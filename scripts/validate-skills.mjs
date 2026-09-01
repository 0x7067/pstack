#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const profilePath = join(root, "profiles", "pstack-lite.json");
const agentPluginManifestPath = join(root, "plugin.json");
const agentPluginSchemaUrl = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const agentPluginSchemaPath = join(root, "schemas", "1.0.0", "plugin.schema.json");
const manifestFixturePath = join(root, "tests", "fixtures", "plugin-missing-required-name.json");
const legacyPolicyPath = join(root, "scripts", "legacy-disabled-skills.txt");
const errors = [];
const fail = (path, message) => errors.push(`${relative(root, path)}: ${message}`);
const agentSkillFields = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

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

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

function characterLength(value) {
	return [...value].length;
}

function stripYamlComment(raw) {
	let quote = null;
	for (let index = 0; index < raw.length; index += 1) {
		const character = raw[index];
		if (quote === "\"" && character === "\\") {
			index += 1;
			continue;
		}
		if (quote === "'" && character === "'" && raw[index + 1] === "'") {
			index += 1;
			continue;
		}
		if ((character === "\"" || character === "'") && !quote) {
			quote = character;
			continue;
		}
		if (character === quote) {
			quote = null;
			continue;
		}
		if (character === "#" && (index === 0 || /\s/.test(raw[index - 1]))) {
			return raw.slice(0, index).trimEnd();
		}
	}
	return raw.trim();
}

function splitYamlFlowItems(raw, path, lineNumber) {
	const items = [];
	let start = 0;
	let depth = 0;
	let quote = null;
	for (let index = 0; index < raw.length; index += 1) {
		const character = raw[index];
		if (quote === "\"" && character === "\\") {
			index += 1;
			continue;
		}
		if (quote === "'" && character === "'" && raw[index + 1] === "'") {
			index += 1;
			continue;
		}
		if ((character === "\"" || character === "'") && !quote) {
			quote = character;
			continue;
		}
		if (character === quote) {
			quote = null;
			continue;
		}
		if (character === "{" || character === "[") depth += 1;
		if (character === "}" || character === "]") depth -= 1;
		if (character === "," && depth === 0) {
			const item = raw.slice(start, index).trim();
			if (item === "") fail(path, `empty flow-style YAML item on line ${lineNumber}`);
			else items.push(item);
			start = index + 1;
		}
	}
	if (quote || depth !== 0) {
		fail(path, `invalid flow-style YAML value on line ${lineNumber}`);
		return [];
	}
	const finalItem = raw.slice(start).trim();
	if (finalItem !== "") items.push(finalItem);
	return items;
}

function parseYamlFlowMapping(value, path, lineNumber) {
	if (!value.endsWith("}")) {
		fail(path, `invalid flow-style YAML value on line ${lineNumber}`);
		return undefined;
	}
	const mapping = Object.create(null);
	const inner = value.slice(1, -1).trim();
	if (inner === "") return mapping;
	for (const item of splitYamlFlowItems(inner, path, lineNumber)) {
		let separator = -1;
		let quote = null;
		let depth = 0;
		for (let index = 0; index < item.length; index += 1) {
			const character = item[index];
			if (quote === "\"" && character === "\\") {
				index += 1;
				continue;
			}
			if (quote === "'" && character === "'" && item[index + 1] === "'") {
				index += 1;
				continue;
			}
			if ((character === "\"" || character === "'") && !quote) {
				quote = character;
				continue;
			}
			if (character === quote) {
				quote = null;
				continue;
			}
			if (character === "{" || character === "[") depth += 1;
			if (character === "}" || character === "]") depth -= 1;
			if (character === ":" && depth === 0) {
				separator = index;
				break;
			}
		}
		if (separator === -1) {
			fail(path, `invalid flow-style YAML mapping on line ${lineNumber}`);
			continue;
		}
		const key = parseYamlScalar(item.slice(0, separator), path, lineNumber);
		if (typeof key !== "string" || key === "") {
			fail(path, `flow-style YAML mapping key must be a string on line ${lineNumber}`);
			continue;
		}
		if (hasOwn(mapping, key)) fail(path, `duplicate metadata field ${key}`);
		mapping[key] = parseYamlScalar(item.slice(separator + 1), path, lineNumber);
	}
	return mapping;
}

