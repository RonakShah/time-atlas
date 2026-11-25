export type Kind = "Person" | "Period" | "Event";
export type Tone = "green" | "purple" | "orange" | "blue";

export type Row = {
  id: string;
  name: string;
  tone: Tone;
  compact?: boolean;
  collapsed?: boolean;
};

export type Entry = {
  id: string;
  row: string;
  name: string;
  kind: Kind;
  start: number;
  end?: number;
  ongoing?: boolean;
  notes?: string;
  source?: string;
};

export type Board = { name: string; rows: Row[]; entries: Entry[] };

export const kinds: Kind[] = ["Person", "Period", "Event"];
export const tones: Tone[] = ["green", "purple", "orange", "blue"];
export const currentYear = new Date().getFullYear();
export const minimumYear = -999999;
export const maximumYear = 999999;
export const storageKey = "time-atlas-board-v1";

export const sample: Board = {
  name: "An age of invention",
  rows: [
    { id: "science", name: "Science & ideas", tone: "green" },
    { id: "arts", name: "Arts & culture", tone: "purple" },
    { id: "world", name: "World events", tone: "orange" },
  ],
  entries: [
    { id: "ada", row: "science", name: "Ada Lovelace", kind: "Person", start: 1815, end: 1852, notes: "Mathematician who wrote notes on Charles Babbage’s Analytical Engine.", source: "https://en.wikipedia.org/wiki/Ada_Lovelace" },
    { id: "darwin", row: "science", name: "Charles Darwin", kind: "Person", start: 1809, end: 1882, source: "https://en.wikipedia.org/wiki/Charles_Darwin" },
    { id: "curie", row: "science", name: "Marie Curie", kind: "Person", start: 1867, end: 1934, source: "https://en.wikipedia.org/wiki/Marie_Curie" },
    { id: "dickens", row: "arts", name: "Charles Dickens", kind: "Person", start: 1812, end: 1870, source: "https://en.wikipedia.org/wiki/Charles_Dickens" },
    { id: "monet", row: "arts", name: "Claude Monet", kind: "Person", start: 1840, end: 1926, source: "https://en.wikipedia.org/wiki/Claude_Monet" },
    { id: "jazz", row: "arts", name: "Jazz Age", kind: "Period", start: 1920, end: 1929, source: "https://en.wikipedia.org/wiki/Jazz_Age" },
    { id: "industrial", row: "world", name: "Second Industrial Revolution", kind: "Period", start: 1870, end: 1914, source: "https://en.wikipedia.org/wiki/Second_Industrial_Revolution" },
    { id: "exhibition", row: "world", name: "Great Exhibition", kind: "Event", start: 1851, source: "https://en.wikipedia.org/wiki/Great_Exhibition" },
    { id: "flight", row: "world", name: "First powered flight", kind: "Event", start: 1903, source: "https://en.wikipedia.org/wiki/Wright_brothers" },
  ],
};

export function yearLabel(year: number) {
  return year < 0 ? `${-year} BCE` : String(year);
}

// Historical years have no year zero. Use a continuous axis internally.
export const axisYear = (year: number) => year < 0 ? year + 1 : year;
export const historyYear = (position: number) => position <= 0 ? position - 1 : position;

export function endYear(entry: Entry) {
  return entry.ongoing ? Math.max(entry.start, currentYear) : (entry.end ?? entry.start);
}

export function entryDates(entry: Entry) {
  const start = yearLabel(entry.start);
  if (entry.ongoing) return `${start}–present`;
  return entry.end !== undefined && entry.end !== entry.start ? `${start}–${yearLabel(entry.end)}` : start;
}

export function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function boardRange(entries: Entry[]): [number, number] {
  if (!entries.length) return [1900, 2000];
  let first = Infinity;
  let last = -Infinity;
  for (const entry of entries) {
    first = Math.min(first, axisYear(entry.start));
    last = Math.max(last, axisYear(endYear(entry)));
  }
  const span = Math.max(last - first, 24);
  const step = rulerStep(span, 7);
  return [Math.floor((first - span * .05) / step) * step, Math.ceil((last + span * .05) / step) * step + (last - first < step ? step * 2 : 0)];
}

export function rulerStep(span: number, density: number) {
  const target = Math.max(1, span / density);
  const power = 10 ** Math.floor(Math.log10(target));
  return ([1, 2, 5, 10].find(step => step * power >= target) ?? 10) * power;
}
