// =============================================
// TokenTracker - Main Application (Real Data)
// Dashboard de monitoramento de uso de tokens IA
// =============================================

import './style.css';
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

import {
  fetchStats,
  fetchEmployees,
  fetchDailyUsage,
  fetchUsageByService,
  fetchHourlyActivity,
  fetchEmployeeDetail,
  fetchAlerts,
  fetchSettings,
  saveSetting,
  formatNumber,
  formatCurrency,
  formatTimeAgo,
  getServiceColor,
  getServiceLabel,
} from './api';

// Register Chart.js components
Chart.register(
  LineController, BarController, DoughnutController,
  LineElement, BarElement, ArcElement, PointElement,
  LinearScale, CategoryScale, Tooltip, Legend, Filler
);

// ---- State ----
let currentRange = 7;
let currentSection = 'dashboard';
let lineChart: Chart | null = null;
let doughnutChart: Chart | null = null;
let barChart: Chart | null = null;
let heatChart: Chart | null = null;
let modalChart: Chart | null = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFilters();
  initSearch();
  initSettings();
  initModal();
  initMobileMenu();
  renderDashboard();

  // Auto-refresh every 15 seconds
  setInterval(() => {
    if (currentSection === 'dashboard') renderDashboard();
  }, 15000);
});

// ---- Navigation ----
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection((item as HTMLElement).dataset.section!);
    });
  });
}

function switchSection(section: string) {
  currentSection = section;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', (item as HTMLElement).dataset.section === section);
  });
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `section-${section}`);
  });

  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    employees: 'Funcionários',
    alerts: 'Alertas e Anomalias',
    settings: 'Configurações',
  };
  document.getElementById('pageTitle')!.textContent = titles[section] || 'Dashboard';

  if (section === 'dashboard') renderDashboard();
  if (section === 'employees') renderEmployeeTable();
  if (section === 'alerts') renderAlerts();

  document.getElementById('sidebar')?.classList.remove('open');
}

// ---- Filters ----
function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRange = parseInt((btn as HTMLElement).dataset.range!);
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDashboard();
    });
  });

  document.querySelectorAll('.alert-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.alert-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAlerts((btn as HTMLElement).dataset.severity);
    });
  });
}

function initSearch() {
  const search = document.getElementById('employeeSearch') as HTMLInputElement;
  if (search) {
    search.addEventListener('input', () => renderEmployeeTable(search.value.toLowerCase()));
  }
}

