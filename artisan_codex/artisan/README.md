# Artisan Codex Package

This package contains a Codex skill and a repo-side `AGENTS.md` template for Artisan.

## Contents

- `artisan/`: installable Codex skill folder
- `artisan/SKILL.md`: skill trigger metadata and workflow instructions
- `artisan/references/`: docs map, examples index, workflow patterns, API usage, and keyword index
- `repo-templates/AGENTS.md`: template to place at the root of the Artisan repo

## Install The Skill

Copy the `artisan` folder to:

```text
C:\......\.codex\skills\artisan
```

Then restart Codex or start a new thread so the skill can be discovered.

## Add Repo Guidance

Copy `repo-templates/AGENTS.md` to the Artisan repo root:

```text
\Artisan\Artisan\AGENTS.md
```

The skill gives reusable Artisan knowledge. The `AGENTS.md` file gives repo-local navigation and rules.
