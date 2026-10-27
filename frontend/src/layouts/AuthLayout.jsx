import Panel from '../components/Panel';
import styles from './AuthLayout.module.css';

/** Centered card used by login / register / password-reset pages. */
export default function AuthLayout({ title, children, footer }) {
  return (
    <div className={styles.wrap}>
      <Panel title={title} tone="amber">
        {children}
      </Panel>
      {footer && <div className={styles.alt}>{footer}</div>}
    </div>
  );
}

export const AuthDivider = () => <div className={styles.divider}>— o —</div>;
