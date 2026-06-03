/**
 * HTTP API client for the FastAPI backend.
 * Replaces the Supabase client — all data fetching goes through here.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'platform_access_token'
const REFRESH_KEY = 'platform_refresh_token'

// ---------------------------------------------------------------------------
// Token storage (browser only)
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message)
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  // Attempt token refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiFetch<T>(path, options, false)
    clearTokens()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new ApiError(401, 'Session expired')
  }

  if (!res.ok) {
    let detail: unknown
    try { detail = await res.json() } catch { detail = await res.text() }
    const msg = (detail as { detail?: string })?.detail || res.statusText
    throw new ApiError(res.status, msg as string, detail)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return false
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) return false
    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const auth = {
  async login(email: string, password: string) {
    const data = await apiFetch<{ access_token: string; refresh_token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false,
    )
    setTokens(data.access_token, data.refresh_token)
    return data
  },

  async register(email: string, password: string, fullName?: string) {
    const data = await apiFetch<{ access_token: string; refresh_token: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
      },
      false,
    )
    setTokens(data.access_token, data.refresh_token)
    return data
  },

  async getUser() {
    if (!getToken()) return null
    try {
      return await apiFetch<{
        id: string
        email: string
        full_name: string | null
        avatar_url: string | null
        role: string
      }>('/auth/me')
    } catch {
      return null
    }
  },

  signOut() {
    clearTokens()
  },

  isAuthenticated(): boolean {
    return Boolean(getToken())
  },
}

// ---------------------------------------------------------------------------
// Contacts & Tags
// ---------------------------------------------------------------------------

export const contacts = {
  list: (params?: { skip?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.skip !== undefined) qs.set('skip', String(params.skip))
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    if (params?.search) qs.set('search', params.search)
    return apiFetch<Contact[]>(`/contacts?${qs}`)
  },
  get: (id: string) => apiFetch<Contact>(`/contacts/${id}`),
  create: (data: Partial<Contact>) =>
    apiFetch<Contact>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Contact>) =>
    apiFetch<Contact>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/contacts/${id}`, { method: 'DELETE' }),
  addTag: (contactId: string, tagId: string) =>
    apiFetch<Contact>(`/contacts/${contactId}/tags/${tagId}`, { method: 'POST' }),
  removeTag: (contactId: string, tagId: string) =>
    apiFetch<Contact>(`/contacts/${contactId}/tags/${tagId}`, { method: 'DELETE' }),
}

export const tags = {
  list: () => apiFetch<Tag[]>('/tags'),
  create: (data: { name: string; color?: string }) =>
    apiFetch<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Conversations & Messages
// ---------------------------------------------------------------------------

export const conversations = {
  list: (params?: { skip?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.skip !== undefined) qs.set('skip', String(params.skip))
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    if (params?.status) qs.set('status', params.status)
    return apiFetch<Conversation[]>(`/conversations?${qs}`)
  },
  get: (id: string) => apiFetch<Conversation>(`/conversations/${id}`),
  getOrCreateForContact: (contactId: string) =>
    apiFetch<Conversation>(`/conversations/contact/${contactId}`),
  update: (id: string, data: { status?: string; assigned_to?: string }) =>
    apiFetch<Conversation>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}

export const messages = {
  list: (conversationId: string, params?: { skip?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.skip !== undefined) qs.set('skip', String(params.skip))
    if (params?.limit !== undefined) qs.set('limit', String(params.limit))
    return apiFetch<Message[]>(`/messages/${conversationId}?${qs}`)
  },
  send: (conversationId: string, data: { type: string; content: Record<string, unknown> }) =>
    apiFetch<Message>(`/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sseUrl: (conversationId: string) => {
    const token = getToken()
    return `${API_URL}/conversations/${conversationId}/sse?token=${token}`
  },
}

// ---------------------------------------------------------------------------
// Pipelines & Deals
// ---------------------------------------------------------------------------

export const pipelines = {
  list: () => apiFetch<Pipeline[]>('/pipelines'),
  create: (name: string) =>
    apiFetch<Pipeline>('/pipelines', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (id: string) => apiFetch<void>(`/pipelines/${id}`, { method: 'DELETE' }),
  createStage: (pipelineId: string, data: { name: string; position?: number; color?: string }) =>
    apiFetch<PipelineStage>(`/pipelines/${pipelineId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStage: (pipelineId: string, stageId: string, data: Partial<PipelineStage>) =>
    apiFetch<PipelineStage>(`/pipelines/${pipelineId}/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteStage: (pipelineId: string, stageId: string) =>
    apiFetch<void>(`/pipelines/${pipelineId}/stages/${stageId}`, { method: 'DELETE' }),
}

export const deals = {
  list: (params?: { pipeline_id?: string; stage_id?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.pipeline_id) qs.set('pipeline_id', params.pipeline_id)
    if (params?.stage_id) qs.set('stage_id', params.stage_id)
    if (params?.status) qs.set('status', params.status)
    return apiFetch<Deal[]>(`/deals?${qs}`)
  },
  create: (data: Partial<Deal>) =>
    apiFetch<Deal>('/deals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Deal>) =>
    apiFetch<Deal>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/deals/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// WhatsApp config & templates
// ---------------------------------------------------------------------------

export const whatsapp = {
  getConfig: () => apiFetch<WhatsAppConfig>('/whatsapp/config'),
  updateConfig: (data: Partial<WhatsAppConfig> & { access_token?: string }) =>
    apiFetch<WhatsAppConfig>('/whatsapp/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  listTemplates: () => apiFetch<MessageTemplate[]>('/whatsapp/templates'),
  createTemplate: (data: Partial<MessageTemplate>) =>
    apiFetch<MessageTemplate>('/whatsapp/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) =>
    apiFetch<void>(`/whatsapp/templates/${id}`, { method: 'DELETE' }),
  send: (data: { to: string; type: string; content: Record<string, unknown> }) =>
    apiFetch<Record<string, unknown>>('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export const broadcasts = {
  list: () => apiFetch<Broadcast[]>('/broadcasts'),
  create: (data: { name: string; template_id?: string; contact_ids: string[] }) =>
    apiFetch<Broadcast>('/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
  send: (id: string) =>
    apiFetch<Broadcast>(`/broadcasts/${id}/send`, { method: 'POST' }),
  delete: (id: string) => apiFetch<void>(`/broadcasts/${id}`, { method: 'DELETE' }),
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboard = {
  getMetrics: () => apiFetch<DashboardMetrics>('/dashboard/metrics'),
}

// ---------------------------------------------------------------------------
// Voice agents
// ---------------------------------------------------------------------------

export interface AgentConfig {
  id: string
  name: string
  system_prompt: string | null
  voice_id: string | null
  llm_model: string | null
  tools_json: string | null
  sip_trunk_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Voice agent options and config
// ---------------------------------------------------------------------------

export interface VoiceOption { id: string; name: string; provider: string }
export interface ModelOption {
  id: string; name: string; provider: string
  ttft_ms: number; cost_per_min_cents: number; recommended: boolean
}

export const agents = {
  list:   ()                        => apiFetch<AgentConfig[]>('/agents'),
  get:    (id: string)              => apiFetch<AgentConfig>(`/agents/${id}`),
  create: (data: Partial<AgentConfig>) =>
    apiFetch<AgentConfig>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<AgentConfig>) =>
    apiFetch<AgentConfig>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/agents/${id}`, { method: 'DELETE' }),
  voices: () => apiFetch<VoiceOption[]>('/agents/options/voices'),
  models: () => apiFetch<ModelOption[]>('/agents/options/models'),
}

// ---------------------------------------------------------------------------
// Voice calls
// ---------------------------------------------------------------------------

export const calls = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.status) qs.set('status', params.status)
    return apiFetch<{ total: number; items: Call[] }>(`/calls?${qs}`)
  },
  get: (id: string) => apiFetch<CallDetail>(`/calls/${id}`),
  outbound: (toNumber: string, agentConfigId?: string, contactId?: string) =>
    apiFetch<{ call_id: string; room_name: string; status: string }>('/calls/outbound', {
      method: 'POST',
      body: JSON.stringify({
        to_number: toNumber,
        agent_config_id: agentConfigId,
        contact_id: contactId,
      }),
    }),
  hangup: (id: string) => apiFetch<void>(`/calls/${id}/hangup`, { method: 'POST' }),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag { id: string; name: string; color?: string }
export interface Contact {
  id: string; phone: string; name?: string; email?: string
  company?: string; custom_fields?: Record<string, unknown>
  created_at: string; tags: Tag[]
}
export interface Message {
  id: string; conversation_id: string; direction: string; type: string
  content: Record<string, unknown>; status: string; wa_message_id?: string
  created_at: string
}
export interface Conversation {
  id: string; contact_id: string; status: string; assigned_to?: string
  last_message_at?: string; created_at: string
  contact?: { id: string; name?: string; phone: string }
  last_message?: Message
}
export interface PipelineStage { id: string; pipeline_id: string; name: string; position: number; color?: string }
export interface Pipeline { id: string; name: string; created_at: string; stages: PipelineStage[] }
export interface Deal {
  id: string; pipeline_id: string; stage_id: string; contact_id?: string
  title: string; value?: number; status: string; close_date?: string
  contact_name?: string; contact_phone?: string; created_at: string
}
export interface WhatsAppConfig {
  id: string; phone_number_id: string; waba_id?: string
  webhook_verify_token?: string; has_access_token: boolean; created_at: string
}
export interface MessageTemplate {
  id: string; name: string; language: string; category: string
  components?: unknown[]; status: string; wa_template_id?: string; created_at: string
}
export interface Broadcast {
  id: string; name: string; status: string; sent_count: number
  failed_count: number; scheduled_at?: string; created_at: string
}
export interface DashboardMetrics {
  conversations_today: number; open_conversations: number; messages_today: number
  deals_open: number; deals_won: number; pipeline_value: number
  calls_today: number; active_calls: number; avg_call_duration_seconds: number
  voice_spend_today_cents: number; voice_answer_rate: number; outbound_calls_today: number
}
export interface Call {
  id: string; direction: string; status: string; from_number?: string
  to_number?: string; started_at?: string; ended_at?: string
  duration_seconds?: number; cost_cents?: number; recording_url?: string
}
export interface CallDetail extends Call {
  agent_config_id?: string; contact_id?: string
  turns: Array<{ id: string; role: string; text: string; started_at: string; latency_ms?: number }>
}
