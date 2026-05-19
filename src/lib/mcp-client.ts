import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { McpTool, TransportType } from '@/types';

interface ConnectOptions {
  preferredTransport?: TransportType;
  bearerToken?: string;
}

function buildHeaders(bearerToken?: string): Record<string, string> | undefined {
  if (!bearerToken) return undefined;
  return { Authorization: `Bearer ${bearerToken}` };
}

async function connectClient(
  client: Client,
  url: URL,
  options: ConnectOptions = {}
): Promise<void> {
  const headers = buildHeaders(options.bearerToken);
  const tryStreamable = async () => {
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  };
  const trySse = async () => {
    await client.connect(new SSEClientTransport(url, { requestInit: { headers } }));
  };

  if (options.preferredTransport === 'sse') {
    try {
      await trySse();
      return;
    } catch {
      await tryStreamable();
      return;
    }
  }

  try {
    await tryStreamable();
  } catch {
    await trySse();
  }
}

export async function discoverTools(serverUrl: string, options: ConnectOptions = {}): Promise<McpTool[]> {
  const url = new URL(serverUrl);
  const client = new Client({ name: 'mcp2skills-client', version: '1.0.0' });
  let connected = false;

  try {
    await connectClient(client, url, options);
    connected = true;

    const result = await client.listTools();

    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as McpTool['inputSchema'],
      outputSchema: tool.outputSchema as McpTool['outputSchema'],
    }));
  } finally {
    if (connected) {
      await client.close().catch(() => undefined);
    }
  }
}

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  options: ConnectOptions = {}
): Promise<unknown> {
  const url = new URL(serverUrl);
  const client = new Client({ name: 'mcp2skills-client', version: '1.0.0' });
  let connected = false;

  try {
    await connectClient(client, url, options);
    connected = true;
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  } finally {
    if (connected) {
      await client.close().catch(() => undefined);
    }
  }
}
