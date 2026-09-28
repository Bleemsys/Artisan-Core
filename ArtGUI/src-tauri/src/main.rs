#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod generation;
use generation::{generate_workflow, cancel_generation, open_run_log, GenerationState};
use serde::Serialize;
use tauri::{Emitter, Manager, State};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, BufWriter, Read, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Serialize)]
struct OpenedFile {
    path: String,
    contents: String,
}

#[tauri::command]
fn open_workflow() -> Result<Option<OpenedFile>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Artisan workflow", &["json"])
        .pick_file()
    else {
        return Ok(None);
    };
    let contents = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(OpenedFile { path: path.to_string_lossy().into_owned(), contents }))
}

#[tauri::command]
fn choose_geometry() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("Preview geometry", &["stl", "obj", "ply", "inp"])
        .pick_file()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn choose_supporting_file() -> Option<String> {
    rfd::FileDialog::new().pick_file().map(|path| path.to_string_lossy().into_owned())
}

// Only the two About links may be opened through this command.
#[tauri::command]
fn open_about_link(url: String) -> Result<(), String> {
    if !["https://bleemsys.com/Artisan.html", "https://bleemsys.com/Artisan/docs/index.html", "https://lucide.dev/", "https://lucide.dev/license"].contains(&url.as_str()) {
        return Err("Unknown About link.".into());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("rundll32.exe").arg("url.dll,FileProtocolHandler").arg(&url)
            .creation_flags(0x08000000).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Opening About links is currently supported on Windows.".into()) }
}

#[tauri::command]
fn choose_lattice_input(kind: String) -> Option<String> {
    let dialog = rfd::FileDialog::new();
    let dialog = match kind.as_str() {
        "la_name" => dialog.add_filter("Lattice definition", &["txt", "mld"]),
        "file" => dialog.add_filter("Unit cell geometry", &["stl", "obj", "ply", "inp", "med"]),
        _ => dialog.add_filter("Lattice mesh", &["med", "inp", "bdf", "msh", "stl", "obj", "ply"]),
    };
    dialog.pick_file().map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_lattice_definition(app: tauri::AppHandle, path: Option<String>, workflow_path: Option<String>, group: Option<String>) -> Result<Option<OpenedFile>, String> {
    let chosen = if let Some(path) = path {
        find_geometry_path(&app, &path, workflow_path.as_deref())?
    } else {
        let extensions = if group.as_deref() == Some("mesh") { vec!["mld", "txt"] } else { vec!["txt", "mld"] };
        let Some(path) = rfd::FileDialog::new().add_filter("Lattice definition", &extensions).pick_file() else { return Ok(None); };
        path
    };
    if !chosen.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("txt") || e.to_string_lossy().eq_ignore_ascii_case("mld")) { return Err("Choose a .txt or .mld definition.".into()); }
    if fs::metadata(&chosen).map_err(|e| e.to_string())?.len() > 4 * 1024 * 1024 { return Err("Definition files are limited to 4 MB.".into()); }
    let contents = fs::read_to_string(&chosen).map_err(|e| e.to_string())?;
    Ok(Some(OpenedFile { path: chosen.to_string_lossy().into_owned(), contents }))
}

#[tauri::command]
fn export_lattice_definition(contents: String, name: String, mesh: bool) -> Result<Option<String>, String> {
    if contents.len() > 4 * 1024 * 1024 { return Err("Definition exceeds 4 MB.".into()); }
    let value: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    if !value["type"].is_string() || !value["definition"].is_object() { return Err("Invalid lattice definition.".into()); }
    let extension = if mesh { "mld" } else { "txt" };
    let safe_name: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect();
    let Some(path) = rfd::FileDialog::new().add_filter("Lattice definition", &[extension])
        .set_file_name(format!("{safe_name}.{extension}")).save_file() else { return Ok(None); };
    if !path.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case(extension)) { return Err(format!("Use the .{extension} file extension.")); }
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn choose_output() -> Option<String> {
    rfd::FileDialog::new()
        .add_filter("3D model", &["stl", "obj", "ply"])
        .set_file_name("Artisan_output.stl")
        .save_file()
        .map(|path| path.to_string_lossy().into_owned())
}

const MAX_QUICK_TRIANGLES: usize = 120_000;

#[derive(Default, Clone)]
struct PreviewJobs(Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GeometryPreview {
    preview_path: String,
    preview_size: u64,
    preview_triangles: usize,
    total_triangles: u64,
    source_size: u64,
    bounds_min: [f32; 3],
    bounds_max: [f32; 3],
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewProgress {
    job_id: String,
    loaded: u64,
    total: u64,
    stage: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GeometryFile {
    path: String,
    size: u64,
    triangle_count: Option<u64>,
}

fn find_geometry_path(app: &tauri::AppHandle, path: &str, workflow_path: Option<&str>) -> Result<PathBuf, String> {
    let given = PathBuf::from(path);
    let mut candidates = vec![given.clone()];
    if given.is_relative() {
        if let Some(parent) = workflow_path.and_then(|p| Path::new(p).parent()) {
            candidates.extend(parent.ancestors().take(5).map(|root| root.join(&given)));
        }
        if let Ok(resources) = app.path().resource_dir() {
            candidates.push(resources.join("artisan").join(&given));
        }
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join(&given));
        }
    }
    for candidate in candidates {
        if candidate.is_file() {
            return candidate.canonicalize()
                .map_err(|e| format!("Could not resolve geometry '{}': {e}", candidate.display()));
        }
    }
    Err(format!("Geometry file was not found: {path}"))
}

#[tauri::command]
fn resolve_geometry(app: tauri::AppHandle, path: String, workflow_path: Option<String>) -> Result<GeometryFile, String> {
    let resolved = find_geometry_path(&app, &path, workflow_path.as_deref())?;
    app.asset_protocol_scope().allow_file(&resolved)
        .map_err(|e| format!("Could not authorize selected geometry: {e}"))?;
    let size = fs::metadata(&resolved).map_err(|e| format!("Could not inspect geometry file: {e}"))?.len();
    let triangle_count = binary_stl_triangle_count(&resolved, size);
    Ok(GeometryFile { path: resolved.to_string_lossy().into_owned(), size, triangle_count })
}

fn binary_stl_triangle_count(path: &Path, size: u64) -> Option<u64> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 84];
    file.read_exact(&mut header).ok()?;
    let count = u32::from_le_bytes(header[80..84].try_into().ok()?) as u64;
    (84u64.saturating_add(count.saturating_mul(50)) == size).then_some(count)
}

