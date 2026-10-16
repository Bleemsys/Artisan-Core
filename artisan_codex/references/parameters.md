# Public parameter reference

Checked against Artisan 0.2.18.dev. This reference contains accepted inputs, without implementation details. Check feature availability in the installed build.

Search for the exact command heading and read only that table. “Required” means the key must be supplied. A listed default can be omitted. “Optional” without a default needs the command guide; do not invent a default. Nested members and constraints are in `references/parameter-catalog.json`.

## Setup.Geometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `Rot` | 3 × number | Required |
| `res` | 3 × number > 0 | Required |
| `Padding` | integer ≥ 0 | Required |
| `onGPU` | boolean | Required |
| `memorylimit` | number > 0 | Required |
| `JsonWorkDir` | boolean or string | Optional |
| `Type` | `Geometry` | Required |
| `Geomfile` | string | Required |
| `Sample` | object | Optional |


## Setup.Sample

| Parameter | Accepted value | Presence |
|---|---|---|
| `Rot` | 3 × number | Required |
| `res` | 3 × number > 0 | Required |
| `Padding` | integer ≥ 0 | Required |
| `onGPU` | boolean | Required |
| `memorylimit` | number > 0 | Required |
| `JsonWorkDir` | boolean or string | Optional |
| `Type` | `Sample` | Required |
| `Sample` | object | Required |
| `Geomfile` | string | Optional |


## PostProcess

| Parameter | Accepted value | Presence |
|---|---|---|
| `CombineMeshes` | boolean | Required |
| `CleanExportedMesh` | boolean | Default: `false` |
| `RemovePartitionMeshFile` | boolean | Required |
| `RemoveIsolatedParts` | boolean | Required |
| `ExportLazPts` | boolean | Required |


## GeomBuild

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |


## GeomFill

| Parameter | Accepted value | Presence |
|---|---|---|
| `Fill` | boolean | Required |


## ReadMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `MeshID` | nonempty string | Required |
| `meshfile` | string | Required |
| `elem_type` | `Line` / `Triangle` / `Quad` / `Tet` / `Hex` | Required |


