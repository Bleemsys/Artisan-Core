# Operation picker and icons

The Add step dialog provides Common, Recent, Favorites, and All operations. Search covers the entire catalog regardless of the current list. Click a row to select it, then Add step (or press Enter). Up/Down navigates choices; Escape closes. The insertion selector defaults to after the selected workflow step, or the end when no step is selected. Favorites and the last 12 added operation types are saved locally and are not part of workflow JSON.

All 73 current operation types have a category, a short description, an icon, and English/Chinese display text. The workflow cards use the same icons. Shared icons identify related operations; their labels distinguish the individual commands.

Display metadata lives in `scripts/operation_metadata.json`; short labels remain in `scripts/operation_labels.json`. Regenerate the catalog with `python scripts/generate_operations.py` from this project. The generator reads Artisan manuals and example workflows and preserves the numeric-type metadata of each preset. Chinese display text lives in `ui/locales/operations-zh-CN.js`.

Commands without an example use reviewed starters in `scripts/operation_templates.json`. These are identified as starter templates in the preset source, not engine defaults or complete workflows. Review paths, domain settings and preceding steps before generation. Source examples take precedence as they become available. Known incomplete manual illustrations are excluded and recorded in `operations-report.json`.

Icons are official SVG assets from `lucide-static` 1.48.0. Their source, package SHA-512 integrity and bundled icon list are recorded in `ui/icons/lucide/provenance.json`. The complete upstream ISC and Feather-derived MIT notices are in `ui/icons/lucide/LICENSE.txt` and displayed in Help → About → View full icon license notices. Keep these notices when redistributing ArtGUI.

Run `python scripts/generate_icons.py` to rebuild the offline `ui/operation-icons.js` module after adding an official SVG to the asset folder and its name to the provenance list. No icon CDN or runtime package installation is required.

Catalogue refresh, 2026-10-10: 73 operations cover the current backend registry and schemas, with 416 presets checked against the backend parameter schemas. Added Gen_PolyCubeHexMesh and starters for GeomBuild, GeomFill, Inv_Field, OP_GeomSDF_GridField and Proc_Mesh_Smoothing. Classified and described Proc_BoxSlices. Refreshed polycube, MMG remeshing, adaptive tetrahedral and field examples; excluded four incomplete manual presets. Numeric metadata, icons and Chinese translations were checked. This catalogue refresh does not run geometry calculations or rebuild the release executable; rebuild ArtGUI to include it in a packaged release.

Run `python -m unittest discover -s tests -p test_operation_catalog.py` for starter precedence, incomplete-example exclusion, numeric preservation and metadata checks, and `node --test tests/i18n.test.mjs` for language coverage. When Artisan changes, also compare the generated keywords against `Artisan/Service.py` and `Artisan/command_schemas.py` and validate presets against the current command schemas.
