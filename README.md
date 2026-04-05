# urlwatcher

Track changes to web pages and API endpoints. Fetches URLs, converts to diff-friendly formats, stores in a git repo, diffs for changes.

- HTML pages → Markdown (text-only, no DOM noise)
- JSON endpoints → sorted YAML (deterministic, clean diffs)
- Changes detected via `git diff`, committed automatically

## Setup

```sh
bun install
bun run src/main.ts init    # creates data dir + git repo
```

## Commands

```sh
urlwatcher init              # initialize data directory as git repo
urlwatcher check             # check all tracked URLs for changes
urlwatcher check <alias>     # check one URL
urlwatcher add <url> [opts]  # add URL to track
urlwatcher remove <alias>    # stop tracking
urlwatcher list              # show all tracked URLs
```

### add options

```
-a, --alias <name>            required — filesystem-safe identifier
--html-converter <name>       turndown (default) or jina
--content-type <type>         force html or json (otherwise auto-detected)
```

### global options

```
-c, --config <path>           path to config file (default: ./urlwatcher.yaml)
```

## Config

`urlwatcher.yaml` — looked up in cwd, then `~/.config/urlwatcher/`.

```yaml
dataDir: /path/to/data        # git-tracked output directory

defaults:
  htmlConverter: turndown      # turndown | jina
  jsonConverter: yaml          # yaml
  timeout: 30000               # fetch timeout ms

urls:
  - alias: my-page
    url: https://example.com
  - alias: my-api
    url: https://api.example.com/data
    contentType: json
  - alias: js-heavy-page
    url: https://spa-site.com
    htmlConverter: jina         # overrides default per-URL

notifications:
  - type: stdout
```

## HTML Converters

| Name | How | Handles JS |
|---|---|---|
| `turndown` | Local. Readability extracts article, Turndown converts to markdown. | No |
| `jina` | Remote. Sends URL to `r.jina.ai`, gets markdown back. | Yes |

Set per-URL via `htmlConverter` field or globally in `defaults.htmlConverter`.

## How it works

1. Fetches each tracked URL
2. Converts response (HTML→md, JSON→yaml)
3. Writes to `<dataDir>/<alias>.md` or `<alias>.yaml`
4. `git add` + `git diff --cached` to detect changes
5. If changed: commits and prints diff. If unchanged: no-op.

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
