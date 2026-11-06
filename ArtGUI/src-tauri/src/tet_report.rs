use serde_json::{json, Value};
use std::{fs::File, io::Read, path::Path};
const LIMIT:u64=1024*1024;

pub fn parse_report(bytes:&[u8])->Result<Value,String>{
    if bytes.len() as u64>LIMIT{return Err("Tet report exceeds 1 MiB.".into());}
    let value:Value=serde_json::from_slice(bytes).map_err(|error|error.to_string())?;
    if value["method"].as_str()!=Some("Native Netgen geometry seed + MMG3D size-field solid adaptation"){
        return Err("This file is not an Artisan size-field tet report.".into());
    }
    match value["valid"].as_bool(){
        Some(false) if value["error"].as_str().is_some()=>return Ok(value),
        Some(true)=>(),_=>return Err("Missing report status.".into())
    }
    let f=&value["final"];
    for key in ["vertices","tetrahedra"]{
        if !f[key].as_u64().is_some_and(|n|n>0){return Err(format!("Invalid element count: {key}"));}
    }
    for key in ["edge_to_target_percentiles","mean_ratio_quality_percentiles"]{
        if !f[key].as_array().is_some_and(|a|a.len()==5&&a.iter().all(|v|v.as_f64().is_some_and(f64::is_finite))){return Err(format!("Missing or invalid metric: {key}"));}
    }
    if !f["volume"].as_f64().is_some_and(|n|n.is_finite()&&n>0.) ||
       !f["boundary_error"]["maximum"].as_f64().is_some_and(|n|n.is_finite()&&n>=0.) ||
       !value["surface_tolerance"].as_f64().is_some_and(|n|n.is_finite()&&n>0.){
        return Err("Missing or invalid volume/surface metrics.".into());
    }
    Ok(value)
}

#[tauri::command]
pub fn read_tet_report(app:tauri::AppHandle,path:String,workflow_path:Option<String>,backend_path:Option<String>,json_work_dir:Value)->Result<Value,String>{
    let resolved=crate::field_reader::resolve_export_output(app,path,workflow_path,backend_path,json_work_dir)?;
    let path=Path::new(&resolved);
    if !path.extension().is_some_and(|ext|ext.eq_ignore_ascii_case("json")){return Err("Choose a JSON quality report.".into());}
    let file=File::open(path).map_err(|error|error.to_string())?;
    let modified=file.metadata().ok().and_then(|m|m.modified().ok()).and_then(|t|t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d|d.as_millis());
    let mut bytes=Vec::new();file.take(LIMIT+1).read_to_end(&mut bytes).map_err(|error|error.to_string())?;
    Ok(json!({"path":resolved,"modifiedMs":modified,"report":parse_report(&bytes)?}))
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn rejects_unrelated_or_malformed_reports(){
        for data in [b"{}".as_slice(),b"not json".as_slice()]{assert!(parse_report(data).is_err());}
        assert!(parse_report(&vec![b' ';LIMIT as usize+1]).is_err());
    }
    #[test]
    fn accepts_the_public_engine_output_fixture(){
        let report=parse_report(include_bytes!("../../tests/fixtures/tet-size-field-report.json")).unwrap();
        assert_eq!(report["final"]["tetrahedra"].as_u64(),Some(4727));
    }
    #[test]
    fn checks_tet_counts_and_metrics_and_accepts_a_recorded_failure(){
        let mut value=json!({"method":"Native Netgen geometry seed + MMG3D size-field solid adaptation","valid":true,"surface_tolerance":0.06,"final":{"vertices":1017,"tetrahedra":4727,"volume":54.,"boundary_error":{"maximum":0.001},"edge_to_target_percentiles":[0.2,0.5,1.,1.2,2.],"mean_ratio_quality_percentiles":[0.2,0.4,0.8,0.9,1.]}});
        assert!(parse_report(&serde_json::to_vec(&value).unwrap()).is_ok());
        value["final"]["tetrahedra"]=json!(-1);assert!(parse_report(&serde_json::to_vec(&value).unwrap()).is_err());
        value["valid"]=json!(false);value["error"]=json!("Meshing failed");assert!(parse_report(&serde_json::to_vec(&value).unwrap()).is_ok());
    }
}
