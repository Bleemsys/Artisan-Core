---
name: artisan
description: Help Artisan users choose lattice parameters, create and check JSON workflows, use ArtGUI, export results, and troubleshoot runs with the installed application. Uses public inputs and outputs; original source code is not required.
metadata:
  skill-version: "0.1.0"
---

# Artisan user guide

Turn a user's design goal into a small, usable Artisan workflow. Explain what the controls change and supply the routine parameters yourself. This skill is version 0.1.0; its parameter reference was checked against Artisan 0.2.18.dev. Packaged releases can differ.

## Working with the user

1. Establish the shape or input file, model units, desired cell scale, wall/strut target, and required output. Ask only for missing choices that materially affect the result; explain them in ordinary language. Reuse choices already provided.
2. Choose the nearest bundled starter from [references/examples-index.md](references/examples-index.md). Start with a small CPU preview; state any assumed values. Cell size, sampling resolution, and strut/wall control are separate decisions.
3. Use [references/parameter-guide.md](references/parameter-guide.md) for parameter meaning, units, practical starting points, and common dependencies. Read [references/meshing-and-fields.md](references/meshing-and-fields.md) for graded or conformal designs, and [references/export-usage.md](references/export-usage.md) for outputs.
4. Before writing a command, look up its exact heading in [references/parameters.md](references/parameters.md). For nested input objects, consult the matching entry in [references/parameter-catalog.json](references/parameter-catalog.json). Read only the commands needed. Distinguish required keys, documented defaults, and optional values without a stated default.
5. Deliver complete UTF-8 JSON without a BOM, alongside a short explanation of the values the user is likely to change. Keep `Setup`, ordered `WorkFlow` steps, and `PostProcess`; use string step numbers. See [references/workflow-patterns.md](references/workflow-patterns.md).
6. Check JSON, required parameters, input files, names, paths, and dependent operations before running. If Artisan is available, verify its version and run only the requested workflow or an appropriate small preview. Say whether you checked the input or actually generated the result.

## Public interface boundary

- Use the bundled guides, user-provided workflows, public manual, and the installed application. This skill must work without an Artisan source repository.
- Keep answers about accepted inputs, supported outputs, user-visible behavior, errors, and operating limits. Do not reproduce Artisan implementation code, internal formulas, algorithm steps, private module/class names, source excerpts, or build internals.
- Do not search for, open, request, or distribute proprietary source files. Do not inspect or decompile application binaries; use the installed executable through its documented interface. Ask for the workflow, version, relevant input asset, or a redacted error message instead of source files.
- For a feature not covered by these references, consult its public manual or a shipped example. Do not invent parameter names, defaults, compatibility, or implementation details. Explain a limitation when it cannot be resolved from public materials.
- Custom user-authored lattice definitions and mathematical expressions are user inputs. Help with those when requested, without extracting built-in lattice definitions or formulas.
- Share workflows and user-selected assets. Exclude local installation configuration, personal paths, logs, private models, source files, and developer notes from a redistributable skill package.

## Finding and running Artisan

General parameter help does not need an installation path. When running or checking version-specific features, use an already known executable path or inspect the existing local `artisan_config.json` if present. Its `artisan_path` is local configuration, never part of a shared package. A new local configuration should be stored with the user's workflow/project files.

Prefer `ArtisanMain.exe -v` and `ArtisanMain.exe -f <workflow.json>` with the installed application. Use `ArtGUI.exe` for the workbench. If the executable cannot be found in known locations, ask for the application folder; do not search for a development repository or require Python. Keep execution results in the user's project/output folder.

For SDK tasks explicitly requested by the user, read [references/api-usage.md](references/api-usage.md). For manual chapter navigation, read [references/docs-map.md](references/docs-map.md). The public workflow-project template is [repo-templates/AGENTS.md](repo-templates/AGENTS.md); never install it automatically.
