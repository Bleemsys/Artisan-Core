# Geometry, supporting files, and INP viewing

Restart the development app to load this update: close its window, stop the existing terminal process with Ctrl+C, then run `npm run dev` from the ArtGUI folder.

## Project panel

- **Project settings** contains the workflow setup.
- **Geometry** contains the workflow source plus any reference meshes you add. Use **+ Add** to attach a reference without changing the workflow source. Click a mesh to load it and inspect its properties. The **Load result** button also adds its file to this list.
- **Supporting files** lets you attach CSV field data, point clouds, custom cell files, or other files. Attaching a file does not automatically connect it to a workflow operation; set that operation's file parameter separately.
- Mesh properties show node/element counts for INP, triangle counts for surface files, and a visibility checkbox after loading. **Preview mesh** reloads a mesh. Supported mesh files attached under Supporting files can also be previewed.
- **Remove from project** removes an attachment and its preview, leaving the disk file intact.
- Save the workflow to preserve the file references. They are references, not embedded copies: keep the files available at their saved locations. On reopening, the source loads automatically; click other geometry files to load them as needed.

“Lattice bracket” was an example project name, not a feature or required project type.

## INP meshes

Open an `.inp` file using **Geometry → + Add**, **Load source**, or **Load result**.

Supported flat Abaqus/meshio-style files contain explicit `*NODE` and `*ELEMENT` records in Cartesian coordinates. The viewer supports common linear beam/truss, triangle, quadrilateral, tetrahedral, wedge, and hexahedral element types. Tested with Artisan exports using **B31H**, **CAX4P**, and **C3D8RH**.

- Beams display as centre lines, without a physical section thickness.
- Shells display as surfaces. Solid meshes display their outer boundary; shared interior faces are removed.
- **Wireframe** and **Solid + edges** show element boundaries rather than the diagonals introduced for rendering quadrilaterals.
- Visibility, colour, opacity, camera controls, measurements, and display section planes work with INP meshes. Measurement snapping also supports beam endpoints.
- Node IDs, original coordinates, element IDs, and connectivity are retained in memory alongside the display geometry. This update does not provide mesh editing, analysis results, or a solver.
- Section planes clip the displayed surface and lines. They do not create filled cross-sections or reveal internal solid-element faces.

This first reader rejects higher-order elements, part/assembly instances, include files, generated node/element definitions, and unsupported coordinate systems with an explicit error. Export those models as a flat supported mesh before loading. Axisymmetric elements are displayed in their supplied coordinates, without revolving them into a 3D body.

Limits: **128 MB per INP file**, **500,000 nodes**, **500,000 elements**, and **2 million processed faces**. INP loads use a cancellable background worker; there is no sampled INP Quick Preview.

## Validation

Parser and browser checks passed with real Artisan beam, shell, and solid examples, including a beam file with 171,001 nodes and 170,658 elements. Checks covered shared-face removal, node IDs/connectivity, invalid input, beam measurements and rotation, multiple geometries, visibility, file attachment persistence/removal, cancellation, and existing viewer controls. Rust compilation passed. Native file-dialog selections were simulated in the browser checks.

The portable parser regression check can be run from the project folder with `node tests/inp-parser.test.mjs`.

Project references are stored in an `ArtGUI` section of the saved workflow JSON. ArtGUI omits this section when sending a workflow to its Artisan backend.