#[tauri::command]
async fn create_geometry_preview(
    app: tauri::AppHandle,
    jobs: State<'_, PreviewJobs>,
    job_id: String,
    path: String,
    workflow_path: Option<String>,
) -> Result<GeometryPreview, String> {
    let source = find_geometry_path(&app, &path, workflow_path.as_deref())?;
    let app_work = app.clone();
    let job_for_work = job_id.clone();
    let cancel = Arc::new(AtomicBool::new(false));
    jobs.0.lock().map_err(|_| "Preview state is unavailable.".to_string())?
        .insert(job_id.clone(), cancel.clone());
    let jobs_map = jobs.0.clone();
    let joined = tauri::async_runtime::spawn_blocking(move || {
        write_quick_preview(&app_work, &source, &job_for_work, cancel)
    }).await;
    if let Ok(mut map) = jobs_map.lock() { map.remove(&job_id); }
    joined.map_err(|e| format!("Quick preview task failed: {e}"))?
}

#[tauri::command]
fn cancel_geometry_preview(jobs: State<'_, PreviewJobs>, job_id: String) {
    if let Ok(map) = jobs.0.lock() {
        if let Some(cancel) = map.get(&job_id) { cancel.store(true, Ordering::Relaxed); }
    }
}

fn emit_preview_progress(app: &tauri::AppHandle, job_id: &str, loaded: u64, total: u64, stage: &str) {
    let _ = app.emit("geometry-preview-progress", PreviewProgress {
        job_id: job_id.to_string(), loaded, total, stage: stage.to_string(),
    });
}

