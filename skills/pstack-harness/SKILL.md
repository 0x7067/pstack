---
name: pstack-harness
description: Internal compatibility contract for running pstack across agent harnesses.
---

# Pstack harness adapter

Use capabilities, not product-specific tool names. Inspect the current session and apply the strongest supported path below. A missing capability reduces parallelism or convenience, never rigor or the completion criteria.

## Skills

Invoke another skill through the harness's native skill mechanism when it is available. Otherwise read that skill's `SKILL.md` and follow it directly. Resolve sibling skills relative to this file's parent directory.

## Work tracking

For multi-step work, use the harness's plan or todo facility. Preserve the workflow's ordered steps and statuses. If the harness has no tracker, keep the same checklist in the conversation and update it as work advances.

## Delegation

Use the harness's native subagent mechanism when available. Describe the delegation in semantic terms instead of naming a tool schema:

- Give every child a concrete bounded task, its read or write scope, its completion predicate, and the expected return shape.
- Launch independent children concurrently. Use a batch call when the harness supports one.
- Keep read-only reviewers read-only through instructions or permissions. Give writing agents separate worktrees, branches, or output paths.
- Run background work when supported and useful. Otherwise wait for the foreground result.
- Tell a general child to read the relevant pstack skill before working. Do not depend on a harness-specific custom-agent type.
- Review every child result and diff in the parent. Return a synthesis, not raw child output.

If the harness has no subagents, execute the same assignments sequentially in the parent, keep their scopes separate, and disclose that the run used the single-agent fallback. If a workflow requires independent judgment, use a fresh context or another available reviewer; when neither exists, state that limitation instead of pretending self-review is independent.

## Models

Model overrides are optional. Identify the active harness as `pi`, `codex`, `claude-code`, `oh-my-pi`, or `prime-agent`, then read `~/.agents/pstack/models/<harness>.md` when it exists. Use only exact models confirmed available in the current harness. `inherit-parent` means omit the override.

When no configuration exists, inherit the parent model. Prefer diverse model families for panels and independent judgment only when the harness exposes them. A rejected or unavailable model falls back to the parent for that assignment and is reported once. Never guess a replacement slug.

## Questions and approvals

Use a structured question tool when available and when the answer is a genuine product or preference decision. Otherwise ask one concise plain-text question. Follow the harness's approval boundary for filesystem, network, account, and destructive actions; a skill never expands authority.

## Long-running work

Use the harness's recurring goal, loop, scheduler, background process, or wake mechanism when available. Otherwise use a bounded poll with an explicit interval, deadline, and exit predicate. Re-arm event watchers after acting on a result. Do not emulate persistence by blocking the session indefinitely.

## Transcripts and session state

Use session metadata or the active harness's documented storage to locate the current workspace's transcripts. Stay inside the active workspace and requested time range. Never glob across another project's chat history. If transcripts are unavailable, use the current conversation, Git state, PRs, tickets, and other live artifacts, then name the missing source.

## Surface verification

Choose an available capability that drives the real surface: browser automation for web or Electron, terminal interaction for CLI or TUI, simulator or device control for native apps, and direct APIs for services. If no driver exists, build the narrowest project-local verification path or explain the unverified surface. Tests and type checks do not substitute for live proof.
