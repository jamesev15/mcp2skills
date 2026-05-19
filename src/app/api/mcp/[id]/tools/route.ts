import { NextRequest, NextResponse } from 'next/server';
import { getServer } from '@/lib/store';
import { discoverTools } from '@/lib/mcp-client';

export async function GET(
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

    return NextResponse.json({
      serverId: id,
      serverName: server.name,
      mappedUrl: server.url,
      tools,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch tools', details: message }, { status: 502 });
  }
}
