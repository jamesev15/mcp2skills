import { NextRequest } from 'next/server';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { getServer } from '@/lib/store';
import { buildSkillBundle } from '@/lib/skill-builder';

function resolveBaseUrl(request: NextRequest): string {
  const envBaseUrl = process.env.APP_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, '');
  }

  return request.nextUrl.origin;
}

function resolveInstallRoot(target: string | null): string | null {
  if (!target || target === 'claude') {
    return path.join(os.homedir(), '.claude', 'skills');
  }

  if (target === 'agents') {
    return path.join(os.homedir(), '.agents', 'skills');
  }

  return null;
}

function formatHomePath(filePath: string): string {
  const homeDir = os.homedir();
  const relativePath = path.relative(homeDir, filePath);

  if (relativePath === '') {
    return '$HOME';
  }

  if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
    return `$HOME/${relativePath.split(path.sep).join('/')}`;
  }

  return filePath;
}

export async function POST(
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

  const target = request.nextUrl.searchParams.get('target');
  const installRoot = resolveInstallRoot(target);

  if (!installRoot) {
    return new Response(
      JSON.stringify({ error: 'Invalid install target', details: 'Use target=claude or target=agents' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const baseUrl = resolveBaseUrl(request);
    const { safeName, files } = buildSkillBundle(server, baseUrl);
    const skillPath = path.join(installRoot, safeName);

    await mkdir(installRoot, { recursive: true });
    await rm(skillPath, { recursive: true, force: true });
    await mkdir(skillPath, { recursive: true });

    for (const file of files) {
      const filePath = path.join(skillPath, file.path);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, 'utf8');
    }

    return new Response(
      JSON.stringify({
        ok: true,
        installedPath: skillPath,
        installedPathDisplay: formatHomePath(skillPath),
        installTarget: target ?? 'claude',
        skillName: safeName,
        filesWritten: files.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown install error';

    return new Response(
      JSON.stringify({ error: 'Failed to install skill locally', details }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
