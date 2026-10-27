import { useState } from 'react';
import styles from './Cover.module.css';

export default function Cover({ url, title }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className={`${styles.cover} ${styles.placeholder}`} role="img" aria-label={`Sin portada: ${title}`}>
        SIN PORTADA
      </div>
    );
  }
  return (
    <img
      className={styles.cover}
      src={url}
      alt={`Portada de ${title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
