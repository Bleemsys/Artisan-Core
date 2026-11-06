use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{atomic::{AtomicU64, Ordering}, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};

// Cache writers and native readers share this gate; cleanup takes exclusive access.
pub(crate) static ACCESS: RwLock<()> = RwLock::new(());

fn linked(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0 // Includes junctions and other reparse points.
    }
    #[cfg(not(windows))]
    { metadata.file_type().is_symlink() }
}

fn create_workflow_preview(
    root: &Path,
    workflow_name: &str,
    step: usize,
    result_name: &str,
) -> Result<PathBuf, String> {
    if step == 0 || !matches!(result_name.rsplit_once('.'), Some((name, "stl" | "inp" | "h5" | "contour"))
        if !name.is_empty() && name.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')) {
        return Err("Invalid workflow preview filename.".into());
    }

    fs::create_dir_all(root).map_err(|error| format!("Could not create ViewScratch: {error}"))?;
    let metadata = fs::symlink_metadata(root).map_err(|error| error.to_string())?;
    if linked(&metadata) || !metadata.is_dir() {
        return Err("ViewScratch must be a regular folder in the ArtGUI application folder.".into());
    }

    let workflow_name: String = workflow_name.chars().take(48)
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let workflow_name = if workflow_name.is_empty() { "Workflow" } else { &workflow_name };
    static NEXT_PREVIEW: AtomicU64 = AtomicU64::new(0);
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let sequence = NEXT_PREVIEW.fetch_add(1, Ordering::Relaxed);
    let folder = root.join(format!("workflow-preview-{}-{stamp}-{sequence}", std::process::id()));
    fs::create_dir(&folder).map_err(|error| format!("Could not create workflow preview folder: {error}"))?;
    Ok(folder.join(format!("{workflow_name}_{step:02}_{result_name}")))
}

#[tauri::command]
pub(crate) fn prepare_workflow_preview(
    workflow_path: String,
    step: usize,
    result_name: String,
) -> Result<String, String> {
    let _access = ACCESS.read().map_err(|_| "Preview cache is unavailable.")?;
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let root = crate::mesh_preview::view_scratch_root(&executable)?;
    let workflow_name = Path::new(&workflow_path).file_stem().and_then(|name| name.to_str()).unwrap_or("Workflow");
    create_workflow_preview(&root, workflow_name, step, &result_name)
        .map(|path| path.to_string_lossy().into_owned())
}

pub(crate) fn workflow_preview_artifact(path: &Path) -> Result<(), String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let root = crate::mesh_preview::view_scratch_root(&executable)?;
    let folder = path.parent().ok_or("Invalid workflow preview path.")?;
    if folder.parent() != Some(root.as_path())
        || !folder.file_name().is_some_and(|name| name.to_string_lossy().starts_with("workflow-preview-"))
    {
        return Err("Invalid workflow preview folder.".into());
    }
    for directory in [&root, folder] {
        let metadata = fs::symlink_metadata(directory)
            .map_err(|error| format!("Workflow preview folder is unavailable: {error}"))?;
        if linked(&metadata) || !metadata.is_dir() {
            return Err("Workflow preview needs a regular ViewScratch folder.".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn read_workflow_contours(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&path);
        if path.extension().and_then(|ext| ext.to_str()) != Some("contour") {
            return Err("Expected a .contour preview file.".into());
        }
        let _access = ACCESS.read().map_err(|_| "Preview cache is unavailable.")?;
        workflow_preview_artifact(path)?;
        let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
        if linked(&metadata) || !metadata.is_file() {
            return Err("Expected a regular contour preview file.".into());
        }
        const LIMIT: u64 = 64 * 1024 * 1024;
        let mut text = String::new();
        fs::File::open(path).map_err(|error| error.to_string())?.take(LIMIT + 1)
            .read_to_string(&mut text).map_err(|error| error.to_string())?;
        if text.len() as u64 > LIMIT {
            return Err("Contour preview exceeds 64 MiB. Use fewer heights or coarser sampling.".into());
        }
        Ok(text)
    }).await.map_err(|error| error.to_string())?
}

fn directory(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x10 != 0
    }
    #[cfg(not(windows))]
    { metadata.is_dir() }
}

