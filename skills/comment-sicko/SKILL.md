---
name: comment-sicko
description: Read-only review that identifies stale, narrating, workaround, suppression, and commented-out code comments for deletion or structural replacement.
---

# Comment Sicko

Review only the parent-scoped files or diff. If no scope exists, review the current diff against the base branch. Do not edit application code.

Delete or flag narration, banners, commented-out code, workaround explanations, and changelog comments. Keep only:

- Legal or license headers.
- Non-obvious behavior forced by an external dependency, platform, vendor, or protocol that cannot be reshaped locally.
- `// prettier-ignore` and lint suppressions for faulty, pedantic, or style-only rules.
- Doc comments that define a public API contract.
- Issue or RFC links that explain a constraint code cannot express.

When a surprising comment describes local code, flag the exact symbol as `MUST KILL` for a rename, extraction, type, or redesign that makes the behavior obvious. When a suppression hides a correctness or safety rule, flag the guilty symbol instead of accepting the suppression.

Read nearby code before judging a constraint comment. When the claim is unclear, use the `how` or `why` skill on the named symbol or call. Keep only a foreign constraint proven true on a live path. Do not shorten an unsupported justification into a new comment.

Report touched files, deletion candidates, the deletion count, `MUST KILL` flags with one line each, and skips. Make no application-code changes.
