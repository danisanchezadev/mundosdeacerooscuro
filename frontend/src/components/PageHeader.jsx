import styles from './PageHeader.module.css';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </header>
  );
}
