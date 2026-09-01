#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# Legacy compatibility installer for clients that do not support Agent Plugins
# and only load skills from user directories.
source_dir=$(cd "$script_dir/../skills" && pwd)
agent_skills_dir=${PSTACK_AGENT_SKILLS_DIR:-"$HOME/.agents/skills"}
claude_skills_dir=${PSTACK_CLAUDE_SKILLS_DIR:-"$HOME/.claude/skills"}
dry_run=false
legacy_policy_path="$script_dir/legacy-disabled-skills.txt"

if [ ! -f "$legacy_policy_path" ]; then
	echo "missing legacy invocation policy: $legacy_policy_path" >&2
	exit 1
fi

if [ "${1:-}" = "--dry-run" ]; then
	dry_run=true
elif [ "$#" -gt 0 ]; then
	echo "usage: scripts/install.sh [--dry-run]" >&2
	exit 2
fi

case "$agent_skills_dir" in
	""|/|"$HOME") echo "unsafe agent skills destination: $agent_skills_dir" >&2; exit 1 ;;
esac
case "$claude_skills_dir" in
	""|/|"$HOME") echo "unsafe Claude skills destination: $claude_skills_dir" >&2; exit 1 ;;
esac

restore_legacy_invocation_policy() {
	local skill_file=$1
	local temporary_file
	temporary_file=$(mktemp "${skill_file}.XXXXXX")
	if ! awk '
		NR == 1 && $0 == "---" { in_frontmatter = 1; print; next }
		in_frontmatter && $0 ~ /^[[:space:]]*disable-model-invocation:[[:space:]]*true[[:space:]]*$/ { has_policy = 1 }
		in_frontmatter && $0 == "---" {
			if (!has_policy) print "disable-model-invocation: true"
			in_frontmatter = 0
			closed = 1
			print
			next
		}
		{ print }
		END { if (!closed) exit 1 }
	' "$skill_file" > "$temporary_file"; then
		rm -f "$temporary_file"
		echo "invalid skill frontmatter: $skill_file" >&2
		return 1
	fi
	cat "$temporary_file" > "$skill_file"
	rm -f "$temporary_file"
}

skill_dirs=()
while IFS= read -r skill_dir; do
	skill_dirs+=("$skill_dir")
done < <(find "$source_dir" -mindepth 1 -maxdepth 1 -type d -exec test -f '{}/SKILL.md' ';' -print | sort)
if [ "${#skill_dirs[@]}" -eq 0 ]; then
	echo "no skills found under $source_dir" >&2
	exit 1
fi

for skill_dir in "${skill_dirs[@]}"; do
	name=${skill_dir##*/}
	target="$agent_skills_dir/$name"
	claude_link="$claude_skills_dir/$name"
	if [ -L "$target" ]; then
		echo "refusing to replace symlinked source-of-truth target: $target" >&2
		exit 1
	fi
	if [ -e "$claude_link" ] || [ -L "$claude_link" ]; then
		if [ ! -L "$claude_link" ] || [ "$(realpath "$claude_link" 2>/dev/null || true)" != "$(realpath "$target" 2>/dev/null || true)" ]; then
			echo "Claude skill collision: $claude_link" >&2
			exit 1
		fi
	fi
done

if $dry_run; then
	for skill_dir in "${skill_dirs[@]}"; do
		name=${skill_dir##*/}
		echo "copy $skill_dir -> $agent_skills_dir/$name"
		echo "link $claude_skills_dir/$name -> $agent_skills_dir/$name"
	done
	exit 0
fi

mkdir -p "$agent_skills_dir" "$claude_skills_dir"
for skill_dir in "${skill_dirs[@]}"; do
	name=${skill_dir##*/}
	target="$agent_skills_dir/$name"
	claude_link="$claude_skills_dir/$name"
	mkdir -p "$target"
	rsync -a --delete --exclude node_modules --exclude .DS_Store "$skill_dir/" "$target/"
	if grep -Fqx "$name" "$legacy_policy_path"; then
		restore_legacy_invocation_policy "$target/SKILL.md"
	fi
	if [ ! -L "$claude_link" ]; then
		ln -s "$target" "$claude_link"
	fi
done

echo "installed ${#skill_dirs[@]} pstack skills in $agent_skills_dir"
echo "linked ${#skill_dirs[@]} pstack skills in $claude_skills_dir"
