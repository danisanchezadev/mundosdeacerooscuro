import { useGoogleLogin } from '@react-oauth/google';
import PixelButton from '../../components/PixelButton';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/** Authorization-code flow: the backend exchanges the code and validates the ID token. */
function GoogleButtonInner({ onCode, onError, label }) {
  const start = useGoogleLogin({
    flow: 'auth-code',
    onSuccess: ({ code }) => onCode(code),
    onError: () => onError?.('No se pudo completar el acceso con Google.'),
    onNonOAuthError: () => onError?.('Ventana de Google cerrada antes de completar el acceso.'),
  });

  return (
    <PixelButton type="button" variant="blue" onClick={() => start()}>
      {label}
    </PixelButton>
  );
}

export default function GoogleLoginButton({ onCode, onError, label = 'ACCEDER CON GOOGLE' }) {
  if (!GOOGLE_CLIENT_ID) return null;
  return <GoogleButtonInner onCode={onCode} onError={onError} label={label} />;
}
