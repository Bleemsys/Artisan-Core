# Inspect exported grid fields

Use **View field…** in the **3D Workspace**, beside **Load result**, to view HDF5 outputs from the current JSON workflow. The button is always visible. When the workflow contains HDF5 Export steps, a chooser lists their filenames and step numbers, checks whether each file exists, and offers **Open another HDF5 file…**. It includes HDF5-only `outfile` exports and combined mesh/field `fieldfile` exports. Missing outputs are marked unavailable until they are generated. The list is rebuilt from the current workflow each time, so existing exports can be opened without rerunning Artisan. With no HDF5 exports in the workflow, the button opens the HDF5 file picker directly. **Fields → Add** also opens that picker; **Load result** lists mesh `outfile` exports from the current JSON, marks missing files and unsupported preview formats, and offers **Open another result file…**. With no mesh exports it opens the file picker directly. That picker accepts STL, OBJ, PLY, INP and HDF5 fields. Load a source or result mesh to overlay the field in the same model coordinates. Select a field in the project tree. Export properties also offer **View exported field…** to open that step’s output directly.

The inspector shows field ID, grid dimensions, precision, coordinate system, available units, saved finite range and nonfinite counts. Select a partition block when a file contains several blocks. This release displays one block at a time, including exported padding; it does not merge overlaps. The coordinate axes in Slice refer to the stored grid coordinates. A saved affine `grid_to_model` transform places a local-coordinate slice over the model.

- **X / Y / Z** selects a slice direction. Enter a position or move the slider; ArtGUI snaps to the nearest original grid plane.
- **Colour** offers Viridis and blue/white/red palettes, editable bounds, a range lock and the saved field range across blocks. Unlocking the range uses the finite values in each displayed slice. NaN and infinity form gaps.
- **Display** controls field visibility, field opacity, mesh visibility and mesh opacity. The quality options limit each preview edge to 128, 256 or 512 samples.
- **Probe** in the viewport toolbar reads a nearest original grid point. It reports stored precision, grid indices, grid coordinates, model coordinates for local grids, and the original value. **Copy value** copies that value. A probe reads the original dataset even when the displayed slice is sampled.

ArtGUI keeps the entire field in the HDF5 file. Rust reads metadata, one block's compact axis vectors and bounded strips of the requested plane. Values use float64 transport and are normalized before GPU colour rendering. Changing the requested slice cancels older reads between HDF5 calls. A billion-value grid therefore does not require a billion-value browser or GPU allocation. Compressed chunk layout still affects read speed; chunks above 32 MiB are rejected.

Supported snapshots are `Artisan.GridField` version 1 with completed root, field and block markers, float32 or float64 point values, `xyz` axes and `C;z-fastest` ordering. Rectilinear axes must be finite and strictly increasing, with at least two points per axis; nonuniform spacing is supported. One block's axis vectors may total at most two million coordinates. Up to eight files may be open, with at most 256 fields and 4096 blocks per file. Use **Remove field file** to close a file.

Structured/deformed grids are listed with an explanatory message; slice rendering for those grids, combined partition views, isosurfaces and volume rendering are later work. Units are shown as unspecified when absent from the snapshot. A viewer unit label does not rescale field coordinates or infer physical units.

Saving records file path, selected field ID and block ID under `ArtGUI.fields`. Reopening a project lists its field references; select a reference to read it. Palette, slice position, opacity and probe results are session settings. ArtGUI-only references are removed from the JSON sent to Artisan. New/Open and Apply JSON close native field handles and clear displayed fields. After saving successfully, **Generate** also unloads displayed fields and cancels pending reads. The native reader waits for HDF5 handles to close before starting Artisan, so it can overwrite exported files. Fields stay closed throughout the run, including cancellation or failure; saved references remain in the tree. Select a reference or use **View field…** after the run to reopen the exported snapshot. The existing PNG command includes the rendered field plane; the HTML field legend and probe tooltip are not part of that canvas image.

## Windows development and delivery

The verified build uses `hdf5-metno` 0.14.1, exposed as the Rust `hdf5` dependency, with Anaconda's native HDF5 1.14.6. The older `hdf5` 0.8.1 binding did not build against this HDF5 version.

Install frontend dependencies with `npm install`, then run `npm run dev` (or `dev-windows.bat`). `npm run build` prepares HDF5 automatically before building the application/installer. `build-windows.bat` also copies the configured Nuitka Artisan package before invoking the same npm build. On Windows, `scripts/run-tauri.cjs` detects a complete HDF5 installation in the active `CONDA_PREFIX`, then standard Anaconda locations including `C:\ProgramData\Anaconda3`; an explicit `HDF5_DIR` takes precedence. It prepares the DLLs and passes the same environment to the Tauri process. A separate npm prebuild hook cannot set variables for the later build process. For another x64 HDF5 installation, set `HDF5_DIR` to its root containing `Library/include/hdf5.h`, `Library/lib/hdf5.lib` and `Library/bin/hdf5.dll`, or the corresponding `include`, `lib` and `bin` folders. Set `ARTGUI_BUILD_PYTHON` if the build helper should use a different Python executable.

`scripts/prepare_hdf5.py` uses Python's standard library at build time to collect the native DLL dependency chain, copy available Conda package licenses, record SHA-256 hashes and update the Tauri resource mapping. DLLs are installed beside the ArtGUI executable, and copied beside development/test executables. The current Anaconda dependency set contains 20 DLLs, approximately 48 MB, largely because this HDF5 build also depends on curl, OpenSSL and ICU. A different native HDF5 distribution must be prepared again so its own dependency chain is bundled.

Delivered users need neither Python nor Anaconda nor a separate HDF5 installation. Keep the bundled DLLs and license directory with the application. Source changes require rebuilding/restarting ArtGUI. The debug application and native reader were built and checked; installer generation is a separate packaging step.

If a direct Cargo or Tauri invocation bypasses npm, set both variables in the same Command Prompt before building:

```bat
set "HDF5_DIR=C:\ProgramData\Anaconda3"
set "PATH=%HDF5_DIR%\Library\bin;%PATH%"
npm run build
```

Activating Conda alone does not set `HDF5_DIR`. No additional native HDF5 download is needed when its headers, import library and runtime DLL already exist.
