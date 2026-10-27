import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewSection from '../features/reviews/ReviewSection';
import BookLoanPanel from '../features/loans/BookLoanPanel';
import LoanTable from '../features/loans/LoanTable';
import ResourceManager from '../features/admin/ResourceManager';
import { ADMIN_RESOURCES } from '../features/admin/config';
import { tokenStorage } from '../services/tokens';
import { authService } from '../services/authService';
import {
  authorsService,
  loansService,
  reservationsService,
  reviewCommentsService,
  reviewsService,
  userBooksService,
} from '../services/resources';
import { renderWithProviders, sampleBook } from './utils';

vi.mock('../services/authService', () => ({ authService: { me: vi.fn() } }));
vi.mock('../services/resources', async (importOriginal) => {
  const original = await importOriginal();
  const resource = () => ({ list: vi.fn(), retrieve: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() });
  return {
    ...original,
    reviewsService: resource(),
    reviewCommentsService: resource(),
    userBooksService: resource(),
    reservationsService: resource(),
    authorsService: resource(),
    sagasService: resource(),
    awardsService: resource(),
    booksService: resource(),
    usersService: resource(),
    loansService: { ...resource(), request: vi.fn(), act: vi.fn() },
  };
});

const page = (items) => ({ count: items.length, results: items });
const me = { id: 10, email: 'me@x.com', name: 'Yo', role: 'user' };
const other = { id: 20, name: 'Otro' };

function loginAs(user) {
  tokenStorage.set({ access: 'a', refresh: 'r' });
  authService.me.mockResolvedValue(user);
}

beforeEach(() => {
  vi.clearAllMocks();
  reviewsService.list.mockResolvedValue(page([]));
  reviewCommentsService.list.mockResolvedValue(page([]));
  userBooksService.list.mockResolvedValue(page([]));
  reservationsService.list.mockResolvedValue(page([]));
});

describe('ReviewSection (authenticated)', () => {
  it('requires a rating, then creates the review', async () => {
    loginAs(me);
    reviewsService.create.mockResolvedValue({ id: 1 });
    renderWithProviders(<ReviewSection book={{ ...sampleBook, review_count: 0 }} />);

    await screen.findByText('PUBLICAR');
    await userEvent.type(screen.getByLabelText('Título'), 'Épico');
    await userEvent.type(screen.getByLabelText('Reseña'), 'Una obra maestra');
    await userEvent.click(screen.getByRole('button', { name: 'PUBLICAR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecciona una puntuación');
    expect(reviewsService.create).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '5 estrellas' }));
    await userEvent.click(screen.getByRole('button', { name: 'PUBLICAR' }));
    await vi.waitFor(() =>
      expect(reviewsService.create).toHaveBeenCalledWith({ book: 1, title: 'Épico', content: 'Una obra maestra', rating: 5 }),
    );
  });

  it('shows server validation errors per field', async () => {
    loginAs(me);
    reviewsService.create.mockRejectedValue({ response: { status: 400, data: { content: ['Este campo es obligatorio.'] } } });
    renderWithProviders(<ReviewSection book={sampleBook} />);

    await screen.findByText('PUBLICAR');
    await userEvent.click(screen.getByRole('button', { name: '3 estrellas' }));
    await userEvent.click(screen.getByRole('button', { name: 'PUBLICAR' }));
    expect((await screen.findAllByText('Este campo es obligatorio.')).length).toBeGreaterThan(0);
  });

  it('lists reviews, loads comments and posts a comment', async () => {
    loginAs(me);
    reviewsService.list.mockResolvedValue(
      page([{ id: 5, title: 'Buena', content: 'Texto', rating: 4, comment_count: 1, user: other, created_at: '2024-01-01T00:00:00Z' }]),
    );
    reviewCommentsService.list.mockResolvedValue(page([{ id: 1, content: 'Opino igual', user: other, created_at: '2024-01-02T00:00:00Z' }]));
    reviewCommentsService.create.mockResolvedValue({ id: 2 });

    renderWithProviders(<ReviewSection book={sampleBook} />);
    await userEvent.click(await screen.findByRole('button', { name: /COMENTARIOS \(1\)/ }));
    expect(await screen.findByText('Opino igual')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Añadir comentario'), 'Gracias');
    await userEvent.click(screen.getByRole('button', { name: 'COMENTAR' }));
    await vi.waitFor(() => expect(reviewCommentsService.create).toHaveBeenCalledWith({ review: 5, content: 'Gracias' }));
  });

  it('only offers deletion on own reviews (admins can moderate everything)', async () => {
    loginAs(me);
    reviewsService.list.mockResolvedValue(
      page([
        { id: 1, title: 'Mia', content: 'x', rating: 4, comment_count: 0, user: { id: me.id, name: 'Yo' }, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, title: 'Ajena', content: 'y', rating: 2, comment_count: 0, user: other, created_at: '2024-01-01T00:00:00Z' },
      ]),
    );
    renderWithProviders(<ReviewSection book={sampleBook} />);
    await screen.findByText('Mia');
    expect(screen.getAllByRole('button', { name: 'BORRAR' })).toHaveLength(1);
  });
});

