# Blend lattice fields

Select **OP_FieldMerge — Blend lattice fields** in the workflow. The panel uses the shared Properties title and three expandable sections.

1. **Target lattice** defines the lattice blended into the accumulated field from earlier workflow steps. It accepts integrated lattices, project definitions and definition files. Set cell dimensions and the native thickness control; for strut lattices this control is the strut radius.
2. **Transition region** selects Linear, Attractor, Annulus or Field. Linear exposes start/end plane positions and normals. Attractor uses a center and radius. Annulus shares a center between its inner and outer radii. Field selects an earlier-created field name or a CSV file, with lower and upper thresholds. Source choices retain separate references and threshold settings while editing.
3. **Bridge lattice** optionally guides the transition through a third lattice. Its native Weight and f_trans values are exposed. Connectivity still needs to be checked in the generated model.

Use the region tools to move centers, resize radii or rotate planes with the workbench's precision handles. Annulus and Linear provide buttons for selecting the radius or plane to edit. Numeric inputs select the corresponding tool. Completed drags are single undo actions; Escape restores the original guide and parameters.

Placement controls affect the target lattice. Displayed rotation angles are degrees; saved Rot values remain radians. Advanced retains Fill, Cube_Request, extra parameters and the existing example presets. Unknown imported parameters and numeric types are preserved.

**Update preview** runs Artisan through this operation and saves an HDF5 lattice field. It excludes downstream operations and unrelated exports, preserving named-field exports needed by a ReadGridField in the prefix. Project outputs remain unchanged. The usual progress and cancel controls apply.

After generation, open **Inspect field** for slices, probes and a sampled isosurface. The isosurface is an inspection view; exported meshes use the original grid. Editing this step or prerequisites marks the stored preview stale. Guide movement alone does not recalculate the lattice.

The title section is unchanged. Influence-guide visibility is controlled in the property panel; no duplicate control is added to the viewport toolbar. English and Simplified Chinese are supported.
