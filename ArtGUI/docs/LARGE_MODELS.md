# Viewing large models in ArtGUI 0.1.5

Open source, result, and reference meshes normally. Preview prepares a reusable disk cache, then automatically loads more detail as you zoom in and releases it as you zoom out. Pan and orbit also update the visible regions. This works with both perspective and orthographic cameras.

The distant overview uses a spatial hierarchy with five levels of surface samples. Samples cover occupied regions of the whole model, and their displayed size follows the camera distance and model scale. A coarse region remains visible until its finer replacements have loaded. This uses the same general idea as an octree point-cloud viewer; Potree is not an application dependency.

Nearby detail blocks contain the original triangles or lines. ArtGUI loads all parts of a spatial cell before giving that cell priority over approximate samples, including samples behind its viewing rays. This prevents coarse samples from filling the holes between detailed struts. Preview remains approximate outside those detailed regions: features and holes smaller than the sample spacing can merge. Measurements remain disabled in Preview.

Preview supports binary/ASCII STL, OBJ surfaces and lines, ASCII PLY surfaces, and the same flat linear-element INP families as the full viewer. INP solid meshes have shared interior faces removed; beam elements appear as center lines. Higher-order elements, assembly instances, external node/element blocks, and binary PLY remain unsupported. Very large INP face buckets fail with a readable message rather than growing without bound.

## First opening and cache storage

The first opening scans the source and prepares small spatial blocks on disk. Progress can be cancelled. Subsequent openings reuse the completed cache; changing the source file invalidates it. The original model and workflow are unchanged.

The cache is stored in **`ViewScratch` beside `ArtGUI.exe`**, with one model-ID subfolder per cache. It follows the application folder, independently of the workflow folder or the folder from which ArtGUI was launched. Keep the application in a writable location. If preparation cannot write there, ArtGUI reports the folder and asks you to move the application to a writable location.

When a model is first opened in this version, ArtGUI checks its completed cache in the previous location, `%LOCALAPPDATA%\org.artisan.workbench\mesh-preview-v1`. It moves that matching cache into `ViewScratch`, including existing triangle blocks and overview levels. On the same drive this is a directory move, so gigabytes of data need not be copied or regenerated. Across drives it stages and verifies a copy before removing the known old cache files. Cancellation or a failed copy preserves the old cache. Locked or unrecognized files may remain in the old folder. Close earlier ArtGUI versions before upgrading. Full Detail resource checks may read either cache location without moving files.

Each large-model cache contains `surface-lod-v2.json` and `surface-lod-v2.bin` for the hierarchical overview; an older cache without these builds them once. The cache is display data and can be removed while ArtGUI is closed; it will be regenerated when needed. Preparation checks free disk space and keeps incomplete jobs in separately named temporary directories that are removed on cancellation or failure. `ViewScratch` is excluded from source control and portable release archives.

Triangle blocks use approximately 36 bytes per source triangle. Allow additional space for overview samples, manifests, and temporary files. Large text and INP models may need more temporary space.

For the tested million-cell STL:

- Source: 398,559,056 triangles; 19,927,952,884 bytes (18.56 GiB).
- Spatial cache: 8,216 blocks; 14,348,126,016 bytes of triangle data (13.36 GiB), plus a small overview and manifest.
- Native base-cache preparation benchmark: 148.4 seconds.
- Additional hierarchy: 4,681 nodes, 67,033,940 bytes (63.9 MiB), 114.3 seconds to build from the existing triangle blocks. Peak process working set was 81,199,104 bytes (77.4 MiB). This figure excludes the desktop viewer, WebView, and graphics driver.

## Load full detail

Click **Load full detail** to request all original geometry. ArtGUI checks live available RAM, estimates expanded geometry and temporary parser memory, accounts for existing viewer geometry, and checks conservative WebView and graphics budgets before reading the complete mesh into the viewer.

If the check refuses the request, a warning explains the limiting resource and offers two choices. **Continue in preview** closes the warning and leaves the current preview unchanged. **Load full geometry** attempts the complete load despite the resource estimate; this can exhaust memory or make the viewer unresponsive. Closing the warning also keeps the preview. The override applies only to that request. Loading supports progress and cancellation. A failed graphics upload keeps the preceding layer.