## ReadGridField

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_GridFieldFile` | string | Required |
| `Gridfield_ID` | nonempty string | Required |
| `FieldID` | nonempty string | Optional |
| `BlockID` | integer ≥ 0 | Optional |


## RemoveMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `MeshID` | nonempty string | Required |


## ExportMeshID

| Parameter | Accepted value | Presence |
|---|---|---|
| `MeshID` | nonempty string | Required |
| `out_meshfile` | string | Required |
| `elem_type` | `Line` / `Triangle` / `Quad` / `Tet` / `Hex` | Required |


## Field_Boundary

| Parameter | Accepted value | Presence |
|---|---|---|
| `Boundary` | `Box` | Required |


## Define_Lattice

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `definition` | object | Required |


## Add_Lattice

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `Inv` | boolean | Required |


## Subtract_Lattice

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `Inv` | boolean | Required |


## Add_Geometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `Name` | nonempty string | Required |
| `k_factor` | number | Required |
| `Paras` | object | Required |
| `push2GeomField` | boolean | Required |


## Subtract_Geometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `Name` | nonempty string | Required |
| `k_factor` | number | Required |
| `Paras` | object | Required |
| `push2GeomField` | boolean | Required |


## Intersect_Geometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `Name` | nonempty string | Required |
| `k_factor` | number | Required |
| `Paras` | object | Required |
| `push2GeomField` | boolean | Required |


## Add_Attractor

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `pt` | 3 × number | Required |
| `r` | number | Required |
| `Inv` | boolean | Optional |


## Lin_Interpolate

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `pt_01` | 3 × number | Required |
| `n_vec_01` | 3 × number; At least one component must be nonzero. | Required |
| `pt_02` | 3 × number | Required |
| `n_vec_02` | 3 × number; At least one component must be nonzero. | Required |
| `Inv` | boolean | Optional |


## HS_Interpolate

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `pt` | 3 × number | Required |
| `n_vec` | 3 × number; At least one component must be nonzero. | Required |


## Add_Shell

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `thk` | number ≥ 0 | Required |


## Inv_Field

| Parameter | Accepted value | Presence |
|---|---|---|
| `Scale` | number | Required |


## Boundary_Inflation

| Parameter | Accepted value | Presence |
|---|---|---|
| `offset` | number | Required |
| `scale_range` | 2 × number | Required |


## Add_Surf_Plate

| Parameter | Accepted value | Presence |
|---|---|---|
| `Surffile` | string | Required |
| `thk` | number ≥ 0 | Required |
| `GeomTrim` | boolean | Required |


## Substract_Surf_Plate

| Parameter | Accepted value | Presence |
|---|---|---|
| `Surffile` | string | Required |
| `thk` | number ≥ 0 | Required |
| `GeomTrim` | boolean | Required |


## Gen_TetBasicMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `size` | 3 × number > 0 | Required |
| `Meshfile` | string | Required |
| `ConvertTet2Beam` | boolean | Required |


## Gen_TetBasicMesh_wFeature

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `elem_size` | number > 0 | Required |
| `init_seed_size` | 3 × number > 0 | Required |
| `Meshfile` | string | Required |
| `convergence_tol` | number ≥ 0 | Required |
| `max_iter` | integer ≥ 1 | Required |
| `MultiSize` | object | Optional |


## Gen_TetBasicMesh_HexSplit

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `size` | 3 × number > 0 | Required |
| `Meshfile` | string | Required |
| `ConvertTet2Beam` | boolean | Required |
| `MultiSize` | object; members in parameter-catalog.json; {} disables this option. Attractor Data rows contain five numbers; Field_Attractor Data rows contain two numbers. | Required |


## Gen_VoronoiPolyMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `size` | 3 × number > 0 | Required |
| `Meshfile` | string | Required |
| `remove_tol` | number ≥ 0 | Required |


## Gen_VoronoiPolyMesh_HexSplit

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `size` | 3 × number > 0 | Required |
| `Meshfile` | string | Required |
| `remove_tol` | number ≥ 0 | Required |


## Gen_PolyCubeHexMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `cell_size` | number > 0 or 3 × number > 0 | Required |
| `method` | `CartesianFit` | Default: `"CartesianFit"` |
| `bounds` | `Auto` | Default: `"Auto"` |
| `max_iteration` | integer ≥ 1 | Default: `100` |
| `min_scaled_jacobian` | number > 0 < 1 | Default: `0.1` |
| `smoothness` | number > 0 | Default: `0.05` |
| `surface_tolerance` | number > 0 or null | Default: `null` |
| `max_cells` | integer ≥ 1 | Default: `250000` |
| `quality_report` | string | Default: `""` |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Default: `-1` |
| `quality_iterations` | integer ≥ 0 | Default: `40` |
| `preserve_features` | boolean | Default: `true` |
| `feature_angle` | number > 0 < 180 | Default: `45.0` |
| `size_weight` | number ≥ 0 | Default: `0.1` |


## Gen_BasicCartesianHexMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `x_range` | 2 × number | Required |
| `y_range` | 2 × number | Required |
| `z_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `z_angle` | number | Required |
| `Meshfile` | string | Required |
| `Geomfile` | string | Required |
| `numPrjLayers` | integer ≥ 0 | Required |
| `LayerDepth` | number ≥ 0 | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `isProjection` | boolean | Optional |


## Gen_BasicCartesianHexMesh_MultiSize

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `x_range` | 2 × number | Required |
| `y_range` | 2 × number | Required |
| `z_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `z_angle` | number | Required |
| `Meshfile` | string | Required |
| `Geomfile` | string | Required |
| `numPrjLayers` | integer ≥ 0 | Required |
| `LayerDepth` | number ≥ 0 | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `MultiSize` | object; members in parameter-catalog.json; {} disables this option. Attractor Data rows contain five numbers; Field_Attractor Data rows contain two numbers. | Required |


## Gen_ExtHexMesh_Geomfield

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `AttractionRatio` | number | Required |
| `isPreAttraction` | boolean | Required |


## Gen_BasicQuadMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `x_range` | 2 × number | Required |
| `y_range` | 2 × number | Required |
| `z_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `z_angle` | number | Required |
| `Meshfile` | string | Required |
| `Geomfile` | string | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `isProjection` | boolean | Required |
| `isSplitTris` | boolean | Required |


## Gen_SimpleQuadMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `size` | 3 × number > 0 | Required |


## Gen_SurfaceReMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `mesh_file` | string or null | Optional |
| `export_mesh` | string | Optional |
| `hmax` | number ≥ 0 or null | Optional |
| `hmin` | number ≥ 0 or null | Optional |
| `hsiz` | number ≥ 0 or null | Optional |
| `hausd` | number > 0 | Optional |
| `hgrad` | number; Greater than 1, or -1. | Optional |
| `angle` | number ≥ 0 ≤ 180 | Optional |
| `detect_sharp_edges` | boolean | Optional |
| `verbose` | integer ≥ -1 ≤ 10 | Optional |
| `size` | number > 0 or 3 × number > 0 or 1 × number > 0 or null | Optional |
| `ShortEdgeThreshold` | number ≥ 0 | Optional |
| `optimize_only` | boolean | Optional |

