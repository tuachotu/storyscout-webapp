export type AudioContentType =
  'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/x-wav' | 'audio/webm';

export interface Recording {
  recordingId: string;
  participantName: string;
  createdAt: string;
  completedAt: string | null;
  storageState: 'awaitingUpload' | 'ready';
  originalFilename: string;
  contentType: AudioContentType;
  sizeBytes: number | null;
}

export interface AccessSession {
  accessToken: string;
  displayName: string;
  expiresAt: string;
}
export interface RecordingUpload {
  recording: Recording;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresAt: string;
  };
}

export type TranscriptionState =
  'queued' | 'processing' | 'completed' | 'failed';

export interface TranscriptionFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface TranscriptionJob {
  transcriptionId: string;
  recordingId: string;
  state: TranscriptionState;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  modelId: string;
  detectedLanguages: string[];
  statusUrl: string;
  transcriptUrl: string | null;
  error?: TranscriptionFailure | null;
}

export interface Transcript {
  transcriptionId: string;
  recordingId: string;
  text: string;
  detectedLanguages: string[];
  version: number;
  modelId: string;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
