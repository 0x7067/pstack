#!/usr/bin/env bun
// Reject Pi settings that consume pstack through more than one path.
// Usage: check-pi-consume-path.mjs [settings.json ...]
// Defaults to the Pi settings files a user is likely to have.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

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

function isRootPstackSource(source) {
	const normalized = source.trim().replaceAll("\\", "/");
	if (/^(?:git:|https?:\/\/)github\.com\/0x7067\/pstack(?:\.git)?(?:@|$)/i.test(normalized)) return true;
	return normalized === "." || normalized === "./";
}

function isPiLiteSource(source) {
	if (isRootPstackSource(source)) return false;
	const normalized = source.trim().replaceAll("\\", "/").replace(/\/+$/, "");
	return /(^|\/)pi-lite$/.test(normalized);
}

function conflictingSources(sources) {
	const root = sources.filter(isRootPstackSource);
	const lite = sources.filter(isPiLiteSource);
	if (root.length === 0 || lite.length === 0) return null;
	return { root, lite };
}

function checkSettingsFile(path) {
	let settings;
	try {
		settings = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		return [`${path}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
	}
	const conflict = conflictingSources(packageSourcesFromSettings(settings));
	if (!conflict) return [];
	return [
		`${path}: refused: pstack is consumed twice (${conflict.root.join(", ")} and ${conflict.lite.join(", ")}).`,
		"  pi-lite duplicates skill names from the root package; loading both loads those names twice.",
		"  Keep exactly one of the two sources.",
	];
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

const problems = settingsPaths.flatMap(checkSettingsFile);
if (problems.length) {
	console.error(problems.join("\n"));
	process.exit(1);
}

console.log(`checked ${settingsPaths.length} Pi settings file(s); one pstack consume path each`);
