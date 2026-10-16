# Find a public operation

Use the goal below to choose a family. For exact required keys, types, choices, and defaults, search that command in `references/parameters.md`; nested inputs are in `references/parameter-catalog.json`. These references cover the reviewed build, not a promise that every released executable supports every command.

| Goal | Starting commands |
|---|---|
| Add or change lattice infill | `Add_Lattice`, `Subtract_Lattice`, `Define_Lattice` |
| Change between lattice designs | `Lin_Interpolate`, `HS_Interpolate`, `Add_Attractor`, `OP_FieldMerge` |
| Combine or trim geometry | `Add_Geometry`, `Subtract_Geometry`, `Intersect_Geometry`, `GeomBuild`, `GeomFill` |
| Import or export stored meshes | `ReadMesh`, `ExportMeshID`, `RemoveMesh` |
| Generate tet domains | `Gen_TetMesh_Adaptive`, `Gen_TetMesh_SizeField`, `Gen_TetBasicMesh` |
| Generate other mesh layouts | `Gen_BoxMesh`, `Gen_CylindricalMesh`, `Gen_SphericalMesh`, `Gen_BasicCartesianHexMesh` |
| Process a mesh | `Proc_Mesh_ExtractSurf`, `Proc_Mesh_Trim`, `Proc_Mesh_Smoothing`, `Gen_SurfaceReMesh` |
| Create, calculate, or read a scalar field | `Define_ScalarField_CombineGeometry`, `OP_Fit_GridField`, `OP_ExprOperation_GridField`, `ReadGridField` |
| Change field thickness/shape | `OP_OffsetField`, `OP_Expr_OffsetField`, `OP_FieldOffset_GeomField` |
| Export or save a design | `Export`, `OP_Compress`, `OP_Decompress` |
| Check inputs or inspect values | `Check_Geometry`, `Evaluate_Points` |

For another public command, search its exact name in the parameter reference rather than inventing one. Use a shipped user example for an extensible `definition`, `Paras`, or other object whose detailed format is not listed.
