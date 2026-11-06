# ArtGUI Tauri Workbench

Independent desktop GUI prototype. The frontend is local HTML/CSS/JavaScript hosted in a Tauri window. Its WebGL geometry viewer uses a locally bundled Three.js build; no network connection or VTK install is needed at runtime.

## Features in this build

ArtGUI 0.1.3 includes a [scalar-field region editor](docs/scalar-region-editor.md)
with Box, Cylinder, Sphere and Mesh inputs, linked viewport handles and a
field-only preview action. Primitive inputs require the updated Artisan backend.

- Project, geometry, ordered operations, timeline, and parameter panels based on the selected ArtGUI layout.
- Operation keywords and example presets are generated from the source manuals and workflows. The properties panel offers an Example preset selector; choosing one replaces the operation parameters. Check file paths and preceding steps before generating.
- Reads, edits, and writes Artisan's `Setup`, numbered `WorkFlow`, and `PostProcess` JSON sections. Numeric types are preserved: `5.0` and `0.0` remain floats, while `5` and `0` remain integers. This includes presets, imported workflows, nested arrays, form edits, JSON edits, cloning, and reordering. Integer fields reject fractional values; change a field’s type explicitly through the JSON editor when needed.
- Native workflow and geometry file dialogs; a custom JSON editor; operation search; reordering; backend selection; and Artisan generation.
- Runs the packaged `ArtisanMain.exe -f <workflow.json>` locally. Package resources are copied into the Tauri application's resource directory.
- Mesh files up to and including **800 MB** automatically request **Full detail**; larger files start in **Preview**. This applies to source, result and reference meshes. Manual detail/preview switching remains available, and automatic full-detail failures fall back to Preview. Existing memory checks remain active.
- WebGL 3D Preview follows orbit, pan, and zoom using a reusable disk-backed spatial hierarchy for STL, OBJ, ASCII PLY, and supported flat linear INP meshes. Size-aware surface samples cover the whole object, with coarse regions retained until finer blocks are ready; nearby blocks use original triangles. Full Detail checks live RAM and conservative viewer/graphics budgets before replacing the preview. See [large model viewing](docs/LARGE_MODELS.md).

## Mesh and conformal strut fields

In a mesh or conformal **Define_Lattice** step, open **Advanced definition → Strut field mode**. **Band (default)** retains the current local calculation. **Full field** completes distant values for later offsets. The optional `field_mode` is stored inside the lattice definition; existing definitions keep it omitted unless the selection changes. English and Chinese labels retain the same `band` / `full` runtime values. See [Strut field mode](docs/lattice-field-mode.md).

This setting requires the updated Artisan backend. Rebuilding ArtGUI does not rebuild an older packaged engine; use the updated Python backend when needed.

## Regional cell sizes and mesh cleanup

- In **Add step**, search for **Scalar field from regions** (`Define_ScalarField_CombineGeometry`) under **Fields**. Set the field name and **Combination method**: Minimum, Maximum, Linear, Smoothstep or InverseDistance. Linear and InverseDistance need at least two separate regions; Smoothstep needs exactly two. Interpolation fills the surrounding 3D domain from regional distances, preserves regional values, ignores the background, and requires transition widths of zero. InverseDistance exposes **Distance power** (default 1). Existing nonzero widths are retained until you explicitly clear them; Undo restores the previous values. Overlapping or touching regions produce a backend error during field computation. Minimum and Maximum retain their existing background and outward-transition behaviour. Use **Add region** / **Remove region** to edit region geometry, value and transition width. The field uses the project resolution; no separate grid spacing is needed. The interpolation methods require an updated Artisan backend.
- Add **Tet mesh from size field** (`Gen_TetMesh_SizeField`) under **Volume meshing**. Reference the field name, a closed solid surface and a tet output ID such as `TetDomains`. The field must cover the whole solid in one partition. The initial seed size is separate from the final edge-size targets. Leave **Final surface tolerance** empty to use twice the boundary tolerance.
- Use `TetDomains` in a conformal lattice definition with the tet-compatible `Icosahedral` unit. Strut radius is set in the consuming **Add lattice** step.
- In **Project settings → Output & cleanup**, enable **Clean exported mesh** (`CleanExportedMesh`) for exact vertex welding and degenerate-triangle cleanup. It does not fill holes or repair non-manifold edges. It defaults to off in new projects and when omitted from older workflows; an explicit saved value is preserved.
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

