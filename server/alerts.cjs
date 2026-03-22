// =============================================
// TokenTracker - Alert Detection Engine
// =============================================
const db = require('./db.cjs');

// Service pricing per 1K tokens (USD)
const SERVICE_PRICING = {
  'anthropic': 0.015,
  'openai': 0.020,
  'cursor': 0.012,
  'google': 0.010,
  'copilot': 0.008,
};

function getPricing(service) {
  for (const [key, price] of Object.entries(SERVICE_PRICING)) {
    if (service.toLowerCase().includes(key)) return price;
  }
  return 0;
}

function checkUsageAnomaly(employeeId, service, tokensTotal) {
  const employee = db.getEmployees().find(e => e.id === employeeId);
  if (!employee) return;

  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Check 1: After hours usage (before 7 AM or after 21 PM)
  if (hour < 7 || hour >= 21) {
    db.insertAlert(
      employeeId,
      'warning',
      `${employee.name} usando IA fora do horário comercial`,
      `Uso de ${formatTokens(tokensTotal)} tokens às ${hour}:${String(now.getMinutes()).padStart(2, '0')} via ${service}. Fora do horário padrão (7h-21h).`,
      'after_hours'
    );
  }

  // Check 2: Weekend usage
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    db.insertAlert(
      employeeId,
      'warning',
      `${employee.name} usando IA no fim de semana`,
      `Uso de ${formatTokens(tokensTotal)} tokens no ${dayOfWeek === 0 ? 'domingo' : 'sábado'} via ${service}.`,
      'weekend_use'
    );
  }

  // Check 3: Daily limit exceeded
  const dailyLimitValue = db.getSetting('daily_limit_per_employee');
  const dailyLimit = Number(dailyLimitValue);
  const todayUsage = db.getUsage(1).filter(r => r.employee_id === employeeId);
  const todayTotal = todayUsage.reduce((sum, r) => sum + r.tokens_input + r.tokens_output, 0);

  if (Number.isFinite(dailyLimit) && dailyLimit > 0 && todayTotal > dailyLimit) {
    const pct = Math.round((todayTotal / dailyLimit) * 100);
    // Only alert once per day per employee
    const recentAlerts = db.getAlerts('critical', 100).filter(a =>
      a.employee_id === employeeId &&
      a.type === 'limit_exceeded' &&
      isToday(a.timestamp)
    );
    if (recentAlerts.length === 0) {
      db.insertAlert(
        employeeId,
        'critical',
        `${employee.name} excedeu o limite diário em ${pct - 100}%`,
        `Uso de ${formatTokens(todayTotal)} tokens hoje, acima do limite de ${formatTokens(dailyLimit)}.`,
        'limit_exceeded'
      );
    }
  }

  // Check 4: Large single request (> 10K tokens)
  if (tokensTotal > 10000) {
    db.insertAlert(
      employeeId,
      'info',
      `Requisição grande: ${employee.name} usou ${formatTokens(tokensTotal)} tokens`,
      `Uma única chamada ao ${service} consumiu ${formatTokens(tokensTotal)} tokens.`,
      'large_request'
    );
  }
}

function isToday(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

module.exports = { checkUsageAnomaly, getPricing };
