import { useEffect, useRef, useState } from 'react';

import { api } from '../api/client';
import type { Transcript, TranscriptionJob } from '../api/types';
import { FilePicker } from '../components/FilePicker';
import { errorMessage, isAbortError } from '../utils';
import styles from './TranscribePage.module.css';

const RECORDING_ID_PATTERN = /^recording_[A-Za-z0-9_-]+$/;
const POLL_INTERVAL_MS = 1200;

export function TranscribePage() {
  const [mode, setMode] = useState<'file' | 'recording'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [recordingId, setRecordingId] = useState('');
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollingRef = useRef<AbortController | null>(null);

  useEffect(() => () => pollingRef.current?.abort(), []);

  async function waitForJob(initial: TranscriptionJob) {
    pollingRef.current?.abort();
    const controller = new AbortController();
    pollingRef.current = controller;
    let current = initial;
    try {
      while (current.state === 'queued' || current.state === 'processing') {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, POLL_INTERVAL_MS),
        );
        current = await api.getTranscription(
          current.transcriptionId,
          controller.signal,
        );
        setJob(current);
      }
      if (current.state === 'completed') {
        setTranscript(
          await api.getTranscript(current.transcriptionId, controller.signal),
        );
      }
    } catch (caught) {
      if (!isAbortError(caught)) setError(errorMessage(caught));
    } finally {
      if (pollingRef.current === controller) pollingRef.current = null;
      setBusy(false);
    }
  }

  async function start() {
    setError(null);
    setTranscript(null);
    if (mode === 'file' && !file) {
      setError('Choose an audio file first.');
      return;
    }
    if (
      mode === 'recording' &&
      !RECORDING_ID_PATTERN.test(recordingId.trim())
    ) {
      setError('Enter a valid recording ID beginning with recording_.');
      return;
    }
    setBusy(true);
    try {
      const created =
        mode === 'file'
          ? await api.createTranscriptionFromFile(file as File)
          : await api.createTranscriptionFromRecording(recordingId.trim());
      setJob(created);
      void waitForJob(created);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  async function retry() {
    if (!job) return;
    setBusy(true);
    setError(null);
    setTranscript(null);
    try {
      const retried = await api.retryTranscription(job.transcriptionId);
      setJob(retried);
      void waitForJob(retried);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  function downloadTranscript() {
    if (!transcript) return;
    const blob = new Blob([transcript.text], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${transcript.recordingId}_transcription.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className="eyebrow">Transcribe</p>
        <h1>Turn a recording into text.</h1>
        <p>
          Choose a local file, or use the ID of an audio recording already
          stored in StoryScout.
        </p>
      </header>

      <section className={`${styles.panel} card`}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Transcription source"
        >
          <button
            className={mode === 'file' ? styles.activeTab : ''}
            role="tab"
            aria-selected={mode === 'file'}
            onClick={() => setMode('file')}
          >
            Local file
          </button>
          <button
            className={mode === 'recording' ? styles.activeTab : ''}
            role="tab"
            aria-selected={mode === 'recording'}
            onClick={() => setMode('recording')}
          >
            Recording ID
          </button>
        </div>

        {mode === 'file' ? (
          <FilePicker
            file={file}
            onChange={setFile}
            label="Choose a file to transcribe"
          />
        ) : (
          <label className={styles.field}>
            <span>Recording ID</span>
            <input
              value={recordingId}
              onChange={(event) => setRecordingId(event.target.value)}
              placeholder="recording_…"
              autoComplete="off"
            />
          </label>
        )}

        <button
          className="button primary"
          type="button"
          disabled={busy}
          onClick={start}
        >
          {busy ? 'Transcribing…' : 'Start transcription'}
        </button>
      </section>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {job && (
        <section className={`${styles.job} card`} aria-live="polite">
          <div className={styles.jobHeader}>
            <div>
              <p className="eyebrow">Job status</p>
              <h2>{job.state}</h2>
            </div>
            <span className={styles.state} data-state={job.state}>
              {job.state}
            </span>
          </div>
          <dl className={styles.meta}>
            <div>
              <dt>Transcription ID</dt>
              <dd>{job.transcriptionId}</dd>
            </div>
            <div>
              <dt>Recording ID</dt>
              <dd>{job.recordingId}</dd>
            </div>
            <div>
              <dt>Attempt</dt>
              <dd>{job.attempt}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{job.modelId}</dd>
            </div>
          </dl>
          {(job.state === 'queued' || job.state === 'processing') && (
            <div className={styles.progress}>
              <span />
            </div>
          )}
          {job.state === 'failed' && (
            <div className={styles.failure}>
              <p>{job.error?.message ?? 'Transcription failed.'}</p>
              <button
                className="button secondary"
                type="button"
                onClick={retry}
                disabled={busy}
              >
                Retry transcription
              </button>
            </div>
          )}
        </section>
      )}

      {transcript && (
        <section className={`${styles.transcript} card`}>
          <header>
            <div>
              <p className="eyebrow">Original transcript</p>
              <h2>Transcript</h2>
              {transcript.detectedLanguages.length > 0 && (
                <p>Detected: {transcript.detectedLanguages.join(', ')}</p>
              )}
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={downloadTranscript}
            >
              Download text
            </button>
          </header>
          <pre>{transcript.text}</pre>
        </section>
      )}
    </main>
  );
}
