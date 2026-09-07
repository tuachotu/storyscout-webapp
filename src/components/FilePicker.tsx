import { useId } from 'react';

import styles from './FilePicker.module.css';

interface FilePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}

export function FilePicker({
  file,
  onChange,
  label = 'Choose an audio file',
}: FilePickerProps) {
  const id = useId();
  return (
    <div className={styles.wrapper}>
      <input
        id={id}
        className={styles.input}
        type="file"
        accept=".m4a,.mp3,.wav,.webm,audio/mp4,audio/mpeg,audio/wav,audio/x-wav,audio/webm"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <label className={styles.label} htmlFor={id}>
        <span>{label}</span>
        <strong>{file?.name ?? 'MP3, M4A, WAV or WebM'}</strong>
      </label>
    </div>
  );
}
