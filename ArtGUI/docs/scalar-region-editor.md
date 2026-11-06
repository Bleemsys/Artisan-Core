# Scalar field region editor

ArtGUI 0.1.3 adds an interactive editor for `Define_ScalarField_CombineGeometry`.
Select the workflow step to open **Scalar field from regions**. Existing mesh
strings are preserved. New steps start with a Box mask: background 0, inside 1,
Maximum overlap. Existing imported values are not reset.

## Edit a region

- Select a region row, or its label in the viewport. The checkbox controls its
  outline only; it does not exclude the region from field computation.
- Choose Box, Cylinder, Sphere or Mesh. Changing type preserves the name and
  scalar values, keeps a primitive's center, and resets shape dimensions. Undo
  restores the previous geometry.
- Box dimensions and cylinder height are full lengths. Box orientation uses an
  axis and angle in degrees; the cylinder axis is normalized by Artisan.
- Move: drag X/Y/Z for constrained motion; drag the selected region's name in
  the camera plane for free motion. Pick center snaps to a visible model surface.
- Resize: drag a box face or cylinder cap, keeping the opposite side fixed.
  Both the center and full length change. Radius handles preserve the center.
- Rotate: drag an X/Y/Z ring handle to rotate a Box or Cylinder. Hold Shift for
  15-degree increments. Sphere orientation has no effect.
- Drag snap uses the displayed model units. Zero disables it. Arrow keys adjust
  a focused movement/resize handle by the snap distance or one model unit;
  Shift makes this ten times larger. Escape cancels an active drag or center pick.
- Undo reverses an edit. Revert restores the values from when the editor first
  opened, or from the last successful Update field in this session.

Mesh accepts a file or a previously created mesh ID. Use project geometry or
browse an STL, OBJ, PLY or INP surface. **Load mesh overlay** loads that file into
the viewer. A computed mesh ID can be used by Artisan even if its surface is not
available for viewport preview. The input must be a valid closed surface;
displaying its outline is not a mesh-validity check.

## Compute and inspect

Choose **Combination method** to control how the regions define the field:

| Method | Regions | Background and exterior |
|---|---|---|
| Minimum / Maximum | Any number | Existing min/max rule includes the background and outward transitions |
| Linear | At least two separate regions | Interpolates throughout the exterior using relative surface distances |
| Smoothstep | Exactly two separate regions | Uses a smoothstep distance profile to join regional values gently |
| InverseDistance | At least two separate regions | Uses inverse-distance weights; **Distance power** controls proximity influence |

Interpolation keeps each region's value inside it and fills the entire sampling
domain. The background control is disabled because its saved value is not used.
Transition widths must be zero; **Clear transition widths** explicitly resets
incompatible imported widths, and Undo restores them. Other validation errors
disable **Update field** until corrected. Overlapping or touching regions are
checked by Artisan when the field is computed and produce an error identifying
the conflicting regions. The GUI does not infer overlap from bounding boxes.

Distance power must be positive and finite; 1 matches Linear. It appears only
for InverseDistance (or to correct an incompatible imported value). Changing
to another method removes this unused setting; Undo restores the prior state.

Outlines represent region geometry, not sampled scalar values. **Update field**
saves the workflow and asks for an HDF5 preview output on first use. It runs
upstream steps through the selected field definition, omits ordinary Export
steps, adds a field-only export, and opens the resulting field in the existing
field inspector. Downstream morphing and other operations are not run. Upstream
operations retain their normal behavior, including any outputs they themselves
write. The saved production workflow is not replaced by this temporary preview.

The preview uses the existing Setup sampling grid. An out-of-bounds note does
not resize the grid. Transition width is an outward field blend, not morphing
smoothing. Region visibility, selected tool and snap distance are session-only
UI settings and are not sent to Artisan.

The updated Artisan Python backend is required for primitive geometry objects.
Select `Src/ArtisanMain.py` and its Python environment under **Backend…**, or use
an Artisan executable rebuilt after the primitive-region backend update. Updating
ArtGUI alone does not rebuild the packaged Artisan engine.
