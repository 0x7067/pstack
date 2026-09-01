# pstack pi-lite

A skills-only Pi package with a small subset of pstack: `/why`, `/unslop`, `/pause-safely`, `/hillclimb`, and `/session-pickup`, plus the sibling trees those skills read (`pstack-harness`, `/how`, `principle-prove-it-works`, `principle-guard-the-context-window`, `/show-me-your-work`).

This is not the full pstack catalog. It does not include `poteto-mode`, sticky mode, or the other playbooks. There is no TypeScript extension. Do not `npm publish` this package.

`/pause-safely`, `/hillclimb`, and `/session-pickup` are first-class Pi skills. You do not need `/poteto-mode` first.

## Install

Pick **one** consume path. Never both.

- Full catalog: `pi install git:github.com/0x7067/pstack@<sha>`. The root package exposes `./skills` only, so this never loads a pi-lite copy.
- Lite subset only: clone that SHA and install this nested package as a local path.

Consuming the root pstack package **and** `./pi-lite` together is unsupported: the overlapping names (`why`, `unslop`, `how`, and the other copied siblings) would load twice. Pi does not reject it for you, so check your own settings:

```bash
scripts/check-pi-consume-path.mjs            # ~/.pi/settings.json and ./.pi/settings.json
scripts/check-pi-consume-path.mjs a/settings.json b/settings.json
```

Sources are pooled across every settings file passed, so a root install in one file and `./pi-lite` in another is still refused. Local paths resolve against the settings file listing them and are identified by their `package.json` name, so an absolute checkout path counts as the root package.

### Lite subset only (`./pi-lite`)

```bash
git clone https://github.com/0x7067/pstack.git
cd pstack
git checkout <sha>
pi install ./pi-lite
```

Then `/reload` so this session picks up the skills.

### Pinning from my-pi-setup

Pick the same single path. Never list the root git source and a `pi-lite` local path in the same `packages` array.

Lite subset as a local package. Identity is the resolved absolute path:

```json
{
  "packages": [
    "/absolute/path/to/pstack/pi-lite"
  ]
}
```

Relative paths resolve against the settings file they appear in. From a checkout of the pinned SHA:

```json
{
  "packages": [
    "./pi-lite"
  ]
}
```

Do not add `./pi-lite/skills` to root `package.json` `pi.skills`. The root package exposes `./skills` only; this nested package is the sole way to load the lite subset.

### Dual-harness copies

If you already ran `scripts/install.sh` and you still use Codex, Claude Code, oh-my-pi, or prime-agent, skip cleanup and keep those copies. They remain the source of truth for those harnesses. Claude Code's `~/.claude/skills` symlinks point at them. Pi auto-loads `~/.agents/skills` and those copies outrank the package, so dual-harness users keep being served from the copies until a later path split.

Pi-only users may remove the pstack copies under `~/.agents/skills` so the package is not shadowed.

`scripts/install.sh` copies repo `skills/` only. It never copies `pi-lite/`.

## Skills

| skill | in this package because |
|---|---|
| [`/why`](./skills/why/SKILL.md) | requested; full tree including `references/` |
| [`/unslop`](./skills/unslop/SKILL.md) | requested |
| [`/pause-safely`](./skills/pause-safely/SKILL.md) | promoted from [`skills/poteto-mode/playbooks/pause-safely.md`](../skills/poteto-mode/playbooks/pause-safely.md) |
| [`/hillclimb`](./skills/hillclimb/SKILL.md) | promoted from [`skills/poteto-mode/playbooks/hillclimb.md`](../skills/poteto-mode/playbooks/hillclimb.md) |
| [`/session-pickup`](./skills/session-pickup/SKILL.md) | promoted from [`skills/poteto-mode/playbooks/session-pickup.md`](../skills/poteto-mode/playbooks/session-pickup.md) |
| [`pstack-harness`](./skills/pstack-harness/SKILL.md) | sibling of `/why` |
| [`/how`](./skills/how/SKILL.md) | sibling of `/hillclimb` |
| [`principle-prove-it-works`](./skills/principle-prove-it-works/SKILL.md) | sibling of `/hillclimb` (the prove-it tree as it exists under `skills/`; there is no `prove-it` skill) |
| [`principle-guard-the-context-window`](./skills/principle-guard-the-context-window/SKILL.md) | sibling of `/session-pickup` and `/hillclimb` |
| [`/show-me-your-work`](./skills/show-me-your-work/SKILL.md) | sibling of `/hillclimb` |

Copied trees stay in sync with `skills/` of the same SHA. The originals of the three promoted playbooks stay under `skills/poteto-mode/playbooks/`.
