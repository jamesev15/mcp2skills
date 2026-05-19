#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_PORT = 4310;

function parseArgs(argv) {
  const args = {
    port: process.env.PORT || String(DEFAULT_PORT),
    host: process.env.HOST || '127.0.0.1',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--port' || arg === '-p') && argv[i + 1]) {
      args.port = argv[i + 1];
      i += 1;
      continue;
    }
    if ((arg === '--host' || arg === '-H') && argv[i + 1]) {
      args.host = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function validatePort(port) {
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  return parsed;
}

function ensureDataFile(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  const dataFile = path.join(dataDir, 'servers.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]', 'utf8');
  }
}

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  const { port, host } = parseArgs(process.argv.slice(2));
  const resolvedPort = validatePort(port);

  ensureDataFile(rootDir);

  const nextBin = require.resolve('next/dist/bin/next');
  const child = spawn(
    process.execPath,
    [nextBin, 'dev', '--port', String(resolvedPort), '--hostname', String(host)],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        APP_BASE_URL: process.env.APP_BASE_URL || `http://${host}:${resolvedPort}`,
      },
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
