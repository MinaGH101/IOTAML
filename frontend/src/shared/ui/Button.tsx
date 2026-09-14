import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './ui.module.css';
import { cx } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    fullWidth = false,
    iconOnly = false,
    leadingIcon,
    trailingIcon,
    className,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        fullWidth && styles.buttonFullWidth,
        iconOnly && styles.buttonIconOnly,
        className,
      )}
    >
      {loading ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : leadingIcon}
      {!iconOnly && children}
      {!loading && trailingIcon}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonProps, 'iconOnly' | 'leadingIcon' | 'trailingIcon'> & {
  icon: ReactNode;
  'aria-label': string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', size = 'sm', ...props },
  ref,
) {
  return <Button {...props} ref={ref} variant={variant} size={size} iconOnly leadingIcon={icon} />;
});