## Guided geometry operations

Add geometry, Subtract geometry and Intersect geometry share a numbered property
panel: Choose operation, Define shape and Set transition. Sections expand
independently; the shape section starts open. Primitive / Mesh tabs show the
relevant controls. Numeric edits and the existing Move / Resize / Rotate handles
update the same Artisan parameters, including box half-length and radian conversions.
Mesh transforms remain editable before a source preview is loaded. Switching
operations keeps the geometry and destination field. Source-field references,
example presets and additional workflow parameters remain editable.

Sharp is k_factor=0; Smooth accepts positive values, including values above 1.
Preview result uses the selected backend, asks for a mesh output, and computes
only through the selected lattice-field operation; downstream steps and earlier
exports are excluded from the preview run. The saved workflow is preserved.
For geometry-field operations, Generate model evaluates downstream consumers.
Viewport guides represent operation inputs; they do not claim to be computed
Boolean results. Undo and Revert edits are available in the panel.

## Interactive Project Settings

Project Settings uses four independently expandable sections: Domain, Sampling,
Compute, and Output & cleanup. Box domain edits retain Setup.Sample.Domain's
minimum/maximum format. The existing precision controls move the box and resize
one face while keeping the opposite face fixed; numeric inputs update during a
drag. Escape cancels and Undo restores previous settings. The viewport toolbar
offers Move domain, Resize bounds and Fit view. Sampling grid lines are capped
for display, with an outer padding envelope; the guide is not the exact engine
sampling grid. Grid spacing changes res, independently from lattice cell size.

Mesh mode shows source-preview bounds read-only after loading the mesh. Manual
Box domain bounds remain available when switching back. Preview bounds precede
Setup rotation; Artisan applies setup rotation during generation. Rotation values
remain in radians, padding in integer grid layers and memorylimit in bytes; the
memory editor displays GiB. Linked axes update all spacing values; unequal spacing
loads unlinked. Compute, relative-path choices (including a custom folder), all
existing post-process flags and additional workflow keys remain supported.


## Compact lattice transition panels

Lin_Interpolate, HS_Interpolate and Add_Attractor share Transition, Lattice and
Placement tabs. The linear boundary table edits both plane points and normals;
the sharp transition uses one plane; the attractor uses a center and radius.
The small diagram and main workspace show input guides, not a computed lattice.
Select a plane in the table or diagram, then move, rotate or pick its point in
the main workspace. Axis presets retain normal magnitude. The radius slider and
viewport radius handle edit the same r value. Drag snap, guide visibility, Undo
and Revert edits remain available. Escape cancels an active viewport drag.

Fit guide frames only the active operation's visible guides. It changes the
camera, not the stored geometry. Preview result evaluates through the current
workflow step and loads the exported mesh; it keeps later steps and original
export paths in the saved workflow. Changing settings marks that preview stale.

Lattice choices reuse the integrated and project-definition picker. Cell size
is distinct from Setup sampling spacing. Rotation is in radians, translation
and point coordinates use model units. Fill is Clip to domain; Inv is Invert
result and is not exposed for HS_Interpolate. Cube_Request remains an editable
advanced JSON object; a configured nonempty request requires ID. Additional
workflow keys and numeric token types are retained.


### Add lattice property panel

