import { NextRequest, NextResponse } from 'next/server';
import { getServer } from '@/lib/store';
import { callTool } from '@/lib/mcp-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolName: string }> }
): Promise<NextResponse> {
  const { id, toolName } = await params;
  const server = getServer(id);

  if (!server) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  let body: { arguments?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const args = body.arguments && typeof body.arguments === 'object' ? body.arguments : {};

  try {
    const result = await callTool(server.url, toolName, args, {
      preferredTransport: server.transport,
      bearerToken: server.auth?.type === 'bearer' ? server.auth.token : undefined,
    });

    return NextResponse.json({
      serverId: id,
      toolName,
      mappedUrl: server.url,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Tool execution failed', details: message }, { status: 502 });
  }
}
