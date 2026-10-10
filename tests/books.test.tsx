import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { ChapterAudio } from '../src/books/BookReader';
import { server, API_URL } from './server';

const id = '9146a916-a99e-4917-89a3-207f20c1b47e';
const home = `/books/${id}`;
const chapter = {
  id: 'recording-5',
  number: 1,
  sourceLanguage: 'hi',
  hasEnglishTranslation: true,
  summary: 'Memories of home.',
  originalSummary: 'घर की यादें।',
  hasAudio: true,
  hasRefinedStory: true,
};
beforeEach(() => {
  window.history.replaceState({}, '', home);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  server.use(
    http.get(`${API_URL}/books/${id}`, () =>
      HttpResponse.json({ id, title: 'Daddy’s Story', chapters: [chapter] }),
    ),
  );
});
afterEach(() => window.history.replaceState({}, '', '/'));

describe('book reader', () => {
  it('renders summaries and direct reading links without fetching audio upfront', async () => {
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Daddy’s Story' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Memories of home.').closest('details'),
    ).not.toHaveAttribute('open');
    expect(screen.getByText('घर की यादें।').closest('details')).toHaveAttribute(
      'open',
    );
    await userEvent.click(screen.getByText('English summary'));
    expect(
      screen.getByText('Memories of home.').closest('details'),
    ).toHaveAttribute('open');
    expect(screen.getByText('घर की यादें।').closest('details')).toHaveAttribute(
      'open',
    );
    expect(
      screen.getByRole('link', { name: 'Refined story (Hindi)' }),
    ).toHaveAttribute('href', `${home}/chapters/recording-5/original`);
    expect(
      screen.getByRole('link', { name: 'English translation' }),
    ).toHaveAttribute('href', `${home}/chapters/recording-5/english`);
    expect(document.querySelector('audio')).not.toHaveAttribute('src');
  });
  it.each(['original', 'english'])(
    'opens a direct %s page with language and return links',
    async (version) => {
      window.history.replaceState(
        {},
        '',
        `${home}/chapters/recording-5/${version}`,
      );
      server.use(
        http.get(`${API_URL}/books/${id}/chapters/recording-5`, () =>
          HttpResponse.json({
            ...chapter,
            bookId: id,
            bookTitle: 'Daddy’s Story',
            version,
            language: version === 'english' ? 'en' : 'hi',
            text: 'मेरी कहानी।\n\nAnother paragraph.',
            images: [],
          }),
        ),
      );
      render(<App />);
      const text = await screen.findByText('मेरी कहानी।');
      expect(text.parentElement).toHaveAttribute(
        'lang',
        version === 'english' ? 'en' : 'hi',
      );
      expect(
        screen.getAllByRole('link', { name: '← Back to book' })[0],
      ).toHaveAttribute('href', `${home}#recording-5`);
      expect(
        screen.getByRole('link', {
          name:
            version === 'english'
              ? 'English translation'
              : 'Refined story (Hindi)',
        }),
      ).toHaveAttribute('aria-current', 'page');
    },
  );
  it('shows missing items as disabled labels without links or expandable summaries', async () => {
    server.use(
      http.get(`${API_URL}/books/${id}`, () =>
        HttpResponse.json({
          id,
          title: 'Partial book',
          chapters: [
            {
              ...chapter,
              summary: null,
              originalSummary: null,
              hasAudio: false,
              hasRefinedStory: false,
              hasEnglishTranslation: false,
            },
          ],
        }),
      ),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Partial book' });
    for (const label of [
      'English summary — Unavailable',
      'Original-language summary (Hindi) — Unavailable',
      'Refined story (Hindi) — Unavailable',
      'English translation — Unavailable',
      '▶ Listen to original recording — Unavailable',
    ]) {
      expect(screen.getByText(label)).toHaveAttribute('aria-disabled', 'true');
    }
    expect(document.querySelectorAll('details, audio, a')).toHaveLength(0);
  });
  it('recovers from an API error using retry', async () => {
    let requests = 0;
    server.use(
      http.get(`${API_URL}/books/${id}`, () =>
        ++requests === 1
          ? HttpResponse.json(
              { error: { message: 'Temporarily unavailable' } },
              { status: 503 },
            )
          : HttpResponse.json({ id, title: 'Recovered book', chapters: [] }),
      ),
    );
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Temporarily unavailable',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Recovered book' }),
    ).toBeInTheDocument();
  });
  it('restores the selected chapter on a return link', async () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    window.history.replaceState({}, '', `${home}#recording-5`);
    render(<App />);
    await screen.findByText('Memories of home.');
    expect(scroll).toHaveBeenCalled();
  });
  it('refreshes failed audio once and restores position, then offers explicit retry', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/books/${id}/chapters/recording-5/audio`, () =>
        HttpResponse.json({
          url: `https://media.test/${++calls}`,
          expiresAt: '2099-01-01T00:00:00Z',
        }),
      ),
    );
    render(
      <ChapterAudio
        bookId={id}
        chapterId="recording-5"
        number={1}
        activeAudioRef={createRef()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Listen/ }));
    const audio = document.querySelector('audio')!;
    await waitFor(() => expect(audio.src).toBe('https://media.test/1'));
    audio.currentTime = 42;
    fireEvent.error(audio);
    await waitFor(() => expect(audio.src).toBe('https://media.test/2'));
    fireEvent.loadedMetadata(audio);
    expect(audio.currentTime).toBe(42);
    fireEvent.error(audio);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Audio is unavailable',
    );
    expect(calls).toBe(2);
  });
  it('pauses the previous player when another recording starts', async () => {
    const active = createRef<HTMLAudioElement>();
    server.use(
      http.get(`${API_URL}/books/${id}/chapters/:chapter/audio`, () =>
        HttpResponse.json({
          url: 'https://media.test/audio',
          expiresAt: '2099-01-01T00:00:00Z',
        }),
      ),
    );
    render(
      <>
        <ChapterAudio
          bookId={id}
          chapterId="a"
          number={1}
          activeAudioRef={active}
        />
        <ChapterAudio
          bookId={id}
          chapterId="b"
          number={2}
          activeAudioRef={active}
        />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /chapter 1/ }));
    await waitFor(() =>
      expect(document.querySelectorAll('audio')[0]).toHaveAttribute('src'),
    );
    const first = document.querySelectorAll('audio')[0]!;
    const pause = vi.spyOn(first, 'pause');
    pause.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /chapter 2/ }));
    expect(pause).toHaveBeenCalled();
    expect(active.current).toBe(document.querySelectorAll('audio')[1]);
  });
  it('refreshes an expired URL on play', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/books/${id}/chapters/recording-5/audio`, () =>
        HttpResponse.json({
          url: `https://media.test/${++calls}`,
          expiresAt:
            calls === 1 ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
        }),
      ),
    );
    render(
      <ChapterAudio
        bookId={id}
        chapterId="recording-5"
        number={1}
        activeAudioRef={createRef()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Listen/ }));
    const audio = document.querySelector('audio')!;
    await waitFor(() => expect(audio.src).toBe('https://media.test/1'));
    fireEvent.play(audio);
    await waitFor(() => expect(audio.src).toBe('https://media.test/2'));
  });
});
