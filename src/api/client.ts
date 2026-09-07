import type {
  ApiErrorBody,
  AccessSession,
  Recording,
  RecordingUpload,
  Transcript,
  TranscriptionJob,
} from './types';

const DEFAULT_API_URL = 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // The server may return an empty or non-JSON error response.
  }

  return new ApiError(
    body?.error.message ?? `Request failed with status ${response.status}.`,
    response.status,
    body?.error.code ?? 'REQUEST_FAILED',
    body?.error.requestId,
  );
}

export class StoryScoutApi {
  readonly baseUrl: string;

  constructor(
    baseUrl = import.meta.env.VITE_STORYSCOUT_API_URL || DEFAULT_API_URL,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) throw await parseError(response);
    return (await response.json()) as T;
  }

  createAccessSession(
    guid: string,
    signal?: AbortSignal,
  ): Promise<AccessSession> {
    return this.request('/access-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guid }),
      signal,
    });
  }

  health(signal?: AbortSignal): Promise<{ status: 'ok' }> {
    return this.request('/health', { signal });
  }

  createRecording(
    token: string,
    file: File,
    signal?: AbortSignal,
  ): Promise<RecordingUpload> {
    return this.request('/recordings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        originalFilename: file.name,
        contentType: file.type.split(';', 1)[0]?.trim().toLowerCase(),
        sizeBytes: file.size,
      }),
      signal,
    });
  }

  getRecording(
    recordingId: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<Recording> {
    return this.request(`/recordings/${encodeURIComponent(recordingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  }

  completeRecording(
    recordingId: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<Recording> {
    return this.request(
      `/recordings/${encodeURIComponent(recordingId)}/complete`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal,
      },
    );
  }

  uploadDirect(
    url: string,
    headers: Record<string, string>,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url);
      Object.entries(headers).forEach(([name, value]) =>
        request.setRequestHeader(name, value),
      );
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable)
          onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () =>
        request.status >= 200 && request.status < 300
          ? resolve()
          : reject(new Error('The recording upload failed.')),
      );
      request.addEventListener('error', () =>
        reject(new Error('The recording upload failed.')),
      );
      request.send(file);
    });
  }

  createTranscriptionFromRecording(
    recordingId: string,
    signal?: AbortSignal,
  ): Promise<TranscriptionJob> {
    return this.request('/transcriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId }),
      signal,
    });
  }

  createTranscriptionFromFile(
    file: File,
    signal?: AbortSignal,
  ): Promise<TranscriptionJob> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.request('/transcriptions', { method: 'POST', body, signal });
  }

  getTranscription(
    transcriptionId: string,
    signal?: AbortSignal,
  ): Promise<TranscriptionJob> {
    return this.request(
      `/transcriptions/${encodeURIComponent(transcriptionId)}`,
      { signal },
    );
  }

  getTranscript(
    transcriptionId: string,
    signal?: AbortSignal,
  ): Promise<Transcript> {
    return this.request(
      `/transcriptions/${encodeURIComponent(transcriptionId)}/transcript?format=json`,
      { signal },
    );
  }

  retryTranscription(
    transcriptionId: string,
    signal?: AbortSignal,
  ): Promise<TranscriptionJob> {
    return this.request(
      `/transcriptions/${encodeURIComponent(transcriptionId)}/retry`,
      { method: 'POST', signal },
    );
  }
}

export const api = new StoryScoutApi();