- When hmin and hmax are both positive, hmin must not exceed hmax.

## Gen_TetMesh_SizeField

| Parameter | Accepted value | Presence |
|---|---|---|
| `mesh_file` | string | Required |
| `export_mesh` | string | Required |
| `size_field` | nonempty string | Required |
| `sampling_size` | number > 0 | Required |
| `hausd` | number > 0 | Default: `0.01` |
| `surface_tolerance` | number > 0 or null | Default: `null` |
| `hgrad` | number > 1 | Default: `1.3` |
| `feature_angle` | number ≥ 0 ≤ 180 | Default: `45.0` |
| `preserve_features` | boolean | Default: `true` |
| `size_iterations` | integer ≥ 2 ≤ 20 | Default: `3` |
| `max_points` | integer ≥ 8 ≤ 2147483647 | Default: `250000` |
| `quality_report` | string | Default: `""` |


## Gen_TetMesh_Adaptive

| Parameter | Accepted value | Presence |
|---|---|---|
| `mesh_file` | string or null | Optional |
| `export_mesh` | string | Optional |
| `hmax` | number ≥ 0 | Optional |
| `hmin` | number ≥ 0 | Optional |
| `hsiz` | number ≥ 0 | Optional |
| `hausd` | number > 0 | Optional |
| `hgrad` | number; Greater than 1, or -1. | Optional |
| `angle` | number ≥ 0 ≤ 180 | Optional |
| `detect_sharp_edges` | boolean | Optional |
| `sampling_size` | number > 0 or 3 × number > 0 | Required |
| `padding` | number > 0 or null | Optional |
| `weld_tolerance` | number ≥ 0 or null | Optional |
| `allow_swaps` | boolean | Optional |
| `max_points` | integer ≥ 8 ≤ 2147483647 | Optional |
| `adaptive` | boolean | Optional |
| `surface_size` | number > 0 or null | Optional |
| `feature_size` | number > 0 or null | Optional |
| `adapt_band` | number > 0 or null | Optional |
| `adapt_iterations` | integer ≥ 1 ≤ 20 | Optional |

- When hmin and hmax are both positive, hmin must not exceed hmax.

## Gen_CylindricalMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `r_range` | 2 × number | Required |
| `phi_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Height` | number > 0 | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `Mesh_file` | string | Required |


## Gen_CappedConeMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `r_range` | 2 × number | Required |
| `phi_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Height` | number > 0 | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `Mesh_file` | string | Required |
| `r_bottom` | number ≥ 0 | Required |
| `UB_heightRatio` | number ≥ 0 ≤ 1 | Required |
| `Preserve_thickness` | boolean | Required |


## Gen_SphericalMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `r_range` | 2 × number | Required |
| `phi_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `Mesh_file` | string | Required |
| `theta_range` | 2 × number | Required |


## Gen_BoxMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `num_elem` | 3 × integer ≥ 1 | Required |
| `x_range` | 2 × number | Required |
| `y_range` | 2 × number | Required |
| `z_range` | 2 × number | Required |
| `ori` | 3 × number | Required |
| `Normal` | 3 × number; At least one component must be nonzero. | Required |
| `z_angle` | number | Required |
| `Mesh_file` | string | Required |


## Gen_HexMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `Meshfile` | string | Required |
| `layerDepth` | list of number ≥ 0 | Required |
| `layerAttractionRatio` | list of number | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `Size` | 3 × number > 0 | Required |
| `Padding` | integer ≥ 0 | Required |
| `MultiSize` | object; members in parameter-catalog.json; {} disables this option. Attractor Data rows contain five numbers; Field_Attractor Data rows contain two numbers. Only Attractor is accepted by this command. | Required |

- layerDepth and layerAttractionRatio must have equal lengths.

## Gen_ConformalLatticeMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `definition_file` | string | Required |
| `size` | 3 × number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `out_meshfile` | string | Required |


## Gen_StackedLayerMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `inp_geommeshfile` | string | Required |
| `out_meshfile` | string | Required |
| `num_layers` | integer ≥ 1 | Required |
| `layer_thk` | number > 0 | Required |
| `projection_direction` | integer | Required |
| `projection_diff_calc_step` | 3 × number ≥ 0 | Required |


## Gen_ParametricLineMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `x_expr` | nonempty string | Required |
| `y_expr` | nonempty string | Required |
| `z_expr` | nonempty string | Required |
| `t_min` | number | Required |
| `t_max` | number | Required |
| `step_size` | number > 0 | Required |
| `closedcurve` | boolean | Required |
| `out_meshfile` | string | Required |

- t_min < t_max

## Gen_SDFVectorFieldLineMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `x_expr` | nonempty string | Required |
| `y_expr` | nonempty string | Required |
| `z_expr` | nonempty string | Required |
| `start_points` | N × 3 numbers | Required |
| `attraction_strength` | number | Required |
| `projection_width` | number > 0 | Required |
| `influence_width` | number > 0 | Required |
| `n_points` | integer ≥ 2 | Required |
| `step_size` | number > 0 | Required |
| `out_meshfile` | string | Required |


## Gen_Z_ContourLines

| Parameter | Accepted value | Presence |
|---|---|---|
| `res` | 3 × number > 0 | Required |
| `PlaneHeights` | list of number | Required |
| `out_meshfile` | string | Required |


## Gen_FrameField

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `num_layers` | integer ≥ 1 | Required |
| `out_fieldfile` | string | Required |
| `out_fieldfile_02` | string | Optional |


## Gen_MaterialPoints_SurfaceLayers

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `depth` | 2 × number | Required |
| `res` | 3 × number > 0 | Required |
| `sampling` | `Grid` / `Poisson` | Required |
| `out_matpoints_file` | string | Required |


## Gen_MSTMesh_Basic

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_matpoints_file` | string | Required |
| `out_meshfile` | string | Required |


