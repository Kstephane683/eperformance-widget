/**
 * Client API admin — dashboard chatbot ePerformance (Sprint 9)
 *
 * Contrat (mission Sprint 9) :
 * - POST /api/auth/login — OAuth2PasswordRequestForm → form-urlencoded
 *   `username=<email>&password=<pwd>` → { access_token, token_type }
 * - /api/chatbot/admin/conversations (+ /{id}, /takeover, /release,
 *   /human-message, /assign) — Authorization: Bearer <token>
 * - GET /api/chatbot/agents — agents assignables
 *
 * ⚠️ Robustesse déploiement : le backend Railway actuel expose les routes
 * admin SANS le préfixe /api/chatbot (cf. openapi.json de prod). La base
 * admin est donc détectée une fois par session via une sonde 404 (sans
 * auth) : on tente le chemin du contrat d'abord, puis le chemin court.
 */

export const API_BASE = 'https://web-production-4ab53.up.railway.app'

/** Clé localStorage du JWT admin (partagée avec le store auth). */
export const ADMIN_TOKEN_KEY = 'eperf_admin_token'

// ============================================================
// TYPES DU CONTRAT ADMIN
// ============================================================

export type AdminConversationStatus = 'active' | 'escalated' | 'resolved' | 'abandoned'

export interface AdminConversationSummary {
  conversation_id: string
  site_id: string
  status: AdminConversationStatus
  human_active: boolean
  assigned_agent: string | null
  lead_captured: boolean
  lead_name: string | null
  lead_phone: string | null
  message_count: number
  last_message: string | null
  last_message_role: string | null
  created_at: string | null
  last_message_at: string | null
}

export interface AdminConversationListResponse {
  conversations: AdminConversationSummary[]
  total: number
}

export interface AdminLead {
  name: string | null
  email: string | null
  phone: string | null
}

export interface AdminMessage {
  id: number | string
  role: 'user' | 'assistant'
  content: string
  /** Message envoyé par un conseiller humain (badge "Conseiller" dans le fil) */
  human: boolean
  agent_used: string | null
  intent: string | null
  created_at: string | null
}

export interface AdminConversationDetail {
  conversation: {
    conversation_id: string
    site_id: string
    status: AdminConversationStatus
    human_active: boolean
    assigned_agent: string | null
    created_at: string | null
    last_message_at: string | null
  }
  lead: AdminLead | null
  messages: AdminMessage[]
}

export interface AdminAgent {
  key: string
  label: string
}

// ============================================================
// ERREURS + WRAPPER FETCH
// ============================================================

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** Branché par main.ts : tout 401 → logout réactif du store auth. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

function readToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail.length > 0) return body.detail
  } catch {
    /* corps non JSON */
  }
  return `HTTP ${res.status}`
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = readToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 401) {
    unauthorizedHandler?.()
    throw new ApiError(401, 'Session expirée — veuillez vous reconnecter.')
  }
  if (res.status === 403) {
    throw new ApiError(403, 'Accès refusé : ce compte n’est pas administrateur.')
  }
  return res
}

// ============================================================
// DÉTECTION DE LA BASE ADMIN (contrat /api/chatbot vs chemin court)
// ============================================================

let adminPrefixPromise: Promise<string> | null = null

function detectAdminPrefix(): Promise<string> {
  return (async () => {
    const candidates = ['/api/chatbot', '']
    for (const prefix of candidates) {
      try {
        // Sonde sans auth : 404 = route absente, tout autre statut = route présente.
        const res = await fetch(`${API_BASE}${prefix}/admin/conversations?limit=1`)
        if (res.status !== 404) return prefix
      } catch {
        break // réseau/CORS : rester sur le chemin du contrat
      }
    }
    return '/api/chatbot'
  })()
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!adminPrefixPromise) adminPrefixPromise = detectAdminPrefix()
  const prefix = await adminPrefixPromise
  return apiFetch(`${prefix}${path}`, init)
}

// ============================================================
// AUTH — POST /api/auth/login
// ============================================================

/** Login OAuth2 : strictement form-urlencoded (username = email). */
export async function adminLogin(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  const data = (await res.json()) as { access_token?: unknown }
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new ApiError(res.status, 'Réponse de connexion invalide.')
  }
  return data.access_token
}

