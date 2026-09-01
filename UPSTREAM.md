# Upstream sync

This repository is a portable fork of [Cursor's pstack plugin](https://github.com/cursor/plugins/tree/main/pstack). It keeps the Agent Skills and workflow playbooks, but it is not a Cursor plugin.

## Portable boundary

The fork targets Pi, Codex, Claude Code, oh-my-pi, and prime-agent. The portable tree intentionally does not contain:

- Cursor's `.cursor-plugin/plugin.json` manifest
- Cursor-specific `agents/`
- Cursor-only automations or model identifiers

`skills/` is the source of truth. A skill that needs harness-specific behavior reads [`skills/pstack-harness/SKILL.md`](./skills/pstack-harness/SKILL.md). The root `package.json` describes the Pi package, `profiles/` contains Pi settings fragments, and `scripts/install.sh` installs the same skill tree for the other supported harnesses.

Do not add a second copy of a skill for a profile. Add the canonical skill under `skills/`, then update the profile and its validator together.

## Baseline

The portability port started from upstream pstack commit [`25e2e7a`](https://github.com/cursor/plugins/commit/25e2e7a8c0d58a1f99171bbb33c550d43047fcbe), immediately before local commit `93b9c5a` removed the Cursor manifest and agents. The fork has independent versioning. Update this baseline after each deliberate upstream import.

## Sync process

The upstream repository is a marketplace containing many plugins. This repository is the pstack subtree, so do not merge the marketplace root into this checkout.

1. Add and fetch the upstream remote if it is not present:

   ```bash
   git remote get-url upstream >/dev/null 2>&1 || git remote add upstream https://github.com/cursor/plugins.git
   git fetch upstream main
   ```

2. Compare a fresh upstream checkout's `pstack/skills/` and `pstack/docs/` with this repository. Review the diff instead of copying the directories wholesale.
3. Port useful upstream changes into the portable tree. Preserve direct `skills/<name>/SKILL.md` ownership, the harness adapter, and the no-Cursor dependency boundary.
4. Update the baseline above and the fork version when the import is complete.
5. Run the checks before publishing or updating a pinned Pi source:

   ```bash
   npm run check
   npm test
   scripts/install.sh --dry-run
   ```

A sync is complete only when the imported behavior is portable, links and metadata validate, and the profile still resolves to its intended canonical skills.
