import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthLayout, { AuthDivider } from '../layouts/AuthLayout';
import Field from '../components/Field';
import PixelButton from '../components/PixelButton';
import { ErrorMessage, SuccessMessage } from '../components/Messages';
import GoogleLoginButton, { GOOGLE_CLIENT_ID } from '../features/auth/GoogleLoginButton';
import { parseApiError } from '../services/api';

export default function RegisterPage() {
  const { register, googleLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password1: '', password2: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setFieldErrors({});

    if (form.password1 !== form.password2) {
      setFieldErrors({ password2: 'Las contraseñas no coinciden.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await register(form);
      if (result.authenticated) navigate('/', { replace: true });
      else setNotice(result.detail || 'Cuenta creada. Revisa tu email para verificarla antes de acceder.');
    } catch (err) {
      const parsed = parseApiError(err);
      setError(Object.keys(parsed.fields).length ? '' : parsed.message);
      setFieldErrors(parsed.fields);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (code) => {
    setError('');
    try {
      await googleLogin(code);
      navigate('/', { replace: true });
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <AuthLayout
      title="NUEVO TRIPULANTE"
      footer={
        <>
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <ErrorMessage message={error} />
        <SuccessMessage>{notice}</SuccessMessage>
        <Field label="Nombre" name="name" autoComplete="name" maxLength={150} required value={form.name} onChange={update} error={fieldErrors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} error={fieldErrors.email} />
        <Field
          label="Contraseña"
          name="password1"
          type="password"
          autoComplete="new-password"
          required
          value={form.password1}
          onChange={update}
          error={fieldErrors.password1}
        />
        <Field
          label="Repite la contraseña"
          name="password2"
          type="password"
          autoComplete="new-password"
          required
          value={form.password2}
          onChange={update}
          error={fieldErrors.password2}
        />
        <PixelButton type="submit" disabled={submitting}>
          {submitting ? 'REGISTRANDO...' : 'CREAR CUENTA'}
        </PixelButton>
      </form>
      {GOOGLE_CLIENT_ID && <AuthDivider />}
      <GoogleLoginButton onCode={handleGoogle} onError={setError} label="REGISTRO CON GOOGLE" />
    </AuthLayout>
  );
}
