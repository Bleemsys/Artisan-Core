//! Disk-backed display tiles and conservative full-detail admission checks.
use crate::mesh_stream::{self, Counts, Primitive};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, VecDeque}, fs::{self, File, OpenOptions}, hash::{Hash, Hasher}, io::{BufWriter, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::{SystemTime,UNIX_EPOCH}};
use tauri::{Manager, State};
use sysinfo::{MemoryRefreshKind, System};

type Result<T> = std::result::Result<T,String>;
const VERSION:u32=1;
const SAMPLE:usize=120_000;
const TILE_PRIMITIVES:u64=65_536;
const GRID:u32=16;
const MIB:u64=1024*1024;
static CACHE_MOVE_LOCK:Mutex<()>=Mutex::new(());

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Tile {pub id:usize,pub path:String,pub count:u64,pub vertices:usize,pub min:[f32;3],pub max:[f32;3],#[serde(default,skip_serializing_if="Option::is_none")]pub cell:Option<u32>}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct MeshPreview {
    pub version:u32,pub source:String,pub source_size:u64,pub modified:u128,
    pub triangles:u64,pub lines:u64,pub nodes:u64,pub elements:u64,
    pub bounds_min:[f32;3],pub bounds_max:[f32;3],pub center:[f32;3],
    pub overview_path:String,pub overview_lines_path:String,pub overview_count:usize,pub overview_lines_count:usize,
    pub tiles:Vec<Tile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lod:Option<crate::mesh_lod::LodInfo>,
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Admission {pub allowed:bool,pub reason:String,pub required_bytes:u64,pub available_bytes:u64,pub position_bytes:u64,pub graphics_bytes:u64}

fn err(e:impl std::fmt::Display)->String{e.to_string()}
fn identity(source:&Path)->Result<(String,u64,u128)>{let m=fs::metadata(source).map_err(err)?;Ok((source.to_string_lossy().into_owned(),m.len(),m.modified().map_err(err)?.duration_since(UNIX_EPOCH).map_err(err)?.as_nanos()))}
fn cache_key(identity:&(String,u64,u128))->String{let mut hash=std::collections::hash_map::DefaultHasher::new();VERSION.hash(&mut hash);identity.hash(&mut hash);format!("{:016x}",hash.finish())}
pub(crate) fn view_scratch_root(executable:&Path)->Result<PathBuf>{
    let folder=executable.parent().filter(|p|!p.as_os_str().is_empty()).ok_or("Could not find the ArtGUI application folder.")?;
    Ok(folder.join("ViewScratch"))
}
fn cache_root()->Result<PathBuf>{view_scratch_root(&std::env::current_exe().map_err(err)?)}
fn legacy_cache_root(app:&tauri::AppHandle)->Result<PathBuf>{Ok(app.path().app_cache_dir().map_err(err)?.join("mesh-preview-v1"))}
fn cache_write_error(root:&Path,error:impl std::fmt::Display)->String{
    format!("Cannot write preview cache in {}: {error}. Put ArtGUI in a folder where you have write access.",root.display())
}
fn cancelled(cancel:&AtomicBool)->Result<()>{if cancel.load(Ordering::Relaxed){Err("Preview cancelled.".into())}else{Ok(())}}

/// Relocate only the matching, completed cache. Other models and unfinished jobs stay put.
fn migrate_cache(legacy_root:&Path,root:&Path,id:&(String,u64,u128),cancel:&AtomicBool,mut progress:impl FnMut(u64,u64)->Result<()>)->Result<bool>{
    let key=cache_key(id);let legacy=legacy_root.join(&key);let destination=root.join(key);
    if destination.exists()||!legacy.is_dir(){return Ok(false);}
    let _guard=CACHE_MOVE_LOCK.lock().map_err(|_|"Preview cache relocation is unavailable.")?;
    cancelled(cancel)?;
    if destination.exists()||valid_cache(&legacy,id).is_none(){return Ok(false);}
    progress(0,1)?;
    cancelled(cancel)?;
    // On the same volume this changes directory metadata rather than copying gigabytes.
    if fs::rename(&legacy,&destination).is_ok(){progress(1,1)?;return Ok(true);}
    // Across volumes (or when an old reader prevents a rename), stage a verified copy.
    copy_legacy_cache(&legacy,root,id,cancel,progress)?;
    Ok(true)
}

fn copy_legacy_cache(legacy:&Path,root:&Path,id:&(String,u64,u128),cancel:&AtomicBool,mut progress:impl FnMut(u64,u64)->Result<()>)->Result<()>{
    let model=valid_cache(legacy,id).ok_or("The previous preview cache changed. Open Preview again.")?;
    let mut names=vec!["manifest.json".to_string(),"overview.bin".to_string(),"overview-lines.bin".to_string()];
    names.extend(model.tiles.iter().map(|t|format!("tile-{}.bin",t.id)));
    for name in ["surface-lod-v2.json","surface-lod-v2.bin"]{if legacy.join(name).is_file(){names.push(name.into());}}
    let total=names.iter().try_fold(0u64,|n,name|fs::metadata(legacy.join(name)).map(|m|n.saturating_add(m.len()))).map_err(err)?;
    if disk_available(root).is_some_and(|free|free<total){return Err(format!("Moving preview cache to {} needs {:.1} GiB of free disk space.",root.display(),total as f64/(1024.*1024.*1024.)));}
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let pending=Pending{path:root.join(format!("building-move-{}-{stamp}",std::process::id())),root:root.to_path_buf()};
    cancelled(cancel)?;fs::create_dir(&pending.path).map_err(|e|cache_write_error(root,e))?;
    let mut copied=0;
    for name in &names{
        cancelled(cancel)?;
        copied+=fs::copy(legacy.join(name),pending.path.join(name)).map_err(|e|format!("Could not move preview cache: {e}. Close other ArtGUI windows and retry."))?;
        progress(copied,total)?;
    }
    cancelled(cancel)?;
    if valid_cache(&pending.path,id).is_none(){return Err("The copied preview cache could not be verified. The previous cache is kept.".into());}
    let destination=root.join(cache_key(id));
    // Never overwrite a cache another process has completed during the copy.
    if destination.exists(){return Err("Another ArtGUI window prepared this preview. Open Preview again.".into());}
    fs::rename(&pending.path,&destination).map_err(|e|cache_write_error(root,e))?;
    // Delete only copied cache files after the new cache is committed. Keep unknown
    // files and any old files still locked by another reader; they are never required.
    for name in &names{let _=fs::remove_file(legacy.join(name));}
    let _=fs::remove_dir(legacy);
    Ok(())
}

fn valid_cache(dir:&Path,id:&(String,u64,u128))->Option<MeshPreview>{
    let bytes=fs::read(dir.join("manifest.json")).ok()?;let mut m:MeshPreview=serde_json::from_slice(&bytes).ok()?;
    if m.version!=VERSION||(&m.source,m.source_size,m.modified)!=(&id.0,id.1,id.2)||m.tiles.len()>100_000{return None;}
    // Paths are reconstructed, never trusted from a cache manifest.
    m.overview_path=dir.join("overview.bin").to_string_lossy().into_owned();
    m.overview_lines_path=dir.join("overview-lines.bin").to_string_lossy().into_owned();
    for t in &mut m.tiles{t.path=dir.join(format!("tile-{}.bin",t.id)).to_string_lossy().into_owned();if t.vertices!=2&&t.vertices!=3{return None;}if t.count>TILE_PRIMITIVES||fs::metadata(&t.path).ok()?.len()!=t.count*t.vertices as u64*12{return None;}}
    if fs::metadata(&m.overview_path).ok()?.len()!=m.overview_count as u64*36||fs::metadata(&m.overview_lines_path).ok()?.len()!=m.overview_lines_count as u64*24{return None;}Some(m)
}

#[tauri::command]
pub async fn prepare_mesh_preview(app:tauri::AppHandle,jobs:State<'_,super::PreviewJobs>,lod_files:State<'_,crate::mesh_lod::LodFiles>,job_id:String,path:String,workflow_path:Option<String>)->Result<MeshPreview>{
    let source=super::find_geometry_path(&app,&path,workflow_path.as_deref())?;
    let token=Arc::new(AtomicBool::new(false));
    jobs.0.lock().map_err(|_|"Preview state is unavailable.")?.insert(job_id.clone(),token.clone());
    let work_app=app.clone();let work_id=job_id.clone();let readers=lod_files.inner().clone();
    let result=tauri::async_runtime::spawn_blocking(move||{
        let _access=crate::scratch::ACCESS.read().map_err(|_|"Preview cache is unavailable.")?;
        cancelled(&token)?;
        let mut model=prepare(&work_app,&source,&work_id,&token)?;
        cancelled(&token)?;
        if let Some(lod)=&mut model.lod{readers.open(lod)?;}
        Ok(model)
    }).await;
    if let Ok(mut active)=jobs.0.lock(){active.remove(&job_id);}
    result.map_err(|e|format!("Preview preparation failed: {e}"))?

}

/// Wait for cache writers/readers, then close native handles before removing files.
#[tauri::command]
pub async fn clean_view_scratch(jobs:State<'_,super::PreviewJobs>,lod_files:State<'_,crate::mesh_lod::LodFiles>)->Result<()>{
    for cancel in jobs.0.lock().map_err(|_|"Preview state is unavailable.")?.values(){cancel.store(true,Ordering::Relaxed);}
    let readers=lod_files.inner().clone();
    tauri::async_runtime::spawn_blocking(move||{
        let _access=crate::scratch::ACCESS.write().map_err(|_|"Preview cache is unavailable.")?;
        let root=cache_root()?;
        readers.close_all()?;
        crate::scratch::clean_contents(&root)
    }).await.map_err(err)?
}

/// RAII cleanup is restricted to the newly created temporary cache directory.
struct Pending {path:PathBuf,root:PathBuf}
impl Drop for Pending {fn drop(&mut self){if self.path.parent()==Some(self.root.as_path())&&self.path.file_name().is_some_and(|n|n.to_string_lossy().starts_with("building-")){let _=fs::remove_dir_all(&self.path);}}}

fn prepare(app:&tauri::AppHandle,source:&Path,job_id:&str,cancel:&AtomicBool)->Result<MeshPreview>{
    let id=identity(source)?;let root=cache_root()?;fs::create_dir_all(&root).map_err(|e|cache_write_error(&root,e))?;let final_dir=root.join(cache_key(&id));
    if let Some(m)=valid_cache(&final_dir,&id){return finish_preview(app,&final_dir,m,job_id,cancel);}
    if let Ok(legacy)=legacy_cache_root(app){
        migrate_cache(&legacy,&root,&id,cancel,|loaded,total|{super::emit_preview_progress(app,job_id,loaded,total,"Moving preview cache…");Ok(())})?;
        // Another preview request may have moved it while this request waited.
        if let Some(moved)=valid_cache(&final_dir,&id){return finish_preview(app,&final_dir,moved,job_id,cancel);}
    }
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let pending=Pending{path:root.join(format!("building-{}-{stamp}",std::process::id())),root:root.clone()};
    fs::create_dir(&pending.path).map_err(|e|cache_write_error(&root,e))?;let scratch=pending.path.join("scratch");fs::create_dir(&scratch).map_err(err)?;
    let ext=source.extension().and_then(|e|e.to_str()).unwrap_or("").to_lowercase();
    let estimate=id.1.saturating_mul(if ext=="inp"{24}else{3}).saturating_add(256*MIB);
    if let Some(free)=disk_available(&root){if estimate>free{return Err(format!("Preview preparation needs up to {:.1} GiB of cache space; {:.1} GiB is available.",estimate as f64/(1024.*1024.*1024.),free as f64/(1024.*1024.*1024.)));}}
    let(mut lo,mut hi,mut total)=([f32::INFINITY;3],[f32::NEG_INFINITY;3],0u64);
    let mut last_bounds=0;
    let counts=mesh_stream::scan(source,&scratch,|n|{cancelled(cancel)?;if n>=last_bounds+8*MIB||n==id.1{super::emit_preview_progress(app,job_id,n,id.1,"Inspecting model bounds…");last_bounds=n;}Ok(())},|p|{for v in &p.points[..p.vertices]{for a in 0..3{lo[a]=lo[a].min(v[a]);hi[a]=hi[a].max(v[a]);}}total+=1;Ok(())})?;
    if total==0{return Err("No supported surfaces or lines were found in this model.".into());}
    cancelled(cancel)?;
    let center=std::array::from_fn(|a|lo[a]/2.+hi[a]/2.);
    let mut builder=Builder::new(&pending.path,lo,hi,center);
    let mut last_emit=0;
    mesh_stream::scan(source,&scratch,|n|{cancelled(cancel)?;if n>=last_emit+8*MIB||n==id.1{super::emit_preview_progress(app,job_id,n,id.1,"Preparing spatial preview cache…");last_emit=n;}Ok(())},|p|builder.push(p))?;
    cancelled(cancel)?;
    let(mut manifest,cache_bytes)=builder.finish(&id,counts)?;
    if identity(source)?!=id{return Err("The model changed during preview preparation. Open it again.".into());}
    // Close all scratch handles before removing only our scratch directory.
    fs::remove_dir_all(&scratch).map_err(err)?;
    super::emit_preview_progress(app,job_id,cache_bytes,cache_bytes,"Finishing preview cache…");
    if final_dir.exists(){
        if let Some(existing)=valid_cache(&final_dir,&id){return finish_preview(app,&final_dir,existing,job_id,cancel);}
        // An invalid old cache belongs to this exact source fingerprint and cache version.
        if final_dir.parent()!=Some(root.as_path()){return Err("Invalid cache directory.".into());}fs::remove_dir_all(&final_dir).map_err(err)?;
    }
    fs::write(pending.path.join("manifest.json"),serde_json::to_vec(&manifest).map_err(err)?).map_err(err)?;
    cancelled(cancel)?;fs::rename(&pending.path,&final_dir).map_err(err)?;
    manifest=valid_cache(&final_dir,&id).ok_or("Preview cache could not be verified.")?;
    finish_preview(app,&final_dir,manifest,job_id,cancel)
}

fn finish_preview(app:&tauri::AppHandle,dir:&Path,mut model:MeshPreview,job_id:&str,cancel:&AtomicBool)->Result<MeshPreview>{
    let mut last=0;
    super::emit_preview_progress(app,job_id,0,model.triangles+model.lines,"Building overview levels…");
    model.lod=crate::mesh_lod::ensure(dir,&model,cancel,|loaded,total|{
        if loaded>=last+1_000_000||loaded==total{super::emit_preview_progress(app,job_id,loaded,total,"Building overview levels…");last=loaded;}
        Ok(())
    })?;
    cancelled(cancel)?;
    app.asset_protocol_scope().allow_directory(dir,true).map_err(err)?;
    Ok(model)
}

struct Builder {
    dir:PathBuf,lo:[f32;3],hi:[f32;3],center:[f32;3],tiles:Vec<Tile>,active:HashMap<(u32,usize),usize>,
    writers:HashMap<usize,BufWriter<File>>,recent:VecDeque<usize>,sample:Vec<Primitive>,sample_lines:Vec<Primitive>,triangles:u64,lines:u64,rng:u64,
}
impl Builder {
    fn new(dir:&Path,lo:[f32;3],hi:[f32;3],center:[f32;3])->Self{Self{dir:dir.into(),lo,hi,center,tiles:Vec::new(),active:HashMap::new(),writers:HashMap::new(),recent:VecDeque::new(),sample:Vec::with_capacity(SAMPLE),sample_lines:Vec::new(),triangles:0,lines:0,rng:0x5bf03635adef}}
    fn push(&mut self,p:Primitive)->Result<()> {
        let mut cell=0;for a in 0..3{let c=p.points[..p.vertices].iter().map(|v|v[a] as f64).sum::<f64>()/p.vertices as f64;let span=self.hi[a] as f64-self.lo[a] as f64;let n=if span>0.{((c-self.lo[a] as f64)/span*GRID as f64).floor().clamp(0.,(GRID-1)as f64)as u32}else{0};cell=cell*GRID+n;}
        let key=(cell,p.vertices);
        let current=self.active.get(&key).copied().filter(|i|self.tiles[*i].count<TILE_PRIMITIVES);
        let index=if let Some(i)=current{i}else{if self.tiles.len()>=100_000{return Err("Preview cache exceeds the supported tile count.".into());}let i=self.tiles.len();self.tiles.push(Tile{id:i,path:String::new(),count:0,vertices:p.vertices,min:[f32::INFINITY;3],max:[f32::NEG_INFINITY;3],cell:Some(cell)});self.active.insert(key,i);i};
        if !self.writers.contains_key(&index){
            while self.writers.len()>=32{if let Some(old)=self.recent.pop_front(){if let Some(mut w)=self.writers.remove(&old){w.flush().map_err(err)?;}}}
            let file=OpenOptions::new().create(true).append(true).open(self.dir.join(format!("tile-{index}.bin"))).map_err(err)?;
            self.writers.insert(index,BufWriter::with_capacity(64*1024,file));self.recent.push_back(index);
        }
        let tile=&mut self.tiles[index];tile.count+=1;let mut bytes=[0u8;36];
        for v in 0..p.vertices{for a in 0..3{let x=p.points[v][a];tile.min[a]=tile.min[a].min(x);tile.max[a]=tile.max[a].max(x);let offset=v*12+a*4;let relative=x-self.center[a];if !relative.is_finite(){return Err("Model coordinates exceed the display range.".into());}bytes[offset..offset+4].copy_from_slice(&relative.to_le_bytes());}}
        self.writers.get_mut(&index).unwrap().write_all(&bytes[..p.vertices*12]).map_err(err)?;
        let (samples,count)=if p.vertices==3{self.triangles+=1;(&mut self.sample,self.triangles)}else{self.lines+=1;(&mut self.sample_lines,self.lines)};
        if samples.len()<SAMPLE{samples.push(p);}else{self.rng^=self.rng<<13;self.rng^=self.rng>>7;self.rng^=self.rng<<17;let n=self.rng%count;if n<SAMPLE as u64{samples[n as usize]=p;}}
        Ok(())
    }
    fn finish(mut self,id:&(String,u64,u128),counts:Counts)->Result<(MeshPreview,u64)> {
        for (_,mut w)in self.writers.drain(){w.flush().map_err(err)?;}
        for (name,items)in [("overview.bin",&self.sample),("overview-lines.bin",&self.sample_lines)]{
            let mut output=BufWriter::new(File::create(self.dir.join(name)).map_err(err)?);
            for p in items {for vertex in &p.points[..p.vertices]{for a in 0..3{output.write_all(&(vertex[a]-self.center[a]).to_le_bytes()).map_err(err)?;}}}output.flush().map_err(err)?;
        }
        let size=self.triangles.saturating_mul(36)+self.lines.saturating_mul(24);
        Ok((MeshPreview{version:VERSION,source:id.0.clone(),source_size:id.1,modified:id.2,triangles:self.triangles,lines:self.lines,nodes:counts.nodes,elements:counts.elements,bounds_min:self.lo,bounds_max:self.hi,center:self.center,overview_path:String::new(),overview_lines_path:String::new(),overview_count:self.sample.len(),overview_lines_count:self.sample_lines.len(),tiles:self.tiles,lod:None},size))
    }
}

/// Checks use live RAM plus renderer budgets; no input or vertex array is read here.
#[tauri::command]
pub fn check_full_detail(app:tauri::AppHandle,path:String,workflow_path:Option<String>,resident_graphics_bytes:u64,graphics_budget_bytes:u64,max_buffer_bytes:u64,heap_available_bytes:Option<u64>)->Result<Admission>{
    let source=super::find_geometry_path(&app,&path,workflow_path.as_deref())?;let id=identity(&source)?;
    let manifest=valid_cache(&cache_root()?.join(cache_key(&id)),&id)
        .or_else(||legacy_cache_root(&app).ok().and_then(|root|valid_cache(&root.join(cache_key(&id)),&id)));
    let counts=if let Some(m)=manifest {(m.triangles,m.lines,m.nodes,m.elements)}else if let Some(n)=super::binary_stl_triangle_count(&source,id.1){(n,0,0,0)}else{return Err("Prepare Preview first so full-detail memory requirements can be checked.".into());};
    let mut system=System::new();system.refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
    let mut format=source.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase();
    if format=="stl"&&super::binary_stl_triangle_count(&source,id.1).is_none(){format="ascii-stl".into();}
    Ok(admit(counts,id.1,&format,system.total_memory(),system.available_memory(),resident_graphics_bytes,graphics_budget_bytes,max_buffer_bytes,heap_available_bytes))
}
fn admit((triangles,lines,nodes,elements):(u64,u64,u64,u64),file_bytes:u64,format:&str,total:u64,available:u64,resident_gpu:u64,gpu_budget:u64,max_buffer:u64,heap:Option<u64>)->Admission {
    let streamed_stl=format=="stl"||format=="ascii-stl";
    // Worst case: three distinct float32 vertices plus uint32 indices per face.
    // Welding savings depend on the input, so admission must not assume them.
    let positions=triangles.saturating_mul(36);let line_bytes=lines.saturating_mul(24);
    let graphics=positions.saturating_add(line_bytes).saturating_add(if streamed_stl{triangles.saturating_mul(12)}else if format=="inp"{positions.saturating_mul(2)}else{0});
    let text=if streamed_stl{32*MIB}else{file_bytes.saturating_mul(if format=="inp"{12}else{8})};
    // STL input and vertex lookup are streamed; do not budget a whole-file copy.
    let graph=if format=="obj"||format=="ply"{triangles.saturating_mul(512)}else{0};
    let required=graphics.saturating_mul(if streamed_stl{2}else{3}).saturating_add(text).saturating_add(graph).saturating_add(nodes.saturating_mul(256)).saturating_add(elements.saturating_mul(512)).saturating_add(128*MIB);
    let reserve=(total/5).max(1024*MIB);let usable=available.saturating_sub(reserve).min(available.saturating_mul(7)/10);
    let mut reason=String::new();
    if total==0||available==0{reason="Available computer memory could not be determined. Continue using Preview.".into();}
    else if !streamed_stl&&file_bytes>256*MIB{reason="The text model exceeds the viewer's safe full-detail text allocation. Continue using Preview.".into();}
    else if (if streamed_stl{triangles.min(65_536).saturating_mul(36)}else{positions}).max(line_bytes)>max_buffer.min(1024*MIB)||max_buffer==0{reason=format!("The model needs a {:.1} GiB vertex buffer, exceeding this viewer's safe buffer capacity. Continue using Preview.",positions.max(line_bytes)as f64/(1024.*1024.*1024.));}
    else if required>usable{reason=format!("Full detail needs approximately {:.1} GiB of additional memory; {:.1} GiB is safely available. Continue using Preview.",required as f64/(1024.*1024.*1024.),usable as f64/(1024.*1024.*1024.));}
    else if graphics.saturating_add(resident_gpu)>gpu_budget.min(512*MIB)||gpu_budget==0{reason="Full detail may exceed the conservative graphics-memory budget. The viewer cannot measure free VRAM. Continue using Preview.".into();}
    else if heap.is_some_and(|n|text.saturating_add(nodes.saturating_mul(256)).saturating_add(elements.saturating_mul(512))>n){reason="Full detail exceeds the available browser memory budget. Continue using Preview.".into();}
    Admission{allowed:reason.is_empty(),reason,required_bytes:required,available_bytes:available,position_bytes:positions,graphics_bytes:graphics}
}

#[cfg(windows)]
fn disk_available(path:&Path)->Option<u64>{
    use std::os::windows::ffi::OsStrExt;
    #[link(name="kernel32")] extern "system"{fn GetDiskFreeSpaceExW(path:*const u16,available:*mut u64,total:*mut u64,free:*mut u64)->i32;}
    let wide:Vec<u16>=path.as_os_str().encode_wide().chain(Some(0)).collect();let mut free=0;
    (unsafe{GetDiskFreeSpaceExW(wide.as_ptr(),&mut free,std::ptr::null_mut(),std::ptr::null_mut())}!=0).then_some(free)
}
#[cfg(not(windows))]fn disk_available(_path:&Path)->Option<u64>{None}

#[cfg(test)]mod tests {
    use super::*;
    fn relocation_fixture(label:&str)->(PathBuf,PathBuf,PathBuf,(String,u64,u128)){
        let stamp=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let scratch=std::env::var_os("ARTGUI_TEST_SCRATCH").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        let base=scratch.join(format!("artgui-cache-move-{}-{label}-{stamp}",std::process::id()));
        let legacy_root=base.join("old");let root=base.join("ArtGUI folder").join("ViewScratch");
        let id=("fixture.stl".to_string(),134,17);let legacy=legacy_root.join(cache_key(&id));
        fs::create_dir_all(&legacy).unwrap();fs::create_dir_all(&root).unwrap();
        let mut builder=Builder::new(&legacy,[0.;3],[1.;3],[0.5;3]);
        builder.push(Primitive::triangle([0.;3],[1.,0.,0.],[0.,1.,0.])).unwrap();
        let(model,_)=builder.finish(&id,Counts::default()).unwrap();
        fs::write(legacy.join("manifest.json"),serde_json::to_vec(&model).unwrap()).unwrap();
        (base,legacy_root,root,id)
    }
    #[test]fn preview_scratch_follows_the_executable_folder(){
        let executable=PathBuf::from("C:/ArtGUI portable/ArtGUI.exe");
        assert_eq!(view_scratch_root(&executable).unwrap(),PathBuf::from("C:/ArtGUI portable/ViewScratch"));
        assert!(view_scratch_root(Path::new("ArtGUI.exe")).is_err());
    }
    #[test]fn preview_cache_relocation_reuses_tiles_and_rebases_hierarchy_paths(){
        let(base,old,root,id)=relocation_fixture("rename");let legacy=old.join(cache_key(&id));let destination=root.join(cache_key(&id));
        let original=fs::read(legacy.join("tile-0.bin")).unwrap();
        let mut data=b"ARTLOD2\0".to_vec();for value in [0f32,0.,0.,0.,0.,1.,0.5]{data.extend_from_slice(&value.to_le_bytes());}
        fs::write(legacy.join("surface-lod-v2.bin"),&data).unwrap();
        let info=crate::mesh_lod::LodInfo{version:2,data_path:legacy.join("surface-lod-v2.bin").to_string_lossy().into_owned(),byte_len:36,roots:vec![0],nodes:vec![crate::mesh_lod::LodNode{id:0,parent:None,children:vec![],level:0,count:1,offset:8,min:[0.;3],max:[1.;3],spacing:1.}],tile_cells:vec![0],handle:String::new()};
        fs::write(legacy.join("surface-lod-v2.json"),serde_json::to_vec(&info).unwrap()).unwrap();
        assert!(migrate_cache(&old,&root,&id,&AtomicBool::new(false),|_,_|Ok(())).unwrap());
        assert!(!legacy.exists());assert_eq!(fs::read(destination.join("tile-0.bin")).unwrap(),original);
        let moved=valid_cache(&destination,&id).unwrap();assert_eq!(PathBuf::from(&moved.tiles[0].path),destination.join("tile-0.bin"));
        let lod=crate::mesh_lod::load(&destination).unwrap();assert_eq!(PathBuf::from(&lod.data_path),destination.join("surface-lod-v2.bin"));
        assert_eq!(fs::read(&lod.data_path).unwrap(),data);fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_relocation_does_not_overwrite_an_existing_destination(){
        let(base,old,root,id)=relocation_fixture("collision");let destination=root.join(cache_key(&id));fs::create_dir(&destination).unwrap();
        fs::write(destination.join("keep.txt"),b"keep").unwrap();
        assert!(!migrate_cache(&old,&root,&id,&AtomicBool::new(false),|_,_|Ok(())).unwrap());
        assert!(valid_cache(&old.join(cache_key(&id)),&id).is_some());assert_eq!(fs::read(destination.join("keep.txt")).unwrap(),b"keep");fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_relocation_rejects_incomplete_sources(){
        let(base,old,root,id)=relocation_fixture("invalid");let legacy=old.join(cache_key(&id));fs::write(legacy.join("tile-0.bin"),b"truncated").unwrap();
        assert!(!migrate_cache(&old,&root,&id,&AtomicBool::new(false),|_,_|Ok(())).unwrap());
        assert!(legacy.is_dir());assert!(!root.join(cache_key(&id)).exists());fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_relocation_cancel_keeps_the_previous_cache(){
        let(base,old,root,id)=relocation_fixture("cancel");
        assert!(migrate_cache(&old,&root,&id,&AtomicBool::new(true),|_,_|Ok(())).is_err());
        assert!(valid_cache(&old.join(cache_key(&id)),&id).is_some());assert!(!root.join(cache_key(&id)).exists());fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_copy_commits_before_cleaning_known_old_files(){
        let(base,old,root,id)=relocation_fixture("copy");let legacy=old.join(cache_key(&id));let original=fs::read(legacy.join("tile-0.bin")).unwrap();
        fs::write(legacy.join("user-note.txt"),b"preserve").unwrap();
        copy_legacy_cache(&legacy,&root,&id,&AtomicBool::new(false),|_,_|Ok(())).unwrap();
        assert!(valid_cache(&root.join(cache_key(&id)),&id).is_some());assert_eq!(fs::read(root.join(cache_key(&id)).join("tile-0.bin")).unwrap(),original);
        assert!(!legacy.join("tile-0.bin").exists());assert_eq!(fs::read(legacy.join("user-note.txt")).unwrap(),b"preserve");fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_copy_cancel_discards_only_its_staging_folder(){
        let(base,old,root,id)=relocation_fixture("copy-cancel");let legacy=old.join(cache_key(&id));let token=AtomicBool::new(false);
        let result=copy_legacy_cache(&legacy,&root,&id,&token,|copied,_|{if copied>0{token.store(true,Ordering::Relaxed);}Ok(())});
        assert!(result.is_err());assert!(valid_cache(&legacy,&id).is_some());assert_eq!(fs::read_dir(&root).unwrap().count(),0);fs::remove_dir_all(base).unwrap();
    }
    #[test]fn preview_cache_copy_write_failure_preserves_the_previous_cache(){
        let(base,old,root,id)=relocation_fixture("copy-failure");let bad_root=base.join("not-a-folder");fs::write(&bad_root,b"keep").unwrap();
        assert!(copy_legacy_cache(&old.join(cache_key(&id)),&bad_root,&id,&AtomicBool::new(false),|_,_|Ok(())).is_err());
        assert!(valid_cache(&old.join(cache_key(&id)),&id).is_some());assert_eq!(fs::read(&bad_root).unwrap(),b"keep");assert_eq!(fs::read_dir(root).unwrap().count(),0);fs::remove_dir_all(base).unwrap();
    }
    #[test]fn warns_about_large_stl_total_memory_not_single_buffer(){let a=admit((398_559_056,0,0,0),19_927_952_884,"stl",512*1024*MIB,400*1024*MIB,0,512*MIB,1024*MIB,None);assert!(!a.allowed);assert!(a.reason.contains("graphics"));assert_eq!(a.position_bytes,14_348_126_016);}
    #[test]fn small_mesh_needs_live_headroom_and_graphics_budget(){assert!(admit((100_000,0,0,0),5_000_084,"stl",16*1024*MIB,8*1024*MIB,0,512*MIB,1024*MIB,None).allowed);assert!(!admit((100_000,0,0,0),5_000_084,"stl",16*1024*MIB,200*MIB,0,512*MIB,1024*MIB,None).allowed);assert!(!admit((100_000,0,0,0),5_000_084,"stl",16*1024*MIB,8*1024*MIB,511*MIB,512*MIB,1024*MIB,None).allowed);}
    #[test]fn text_and_topology_overheads_are_budgeted(){let a=admit((100_000,0,2_000_000,2_000_000),200*MIB,"inp",16*1024*MIB,4*1024*MIB,0,512*MIB,1024*MIB,None);assert!(!a.allowed);}
    #[test]fn spatial_tiles_are_bounded_and_reusable(){
        let root=std::env::temp_dir().join(format!("artgui-tiles-{}",std::process::id()));fs::create_dir_all(&root).unwrap();
        let mut b=Builder::new(&root,[0.;3],[1.;3],[0.5;3]);for _ in 0..TILE_PRIMITIVES+1{b.push(Primitive::triangle([0.;3],[1.,0.,0.],[0.,1.,0.])).unwrap();}
        let id=("fixture".into(),0,0);let(m,_)=b.finish(&id,Counts::default()).unwrap();assert_eq!(m.tiles.len(),2);assert_eq!(m.tiles[0].count,TILE_PRIMITIVES);fs::write(root.join("manifest.json"),serde_json::to_vec(&m).unwrap()).unwrap();assert!(valid_cache(&root,&id).is_some());fs::write(root.join("tile-0.bin"),b"bad").unwrap();assert!(valid_cache(&root,&id).is_none());fs::remove_dir_all(root).unwrap();
    }
    #[test]
    #[ignore = "Optional end-to-end scan and cache benchmark; set ARTGUI_PREVIEW_SOURCE and ARTGUI_PREVIEW_CACHE"]
    fn large_model_cache_benchmark(){
        let source=PathBuf::from(std::env::var("ARTGUI_PREVIEW_SOURCE").expect("Set ARTGUI_PREVIEW_SOURCE"));
        let output=PathBuf::from(std::env::var("ARTGUI_PREVIEW_CACHE").expect("Set ARTGUI_PREVIEW_CACHE to a new empty directory"));
        assert!(!output.exists(),"Benchmark output must be new");fs::create_dir_all(&output).unwrap();let scratch=output.join("scratch");fs::create_dir(&scratch).unwrap();
        let id=identity(&source).unwrap();let start=std::time::Instant::now();let(mut lo,mut hi)=([f32::INFINITY;3],[f32::NEG_INFINITY;3]);let mut count=0u64;
        let counts=mesh_stream::scan(&source,&scratch,|_|Ok(()),|p|{count+=1;for v in &p.points[..p.vertices]{for a in 0..3{lo[a]=lo[a].min(v[a]);hi[a]=hi[a].max(v[a]);}}Ok(())}).unwrap();
        println!("Bounds scanned: {count} primitives in {:.2}s",start.elapsed().as_secs_f64());
        let center=std::array::from_fn(|a|lo[a]/2.+hi[a]/2.);let mut builder=Builder::new(&output,lo,hi,center);
        mesh_stream::scan(&source,&scratch,|_|Ok(()),|p|builder.push(p)).unwrap();let(manifest,bytes)=builder.finish(&id,counts).unwrap();
        assert_eq!(manifest.triangles+manifest.lines,count);fs::write(output.join("manifest.json"),serde_json::to_vec(&manifest).unwrap()).unwrap();assert!(valid_cache(&output,&id).is_some());
        println!("Verified {} tiles, {} triangles, {} cache bytes in {:.2}s",manifest.tiles.len(),manifest.triangles,bytes,start.elapsed().as_secs_f64());
    }
    #[test]
    #[ignore = "Build hierarchical overview from an existing v1 cache; set ARTGUI_LOD_CACHE"]
    fn mesh_lod_existing_cache_benchmark(){
        let dir=PathBuf::from(std::env::var("ARTGUI_LOD_CACHE").expect("Set ARTGUI_LOD_CACHE"));
        let m:MeshPreview=serde_json::from_slice(&fs::read(dir.join("manifest.json")).unwrap()).unwrap();
        let start=std::time::Instant::now();let mut last=0;
        let info=crate::mesh_lod::ensure(&dir,&m,&AtomicBool::new(false),|n,total|{if n>=last+50_000_000{println!("Overview: {n}/{total}");last=n;}Ok(())}).unwrap().unwrap();
        println!("Verified {} hierarchy nodes, {} bytes, {:.2}s",info.nodes.len(),info.byte_len,start.elapsed().as_secs_f64());
        for node in &info.nodes{assert!(node.count<=512);}
    }
}