Add_Lattice uses the same compact panel style as the transition keywords. Lattice and Placement tabs separate cell dimensions and thickness from rotation (radians) and translation (model units). Link axes updates all three positive cell dimensions together; turning it off preserves independent dimensions. Strut definitions show radius and derived diameter; TPMS definitions show a thickness control without promising a measured uniform wall. Unknown definitions keep a neutral thickness label.

Preview result runs prerequisites through this Add_Lattice step and displays Artisan's actual mesh in the main 3D workspace. The property panel contains settings only, with no secondary display area. A status message indicates when Setup, prerequisites, definitions, or operation settings need a preview update. Later steps and original exports are preserved. Preview uses the project's actual domain and sampling, so large projects may take time.

Fill is labelled Clip to domain; Inv is labelled Invert result. Required keys, extra properties, example presets, custom/project definitions, and configured Cube_Request payloads remain available. Fit guide adjusts the camera to this operation's cell frame; it does not change parameters.


### Field-controlled quad surface meshing

Add **Surface meshing → Quad surface from size field** (`Gen_QuadMesh_SizeField`).
Select an earlier triangle mesh (or a surface file), an earlier scalar field, and an output mesh ID or file. Field values specify target quad edge lengths in model units; actual sizes also depend on geometry. The field must be positive and cover the surface; Artisan checks coverage during generation.

The default output is all quads. **Split quads into triangles** produces two surface triangles per quad without moving vertices. Matching later `ExportMeshID` steps update their element type automatically. INP preserves quad connectivity for preview; STL is available when splitting is enabled.

Choose **SimpleQuad** or **Subdivision** in the **Meshing method** selector. SimpleQuad is the default and uses QuadriFlow followed by field-controlled conforming quad refinement and shape optimization. Subdivision uses the retained MMGS triangle-adaptation and quad-subdivision algorithm. Both support optional triangle splitting. The JSON setting is `"method": "SimpleQuad"` or `"method": "Subdivision"`; older JSON without it defaults to SimpleQuad. Netgen tetrahedral meshing remains available separately.

Switching methods keeps shared settings and mesh/field IDs. Help text explains the selected method's adaptation passes and gradation. Reports display the generating method, including older saved reports; a method change marks a saved result as needing regeneration. The coarse SimpleQuad shoe example and the new `Shoes_02_Subdivision_Surface.json` both keep the generated quad mesh in memory and export a MeshLattice STL.

The new shoe presets prioritize a quick coarse approximation: uniform triangle size 10, a varying quad-size field of 8–16, `hausd: 10`, `surface_tolerance: 1000`, and sharp-feature preservation disabled. Actual geometry deviation is still reported, and element/topology/intersection checks remain active. These settings are confined to these presets; the keyword defaults are unchanged.

Feature preservation is visible in the main inspector. Geometry tolerances, gradation, adaptation passes, vertex limit, and the optional JSON quality-report path are in collapsible groups. Empty final surface tolerance means twice `hausd`. The vertex limit is not a memory limit.

**Load saved report** reads actual exported counts, edge-to-target ratio, surface distance and element quality. Saved or edited settings are explicitly marked as needing verification; only an unchanged successful run is labelled as the last run. Poor quality triggers a review message. The report folder must already exist.

Viewport switches reuse the current source/result mesh viewer and the real HDF5 field slice viewer. The size-field view requires an imported or exported HDF5 file; its colour scale describes stored values. It does not colour the mesh surface by an estimated field. Mesh preview supports INP, STL, OBJ and PLY; use an INP export to see quad edges.

Run with an Artisan backend containing `Gen_QuadMesh_SizeField` and its native extension. An older packaged Artisan engine does not gain this keyword from a GUI update alone. Source examples are in `Src/Test_json/ConformalLattice/QuadSizeField/`.
# Geometry and Plate cell editors

Create **Geometry unit cell** or **Surface / plate unit cell** under Custom unit
cells, or open a designer from an existing definition. Both import complete STL
and OBJ meshes up to 32 MB, with limits of 100,000 unique vertices, 100,000 faces,
and 200,000 displayed triangles. Other formats retain the original definition
fields. Hex and Tet reference domains are available.

