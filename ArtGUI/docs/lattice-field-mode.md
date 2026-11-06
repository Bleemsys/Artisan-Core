# Strut field mode

For a **Define_Lattice** step containing a **Mesh lattice** or **Conformal lattice** definition, open **Advanced definition → Strut field mode**.

- **Band (default)** retains the current fast local calculation and capped values outside local strut regions.
- **Full field** completes distant strut-field values using the existing spatial search. Use it when later offsets or other operations require complete distance values. It can take longer.

The setting applies to strut fields. Conformal TPMS and geometry-based calculation paths do not use this setting.

Choose the mode and click **Apply changes**, or save the workflow to apply its pending edits. The read-only definition JSON shows the pending value. Switching between definitions or interface languages preserves the draft; **Revert** restores the saved value.

The optional parameter is stored inside the lattice definition:

```json
{
  "type": "ConformalLattice",
  "definition": {
    "meshfile": "HexMesh",
    "la_name": "BCCubic",
    "k": 0.0,
    "field_mode": "full"
  }
}
```

For mesh lattices, use `"type": "MeshLattice"` and omit the unit-cell `la_name` inside `definition`.

Existing definitions without `field_mode` display **Band (default)**. Opening, saving, or editing another property preserves the omission. An explicit saved `"band"` or `"full"` is retained. Only these two string values are accepted; invalid imported values must be corrected before applying the definition.

The mode belongs to the definition, not the consuming **Add_Lattice** step. Exporting the definition as `.mld` retains the selected value. Runtime values remain `band` and `full` in both English and Chinese interfaces.

This control requires the updated Artisan backend that supports optional `field_mode`. Rebuilding ArtGUI does not rebuild the packaged Artisan engine; select the updated Python backend if the packaged engine has not been rebuilt.
