/** A span of a run's video, as the worker stores it (runs.video_cues). */
export type VideoCueView = { step: number | null; from: number; to: number };

const HIDDEN = 'Ausgeblendet: Die Seite zeigte Zugangsdaten.';
/** A cue shorter than this would flash by unseen. */
const MIN_CUE_MS = 100;

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** 61005 → "00:01:01.005". */
export function vttTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor(total / 60_000) % 60;
  const seconds = Math.floor(total / 1_000) % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(total % 1_000, 3)}`;
}

/** One line of text: a title must not end a cue or the file. */
const oneLine = (text: string) =>
  text
    .replace(/-->/g, '→')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();

/**
 * The captions of a run's video: "Schritt 3 von 13 · Klicke auf „Anmelden“" while a step ran,
 * with the titles of the report, and when the picture was hidden.
 */
export function toWebVtt(cues: VideoCueView[], titles: string[]): string {
  const blocks = cues.map(({ step, from, to }) => {
    const text =
      step === null
        ? HIDDEN
        : `Schritt ${step + 1} von ${titles.length} · ${oneLine(titles[step] ?? '')}`.replace(
            / · $/,
            '',
          );
    return `${vttTime(from)} --> ${vttTime(Math.max(to, from + MIN_CUE_MS))}\n${text}\n`;
  });
  return ['WEBVTT', '', ...blocks].join('\n');
}