// ============================================================
// CONVERSATIONS ADMIN
// ============================================================

export async function fetchConversations(limit = 50): Promise<AdminConversationListResponse> {
  const res = await adminFetch(`/admin/conversations?limit=${encodeURIComponent(String(limit))}`)
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return (await res.json()) as AdminConversationListResponse
}

export async function fetchConversationDetail(
  conversationId: string,
): Promise<AdminConversationDetail> {
  const res = await adminFetch(`/admin/conversations/${encodeURIComponent(conversationId)}`)
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return (await res.json()) as AdminConversationDetail
}

async function postAction(conversationId: string, subPath: string, jsonBody?: unknown): Promise<void> {
  const init: RequestInit = { method: 'POST' }
  if (jsonBody !== undefined) init.body = JSON.stringify(jsonBody)
  const res = await adminFetch(
    `/admin/conversations/${encodeURIComponent(conversationId)}${subPath}`,
    init,
  )
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
}

export function takeoverConversation(conversationId: string): Promise<void> {
  return postAction(conversationId, '/takeover')
}

export function releaseConversation(conversationId: string): Promise<void> {
  return postAction(conversationId, '/release')
}

export function sendHumanMessage(conversationId: string, content: string): Promise<void> {
  return postAction(conversationId, '/human-message', { content })
}

export function assignAgent(conversationId: string, agentKey: string): Promise<void> {
  return postAction(conversationId, '/assign', { agent_key: agentKey })
}

// ============================================================
// AGENTS — GET /api/chatbot/agents
// ============================================================

/**
 * Format de réponse volontairement tolérant : tableau nu ou { agents: [...] },
 * items en chaînes ("sales-coach") ou objets { key|agent_key, name|label }.
 */
export async function fetchAgents(): Promise<AdminAgent[]> {
  let res = await apiFetch('/api/chatbot/agents')
  if (res.status === 404) {
    // Repli déploiement sans préfixe /api/chatbot
    res = await apiFetch('/agents')
  }
  if (res.status === 404) return []
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return normalizeAgents(await res.json())
}

function normalizeAgents(data: unknown): AdminAgent[] {
  let list: unknown[] = []
  if (Array.isArray(data)) {
    list = data
  } else if (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { agents?: unknown }).agents)
  ) {
    list = (data as { agents: unknown[] }).agents
  }

  const agents: AdminAgent[] = []
  for (const item of list) {
    if (typeof item === 'string') {
      agents.push({ key: item, label: item })
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const key = obj.key ?? obj.agent_key ?? obj.id ?? obj.name
      if (typeof key === 'string' && key.length > 0) {
        const label = obj.name ?? obj.label ?? key
        agents.push({ key, label: typeof label === 'string' ? label : key })
      }
    }
  }
  return agents
}

// ============================================================
// COCKPIT UNIFIÉ — stats, users, candidats (jalon unification)
// ============================================================

export interface AdminStats {
  conversations: number
  conversations_en_attente: number
  leads_chatbot: number
  candidats: number
  candidats_en_attente: number
  users: number
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await adminFetch('/admin/stats')
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return (await res.json()) as AdminStats
}

export interface AdminUser {
  id: number
  email: string
  nom: string | null
  role: string
  is_active: boolean
  last_login: string | null
  created_at: string | null
}

export async function fetchAdminUsers(limit = 200): Promise<{ users: AdminUser[]; total: number }> {
  const res = await adminFetch(`/admin/users?limit=${encodeURIComponent(String(limit))}`)
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return (await res.json()) as { users: AdminUser[]; total: number }
}

export interface AdminCandidat {
  id: number
  nom: string
  email: string
  whatsapp: string | null
  entreprise: string | null
  secteur: string | null
  score: number
  statut: string | null
  niveau_accompagnement: string | null
  created_at: string | null
}

export async function fetchAdminCandidats(
  statut?: string,
  limit = 200,
): Promise<{ candidats: AdminCandidat[]; total: number }> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (statut) params.set('statut', statut)
  const res = await adminFetch(`/admin/candidats?${params.toString()}`)
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res))
  return (await res.json()) as { candidats: AdminCandidat[]; total: number }
}
