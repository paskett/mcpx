# AGENTS.md

## What is mcpx?

`mcpx` is a small CLI for talking to MCP (Model Context Protocol) servers. It
lets you log in to servers defined in a Claude-style `mcpServers` JSON config,
then call their tools, render their prompts, and read their resources directly
from the shell:

```sh
mcpx server atlassian                                  # log in, cache the catalog
mcpx tool atlassian jira_issue_details --query "ABC-123"
mcpx prompt <server> <prompt-name> [--arg ...]
mcpx resource <server> <resource-name> [--placeholder ...]
```

## General outline

Everything lives in a single executable script: `./mcpx` (a `uv run` script
with inline PEP 723 dependencies). Its sections, top to bottom:

1. **Config / cache plumbing** — loads server definitions from `.mcp.json`
   (via `--config`) merged with the global `~/.config/mcpx/mcp.json` (local
   wins). Catalogs are cached per-config-path under `~/.cache/mcpx/`, and
   OAuth tokens under `~/.cache/mcpx/oauth/`. Optional CA bundle support for
   corporate TLS interception.
2. **Client construction** — builds a fastmcp `Client` for HTTP or stdio
   servers, falling back to OAuth for HTTP servers when a plain connection
   fails.
3. **Result rendering** — prints tool/prompt/resource results as text or JSON.
4. **Click parameter generation** — turns each tool's JSON input schema into
   click options, so every MCP tool becomes a well-formed CLI subcommand.
5. **Dynamic groups** — `ToolGroup` / `PromptGroup` / `ResourceGroup` expose
   the cached catalog as subcommands with progressive disclosure
   (`mcpx tool` → servers, `mcpx tool <server>` → items, `... <name> --help`
   → full help).
6. **Top-level CLI** — the `mcpx server` login/refresh command and the three
   dynamic groups.

## Ground rules for changes

- **Keep it a single file.** All code stays in the `mcpx` script. Do not split
  it into a package, add modules, or introduce a build step.
- **Keep the implementation simple.** Prefer small, direct functions over
  abstractions. This is a convenience tool, not a framework — resist adding
  layers, plugin systems, or speculative configurability.
- **Limit dependencies.** `click` and `fastmcp` are the core dependencies
  (plus `py-key-value-aio` for OAuth token persistence). Do not add new
  dependencies unless there is no reasonable way to do it with the standard
  library or the existing ones.
