import React from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('SIRTS render failure', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-xl border border-red-500/20 bg-zinc-950/90 p-6 shadow-2xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-red-400 font-semibold">Workspace unavailable</p>
          <h2 className="text-xl font-semibold text-white mt-2">This view failed to render.</h2>
          <p className="text-sm text-zinc-500 mt-3">
            SIRTS kept the rest of the session alive. Return home or reload this view after the data service recovers.
          </p>
          <div className="flex gap-3 mt-6">
            <Link to="/dashboard" className="btn-primary">Go home</Link>
            <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
