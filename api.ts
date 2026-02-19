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
  
  // Default to relative path to support reverse proxy and vite proxy
  return '';
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

    if (typeof data === 'object' && data !== null) {
      const code = typeof (data as any).code === 'string' ? String((data as any).code) : '';
      const message = typeof (data as any).message === 'string' ? String((data as any).message) : '';
      const requestId = typeof (data as any).requestId === 'string' ? String((data as any).requestId) : '';
      const upstreamStatus = Number((data as any).upstreamStatus);

      if (code) err.code = code;
      if (requestId) err.requestId = requestId;
      if (Number.isFinite(upstreamStatus) && upstreamStatus >= 100) err.upstreamStatus = upstreamStatus;

      const parts: string[] = [];
      parts.push(`[${res.status}]`);
      if (code) parts.push(code);
      if (message) parts.push(message);
      if (!message) parts.push('请求失败');
      if (Number.isFinite(upstreamStatus) && upstreamStatus >= 100) parts.push(`upstreamStatus: ${upstreamStatus}`);
      if (requestId) parts.push(`requestId: ${requestId}`);
      err.serverMessage = parts.join(' ');
    } else if (typeof data === 'string') {
      const s = data.trim();
      const looksLikeHtml = /^<!doctype html/i.test(s) || /^<html/i.test(s);
      err.serverMessage = looksLikeHtml ? `[${res.status}] 网关返回了非 JSON 错误页面` : `[${res.status}] ${s.slice(0, 200)}`;
    } else {
      err.serverMessage = `[${res.status}] 请求失败`;
    }

    if (typeof err.serverMessage === 'string' && err.serverMessage) {
      err.message = err.serverMessage;
    }

    throw err;
  }

  return { data, status: res.status };
};

const api = {
  get<T = any>(url: string, params?: Record<string, any>) {
    let finalUrl = url;
    if (params) {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) sp.append(k, String(v));
      });
      const qs = sp.toString();
      if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
    }
    return request<T>('GET', finalUrl);
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