function initMobileMenu() {
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

async function initSettings() {
  const companyNameInput = document.getElementById('companyName') as HTMLInputElement | null;
  const monthlyLimitInput = document.getElementById('monthlyLimit') as HTMLInputElement | null;
  const dailyLimitInput = document.getElementById('dailyLimit') as HTMLInputElement | null;
  const saveBtn = document.getElementById('saveSettingsBtn') as HTMLButtonElement | null;
  const sidebarCompany = document.getElementById('sidebarCompanyName');

  if (!companyNameInput || !monthlyLimitInput || !dailyLimitInput || !saveBtn || !sidebarCompany) {
    return;
  }

  try {
    const settings = await fetchSettings();
    companyNameInput.value = settings.company_name || '';
    monthlyLimitInput.value = settings.monthly_limit || '';
    dailyLimitInput.value = settings.daily_limit_per_employee || '';
    sidebarCompany.textContent = settings.company_name || '—';
  } catch (err) {
    console.error('Erro ao carregar configuracoes:', err);
    sidebarCompany.textContent = '—';
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const prevLabel = saveBtn.textContent;
    saveBtn.textContent = 'Salvando...';

    try {
      await saveSetting('company_name', companyNameInput.value.trim());
      await saveSetting('monthly_limit', monthlyLimitInput.value.trim());
      await saveSetting('daily_limit_per_employee', dailyLimitInput.value.trim());
      sidebarCompany.textContent = companyNameInput.value.trim() || '—';
      saveBtn.textContent = 'Salvo';
      setTimeout(() => {
        saveBtn.textContent = prevLabel || 'Salvar';
      }, 900);
    } catch (err) {
      console.error('Erro ao salvar configuracoes:', err);
      saveBtn.textContent = 'Erro ao salvar';
      setTimeout(() => {
        saveBtn.textContent = prevLabel || 'Salvar';
      }, 1200);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// ---- Dashboard ----
async function renderDashboard() {
  try {
    const stats = await fetchStats(currentRange);

    // KPIs
    renderKPIs([
      {
        label: 'Total de Tokens',
        value: stats.totalTokens > 0 ? formatNumber(stats.totalTokens) : '0',
        trend: stats.trends.tokens,
        icon: '⚡',
        gradient: true,
      },
      {
        label: 'Custo Total',
        value: formatCurrency(stats.totalCost),
        trend: stats.trends.cost,
        icon: '💰',
      },
      {
        label: 'Usuários Ativos',
        value: stats.activeUsers.toString(),
        trend: 0,
        icon: '👥',
        trendLabel: stats.totalEmployees > 0 ? `de ${stats.totalEmployees} total` : 'Nenhum cadastrado',
      },
      {
        label: 'Custo Médio / Usuário',
        value: formatCurrency(stats.avgCostPerUser),
        trend: 0,
        icon: '📊',
      },
      {
        label: 'Serviço Mais Usado',
        value: stats.topService ? getServiceLabel(stats.topService.name) : '—',
        trend: 0,
        icon: '🤖',
        trendLabel: stats.topService ? formatNumber(stats.topService.tokens) + ' tokens' : 'Sem dados',
      },
      {
        label: 'Alertas Críticos',
        value: stats.criticalAlerts.toString(),
        trend: 0,
        icon: '🚨',
        trendLabel: stats.criticalAlerts > 0 ? 'Atenção necessária' : 'Tudo normal',
        trendClass: stats.criticalAlerts > 0 ? 'up' : 'down',
      },
    ]);

    // Charts
    await Promise.all([
      renderLineChart(),
      renderDoughnutChart(),
      renderBarChart(),
      renderHeatChart(),
    ]);

    // Alert badge
    const badge = document.getElementById('alertBadge')!;
    badge.textContent = (stats.criticalAlerts + stats.warningAlerts).toString();

  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    renderDashboardUnavailableState();
  }
}

function renderDashboardUnavailableState() {
  renderKPIs([
    { label: 'Total de Tokens', value: '0', trend: 0, icon: '⚡', gradient: true, trendLabel: 'API indisponível' },
    { label: 'Custo Total', value: '$0.00', trend: 0, icon: '💰', trendLabel: 'API indisponível' },
    { label: 'Usuários Ativos', value: '0', trend: 0, icon: '👥', trendLabel: 'API indisponível' },
    { label: 'Custo Médio / Usuário', value: '$0.00', trend: 0, icon: '📊', trendLabel: 'API indisponível' },
    { label: 'Serviço Mais Usado', value: '—', trend: 0, icon: '🤖', trendLabel: 'API indisponível' },
    { label: 'Alertas Críticos', value: '0', trend: 0, icon: '🚨', trendLabel: 'API indisponível' },
  ]);

  const badge = document.getElementById('alertBadge');
  if (badge) badge.textContent = '0';

  const liveLabel = document.querySelector('.live-indicator span:last-child');
  if (liveLabel) liveLabel.textContent = 'Sem conexão API';

  const legendEl = document.getElementById('lineChartLegend');
  if (legendEl) legendEl.innerHTML = '';

  if (lineChart) { lineChart.destroy(); lineChart = null; }
  if (doughnutChart) { doughnutChart.destroy(); doughnutChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
  if (heatChart) { heatChart.destroy(); heatChart = null; }

  const lineCanvas = document.getElementById('usageLineChart') as HTMLCanvasElement | null;
  const doughnutCanvas = document.getElementById('serviceDoughnutChart') as HTMLCanvasElement | null;
  const barCanvas = document.getElementById('employeeBarChart') as HTMLCanvasElement | null;
  const heatCanvas = document.getElementById('activityHeatChart') as HTMLCanvasElement | null;

  if (lineCanvas) renderEmptyChart(lineCanvas, 'Sem conexão com o backend');
  if (doughnutCanvas) renderEmptyChart(doughnutCanvas, 'Sem conexão com o backend');
  if (barCanvas) renderEmptyChart(barCanvas, 'Sem conexão com o backend');
  if (heatCanvas) renderEmptyChart(heatCanvas, 'Sem conexão com o backend');
}

interface KPIData {
  label: string;
  value: string;
  trend: number;
  icon: string;
  gradient?: boolean;
  trendLabel?: string;
  trendClass?: string;
}

function renderKPIs(kpis: KPIData[]) {
  const grid = document.getElementById('kpiGrid')!;
  grid.innerHTML = kpis.map(kpi => {
    const trendClass = kpi.trendClass || (kpi.trend > 0 ? 'up' : kpi.trend < 0 ? 'down' : 'neutral');
    const trendIcon = kpi.trend > 0 ? '↑' : kpi.trend < 0 ? '↓' : '';
    const trendText = kpi.trendLabel || (kpi.trend !== 0 ? `${trendIcon} ${Math.abs(kpi.trend).toFixed(1)}% vs período anterior` : '—');
    return `
      <div class="kpi-card">
        <span class="kpi-icon">${kpi.icon}</span>
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value ${kpi.gradient ? 'gradient' : ''}">${kpi.value}</div>
        <div class="kpi-trend ${trendClass}">${trendText}</div>
      </div>`;
  }).join('');
}

// ---- Charts ----
async function renderLineChart() {
  const canvas = document.getElementById('usageLineChart') as HTMLCanvasElement;
  if (lineChart) lineChart.destroy();

  const dailyData = await fetchDailyUsage(currentRange);
  if (dailyData.length === 0) {
    renderEmptyChart(canvas, 'Sem dados de uso ainda');
    return;
  }

  // Group by date and service
  const dates = [...new Set(dailyData.map(d => d.date))].sort();
  const services = [...new Set(dailyData.map(d => d.service))];

  const labels = dates.map(d => {
    const date = new Date(d + 'T12:00:00');
    return `${date.getDate()}/${date.getMonth() + 1}`;
  });

  const datasets = services.map(service => {
    const data = dates.map(date => {
      const row = dailyData.find(r => r.date === date && r.service === service);
      return row ? row.total_tokens / 1000 : 0;
    });
    return {
      label: getServiceLabel(service),
      data,
      borderColor: getServiceColor(service),
      backgroundColor: getServiceColor(service) + '15',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
    };
  });

  lineChart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions({
      y: { callback: (v: any) => formatNumber(Number(v) * 1000) },
      tooltip: { label: (ctx: any) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y * 1000)} tokens` },
    }),
  });

  // Legend
  const legendEl = document.getElementById('lineChartLegend')!;
  legendEl.innerHTML = services.map(s => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${getServiceColor(s)}"></span>
      ${getServiceLabel(s)}
    </div>
  `).join('');
}

async function renderDoughnutChart() {
  const canvas = document.getElementById('serviceDoughnutChart') as HTMLCanvasElement;
  if (doughnutChart) doughnutChart.destroy();

  const byService = await fetchUsageByService(currentRange);
  if (byService.length === 0) {
    renderEmptyChart(canvas, 'Sem dados');
    return;
  }

  doughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: byService.map(s => getServiceLabel(s.service)),
      datasets: [{
        data: byService.map(s => Math.round(s.total_cost * 100) / 100),
        backgroundColor: byService.map(s => getServiceColor(s.service)),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#475569', padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
          borderColor: '#dbe6f6', borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed)}` },
        },
      },
    },
  });
}

async function renderBarChart() {
  const canvas = document.getElementById('employeeBarChart') as HTMLCanvasElement;
  if (barChart) barChart.destroy();

  const employees = await fetchEmployees(currentRange);
  const top8 = employees.slice(0, 8);
  if (top8.length === 0) {
    renderEmptyChart(canvas, 'Nenhum funcionário registrado');
    return;
  }

  const colors = ['#6366f1', '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

  barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top8.map(e => e.name.split(' ')[0]),
      datasets: [{
        data: top8.map(e => e.totalTokens / 1000),
        backgroundColor: top8.map((_, i) => colors[i % colors.length] + 'CC'),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
          borderColor: '#dbe6f6', borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${formatNumber(Number(ctx.parsed.x ?? 0) * 1000)} tokens (${formatCurrency(top8[ctx.dataIndex].totalCost)})` },
        },
      },
      scales: {
        x: { grid: { color: '#edf2fb' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v: any) => formatNumber(Number(v) * 1000) } },
        y: { grid: { display: false }, ticks: { color: '#334155', font: { size: 12, weight: '500' as any } } },
      },
    },
  });
}

