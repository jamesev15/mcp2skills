'use client';

import { useEffect, useState } from 'react';
import type { McpServer, TransportType } from '@/types';

interface Props {
  server?: McpServer;
  onUpdated: (server: McpServer) => void;
}

export default function ServerEditor({ server, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [transport, setTransport] = useState<TransportType>('streamable-http');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!server) {
      setName('');
      setOwner('');
      setTransport('streamable-http');
      setAuthType('none');
      setToken('');
      return;
    }

    setName(server.name);
    setOwner(server.owner ?? '');
    setTransport(server.transport ?? 'streamable-http');
    setAuthType(server.auth?.type === 'bearer' ? 'bearer' : 'none');
    setToken(server.auth?.type === 'bearer' ? server.auth.token ?? '' : '');
    setError(null);
    setOk(false);
  }, [server]);

  if (!server) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Select a registered server to edit its configuration.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(false);

    try {
      const res = await fetch(`/api/servers/${server.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          owner: owner || '',
          transport,
          auth: authType === 'bearer' ? { type: 'bearer', token } : { type: 'none' },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Update failed');
        return;
      }

      onUpdated(data as McpServer);
      setOk(true);
    } catch {
      setError('Network error - could not update server');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-server-name">
          Server name
        </label>
        <input
          id="edit-server-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-owner">
          Owner (optional)
        </label>
        <input
          id="edit-owner"
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-transport">
            Transport
          </label>
          <select
            id="edit-transport"
            value={transport}
            onChange={(e) => setTransport(e.target.value as TransportType)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="streamable-http">streamable-http</option>
            <option value="sse">sse</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-auth-type">
            Auth
          </label>
          <select
            id="edit-auth-type"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as 'none' | 'bearer')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="none">none</option>
            <option value="bearer">bearer</option>
          </select>
        </div>
      </div>

      {authType === 'bearer' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="edit-auth-token">
            Bearer token
          </label>
          <input
            id="edit-auth-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {ok && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">Changes saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
