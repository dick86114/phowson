export type ApiResponse<T> = {
  data: T;
  status: number;
};

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const AUTH_STORAGE_KEY = 'photologs:auth:user';
const AUTH_TOKEN_KEY = 'photologs:auth:token';

const getAuthToken = (): string | null => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const t = String(token ?? '').trim();
    return t ? t : null;
  } catch {
    return null;
  }
};

const getAuthHeaders = (): Record<string, string> => {
  try {
    const token = getAuthToken();
    if (token) return { authorization: `Bearer ${token}` };

    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return {};
    const user = JSON.parse(raw) as any;
    const role = String(user?.role ?? '').toLowerCase();
    if (!user?.id || (role !== 'admin' && role !== 'family')) return {};
    return {
      'x-user-id': String(user?.id ?? ''),
      'x-user-name': String(user?.name ?? ''),
      'x-user-avatar': String(user?.avatar ?? ''),
      'x-user-role': role,
    };
  } catch {
    return {};
  }
};

export const API_BASE_URL = (() => {
  const env = (import.meta as any)?.env;
  const configured = env?.VITE_API_BASE_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window?.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
})();

const request = async <T,>(method: HttpMethod, url: string, body?: unknown): Promise<ApiResponse<T>> => {
  const fullUrl = `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };

  let fetchBody: BodyInit | undefined;
  if (body instanceof FormData) {
    fetchBody = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: fetchBody,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const err = new Error(`请求失败: ${method} ${url}`) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { data, status: res.status };
};

const api = {
  get<T = any>(url: string) {
    return request<T>('GET', url);
  },
  post<T = any>(url: string, body?: unknown) {
    return request<T>('POST', url, body);
  },
  patch<T = any>(url: string, body?: unknown) {
    return request<T>('PATCH', url, body);
  },
  delete<T = any>(url: string) {
    return request<T>('DELETE', url);
  },
};

export default api;
