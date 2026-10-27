import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useList, useResourceMutations } from '../../hooks/useResources';
import Badge from '../../components/Badge';
import PixelButton from '../../components/PixelButton';
import QueryState from '../../components/QueryState';
import { ErrorMessage } from '../../components/Messages';
import { parseApiError } from '../../services/api';
import { results } from '../../utils/format';
import styles from './Loans.module.css';

export function MyCopies() {
  const copies = useList('user-books', { mine: true, page_size: 100 });
  const { update, remove } = useResourceMutations('user-books');
  const [error, setError] = useState('');
  const items = results(copies.data);

  const onError = (err) => setError(parseApiError(err).message);

  return (
    <QueryState query={copies} isEmpty={items.length === 0} emptyLabel="AÚN NO HAS REGISTRADO EJEMPLARES">
      <ErrorMessage message={error} />
      <ul className={styles.copies}>
        {items.map((copy) => (
          <li key={copy.id} className={styles.copy}>
            <div>
              <Link to={`/books/${copy.book}`}>{copy.book_title}</Link>
              <div className="muted">
                {copy.book_author}
                {copy.notes ? ` · ${copy.notes}` : ''}
              </div>
            </div>
            <div className={styles.copyActions}>
              {copy.on_loan && <Badge tone="amber">PRESTADO</Badge>}
              <Badge tone={copy.available_for_loan ? 'green' : 'dim'}>{copy.available_for_loan ? 'OFRECIDO' : 'NO OFRECIDO'}</Badge>
              <PixelButton
                size="small"
                variant="blue"
                disabled={update.isPending}
                onClick={() => {
                  setError('');
                  update.mutate({ id: copy.id, available_for_loan: !copy.available_for_loan }, { onError });
                }}
              >
                {copy.available_for_loan ? 'RETIRAR' : 'OFRECER'}
              </PixelButton>
              <PixelButton
                size="small"
                variant="red"
                disabled={remove.isPending}
                onClick={() => {
                  if (!window.confirm('¿Eliminar este ejemplar?')) return;
                  setError('');
                  remove.mutate(copy.id, { onError });
                }}
              >
                BORRAR
              </PixelButton>
            </div>
          </li>
        ))}
      </ul>
    </QueryState>
  );
}

export function MyReservations() {
  const { user } = useAuth();
  const reservations = useList('reservations', { active: true, user: user.id, page_size: 100 });
  const { remove } = useResourceMutations('reservations');
  const [error, setError] = useState('');
  const items = results(reservations.data);

  return (
    <QueryState query={reservations} isEmpty={items.length === 0} emptyLabel="NO TIENES RESERVAS ACTIVAS">
      <ErrorMessage message={error} />
      <ul className={styles.copies}>
        {items.map((reservation) => (
          <li key={reservation.id} className={styles.copy}>
            <Link to={`/books/${reservation.book}`}>{reservation.book_title}</Link>
            <div className={styles.copyActions}>
              <Badge tone="blue">POSICIÓN {reservation.queue_position}</Badge>
              <PixelButton
                size="small"
                variant="red"
                disabled={remove.isPending}
                onClick={() => {
                  setError('');
                  remove.mutate(reservation.id, { onError: (err) => setError(parseApiError(err).message) });
                }}
              >
                CANCELAR
              </PixelButton>
            </div>
          </li>
        ))}
      </ul>
    </QueryState>
  );
}
