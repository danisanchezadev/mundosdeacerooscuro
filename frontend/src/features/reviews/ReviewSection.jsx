import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useList, useResourceMutations } from '../../hooks/useResources';
import StarRating, { StarInput } from '../../components/StarRating';
import Field from '../../components/Field';
import PixelButton from '../../components/PixelButton';
import Panel from '../../components/Panel';
import QueryState from '../../components/QueryState';
import Pagination from '../../components/Pagination';
import { ErrorMessage } from '../../components/Messages';
import { parseApiError } from '../../services/api';
import { formatDate, results } from '../../utils/format';
import styles from './Reviews.module.css';

const PAGE_SIZE = 10;

function ReviewForm({ bookId }) {
  const { create } = useResourceMutations('reviews');
  const [form, setForm] = useState({ title: '', content: '', rating: 0 });
  const [error, setError] = useState({ message: '', fields: {} });

  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.rating) {
      setError({ message: 'Selecciona una puntuación de 1 a 5.', fields: {} });
      return;
    }
    setError({ message: '', fields: {} });
    create.mutate(
      { book: bookId, ...form },
      {
        onSuccess: () => setForm({ title: '', content: '', rating: 0 }),
        onError: (err) => setError(parseApiError(err)),
      },
    );
  };

  return (
    <Panel title="PUNTUAR Y ESCRIBIR RESEÑA" tone="blue">
      <form onSubmit={handleSubmit} noValidate>
        <ErrorMessage message={error.message} />
        <div className={styles.meta}>Tu puntuación</div>
        <StarInput value={form.rating} onChange={(rating) => setForm((prev) => ({ ...prev, rating }))} />
        {error.fields.rating && <div role="alert">{error.fields.rating}</div>}
        <Field label="Título" name="title" value={form.title} onChange={update} maxLength={200} required error={error.fields.title} />
        <Field as="textarea" label="Reseña" name="content" value={form.content} onChange={update} maxLength={10000} required error={error.fields.content} />
        <PixelButton type="submit" disabled={create.isPending}>
          {create.isPending ? 'ENVIANDO...' : 'PUBLICAR'}
        </PixelButton>
      </form>
    </Panel>
  );
}

function CommentSection({ reviewId }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const comments = useList('review-comments', { review: reviewId, ordering: 'created_at', page_size: 50 });
  const { create, remove } = useResourceMutations('review-comments');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    create.mutate(
      { review: reviewId, content },
      {
        onSuccess: () => setContent(''),
        onError: (err) => setError(parseApiError(err).message),
      },
    );
  };

  const items = results(comments.data);

  return (
    <div className={styles.comments}>
      <QueryState query={comments} isEmpty={items.length === 0} emptyLabel="SIN COMENTARIOS">
        {items.map((comment) => (
          <div key={comment.id} className={styles.comment}>
            <div className={styles.meta}>
              {comment.user?.name} · {formatDate(comment.created_at)}
            </div>
            <p className={styles.content}>{comment.content}</p>
            {(isAdmin || comment.user?.id === user?.id) && (
              <PixelButton size="small" variant="red" onClick={() => remove.mutate(comment.id)} disabled={remove.isPending}>
                BORRAR
              </PixelButton>
            )}
          </div>
        ))}
      </QueryState>

      {isAuthenticated && (
        <form onSubmit={handleSubmit} noValidate>
          <ErrorMessage message={error} />
          <Field
            as="textarea"
            label="Añadir comentario"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            style={{ minHeight: 70 }}
            required
          />
          <PixelButton type="submit" size="small" disabled={create.isPending || !content.trim()}>
            COMENTAR
          </PixelButton>
        </form>
      )}
    </div>
  );
}

function ReviewItem({ review }) {
  const { user, isAdmin } = useAuth();
  const { remove } = useResourceMutations('reviews');
  const [open, setOpen] = useState(false);
  const canDelete = isAdmin || review.user?.id === user?.id;

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div>
          <h4 className={styles.title}>{review.title}</h4>
          <div className={styles.meta}>
            {review.user?.name} · {formatDate(review.created_at)}
          </div>
        </div>
        <StarRating value={review.rating} showValue={false} />
      </div>
      <p className={styles.content}>{review.content}</p>
      <div className={styles.actions}>
        <PixelButton size="small" variant="blue" aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
          {open ? 'OCULTAR' : 'COMENTARIOS'} ({review.comment_count})
        </PixelButton>
        {canDelete && (
          <PixelButton
            size="small"
            variant="red"
            disabled={remove.isPending}
            onClick={() => window.confirm('¿Borrar esta reseña?') && remove.mutate(review.id)}
          >
            BORRAR
          </PixelButton>
        )}
      </div>
      {open && <CommentSection reviewId={review.id} />}
    </article>
  );
}

export default function ReviewSection({ book }) {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const query = useList('reviews', { book: book.id, ordering: '-created_at', page, page_size: PAGE_SIZE });
  const items = results(query.data);

  return (
    <section aria-label="Reseñas" className="stack">
      <h2>RESEÑAS ({book.review_count})</h2>

      {isAuthenticated ? (
        <ReviewForm bookId={book.id} />
      ) : (
        <p className="muted">
          <Link to="/login">Inicia sesión</Link> para puntuar, reseñar y comentar.
        </p>
      )}

      <QueryState query={query} isEmpty={items.length === 0} emptyLabel="NADIE HA RESEÑADO ESTE LIBRO TODAVÍA">
        <div className={styles.list}>
          {items.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </div>
        <Pagination page={page} count={query.data?.count} pageSize={PAGE_SIZE} onChange={setPage} />
      </QueryState>
    </section>
  );
}
