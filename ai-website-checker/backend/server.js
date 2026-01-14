const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { saveReport, getReport, getAllReports, getReportsByUrl, saveEmailReport, isDatabaseAvailable } = require('./database');
const { generatePDFReport } = require('./pdf-generator');
const { sendReportEmail } = require('./email-sender');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

// Website verification endpoint (with database save)
app.post('/api/verify', async (req, res) => {
  const { url, saveToDb = true } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const results = await analyzeWebsite(url);

    // Save to database if requested
    if (saveToDb) {
      const reportId = saveReport(results.url, results.score, results.checks);
      results.reportId = reportId;
    }

    res.json(results);
  } catch (error) {
    console.error('Error analyzing website:', error);
    res.status(500).json({
      error: 'Failed to analyze website',
      message: error.message
    });
  }
});

// Bulk URL verification endpoint
app.post('/api/verify-bulk', async (req, res) => {
  const { urls, email } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (urls.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 URLs allowed per request' });
  }

  try {
    const results = [];
    const pdfPaths = [];

    for (const url of urls) {
      try {
        const result = await analyzeWebsite(url);
        const reportId = saveReport(result.url, result.score, result.checks);
        result.reportId = reportId;

        // Generate PDF for each successful result
        const pdfPath = path.join(reportsDir, `report-${reportId}-${Date.now()}.pdf`);
        await generatePDFReport(result, pdfPath);
        pdfPaths.push(pdfPath);

        // Save email record
        saveEmailReport(reportId, email);

        results.push({
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          success: false,
          url,
          error: error.message
        });
      }
    }

    // Send email with all PDFs
    if (pdfPaths.length > 0) {
      const bulkSummary = {
        url: `Bulk Analysis (${results.filter(r => r.success).length} sites)`,
        score: Math.round(results.filter(r => r.success).reduce((sum, r) => sum + r.score, 0) / results.filter(r => r.success).length),
        timestamp: new Date().toISOString(),
        checks: {}
      };
      await sendReportEmail(email, bulkSummary, pdfPaths);

      // Delete PDFs after sending
      pdfPaths.forEach(p => {
        try { fs.unlinkSync(p); } catch (e) {}
      });
    }

    res.json({
      total: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      emailSent: pdfPaths.length > 0,
      results
    });

  } catch (error) {
    console.error('Error in bulk verification:', error);
    res.status(500).json({
      error: 'Failed to process bulk verification',
      message: error.message
    });
  }
});

// Generate PDF and send email
app.post('/api/send-report', async (req, res) => {
  const { url, email } = req.body;

  if (!url || !email) {
    return res.status(400).json({ error: 'URL and email are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Analyze website
    const results = await analyzeWebsite(url);

    // Save to database
    const reportId = saveReport(results.url, results.score, results.checks);
    results.reportId = reportId;

    // Generate PDF
    const pdfPath = path.join(reportsDir, `report-${reportId}-${Date.now()}.pdf`);
    await generatePDFReport(results, pdfPath);

    // Send email
    const emailResult = await sendReportEmail(email, results, pdfPath);

    // Save email record
    saveEmailReport(reportId, email);

    // Delete PDF after sending (optional)
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      message: 'Report sent successfully',
      reportId,
      emailSent: emailResult.success,
      results
    });

  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({
      error: 'Failed to send report',
      message: error.message,
      details: error.code === 'EAUTH' ? 'Email authentication failed. Please check SMTP credentials.' : undefined
    });
  }
});

// Get report by ID
app.get('/api/reports/:id', (req, res) => {
  try {
    const report = getReport(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error retrieving report:', error);
    res.status(500).json({
      error: 'Failed to retrieve report',
      message: error.message
    });
  }
});

// Get all reports (paginated)
app.get('/api/reports', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const reports = getAllReports(limit);

    res.json({
      total: reports.length,
      reports
    });
  } catch (error) {
    console.error('Error retrieving reports:', error);
    res.status(500).json({
      error: 'Failed to retrieve reports',
      message: error.message
    });
  }
});

