/**
 * Generates an ADMIN_PASSCODE_HASH for a deployment.
 *
 *   npm run admin:hash-passcode
 *
 * Design constraints (brief 12):
 *   - the passcode is never a command-line argument, so it cannot end up in
 *     shell history or a process listing;
 *   - the passcode is never written to a file, never echoed, and never printed;
 *   - only the encoded hash and setup instructions reach stdout;
 *   - a fresh cryptographic salt per run, in the application's single format.
 *
 * On a real terminal the prompt is read through readline with its output muted,
 * which suppresses echo identically in Windows Terminal, PowerShell and a POSIX
 * shell using Node built-ins only. Echo cannot be suppressed on a pipe, so the
 * non-interactive path says so plainly and reads stdin directly rather than
 * pretending the input was hidden.
 */

import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { createPasscodeHash, PBKDF2_ITERATIONS } from '../src/server/lib/passcode.js';
import { ADMIN_PASSCODE_MIN_LENGTH, ADMIN_PASSCODE_MAX_LENGTH } from '../src/core/admin/schemas.js';

class MutableOutput extends Writable {
  public muted = false;

  override _write(
    chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (!this.muted) process.stdout.write(chunk as string);
    callback();
  }
}

function fail(message: string): never {
  process.stderr.write(`\n${message}\n`);
  process.exit(1);
}

/** Terminal prompt with echo suppressed. */
async function promptHidden(question: string): Promise<string> {
  const output = new MutableOutput();
  const rl = createInterface({ input: process.stdin, output, terminal: true });

  process.stdout.write(question);
  output.muted = true;

  try {
    return await new Promise<string>((resolve) => {
      rl.question('', resolve);
    });
  } finally {
    output.muted = false;
    rl.close();
    process.stdout.write('\n');
  }
}

async function readAllStdin(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}

async function main(): Promise<void> {
  process.stdout.write('AI Adoption Pulse Check - admin passcode hash generator\n\n');

  const interactive = process.stdin.isTTY === true;
  let piped: string[] = [];
  let pipedIndex = 0;

  if (!interactive) {
    process.stdout.write(
      'Note: stdin is not an interactive terminal, so the passcode cannot be hidden as you type.\n' +
        'Run this in a normal terminal window if that matters.\n\n',
    );
    piped = await readAllStdin();
  }

  const prompt = async (question: string): Promise<string> => {
    if (interactive) return promptHidden(question);

    process.stdout.write(`${question}\n`);
    const line = piped[pipedIndex];
    pipedIndex += 1;
    if (line === undefined) fail('No passcode was provided on stdin.');
    return line;
  };

  const passcode = await prompt('Admin passcode: ');
  if (passcode.length < ADMIN_PASSCODE_MIN_LENGTH) {
    fail(`The passcode must be at least ${ADMIN_PASSCODE_MIN_LENGTH} characters.`);
  }
  if (passcode.length > ADMIN_PASSCODE_MAX_LENGTH) {
    fail(`The passcode must be at most ${ADMIN_PASSCODE_MAX_LENGTH} characters.`);
  }

  const confirmation = await prompt('Confirm passcode: ');
  if (confirmation !== passcode) fail('The two entries did not match. Nothing was generated.');

  process.stdout.write(
    `Deriving the hash (${PBKDF2_ITERATIONS.toLocaleString('en-US')} iterations)...\n\n`,
  );
  const hash = await createPasscodeHash(passcode);

  process.stdout.write(`ADMIN_PASSCODE_HASH=${JSON.stringify(hash)}\n\n`);
  process.stdout.write(
    [
      'Next steps',
      '',
      '  Local development',
      '    1. Copy .dev.vars.example to .dev.vars if you have not already.',
      '    2. Paste the line above into .dev.vars.',
      '    3. Set SESSION_SECRET to at least 32 random characters:',
      '         node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      '',
      '  Deployment',
      '    wrangler secret put ADMIN_PASSCODE_HASH',
      '    wrangler secret put SESSION_SECRET',
      '',
      'The passcode itself was not stored or printed. Keep it in a password',
      'manager - there is no recovery flow, and re-running this script with a',
      'new passcode is the only way to change it.',
      '',
    ].join('\n'),
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : 'Could not read the passcode.');
});
