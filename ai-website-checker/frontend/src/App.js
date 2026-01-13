import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post('/api/verify', { url });
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to analyze website');
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
        <h1>🤖 AI Website Checker</h1>
        <p>Verify how AI-friendly your website is</p>
      </header>

      <main className="App-main">
        <form onSubmit={handleSubmit} className="url-form">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            required
            className="url-input"
          />
          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Analyzing...' : 'Check Website'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {results && (
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
      </main>

      <footer className="App-footer">
        <p>Built with React & Express | AI Website Checker v1.0</p>
      </footer>
    </div>
  );
}

export default App;
