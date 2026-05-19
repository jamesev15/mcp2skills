import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { McpServer } from '@/types';

const DATA_DIR = path.join(os.homedir(), '.mcp2skills');
const DATA_FILE = path.join(DATA_DIR, 'servers.json');

let cache: Map<string, McpServer> | null = null;

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function loadStore(): Map<string, McpServer> {
  if (cache) return cache;

  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as McpServer[];
    cache = new Map(parsed.map((server) => [server.id, server]));
  } catch {
    cache = new Map();
  }

  return cache;
}

function persistStore(store: Map<string, McpServer>): void {
  const list = Array.from(store.values());
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function getAllServers(): McpServer[] {
  const store = loadStore();
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getServer(id: string): McpServer | undefined {
  return loadStore().get(id);
}

export function saveServer(server: McpServer): void {
  const store = loadStore();
  store.set(server.id, server);
  persistStore(store);
}

export function deleteServer(id: string): boolean {
  const store = loadStore();
  const removed = store.delete(id);
  if (removed) persistStore(store);
  return removed;
}
