use std::{fs::File, io::Read, path::Path};
use serde_json::Value;

// Reports are local JSON files produced alongside the user-selected preview.
// Bound the read and validate the report contract before returning it to the UI.
pub fn parse_report(bytes: &[u8]) -> Result<Value, String> {
    if bytes.len() > 1024 * 1024 { return Err("Morph report exceeds 1 MiB.".into()); }
    let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    if value.get("status").and_then(Value::as_str) != Some("success") ||
        value.get("method").and_then(Value::as_str) != Some("WendlandC2_RBF_trilinear_inverse") {
        return Err("This file is not a successful Artisan field-morph report.".into());
    }
    for key in ["displacement_gradient_bound", "jacobian_determinant_lower_bound", "inverse_residual_max", "fixed_value_error_max", "control_points"] {
        if !value.get(key).and_then(Value::as_f64).is_some_and(f64::is_finite) {
            return Err(format!("Missing or invalid morph metric: {key}"));
        }
    }
    Ok(value)
}

#[tauri::command]
pub fn read_morph_report(path: String) -> Result<Value, String> {
    let path = Path::new(&path);
    if !path.is_absolute() || !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("json")) {
        return Err("Choose an absolute .json morph report path.".into());
    }
    let mut bytes = Vec::new();
    File::open(path).map_err(|e| e.to_string())?.take(1024 * 1024 + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    parse_report(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_only_complete_successful_reports() {
        let valid = br#"{"status":"success","method":"WendlandC2_RBF_trilinear_inverse","displacement_gradient_bound":0.8,"jacobian_determinant_lower_bound":0.008,"inverse_residual_max":0.000001,"fixed_value_error_max":0.0,"control_points":256}"#;
        assert!(parse_report(valid).is_ok());
        assert!(parse_report(b"{}").is_err());
        assert!(parse_report(b"not json").is_err());
        assert!(parse_report(&vec![b' '; 1024 * 1024 + 1]).is_err());
    }
}
