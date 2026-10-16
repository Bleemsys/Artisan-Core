# Meshes, grading, and conformal cells

This guide explains user inputs and their effects. The detailed command input tables are in `references/parameters.md`.

## Choose the intended structure

| Goal | Public workflow |
|---|---|
| Regular cells in a solid | `Add_Lattice` with periodic `size`; use `Fill: true`. |
| Struts following an existing mesh | Define a `MeshLattice` from that mesh, then add it. |
| A unit cell in each tet/hex domain | Define a `ConformalLattice` using a compatible volume mesh and unit cell. |
| Regionally varying tet-domain sizes | Create a scalar size field, use `Gen_TetMesh_SizeField`, then add conformal infill. |
| A surface mesh file | `Export` after constructing the surface. |
| Tet/hex domain mesh file | `ExportMeshID` for that stored volume mesh. |

For a conformal definition, the volume mesh controls the cell domains. Keep `size: [1,1,1]` in the bundled tet workflow; change the domain mesh or size field to change that layout. `thk` still controls strut radius. Conformal `TPMS-Field` is not supported in the reviewed build.

## Make a regional size field

`Define_ScalarField_CombineGeometry` needs `field_id`, `default_value`, and `regions`. Each region needs `geometry` (a closed triangle-surface file or existing triangle-mesh ID) and `value`. Its optional `name` labels it, and `transition_width` gives the outward transition distance in model units; the default is 0. `overlap` defaults to `Minimum` and also accepts `Maximum`.

`Minimum` can reduce the default in regional areas; `Maximum` can increase it. Region order does not choose priority. An empty `regions` list creates a constant field. The field uses the grid from `Setup`; do not add a made-up `grid_spacing` parameter.

This command stores a named scalar field. It does not automatically resize an existing lattice. Connect it explicitly to the later operation, such as `"size_field": "CellSize"`. Generic scalar fields can contain negative or zero values; a tet size field must contain finite, strictly positive edge-length targets everywhere in the solid.

## Size-field tet inputs

| Control | Meaning |
|---|---|
| `mesh_file` | Required closed triangle shell file or mesh-container ID. |
| `export_mesh` | Required tet output file or a new mesh-container ID, such as `TetDomains`. |
| `size_field` | Required existing scalar field ID covering the entire solid. |
| `sampling_size` | Required positive initial size setting; it is distinct from the final field targets. |
| `hausd` | Positive boundary tolerance in model units; default 0.01. |
| `surface_tolerance` | Positive final surface-distance acceptance limit; omission/null uses twice `hausd`. |
| `hgrad` | Size-transition control greater than 1; default 1.3. |
| `preserve_features` / `feature_angle` | Feature preservation and its angle in degrees; defaults true / 45. |
| `size_iterations` | Integer from 2 to 20; default 3. Keep the default initially. |
| `max_points` | Vertex-count limit; default 250000. It is not a peak-memory guarantee. |
| `quality_report` | Optional JSON report filename. Its parent folder must exist, and its path must differ from the input and output meshes. |

The input must be one connected, closed, manifold triangle shell without self-intersections. Separate solids and nested cavity shells are unsupported here. Convert a volume mesh to a surface explicitly when needed. The scalar field must cover the solid on a rectilinear grid with at least two points per axis; a partial saved block is insufficient.

Keep this complete-domain workflow in one computation partition. Use a small preview or a coarser sampling grid if necessary; choose a memory budget that the machine can support. Do not raise `memorylimit` blindly to avoid a partition. Actual tet sizes remain approximate and depend on the boundary and quality constraints; read the report.

## Fitted and saved fields

Use `OP_Fit_GridField` to fit the user's point-field CSV, with `inp_ptFieldFile` and `out_gridFieldFile`. The CSV contains x/y/z and one scalar value per point; use the application's shipped CSV example to match its exact format. `OP_ExprOperation_GridField` takes `expression` and `out_gridFieldFile`; reference existing field IDs in a user-authored expression. A generated name is a field ID, not automatically a filename.

HDF5 fields can be saved with `Export` and loaded in a later workflow with `ReadGridField`. See `references/export-usage.md` for saved-field names, block selection, and grid compatibility.

## Definitions and trimming

The bundled graded example demonstrates the public `Define_Lattice` envelope for a conformal lattice and uses `Icosahedral` with tet domains. For a user's custom cell, use their definition or the documented definition format; do not extract an integrated lattice's geometry or equations.

`Fill: true` uses the setup clipping geometry/domain. When `Fill: false` is chosen to permit explicit trimming, add `Intersect_Geometry` with the intended solid before final surface export. A padded sampling box is not a substitute for that solid.