// Get reports by URL
app.get('/api/reports/url/:url', (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    const limit = parseInt(req.query.limit) || 10;
    const reports = getReportsByUrl(url, limit);

    res.json({
      url,
      total: reports.length,
      reports
    });
  } catch (error) {
    console.error('Error retrieving reports by URL:', error);
    res.status(500).json({
      error: 'Failed to retrieve reports',
      message: error.message
    });
  }
});

// Health check endpoint (root level for Railway)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Detailed health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'AI Website Checker API is running',
    timestamp: new Date().toISOString(),
    features: {
      singleVerification: true,
      bulkVerification: true,
      pdfGeneration: true,
      emailSending: true,
      database: isDatabaseAvailable()
    }
  });
});

async function analyzeWebsite(url) {
  // Fetch the website HTML
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Website-Checker/1.0)'
    },
    timeout: 10000
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Analyze various aspects
  const results = {
    url,
    timestamp: new Date().toISOString(),
    score: 0,
    maxScore: 100,
    checks: {
      structure: analyzeStructure($),
      metadata: analyzeMetadata($),
      content: analyzeContent($),
      accessibility: analyzeAccessibility($),
      performance: analyzePerformance($, html)
    }
  };

  // Calculate overall score
  const checks = Object.values(results.checks);
  const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
  const maxPossibleScore = checks.reduce((sum, check) => sum + check.maxScore, 0);
  results.score = Math.round((totalScore / maxPossibleScore) * 100);
  results.maxScore = 100;

  return results;
}

function analyzeStructure($) {
  const issues = [];
  let score = 0;
  const maxScore = 20;

  // Check for semantic HTML5 elements
  const hasHeader = $('header').length > 0;
  const hasNav = $('nav').length > 0;
  const hasMain = $('main').length > 0;
  const hasFooter = $('footer').length > 0;

  if (hasHeader) score += 5;
  else issues.push('Missing <header> element');

  if (hasNav) score += 5;
  else issues.push('Missing <nav> element');

  if (hasMain) score += 5;
  else issues.push('Missing <main> element');

  if (hasFooter) score += 5;
  else issues.push('Missing <footer> element');

  return {
    category: 'HTML Structure',
    score,
    maxScore,
    issues,
    recommendations: issues.length > 0 ?
      ['Use semantic HTML5 elements (header, nav, main, footer) for better AI understanding'] :
      []
  };
}

function analyzeMetadata($) {
  const issues = [];
  let score = 0;
  const maxScore = 25;

  // Check title
  const title = $('title').text();
  if (title && title.length > 0) {
    score += 5;
    if (title.length >= 30 && title.length <= 60) score += 3;
    else issues.push('Title should be 30-60 characters for optimal display');
  } else {
    issues.push('Missing <title> tag');
  }

  // Check meta description
  const description = $('meta[name="description"]').attr('content');
  if (description && description.length > 0) {
    score += 5;
    if (description.length >= 120 && description.length <= 160) score += 2;
    else issues.push('Meta description should be 120-160 characters');
  } else {
    issues.push('Missing meta description');
  }

  // Check Open Graph tags
  const ogTitle = $('meta[property="og:title"]').length > 0;
  const ogDescription = $('meta[property="og:description"]').length > 0;
  const ogImage = $('meta[property="og:image"]').length > 0;

  if (ogTitle && ogDescription && ogImage) score += 5;
  else issues.push('Incomplete Open Graph tags (og:title, og:description, og:image)');

  // Check structured data
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  if (hasJsonLd) score += 5;
  else issues.push('Missing JSON-LD structured data');

  return {
    category: 'Metadata & SEO',
    score,
    maxScore,
    issues,
    recommendations: issues.length > 0 ?
      ['Add comprehensive metadata for better AI and search engine understanding'] :
      []
  };
}

