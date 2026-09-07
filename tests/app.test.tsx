import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import { api } from '../src/api/client';
import { API_URL, server } from './server';

async function submitAccessCode() {
  await userEvent.type(
    screen.getByLabelText('Access code'),
    '11111111-1111-4111-8111-111111111111',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('minimal recording frontend', () => {
  it('gates recording behind an access code and greets the participant', async () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Enter your access code' }),
    ).toBeInTheDocument();
    await submitAccessCode();
    await screen.findByRole('heading', { name: 'Record your story' });
    expect(screen.getByText('Hi Puran.')).toBeInTheDocument();
    expect(screen.queryByText(/Transcribe/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Choose an audio file/i),
    ).not.toBeInTheDocument();
  });

  it('shows invalid access errors', async () => {
    server.use(
      http.post(`${API_URL}/access-sessions`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'ACCESS_DENIED',
              message: 'The access code is not valid.',
              requestId: 'request_test',
            },
          },
          { status: 401 },
        ),
      ),
    );
    render(<App />);
    await submitAccessCode();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The access code is not valid.',
    );
  });

  it('handles microphone denial', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: class {},
    });
    render(<App />);
    await submitAccessCode();
    await screen.findByRole('heading', { name: 'Record your story' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Start recording' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Microphone permission was denied.',
    );
  });

  it('records, previews, uploads directly, and confirms', async () => {
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
      },
    });
    class RecorderMock extends EventTarget {
      state: RecordingState = 'inactive';
      mimeType = 'audio/webm;codecs=opus';
      start() {
        this.state = 'recording';
      }
      pause() {
        this.state = 'paused';
      }
      resume() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.dispatchEvent(
          new MessageEvent('dataavailable', {
            data: new Blob(['voice'], { type: this.mimeType }),
          }),
        );
        this.dispatchEvent(new Event('stop'));
      }
    }
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: RecorderMock,
    });
    vi.spyOn(api, 'uploadDirect').mockImplementation(
      async (_url, _headers, _file, progress) => {
        progress(100);
      },
    );
    const createRecording = vi.spyOn(api, 'createRecording');
    render(<App />);
    await submitAccessCode();
    await screen.findByRole('heading', { name: 'Record your story' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Start recording' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(
      await screen.findByRole('button', { name: 'Upload' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(
      await screen.findByRole('heading', { name: 'Recording saved' }),
    ).toBeInTheDocument();
    expect(screen.getByText('recording_test123')).toBeInTheDocument();
    expect(api.uploadDirect).toHaveBeenCalledOnce();
    expect(createRecording).toHaveBeenCalledWith(
      'test-token',
      expect.objectContaining({ type: 'audio/webm' }),
    );
    expect(track.stop).toHaveBeenCalled();
  });
});
