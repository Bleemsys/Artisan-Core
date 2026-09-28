use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager, State};

#[derive(Default)]
pub struct GenerationState {
    active: Mutex<Option<(String, Arc<AtomicBool>, Option<u32>)>>,
    logs: Mutex<HashMap<String, PathBuf>>,
}
#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunUpdate {
    run_id: String,
    lines: Vec<String>,
    progress: Option<f64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    success: bool,
    cancelled: bool,
    exit_code: Option<i32>,
    log_path: String,
    progress_path: String,
}

fn hidden(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
}
fn stop_process(pid: u32) {
    #[cfg(windows)]
    {
        let _ = hidden(Command::new("taskkill.exe").args(["/PID", &pid.to_string(), "/T", "/F"]))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").arg(pid.to_string()).status();
    }
}
pub fn stop_on_close(state: &GenerationState) {
    if let Ok(active) = state.active.lock() {
        if let Some((_, cancel, pid)) = active.as_ref() {
            cancel.store(true, Ordering::Relaxed);
            if let Some(pid) = pid {
                stop_process(*pid);
            }
        }
    }
}
#[tauri::command]
pub fn cancel_generation(state: State<'_, GenerationState>, run_id: String) -> Result<(), String> {
    let active = state.active.lock().map_err(|e| e.to_string())?;
    if let Some((id, cancel, _)) = active.as_ref() {
        if id == &run_id {
            cancel.store(true, Ordering::Relaxed);
            return Ok(());
        }
    }
    Err("This run is no longer active.".into())
}
#[tauri::command]
pub fn open_run_log(state: State<'_, GenerationState>, run_id: String) -> Result<(), String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    let path = logs
        .get(&run_id)
        .filter(|p| p.is_file())
        .ok_or("The run log is not available yet.")?;
    #[cfg(windows)]
    {
        hidden(Command::new("notepad.exe").arg(path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Incremental reads retain partial lines and tolerate files recreated by the logger.
#[derive(Default)]
struct Tail {
    offset: u64,
    pending: Vec<u8>,
}
impl Tail {
    fn read(&mut self, path: &Path, finish: bool) -> Vec<String> {
        let Ok(mut file) = File::open(path) else {
            return vec![];
        };
        if file
            .metadata()
            .map(|m| m.len() < self.offset)
            .unwrap_or(false)
        {
            self.offset = 0;
            self.pending.clear();
        }
        if file.seek(SeekFrom::Start(self.offset)).is_err() {
            return vec![];
        }
        let mut bytes = vec![0; 65536];
        let count = file.read(&mut bytes).unwrap_or(0);
        self.offset += count as u64;
        self.pending.extend_from_slice(&bytes[..count]);
        split_lines(&mut self.pending, finish && count < 65536)
    }
}
fn split_lines(pending: &mut Vec<u8>, finish: bool) -> Vec<String> {
    let mut lines = vec![];
    let mut start = 0;
    for i in 0..pending.len() {
        if pending[i] == b'\n' || pending[i] == b'\r' {
            if i > start {
                lines.push(String::from_utf8_lossy(&pending[start..i]).into_owned());
            }
            start = i + 1;
        }
    }
    if start > 0 {
        pending.drain(..start);
    }
    if (finish || pending.len() > 65536) && !pending.is_empty() {
        lines.push(String::from_utf8_lossy(pending).into_owned());
        pending.clear();
    }
    lines
}
fn percentage(line: &str) -> Option<f64> {
    let n = line.trim().strip_suffix('%')?.trim().parse::<f64>().ok()?;
    n.is_finite().then_some(n.clamp(0.0, 100.0))
}
#[derive(Default)]
struct Merge {
    counts: HashMap<String, [usize; 2]>,
}
impl Merge {
    fn keep(&mut self, line: &str, source: usize) -> bool {
        // Compare occurrence counts, so repeated real messages are not lost.
        if self.counts.len() > 20000 {
            self.counts.clear();
        }
        let counts = self.counts.entry(line.to_owned()).or_default();
        counts[source] += 1;
        counts[source] > counts[1 - source]
    }
}
fn pipe(reader: impl Read + Send + 'static, tx: mpsc::SyncSender<String>) {
    thread::spawn(move || {
        let mut reader = reader;
        let mut pending = vec![];
        let mut buf = [0; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    for line in split_lines(&mut pending, false) {
                        if tx.send(line).is_err() {
                            return;
                        }
                    }
                }
            }
        }
        for line in split_lines(&mut pending, true) {
            let _ = tx.send(line);
        }
    });
}

fn monitor(
    mut child: Child,
    cancel: Arc<AtomicBool>,
    run_id: &str,
    log: &Path,
    progress: &Path,
    transcript: &Path,
    mut emit: impl FnMut(RunUpdate),
) -> Result<(bool, bool, Option<i32>), String> {
    let (tx, rx) = mpsc::sync_channel(256);
    if let Some(out) = child.stdout.take() {
        pipe(out, tx.clone());
    }
    if let Some(err) = child.stderr.take() {
        pipe(err, tx.clone());
    }
    drop(tx);
    let mut log_tail = Tail::default();
    let mut progress_tail = Tail::default();
    let mut merge = Merge::default();
    let mut saved = OpenOptions::new()
        .create(true)
        .append(true)
        .open(transcript)
        .ok();
    let mut cancelled = false;
    let mut ended = None;
    let mut status = None;
    let mut last_progress = None;
    loop {
        if cancel.load(Ordering::Relaxed) && status.is_none() && !cancelled {
            cancelled = true;
            stop_process(child.id());
            let _ = child.kill();
        }
        if status.is_none() {
            match child.try_wait() {
                Ok(Some(s)) => {
                    status = Some(s);
                    ended = Some(Instant::now());
                }
                Ok(None) => {}
                Err(e) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(e.to_string());
                }
            }
        }
        let finish = status.is_some();
        let mut update = RunUpdate {
            run_id: run_id.into(),
            ..Default::default()
        };
        let mut disconnected = false;
        for _ in 0..1024 {
            match rx.try_recv() {
                Ok(line) => {
                    if let Some(n) = percentage(&line) {
                        update.progress = Some(n);
                    } else if merge.keep(&line, 0) {
                        update.lines.push(line);
                    }
                }
                Err(mpsc::TryRecvError::Empty) => break,
                Err(mpsc::TryRecvError::Disconnected) => {
                    disconnected = true;
                    break;
                }
            }
        }
        let file_lines = log_tail.read(log, finish);
        let file_read = file_lines.len();
        for line in file_lines {
            if merge.keep(&line, 1) {
                update.lines.push(line);
            }
        }
        for line in progress_tail.read(progress, finish) {
            if let Some(n) = percentage(&line) {
                update.progress = Some(n);
            }
        }
        if let Some(n) = update.progress {
            if last_progress == Some(n) {
                update.progress = None;
            } else {
                last_progress = Some(n);
            }
        }
        if !update.lines.is_empty() || update.progress.is_some() {
            if let Some(file) = saved.as_mut() {
                for line in &update.lines {
                    let _ = writeln!(file, "{line}");
                }
                let _ = file.flush();
            }
            emit(update);
        }
        if finish
            && file_read == 0
            && (disconnected || ended.is_some_and(|t| t.elapsed() > Duration::from_secs(2)))
        {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    let s = status.unwrap();
    Ok((s.success() && !cancelled, cancelled, s.code()))
}

fn backend_command(engine: &Path, python: Option<&str>, workflow: &Path) -> Command {
    let is_python = engine.extension().and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("py"));
    let mut command = if is_python {
        let interpreter = python.map(str::trim).filter(|p| !p.is_empty()).unwrap_or("python");
        let mut command = Command::new(interpreter);
        command.arg("-u").arg(engine);
        command
    } else {
        Command::new(engine)
    };
    command.arg("-f").arg(workflow);
    command
}

#[tauri::command]
pub async fn generate_workflow(
    app: tauri::AppHandle,
    contents: String,
    backend_path: Option<String>,
    python_path: Option<String>,
    workflow_path: String,
    run_id: String,
) -> Result<RunResult, String> {
    if run_id.is_empty()
        || run_id.len() > 80
        || !run_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("Invalid run identifier.".into());
    }
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let state = app.state::<GenerationState>();
        let mut active = state.active.lock().map_err(|e| e.to_string())?;
        if active.is_some() {
            return Err("Artisan is already running.".into());
        }
        *active = Some((run_id.clone(), cancel.clone(), None));
    }
    let cleanup_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let exe = backend_path
            .filter(|p| !p.trim().is_empty())
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("ARTISAN_MAIN_EXE").map(PathBuf::from))
            .or_else(|| {
                app.path()
                    .resource_dir()
                    .ok()
                    .map(|p| p.join("artisan/ArtisanMain.exe"))
            })
            .ok_or("Choose ArtisanMain.exe or ArtisanMain.py with Backend first.")?;
        let (exe, working_dir) = super::find_backend_root(&exe)?;
        let value: serde_json::Value =
            serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        let project = PathBuf::from(workflow_path);
        let project_dir = project
            .parent()
            .filter(|p| p.is_dir())
            .ok_or("Save your project to a folder before generating.")?;
        let runs = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("runs");
        fs::create_dir_all(&runs).map_err(|e| e.to_string())?;
        let setting = &value["Setup"]["JsonWorkDir"];
        let json_dir = if setting.as_bool() == Some(true) {
            project_dir
        } else {
            &runs
        };
        let temp = json_dir.join(format!("artisan_run_{run_id}.json"));
        let engine_dir = match setting {
            serde_json::Value::Bool(true) => project_dir.to_path_buf(),
            serde_json::Value::String(p) => {
                let p = PathBuf::from(p);
                let p = if p.is_absolute() {
                    p
                } else {
                    working_dir.join(p)
                };
                if p.is_dir() {
                    p
                } else {
                    working_dir.clone()
                }
            }
            serde_json::Value::Null => json_dir.to_path_buf(),
            _ => working_dir.clone(),
        };
        let log = engine_dir.join(format!("artisan_run_{run_id}.log"));
        let progress = log.with_extension("prg");
        let transcript = runs.join(format!("{run_id}.log"));
        File::create(&transcript).map_err(|e| e.to_string())?;
        {
            let state = app.state::<GenerationState>();
            let mut logs = state.logs.lock().map_err(|e| e.to_string())?;
            if logs.len() > 50 {
                logs.clear();
            }
            logs.insert(run_id.clone(), transcript.clone());
        }
        fs::write(&temp, contents).map_err(|e| format!("Could not prepare workflow: {e}"))?;
        let result = (|| {
            let child = hidden(
                backend_command(&exe, python_path.as_deref(), &temp)
                    .current_dir(&working_dir)
                    .env("PYTHONUNBUFFERED", "1")
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped()),
            )
            .spawn()
            .map_err(|e| format!("Could not start Artisan: {e}. For a Python backend, check the Python interpreter in Backend settings."))?;
            if let Ok(mut active) = app.state::<GenerationState>().active.lock() {
                if let Some((_, _, pid)) = active.as_mut() {
                    *pid = Some(child.id());
                }
            }
            let (success, cancelled, exit_code) = monitor(
                child,
                cancel,
                &run_id,
                &log,
                &progress,
                &transcript,
                |update| {
                    let _ = app.emit("artisan-run", update);
                },
            )?;
            Ok(RunResult {
                success,
                cancelled,
                exit_code,
                log_path: transcript.to_string_lossy().into_owned(),
                progress_path: progress.to_string_lossy().into_owned(),
            })
        })();
        let _ = fs::remove_file(temp);
        result
    })
    .await
    .map_err(|e| format!("Generation task failed: {e}"));
    if let Ok(mut active) = cleanup_app.state::<GenerationState>().active.lock() {
        *active = None;
    }
    result?
}

