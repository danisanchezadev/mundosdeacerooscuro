import { Link } from 'react-router-dom';
import EntityListPage from '../features/books/EntityListPage';

export default function AwardsPage() {
  return (
    <EntityListPage
      resource="awards"
      title="PREMIOS LITERARIOS"
      subtitle="Los galardones que coronan la ciencia ficción."
      describe={(award) => award.description}
      meta={(award) =>
        award.book_count > 0 ? <Link to={`/books?award=${award.id}`}>VER LIBROS &gt;&gt;</Link> : null
      }
    />
  );
}
