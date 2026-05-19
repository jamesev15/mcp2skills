import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAllServers, saveServer } from '@/lib/store';
import type { AuthConfig, RegisterServerRequest, TransportType } from '@/types';

function normalizeTransport(transport: unknown): TransportType {
  if (transport === 'sse') return 'sse';
  return 'streamable-http';
}

function normalizeAuth(auth: unknown): AuthConfig {
  if (!auth || typeof auth !== 'object') return { type: 'none' };

  const maybeAuth = auth as { type?: unknown; token?: unknown };
  if (maybeAuth.type === 'bearer') {
    if (typeof maybeAuth.token !== 'string' || !maybeAuth.token.trim()) {
      throw new Error('auth.token is required when auth.type is bearer');
    }
    return { type: 'bearer', token: maybeAuth.token.trim() };
  }

  return { type: 'none' };
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getAllServers());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RegisterServerRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, url, owner, transport, auth } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'url must be a valid URL' }, { status: 400 });
  }

  let normalizedAuth: AuthConfig;
  try {
    normalizedAuth = normalizeAuth(auth);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid auth configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const server = {
    id: randomUUID(),
    name: name.trim(),
    url: url.trim(),
    owner: typeof owner === 'string' && owner.trim() ? owner.trim() : undefined,
    transport: normalizeTransport(transport),
    auth: normalizedAuth,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };

  saveServer(server);
  return NextResponse.json(server, { status: 201 });
}
