declare module "pg" {
  export class Pool {
    constructor(options: { connectionString: string });
    query<T = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: T[] }>;
  }
}
