import styles from './StarRating.module.css';
import { formatRating } from '../utils/format';

export function StarRating({ value, count, showValue = true }) {
  const number = Number(value);
  const rounded = Number.isFinite(number) ? Math.round(number) : 0;
  return (
    <span className={styles.stars} role="img" aria-label={`Valoración ${formatRating(value)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`${styles.star} ${n <= rounded ? styles.on : ''}`} aria-hidden="true">
          ★
        </span>
      ))}
      {showValue && <span className={styles.value}>{formatRating(value)}</span>}
      {count !== undefined && <span className={styles.count}>({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange, name = 'rating' }) {
  return (
    <fieldset className={styles.input} aria-label="Puntuación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          name={name}
          className={n <= value ? styles.on : ''}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </fieldset>
  );
}

export default StarRating;