Graphics free-memory telemetry is not reliably available through WebGL. This release therefore uses a conservative 512 MiB total geometry budget and a 1 GiB maximum single vertex-buffer budget, in addition to live RAM checks. These are safety budgets, not measurements of installed VRAM. Each model uses one surface-sample draw batch, up to 32 MiB of sample attributes, small visibility textures, and up to 64 MiB of original detailed blocks, constrained by the shared viewer budget. At most two block reads run concurrently. A graphics-context interruption reduces the preview detail budget before recovery.

Your 398.6-million-triangle STL requires a 13.36 GiB position array alone, so Full Detail is refused by the single-buffer check. Preview is the intended way to inspect this file.

## Validation

Automated tests cover camera-driven selection, parent fallback during loading, complete-cell transitions, memory budgets, cancellation and reader release, context recovery, refusal without viewer mutation, import, and cache integrity. The actual full-size STL was used for native cache and hierarchy benchmarks. Offscreen rendering on Intel UHD Graphics used production shader sources and native samples for the real cube, its detailed struts, a torus, and a frame with a thin separate component. Torus and frame tests covered all reference-surface pixels in the tested views while retaining their large openings. Saved images were visually inspected. Full desktop WebView interaction remains to be checked on the target machine; these offscreen checks do not replace that acceptance step.

The standard build remains `npm run build` using the installed Artisan development environment. No new runtime dependency was added.

## Indexed full-detail STL loading

Full-detail binary and ASCII STL now use a streaming worker with approximately
1 MiB byte-range requests. This also bounds native asset-protocol allocations;
a normal un-ranged asset request would read the whole source into native memory. Coordinates are
shared exactly within independent batches of at most 65,536 triangles. No
geometric tolerance is applied and faces are not simplified. Vertices on batch
boundaries can be duplicated. Each batch stores float32 positions and uint16
or uint32 triangle indices, with its own local origin for rendering precision.
The worker transfers one batch at a time and waits for acknowledgement before
sending another. It does not keep the whole source file or one global weld map.
The main window retains the completed geometry until loading succeeds. Surface
shading uses derivatives; wireframe edge buffers are created only when needed
and released on returning to solid display. Measurements use the clicked batch.

The admission estimate uses 48 bytes per STL triangle as a conservative upper
bound (positions plus indices), with bounded parser overhead. It does not assume
vertex sharing will save space. The single-buffer check uses the batch size,
not the total STL size. The 512 MiB graphics budget remains a warning with the
explicit **Load full geometry** override; it is not measured available VRAM.
Full detail still retains the complete model in CPU/GPU memory. Streaming is a
loading improvement, not an unlimited-memory renderer. INP, OBJ and PLY keep
their existing full-detail readers.

A Node parser benchmark on Shoes_02_SinTet_Conformal.stl (1,313,340,584 bytes)
read all 26,266,810 triangles in 6.6 seconds, producing 401 batches and 394.9 MiB
of position/index data versus 901.8 MiB of non-indexed positions. The largest
position/index buffer was 0.683 MiB. This benchmark discarded completed batches;
its process memory is not a prediction of the desktop viewer's total memory.
Actual desktop graphics upload and interaction need validation on target hardware.

## Runtime protection for full-detail STL

Streamed STL now starts with a current system-memory reading instead of a
whole-file graphics-budget refusal. It checks again at least every second or
16 MiB of prepared geometry. The native resource monitor samples once per second;
readings older than five seconds or missing readings pause the load.

The RAM reserve scales with installed memory: 10 percent, with a 512 MiB minimum
and 2 GiB maximum, plus bounded working space and an allowance for pending buffer
copies. These are initial protection settings, not a guarantee against exhaustion.
Buffers already loaded are reflected in live available RAM; newly prepared data
is also tracked while waiting for the next native sample. No free VRAM is invented.

Each completed batch is uploaded to an offscreen target before the worker is
allowed to read more. A low-memory warning pauses the worker and offers
**Continue in preview** or **Continue loading**. Closing the warning or cancelling
chooses the preview and disposes the staged geometry. Continuing permits at most
another 64 MiB or five seconds before a persistent warning must be reconsidered;
it does not disable protection. Current memory is checked again at completion.

The displayed preview is retained until all batches have succeeded. Allocation
or graphics-upload errors stop the attempt, terminate the worker, and release the
new buffers. A graphics-context loss can still temporarily interrupt the existing
preview. Wireframe buffers introduced by a display-mode change are checked and
uploaded batch by batch before replacement. The old full-load preflight remains
for formats which do not yet use the streamed STL pipeline.
