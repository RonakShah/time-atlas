"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PiArrowDown, PiArrowUp, PiCheck, PiClock, PiGlobeHemisphereWest, PiLightning, PiMagnifyingGlass, PiPersonSimple, PiPlus, PiTrash, PiX } from "react-icons/pi";
import { entryDates, kinds, maximumYear, minimumYear, sourceUrl, tones, type Entry, type Kind, type Row, type Tone } from "./model";
import { lookupDates, searchWikipedia, type Suggestion } from "./wikimedia";

export const kindIcons = { Person: PiPersonSimple, Period: PiClock, Event: PiLightning };
const toneNames = { green: "Green", purple: "Purple", orange: "Orange", blue: "Blue" };

export function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
    }}>
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" onClick={close} aria-label="Close"><PiX /></button>
      </div>
      {children}
    </dialog>
  );
}

export function EntryEditor({ entry, rows, initialRow, initialYear, close, save, remove }: {
  entry?: Entry;
  rows: Row[];
  initialRow?: string;
  initialYear?: number;
  close: () => void;
  save: (entry: Entry) => void;
  remove: (id: string) => void;
}) {
  const [mode, setMode] = useState<"manual" | "search">("manual");
  const [kind, setKind] = useState<Kind>(entry?.kind ?? "Person");
  const [name, setName] = useState(entry?.name ?? "");
  const [start, setStart] = useState(String(entry?.start ?? initialYear ?? ""));
  const [end, setEnd] = useState(String(entry?.end ?? ""));
  const [ongoing, setOngoing] = useState(entry?.ongoing ?? false);
  const [row, setRow] = useState(entry?.row ?? initialRow ?? rows[0].id);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [source, setSource] = useState(entry?.source ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [request, setRequest] = useState<AbortController>();
  const [searchStatus, setSearchStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => () => request?.abort(), [request]);

  function changeMode(next: typeof mode) {
    request?.abort();
    setSearchStatus("");
    setMode(next);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const searchText = query.trim();
    if (searchText.length < 2) return;
    request?.abort();
    const controller = new AbortController();
    setRequest(controller);
    setResults([]);
    setSearchStatus("Searching Wikipedia…");
    try {
      const hits = await searchWikipedia(searchText, controller.signal);
      setResults(hits);
      setSearchStatus(hits.length ? "" : "No matches. Try a different name or add it yourself.");
    } catch {
      if (!controller.signal.aborted) setSearchStatus("Wikipedia is unavailable. You can still add the item yourself.");
    }
  }

  async function select(result: Suggestion) {
    request?.abort();
    const controller = new AbortController();
    setRequest(controller);
    setSearchStatus("Looking up dates…");
    let dates: Awaited<ReturnType<typeof lookupDates>> | undefined;
    try {
      dates = await lookupDates(result.title, controller.signal);
    } catch {
      if (controller.signal.aborted) return;
    }
    setName(result.title);
    setSource(dates?.source ?? result.url);
    setKind(dates?.kind ?? kind);
    setStart(dates?.start ?? "");
    setEnd(dates?.end ?? "");
    setOngoing(false);
    if (dates?.hasAlternatives) {
      setNotice("Sources give different dates. Check the article and use the years that fit your source.");
    } else {
      setNotice(dates?.start ? "Check the suggested years before adding this item." : "Add a year from the article or a source you trust.");
    }
    setSearchStatus("");
    setMode("manual");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = Number(start);
    const last = kind !== "Event" && !ongoing && end ? Number(end) : undefined;
    if (!name.trim()) return setError("Give your item a name.");
    if (!first || last === 0 || (last !== undefined && last < first)) return setError("Use a nonzero year and put the end year after or equal to the start.");
    const link = source.trim() ? sourceUrl(source.trim()) : undefined;
    if (source.trim() && !link) return setError("Enter a source link beginning with https:// or http://.");
    save({ id: entry?.id ?? crypto.randomUUID(), row, name: name.trim(), kind, start: first, end: last, ongoing: kind !== "Event" && ongoing, notes: notes.trim(), source: link });
  }

  return (
    <Dialog title={entry ? "Edit item" : "Add to your timeline"} close={close}>
      {!entry && <div className="mode-switch" aria-label="Entry mode">
        <button type="button" aria-pressed={mode === "manual"} onClick={() => changeMode("manual")}><PiPlus /> Add yourself</button>
        <button type="button" aria-pressed={mode === "search"} onClick={() => changeMode("search")}><PiGlobeHemisphereWest /> Find on Wikipedia</button>
      </div>}
      {mode === "search" ? <div className="dialog-body">
        <form className="search-form" onSubmit={search}>
          <label htmlFor="wiki-search">Who or what are you looking for?</label>
          <div className="search-input">
            <input id="wiki-search" placeholder="Try Leonardo da Vinci" value={query} onChange={event => setQuery(event.target.value)} required minLength={2} />
            <button className="button primary" aria-label="Search Wikipedia"><PiMagnifyingGlass /></button>
          </div>
        </form>
        <p role="status" className="form-note">{searchStatus || "Choose a match to bring its name, dates when available, and source into your timeline."}</p>
        <div className="results">
          {results.map(result => <button type="button" key={result.url} className="button" onClick={() => void select(result)}>{result.title}<PiPlus /></button>)}
        </div>
      </div> : <form onSubmit={submit} className="dialog-body">
        {notice && <p className="form-note notice">{notice}{source && <> <a href={sourceUrl(source)} target="_blank" rel="noreferrer">Open article</a></>}</p>}
        <div className="kind-options" aria-label="Item type">
          {kinds.map(option => {
            const Icon = kindIcons[option];
            return <button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)}><Icon />{option}</button>;
          })}
        </div>
        <label>Name<input required maxLength={120} placeholder={kind === "Person" ? "e.g. Alan Turing" : kind === "Period" ? "e.g. The Renaissance" : "e.g. Moon landing"} value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="date-fields">
          <label>{kind === "Event" ? "Year" : "Start year"}<input type="number" required min={minimumYear} max={maximumYear} placeholder="e.g. 1912" value={start} onChange={event => setStart(event.target.value)} /></label>
          {kind !== "Event" && <label>End year <span className="optional">optional</span><input type="number" min={minimumYear} max={maximumYear} disabled={ongoing} value={end} onChange={event => setEnd(event.target.value)} /></label>}
        </div>
        <div className="date-help"><small>Use a minus sign for BCE, e.g. −44.</small>{kind !== "Event" && <label><input type="checkbox" checked={ongoing} onChange={event => setOngoing(event.target.checked)} /> Ongoing</label>}</div>
        <label>Row<select aria-label="Row" value={row} onChange={event => setRow(event.target.value)}>{rows.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
        <details className="extra-fields" open={Boolean(entry?.source || entry?.notes) || undefined}>
          <summary>Notes &amp; source <span className="optional">optional</span></summary>
          <label>Notes<textarea rows={2} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
          <label>Source link<input type="url" maxLength={2048} placeholder="https://" value={source} onChange={event => setSource(event.target.value)} /></label>
        </details>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="dialog-actions">
          {entry && <button type="button" className="button danger" onClick={() => confirmDelete ? remove(entry.id) : setConfirmDelete(true)}><PiTrash />{confirmDelete ? "Confirm delete" : "Delete"}</button>}
          <button type="button" className="button secondary push" onClick={close}>Cancel</button>
          <button className="button primary"><PiCheck />{entry ? "Save changes" : "Add item"}</button>
        </div>
      </form>}
    </Dialog>
  );
}

