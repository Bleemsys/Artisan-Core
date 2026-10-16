# Installed application and optional SDK

## Normal application use

Use the installed executable:

```text
ArtisanMain.exe -v
ArtisanMain.exe -f <workflow.json>
ArtGUI.exe
```

Use the actual known executable path when necessary. No Python interpreter or source repository is required for a standalone application release. Explain the workflow and editable parameters, not application internals.

## SDK integrations, only when requested

If the user has a documented Artisan SDK, use its public API Interface manual and packaged examples. The established entry-point names are `Run(filename)`, `Execution(json_string, logfilename)`, and `ArtisanModel()` with `Setup`/`WorkItem`. Import locations and SDK availability depend on the distributed release; do not infer a source checkout or try to import an executable.

Keep code examples limited to calling the public SDK with user workflow inputs. Do not embed or reconstruct Artisan implementation code. If an SDK is unavailable, deliver JSON for the installed application instead of asking for source.

For the reviewed API, mesh-only `Export` returns a path or no result when no surface is produced. HDF5-only export returns the HDF5 path; combined output returns a list of successfully written mesh/HDF5 paths. SDK field export captures the available grid as one block. Confirm these contracts in the SDK version being used.
