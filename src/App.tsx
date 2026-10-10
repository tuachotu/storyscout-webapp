import { useState, type FormEvent } from 'react';

import { BookReader } from './books/BookReader';
import { api } from './api/client';
import type { AccessSession } from './api/types';
import { RecordPage } from './pages/RecordPage';
import { errorMessage } from './utils';
import styles from './App.module.css';

export function App() {
  return window.location.pathname.startsWith('/books/') ? (
    <BookReader />
  ) : (
    <RecordingApp />
  );
}

function RecordingApp() {
  const [session, setSession] = useState<AccessSession | null>(null);
  const [guid, setGuid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithGuid(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSession(await api.createAccessSession(guid.trim()));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <p className={styles.brand}>StoryScout</p>
        {session ? (
          <RecordPage session={session} />
        ) : (
          <section className={styles.access}>
            <p className={styles.step}>Step 1 of 2</p>
            <h1>Enter your access code</h1>
            <form onSubmit={continueWithGuid}>
              <label htmlFor="guid">Access code</label>
              <input
                id="guid"
                value={guid}
                onChange={(event) => setGuid(event.target.value)}
                autoComplete="off"
                required
                placeholder="00000000-0000-0000-0000-000000000000"
              />
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy}>
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
