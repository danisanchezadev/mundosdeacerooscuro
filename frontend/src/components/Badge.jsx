import styles from './Badge.module.css';

export default function Badge({ tone = 'green', children, ...props }) {
  return (
    <span className={`${styles.badge} ${tone !== 'green' ? styles[tone] : ''}`} {...props}>
      {children}
    </span>
  );
}
