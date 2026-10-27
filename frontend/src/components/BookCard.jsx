import { Link } from 'react-router-dom';
import Cover from './Cover';
import StarRating from './StarRating';
import Badge from './Badge';
import styles from './BookCard.module.css';

export function AvailabilityBadge({ availability }) {
  if (availability === 'available') return <Badge tone="green">DISPONIBLE</Badge>;
  if (availability === 'lent') return <Badge tone="amber">PRESTADO</Badge>;
  return <Badge tone="dim">SIN EJEMPLARES</Badge>;
}

export default function BookCard({ book }) {
  return (
    <Link to={`/books/${book.id}`} className={styles.card}>
      <Cover url={book.external_cover_url} title={book.title} />
      <h3 className={styles.title}>{book.title}</h3>
      <span className={styles.author}>{book.author?.name}</span>
      <StarRating value={book.average_rating} count={book.review_count} />
      <div className={styles.meta}>
        <span className="muted">{book.publication_year ?? ''}</span>
        <AvailabilityBadge availability={book.loan_availability} />
      </div>
    </Link>
  );
}

export function BookGrid({ books }) {
  return (
    <div className={styles.grid}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
