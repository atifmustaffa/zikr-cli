#!/usr/bin/env node

/**
 * zikr-cli
 * Installs/uninstalls a "zikr instruction" managed block into the global
 * instruction file of any detected AI coding CLI (Claude Code, Codex, OpenCode).
 *
 * Usage:
 *   npx zikr-cli            # install into every tool found on PATH
 *   npx zikr-cli --uninstall
 *   npx zikr-cli --status   # show what's installed where, no changes
 *
 * Design notes:
 * - Detection is done by trying to run `<cmd> --version`, not by guessing
 *   install paths. If the binary isn't on PATH, we skip it silently.
 * - Content is wrapped in HTML-comment markers so re-running install is
 *   idempotent (replaces the block in place) and uninstall is exact
 *   (removes only what we added, nothing else in the file).
 * - No third-party deps: only Node builtins. Works the same under
 *   `node`, `npx`, and `bunx`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const MARKER_START = '<!-- zikr-instruction:start (managed by zikr-cli, do not edit between markers) -->';
const MARKER_END = '<!-- zikr-instruction:end -->';

// The instruction text lives in zikr-instruction.md, one directory up from
// this script (repo/package root) - NOT hardcoded here. Update that file
// and every install/uninstall run picks up the change automatically; no
// need to touch this script or keep the README in sync by hand.
const CONTENT_PATH = path.join(__dirname, '..', 'zikr-instruction.md');

/** Loads the instruction text from zikr-instruction.md. Fails loudly if missing. */
function loadZikrBlock() {
  try {
    return fs.readFileSync(CONTENT_PATH, 'utf8').trim();
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `couldn't find zikr-instruction.md at ${CONTENT_PATH}. ` +
        `If you're developing locally, make sure it sits next to package.json.`
      );
    }
    throw err;
  }
}

const ZIKR_BLOCK = loadZikrBlock();

/**
 * Each tool's global instruction file. Paths chosen to match each tool's
 * own documented global-config location, not an install-time guess.
 */
const TOOLS = [
  {
    id: 'claude',
    label: 'Claude Code',
    checkCmd: 'claude --version',
    filePath: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    checkCmd: 'codex --version',
    filePath: path.join(os.homedir(), '.codex', 'AGENTS.md'),
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    checkCmd: 'opencode --version',
    filePath: path.join(os.homedir(), '.config', 'opencode', 'AGENTS.md'),
  },
];

/** Runs `<cmd> --version` and returns true only if it exits cleanly. */
function isInstalled(checkCmd) {
  try {
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Reads a file if it exists, otherwise returns an empty string. */
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

/** Inserts or replaces the managed block inside `content`. */
function withBlockInstalled(content) {
  const block = `${MARKER_START}\n${ZIKR_BLOCK}\n${MARKER_END}`;
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing block in place (handles re-runs / updates cleanly).
    return content.slice(0, startIdx) + block + content.slice(endIdx + MARKER_END.length);
  }

  // No existing block: append, with a blank-line separator if file has content.
  const trimmed = content.replace(/\s+$/, '');
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

/** Removes the managed block from `content`. Returns null if not present. */
function withBlockRemoved(content) {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;

  const before = content.slice(0, startIdx);
  const after = content.slice(endIdx + MARKER_END.length);
  const merged = (before + after).replace(/\n{3,}/g, '\n\n').trim();
  return merged.length > 0 ? `${merged}\n` : '';
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function install(tool) {
  const current = readFileSafe(tool.filePath);
  const updated = withBlockInstalled(current);
  ensureDirFor(tool.filePath);
  fs.writeFileSync(tool.filePath, updated, 'utf8');
  console.log(`  \u2713 installed -> ${tool.filePath}`);
}

function uninstall(tool) {
  const current = readFileSafe(tool.filePath);
  if (!current) {
    console.log(`  - nothing to remove (file doesn't exist)`);
    return;
  }
  const updated = withBlockRemoved(current);
  if (updated === null) {
    console.log(`  - no managed block found, left file untouched`);
    return;
  }
  if (updated === '') {
    fs.unlinkSync(tool.filePath);
    console.log(`  \u2713 removed block, deleted now-empty file`);
  } else {
    fs.writeFileSync(tool.filePath, updated, 'utf8');
    console.log(`  \u2713 removed block <- ${tool.filePath}`);
  }
}

function status(tool) {
  const current = readFileSafe(tool.filePath);
  const has = current.includes(MARKER_START) && current.includes(MARKER_END);
  console.log(`  ${has ? '\u2713 installed' : '\u2717 not installed'} (${tool.filePath})`);
}

function main() {
  const args = new Set(process.argv.slice(2));
  const mode = args.has('--uninstall') ? 'uninstall' : args.has('--status') ? 'status' : 'install';

  console.log(`zikr-cli: ${mode}\n`);

  let foundAny = false;

  for (const tool of TOOLS) {
    const present = isInstalled(tool.checkCmd);
    if (!present) {
      console.log(`${tool.label}: not found on PATH, skipping`);
      continue;
    }
    foundAny = true;
    console.log(`${tool.label}: found`);

    try {
      if (mode === 'install') install(tool);
      else if (mode === 'uninstall') uninstall(tool);
      else status(tool);
    } catch (err) {
      // Never let one tool's failure kill the run for the others.
      // If the automated write/remove fails (permissions, weird config
      // layout, whatever), hand the user exact manual steps instead of
      // leaving them stuck.
      console.error(`  \u2717 error handling ${tool.label}: ${err.message}`);
      printManualFallback(tool, mode);
    }
    console.log('');
  }

  if (!foundAny) {
    console.log('No supported CLIs (claude, codex, opencode) found on PATH. Nothing to do.');
  }
}

/** Printed whenever an automated step fails, or when --help is passed. */
function printManualFallback(tool, mode) {
  if (mode === 'uninstall') {
    console.log(`  Manual fix: open ${tool.filePath} in any text editor and delete`);
    console.log(`  everything from the line starting "${MARKER_START.slice(0, 40)}..."`);
    console.log(`  down to and including the line "${MARKER_END}". Save the file.`);
  } else {
    console.log(`  Manual fix: open (or create) ${tool.filePath} and paste this at the end:`);
    console.log('');
    console.log(`  ${MARKER_START}`);
    console.log(`  ${ZIKR_BLOCK.split('\n').join('\n  ')}`);
    console.log(`  ${MARKER_END}`);
  }
}

function printHelp() {
  console.log(`zikr-cli - adds a zikr instruction to Claude Code, Codex CLI, and OpenCode

Usage:
  npx zikr-cli              install into every supported CLI found on PATH
  npx zikr-cli --uninstall  remove it from every supported CLI found on PATH
  npx zikr-cli --status     show what's installed where, no changes
  npx zikr-cli --help       show this screen

This only ever edits one clearly-marked block in each tool's global
instruction file. Nothing else in those files is touched.

  Claude Code -> ~/.claude/CLAUDE.md
  Codex CLI   -> ~/.codex/AGENTS.md
  OpenCode    -> ~/.config/opencode/AGENTS.md

Prefer not to run a script, or the automated uninstall didn't work?
Do it by hand instead - open the relevant file above and:
  - to install: paste the block shown by running any command with
    an error (or see the README), between the start/end marker
    comments
  - to uninstall: delete everything from the line containing
    "zikr-instruction:start" down through the line containing
    "zikr-instruction:end", then save the file
That's it - it's plain Markdown, no build step, no side effects.`);
}

const argsTop = new Set(process.argv.slice(2));
if (argsTop.has('--help') || argsTop.has('-h')) {
  printHelp();
} else {
  main();
}
