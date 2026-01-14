let db = null;
let dbAvailable = false;

// In-memory fallback storage
const memoryStorage = {
  reports: [],
  emailReports: [],
  nextId: 1
};

// Try to initialize SQLite database
function initDatabase() {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');

    db = new Database(path.join(__dirname, 'website-checker.db'));

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

    dbAvailable = true;
    console.log('SQLite database initialized successfully');
  } catch (error) {
    console.warn('SQLite not available, using in-memory storage:', error.message);
    dbAvailable = false;
  }
}

// Save report to database or memory
function saveReport(url, score, checks) {
  const timestamp = new Date().toISOString();
  const checksJson = JSON.stringify(checks);

  if (dbAvailable && db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO reports (url, score, timestamp, checks)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(url, score, timestamp, checksJson);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Database save error:', error.message);
    }
  }

  // Fallback to memory storage
  const id = memoryStorage.nextId++;
  memoryStorage.reports.push({
    id,
    url,
    score,
    timestamp,
    checks: checksJson,
    created_at: timestamp
  });
  return id;
}

// Get report by ID
function getReport(id) {
  if (dbAvailable && db) {
    try {
      const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
      const report = stmt.get(id);
      if (report) {
        report.checks = JSON.parse(report.checks);
      }
      return report;
    } catch (error) {
      console.error('Database get error:', error.message);
    }
  }

  // Fallback to memory storage
  const report = memoryStorage.reports.find(r => r.id === id);
  if (report) {
    return { ...report, checks: JSON.parse(report.checks) };
  }
  return null;
}

// Get all reports
function getAllReports(limit = 50) {
  if (dbAvailable && db) {
    try {
      const stmt = db.prepare(`
        SELECT id, url, score, timestamp, created_at
        FROM reports
        ORDER BY created_at DESC
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      console.error('Database getAllReports error:', error.message);
    }
  }

  // Fallback to memory storage
  return memoryStorage.reports
    .slice(-limit)
    .reverse()
    .map(({ id, url, score, timestamp, created_at }) => ({
      id, url, score, timestamp, created_at
    }));
}

// Get reports by URL
function getReportsByUrl(url, limit = 10) {
  if (dbAvailable && db) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM reports
        WHERE url = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      const reports = stmt.all(url, limit);
      return reports.map(report => ({
        ...report,
        checks: JSON.parse(report.checks)
      }));
    } catch (error) {
      console.error('Database getReportsByUrl error:', error.message);
    }
  }

  // Fallback to memory storage
  return memoryStorage.reports
    .filter(r => r.url === url)
    .slice(-limit)
    .reverse()
    .map(report => ({ ...report, checks: JSON.parse(report.checks) }));
}

// Save email report record
function saveEmailReport(reportId, email) {
  if (dbAvailable && db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO email_reports (report_id, email)
        VALUES (?, ?)
      `);
      return stmt.run(reportId, email);
    } catch (error) {
      console.error('Database saveEmailReport error:', error.message);
    }
  }

  // Fallback to memory storage
  memoryStorage.emailReports.push({
    id: memoryStorage.emailReports.length + 1,
    report_id: reportId,
    email,
    sent_at: new Date().toISOString()
  });
  return { changes: 1 };
}

// Get email reports
function getEmailReports(reportId) {
  if (dbAvailable && db) {
    try {
      const stmt = db.prepare(`
        SELECT * FROM email_reports
        WHERE report_id = ?
        ORDER BY sent_at DESC
      `);
      return stmt.all(reportId);
    } catch (error) {
      console.error('Database getEmailReports error:', error.message);
    }
  }

  // Fallback to memory storage
  return memoryStorage.emailReports
    .filter(r => r.report_id === reportId)
    .reverse();
}

// Check if database is available
function isDatabaseAvailable() {
  return dbAvailable;
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
  getEmailReports,
  isDatabaseAvailable
};
