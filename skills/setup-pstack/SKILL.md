---
name: setup-pstack
description: Configure pstack model roles for the active agent harness. Detects available models and writes a harness-specific shared configuration. Use for setup-pstack, "configure pstack models", or changing pstack model choices.
---

# Setup pstack

Create `~/.agents/pstack/models/<harness>.md` for the active harness. Pi, Codex, Claude Code, oh-my-pi, and prime-agent share this configuration directory without sharing incompatible model identifiers.

Read `../pstack-harness/SKILL.md` before using model discovery or questions.

## Steps

1. Identify the active harness as `pi`, `codex`, `claude-code`, `oh-my-pi`, or `prime-agent` from the session metadata and available executable. Do not infer it from the selected model.
2. Enumerate the exact models that the active harness can assign to a subagent. Prefer its native model list, API, or tool schema. If the harness cannot override child models, use only `inherit-parent`. If it can override models but cannot enumerate them, ask the user for the exact identifiers.
3. Read the existing file for this harness when present. Treat it as current state. Start missing roles at `inherit-parent`.
4. Show every role and current value. Mark any identifier absent from the detected set. Ask whether to keep the current mapping or change specific roles. Panel roles are comma-separated lists; their length sets fan-out even when every entry inherits the parent.
5. Validate every value. `inherit-parent` is always valid. Every other value must exactly match a model confirmed by the active harness.
6. Write the whole harness file atomically so reruns converge. Preserve configuration files for other harnesses.
7. Report the written path and note that new sessions will use it. If the harness supports live skill reload, the next pstack invocation may use it immediately.

Use this shape:

```markdown
---
harness: codex
---

# Pstack model roles

feature, refactoring: inherit-parent
bug-fix: inherit-parent
perf-issue: inherit-parent
hillclimb: inherit-parent
judgment and prose: inherit-parent
hardest tasks: inherit-parent
how explorer: inherit-parent
how explainer: inherit-parent
how critics: inherit-parent, inherit-parent, inherit-parent, inherit-parent
why investigators: inherit-parent
why synthesizer: inherit-parent
reflect tooling: inherit-parent
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: inherit-parent, inherit-parent, inherit-parent, inherit-parent
arena cross-judge pool: inherit-parent, inherit-parent, inherit-parent, inherit-parent
swarm workers: inherit-parent
architect runners: inherit-parent, inherit-parent, inherit-parent, inherit-parent
interrogate reviewers: inherit-parent, inherit-parent, inherit-parent, inherit-parent
```

After configuration, check whether the current project has a real-surface verification skill or harness. If not, offer `create-verification-skill` once. Continue without it when the user declines.
