# Export surfaces, meshes, and fields

## Choose the output

- `Export` saves the current lattice surface and/or sampled scalar fields.
- `ExportMeshID` writes an already stored mesh, including volume elements.
- Conformal FEA beam/shell output is a separate public definition option; consult the FEA Interface chapter when requested.

`Export.outfile` is required. A mesh extension selects a triangle surface; `.h5` or `.hdf5` selects fields only. Surface formats include `.stl`, `.obj`, `.ply`, `.off`, `.vtk`, `.vtu`, `.inp`, `.msh`, `.mesh`, and `.med`. Choosing an `.inp` extension does not make this command generate volume elements.

```json
{"Export": {
  "outfile": "./part.stl",
  "fieldfile": "./part.h5",
  "GridFieldIDs": ["SizeField"]
}}
```

`fieldfile` adds HDF5 alongside a mesh; omit it if `outfile` already ends in `.h5` or `.hdf5`. `GridFieldIDs` defaults to `[]`, requires HDF5 output, and selects existing distinct named scalar fields. `lattice` is reserved for the current lattice field, which is included when present. Fields-only export needs at least one available scalar field and can run before a lattice exists.

Each workflow export captures that step independently. Use distinct output paths for separate steps. Workflow outputs are completed during `PostProcess`; read an HDF5 snapshot in a subsequent workflow or SDK call. HDF5 stores sampled values and their grid coordinates, rather than a surface mesh.

## Read a saved field

```json
{"ReadGridField": {
  "inp_GridFieldFile": "./part.h5",
  "FieldID": "SizeField",
  "Gridfield_ID": "LoadedSize",
  "BlockID": 0
}}
```

`FieldID` selects the saved field (default `lattice`). `Gridfield_ID` names it after loading into Artisan; later expressions use `LoadedSize`. `BlockID` is optional for a one-block file and required for partitioned files. The reader preserves coordinates and shape; it does not join all partitions or resample onto the current lattice grid. CSV input uses `Gridfield_ID` without the HDF5 selectors.

## Surface output options

Use the complete `PostProcess` block from the starter workflow.

| Option | User-visible effect |
|---|---|
| `CombineMeshes` | Produce the requested surface file from computation partitions. False retains separate VTU partition files. |
| `CleanExportedMesh` | Optional; default false. Remove identical duplicate vertices, degenerate triangles, and unused vertices. It does not repair holes or non-manifold edges. |
| `RemovePartitionMeshFile` | Delete intermediate partition files after successful combination; true requires `CombineMeshes: true`. |
| `RemoveIsolatedParts` | Retain only the largest connected component during combination, measured by triangle count. Keep false to preserve intended separate parts. |
| `ExportLazPts` | Required compatibility flag. Keep false; LAZ output is unavailable in this export path. |

Cleanup applies after combination, or to each retained partition when combination is disabled. These options do not change HDF5 fields or `ExportMeshID` results. A cleanup success is not proof of a watertight or printable result.

## Export a stored mesh

```json
{"ExportMeshID": {
  "MeshID": "TetDomains",
  "out_meshfile": "./domains.inp",
  "elem_type": "Tet"
}}
```

Use an existing mesh ID and its matching element type: `Line`, `Triangle`, `Quad`, `Tet`, or `Hex`. `Tetrahedron` is not the accepted mesh-interface value. See the Mesh Container section of Meshing 02 in the public manual.
