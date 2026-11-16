const TOKEN_KEY = "token";
const USER_KEY = "user";

export interface AuthUser { username: string; role: "customer" | "admin"; name: string }
export interface Policy {
  policy_number: string; product: string; policy_type: string; status: string;
  sum_insured: number; sum_insured_display: string; annual_premium: number; annual_premium_display: string; deductible: number; deductible_display: string;
  start_date: string; start_date_display: string; end_date: string; end_date_display: string; nominee: string | null;
  grace_until?: string; grace_until_display?: string; customer_id?: string;
  details?: Record<string, unknown>;
}
export interface Claim {
  claim_number: string; policy_number: string; claim_type: string; amount: number; amount_display: string; status: string;
  filed_date: string; filed_date_display: string; description: string; customer_id?: string;
}
export interface Payment {
  payment_id: string; policy_number: string; amount: number; amount_display: string; paid_on: string; paid_on_display: string; mode: string; status: string;
}
export interface Profile {
  customer_id: string; full_name: string; email: string; phone: string; date_of_birth: string; date_of_birth_display: string;
  city: string; state: string; pan_masked: string; account_reference: string;
}
export interface Me { username: string; role: string; name: string; profile: Profile | null }
export interface DashboardAlert { type: "grace_period" | "lapsed" | "failed_payment"; severity: "warning" | "destructive"; policy_number: string; message: string }
export interface DashboardSummary {
  active_policies: number; total_sum_insured: number; total_sum_insured_display: string; open_claims: number;
  next_renewal: { policy_number: string; date: string; date_display: string; days_left: number } | null; alerts: DashboardAlert[];
}
export interface ConversationSummary { id: string; title: string; created_at: string; updated_at: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; request_id: string | null; created_at: string; blocked?: boolean }
export interface GuardrailEvent { stage: "input" | "prompt" | "tool" | "output"; rule_id: string; severity: string; action: "block" | "flag" | "redact"; detail: string | null }
export interface ToolCallLog { tool: string; arguments: Record<string, unknown>; authorization: string; reason: string | null; result_status: string; result?: unknown }
export interface AgentLog {
  id: string; request_id: string; user: string | null; query: string; requested_resource: string | null; tool_calls: ToolCallLog[];
  authorization_result: "allowed" | "denied" | "none"; authorization_reason: string | null; guardrail_events: GuardrailEvent[];
  blocked_by: string | null; tainted: boolean; guardrails_degraded: boolean; llm_provider: string | null; llm_model: string | null;
  final_response: string; created_at: string; latency_ms: number; [k: string]: unknown;
}
export interface Paged<T> { items: T[]; total: number; page: number; page_size: number }
export interface CustomerDetail { profile: Profile; username: string | null; policies: Policy[]; claims: Claim[]; payments: Payment[] }
export interface Slice { name: string; value: number }
export interface AdminStats {
  customers: number; active_policies: number; total_sum_insured: number; open_claims: number; chat_requests_24h: number; blocked_requests_24h: number;
  policies_by_product: Slice[]; claims_by_status: Slice[]; blocked_last_7_days: { date: string; value: number }[]; top_guardrail_rules: Slice[];
}
export interface SystemInfo {
  llm_provider: string; llm_model: string; llm: { reachable: boolean; model_available?: boolean };
  guardrails: { input: boolean; tool: boolean; output: boolean; llm_classifier: boolean; degraded: boolean };
  rate_limit_per_minute: number; lockout_enabled: boolean;
}
export interface Lockout { username: string; seconds_left: number }

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string, u: AuthUser) => { sessionStorage.setItem(TOKEN_KEY, t); sessionStorage.setItem(USER_KEY, JSON.stringify(u)); },
  user: (): AuthUser | null => { try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; } },
  clear: () => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try { res = await fetch(`/api${path}`, { ...init, headers }); } catch { throw new ApiError(0, "Network error. Is the backend running?"); }
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); detail = typeof j.detail === "string" ? j.detail : "Request failed"; } catch { /* non-JSON error body */ }
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

const get = <T,>(p: string) => request<T>(p);
const qs = (o: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]));
  return s.size ? `?${s}` : "";
};

export const api = {
  login: (username: string, password: string) =>
    request<{ access_token: string; user: AuthUser }>("/login", { method: "POST", body: JSON.stringify({ username, password }) }, false),
  logout: () => request("/logout", { method: "POST" }),
  me: () => get<Me>("/me"),
  updateMe: (body: Partial<Pick<Profile, "phone" | "email" | "city" | "state">>) => request<Me>("/me", { method: "PATCH", body: JSON.stringify(body) }),
  dashboard: () => get<DashboardSummary>("/dashboard/summary"),
  policies: (f: { status?: string; type?: string; q?: string } = {}) => get<{ policies: Policy[] }>(`/my-policies${qs(f)}`),
  policy: (n: string) => get<Policy>(`/my-policies/${encodeURIComponent(n)}`),
  renewPolicy: (n: string, mode?: string) => request<{ policy: Policy; payment: Payment }>(`/my-policies/${encodeURIComponent(n)}/renew`, { method: "POST", body: JSON.stringify(mode ? { mode } : {}) }),
  claims: (status?: string) => get<{ claims: Claim[] }>(`/my-claims${qs({ status })}`),
  payments: () => get<{ payments: Payment[] }>("/my-payments"),
  chat: (message: string, conversation_id?: string) =>
    request<{ request_id: string; conversation_id: string; reply: string; blocked: boolean }>("/chat", { method: "POST", body: JSON.stringify({ message, conversation_id }) }),
  conversations: () => get<ConversationSummary[]>("/conversations"),
  messages: (id: string) => get<ChatMessage[]>(`/conversations/${id}/messages`),
  deleteConversation: (id: string) => request(`/conversations/${id}`, { method: "DELETE" }),
  adminStats: () => get<AdminStats>("/admin/stats"),
  adminCustomers: (f: { q?: string; page?: number; page_size?: number; sort?: string } = {}) => get<Paged<Profile>>(`/admin/customers${qs({ page_size: 200, ...f })}`),
  adminCustomer: (id: string) => get<CustomerDetail>(`/admin/customers/${id}`),
  adminPolicies: (f: { q?: string; status?: string; type?: string; page?: number; page_size?: number } = {}) => get<Paged<Policy>>(`/admin/policies${qs({ page_size: 200, ...f })}`),
  adminClaims: (f: { q?: string; status?: string; page?: number; page_size?: number } = {}) => get<Paged<Claim>>(`/admin/claims${qs({ page_size: 200, ...f })}`),
  adminLogs: (f: { user?: string; authorization?: string; blocked_by?: string; from?: string; to?: string; page?: number; page_size?: number }) =>
    get<Paged<AgentLog>>(`/admin/logs${qs(f)}`),
  adminLockouts: () => get<Lockout[]>("/admin/lockouts"),
  clearLockout: (username: string) => request(`/admin/lockouts/${encodeURIComponent(username)}`, { method: "DELETE" }),
  adminSystem: () => get<SystemInfo>("/admin/system"),
};
