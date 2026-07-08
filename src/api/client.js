const DEFAULT_BASE_URL = 'http://localhost:8000'

export function getApiBaseUrl() {
  // Vite exposes env vars prefixed with VITE_*
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL
}

function json(res) {
  return res.json().catch(() => null)
}

export async function apiHealth() {
  const res = await fetch(`${getApiBaseUrl()}/health`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(`Health check failed: ${res.status} ${body?.status || ''}`.trim())
  }
  return res.json()
}

export async function apiLogin({ email, password }) {
  const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Login failed: ${res.status}`)
  }
  return res.json()
}

export async function apiMe(accessToken) {
  const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Me failed: ${res.status}`)
  }
  return res.json()
}

export async function apiListProcesses(accessToken) {
  const res = await fetch(`${getApiBaseUrl()}/processes`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `List processes failed: ${res.status}`)
  }
  return res.json()
}

export async function apiGetProcessDetail(accessToken, processId) {
  const res = await fetch(`${getApiBaseUrl()}/processes/${processId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Get process failed: ${res.status}`)
  }
  return res.json()
}


export async function apiCreateProcess(accessToken, { name, bpmn_xml }) {
  const res = await fetch(`${getApiBaseUrl()}/processes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name, bpmn_xml }),
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Create process failed: ${res.status}`)
  }
  return res.json()
}

export async function apiUpdateProcess(accessToken, { process_id, name, bpmn_xml }) {
  const res = await fetch(`${getApiBaseUrl()}/processes/${process_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name, bpmn_xml }),
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Update process failed: ${res.status}`)
  }
  return res.json()
}

export async function apiRegister({ email, password, full_name = null, role = 'viewer' }) {
  const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, full_name, role }),
  })

  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Register failed: ${res.status}`)
  }
  return res.json()
}

export async function apiAdminListUsers(accessToken) {
  const res = await fetch(`${getApiBaseUrl()}/admin/users`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `List users failed: ${res.status}`)
  }
  return res.json()
}

export async function apiAdminActivateUser(accessToken, userId) {
  const res = await fetch(`${getApiBaseUrl()}/admin/users/${userId}/activate`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Activate user failed: ${res.status}`)
  }
  return res.json()
}

export async function apiAdminDeactivateUser(accessToken, userId) {
  const res = await fetch(`${getApiBaseUrl()}/admin/users/${userId}/deactivate`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await json(res)
    throw new Error(body?.detail || `Deactivate user failed: ${res.status}`)
  }
  return res.json()
}


