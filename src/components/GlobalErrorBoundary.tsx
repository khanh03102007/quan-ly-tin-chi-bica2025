import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra sự cố không mong muốn trong quá trình hiển thị giao diện.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ghi nhận lỗi runtime phục vụ giám sát (Global Error Tracking)
    if (typeof window !== 'undefined') {
      try {
        const errorLog = {
          message: error?.message || 'Unknown UI Error',
          componentStack: errorInfo?.componentStack?.slice(0, 500) || '',
          timestamp: new Date().toISOString(),
          url: window.location.href,
        };
        sessionStorage.setItem('bica_last_runtime_error', JSON.stringify(errorLog));
      } catch {
        // Bỏ qua nếu sessionStorage bị chặn
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      sessionStorage.clear();
    } catch {
      // Ignore storage error
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-slate-900/90 border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <ShieldAlert className="w-3.5 h-3.5" />
                HTTP 500 • Bảo vệ Phiên Làm Việc
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Hệ thống gặp sự cố tạm thời
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ứng dụng vừa ghi nhận một ngoại lệ khi xử lý giao diện. Dữ liệu học tập và tín chỉ của bạn vẫn được bảo toàn an toàn.
              </p>
            </div>

            {this.state.errorMessage && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  Chi tiết chẩn đoán
                </p>
                <p className="text-xs text-rose-300 font-mono break-words line-clamp-3">
                  {this.state.errorMessage}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors cursor-pointer"
              >
                Làm mới phiên
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
