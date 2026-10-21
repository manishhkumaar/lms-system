import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps one broken screen from blanking the app. Reset by changing `resetKey` (the route). */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-auth" role="alert" data-error-boundary>
        <div className="app-auth-card">
          <h1 className="t-h2">This screen couldn't load</h1>
          <p className="muted">Something went wrong while showing this page. Your data is safe. Go back, or reload to try again.</p>
          <pre className="caption bl-mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {this.state.error.message}
          </pre>
          <div className="row">
            <button type="button" className="bl-btn bl-btn-secondary" onClick={() => history.back()}>
              Go back
            </button>
            <button type="button" className="bl-btn bl-btn-primary" onClick={() => location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
