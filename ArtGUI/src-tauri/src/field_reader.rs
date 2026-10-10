//! Read-only, bounded access to Artisan.GridField v1 snapshots.
use hdf5::{
    types::{FloatSize, TypeDescriptor, VarLenUnicode},
    File, Group, Hyperslab, SliceOrIndex,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Manager, State};

type Result<T> = std::result::Result<T, String>;
const MAX_FILES: usize = 8;
const MAX_AXIS_VALUES: usize = 2_000_000;
const MAX_SLICE_EDGE: usize = 512;
const MAX_CHUNK_BYTES: usize = 32 * 1024 * 1024;
const IDENTITY: [f64; 16] = [
    1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1.,
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Statistics {
    pub minimum: Option<f64>,
    pub maximum: Option<f64>,
    pub finite_count: u64,
    pub nan_count: u64,
    pub inf_count: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockInfo {
    pub id: u64,
    pub shape: Vec<usize>,
    pub kind: String,
    pub dtype: String,
    pub bounds: Option<Vec<Vec<f64>>>,
    pub transform: Vec<f64>,
    pub statistics: Statistics,
    pub supported: bool,
    pub message: String,
    pub core_bounds: Option<Vec<Vec<f64>>>,
    #[serde(skip)]
    key: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldInfo {
    pub id: String,
    pub source: String,
    pub coordinate_space: String,
    pub coordinate_units: String,
    pub value_units: String,
    pub blocks: Vec<BlockInfo>,
    #[serde(skip)]
    key: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub handle: String,
    pub path: String,
    pub artisan_version: String,
    pub workflow_step: String,
    pub fields: Vec<FieldInfo>,
}
struct Session {
    file: File,
    info: FileInfo,
    axes: Option<(String, [Vec<f64>; 3])>,
}
struct OpenSession {
    data: Mutex<Option<Session>>,
    latest: AtomicU64,
    closed: AtomicBool,
}
#[derive(Clone, Default)]
pub struct FieldFiles {
    files: Arc<Mutex<HashMap<String, Arc<OpenSession>>>>,
    counter: Arc<AtomicU64>,
    // Serializes opening/registering and closing files, including in-flight opens.
    lifecycle: Arc<Mutex<()>>,
    generating: Arc<AtomicBool>,
}

pub struct FieldGenerationGuard {
    generating: Arc<AtomicBool>,
}
impl Drop for FieldGenerationGuard {
    fn drop(&mut self) {
        self.generating.store(false, Ordering::Release);
    }
}
impl OpenSession {
    fn close(&self) -> Result<()> {
        self.closed.store(true, Ordering::Release);
        // A running read owns this lock. Wait for it, then close the HDF5 file
        // even if a queued reader still holds an Arc to this session.
        if let Some(data) = self
            .data
            .lock()
            .map_err(|_| "Field reader unavailable.")?
            .take()
        {
            data.file
                .close()
                .map_err(|e| format!("Could not close field file: {e}"))?;
        }
        Ok(())
    }
}

fn text(group: &Group, name: &str) -> Result<String> {
    group
        .attr(name)
        .and_then(|a| a.read_scalar::<VarLenUnicode>())
        .map(|s| s.as_str().to_owned())
        .map_err(|e| format!("Invalid {name} attribute: {e}"))
}
fn optional_text(group: &Group, name: &str) -> String {
    text(group, name).unwrap_or_default()
}
fn complete(group: &Group) -> Result<()> {
    if !group
        .attr("complete")
        .and_then(|a| a.read_scalar::<bool>())
        .map_err(|e| e.to_string())?
    {
        return Err(
            "The field snapshot is incomplete. Wait for Artisan to finish exporting.".into(),
        );
    }
    Ok(())
}
fn finite(value: f64) -> Option<f64> {
    value.is_finite().then_some(value)
}
fn matrix(group: &Group, name: &str, rows: usize) -> Result<Option<Vec<Vec<f64>>>> {
    if !group
        .attr_names()
        .map_err(|e| e.to_string())?
        .iter()
        .any(|n| n == name)
    {
        return Ok(None);
    }
    let attr = group.attr(name).map_err(|e| e.to_string())?;
    if attr.shape() != [rows, 2] {
        return Err(format!("Invalid {name} shape."));
    }
    let values = attr.read_raw::<f64>().map_err(|e| e.to_string())?;
    if !values.iter().all(|v| v.is_finite()) {
        return Err(format!("Invalid {name} coordinates."));
    }
    Ok(Some(values.chunks_exact(2).map(|v| v.to_vec()).collect()))
}
fn transform(group: &Group, space: &str) -> Result<Vec<f64>> {
    if !group
        .attr_names()
        .map_err(|e| e.to_string())?
        .iter()
        .any(|n| n == "grid_to_model")
    {
        return if space == "model" {
            Ok(IDENTITY.to_vec())
        } else {
            Err("Local coordinates require grid_to_model.".into())
        };
    }
    let attr = group.attr("grid_to_model").map_err(|e| e.to_string())?;
    if attr.shape() != [4, 4] {
        return Err("Invalid grid_to_model shape.".into());
    }
    let m = attr.read_raw::<f64>().map_err(|e| e.to_string())?;
    let det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[1] * (m[4] * m[10] - m[6] * m[8])
        + m[2] * (m[4] * m[9] - m[5] * m[8]);
    if !m.iter().all(|v| v.is_finite())
        || !det.is_finite()
        || det == 0.
        || m[12..] != [0., 0., 0., 1.]
    {
        return Err("Invalid affine grid_to_model transform.".into());
    }
    Ok(m)
}

impl Session {
    fn open(path: &Path, handle: String) -> Result<Self> {
        let path =
            std::fs::canonicalize(path).map_err(|e| format!("Could not open field file: {e}"))?;
        let file = File::open(&path).map_err(|e| format!("Could not read HDF5: {e}"))?;
        let root = file.group("/").map_err(|e| e.to_string())?;
        if text(&root, "format")? != "Artisan.GridField"
            || root
                .attr("format_version")
                .and_then(|a| a.read_scalar::<u64>())
                .map_err(|e| e.to_string())?
                != 1
        {
            return Err("Expected an Artisan.GridField version 1 file.".into());
        }
        complete(&root)?;
        let field_root = file.group("fields").map_err(|e| e.to_string())?;
        let names = field_root.member_names().map_err(|e| e.to_string())?;
        if names.is_empty() || names.len() > 256 {
            return Err("The file must contain between 1 and 256 fields.".into());
        }
        let mut fields = Vec::new();
        let mut total_blocks = 0usize;
        for key in names {
            let group = field_root.group(&key).map_err(|e| e.to_string())?;
            complete(&group)?;
            let id = text(&group, "field_id")?;
            let space = text(&group, "coordinate_space")?;
            if fields.iter().any(|f: &FieldInfo| f.id == id) {
                return Err("Duplicate field IDs in file.".into());
            }
            let blocks_group = group.group("blocks").map_err(|e| e.to_string())?;
            let block_names = blocks_group.member_names().map_err(|e| e.to_string())?;
            total_blocks = total_blocks.saturating_add(block_names.len());
            if block_names.is_empty() || total_blocks > 4096 {
                return Err("Unsupported block count (maximum 4096 per file).".into());
            }
            let mut blocks = Vec::new();
            for block_key in block_names {
                let block = blocks_group.group(&block_key).map_err(|e| e.to_string())?;
                complete(&block)?;
                let values = block.dataset("values").map_err(|e| e.to_string())?;
                let shape = values.shape();
                let descriptor = values
                    .dtype()
                    .and_then(|d| d.to_descriptor())
                    .map_err(|e| e.to_string())?;
                let dtype = match descriptor {
                    TypeDescriptor::Float(FloatSize::U4) => "float32",
                    TypeDescriptor::Float(FloatSize::U8) => "float64",
                    _ => return Err("Field values must be float32 or float64.".into()),
                }
                .to_owned();
                if shape.len() != 3 || shape.contains(&0) {
                    return Err("Field values must have three nonempty dimensions.".into());
                }
                if let Some(chunk) = values.chunk() {
                    if chunk
                        .iter()
                        .try_fold(values.dtype().map_err(|e| e.to_string())?.size(), |a, b| {
                            a.checked_mul(*b)
                        })
                        .unwrap_or(usize::MAX)
                        > MAX_CHUNK_BYTES
                    {
                        return Err("Field chunks exceed the 32 MB reader limit.".into());
                    }
                }
                if text(&block, "axis_order")? != "xyz"
                    || text(&block, "association")? != "point"
                    || text(&block, "buffer_order")? != "C;z-fastest"
                {
                    return Err("Unsupported field ordering or association.".into());
                }
                if block
                    .attr("grid_shape")
                    .and_then(|a| a.read_raw::<usize>())
                    .map_err(|e| e.to_string())?
                    != shape
                {
                    return Err("Grid shape metadata disagrees with values.".into());
                }
                let kind = text(&block, "grid_kind")?;
                let supported = kind == "rectilinear"
                    && shape
                        .iter()
                        .try_fold(0usize, |sum, n| sum.checked_add(*n))
                        .is_some_and(|sum| sum <= MAX_AXIS_VALUES)
                    && shape.iter().all(|s| *s >= 2);
                let message = if kind != "rectilinear" {
                    "Structured/deformed grids need a later viewer update."
                } else if shape.iter().any(|s| *s < 2) {
                    "Slice display needs at least two points on each axis."
                } else if !supported {
                    "Axis vectors exceed the viewer memory limit."
                } else {
                    ""
                }
                .to_owned();
                let bounds = matrix(&block, "bounds", 3)?;
                if supported
                    && bounds
                        .as_ref()
                        .is_none_or(|b| b.iter().any(|axis| axis[1] <= axis[0]))
                {
                    return Err("Rectilinear blocks require increasing coordinate bounds.".into());
                }
                let stats = Statistics {
                    minimum: values
                        .attr("finite_min")
                        .and_then(|a| a.read_scalar::<f64>())
                        .ok()
                        .and_then(finite),
                    maximum: values
                        .attr("finite_max")
                        .and_then(|a| a.read_scalar::<f64>())
                        .ok()
                        .and_then(finite),
                    finite_count: values
                        .attr("finite_count")
                        .and_then(|a| a.read_scalar::<u64>())
                        .unwrap_or(0),
                    nan_count: values
                        .attr("nan_count")
                        .and_then(|a| a.read_scalar::<u64>())
                        .unwrap_or(0),
                    inf_count: values
                        .attr("inf_count")
                        .and_then(|a| a.read_scalar::<u64>())
                        .unwrap_or(0),
                };
                let id = block
                    .attr("block_id")
                    .and_then(|a| a.read_scalar::<u64>())
                    .map_err(|e| e.to_string())?;
                if id > 9_007_199_254_740_991 {
                    return Err("Block ID exceeds the supported integer range.".into());
                }
                if blocks.iter().any(|b: &BlockInfo| b.id == id) {
                    return Err("Duplicate block IDs.".into());
                }
                blocks.push(BlockInfo {
                    id,
                    shape,
                    kind,
                    dtype,
                    bounds,
                    transform: transform(&block, &space)?,
                    statistics: stats,
                    supported,
                    message,
                    core_bounds: matrix(&block, "core_bounds", 3)?,
                    key: block_key,
                });
            }
            blocks.sort_by_key(|b| b.id);
            let expected = group
                .attr("block_count")
                .and_then(|a| a.read_scalar::<u64>())
                .map_err(|e| e.to_string())?;
            if expected != blocks.len() as u64 {
                return Err("Incomplete field block list.".into());
            }
            fields.push(FieldInfo {
                id,
                source: optional_text(&group, "source"),
                coordinate_space: space,
                coordinate_units: optional_text(&group, "coordinate_units"),
                value_units: optional_text(&group, "value_units"),
                blocks,
                key,
            });
        }
        fields.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(Self {
            info: FileInfo {
                handle,
                path: path.to_string_lossy().into_owned(),
                artisan_version: optional_text(&root, "artisan_version"),
                workflow_step: optional_text(&root, "workflow_step"),
                fields,
            },
            file,
            axes: None,
        })
    }
    fn block(&self, field_id: &str, block_id: u64) -> Result<(FieldInfo, BlockInfo)> {
        let field = self
            .info
            .fields
            .iter()
            .find(|f| f.id == field_id)
            .ok_or("Unknown field ID.")?;
        let block = field
            .blocks
            .iter()
            .find(|b| b.id == block_id)
            .ok_or("Unknown block ID.")?;
        if !block.supported {
            return Err(block.message.clone());
        }
        Ok((field.clone(), block.clone()))
    }
    fn axes(&mut self, field: &FieldInfo, block: &BlockInfo) -> Result<&[Vec<f64>; 3]> {
        let key = format!("fields/{}/blocks/{}", field.key, block.key);
        if self.axes.as_ref().is_none_or(|a| a.0 != key) {
            let group = self.file.group(&key).map_err(|e| e.to_string())?;
            let mut axes = [Vec::new(), Vec::new(), Vec::new()];
            for (i, name) in ["x", "y", "z"].iter().enumerate() {
                let dataset = group.dataset(name).map_err(|e| e.to_string())?;
                if dataset.shape() != [block.shape[i]] {
                    return Err("Axis length disagrees with grid values.".into());
                }
                let values = dataset.read_raw::<f64>().map_err(|e| e.to_string())?;
                if !values.iter().all(|v| v.is_finite()) || !values.windows(2).all(|v| v[1] > v[0])
                {
                    return Err("Axes must contain finite, strictly increasing coordinates.".into());
                }
                if let Some(bounds) = &block.bounds {
                    if values[0] != bounds[i][0] || *values.last().unwrap() != bounds[i][1] {
                        return Err("Axis coordinates disagree with saved bounds.".into());
                    }
                }
                axes[i] = values;
            }
            self.axes = Some((key, axes));
        }
        Ok(&self.axes.as_ref().unwrap().1)
    }
    fn slice(&mut self, request: &SliceRequest, token: &OpenSession) -> Result<Vec<u8>> {
        let (field, block) = self.block(&request.field_id, request.block_id)?;
        if request.axis > 2
            || !request.position.is_finite()
            || !(2..=MAX_SLICE_EDGE).contains(&request.max_edge)
        {
            return Err("Invalid slice request.".into());
        }
        check_request(token, request.request_id)?;
        let axes = self.axes(&field, &block)?;
        let fixed = nearest(&axes[request.axis], request.position)?;
        let varying: Vec<usize> = (0..3).filter(|i| *i != request.axis).collect();
        let strides: Vec<usize> = varying
            .iter()
            .map(|i| (axes[*i].len() - 1).div_ceil(request.max_edge - 1).max(1))
            .collect();
        let samples: Vec<Vec<usize>> = varying
            .iter()
            .zip(&strides)
            .map(|(i, s)| (0..axes[*i].len()).step_by(*s).collect())
            .collect();
        let coordinates: Vec<Vec<f64>> = varying
            .iter()
            .zip(&samples)
            .map(|(i, s)| s.iter().map(|j| axes[*i][*j]).collect())
            .collect();
        let position = axes[request.axis][fixed];
        let header = serde_json::json!({"version":1,"axis":request.axis,"index":fixed,"position":position,"varying":varying,"coordinates":coordinates,"shape":[samples[0].len(),samples[1].len()],"sampled":strides.iter().any(|s|*s>1),"transform":block.transform,"fieldId":field.id,"blockId":block.id});
        let header = serde_json::to_vec(&header).map_err(|e| e.to_string())?;
        let mut out =
            Vec::with_capacity(4 + header.len() + samples[0].len() * samples[1].len() * 8);
        out.extend_from_slice(&(header.len() as u32).to_le_bytes());
        out.extend_from_slice(&header);
        let dataset = self
            .file
            .dataset(&format!("fields/{}/blocks/{}/values", field.key, block.key))
            .map_err(|e| e.to_string())?;
        // Bounded strips let newer requests cancel between HDF5 calls.
        for start in (0..samples[0].len()).step_by(32) {
            check_request(token, request.request_id)?;
            let mut selection = vec![SliceOrIndex::Index(0); 3];
            selection[request.axis] = SliceOrIndex::Index(fixed);
            selection[varying[0]] = SliceOrIndex::SliceCount {
                start: samples[0][start],
                step: strides[0],
                count: 32.min(samples[0].len() - start),
                block: 1,
            };
            selection[varying[1]] = SliceOrIndex::SliceCount {
                start: 0,
                step: strides[1],
                count: samples[1].len(),
                block: 1,
            };
            let values = dataset
                .read_slice_2d::<f64, _>(Hyperslab::from(selection))
                .map_err(|e| e.to_string())?;
            for value in values {
                out.extend_from_slice(&value.to_le_bytes());
            }
        }
        check_request(token, request.request_id)?;
        Ok(out)
    }
    fn probe(&mut self, field_id: &str, block_id: u64, point: [f64; 3]) -> Result<ProbeInfo> {
        let (field, block) = self.block(field_id, block_id)?;
        let axes = self.axes(&field, &block)?;
        let indices = [
            nearest(&axes[0], point[0])?,
            nearest(&axes[1], point[1])?,
            nearest(&axes[2], point[2])?,
        ];
        let coordinates = [
            axes[0][indices[0]],
            axes[1][indices[1]],
            axes[2][indices[2]],
        ];
        let selection: Vec<SliceOrIndex> = indices
            .iter()
            .map(|i| SliceOrIndex::SliceCount {
                start: *i,
                step: 1,
                count: 1,
                block: 1,
            })
            .collect();
        let value = self
            .file
            .dataset(&format!("fields/{}/blocks/{}/values", field.key, block.key))
            .and_then(|d| d.read_slice::<f64, _, ndarray::IxDyn>(Hyperslab::from(selection)))
            .map_err(|e| e.to_string())?[ndarray::IxDyn(&[0, 0, 0])];
        let kind = if value.is_nan() {
            "NaN"
        } else if value == f64::INFINITY {
            "+Infinity"
        } else if value == f64::NEG_INFINITY {
            "-Infinity"
        } else {
            "finite"
        }
        .to_owned();
        Ok(ProbeInfo {
            indices,
            coordinates,
            model_coordinates: apply_transform(&block.transform, coordinates),
            value: finite(value),
            kind,
            dtype: block.dtype,
        })
    }
}

fn nearest(axis: &[f64], point: f64) -> Result<usize> {
    if !point.is_finite()
        || point < axis[0] - f64::EPSILON * axis[0].abs().max(1.) * 32.
        || point > *axis.last().unwrap() + f64::EPSILON * axis.last().unwrap().abs().max(1.) * 32.
    {
        return Err("Point lies outside the selected block.".into());
    }
    let i = axis.partition_point(|v| *v < point);
    if i == 0 {
        Ok(0)
    } else if i == axis.len() || point - axis[i - 1] <= axis[i] - point {
        Ok(i - 1)
    } else {
        Ok(i)
    }
}
fn apply_transform(m: &[f64], p: [f64; 3]) -> [f64; 3] {
    std::array::from_fn(|i| {
        m[4 * i] * p[0] + m[4 * i + 1] * p[1] + m[4 * i + 2] * p[2] + m[4 * i + 3]
    })
}
fn check_request(session: &OpenSession, id: u64) -> Result<()> {
    if session.closed.load(Ordering::Acquire) || session.latest.load(Ordering::Acquire) != id {
        Err("Field request cancelled.".into())
    } else {
        Ok(())
    }
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SliceRequest {
    pub field_id: String,
    pub block_id: u64,
    pub axis: usize,
    pub position: f64,
    pub max_edge: usize,
    pub request_id: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeInfo {
    indices: [usize; 3],
    coordinates: [f64; 3],
    model_coordinates: [f64; 3],
    value: Option<f64>,
    kind: String,
    dtype: String,
}

impl FieldFiles {
    fn open(&self, path: &Path) -> Result<FileInfo> {
        let _lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| "Field file state unavailable.")?;
        if self.generating.load(Ordering::Acquire) {
            return Err("Field files are closed while Artisan is generating. Open the field after the run finishes.".into());
        }
        let handle = format!("field-{}", self.counter.fetch_add(1, Ordering::Relaxed));
        let count = self
            .files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .len();
        if count >= MAX_FILES {
            return Err("Close a field file before opening another (maximum 8).".into());
        }
        let session = Session::open(path, handle.clone())?;
        let info = session.info.clone();
        self.files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .insert(
                handle,
                Arc::new(OpenSession {
                    data: Mutex::new(Some(session)),
                    latest: AtomicU64::new(0),
                    closed: AtomicBool::new(false),
                }),
            );
        Ok(info)
    }
    fn close(&self, handle: &str) -> Result<()> {
        let _lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| "Field file state unavailable.")?;
        let file = self
            .files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .get(handle)
            .cloned();
        if let Some(file) = file {
            file.close()?;
        }
        self.files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .remove(handle);
        Ok(())
    }
    pub fn prepare_generation(&self) -> Result<FieldGenerationGuard> {
        let _lifecycle = self
            .lifecycle
            .lock()
            .map_err(|_| "Field file state unavailable.")?;
        self.generating
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "Artisan is already using the field output files.")?;
        let guard = FieldGenerationGuard {
            generating: self.generating.clone(),
        };
        let files: Vec<_> = self
            .files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .values()
            .cloned()
            .collect();
        // Cancel every read before waiting for any one reader to finish.
        for file in &files {
            file.closed.store(true, Ordering::Release);
        }
        for file in &files {
            file.close()?;
        }
        self.files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .clear();
        Ok(guard)
    }
    fn get(&self, handle: &str) -> Result<Arc<OpenSession>> {
        self.files
            .lock()
            .map_err(|_| "Field file state unavailable.")?
            .get(handle)
            .cloned()
            .ok_or_else(|| "Field file was closed.".into())
    }
}
#[tauri::command]
pub fn choose_field_file() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("HDF5 fields", &["h5", "hdf5"])
        .pick_file()
        .map(|p| p.to_string_lossy().into_owned())
}
#[tauri::command]
pub fn choose_result() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter(
            "Meshes and HDF5 fields",
            &["stl", "obj", "ply", "inp", "h5", "hdf5"],
        )
        .pick_file()
        .map(|p| p.to_string_lossy().into_owned())
}
// Mesh and field exports use the same workflow working-directory rules.
#[tauri::command]
pub fn resolve_export_output(
    app: tauri::AppHandle,
    path: String,
    workflow_path: Option<String>,
    backend_path: Option<String>,
    json_work_dir: serde_json::Value,
) -> Result<String> {
    resolve_field_output(app, path, workflow_path, backend_path, json_work_dir)
}
#[tauri::command]
pub fn resolve_field_output(
    app: tauri::AppHandle,
    path: String,
    workflow_path: Option<String>,
    backend_path: Option<String>,
    json_work_dir: serde_json::Value,
) -> Result<String> {
    let given = std::path::PathBuf::from(path);
    let resolved = if given.is_absolute() {
        given
    } else {
        let executable = backend_path.map(std::path::PathBuf::from).or_else(|| {
            app.path()
                .resource_dir()
                .ok()
                .map(|r| r.join("artisan/ArtisanMain.exe"))
        });
        let working = executable
            .as_deref()
            .and_then(|p| super::find_backend_root(p).ok().map(|r| r.1))
            .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
        let directory = match json_work_dir {
            serde_json::Value::Bool(true) => workflow_path
                .as_deref()
                .and_then(|p| Path::new(p).parent())
                .filter(|p| p.is_dir())
                .ok_or("Save the workflow before viewing its relative output.")?
                .to_path_buf(),
            serde_json::Value::String(p) => {
                let p = std::path::PathBuf::from(p);
                let p = if p.is_absolute() { p } else { working.join(p) };
                if p.is_dir() {
                    p
                } else {
                    working
                }
            }
            serde_json::Value::Null => app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .join("runs"),
            _ => working,
        };
        directory.join(given)
    };
    if !resolved.is_file() {
        return Err(format!(
            "Exported file was not found: {}. Generate the workflow or open another file.",
            resolved.display()
        ));
    }
    std::fs::canonicalize(resolved)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn open_field_file(path: String, state: State<'_, FieldFiles>) -> Result<FileInfo> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.open(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn read_field_slice(
    handle: String,
    request: SliceRequest,
    state: State<'_, FieldFiles>,
) -> Result<tauri::ipc::Response> {
    let session = state.get(&handle)?;
    session
        .latest
        .fetch_max(request.request_id, Ordering::AcqRel);
    tauri::async_runtime::spawn_blocking(move || {
        let mut data = session
            .data
            .lock()
            .map_err(|_| "Field reader unavailable.")?;
        data.as_mut()
            .ok_or("Field file was closed.")?
            .slice(&request, &session)
            .map(tauri::ipc::Response::new)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn probe_field(
    handle: String,
    field_id: String,
    block_id: u64,
    point: [f64; 3],
    state: State<'_, FieldFiles>,
) -> Result<ProbeInfo> {
    let session = state.get(&handle)?;
    tauri::async_runtime::spawn_blocking(move || {
        if session.closed.load(Ordering::Acquire) {
            return Err("Field file was closed.".into());
        }
        session
            .data
            .lock()
            .map_err(|_| "Field reader unavailable.")?
            .as_mut()
            .ok_or("Field file was closed.")?
            .probe(&field_id, block_id, point)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn cancel_field_request(
    handle: String,
    request_id: u64,
    state: State<'_, FieldFiles>,
) -> Result<()> {
    state
        .get(&handle)?
        .latest
        .fetch_max(request_id, Ordering::AcqRel);
    Ok(())
}
#[tauri::command]
pub async fn close_field_file(handle: String, state: State<'_, FieldFiles>) -> Result<()> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.close(&handle))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(name: &str) -> Session {
        Session::open(
            &Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("tests/fixtures")
                .join(name),
            "test".into(),
        )
        .unwrap()
    }
    fn token() -> OpenSession {
        OpenSession {
            data: Mutex::new(Some(fixture("regular.h5"))),
            latest: AtomicU64::new(1),
            closed: AtomicBool::new(false),
        }
    }
    struct TemporaryField(std::path::PathBuf);
    impl TemporaryField {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "artgui-field-release-{}-{}.h5",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            let result = Self(path);
            result.restore();
            result
        }
        fn restore(&self) {
            std::fs::copy(
                Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/regular.h5"),
                &self.0,
            )
            .unwrap();
        }
    }
    impl Drop for TemporaryField {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    #[test]
    fn generation_closes_all_files_before_overwrite_and_blocks_reopening() {
        let first = TemporaryField::new();
        let second = TemporaryField::new();
        let files = FieldFiles::default();
        let a = files.open(&first.0).unwrap();
        let b = files.open(&second.0).unwrap();
        // Retained Arcs simulate readers queued before Generate was clicked.
        let retained = [files.get(&a.handle).unwrap(), files.get(&b.handle).unwrap()];
        let guard = files.prepare_generation().unwrap();
        for (path, session) in [&first.0, &second.0].into_iter().zip(&retained) {
            assert!(session.closed.load(Ordering::Acquire));
            assert!(session.data.lock().unwrap().is_none());
            File::create(path)
                .expect("Artisan must be able to overwrite the output")
                .close()
                .unwrap();
            assert!(files.open(path).err().unwrap().contains("generating"));
        }
        assert!(files.get(&a.handle).is_err());
        assert!(files.prepare_generation().is_err());
        assert!(files.generating.load(Ordering::Acquire));
        // Dropping the run guard also covers early errors/cancelled runs.
        drop(guard);
        first.restore();
        let reopened = files.open(&first.0).unwrap();
        files.close(&reopened.handle).unwrap();
    }
    #[test]
    fn generation_waits_for_active_read_and_invalidates_queued_read() {
        use std::{
            sync::mpsc,
            thread,
            time::{Duration, Instant},
        };
        let path = TemporaryField::new();
        let files = FieldFiles::default();
        let info = files.open(&path.0).unwrap();
        let reader = files.get(&info.handle).unwrap();
        let active_read = reader.data.lock().unwrap();
        let worker_files = files.clone();
        let (tx, rx) = mpsc::channel();
        let worker = thread::spawn(move || tx.send(worker_files.prepare_generation()).unwrap());
        let deadline = Instant::now() + Duration::from_secs(5);
        while !reader.closed.load(Ordering::Acquire) {
            assert!(
                Instant::now() < deadline,
                "Generate did not cancel the active read"
            );
            thread::yield_now();
        }
        assert!(
            matches!(
                rx.recv_timeout(Duration::from_millis(50)),
                Err(mpsc::RecvTimeoutError::Timeout)
            ),
            "Artisan must not start until the active read releases its file"
        );
        drop(active_read);
        let guard = rx.recv_timeout(Duration::from_secs(5)).unwrap().unwrap();
        worker.join().unwrap();
        assert!(reader.data.lock().unwrap().is_none());
        assert!(check_request(&reader, 0).is_err());
        File::create(&path.0).unwrap().close().unwrap();
        drop(guard);
    }
    #[test]
    fn closing_a_file_releases_the_handle_even_with_a_retained_reader() {
        let path = TemporaryField::new();
        let files = FieldFiles::default();
        let info = files.open(&path.0).unwrap();
        let retained = files.get(&info.handle).unwrap();
        files.close(&info.handle).unwrap();
        files.close(&info.handle).unwrap();
        assert!(retained.data.lock().unwrap().is_none());
        File::create(&path.0).unwrap().close().unwrap();
    }
    #[test]
    fn actual_artisan_export_opens() {
        let f = fixture("artisan-export.h5");
        assert!(f.info.fields.iter().any(|f| f.id == "SizeField"));
        assert!(f.info.fields.iter().any(|f| f.id == "lattice"));
        assert_eq!(f.info.fields[0].blocks[0].shape, vec![22, 22, 22]);
    }
    #[test]
    fn nonuniform_axes_and_float64_probe() {
        let mut f = fixture("regular.h5");
        let p = f.probe("stress/σ", 0, [1.2, 3., 4.]).unwrap();
        assert_eq!(p.indices, [1, 1, 1]);
        assert_eq!(p.coordinates, [1., 2., 4.]);
        assert_eq!(p.value, Some(21.1234567890123));
        assert_eq!(p.model_coordinates, [12., 26., 46.]);
    }
    #[test]
    fn every_axis_slice_uses_xyz_order() {
        let t = token();
        for axis in 0..3 {
            let mut f = fixture("regular.h5");
            let p = [1., 2., 4.][axis];
            let data = f
                .slice(
                    &SliceRequest {
                        field_id: "stress/σ".into(),
                        block_id: 0,
                        axis,
                        position: p,
                        max_edge: 512,
                        request_id: 1,
                    },
                    &t,
                )
                .unwrap();
            let length = u32::from_le_bytes(data[..4].try_into().unwrap()) as usize;
            let header: serde_json::Value = serde_json::from_slice(&data[4..4 + length]).unwrap();
            assert_eq!(header["index"], 1);
            let values: Vec<f64> = data[4 + length..]
                .chunks_exact(8)
                .map(|b| f64::from_le_bytes(b.try_into().unwrap()))
                .collect();
            let shape = [3, 4, 5];
            let varying: Vec<_> = (0..3).filter(|i| *i != axis).collect();
            assert_eq!(values.len(), shape[varying[0]] * shape[varying[1]]);
            for i in 0..shape[varying[0]] {
                for j in 0..shape[varying[1]] {
                    let mut index = [0, 0, 0];
                    index[axis] = 1;
                    index[varying[0]] = i;
                    index[varying[1]] = j;
                    let expected = 10. * [0., 1., 4.][index[0]]
                        + [0., 2., 7., 9.][index[1]]
                        + [0., 4., 5., 8., 11.][index[2]]
                        + (if index == [1, 1, 1] {
                            5.1234567890123
                        } else {
                            0.
                        });
                    assert!((values[i * shape[varying[1]] + j] - expected).abs() < 1e-5);
                }
            }
        }
    }
    #[test]
    fn billion_values_are_read_as_a_bounded_slice() {
        let mut f = fixture("billion.h5");
        assert_eq!(f.info.fields[0].blocks[0].shape, vec![1000; 3]);
        let data = f
            .slice(
                &SliceRequest {
                    field_id: "large".into(),
                    block_id: 0,
                    axis: 2,
                    position: 500.,
                    max_edge: 128,
                    request_id: 1,
                },
                &token(),
            )
            .unwrap();
        assert!(data.len() < 200_000);
        assert_eq!(
            f.probe("large", 0, [10., 20., 30.]).unwrap().value,
            Some(42.)
        );
    }
    #[test]
    fn invalid_and_cancelled_requests_are_rejected() {
        let mut f = fixture("regular.h5");
        assert!(f.probe("stress/σ", 99, [0.; 3]).is_err());
        assert!(f.probe("missing", 0, [0.; 3]).is_err());
        assert!(f.probe("stress/σ", 0, [-1., 0., 0.]).is_err());
        let t = token();
        t.latest.store(2, Ordering::Release);
        assert!(f
            .slice(
                &SliceRequest {
                    field_id: "stress/σ".into(),
                    block_id: 0,
                    axis: 0,
                    position: 1.,
                    max_edge: 128,
                    request_id: 1
                },
                &t
            )
            .unwrap_err()
            .contains("cancelled"));
        assert!(Session::open(
            &Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/incomplete.h5"),
            "x".into()
        )
        .is_err());
    }
    #[test]
    fn nonfinite_probes_have_json_safe_labels() {
        let mut f = fixture("nonfinite.h5");
        let p = f.probe("special", 0, [0.; 3]).unwrap();
        assert_eq!(p.kind, "NaN");
        assert_eq!(p.value, None);
        assert!(serde_json::to_string(&p).unwrap().contains("null"));
        assert_eq!(
            f.probe("special", 0, [1., 0., 0.]).unwrap().kind,
            "+Infinity"
        );
    }
    #[test]
    fn partition_blocks_read_original_values() {
        let mut f = fixture("partitioned.h5");
        let fields = f.info.fields.clone();
        let mut tested = 0;
        for field in fields {
            for block in field.blocks {
                let bounds = block.bounds.as_ref().unwrap();
                let point = std::array::from_fn(|i| bounds[i][0]);
                let probe = f.probe(&field.id, block.id, point).unwrap();
                assert_eq!(probe.indices, [0, 0, 0]);
                let data = f
                    .slice(
                        &SliceRequest {
                            field_id: field.id.clone(),
                            block_id: block.id,
                            axis: 2,
                            position: point[2],
                            max_edge: 128,
                            request_id: 1,
                        },
                        &token(),
                    )
                    .unwrap();
                assert!(!data.is_empty());
                tested += 1;
            }
        }
        assert!(tested >= 2);
    }
    #[test]
    fn structured_grid_is_reported_as_unsupported() {
        let mut f = fixture("structured.h5");
        let b = &f.info.fields[0].blocks[0];
        assert!(!b.supported);
        assert!(b.message.contains("Structured"));
        assert!(f
            .probe("stress/σ", 0, [0.; 3])
            .err()
            .unwrap()
            .contains("Structured"));
    }
    // A local browser QA server uses this test-only bridge to exercise the real Rust reader.
    #[test]
    fn browser_bridge() {
        let Ok(input) = std::env::var("ARTGUI_FIELD_QA_JSON") else {
            return;
        };
        let request: serde_json::Value = serde_json::from_str(&input).unwrap();
        let mut session =
            Session::open(Path::new(request["path"].as_str().unwrap()), "qa".into()).unwrap();
        let result = match request["command"].as_str().unwrap() {
            "open" => serde_json::to_vec(&session.info).unwrap(),
            "slice" => {
                let slice: SliceRequest =
                    serde_json::from_value(request["request"].clone()).unwrap();
                let t = token();
                t.latest.store(slice.request_id, Ordering::Release);
                session.slice(&slice, &t).unwrap()
            }
            "probe" => serde_json::to_vec(
                &session
                    .probe(
                        request["fieldId"].as_str().unwrap(),
                        request["blockId"].as_u64().unwrap(),
                        serde_json::from_value(request["point"].clone()).unwrap(),
                    )
                    .unwrap(),
            )
            .unwrap(),
            _ => panic!("Unknown QA command"),
        };
        std::fs::write(std::env::var("ARTGUI_FIELD_QA_OUTPUT").unwrap(), result).unwrap();
    }
}