Geometry supports solid/edge display, section inspection, boundary and winding
checks, uniform or independent scaling, rotation, translation and fitting inside
the reference cell. Fit cell changes the camera; Fit inside cell changes the
prepared mesh coordinates. Closed, consistently outward-oriented boundaries and
positive enclosed volume are required. Boundary checks do not test geometric
self-intersections; verify the generated result in Artisan.

Plate supports planar XY/XZ/YZ patches or custom ordered coplanar polygons,
face selection, vertex and whole-face dragging within the plate plane, numeric
vertex editing, face position, normal reversal, deletion and Undo/Redo. Open
boundaries are allowed. Multi-face junctions and inconsistent winding are reported
for review. The lower face table and selected-face handles remain synchronized.

Apply writes a new triangulated OBJ asset when the mesh changes. Standard
comments retain editable polygon groups for reopening in ArtGUI; Artisan receives
triangle faces. Polygon comments are checked against the actual triangle edges
before being trusted during import. Apply then updates the reusable
definition's file and ladomain. With a saved workflow, assets go under its sibling
`<workflow>_assets/cells/` folder; an unsaved workflow prompts for a new OBJ path.
Existing files are never overwritten. Cancel discards unapplied edits without
writing mesh assets. Unchanged existing sources keep their original file references.
Size, shape offset, plate thickness and placement remain in the consuming workflow
operation. The Artisan engine itself is unchanged.

# Custom TPMS cell editor

Create a cell with **Project → Custom unit cells → Add → TPMS unit cell**,
or select an existing ordinary Hex TPMS definition and choose **Open TPMS cell
designer**. Imported ordinary Hex TPMS definitions open in the same designer.

The local preview does not need an Artisan backend. **Volume** is the default:
a GPU shader casts viewing rays through a scalar 3D texture and composites
colours and opacity from the sampled equation values. The initial appearance
uses opacity 6 and the near-zero region at the
minimum band width (2% of the maximum absolute sampled value).
It also supports the entire
field, positive or negative values, and a band around zero. Adjust opacity,
smooth/nearest-sample interpolation, and an X/Y/Z cut plane with either retained
side. The colour scale stays centred on zero. The zero-band width and opacity
are visualization settings, not physical wall thickness or material density.
Volume probing reports the first qualifying stored sample along the viewing
ray, not a single scalar value for the composited pixel.

**Surface cells** displays
sampled grid cells whose corner values bracket zero. **Field samples** colours
the grid points by equation value. **Slice** displays an adjustable XY, XZ or YZ
section. Click the view to inspect cell corner ranges or sampled field values;
drag to orbit and scroll to zoom. Neighbour views repeat the reference cell.
This implementation does not extract a triangle isosurface or use Marching Cubes.

The expression is sampled in a background worker using a restricted mathematical
language: x/y/z, pi, numerical constants, arithmetic and power (**), comparisons,
common trigonometric/exponential functions and where. Equation periods must be
positive constant expressions. The supported-function list is available in the
designer. This is a local preview subset, not the full NumExpr language; definitions
outside that subset can still be edited using the existing main-window fields.

Preview sampling ranges from 16 to 64 cells per axis. Neighbour views are capped
at 32 cells per axis. Obsolete jobs are cancelled and previous grids are labelled
until a current result is available. Nonfinite values and unsupported numerical
ranges produce errors without discarding the draft. The grid representation is
an approximation; it does not certify periodicity or a mathematically minimal
surface, and voxel width is not physical wall thickness.

**Apply and return** updates the reusable workflow definition; the normal project
**Save** writes it to disk. Cancel offers to discard unapplied changes. Renaming
updates references while retaining each consumer's size, thickness and placement.
Unknown definition fields and their numeric formatting are preserved. Sampling,
slice, volume appearance and camera settings do not become engine definition parameters. Final wall
thickness, target filling and workflow geometry remain Artisan calculations.

