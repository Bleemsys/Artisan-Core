use std::{collections::{HashMap, HashSet}, fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};

static NEXT_ASSET: AtomicU64 = AtomicU64::new(1);
const MAX_VERTICES: usize = 100_000;
const MAX_FACES: usize = 100_000;

#[tauri::command]
pub fn choose_cell_mesh() -> Option<String> {
    rfd::FileDialog::new().add_filter("Unit-cell mesh", &["stl", "obj"]).pick_file().map(|p| p.to_string_lossy().into_owned())
}

fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] { [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]] }
fn dot(a: [f64; 3], b: [f64; 3]) -> f64 { a.iter().zip(b).map(|(x,y)| x*y).sum() }
fn subtract(a: [f64; 3], b: [f64; 3]) -> [f64; 3] { [a[0]-b[0],a[1]-b[1],a[2]-b[2]] }
fn triangulate(vertices: &[[f64;3]], face: &[usize]) -> Result<Vec<[usize;3]>,String> {
    if face.len()==3 { return Ok(vec![[face[0],face[1],face[2]]]); }
    let origin=vertices[face[0]];let mut normal=[0.0;3];
    for i in 1..face.len()-1 { let n=cross(subtract(vertices[face[i]],origin),subtract(vertices[face[i+1]],origin));for a in 0..3 {normal[a]+=n[a];} }
    let drop=(0..3).max_by(|a,b|normal[*a].abs().total_cmp(&normal[*b].abs())).unwrap();let axes:Vec<_>=(0..3).filter(|a|*a!=drop).collect();
    let p:Vec<[f64;2]>=face.iter().map(|i|[vertices[*i][axes[0]],vertices[*i][axes[1]]]).collect();
    let area:f64=(0..p.len()).map(|i|p[i][0]*p[(i+1)%p.len()][1]-p[(i+1)%p.len()][0]*p[i][1]).sum();let sign=if area>0.0 {1.0} else {-1.0};
    let turn=|a:usize,b:usize,c:usize|((p[b][0]-p[a][0])*(p[c][1]-p[a][1])-(p[b][1]-p[a][1])*(p[c][0]-p[a][0]))*sign;
    let mut remaining:Vec<usize>=(0..face.len()).collect();let mut triangles=Vec::new();
    while remaining.len()>3 {
        let mut found=false;
        for i in 0..remaining.len() {
            let a=remaining[(i+remaining.len()-1)%remaining.len()];let b=remaining[i];let c=remaining[(i+1)%remaining.len()];
            if turn(a,b,c)<=1e-18 {continue;}
            if remaining.iter().any(|q|*q!=a&&*q!=b&&*q!=c&&turn(a,b,*q)>=-1e-18&&turn(b,c,*q)>=-1e-18&&turn(c,a,*q)>=-1e-18) {continue;}
            triangles.push([face[a],face[b],face[c]]);remaining.remove(i);found=true;break;
        }
        if !found {return Err("A polygon could not be triangulated. Remove crossing or redundant collinear vertices.".into());}
    }
    if turn(remaining[0],remaining[1],remaining[2])<=1e-18 {return Err("A polygon contains a zero-area triangle.".into());}
    triangles.push([face[remaining[0]],face[remaining[1]],face[remaining[2]]]);Ok(triangles)
}

fn mesh_obj(vertices: &[[f64; 3]], faces: &[Vec<usize>], kind: &str, domain: &str) -> Result<String, String> {
    if !["Geom", "Geom-Plate"].contains(&kind) || !["Hex", "Tet"].contains(&domain) { return Err("Choose Geometry or Plate in a Hex or Tet reference domain.".into()); }
    if vertices.len() < 3 || vertices.len() > MAX_VERTICES || faces.is_empty() || faces.len() > MAX_FACES { return Err("The prepared mesh is empty or exceeds the editing limit.".into()); }
    if vertices.iter().any(|p| p.iter().any(|v| !v.is_finite() || *v < 0.0 || *v > 1.0) || domain == "Tet" && p.iter().sum::<f64>() > 1.0 + 1e-9) { return Err("Prepared mesh vertices must lie inside the reference domain.".into()); }
    let mut edges: HashMap<(usize, usize), (usize, i32)> = HashMap::new();
    let mut seen = HashSet::new();
    let mut volume = 0.0;
    for face in faces {
        if face.len() < 3 || face.len() > 64 || face.iter().any(|i| *i >= vertices.len()) { return Err("A face has invalid vertex indices.".into()); }
        let mut key = face.clone(); key.sort_unstable();
        if key.windows(2).any(|p| p[0] == p[1]) || !seen.insert(key) { return Err("Remove repeated vertices and duplicate faces.".into()); }
        let origin = vertices[face[0]];
        let mut normal = [0.0; 3];
        for i in 1..face.len()-1 {
            let a = vertices[face[i]]; let b = vertices[face[i+1]];
            let n = cross(subtract(a, origin), subtract(b, origin));
            for axis in 0..3 { normal[axis] += n[axis]; }
            volume += dot(origin, cross(a,b))/6.0;
        }
        let length = dot(normal, normal).sqrt();
        if !length.is_finite() || length <= 1e-24 { return Err("Remove zero-area faces.".into()); }
        if face.iter().any(|i| dot(subtract(vertices[*i],origin),normal).abs()/length > 1e-7) { return Err("Polygon vertices must lie in one plane.".into()); }
        for i in 0..face.len() {
            let a = face[i]; let b = face[(i+1)%face.len()];
            let edge = edges.entry((a.min(b),a.max(b))).or_default();
            edge.0 += 1; edge.1 += if a < b { 1 } else { -1 };
        }
    }
    if kind == "Geom" && (edges.values().any(|(count,direction)| *count != 2 || *direction != 0) || !volume.is_finite() || volume <= 0.0) { return Err("Geometry requires a closed, consistently outward-oriented solid boundary.".into()); }
    let mut output = format!("# ArtGUI prepared {kind} unit cell; reference domain {domain}\n");
    for p in vertices { output.push_str(&format!("v {} {} {}\n",p[0],p[1],p[2])); }
    for face in faces {
        // Artisan reads triangle primitives. Comments preserve editable polygon
        // grouping for ArtGUI without changing the standard OBJ mesh geometry.
        output.push_str("# ArtGUI polygon");for i in face {output.push_str(&format!(" {}",i+1));}output.push('\n');
        for triangle in triangulate(vertices,face)? {output.push_str(&format!("f {} {} {}\n",triangle[0]+1,triangle[1]+1,triangle[2]+1));}
    }
    Ok(output)
}