## Gen_Mesh_Streamlines

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_fieldfile` | string | Required |
| `out_meshfile` | string | Required |
| `source` | 3 × number | Required |
| `sink` | 3 × number | Required |
| `step` | number > 0 | Required |
| `num_integration_steps` | integer ≥ 1 | Required |
| `num_streamlines_seeds` | integer ≥ 1 | Required |
| `source_plane_dir` | 3 × number; At least one component must be nonzero. | Required |
| `source_plane_radius` | number ≥ 0 | Required |
| `min_streamlines_spacing` | number ≥ 0 | Required |


## Gen_Field_Laplace

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `res` | 3 × number > 0 | Required |
| `sources` | 3 × number or N × 3 numbers | Required |
| `source_strengths` | list of number | Required |
| `sinks` | 3 × number or N × 3 numbers | Required |
| `sink_strengths` | list of number | Required |
| `influence_factors` | object | Required |
| `solver_factors` | object | Required |
| `out_fieldfile` | string | Required |
| `is_create_on_lattice_field` | boolean | Required |

- source_strengths/sink_strengths must contain one shared value or one value per corresponding source/sink point.

## Proc_Mesh_ExtractSurf

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `Elem_Type` | `Tet` / `Hex` | Required |
| `isSplitTris` | boolean | Required |


## Proc_Mesh_SurfMeshMap

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `Geomfile` | string | Required |
| `tol` | number ≥ 0 | Required |
| `isCvt2beam` | boolean | Required |


## Proc_Mesh_Smoothing

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `feature_size` | number ≥ 0 | Required |


## Proc_Mesh_Octree

| Parameter | Accepted value | Presence |
|---|---|---|
| `Type` | `Geom` / `Field` | Required |
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `Fieldfile` | string | Required |
| `numCoverNodes` | integer ≥ -1 ≤ 8 | Required |
| `num_refinements` | integer ≥ 0 | Required |
| `refine_stepsize` | number | Required |


## Proc_Mesh_Trim

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `Geomfile` | string | Required |
| `elem_type` | string | Required |
| `tol` | number ≥ 0 | Required |
| `num_beam_refinement` | integer ≥ 0 | Required |
| `remove_short_beams` | boolean | Required |


## Proc_Mesh_GenSkin

| Parameter | Accepted value | Presence |
|---|---|---|
| `Geomfile` | string | Required |
| `lattice_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `tol` | number ≥ 0 | Required |
| `faces_angles` | 2 × number | Required |
| `long_edge_tol` | number ≥ 0 | Required |


## Proc_Mesh_FieldDrivenMesh

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `MultiSize` | object; members in parameter-catalog.json; {} disables this option. Attractor Data rows contain five numbers; Field_Attractor Data rows contain two numbers. | Required |


