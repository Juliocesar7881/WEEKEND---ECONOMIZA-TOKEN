// =============================================
// TokenTracker - API Client
// Fetches real data from the backend server
// =============================================

const API_BASE = (localStorage.getItem('norte_api_base') || '').trim() || window.location.origin;
const DEMO_MODE = /\.netlify\.app$/i.test(window.location.hostname) && !localStorage.getItem('norte_api_base');

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

type DemoEmployee = {
  id: string;
  name: string;
  role: string;
  pc_id: string;
};

type DemoUsage = {
  employee_id: string;
  date: string;
  hour: number;
  service: string;
  tokens: number;
  cost: number;
};

const DEMO_SERVICES = ['openai', 'anthropic', 'google', 'copilot', 'cursor'];
const DEMO_PRICING: Record<string, number> = {
  openai: 0.02,
  anthropic: 0.015,
  google: 0.01,
  copilot: 0.008,
  cursor: 0.012,
};

const DEMO_EMPLOYEES: DemoEmployee[] = [
  { id: 'ana.souza', name: 'Ana Souza', role: 'Engenheira de Software', pc_id: 'DEV-ANA-01' },
  { id: 'bruno.lima', name: 'Bruno Lima', role: 'Tech Lead', pc_id: 'DEV-BRUNO-02' },
  { id: 'carla.rocha', name: 'Carla Rocha', role: 'Product Manager', pc_id: 'PM-CARLA-03' },
  { id: 'daniel.costa', name: 'Daniel Costa', role: 'DevOps', pc_id: 'OPS-DANIEL-04' },
  { id: 'eduarda.nunes', name: 'Eduarda Nunes', role: 'Designer UX', pc_id: 'UX-EDUARDA-05' },
  { id: 'felipe.melo', name: 'Felipe Melo', role: 'Backend Senior', pc_id: 'BE-FELIPE-06' },
  { id: 'gabriela.martins', name: 'Gabriela Martins', role: 'Frontend Senior', pc_id: 'FE-GABI-07' },
  { id: 'henrique.alves', name: 'Henrique Alves', role: 'QA Engineer', pc_id: 'QA-HENRIQUE-08' },
  { id: 'isabela.fernandes', name: 'Isabela Fernandes', role: 'Data Analyst', pc_id: 'DA-ISABELA-09' },
  { id: 'joao.pereira', name: 'Joao Pereira', role: 'Arquiteto de Software', pc_id: 'ARQ-JOAO-10' },
  { id: 'karina.silva', name: 'Karina Silva', role: 'Customer Success', pc_id: 'CS-KARINA-11' },
  { id: 'lucas.teixeira', name: 'Lucas Teixeira', role: 'Mobile Engineer', pc_id: 'MB-LUCAS-12' },
  { id: 'mariana.oliveira', name: 'Mariana Oliveira', role: 'Head de Produto', pc_id: 'HP-MARIANA-13' },
  { id: 'nicolas.santos', name: 'Nicolas Santos', role: 'Estagiario Dev', pc_id: 'JR-NICOLAS-14' },
  { id: 'patricia.gomes', name: 'Patricia Gomes', role: 'Financeiro', pc_id: 'FN-PATRICIA-15' },
];

const DEMO_USAGE_CACHE = new Map<number, DemoUsage[]>();

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function rng(seed: number): number {
  const x = Math.sin(seed * 999.91) * 10000;
  return x - Math.floor(x);
}

function getDemoUsage(days: number): DemoUsage[] {
  if (DEMO_USAGE_CACHE.has(days)) return DEMO_USAGE_CACHE.get(days)!;

  const rows: DemoUsage[] = [];
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const date = dayKey(dayOffset);
    for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
      const employee = DEMO_EMPLOYEES[i];
      const requests = 3 + Math.floor(rng(i * 100 + dayOffset) * 7);
      for (let r = 0; r < requests; r++) {
        const seed = i * 1000 + dayOffset * 100 + r;
        const service = DEMO_SERVICES[Math.floor(rng(seed + 7) * DEMO_SERVICES.length)];
        const hour = 8 + Math.floor(rng(seed + 13) * 12);
        const tokens = 400 + Math.floor(rng(seed + 17) * 8800);
        rows.push({
          employee_id: employee.id,
          date,
          hour,
          service,
          tokens,
          cost: (tokens / 1000) * DEMO_PRICING[service],
        });
      }
    }
  }

  DEMO_USAGE_CACHE.set(days, rows);
  return rows;
}

