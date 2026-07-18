# Artisan Repo Guidance For Codex

Artisan is an implicit-modelling lattice generation tool driven mainly by JSON workflows, with Python and C++ API integration options.
Artisan path should be known, and this file should be under the Artisan package main root. If not, ask Artisan package path, and copy this file to the folder.

## Start Here

Read these first:

- `README.MD`
- `Doc/_build/html/_sources/index.rst`
- `Doc/_build/html/_sources/Intro.rst`
- `Doc/_build/html/_sources/API.rst`

Prefer `.rst` files in `Doc/_build/html/_sources` over generated `.html` files.

## Main Paths

- Source/application entry points: `Src`
- JSON workflow examples: `Src/Test_json`
- Sample geometry: `Src/sample-obj`
- Python/C++ API examples: `Interfaces`
- Documentation sources: `Doc/_build/html/_sources`

## Commands

Run a workflow from `Src`:

```bash
python ArtisanMain.py -f .//Test_json//Basic//Sample_Box.json
```

Check version:

```bash
python ArtisanMain.py -v
```

Launch GUI:

```bash
python ArtGUI.py
```

## Workflow Rules

- Start from the closest existing JSON example in `Src/Test_json`.
- Preserve the `Setup`, `WorkFlow`, and `PostProcess` structure.
- Preserve ordered workflow step keys as strings, such as `"1"`, `"2"`, `"3"`.
- Keep paths relative to the Artisan execution directory unless asked otherwise.
- For Python API integration, inspect `Interfaces/Python` and `Doc/_build/html/_sources/API.rst`.
- For C++ API integration, inspect `Interfaces/Cpp` and `Doc/_build/html/_sources/API.rst`.


