import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 700, margin: '0 auto', color: '#f2f3f5' }}>
          <h2 style={{ color: '#ff5a5a' }}>Something went wrong</h2>
          <p style={{ color: '#9aa1ac' }}>
            The app hit an error and couldn't render this page. The details below will help fix it.
          </p>
          <pre
            style={{
              background: '#1e2128',
              border: '1px solid #2c313a',
              borderRadius: 8,
              padding: 16,
              overflowX: 'auto',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              background: '#f0b93e',
              color: '#14161a',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}