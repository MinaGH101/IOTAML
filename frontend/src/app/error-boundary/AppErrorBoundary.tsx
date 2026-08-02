import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

type Props = { children: ReactNode; scope?: string };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[IOTA UI boundary]', this.props.scope || 'application', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app-shell fatal-error" dir="rtl" role="alert">
        <h1>نمایش این بخش متوقف شد</h1>
        <p>یک خطای رابط کاربری رخ داد. داده‌های پروژه حذف نشده‌اند.</p>
        <button type="button" onClick={() => window.location.reload()}><RefreshCw size={16} /> بارگذاری دوباره</button>
      </main>
    );
  }
}
