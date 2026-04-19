# urlwatcher

Track changes to web pages and API endpoints. Fetches URLs, converts to diff-friendly formats, stores in a git repo, diffs for changes.

- HTML pages → Markdown (text-only, no DOM noise)
- JSON endpoints → sorted YAML (deterministic, clean diffs)
- Changes detected via `git diff`, committed automatically
- Per-URL watchers live as Markdown files with YAML front matter — the body holds free-form instructions passed to an optional `onChange` command

## Setup

```sh
bun install
bun run src/main.ts init    # creates data dir + watcher dir + git repo
```

## Commands

```sh
urlwatcher init              # initialize data + watcher directories
urlwatcher check             # check all watchers for changes
urlwatcher check <alias>     # check one watcher
urlwatcher add <url> [opts]  # create a watcher Markdown file
urlwatcher remove <alias>    # delete a watcher Markdown file
urlwatcher list              # show all watchers
```

### add options

```
-a, --alias <name>            required — filesystem-safe identifier (= filename)
--html-converter <name>       turndown (default) or jina
--content-type <type>         force html or json (otherwise auto-detected)
```

### global options

```
-c, --config <path>           path to config file (default: ./urlwatcher.yaml)
```

## Config

`urlwatcher.yaml` — looked up in cwd, then `~/.config/urlwatcher/`. Paths are resolved relative to the config file.

```yaml
dataDir: ./data                # git-tracked output directory
watchDir: ./watchers           # directory of per-URL Markdown files

onChange: "my-agent --diff {{diff}} --instructions {{body}}"

defaults:
  htmlConverter: turndown      # turndown | jina
  jsonConverter: yaml          # yaml
  timeout: 30000               # fetch timeout ms

notifications:
  - type: stdout
```

The config no longer contains the list of URLs — each URL is its own file under `watchDir`.

## Watcher files

Each tracked URL is a Markdown file `<watchDir>/<alias>.md`. The filename (minus `.md`) is the alias. YAML front matter holds the per-URL settings; the body is free-form instructions passed to `onChange`.

```markdown
---
url: https://example.com/blog
htmlConverter: turndown        # optional, overrides default
contentType: html              # optional: html | json (auto if omitted)
timeout: 15000                 # optional, overrides default
---

Any text down here is ignored by urlwatcher itself. It is made
available to the `onChange` command as `{{body}}`, so you can embed
instructions meant for a downstream AI agent.
```

Front-matter fields: `url` (required), `htmlConverter`, `jsonConverter`, `contentType`, `timeout` (all optional).

## onChange

Optional shell command run once per URL that actually changed. Placeholders substituted in the command string:

| Placeholder | Contents |
|---|---|
| `{{diff}}` | git diff for this URL's stored file |
| `{{body}}` | the watcher's Markdown body |
| `{{alias}}` | watcher alias |
| `{{url}}` | watcher URL |

Placeholders expand to properly-quoted references to env vars (`URLWATCHER_DIFF`, `URLWATCHER_BODY`, `URLWATCHER_ALIAS`, `URLWATCHER_URL`), so diff/body content cannot inject shell. The command runs via `sh -c` with those env vars set, inheriting stdio. It is skipped on `--dry-run` and when a URL is unchanged.

## HTML Converters

| Name | How | Handles JS |
|---|---|---|
| `turndown` | Local. Readability extracts article, Turndown converts to markdown. | No |
| `jina` | Remote. Sends URL to `r.jina.ai`, gets markdown back. | Yes |

Set per-URL via `htmlConverter` in front matter, or globally in `defaults.htmlConverter`.

## How it works

1. Loads each `.md` file from `watchDir` as a watcher
2. Fetches its URL
3. Converts response (HTML→md, JSON→yaml)
4. Writes to `<dataDir>/<alias>.md` or `<alias>.yaml`
5. `git add` + `git diff --cached` to detect changes
6. If changed: commits, prints diff via notifications, runs `onChange` (if configured). If unchanged: concise unchanged summary, no-op.

Fetch failures skip the URL with a warning — existing file untouched.

## Examples

```sh
# track a blog
bun run src/main.ts add https://example.com/blog --alias blog

# track a JSON API
bun run src/main.ts add https://api.github.com/users/octocat --alias gh-octocat --content-type json

# track a JS-rendered page via Jina
bun run src/main.ts add https://spa-site.com --alias spa --html-converter jina

# check everything
bun run src/main.ts check

# check one
bun run src/main.ts check blog
```

## Requires

- [Bun](https://bun.sh)
- `git` on PATH
