# Precision controls for geometry, slices and transitions

ArtGUI provides a shared interactive panel for `Add_Geometry`,
`Subtract_Geometry`, `Intersect_Geometry`, `Proc_BoxSlices`,
`HS_Interpolate`, `Lin_Interpolate` and `Add_Attractor`.

Select a target in the property panel. Move uses signed XYZ arrows, planar
XY/YZ/ZX pads and a centre pivot. Rotate uses the Precision dial and its XYZ
tool-axis selector. Selecting a tool or dial axis does not change the workflow.
Resize uses square face, cap or radius handles. Arrow keys adjust a focused
handle; Shift gives larger translation/resize steps or 15-degree rotation.
Drag snap applies in model units. Esc cancels an active drag and restores its
original parameters. Undo restores edits, including changes to the original
numeric parameter fields. Revert edits restores the panel's initial parameters.

## Geometry operations

Box, Cylinder and Sphere previews can be edited directly. Choose mesh opens a
file picker; load its source preview to enable movement, rotation and scaling.
The coloured copy follows the operation's transform without modifying source
buffers or files. Preview supports STL, OBJ, PLY and INP; computed mesh IDs
remain available through the ordinary parameters and are evaluated by Artisan.
Mesh scaling handles require a positive scale and nonzero source extent on
each axis. Unknown geometry definitions remain accessible in the ordinary
parameter fields. Field references are preserved and have no independent
transform handles: edit the referenced field's defining step instead. Choosing
a primitive explicitly replaces the geometry definition and can be undone.

The interactive fields show full box dimensions and angles in degrees. Legacy
`Paras.length` stores half-lengths, `normal` points along the box's local Z
axis, and `z_angle` stores its additional spin in radians. Cylinder changes map
to `pa`, `pb` and `r`. Sphere changes map to `ori` and `r`. Mesh changes map to
`Paras.Scale`, `Paras.Trans` and XYZ Euler `Paras.Rot` in radians. Mesh scaling
uses the source minimum corner; rotation uses its scaled/transformed bounding
box centre, matching Artisan's existing transform order.

## Slice boxes

Each existing `Boxes` entry is selectable independently. Add and duplicate
allocate a new FieldID without reusing IDs found in the workflow; remove keeps
at least one box. The selected box exposes its position, full dimensions and
orientation. Updates preserve source/target settings, the other boxes,
FieldIDs and additional parameters. The half-length/radian conversion is the
same as the existing `Proc_BoxSlices` contract.

## Transition planes and attractors

`HS_Interpolate` exposes one plane through `pt` and `n_vec`.
`Lin_Interpolate` exposes two selectable planes through `pt_01`, `n_vec_01`,
`pt_02` and `n_vec_02`. Each plane has a normal arrow. Plane extents are visual
guides derived from the sampling domain, not clipping boundaries. Move edits
the plane point; rotate edits the normal while preserving its magnitude.
Plane resize is unavailable. The lattice's own Rot, Trans and size are separate.

`Add_Attractor` exposes an influence sphere. Move edits `pt`; resize edits `r`.
The lattice's placement, thickness and other options are preserved.

Guides preview the inputs. Generate the workflow to compute the actual Boolean
result, sliced fields, lattice transition or attractor effect. The update does
not change Artisan's keyword schema or automatically run the backend.

New panel controls and their accessibility labels support English and Chinese;
user FieldIDs, filenames and keyword identifiers remain unchanged.
