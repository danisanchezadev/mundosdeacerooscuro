import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { tokenStorage } from '../services/tokens';
import { authService } from '../services/authService';
import { renderWithProviders } from './utils';

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    updateMe: vi.fn(),
  },
}));

const regularUser = { id: 1, email: 'a@b.com', name: 'Ana', role: 'user', completed_loans: 0 };
const adminUser = { ...regularUser, id: 2, role: 'admin' };

function Whoami() {
  const { user, isAdmin } = useAuth();
  return <p>{user ? `${user.name}${isAdmin ? ' (admin)' : ''}` : 'anon'}</p>;
}

const routes = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/" element={<Whoami />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/profile" element={<p>PERFIL</p>} />
    </Route>
    <Route element={<ProtectedRoute adminOnly />}>
      <Route path="/admin" element={<p>ADMIN</p>} />
    </Route>
  </Routes>
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('logs in and redirects home', async () => {
    authService.login.mockResolvedValue({});
    authService.me.mockResolvedValue(regularUser);

    renderWithProviders(routes, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /INICIAR SESIÓN/ }));

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(authService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('shows the API error on invalid credentials', async () => {
    authService.login.mockRejectedValue({ response: { status: 400, data: { non_field_errors: ['Credenciales incorrectas.'] } } });

    renderWithProviders(routes, { route: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: /INICIAR SESIÓN/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas.');
  });
});

describe('RegisterPage', () => {
  it('validates password confirmation client-side', async () => {
    renderWithProviders(routes, { route: '/register' });
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Str0ng-Passw0rd!');
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: /CREAR CUENTA/ }));

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('shows the verification notice when no tokens are returned', async () => {
    authService.register.mockResolvedValue({ detail: 'Se ha enviado un email de verificación.' });

    renderWithProviders(routes, { route: '/register' });
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Str0ng-Passw0rd!');
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'Str0ng-Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: /CREAR CUENTA/ }));

    expect(await screen.findByText(/verificación/)).toBeInTheDocument();
  });
});

describe('ProtectedRoute', () => {
  it('redirects anonymous visitors to the login page', async () => {
    renderWithProviders(routes, { route: '/profile' });
    expect(await screen.findByRole('heading', { name: /ACCESO AL SISTEMA/ })).toBeInTheDocument();
  });

  it('lets authenticated users in', async () => {
    tokenStorage.set({ access: 'a', refresh: 'r' });
    authService.me.mockResolvedValue(regularUser);
    renderWithProviders(routes, { route: '/profile' });
    expect(await screen.findByText('PERFIL')).toBeInTheDocument();
  });

  it('blocks non-admins from admin routes', async () => {
    tokenStorage.set({ access: 'a', refresh: 'r' });
    authService.me.mockResolvedValue(regularUser);
    renderWithProviders(routes, { route: '/admin' });
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
  });

  it('allows admins', async () => {
    tokenStorage.set({ access: 'a', refresh: 'r' });
    authService.me.mockResolvedValue(adminUser);
    renderWithProviders(routes, { route: '/admin' });
    expect(await screen.findByText('ADMIN')).toBeInTheDocument();
  });

  it('drops an invalid stored session', async () => {
    tokenStorage.set({ access: 'expired', refresh: 'expired' });
    authService.me.mockRejectedValue(new Error('401'));
    renderWithProviders(routes, { route: '/profile' });
    expect(await screen.findByRole('heading', { name: /ACCESO AL SISTEMA/ })).toBeInTheDocument();
    expect(tokenStorage.hasSession()).toBe(false);
  });
});
