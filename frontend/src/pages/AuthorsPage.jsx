import EntityListPage from '../features/books/EntityListPage';

export default function AuthorsPage() {
  return (
    <EntityListPage
      resource="authors"
      title="AUTORES"
      subtitle="Los arquitectos de mundos imposibles."
      basePath="/authors"
      describe={(author) => author.biography}
      meta={(author) => (author.country ? <span className="muted">{author.country}</span> : null)}
    />
  );
}
