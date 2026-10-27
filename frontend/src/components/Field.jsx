import { useId } from 'react';
import styles from './Field.module.css';

/** Labelled form control. `as` can be "input" (default), "textarea" or "select". */
export default function Field({ label, error, as: Tag = 'input', className = '', children, ...props }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <Tag
        id={id}
        className={`${styles.control} ${error ? styles.invalid : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {children}
      </Tag>
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
