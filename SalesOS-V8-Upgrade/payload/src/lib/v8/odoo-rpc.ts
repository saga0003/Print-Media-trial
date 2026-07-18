type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { message?: string; data?: { message?: string; debug?: string } };
};

const baseUrl = () => {
  const raw = process.env.ODOO_URL?.trim();
  if (!raw) throw new Error("ODOO_URL is missing");
  return raw.replace(/\/+$/, "");
};

const database = () => {
  const value = process.env.ODOO_DB?.trim();
  if (!value) throw new Error("ODOO_DB is missing");
  return value;
};

const username = () => {
  const value = process.env.ODOO_USERNAME?.trim();
  if (!value) throw new Error("ODOO_USERNAME is missing");
  return value;
};

const secret = () => {
  const value = process.env.ODOO_API_KEY?.trim();
  if (!value) throw new Error("ODOO_API_KEY is missing");
  return value;
};

let requestId = 0;
let uidPromise: Promise<number> | null = null;

async function jsonRpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${baseUrl()}/jsonrpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: ++requestId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    const message =
      payload.error.data?.message ||
      payload.error.message ||
      "Odoo RPC request failed";
    throw new Error(message);
  }
  return payload.result as T;
}

export async function authenticateOdoo(): Promise<number> {
  if (!uidPromise) {
    uidPromise = jsonRpc<number>("common", "authenticate", [
      database(),
      username(),
      secret(),
      {},
    ]).then((uid) => {
      if (!uid) throw new Error("Odoo authentication failed");
      return uid;
    });
  }
  return uidPromise;
}

export function normaliseDomain(domain: unknown): unknown[][] {
  if (!Array.isArray(domain)) return [];
  if (domain.length === 0) return [];

  const isLeaf =
    domain.length >= 3 &&
    typeof domain[0] === "string" &&
    typeof domain[1] === "string";

  if (isLeaf) return [domain as unknown[]];

  return domain.filter((item): item is unknown[] => Array.isArray(item));
}

export async function executeKw<T>(
  model: string,
  method: string,
  positional: unknown[] = [],
  keyword: Record<string, unknown> = {},
): Promise<T> {
  const uid = await authenticateOdoo();
  const args = positional.length > 0 ? positional : [];

  if (
    (method === "search" || method === "search_read" || method === "search_count") &&
    args.length > 0
  ) {
    args[0] = normaliseDomain(args[0]);
  }

  return jsonRpc<T>("object", "execute_kw", [
    database(),
    uid,
    secret(),
    model,
    method,
    args,
    keyword,
  ]);
}

export async function searchRead<T>(
  model: string,
  domain: unknown,
  fields: string[],
  options: Record<string, unknown> = {},
): Promise<T[]> {
  return executeKw<T[]>(model, "search_read", [normaliseDomain(domain)], {
    fields,
    ...options,
  });
}

export async function readByIds<T>(
  model: string,
  ids: number[],
  fields: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  return executeKw<T[]>(model, "read", [ids], { fields });
}

export function odooRecordUrl(leadId: number): string {
  return `${baseUrl()}/web#id=${leadId}&model=crm.lead&view_type=form`;
}
