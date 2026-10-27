import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import PixelButton from '../components/PixelButton';
import styles from './MainLayout.module.css';

const LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/books', label: 'Libros' },
  { to: '/authors', label: 'Autores' },
  { to: '/sagas', label: 'Sagas' },
  { to: '/awards', label: 'Premios' },
];

const linkClass = ({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`;

export default function MainLayout() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <NavLink to="/" className={styles.brand} aria-label="Mundos de Acero Oscuro, inicio">
            <span className={styles.brandName}>MUNDOS DE ACERO OSCURO</span>
            <span className={styles.brandTag}>[ TERMINAL DE CIENCIA FICCIÓN v1.0 ]</span>
          </NavLink>

          <nav className={styles.nav} aria-label="Principal">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className={linkClass}>
                Admin
              </NavLink>
            )}
          </nav>

          <div className={styles.session}>
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className={styles.userName} title="Mi perfil">
                  {user.name || user.email}
                </NavLink>
                <PixelButton size="small" variant="amber" onClick={handleLogout}>
                  SALIR
                </PixelButton>
              </>
            ) : (
              <>
                <PixelButton size="small" to="/login">
                  ENTRAR
                </PixelButton>
                <PixelButton size="small" variant="blue" to="/register">
                  REGISTRO
                </PixelButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        MUNDOS DE ACERO OSCURO © {new Date().getFullYear()} :: SISTEMA OPERATIVO · SIN SEÑAL DE LA TIERRA
      </footer>
    </div>
  );
}
