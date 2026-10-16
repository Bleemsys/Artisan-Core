# Troubleshoot from user-visible evidence

Use the workflow, application version, existing input files, output checks, and relevant error text. Do not request private source code or full system logs. Read only the error section needed; redact personal paths when sharing an explanation.

| Symptom | Check first | Useful next step |
|---|---|---|
| Missing or invalid parameter | Exact command table; required keys, capitalization, numeric/vector shapes, and booleans. | Correct the affected command and check the complete workflow again. |
| Unknown command or unsupported option | Installed application version and its public manual. | Use a supported shipped example or explain that the installed build lacks the feature. |
| File not found / no output in expected folder | `JsonWorkDir`, JSON location, launch folder, relative paths, and output directories. | Resolve paths from the chosen working folder. Use `JsonWorkDir: true` for the portable starters. |
| Missing mesh/field/lattice ID | Whether an earlier step creates the exact ID. | Create/load it before first use; distinguish a container name from a filename. |
| Requested mesh elements absent | Actual input element type and the command's selector. | Use `Tet`, `Hex`, `Triangle`, `Quad`, or `Line` as appropriate; a filename extension does not select the contents. |
| Empty surface export | Whether a lattice/solid was created and whether trimming, inversion, or placement removed it. | Preview the result before the final trim and check its bounds. A scalar-only field is not automatically a lattice surface. |
| Missing thin struts or rough walls | `thk`, model scale, sampling `res`, and cell `size`. | Try a smaller sample with finer spacing; compare geometry before changing the entire job. |
| Excess memory or long runtime | Domain size, spacing, partition requirements, and supported hardware. | Start smaller/coarser. Do not use an unrealistically large `memorylimit` or assume GPU support. |
| Inverted/misaligned design | `Inv`, separate setup/lattice transforms, and angle units. | Restore zero transforms, then preview one requested change. `Rot` uses radians in the reviewed build. |
| Tet size-field meshing rejects the input | Closed connected surface, strictly positive field, full coverage, and complete-domain partition. | Correct the identified input condition. Do not silently replace the requested mesher with another tool. |
| HDF5 read fails | Completed output, selected `FieldID`, `BlockID`, and matching grid requirements. | Read the completed file in a subsequent workflow; see the export guide. |
| Cleanup removed desired geometry | Isolated-part removal and the user's intended separate components. | Keep `RemoveIsolatedParts: false` when those components are intentional. |

Stop repeated retries when the same input or capability error persists. Explain the specific missing input or unsupported feature. Make a new run only after a relevant change, and report which checks actually passed.
