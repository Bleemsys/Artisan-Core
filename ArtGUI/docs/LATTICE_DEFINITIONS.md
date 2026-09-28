# Lattice definitions in the Project panel

The Project panel has two definition sections. Artisan's integrated lattices remain available in the lattice-name suggestions; they do not need a project definition.

## Mesh / Conformal lattices

Use **Add** to create a Mesh lattice or Conformal lattice, or **Import .mld** to load an existing definition.

- **Mesh lattice:** select a mesh file or enter a mesh variable produced by an earlier workflow step, and set joint smoothing `k` (zero disables smoothing).
- **Conformal lattice:** also choose an integrated lattice, a project custom unit cell, or a `.txt` definition. Match the unit cell's Hex/Tet reference domain to the volume mesh. Surface conformal workflows may use Quad or Triangle cells.

Click **Apply definition**, then **Add lattice step** to insert an `Add_Lattice` operation immediately after the definition. Set size, thickness, rotation, translation and Fill on that operation. Mesh/conformal operations start with Fill disabled. Their size is the computational search scale; start near the mesh element size and consult the manual for the intended mesh.

## Custom unit cells

Use **Add** to choose one of these types, or **Import .txt**:

- **Strut:** normalized node coordinates and pairs of zero-based node indices. Hex coordinates are in the unit cube; Tet coordinates satisfy x, y, z ≥ 0 and x + y + z ≤ 1.
- **TPMS:** X/Y/Z periods and an implicit expression.
- **Field-driven TPMS:** periods and an expression referring to grid fields created earlier with `OP_Fit_GridField`.
- **Geometry:** a closed, watertight unit-cell geometry file.
- **Surface / plate:** a surface mesh defining a plate unit cell.

Select the appropriate reference domain. Apply the definition before changing selections. Save, JSON, Generate, Add lattice step and Export also apply the currently displayed definition, and stop if its entries are invalid.

## Saving, references and execution

Definitions are native `Define_Lattice` workflow steps, stored in the project JSON. Renaming a definition updates matching lattice-name references. A referenced definition cannot be removed until its uses are changed or removed. Generation checks that definitions precede their consumers; meshes, fields and other required inputs must also exist before use.

Existing external `.mld`/`.txt` references appear in the corresponding Project section. Clicking one imports it into the workflow before its first consumer and replaces matching file references with the project definition name. Relative file paths inside definitions are retained; check them against the Artisan execution directory (or JSON directory when `JsonWorkDir` is enabled).

**Export definition** writes a standalone `.mld` or `.txt` while retaining the inline project definition. Extra imported fields are preserved. Expressions, file existence, mesh compatibility and generated lattice quality are ultimately checked by Artisan during execution.

## Source material

Based on the installed Artisan manual's `Customization/Customization.rst`, `Mesh.rst` and `Conformal.rst`, and the examples in `Src/Test_json/CustomLattice`, `Src/Test_json/ConformalLattice`, and `Src/Test_json/LatticeContainer/LatticeContainer_CustomizedStrut.json`.

The GUI was checked with the supplied strut and conformal definition files. Browser checks simulated native dialogs and engine calls; they did not generate a full lattice model.
