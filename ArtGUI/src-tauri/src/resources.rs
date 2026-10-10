use serde::Serialize;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use sysinfo::{MemoryRefreshKind, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{Manager, State};

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupUsage {
    memory_bytes: Option<u64>,
    cpu_percent: Option<f64>,
    process_count: usize,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPoint {
    sampled_at: u64,
    system_memory_bytes: u64,
    system_cpu_percent: Option<f64>,
    artisan: GroupUsage,
    artgui: GroupUsage,
    run_id: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    sampled_at: u64,
    total_bytes: u64,
    used_bytes: u64,
    available_bytes: u64,
    cpu_percent: Option<f64>,
    artisan: GroupUsage,
    artgui: GroupUsage,
    run_active: bool,
    run_id: Option<String>,
    peak_bytes: Option<u64>,
    history: Vec<HistoryPoint>,
}

#[derive(Clone, Default)]
pub struct ResourceMonitor {
    latest: Arc<Mutex<Option<ResourceSnapshot>>>,
    stopped: Arc<AtomicBool>,
}
impl ResourceMonitor {
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Relaxed);
    }
}
#[tauri::command]
pub fn resource_snapshot(
    state: State<'_, ResourceMonitor>,
) -> Result<Option<ResourceSnapshot>, String> {
    if !sysinfo::IS_SUPPORTED_SYSTEM {
        return Err("Resource monitoring is unavailable on this platform.".into());
    }
    Ok(state
        .latest
        .lock()
        .map_err(|_| "Resource monitor is unavailable.")?
        .clone())
}

