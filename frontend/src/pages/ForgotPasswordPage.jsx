import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import Field from '../components/Field';
import PixelButton from '../components/PixelButton';
import { ErrorMessage, SuccessMessage } from '../components/Messages';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="RECUPERAR ACCESO" footer={<Link to="/login">Volver al acceso</Link>}>
      {sent ? (
        <SuccessMessage>Si el email existe, recibirás un enlace para restablecer la contraseña.</SuccessMessage>
      ) : (
        <form onSubmit={handleSubmit}>
          <ErrorMessage error={error} />
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <PixelButton type="submit" disabled={submitting}>
            {submitting ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
          </PixelButton>
        </form>
      )}
    </AuthLayout>
  );
}
