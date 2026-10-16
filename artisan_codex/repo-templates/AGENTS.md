# Artisan workflow project

This folder contains user workflows and their input/output assets. Use the installed Artisan application and the Artisan skill; original source code is not required.

- Preserve the user's model units and requested geometry/lattice/output choices.
- Use the skill's bundled parameter guide and public command reference. Consult the installed application's manual for version-specific features.
- Keep `Setup`, ordered string-keyed `WorkFlow` steps, and `PostProcess`. Check exact parameter spelling and required keys.
- Prefer project-relative paths with explicit `JsonWorkDir: true`. Keep generated files in this project.
- Check JSON, inputs, IDs, and output paths before a run. Distinguish input validation from a successfully generated model.
- Explain design controls and user-visible errors. Do not request or expose proprietary source, algorithms, built-in lattice definitions, or development/build internals.
