import React from 'react';
export class ToolErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <section role="alert" className="m-4 rounded-xl border border-red-300 p-6">
      <h2>Unable to open this tool</h2>
      <p>{this.state.error}</p>
      <button type="button" onClick={() => window.location.reload()}>Reload and retry</button>
      <p>You can also select another tool from the directory.</p>
    </section>;
  }
}
