# urlwatcher example

A ready-to-run workspace demonstrating both HTML and RSS target specs, plus
an `onChange` command that prints the target spec instructions alongside
the diff.

## Contents

- `urlwatcher.yaml` — config with `onChange` wired up
- `targets/anthropic-news.md` — HTML page -> Markdown (Turndown)
- `targets/openrouter-models.md` — RSS feed -> sorted YAML

## Run it

From this directory:

```sh
bun run ../src/main.ts init        # sets up ./snapshot as a git repo
bun run ../src/main.ts list        # shows the two tracked target specs
bun run ../src/main.ts check       # fetches, diffs, fires onChange
bun run ../src/main.ts check --replay  # replays newest stored diffs through onChange
```

The first `check` treats every target as changed (first snapshot).
Subsequent runs will be silent unless the upstream page or feed
actually changed.

`check --replay` is the opposite of a live run: it does not fetch or
write anything, and instead feeds the newest historical snapshot diff
for each selected alias back through the configured `onChange` command.

`./snapshot/` (the internal change-tracking git repo and snapshots) is
gitignored; it is created fresh by `init`.

## Swapping `onChange` for a real agent

The example `onChange` prints the body and diff to stdout. A more
useful version might hand the files to an LLM CLI:

```yaml
onChange: "my-agent --prompt-file {{body}} --diff-file {{diff}}"
```

`{{body}}` and `{{diff}}` expand to paths to temp files (cleaned up
after the command exits). `{{alias}}` and `{{url}}` expand to the
literal values. All four are passed via `URLWATCHER_*` env vars and
cannot inject shell syntax.
