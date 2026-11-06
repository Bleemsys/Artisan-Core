use serde_json::{json, Value};
use std::{fs::File, io::Read, path::Path};
const LIMIT: u64 = 1024 * 1024;

pub fn parse_report(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() as u64 > LIMIT { return Err("Quad report exceeds 1 MiB.".into()); }
    let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if !matches!(value["method"].as_str(),
        Some("Native MMGS scalar-field adaptation + conforming all-quad subdivision") |
        Some("QuadriFlow layout + conforming scalar-field quad adaptation")) {
        return Err("This file is not an Artisan quad surface report.".into());
    }
    match value["valid"].as_bool() {
        Some(false) if value["error"].as_str().is_some() => return Ok(value),
        Some(true) => (),
        _ => return Err("Missing report status.".into()),
    }
    let f = &value["final"];
    for key in ["vertices", "quadrilaterals", "triangles"] {
        if f[key].as_u64().is_none() { return Err(format!("Invalid element count: {key}")); }
    }
    let triangle = value["split_to_triangles"].as_bool() == Some(true) || value["output_element_type"].as_str() == Some("Triangle");
    if (triangle && (f["quadrilaterals"].as_u64()!=Some(0) || f["triangles"].as_u64()==Some(0))) ||
        (!triangle && (f["triangles"].as_u64()!=Some(0) || f["quadrilaterals"].as_u64()==Some(0))) {
        return Err("Report element counts do not match its output type.".into());
    }
    for key in ["edge_to_target_percentiles", if triangle {"mean_ratio_quality_percentiles"} else {"scaled_jacobian_percentiles"}] {
        if !f[key].as_array().is_some_and(|a| a.len()==5 && a.iter().all(|v| v.as_f64().is_some_and(f64::is_finite))) {
            return Err(format!("Missing or invalid metric: {key}"));
        }
    }
    if !f["surface_error"]["maximum"].as_f64().is_some_and(|n| n.is_finite() && n>=0.0) ||
        !value["surface_tolerance"].as_f64().is_some_and(|n| n.is_finite() && n>0.0) {
        return Err("Missing or invalid surface tolerance metrics.".into());
    }
    Ok(value)
}

#[tauri::command]
pub fn read_quad_report(app: tauri::AppHandle, path: String, workflow_path: Option<String>, backend_path: Option<String>, json_work_dir: Value) -> Result<Value,String> {
    let resolved=crate::field_reader::resolve_export_output(app,path,workflow_path,backend_path,json_work_dir)?;
    let path=Path::new(&resolved);
    if !path.extension().is_some_and(|e|e.eq_ignore_ascii_case("json")) { return Err("Choose a JSON quality report.".into()); }
    let file=File::open(path).map_err(|e|e.to_string())?;
    let modified=file.metadata().ok().and_then(|m|m.modified().ok()).and_then(|t|t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d|d.as_millis());
    let mut bytes=Vec::new();file.take(LIMIT+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
    Ok(json!({"path":resolved,"modifiedMs":modified,"report":parse_report(&bytes)?}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unrelated_incomplete_and_oversized_reports(){
        assert!(parse_report(b"{}").is_err());
        assert!(parse_report(b"not json").is_err());
        assert!(parse_report(&vec![b' ';LIMIT as usize+1]).is_err());
    }
    #[test]
    fn checks_both_element_contracts(){
        for method in ["Native MMGS scalar-field adaptation + conforming all-quad subdivision",
                       "QuadriFlow layout + conforming scalar-field quad adaptation"] {
        for triangle in [false,true] {
            let mut f=json!({"vertices":8,"quadrilaterals":if triangle{0}else{6},"triangles":if triangle{12}else{0},"edge_to_target_percentiles":[0.5,0.7,1,1.1,2],"surface_error":{"maximum":0.1}});
            f[if triangle{"mean_ratio_quality_percentiles"}else{"scaled_jacobian_percentiles"}]=json!([0.1,0.2,0.4,0.8,1]);
            let mut report=json!({"method":method,"valid":true,"split_to_triangles":triangle,"surface_tolerance":0.2,"final":f});
            assert!(parse_report(&serde_json::to_vec(&report).unwrap()).is_ok());
            report["final"]["triangles"]=json!(3);
            if !triangle {assert!(parse_report(&serde_json::to_vec(&report).unwrap()).is_err());}
            report["final"]["edge_to_target_percentiles"]=json!([1]);
            assert!(parse_report(&serde_json::to_vec(&report).unwrap()).is_err());
        }
        }
    }
}
