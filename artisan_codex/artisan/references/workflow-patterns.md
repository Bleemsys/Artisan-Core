# Artisan Workflow Patterns

Most Artisan workflows are JSON documents with this shape:

```json
{
  "Setup": {},
  "WorkFlow": {
    "1": {},
    "2": {}
  },
  "PostProcess": {}
}
```

## Setup

`Setup` defines the domain or source geometry/mesh, resolution, rotation, padding, GPU setting, and memory limits. Common setup fields include:

- `Type`
- `Geomfile`
- `Mesh_file`
- `Rot`
- `res`
- `Padding`
- `onGPU`
- `memorylimit`

Use existing examples to preserve exact spelling and expected values.

## WorkFlow

`WorkFlow` is an ordered object. Keys are string numbers: `"1"`, `"2"`, `"3"`. Each step usually has one operation name as its key.

Common operations include:

- `Add_Lattice`
- `Export`
- `Gen_BoxMesh`
- `Add_Geometry`
- `Gen_ConformalLatticeMesh`
- `Proc_Mesh_Trim`
- `HS_Interpolate`
- `Lin_Interpolate`
- `Add_Attractor`
- `OP_FieldMerge`
- `Proc_Mesh_ExtractSurf`
- `Gen_BasicCartesianHexMesh`
- `Gen_SphericalMesh`

## PostProcess

Common fields include:

- `CombineMeshes`
- `RemovePartitionMeshFile`
- `RemoveIsolatedParts`
- `ExportLazPts`

## Creation Rule

When asked to create a workflow, choose the closest example from `references/examples-index.md`, copy its structure conceptually, then change only the fields needed for the user's geometry, lattice, operation, or output path.

## Path Rule

Examples often use paths like `.//Test_json//...` and `.//Test_results//...`. Preserve relative path style unless the user asks to run from another working directory.

## Workflow Structure Template

- Use the template below: 
  {"Setup":{  "Type" : "Sample",
            "Sample": {"Domain" : [[0.0,4.0],[0.0,4.0],[0.0,4.0]], "Shape": "Box"},
            "Geomfile": "",
            "Rot" : [0.0,0.0,0.0],
            "res":[0.05,0.05,0.05],
            "Padding": 1,
            "onGPU": false,
            "memorylimit": 1073741824000,
            "JsonWorkDir": true
            },
  "WorkFlow":{
      "1":{...},
      "2":{...},
      "3":{...}
       },
   "PostProcess":{"CombineMeshes": true,
            "RemovePartitionMeshFile": false,
            "RemoveIsolatedParts": false,
            "ExportLazPts": false}
  }