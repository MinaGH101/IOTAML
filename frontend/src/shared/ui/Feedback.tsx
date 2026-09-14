import { LoaderCircle } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ui.module.css';
import { cx } from './utils';

export function Spinner({ className, ...props }: HTMLAttributes<SVGSVGElement>) {
  return <LoaderCircle {...props} className={cx(styles.spinner, className)} aria-hidden="true" />;
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ title, description, action, compact = false, className, children, ...props }: EmptyStateProps) {
  return (
    <div {...props} className={cx(styles.emptyState, compact && styles.emptyStateCompact, className)}>
      {title && <strong>{title}</strong>}
      {description && <p>{description}</p>}
      {children}
      {action && <div className={styles.emptyStateAction}>{action}</div>}
    </div>
  );
}

export type StatusTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function StatusBadge({ tone = 'neutral', className, ...props }: StatusBadgeProps) {
  return <span {...props} className={cx(styles.statusBadge, styles[`status_${tone}`], className)} />;
}

export type ErrorMessageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ErrorMessage({ className, children, ...props }: ErrorMessageProps) {
  return <div {...props} className={cx(styles.errorMessage, className)} role="alert">{children}</div>;
}
