import EntityListPage from '../features/books/EntityListPage';

export default function SagasPage() {
  return (
    <EntityListPage
      resource="sagas"
      title="SAGAS"
      subtitle="Universos que se extienden por varios volúmenes."
      basePath="/sagas"
      describe={(saga) => saga.description}
    />
  );
}
