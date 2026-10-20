//! Bounded-memory surface reader used by the display cache, never by Artisan.
use std::{collections::HashMap, fs::{self, File, OpenOptions}, io::{BufRead, BufReader, BufWriter, Read, Seek, SeekFrom, Write}, path::Path};

pub type Result<T> = std::result::Result<T, String>;
pub const MAX_RECORD: u64 = 4 * 1024 * 1024;

#[derive(Clone, Copy, Debug)]
pub struct Primitive { pub points: [[f32; 3]; 3], pub vertices: usize }
impl Primitive {
    pub fn triangle(a: [f32;3], b: [f32;3], c: [f32;3]) -> Self { Self {points: [a,b,c], vertices: 3} }
    fn line(a: [f32;3], b: [f32;3]) -> Self { Self {points: [a,b,a], vertices: 2} }
}
#[derive(Default, Clone, Copy)]
pub struct Counts { pub nodes: u64, pub elements: u64 }

fn err(e: impl std::fmt::Display) -> String { e.to_string() }
fn number(s: &str) -> Result<f32> {
    let n: f32 = s.replace(['d','D'], "e").parse().map_err(|_| format!("Invalid coordinate: {s}"))?;
    if !n.is_finite() { return Err("Model contains non-finite or out-of-range coordinates.".into()); }
    Ok(n)
}
fn id(s: &str) -> Result<u64> { s.parse::<u64>().ok().filter(|n| *n > 0).ok_or_else(|| format!("Invalid mesh ID: {s}")) }
fn point(words: &[&str]) -> Result<[f32;3]> {
    if words.len() < 2 { return Err("Incomplete mesh vertex.".into()); }
    Ok([number(words[0])?, number(words[1])?, if words.len()>2 {number(words[2])?} else {0.}])
}
// read_line()/lines() have no record-size bound; malformed text must not allocate gigabytes.
fn each_line(path: &Path, mut visit: impl FnMut(&str, u64) -> Result<()>) -> Result<()> {
    let mut file = BufReader::with_capacity(1024*1024, File::open(path).map_err(err)?);
    let mut line = Vec::new(); let mut offset = 0;
    loop {
        line.clear();
        let n = file.by_ref().take(MAX_RECORD+1).read_until(b'\n', &mut line).map_err(err)?;
        if n == 0 { break; }
        if n as u64 > MAX_RECORD { return Err("Mesh text record exceeds 4 MiB.".into()); }
        offset += n as u64;
        visit(std::str::from_utf8(&line).map_err(|_| "Mesh is not supported UTF-8 text.")?.trim(), offset)?;
    }
    Ok(())
}

/// On-disk hash table for arbitrary INP node IDs (also used for duplicate element IDs).
/// Fixed RAM regardless of node count. Coordinates are cached in a small bounded map.
struct Nodes { file: File, slots: u64, cache: HashMap<u64,[f32;3]> }
impl Nodes {
    fn new(path: &Path, count: u64) -> Result<Self> {
        let slots = count.saturating_mul(2).max(16).checked_next_power_of_two().ok_or("Too many nodes.")?;
        let file = OpenOptions::new().create(true).truncate(true).read(true).write(true).open(path).map_err(err)?;
        file.set_len(slots.checked_mul(24).ok_or("Node table is too large.")?).map_err(err)?;
        Ok(Self {file,slots,cache:HashMap::new()})
    }
    fn slot(&mut self, key: u64) -> Result<(u64,[u8;24])> {
        let mut at = key.wrapping_mul(0x9e3779b97f4a7c15) & (self.slots-1);
        for _ in 0..self.slots {
            self.file.seek(SeekFrom::Start(at*24)).map_err(err)?;
            let mut data=[0;24]; self.file.read_exact(&mut data).map_err(err)?;
            let found = u64::from_le_bytes(data[..8].try_into().unwrap());
            if found==0 || found==key { return Ok((at,data)); }
            at=(at+1)&(self.slots-1);
        }
        Err("Node lookup table is full.".into())
    }
    fn insert(&mut self, key: u64, p: [f32;3]) -> Result<()> {
        let (at,mut data)=self.slot(key)?;
        if u64::from_le_bytes(data[..8].try_into().unwrap())!=0 { return Err(format!("Duplicate mesh ID: {key}")); }
        data[..8].copy_from_slice(&key.to_le_bytes());
        for a in 0..3 {data[8+a*4..12+a*4].copy_from_slice(&p[a].to_le_bytes());}
        self.file.seek(SeekFrom::Start(at*24)).map_err(err)?;self.file.write_all(&data).map_err(err)?;
        self.remember(key,p); Ok(())
    }
    fn remember(&mut self,key:u64,p:[f32;3]) { if self.cache.len()>=16384 {self.cache.clear();} self.cache.insert(key,p); }
    fn get(&mut self,key:u64)->Result<[f32;3]> {
        if let Some(p)=self.cache.get(&key){return Ok(*p);}
        let (_,data)=self.slot(key)?;
        if u64::from_le_bytes(data[..8].try_into().unwrap())==0 {return Err(format!("Missing mesh node: {key}"));}
        let p=std::array::from_fn(|a|f32::from_le_bytes(data[8+a*4..12+a*4].try_into().unwrap()));
        self.remember(key,p);Ok(p)
    }
}

