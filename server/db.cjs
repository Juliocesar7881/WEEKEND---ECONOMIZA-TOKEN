// =============================================
// TokenTracker - Database Layer (SQLite)
// =============================================
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tokentracker.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pc_id TEXT NOT NULL,
      department TEXT DEFAULT '',
      role TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      service TEXT NOT NULL,
      model TEXT DEFAULT '',
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      hour INTEGER DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      detail TEXT DEFAULT '',
      type TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_employee ON usage_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_records(timestamp);
    CREATE INDEX IF NOT EXISTS idx_usage_service ON usage_records(service);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
  `);

}

// ---- Employee operations ----
function upsertEmployee(id, name, pcId, department = '', role = '') {
  const d = getDb();
  d.prepare(`
    INSERT INTO employees (id, name, pc_id, department, role)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, pc_id=excluded.pc_id,
      department=excluded.department, role=excluded.role
  `).run(id, name, pcId, department, role);
}

function getEmployees() {
  return getDb().prepare('SELECT * FROM employees ORDER BY created_at').all();
}

// ---- Usage operations ----
function insertUsage(employeeId, service, model, tokensInput, tokensOutput, cost) {
  const now = new Date();
  const hour = now.getHours();
  getDb().prepare(`
    INSERT INTO usage_records (employee_id, service, model, tokens_input, tokens_output, cost, hour, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(employeeId, service, model, tokensInput, tokensOutput, cost, hour);
}

function getUsage(days = 7) {
  return getDb().prepare(`
    SELECT * FROM usage_records
    WHERE timestamp >= datetime('now', ?)
    ORDER BY timestamp DESC
  `).all(`-${days} days`);
}

function getUsageByEmployee(days = 7) {
  return getDb().prepare(`
    SELECT
      employee_id,
      SUM(tokens_input + tokens_output) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(*) as request_count
    FROM usage_records
    WHERE timestamp >= datetime('now', ?)
    GROUP BY employee_id
    ORDER BY total_tokens DESC
  `).all(`-${days} days`);
}

function getUsageByService(days = 7) {
  return getDb().prepare(`
    SELECT
      service,
      SUM(tokens_input + tokens_output) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(*) as request_count
    FROM usage_records
    WHERE timestamp >= datetime('now', ?)
    GROUP BY service
    ORDER BY total_tokens DESC
  `).all(`-${days} days`);
}

function getDailyUsage(days = 7) {
  return getDb().prepare(`
    SELECT
      date(timestamp) as date,
      service,
      SUM(tokens_input + tokens_output) as total_tokens,
      SUM(cost) as total_cost
    FROM usage_records
    WHERE timestamp >= datetime('now', ?)
    GROUP BY date(timestamp), service
    ORDER BY date
  `).all(`-${days} days`);
}

function getHourlyActivity(days = 7) {
  return getDb().prepare(`
    SELECT
      hour,
      SUM(tokens_input + tokens_output) as total_tokens
    FROM usage_records
    WHERE timestamp >= datetime('now', ?)
    GROUP BY hour
    ORDER BY hour
  `).all(`-${days} days`);
}

function getEmployeeUsageDetail(employeeId, days = 30) {
  return getDb().prepare(`
    SELECT
      date(timestamp) as date,
      service,
      SUM(tokens_input + tokens_output) as total_tokens,
      SUM(cost) as total_cost
    FROM usage_records
    WHERE employee_id = ? AND timestamp >= datetime('now', ?)
    GROUP BY date(timestamp), service
    ORDER BY date
  `).all(employeeId, `-${days} days`);
}

function getTopServiceForEmployee(employeeId, days = 7) {
  const row = getDb().prepare(`
    SELECT service, SUM(tokens_input + tokens_output) as total
    FROM usage_records
    WHERE employee_id = ? AND timestamp >= datetime('now', ?)
    GROUP BY service
    ORDER BY total DESC
    LIMIT 1
  `).get(employeeId, `-${days} days`);
  return row ? row.service : '';
}

// ---- Alert operations ----
function insertAlert(employeeId, severity, message, detail, type) {
  getDb().prepare(`
    INSERT INTO alerts (employee_id, severity, message, detail, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(employeeId, severity, message, detail, type);
}

function getAlerts(severity = null, limit = 50) {
  if (severity && severity !== 'all') {
    return getDb().prepare('SELECT * FROM alerts WHERE severity = ? ORDER BY timestamp DESC LIMIT ?').all(severity, limit);
  }
  return getDb().prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?').all(limit);
}

// ---- Settings ----
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const rows = getDb().prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

module.exports = {
  getDb, upsertEmployee, getEmployees,
  insertUsage, getUsage, getUsageByEmployee, getUsageByService,
  getDailyUsage, getHourlyActivity, getEmployeeUsageDetail, getTopServiceForEmployee,
  insertAlert, getAlerts,
  getSetting, setSetting, getAllSettings,
};
