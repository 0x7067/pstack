#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const piLiteRoot = join(root, "pi-lite");
const piLiteSkillsRoot = join(piLiteRoot, "skills");
const errors = [];
const fail = (path, message) => errors.push(`${relative(root, path)}: ${message}`);

const copiedPiLiteSkills = [
	"why",
	"unslop",
	"pstack-harness",
	"how",
	"principle-prove-it-works",
	"principle-guard-the-context-window",
	"show-me-your-work",
];
const promotedPiLiteSkills = ["pause-safely", "hillclimb", "session-pickup"];
const expectedPiLiteSkills = [...copiedPiLiteSkills, ...promotedPiLiteSkills].sort();
const forbiddenPiLiteSkills = ["poteto-mode"];

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
	const skills = pkg.pi?.skills;
	if (
		!Array.isArray(skills) ||
		skills.length !== 2 ||
		skills[0] !== "./skills" ||
		skills[1] !== "./pi-lite/skills"
	) {
		fail(path, "pi.skills must be [\"./skills\", \"./pi-lite/skills\"]");
	}
	if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
		fail(path, "keywords must include pi-package");
	}
}

function validatePiLitePackageLayout() {
	const path = join(piLiteRoot, "package.json");
	if (!existsSync(path)) {
		fail(path, "pi-lite package.json is missing");
		return;
	}
	const pkg = readJson(path);
	if (!pkg) return;
	if (pkg.name === "@0x7067/pstack") fail(path, "name must be distinct from the root package");
	if (pkg.name !== "@0x7067/pstack-pi-lite") fail(path, `name ${pkg.name} must be @0x7067/pstack-pi-lite`);
	if (pkg.private !== true) fail(path, "private must be true (no npm publish)");
	if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
		fail(path, "keywords must include pi-package");
	}
	if (pkg.pi?.extensions) fail(path, "must not declare a TypeScript extension");
	const skills = pkg.pi?.skills;
	if (!Array.isArray(skills) || skills.length !== 1 || skills[0] !== "./skills") {
		fail(path, "pi.skills must point at this package's ./skills, not the repo skills/");
	}
	if (existsSync(join(piLiteRoot, "extensions"))) fail(join(piLiteRoot, "extensions"), "must not ship a Pi extension");
	for (const file of filesUnder(piLiteRoot)) {
		if (file.endsWith(".ts") || file.endsWith(".js")) fail(file, "pi-lite must not include a TypeScript extension");
	}
}

function validatePiLiteSkillSet(skillDirs) {
	const missing = expectedPiLiteSkills.filter((name) => !skillDirs.includes(name));
	const extra = skillDirs.filter((name) => !expectedPiLiteSkills.includes(name));
	for (const name of missing) fail(join(piLiteSkillsRoot, name), "expected pi-lite skill is missing");
	for (const name of extra) fail(join(piLiteSkillsRoot, name), "unexpected skill; pi-lite is a closed subset");
	for (const name of forbiddenPiLiteSkills) {
		if (skillDirs.includes(name)) fail(join(piLiteSkillsRoot, name), "must not include poteto-mode or its catalog");
	}
	for (const name of copiedPiLiteSkills) {
		const source = join(skillsRoot, name);
		const dest = join(piLiteSkillsRoot, name);
		if (!existsSync(source)) {
			fail(source, "copied skill is missing from skills/");
			continue;
		}
		const sourceFiles = filesUnder(source).map((path) => relative(source, path)).sort();
		const destFiles = filesUnder(dest).map((path) => relative(dest, path)).sort();
		if (sourceFiles.join("\n") !== destFiles.join("\n")) {
			fail(dest, "copied skill tree file list must match skills/");
			continue;
		}
		for (const relativePath of sourceFiles) {
			const from = join(source, relativePath);
			const to = join(dest, relativePath);
			if (readFileSync(from, "utf8") !== readFileSync(to, "utf8")) {
				fail(to, "copied skill file must match skills/");
			}
		}
	}
	for (const name of promotedPiLiteSkills) {
		const playbook = join(skillsRoot, "poteto-mode", "playbooks", `${name}.md`);
		if (!existsSync(playbook)) fail(playbook, "original playbook must remain in skills/poteto-mode/playbooks/");
		const skill = join(piLiteSkillsRoot, name, "SKILL.md");
		if (!existsSync(skill)) fail(skill, "promoted playbook must ship as a Pi skill");
		const text = readFileSync(skill, "utf8");
		if (!text.includes("Do not require `/poteto-mode` first")) {
			fail(skill, "promoted skill must be standalone (not require /poteto-mode first)");
		}
		if (existsSync(join(skillsRoot, name, "SKILL.md"))) {
			fail(join(skillsRoot, name), "do not copy promotions into skills/");
		}
	}
}

function validateInstallDoesNotCopyPiLite() {
	const path = join(root, "scripts", "install.sh");
	const text = readFileSync(path, "utf8");
	if (!text.includes('script_dir/../skills')) fail(path, "must copy repo skills/, not another tree");
	if (/source_dir=.*pi-lite/.test(text)) fail(path, "must never copy pi-lite/ into ~/.agents/skills");
}

const skillDirs = validateSkillFrontmatter(skillsRoot);
const piLiteSkillDirs = validateSkillFrontmatter(piLiteSkillsRoot);
validateRootPackageLayout();
validatePiLitePackageLayout();
validatePiLiteSkillSet(piLiteSkillDirs);
validateInstallDoesNotCopyPiLite();

const skillMarkdownFiles = [
	...filesUnder(skillsRoot),
	...(existsSync(piLiteSkillsRoot) ? filesUnder(piLiteSkillsRoot) : []),
].filter((path) => path.endsWith(".md"));
const documentationFiles = [
	join(root, "README.md"),
	join(piLiteRoot, "README.md"),
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
	`validated ${skillDirs.length} skills, ${piLiteSkillDirs.length} pi-lite skills, and ${skillMarkdownFiles.length + documentationFiles.length} markdown files`,
);
