import { useEffect, useState } from 'react';

import { api } from '../api/client';
import styles from './BackendStatus.module.css';

type Status = 'checking' | 'online' | 'offline';

export function BackendStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then(() => setStatus('online'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setStatus('offline');
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <div className={styles.status} data-status={status} role="status">
      <span className={styles.dot} aria-hidden="true" />
      Backend {status}
    </div>
  );
}
