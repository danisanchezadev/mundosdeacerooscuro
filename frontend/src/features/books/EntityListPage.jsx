import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useList } from '../../hooks/useResources';
import PageHeader from '../../components/PageHeader';
import QueryState from '../../components/QueryState';
import Pagination from '../../components/Pagination';
import Field from '../../components/Field';
import PixelButton from '../../components/PixelButton';
import { results } from '../../utils/format';
import styles from './Catalog.module.css';

const PAGE_SIZE = 12;

/** Searchable, paginated grid shared by authors / sagas / awards. */
export default function EntityListPage({ resource, title, subtitle, basePath, describe, meta }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useList(resource, { search, page, page_size: PAGE_SIZE });
  const items = results(query.data);

  const submit = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(text.trim());
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <form className={styles.search} onSubmit={submit} role="search">
        <Field label="Buscar" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} />
        <PixelButton type="submit">BUSCAR</PixelButton>
      </form>

      <QueryState query={query} isEmpty={items.length === 0} emptyLabel="SIN RESULTADOS">
        <div className={styles.grid}>
          {items.map((item) => {
            const content = (
              <>
                <h3 className={styles.name}>{item.name}</h3>
                {describe(item) && <p className={styles.desc}>{describe(item)}</p>}
                <span className={styles.count}>{item.book_count} LIBRO(S)</span>
                {meta?.(item)}
              </>
            );
            return basePath ? (
              <Link key={item.id} to={`${basePath}/${item.id}`} className={styles.item}>
                {content}
              </Link>
            ) : (
              <article key={item.id} className={styles.item}>
                {content}
              </article>
            );
          })}
        </div>
        <Pagination page={page} count={query.data?.count} pageSize={PAGE_SIZE} onChange={setPage} />
      </QueryState>
    </>
  );
}
