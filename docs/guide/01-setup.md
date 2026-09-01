# Set up pstack

In this page you install the skills, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the skills

The README's [Install section](../../README.md#install) owns the supported installation paths, including Agent Plugins-compatible clients and the legacy fallback. This page continues with Pi-specific setup below.

### Pi

```text
pi install git:github.com/0x7067/pstack
```

or from a local checkout:

```text
pi install .
```

then `/reload` so this session picks up the skills.

The README's [Pi install section](../../README.md#pi) owns the rest: how to switch to the smaller `pstack-lite` preset without loading the full package beside it, and what to do with the `~/.agents/skills` copies when you also use another harness.

## Pick your models

Run:

Invoke `setup-pstack` with your harness's skill syntax, or say `use the setup-pstack skill`.

[`setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models available in the active harness, shows you each role (code delegates, judgment, the review panels), and asks what you want. Run it once per harness. It writes `~/.agents/pstack/models/<harness>.md`, so incompatible model identifiers never leak between harnesses.

You only override what you care about. A role with no line inherits the parent model. To restore that behavior later, delete the role's line or run `setup-pstack` again.

Set a role to `inherit-parent` and pstack omits the model override, so the subagent inherits your parent chat model. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every swarm worker unless a race names a model for each arm.

## Accept the verification offer, or don't

At the end of setup, `setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.agents/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.

After setup, start a new chat if your harness does not reload the configuration live.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
use the poteto-mode skill. add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the plan or todo tracker. The first item is always "read the Principles section". The rest are the matched playbook's steps copied in, the Feature playbook for this prompt. If `poteto-mode` skips a step, the step stays in the tracker with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `poteto-mode` is sticky. It stays on for the conversation until you opt out by saying so.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).
