/**
 * Starts the Worker the Playwright suite runs against. Development only.
 *
 * Why this exists rather than a plain `wrangler dev` command:
 *
 *   1. The admin flows need real secrets. This derives a throwaway passcode
 *      hash at start-up and passes it, plus a per-run session secret, as
 *      `--var` values. No secret is written to a file, committed, or shared
 *      with the developer's own `.dev.vars`.
 *
 *   2. The first-run flow needs an EMPTY database. This gives the run its own
 *      D1 in `.wrangler/e2e-state`, recreated from scratch every time, so the
 *      developer's local data in `.wrangler/state` is never touched and the
 *      "no organization yet" precondition is guaranteed.
 *
 * Everything the suite needs afterwards is provisioned through the real admin
 * API by `e2e/admin.setup.ts`, not by seeding SQL.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createPasscodeHash } from '../src/server/lib/passcode.js';
import { E2E_ADMIN_PASSCODE, E2E_PORT } from '../e2e/e2eConfig.js';

const PERSIST_DIR = '.wrangler/e2e-state';

// Wrangler does not export its CLI entry point, so it is addressed by path.
// Running it through `node` rather than `npx` keeps the command shell-free,
// which matters because the passcode hash contains `$`.
const wranglerBin = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!existsSync(wranglerBin)) {
  throw new Error(`Could not find the wrangler CLI at ${wranglerBin}. Run npm install first.`);
}

/** Invoked through Node directly, so no shell quoting is involved on any OS. */
function wrangler(args: readonly string[], inherit: boolean): ReturnType<typeof spawn> {
  return spawn(process.execPath, [wranglerBin, ...args], {
    stdio: inherit ? 'inherit' : 'pipe',
  });
}

function wranglerSync(args: readonly string[]): void {
  const result = spawnSync(process.execPath, [wranglerBin, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main(): Promise<void> {
  // A fresh database every run: the admin first-run flow must find no
  // organization, and no test may depend on the order of a previous run.
  rmSync(PERSIST_DIR, { recursive: true, force: true });

  wranglerSync(['d1', 'migrations', 'apply', 'pulse_check', '--local', '--persist-to', PERSIST_DIR]);

  const passcodeHash = await createPasscodeHash(E2E_ADMIN_PASSCODE);
  const sessionSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');

  const child = wrangler(
    [
      'dev',
      '--port',
      String(E2E_PORT),
      '--local',
      '--persist-to',
      PERSIST_DIR,
      '--var',
      `ADMIN_PASSCODE_HASH:${passcodeHash}`,
      '--var',
      `SESSION_SECRET:${sessionSecret}`,
    ],
    true,
  );

  const stop = (): void => {
    child.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  child.on('exit', (code) => process.exit(code ?? 0));
}

void main();
