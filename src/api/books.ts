import { api, ApiError } from './client';

export interface BookChapter {
  id: string;
  number: number;
  sourceLanguage: string;
  summary: string | null;
  originalSummary: string | null;
  hasAudio: boolean;
  hasRefinedStory: boolean;
  hasEnglishTranslation: boolean;
}
export interface Book {
  id: string;
  title: string;
  chapters: BookChapter[];
}
export interface Chapter extends Omit<
  BookChapter,
  'summary' | 'originalSummary' | 'hasAudio'
> {
  bookId: string;
  bookTitle: string;
  language: string;
  version: 'original' | 'english';
  text: string;
  images: Array<{
    url: string;
    expiresAt: string;
    alt: string;
    caption?: string;
  }>;
}
export interface MediaLink {
  url: string;
  expiresAt: string;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${api.baseUrl}/books/${path}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error?.message ?? 'Unable to load this book. Please try again.',
      response.status,
      body?.error?.code ?? 'BOOK_REQUEST_FAILED',
    );
  }
  return response.json() as Promise<T>;
}
export const books = {
  get: (id: string, signal?: AbortSignal) =>
    get<Book>(encodeURIComponent(id), signal),
  chapter: (
    id: string,
    chapter: string,
    version: string,
    signal?: AbortSignal,
  ) =>
    get<Chapter>(
      `${encodeURIComponent(id)}/chapters/${encodeURIComponent(chapter)}?version=${encodeURIComponent(version)}`,
      signal,
    ),
  audio: (id: string, chapter: string, signal?: AbortSignal) =>
    get<MediaLink>(
      `${encodeURIComponent(id)}/chapters/${encodeURIComponent(chapter)}/audio`,
      signal,
    ),
};
