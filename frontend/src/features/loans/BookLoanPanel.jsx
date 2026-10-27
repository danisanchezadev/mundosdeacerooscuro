import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useList, useRequestLoan, useResourceMutations } from '../../hooks/useResources';
import Panel from '../../components/Panel';
import Badge from '../../components/Badge';
import Field, { Checkbox } from '../../components/Field';
import PixelButton from '../../components/PixelButton';
import QueryState from '../../components/QueryState';
import { ErrorMessage, SuccessMessage } from '../../components/Messages';
import { parseApiError } from '../../services/api';
import { results } from '../../utils/format';
import styles from './Loans.module.css';

function CopyRow({ copy, book, userId, onRequest, requesting }) {
  const mine = copy.owner?.id === userId;
  const free = copy.available_for_loan && !copy.on_loan;

  return (
    <li className={styles.copy}>
      <div>
        <strong>{copy.owner?.name}</strong>
        {copy.notes && <div className="muted">{copy.notes}</div>}
      </div>
      <div className={styles.copyActions}>
        {copy.on_loan ? <Badge tone="amber">PRESTADO</Badge> : <Badge>DISPONIBLE</Badge>}
        {mine && <Badge tone="blue">TU EJEMPLAR</Badge>}
        {free && !mine && userId && (
          <PixelButton size="small" disabled={requesting} onClick={() => onRequest(copy.id)} aria-label={`Solicitar préstamo de ${book.title} a ${copy.owner?.name}`}>
            SOLICITAR
          </PixelButton>
        )}
      </div>
    </li>
  );
}

function OfferCopyForm({ bookId }) {
  const { create } = useResourceMutations('user-books');
  const [notes, setNotes] = useState('');
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setDone(false);
    create.mutate(
      { book: bookId, notes, available_for_loan: available },
      {
        onSuccess: () => {
          setNotes('');
          setDone(true);
        },
        onError: (err) => setError(parseApiError(err).message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className={styles.offer} noValidate>
      <h3>OFRECER UN EJEMPLAR</h3>
      <ErrorMessage message={error} />
      {done && <SuccessMessage>Ejemplar registrado.</SuccessMessage>}
      <Field label="Notas (estado, edición...)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      <Checkbox label="Disponible para préstamo" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
      <PixelButton type="submit" size="small" variant="amber" disabled={create.isPending}>
        REGISTRAR EJEMPLAR
      </PixelButton>
    </form>
  );
}

export default function BookLoanPanel({ book }) {
  const { user, isAuthenticated } = useAuth();
  const copies = useList('user-books', { book: book.id, available_for_loan: true, page_size: 100 });
  const reservations = useList('reservations', { book: book.id, active: true, user: user?.id }, { enabled: isAuthenticated });
  const requestLoan = useRequestLoan();
  const reservationMutations = useResourceMutations('reservations');
  const [feedback, setFeedback] = useState({ error: '', ok: '' });

  const items = results(copies.data);
  const myReservation = results(reservations.data)[0];
  const canReserve = isAuthenticated && book.loan_availability === 'lent' && !myReservation;

  const handleRequest = (userBookId) => {
    setFeedback({ error: '', ok: '' });
    requestLoan.mutate(userBookId, {
      onSuccess: () => setFeedback({ error: '', ok: 'Préstamo solicitado. El propietario deberá aprobarlo (ver tu perfil).' }),
      onError: (err) => setFeedback({ error: parseApiError(err).message, ok: '' }),
    });
  };

  const handleReserve = () => {
    setFeedback({ error: '', ok: '' });
    reservationMutations.create.mutate(
      { book: book.id },
      {
        onSuccess: () => setFeedback({ error: '', ok: 'Reserva registrada.' }),
        onError: (err) => setFeedback({ error: parseApiError(err).message, ok: '' }),
      },
    );
  };

  const handleCancelReservation = () => {
    setFeedback({ error: '', ok: '' });
    reservationMutations.remove.mutate(myReservation.id, {
      onSuccess: () => setFeedback({ error: '', ok: 'Reserva cancelada.' }),
      onError: (err) => setFeedback({ error: parseApiError(err).message, ok: '' }),
    });
  };

  return (
    <Panel title="PRÉSTAMOS ENTRE LECTORES" tone="amber">
      <ErrorMessage message={feedback.error} />
      <SuccessMessage>{feedback.ok}</SuccessMessage>

      <QueryState query={copies} isEmpty={items.length === 0} emptyLabel="NINGÚN LECTOR OFRECE ESTE LIBRO">
        <ul className={styles.copies}>
          {items.map((copy) => (
            <CopyRow key={copy.id} copy={copy} book={book} userId={user?.id} onRequest={handleRequest} requesting={requestLoan.isPending} />
          ))}
        </ul>
      </QueryState>

      {book.reservation_count > 0 && <p className="muted">Reservas en cola: {book.reservation_count}</p>}

      {myReservation && (
        <div className={styles.reservation}>
          <Badge tone="blue">TU RESERVA · POSICIÓN {myReservation.queue_position}</Badge>
          <PixelButton size="small" variant="red" onClick={handleCancelReservation} disabled={reservationMutations.remove.isPending}>
            CANCELAR RESERVA
          </PixelButton>
        </div>
      )}
      {canReserve && (
        <PixelButton variant="blue" onClick={handleReserve} disabled={reservationMutations.create.isPending}>
          RESERVAR (EN COLA)
        </PixelButton>
      )}

      {isAuthenticated ? (
        <OfferCopyForm bookId={book.id} />
      ) : (
        <p className="muted">
          <Link to="/login">Inicia sesión</Link> para solicitar préstamos, reservar u ofrecer tus ejemplares.
        </p>
      )}
    </Panel>
  );
}
