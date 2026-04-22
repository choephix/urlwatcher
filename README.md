# urlwatcher

`urlwatcher` is a Bun CLI for tracking changes to web pages, JSON APIs, and RSS/Atom feeds.

It fetches each target URL, converts the response into a stable text format, writes the result into a dedicated git-tracked `snapshotDir`, and uses git diffs to decide whether anything meaningful changed. When something does change, it can:

- commit the updated snapshot
- emit a formatted run summary through one or more notifiers
- hand the per-target diff plus free-form instructions to an `onChange` command

The project is built around the idea that change detection is more useful when the stored output is diff-friendly rather than raw HTML or raw API responses.

## What It Tracks

- HTML pages -> Markdown
- JSON endpoints -> sorted YAML
- RSS/Atom feeds -> normalized sorted YAML

That gives you cleaner history, smaller diffs, and much less markup noise.

## How It Is Structured

There are two separate working areas:

- `specDir`: your target spec definitions, one Markdown file per URL
- `snapshotDir`: generated snapshots plus `.state.yaml`, stored inside a git repo

Target spec files are the source of truth. The config file defines global defaults and runtime behavior. The generated output in `snapshotDir` is disposable in the sense that it is derived from the spec set, but it is still important because its git history is how changes are detected and reviewed.

## Core Workflow

On `urlwatcher check`, the CLI:

1. loads config
2. loads target spec Markdown files from `specDir`
3. fetches each enabled URL
4. detects or respects the configured content type
5. runs the matching converter
6. writes the normalized output into `snapshotDir`
7. stages the files in the `snapshotDir` git repo
8. uses `git diff --cached` to determine which targets changed
9. updates `.state.yaml` with `lastChecked` and `lastChanged`
10. commits when there are real changes
11. sends a run summary to all configured notifications
12. runs `onChange` once per changed target, if configured

If a fetch fails, the target is reported as an error and the previous stored snapshot is left untouched.

## Features

- Spec-per-file model instead of one giant URL list
- Git-backed history for generated snapshots
- Automatic content-type detection for HTML, JSON, and RSS/Atom
- Stable converters designed for readable diffs
- Per-target overrides in YAML front matter
- Optional free-form spec body passed to downstream automation
- Built-in `stdout` and append-to-file notifications
- `--dry-run` mode for fetch/diff without committing
- `--replay` mode for running `onChange` against the newest historical diff
- Disabled targets via front matter
- Locking to avoid overlapping checks against the same `snapshotDir`

## Install

This project uses Bun exclusively.

```sh
bun install
```

Run directly from source:

```sh
bun run src/main.ts <command>
```

Or use the package bin if installed in your environment:

```sh
urlwatcher <command>
```

## Quick Start

If `urlwatcher.yaml` does not exist yet, `init` now creates it interactively and prompts for the important fields. Press Enter to accept the defaults.

The generated config looks like this:

```yaml
snapshotDir: ./snapshot
specDir: ./targets

defaults:
  htmlConverter: turndown
  jsonConverter: yaml
  rssConverter: rss
  timeout: 30000

notifications:
  - type: stdout
```

Initialize the directories and the internal git repo inside `snapshotDir`:

```sh
bun run src/main.ts init
```

Add a target:

```sh
bun run src/main.ts add https://example.com/blog --alias blog
```

Check everything:

```sh
bun run src/main.ts check
```

## Commands

```sh
urlwatcher init
urlwatcher check
urlwatcher check <alias>
urlwatcher check --replay
urlwatcher check <alias> --replay
urlwatcher add <url> --alias <name>
urlwatcher remove <alias>
urlwatcher list
```

### Global options

```txt
-c, --config <path>    path to config file
```

Config lookup order when `--config` is omitted:

1. `./urlwatcher.yaml`
2. `~/.config/urlwatcher/urlwatcher.yaml`

### `check`

```txt
-n, --dry-run          fetch and diff, but do not commit or keep changes
--replay               run onChange with the newest historical diff instead of fetching live
```

