import { useEffect, useRef, useState } from 'react';
import { books, type Book, type Chapter, type MediaLink } from '../api/books';
import { errorMessage } from '../utils';
import styles from './BookReader.module.css';

function languageName(code: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function BookReader() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const bookId = parts[1] ?? '';
  const chapterId = parts[3];
  const version = parts[4];
  const valid =
    parts.length === 2 ||
    (parts.length === 5 &&
      parts[2] === 'chapters' &&
      ['original', 'english'].includes(version));
  const [data, setData] = useState<Book | Chapter | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const home = `/books/${encodeURIComponent(bookId)}`;

  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const request = chapterId
      ? books.chapter(bookId, chapterId, version, controller.signal)
      : books.get(bookId, controller.signal);
    request
      .then((result) => {
        setData(result);
        document.title = `${'bookTitle' in result ? result.bookTitle + ' · Chapter ' + result.number : result.title} — StoryScout`;
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      });
    return () => controller.abort();
  }, [bookId, chapterId, version, valid, attempt]);

  useEffect(() => {
    if (!data || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView?.({ block: 'start' });
  }, [data]);

  function retry() {
    setError('');
    setData(null);
    setAttempt((value) => value + 1);
  }
  const chapter = data && 'text' in data ? data : null;
  const book = data && 'chapters' in data ? data : null;
  return (
    <main className={styles.reader}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>STORYSCOUT</span>
        <span className={styles.topLabel}>A life, in their own words</span>
      </header>
      {!valid || error ? (
        <section className={styles.message} role="alert">
          <h1>Unable to open this page</h1>
          <p>{error || 'This book link is not valid.'}</p>
          {valid && <button onClick={retry}>Try again</button>}
          {chapterId && (
            <p>
              <a href={home}>← Back to book</a>
            </p>
          )}
        </section>
      ) : !data ? (
        <p className={styles.message} role="status">
          Opening the book…
        </p>
      ) : null}
      {book && !error && (
        <div className={styles.book}>
          <section className={styles.intro}>
            <p className={styles.eyebrow}>
              THE BOOK · {book.chapters.length} CHAPTERS
            </p>
            <h1>{book.title}</h1>
            <p className={styles.subtitle}>
              Read the stories. Hear the voice behind them.
            </p>
            <div className={styles.rule} />
          </section>
          <div className={styles.contents}>
            <span>CONTENTS</span>
            <span>Read & listen</span>
          </div>
          {book.chapters.map((item) => (
            <section className={styles.chapter} key={item.id} id={item.id}>
              <div className={styles.chapterNumber} aria-hidden="true">
                {String(item.number).padStart(2, '0')}
              </div>
              <div className={styles.chapterBody}>
                <h2>Chapter {item.number}</h2>
                <Summary
                  label={`Original-language summary (${languageName(item.sourceLanguage)})`}
                  initiallyOpen
                  text={item.originalSummary}
                  language={item.sourceLanguage}
                />
                <Summary
                  label="English summary"
                  text={item.summary}
                  language="en"
                />
                {item.hasAudio ? (
                  <ChapterAudio
                    bookId={book.id}
                    chapterId={item.id}
                    number={item.number}
                    activeAudioRef={activeAudioRef}
                  />
                ) : (
                  <p className={styles.unavailable} aria-disabled="true">
                    ▶ Listen to original recording — Unavailable
                  </p>
                )}
                <nav
                  className={styles.readLinks}
                  aria-label={`Read chapter ${item.number}`}
                >
                  <ReadingLink
                    href={`${home}/chapters/${item.id}/original`}
                    available={item.hasRefinedStory}
                  >
                    Refined story ({languageName(item.sourceLanguage)})
                  </ReadingLink>
                  {item.sourceLanguage !== 'en' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <ReadingLink
                        href={`${home}/chapters/${item.id}/english`}
                        available={item.hasEnglishTranslation}
                      >
                        English translation
                      </ReadingLink>
                    </>
                  )}
                </nav>
              </div>
            </section>
          ))}
          <footer className={styles.footer}>End of {book.title}</footer>
        </div>
      )}
      {chapter && !error && (
        <article className={styles.reading}>
          <a className={styles.back} href={`${home}#${chapter.id}`}>
            ← Back to book
          </a>
          <p className={styles.eyebrow}>{chapter.bookTitle}</p>
          <h1>Chapter {chapter.number}</h1>
          <nav className={styles.languageSwitch} aria-label="Reading language">
            <ReadingLink
              href={`${home}/chapters/${chapter.id}/original`}
              available={chapter.hasRefinedStory}
              current={chapter.version === 'original'}
            >
              Refined story ({languageName(chapter.sourceLanguage)})
            </ReadingLink>
            {chapter.sourceLanguage !== 'en' && (
              <ReadingLink
                href={`${home}/chapters/${chapter.id}/english`}
                available={chapter.hasEnglishTranslation}
                current={chapter.version === 'english'}
              >
                English translation
              </ReadingLink>
            )}
          </nav>
          {chapter.images.map((image) => (
            <figure key={image.url}>
              <img src={image.url} alt={image.alt} />
              <figcaption>{image.caption}</figcaption>
            </figure>
          ))}
          <div className={styles.prose} lang={chapter.language} dir="auto">
            {chapter.text.split(/\r?\n\s*\r?\n/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <a className={styles.back} href={`${home}#${chapter.id}`}>
            ← Back to book
          </a>
        </article>
      )}
    </main>
  );
}

export function ChapterAudio({
  bookId,
  chapterId,
  number,
  activeAudioRef,
}: {
  bookId: string;
  chapterId: string;
  number: number;
  activeAudioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const link = useRef<MediaLink | null>(null);
  const request = useRef<AbortController | null>(null);
  const position = useRef(0);
  const recoveries = useRef(0);
  const mounted = useRef(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    const element = audio.current;
    return () => {
      mounted.current = false;
      request.current?.abort();
      element?.pause();
    };
  }, []);
  function claim() {
    if (activeAudioRef.current !== audio.current)
      activeAudioRef.current?.pause();
    activeAudioRef.current = audio.current;
  }
  async function load(resetRecovery = true) {
    const element = audio.current;
    if (!element) return;
    claim();
    if (resetRecovery) recoveries.current = 0;
    position.current = element.currentTime || 0;
    element.pause();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const next = await books.audio(bookId, chapterId, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      link.current = next;
      element.src = next.url;
      setLoaded(true);
      element.load();
    } catch (caught) {
      if (!controller.signal.aborted && mounted.current)
        setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted && mounted.current) setBusy(false);
    }
  }
  function onPlay() {
    claim();
    if (
      link.current &&
      Date.parse(link.current.expiresAt) <= Date.now() + 10000
    )
      void load();
  }
  function mediaError() {
    if (!link.current || activeAudioRef.current !== audio.current) return;
    if (recoveries.current < 1) {
      recoveries.current += 1;
      void load(false);
    } else setError('Audio is unavailable. Please try again.');
  }
  return (
    <div className={styles.audioBlock}>
      {(!loaded || error) && (
        <button
          className={styles.listen}
          onClick={() => void load()}
          disabled={busy}
          aria-label={`${error ? 'Retry' : 'Listen to'} original recording, chapter ${number}`}
        >
          <span aria-hidden="true">▶</span>{' '}
          {busy
            ? 'Loading recording…'
            : error
              ? 'Retry recording'
              : 'Listen to original recording'}
        </button>
      )}
      {busy && loaded && <span role="status">Refreshing recording…</span>}
      <audio
        ref={audio}
        controls={loaded}
        hidden={!loaded}
        preload="none"
        aria-label={`Original recording, chapter ${number}`}
        onPlay={onPlay}
        onError={mediaError}
        onLoadedMetadata={() => {
          const element = audio.current;
          if (!element) return;
          if (position.current > 0) element.currentTime = position.current;
          if (activeAudioRef.current === element)
            void element.play().catch(() => {
              /* Native controls remain available if autoplay is blocked. */
            });
        }}
      />
      {error && (
        <p role="alert" className={styles.audioError}>
          {error}
        </p>
      )}
    </div>
  );
}

function Summary({
  initiallyOpen = false,
  label,
  text,
  language,
}: {
  initiallyOpen?: boolean;
  label: string;
  text: string | null;
  language: string;
}) {
  return text ? (
    <details className={styles.summaryDetails} open={initiallyOpen}>
      <summary>{label}</summary>
      <p className={styles.summary} lang={language} dir="auto">
        {text}
      </p>
    </details>
  ) : (
    <p className={styles.unavailable} aria-disabled="true">
      {label} — Unavailable
    </p>
  );
}
function ReadingLink({
  href,
  available,
  current,
  children,
}: {
  href: string;
  available: boolean;
  current?: boolean;
  children: React.ReactNode;
}) {
  return available ? (
    <a href={href} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  ) : (
    <span className={styles.unavailable} aria-disabled="true">
      {children} — Unavailable
    </span>
  );
}