/// Callback progress also checks cancellation. Faces arrive in source coordinates.
pub fn scan(path:&Path, scratch:&Path, mut progress:impl FnMut(u64)->Result<()>, mut emit:impl FnMut(Primitive)->Result<()>) -> Result<Counts> {
    match path.extension().and_then(|s|s.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "stl"=> {scan_stl(path,&mut progress,&mut emit)?;Ok(Counts::default())},
        "obj"=>scan_obj(path,scratch,&mut progress,&mut emit),
        "ply"=>scan_ply(path,scratch,&mut progress,&mut emit),
        "inp"=>scan_inp(path,scratch,&mut progress,&mut emit),
        _=>Err("Preview supports STL, OBJ, ASCII PLY and flat linear-element INP meshes.".into())
    }
}
fn scan_stl(path:&Path, progress:&mut impl FnMut(u64)->Result<()>, emit:&mut impl FnMut(Primitive)->Result<()>) -> Result<()> {
    let mut input=BufReader::with_capacity(1024*1024,File::open(path).map_err(err)?);
    let size=input.get_ref().metadata().map_err(err)?.len();let mut header=[0;84];
    let binary=input.read_exact(&mut header).is_ok() && 84+u32::from_le_bytes(header[80..].try_into().unwrap()) as u64*50==size;
    if binary {
        let count=u32::from_le_bytes(header[80..].try_into().unwrap());let mut record=[0;50];
        for i in 0..count {
            if i%32768==0 {progress(84+i as u64*50)?;}
            input.read_exact(&mut record).map_err(err)?;
            let mut p=[[0.;3];3];
            for v in 0..3 {for a in 0..3 {let k=12+v*12+a*4;p[v][a]=f32::from_le_bytes(record[k..k+4].try_into().unwrap());if !p[v][a].is_finite(){return Err(format!("Invalid coordinate at STL triangle {i}."));}}}
            emit(Primitive{points:p,vertices:3})?;
        }
    } else {
        let mut p=[[0.;3];3];let mut n=0;let mut last=0;
        each_line(path,|line,offset|{
            if offset-last>1024*1024 {progress(offset)?;last=offset;}
            let words:Vec<_>=line.split_whitespace().collect();
            if words.first().is_some_and(|s|s.eq_ignore_ascii_case("vertex")) {
                if words.len()!=4 {return Err("Incomplete ASCII STL vertex.".into());}
                p[n]=point(&words[1..])?;n+=1;if n==3 {emit(Primitive{points:p,vertices:3})?;n=0;}
            } Ok(())
        })?;
        if n!=0 {return Err("Incomplete ASCII STL triangle.".into());}
    }
    progress(size)
}