fn safe_stem(value: &str) -> String { let name: String = value.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').take(64).collect(); if name.is_empty() { "cell".into() } else { name } }
fn asset_directory(workflow: &Path) -> Result<PathBuf, String> {
    if !workflow.is_absolute() || !workflow.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("json")) { return Err("Save the workflow as a JSON file before using its asset folder.".into()); }
    let parent = workflow.parent().filter(|p| p.is_dir()).ok_or("The workflow folder does not exist.")?;
    let stem = safe_stem(&workflow.file_stem().unwrap_or_default().to_string_lossy());
    Ok(parent.join(format!("{stem}_assets")).join("cells"))
}
fn write_new_asset(path: &Path, contents: &str) -> Result<(), String> {
    if !path.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("obj")) { return Err("Prepared cells must be saved as .obj files.".into()); }
    let mut file = OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| format!("Could not create a new prepared mesh; existing files are never overwritten: {e}"))?;
    if let Err(error) = file.write_all(contents.as_bytes()).and_then(|_| file.sync_all()) { drop(file); let _ = fs::remove_file(path); return Err(format!("Could not save prepared mesh: {error}")); }
    Ok(())
}

#[tauri::command]
pub fn save_cell_mesh(vertices: Vec<[f64;3]>, faces: Vec<Vec<usize>>, kind: String, domain: String, name: String, workflow_path: Option<String>) -> Result<Option<String>,String> {
    let contents = mesh_obj(&vertices,&faces,&kind,&domain)?;
    let path = if let Some(workflow) = workflow_path.filter(|p| !p.trim().is_empty()) {
        let directory = asset_directory(Path::new(&workflow))?;
        fs::create_dir_all(&directory).map_err(|e| format!("Could not create the cell asset folder: {e}"))?;
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
        directory.join(format!("{}_{}_{}.obj",safe_stem(&name),stamp,NEXT_ASSET.fetch_add(1,Ordering::Relaxed)))
    } else {
        let Some(path) = rfd::FileDialog::new().add_filter("Prepared unit cell", &["obj"]).set_file_name(format!("{}_cell.obj",safe_stem(&name))).save_file() else { return Ok(None); };
        path
    };
    write_new_asset(&path,&contents)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn plate_allows_open_boundaries_but_geometry_requires_a_solid() {
        let vertices=vec![[0.0,0.0,0.5],[1.0,0.0,0.5],[1.0,1.0,0.5],[0.0,1.0,0.5]]; let faces=vec![vec![0,1,2,3]];
        let obj=mesh_obj(&vertices,&faces,"Geom-Plate","Hex").unwrap();assert!(obj.contains("# ArtGUI polygon 1 2 3 4"));assert!(obj.lines().filter(|l|l.starts_with("f ")).all(|l|l.split_whitespace().count()==4));
        assert!(mesh_obj(&vertices,&faces,"Geom","Hex").is_err());
        assert!(mesh_obj(&vertices,&faces,"Geom-Plate","Tet").is_err());
        assert!(mesh_obj(&vertices,&[vec![0,1,99]],"Geom-Plate","Hex").is_err());
        assert!(mesh_obj(&vertices,&[vec![0,1,1]],"Geom-Plate","Hex").is_err());
    }
    #[test] fn accepts_outward_tetrahedron_and_rejects_reversed_or_nonfinite_mesh() {
        let v=vec![[0.0,0.0,0.0],[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]];
        let mut f=vec![vec![0,2,1],vec![0,1,3],vec![0,3,2],vec![1,2,3]];
        assert!(mesh_obj(&v,&f,"Geom","Tet").is_ok());for face in &mut f { face.reverse(); } assert!(mesh_obj(&v,&f,"Geom","Tet").is_err());
        let mut bad=v;bad[0][0]=f64::NAN;assert!(mesh_obj(&bad,&f,"Geom-Plate","Hex").is_err());
    }
    #[test] fn asset_creation_cannot_overwrite_an_existing_file() {
        let dir=std::env::temp_dir().join(format!("artgui-cell-assets-{}-{}",std::process::id(),NEXT_ASSET.fetch_add(1,Ordering::Relaxed)));fs::create_dir(&dir).unwrap();let path=dir.join("source.obj");
        write_new_asset(&path,"original").unwrap();assert!(write_new_asset(&path,"replacement").is_err());assert_eq!(fs::read_to_string(&path).unwrap(),"original");
        assert!(write_new_asset(&dir.join("bad.txt"),"mesh").is_err());fs::remove_file(path).unwrap();fs::remove_dir(dir).unwrap();
        assert_eq!(safe_stem("../../test\\bad"),"testbad");assert!(asset_directory(Path::new("relative.json")).is_err());
    }
}