#[cfg(test)]
mod tests {

    #[test]
    fn executable_launch_ignores_python_setting() {
        let cmd = backend_command(Path::new("engine with spaces.exe"), Some("unused-python.exe"), Path::new("project with spaces.json"));
        assert_eq!(cmd.get_program(), "engine with spaces.exe");
        assert_eq!(cmd.get_args().collect::<Vec<_>>(), vec!["-f", "project with spaces.json"]);
    }
    #[test]
    fn python_launch_uses_separate_arguments() {
        let cmd = backend_command(Path::new("Artisan Main.PY"), Some("  C:/Python env/python.exe  "), Path::new("workflow.json"));
        assert_eq!(cmd.get_program(), "C:/Python env/python.exe");
        assert_eq!(cmd.get_args().collect::<Vec<_>>(), vec!["-u", "Artisan Main.PY", "-f", "workflow.json"]);
        let cmd = backend_command(Path::new("ArtisanMain.py"), Some(" "), Path::new("workflow.json"));
        assert_eq!(cmd.get_program(), "python");
    }
    #[test]
    #[ignore = "requires ARTGUI_TEST_PYTHON pointing to a Python interpreter"]
    fn python_subprocess_preserves_paths_and_working_directory() {
        let python = std::env::var("ARTGUI_TEST_PYTHON").expect("Set ARTGUI_TEST_PYTHON");
        let dir = std::env::temp_dir().join(format!("artgui python launch {}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let script = dir.join("Artisan entry.py");
        let workflow = dir.join("workflow with spaces.json");
        fs::write(&script, "import os,sys,json\nprint(json.dumps({'args':sys.argv[1:],'cwd':os.getcwd()}))\n").unwrap();
        fs::write(&workflow, "{}").unwrap();
        let output = hidden(backend_command(&script, Some(&python), &workflow).current_dir(&dir)).output().unwrap();
        assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
        let result: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(result["args"][0], "-f");
        assert_eq!(result["args"][1], workflow.to_string_lossy().as_ref());
        assert_eq!(fs::canonicalize(result["cwd"].as_str().unwrap()).unwrap(), fs::canonicalize(&dir).unwrap());
        fs::remove_file(script).unwrap();fs::remove_file(workflow).unwrap();fs::remove_dir(dir).unwrap();
    }

    use super::*;
    #[test]
    fn progress_and_duplicates() {
        assert_eq!(percentage("42.5%"), Some(42.5));
        assert_eq!(percentage("NaN%"), None);
        assert_eq!(percentage("1000%"), Some(100.0));
        assert_eq!(percentage("INFO 10%"), None);
        let mut m = Merge::default();
        assert!(m.keep("message", 0));
        assert!(!m.keep("message", 1));
        assert!(m.keep("message", 1));
        assert!(!m.keep("message", 0));
    }
    #[test]
    fn partial_lines() {
        let mut p = b"hello\r\npart".to_vec();
        assert_eq!(split_lines(&mut p, false), vec!["hello"]);
        p.extend_from_slice(b"ial\n");
        assert_eq!(split_lines(&mut p, false), vec!["partial"]);
    }
    #[test]
    #[ignore]
    fn fake_engine() {
        let Ok(dir) = std::env::var("ARTGUI_TEST_RUN") else {
            return;
        };
        let p = PathBuf::from(dir);
        fs::write(p.join("run.log"), "Calculating Add_Lattice\n").unwrap();
        eprintln!("Calculating Add_Lattice");
        fs::write(p.join("run.prg"), "0%\n42%").unwrap();
        thread::sleep(Duration::from_millis(500));
        if std::env::var_os("ARTGUI_TEST_CANCEL").is_some() {
            thread::sleep(Duration::from_secs(30));
        }
        fs::write(p.join("run.prg"), "0%\n42%\n100%\n").unwrap();
    }
    fn fixture(cancel_run: bool) {
        let dir = std::env::temp_dir().join(format!(
            "artgui-monitor-test-{}-{}",
            std::process::id(),
            cancel_run
        ));
        fs::create_dir_all(&dir).unwrap();
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "generation::tests::fake_engine",
                "--ignored",
                "--nocapture",
            ])
            .env("ARTGUI_TEST_RUN", &dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if cancel_run {
            command.env("ARTGUI_TEST_CANCEL", "1");
        }
        let child = hidden(&mut command).spawn().unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        if cancel_run {
            let c = cancel.clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(300));
                c.store(true, Ordering::Relaxed);
            });
        }
        let mut updates = vec![];
        let result = monitor(
            child,
            cancel,
            "test",
            &dir.join("run.log"),
            &dir.join("run.prg"),
            &dir.join("console.log"),
            |u| updates.push(u),
        )
        .unwrap();
        assert_eq!(result.0, !cancel_run);
        assert_eq!(result.1, cancel_run);
        if !cancel_run {
            assert!(updates.iter().any(|u| u.progress == Some(100.0)));
            assert_eq!(
                updates
                    .iter()
                    .flat_map(|u| &u.lines)
                    .filter(|l| l.as_str() == "Calculating Add_Lattice")
                    .count(),
                1
            );
        }
        let _ = fs::remove_dir_all(dir);
    }
    #[test]
    fn streams_and_tails() {
        fixture(false);
    }
    #[test]
    fn cancels_child() {
        fixture(true);
    }
}
