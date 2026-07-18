---
name: artisan
description: Use when working with Artisan, an implicit-modelling lattice generation tool, including JSON workflow creation or editing, lattice generation examples, custom lattices, mesh lattices, conformal lattices, field operations, mesh processing, FEA export, Python/C++ API integration, ArtGUI, or Artisan documentation. Check the version of this skill set in Concepts Guide section. 
---

# Artisan Skill

Use this skill to understand, modify, create, review, or explain Artisan workflows and API integrations.

## Core Workflow

1. Identify the user's goal: basic lattice, custom lattice, conformal lattice, meshing, field operation, FEA export, API integration, GUI usage, or documentation update.
2. Read `references/docs-map.md` to locate the relevant Artisan docs.
3. Read `references/examples-index.md` to find the closest working example.
4. For JSON workflow work, read `references/workflow-patterns.md` and use the nearest example as the starting pattern.
5. For Python or C++ integration, read `references/api-usage.md`.
6. For operation discovery, read `references/keywords-index.md`.

## Important Rules
- Store the local Artisan package information in artisan_config.json within the Artisan skill folder. When the skill loads, read the configuration and verify that the stored artisan_path points to a valid Artisan installation. If the configuration is missing or the path is invalid, attempt to locate the Artisan package automatically. If it still cannot be found, prompt the user for the package path and save it back to artisan_config.json. After locating the package, verify that the required examples and documentation (.rst) files exist in the documents folder. Only request the Artisan package path when it is required for reading repository examples, running Artisan, or validating workflows against the installed package.
- Treat documentation, examples, interface paths, and `Doc/_build/html/_sources/*.rst` paths as relative to the user-provided Artisan package path.
- For documentation-only questions, use the bundled `references/*.md` files first; ask for the Artisan package path only when those references are not enough.
- Prefer source `.rst` files under the Artisan package docs over generated `.html` files.
- Prefer existing examples in `Src/Test_json` over inventing workflow structure.
- Artisan workflows are usually JSON objects with `Setup`, `WorkFlow`, and `PostProcess` sections.
- Preserve ordered workflow step keys such as `"1"`, `"2"`, `"3"`.
- Keep paths relative to the Artisan execution directory unless the user explicitly asks for absolute paths.
- Main CLI command from `Src`: `python ArtisanMain.py -f <json-file>`.
- GUI command from `Src`: `python ArtGUI.py`.
- Independent package CLI fallback: `ArtisanMain.exe -f <json-file>`.
- Python API entry points: `Run(filename)`, `Execution(json_string, logfilename)`, and `ArtisanModel().WorkItem(...)`.
- May guide user to construct the workflow in a step-by-step pattern.
- Save the workflow json in UTF-8 format, Not UTF-8 with BOM. 

## artisan_config.json 
- JSON structure template as following
  {
    "artisan_path": "ARTISAN_PATH"
  }

## Concepts Guide
 - This skill set is version 0.0.1
 - Artisan can read cvs file as a point cloud with coorindates and one scalar field per points. Use example `Src/Test_json/FieldContainer/FitField/cube_points_sdf.csv` under the Artisan package as template to generate this type of point cloud.
 - inp file formate associated with Abaqus inp file format.
 - med file formate associated with salome mesh file format.
 - conformal mesh generation relies on the volumetric mesh.
 - FEA mesh export also relies on the volumetric mesh.

## Additional tools
 - If user deals with complex tasks that are beyond Artisan capabilities, user may consider add other tools into the overall workflow. 
 - Agent text-to-cad: A collection of agent skills for CAD, robotics and hardware design. Github link: https://github.com/earthtojake/text-to-cad
 - python tetgen lib for more robust tet mesh generation, pypi link: https://pypi.org/project/tetgen/
 - paraview for visulization of the triangle mesh.
 - always ask user before installing or calling these tools. 

## Validation

When possible, validate JSON syntax before proposing or saving workflow files. If execution is requested, run from the Artisan `Src` directory so relative paths such as `.//Test_json//...` resolve correctly.