// =============================================
// TokenTracker - API Client
// Fetches real data from the backend server
// =============================================

const API_BASE = (localStorage.getItem('norte_api_base') || '').trim() || window.location.origin;

export interface StatsResponse {
  totalTokens: number;
  totalCost: number;
  activeUsers: number;
  totalEmployees: number;
  avgCostPerUser: number;
  topService: { name: string; tokens: number } | null;
  criticalAlerts: number;
  warningAlerts: number;
  trends: { tokens: number; cost: number };
}

export interface EmployeeResponse {
  id: string;
  name: string;
  pc_id: string;
  department: string;
  role: string;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  topService: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface DailyUsageRow {
  date: string;
  service: string;
  total_tokens: number;
  total_cost: number;
}

export interface ServiceUsageRow {
  service: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
}

export interface HourlyRow {
  hour: number;
  total_tokens: number;
}

export interface AlertRow {
  id: number;
  employee_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detail: string;
  type: string;
  timestamp: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(API_BASE + url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchStats(days: number): Promise<StatsResponse> {
  return fetchJson(`/api/stats?days=${days}`);
}

export async function fetchEmployees(days: number): Promise<EmployeeResponse[]> {
  return fetchJson(`/api/employees?days=${days}`);
}

export async function fetchDailyUsage(days: number): Promise<DailyUsageRow[]> {
  return fetchJson(`/api/usage/daily?days=${days}`);
}

export async function fetchUsageByService(days: number): Promise<ServiceUsageRow[]> {
  return fetchJson(`/api/usage/by-service?days=${days}`);
}

export async function fetchHourlyActivity(days: number): Promise<HourlyRow[]> {
  return fetchJson(`/api/usage/hourly?days=${days}`);
}

export async function fetchEmployeeDetail(employeeId: string, days = 30): Promise<{ employee: any; usage: DailyUsageRow[] }> {
  return fetchJson(`/api/employees/${employeeId}/usage?days=${days}`);
}

export async function fetchAlerts(severity?: string): Promise<AlertRow[]> {
  const qs = severity && severity !== 'all' ? `?severity=${severity}` : '';
  return fetchJson(`/api/alerts${qs}`);
}

export async function fetchSettings(): Promise<Record<string, string>> {
  return fetchJson('/api/settings');
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await fetch(API_BASE + '/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  });
}

// ---- Formatting helpers ----
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatCurrency(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

// Service display info
export const SERVICE_COLORS: Record<string, string> = {
  anthropic: '#d97706',
  openai: '#10b981',
  cursor: '#6366f1',
  google: '#06b6d4',
  copilot: '#22c55e',
};

export const SERVICE_LABELS: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  cursor: 'Cursor',
  google: 'Antigravity',
  copilot: 'Copilot',
};

export function getServiceColor(service: string): string {
  for (const [key, color] of Object.entries(SERVICE_COLORS)) {
    if (service.toLowerCase().includes(key)) return color;
  }
  return '#8b5cf6';
}

export function getServiceLabel(service: string): string {
  for (const [key, label] of Object.entries(SERVICE_LABELS)) {
    if (service.toLowerCase().includes(key)) return label;
  }
  return service;
}
