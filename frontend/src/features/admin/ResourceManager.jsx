import { useState } from 'react';
import { useList, useResourceMutations } from '../../hooks/useResources';
import Field, { Checkbox } from '../../components/Field';
import Panel from '../../components/Panel';
import PixelButton from '../../components/PixelButton';
import QueryState from '../../components/QueryState';
import Pagination from '../../components/Pagination';
import { ErrorMessage } from '../../components/Messages';
import { parseApiError } from '../../services/api';
import { results } from '../../utils/format';
import { PAGE_SIZE } from './config';
import loanStyles from '../loans/Loans.module.css';
import styles from './Admin.module.css';

function OptionsField({ field, value, onChange, error }) {
  const options = useList(field.options.resource, { page_size: 100, ordering: 'name' });
  const items = results(options.data);
  const multiple = field.type === 'multiselect';

  const handleChange = (event) => {
    if (multiple) onChange(Array.from(event.target.selectedOptions, (option) => Number(option.value)));
    else onChange(event.target.value);
  };

  return (
    <Field
      as="select"
      label={field.label}
      value={value}
      multiple={multiple}
      required={field.required}
      onChange={handleChange}
      error={error}
      className={multiple ? styles.multi : ''}
    >
      {!multiple && <option value="">{field.allowEmpty ? '— ninguna —' : '— selecciona —'}</option>}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item[field.options.label]}
        </option>
      ))}
    </Field>
  );
}

function EditForm({ config, initial, onSubmit, onCancel, submitting, error }) {
  const [form, setForm] = useState(initial);
  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(config.toPayload(form));
      }}
      noValidate
    >
      <ErrorMessage message={error.message} />
      {config.fields.map((field) => {
        const fieldError = error.fields[field.name] ?? error.fields[field.name.replace(/_ids?$/, '')];
        if (field.type === 'select' || field.type === 'multiselect') {
          return <OptionsField key={field.name} field={field} value={form[field.name]} onChange={(v) => set(field.name, v)} error={fieldError} />;
        }
        if (field.type === 'checkbox') {
          return <Checkbox key={field.name} label={field.label} checked={Boolean(form[field.name])} onChange={(e) => set(field.name, e.target.checked)} />;
        }
        return (
          <Field
            key={field.name}
            as={field.type === 'textarea' ? 'textarea' : 'input'}
            type={field.type === 'textarea' ? undefined : (field.inputType ?? 'text')}
            label={field.label}
            value={form[field.name] ?? ''}
            maxLength={field.maxLength}
            onChange={(e) => set(field.name, e.target.value)}
            error={fieldError}
          />
        );
      })}
      <PixelButton type="submit" disabled={submitting}>
        {submitting ? 'GUARDANDO...' : 'GUARDAR'}
      </PixelButton>
      <PixelButton type="button" variant="amber" onClick={onCancel}>
        CANCELAR
      </PixelButton>
    </form>
  );
}

export default function ResourceManager({ config }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // editing: null (closed) | { id?: number, initial } (open)
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState({ message: '', fields: {} });

  const params = { page, page_size: PAGE_SIZE, ordering: config.ordering };
  if (config.searchParam && search) params[config.searchParam] = search;
  const query = useList(config.resource, params);
  const { create, update, remove } = useResourceMutations(config.resource);
  const items = results(query.data);

  const close = () => {
    setEditing(null);
    setError({ message: '', fields: {} });
  };

  const handleSave = (payload) => {
    setError({ message: '', fields: {} });
    const options = { onSuccess: close, onError: (err) => setError(parseApiError(err)) };
    if (editing.id) update.mutate({ id: editing.id, ...payload }, options);
    else create.mutate(payload, options);
  };

  const handleDelete = (item) => {
    const name = item.title || item.name || item.email || `#${item.id}`;
    if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    setError({ message: '', fields: {} });
    remove.mutate(item.id, { onError: (err) => setError(parseApiError(err)) });
  };

  return (
    <>
      <div className={styles.toolbar}>
        {config.searchParam ? (
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(text.trim());
            }}
          >
            <Field label="Buscar" value={text} onChange={(e) => setText(e.target.value)} maxLength={100} />
            <PixelButton type="submit">BUSCAR</PixelButton>
          </form>
        ) : (
          <span />
        )}
        {config.canCreate && (
          <PixelButton variant="amber" onClick={() => setEditing({ initial: config.empty() })}>
            + NUEVO
          </PixelButton>
        )}
      </div>

      {editing && (
        <div className={styles.formWrap}>
          <Panel title={editing.id ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'} tone="amber">
            <EditForm
              key={editing.id ?? 'new'}
              config={config}
              initial={editing.initial}
              onSubmit={handleSave}
              onCancel={close}
              submitting={create.isPending || update.isPending}
              error={error}
            />
          </Panel>
        </div>
      )}

      {!editing && <ErrorMessage message={error.message} />}

      <QueryState query={query} isEmpty={items.length === 0}>
        <table className={loanStyles.table}>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {config.columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(item) : item[column.key]}</td>
                ))}
                <td>
                  <div className={styles.rowActions}>
                    {config.canEdit && (
                      <PixelButton size="small" variant="blue" onClick={() => setEditing({ id: item.id, initial: config.toForm(item) })}>
                        EDITAR
                      </PixelButton>
                    )}
                    {config.canDelete && (
                      <PixelButton size="small" variant="red" disabled={remove.isPending} onClick={() => handleDelete(item)}>
                        BORRAR
                      </PixelButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} count={query.data?.count} pageSize={PAGE_SIZE} onChange={setPage} />
      </QueryState>
    </>
  );
}
