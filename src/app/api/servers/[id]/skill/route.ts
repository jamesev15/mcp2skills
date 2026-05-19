import { NextRequest } from 'next/server';
import { getServer } from '@/lib/store';
import { buildSkillZip } from '@/lib/skill-builder';

function resolveBaseUrl(request: NextRequest): string {
  const envBaseUrl = process.env.APP_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  return request.nextUrl.origin;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const server = getServer(id);

  if (!server) {
    return new Response(JSON.stringify({ error: 'Server not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!server.tools || server.tools.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No tools discovered. Run discovery first.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const baseUrl = resolveBaseUrl(request);
  const buffer = await buildSkillZip(server, baseUrl);
  const filename = `skill-${server.name.replace(/[^a-z0-9]/gi, '_')}.zip`;
  const bytes = new Uint8Array(buffer);

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