Notes:

- `check` can run against all target specs or a single alias
- disabled targets are skipped and reported
- if `snapshotDir` already has uncommitted changes, the CLI prompts whether to commit them as `manual changes` before continuing
- `--replay` is read-only: no fetches, snapshot writes, state updates, notifications, or commits
- `--replay` requires `onChange` to be configured and cannot be combined with `--dry-run`

### `add`

```txt
-a, --alias <name>           required; target spec filename stem
--html-converter <name>      override HTML converter
--content-type <type>        html | json | rss
```

Aliases must be filesystem-safe and may contain only letters, numbers, hyphens, and underscores.

## Config

`urlwatcher.yaml` controls runtime behavior. Paths are resolved relative to the config file location.

If the config file is missing when you run `urlwatcher init`, the CLI creates it for you and prompts for:

- `snapshotDir`
- `specDir`
- default fetch timeout
- optional `onChange` command
- optional file log path for the built-in file notifier

If you prefer, you can still create or edit `urlwatcher.yaml` manually, or start from `examples/urlwatcher.yaml`.

```yaml
snapshotDir: ./snapshot
specDir: ./targets

onChange: "my-agent --diff-file {{diff}} --instructions-file {{body}}"

defaults:
  htmlConverter: turndown
  jsonConverter: yaml
  rssConverter: rss
  timeout: 30000

notifications:
  - type: stdout
  - type: file
    path: ./runs.log
```

### Config fields

| Field | Meaning |
|---|---|
| `snapshotDir` | Directory where generated snapshots and `.state.yaml` live. Must be initialized as a git repo via `urlwatcher init`. |
| `specDir` | Directory containing target spec Markdown files. |
| `onChange` | Optional shell command run once per changed target. |
| `defaults.htmlConverter` | Default converter for HTML content. |
| `defaults.jsonConverter` | Default converter for JSON content. |
| `defaults.rssConverter` | Default converter for feeds. |
| `defaults.timeout` | Fetch timeout in milliseconds. |
| `notifications` | List of notifier configs executed after each non-empty run. |

## Target Spec Files

Each tracked URL is defined by one Markdown file in `specDir`, named `<alias>.md`.

Example:

```markdown
---
url: https://example.com/blog
enabled: true
htmlConverter: turndown
contentType: html
timeout: 15000
---

Watch for product announcements and pricing changes.
Ignore layout-only edits.
```

### Front matter fields

| Field | Required | Meaning |
|---|---|---|
| `url` | yes | Target URL to fetch. |
| `enabled` | no | Defaults to `true`. Disabled targets are skipped. |
| `htmlConverter` | no | Per-target override for HTML conversion. |
| `jsonConverter` | no | Per-target override for JSON conversion. |
| `rssConverter` | no | Per-target override for feed conversion. |
| `contentType` | no | `html`, `json`, or `rss`. If omitted, auto-detected. |
| `timeout` | no | Per-target timeout override in milliseconds. |

The Markdown body is not interpreted by `urlwatcher` itself. It is preserved and passed to `onChange` as an instructions file, which makes each target spec a useful container for both machine-readable settings and human-written downstream instructions.

## Converters

### HTML

| Name | Behavior | JS-rendered pages |
|---|---|---|
| `turndown` | Local conversion. Readability extracts article-like content, then Turndown converts it to Markdown. | No |
| `jina` | Remote conversion through `r.jina.ai`, returning Markdown. | Yes |

### JSON

| Name | Behavior |
|---|---|
| `yaml` | Converts JSON into sorted YAML for deterministic diffs. |

### RSS / Atom

| Name | Behavior |
|---|---|
| `rss` | Parses feed metadata and items into normalized sorted YAML. |

Feed items are normalized and sorted by a stable id so noisy ordering changes do not create unnecessary diffs.

## Notifications

Each `check` run produces one formatted run block, which is sent to every configured notifier.

