# AGENTS.md

## Purpose
Operational guide for AI coding agents working on `@mcp2skills/start`.

This project runs locally (no cloud deployment required) and provides:
- A local web UI to register MCP servers
- Tool discovery per registered server
- Proxy endpoints mapped by internal `serverId`
- Skill ZIP generation pointing to local proxy endpoints

## Product Constraints
- Runtime is local-first.
- Main user entrypoint is:
  - `npx @mcp2skills/start`
- Persistence is file-based JSON (`$HOME/.mcp2skills/servers.json`), not database-based.
- Avoid introducing mandatory cloud dependencies.

## Tech Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- MCP SDK (`@modelcontextprotocol/sdk`)

## Key Paths
- UI page: `src/app/page.tsx`
- Register/list APIs: `src/app/api/servers/`
- Discovery API: `src/app/api/servers/[id]/discover/route.ts`
- Skill ZIP API: `src/app/api/servers/[id]/skill/route.ts`
- Proxy APIs: `src/app/api/mcp/[id]/tools/`
- Store: `src/lib/store.ts`
- MCP client helpers: `src/lib/mcp-client.ts`
- Skill/code generation: `src/lib/skill-builder.ts`, `src/lib/codegen.ts`
- CLI entrypoint: `bin/start.cjs`

## Local Execution
- Dev mode:
  - `npm run dev`
- CLI mode (target UX):
  - `npm run start:local`
  - or `npx @mcp2skills/start`

CLI flags:
- `--port` / `-p`
- `--host` / `-H`

## Persistence Rules
- Registered servers must persist in `$HOME/.mcp2skills/servers.json`.
- Keep data format backward-compatible when possible.
- If schema evolves, add safe defaults in read/normalize flows.

## API Conventions
- Return JSON for errors with:
  - `error` (human-readable)
  - `details` (optional)
- HTTP status expectations:
  - `400` invalid request
  - `404` resource not found
  - `502` upstream MCP communication failures

## Proxy Contract
Mapped endpoints:
- `GET /api/mcp/:id/tools`
- `POST /api/mcp/:id/tools/:toolName`

Agent rule:
- Do not bypass mapping design by hardcoding remote MCP URLs in client UX flows.
- Generated skills should target mapped local endpoints.

## Security Notes
- Treat bearer tokens as sensitive.
- Never log auth tokens in plaintext.
- Prefer not exposing token values in UI responses.

## Coding Guidelines
- Use TypeScript strict-friendly code.
- Keep changes minimal and focused.
- Reuse existing helpers before adding new abstractions.
- Preserve App Router patterns already in repo.

## Validation Checklist
Before finishing changes:
1. `npm run build` succeeds.
2. Register server works.
3. Discover tools works.
4. Download skill ZIP works.
5. Proxy endpoints resolve registered `serverId` correctly.
6. Delete server removes it from `$HOME/.mcp2skills/servers.json`.

## Non-Goals (unless user asks)
- Cloud hosting setup
- Database migrations (PostgreSQL, MySQL, etc.)
- Auth platform integration (OAuth provider, SSO)
- Replacing Next.js with another framework

## Release Notes for Agents
When touching publish/CLI behavior, verify:
- `package.json` name, bin, files, engines, publishConfig
- `README.md` usage examples still valid
- `npm pack --dry-run` includes required runtime files
