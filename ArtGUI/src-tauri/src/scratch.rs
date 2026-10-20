use std::{fs, path::Path, sync::RwLock};

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
