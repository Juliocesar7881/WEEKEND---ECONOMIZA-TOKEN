// =============================================
// TokenTracker - Express Server
// Serves dashboard + API for agents
// =============================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db.cjs');
const { checkUsageAnomaly, getPricing } = require('./alerts.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve dashboard frontend (built files)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// =============================================
// API ENDPOINTS
// =============================================

// ---- Agent reports usage here ----
app.post('/api/usage', (req, res) => {
  try {
    const { employeeId, employeeName, pcId, department, role, service, model, tokensInput, tokensOutput } = req.body;

    if (!employeeId || !service) {
      return res.status(400).json({ error: 'employeeId and service are required' });
    }

    // Auto-register/update employee
    db.upsertEmployee(employeeId, employeeName || employeeId, pcId || 'unknown', department || '', role || '');

    // Calculate cost
    const totalTokens = (tokensInput || 0) + (tokensOutput || 0);
    const cost = (totalTokens / 1000) * getPricing(service);

    // Save usage
    db.insertUsage(employeeId, service, model || '', tokensInput || 0, tokensOutput || 0, cost);

    // Check for anomalies
    checkUsageAnomaly(employeeId, service, totalTokens);

    res.json({ ok: true, tokens: totalTokens, cost });
  } catch (err) {
    console.error('Error saving usage:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Dashboard fetches data here ----

// Overview KPIs
app.get('/api/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const usage = db.getUsage(days);
  const employees = db.getEmployees();

  const totalTokens = usage.reduce((s, r) => s + r.tokens_input + r.tokens_output, 0);
  const totalCost = usage.reduce((s, r) => s + r.cost, 0);
  const activeUsers = new Set(usage.map(r => r.employee_id)).size;
  const avgCostPerUser = activeUsers > 0 ? totalCost / activeUsers : 0;

  // Top service
  const byService = {};
  for (const r of usage) {
    byService[r.service] = (byService[r.service] || 0) + r.tokens_input + r.tokens_output;
  }
  const topService = Object.entries(byService).sort((a, b) => b[1] - a[1])[0];

  // Critical alerts count
  const criticalAlerts = db.getAlerts('critical', 100).length;
  const warningAlerts = db.getAlerts('warning', 100).length;

  // Previous period for trend
  const prevUsage = db.getUsage(days * 2).filter(r => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(r.timestamp) < cutoff;
  });
  const prevTotalTokens = prevUsage.reduce((s, r) => s + r.tokens_input + r.tokens_output, 0);
  const prevTotalCost = prevUsage.reduce((s, r) => s + r.cost, 0);

  res.json({
    totalTokens,
    totalCost,
    activeUsers,
    totalEmployees: employees.length,
    avgCostPerUser,
    topService: topService ? { name: topService[0], tokens: topService[1] } : null,
    criticalAlerts,
    warningAlerts,
    trends: {
      tokens: prevTotalTokens > 0 ? ((totalTokens - prevTotalTokens) / prevTotalTokens * 100) : 0,
      cost: prevTotalCost > 0 ? ((totalCost - prevTotalCost) / prevTotalCost * 100) : 0,
    }
  });
});

// Employees list with usage data
app.get('/api/employees', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const employees = db.getEmployees();
  const byEmployee = db.getUsageByEmployee(days);

  const result = employees.map(emp => {
    const usage = byEmployee.find(u => u.employee_id === emp.id);
    const topService = db.getTopServiceForEmployee(emp.id, days);

    // Determine status
    const dailyLimitValue = db.getSetting('daily_limit_per_employee');
    const dailyLimit = Number(dailyLimitValue);
    const todayUsage = db.getUsage(1).filter(r => r.employee_id === emp.id);
    const todayTokens = todayUsage.reduce((s, r) => s + r.tokens_input + r.tokens_output, 0);
    let status = 'normal';
    if (Number.isFinite(dailyLimit) && dailyLimit > 0) {
      if (todayTokens > dailyLimit) status = 'critical';
      else if (todayTokens > dailyLimit * 0.7) status = 'warning';
    }

    return {
      ...emp,
      totalTokens: usage ? usage.total_tokens : 0,
      totalCost: usage ? usage.total_cost : 0,
      requestCount: usage ? usage.request_count : 0,
      topService,
      status,
    };
  });

  res.json(result.sort((a, b) => b.totalTokens - a.totalTokens));
});

// Daily usage for charts
app.get('/api/usage/daily', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json(db.getDailyUsage(days));
});

// Usage by service
app.get('/api/usage/by-service', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json(db.getUsageByService(days));
});

// Hourly activity
app.get('/api/usage/hourly', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  res.json(db.getHourlyActivity(days));
});

// Employee detail
app.get('/api/employees/:id/usage', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const detail = db.getEmployeeUsageDetail(req.params.id, days);
  const employee = db.getEmployees().find(e => e.id === req.params.id);
  res.json({ employee, usage: detail });
});

// Alerts
app.get('/api/alerts', (req, res) => {
  const severity = req.query.severity || null;
  res.json(db.getAlerts(severity, 100));
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getAllSettings());
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (key && value !== undefined) {
    db.setSetting(key, String(value));
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'key and value required' });
  }
});

// Fallback to dashboard for SPA routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    next();
  }
});

// ---- Start ----
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║           🧭  Norte.AI Server            ║');
  console.log(`  ║    Dashboard: http://localhost:${PORT}        ║`);
  console.log('  ║    API:       http://localhost:' + PORT + '/api    ║');
  console.log('  ║                                          ║');
  console.log('  ║    Aguardando dados dos agents...        ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