async function renderHeatChart() {
  const canvas = document.getElementById('activityHeatChart') as HTMLCanvasElement;
  if (heatChart) heatChart.destroy();

  const hourlyData = await fetchHourlyActivity(currentRange);
  if (hourlyData.length === 0) {
    renderEmptyChart(canvas, 'Sem dados de atividade');
    return;
  }

  const hours = new Array(24).fill(0);
  for (const row of hourlyData) hours[row.hour] = row.total_tokens;
  const maxVal = Math.max(...hours, 1);

  const colors = hours.map((val, i) => {
    const isBusiness = i >= 8 && i < 18;
    const intensity = val / maxVal;
    if (!isBusiness && intensity > 0.2) return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
    return isBusiness
      ? `rgba(99, 102, 241, ${0.2 + intensity * 0.8})`
      : `rgba(100, 116, 139, ${0.1 + intensity * 0.3})`;
  });

  heatChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
      datasets: [{ data: hours.map(h => h / 1000), backgroundColor: colors, borderRadius: 4, borderSkipped: false }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
          borderColor: '#dbe6f6', borderWidth: 1, padding: 12, cornerRadius: 8,
          callbacks: {
            title: (items) => {
              const hr = items[0].dataIndex;
              return `${hr}:00 - ${hr + 1}:00 ${(hr < 7 || hr >= 21) ? '⚠️ Fora do horário' : ''}`;
            },
            label: (ctx) => ` ${formatNumber(Number(ctx.parsed.y ?? 0) * 1000)} tokens`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
        y: { grid: { color: '#edf2fb' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v: any) => formatNumber(Number(v) * 1000) } },
      },
    },
  });
}