fn collect_triangle(
    triangle: [f32; 9], face: u64, sampled: &mut Vec<[f32; 9]>,
    lo: &mut [f32; 3], hi: &mut [f32; 3], rng: &mut u64,
) {
    for vertex in 0..3 {
        for axis in 0..3 {
            let value = triangle[vertex * 3 + axis];
            lo[axis] = lo[axis].min(value);
            hi[axis] = hi[axis].max(value);
        }
    }
    if sampled.len() < MAX_QUICK_TRIANGLES {
        sampled.push(triangle);
    } else {
        *rng ^= *rng << 13;
        *rng ^= *rng >> 7;
        *rng ^= *rng << 17;
        let slot = *rng % (face + 1);
        if slot < MAX_QUICK_TRIANGLES as u64 { sampled[slot as usize] = triangle; }
    }
}

fn write_quick_preview(
    app: &tauri::AppHandle, source: &Path, job_id: &str, cancel: Arc<AtomicBool>,
) -> Result<GeometryPreview, String> {
    let source_size = fs::metadata(source).map_err(|e| format!("Could not inspect STL: {e}"))?.len();
    let mut input = BufReader::new(fs::File::open(source).map_err(|e| format!("Could not open STL: {e}"))?);
    let mut header = [0u8; 84];
    input.read_exact(&mut header).map_err(|e| format!("Could not read STL header: {e}"))?;
    let binary_facets = u32::from_le_bytes(header[80..84].try_into().unwrap()) as u64;
    let is_binary = 84u64.saturating_add(binary_facets.saturating_mul(50)) == source_size;
    let mut sampled = Vec::<[f32; 9]>::with_capacity(MAX_QUICK_TRIANGLES);
    let mut lo = [f32::INFINITY; 3];
    let mut hi = [f32::NEG_INFINITY; 3];
    let mut rng = source_size ^ 0x9e3779b97f4a7c15;
    let mut total_triangles = 0u64;

    if is_binary {
        let mut record = [0u8; 50];
        for face in 0..binary_facets {
            if face % 4096 == 0 {
                if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
                if face % 262_144 == 0 { emit_preview_progress(app, job_id, 84 + face * 50, source_size, "Scanning STL facets…"); }
            }
            input.read_exact(&mut record).map_err(|e| format!("Could not read STL facet {face}: {e}"))?;
            let mut triangle = [0f32; 9];
            for (index, value) in triangle.iter_mut().enumerate() {
                let offset = 12 + index * 4;
                *value = f32::from_le_bytes(record[offset..offset + 4].try_into().unwrap());
                if !value.is_finite() { return Err(format!("STL facet {face} contains a non-finite vertex.")); }
            }
            collect_triangle(triangle, face, &mut sampled, &mut lo, &mut hi, &mut rng);
            total_triangles += 1;
        }
    } else {
        drop(input);
        let file = BufReader::new(fs::File::open(source).map_err(|e| format!("Could not open ASCII STL: {e}"))?);
        let mut triangle = [0f32; 9];
        let mut vertices = 0usize;
        let mut bytes_read = 0u64;
        for line in file.lines() {
            let line = line.map_err(|e| format!("Could not read ASCII STL: {e}"))?;
            bytes_read += line.len() as u64 + 1;
            let mut parts = line.split_whitespace();
            if parts.next().is_some_and(|word| word.eq_ignore_ascii_case("vertex")) {
                let mut values = [0f32; 3];
                for value in &mut values {
                    *value = parts.next().ok_or("Incomplete STL vertex.")?.parse::<f32>()
                        .map_err(|_| "ASCII STL contains an invalid vertex coordinate.")?;
                    if !value.is_finite() { return Err("ASCII STL contains a non-finite vertex.".into()); }
                }
                triangle[vertices * 3..vertices * 3 + 3].copy_from_slice(&values);
                vertices += 1;
                if vertices == 3 {
                    if total_triangles % 4096 == 0 {
                        if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
                        if total_triangles % 262_144 == 0 { emit_preview_progress(app, job_id, bytes_read, source_size, "Scanning ASCII STL…"); }
                    }
                    collect_triangle(triangle, total_triangles, &mut sampled, &mut lo, &mut hi, &mut rng);
                    total_triangles += 1;
                    vertices = 0;
                }
            }
        }
    }

    if cancel.load(Ordering::Relaxed) { return Err("Preview cancelled.".into()); }
    if total_triangles == 0 || sampled.is_empty() { return Err("No STL triangles were found.".into()); }
    emit_preview_progress(app, job_id, source_size, source_size, "Writing quick preview…");
    let cache_dir = app.path().app_cache_dir().map_err(|e| format!("Could not locate preview cache: {e}"))?;
    fs::create_dir_all(&cache_dir).map_err(|e| format!("Could not create preview cache: {e}"))?;
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with("artisan_preview_") && entry.path().extension().is_some_and(|e| e == "stl") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let preview_path = cache_dir.join(format!("artisan_preview_{}_{}.stl", std::process::id(), stamp));
    let mut output = BufWriter::new(fs::File::create(&preview_path).map_err(|e| format!("Could not create quick preview: {e}"))?);
    let mut preview_header = [0u8; 80];
    let label = b"ArtGUI quick preview; source mesh is unchanged";
    preview_header[..label.len()].copy_from_slice(label);
    output.write_all(&preview_header).map_err(|e| e.to_string())?;
    output.write_all(&(sampled.len() as u32).to_le_bytes()).map_err(|e| e.to_string())?;
    for triangle in sampled {
        output.write_all(&[0u8; 12]).map_err(|e| e.to_string())?;
        for value in triangle { output.write_all(&value.to_le_bytes()).map_err(|e| e.to_string())?; }
        output.write_all(&[0u8; 2]).map_err(|e| e.to_string())?;
    }
    output.flush().map_err(|e| format!("Could not finish quick preview: {e}"))?;
    if let Err(e) = app.asset_protocol_scope().allow_file(&preview_path) {
        let _ = fs::remove_file(&preview_path);
        return Err(format!("Could not authorize preview mesh: {e}"));
    }
    let preview_size = fs::metadata(&preview_path).map_err(|e| format!("Could not inspect preview mesh: {e}"))?.len();
    Ok(GeometryPreview {
        preview_path: preview_path.to_string_lossy().into_owned(), preview_size,
        preview_triangles: (preview_size.saturating_sub(84) / 50) as usize,
        total_triangles, source_size, bounds_min: lo, bounds_max: hi,
    })
}

