Define and reuse lattices
*************************

Integrated lattices such as ``Cubic`` and ``SchwarzDiamond`` are already
available in lattice-name selectors. Create a definition when you need your
own unit cell, a lattice based on a mesh, or a conformal lattice.

ArtGUI groups definitions in two sections of the Project panel:
**Mesh / Conformal lattices** and **Custom unit cells**. Definitions are stored
as ``Define_Lattice`` steps in the workflow JSON.

Create a custom unit cell
=========================

#. Choose **+ Add** beside **Custom unit cells**.
#. Choose a definition type and a unique lattice name. Use a name without a
   path or ``.txt`` / ``.mld`` extension; do not reuse an integrated name.
#. Choose **Create definition**.
#. Fill in the definition's properties and choose **Apply definition**.
#. Choose **Add lattice step** to insert an ``Add_Lattice`` operation directly
   after the definition.
#. Edit the consuming operation's size, thickness, rotation, translation and
   Fill settings. Save the project.

.. list-table:: Custom unit-cell types
   :widths: 25 75
   :header-rows: 1

   * - Type
     - Inputs and checks
   * - Strut
     - Normalized node coordinates and pairs of zero-based node indices.
       Each connection refers to two entries in the node list.
   * - TPMS
     - X, Y and Z periods and an implicit expression.
   * - Field-driven TPMS
     - Periods and an expression using grid fields. Create those fields
       earlier in the workflow with ``OP_Fit_GridField``.
   * - Geometry
     - A closed, watertight geometry file defining the unit cell.
   * - Surface / plate
     - A surface mesh defining a plate unit cell.

Choose the reference domain to match how the cell will be used. **Hex** uses
the unit cube. **Tet** uses the standard tetrahedron: coordinates are
non-negative and X + Y + Z must not exceed 1. **Quad** is for an appropriate
surface-cell workflow. A domain selection does not convert an incompatible
mesh into a compatible one.

Create a mesh or conformal lattice
==================================

#. Choose **+ Add** beside **Mesh / Conformal lattices**.
#. Choose **Mesh lattice** or **Conformal lattice**, supply a unique name,
   and create the definition.
#. Enter a mesh file or a mesh variable produced by an earlier workflow step.
#. For a conformal lattice, select its unit lattice: an integrated name,
   a project custom unit cell, or a ``.txt`` definition.
#. Set **Joint smoothing (k)**. Zero disables smoothing; larger values blend
   joints and add material.
#. Choose **Apply definition**, then **Add lattice step**.

Match a conformal unit cell's reference domain to its mesh: Hex and Tet cells
require the corresponding volume-mesh arrangement; surface workflows may
use Quad cells. A conformal definition refers to a separate unit cell, not
to itself or another mesh/conformal lattice definition.

.. important::

   For mesh and conformal lattices, the consuming operation's **size** is a
   computational search scale. Start near the mesh element size and check the
   intended workflow. It should not be interpreted as freely rescaling the
   underlying mesh. ArtGUI initially disables Fill for these operations.

Import existing definitions
===========================

Use **Import .mld…** for mesh/conformal definitions and **Import .txt…** for
custom unit cells. The imported definition becomes a workflow step that can
be edited in the Project panel.

When an opened workflow refers to external definition files, those references
appear in the corresponding Project section. Selecting one imports the
definition before its first consumer and replaces matching file references
with the new project definition name.

Paths inside imported definitions keep their original values. They do not
automatically become relative to the definition file's former folder.
Check them against the selected Artisan working directory; see :doc:`projects`.

Apply, rename and export
========================

Choose **Apply definition** before leaving a definition form. Save, JSON,
Generate, Add lattice step and Export also attempt to apply the displayed
definition, and stop if its entries are invalid.

Renaming an applied definition updates matching lattice-name references.
ArtGUI prevents removing a definition that is still used; first change or
remove its consuming operations. Keep mesh creation, grid fields and required
unit cells before the steps that need them.

Choose **Export definition…** to write a standalone ``.mld`` or ``.txt`` file
for reuse. The project keeps its inline definition too. Saving a workflow
does not automatically rewrite an external definition file.

Form checks help catch structural mistakes. Artisan still evaluates
expressions, checks input availability and mesh compatibility, and generates
the actual geometry. Review the result after any definition change.
