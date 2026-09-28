# ArtGUI

Desktop workflow editor and 3D viewer for Artisan, built with Tauri, Rust, JavaScript and Three.js. This folder contains GUI source, required images/icons, dependency manifests and lockfiles. Installed libraries and build outputs are deliberately excluded.

## Run from source on Windows

Install Node.js with npm, Rust/Cargo (MSVC toolchain), Microsoft C++ Build Tools with the Windows SDK, and the Microsoft Edge WebView2 runtime. Then, from this folder:

```powershell
npm ci
npm run dev
```

`npm ci` restores the locked JavaScript dependencies and copies the required Three.js files and license into ignored `ui/vendor/`. Cargo restores Rust dependencies during the first build. Network access is needed for dependency downloads; the GUI and viewer run locally afterward. Do not commit `node_modules`, `ui/vendor`, `src-tauri/target`, or engine runtimes.

## Choose the Artisan backend

Click **Backend…** and select either:

- `ArtisanMain.py` in the repository root. Choose the `python.exe` from the Python environment containing Artisan's dependencies, or leave the interpreter blank to use `python` from PATH. See the repository's installation instructions for engine requirements. The script runs from its own directory.
- A separately packaged `ArtisanMain.exe`.

Backend and Python interpreter selections are remembered locally. The Python backend requires a compatible Python environment; GUI build tools do not install the engine's Python dependencies. This GUI source folder does not duplicate the encrypted Artisan engine or its runtime.

## Build an installer

```powershell
npm ci
npm run build
```

Installer output is under `src-tauri/target/release/bundle/`. The default installer contains the GUI and viewer; users select their external engine through Backend. The default WebView2 bootstrapper may download WebView2 if it is missing.

To intentionally package a separately built Artisan executable and its runtime:

```powershell
$env:ARTISAN_PACKAGE_DIR = 'C:\path\to\ArtisanMain.dist'
.\build-windows.bat
```

This optional script copies the engine to ignored local resources and applies `src-tauri/tauri.bundle-engine.conf.json`. Do not commit those generated resources.

## Features

- Source/reference geometry, supporting files, mesh/conformal lattice definitions and custom unit cells (Hex, Tet, Quad and Triangle domains).
- 65 operation types with 371 source example presets; Common, Recent, Favorites and searchable lists; insertion at a chosen workflow position.
- Numeric JSON preservation, including decimal tokens needed by Artisan; GUI metadata is excluded from engine input.
- STL, OBJ, PLY and supported INP previews; geometry bounds and XYZ lengths; Orbit/Pan/Zoom, sections, measurements and visibility controls.
- Compact generation progress with console, log and progress-file updates, cancellation and log access.
- About information with bundled Lucide/Feather icon notices.

See [project files and INP](docs/project-files-and-inp.md), [lattice definitions](docs/LATTICE_DEFINITIONS.md), [run progress](docs/RUN_PROGRESS.md), and [operation picker](OPERATION_PICKER.md).

## Development checks and generated assets

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
python scripts/generate_icons.py
python scripts/generate_operations.py --artisan-root ..
```

The checked-in operation catalog is ready to use; regeneration is optional. The generator accepts both the public `Doc` + `Test_json` layout and the development `Doc` + `Src/Test_json` layout. It uses only Python's standard library and reads manuals/examples without running the engine. Catalog presets retain their numeric types; check example file paths before generating models.

An optional Python-launch test requires `ARTGUI_TEST_PYTHON` to point to an interpreter:

```powershell
$env:ARTGUI_TEST_PYTHON = 'C:\path\to\python.exe'
cargo test --manifest-path src-tauri/Cargo.toml python_subprocess_preserves_paths_and_working_directory -- --ignored
```

The fake-engine subprocess fixture is intentionally ignored during ordinary tests. Full model generation requires the real Artisan engine and suitable input files.

## Third-party notices

Keep `ui/icons/lucide/LICENSE.txt` with the icon assets. Three.js's MIT notice is restored into `ui/vendor/THREE-LICENSE.txt` during setup and included in builds. These licenses do not change the Artisan engine's license; see the repository license information.
