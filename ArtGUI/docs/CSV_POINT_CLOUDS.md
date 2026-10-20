# CSV point clouds

Use **Point clouds > + Add** to select a CSV or TSV file. Dropping a CSV onto
the viewport also works for the current session. In the import dialog, confirm
the delimiter, header row, X/Y/Z columns, scalar color column, and display limit.
The selected coordinate columns must be distinct. No data table is displayed.

Opening or applying workflow JSON also discovers CSV/TSV paths in its nested
parameters and supporting-file references. These appear under **Point clouds**,
like external lattice definitions. Discovery does not read the CSV contents or
change workflow parameters. Click a referenced file to confirm its column mapping
and show the points. Duplicate path spellings using slashes, case, or leading
`./` are combined; saved point-cloud mappings take priority. Relative paths use
the same workflow-location and application search as external lattice files.
Missing or not-yet-generated CSVs report an error when opened and remain listed.

A point-cloud layer appears in the project tree. Its sidebar controls the color
field, color map, point size, color range and range lock, reference-geometry
opacity, visibility, point inspection, and display limit. The main viewport
can be enlarged by collapsing the bottom panel. Its Expand/Collapse button works
with every property panel and keeps the same state when the selection changes. Coordinates use model units; scalar units are unspecified unless known.

The reader supports comma, semicolon and tab delimiters, quoted fields, escaped
quotes, UTF-8 headers, and quoted newlines. Rows with invalid coordinates or an
inconsistent number of columns are skipped and counted. Missing or nonfinite
scalar values remain visible in gray. The point inspector shows the original
sample coordinates, data-row identifier, and selected scalar value. These are
samples, without interpolation or fitted-field operations.

Large files are scanned in a background worker using bounded reads. The display
uses a deterministic reservoir sample capped at the selected 100,000, 250,000,
or 1,000,000 points. The status identifies sampled previews and the shown/total
counts. Coordinate bounds and the selected scalar range use every valid row.
Changing the scalar column or display limit rereads the CSV; loading can be
cancelled. Native RAM monitoring checks the bounded allocations during loading.

Native file-picker paths, column mappings, display limits, and appearance are
saved under ArtGUI.pointClouds in the project JSON. Reopen a saved layer from
the project tree to restore it without remapping. A browser-dropped File lacks
a portable native path and must be reattached after reopening. The original CSV
and Artisan workflow operations are unchanged. The point-cloud layer does not
implicitly make a fitted lattice-control field.

Automated DOM tests can use an optional jsdom installation. Set ARTGUI_TEST_DOM
to the jsdom module URL, then run node --test tests/point-cloud-ui.test.mjs.
Without this optional test dependency those DOM checks are skipped; parser and
worker tests have no new production dependencies.