function demoStats(days: number): StatsResponse {
  const usage = getDemoUsage(days);
  const totalTokens = usage.reduce((s, r) => s + r.tokens, 0);
  const totalCost = usage.reduce((s, r) => s + r.cost, 0);
  const activeUsers = new Set(usage.map(r => r.employee_id)).size;

  const byService = new Map<string, number>();
  for (const r of usage) byService.set(r.service, (byService.get(r.service) || 0) + r.tokens);
  const topServiceEntry = [...byService.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const prev = getDemoUsage(days * 2).filter(r => r.date < dayKey(days - 1));
  const prevTokens = prev.reduce((s, r) => s + r.tokens, 0);
  const prevCost = prev.reduce((s, r) => s + r.cost, 0);

  return {
    totalTokens,
    totalCost,
    activeUsers,
    totalEmployees: DEMO_EMPLOYEES.length,
    avgCostPerUser: activeUsers > 0 ? totalCost / activeUsers : 0,
    topService: topServiceEntry ? { name: topServiceEntry[0], tokens: topServiceEntry[1] } : null,
    criticalAlerts: 2,
    warningAlerts: 6,
    trends: {
      tokens: prevTokens > 0 ? ((totalTokens - prevTokens) / prevTokens) * 100 : 0,
      cost: prevCost > 0 ? ((totalCost - prevCost) / prevCost) * 100 : 0,
    },
  };
}

function demoEmployees(days: number): EmployeeResponse[] {
  const usage = getDemoUsage(days);
  const byEmployee = new Map<string, { tokens: number; cost: number; count: number; byService: Map<string, number> }>();
  for (const row of usage) {
    const agg = byEmployee.get(row.employee_id) || { tokens: 0, cost: 0, count: 0, byService: new Map<string, number>() };
    agg.tokens += row.tokens;
    agg.cost += row.cost;
    agg.count += 1;
    agg.byService.set(row.service, (agg.byService.get(row.service) || 0) + row.tokens);
    byEmployee.set(row.employee_id, agg);
  }

  return DEMO_EMPLOYEES.map(e => {
    const agg = byEmployee.get(e.id) || { tokens: 0, cost: 0, count: 0, byService: new Map<string, number>() };
    const topService = [...agg.byService.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    let status: 'normal' | 'warning' | 'critical' = 'normal';
    if (agg.tokens > 140000) status = 'critical';
    else if (agg.tokens > 95000) status = 'warning';

    return {
      id: e.id,
      name: e.name,
      pc_id: e.pc_id,
      department: '',
      role: e.role,
      totalTokens: agg.tokens,
      totalCost: agg.cost,
      requestCount: agg.count,
      topService,
      status,
    };
  }).sort((a, b) => b.totalTokens - a.totalTokens);
}

function demoDailyUsage(days: number): DailyUsageRow[] {
  const usage = getDemoUsage(days);
  const grouped = new Map<string, DailyUsageRow>();
  for (const row of usage) {
    const key = `${row.date}::${row.service}`;
    const prev = grouped.get(key) || { date: row.date, service: row.service, total_tokens: 0, total_cost: 0 };
    prev.total_tokens += row.tokens;
    prev.total_cost += row.cost;
    grouped.set(key, prev);
  }
  return [...grouped.values()].sort((a, b) => (a.date + a.service).localeCompare(b.date + b.service));
}

function demoByService(days: number): ServiceUsageRow[] {
  const usage = getDemoUsage(days);
  const grouped = new Map<string, ServiceUsageRow>();
  for (const row of usage) {
    const prev = grouped.get(row.service) || { service: row.service, total_tokens: 0, total_cost: 0, request_count: 0 };
    prev.total_tokens += row.tokens;
    prev.total_cost += row.cost;
    prev.request_count += 1;
    grouped.set(row.service, prev);
  }
  return [...grouped.values()].sort((a, b) => b.total_tokens - a.total_tokens);
}

function demoHourly(days: number): HourlyRow[] {
  const usage = getDemoUsage(days);
  const buckets = new Array(24).fill(0);
  for (const row of usage) buckets[row.hour] += row.tokens;
  return buckets.map((v, i) => ({ hour: i, total_tokens: v }));
}

function demoEmployeeDetail(employeeId: string, days: number): { employee: any; usage: DailyUsageRow[] } {
  const employee = DEMO_EMPLOYEES.find(e => e.id === employeeId) || DEMO_EMPLOYEES[0];
  const usage = getDemoUsage(days).filter(r => r.employee_id === employee.id);
  const grouped = new Map<string, DailyUsageRow>();
  for (const row of usage) {
    const key = `${row.date}::${row.service}`;
    const prev = grouped.get(key) || { date: row.date, service: row.service, total_tokens: 0, total_cost: 0 };
    prev.total_tokens += row.tokens;
    prev.total_cost += row.cost;
    grouped.set(key, prev);
  }

  return {
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      pc_id: employee.pc_id,
      department: '',
    },
    usage: [...grouped.values()].sort((a, b) => (a.date + a.service).localeCompare(b.date + b.service)),
  };
}

function demoAlerts(): AlertRow[] {
  const now = Date.now();
  return [
    {
      id: 1,
      employee_id: 'bruno.lima',
      severity: 'critical',
      message: 'Bruno Lima excedeu o limite diário',
      detail: 'Uso concentrado acima do padrão nas últimas 2h.',
      type: 'limit_exceeded',
      timestamp: new Date(now - 45 * 60000).toISOString(),
    },
    {
      id: 2,
      employee_id: 'nicolas.santos',
      severity: 'warning',
      message: 'Uso fora do horário comercial',
      detail: 'Atividade detectada após 22h com múltiplas chamadas.',
      type: 'after_hours',
      timestamp: new Date(now - 130 * 60000).toISOString(),
    },
    {
      id: 3,
      employee_id: 'joao.pereira',
      severity: 'info',
      message: 'Requisição de alto volume',
      detail: 'Uma chamada consumiu mais de 10K tokens.',
      type: 'large_request',
      timestamp: new Date(now - 210 * 60000).toISOString(),
    },
    {
      id: 4,
      employee_id: 'gabriela.martins',
      severity: 'warning',
      message: 'Pico de uso em curto período',
      detail: 'Aumento de 65% no consumo comparado à média diária.',
      type: 'spike',
      timestamp: new Date(now - 340 * 60000).toISOString(),
    },
  ];
}

export async function fetchStats(days: number): Promise<StatsResponse> {
  if (DEMO_MODE) return demoStats(days);
  return fetchJson(`/api/stats?days=${days}`);
}

export async function fetchEmployees(days: number): Promise<EmployeeResponse[]> {
  if (DEMO_MODE) return demoEmployees(days);
  return fetchJson(`/api/employees?days=${days}`);
}

export async function fetchDailyUsage(days: number): Promise<DailyUsageRow[]> {
  if (DEMO_MODE) return demoDailyUsage(days);
  return fetchJson(`/api/usage/daily?days=${days}`);
}

export async function fetchUsageByService(days: number): Promise<ServiceUsageRow[]> {
  if (DEMO_MODE) return demoByService(days);
  return fetchJson(`/api/usage/by-service?days=${days}`);
}

export async function fetchHourlyActivity(days: number): Promise<HourlyRow[]> {
  if (DEMO_MODE) return demoHourly(days);
  return fetchJson(`/api/usage/hourly?days=${days}`);
}

export async function fetchEmployeeDetail(employeeId: string, days = 30): Promise<{ employee: any; usage: DailyUsageRow[] }> {
  if (DEMO_MODE) return demoEmployeeDetail(employeeId, days);
  return fetchJson(`/api/employees/${employeeId}/usage?days=${days}`);
}

export async function fetchAlerts(severity?: string): Promise<AlertRow[]> {
  if (DEMO_MODE) {
    const alerts = demoAlerts();
    if (!severity || severity === 'all') return alerts;
    return alerts.filter(a => a.severity === severity);
  }
  const qs = severity && severity !== 'all' ? `?severity=${severity}` : '';
  return fetchJson(`/api/alerts${qs}`);
}

export async function fetchSettings(): Promise<Record<string, string>> {
  if (DEMO_MODE) {
    return {
      company_name: localStorage.getItem('demo_company_name') || 'Demo Company',
      monthly_limit: localStorage.getItem('demo_monthly_limit') || '25000',
      daily_limit_per_employee: localStorage.getItem('demo_daily_limit_per_employee') || '120000',
    };
  }
  return fetchJson('/api/settings');
}

export async function saveSetting(key: string, value: string): Promise<void> {
  if (DEMO_MODE) {
    localStorage.setItem(`demo_${key}`, value);
    return;
  }
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
