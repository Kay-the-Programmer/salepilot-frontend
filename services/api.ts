import { dbService } from './dbService';

// Determine API base URL
const DEFAULT_BASE_URL = 'http://localhost:5000/api';
// Optional runtime override: window.__API_URL or <meta name="app:apiUrl" content="...">
const RUNTIME_BASE = (typeof window !== 'undefined' && (window as any).__API_URL) ||
  (typeof document !== 'undefined' ? document.querySelector('meta[name="app:apiUrl"]')?.getAttribute('content') || undefined : undefined);
const ENV_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_URL) || undefined;
const BASE_URL = (RUNTIME_BASE || ENV_BASE || DEFAULT_BASE_URL).replace(/\/+$/, '');

// Storage key used by authService
const CURRENT_USER_KEY = 'salePilotUser';

// Online status helpers
export const getOnlineStatus = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
};

// Bridge native online/offline to a custom event used in App
if (typeof window !== 'undefined') {
  const dispatchStatus = () => window.dispatchEvent(new Event('onlineStatusChange'));
  window.addEventListener('online', dispatchStatus);
  window.addEventListener('offline', dispatchStatus);
}

// Internal helper to get auth header
const getAuthHeaders = (): Record<string, string> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return {};
    const user = JSON.parse(raw);
    if (user && user.token) {
      return { Authorization: `Bearer ${user.token}` };
    }
  } catch (_) {}
  return {};
};

// Generic fetch wrapper
async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && (init.body as any) instanceof FormData;
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!isFormData && !('Content-Type' in headers) && !('content-type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(url, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    let message = text || `Request failed with status ${resp.status}`;
    try {
      const json = JSON.parse(text);
      message = json.message || message;
    } catch (_) {}
    throw new Error(message);
  }
  // Try parse JSON, allow empty
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await resp.json()) as T;
  }
  // @ts-ignore - for endpoints that return nothing
  return undefined as T;
}

// When offline or network fails during a mutation, enqueue and return an offline marker
// Serialize RequestInit for IndexedDB-safe storage (FormData is not cloneable)
function serializeOptionsForQueue(options: RequestInit): any {
  const out: any = { method: options.method };
  if (options.headers) out.headers = options.headers;
  const body: any = (options as any).body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const entries: any[] = [];
    body.forEach((value, key) => {
      if (value instanceof Blob) {
        // Keep Blob/File as is (structured clone supports it); preserve filename if present
        const file: any = value as any;
        entries.push({ k: key, t: 'blob', v: value, n: file.name || undefined, m: value.type || undefined });
      } else {
        entries.push({ k: key, t: 'string', v: String(value) });
      }
    });
    out.body = { _form: true, entries };
  } else if (typeof body === 'string') {
    out.body = body; // JSON string
  } else if (body != null) {
    try {
      out.body = JSON.stringify(body);
    } catch {
      out.body = String(body);
    }
  }
  return out;
}

async function queueAndReturn<T>(endpoint: string, options: RequestInit, bodyEcho?: any): Promise<T & { offline: true }>
{
  const serialized = serializeOptionsForQueue(options);
  await dbService.addMutationToQueue(endpoint, serialized);
  const echo: any = bodyEcho && typeof bodyEcho === 'object' ? { ...bodyEcho } : {};
  echo.offline = true;
  return echo as T & { offline: true };
}

export function buildAssetUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  // Derive backend origin by removing trailing /api from BASE_URL
  const backendBase = BASE_URL.replace(/\/?api$/i, '');
  // Ensure single slash join
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${backendBase}${path}`;
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    // Do not short-circuit based on navigator.onLine. Local backends work without internet.
    // Let fetch determine actual reachability.
    return await request<T>(endpoint, { method: 'GET' });
  },

  async post<T>(endpoint: string, body?: any): Promise<T | (T & { offline: true })> {
    const options: RequestInit = {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      // For FormData, let the browser set the correct multipart headers
      headers: body instanceof FormData ? getAuthHeaders() : undefined,
    };

    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, body);
    }

    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      // Network errors -> queue; server errors should bubble up
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, body);
      }
      throw err;
    }
  },

  async put<T>(endpoint: string, body?: any): Promise<T | (T & { offline: true })> {
    const options: RequestInit = {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      headers: body instanceof FormData ? getAuthHeaders() : undefined,
    };

    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, body);
    }

    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, body);
      }
      throw err;
    }
  },

  async patch<T>(endpoint: string, body?: any): Promise<T | (T & { offline: true })> {
    const options: RequestInit = {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      headers: body instanceof FormData ? getAuthHeaders() : undefined,
    };

    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, body);
    }

    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, body);
      }
      throw err;
    }
  },

  async delete<T>(endpoint: string): Promise<T | (T & { offline: true })> {
    const options: RequestInit = { method: 'DELETE' };

    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, {});
    }

    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, {});
      }
      throw err;
    }
  },

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T | (T & { offline: true })> {
    const options: RequestInit = {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(),
    };
    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, formData);
    }
    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, formData);
      }
      throw err;
    }
  },

  async putFormData<T>(endpoint: string, formData: FormData): Promise<T | (T & { offline: true })> {
    const options: RequestInit = {
      method: 'PUT',
      body: formData,
      headers: getAuthHeaders(),
    };
    if (!getOnlineStatus()) {
      return queueAndReturn<T>(endpoint, options, formData);
    }
    try {
      return await request<T>(endpoint, options);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes('failed to fetch')) {
        return queueAndReturn<T>(endpoint, options, formData);
      }
      throw err;
    }
  },
};

function reconstructOptions(options: any): RequestInit {
  const init: RequestInit = { method: options.method };
  // Rebuild body
  const body = options.body;
  if (body && body._form && Array.isArray(body.entries)) {
    const fd = new FormData();
    for (const e of body.entries) {
      if (e.t === 'blob' && e.v) {
        try {
          const file = new File([e.v], e.n || 'file', { type: e.m || (e.v && e.v.type) || 'application/octet-stream' });
          fd.append(e.k, file);
        } catch {
          // fallback to append blob directly
          fd.append(e.k, e.v, e.n || 'file');
        }
      } else {
        fd.append(e.k, e.v);
      }
    }
    init.body = fd;
    // For FormData we should not set Content-Type manually; refresh auth header
    init.headers = getAuthHeaders();
  } else if (typeof body === 'string') {
    init.body = body;
    init.headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options.headers || {}) };
  } else if (body != null) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options.headers || {}) };
  } else {
    init.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  }
  return init;
}

export async function syncOfflineMutations(): Promise<{ succeeded: number; failed: number }> {
  const queued = await dbService.getQueuedMutations();
  let succeeded = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      const init = reconstructOptions(item.options);
      await request(item.endpoint, init);
      if (item.id != null) await dbService.deleteQueuedMutation(item.id);
      succeeded++;
    } catch (e) {
      failed++;
    }
  }

  return { succeeded, failed };
}
