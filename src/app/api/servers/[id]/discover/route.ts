import { NextRequest, NextResponse } from 'next/server';
import { getServer, saveServer } from '@/lib/store';
import { discoverTools } from '@/lib/mcp-client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const server = getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  try {
    const tools = await discoverTools(server.url, {
      preferredTransport: server.transport,
      bearerToken: server.auth?.type === 'bearer' ? server.auth.token : undefined,
    });

    const updated = {
      ...server,
      tools,
      status: 'active' as const,
      lastDiscoveredAt: new Date().toISOString(),
      error: undefined,
    };

    saveServer(updated);
    return NextResponse.json({ tools, discoveredAt: updated.lastDiscoveredAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const updated = { ...server, status: 'error' as const, error: message };
    saveServer(updated);

    return NextResponse.json(
      { error: 'Failed to connect to MCP server', details: message },
      { status: 502 }
    );
  }
}
