import JSZip from 'jszip';
import type { McpServer, McpTool } from '@/types';
import { generateSharedTypeScriptHelper, generateTypeScriptCodeRef } from './codegen';

export interface SkillFile {
  path: string;
  content: string;
}

export interface SkillBundle {
  safeName: string;
  files: SkillFile[];
}

export function buildSkillBundle(server: McpServer, baseUrl: string): SkillBundle {
  const tools: McpTool[] = server.tools ?? [];
  const safeName = server.name.replace(/[^a-z0-9_-]/gi, '_');
  const files: SkillFile[] = [
    { path: 'SKILL.md', content: buildSkillMd(server, tools, baseUrl) },
    { path: 'code_refs/_shared.ts', content: generateSharedTypeScriptHelper(baseUrl) },
  ];

  for (const tool of tools) {
    const endpoint = `${baseUrl}/api/mcp/${server.id}/tools/${encodeURIComponent(tool.name)}`;
    const content = generateTypeScriptCodeRef(tool, endpoint);
    files.push({ path: `code_refs/${tool.name}.ts`, content });
  }

  return { safeName, files };
}

export async function buildSkillZip(server: McpServer, baseUrl: string): Promise<Buffer> {
  const zip = new JSZip();
  const { safeName, files } = buildSkillBundle(server, baseUrl);
  const basePath = `skills/${safeName}/`;

  for (const file of files) {
    zip.file(`${basePath}${file.path}`, file.content);
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

function buildSkillMd(server: McpServer, tools: McpTool[], baseUrl: string): string {
  const toolLines = tools
    .map((t) => `- \`${t.name}\`${t.description ? ` — ${t.description}` : ''}`)
    .join('\n');
  const toolNames = tools.map((t) => t.name).slice(0, 6);
  const extraToolsCount = Math.max(0, tools.length - toolNames.length);
  const toolSummary =
    toolNames.length > 0
      ? `Primary tools: ${toolNames.join(', ')}${extraToolsCount > 0 ? `, and ${extraToolsCount} more` : ''}.`
      : 'No discovered tools yet.';
  const skillDescription = `Generated from MCP server "${server.name}" via mcp2skills. Routes tool calls through a stable local proxy endpoint. ${toolSummary}`;
  const escapedDescription = skillDescription.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return `---
name: ${server.name.replace(/\s+/g, '-').toLowerCase()}
description: "${escapedDescription}"
---

# Skill: ${server.name}

## Description
MCP server registered via mcp2skills. This skill is generated against the mcp2skills proxy endpoint,
which maps a stable server id to the remote MCP URL.

## Server Mapping
- Server ID: \`${server.id}\`
- Source MCP URL: \`${server.url}\`
- Proxy tools endpoint: \`${baseUrl}/api/mcp/${server.id}/tools\`

## Setup
1. Ensure mcp2skills is running and reachable at \`${baseUrl}\`.
2. Optional: override generated base URL with \`MCP_PROXY_BASE_URL\` (example: \`http://localhost:3000\`).
3. Use the TypeScript examples from \`code_refs/\` to generate task-specific executable code.

## Runtime Requirements
- Node.js 20 or newer is recommended because generated code can use the built-in \`fetch\` API.
- Do not assume TypeScript runners such as \`tsx\` are installed.
- If execution requires installing a runner or accessing localhost from a sandboxed environment, request permission first.

## Tools
${toolLines || '_No tools discovered._'}

## Execution Policy
- Treat \`code_refs/*.ts\` as reference implementations, not standalone executable scripts.
- For each task, write a temporary runner that follows the relevant \`code_refs/\` example, calls the needed tool(s), and prints JSON output.
- Prefer a plain Node.js runner when that is enough; use TypeScript only when a TypeScript runtime is already available or can be installed with permission.
- Do not use \`curl\` as the primary invocation path.
- Use raw HTTP only for explicit troubleshooting/debugging.

## Usage
Each \`code_refs/<tool_name>.ts\` shows the expected input shape, output shape, and proxy endpoint for one tool.

Example runner workflow:
\`\`\`bash
mkdir -p tmp
$EDITOR tmp/run-tool.mjs
node tmp/run-tool.mjs
\`\`\`

Example runner shape:
\`\`\`js
const baseUrl = process.env.MCP_PROXY_BASE_URL ?? "${baseUrl}";
const response = await fetch(\`\${baseUrl}/api/mcp/${server.id}/tools/<tool_name>\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    arguments: {
      // Fill arguments from the user's request.
    },
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
\`\`\`

## Proxy Response Shape
Tool calls return an MCP envelope. Generated wrappers extract data with this precedence:
1. \`result.structuredContent\`
2. First JSON-parsable \`result.content[].text\`

If neither is available, wrappers throw a descriptive envelope parsing error.

## Troubleshooting
- If you see connection errors (for example, "Unable to connect"), confirm mcp2skills is running at \`${baseUrl}\`.
- In sandboxed environments, localhost traffic may be blocked; run outside sandbox if needed.
`;
}
