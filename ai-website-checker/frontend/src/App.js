import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [error, setError] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setEmailSent(false);

    try {
      // Send report via email (always required)
      const response = await axios.post('/api/send-report', { url, email });
      setEmailSent(true);
      setResults(response.data.results);
      setError(`PDF 리포트가 ${email}로 전송되었습니다!`);
    } catch (err) {
      setError(err.response?.data?.message || '웹사이트 분석에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBulkResults(null);
    setEmailSent(false);

    try {
      // Parse URLs (one per line)
      const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);

      if (urlList.length === 0) {
        setError('URL을 최소 1개 이상 입력해주세요');
        setLoading(false);
        return;
      }

      if (urlList.length > 10) {
        setError('최대 10개의 URL만 분석 가능합니다');
        setLoading(false);
        return;
      }

      const response = await axios.post('/api/verify-bulk', { urls: urlList, email });
      setBulkResults(response.data);
      setEmailSent(true);
      setError(`PDF 리포트가 ${email}로 전송되었습니다!`);
    } catch (err) {
      setError(err.response?.data?.message || '웹사이트 분석에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Website Checker</h1>
        <p>웹사이트의 AI 친화성을 분석합니다</p>
        <p className="no-signup-notice">회원가입 없이 바로 사용 가능</p>
      </header>

      <main className="App-main">
        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            className={mode === 'single' ? 'active' : ''}
            onClick={() => {
              setMode('single');
              setBulkResults(null);
              setResults(null);
              setError(null);
              setEmailSent(false);
            }}
          >
            단일 URL
          </button>
          <button
            className={mode === 'bulk' ? 'active' : ''}
            onClick={() => {
              setMode('bulk');
              setBulkResults(null);
              setResults(null);
              setError(null);
              setEmailSent(false);
            }}
          >
            대량 URL
          </button>
        </div>

        {/* Single URL Mode */}
        {mode === 'single' && (
          <form onSubmit={handleSingleSubmit} className="url-form">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="분석할 웹사이트 URL (예: https://example.com)"
              required
              className="url-input"
            />

            <div className="email-section">
              <label className="email-label">결과를 받을 이메일 주소</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="email-input"
              />
              <p className="email-hint">분석 결과가 PDF로 이메일 전송됩니다</p>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? '분석 중...' : '웹사이트 분석하기'}
            </button>
          </form>
        )}

        {/* Bulk URL Mode */}
        {mode === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="url-form bulk-form">
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="웹사이트 URL을 한 줄에 하나씩 입력 (최대 10개)&#10;https://example1.com&#10;https://example2.com&#10;https://example3.com"
              required
              className="url-textarea"
              rows="6"
            />

            <div className="email-section">
              <label className="email-label">결과를 받을 이메일 주소</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="email-input"
              />
              <p className="email-hint">분석 결과가 PDF로 이메일 전송됩니다</p>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? '분석 중...' : '모든 웹사이트 분석하기'}
            </button>
          </form>
        )}

        {error && (
          <div className={emailSent ? 'success-message' : 'error-message'}>
            <strong>{emailSent ? 'Success:' : 'Error:'}</strong> {error}
          </div>
        )}

        {/* Single URL Results */}
        {results && mode === 'single' && (
          <div className="results">
            <div className="score-card">
              <h2>Overall Score</h2>
              <div
                className="score-circle"
                style={{ borderColor: getScoreColor(results.score) }}
              >
                <span className="score-number">{results.score}</span>
                <span className="score-max">/ {results.maxScore}</span>
              </div>
              <p
                className="score-label"
                style={{ color: getScoreColor(results.score) }}
              >
                {getScoreLabel(results.score)}
              </p>
              <p className="analyzed-url">
                <strong>URL:</strong> {results.url}
              </p>
              <p className="timestamp">
                Analyzed: {new Date(results.timestamp).toLocaleString()}
              </p>
              {results.reportId && (
                <p className="report-id">Report ID: #{results.reportId}</p>
              )}
            </div>

            <div className="checks-grid">
              {Object.values(results.checks).map((check, index) => (
                <div key={index} className="check-card">
                  <h3>{check.category}</h3>
                  <div className="check-score">
                    <span className="score">
                      {check.score} / {check.maxScore}
                    </span>
                    <div className="score-bar">
                      <div
                        className="score-fill"
                        style={{
                          width: `${(check.score / check.maxScore) * 100}%`,
                          backgroundColor: getScoreColor(
                            (check.score / check.maxScore) * 100
                          ),
                        }}
                      ></div>
                    </div>
                  </div>

                  {check.issues.length > 0 && (
                    <div className="issues">
                      <h4>Issues Found:</h4>
                      <ul>
                        {check.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {check.recommendations.length > 0 && (
                    <div className="recommendations">
                      <h4>Recommendations:</h4>
                      <ul>
                        {check.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bulk URL Results */}
        {bulkResults && mode === 'bulk' && (
          <div className="bulk-results">
            <div className="bulk-summary">
              <h2>Bulk Analysis Results</h2>
              <div className="bulk-stats">
                <div className="stat">
                  <span className="stat-number">{bulkResults.total}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat success">
                  <span className="stat-number">{bulkResults.successful}</span>
                  <span className="stat-label">Successful</span>
                </div>
                <div className="stat failed">
                  <span className="stat-number">{bulkResults.failed}</span>
                  <span className="stat-label">Failed</span>
                </div>
              </div>
            </div>

            <div className="bulk-results-grid">
              {bulkResults.results.map((result, index) => (
                <div key={index} className={`bulk-result-card ${result.success ? 'success' : 'failed'}`}>
                  {result.success ? (
                    <>
                      <div className="bulk-result-header">
                        <h3>{result.url}</h3>
                        <div
                          className="bulk-score"
                          style={{ backgroundColor: getScoreColor(result.score) }}
                        >
                          {result.score}
                        </div>
                      </div>
                      <p className="bulk-score-label">
                        {getScoreLabel(result.score)}
                      </p>
                      <p className="bulk-report-id">Report ID: #{result.reportId}</p>

                      <div className="bulk-checks">
                        {Object.values(result.checks).map((check, i) => (
                          <div key={i} className="bulk-check-item">
                            <span className="bulk-check-name">{check.category}</span>
                            <span className="bulk-check-score">
                              {check.score}/{check.maxScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bulk-result-header">
                        <h3>{result.url}</h3>
                        <span className="failed-badge">Failed</span>
                      </div>
                      <p className="error-text">{result.error}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>AI Website Checker v2.0</p>
        <p>회원가입 없이 이메일만으로 PDF 리포트 수신</p>
      </footer>
    </div>
  );
}

export default App;
