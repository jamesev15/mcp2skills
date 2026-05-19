# @mcp2skills/start

Run mcp2skills locally to register MCP servers, discover tools, and generate skills.

## Quick start

```bash
npx @mcp2skills/start
```

Open `http://127.0.0.1:3000`.

## CLI options

```bash
npx @mcp2skills/start --port 3456 --host 0.0.0.0
```

Supported flags:

- `--port`, `-p` (default: `3000`)
- `--host`, `-H` (default: `127.0.0.1`)

## Local data persistence

Registered servers are persisted in:

- `$HOME/.mcp2skills/servers.json`

## Environment variable

- `APP_BASE_URL` (optional): base URL embedded in generated skill ZIPs.

If not set, the CLI uses `http://<host>:<port>`.
