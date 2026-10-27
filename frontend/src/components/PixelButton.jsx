import { Link } from 'react-router-dom';
import styles from './PixelButton.module.css';

/** Pixel-art button. Renders a router Link when `to` is provided. */
export default function PixelButton({ variant = 'green', size = 'normal', to, className = '', children, ...props }) {
  const classes = [styles.btn, variant !== 'green' && styles[variant], size === 'small' && styles.small, className]
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
