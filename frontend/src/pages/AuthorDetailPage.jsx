import EntityDetailPage from '../features/books/EntityDetailPage';
import styles from '../features/books/Catalog.module.css';
import { formatDate } from '../utils/format';

export default function AuthorDetailPage() {
  return (
    <EntityDetailPage
      resource="authors"
      filterKey="author"
      backTo="/authors"
      backLabel="AUTORES"
      renderBody={(author) => (
        <>
          <p className="muted">
            {author.country || 'País desconocido'} · Nacimiento: {formatDate(author.birth_date)}
          </p>
          <p className={styles.bio}>{author.biography || 'Sin biografía disponible.'}</p>
        </>
      )}
    />
  );
}
