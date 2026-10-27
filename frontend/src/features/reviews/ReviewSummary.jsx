import { Link } from 'react-router-dom';
import StarRating from '../../components/StarRating';
import { formatDate } from '../../utils/format';
import styles from './Reviews.module.css';

/** Compact review used on the home page and profile. */
export default function ReviewSummary({ review }) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>{review.title}</h4>
          <div className={styles.meta}>
            <Link to={`/books/${review.book}`}>{review.book_title}</Link> · {review.user?.name} · {formatDate(review.created_at)}
          </div>
        </div>
        <StarRating value={review.rating} showValue={false} />
      </div>
      <p className={`${styles.content} ${styles.excerpt}`}>{review.content}</p>
    </article>
  );
}