// Indexed text meshes keep vertices on disk, not in a JS object graph.
struct Indexed { file:File, count:u64, cache:HashMap<u64,[f32;3]> }
impl Indexed {
    fn new(path:&Path)->Result<Self>{Ok(Self{file:OpenOptions::new().create(true).truncate(true).read(true).write(true).open(path).map_err(err)?,count:0,cache:HashMap::new()})}
    fn push(&mut self,p:[f32;3])->Result<()> {self.file.seek(SeekFrom::End(0)).map_err(err)?;for x in p {self.file.write_all(&x.to_le_bytes()).map_err(err)?;}self.count+=1;if self.cache.len()>16384{self.cache.clear();}self.cache.insert(self.count-1,p);Ok(())}
    fn get(&mut self,id:u64)->Result<[f32;3]>{if id>=self.count{return Err(format!("Missing vertex index: {id}"));}if let Some(p)=self.cache.get(&id){return Ok(*p);}self.file.seek(SeekFrom::Start(id*12)).map_err(err)?;let mut b=[0;12];self.file.read_exact(&mut b).map_err(err)?;let p=std::array::from_fn(|a|f32::from_le_bytes(b[a*4..a*4+4].try_into().unwrap()));if self.cache.len()>16384{self.cache.clear();}self.cache.insert(id,p);Ok(p)}
}
fn scan_obj(path:&Path,scratch:&Path,progress:&mut impl FnMut(u64)->Result<()>,emit:&mut impl FnMut(Primitive)->Result<()>) -> Result<Counts> {
    let mut vertices=Indexed::new(&scratch.join("vertices.tmp"))?;let mut counts=Counts::default();let mut last=0;
    each_line(path,|line,offset|{
        if offset-last>1024*1024 {progress(offset)?;last=offset;}
        let words:Vec<_>=line.split('#').next().unwrap_or("").split_whitespace().collect();
        match words.first().copied().unwrap_or("") {
            "v"=>{if words.len()<4{return Err("Incomplete OBJ vertex.".into());}vertices.push(point(&words[1..4])?)?;counts.nodes+=1;},
            "f"|"l"=>{
                let mut points=Vec::with_capacity(words.len());
                for word in &words[1..] {let n=word.split('/').next().unwrap().parse::<i64>().map_err(|_|"Invalid OBJ face index.")?;let at=if n<0 {vertices.count as i64+n}else{n-1};if at<0{return Err("Invalid OBJ face index.".into());}points.push(vertices.get(at as u64)?);}
                if words[0]=="f" {if points.len()<3{return Err("Incomplete OBJ face.".into());}for i in 1..points.len()-1 {emit(Primitive::triangle(points[0],points[i],points[i+1]))?;}}
                else {for pair in points.windows(2){emit(Primitive::line(pair[0],pair[1]))?;}}
                counts.elements+=1;
            }, _=>{}
        } Ok(())
    })?;progress(fs::metadata(path).map_err(err)?.len())?;Ok(counts)
}
fn scan_ply(path:&Path,scratch:&Path,progress:&mut impl FnMut(u64)->Result<()>,emit:&mut impl FnMut(Primitive)->Result<()>) -> Result<Counts> {
    let mut vertices=Indexed::new(&scratch.join("vertices.tmp"))?;
    let(mut header,mut element,mut nv,mut nf,mut line_index)=(true,String::new(),0u64,0u64,0u64);
    let(mut props,mut xyz,mut last)=(Vec::new(),[0usize,1,2],0);
    each_line(path,|line,offset|{
        if offset-last>1024*1024{progress(offset)?;last=offset;}
        let w:Vec<_>=line.split_whitespace().collect();if w.is_empty(){return Ok(());}
        if header {
            match w[0] {
                "format" if w.get(1)!=Some(&"ascii")=>return Err("Only ASCII PLY preview is supported.".into()),
                "element"=>{element=w.get(1).unwrap_or(&"").to_string();let n=w.get(2).ok_or("Incomplete PLY header.")?.parse::<u64>().map_err(err)?;match element.as_str(){"vertex"=>nv=n,"face"=>nf=n,_ if n>0=>return Err("PLY contains an unsupported element block.".into()),_=>{}}},
                "property" if element=="vertex"=>{if w.get(1)==Some(&"list"){return Err("PLY list vertex properties are unsupported.".into());}props.push(w.last().unwrap().to_string());},
                "property" if element=="face"=>{if w.get(1)!=Some(&"list") || !["vertex_indices","vertex_index"].contains(w.last().unwrap()){return Err("PLY faces must contain only a vertex_indices list.".into());}},
                "end_header"=>{for(a,name)in ["x","y","z"].iter().enumerate(){xyz[a]=props.iter().position(|p|p==name).ok_or("PLY is missing XYZ properties.")?;}header=false;}, _=>{}
            }
        }else if line_index<nv {
            if w.len()!=props.len(){return Err("Incomplete PLY vertex record.".into());}
            vertices.push([number(w[xyz[0]])?,number(w[xyz[1]])?,number(w[xyz[2]])?])?;line_index+=1;
        }else if line_index<nv+nf {
            let n=w[0].parse::<usize>().map_err(err)?;if n<3||w.len()!=n+1{return Err("Incomplete PLY face.".into());}
            let first=vertices.get(w[1].parse().map_err(err)?)?;let mut previous=vertices.get(w[2].parse().map_err(err)?)?;
            for word in &w[3..] {let next=vertices.get(word.parse().map_err(err)?)?;emit(Primitive::triangle(first,previous,next))?;previous=next;}line_index+=1;
        } Ok(())
    })?;
    if header||line_index!=nv+nf{return Err("PLY ended before all records were read.".into());}Ok(Counts{nodes:nv,elements:nf})
}

