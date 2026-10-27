import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BooksPage from '../pages/BooksPage';
import HomePage from '../pages/HomePage';
import BookDetailPage from '../pages/BookDetailPage';
import { booksService, sagasService, awardsService, reviewsService, userBooksService, reservationsService } from '../services/resources';
import { renderWithProviders, sampleBook } from './utils';

vi.mock('../services/resources', async (importOriginal) => {
  const original = await importOriginal();
  const resource = () => ({ list: vi.fn(), retrieve: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() });
  return {
    ...original,
    booksService: resource(),
    sagasService: resource(),
    awardsService: resource(),
    reviewsService: resource(),
    reviewCommentsService: resource(),
    userBooksService: resource(),
    reservationsService: resource(),
    authorsService: resource(),
    usersService: resource(),
    loansService: { ...resource(), request: vi.fn(), act: vi.fn() },
  };
});

const page = (items) => ({ count: items.length, results: items });

beforeEach(() => {
  vi.clearAllMocks();
  booksService.list.mockResolvedValue(page([sampleBook]));
  sagasService.list.mockResolvedValue(page([{ id: 7, name: 'Fundación' }]));
  awardsService.list.mockResolvedValue(page([{ id: 9, name: 'Hugo' }]));
  reviewsService.list.mockResolvedValue(page([]));
  userBooksService.list.mockResolvedValue(page([]));
  reservationsService.list.mockResolvedValue(page([]));
});

describe('BooksPage', () => {
  it('reads filters from the URL and sends them to the API', async () => {
    renderWithProviders(<BooksPage />, { route: '/books?language=es&available_for_loan=true&page=2' });
    expect(await screen.findByText('Dune')).toBeInTheDocument();
    expect(booksService.list).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'es', available_for_loan: 'true', page: 2, page_size: 12 }),
    );
  });

  it('submits the search form as new filters', async () => {
    renderWithProviders(<BooksPage />, { route: '/books' });
    await screen.findByText('Dune');

    await userEvent.type(screen.getByLabelText('Título'), 'Solaris');
    await userEvent.selectOptions(await screen.findByLabelText('Saga'), '7');
    await userEvent.click(screen.getByRole('button', { name: 'EJECUTAR BÚSQUEDA' }));

    await vi.waitFor(() =>
      expect(booksService.list).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Solaris', saga: '7', page: 1 })),
    );
  });

  it('shows the empty state', async () => {
    booksService.list.mockResolvedValue({ count: 0, results: [] });
    renderWithProviders(<BooksPage />, { route: '/books' });
    expect(await screen.findByText('NINGÚN LIBRO COINCIDE CON LA BÚSQUEDA')).toBeInTheDocument();
  });

  it('shows API errors', async () => {
    booksService.list.mockRejectedValue({ response: { status: 500, data: { detail: 'Fallo del servidor' } } });
    renderWithProviders(<BooksPage />, { route: '/books' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo del servidor');
  });
});

describe('HomePage', () => {
  it('renders the four home sections', async () => {
    reviewsService.list.mockResolvedValue(
      page([{ id: 1, title: 'Genial', content: 'Muy buena', rating: 5, book: 1, book_title: 'Dune', user: { id: 2, name: 'Ana' }, created_at: '2024-01-01T00:00:00Z' }]),
    );
    renderWithProviders(<HomePage />);

    expect(await screen.findByText('Genial')).toBeInTheDocument();
    for (const name of ['ÚLTIMOS LIBROS AÑADIDOS', 'MEJOR VALORADOS', 'ÚLTIMAS RESEÑAS', 'DISPONIBLES PARA PRÉSTAMO']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(booksService.list).toHaveBeenCalledWith(expect.objectContaining({ available_for_loan: true }));
    expect(booksService.list).toHaveBeenCalledWith(expect.objectContaining({ ordering: '-average_rating', has_reviews: true }));
  });
});

describe('BookDetailPage', () => {
  const detail = {
    ...sampleBook,
    isbn: '9780441172719',
    synopsis: 'Arrakis.',
    awards: [{ id: 9, name: 'Hugo' }],
    saga: { id: 7, name: 'Dune Saga' },
    amazon_url: 'https://www.amazon.es/s?k=Dune',
    casa_del_libro_url: 'https://www.casadellibro.com/busqueda-generica?busqueda=Dune',
  };

  const renderDetail = () =>
    renderWithProviders(
      <Routes>
        <Route path="/books/:id" element={<BookDetailPage />} />
      </Routes>,
      { route: '/books/1' },
    );

  it('shows the full information with safe external links', async () => {
    booksService.retrieve.mockResolvedValue(detail);
    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Dune', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frank Herbert' })).toHaveAttribute('href', '/authors/3');
    expect(screen.getByRole('link', { name: 'Dune Saga' })).toHaveAttribute('href', '/sagas/7');
    expect(screen.getByText('Hugo')).toBeInTheDocument();
    expect(screen.getByText('Arrakis.')).toBeInTheDocument();

    const amazon = screen.getByRole('link', { name: /AMAZON/ });
    expect(amazon).toHaveAttribute('href', detail.amazon_url);
    expect(amazon).toHaveAttribute('target', '_blank');
    expect(amazon.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: /CASA DEL LIBRO/ })).toBeInTheDocument();
  });

  it('invites visitors to log in instead of showing write forms', async () => {
    booksService.retrieve.mockResolvedValue(detail);
    renderDetail();
    await screen.findByRole('heading', { name: 'Dune', level: 1 });
    expect(screen.queryByText('PUBLICAR')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Inicia sesión' }).length).toBeGreaterThan(0);
  });

  it('shows an error for unknown books', async () => {
    booksService.retrieve.mockRejectedValue({ response: { status: 404, data: { detail: 'No encontrado.' } } });
    renderDetail();
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrado.');
  });
});
