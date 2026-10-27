import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useList } from '../hooks/useResources';
import PageHeader from '../components/PageHeader';
import Panel from '../components/Panel';
import QueryState from '../components/QueryState';
import Badge from '../components/Badge';
import LoanTable from '../features/loans/LoanTable';
import { MyCopies, MyReservations } from '../features/loans/MyLists';
import ProfileEditor from '../features/auth/ProfileEditor';
import PixelButton from '../components/PixelButton';
import { formatDate, results } from '../utils/format';
import styles from './ProfilePage.module.css';

function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  if (user.avatar_url && !failed) {
    return <img className={styles.avatar} src={user.avatar_url} alt={`Avatar de ${user.name || user.email}`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${styles.avatar} ${styles.initial}`} aria-hidden="true">
      {(user.name || user.email).charAt(0).toUpperCase()}
    </div>
  );
}

function LoanSection({ role, emptyLabel }) {
  const { user } = useAuth();
  const query = useList('loans', { role, page_size: 100 });
  const loans = results(query.data);
  return (
    <QueryState query={query} isEmpty={loans.length === 0} emptyLabel={emptyLabel}>
      <LoanTable loans={loans} userId={user.id} />
    </QueryState>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <PageHeader title="PERFIL DE USUARIO" />

      <div className={styles.head}>
        <Avatar user={user} />
        <div>
          <h2>{user.name || user.email}</h2>
          {user.role === 'admin' && <Badge tone="amber">ADMINISTRADOR</Badge>}
          <dl className={styles.stats}>
            <dt>EMAIL</dt>
            <dd>{user.email}</dd>
            <dt>ALTA</dt>
            <dd>{formatDate(user.date_joined)}</dd>
            <dt>PRÉSTAMOS COMPLETADOS</dt>
            <dd>{user.completed_loans}</dd>
          </dl>
          <PixelButton size="small" variant="amber" onClick={() => setEditing((prev) => !prev)} aria-expanded={editing}>
            {editing ? 'CERRAR EDICIÓN' : 'EDITAR PERFIL'}
          </PixelButton>
        </div>
      </div>

      {editing && (
        <div className={styles.editor}>
          <Panel title="EDITAR PERFIL" tone="amber">
            <ProfileEditor />
          </Panel>
        </div>
      )}

      <div className={styles.sections}>
        <section aria-label="Mis ejemplares">
          <h2>MIS EJEMPLARES</h2>
          <MyCopies />
        </section>
        <section aria-label="Préstamos que he pedido">
          <h2>PRÉSTAMOS SOLICITADOS POR MÍ</h2>
          <LoanSection role="borrower" emptyLabel="NO HAS SOLICITADO PRÉSTAMOS" />
        </section>
        <section aria-label="Préstamos de mis libros">
          <h2>PETICIONES SOBRE MIS LIBROS</h2>
          <LoanSection role="owner" emptyLabel="NADIE HA PEDIDO TUS LIBROS TODAVÍA" />
        </section>
        <section aria-label="Mis reservas">
          <h2>MIS RESERVAS</h2>
          <MyReservations />
        </section>
      </div>
    </>
  );
}
