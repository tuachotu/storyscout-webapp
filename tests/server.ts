import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API_URL = 'http://localhost:3001/api/v1';
export const session = {
  accessToken: 'test-token',
  displayName: 'Puran',
  expiresAt: '2026-08-22T20:00:00.000Z',
};
export const recording = {
  recordingId: 'recording_test123',
  participantName: 'Puran',
  createdAt: '2026-08-22T19:00:00.000Z',
  completedAt: '2026-08-22T19:01:00.000Z',
  storageState: 'ready',
  originalFilename: 'story.webm',
  contentType: 'audio/webm',
  sizeBytes: 5,
};
export const handlers = [
  http.post(`${API_URL}/access-sessions`, () =>
    HttpResponse.json(session, { status: 201 }),
  ),
  http.post(`${API_URL}/recordings`, () =>
    HttpResponse.json(
      {
        recording: {
          ...recording,
          completedAt: null,
          storageState: 'awaitingUpload',
          sizeBytes: null,
        },
        upload: {
          url: 'https://upload.test/object',
          method: 'PUT',
          headers: { 'Content-Type': 'audio/webm' },
          expiresAt: session.expiresAt,
        },
      },
      { status: 201 },
    ),
  ),
  http.post(`${API_URL}/recordings/:recordingId/complete`, () =>
    HttpResponse.json(recording),
  ),
];
export const server = setupServer(...handlers);
