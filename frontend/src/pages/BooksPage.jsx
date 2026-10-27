import { useSearchParams } from 'react-router-dom';
import { useList } from '../hooks/useResources';
import PageHeader from '../components/PageHeader';
import QueryState from '../components/QueryState';
import Pagination from '../components/Pagination';
import { BookGrid } from '../components/BookCard';
import BookFilters, { EMPTY_FILTERS } from '../features/books/BookFilters';
import styles from '../features/books/BookFilters.module.css';
import { results } from '../utils/format';

const PAGE_SIZE = 12;

export default function BooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = Object.fromEntries(Object.keys(EMPTY_FILTERS).map((key) => [key, searchParams.get(key) ?? '']));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const query = useList('books', { ...filters, page, page_size: PAGE_SIZE });
  const books = results(query.data);

  const applyFilters = (next) => {
    const params = {};
    Object.entries(next).forEach(([key, value]) => {
      if (value) params[key] = value;
    });
    setSearchParams(params);
  };

  const goToPage = (nextPage) => {
    const params = Object.fromEntries(searchParams);
    params.page = String(nextPage);
    setSearchParams(params);
    window.scrollTo({ top: 0 });
  };

  // Remount the form when the URL filters change externally (home links, reset).
  const formKey = JSON.stringify(filters);

  return (
    <>
      <PageHeader title="CATÁLOGO" subtitle="Explora la biblioteca de ciencia ficción." />
      <BookFilters key={formKey} values={filters} onSubmit={applyFilters} />

      <p className={styles.summary}>{query.data ? `${query.data.count} LIBRO(S) ENCONTRADO(S)` : ' '}</p>

      <QueryState query={query} isEmpty={books.length === 0} emptyLabel="NINGÚN LIBRO COINCIDE CON LA BÚSQUEDA">
        <BookGrid books={books} />
        <Pagination page={page} count={query.data?.count} pageSize={PAGE_SIZE} onChange={goToPage} />
      </QueryState>
    </>
  );
}
