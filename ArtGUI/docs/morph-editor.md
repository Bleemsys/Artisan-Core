# Morph implicit field

ArtGUI 0.1.4 adds a dedicated `Proc_Field_Morph` panel. Find **Morph implicit field** in Add step → Common or Fields. Use an Artisan backend that includes `Proc_Field_Morph`; primitive masks also need the updated `Define_ScalarField_CombineGeometry` backend. Updating ArtGUI alone does not rebuild Artisan.

## Set up a deformation

1. Produce or load the input grid field. Use its name (for example `Body`), or `lattice` for the active field. Use `lattice` as the output to enable normal surface export, or a separate name to keep a named field.
2. Choose the domain mask and optionally a fixed mask. The domain describes where deformation is allowed; everything outside stays fixed.
3. Add one or more moving regions. Select an earlier named mask for each, and enter translation and optional axis-angle rotation.
4. **Edit** opens the earlier geometry-mask definition. **New** inserts a new `Define_ScalarField_CombineGeometry` immediately before the morph, assigns a unique name, and opens its Box/Cylinder/Sphere/Mesh editor. Use **Return to morph** after editing. New masks use background 0, region value 1, and Maximum overlap. New fixed/moving boxes are starting selections; position and size them for your model.
5. Click **Compute preview**. Choose an HDF5 destination and save the workflow if prompted. The preview runs upstream commands and this morph, skips ordinary workflow exports and all later steps, and exports a preview plus a sibling `-quality.json` report. An incomplete later morph does not block a preview of an earlier step. Upstream operations retain their normal side effects, including their own file outputs.

## Movement controls

- **Move**: drag X/Y/Z handles for a constrained translation, or the selected target label to translate in the viewing plane. Numeric translation is the total displacement in model units; coordinates in mm mean translations in mm.
- **Rotate**: drag X/Y/Z rotation rings. Shift snaps the incremental rotation to 15°. The numerical axis and angle describe the resulting rotation, including composed rotations.
- Rotation is applied about `rotation_center` in the original model, then translation. **Use mask center** uses the bounding-box center of the primitive outlines or loaded mesh geometry; it is not a centroid calculated from mask samples. **Pick center** picks the visible original mesh surface and excludes the result layer.
- Arrow keys adjust a focused axis handle by the drag snap (or 1 model unit). Shift multiplies translation steps by 10. Rotation arrow keys use 1°, or 15° with Shift. Escape cancels a drag or picking mode.
- **Undo** reverses panel edits and committed drags. **Revert** restores the state when first opening this morph, or the last successfully computed preview. Edits to separate mask steps remain separate workflow edits.

Bending, twisting, stretching and compression can result from combinations of these translations and rotations with appropriate fixed and moving selections. This panel does not introduce unsupported bend/twist/scale keywords or an automatic deformation preset.

## Understand guides and preview

Teal outlines show domain geometry, blue shows fixed geometry, pale orange shows moving source geometry, and orange shows requested rigid target geometry. Guides show the defining geometry, not sampled mask contours or the RBF solution. Background values, overlap rules, transitions, and the threshold can change the sampled selection. File meshes must be loaded using **Load mask meshes** for their guides to appear. Computed mesh IDs or fields loaded from HDF5 may have no geometry guides; their names can still be entered and resolved by Artisan.

Field suggestions include known outputs from earlier steps. Manually entered names are supported for fields loaded or computed by other operations. An Edit button is available only for an earlier geometry-mask definition. Changing a mask's field name in its editor requires updating its references.

**Also preview surface** creates an STL alongside HDF5 when output is `lattice`; it opens as the result geometry. Otherwise the computed named field opens in the existing HDF5 slice inspector. **View saved field…** opens the standard field picker. Production Export settings and the morph's production report path are unchanged by preview generation. Preview output paths and guides are session state, not Artisan keywords. Repeated previews reuse the selected preview filename.

Quality values come from the successful Artisan report: gradient bound, Jacobian determinant lower bound, inverse error, fixed-field error, and control-point count. Edits to this morph, preceding steps or Setup mark the preview stale. A failed computation does not certify an older result. Inspect the run log for errors; partially written outputs may remain after a failed or cancelled run.

## Solver settings and constraints

**Stages** sets the positive integer `stages` parameter, default 1. Total
translation and rotation are divided into this many equal increments. Each stage
starts from the preceding solved field. The backend updates moving selections
internally while preserving the original named masks; fixed and domain masks
remain fixed. The full motion must fit the sampling domain. A failed stage stops
the calculation and preserves the existing output. Repeated field resampling
can blur thin features, so use a stage count appropriate to the motion.

For multiple stages, preview quality shows the completed stage count, maximum
stage gradient, maximum stage inverse residual, and the composed Jacobian lower
bound. Inverse tolerance applies individually to each stage. The full JSON report
contains per-stage progress, incremental movements and quality metrics.

Advanced settings mirror the backend: `mask_threshold`, `max_control_points`, `support_radius`, `max_gradient`, `inverse_tolerance`, `inverse_iterations`, `max_grid_points`, and `quality_report`. CPU thread selection is automatic. Support radius 0 means automatic. The optional production quality report must be a `.json` filename in an existing directory.

Masks must contain finite values in [0,1] on exactly the same rectilinear grid as the input. Moving regions must not overlap fixed space, the outside domain, or one another after the backend's one-cell constraint halos. Leave enough free space for transition. Grid boundaries remain fixed. Large motions can fail the gradient/inverse checks: increase transition space, adjust the masks or refine the grid as appropriate. ArtGUI does not weaken these checks or resize the sampling domain automatically.

Analytical target bounds warnings are conservative and cannot prove the deformation fits. Mesh bounds, mask overlap and invertibility are checked by Artisan at computation time. The resulting field is generally not an exact signed-distance field: a later distance-sensitive operation may require re-distancing.

## Chinese interface (0.1.5)

The morph panel translates labels with units, rotation and movement controls, tooltips, validation errors, individual mask warnings, preview status and quality labels. The viewport legend and target suffix also translate. Language switching preserves input drafts, field names, filenames and workflow values; user mask identifiers and Artisan keywords stay unchanged.