#[tauri::command]
fn choose_backend() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select Artisan engine: executable or ArtisanMain.py")
        .add_filter("Artisan engine", &["exe", "py"])
        .add_filter("Artisan executable", &["exe"])
        .add_filter("Artisan Python script", &["py"])
        .set_file_name("ArtisanMain.exe")
        .pick_file()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn choose_python() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select the Python interpreter for Artisan")
        .add_filter("Python executable", &["exe"])
        .set_file_name("python.exe")
        .pick_file()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn packaged_backend(app: tauri::AppHandle) -> Option<String> {
    app.path().resource_dir().ok()
        .map(|p| p.join("artisan").join("ArtisanMain.exe"))
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
fn save_workflow(path: Option<String>, contents: String) -> Result<Option<String>, String> {
    let chosen = match path {
        Some(value) if !value.is_empty() => Some(PathBuf::from(value)),
        _ => rfd::FileDialog::new()
            .add_filter("Artisan workflow", &["json"])
            .set_file_name("Artisan_workflow.json")
            .save_file(),
    };
    let Some(chosen) = chosen else { return Ok(None) };
    fs::write(&chosen, contents).map_err(|e| e.to_string())?;
    Ok(Some(chosen.to_string_lossy().into_owned()))
}

#[tauri::command]
fn save_view_image(png_data: Vec<u8>) -> Result<Option<String>, String> {
    if png_data.len() > 32 * 1024 * 1024 || !png_data.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err("Invalid or oversized PNG image.".into());
    }
    let Some(path) = rfd::FileDialog::new().add_filter("PNG image", &["png"])
        .set_file_name("ArtGUI-view.png").save_file() else { return Ok(None); };
    fs::write(&path, png_data).map_err(|e| format!("Could not save image: {e}"))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn find_backend_root(exe: &Path) -> Result<(PathBuf, PathBuf), String> {
    if !exe.is_file() {
        return Err(format!("Artisan engine was not found: {}", exe.display()));
    }
    // Python entry points must run from their own source directory; never
    // substitute a packaged executable found in an ancestor directory.
    if exe.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("py")) {
        let script = fs::canonicalize(exe).map_err(|e| e.to_string())?;
        let root = script.parent().ok_or("The Python script has no parent folder.")?.to_path_buf();
        return Ok((script, root));
    }
    let start = exe.parent().unwrap_or_else(|| Path::new("."));
    let mut candidates = vec![start.to_path_buf()];
    candidates.extend(start.ancestors().skip(1).take(4).map(Path::to_path_buf));
    for root in candidates {
        if root.join("AGUI").is_dir() || root.join("Test_json").is_dir() {
            return Ok((exe.to_path_buf(), root));
        }
        let nested = root.join("artisan");
        if nested.join("ArtisanMain.exe").is_file() {
            return Ok((nested.join("ArtisanMain.exe"), nested));
        }
    }
    let root = start.to_path_buf();
    Ok((exe.to_path_buf(), root))
}