pub(crate) fn clean_contents(root: &Path) -> Result<(), String> {
    if !root.is_absolute() || root.file_name().is_none_or(|name| name != "ViewScratch") {
        return Err("Invalid ViewScratch folder.".into());
    }
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Could not inspect ViewScratch: {error}")),
    };
    if linked(&metadata) || !metadata.is_dir() {
        return Err("ViewScratch must be a regular folder in the ArtGUI application folder.".into());
    }
    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    let entries = fs::read_dir(&root).map_err(|error| format!("Could not read ViewScratch: {error}"))?;
    let mut failures = Vec::new();
    for entry in entries {
        let result = (|| -> Result<(), String> {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.parent() != Some(root.as_path()) {
                return Err("Scratch entry is outside ViewScratch.".into());
            }
            let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
            // Never traverse a child link or junction. remove_dir_all also avoids
            // following links nested inside a regular scratch subfolder.
            let result = if directory(&metadata) && linked(&metadata) {
                fs::remove_dir(&path)
            } else if metadata.is_dir() {
                fs::remove_dir_all(&path)
            } else {
                fs::remove_file(&path)
            };
            result.map_err(|error| format!("{}: {error}", path.display()))
        })();
        if let Err(error) = result { failures.push(error); }
    }
    if failures.is_empty() { Ok(()) } else {
        Err(format!("Some scratch entries could not be deleted. Close other ArtGUI windows and retry. {}", failures.join("; ")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
            let path = std::env::temp_dir().join(format!("artgui-clean-{}-{stamp}", std::process::id()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn scratch(&self) -> PathBuf { self.0.join("ViewScratch") }
    }
    impl Drop for Fixture { fn drop(&mut self) { fs::remove_dir_all(&self.0).unwrap(); } }

    #[test]
    fn workflow_previews_use_safe_names_and_separate_run_folders() {
        let fixture = Fixture::new();
        let root = fixture.scratch();
        let first = create_workflow_preview(&root, "Test bracket", 3, "preview.stl").unwrap();
        let second = create_workflow_preview(&root, "Test bracket", 3, "preview.stl").unwrap();
        assert_eq!(first.file_name().unwrap(), "Test_bracket_03_preview.stl");
        assert_ne!(first.parent(), second.parent());
        assert_eq!(first.parent().unwrap().parent(), Some(root.as_path()));
        assert!(create_workflow_preview(&root, "Test bracket", 3, "../preview.stl").is_err());
        fs::write(&first, "preview").unwrap();
        clean_contents(&root).unwrap();
        assert!(!first.exists());
    }

    #[test]
    fn deletes_all_contents_and_preserves_root_and_neighbours() {
        let fixture = Fixture::new();
        let root = fixture.scratch();
        fs::create_dir_all(root.join("cache/scratch")).unwrap();
        fs::write(root.join("cache/scratch/vertices.tmp"), "scratch").unwrap();
        fs::write(root.join(".hidden"), "scratch").unwrap();
        fs::write(root.join("overview.bin"), "scratch").unwrap();
        fs::write(fixture.0.join("workflow.json"), "keep").unwrap();
        clean_contents(&root).unwrap();
        assert!(root.is_dir());
        assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
        assert_eq!(fs::read(fixture.0.join("workflow.json")).unwrap(), b"keep");
        clean_contents(&root).unwrap();
    }

    #[test]
    fn missing_scratch_is_already_clean_and_invalid_targets_are_rejected() {
        let fixture = Fixture::new();
        clean_contents(&fixture.scratch()).unwrap();
        assert!(clean_contents(&fixture.0).is_err());
        assert!(clean_contents(Path::new("ViewScratch")).is_err());
        fs::write(fixture.scratch(), "keep").unwrap();
        assert!(clean_contents(&fixture.scratch()).is_err());
    }

    #[cfg(windows)]
    fn junction(link: &Path, target: &Path) {
        let status = std::process::Command::new("cmd.exe")
            .args(["/D", "/C", "mklink", "/J"])
            .arg(link).arg(target).output().unwrap();
        assert!(status.status.success(), "{}", String::from_utf8_lossy(&status.stderr));
    }

    #[cfg(windows)]
    #[test]
    fn never_traverses_junctions_at_root_or_inside_scratch() {
        let fixture = Fixture::new();
        let outside = fixture.0.join("models");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("source.stl"), "keep").unwrap();
        junction(&fixture.scratch(), &outside);
        assert!(clean_contents(&fixture.scratch()).is_err());
        fs::remove_dir(fixture.scratch()).unwrap();
        fs::create_dir_all(fixture.scratch().join("cache")).unwrap();
        junction(&fixture.scratch().join("linked-models"), &outside);
        junction(&fixture.scratch().join("cache").join("nested-link"), &outside);
        clean_contents(&fixture.scratch()).unwrap();
        assert_eq!(fs::read_dir(fixture.scratch()).unwrap().count(), 0);
        assert_eq!(fs::read(outside.join("source.stl")).unwrap(), b"keep");
    }
}
