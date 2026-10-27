import styles from './Loading.module.css';

export default function Loading({ label = 'CARGANDO' }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      {label}
      <span className={styles.cursor} aria-hidden="true" />
    </div>
  );
}
