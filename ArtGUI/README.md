# ArtGUI Tauri Workbench

Independent desktop GUI prototype. The frontend is local HTML/CSS/JavaScript hosted in a Tauri window. Its WebGL geometry viewer uses a locally bundled Three.js build; no network connection or VTK install is needed at runtime.

## Features in this build

- Project, geometry, ordered operations, timeline, and parameter panels based on the selected ArtGUI layout.
- Operation keywords and example presets are generated from the source manuals and workflows. The properties panel offers an Example preset selector; choosing one replaces the operation parameters. Check file paths and preceding steps before generating.
- Reads, edits, and writes Artisan's `Setup`, numbered `WorkFlow`, and `PostProcess` JSON sections. Numeric types are preserved: `5.0` and `0.0` remain floats, while `5` and `0` remain integers. This includes presets, imported workflows, nested arrays, form edits, JSON edits, cloning, and reordering. Integer fields reject fractional values; change a field’s type explicitly through the JSON editor when needed.
- Native workflow and geometry file dialogs; a custom JSON editor; operation search; reordering; backend selection; and Artisan generation.
- Runs the packaged `ArtisanMain.exe -f <workflow.json>` locally. Package resources are copied into the Tauri application's resource directory.
- WebGL 3D Preview follows orbit, pan, and zoom using a reusable disk-backed spatial hierarchy for STL, OBJ, ASCII PLY, and supported flat linear INP meshes. Size-aware surface samples cover the whole object, with coarse regions retained until finer blocks are ready; nearby blocks use original triangles. Full Detail checks live RAM and conservative viewer/graphics budgets before replacing the preview. See [large model viewing](docs/LARGE_MODELS.md).

## Regional cell sizes and mesh cleanup

- In **Add step**, search for **Scalar field from regions** (`Define_ScalarField_CombineGeometry`) under **Fields**. Set the field name, default value and overlap rule. Use **Add region** / **Remove region** to edit region geometry, value and transition width. The field uses the project resolution; no separate grid spacing is needed.
- Add **Tet mesh from size field** (`Gen_TetMesh_SizeField`) under **Volume meshing**. Reference the field name, a closed solid surface and a tet output ID such as `TetDomains`. The field must cover the whole solid in one partition. The initial seed size is separate from the final edge-size targets. Leave **Final surface tolerance** empty to use twice the boundary tolerance.
- Use `TetDomains` in a conformal lattice definition with the tet-compatible `Icosahedral` unit. Strut radius is set in the consuming **Add lattice** step.
- In **Project settings → Post process**, enable **Clean exported mesh** (`CleanExportedMesh`) for exact vertex welding and degenerate-triangle cleanup. It does not fill holes or repair non-manifold edges. It defaults to off in new projects and when omitted from older workflows; an explicit saved value is preserved.
- Existing **Export → HDF5 field only** supports saving the named field through `GridFieldIDs`. **ReadGridField** can reload it. The complete example is `Src/Test_json/ConformalLattice/TetSizeField/TetSizeField_Conformal.json`; its relative paths use the Artisan `Src` working directory.

These controls require the updated Artisan backend and its native Netgen/MMG support. Updating ArtGUI does not rebuild or replace an older packaged Artisan engine. Select the updated Python backend if the packaged engine has not been rebuilt.

## Interface language

Use the top-right **中文 / English** button to switch between English and Simplified
Chinese. The preference is saved locally, with English as the default. Switching
updates the current interface in place without resetting the workflow, unsaved
parameter edits, viewer, or active run. The operation picker searches both English
and Chinese names and descriptions; Artisan command keywords stay unchanged.

Translation catalogs live in `ui/locales/zh-CN.js` and
`ui/locales/operations-zh-CN.js`. English UI strings are fallback keys. `ui/i18n.js`
localizes display text and accessibility labels, retaining English sources for
switching back and observing newly rendered controls. Mark user-defined text with
`translate="no"`; form values, JSON, file paths, technical identifiers and engine
logs are not translated. Options retain their original values. Native system file
dialogs follow the operating system language, and untranslated messages fall back
to English. Extend the catalogs when adding UI copy.

