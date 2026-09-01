#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const profilePath = join(root, "profiles", "pstack-lite.json");
const errors = [];
const fail = (path, message) => errors.push(`${relative(root, path)}: ${message}`);

const pstackLiteProfileSkills = [
	"how",
	"hillclimb",
	"pause-safely",
	"principle-guard-the-context-window",
	"principle-prove-it-works",
	"pstack-harness",
	"session-pickup",
	"show-me-your-work",
	"unslop",
	"why",
].sort();

function filesUnder(path) {
	const files = [];
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === ".git") continue;
		const child = join(path, entry.name);
		if (entry.isDirectory()) files.push(...filesUnder(child));
		else if (entry.isFile()) files.push(child);
	}
	return files;
}

function skillDirsIn(skillsDir) {
	if (!existsSync(skillsDir)) return [];
	return readdirSync(skillsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md")))
		.map((entry) => entry.name)
		.sort();
}

function validateSkillFrontmatter(skillsDir) {
	const skillDirs = skillDirsIn(skillsDir);
	for (const directoryName of skillDirs) {
		const path = join(skillsDir, directoryName, "SKILL.md");
		const text = readFileSync(path, "utf8");
		const lines = text.split(/\r?\n/);
		if (lines[0] !== "---") {
			fail(path, "frontmatter must start on line 1");
			continue;
		}
		const end = lines.indexOf("---", 1);
		if (end === -1) {
			fail(path, "frontmatter has no closing delimiter");
			continue;
		}
		const fields = new Map();
		for (const line of lines.slice(1, end)) {
			const match = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
			if (match) fields.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
		}
		const name = fields.get("name");
		const description = fields.get("description");
		if (!name) fail(path, "frontmatter requires name");
		if (!description) fail(path, "frontmatter requires description");
		if (name && name !== directoryName) fail(path, `name ${name} must match directory ${directoryName}`);
		if (name && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail(path, `invalid Agent Skills name ${name}`);
		if (name && name.length > 64) fail(path, "name exceeds 64 characters");
	}
	return skillDirs;
}

function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		fail(path, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

function validateRootPackageLayout() {
	const path = join(root, "package.json");
	const pkg = readJson(path);
	if (!pkg) return;
	if (pkg.name !== "@0x7067/pstack") fail(path, `name ${pkg.name} must stay @0x7067/pstack`);
	if (pkg.private !== true) fail(path, "private must be true; this is a Git-installed Pi package, not an npm publication");
	const skills = pkg.pi?.skills;
	if (!Array.isArray(skills) || skills.length !== 1 || skills[0] !== "./skills") {
		fail(path, "pi.skills must be [\"./skills\"]");
	}
	if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
		fail(path, "keywords must include pi-package");
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes("profiles")) {
		fail(path, "files must include profiles so the Pi settings presets ship with the package");
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes("UPSTREAM.md")) {
		fail(path, "files must include UPSTREAM.md so the fork boundary ships with the package");
	}
}

function validatePstackLiteProfile(skillDirs) {
	if (!existsSync(profilePath)) {
		fail(profilePath, "pstack-lite profile is missing");
		return;
	}
	const profile = readJson(profilePath);
	if (!profile) return;
	if (!Array.isArray(profile.packages) || profile.packages.length !== 1) {
		fail(profilePath, "packages must contain one filtered root-package entry");
		return;
	}
	const entry = profile.packages[0];
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		fail(profilePath, "the profile package entry must be an object");
		return;
	}
	if (typeof entry.source !== "string" || !/^git:github\.com\/0x7067\/pstack(?:@[^/]+)?$/.test(entry.source)) {
		fail(profilePath, "source must be the root git:github.com/0x7067/pstack package");
	}
	for (const resourceType of ["extensions", "prompts", "themes"]) {
		if (!Array.isArray(entry[resourceType]) || entry[resourceType].length !== 0) {
			fail(profilePath, `${resourceType} must be [] in the skills-only profile`);
		}
	}
	if (!Array.isArray(entry.skills) || entry.skills.some((pattern) => typeof pattern !== "string")) {
		fail(profilePath, "skills must be an array of package-relative patterns");
		return;
	}
	for (const name of pstackLiteProfileSkills) {
		if (!skillDirs.includes(name)) fail(join(skillsRoot, name), "pstack-lite profile references a missing canonical skill");
	}

	const selected = new Set();
	for (const pattern of entry.skills) {
		const matched = skillDirs.filter((name) => matchesGlob(`skills/${name}/SKILL.md`, pattern));
		if (matched.length === 0) fail(profilePath, `skills pattern ${pattern} selects no canonical skill under skills/`);
		for (const name of matched) selected.add(name);
	}
	const expected = new Set(pstackLiteProfileSkills.filter((name) => skillDirs.includes(name)));
	const missing = [...expected].filter((name) => !selected.has(name));
	const extra = [...selected].filter((name) => !expected.has(name)).sort();
	if (missing.length) fail(profilePath, `skills must select the canonical pstack-lite skills, but misses ${missing.join(", ")}`);
	if (extra.length) fail(profilePath, `skills must not select beyond pstack-lite, but also selects ${extra.join(", ")}`);
	if (selected.has("poteto-mode")) {
		fail(profilePath, "pstack-lite must not select poteto-mode");
	}
}

function validatePortableLayout() {
	for (const relativePath of [".cursor-plugin", "agents", "automations"]) {
		const path = join(root, relativePath);
		if (existsSync(path)) fail(path, "portable fork must not include Cursor-only packaging or automation");
	}
}

function validateInstallScript(skillDirs) {
	const path = join(root, "scripts", "install.sh");
	if (!existsSync(path)) return;

	const sandbox = mkdtempSync(join(tmpdir(), "pstack-install-"));
	const agentSkillsDir = join(sandbox, "agents", "skills");
	const claudeSkillsDir = join(sandbox, "claude", "skills");
	let stdout;
	try {
		stdout = execFileSync(path, ["--dry-run"], {
			encoding: "utf8",
			env: {
				...process.env,
				PSTACK_AGENT_SKILLS_DIR: agentSkillsDir,
				PSTACK_CLAUDE_SKILLS_DIR: claudeSkillsDir,
			},
		});
	} catch (error) {
		fail(path, `--dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
		return;
	} finally {
		rmSync(sandbox, { recursive: true, force: true });
	}

	const resolvedOrSelf = (candidate) => {
		try {
			return realpathSync(candidate);
		} catch {
			return candidate;
		}
	};

	const copies = new Map();
	const links = new Map();
	for (const line of stdout.split(/\r?\n/)) {
		const match = line.match(/^(copy|link) (.+) -> (.+)$/);
		if (!match) continue;
		if (match[1] === "copy") copies.set(resolvedOrSelf(match[2]), match[3]);
		else links.set(match[2], match[3]);
	}

	const sourceRoot = realpathSync(skillsRoot);
	for (const name of skillDirs) {
		if (copies.get(join(sourceRoot, name)) !== join(agentSkillsDir, name)) {
			fail(path, `--dry-run does not install skills/${name} into the agent skills directory`);
		}
		if (links.get(join(claudeSkillsDir, name)) !== join(agentSkillsDir, name)) {
			fail(path, `--dry-run does not link skills/${name} into the Claude skills directory`);
		}
	}
	for (const [source, target] of copies) {
		if (dirname(source) !== sourceRoot || !existsSync(join(source, "SKILL.md"))) {
			fail(path, `--dry-run copies ${source}, which is not a canonical skill under skills/`);
		}
		if (dirname(target) !== agentSkillsDir) {
			fail(path, `--dry-run installs outside the agent skills directory: ${target}`);
		}
	}
}

const skillDirs = validateSkillFrontmatter(skillsRoot);
validateRootPackageLayout();
validatePstackLiteProfile(skillDirs);
validatePortableLayout();
validateInstallScript(skillDirs);

const skillMarkdownFiles = filesUnder(skillsRoot).filter((path) => path.endsWith(".md"));
const documentationFiles = [
	join(root, "README.md"),
	join(root, "UPSTREAM.md"),
	...filesUnder(join(root, "docs")),
].filter((path) => path.endsWith(".md"));
const forbidden = [
	[/~\/\.cursor|\.cursor\/skills/i, "Cursor-specific skill path"],
	[/subagent_type|generalPurpose/, "Cursor-specific subagent schema"],
	[/cursor-team-kit/i, "Cursor-only plugin dependency"],
	[/grok-4\.6|claude-fable|gpt-5\.6-sol|claude-opus/i, "hard-coded harness model identifier"],
];

for (const path of skillMarkdownFiles) {
	const text = readFileSync(path, "utf8");
	for (const [pattern, label] of forbidden) {
		if (pattern.test(text)) fail(path, label);
	}
}

for (const path of [...skillMarkdownFiles, ...documentationFiles]) {
	if (!existsSync(path)) {
		fail(path, "required markdown file is missing");
		continue;
	}
	const text = readFileSync(path, "utf8");
	for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
		let target = match[1].trim().replace(/^<|>$/g, "");
		if (/^(?:[a-z]+:|#)/i.test(target)) continue;
		target = target.split("#", 1)[0];
		if (!target) continue;
		const resolved = resolve(dirname(path), decodeURIComponent(target));
		if (!existsSync(resolved)) fail(path, `broken relative link ${match[1]}`);
	}
}

for (const relativePath of ["scripts/install.sh", "scripts/validate-skills.mjs"]) {
	const path = join(root, relativePath);
	if (!existsSync(path)) fail(path, "required script is missing");
	else if (!(statSync(path).mode & 0o111)) fail(path, "script must be executable");
}

if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(
	`validated ${skillDirs.length} skills and pstack-lite profile (${pstackLiteProfileSkills.length} skills), plus ${skillMarkdownFiles.length + documentationFiles.length} markdown files`,
);