# Custom strut cell editor

Create a cell with **Project → Custom unit cells → Add → Strut unit cell**.
Hex and Tet strut cells open in a dedicated designer. Choose **Reference domain**
inside the designer. Hex uses the unit cube, with coordinates between 0 and 1.
Tet uses the standard reference tetrahedron with vertices (0,0,0), (1,0,0),
(0,1,0), (0,0,1): X, Y and Z are non-negative and X + Y + Z must not exceed 1.
The corner and centre actions follow the selected domain; the Tet centre is
(0.25,0.25,0.25). Mouse dragging respects the Tet boundary and held coordinates.
Boundary projection can take precedence over the snap increment.

Changing domain retains nodes and connectivity. Nodes outside the selected
domain are marked red in the table and viewport; move or delete them before
Apply becomes available. Undo restores the preceding domain and topology.
Tet neighbour arrangements depend on the actual conformal mesh, so the
designer previews one reference tetrahedron and disables periodic neighbours.

Existing cells have an
**Open strut cell designer** action in their properties; imported Hex and Tet strut
definitions can be edited there too.

Add reference corners or individual normalized coordinates, then connect
nodes by clicking pairs, dragging between them, or selecting endpoints in
the connection controls. Drag nodes on a chosen plane or axis with optional
snapping. The table and 3D selection stay synchronized. Use **Neighbours**
to inspect repeated cells; the display is a topology preview.

**Apply and return** updates the workflow definition. **Cancel** leaves its
applied definition intact and offers to discard draft edits. Use the normal
project **Save** to write the workflow. Renaming an applied definition updates
its consumers; their cell size, thickness and placement remain independent.
The designer preserves unfamiliar definition fields and existing numeric
formatting. Imported coincident nodes are retained and reported. Unsupported
reference domains remain available through the original definition fields.



### Guided lattice definition inspector

Define_Lattice uses four numbered, expandable sections: Identity, Cell definition, Advanced definition, and Usage. The shared inspector supports mesh/conformal definitions, struts, TPMS/field-driven TPMS, geometry and plate cells, retaining their existing designers and serialized definitions. TPMS periods use compact optionally linked inputs. Apply changes commits the panel draft to the workflow; Revert restores the applied definition. Local drafts survive selection and viewer refreshes and are validated and flushed by project Save/JSON/generation. The fixed action area is separate from the scrolling controls. Usage lists actual consuming steps and warns about consumers placed before their definition. Export and removal are in the More menu; existing reference-aware removal and rename propagation remain in place.


### Compact size-field meshers

Gen_TetMesh_SizeField and Gen_QuadMesh_SizeField share the Compact Controls inspector: input/output selectors, target-size field actions, meshing controls, one advanced disclosure, result/quality actions, and a persistent Generate mesh / Revert footer. Tet retains its initial seed size; Quad offers SimpleQuad/Subdivision and Quad/split-triangle output controls. Existing optional settings, defaults and numeric tokens are preserved. Example presets remain inside Advanced.

Edits remain local until Generate mesh, workflow JSON, or Save applies them. Revert restores the applied settings; drafts survive visiting a field editor or viewer. Generate mesh runs prerequisites through the selected mesher, preserves explicit HDF5 field exports and writes a preview mesh/report without running later lattice operations. Report status distinguishes saved or stale results from a matching successful run. Tet reports use volume/mean-ratio/boundary-error data; Quad reports retain their existing quality metrics.

View field is available beside Edit field for both meshers. It resolves the selected earlier field, handles ReadGridField aliases using the stored FieldID, and opens real HDF5 data in the existing slice/probe viewer with Return to meshing. A missing export or a missing dataset produces a recoverable message; it does not silently display a different field. The displayed saved-field range comes from loaded HDF5 metadata, not from a preset or an estimate.
