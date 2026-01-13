const Database = require('better-sqlite3');
const path = require('path');

// Create or open database
const db = new Database(path.join(__dirname, 'website-checker.db'));

// Initialize database schema
function initDatabase() {
  // Create reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      checks TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create email_reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )
  `);

  console.log('Database initialized successfully');
}

// Save report to database
function saveReport(url, score, checks) {
  const timestamp = new Date().toISOString();
  const checksJson = JSON.stringify(checks);

  const stmt = db.prepare(`
    INSERT INTO reports (url, score, timestamp, checks)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(url, score, timestamp, checksJson);
  return result.lastInsertRowid;
}

// Get report by ID
function getReport(id) {
  const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
  const report = stmt.get(id);

  if (report) {
    report.checks = JSON.parse(report.checks);
  }

  return report;
}

// Get all reports
function getAllReports(limit = 50) {
  const stmt = db.prepare(`
    SELECT id, url, score, timestamp, created_at
    FROM reports
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

// Get reports by URL
function getReportsByUrl(url, limit = 10) {
  const stmt = db.prepare(`
    SELECT * FROM reports
    WHERE url = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const reports = stmt.all(url, limit);

  return reports.map(report => {
    report.checks = JSON.parse(report.checks);
    return report;
  });
}

// Save email report record
function saveEmailReport(reportId, email) {
  const stmt = db.prepare(`
    INSERT INTO email_reports (report_id, email)
    VALUES (?, ?)
  `);

  return stmt.run(reportId, email);
}

// Get email reports
function getEmailReports(reportId) {
  const stmt = db.prepare(`
    SELECT * FROM email_reports
    WHERE report_id = ?
    ORDER BY sent_at DESC
  `);

  return stmt.all(reportId);
}

// Initialize database on module load
initDatabase();

module.exports = {
  db,
  saveReport,
  getReport,
  getAllReports,
  getReportsByUrl,
  saveEmailReport,
  getEmailReports
};
