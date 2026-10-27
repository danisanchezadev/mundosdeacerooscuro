import PixelButton from './PixelButton';
import styles from './Pagination.module.css';

export default function Pagination({ page, count, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.nav} aria-label="Paginación">
      <PixelButton size="small" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        &lt; ANT
      </PixelButton>
      <span className={styles.info}>
        PÁGINA {page} / {totalPages}
      </span>
      <PixelButton size="small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        SIG &gt;
      </PixelButton>
    </nav>
  );
}