## ArtGUI version

The `version` field in `package.json` is the single source of truth for the
ArtGUI release. It is separate from the Artisan engine and project format versions.

Edit that field and run `npm run sync-version`, or use
`npm version patch --no-git-tag-version` (the npm version hook synchronizes it).
Commit the updated manifests, lockfiles and `ui/version.js`.

Tauri reads `../package.json` directly for the application/installer version.
The synchronizer updates the Rust package, both lockfiles, and the About dialog's
`ARTGUI_VERSION` export. It runs before `npm run dev` and `npm run build`, and in
Tauri development/build hooks. For a browser-only preview or direct Cargo build,
run `npm run sync-version` first. `npm run check-version` checks for stale
generated values without changing files. Do not edit generated values manually.

The application executable is `src-tauri/target/release/ArtGUI.exe`. Both Cargo and Tauri use this binary name; the installer packages `ArtGUI.exe`.

## Build on Windows

These instructions apply to a fresh GitHub checkout. In the full Artisan repository the application is under `Src/ArtGUI`; in an ArtGUI-only checkout it is the repository root. Run the commands from the directory containing `package.json`. All command examples below use **Command Prompt (CMD)**. Replace example paths with your own paths.

### Build prerequisites

Install the following on the build computer:

- [Node.js](https://nodejs.org/) LTS with npm.
- [Rust](https://www.rust-lang.org/tools/install) with the **x86_64-pc-windows-msvc** host/toolchain.
- Microsoft C++ Build Tools with **Desktop development with C++**, including the Windows SDK, and the WebView2 runtime. Follow the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).
- [Python 3](https://www.python.org/downloads/windows/) for `scripts/prepare_hdf5.py`. This helper uses only the standard library; ArtGUI compilation does not require h5py or Artisan's Python packages.
- The standalone **x64 MSVC HDF5 shared-library development package** described below.

Check that the command-line tools are available in a new CMD window:

```bat
node --version
npm --version
rustc --version
cargo --version
python --version
```

Python is currently a build-time requirement even when Artisan will be delivered as a Nuitka executable. Anaconda is optional. Users of the installed, fully packaged application do not need these build tools, Python, Anaconda or a separate HDF5 installation.

### Download and install HDF5

Use the official [HDF5 1.14.6 release](https://github.com/HDFGroup/hdf5/releases/tag/hdf5_1.14.6). Under **Assets**, download one of:

- **`hdf5-1.14.6-win-vs2022_cl.msi`**: run the installer and record the installation directory.
- **`hdf5-1.14.6-win-vs2022_cl.zip`**: extract the precompiled SDK to a directory of your choice.

Choose the Microsoft C/MSVC (`cl`) Windows package. The source-code archives, Intel compiler packages and a runtime DLL by itself are not the SDK used by this guide. HDF5 1.14.6 matches the native version used by the current `hdf5-metno` 0.14.1 integration; validate other native versions before using them.

Locate the SDK directory with this layout; it may be inside another directory after extraction:

```text
<HDF5 SDK root>\
  include\hdf5.h
  include\H5pubconf.h
  lib\hdf5.lib
  bin\hdf5.dll
```

The current ArtGUI build uses the shared-library import library **`hdf5.lib`**. A static-only package containing `libhdf5.lib` does not satisfy this configuration. Headers, import library and runtime DLLs must come from the same x64 installation. Keep all supplied dependency DLLs in `bin`; copying only `hdf5.dll` can leave required dependencies missing. The Rust HDF5 bindings are downloaded by Cargo from `Cargo.toml`, while this native SDK must be installed separately.

### Configure HDF5 in CMD

Enter the application directory and set the SDK root. `C:\Libraries\HDF5\1.14.6` is an example location, not an assumed installer default:

```bat
cd /d "C:\path\to\ArtGUI"
set "HDF5_DIR=C:\Libraries\HDF5\1.14.6"
dir "%HDF5_DIR%\include\hdf5.h"
dir "%HDF5_DIR%\include\H5pubconf.h"
dir "%HDF5_DIR%\lib\hdf5.lib"
dir "%HDF5_DIR%\bin\hdf5.dll"
```

Each `dir` command should find its file. Set `HDF5_DIR` to the directory above `include`, `lib` and `bin`. Paths containing spaces work with the quoted `set "NAME=value"` syntax; the quotes are not part of the value. Continue in the same CMD window. Repeat the `set` commands in a new window, or save the variables in Windows user environment settings and open a new CMD window.

If `python --version` cannot find Python, or you want a specific interpreter, set its full executable path:

```bat
set "ARTGUI_BUILD_PYTHON=C:\path\to\python.exe"
```

With a standalone SDK and no override, the helper uses `python` on PATH. `ARTGUI_BUILD_PYTHON` affects the build helper, not the Artisan backend selected in the GUI.

An existing Anaconda installation is an alternative when it contains the complete development files. With no explicit `HDF5_DIR`, the launcher checks the active Conda environment and standard Anaconda locations. You can select an activated environment explicitly with `set "HDF5_DIR=%CONDA_PREFIX%"`; its files must exist under `Library\include`, `Library\lib` and `Library\bin`. The launcher also accepts that `Library` directory as the SDK root. Installing only the Python h5py package does not guarantee the required headers and import library are present.

### Develop or build the installer

Install frontend dependencies once, then launch development:

```bat
npm install
npm run dev
```

To compile the release application and installer from the same configured CMD window:

```bat
npm run build
```

The installer outputs are under `src-tauri/target/release/bundle/`. Both npm commands run `scripts/run-tauri.cjs`, which prepares HDF5 before starting Tauri, passes `HDF5_DIR` to Cargo and adds the SDK's `bin` directory to PATH for that build process. No separate permanent PATH change is required for these commands. Use these npm entry points for the documented preparation; invoking Cargo or Tauri directly bypasses it.

The helper collects HDF5's DLL dependency chain into `src-tauri/resources/hdf5/`, records hashes in `runtime-manifest.json`, updates `src-tauri/tauri.conf.json` and copies the DLLs beside development executables. The installer places the required DLLs beside the installed ArtGUI executable. These files are prepared on the build computer; GitHub readers should obtain their own SDK using the instructions above.

For distribution, retain the license notices supplied with HDF5 and any bundled dependency DLLs. The helper collects available notices from the Conda package cache, but does not collect notices automatically from a standalone SDK. Copy those notices into `src-tauri/resources/hdf5/licenses/` before the final build; the helper maps that directory into the installed `hdf5-licenses/` directory. For an SDK that has a root `COPYING` file, for example:

```bat
if not exist "src-tauri\resources\hdf5\licenses" mkdir "src-tauri\resources\hdf5\licenses"
copy /Y "%HDF5_DIR%\COPYING" "src-tauri\resources\hdf5\licenses\HDF5-COPYING.txt"
```

Also retain any separate notices supplied for the dependency DLLs you distribute, then run `npm run build` again if the installer was already generated. Keep the packaged DLLs and notices with the installed application.

### Package the Artisan backend

ArtGUI can be compiled and used to view files before a backend is bundled. **Generate** requires `ArtisanMain.exe`; in development use **Backend…** to select it.

To produce a package with the backend included, first build Artisan using its Nuitka workflow. Set `ARTISAN_PACKAGE_DIR` to the complete output directory containing `ArtisanMain.exe` and all adjacent runtime files, then run from the ArtGUI folder with the HDF5 settings above still active:

```bat
set "ARTISAN_PACKAGE_DIR=C:\path\to\ArtisanMain.dist"
build-windows.bat
```

The script copies the complete backend directory and invokes the same npm build. For an offline installer, configure Tauri's WebView2 install mode to `offlineInstaller`; the default bootstrapper downloads WebView2 if it is missing. Three.js and OrbitControls are bundled locally.

### Common HDF5 build problems

| Message or symptom | What to check |
| --- | --- |
| `Unable to locate HDF5 root directory and/or headers`, or `Could not find HDF5 development files` | Install the complete Windows SDK, set `HDF5_DIR`, check all four files above and run `npm run build` in the same CMD window. |
| `HDF5_DIR does not contain complete x64 HDF5 development files` | The path may point at `bin`, an outer ZIP directory, or a runtime-only installation. Select the actual SDK root containing `include`, `lib` and `bin`. |
| `Could not run HDF5 build helper` | Install Python 3 and make `python` available, or set `ARTGUI_BUILD_PYTHON` to its full executable path. |
| `Expected x64 DLL`, a linker architecture error, or HDF5 version mismatch | Use the x64 MSVC Rust toolchain and one matching x64 SDK for headers, libraries and DLLs. When switching SDKs, run `cargo clean --manifest-path src-tauri/Cargo.toml`, then rebuild through npm. |
| `Missing runtime dependency: ...` | Restore the complete SDK `bin` directory and its required dependency DLLs, then build again. |
| The installed application reports a missing HDF5 DLL | Rebuild through npm with a complete SDK and reinstall the resulting package. Keep the bundled DLLs beside the application executable. |

## Operation categories

Operations are grouped by purpose, using the manual chapters and example workflows. The nine groups are Geometry & shells, Lattices & transitions, Volume meshing, Surface meshing, Mesh processing, Lines & paths, Fields, Analysis & FEA, and Import, export & storage.

`scripts/operation_categories.json` maintains explicit keyword assignments, descriptions, and source references. Update this file when adding or moving an operation, then regenerate the catalog. Duplicate assignments are rejected. New keywords without an assignment appear under Uncategorized and are listed in `operations-report.json` for review.

The Add operation picker shows categories in workflow order, with operation counts and a brief explanation of each group. Search matches category names as well as operation keywords, display names and preset sources.

The grouping reflects each operation’s primary purpose: lattice interpolation is under Lattices & transitions; operations that reshape an existing mesh using a field are under Mesh processing; conformal FEA lattice mesh generation is under Analysis & FEA; compression and decompression are under Import, export & storage. Some operations also support workflows described in other chapters.

## Export mesh and HDF5 fields

Select **Export model**, then choose **Mesh only**, **HDF5 field only**, or **Mesh plus HDF5 field**. Mesh-only workflows keep the existing `outfile` syntax. HDF5-only output uses a `.h5` / `.hdf5` `outfile`; combined output adds `fieldfile`. Optional `GridFieldIDs` is a JSON array of named grid fields created before the Export step. The current lattice field is included automatically when present. Invalid output combinations and field-ID drafts must be corrected before saving or generating. Native output dialogs offer the matching mesh/HDF5 filters.

ArtGUI reads completed HDF5 field snapshots through a native Rust reader. Use **Load result**, **Fields → Add**, or **View exported field…** to inspect slices, mesh overlays and original grid values. See [Field viewer guide](docs/field-viewer.md) for supported grids, large-file limits and Windows HDF5 packaging. Rebuild/restart Tauri after this update.

## Regenerate the operation catalog

From `Src/ArtGUI`, run:

```bat
python scripts/generate_operations.py
```

To refresh just Export while preserving the other bundled operations, run `python scripts/generate_operations.py --keywords Export`. The report records the refreshed keywords.

The generator uses Python's standard library and discovers the Artisan root relative to its own location. For a different source checkout, pass `--artisan-root "C:\path\to\Artisan"`.

- `ui/operations.js` contains the catalog, source references, example presets, and numeric type metadata. Each preset includes `paramsJson`, a JSON string that retains decimal notation when loaded by the JavaScript interface.
- `ui/numeric-json.js` preserves numeric tokens through import, edits, and export. Types are stored with their containing objects/arrays, so moving workflow steps does not change them. Catalog metadata is never added to exported Artisan workflows.
- `operations-report.json` records source coverage, extracted keywords, incomplete manual snippets, and parameters whose types differ between examples.

Source RST files take priority over generated `_build` copies, which are excluded. Complete tutorial/manual examples are preferred as the initial preset; executable examples provide alternatives and additional operations. Example presets are starting configurations, not authoritative engine defaults. Different shapes, parameter sets, values, and numeric types are retained separately rather than merged into one synthetic configuration.

Only operations appearing in workflow steps or explicit operation JSON blocks are included. Parameter-only fragments and symbolic illustrations are not presented as new keywords. Complete operation objects can be recovered from incomplete illustrative workflows; those recoveries and trailing-comma corrections are recorded in the report. Source files are never rewritten.

Catalog regeneration is a development step. Distributed users need neither the manual/example folders nor Python to open the bundled catalog.

## Development

Follow [Build on Windows](#build-on-windows) to install the SDK and configure CMD, then run `npm run dev` from the application folder. In a development run, use **Backend…** to select `ArtisanMain.exe` when running workflows.

## Resource monitor

The bottom panel has **Workflow** and **Resources** tabs. Workflow is selected on startup. Resources shows system RAM and CPU, the current Artisan process group (including workers), and ArtGUI plus its WebView/viewer processes. The three sections sit side by side when the panel is wide; narrower panels place the history chart below the summaries or stack all sections. Tab switching preserves the panel's height. A compact system RAM/CPU summary stays beside the progress bar, on its left. Generate, Stop and log controls remain outside the tabs.

A native Rust sampler updates once per second, including when Workflow is selected or the window is minimized. Select Artisan, ArtGUI or System for the last 60 seconds of memory or CPU history. Monitoring is local and uses the `sysinfo` Rust crate, fetched by Cargo; it adds no Python requirement or separately installed runtime library. Process groups follow parent/child identities rather than executable names, exclude Artisan from the GUI group, and retain live workers whose parent exits. Only Artisan runs started by this ArtGUI instance are included.

RAM is resident process memory, summed across the group; shared pages may be counted more than once. System RAM includes other applications and OS use, so the group totals need not equal system usage. Values use MiB/GiB. CPU percentages use total machine capacity (0–100%); initial CPU readings show a dash until a second sample is available. Observed run peak is the highest Artisan group RAM sampled during the latest run, and can miss bursts between samples. It resets for a new run and remains after completion. Short runs may finish between samples. Missing or stale readings are marked unavailable. Monitoring does not change the workflow JSON or Artisan's memory limit.

## 3D Workspace controls

- **Expand** in the 3D Workspace header temporarily hides Project, Properties and Workflow/Resources, giving the viewer the full workspace area. The top bar, viewer tools and bottom Generate/Stop, RAM/CPU and log controls remain available. **Restore layout** returns the panels with their previous selections. Esc also restores the layout when a dialog, editor, viewer menu or measurement tool is not handling the key. Expanding resizes the existing viewer without reloading geometry or HDF5 data; the camera, visible layers, field slice and measurements are retained. Restore the layout to edit field or workflow properties. ArtGUI starts with the normal layout each time.
- **Load source** selects the workflow's geometry. **Load result** opens an output mesh or HDF5 field as a separate viewer layer; select the generated file after an Artisan run. Result loading does not replace the workflow source path. Both meshes retain their original coordinate positions. New/Open project clears both layers.
- **View** offers front, back, left, right, top, bottom and isometric views, using Z as the vertical axis. Click a face, edge or corner of the orientation cube to orient the model. **Fit view** frames visible layers; **Reset** returns to an isometric camera.
- Switch between perspective and orthographic projection, or between solid, wireframe and solid-with-triangle-edges display. Edges are rendered by a shader without building a second CPU edge mesh. Dense edge displays can still be visually crowded.
- **Mouse controls** uses the preferred button mapping. Orbit, Pan and Zoom tools temporarily assign that action to the left button. More > Mouse controls configures left/right buttons, sensitivity and scroll direction. Middle drag zooms; touch uses one finger to orbit and two to pan/zoom.
- **Section** clips the display with an X, Y, Z or custom-normal plane. Move its position slider and optionally reverse the visible side. It is a display cut with no filled cap; it does not modify the mesh or export a cut model.
- Select a geometry, field or point cloud in the Project tree to change its own **Opacity** in Properties. Each object keeps its own opacity, saved with the workflow; opening or editing a field or point cloud preserves all other objects’ opacity and visibility.
- **Visibility** also controls source/result visibility, opacity and colour independently. Make active selects the model affected by the Preview / Full Detail switch. Transparency is for visual comparison and may have sorting artifacts on complex intersecting surfaces.
- **Measure** selects a model and measures distance with two clicks or an angle with three (the second is the vertex). Optional vertex snapping selects triangle vertices near the click. Only a visible full-detail mesh can be measured; adaptive Preview is intentionally excluded. Measurements describe the loaded mesh, with its floating-point precision. Very large full-detail meshes may take longer to pick.
- **More** contains grid, axes, bounding box/dimensions, background, unit labels, mouse preferences, named camera views and PNG export. Mesh coordinates are unitless: choose the appropriate label; changing it does not rescale geometry.
- Named camera views store camera position, target, projection and zoom. Viewer preferences and saved cameras persist locally across sessions, separately from Artisan workflow JSON. Measurement annotations are session-only and are cleared when their model is replaced.
- **Save PNG** uses a native Save dialog. Choose an opaque or transparent background and whether to include measurement annotations. The image uses the current viewport resolution; screenshots do not change the mesh.

The native preview service returns original mesh bounds. The STL worker retains its centring offset so the renderer can align source and result while keeping GPU coordinates near the model origin. Rebuild/restart Tauri after updating this version so the Rust service and frontend use the same coordinate convention.

## Project files and INP meshes

See [Project files and INP guide](docs/project-files-and-inp.md) for supported meshes, file references, limits, and validation.

## Large model viewing (0.1.5)

Preview now follows zoom, pan, and orbit using a reusable spatial cache on disk. **Load full detail** checks memory and viewer limits before replacing the preview. See [large-model viewing](docs/LARGE_MODELS.md) for cache space, supported meshes, safety budgets, and validation details.

**Save as** beside **Save** opens a Save dialog and makes the chosen JSON the current workflow. Subsequent **Save** actions write to that file. Use Ctrl+Shift+S (or Cmd+Shift+S) for Save as. Cancelling the dialog keeps the current file and unsaved changes.

**Clean scratch** beside **Reset** deletes all files and subfolders inside `ViewScratch`, keeping the folder. Active preview work is cancelled and cached preview layers are closed first; reopen a model to rebuild its preview. Full-detail geometry and workflow files are kept. A cleanup failure is reported so you can close another window using the cache and retry.

Preview caches live in `ViewScratch` beside `ArtGUI.exe`. Existing completed caches in the former AppData location move there automatically when their model is opened. Keep ArtGUI in a writable folder.



## Geometry display colours

Select a geometry under Project → Geometry, then use Properties → Display →
Display colour. The colour updates immediately and can be set before loading a
preview. It is retained through preview/full-detail reloads and saved in the
project JSON: `ArtGUI.sourceColor` for the source, and `color` on each
`ArtGUI.geometry` entry for reference/result meshes. Existing projects without
colour metadata use the viewer's existing defaults. Visibility colour controls
edit the same project setting. New projects and other opened projects do not
inherit another project's colour overrides. Supporting files and field colour
maps keep their existing controls.