export function RowEditor({ row, count, close, save, remove, addItem, moveUp, moveDown }: {
  row?: Row;
  count: number;
  close: () => void;
  save: (row: Row) => void;
  remove?: () => void;
  addItem?: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [tone, setTone] = useState<Tone>(row?.tone ?? "green");
  const [compact, setCompact] = useState(row?.compact ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return <Dialog title={row ? "Edit row" : "Add a row"} close={close}>
    <form className="dialog-body" onSubmit={event => {
      event.preventDefault();
      if (name.trim()) save({ id: row?.id ?? crypto.randomUUID(), name: name.trim(), tone, compact, collapsed: row?.collapsed });
    }}>
      <label>Row name<input required maxLength={60} placeholder="e.g. Ancient India" value={name} onChange={event => setName(event.target.value)} autoFocus /></label>
      <fieldset><legend>Row color</legend><div className="color-options">
        {tones.map(option => <button key={option} type="button" className={`color-choice ${option}`} aria-label={toneNames[option]} aria-pressed={tone === option} onClick={() => setTone(option)}>{tone === option && <PiCheck />}</button>)}
      </div></fieldset>
      <label className="check-row"><input type="checkbox" checked={compact} onChange={event => setCompact(event.target.checked)} /> Use a shorter row</label>
      {row && <div className="row-commands">
        <button type="button" className="button secondary" onClick={addItem}><PiPlus /> Add item here</button>
        <button type="button" className="icon-button" aria-label="Move row up" onClick={moveUp} disabled={!moveUp}><PiArrowUp /></button>
        <button type="button" className="icon-button" aria-label="Move row down" onClick={moveDown} disabled={!moveDown}><PiArrowDown /></button>
      </div>}
      {confirmDelete && <p className="form-note">{count ? "Items in this row will move to the first remaining row." : "This empty row will be removed."}</p>}
      <div className="dialog-actions">
        {remove && <button type="button" className="button danger" onClick={() => confirmDelete ? remove() : setConfirmDelete(true)}><PiTrash />{confirmDelete ? "Confirm delete" : "Delete"}</button>}
        <button type="button" className="button secondary push" onClick={close}>Cancel</button>
        <button className="button primary"><PiCheck />{row ? "Save row" : "Add row"}</button>
      </div>
    </form>
  </Dialog>;
}

export function EntryDetails({ entry, close, edit }: { entry: Entry; close: () => void; edit: () => void }) {
  const Icon = kindIcons[entry.kind];
  return <Dialog title={entry.name} close={close}>
    <div className="dialog-body">
      <div className="entry-meta"><Icon />{entry.kind}<span>{entryDates(entry)}</span></div>
      {entry.notes && <p className="entry-notes">{entry.notes}</p>}
      {entry.source && <a href={sourceUrl(entry.source)} target="_blank" rel="noreferrer">Open source ↗</a>}
      <div className="dialog-actions"><button className="button primary push" onClick={edit}>Edit item</button></div>
    </div>
  </Dialog>;
}
