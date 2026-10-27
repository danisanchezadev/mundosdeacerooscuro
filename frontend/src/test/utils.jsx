import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../features/auth/AuthContext';

export function renderWithProviders(ui, { route = '/', withAuth = true } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const content = withAuth ? <AuthProvider>{ui}</AuthProvider> : ui;
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const sampleBook = {
  id: 1,
  title: 'Dune',
  author: { id: 3, name: 'Frank Herbert' },
  saga: null,
  publication_year: 1965,
  language: 'en',
  external_cover_url: '',
  average_rating: '4.5',
  review_count: 2,
  available_copies: 1,
  offered_copies: 1,
  reservation_count: 0,
  loan_availability: 'available',
};
