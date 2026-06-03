'use client';

import { useEffect, useMemo, useState } from 'react';
import type { McpServer } from '@/types';
import RegisterForm from '@/components/RegisterForm';
import ServerEditor from '@/components/ServerEditor';
import ServerList from '@/components/ServerList';

type RightPanel = 'register' | 'edit';
type BulkActionType = 'zip' | 'install-claude' | 'install-agents' | 'delete';
type InstallTarget = 'claude' | 'agents';

interface BulkResultItem {
  id: string;
  name: string;
  ok: boolean;
  message: string;
}

export default function HomePage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | undefined>(undefined);
  const [selectedToDelete, setSelectedToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkInstalling, setBulkInstalling] = useState(false);
  const [bulkZipping, setBulkZipping] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    action: BulkActionType;
    items: BulkResultItem[];
  } | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>('register');

  useEffect(() => {
    fetch('/api/servers')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as McpServer[]) : [];
        setServers(list);
        if (list.length > 0) {
          setSelectedServerId(list[0].id);
          setRightPanel('edit');
        }
      })
      .catch(() => {
        setServers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedServerId),
    [servers, selectedServerId]
  );
  const allSelected = servers.length > 0 && selectedToDelete.length === servers.length;
  const someSelected = selectedToDelete.length > 0 && selectedToDelete.length < servers.length;

  const handleRegistered = (server: McpServer) => {
    setServers((prev) => [server, ...prev]);
    setSelectedServerId(server.id);
    setRightPanel('edit');
  };

  const handleUpdated = (updated: McpServer) => {
    setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSelectServer = (id: string) => {
    setSelectedServerId(id);
    setRightPanel('edit');
  };

  const handleToggleSelectForDelete = (id: string) => {
    setSelectedToDelete((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedToDelete((prev) => (prev.length === servers.length ? [] : servers.map((s) => s.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedToDelete.length === 0 || bulkDeleting) return;

    setBulkSummary(null);
    setBulkDeleting(true);
    const ids = [...selectedToDelete];

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
          return { id, ok: res.ok };
        })
      );

      const deletedIds = results.filter((r) => r.ok).map((r) => r.id);
      if (deletedIds.length > 0) {
        let nextSelection: string | undefined;
        let nextPanel: RightPanel = 'register';
        setServers((prev) => {
          const remaining = prev.filter((s) => !deletedIds.includes(s.id));
          if (selectedServerId && deletedIds.includes(selectedServerId)) {
            nextSelection = remaining[0]?.id;
            nextPanel = remaining.length > 0 ? 'edit' : 'register';
          }
          return remaining;
        });
        setSelectedToDelete((prev) => prev.filter((id) => !deletedIds.includes(id)));
        if (selectedServerId && deletedIds.includes(selectedServerId)) {
          setSelectedServerId(nextSelection);
          setRightPanel(nextPanel);
        }
      }

      setBulkSummary({
        action: 'delete',
        items: results.map((result) => ({
          id: result.id,
          name: servers.find((server) => server.id === result.id)?.name ?? result.id,
          ok: result.ok,
          message: result.ok ? 'Deleted' : 'Delete failed',
        })),
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const discoverServer = async (server: McpServer): Promise<McpServer | null> => {
    const res = await fetch(`/api/servers/${server.id}/discover`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return null;

    const updated: McpServer = {
      ...server,
      tools: Array.isArray(data.tools) ? data.tools : [],
      status: 'active',
      lastDiscoveredAt: data.discoveredAt,
      error: undefined,
    };
    setServers((prev) => prev.map((s) => (s.id === server.id ? updated : s)));
    return updated;
  };

  const downloadSkillZip = async (server: McpServer) => {
    const res = await fetch(`/api/servers/${server.id}/skill`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.details ?? data.error ?? 'ZIP download failed');
    }

    const blob = await res.blob();
    const safeName = server.name.replace(/[^a-z0-9]/gi, '_') || server.id;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `skill-${safeName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const handleBulkInstall = async (target: InstallTarget) => {
    if (selectedToDelete.length === 0 || bulkInstalling || bulkDeleting || bulkZipping) return;

    setBulkSummary(null);
    setBulkInstalling(true);
    const selectedServers = servers.filter((server) => selectedToDelete.includes(server.id));
    const results: BulkResultItem[] = [];

    try {
      for (const server of selectedServers) {
        try {
          const hasTools = (server.tools?.length ?? 0) > 0;
          const readyServer = hasTools ? server : await discoverServer(server);
          if (!readyServer || (readyServer.tools?.length ?? 0) === 0) {
            results.push({
              id: server.id,
              name: server.name,
              ok: false,
              message: 'Discovery failed or no tools available',
            });
            continue;
          }

          const res = await fetch(`/api/servers/${server.id}/skill/install?target=${target}`, {
            method: 'POST',
          });
          const data = await res.json();
          if (!res.ok) {
            results.push({
              id: server.id,
              name: server.name,
              ok: false,
              message: data.details ?? data.error ?? 'Install failed',
            });
            continue;
          }

          results.push({
            id: server.id,
            name: server.name,
            ok: true,
            message: `Installed in ${data.installedPathDisplay ?? data.installedPath}`,
          });
        } catch {
          results.push({
            id: server.id,
            name: server.name,
            ok: false,
            message: 'Network error during install',
          });
        }
      }
    } finally {
      setBulkSummary({
        action: target === 'claude' ? 'install-claude' : 'install-agents',
        items: results,
      });
      setBulkInstalling(false);
    }
  };

  const handleBulkZipDownload = async () => {
    if (selectedToDelete.length === 0 || bulkZipping || bulkDeleting || bulkInstalling) return;

    setBulkSummary(null);
    setBulkZipping(true);
    const selectedServers = servers.filter((server) => selectedToDelete.includes(server.id));
    const results: BulkResultItem[] = [];

    try {
      for (const server of selectedServers) {
        try {
          const hasTools = (server.tools?.length ?? 0) > 0;
          const readyServer = hasTools ? server : await discoverServer(server);
          if (!readyServer || (readyServer.tools?.length ?? 0) === 0) {
            results.push({
              id: server.id,
              name: server.name,
              ok: false,
              message: 'Discovery failed or no tools available',
            });
            continue;
          }

          await downloadSkillZip(readyServer);
          results.push({
            id: server.id,
            name: server.name,
            ok: true,
            message: 'ZIP downloaded',
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Network error during ZIP download';
          results.push({
            id: server.id,
            name: server.name,
            ok: false,
            message,
          });
        }
      }
    } finally {
      setBulkSummary({ action: 'zip', items: results });
      setBulkZipping(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">mcp2skills</h1>
        <p className="mt-1 text-gray-500">
          Register MCP servers and convert them to TypeScript skills
        </p>
      </header>

      {bulkSummary && (
        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              {bulkSummary.action === 'zip'
                ? 'ZIP Batch Summary'
                : bulkSummary.action === 'install-claude'
                  ? 'Claude Code Install Summary'
                  : bulkSummary.action === 'install-agents'
                    ? 'Agents Install Summary'
                    : 'Delete Batch Summary'}
            </h2>
            <p className="text-xs text-gray-500">
              {bulkSummary.items.filter((item) => item.ok).length} success,{' '}
              {bulkSummary.items.filter((item) => !item.ok).length} failed
            </p>
          </div>
          <ul className="space-y-1">
            {bulkSummary.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className={item.ok ? 'text-emerald-700' : 'text-red-700'}>{item.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Servers</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBulkZipDownload}
                disabled={selectedToDelete.length === 0 || bulkDeleting || bulkInstalling || bulkZipping}
                aria-label="Download ZIP for selected servers"
                title="Download ZIP for selected"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m12 10 3 3m0 0-3 3m3-3H9" />
                </svg>
                {bulkZipping ? '...' : 'ZIP'}
              </button>
              <button
                onClick={() => handleBulkInstall('claude')}
                disabled={selectedToDelete.length === 0 || bulkDeleting || bulkInstalling || bulkZipping}
                aria-label="Install selected skills in Claude Code"
                title="Install in ~/.claude/skills"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8 11 4 4 4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14" />
                </svg>
                {bulkInstalling ? '...' : 'Claude Code'}
              </button>
              <button
                onClick={() => handleBulkInstall('agents')}
                disabled={selectedToDelete.length === 0 || bulkDeleting || bulkInstalling || bulkZipping}
                aria-label="Install selected skills in Agents"
                title="Install in ~/.agents/skills"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-600 px-2.5 text-xs font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8 10 4 4 4-4" />
                  <rect x="4" y="18" width="16" height="2" rx="1" />
                </svg>
                {bulkInstalling ? '...' : 'Agents'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedToDelete.length === 0 || bulkDeleting || bulkInstalling || bulkZipping}
                aria-label="Delete selected servers"
                title="Delete selected"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <span className="text-sm leading-none">...</span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 .93h6a1 1 0 0 0 1-.93L17 6"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 10v6M14 10v6" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setRightPanel('register')}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
                  rightPanel === 'register'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                New
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <ServerList
                servers={servers}
                selectedServerId={selectedServerId}
                selectedToDelete={selectedToDelete}
                allSelected={allSelected}
                someSelected={someSelected}
                onSelect={handleSelectServer}
                onToggleSelectAll={handleToggleSelectAll}
                onToggleSelectForDelete={handleToggleSelectForDelete}
                onUpdated={handleUpdated}
              />
            </div>
          )}
        </aside>

        <section className="min-h-[420px] rounded-xl border border-gray-200 bg-white p-5 lg:sticky lg:top-6 lg:h-fit">
          {rightPanel === 'register' ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Register a new MCP server</h2>
              <RegisterForm onRegistered={handleRegistered} />
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Edit server</h2>
                <button
                  onClick={() => setRightPanel('register')}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Register another
                </button>
              </div>
              <ServerEditor server={selectedServer} onUpdated={handleUpdated} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
