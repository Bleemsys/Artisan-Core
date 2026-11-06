# Slice manager

`Proc_BoxSlices` uses a dedicated property panel with source/output selectors,
a named, colour-coded slice list, full thickness, orientation presets, position
along the normal, and expandable width/height/center controls. Numeric controls
and the existing Precision Move/Resize/Rotate handles edit the same box.
There is no Advanced settings section. The main JSON editor remains available.

Dimensions use the model coordinate units (mm when the model coordinates are mm).
Width, height and thickness are full dimensions; the backend `length` vector
continues to store half-lengths. Position along normal is the projection of the
box center onto its unit normal, measured from the world origin. Changing this
value preserves the center's two tangential components.

Add slice offers Single slice and Parallel set. The latter appends 1–200 boxes
using the selected slice as a template (or a domain-based default if empty).
The template is retained. The new set is centered on the template center and
distributed along its normalized normal using center-to-center spacing. It
inherits thickness, width, height and orientation; generated field IDs avoid
existing workflow IDs. Every generated slice can subsequently be edited or
removed independently. Creating a set is one Undo action. No grouping keywords
are added to the Artisan JSON.

Source supports Geometry/Field. Output supports FieldContainer/Lattice.
Legacy `outfile` workflows keep their mesh-file output and do not receive
incompatible Target or FieldID values when adding/duplicating slices.

Verification: 70 rendered interaction checks, including all seven spatial panels,
Chinese/English switching, selected-slice movement, half-length conversion,
parallel-set spacing on a rotated normal, unique IDs, single-action Undo,
invalid-count rollback, and legacy file-output compatibility. 30 targeted Node
tests cover spatial transforms, Precision gizmos, region geometry, workflow
serialization and translations.

The Slices section shares the scalar-field region list styles: count, header Add button, colour/name/summary rows and outline visibility toggles. Visibility is editor-only and does not change JSON. Thickness summaries update during edits. Validated by 78 browser interaction checks, including sibling visibility after removal and Undo.