Built-in notifiers:

| Type | Config | Behavior |
|---|---|---|
| `stdout` | none | Prints the run block to stdout. |
| `file` | `path: <file>` | Appends the run block to a text log file. Parent directories are created automatically. Dry-runs are skipped. |

Example output:

```txt
════════════════════════════════════════════════════════════
  2026-04-21 08:00:00
════════════════════════════════════════════════════════════

[blog] no changes
[api]  changed  +3 -1
@@ -1,3 +1,3 @@
...diff...

[feed] error  Timeout after 30000ms
```

Entries with diffs are spaced out for readability; unchanged and error lines stay compact.

## `onChange`

`onChange` is an optional shell command that runs once for each target whose generated output actually changed.

Supported placeholders:

| Placeholder | Expands to |
|---|---|
| `{{diff}}` | Path to a temporary file containing the target diff |
| `{{body}}` | Path to a temporary file containing the target spec Markdown body |
| `{{alias}}` | Target alias |
| `{{url}}` | Target URL |

Important detail: `{{diff}}` and `{{body}}` expand to file paths, not inline content. That avoids shell argument length issues and makes it practical to hand large diffs to other tools.

Example:

```yaml
onChange: |
  printf 'Changed: %s\n' {{alias}}
  printf 'URL: %s\n\n' {{url}}
  printf 'Instructions:\n'
  cat {{body}}
  printf '\n\nDiff:\n'
  cat {{diff}}
```

The command runs via `sh -c` with environment variables populated for the placeholder values, and temporary files are removed when the command exits.

### Historical replay

If you want to test the real `onChange` command without hitting the network, use replay mode:

```sh
bun run src/main.ts check --replay
bun run src/main.ts check blog --replay
```

Replay mode scans backward through the internal snapshot git history for each selected alias and picks the newest commit that contains a real textual diff for that alias's snapshot file. It then runs `onChange` with that historical diff and the current target spec body.

Replay mode is intentionally read-only:

- no live fetches
- no snapshot updates
- no `.state.yaml` writes
- no notifications
- no commits
- no file logging

## State Tracking

`snapshotDir/.state.yaml` stores per-target timestamps:

- `lastChecked`
- `lastChanged`

This lets `urlwatcher list` show operational history without reading git logs.

## Data Repo Behavior

`urlwatcher` manages its own git repository inside `snapshotDir`.

- `init` creates the repo and makes the initial commit
- `check` creates commits such as `urlwatcher: Update blog, api — <timestamp>` when real content changes
- if content did not change, it may still commit an updated `.state.yaml`
- `--dry-run` restores the working tree so no commit or snapshot update remains afterwards

This internal repo is part of the runtime behavior. It is separate from this project's development repo.

## Examples

Track an HTML page:

```sh
bun run src/main.ts add https://example.com/blog --alias blog
```

Track a JSON API:

```sh
bun run src/main.ts add https://api.github.com/users/octocat --alias gh-octocat --content-type json
```

Track an RSS or Atom feed:

```sh
bun run src/main.ts add https://example.com/feed.xml --alias feed --content-type rss
```

Track a JS-heavy page with Jina:

```sh
bun run src/main.ts add https://spa-site.com --alias spa --html-converter jina
```

Check one target:

```sh
bun run src/main.ts check blog
```

Use the bundled example config and target specs:

```sh
bun run example:init
bun run example
bun run example:dry
```

## Repository Layout

```txt
src/
  commands/        CLI commands
  config/          config loading and schema validation
  converters/      HTML, JSON, and feed normalization
  git/             git operations used against snapshotDir
  notifications/   run output formatters and sinks
  specs/           target spec file parsing and creation
examples/          sample config and target spec definitions
```

## Requirements

- [Bun](https://bun.sh)
- `git` available on `PATH`

## Summary

Use `urlwatcher` when you want git-style change tracking for URLs, but with normalized outputs that are pleasant to diff and easy to hand off to automation.
