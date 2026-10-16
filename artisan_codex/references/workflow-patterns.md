# Build a usable workflow

Start from a complete JSON file in `examples/`, rather than an empty skeleton. All bundled examples use `JsonWorkDir: true`; their paths are relative to their own JSON file. When copying an example, copy the input files it references or update those paths. Keep the outputs inside the user's project folder.

## Common sequence

1. Set the sample box or imported geometry, units, sampling spacing, and resource budget.
2. Load any mesh/field inputs and define any custom lattices needed later.
3. Construct the lattice or mesh, and apply the intended trimming.
4. Export each result using a distinct destination path.
5. Include the required top-level `PostProcess` options.

Use ordered string step keys (`"1"`, `"2"`, …), with one operation per step for clear workflows. The order matters: a mesh or field ID must exist before a later command uses it. Preserve the user's existing step order when editing.

## Standard surface output

```json
{"PostProcess": {
  "CombineMeshes": true,
  "RemovePartitionMeshFile": true,
  "RemoveIsolatedParts": false,
  "ExportLazPts": false
}}
```

These four keys are required in the reviewed workflow interface. `CleanExportedMesh` is optional and defaults to false; add it only when supported and wanted. `RemovePartitionMeshFile: true` requires `CombineMeshes: true`. Keep isolated-part removal false when separate components are intentional.

## Files and IDs

A mesh-container name such as `Solid` or `TetDomains` is an in-memory reference, not a filename. Create it with `ReadMesh` or a mesh-generation command first. Use simple names without file extensions for container IDs. A path such as `./inputs/box.inp` names a file. Respect command-specific filename keys; do not replace `Mesh_file`, `Meshfile`, `mesh_file`, or `out_meshfile` with one another.

Use exact element-type values: `Line`, `Triangle`, `Quad`, `Tet`, or `Hex` where the command accepts `elem_type`. In particular use `Tet`, not `Tetrahedron`. Confirm that the mesh actually contains that element type. Some commands use different keys or choices, such as `Elem_Type: "Tet"`; check their parameter table.

## Checks before delivery or execution

- Parse the complete file as JSON; remove comments, ellipses, and placeholder values.
- Check each command's required keys, value types, and any dependent settings.
- Check paths relative to the selected working folder. Create needed output directories in the user's project.
- Check lattice names, mesh element types, earlier-created IDs, model units, and field coverage.
- Inspect the installed application version for requested features. A newer skill cannot add a missing application feature.
- A successful input check is not a completed run. Report whether a preview ran, which outputs exist, and any relevant error or limitation.

For a small preview, run the executable against the project workflow. Do not install extra packages, change application internals, or require source code to make a user workflow run.
