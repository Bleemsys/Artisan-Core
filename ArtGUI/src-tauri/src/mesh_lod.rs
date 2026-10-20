//! Spatially distributed surface samples, stored as a small octree sidecar to v1 mesh caches.
//! Original triangle blocks are reused. No mesh or point cloud is loaded in its entirety.
use crate::{mesh_preview::MeshPreview, mesh_stream::Primitive};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::State;

type Result<T> = std::result::Result<T, String>;
const LOD_VERSION: u32 = 2;
const FINE: usize = 128;
const NODE_GRID: usize = 8;
pub const RECORD_BYTES: usize = 28;
const MAGIC: &[u8; 8] = b"ARTLOD2\0";
static BUILD_LOCK: Mutex<()> = Mutex::new(());
static NEXT_HANDLE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LodNode {
    pub id: usize,
    pub parent: Option<usize>,
    pub children: Vec<usize>,
    pub level: usize,
    pub count: usize,
    pub offset: u64,
    pub min: [f32; 3],
    pub max: [f32; 3],
    pub spacing: f32,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LodInfo {
    pub version: u32,
    pub data_path: String,
    pub byte_len: u64,
    pub roots: Vec<usize>,
    pub nodes: Vec<LodNode>,
    #[serde(default)]
    pub tile_cells: Vec<u32>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub handle: String,
}

struct LodSession {
    file: Mutex<File>,
    info: LodInfo,
}

#[derive(Clone, Default)]
pub struct LodFiles(Arc<Mutex<HashMap<String, Arc<LodSession>>>>);

impl LodFiles {
    pub fn close_all(&self) -> Result<()> {
        self.0.lock().map_err(|_| "Preview sessions are unavailable.")?.clear();
        Ok(())
    }

    pub fn open(&self, info: &mut LodInfo) -> Result<()> {
        let file = File::open(&info.data_path).map_err(|e| e.to_string())?;
        let mut sessions = self.0.lock().map_err(|_| "Preview sessions are unavailable.")?;
        if sessions.len() >= 64 {
            return Err("Close an unused preview before opening another model.".into());
        }
        let handle = format!("surface-lod-{}", NEXT_HANDLE.fetch_add(1, Ordering::Relaxed));
        info.handle = handle.clone();
        sessions.insert(handle, Arc::new(LodSession { file: Mutex::new(file), info: info.clone() }));
        Ok(())
    }
}

#[tauri::command]
pub async fn read_preview_lod(handle: String, node_id: usize, state: State<'_, LodFiles>) -> Result<tauri::ipc::Response> {
    let readers = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _access = crate::scratch::ACCESS.read().map_err(|_| "Preview cache is unavailable.")?;
        let session = readers.0.lock().map_err(|_| "Preview sessions are unavailable.")?
            .get(&handle).cloned().ok_or("This preview has been closed. Open Preview again.")?;
        let node = session.info.nodes.get(node_id).ok_or("Unknown preview level.")?;
        let mut file = session.file.lock().map_err(|_| "Preview data is unavailable.")?;
        let bytes = read_node(&mut file, node, session.info.byte_len)?;
        Ok(tauri::ipc::Response::new(bytes))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn close_preview_lod(handle: String, state: State<'_, LodFiles>) {
    if let Ok(mut sessions) = state.0.lock() { sessions.remove(&handle); }
}

pub fn read_node(file: &mut File, node: &LodNode, length: u64) -> Result<Vec<u8>> {
    let size = node.count.checked_mul(RECORD_BYTES).ok_or("Invalid sample count.")?;
    if node.count > NODE_GRID.pow(3) || node.offset < 8 || node.offset.checked_add(size as u64).is_none_or(|end| end > length) {
        return Err("Invalid preview block range.".into());
    }
    let mut bytes = vec![0; size];
    file.seek(SeekFrom::Start(node.offset)).map_err(|e| e.to_string())?;
    file.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    for record in bytes.chunks_exact(RECORD_BYTES) {
        for value in record.chunks_exact(4) {
            if !f32::from_le_bytes(value.try_into().unwrap()).is_finite() { return Err("Invalid surface sample.".into()); }
        }
        if f32::from_le_bytes(record[24..28].try_into().unwrap()) <= 0. { return Err("Invalid sample radius.".into()); }
    }
    Ok(bytes)
}

fn sidecar_path(dir: &Path) -> PathBuf { dir.join("surface-lod-v2.json") }

pub fn load(dir: &Path) -> Option<LodInfo> {
    let path = sidecar_path(dir);
    if fs::metadata(&path).ok()?.len() > 8 * 1024 * 1024 { return None; }
    let mut info: LodInfo = serde_json::from_slice(&fs::read(path).ok()?).ok()?;
    if info.version != LOD_VERSION || info.nodes.is_empty() || info.nodes.len() > 4681 || info.roots != [0] || info.tile_cells.iter().any(|&cell|cell>=4096) { return None; }
    let data = dir.join("surface-lod-v2.bin");
    if fs::metadata(&data).ok()?.len() != info.byte_len { return None; }
    let mut input = File::open(&data).ok()?;
    let mut magic = [0; 8]; input.read_exact(&mut magic).ok()?;
    if magic != *MAGIC { return None; }
    let mut end = 8;
    for (id, node) in info.nodes.iter().enumerate() {
        if node.id != id || node.count == 0 || node.count > NODE_GRID.pow(3) || node.offset != end || node.level > 4 || !node.spacing.is_finite() || node.spacing <= 0. { return None; }
        if node.min.iter().chain(&node.max).any(|x| !x.is_finite()) { return None; }
        if (0..3).any(|a| node.min[a] > node.max[a]) { return None; }
        if node.children.len() > 8 || node.children.iter().any(|&child| info.nodes.get(child).is_none_or(|c| c.parent != Some(id) || c.level != node.level + 1)) { return None; }
        if id == 0 && (node.parent.is_some() || node.level != 0) { return None; }
        if id != 0 && node.parent.is_none_or(|p| p >= id || !info.nodes[p].children.contains(&id)) { return None; }
        end += (node.count * RECORD_BYTES) as u64;
    }
    if end != info.byte_len { return None; }
    info.data_path = data.to_string_lossy().into_owned(); info.handle.clear();
    Some(info)
}

pub fn ensure(dir: &Path, model: &MeshPreview, cancel: &AtomicBool, mut progress: impl FnMut(u64, u64) -> Result<()>) -> Result<Option<LodInfo>> {
    if model.triangles + model.lines <= 120_000 { return Ok(None); }
    if let Some(info) = load(dir).filter(|i|i.tile_cells.len()==model.tiles.len()) { return Ok(Some(info)); }
    // One hierarchy builder at a time bounds aggregate RAM, including cancelled jobs.
    let _lock = BUILD_LOCK.lock().map_err(|_| "Preview hierarchy builder is unavailable.")?;
    if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
    if let Some(info) = load(dir).filter(|i|i.tile_cells.len()==model.tiles.len()) { return Ok(Some(info)); }
    let lower = std::array::from_fn(|a| model.bounds_min[a] as f64 - model.center[a] as f64);
    let width = (0..3).map(|a| model.bounds_max[a] as f64 - model.bounds_min[a] as f64).fold(0., f64::max).max(1e-20);
    let mut grid = Grid::new(FINE, lower, width);
    let total = model.triangles + model.lines; let mut processed = 0;let mut tile_cells=Vec::with_capacity(model.tiles.len());
    for tile in &model.tiles {
        let path = dir.join(format!("tile-{}.bin", tile.id));
        let mut input = BufReader::with_capacity(1024 * 1024, File::open(path).map_err(|e| e.to_string())?);
        let record_len = tile.vertices * 12;
        if record_len != 24 && record_len != 36 { return Err("Unsupported preview primitive.".into()); }
        for index in 0..tile.count {
            if processed % 256 == 0 && cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
            if processed % 32768 == 0 {
                if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
                progress(processed, total)?;
            }
            let mut data = [0; 36]; input.read_exact(&mut data[..record_len]).map_err(|e| e.to_string())?;
            let mut points = [[0.; 3]; 3];
            for v in 0..tile.vertices { for a in 0..3 {
                let at = v * 12 + a * 4;
                points[v][a] = f32::from_le_bytes(data[at..at+4].try_into().unwrap());
                if !points[v][a].is_finite() { return Err("Invalid cached mesh coordinate.".into()); }
            }}
            if index==0{
                let cell=tile.cell.unwrap_or_else(||{
                    let mut key=0;
                    for a in 0..3{let p=points[..tile.vertices].iter().map(|v|v[a]as f64+model.center[a]as f64).sum::<f64>()/tile.vertices as f64;let span=model.bounds_max[a]as f64-model.bounds_min[a]as f64;let at=if span>0.{((p-model.bounds_min[a]as f64)/span*16.).floor().clamp(0.,15.)as u32}else{0};key=key*16+at;}key
                });tile_cells.push(cell);
            }
            grid.insert_primitive(Primitive { points, vertices: tile.vertices }); processed += 1;
        }
    }
    progress(total, total)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp = dir.join(format!("surface-lod-v2-building-{stamp}.bin"));
    let temp_index = dir.join(format!("surface-lod-v2-building-{stamp}.json"));
    let result = (|| {
        let mut levels = vec![grid];
        while levels.last().unwrap().resolution > NODE_GRID {
            if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
            levels.push(levels.last().unwrap().coarsen());
        }
        levels.reverse();
        let mut info = write_levels(&temp, &levels)?;info.tile_cells=tile_cells;
        if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
        fs::write(&temp_index, serde_json::to_vec(&info).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        let final_data = dir.join("surface-lod-v2.bin");
        // An invalid earlier sidecar is display data owned by this source cache.
        if final_data.exists() { fs::remove_file(&final_data).map_err(|e| e.to_string())?; }
        fs::rename(&temp, &final_data).map_err(|e| e.to_string())?;
        if sidecar_path(dir).exists() { fs::remove_file(sidecar_path(dir)).map_err(|e| e.to_string())?; }
        fs::rename(&temp_index, sidecar_path(dir)).map_err(|e| e.to_string())?;
        load(dir).ok_or_else(|| "The overview hierarchy could not be verified.".into())
    })();
    if result.is_err() { let _ = fs::remove_file(temp); let _ = fs::remove_file(temp_index); }
    result.map(Some)
}

#[derive(Clone, Copy)]
struct Cell { position: [f32; 3], normal: [f32; 3], score: f32, occupied: u32 }
impl Default for Cell { fn default() -> Self { Self { position: [0.; 3], normal: [0.; 3], score: f32::INFINITY, occupied: 0 } } }

struct Grid { resolution: usize, lower: [f64; 3], width: f64, cells: Vec<Cell> }
impl Grid {
    fn new(resolution: usize, lower: [f64; 3], width: f64) -> Self {
        Self { resolution, lower, width, cells: vec![Cell::default(); resolution.pow(3)] }
    }
    fn spacing(&self) -> f64 { self.width / self.resolution as f64 }
    fn coordinate(&self, p: [f32; 3]) -> ([usize; 3], [f64; 3]) {
        let scale = self.resolution as f64 / self.width;
        let q = std::array::from_fn(|a| (p[a] as f64 - self.lower[a]) * scale);
        (std::array::from_fn(|a| q[a].floor().clamp(0., (self.resolution - 1) as f64) as usize), q)
    }
    fn insert(&mut self, p: [f32; 3], normal: [f32; 3]) {
        let (at, q) = self.coordinate(p);
        let index = (at[0] * self.resolution + at[1]) * self.resolution + at[2];
        let score = (0..3).map(|a| (q[a] - at[a] as f64 - 0.5).powi(2)).sum::<f64>() as f32;
        let cell = &mut self.cells[index];
        if score < cell.score { *cell = Cell { position: p, normal, score, occupied: 1 }; }
    }
    fn insert_primitive(&mut self, p: Primitive) {
        let a = p.points[0].map(f64::from); let b = p.points[1].map(f64::from); let c = p.points[2].map(f64::from);
        let ab: [f64; 3] = std::array::from_fn(|i| b[i]-a[i]);
        let ac: [f64; 3] = std::array::from_fn(|i| c[i]-a[i]);
        let cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
        let length = cross.iter().map(|x| x*x).sum::<f64>().sqrt();
        let normal = if p.vertices == 3 && length > 1e-30 { cross.map(|x| (x/length) as f32) } else { [0., 0., 1.] };
        let max_edge = if p.vertices == 2 { ab.iter().map(|x| x*x).sum::<f64>().sqrt() } else {
            (0..3).map(|i| (0..3).map(|j| (p.points[i][j] as f64-p.points[(i+1)%3][j] as f64).powi(2)).sum::<f64>().sqrt()).fold(0., f64::max)
        };
        let n = (max_edge / self.spacing() * 1.5).ceil().clamp(1., 384.) as usize;
        if n == 1 {
            let center = std::array::from_fn(|i| (p.points[..p.vertices].iter().map(|v| v[i] as f64).sum::<f64>() / p.vertices as f64) as f32);
            self.insert(center, normal);
            let cell = self.coordinate(center).0;
            for &point in &p.points[..p.vertices] { if self.coordinate(point).0 != cell { self.insert(point, normal); } }
        } else if p.vertices == 2 {
            for i in 0..=n { let t = i as f64/n as f64; self.insert(std::array::from_fn(|j| (a[j]+ab[j]*t) as f32), normal); }
        } else {
            // Area-spaced barycentric sampling covers large triangles, including planes
            // that would disappear entirely if represented by one triangle centroid.
            for i in 0..=n { for j in 0..=n-i {
                self.insert(std::array::from_fn(|axis| (a[axis]+ab[axis]*i as f64/n as f64+ac[axis]*j as f64/n as f64) as f32), normal);
            }}
        }
    }
    fn coarsen(&self) -> Self {
        let mut parent = Self::new(self.resolution/2, self.lower, self.width);
        for cell in &self.cells { if cell.occupied != 0 { parent.insert(cell.position, cell.normal); } }
        parent
    }
}

fn write_levels(path: &Path, levels: &[Grid]) -> Result<LodInfo> {
    let mut output = BufWriter::new(File::create(path).map_err(|e| e.to_string())?);
    output.write_all(MAGIC).map_err(|e| e.to_string())?;
    let mut nodes: Vec<LodNode> = Vec::new(); let mut level_maps: Vec<Vec<Option<usize>>> = Vec::new(); let mut offset = 8;
    for (level, grid) in levels.iter().enumerate() {
        let blocks = grid.resolution/NODE_GRID; let mut map = vec![None; blocks.pow(3)];
        for nx in 0..blocks { for ny in 0..blocks { for nz in 0..blocks {
            let mut records = Vec::with_capacity(NODE_GRID.pow(3)*RECORD_BYTES);
            let mut min = [f32::INFINITY; 3]; let mut max = [f32::NEG_INFINITY; 3]; let mut count = 0;
            for x in nx*NODE_GRID..(nx+1)*NODE_GRID { for y in ny*NODE_GRID..(ny+1)*NODE_GRID { for z in nz*NODE_GRID..(nz+1)*NODE_GRID {
                let cell = &grid.cells[(x*grid.resolution+y)*grid.resolution+z];
                if cell.occupied == 0 { continue; }
                let at = [x,y,z]; let h = grid.spacing();
                let radius = (0..3).map(|a| {
                    let lo = grid.lower[a]+at[a] as f64*h;
                    (cell.position[a] as f64-lo).abs().max((lo+h-cell.position[a] as f64).abs()).powi(2)
                }).sum::<f64>().sqrt() as f32 * 1.02;
                if !radius.is_finite() || radius <= 0. { return Err("Model scale exceeds preview range.".into()); }
                for a in 0..3 { min[a]=min[a].min(cell.position[a]-radius); max[a]=max[a].max(cell.position[a]+radius); }
                for value in cell.position.into_iter().chain(cell.normal).chain([radius]) { records.extend_from_slice(&value.to_le_bytes()); }
                count += 1;
            }}}
            if count == 0 { continue; }
            let id = nodes.len(); map[(nx*blocks+ny)*blocks+nz] = Some(id);
            let parent = if level == 0 { None } else {
                let b=blocks/2; level_maps[level-1][((nx/2)*b+ny/2)*b+nz/2]
            };
            if let Some(p) = parent { nodes[p].children.push(id); }
            nodes.push(LodNode { id, parent, children: Vec::new(), level, count, offset, min, max, spacing: grid.spacing() as f32 });
            output.write_all(&records).map_err(|e| e.to_string())?; offset += records.len() as u64;
        }}}
        level_maps.push(map);
    }
    output.flush().map_err(|e| e.to_string())?;
    if nodes.is_empty() { return Err("The model contains no usable surface samples.".into()); }
    Ok(LodInfo { version: LOD_VERSION, data_path: String::new(), byte_len: offset, roots: vec![0], nodes, tile_cells:Vec::new(),handle: String::new() })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mesh_lod_large_triangles_cover_the_surface_and_preserve_a_hole() {
        let mut grid = Grid::new(32, [0.; 3], 1.);
        // Four bars form a square ring. The hole must stay empty at the fine level.
        for [x0,y0,x1,y1] in [[0.,0.,1.,0.2],[0.,0.8,1.,1.],[0.,0.2,0.2,0.8],[0.8,0.2,1.,0.8]] {
            grid.insert_primitive(Primitive::triangle([x0,y0,0.],[x1,y0,0.],[x1,y1,0.]));
            grid.insert_primitive(Primitive::triangle([x0,y0,0.],[x1,y1,0.],[x0,y1,0.]));
        }
        let occupied=grid.cells.iter().filter(|c|c.occupied!=0).count();assert!(occupied>450);
        let center=(16*32+16)*32;assert_eq!(grid.cells[center].occupied,0);
        for x in 1..31 { assert_ne!(grid.cells[(x*32+2)*32].occupied,0); }
    }
    #[test]
    fn mesh_lod_parent_levels_retain_each_occupied_region() {
        let mut grid=Grid::new(32,[0.;3],1.);
        for p in [[0.01,0.01,0.01],[0.99,0.99,0.99],[0.01,0.99,0.01]] {grid.insert(p,[0.,0.,1.]);}
        let parent=grid.coarsen().coarsen();assert_eq!(parent.cells.iter().filter(|c|c.occupied!=0).count(),3);
        assert_eq!(std::mem::size_of::<Cell>(),32);
    }
    #[test]
    fn mesh_lod_node_ranges_are_bounded() {
        let root=std::env::temp_dir().join(format!("artgui-lod-{}",std::process::id()));fs::create_dir_all(&root).unwrap();
        let mut fine=Grid::new(16,[0.;3],1.);fine.insert_primitive(Primitive::triangle([0.,0.,0.],[1.,0.,0.],[0.,1.,0.]));
        let info=write_levels(&root.join("surface-lod-v2.bin"),&[fine.coarsen(),fine]).unwrap();fs::write(sidecar_path(&root),serde_json::to_vec(&info).unwrap()).unwrap();
        let info=load(&root).unwrap();let mut file=File::open(&info.data_path).unwrap();assert!(!read_node(&mut file,&info.nodes[0],info.byte_len).unwrap().is_empty());
        let mut bad=info.nodes[0].clone();bad.count=513;assert!(read_node(&mut file,&bad,info.byte_len).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    #[ignore = "Export native hierarchy and reference meshes for offscreen visual QA; set ARTGUI_LOD_FIXTURES"]
    fn mesh_lod_visual_fixtures() {
        let root=PathBuf::from(std::env::var("ARTGUI_LOD_FIXTURES").expect("Set ARTGUI_LOD_FIXTURES"));
        fn save(root:&Path,name:&str,lower:[f64;3],width:f64,faces:Vec<Primitive>){
            let dir=root.join(name);fs::create_dir_all(&dir).unwrap();let mut grid=Grid::new(FINE,lower,width);
            let(mut min,mut max)=([f32::INFINITY;3],[f32::NEG_INFINITY;3]);let mut reference=BufWriter::new(File::create(dir.join("reference.bin")).unwrap());
            for p in &faces{grid.insert_primitive(*p);for v in p.points{for a in 0..3{min[a]=min[a].min(v[a]);max[a]=max[a].max(v[a]);reference.write_all(&v[a].to_le_bytes()).unwrap();}}}
            reference.flush().unwrap();let mut levels=vec![grid];while levels.last().unwrap().resolution>NODE_GRID{levels.push(levels.last().unwrap().coarsen());}levels.reverse();
            let info=write_levels(&dir.join("surface-lod-v2.bin"),&levels).unwrap();fs::write(sidecar_path(&dir),serde_json::to_vec(&info).unwrap()).unwrap();
            fs::write(dir.join("model.json"),serde_json::to_vec(&serde_json::json!({"min":min,"max":max,"triangles":faces.len()})).unwrap()).unwrap();
            println!("Exported {name}: {} nodes, {} surface bytes",info.nodes.len(),info.byte_len);
        }
        let mut torus=Vec::new();let at=|u:f64,v:f64|[(1.+0.4*v.cos())*u.cos(),(1.+0.4*v.cos())*u.sin(),0.4*v.sin()].map(|x|x as f32);
        for i in 0..96{for j in 0..48{let u=i as f64*std::f64::consts::TAU/96.;let v=j as f64*std::f64::consts::TAU/48.;let du=std::f64::consts::TAU/96.;let dv=std::f64::consts::TAU/48.;torus.push(Primitive::triangle(at(u,v),at(u+du,v),at(u+du,v+dv)));torus.push(Primitive::triangle(at(u,v),at(u+du,v+dv),at(u,v+dv)));}}
        save(&root,"torus",[-1.4,-1.4,-0.4],2.8,torus);
        let mut bracket=Vec::new();
        for (lo,hi)in [([0.,0.,0.],[100.,20.,15.]),([0.,0.,0.],[20.,100.,60.]),([80.,0.,0.],[100.,100.,60.]),([0.,80.,0.],[100.,100.,20.]),([128.,60.,0.],[130.,62.,70.])]{
            let p:Vec<[f32;3]>=(0..8).map(|i|std::array::from_fn(|a|if i&(1<<a)==0{lo[a]}else{hi[a]})).collect();
            for f in [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]]{bracket.push(Primitive::triangle(p[f[0]],p[f[1]],p[f[2]]));bracket.push(Primitive::triangle(p[f[0]],p[f[2]],p[f[3]]));}
        }
        save(&root,"bracket",[0.;3],130.,bracket);
    }
}
