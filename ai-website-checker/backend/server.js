const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Website verification endpoint
app.post('/api/verify', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const results = await analyzeWebsite(url);
    res.json(results);
  } catch (error) {
    console.error('Error analyzing website:', error);
    res.status(500).json({
      error: 'Failed to analyze website',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI Website Checker API is running' });
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
