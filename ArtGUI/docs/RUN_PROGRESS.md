# Generation progress

The progress row sits directly below Workflow and is 38 px high. The run log is collapsed whenever a run starts.

- The row shows the current operation, engine-reported percentage, elapsed time, **Show log**, and **Stop**.
- The active workflow card is highlighted. Subdomain details appear in the log header and the operation tooltip.
- **Show log** opens a resizable log area. **Auto-scroll** follows new messages; turn it off to read earlier output. **Copy** copies the visible log (up to the latest 2,000 lines). **Open log** opens the retained full transcript in Notepad.
- Workflow editing is locked while a run is active; the model can still be rotated and inspected.
- **Stop** terminates the running Artisan process and its child processes. Partial output files are retained.
- Success, failure, and elapsed time remain visible after the run. Failures expand the log automatically. No completion dialog covers the workspace.

The desktop launcher streams stdout and stderr and incrementally reads Artisan's `.log` and `.prg` files. Matching console/log occurrences are shown once. A retained transcript is written under the application's data directory in `runs`. Engine `.log` and `.prg` files retain a unique `artisan_run_<id>` name in the engine's selected working directory. The temporary workflow JSON is removed after the process exits.

When `JsonWorkDir` is true, the temporary workflow is placed beside the saved project, so relative inputs and outputs resolve from the saved project's folder. With false, Artisan uses its backend working directory. Custom directory strings retain their engine meaning.

The percentage reflects Artisan's operation-based reporting, which may update in jumps or pause during a long operation. It is not a time estimate. The display remains below 100% until the engine exits successfully; elapsed time continues while progress is unchanged. The existing engine progress calculation has not been changed.

Validation: Rust compilation and process tests cover console/file merging, partial lines, percentages and cancellation. Browser checks cover the compact layout at 1550×1000 and 1120×720, step highlighting, log expansion, success, failure, cancellation and editing locks. These used a test subprocess and simulated desktop events, not a full Artisan lattice-generation run.

Restart the desktop development process with `npm run dev` after installing this change so the new native commands and event permissions are loaded.
