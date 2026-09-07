import { useEffect, useRef, useState } from 'react';

import { api } from '../api/client';
import type { AccessSession, Recording } from '../api/types';
import { errorMessage, formatDuration } from '../utils';
import styles from './RecordPage.module.css';

type CaptureState = 'idle' | 'recording' | 'paused';

export function RecordPage({ session }: { session: AccessSession }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Recording | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    if (captureState !== 'recording') return;
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [captureState]);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  function setRecordingFile(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewRef.current);
    setFile(next);
    setSaved(null);
    setError(null);
    setProgress(null);
  }

  async function start() {
    setError(null);
    setSaved(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setElapsed(0);
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const type = baseAudioContentType(recorder.mimeType || 'audio/webm');
        const extension = type.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        setRecordingFile(
          new File([blob], `story-${Date.now()}.${extension}`, { type }),
        );
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setCaptureState('idle');
      });
      recorder.start();
      setCaptureState('recording');
    } catch (caught) {
      setError(
        caught instanceof DOMException && caught.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : errorMessage(caught),
      );
    }
  }

  function pauseOrResume() {
    const recorder = recorderRef.current;
    if (captureState === 'recording' && recorder?.state === 'recording') {
      recorder.pause();
      setCaptureState('paused');
    } else if (captureState === 'paused' && recorder?.state === 'paused') {
      recorder.resume();
      setCaptureState('recording');
    }
  }

  async function upload() {
    if (!file) return;
    setProgress(0);
    setError(null);
    try {
      const created = await api.createRecording(session.accessToken, file);
      await api.uploadDirect(
        created.upload.url,
        created.upload.headers,
        file,
        setProgress,
      );
      setSaved(
        await api.completeRecording(
          created.recording.recordingId,
          session.accessToken,
        ),
      );
      setProgress(100);
    } catch (caught) {
      setError(errorMessage(caught));
      setProgress(null);
    }
  }

  if (saved)
    return (
      <section className={styles.page}>
        <p className={styles.step}>Complete</p>
        <h1>Recording saved</h1>
        <p>
          Your recording ID is <strong>{saved.recordingId}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            setRecordingFile(null);
            setSaved(null);
            setElapsed(0);
          }}
        >
          Record another
        </button>
      </section>
    );

  return (
    <section className={styles.page}>
      <p className={styles.step}>Step 2 of 2</p>
      <h1>Record your story</h1>
      <p>Hi {session.displayName}.</p>
      <div className={styles.timer}>{formatDuration(elapsed)}</div>
      {captureState === 'idle' && !file && (
        <button type="button" onClick={start}>
          Start recording
        </button>
      )}
      {captureState !== 'idle' && (
        <div className={styles.actions}>
          <button
            className={styles.secondary}
            type="button"
            onClick={pauseOrResume}
          >
            {captureState === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button type="button" onClick={() => recorderRef.current?.stop()}>
            Stop
          </button>
        </div>
      )}
      {file && (
        <div className={styles.preview}>
          {previewUrl && <audio controls src={previewUrl} />}
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              type="button"
              disabled={progress !== null}
              onClick={() => {
                setRecordingFile(null);
                setElapsed(0);
              }}
            >
              Record again
            </button>
            <button type="button" disabled={progress !== null} onClick={upload}>
              Upload
            </button>
          </div>
        </div>
      )}
      {progress !== null && <p aria-live="polite">Uploading… {progress}%</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function baseAudioContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() || 'audio/webm';
}
