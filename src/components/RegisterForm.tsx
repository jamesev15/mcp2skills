'use client';

import { useState } from 'react';
import type { McpServer, TransportType } from '@/types';

interface Props {
  onRegistered: (server: McpServer) => void;
}

export default function RegisterForm({ onRegistered }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState('');
  const [transport, setTransport] = useState<TransportType>('streamable-http');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          owner: owner || undefined,
          transport,
          auth: authType === 'bearer' ? { type: 'bearer', token } : { type: 'none' },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Registration failed');
        return;
      }

      onRegistered(data as McpServer);
      setName('');
      setUrl('');
      setOwner('');
      setTransport('streamable-http');
      setAuthType('none');
      setToken('');
    } catch {
      setError('Network error - could not reach the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="server-name">
          Server name
        </label>
        <input
          id="server-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-mcp-server"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="server-url">
          Server URL
        </label>
        <input
          id="server-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://my-mcp-server.example.com/mcp"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="server-owner">
          Owner (optional)
        </label>
        <input
          id="server-owner"
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="team-ml"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="transport">
            Transport
          </label>
          <select
            id="transport"
            value={transport}
            onChange={(e) => setTransport(e.target.value as TransportType)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="streamable-http">streamable-http</option>
            <option value="sse">sse</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="auth-type">
            Auth
          </label>
          <select
            id="auth-type"
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
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="auth-token">
            Bearer token
          </label>
          <input
            id="auth-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Registering…' : 'Register server'}
      </button>
    </form>
  );
}
