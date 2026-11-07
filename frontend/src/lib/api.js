// Thin fetch wrapper — no axios. Base path is relative (`/api/...`), proxied
// to the Django backend by Vite in dev (see vite.config.js) and served from
// the same origin in prod. Auth token lives in useAuthStore, read lazily
// here to avoid an import cycle.
import { useAuthStore } from '../stores/useAuthStore'

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed with ${status}`)
    this.status = status
    this.code = body?.error?.code
    this.details = body?.error?.details
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = useAuthStore.getState().accessToken
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError(res.status, data)
  }
  return data
}

async function requestForm(path, formData) {
  const token = useAuthStore.getState().accessToken
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    // No Content-Type header — the browser sets the multipart boundary.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: requestForm,
}

export { ApiError }
