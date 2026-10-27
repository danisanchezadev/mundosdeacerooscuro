import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import Field from '../components/Field';
import PixelButton from '../components/PixelButton';
import { ErrorMessage, SuccessMessage } from '../components/Messages';
import { authService } from '../services/authService';
import { parseApiError } from '../services/api';

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const [form, setForm] = useState({ new_password1: '', new_password2: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await authService.confirmPasswordReset({ uid, token, ...form });
      setDone(true);
    } catch (err) {
      const parsed = parseApiError(err);
      const tokenProblem = parsed.fields.token || parsed.fields.uid;
      setError(tokenProblem ? 'El enlace no es válido o ha caducado. Solicita uno nuevo.' : parsed.message);
      setFieldErrors(parsed.fields);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="NUEVA CONTRASEÑA" footer={<Link to="/login">Ir al acceso</Link>}>
      {done ? (
        <SuccessMessage>Contraseña actualizada. Ya puedes iniciar sesión.</SuccessMessage>
      ) : (
        <form onSubmit={handleSubmit}>
          <ErrorMessage message={error} />
          <Field
            label="Nueva contraseña"
            name="new_password1"
            type="password"
            autoComplete="new-password"
            required
            value={form.new_password1}
            onChange={update}
            error={fieldErrors.new_password1}
          />
          <Field
            label="Repite la contraseña"
            name="new_password2"
            type="password"
            autoComplete="new-password"
            required
            value={form.new_password2}
            onChange={update}
            error={fieldErrors.new_password2}
          />
          <PixelButton type="submit" disabled={submitting}>
            {submitting ? 'GUARDANDO...' : 'GUARDAR'}
          </PixelButton>
        </form>
      )}
    </AuthLayout>
  );
}
