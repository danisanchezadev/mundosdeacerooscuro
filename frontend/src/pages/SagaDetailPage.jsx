import EntityDetailPage from '../features/books/EntityDetailPage';
import styles from '../features/books/Catalog.module.css';

export default function SagaDetailPage() {
  return (
    <EntityDetailPage
      resource="sagas"
      filterKey="saga"
      backTo="/sagas"
      backLabel="SAGAS"
      renderBody={(saga) => <p className={styles.bio}>{saga.description || 'Sin descripción disponible.'}</p>}
    />
  );
}
