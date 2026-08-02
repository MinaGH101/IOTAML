import { Component, type ReactNode } from 'react';
import type { Output } from '../../../workspace/_model/output';
import { WorkflowErrorCard } from './WorkflowErrorCard';

export class OutputErrorBoundary extends Component<{ children: ReactNode; output: Output }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidUpdate(previous: { output: Output }) {
    if (previous.output !== this.props.output && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <WorkflowErrorCard problem={{
      code: 'OUTPUT_RENDER_FAILED',
      message: 'نمایش این خروجی در رابط کاربری با خطا متوقف شد.',
      responsibility: 'application',
      node_id: this.props.output.node_id,
      port: this.props.output.source_handle,
      actual: this.state.error.message,
      suggested_fix: 'خروجی نود را دوباره اجرا کنید. اگر خطا تکرار شد، جزئیات این کارت را بررسی کنید.',
    }} />;
  }
}