function analyzeContent($) {
  const issues = [];
  let score = 0;
  const maxScore = 25;

  // Check heading structure
  const h1Count = $('h1').length;
  if (h1Count === 1) score += 8;
  else if (h1Count === 0) issues.push('Missing H1 heading');
  else issues.push('Multiple H1 headings found (should have only one)');

  const hasH2 = $('h2').length > 0;
  if (hasH2) score += 4;
  else issues.push('No H2 headings found');

  // Check for text content
  const textContent = $('body').text().trim();
  if (textContent.length > 300) score += 5;
  else issues.push('Insufficient text content (less than 300 characters)');

  // Check for lists
  const hasLists = $('ul, ol').length > 0;
  if (hasLists) score += 4;
  else issues.push('No lists found (ul/ol help structure content)');

  // Check paragraphs
  const paragraphCount = $('p').length;
  if (paragraphCount >= 3) score += 4;
  else issues.push('Limited paragraph structure (less than 3 paragraphs)');

  return {
    category: 'Content Structure',
    score,
    maxScore,
    issues,
    recommendations: issues.length > 0 ?
      ['Use proper heading hierarchy and structured content for AI readability'] :
      []
  };
}

function analyzeAccessibility($) {
  const issues = [];
  let score = 0;
  const maxScore = 20;

  // Check images for alt text
  const images = $('img');
  const imagesWithAlt = $('img[alt]').length;
  const altTextRatio = images.length > 0 ? imagesWithAlt / images.length : 1;

  if (altTextRatio === 1) score += 8;
  else if (altTextRatio > 0.7) {
    score += 5;
    issues.push(`${images.length - imagesWithAlt} images missing alt text`);
  } else {
    issues.push(`${images.length - imagesWithAlt} images missing alt text`);
  }

  // Check for ARIA labels
  const ariaLabels = $('[aria-label], [aria-labelledby]').length;
  if (ariaLabels > 0) score += 4;
  else issues.push('No ARIA labels found');

  // Check for language attribute
  const hasLang = $('html[lang]').length > 0;
  if (hasLang) score += 4;
  else issues.push('Missing lang attribute on <html> element');

  // Check links have descriptive text
  const links = $('a');
  const emptyLinks = links.filter((i, el) => $(el).text().trim().length === 0).length;
  if (emptyLinks === 0) score += 4;
  else issues.push(`${emptyLinks} links with no descriptive text`);

  return {
    category: 'Accessibility',
    score,
    maxScore,
    issues,
    recommendations: issues.length > 0 ?
      ['Improve accessibility with alt text, ARIA labels, and proper HTML attributes'] :
      []
  };
}

function analyzePerformance($, html) {
  const issues = [];
  let score = 0;
  const maxScore = 10;

  // Check HTML size
  const htmlSize = Buffer.byteLength(html, 'utf8');
  if (htmlSize < 100000) score += 3;
  else issues.push('Large HTML size (>100KB) may affect AI processing');

  // Check for inline styles (should use external CSS)
  const inlineStyles = $('[style]').length;
  if (inlineStyles < 5) score += 2;
  else issues.push('Many inline styles found (use external CSS)');

  // Check external scripts
  const scripts = $('script[src]').length;
  if (scripts < 10) score += 2;
  else issues.push('Many external scripts may slow down processing');

  // Check for viewport meta tag
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (hasViewport) score += 3;
  else issues.push('Missing viewport meta tag');

  return {
    category: 'Performance & Optimization',
    score,
    maxScore,
    issues,
    recommendations: issues.length > 0 ?
      ['Optimize page size and loading for better AI processing performance'] :
      []
  };
}

// Serve static frontend files (for production)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // Handle React Router - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${isDatabaseAvailable() ? 'SQLite' : 'In-Memory'}`);
  console.log(`Features: Single/Bulk verification, PDF generation, Email sending`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});
