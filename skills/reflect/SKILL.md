---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Read `../pstack-harness/SKILL.md` before locating transcripts, launching reviewers, selecting models, or invoking skill-authoring guidance.

## When to invoke

- The user said "reflect" or "/reflect".
- A complex task (5+ tool calls) just landed cleanly and the recipe is worth keeping.
- The agent hit dead ends, found the working path, and the path generalizes.
- The user corrected the agent's approach mid-task.
- A non-trivial workflow emerged that isn't captured anywhere.

Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## Process

### 1. Locate the active transcript

The parent finds its own transcript before fanning out. Use session metadata or the current harness's documented storage. Stay inside the active workspace; never glob across other projects. If no transcript resolves, write a tight digest of the session and pass that instead.

```bash
ls -t <agent-transcripts>/*.jsonl <agent-transcripts>/*/*.jsonl <agent-transcripts>/*/subagents/*.jsonl 2>/dev/null | head -10
```

Three transcript layouts: legacy flat (`<id>.jsonl`), current nested (`<id>/<id>.jsonl`), and subagent (`<parent>/subagents/<child>.jsonl`).

For JSONL candidates, read the opening record and match it to the conversation's opening user prompt. Take the matching path. Other formats use the harness's session metadata.

### 2. Spawn three reviewers in parallel

Launch three reviewers concurrently through the harness's native delegation capability. Reviewers need connector access for context lookups but must not write files or mutate external systems. The parent applies edits. If delegation is unavailable, run the three lenses sequentially in the parent and disclose that they are not independent contexts.

| Lens | Model role | Prompt template |
|---|---|---|
| Judgment | configured reflect judgment, otherwise inherit parent | `references/judgment-reviewer.md` |
| Tooling | configured reflect tooling, otherwise inherit parent | `references/tooling-reviewer.md` |
| Divergent | configured reflect divergent, otherwise inherit parent | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings to the parent.

### 3. Synthesize

Launch one synthesizer using the configured reflect synthesizer model, or inherit the parent. It needs connector access to spot-verify citations but must not write. Use `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. The synthesizer returns a structured Accepted / Rejected / Backlog list. If delegation is unavailable, synthesize in the parent.

### 4. Structural enforcement check

Sanity-check the synthesizer's Accepted list. For any item that would be enforced more reliably by a lint rule, script, metadata flag, or runtime check, move it from Accepted to Backlog. The synthesizer already applies this criterion; this is a final pass before edits land. See the **encode-lessons-in-structure** principle skill.

### 5. Apply

Before applying any Accepted edit, present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval. The user picks which subset to apply and may redirect routings. Skill changes affect every future agent in the org; do not auto-apply.

Backlog items file to whatever devex / backlog tracker your team uses automatically. Those are tracker submissions, not skill edits. Only the Accepted list waits for approval.

For each approved Accepted item, follow the Routing field exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): parent does directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): use the active harness's skill-authoring guidance and run its draft, validate, and iterate loop.
- `tune description: <skill path>` (the skill exists but did not trigger when it should have): use skill-authoring guidance and run a description-optimization loop.
- `new skill: <kebab-name>`: use skill-authoring guidance. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

### 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
