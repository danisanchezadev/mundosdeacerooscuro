import { Link, useParams } from 'react-router-dom';
import { useDetail } from '../hooks/useResources';
import Cover from '../components/Cover';
import StarRating from '../components/StarRating';
import Badge from '../components/Badge';
import QueryState from '../components/QueryState';
import { AvailabilityBadge } from '../components/BookCard';
import BookLoanPanel from '../features/loans/BookLoanPanel';
import ReviewSection from '../features/reviews/ReviewSection';
import { languageLabel } from '../utils/format';
import styles from './BookDetailPage.module.css';

function ExternalLink({ href, children }) {
  return (
    <a className="amber" href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children} ↗
    </a>
  );
}

function BookInfo({ book }) {
  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        <Cover url={book.external_cover_url} title={book.title} />
        <div className={styles.buy}>
          <ExternalLink href={book.amazon_url}>AMAZON</ExternalLink>
          <ExternalLink href={book.casa_del_libro_url}>CASA DEL LIBRO</ExternalLink>
        </div>
      </div>

      <div>
        <h1>{book.title}</h1>
        <div className="row">
          <StarRating value={book.average_rating} count={book.review_count} />
          <AvailabilityBadge availability={book.loan_availability} />
        </div>

        <dl className={styles.facts}>
          <dt>AUTOR</dt>
          <dd>
            <Link to={`/authors/${book.author.id}`}>{book.author.name}</Link>
          </dd>
          <dt>SAGA</dt>
          <dd>{book.saga ? <Link to={`/sagas/${book.saga.id}`}>{book.saga.name}</Link> : '—'}</dd>
          <dt>AÑO</dt>
          <dd>{book.publication_year ?? '—'}</dd>
          <dt>IDIOMA</dt>
          <dd>{languageLabel(book.language)}</dd>
          <dt>ISBN</dt>
          <dd>{book.isbn || '—'}</dd>
          <dt>PREMIOS</dt>
          <dd>
            {book.awards.length ? (
              <span className={styles.tags}>
                {book.awards.map((award) => (
                  <Link key={award.id} to={`/books?award=${award.id}`}>
                    <Badge tone="amber">{award.name}</Badge>
                  </Link>
                ))}
              </span>
            ) : (
              '—'
            )}
          </dd>
          <dt>EJEMPLARES</dt>
          <dd>
            {book.available_copies} disponibles de {book.offered_copies} ofrecidos
          </dd>
        </dl>

        <h2>SINOPSIS</h2>
        <p className={styles.synopsis}>{book.synopsis || 'Sin sinopsis disponible.'}</p>
      </div>
    </div>
  );
}

export default function BookDetailPage() {
  const { id } = useParams();
  const query = useDetail('books', id);

  return (
    <QueryState query={query}>
      {query.data && (
        <>
          <BookInfo book={query.data} />
          <div className={styles.bottom}>
            <ReviewSection book={query.data} />
            <BookLoanPanel book={query.data} />
          </div>
        </>
      )}
    </QueryState>
  );
}
