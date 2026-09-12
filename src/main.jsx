import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global DOM monkey-patch for browser translation & extensions (Google Translate removeChild bug in React)
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      }
      return this.appendChild(newNode);
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    const errorStr = error ? error.toString() : '';
    // If it's a DOM manipulation error from extensions/translation, ignore & attempt render
    if (errorStr.includes('removeChild') || errorStr.includes('insertBefore')) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const errorStr = error ? error.toString() : '';
    if (errorStr.includes('removeChild') || errorStr.includes('insertBefore')) {
      console.warn('Recovered from DOM extension error:', error);
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
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