// One native sampler runs independently of the selected tab or WebView timers.
pub fn start(app: tauri::AppHandle) {
    let state = app.state::<ResourceMonitor>().inner().clone();
    std::thread::spawn(move || {
        let mut sampler = Sampler::new();
        while !state.stopped.load(Ordering::Relaxed) {
            let active = app
                .state::<super::generation::GenerationState>()
                .resource_run();
            let snapshot = sampler.sample(active);
            if let Ok(mut latest) = state.latest.lock() {
                *latest = Some(snapshot);
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}

#[derive(Clone)]
struct ProcessRow {
    pid: u32,
    parent: Option<u32>,
    born: u64,
    memory: u64,
    cpu: f64,
}

// Retaining live identities accounts for workers after their parent exits.
// Birth times prevent reused PIDs from joining an old run or process tree.
fn descendants(
    rows: &[ProcessRow],
    known: &mut HashMap<u32, u64>,
    root: Option<(u32, u64)>,
    exclude: &HashSet<u32>,
) {
    let by_pid: HashMap<_, _> = rows.iter().map(|p| (p.pid, p)).collect();
    known.retain(|pid, born| {
        !exclude.contains(pid) && by_pid.get(pid).is_some_and(|p| p.born == *born)
    });
    if let Some(row) = root.and_then(|(pid, born)| by_pid.get(&pid).filter(|p| p.born == born)) {
        if !exclude.contains(&row.pid) {
            known.insert(row.pid, row.born);
        }
    }
    loop {
        let mut added = false;
        for row in rows {
            if !known.contains_key(&row.pid)
                && !exclude.contains(&row.pid)
                && row
                    .parent
                    .and_then(|pid| known.get(&pid))
                    .is_some_and(|born| row.born >= *born)
            {
                known.insert(row.pid, row.born);
                added = true;
            }
        }
        if !added {
            break;
        }
    }
}
fn percent(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.0, 100.0)
    } else {
        0.0
    }
}
fn group_usage(
    rows: &[ProcessRow],
    members: &HashMap<u32, u64>,
    previous: &HashMap<u32, u64>,
    cpu_count: usize,
) -> GroupUsage {
    let included: Vec<_> = rows
        .iter()
        .filter(|p| members.get(&p.pid) == Some(&p.born))
        .collect();
    if included.is_empty() {
        return GroupUsage::default();
    }
    let warmed = included
        .iter()
        .all(|p| previous.get(&p.pid) == Some(&p.born));
    GroupUsage {
        memory_bytes: Some(
            included
                .iter()
                .fold(0u64, |sum, p| sum.saturating_add(p.memory)),
        ),
        cpu_percent: warmed.then(|| {
            percent(included.iter().map(|p| p.cpu).sum::<f64>() / cpu_count.max(1) as f64)
        }),
        process_count: included.len(),
    }
}
struct Sampler {
    system: System,
    previous: HashMap<u32, u64>,
    artisan: HashMap<u32, u64>,
    artgui: HashMap<u32, u64>,
    run_id: Option<String>,
    artisan_root: Option<(u32, u64)>,
    peak: Option<u64>,
    history: VecDeque<HistoryPoint>,
    warmed: bool,
}
impl Sampler {
    fn new() -> Self {
        Self {
            system: System::new(),
            previous: HashMap::new(),
            artisan: HashMap::new(),
            artgui: HashMap::new(),
            run_id: None,
            artisan_root: None,
            peak: None,
            history: VecDeque::new(),
            warmed: false,
        }
    }
    fn sample(&mut self, active: Option<(String, Option<u32>)>) -> ResourceSnapshot {
        self.system
            .refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
        self.system.refresh_cpu_usage();
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
        let rows: Vec<_> = self
            .system
            .processes()
            .iter()
            .map(|(pid, p)| ProcessRow {
                pid: pid.as_u32(),
                parent: p.parent().map(|pid| pid.as_u32()),
                born: p.start_time(),
                memory: p.memory(),
                cpu: p.cpu_usage() as f64,
            })
            .collect();
        if let Some((id, _)) = &active {
            if self.run_id.as_ref() != Some(id) {
                self.run_id = Some(id.clone());
                self.artisan_root = None;
                self.artisan.clear();
                self.peak = None;
            }
        }
        if self.artisan_root.is_none() {
            self.artisan_root = active
                .as_ref()
                .and_then(|(_, pid)| *pid)
                .and_then(|pid| rows.iter().find(|p| p.pid == pid))
                .map(|p| (p.pid, p.born));
        }
        descendants(&rows, &mut self.artisan, self.artisan_root, &HashSet::new());
        let excluded: HashSet<_> = self.artisan.keys().copied().collect();
        let gui_root = rows
            .iter()
            .find(|p| p.pid == std::process::id())
            .map(|p| (p.pid, p.born));
        descendants(&rows, &mut self.artgui, gui_root, &excluded);
        let cpus = self.system.cpus().len();
        let artisan = group_usage(&rows, &self.artisan, &self.previous, cpus);
        let artgui = group_usage(&rows, &self.artgui, &self.previous, cpus);
        if active.is_some() || artisan.process_count > 0 {
            if let Some(memory) = artisan.memory_bytes {
                self.peak = Some(self.peak.unwrap_or(0).max(memory));
            }
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let total = self.system.total_memory();
        let available = self.system.available_memory().min(total);
        let used = total.saturating_sub(available);
        let cpu = self
            .warmed
            .then(|| percent(self.system.global_cpu_usage() as f64));
        self.history.push_back(HistoryPoint {
            sampled_at: now,
            system_memory_bytes: used,
            system_cpu_percent: cpu,
            artisan: artisan.clone(),
            artgui: artgui.clone(),
            run_id: self.run_id.clone(),
        });
        while self.history.len() > 61
            || self
                .history
                .front()
                .is_some_and(|p| now.saturating_sub(p.sampled_at) > 60_000)
        {
            self.history.pop_front();
        }
        self.previous = rows.iter().map(|p| (p.pid, p.born)).collect();
        self.warmed = true;
        ResourceSnapshot {
            sampled_at: now,
            total_bytes: total,
            used_bytes: used,
            available_bytes: available,
            cpu_percent: cpu,
            artisan,
            artgui,
            run_active: active.is_some(),
            run_id: self.run_id.clone(),
            peak_bytes: self.peak,
            history: self.history.iter().cloned().collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn row(pid: u32, parent: Option<u32>, born: u64) -> ProcessRow {
        ProcessRow {
            pid,
            parent,
            born,
            memory: 100,
            cpu: 80.0,
        }
    }
    #[test]
    fn trees_include_workers_and_exclude_backend_from_gui() {
        let rows = vec![
            row(1, None, 1),
            row(2, Some(1), 2),
            row(3, Some(2), 3),
            row(4, Some(1), 4),
            row(5, None, 5),
        ];
        let mut artisan = HashMap::new();
        descendants(&rows, &mut artisan, Some((2, 2)), &HashSet::new());
        assert_eq!(artisan.len(), 2);
        let mut gui = HashMap::new();
        descendants(
            &rows,
            &mut gui,
            Some((1, 1)),
            &artisan.keys().copied().collect(),
        );
        assert_eq!(
            gui.keys().copied().collect::<HashSet<_>>(),
            HashSet::from([1, 4])
        );
    }
    #[test]
    fn retains_orphans_but_rejects_pid_reuse_and_older_children() {
        let mut known = HashMap::from([(2, 2), (3, 3)]);
        let rows = vec![
            row(3, Some(2), 3),
            row(4, Some(3), 4),
            row(5, Some(3), 1),
            row(2, None, 10),
        ];
        descendants(&rows, &mut known, Some((2, 2)), &HashSet::new());
        assert_eq!(
            known.keys().copied().collect::<HashSet<_>>(),
            HashSet::from([3, 4])
        );
    }
    #[test]
    fn cpu_uses_whole_machine_capacity_and_warms_new_processes() {
        let rows = vec![row(2, None, 2), row(3, Some(2), 3)];
        let members = HashMap::from([(2, 2), (3, 3)]);
        assert_eq!(
            group_usage(&rows, &members, &members, 4).cpu_percent,
            Some(40.0)
        );
        assert_eq!(
            group_usage(&rows, &members, &HashMap::new(), 4).cpu_percent,
            None
        );
        assert_eq!(
            group_usage(&rows, &members, &members, 4).memory_bytes,
            Some(200)
        );
        assert_eq!(percent(f64::NAN), 0.0);
    }
    #[test]
    fn live_sampler_reads_system_and_own_process() {
        let mut sampler = Sampler::new();
        let first = sampler.sample(None);
        assert!(first.total_bytes > 0);
        assert!(first.artgui.memory_bytes.unwrap_or(0) > 0);
        assert_eq!(first.cpu_percent, None);
        std::thread::sleep(Duration::from_millis(250));
        let second = sampler.sample(None);
        assert!((0.0..=100.0).contains(&second.cpu_percent.unwrap()));
        assert_eq!(second.history.len(), 2);
        assert_eq!(second.artisan.process_count, 0);
    }
    #[test]
    fn live_child_is_separate_from_gui_and_peak_resets_per_run() {
        use std::process::{Command, Stdio};
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args(["resources::tests::memory_fixture", "--exact", "--ignored"])
            .env("ARTGUI_RESOURCE_FIXTURE", "1")
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        struct ChildGuard(std::process::Child);
        impl Drop for ChildGuard {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let mut child = ChildGuard(command.spawn().unwrap());
        let mut sampler = Sampler::new();
        let mut snapshot = sampler.sample(Some(("first".into(), Some(child.0.id()))));
        for _ in 0..20 {
            if snapshot.artisan.memory_bytes.unwrap_or(0) > 32 * 1024 * 1024 {
                break;
            }
            std::thread::sleep(Duration::from_millis(50));
            snapshot = sampler.sample(Some(("first".into(), Some(child.0.id()))));
        }
        assert!(snapshot.artisan.memory_bytes.unwrap_or(0) > 32 * 1024 * 1024);
        assert!(sampler.artisan.contains_key(&child.0.id()));
        assert!(!sampler.artgui.contains_key(&child.0.id()));
        let peak = snapshot.peak_bytes;
        child.0.kill().unwrap();
        child.0.wait().unwrap();
        assert_eq!(sampler.sample(None).peak_bytes, peak);
        let next = sampler.sample(Some(("second".into(), None)));
        assert_eq!(next.peak_bytes, None);
        assert_eq!(next.artisan.process_count, 0);
    }
    #[test]
    #[ignore]
    fn memory_fixture() {
        if std::env::var_os("ARTGUI_RESOURCE_FIXTURE").is_none() {
            return;
        }
        let memory = vec![7u8; 48 * 1024 * 1024];
        std::hint::black_box(&memory);
        std::thread::sleep(Duration::from_secs(5));
        std::hint::black_box(&memory);
    }
    #[test]
    #[ignore]
    fn browser_resource_bridge() {
        let Some(output) = std::env::var_os("ARTGUI_RESOURCE_QA_OUTPUT") else {
            return;
        };
        let count = std::env::var("ARTGUI_RESOURCE_QA_STREAM")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(1)
            .min(600);
        let mut sampler = Sampler::new();
        sampler.sample(None);
        std::thread::sleep(Duration::from_millis(250));
        for _ in 0..count {
            let active = std::env::var_os("ARTGUI_RESOURCE_QA_CONTROL")
                .and_then(|path| std::fs::read(path).ok())
                .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
                .and_then(|value| {
                    Some((
                        value["runId"].as_str()?.to_owned(),
                        value["pid"].as_u64().map(|pid| pid as u32),
                    ))
                });
            let snapshot = sampler.sample(active);
            std::fs::write(&output, serde_json::to_vec(&snapshot).unwrap()).unwrap();
            if count > 1 {
                std::thread::sleep(Duration::from_secs(1));
            }
        }
    }
}
