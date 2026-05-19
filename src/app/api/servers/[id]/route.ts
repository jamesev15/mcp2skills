import { NextRequest, NextResponse } from 'next/server';
import { deleteServer, getServer, saveServer } from '@/lib/store';
import type { AuthConfig, TransportType } from '@/types';

interface UpdateServerRequest {
  name?: string;
  owner?: string;
  transport?: TransportType;
  auth?: AuthConfig;
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

function normalizeTransport(transport: unknown): TransportType {
  if (transport === 'sse') return 'sse';
  return 'streamable-http';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const existing = getServer(id);

  if (!existing) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  let body: UpdateServerRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
  }

  let auth = existing.auth;
  try {
    if (body.auth !== undefined) {
      auth = normalizeAuth(body.auth);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid auth configuration';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const updated = {
    ...existing,
    name: body.name !== undefined ? body.name.trim() : existing.name,
    owner:
      body.owner !== undefined
        ? typeof body.owner === 'string' && body.owner.trim()
          ? body.owner.trim()
          : undefined
        : existing.owner,
    transport: body.transport !== undefined ? normalizeTransport(body.transport) : existing.transport,
    auth,
  };

  saveServer(updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const existing = getServer(id);

  if (!existing) {
    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
  }

  deleteServer(id);
  return NextResponse.json({ ok: true, id });
}
