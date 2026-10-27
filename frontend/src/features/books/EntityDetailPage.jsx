import { Link, useParams } from 'react-router-dom';
import { useDetail, useList } from '../../hooks/useResources';
import PageHeader from '../../components/PageHeader';
import QueryState from '../../components/QueryState';
import Pagination from '../../components/Pagination';
import { BookGrid } from '../../components/BookCard';
import { useState } from 'react';
import { results } from '../../utils/format';
import styles from './Catalog.module.css';

const PAGE_SIZE = 12;

/** Detail page for an author or a saga: header + paginated books filtered by `filterKey`. */
export default function EntityDetailPage({ resource, filterKey, backTo, backLabel, renderBody }) {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const entity = useDetail(resource, id);
  const books = useList('books', { [filterKey]: id, page, page_size: PAGE_SIZE, ordering: 'publication_year' });
  const items = results(books.data);

  return (
    <QueryState query={entity}>
      {entity.data && (
        <>
          <PageHeader title={entity.data.name}>
            <Link to={backTo}>&lt;&lt; {backLabel}</Link>
          </PageHeader>
          <div className={styles.detail}>{renderBody(entity.data)}</div>

          <h2>LIBROS</h2>
          <QueryState query={books} isEmpty={items.length === 0} emptyLabel="SIN LIBROS EN EL CATÁLOGO">
            <BookGrid books={items} />
            <Pagination page={page} count={books.data?.count} pageSize={PAGE_SIZE} onChange={setPage} />
          </QueryState>
        </>
      )}
    </QueryState>
  );
}
