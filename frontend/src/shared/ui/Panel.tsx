import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ui.module.css';
import { cx } from './utils';

export type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function Panel({ title, subtitle, actions, compact = false, className, children, ...props }: PanelProps) {
  return (
    <section {...props} className={cx(styles.panel, compact && styles.panelCompact, className)}>
      {(title || subtitle || actions) && (
        <header className={styles.panelHeader}>
          <div className={styles.panelHeading}>
            {title && <div className={styles.panelTitle}>{title}</div>}
            {subtitle && <div className={styles.panelSubtitle}>{subtitle}</div>}
          </div>
          {actions && <div className={styles.panelActions}>{actions}</div>}
        </header>
      )}
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}
