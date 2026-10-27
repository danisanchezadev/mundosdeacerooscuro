import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout, { AuthDivider } from '../layouts/AuthLayout';
import Field from '../components/Field';
import PixelButton from '../components/PixelButton';
import { ErrorMessage } from '../components/Messages';
import GoogleLoginButton, { GOOGLE_CLIENT_ID } from '../features/auth/GoogleLoginButton';
import { parseApiError } from '../services/api';

export default function LoginPage() {
  const { login, googleLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from ?? '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
      setFieldErrors(parsed.fields);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (code) => {
    setError('');
    try {
      await googleLogin(code);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <AuthLayout
      title="ACCESO AL SISTEMA"
      footer={
        <>
          ¿Sin credenciales? <Link to="/register">Solicitar acceso</Link> ·{' '}
          <Link to="/forgot-password">He olvidado mi contraseña</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <ErrorMessage message={error} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} error={fieldErrors.email} />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update}
          error={fieldErrors.password}
        />
        <PixelButton type="submit" disabled={submitting}>
          {submitting ? 'CONECTANDO...' : 'INICIAR SESIÓN'}
        </PixelButton>
      </form>
      {GOOGLE_CLIENT_ID && <AuthDivider />}
      <GoogleLoginButton onCode={handleGoogle} onError={setError} />
    </AuthLayout>
  );
}
