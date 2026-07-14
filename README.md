# zikr-cli

Adds a small instruction to your AI coding assistant so it naturally weaves in
a zikr (Bismillah, Alhamdulillah, InsyaAllah, etc.) depending on context —
starting a task, something working, a mistake, a warning, and so on.

Works with any of these, if installed on your machine:
- **Claude Code**
- **Codex CLI**
- **OpenCode**

It only touches one clearly-marked block in each tool's global instruction
file — nothing else in those files is read, reordered, or removed.

## Quickstart

```bash
npx zikr-cli              # installs into every supported CLI it finds
npx zikr-cli --status     # check what's installed, makes no changes
npx zikr-cli --uninstall  # removes it again
```

`bunx zikr-cli` works the same way if you use Bun.

No install step, no dependencies pulled in beyond Node itself, and the tool
skips (doesn't error) any CLI it doesn't find on your `PATH`.

## What it actually does

For each tool it finds, it opens (or creates) this file:

| Tool        | File                            |
|-------------|----------------------------------|
| Claude Code | `~/.claude/CLAUDE.md`            |
| Codex CLI   | `~/.codex/AGENTS.md`             |
| OpenCode    | `~/.config/opencode/AGENTS.md`   |

...and inserts the contents of **[`zikr-instruction.md`](./zikr-instruction.md)**,
wrapped in marker comments so it can be found and replaced cleanly later.

That file is the single source of truth for the instruction text — the
script reads it at runtime rather than hardcoding a copy, so this README
never goes stale. Want to change the wording or the zikr mapping? Edit
`zikr-instruction.md` and every future install/uninstall picks it up
automatically — no need to touch the script or this README.

Running the install command again just replaces the block in place — safe to
re-run any time, it won't duplicate itself.

## Don't want to run a script? Do it by hand

That's completely fine — it's plain Markdown, no build step, no side effects.
Just open the relevant file from the table above in any text editor:

**To install:** paste the block shown above at the end of the file.

**To uninstall:** delete everything from the line containing
`zikr-instruction:start` down through the line containing
`zikr-instruction:end`, then save. That's the entire uninstall — there's no
other trace left anywhere on your system.

## Uninstall didn't work automatically?

Run `npx zikr-cli --uninstall` again — if it hit a permissions error or an
unusual file layout, it prints the exact manual steps for that specific file
right in the terminal output. Or just do the manual removal above; it's the
same two-line edit either way.

## Why this is safe to run

- Only ever touches the one marked block — verified by tests that pre-existing
  content in the file survives install and uninstall untouched.
- No network calls, no telemetry, no dependencies beyond Node's built-in
  modules.
- Detection is based on whether `claude`, `codex`, or `opencode` actually run
  on your machine (`<cmd> --version`) — it never guesses or assumes an install
  path.
- Read the ~150 lines of `bin/zikr.js` yourself before trusting it — that's
  the point of keeping it dependency-free and small.

## License

MIT
