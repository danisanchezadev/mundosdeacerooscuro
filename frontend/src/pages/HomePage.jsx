import { Link } from 'react-router-dom';
import { useList } from '../hooks/useResources';
import { BookGrid } from '../components/BookCard';
import QueryState from '../components/QueryState';
import ReviewSummary from '../features/reviews/ReviewSummary';
import { results } from '../utils/format';
import styles from './HomePage.module.css';

function Section({ title, to, query, emptyLabel, children }) {
  const items = results(query.data);
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {to && <Link to={to}>VER TODO &gt;&gt;</Link>}
      </div>
      <QueryState query={query} isEmpty={items.length === 0} emptyLabel={emptyLabel}>
        {children(items)}
      </QueryState>
    </section>
  );
}

export default function HomePage() {
  const latest = useList('books', { ordering: '-created_at', page_size: 6 });
  const topRated = useList('books', { has_reviews: true, ordering: '-average_rating', page_size: 6 });
  const reviews = useList('reviews', { ordering: '-created_at', page_size: 6 });
  const available = useList('books', { available_for_loan: true, ordering: '-created_at', page_size: 6 });

  return (
    <>
      <div className={styles.hero}>
        <h1 className={styles.prompt}>BIENVENIDO, VIAJERO</h1>
        <p>
          Comunidad de lectores de ciencia ficción. Explora el catálogo, puntúa y reseña, y comparte tus ejemplares
          con otros miembros de la tripulación.
        </p>
      </div>

      <div className={styles.columns}>
        <Section title="ÚLTIMOS LIBROS AÑADIDOS" to="/books?ordering=-created_at" query={latest} emptyLabel="CATÁLOGO VACÍO">
          {(items) => <BookGrid books={items} />}
        </Section>

        <Section title="MEJOR VALORADOS" to="/books?ordering=-average_rating&has_reviews=true" query={topRated} emptyLabel="AÚN NO HAY VALORACIONES">
          {(items) => <BookGrid books={items} />}
        </Section>

        <Section title="ÚLTIMAS RESEÑAS" query={reviews} emptyLabel="AÚN NO HAY RESEÑAS">
          {(items) => (
            <div className={styles.reviews}>
              {items.map((review) => (
                <ReviewSummary key={review.id} review={review} />
              ))}
            </div>
          )}
        </Section>

        <Section title="DISPONIBLES PARA PRÉSTAMO" to="/books?available_for_loan=true" query={available} emptyLabel="NINGÚN EJEMPLAR OFRECIDO TODAVÍA">
          {(items) => <BookGrid books={items} />}
        </Section>
      </div>
    </>
  );
}
