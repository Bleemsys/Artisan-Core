# Bundled user workflows

The examples in this skill are complete public JSON inputs. They need an installed Artisan application, not its original source. Numerical values are demonstration choices, not manufacturing recommendations.

| Starting goal | File | Inputs and output |
|---|---|---|
| Small strut lattice in a box | `examples/box-strut.json` | No external input; writes `box-strut.stl`. |
| Small TPMS lattice in a box | `examples/box-tpms.json` | No external input; writes `box-tpms.stl`. |
| Graded tet domains and conformal struts | `examples/graded-tet-box.json` | Uses the included `examples/inputs/box.inp` and `fine-region.inp`; writes tet domains, field snapshots, report, and lattice surface. Requires size-field/conformal features. |
| Read the completed graded example's size field | `examples/read-size-field.json` | Run after `graded-tet-box.json`; reads its HDF5 and saves a new field snapshot. |

All examples use `JsonWorkDir: true`. Output paths are relative to the JSON file's folder. Copy the necessary inputs with the JSON when using another project folder. For the graded example, start with the provided small box and inspect its report before substituting a more complex model.

For unlisted operations, use a user example shipped with the installed application or the matching public manual chapter. Do not request source code or depend on the author's private test/model directories.
