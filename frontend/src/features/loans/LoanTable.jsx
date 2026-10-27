import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoanAction } from '../../hooks/useResources';
import Badge from '../../components/Badge';
import PixelButton from '../../components/PixelButton';
import { ErrorMessage } from '../../components/Messages';
import { parseApiError } from '../../services/api';
import { LOAN_ACTION_LABELS, LOAN_STATUS_LABELS, formatDate } from '../../utils/format';
import styles from './Loans.module.css';

const STATUS_TONE = {
  REQUESTED: 'amber',
  APPROVED: 'blue',
  BORROWED: 'green',
  RETURN_PENDING: 'amber',
  RETURN_CONFIRMED: 'dim',
  CANCELLED: 'dim',
  LOST: 'red',
};

const DANGEROUS = new Set(['cancel', 'mark_lost']);

export default function LoanTable({ loans, userId }) {
  const action = useLoanAction();
  const [error, setError] = useState('');

  const run = (loan, name) => {
    if (name === 'mark_lost' && !window.confirm('¿Marcar este libro como perdido? El ejemplar dejará de ofrecerse.')) return;
    setError('');
    action.mutate({ id: loan.id, action: name }, { onError: (err) => setError(parseApiError(err).message) });
  };

  return (
    <>
      <ErrorMessage message={error} />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>LIBRO</th>
            <th>CON</th>
            <th>ESTADO</th>
            <th>SOLICITADO</th>
            <th>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => {
            const counterpart = loan.owner?.id === userId ? loan.borrower : loan.owner;
            const role = loan.owner?.id === userId ? 'Prestatario' : 'Propietario';
            return (
              <tr key={loan.id}>
                <td>
                  <Link to={`/books/${loan.book_id}`}>{loan.book_title}</Link>
                </td>
                <td>
                  {counterpart?.name} <span className="muted">({role})</span>
                </td>
                <td>
                  <Badge tone={STATUS_TONE[loan.status]}>{LOAN_STATUS_LABELS[loan.status] ?? loan.status}</Badge>
                  {loan.status === 'RETURN_PENDING' && (
                    <div className="muted">
                      Propietario: {loan.owner_confirmed_return ? 'sí' : 'no'} · Prestatario: {loan.borrower_confirmed_return ? 'sí' : 'no'}
                    </div>
                  )}
                </td>
                <td>{formatDate(loan.requested_at)}</td>
                <td>
                  <div className={styles.rowActions}>
                    {loan.allowed_actions.map((name) => (
                      <PixelButton
                        key={name}
                        size="small"
                        variant={DANGEROUS.has(name) ? 'red' : 'green'}
                        disabled={action.isPending}
                        onClick={() => run(loan, name)}
                      >
                        {LOAN_ACTION_LABELS[name] ?? name}
                      </PixelButton>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
