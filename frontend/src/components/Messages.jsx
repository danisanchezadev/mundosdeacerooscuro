import styles from './Messages.module.css';
import { parseApiError } from '../services/api';

export function ErrorMessage({ error, message }) {
  const text = message ?? (error ? parseApiError(error).message : null);
  if (!text) return null;
  return (
    <div className={styles.box} role="alert">
      {text}
    </div>
  );
}

export function SuccessMessage({ children }) {
  if (!children) return null;
  return (
    <div className={styles.success} role="status">
      {children}
    </div>
  );
}

export function EmptyState({ children = 'SIN RESULTADOS' }) {
  return <p className={styles.empty}>{children}</p>;
}
