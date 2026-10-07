import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './ui.module.css';
import { cx } from './utils';

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={htmlFor}>
          {label}
          {required && <span className={styles.requiredMark} aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? <div className={styles.fieldError} role="alert">{error}</div> : hint ? <div className={styles.fieldHint}>{hint}</div> : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  bare?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, bare, ...props },
  ref,
) {
  return <input {...props} ref={ref} data-ui-bare={bare ? 'true' : undefined} aria-invalid={invalid || undefined} className={cx(styles.control, bare && styles.bareControl, invalid && styles.controlInvalid, className)} />;
});

export type SearchFieldProps = Omit<InputProps, 'type'> & {
  containerClassName?: string;
  leading?: ReactNode;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, containerClassName, leading, ...props },
  ref,
) {
  return <div className={cx(styles.searchField, containerClassName)} data-ui-search-field="true">
    {leading && <span className={styles.searchLeading} aria-hidden="true">{leading}</span>}
    <Input {...props} ref={ref} bare type="search" className={cx(styles.searchInput, className)} />
  </div>;
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return <textarea {...props} ref={ref} aria-invalid={invalid || undefined} className={cx(styles.control, styles.textarea, invalid && styles.controlInvalid, className)} />;
});

export type NativeSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  options: NativeSelectOption[];
  placeholder?: string;
  invalid?: boolean;
};

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { options, placeholder, className, invalid, id, ...props },
  ref,
) {
  const generatedId = useId();
  return (
    <select
      {...props}
      ref={ref}
      id={id ?? generatedId}
      aria-invalid={invalid || undefined}
      className={cx(styles.control, styles.select, invalid && styles.controlInvalid, className)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label({ className, ...props }, ref) {
  return <label {...props} ref={ref} className={cx(styles.fieldLabel, className)} />;
});
