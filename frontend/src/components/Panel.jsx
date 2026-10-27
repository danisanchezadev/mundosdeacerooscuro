import styles from './Panel.module.css';

export default function Panel({ title, tone = 'green', as: Tag = 'section', className = '', children, ...props }) {
  const classes = [styles.panel, tone !== 'green' && styles[tone], className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...props}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </Tag>
  );
}