fn main() {
    tauri::Builder::default()
        .manage(PreviewJobs::default())
        .manage(GenerationState::default())
        .on_window_event(|window,event| { if matches!(event,tauri::WindowEvent::CloseRequested {..}) { generation::stop_on_close(&window.state::<GenerationState>()); } })
        .invoke_handler(tauri::generate_handler![
            open_workflow,
            choose_geometry,
            choose_lattice_input,
            open_lattice_definition,
            export_lattice_definition,
            open_about_link,
            choose_supporting_file,
            resolve_geometry,
            create_geometry_preview,
            cancel_geometry_preview,
            choose_output,
            choose_backend,
            choose_python,
            packaged_backend,
            save_workflow,
            save_view_image,
            cancel_generation,
            open_run_log,
            generate_workflow
        ])
        .run(tauri::generate_context!())
        .expect("error while running Artisan Workbench");
}

#[cfg(test)]
mod backend_tests {
    use super::*;
    #[test]
    fn python_backend_keeps_selected_script_and_source_folder() {
        let dir = std::env::temp_dir().join(format!("artgui backend root {}", std::process::id()));
        let source = dir.join("Src");let packaged = dir.join("artisan");
        fs::create_dir_all(&source).unwrap();fs::create_dir_all(&packaged).unwrap();
        let script = source.join("ArtisanMain.py");let executable = packaged.join("ArtisanMain.exe");
        fs::write(&script, "# fixture").unwrap();fs::write(&executable, "fixture").unwrap();
        let (chosen, cwd) = find_backend_root(&script).unwrap();
        assert_eq!(chosen, fs::canonicalize(&script).unwrap());
        assert_eq!(cwd, fs::canonicalize(&source).unwrap());
        fs::remove_file(script).unwrap();fs::remove_file(executable).unwrap();
        fs::remove_dir(source).unwrap();fs::remove_dir(packaged).unwrap();fs::remove_dir(dir).unwrap();
    }
}
