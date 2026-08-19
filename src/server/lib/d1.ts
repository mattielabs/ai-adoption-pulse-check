/**
 * Minimal structural typing for the D1 binding.
 *
 * The server declares only the surface it actually uses, rather than the full
 * `@cloudflare/workers-types` D1Database. Two reasons:
 *
 *   1. Route handlers become unit-testable in plain Node - a test can supply
 *      an in-memory object satisfying this interface without pulling Workers
 *      global types into the test project (where they collide with DOM/Node
 *      globals).
 *   2. It documents exactly which D1 features the codebase relies on:
 *      parameterized prepare/bind and first/all/run. Nothing else.
 *
 * The real D1Database satisfies these interfaces structurally, so `wrangler`
 * hands the binding straight through with no casting.
 */

export interface D1BoundStatement {
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ readonly results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1PreparedStatementLike extends D1BoundStatement {
  /** Every query with inputs goes through bind(). Never interpolate into SQL. */
  bind(...values: unknown[]): D1BoundStatement;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;

  /**
   * Runs prepared statements as a single transaction. D1 rolls the whole
   * sequence back if any statement fails, which is what makes "create a Pulse
   * and its custom questions" atomic - there is no state where a Pulse exists
   * with half its configuration.
   */
  batch(statements: readonly D1BoundStatement[]): Promise<readonly unknown[]>;
}