function renderEmptyChart(canvas: HTMLCanvasElement, message: string) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  ctx.fillText('Os dados aparecerão quando o agent começar a enviar.', canvas.width / 2, canvas.height / 2 + 24);
}

function chartOptions(overrides: any = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
          backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
          borderColor: '#dbe6f6', borderWidth: 1, padding: 12, cornerRadius: 8,
        callbacks: overrides.tooltip ? { label: overrides.tooltip.label } : {},
      },
    },
    scales: {
      x: { grid: { color: '#edf2fb' }, ticks: { color: '#64748b', maxTicksLimit: 10, font: { size: 11 } } },
      y: {
        grid: { color: '#edf2fb' },
        ticks: { color: '#64748b', font: { size: 11 }, ...(overrides.y || {}) },
      },
    },
  };
}

// ---- Employee Table ----
async function renderEmployeeTable(searchTerm = '') {
  try {
    let employees = await fetchEmployees(currentRange);

    if (searchTerm) {
      employees = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm) ||
        (e.role && e.role.toLowerCase().includes(searchTerm)) ||
        e.pc_id.toLowerCase().includes(searchTerm)
      );
    }

    const tbody = document.getElementById('employeeTableBody')!;

    if (employees.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">
          <div style="font-size:2rem;margin-bottom:8px">📡</div>
          <strong>Nenhum funcionário registrado ainda</strong><br>
          <span style="font-size:0.85rem">Instale o agent no PC dos funcionários para começar a coletar dados.</span>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = employees.map(emp => {
      const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const statusLabel = emp.status === 'normal' ? 'Normal' : emp.status === 'warning' ? 'Atenção' : 'Crítico';
      return `
        <tr>
          <td>
            <div class="employee-cell">
              <div class="employee-avatar">${initials}</div>
              <div class="employee-info">
                <span class="emp-name">${emp.name}</span>
                <span class="emp-role">${emp.role || '—'}</span>
              </div>
            </div>
          </td>
          <td><code style="font-size:0.8rem;color:var(--accent-secondary)">${emp.pc_id}</code></td>
          <td><strong>${formatNumber(emp.totalTokens)}</strong></td>
          <td>${formatCurrency(emp.totalCost)}</td>
          <td>${getServiceLabel(emp.topService) || '—'}</td>
          <td>
            <span class="status-badge ${emp.status}">
              <span class="status-dot"></span>
              ${statusLabel}
            </span>
          </td>
          <td>
            <button class="btn-detail" data-employee-id="${emp.id}">Ver detalhes</button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => openEmployeeModal((btn as HTMLElement).dataset.employeeId!));
    });

  } catch (err) {
    console.error('Erro ao carregar funcionários:', err);
  }
}

// ---- Alerts ----
async function renderAlerts(severity = 'all') {
  try {
    const alerts = await fetchAlerts(severity);
    const employees = await fetchEmployees(currentRange);
    const list = document.getElementById('alertsList')!;

    if (alerts.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
          <div style="font-size:2rem;margin-bottom:8px">✅</div>
          <strong>Nenhum alerta${severity !== 'all' ? ' deste tipo' : ''}</strong><br>
          <span style="font-size:0.85rem">Alertas são gerados automaticamente quando há uso anormal.</span>
        </div>`;
      return;
    }

    const severityIcons: Record<string, string> = { critical: '🔴', warning: '🟡', info: '🔵' };

    list.innerHTML = alerts.map((alert, i) => {
      const employee = employees.find(e => e.id === alert.employee_id);
      return `
        <div class="alert-item ${alert.severity}" style="animation-delay: ${i * 0.05}s">
          <div class="alert-severity-icon">${severityIcons[alert.severity] || '🔵'}</div>
          <div class="alert-content">
            <h4>${alert.message}</h4>
            <p>${alert.detail}</p>
            <div class="alert-meta">
              <span>👤 ${employee?.name || alert.employee_id}</span>
              ${employee ? `<span>💻 ${employee.pc_id}</span>` : ''}
            </div>
          </div>
          <div class="alert-time">${formatTimeAgo(alert.timestamp)}</div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Erro ao carregar alertas:', err);
  }
}

// ---- Employee Modal ----
function initModal() {
  const overlay = document.getElementById('employeeModal')!;
  document.getElementById('modalClose')!.addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.classList.remove('active');
  });
}

async function openEmployeeModal(employeeId: string) {
  try {
    const detail = await fetchEmployeeDetail(employeeId, 30);
    const overlay = document.getElementById('employeeModal')!;
    const emp = detail.employee;

    document.getElementById('modalEmployeeName')!.textContent = `${emp.name} — ${emp.role || ''}`;

    // KPIs
    const totalTokens = detail.usage.reduce((s, r) => s + r.total_tokens, 0);
    const totalCost = detail.usage.reduce((s, r) => s + r.total_cost, 0);
    const daysActive = new Set(detail.usage.map(r => r.date)).size;

    document.getElementById('modalKpis')!.innerHTML = `
      <div class="modal-kpi"><div class="mkpi-label">Tokens (30d)</div><div class="mkpi-value">${formatNumber(totalTokens)}</div></div>
      <div class="modal-kpi"><div class="mkpi-label">Custo (30d)</div><div class="mkpi-value">${formatCurrency(totalCost)}</div></div>
      <div class="modal-kpi"><div class="mkpi-label">Dias Ativos</div><div class="mkpi-value">${daysActive}</div></div>`;

    // Chart
    const canvas = document.getElementById('modalChart') as HTMLCanvasElement;
    if (modalChart) modalChart.destroy();

    const dates = [...new Set(detail.usage.map(r => r.date))].sort();
    const services = [...new Set(detail.usage.map(r => r.service))];

    modalChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dates.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: services.map(service => ({
          label: getServiceLabel(service),
          data: dates.map(date => {
            const row = detail.usage.find(r => r.date === date && r.service === service);
            return row ? row.total_tokens / 1000 : 0;
          }),
          backgroundColor: getServiceColor(service) + 'AA',
          borderRadius: 3,
          borderSkipped: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#475569', usePointStyle: true, pointStyle: 'circle', font: { size: 10 } } },
          tooltip: {
            backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#475569',
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(Number(ctx.parsed.y ?? 0) * 1000)} tokens` },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 15 } },
          y: { stacked: true, grid: { color: '#edf2fb' }, ticks: { color: '#64748b', font: { size: 10 }, callback: (v: any) => formatNumber(Number(v) * 1000) } },
        },
      },
    });

    // Breakdown by service
    const serviceMap = new Map<string, { tokens: number; cost: number }>();
    for (const r of detail.usage) {
      const e = serviceMap.get(r.service) || { tokens: 0, cost: 0 };
      e.tokens += r.total_tokens;
      e.cost += r.total_cost;
      serviceMap.set(r.service, e);
    }
    const breakdown = [...serviceMap.entries()].map(([s, d]) => ({ service: s, ...d })).sort((a, b) => b.tokens - a.tokens);
    const maxTokens = breakdown[0]?.tokens || 1;

    document.getElementById('modalBreakdown')!.innerHTML = breakdown.map(item => {
      const pct = (item.tokens / maxTokens * 100).toFixed(0);
      return `
        <div class="breakdown-row">
          <div class="breakdown-icon" style="background:${getServiceColor(item.service)}"></div>
          <div class="breakdown-name">${getServiceLabel(item.service)}</div>
          <div class="breakdown-tokens">${formatNumber(item.tokens)} tokens</div>
          <div class="breakdown-bar-container"><div class="breakdown-bar" style="width:${pct}%;background:${getServiceColor(item.service)}"></div></div>
          <div class="breakdown-cost">${formatCurrency(item.cost)}</div>
        </div>`;
    }).join('');

    overlay.classList.add('active');
  } catch (err) {
    console.error('Erro ao abrir detalhes:', err);
  }
}
