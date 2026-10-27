import { useState } from 'react';
import Field, { Checkbox } from '../../components/Field';
import PixelButton from '../../components/PixelButton';
import Panel from '../../components/Panel';
import { useList } from '../../hooks/useResources';
import { LANGUAGES, results } from '../../utils/format';
import styles from './BookFilters.module.css';

export const FILTER_KEYS = ['q', 'title', 'author_name', 'language', 'saga', 'award', 'year', 'available_for_loan'];

export const EMPTY_FILTERS = {
  q: '',
  title: '',
  author_name: '',
  language: '',
  saga: '',
  award: '',
  year: '',
  available_for_loan: '',
  has_reviews: '',
  ordering: '',
};

export const ORDERINGS = [
  ['', 'Relevancia / título'],
  ['title', 'Título A-Z'],
  ['-publication_year', 'Más recientes'],
  ['publication_year', 'Más antiguos'],
  ['-average_rating', 'Mejor valorados'],
  ['-review_count', 'Más reseñados'],
  ['-created_at', 'Últimos añadidos'],
];

export default function BookFilters({ values, onSubmit }) {
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS, ...values });
  const sagas = useList('sagas', { page_size: 100 });
  const awards = useList('awards', { page_size: 100 });

  const update = (event) => {
    const { name, type, checked, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: type === 'checkbox' ? (checked ? 'true' : '') : value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(draft);
  };

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    onSubmit(EMPTY_FILTERS);
  };

  return (
    <Panel title="BUSCADOR">
      <form className={styles.form} onSubmit={handleSubmit} role="search">
        <div className={styles.wide}>
          <Field label="Búsqueda libre" name="q" value={draft.q} onChange={update} placeholder="título, autor, sinopsis..." maxLength={200} />
        </div>
        <Field label="Título" name="title" value={draft.title} onChange={update} maxLength={200} />
        <Field label="Autor" name="author_name" value={draft.author_name} onChange={update} maxLength={200} />

        <Field as="select" label="Idioma" name="language" value={draft.language} onChange={update}>
          <option value="">Todos</option>
          {Object.entries(LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Field>
        <Field as="select" label="Saga" name="saga" value={draft.saga} onChange={update}>
          <option value="">Todas</option>
          {results(sagas.data).map((saga) => (
            <option key={saga.id} value={saga.id}>
              {saga.name}
            </option>
          ))}
        </Field>
        <Field as="select" label="Premio" name="award" value={draft.award} onChange={update}>
          <option value="">Todos</option>
          {results(awards.data).map((award) => (
            <option key={award.id} value={award.id}>
              {award.name}
            </option>
          ))}
        </Field>
        <Field label="Año" name="year" type="number" min="1000" max="2100" value={draft.year} onChange={update} />

        <Field as="select" label="Ordenar por" name="ordering" value={draft.ordering} onChange={update}>
          {ORDERINGS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Field>
        <div className={styles.wide}>
          <Checkbox label="Solo disponibles para préstamo" name="available_for_loan" checked={draft.available_for_loan === 'true'} onChange={update} />
        </div>

        <div className={styles.actions}>
          <PixelButton type="submit">EJECUTAR BÚSQUEDA</PixelButton>
          <PixelButton type="button" variant="amber" onClick={handleReset}>
            LIMPIAR
          </PixelButton>
        </div>
      </form>
    </Panel>
  );
}
