# Artisan user skill

Version 0.1.0. This skill helps normal users choose parameters, prepare workflows, use the installed Artisan application, and export results. It includes public input references and small examples. It does not contain Artisan implementation code, internal algorithms, binaries, or a development repository.

Copy the `artisan` folder into your Codex skills directory. Ask for an Artisan design in ordinary language, including your input shape, units, desired cell scale, strut/wall target, and output. The skill can explain parameters without finding an installation; running an example requires the Artisan application and the relevant features.

The public parameter reference was checked against Artisan 0.2.18.dev. Older applications may not support all listed operations. Use the installed application's version and public manual when choosing version-specific features.

Start with the complete examples described in `references/examples-index.md`. Optional `repo-templates/AGENTS.md` guidance belongs in a user workflow project, not an Artisan source repository. Do not include your local `artisan_config.json`, personal paths, logs, private geometry, or application source when sharing this skill.
