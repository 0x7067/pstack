# pstack

pstack is a set of Agent Skills and workflow playbooks for careful software work. It helps an agent understand a codebase before editing it, choose a shape before writing code, and verify the real result before calling a task done.

I built it around a simple preference: one small, well-understood change is worth more than a large patch that merely looks plausible. When each change has evidence behind it, independent work can run in parallel without turning into noise.

pstack comes from [poteto](https://x.com/poteto). Use it as-is, fork it, or keep the parts that fit how you work.

## What this package is

This repository is an [Agent Plugins](https://agent-plugins.org/) 1.0.0 package and a portable fork of [Cursor's pstack plugin](https://github.com/cursor/plugins/tree/main/pstack).

The portable package has one component type:

- [`plugin.json`](./plugin.json) is the Agent Plugins manifest.
- [`skills/`](./skills/) contains the Agent Skills. A compatible client discovers each immediate child directory with a `SKILL.md` file.

pstack does not ship an `mcp.json` because it has no MCP server. The nested playbooks, references, and scripts support their parent skills. They are not separate discovered skills.

The repository also contains client adapters and maintenance files:

- [`package.json`](./package.json) describes the Pi package.
- [`profiles/`](./profiles/) contains Pi settings fragments.
- [`scripts/install.sh`](./scripts/install.sh) is a legacy fallback for clients that cannot load Agent Plugins and only read user skill directories.
- [`docs/guide/`](./docs/guide/README.md) is the usage guide.
- [`UPSTREAM.md`](./UPSTREAM.md) records the fork boundary and sync rules.

The root `skills/` tree is the source of truth. Do not copy a skill for one client or profile. Add it under `skills/` and update the relevant adapter or profile.

## Install

### Agent Plugins-compatible clients

Use the client's Agent Plugins installation flow and point it at the repository root. The standard defines the package layout, not distribution or installation.

The client reads `plugin.json`, then discovers the skills under `skills/`. Do not run `scripts/install.sh` in this mode. That script copies skills into legacy user directories and bypasses plugin discovery.

### Pi

Install the Pi package from Git:

```bash
pi install git:github.com/0x7067/pstack
```

From a local checkout, use:

```bash
pi install .
```

Run `/reload` after installation so the current session sees the skills.

The full catalog is the default package. A smaller Pi-only profile is available at [`profiles/pstack-lite.json`](./profiles/pstack-lite.json). It selects ten skills and keeps one package source.

- Full catalog: `pi install git:github.com/0x7067/pstack@<sha>`
- Lite profile: install the root package, then replace its package entry in Pi settings with the filtered entry from [`profiles/pstack-lite.json`](./profiles/pstack-lite.json). Pin the source to the SHA you installed. Do not add the profile beside an unfiltered pstack entry.

If you previously ran the legacy installer, Pi may load those copies from `~/.agents/skills` before it loads the package. Keep the copies if another legacy client needs them. Pi-only users can remove the pstack copies from `~/.agents/skills` so the package is the only source.

### Clients without Agent Plugins support

Use this path only when the client cannot load an Agent Plugin and only reads skills from a user directory. If the client supports Agent Plugins, install the repository root as a plugin instead.

From the checkout, run:

```bash
scripts/install.sh
```

The installer copies each skill to `~/.agents/skills` and creates a symlink for each skill under `~/.claude/skills`. Use `--dry-run` to inspect the targets before writing them.

These are the invocation forms used by the direct skill-directory integrations:

| Client | Example |
|---|---|
| Codex | `$poteto-mode` |
| Claude Code | `/poteto-mode` |
| oh-my-pi or prime-agent | `/skill:poteto-mode` |

Use the client's own syntax when it exposes a different command form. Natural language also works: `use the poteto-mode skill for this task`.

## Start here

1. Install pstack using the path for your client.
2. Run [`setup-pstack`](./skills/setup-pstack/SKILL.md) if you want model overrides for delegated work. Otherwise, every role inherits the parent model.
3. Use [`poteto-mode`](./skills/poteto-mode/SKILL.md) for a non-trivial task.

For a guided walkthrough, read [the pstack guide](./docs/guide/README.md). It covers setup, task routing, code exploration, design, implementation, verification, and long-running work.

A good first prompt names an outcome and a check:

```text
Use poteto-mode. The export writes duplicate rows when a retry lands mid-run. Reproduce it first, then fix it and verify the result.
```

## Use poteto-mode

[`poteto-mode`](./skills/poteto-mode/SKILL.md) is the default entry point. It stays out of the way for small requests and routes work that needs rigor.

When it applies, the skill:

1. Starts the harness's plan or todo tracker, or keeps the same checklist in the conversation.
2. Reads the principles index before choosing a path.
3. Matches the task to a playbook and copies the playbook's steps into the tracker.
4. Routes to focused skills such as `how`, `why`, `architect`, `tdd`, or `interrogate` as the steps require them.
5. Verifies the real artifact and reports the decisions and evidence.

The mode is sticky. It remains active for the conversation until you opt out. It uses the current harness's native subagents, recurring work, schedulers, and background execution when available. Without those features, it uses a bounded plan and reports the limit.

### Playbooks

| Playbook | Use it for |
|---|---|
| [Investigation](./skills/poteto-mode/playbooks/investigation.md) | Answering a read-only question about behavior, design, or history. |
| [Bug fix](./skills/poteto-mode/playbooks/bug-fix.md) | Reproducing a defect, finding its root cause, and fixing it with runtime evidence. |
| [Perf issue](./skills/poteto-mode/playbooks/perf-issue.md) | Tracing a measured slowdown and improving it against a baseline. |
| [Hillclimb](./skills/poteto-mode/playbooks/hillclimb.md) | Repeating measured experiments to improve one metric toward a target. |
| [Runtime forensics](./skills/poteto-mode/playbooks/runtime-forensics.md) | Diagnosing a live symptom such as a leak, idle CPU spin, or glitch. |
| [Trace forensics](./skills/poteto-mode/playbooks/trace-forensics.md) | Diagnosing a captured profile or trace artifact. |
| [Feature](./skills/poteto-mode/playbooks/feature.md) | Building new behavior from a named data shape. |
| [Refactoring](./skills/poteto-mode/playbooks/refactoring.md) | Changing structure without changing behavior. |
| [Prototype](./skills/poteto-mode/playbooks/prototype.md) | Comparing cheap sketches before making a design decision. |
| [Visual parity](./skills/poteto-mode/playbooks/visual-parity.md) | Matching two UI implementations against visual evidence. |
| [Authoring a skill](./skills/poteto-mode/playbooks/authoring-a-skill.md) | Writing or changing an Agent Skill. |
| [Eval](./skills/poteto-mode/playbooks/eval.md) | Testing how a skill, prompt, or structure change affects agent behavior. |
| [Babysit](./skills/poteto-mode/playbooks/babysit.md) | Driving a pull request or stack through conflicts, review, and CI. |
| [Shipping](./skills/poteto-mode/playbooks/shipping.md) | Independently verifying a green stack before landing the contiguous run. |
| [Autonomous run](./skills/poteto-mode/playbooks/autonomous-run.md) | Driving one task to a defined completion condition without stopping. |
| [Orchestrate](./skills/poteto-mode/playbooks/orchestrate.md) | Coordinating a project that spans many phases, pull requests, and agents. |
| [Autopilot full](./skills/poteto-mode/playbooks/autopilot-full.md) | Running independent pull requests to merge with one owner per pull request. |
| [Autopilot stack](./skills/poteto-mode/playbooks/autopilot-stack.md) | Building and verifying one linear stack for the operator to land. |
| [Session pickup](./skills/poteto-mode/playbooks/session-pickup.md) | Resuming work from a transcript, cloud-agent URL, or pushed branch. |
| [Pause safely](./skills/poteto-mode/playbooks/pause-safely.md) | Stopping in-flight work with a checkpoint that another session can resume. |
| [Multi-phase plan](./skills/poteto-mode/playbooks/multi-phase-plan.md) | Organizing work that spans phases or stacked pull requests. |
| [Worktree cleanup](./skills/poteto-mode/playbooks/worktree-cleanup.md) | Safely reclaiming space from stale worktrees and iOS simulators. |
| [Opening a pull request](./skills/poteto-mode/playbooks/opening-a-pr.md) | Preparing a focused pull request at the end of another playbook. |

## Other skills

Use these skills directly when you already know which kind of help you need. `poteto-mode` routes to many of them automatically.

| Skill | Use it for |
|---|---|
| [Architect](./skills/architect/SKILL.md) | Settling a function boundary, its callers, types, and module shape before implementation. |
| [Arena](./skills/arena/SKILL.md) | Running competing design or implementation attempts and combining the useful parts. |
| [Automate me](./skills/automate-me/SKILL.md) | Drafting a personal mode from how you actually work. |
| [Blast radius](./skills/blast-radius/SKILL.md) | Finding what a small-looking change could break. |
| [Bro](./skills/bro/SKILL.md) | Restating the last message in plain language. |
| [Comment Sicko](./skills/comment-sicko/SKILL.md) | Reviewing comments without changing the code. |
| [Create verification skill](./skills/create-verification-skill/SKILL.md) | Generating a project-local skill that proves app behavior. |
| [Figure it out](./skills/figure-it-out/SKILL.md) | Designing a rigorous path when no bundled playbook fits. |
| [How](./skills/how/SKILL.md) | Explaining runtime flow, ownership, and layering. |
| [Hillclimb](./skills/hillclimb/SKILL.md) | Running a sustained, measured improvement loop. |
| [Interrogate](./skills/interrogate/SKILL.md) | Trying to break a change with independent judgment and review. |
| [Maintain verification skill](./skills/maintain-verification-skill/SKILL.md) | Keeping a project's verification map aligned with the app. |
| [Make bot UI](./skills/make-bot-ui/SKILL.md) | Building a UI whose actions call an existing agent or automation endpoint. |
| [No comments](./skills/no-comments/SKILL.md) | Finding and removing narrating comments before review. |
| [Pause safely](./skills/pause-safely/SKILL.md) | Creating a clean resume point before going offline or restarting. |
| [Recall](./skills/recall/SKILL.md) | Rebuilding recent context from the shared record and chat history. |
| [Reflect](./skills/reflect/SKILL.md) | Capturing lessons from a completed task for the next run. |
| [Session pickup](./skills/session-pickup/SKILL.md) | Taking over another agent's in-flight work. |
| [Setup pstack](./skills/setup-pstack/SKILL.md) | Configuring model roles for the active harness. |
| [Show me your work](./skills/show-me-your-work/SKILL.md) | Keeping an auditable decision trail. |
| [Swarm](./skills/swarm/SKILL.md) | Splitting independent work across parallel workers. |
| [TDD](./skills/tdd/SKILL.md) | Writing a failing test before fixing a behavior. |
| [Teach](./skills/teach/SKILL.md) | Building an explanation of a change from how and why evidence. |
| [Technical writing](./skills/technical-writing/SKILL.md) | Writing readmes, RFCs, PR descriptions, and other technical documents. |
| [TypeScript best practices](./skills/typescript-best-practices/SKILL.md) | Applying type-system discipline to TypeScript. |
| [Unslop](./skills/unslop/SKILL.md) | Removing AI tells from writing. |
| [Why](./skills/why/SKILL.md) | Finding the reasons behind a design or decision. |

## Principles

`poteto-mode` reads this index before it chooses a playbook. Read the linked skill when a principle shapes a decision.

| Principle | Rule |
|---|---|
| [Laziness protocol](./skills/principle-laziness-protocol/SKILL.md) | Prefer deletion and the smallest change that solves the problem. |
| [Foundational thinking](./skills/principle-foundational-thinking/SKILL.md) | Choose the core types and data structures before writing logic. |
| [Redesign from first principles](./skills/principle-redesign-from-first-principles/SKILL.md) | Treat the requirement as foundational instead of bolting it onto the old design. |
| [Subtract before you add](./skills/principle-subtract-before-you-add/SKILL.md) | Remove dead weight and redundant paths before adding more structure. |
| [Minimize reader load](./skills/principle-minimize-reader-load/SKILL.md) | Reduce layers and hidden state between a question and its answer. |
| [Outcome-oriented execution](./skills/principle-outcome-oriented-execution/SKILL.md) | Converge on the target architecture instead of preserving throwaway intermediate states. |
| [Experience first](./skills/principle-experience-first/SKILL.md) | Choose a useful, polished result over implementation convenience. |
| [Exhaust the design space](./skills/principle-exhaust-the-design-space/SKILL.md) | Compare competing prototypes before committing to a design. |
| [Build the lever](./skills/principle-build-the-lever/SKILL.md) | Build the tool that performs or proves non-trivial work. |
| [Model the domain](./skills/principle-model-the-domain/SKILL.md) | Encode domain rules in a structure instead of scattered conditionals. |
| [Boundary discipline](./skills/principle-boundary-discipline/SKILL.md) | Validate at system boundaries and keep internal logic typed and direct. |
| [Type-system discipline](./skills/principle-type-system-discipline/SKILL.md) | Make illegal states unrepresentable and derive types from authoritative data. |
| [Make operations idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | Make partial reruns converge on the same end state. |
| [Migrate callers, then delete legacy APIs](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | Move callers and remove the old API in the same change wave. |
| [Separate before serializing shared state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | Remove sharing first. Serialize only when one shared writer is a real invariant. |
| [Prove it works](./skills/principle-prove-it-works/SKILL.md) | Verify the actual artifact instead of trusting a proxy or a self-report. |
| [Fix root causes](./skills/principle-fix-root-causes/SKILL.md) | Trace symptoms to their cause instead of adding guards that hide them. |
| [Sequence verifiable units](./skills/principle-sequence-verifiable-units/SKILL.md) | Break multi-step work into small units and verify each before continuing. |
| [Guard the context window](./skills/principle-guard-the-context-window/SKILL.md) | Route bulk work to subagents and keep summaries in the main thread. |
| [Never block on the human](./skills/principle-never-block-on-the-human/SKILL.md) | Proceed when the next step is reversible and let the human course-correct later. |
| [Encode lessons in structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | Put durable rules in metadata, scripts, checks, or runtime behavior. |

## Models and harnesses

pstack uses the active harness's capabilities instead of requiring a custom agent-file format. It uses native plans, todos, subagents, background execution, recurring work, and browser or connector tools when the harness exposes them. A missing capability narrows the workflow. It does not block the task.

Run [`setup-pstack`](./skills/setup-pstack/SKILL.md) once per harness when you want overrides. It writes `~/.agents/pstack/models/<harness>.md`. A missing role inherits the parent model. Use only model identifiers that the active harness confirms.

The [`pstack-harness`](./skills/pstack-harness/SKILL.md) skill owns the adapter rules. Read it before using model overrides, delegation, questions, recurring work, transcripts, or surface-driving tools.

## Guide and maintenance

Read [the guide](./docs/guide/README.md) for a first task and the full workflow.

Before opening a change, run:

```bash
npm run check
npm test
scripts/install.sh --dry-run
```

The first two commands validate the package and skills. The last command checks the legacy installer without writing to your home directory. Use it because the installer is still part of the fallback path, not because Agent Plugins clients need it.

Read [`UPSTREAM.md`](./UPSTREAM.md) before importing changes from the original Cursor repository. Keep client-specific behavior out of the portable skills unless the harness adapter owns it.

## License

MIT