const TRI:&[&[usize]]=&[&[0,1,2]];
const QUAD:&[&[usize]]=&[&[0,1,2,3]];
const TET:&[&[usize]]=&[&[0,2,1],&[0,1,3],&[1,2,3],&[2,0,3]];
const WEDGE:&[&[usize]]=&[&[0,2,1],&[3,4,5],&[0,1,4,3],&[1,2,5,4],&[2,0,3,5]];
const HEX:&[&[usize]]=&[&[0,3,2,1],&[4,5,6,7],&[0,1,5,4],&[1,2,6,5],&[2,3,7,6],&[3,0,4,7]];
fn inp_shape(t:&str)->Result<(usize,bool,&'static [&'static [usize]])> {
    // Matches the viewer's supported linear-element subset; reject higher orders.
    if ["B21","B21H","B21OS","B21OSH","B31","B31H","B31OS","B31OSH","T2D2","T2D2H","T2D2T","T3D2","T3D2H","T3D2T","R2D2","R3D2","CONN2D2","CONN3D2"].contains(&t){return Ok((2,false,&[]));}
    if ["S3","S3R","STRI3","R3D3","M3D3","CPS3","CPE3","CAX3","CPS3H","CPE3H","CAX3H","CPS3T","CPE3T","CAX3T"].contains(&t){return Ok((3,false,TRI));}
    if ["S4","S4R","S4R5","S4T","S4RT","R3D4","M3D4","M3D4R"].contains(&t) || ["CPS4","CPE4","CAX4"].iter().any(|p|t.strip_prefix(p).is_some_and(|s|["","R","H","RH","P","RP","T","RT"].contains(&s))){return Ok((4,false,QUAD));}
    if ["C3D4","C3D4H","C3D4T"].contains(&t){return Ok((4,true,TET));}
    if ["C3D6","C3D6H","C3D6T"].contains(&t){return Ok((6,true,WEDGE));}
    if ["C3D8","C3D8R","C3D8H","C3D8RH","C3D8I","C3D8IH","C3D8T","C3D8RT"].contains(&t){return Ok((8,true,HEX));}
    Err(format!("Unsupported INP element type: {t}. Export flat linear elements."))
}
// Partition solid faces by canonical IDs; matching interior faces cancel even across element blocks.
const FACE_BUCKETS:usize=128;
fn scan_inp(path:&Path,scratch:&Path,progress:&mut impl FnMut(u64)->Result<()>,emit:&mut impl FnMut(Primitive)->Result<()>) -> Result<Counts> {
    let mut node_count=0u64;let mut element_rows=0u64;let mut mode=String::new();let mut last=0;
    each_line(path,|line,at|{if at-last>1024*1024{progress(at)?;last=at;}if line.starts_with("**")||line.is_empty(){return Ok(());}if line.starts_with('*'){mode=line[1..].split(',').next().unwrap().trim().to_uppercase();}else if mode=="NODE"{node_count+=1;}else if mode=="ELEMENT"{element_rows+=1;}Ok(())})?;
    let mut nodes=Nodes::new(&scratch.join("nodes.tmp"),node_count)?;
    let mut ids=Nodes::new(&scratch.join("element-ids.tmp"),element_rows)?;
    let mut buckets:Vec<BufWriter<File>>=(0..FACE_BUCKETS).map(|i|File::create(scratch.join(format!("faces-{i}.tmp"))).map(BufWriter::new).map_err(err)).collect::<Result<_>>()?;
    let mut shape=(0,false,TRI);let mut pending=Vec::new();let mut counts=Counts::default();last=0;
    // Populate nodes before elements, including valid forward node references.
    mode.clear();each_line(path,|line,at|{
        if at-last>1024*1024{progress(at)?;last=at;}if line.starts_with("**")||line.is_empty(){return Ok(());}
        if line.starts_with('*'){mode=line[1..].split(',').next().unwrap().trim().to_uppercase();}
        else if mode=="NODE"{let w:Vec<_>=line.trim_end_matches(',').split(',').map(str::trim).collect();if w.len()<3||w.len()>4{return Err("Incomplete INP node.".into());}nodes.insert(id(w[0])?,point(&w[1..])?)?;counts.nodes+=1;}Ok(())
    })?;
    mode.clear();last=0;each_line(path,|line,at|{
        if at-last>1024*1024{progress(at)?;last=at;}if line.starts_with("**")||line.is_empty(){return Ok(());}
        if line.starts_with('*'){
            if !pending.is_empty(){return Err("Incomplete INP connectivity.".into());}
            let parts:Vec<_>=line[1..].split(',').map(str::trim).collect();mode=parts[0].to_uppercase();
            if ["PART","ASSEMBLY","INSTANCE","INCLUDE","SYSTEM","NGEN","NFILL","NCOPY","ELGEN","ELCOPY","PARAMETER","IMPORT"].contains(&mode.as_str()){return Err(format!("*{mode} is unsupported; export a flat explicit mesh."));}
            let opts:HashMap<_,_>=parts[1..].iter().filter_map(|p|p.split_once('=')).map(|(k,v)|(k.trim().to_uppercase(),v.trim().to_uppercase())).collect();
            if (mode=="NODE"||mode=="ELEMENT") && opts.contains_key("INPUT"){return Err("External INP node/element blocks are unsupported.".into());}
            if mode=="NODE" && opts.get("SYSTEM").is_some_and(|s|s!="R"){return Err("Only Cartesian INP nodes are supported.".into());}
            if mode=="ELEMENT"{shape=inp_shape(opts.get("TYPE").map(String::as_str).unwrap_or(""))?;}return Ok(());
        }
        if mode!="ELEMENT"{return Ok(());}
        for word in line.trim_end_matches(',').split(','){pending.push(id(word.trim())?);}
        if pending.len()>shape.0+1{return Err("Too many INP element nodes.".into());}
        if pending.len()!=shape.0+1{return Ok(());}
        ids.insert(pending[0],[0.;3])?;counts.elements+=1;
        let values:Vec<_>=pending[1..].iter().map(|n|nodes.get(*n)).collect::<Result<_>>()?;
        if shape.0==2{emit(Primitive::line(values[0],values[1]))?;}
        else {for face in shape.2 {
            if shape.1 {
                let mut key=[0u64;4];for(i,v)in face.iter().enumerate(){key[i]=pending[v+1];}key[..face.len()].sort_unstable();
                let hash=key.iter().fold(0u64,|h,n|h.rotate_left(13)^n.wrapping_mul(0x9e3779b97f4a7c15));
                let output=&mut buckets[hash as usize%FACE_BUCKETS];output.write_all(&[face.len() as u8]).map_err(err)?;
                for n in key{output.write_all(&n.to_le_bytes()).map_err(err)?;}
                for i in 0..4{for x in if i<face.len(){values[face[i]]}else{[0.;3]}{output.write_all(&x.to_le_bytes()).map_err(err)?;}}
            }else{for i in 1..face.len()-1{emit(Primitive::triangle(values[face[0]],values[face[i]],values[face[i+1]]))?;}}
        }}pending.clear();Ok(())
    })?;
    if !pending.is_empty(){return Err("Incomplete final INP element.".into());}
    for b in &mut buckets{b.flush().map_err(err)?;}drop(buckets);drop(nodes);drop(ids);
    for i in 0..FACE_BUCKETS {
        progress(fs::metadata(path).map_err(err)?.len())?;
        let mut faces:HashMap<[u64;4],(u8,[[f32;3];4],u64)>=HashMap::new();
        let mut f=BufReader::new(File::open(scratch.join(format!("faces-{i}.tmp"))).map_err(err)?);let mut b=[0u8;81];
        while f.read(&mut b[..1]).map_err(err)?!=0 {
            f.read_exact(&mut b[1..]).map_err(err)?;
            let key=std::array::from_fn(|a|u64::from_le_bytes(b[1+a*8..9+a*8].try_into().unwrap()));
            if let Some(face)=faces.get_mut(&key){face.2+=1;}
            else {
                if faces.len()>=750_000{return Err("INP surface bucket exceeds the preview memory budget; split this mesh into smaller files.".into());}
                let p=std::array::from_fn(|v|std::array::from_fn(|a|{let at=33+v*12+a*4;f32::from_le_bytes(b[at..at+4].try_into().unwrap())}));faces.insert(key,(b[0],p,1));
            }
            if faces.len()%32768==0{progress(fs::metadata(path).map_err(err)?.len())?;}
        }
        for (_, (n,p,count)) in faces {if count==1{for j in 1..n as usize-1{emit(Primitive::triangle(p[0],p[j],p[j+1]))?;}}}
    }
    Ok(counts)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(ext:&str,text:&str,expected:usize){let root=std::env::temp_dir().join(format!("artgui-stream-{}-{ext}",std::process::id()));fs::create_dir_all(&root).unwrap();let p=root.join(format!("mesh.{ext}"));fs::write(&p,text).unwrap();let mut seen=Vec::new();scan(&p,&root,|_|Ok(()),|p|{seen.push(p);Ok(())}).unwrap();assert_eq!(seen.len(),expected);assert!(seen.iter().flat_map(|p|p.points.iter().flatten()).all(|x|x.is_finite()));fs::remove_dir_all(root).unwrap();}
    #[test]fn obj_negative_indices_and_lines(){fixture("obj","v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1\nl 1 2\n",3);}
    #[test]fn ply_property_order(){fixture("ply","ply\nformat ascii 1.0\nelement vertex 3\nproperty float z\nproperty float x\nproperty float y\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n0 1 0\n0 0 1\n3 0 1 2\n",1);}
    #[test]fn inp_shared_faces_are_removed(){fixture("inp","*NODE\n1,0,0,0\n2,1,0,0\n3,0,1,0\n4,0,0,1\n5,0,0,-1\n*ELEMENT,TYPE=C3D4\n1,1,2,3,4\n2,1,3,2,5\n",6);}
    #[test]fn ascii_stl(){fixture("stl","solid a\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid\n",1);}
}