function parseYamlScalar(raw, path, lineNumber) {
	const value = stripYamlComment(raw);
	if (value === "") return null;
	if (value.startsWith("\"")) {
		if (!value.endsWith("\"")) {
			fail(path, `invalid double-quoted YAML value on line ${lineNumber}`);
			return undefined;
		}
		try {
			return JSON.parse(value);
		} catch (error) {
			fail(path, `invalid double-quoted YAML value on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}
	if (value.startsWith("'")) {
		if (!value.endsWith("'")) {
			fail(path, `invalid single-quoted YAML value on line ${lineNumber}`);
			return undefined;
		}
		return value.slice(1, -1).replace(/''/g, "'");
	}
	if (value.startsWith("{") || value.startsWith("[")) {
		if (value.startsWith("{")) return parseYamlFlowMapping(value, path, lineNumber);
		try {
			return JSON.parse(value);
		} catch (error) {
			fail(path, `invalid flow-style YAML value on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}
	if (value === "null" || value === "~") return null;
	if (value === "true") return true;
	if (value === "false") return false;
	if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) return Number(value);
	return value;
}

function parseBlockScalar(lines, start, end, marker, path) {
	const content = [];
	let minimumIndent = Infinity;
	let index = start;
	while (index < end) {
		const line = lines[index];
		if (line.trim() === "") {
			content.push("");
			index += 1;
			continue;
		}
		const indentMatch = line.match(/^[ \t]+/);
		if (!indentMatch) break;
		if (indentMatch[0].includes("\t")) {
			fail(path, `tabs are not valid YAML indentation on line ${index + 1}`);
		}
		minimumIndent = Math.min(minimumIndent, indentMatch[0].length);
		content.push(line);
		index += 1;
	}
	const indent = Number.isFinite(minimumIndent) ? minimumIndent : 0;
	const unindented = content.map((line) => line === "" ? "" : line.slice(indent));
	let value;
	if (marker.startsWith("|")) {
		value = unindented.join("\n");
	} else {
		value = "";
		for (const line of unindented) {
			if (value === "") value = line;
			else if (line === "" || value.endsWith("\n")) value += `\n${line}`;
			else value += ` ${line}`;
		}
	}
	if (!marker.endsWith("-")) value += "\n";
	if (marker.endsWith("+")) value += "\n";
	return { value, nextIndex: index };
}

function parseSkillFrontmatter(text, path) {
	const lines = text.split(/\r?\n/);
	if (lines[0] !== "---") {
		fail(path, "frontmatter must start on line 1");
		return null;
	}
	const end = lines.indexOf("---", 1);
	if (end === -1) {
		fail(path, "frontmatter has no closing delimiter");
		return null;
	}

	const fields = Object.create(null);
	let index = 1;
	while (index < end) {
		const line = lines[index];
		if (line.trim() === "" || /^\s*#/.test(line)) {
			index += 1;
			continue;
		}
		if (/^\s/.test(line)) {
			fail(path, `unexpected indentation in frontmatter on line ${index + 1}`);
			index += 1;
			continue;
		}
		const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):(?:[ \t]*(.*))?$/);
		if (!match) {
			fail(path, `invalid YAML mapping entry on line ${index + 1}`);
			index += 1;
			continue;
		}
		const key = match[1];
		if (hasOwn(fields, key)) fail(path, `duplicate frontmatter field ${key}`);
		const rawValue = match[2] ?? "";
		const cleanValue = stripYamlComment(rawValue);

		if (key === "metadata" && cleanValue === "") {
			const metadata = Object.create(null);
			index += 1;
			while (index < end) {
				const nestedLine = lines[index];
				if (nestedLine.trim() === "" || /^\s*#/.test(nestedLine)) {
					index += 1;
					continue;
				}
				const nestedMatch = nestedLine.match(/^[ \t]+([^:#][^:]*):(?:[ \t]*(.*))?$/);
				if (!nestedMatch) {
					if (/^\s/.test(nestedLine)) fail(path, `invalid metadata mapping on line ${index + 1}`);
					break;
				}
				const metadataKey = nestedMatch[1].trim();
				if (!metadataKey) fail(path, `metadata key is empty on line ${index + 1}`);
				if (hasOwn(metadata, metadataKey)) fail(path, `duplicate metadata field ${metadataKey}`);
				metadata[metadataKey] = parseYamlScalar(nestedMatch[2] ?? "", path, index + 1);
				index += 1;
			}
			fields[key] = metadata;
			continue;
		}

		if (/^[|>][+-]?$/.test(cleanValue)) {
			const block = parseBlockScalar(lines, index + 1, end, cleanValue, path);
			fields[key] = block.value;
			index = block.nextIndex;
			continue;
		}
		fields[key] = parseYamlScalar(rawValue, path, index + 1);
		index += 1;
	}
	return fields;
}

function validateSkillFrontmatter(skillsDir) {
	const skillDirs = skillDirsIn(skillsDir);
	for (const directoryName of skillDirs) {
		const path = join(skillsDir, directoryName, "SKILL.md");
		const fields = parseSkillFrontmatter(readFileSync(path, "utf8"), path);
		if (!fields) continue;
		for (const field of Object.keys(fields)) {
			if (!agentSkillFields.has(field)) fail(path, `unsupported Agent Skills frontmatter field ${field}`);
		}

		if (!hasOwn(fields, "name")) fail(path, "frontmatter requires name");
		if (!hasOwn(fields, "description")) fail(path, "frontmatter requires description");
		const name = fields.name;
		const description = fields.description;
		if (typeof name !== "string" || name.length === 0) fail(path, "name must be a non-empty string");
		if (typeof description !== "string" || description.length === 0) fail(path, "description must be a non-empty string");
		if (typeof name === "string" && name !== directoryName) fail(path, `name ${name} must match directory ${directoryName}`);
		if (typeof name === "string" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail(path, `invalid Agent Skills name ${name}`);
		if (typeof name === "string" && characterLength(name) > 64) fail(path, "name exceeds 64 characters");
		if (typeof description === "string" && characterLength(description) > 1024) fail(path, "description exceeds 1024 characters");
		if (hasOwn(fields, "license") && typeof fields.license !== "string") fail(path, "license must be a string");
		if (hasOwn(fields, "compatibility")) {
			if (typeof fields.compatibility !== "string" || characterLength(fields.compatibility) === 0 || characterLength(fields.compatibility) > 500) {
				fail(path, "compatibility must be a 1-500 character string");
			}
		}
		if (hasOwn(fields, "allowed-tools") && typeof fields["allowed-tools"] !== "string") {
			fail(path, "allowed-tools must be a string");
		}
		if (hasOwn(fields, "metadata")) {
			const metadata = fields.metadata;
			if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) fail(path, "metadata must be a mapping");
			else for (const [key, value] of Object.entries(metadata)) {
				if (typeof value !== "string") fail(path, `metadata.${key} must be a string`);
			}
		}
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

function jsonType(value) {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function resolveJsonPointer(document, reference) {
	if (reference === "#") return document;
	if (!reference.startsWith("#/")) return undefined;
	let value = document;
	for (const part of reference.slice(2).split("/")) {
		const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
		if (!value || typeof value !== "object" || !hasOwn(value, key)) return undefined;
		value = value[key];
	}
	return value;
}

function validateJsonSchema(value, schema, location = "$", rootSchema = schema) {
	const issues = [];
	if (!schema || typeof schema !== "object") return [{ path: location, message: "schema node is not an object" }];
	if (schema.$ref) {
		const target = resolveJsonPointer(rootSchema, schema.$ref);
		if (target === undefined) return [{ path: location, message: `unresolved schema reference ${schema.$ref}` }];
		return validateJsonSchema(value, target, location, rootSchema);
	}
	if (hasOwn(schema, "const") && !sameJson(value, schema.const)) {
		issues.push({ path: location, message: `must equal ${JSON.stringify(schema.const)}` });
	}
	if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => sameJson(value, candidate))) {
		issues.push({ path: location, message: "must equal one of the allowed values" });
	}
	if (schema.type) {
		const types = Array.isArray(schema.type) ? schema.type : [schema.type];
		if (!types.includes(jsonType(value))) {
			issues.push({ path: location, message: `must be ${types.join(" or ")}, got ${jsonType(value)}` });
			return issues;
		}
	}
	if (Array.isArray(schema.anyOf)) {
		const matched = schema.anyOf.some((candidate) => validateJsonSchema(value, candidate, location, rootSchema).length === 0);
		if (!matched) issues.push({ path: location, message: "must satisfy one schema in anyOf" });
	}
	if (Array.isArray(schema.oneOf)) {
		const matches = schema.oneOf.filter((candidate) => validateJsonSchema(value, candidate, location, rootSchema).length === 0).length;
		if (matches !== 1) issues.push({ path: location, message: "must satisfy exactly one schema in oneOf" });
	}
	if (schema.not && validateJsonSchema(value, schema.not, location, rootSchema).length === 0) {
		issues.push({ path: location, message: "must not satisfy the nested schema" });
	}
	if (typeof value === "string") {
		if (typeof schema.minLength === "number" && value.length < schema.minLength) issues.push({ path: location, message: `must have at least ${schema.minLength} characters` });
		if (typeof schema.maxLength === "number" && value.length > schema.maxLength) issues.push({ path: location, message: `must have at most ${schema.maxLength} characters` });
		if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) issues.push({ path: location, message: `must match ${schema.pattern}` });
	}
	if (Array.isArray(value)) {
		if (schema.items && typeof schema.items === "object") {
			for (let index = 0; index < value.length; index += 1) {
				issues.push(...validateJsonSchema(value[index], schema.items, `${location}[${index}]`, rootSchema));
			}
		}
	}
	if (value && typeof value === "object" && !Array.isArray(value)) {
		if (Array.isArray(schema.required)) {
			for (const field of schema.required) {
				if (!hasOwn(value, field)) issues.push({ path: `${location}.${field}`, message: `required property ${field} is missing` });
			}
		}
		const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
		for (const [field, fieldValue] of Object.entries(value)) {
			if (hasOwn(properties, field)) {
				issues.push(...validateJsonSchema(fieldValue, properties[field], `${location}.${field}`, rootSchema));
			} else if (schema.additionalProperties === false) {
				issues.push({ path: `${location}.${field}`, message: "property is not allowed" });
			} else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
				issues.push(...validateJsonSchema(fieldValue, schema.additionalProperties, `${location}.${field}`, rootSchema));
			}
		}
	}
	return issues;
}

function loadAgentPluginSchema() {
	if (!existsSync(agentPluginSchemaPath)) {
		fail(agentPluginSchemaPath, "published Agent Plugins schema fixture is missing");
		return null;
	}
	const schema = readJson(agentPluginSchemaPath);
	if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
		fail(agentPluginSchemaPath, "published Agent Plugins schema fixture must be an object");
		return null;
	}
	if (schema.$id !== agentPluginSchemaUrl) fail(agentPluginSchemaPath, `$id must be ${agentPluginSchemaUrl}`);
	return schema;
}

