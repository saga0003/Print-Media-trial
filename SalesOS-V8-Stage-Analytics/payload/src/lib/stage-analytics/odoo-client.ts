type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: { message?: string; debug?: string };
  };
};

export type OdooDomainTerm = [string, string, unknown];
export type OdooDomain = Array<OdooDomainTerm | '&' | '|' | '!'>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function normalizeDomain(domain: unknown): OdooDomain {
  if (!Array.isArray(domain)) return [];
  if (domain.length === 3 && typeof domain[0] === 'string' && typeof domain[1] === 'string') {
    return [domain as OdooDomainTerm];
  }

  const normalized: OdooDomain = [];
  for (const item of domain) {
    if (item === '&' || item === '|' || item === '!') {
      normalized.push(item);
      continue;
    }
    if (Array.isArray(item) && item.length === 3 && typeof item[0] === 'string') {
      normalized.push(item as OdooDomainTerm);
      continue;
    }
    if (Array.isArray(item)) normalized.push(...normalizeDomain(item));
  }
  return normalized;
}

export class StageOdooClient {
  private readonly url = requiredEnv('ODOO_URL').replace(/\/$/, '');
  private readonly db = requiredEnv('ODOO_DB');
  private readonly username = requiredEnv('ODOO_USERNAME');
  private readonly apiKey = requiredEnv('ODOO_API_KEY');
  private uid: number | null = null;
  private requestId = 1;

  private async rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
    const response = await fetch(`${this.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { service, method, args },
        id: this.requestId++,
      }),
    });

    const payload = (await response.json()) as JsonRpcResponse<T>;
    if (!response.ok || payload.error) {
      const message = payload.error?.data?.message || payload.error?.message || `Odoo RPC failed with HTTP ${response.status}.`;
      const debug = process.env.ODOO_DEBUG_ERRORS === 'true' ? payload.error?.data?.debug : undefined;
      throw new Error(debug ? `${message}\n${debug}` : message);
    }
    return payload.result as T;
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const uid = await this.rpc<number>('common', 'login', [this.db, this.username, this.apiKey]);
    if (!uid) throw new Error('Odoo authentication failed. Check ODOO_DB, ODOO_USERNAME and ODOO_API_KEY.');
    this.uid = uid;
    return uid;
  }

  async execute<T>(model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
    const uid = await this.authenticate();
    const normalizedArgs = [...args];
    if ((method === 'search' || method === 'search_read' || method === 'search_count') && normalizedArgs.length > 0) {
      normalizedArgs[0] = normalizeDomain(normalizedArgs[0]);
    }
    return this.rpc<T>('object', 'execute_kw', [this.db, uid, this.apiKey, model, method, normalizedArgs, kwargs]);
  }

  async searchRead<T extends Record<string, unknown>>(
    model: string,
    domain: OdooDomain,
    fields: string[],
    options: { offset?: number; limit?: number; order?: string } = {},
  ): Promise<T[]> {
    return this.execute<T[]>(model, 'search_read', [normalizeDomain(domain)], {
      fields,
      offset: options.offset ?? 0,
      limit: options.limit ?? 0,
      order: options.order,
    });
  }

  async searchReadAll<T extends Record<string, unknown>>(
    model: string,
    domain: OdooDomain,
    fields: string[],
    options: { batchSize?: number; maxRows?: number; order?: string } = {},
  ): Promise<T[]> {
    const batchSize = Math.max(50, Math.min(options.batchSize ?? 500, 2000));
    const maxRows = Math.max(1, options.maxRows ?? 50000);
    const rows: T[] = [];
    let offset = 0;

    while (rows.length < maxRows) {
      const chunk = await this.searchRead<T>(model, domain, fields, {
        offset,
        limit: Math.min(batchSize, maxRows - rows.length),
        order: options.order,
      });
      rows.push(...chunk);
      if (chunk.length < batchSize) break;
      offset += chunk.length;
    }
    return rows;
  }

  async read<T extends Record<string, unknown>>(model: string, ids: number[], fields: string[]): Promise<T[]> {
    if (!ids.length) return [];
    return this.execute<T[]>(model, 'read', [ids], { fields });
  }
}

export function many2oneId(value: unknown): number | undefined {
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0];
  if (typeof value === 'number') return value;
  return undefined;
}

export function many2oneName(value: unknown): string {
  if (Array.isArray(value) && value.length > 1) return String(value[1] ?? '');
  return '';
}

export function chunkIds(ids: number[], size = 500): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size));
  return chunks;
}
