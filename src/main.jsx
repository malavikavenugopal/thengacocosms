import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', border: '1px solid #fecaca', margin: '20px', fontFamily: 'sans-serif'}}>
          <h1 style={{fontSize: '1.5rem', fontWeight: 'bold'}}>Application Error</h1>
          <p style={{marginTop: '10px'}}>Something went wrong in the UI render:</p>
          <pre style={{marginTop: '10px', padding: '15px', background: 'white', border: '1px solid #fecaca', borderRadius: '8px', overflow: 'auto', fontSize: '0.85rem'}}>
            {this.state.error.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{marginTop: '20px', padding: '10px 20px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'}}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
