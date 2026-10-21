import { Pool, type PoolClient } from 'pg';

export interface Db {
  readonly pool: Pool;
  withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDb(databaseUrl: string): Db {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'tally',
    options: '-c timezone=Asia/Hong_Kong',
  });

  pool.on('error', () => {
    // Idle client errors are surfaced by the next query; avoid crashing the process.
  });

  return {
    pool,
    async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await work(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
    async health(): Promise<boolean> {
      try {
        await pool.query('select 1');
        return true;
      } catch {
        return false;
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
