#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const errors = [];
const fail = (path, message) => errors.push(`${relative(root, path)}: ${message}`);

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

const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && existsSync(join(skillsRoot, entry.name, "SKILL.md")))
	.map((entry) => entry.name)
	.sort();

for (const directoryName of skillDirs) {
	const path = join(skillsRoot, directoryName, "SKILL.md");
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

const skillMarkdownFiles = filesUnder(skillsRoot).filter((path) => path.endsWith(".md"));
const documentationFiles = [join(root, "README.md"), ...filesUnder(join(root, "docs"))].filter((path) => path.endsWith(".md"));
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

console.log(`validated ${skillDirs.length} skills and ${skillMarkdownFiles.length + documentationFiles.length} markdown files`);