describe('BookLoanPanel', () => {
  const copy = { id: 77, owner: other, notes: 'Tapa blanda', available_for_loan: true, on_loan: false };

  it('lets a user request a loan on an available copy', async () => {
    loginAs(me);
    userBooksService.list.mockResolvedValue(page([copy]));
    loansService.request.mockResolvedValue({ id: 1 });

    renderWithProviders(<BookLoanPanel book={sampleBook} />);
    await userEvent.click(await screen.findByRole('button', { name: /Solicitar préstamo/ }));
    await vi.waitFor(() => expect(loansService.request).toHaveBeenCalledWith(77));
    expect(await screen.findByText(/Préstamo solicitado/)).toBeInTheDocument();
  });

  it('does not offer to borrow your own copy', async () => {
    loginAs(me);
    userBooksService.list.mockResolvedValue(page([{ ...copy, owner: { id: me.id, name: 'Yo' } }]));
    renderWithProviders(<BookLoanPanel book={sampleBook} />);
    expect(await screen.findByText('TU EJEMPLAR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Solicitar préstamo/ })).not.toBeInTheDocument();
  });

  it('shows backend refusals', async () => {
    loginAs(me);
    userBooksService.list.mockResolvedValue(page([copy]));
    loansService.request.mockRejectedValue({ response: { status: 400, data: ['Ya tienes una solicitud activa.'] } });
    renderWithProviders(<BookLoanPanel book={sampleBook} />);
    await userEvent.click(await screen.findByRole('button', { name: /Solicitar préstamo/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('offers reservations when every copy is lent and allows cancelling', async () => {
    loginAs(me);
    userBooksService.list.mockResolvedValue(page([{ ...copy, on_loan: true }]));
    reservationsService.create.mockResolvedValue({ id: 3 });
    const lentBook = { ...sampleBook, loan_availability: 'lent', reservation_count: 2 };

    renderWithProviders(<BookLoanPanel book={lentBook} />);
    expect(await screen.findByText(/Reservas en cola: 2/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /RESERVAR/ }));
    await vi.waitFor(() => expect(reservationsService.create).toHaveBeenCalledWith({ book: 1 }));
  });

  it('shows the queue position of an existing reservation', async () => {
    loginAs(me);
    userBooksService.list.mockResolvedValue(page([{ ...copy, on_loan: true }]));
    reservationsService.list.mockResolvedValue(page([{ id: 9, queue_position: 2 }]));
    reservationsService.remove.mockResolvedValue();

    renderWithProviders(<BookLoanPanel book={{ ...sampleBook, loan_availability: 'lent' }} />);
    expect(await screen.findByText(/POSICIÓN 2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /RESERVAR/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'CANCELAR RESERVA' }));
    await vi.waitFor(() => expect(reservationsService.remove).toHaveBeenCalledWith(9));
  });

  it('registers a new copy', async () => {
    loginAs(me);
    userBooksService.create.mockResolvedValue({ id: 1 });
    renderWithProviders(<BookLoanPanel book={sampleBook} />);
    await userEvent.type(await screen.findByLabelText(/Notas/), 'Como nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'REGISTRAR EJEMPLAR' }));
    await vi.waitFor(() =>
      expect(userBooksService.create).toHaveBeenCalledWith({ book: 1, notes: 'Como nuevo', available_for_loan: true }),
    );
  });

  it('hides write actions from visitors', async () => {
    userBooksService.list.mockResolvedValue(page([copy]));
    renderWithProviders(<BookLoanPanel book={sampleBook} />);
    await screen.findByText('Tapa blanda');
    expect(screen.queryByRole('button', { name: /Solicitar préstamo/ })).not.toBeInTheDocument();
    expect(reservationsService.list).not.toHaveBeenCalled();
  });
});

describe('LoanTable', () => {
  const loan = {
    id: 4,
    owner: { id: me.id, name: 'Yo' },
    borrower: other,
    book_id: 1,
    book_title: 'Dune',
    status: 'REQUESTED',
    requested_at: '2024-01-01T00:00:00Z',
    allowed_actions: ['approve', 'cancel'],
  };

  it('renders only the actions allowed by the API and runs them', async () => {
    loansService.act.mockResolvedValue({});
    renderWithProviders(<LoanTable loans={[loan]} userId={me.id} />, { withAuth: false });

    expect(screen.getAllByText('SOLICITADO')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'ENTREGADO' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'APROBAR' }));
    await vi.waitFor(() => expect(loansService.act).toHaveBeenCalledWith(4, 'approve'));
  });

  it('shows return confirmations from both parties', () => {
    const pending = { ...loan, status: 'RETURN_PENDING', owner_confirmed_return: true, borrower_confirmed_return: false, allowed_actions: [] };
    renderWithProviders(<LoanTable loans={[pending]} userId={me.id} />, { withAuth: false });
    expect(screen.getByText(/Propietario: sí · Prestatario: no/)).toBeInTheDocument();
  });

  it('asks for confirmation before marking a loan as lost', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithProviders(<LoanTable loans={[{ ...loan, status: 'BORROWED', allowed_actions: ['mark_lost'] }]} userId={me.id} />, { withAuth: false });
    await userEvent.click(screen.getByRole('button', { name: 'MARCAR PERDIDO' }));
    expect(confirm).toHaveBeenCalled();
    expect(loansService.act).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('surfaces action errors', async () => {
    loansService.act.mockRejectedValue({ response: { status: 400, data: { detail: 'Transición no permitida.' } } });
    renderWithProviders(<LoanTable loans={[loan]} userId={me.id} />, { withAuth: false });
    await userEvent.click(screen.getByRole('button', { name: 'APROBAR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Transición no permitida.');
  });
});

describe('Admin ResourceManager', () => {
  it('creates an author with the payload mapped by the config', async () => {
    authorsService.list.mockResolvedValue(page([]));
    authorsService.create.mockResolvedValue({ id: 1 });
    renderWithProviders(<ResourceManager config={ADMIN_RESOURCES.authors} />, { withAuth: false });

    await userEvent.click(await screen.findByRole('button', { name: '+ NUEVO' }));
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ursula K. Le Guin');
    await userEvent.type(screen.getByLabelText('País'), 'EEUU');
    await userEvent.click(screen.getByRole('button', { name: 'GUARDAR' }));

    await vi.waitFor(() =>
      expect(authorsService.create).toHaveBeenCalledWith({ name: 'Ursula K. Le Guin', biography: '', birth_date: null, country: 'EEUU' }),
    );
  });

  it('edits and deletes after confirmation, showing conflicts', async () => {
    authorsService.list.mockResolvedValue(page([{ id: 3, name: 'Asimov', country: 'EEUU', book_count: 4, biography: '', birth_date: null }]));
    authorsService.update.mockResolvedValue({});
    authorsService.remove.mockRejectedValue({ response: { status: 409, data: { detail: 'No se puede borrar: tiene libros.' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<ResourceManager config={ADMIN_RESOURCES.authors} />, { withAuth: false });
    const row = (await screen.findByText('Asimov')).closest('tr');

    await userEvent.click(within(row).getByRole('button', { name: 'EDITAR' }));
    const name = screen.getByLabelText('Nombre');
    await userEvent.clear(name);
    await userEvent.type(name, 'Isaac Asimov');
    await userEvent.click(screen.getByRole('button', { name: 'GUARDAR' }));
    await vi.waitFor(() => expect(authorsService.update).toHaveBeenCalledWith(3, expect.objectContaining({ name: 'Isaac Asimov' })));

    await userEvent.click(await within((await screen.findByText('Asimov')).closest('tr')).findByRole('button', { name: 'BORRAR' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede borrar');
    window.confirm.mockRestore();
  });
});
