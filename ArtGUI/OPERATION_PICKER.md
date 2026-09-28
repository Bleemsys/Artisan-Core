# Operation picker and icons

The Add step dialog provides Common, Recent, Favorites, and All operations. Search covers the entire catalog regardless of the current list. Click a row to select it, then Add step (or press Enter). Up/Down navigates choices; Escape closes. The insertion selector defaults to after the selected workflow step, or the end when no step is selected. Favorites and the last 12 added operation types are saved locally and are not part of workflow JSON.

All 65 current operation types have a short description and an icon. The workflow cards use the same icons. Shared icons identify related operations; their labels distinguish the individual commands.

Display metadata lives in `scripts/operation_metadata.json`; short labels remain in `scripts/operation_labels.json`. Regenerate the catalog with `python scripts/generate_operations.py` from this project. The generator reads Artisan manuals and example workflows and preserves the numeric-type metadata of each preset.

Icons are official SVG assets from `lucide-static` 1.48.0. Their source, package SHA-512 integrity and bundled icon list are recorded in `ui/icons/lucide/provenance.json`. The complete upstream ISC and Feather-derived MIT notices are in `ui/icons/lucide/LICENSE.txt` and displayed in Help → About → View full icon license notices. Keep these notices when redistributing ArtGUI.

Run `python scripts/generate_icons.py` to rebuild the offline `ui/operation-icons.js` module after adding an official SVG to the asset folder and its name to the provenance list. No icon CDN or runtime package installation is required.

Validation: all 65 operations and 371 presets were compared with the previous catalog; only display metadata was added. Browser checks covered filtering, favorites, recent choices, keyboard use, insertion order, JSON numeric preservation and About notices. Native compilation passed. Full Artisan generation was not part of this UI change.