function validateAgentPluginManifest() {
	const path = agentPluginManifestPath;
	const schema = loadAgentPluginSchema();
	if (!existsSync(path)) {
		fail(path, "Agent Plugins manifest is missing");
		return { manifest: null, schema };
	}
	if (!statSync(path).isFile()) {
		fail(path, "Agent Plugins manifest must be a regular file");
		return { manifest: null, schema };
	}
	const manifest = readJson(path);
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
		fail(path, "manifest must be a JSON object");
		return { manifest: null, schema };
	}
	if (schema) {
		for (const issue of validateJsonSchema(manifest, schema)) {
			fail(path, `schema violation at ${issue.path}: ${issue.message}`);
		}
	}
	if (manifest.name !== "pstack") fail(path, `name must be pstack, got ${manifest.name}`);
	return { manifest, schema };
}

function validateManifestRegressionFixture(schema) {
	if (!schema || !existsSync(manifestFixturePath)) {
		if (!existsSync(manifestFixturePath)) fail(manifestFixturePath, "manifest schema regression fixture is missing");
		return;
	}
	const fixture = readJson(manifestFixturePath);
	if (!fixture) return;
	const issues = validateJsonSchema(fixture, schema);
	if (!issues.some((issue) => issue.message === "required property name is missing")) {
		fail(manifestFixturePath, "schema regression fixture must fail for missing required name");
	}
}

