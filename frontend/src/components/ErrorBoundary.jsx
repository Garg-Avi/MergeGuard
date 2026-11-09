import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090A0C] text-[#F5F5F5] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full mg-card p-8 border-rose-900/50 text-center space-y-4 shadow-xl bg-[#17191F]">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 mx-auto shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-[#F5F5F5]">Application Exception</h2>
            <p className="text-xs text-[#B0B3BA] leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mg-btn-primary mx-auto text-xs py-2.5 px-5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload MergeGuard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
