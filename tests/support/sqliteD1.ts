/**
 * A `D1DatabaseLike` backed by real SQLite (`node:sqlite`, built into Node 24)
 * with the project's real migrations applied.
 *
 * The public-API tests use a hand-written fake because they assert exactly
 * which values reach the INSERT. The admin tests need the opposite: real
 * constraint enforcement. Foreign-key cascade on delete, the unique index on
 * `public_id`, the custom-question position range, the day-granularity CHECKs
 * and - most importantly - transactional rollback of a partially failed
 * `batch()` are all behaviours worth testing against a database engine rather
 * than against a mock that would simply agree with the implementation.
 *
 * This is not a claim that SQLite and D1 are identical. D1 is SQLite, and the
 * migrations are the same files `wrangler d1 migrations apply` runs, but the
 * end-to-end proof still happens against real local D1 in the Playwright run.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { D1BoundStatement, D1DatabaseLike, D1PreparedStatementLike } from '../../src/server/lib/d1.js';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

/** Marks a statement as executable inside batch(), without widening the public interface. */
const EXECUTE = Symbol('execute');

type SqlParam = string | number | null;

interface BatchableStatement extends D1BoundStatement {
  readonly [EXECUTE]: () => void;
}

function coerce(values: readonly unknown[]): SqlParam[] {
  return values.map((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number' || typeof value === 'string') return value;
    return String(value);
  });
}

export interface SqliteD1 extends D1DatabaseLike {
  /** Direct access for test assertions and seeding. */
  readonly raw: DatabaseSync;
  close(): void;
}

export function createSqliteD1(): SqliteD1 {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    raw.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  // Migration 0002 rebuilds a table with foreign keys deferred; re-assert the
  // pragma so later cascade behaviour is exercised as it is in D1.
  raw.exec('PRAGMA foreign_keys = ON');

  function bound(sql: string, params: readonly unknown[]): BatchableStatement {
    const args = coerce(params);
    return {
      first<T>(): Promise<T | null> {
        return Promise.resolve((raw.prepare(sql).get(...args) as T | undefined) ?? null);
      },
      all<T>(): Promise<{ readonly results: T[] }> {
        return Promise.resolve({ results: raw.prepare(sql).all(...args) as T[] });
      },
      run(): Promise<unknown> {
        return Promise.resolve(raw.prepare(sql).run(...args));
      },
      [EXECUTE](): void {
        raw.prepare(sql).run(...args);
      },
    };
  }

  return {
    raw,
    close: () => raw.close(),

    prepare(sql: string): D1PreparedStatementLike {
      return {
        bind: (...values: unknown[]) => bound(sql, values),
        ...bound(sql, []),
      };
    },

    batch(statements: readonly D1BoundStatement[]): Promise<readonly unknown[]> {
      raw.exec('BEGIN');
      try {
        for (const statement of statements) {
          (statement as BatchableStatement)[EXECUTE]();
        }
        raw.exec('COMMIT');
        return Promise.resolve(statements.map(() => ({ success: true })));
      } catch (error) {
        raw.exec('ROLLBACK');
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}