function validateRootPackageLayout(manifest) {
	const path = join(root, "package.json");
	const pkg = readJson(path);
	if (!pkg) return;
	if (pkg.name !== "@0x7067/pstack") fail(path, `name ${pkg.name} must stay @0x7067/pstack`);
	if (pkg.private !== true) fail(path, "private must be true; this is a Git-installed Pi package, not an npm publication");
	if (!manifest || pkg.version !== manifest.version) fail(path, `version ${pkg.version} must match plugin.json version ${manifest?.version}`);
	const skills = pkg.pi?.skills;
	if (!Array.isArray(skills) || skills.length !== 1 || skills[0] !== "./skills") {
		fail(path, "pi.skills must be [\"./skills\"]");
	}
	if (!Array.isArray(pkg.keywords) || !pkg.keywords.includes("pi-package")) {
		fail(path, "keywords must include pi-package");
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes("plugin.json")) {
		fail(path, "files must include plugin.json so the Agent Plugins manifest ships with the package");
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes("profiles")) {
		fail(path, "files must include profiles so the Pi settings presets ship with the package");
	}
	if (!Array.isArray(pkg.files) || !pkg.files.includes("schemas")) {
		fail(path, "files must include schemas so the published Agent Plugins schema fixture ships with the package");
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
	if (selected.has("poteto-mode")) fail(profilePath, "pstack-lite must not select poteto-mode");
}

function validatePortableLayout() {
	for (const relativePath of [".cursor-plugin", "agents", "automations"]) {
		const path = join(root, relativePath);
		if (existsSync(path)) fail(path, "portable fork must not include Cursor-only packaging or automation");
	}
}

function readLegacyPolicy() {
	if (!existsSync(legacyPolicyPath)) {
		fail(legacyPolicyPath, "legacy invocation policy is missing");
		return [];
	}
	const names = [];
	for (const line of readFileSync(legacyPolicyPath, "utf8").split(/\r?\n/)) {
		const name = line.trim();
		if (!name || name.startsWith("#")) continue;
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail(legacyPolicyPath, `invalid legacy skill name ${name}`);
		if (names.includes(name)) fail(legacyPolicyPath, `duplicate legacy skill name ${name}`);
		names.push(name);
	}
	return names;
}

function frontmatterField(text, field) {
	const lines = text.split(/\r?\n/);
	if (lines[0] !== "---") return undefined;
	const end = lines.indexOf("---", 1);
	if (end === -1) return undefined;
	for (let index = 1; index < end; index += 1) {
		const match = lines[index].match(new RegExp(`^${field.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:\\s*(.*)$`));
		if (match) return parseYamlScalar(match[1], "legacy installer output", index + 1);
	}
	return undefined;
}

function validateLegacyInstallScript(skillDirs) {
	const path = join(root, "scripts", "install.sh");
	if (!existsSync(path)) return;
	const legacyDisabledSkills = readLegacyPolicy();
	for (const name of legacyDisabledSkills) {
		if (!skillDirs.includes(name)) fail(legacyPolicyPath, `legacy policy references missing canonical skill ${name}`);
	}

	const sandbox = mkdtempSync(join(tmpdir(), "pstack-install-"));
	const agentSkillsDir = join(sandbox, "agents", "skills");
	const claudeSkillsDir = join(sandbox, "claude", "skills");
	const env = {
		...process.env,
		PSTACK_AGENT_SKILLS_DIR: agentSkillsDir,
		PSTACK_CLAUDE_SKILLS_DIR: claudeSkillsDir,
	};
	const resolvedOrSelf = (candidate) => {
		try {
			return realpathSync(candidate);
		} catch {
			return candidate;
		}
	};
	try {
		let stdout;
		try {
			stdout = execFileSync(path, ["--dry-run"], { encoding: "utf8", env });
		} catch (error) {
			fail(path, `--dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}

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
			if (dirname(target) !== agentSkillsDir) fail(path, `--dry-run installs outside the agent skills directory: ${target}`);
		}

		try {
			execFileSync(path, [], { env, stdio: "ignore" });
		} catch (error) {
			fail(path, `real install failed: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		for (const name of skillDirs) {
			const installedSkill = join(agentSkillsDir, name, "SKILL.md");
			const claudeLink = join(claudeSkillsDir, name);
			if (!existsSync(installedSkill)) fail(path, `real install did not copy skills/${name}`);
			if (!existsSync(claudeLink) || !lstatSync(claudeLink).isSymbolicLink() || realpathSync(claudeLink) !== realpathSync(join(agentSkillsDir, name))) {
				fail(path, `real install did not link skills/${name} into Claude's directory`);
			}
		}
		for (const name of legacyDisabledSkills) {
			const value = frontmatterField(readFileSync(join(agentSkillsDir, name, "SKILL.md"), "utf8"), "disable-model-invocation");
			if (value !== true) fail(path, `legacy install did not restore automatic-invocation policy for ${name}`);
		}
		const legacyAutoInvokedValue = frontmatterField(readFileSync(join(agentSkillsDir, "unslop", "SKILL.md"), "utf8"), "disable-model-invocation");
		if (legacyAutoInvokedValue !== undefined) fail(path, "legacy install changed the automatic-invocation policy for unslop");
	} finally {
		rmSync(sandbox, { recursive: true, force: true });
	}
}

const skillDirs = validateSkillFrontmatter(skillsRoot);
const { manifest, schema } = validateAgentPluginManifest();
validateManifestRegressionFixture(schema);
validateRootPackageLayout(manifest);
validatePstackLiteProfile(skillDirs);
validatePortableLayout();
validateLegacyInstallScript(skillDirs);

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
