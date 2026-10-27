import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import PixelButton from '../components/PixelButton';
import ResourceManager from '../features/admin/ResourceManager';
import { ADMIN_RESOURCES } from '../features/admin/config';
import styles from '../features/admin/Admin.module.css';

export default function AdminPage() {
  const [tab, setTab] = useState('books');
  const config = ADMIN_RESOURCES[tab];

  return (
    <>
      <PageHeader title="PANEL DE ADMINISTRACIÓN" subtitle="Gestión de catálogo, moderación y usuarios." />
      <div className={styles.tabs} role="tablist" aria-label="Recursos">
        {Object.entries(ADMIN_RESOURCES).map(([key, item]) => (
          <PixelButton
            key={key}
            size="small"
            role="tab"
            aria-selected={key === tab}
            variant={key === tab ? 'amber' : 'green'}
            onClick={() => setTab(key)}
          >
            {item.label}
          </PixelButton>
        ))}
      </div>
      <ResourceManager key={tab} config={config} />
    </>
  );
}
