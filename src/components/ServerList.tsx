'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import type { McpServer, McpTool } from '@/types';
import ToolList from './ToolList';

interface Props {
  servers: McpServer[];
  selectedServerId?: string;
  selectedToDelete: string[];
  allSelected: boolean;
  someSelected: boolean;
  onSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onToggleSelectForDelete: (id: string) => void;
  onUpdated: (server: McpServer) => void;
}

export default function ServerList({
  servers,
  selectedServerId,
  selectedToDelete,
  allSelected,
  someSelected,
  onSelect,
  onToggleSelectAll,
  onToggleSelectForDelete,
  onUpdated,
}: Props) {
  const [discovering, setDiscovering] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  if (servers.length === 0) {
    return <p className="text-sm text-gray-500">No servers registered yet.</p>;
  }

  const handleDiscover = async (server: McpServer): Promise<boolean> => {
    setDiscovering((prev) => ({ ...prev, [server.id]: true }));
    setRowError((prev) => ({ ...prev, [server.id]: '' }));

    try {
      const res = await fetch(`/api/servers/${server.id}/discover`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setRowError((prev) => ({
          ...prev,
          [server.id]: data.details ?? data.error ?? 'Discovery failed',
        }));
        return false;
      }

      onUpdated({
        ...server,
        tools: data.tools as McpTool[],
        status: 'active',
        lastDiscoveredAt: data.discoveredAt,
        error: undefined,
      });
      return true;
    } catch {
      setRowError((prev) => ({
        ...prev,
        [server.id]: 'Network error during discovery',
      }));
      return false;
    } finally {
      setDiscovering((prev) => ({ ...prev, [server.id]: false }));
    }
  };

  const toggleExpanded = async (server: McpServer) => {
    const id = server.id;
    const isExpanded = expanded[id] ?? false;
    if (isExpanded) {
      setExpanded((prev) => ({ ...prev, [id]: false }));
      return;
    }

    const ok = await handleDiscover(server);
    if (ok) {
      setExpanded((prev) => ({ ...prev, [id]: true }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full border-separate border-spacing-0">
        <colgroup>
          <col className="w-10" />
          <col className="w-[24%]" />
          <col className="w-[40%]" />
          <col className="w-[10%]" />
          <col className="w-[26%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="border-b border-gray-200 px-2 py-2 font-semibold">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all servers"
                title="Select all servers"
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="border-b border-gray-200 px-3 py-2 font-semibold">Name</th>
            <th className="border-b border-gray-200 px-3 py-2 font-semibold">URL</th>
            <th className="border-b border-gray-200 px-3 py-2 font-semibold">Tools</th>
            <th className="border-b border-gray-200 px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => {
            const isSelected = selectedServerId === server.id;
            const isDiscovering = discovering[server.id] ?? false;
            const err = rowError[server.id] ?? server.error;
            const toolCount = server.tools?.length ?? 0;
            const isExpanded = expanded[server.id] ?? false;
            const checked = selectedToDelete.includes(server.id);

            return (
              <Fragment key={server.id}>
                <tr
                  className={`border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <td className="px-2 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelectForDelete(server.id)}
                      className="mt-1 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <button onClick={() => onSelect(server.id)} className="w-full text-left">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-gray-900">{server.name}</p>
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="max-w-[360px] truncate text-sm text-gray-700">{server.url}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{server.transport ?? 'streamable-http'}</p>
                  </td>
                  <td className="px-3 py-2 align-top text-sm text-gray-700">{toolCount}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void toggleExpanded(server)}
                        disabled={isDiscovering}
                        aria-label={isExpanded ? 'Hide tools' : 'Discover and show tools'}
                        title={isExpanded ? 'Hide tools' : 'Discover and show tools'}
                        className="inline-flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDiscovering ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 3a9 9 0 1 0 9 9"
                            />
                          </svg>
                        ) : isExpanded ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                          </svg>
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.7 6.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-6.9 6.9a2 2 0 0 1-.9.52l-2.2.55.55-2.2a2 2 0 0 1 .52-.9l6.9-6.9Z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 7.5 3 3" />
                          </svg>
                        )}
                      </button>

                    </div>
                  </td>
                </tr>
                {(err || (isExpanded && toolCount > 0)) && (
                  <tr className={isSelected ? 'bg-blue-50' : 'bg-white'}>
                    <td colSpan={5} className="border-b border-gray-100 px-3 pb-3 pt-1">
                      {err && <p className="mb-2 text-xs text-red-700">{err}</p>}
                      {isExpanded && toolCount > 0 && (
                        <div className="rounded border border-gray-200 bg-white p-2">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Registered tools
                          </p>
                          <ToolList tools={server.tools ?? []} compact />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