## Proc_Mesh_PolyCube

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_meshfile` | string | Required |
| `cube` | number ≥ 0 | Required |
| `smoothness` | number ≥ 0 | Required |
| `distortion_angle` | number ≥ 0 | Required |
| `distortion_volume` | number ≥ 0 | Required |
| `max_iteration` | integer ≥ 1 | Required |
| `minimum_jacobian` | number > 0 < 1 | Default: `0.001` |
| `continuation_steps` | integer ≥ 1 | Default: `3` |
| `ftol` | number ≥ 0 | Default: `1e-08` |
| `gtol` | number ≥ 0 | Default: `1e-06` |
| `quality_report` | string | Default: `""` |


## Proc_Mesh_MappingHexElem

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_original_meshfile` | string | Required |
| `inp_deformed_meshfile` | string | Required |
| `inp_Hex_meshfile` | string | Required |
| `out_meshfile` | string | Required |


## OP_Fit_GridField

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_ptFieldFile` | string | Required |
| `out_gridFieldFile` | string | Required |


## OP_ExprOperation_GridField

| Parameter | Accepted value | Presence |
|---|---|---|
| `expression` | nonempty string | Required |
| `out_gridFieldFile` | string | Required |


## Define_ScalarField_CombineGeometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `field_id` | nonempty string | Required |
| `default_value` | number | Required |
| `regions` | list of object | Required |
| `overlap` | `Minimum` / `Maximum` | Default: `"Minimum"` |


## OP_GeomSDF_GridField

| Parameter | Accepted value | Presence |
|---|---|---|
| `inp_meshfile` | string | Required |
| `out_gridfieldFile` | string | Required |


## OP_OffsetField

| Parameter | Accepted value | Presence |
|---|---|---|
| `Max_Offset` | number | Required |
| `Min_Offset` | number | Required |
| `FieldFile` | string | Required |
| `Fill` | boolean | Required |

- Min_Offset <= Max_Offset

## OP_Expr_OffsetField

| Parameter | Accepted value | Presence |
|---|---|---|
| `expr` | nonempty string | Required |
| `Fill` | boolean | Required |


## OP_FieldOffset_GeomField

| Parameter | Accepted value | Presence |
|---|---|---|
| `Name` | nonempty string | Required |
| `Paras` | object | Required |
| `min` | number | Required |
| `max` | number | Required |
| `min_val` | number | Required |
| `max_val` | number | Required |
| `min_max_opt` | 2 × number | Required |


## OP_FieldMerge

| Parameter | Accepted value | Presence |
|---|---|---|
| `la_name` | nonempty string | Required |
| `size` | 3 × number > 0 | Required |
| `thk` | number ≥ 0 | Required |
| `Rot` | 3 × number | Required |
| `Trans` | 3 × number | Required |
| `Fill` | boolean | Required |
| `Cube_Request` | object | Required |
| `OP_para` | object | Required |


## OP_EdgeEnhance

| Parameter | Accepted value | Presence |
|---|---|---|
| `max_offset` | number | Required |
| `min_offset` | number | Required |
| `meshfile` | string | Required |
| `Fill` | boolean | Required |
| `Angles` | 2 × number | Required |
| `r` | number | Required |
| `MergeNodes` | boolean | Required |

- min_offset <= max_offset

## OP_CornerEnhance

| Parameter | Accepted value | Presence |
|---|---|---|
| `max_offset` | number | Required |
| `min_offset` | number | Required |
| `meshfile` | string | Required |
| `Fill` | boolean | Required |
| `k` | number | Required |
| `threshold` | number | Required |
| `r` | number | Required |
| `param` | object | Required |

- min_offset <= max_offset

## OP_Compress

| Parameter | Accepted value | Presence |
|---|---|---|
| `compressed_file` | string | Required |


## OP_Decompress

| Parameter | Accepted value | Presence |
|---|---|---|
| `compressed_file` | string | Required |
| `rebuild` | boolean | Required |
| `OP_type` | `Build` / `Union` / `Intersection` / `Diff` | Required |


## Proc_BoxSlices

| Parameter | Accepted value | Presence |
|---|---|---|
| `Boxes` | list of object; at least 1 entries | Required |
| `outfile` | string | Required |
| `Source` | `Geometry` / `Field` | Default: `"Geometry"` |


## Export

| Parameter | Accepted value | Presence |
|---|---|---|
| `outfile` | string | Required |
| `fieldfile` | string | Optional |
| `GridFieldIDs` | list of nonempty string | Default: `[]` |

- fieldfile is only allowed with a mesh outfile.
- Nonempty GridFieldIDs requires an HDF5 destination; IDs must be distinct and cannot be lattice.

## Evaluate_Points

| Parameter | Accepted value | Presence |
|---|---|---|
| `Inp_meshfile` | string | Required |
| `Export_file` | string | Required |


## Check_Geometry

| Parameter | Accepted value | Presence |
|---|---|---|
| `Inp_meshfile` | string | Required |
