#!/usr/bin/env bun
// Reject Pi settings that consume pstack through more than one path.
// Usage: check-pi-consume-path.mjs [settings.json ...]
// Every listed file is one active Pi configuration: sources are pooled across
// all of them, because Pi loads the union and duplicate names collide there.
// Defaults to the Pi settings files a user is likely to have.
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const defaultSettingsPaths = [
	join(homedir(), ".pi", "settings.json"),
	join(process.cwd(), ".pi", "settings.json"),
];

function packageSourcesFromSettings(settings) {
	if (!settings || !Array.isArray(settings.packages)) return [];
	const sources = [];
	for (const entry of settings.packages) {
		if (typeof entry === "string") sources.push(entry);
		else if (entry && typeof entry === "object" && typeof entry.source === "string") sources.push(entry.source);
	}
	return sources;
}

function packageNameAt(path) {
	const manifest = join(path, "package.json");
	try {
		if (!statSync(path).isDirectory() || !existsSync(manifest)) return null;
		const name = JSON.parse(readFileSync(manifest, "utf8")).name;
		return typeof name === "string" ? name : null;
	} catch {
		return null;
	}
}

// "root" (the full pstack catalog) or "lite" (the nested pi-lite package).
// Local sources resolve against the settings file that lists them and are
// identified by package metadata, so an absolute checkout path is recognized
// as the root package; path shape is only the fallback for sources that are
// not on this machine.
function classifySource(source, settingsPath) {
	const normalized = source.trim().replaceAll("\\", "/");
	if (/^(?:git:|https?:\/\/)github\.com\/0x7067\/pstack(?:\.git)?(?:@|$)/i.test(normalized)) return "root";
	if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null;
	const name = packageNameAt(resolve(dirname(settingsPath), normalized));
	if (name === "@0x7067/pstack") return "root";
	if (name === "@0x7067/pstack-pi-lite") return "lite";
	if (name) return null;
	const path = normalized.replace(/\/+$/, "");
	if (/(^|\/)pi-lite$/.test(path)) return "lite";
	if (path === "." || /(^|\/)pstack$/.test(path)) return "root";
	return null;
}

function loadSources(path) {
	let settings;
	try {
		settings = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		return { error: `${path}: invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
	}
	const found = { root: [], lite: [] };
	for (const source of packageSourcesFromSettings(settings)) {
		const kind = classifySource(source, path);
		if (kind) found[kind].push(`${source} (${path})`);
	}
	return found;
}

const argumentPaths = process.argv.slice(2).map((path) => resolve(path));
const settingsPaths = (argumentPaths.length ? argumentPaths : defaultSettingsPaths).filter((path) => {
	if (existsSync(path)) return true;
	if (argumentPaths.length) {
		console.error(`${path}: settings file not found`);
		process.exit(2);
	}
	return false;
});

const errors = [];
const root = [];
const lite = [];
for (const path of settingsPaths) {
	const result = loadSources(path);
	if (result.error) {
		errors.push(result.error);
		continue;
	}
	root.push(...result.root);
	lite.push(...result.lite);
}

if (root.length && lite.length) {
	errors.push(
		"refused: pstack is consumed twice across the active Pi settings.",
		...root.map((source) => `  root: ${source}`),
		...lite.map((source) => `  lite: ${source}`),
		"  pi-lite duplicates skill names from the root package; loading both loads those names twice.",
		"  Keep exactly one of the two sources.",
	);
}

if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(`checked ${settingsPaths.length} Pi settings file(s); one pstack consume path in total`);
