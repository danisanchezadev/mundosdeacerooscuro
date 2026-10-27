import Loading from './Loading';
import { ErrorMessage, EmptyState } from './Messages';

/** Renders loading / error / empty states for a react-query result. */
export default function QueryState({ query, isEmpty, emptyLabel, children }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorMessage error={query.error} />;
  if (isEmpty) return <EmptyState>{emptyLabel}</EmptyState>;
  return children;
}
