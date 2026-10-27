import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Field from '../../components/Field';
import PixelButton from '../../components/PixelButton';
import { ErrorMessage, SuccessMessage } from '../../components/Messages';
import { authService } from '../../services/authService';
import { parseApiError } from '../../services/api';

export default function ProfileEditor() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name ?? '', avatar_url: user.avatar_url ?? '' });
  const [error, setError] = useState({ message: '', fields: {} });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (event) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError({ message: '', fields: {} });
    setSaving(true);
    try {
      setUser(await authService.updateMe(form));
      setSaved(true);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <ErrorMessage message={error.message} />
      {saved && <SuccessMessage>Perfil actualizado.</SuccessMessage>}
      <Field label="Nombre" name="name" value={form.name} onChange={update} maxLength={150} error={error.fields.name} />
      <Field
        label="URL del avatar (https://...)"
        name="avatar_url"
        type="url"
        value={form.avatar_url}
        onChange={update}
        error={error.fields.avatar_url}
      />
      <PixelButton type="submit" disabled={saving}>
        {saving ? 'GUARDANDO...' : 'GUARDAR PERFIL'}
      </PixelButton>
    </form>
  );
}
