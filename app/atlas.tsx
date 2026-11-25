"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  PiArrowsHorizontal, PiArrowsOut, PiCaretDown, PiCaretRight, PiCheckCircle,
  PiCompass, PiDotsThree, PiMinus, PiPlus, PiRows, PiChartBarHorizontal,
} from "react-icons/pi";
import { Dialog, EntryDetails, EntryEditor, kindIcons, RowEditor } from "./editor";
import {
  axisYear, boardRange, endYear, entryDates, historyYear, kinds, maximumYear, minimumYear,
  rulerStep, sample, storageKey, yearLabel, type Board, type Entry, type Kind, type Row,
} from "./model";

type Panel =
  | { type: "item"; id?: string; row?: string; year?: number }
  | { type: "details"; id: string }
  | { type: "row"; id?: string }
  | { type: "title" }
  | { type: "blank" };

const horizontalPadding = 24;
const dragType = "application/x-time-atlas-item";
const newItem = "new";

function arrange(entries: Entry[], position: (year: number) => number, width: number) {
  const laneEnds: number[] = [];
  const blocks = [...entries].sort((a, b) => a.start - b.start).map(entry => {
    const left = position(entry.start);
    const duration = Math.max(0, position(endYear(entry)) - left);
    const textWidth = Math.min(224, Math.max(82, entry.name.length * 7.4 + 44));
    const inline = entry.kind !== "Event" && duration >= Math.min(textWidth, 90);
    const labelAtLeft = !inline && left + duration + textWidth + 12 > width;
    const from = labelAtLeft ? Math.max(0, left - textWidth) : left;
    const to = left + duration + (inline || labelAtLeft ? 12 : textWidth + 12);
    let lane = laneEnds.findIndex(edge => edge <= from);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = to;
    return { entry, left, duration, inline, labelAtLeft, lane, textWidth };
  });
  return { blocks, lanes: laneEnds.length };
}

export default function Atlas() {
  const [board, setBoard] = useState<Board>(sample);
  const [ready, setReady] = useState(false);
  const [saveText, setSaveText] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [filter, setFilter] = useState<Kind | "All">("All");
  const [zoom, setZoom] = useState(1);
  const [viewWidth, setViewWidth] = useState(960);
  const [dropRow, setDropRow] = useState<string>();
  const [message, setMessage] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const rowLabel = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const dragId = useRef<string | null>(null);
  const [first, last] = boardRange(board.entries);
  const span = last - first;
  const chartWidth = Math.max(620, viewWidth) * zoom;
  const step = rulerStep(span, chartWidth / 75);
  const ticks = Array.from({ length: Math.floor((last - Math.ceil(first / step) * step) / step) + 1 }, (_, index) => Math.ceil(first / step) * step + index * step);
  const position = (year: number) => horizontalPadding + (axisYear(year) - first) / span * (chartWidth - horizontalPadding * 2);
  const visibleEntries = filter === "All" ? board.entries : board.entries.filter(entry => entry.kind === filter);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setBoard(JSON.parse(saved));
    } catch {
      setSaveText("Browser storage unavailable");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(board));
      setSaveText("Saved on this device");
    } catch {
      setSaveText("Unable to save on this device");
    }
  }, [board, ready]);

  useEffect(() => {
    const element = viewport.current;
    const label = rowLabel.current;
    if (!element || !label) return;
    const measure = () => setViewWidth(Math.max(240, element.clientWidth - label.offsetWidth));
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(label);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pendingScroll.current !== null && viewport.current) {
      viewport.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [zoom]);

  function changeZoom(value: number) {
    const scroll = viewport.current;
    if (!scroll || value === zoom) return;
    pendingScroll.current = (scroll.scrollLeft + viewWidth / 2) * (value / zoom) - viewWidth / 2;
    setZoom(value);
  }

  function fit() {
    setZoom(1);
    pendingScroll.current = null;
    if (viewport.current) viewport.current.scrollLeft = 0;
  }

  function showItem(entry: Entry, entries: Entry[]) {
    const [start, end] = boardRange(entries);
    const left = horizontalPadding + (axisYear(entry.start) - start) / (end - start) * (chartWidth - horizontalPadding * 2);
    const right = horizontalPadding + (axisYear(endYear(entry)) - start) / (end - start) * (chartWidth - horizontalPadding * 2);
    const element = viewport.current;
    if (element && (right > element.scrollLeft + viewWidth || left < element.scrollLeft)) {
      element.scrollLeft = Math.max(0, left - viewWidth / 3);
    }
  }

  function saveEntry(entry: Entry) {
    const entries = board.entries.some(item => item.id === entry.id)
      ? board.entries.map(item => item.id === entry.id ? entry : item)
      : [...board.entries, entry];
    setBoard({ ...board, entries, rows: board.rows.map(row => row.id === entry.row ? { ...row, collapsed: false } : row) });
    if (filter !== "All" && filter !== entry.kind) setFilter("All");
    setPanel(null);
    setMessage(`${entry.name} saved`);
    requestAnimationFrame(() => showItem(entry, entries));
  }

  function saveRow(row: Row) {
    setBoard(previous => ({
      ...previous,
      rows: previous.rows.some(item => item.id === row.id) ? previous.rows.map(item => item.id === row.id ? row : item) : [...previous.rows, row],
    }));
    setPanel(null);
    setMessage(`${row.name} saved`);
  }

  function removeRow(id: string) {
    setBoard(previous => {
      const rows = previous.rows.filter(row => row.id !== id);
      if (!rows.length) return previous;
      return { ...previous, rows, entries: previous.entries.map(item => item.row === id ? { ...item, row: rows[0].id } : item) };
    });
    setPanel(null);
    setMessage("Row removed");
  }

  function reorderRow(index: number, offset: number) {
    setBoard(previous => {
      const rows = [...previous.rows];
      [rows[index], rows[index + offset]] = [rows[index + offset], rows[index]];
      return { ...previous, rows };
    });
  }

  function beginDrag(event: DragEvent, id: string) {
    dragId.current = id;
    event.dataTransfer.effectAllowed = id === newItem ? "copy" : "move";
    event.dataTransfer.setData(dragType, id);
  }

  function drop(event: DragEvent<HTMLDivElement>, row: Row) {
    const id = event.dataTransfer.getData(dragType);
    if (!id) return;
    event.preventDefault();
    setDropRow(undefined);
    dragId.current = null;
    if (id === newItem) {
      const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - horizontalPadding;
      const year = historyYear(Math.round(first + offset / (chartWidth - horizontalPadding * 2) * span));
      setPanel({ type: "item", row: row.id, year: Math.max(minimumYear, Math.min(maximumYear, year)) });
      return;
    }
    const entry = board.entries.find(item => item.id === id);
    if (entry && entry.row !== row.id) saveEntry({ ...entry, row: row.id });
  }

  const activeEntry = panel && (panel.type === "item" || panel.type === "details") ? board.entries.find(entry => entry.id === panel.id) : undefined;
  const activeRow = panel?.type === "row" ? board.rows.find(row => row.id === panel.id) : undefined;
  const activeRowIndex = activeRow ? board.rows.indexOf(activeRow) : -1;
  const closePanel = () => setPanel(null);

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="./"><span className="brand-mark"><PiCompass /></span>Time Atlas</a>
          <div className="header-actions">
            <span className="save-status" title={saveText}><PiCheckCircle /><span>{saveText}</span></span>
            <button className="button header-new" onClick={() => setPanel({ type: "blank" })}><PiPlus /> New timeline</button>
          </div>
        </div>
      </header>
      <main>
        <section className="intro">
          <div className="intro-copy">
            <h1>See history side by side.</h1>
            <p>Put people, periods, and events on the same timeline.<br className="desktop-break" /> See who lived when and what was happening around them.</p>
          </div>
          <div className="intro-art" aria-hidden="true">
            <span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" />
            <span className="orbit-axis" /><span className="orbit-vertical" />
            <PiCompass className="compass-art" /><span className="orbit-dot a" /><span className="orbit-dot b" /><span className="orbit-dot c" />
          </div>
        </section>
        <section className="board" aria-label="Timeline editor">
          <div className="board-heading">
            <div className="board-title-group">
              <span className="board-mark"><PiChartBarHorizontal /></span>
              <div>
                <button className="board-title" title="Rename timeline" onClick={() => setPanel({ type: "title" })}>{board.name}<PiDotsThree /></button>
                <p>{board.entries.length} {board.entries.length === 1 ? "item" : "items"} <span aria-hidden="true">·</span> {board.rows.length} {board.rows.length === 1 ? "row" : "rows"}</p>
              </div>
            </div>
            <button className="button primary add-item" onClick={() => setPanel({ type: "item" })} draggable
              onDragStart={event => beginDrag(event, newItem)} onDragEnd={() => { dragId.current = null; setDropRow(undefined); }}>
              <PiPlus /> Add item
            </button>
          </div>
          <div className="toolbar">
            <div className="filters" aria-label="Filter by item type">
              <button className="filter" aria-pressed={filter === "All"} onClick={() => setFilter("All")}>All</button>
              {kinds.map(kind => {
                const Icon = kindIcons[kind];
                return <button key={kind} className="filter" aria-pressed={filter === kind} onClick={() => setFilter(kind)}><Icon />{kind === "Person" ? "People" : `${kind}s`}</button>;
              })}
            </div>
            <div className="zoom" aria-label="Timeline zoom">
              <button className="icon-button" type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => changeZoom(Math.max(1, zoom / 1.5))}><PiMinus /></button>
              <button className="icon-button" type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 8} onClick={() => changeZoom(Math.min(8, zoom * 1.5))}><PiPlus /></button>
              <button className="icon-button fit" type="button" aria-label="Reset zoom and scroll" title="Reset zoom and scroll" onClick={fit}><PiArrowsOut /></button>
            </div>
          </div>
          <div className="timeline-viewport" ref={viewport} tabIndex={0} aria-label="Scrollable timeline">
            <div className="timeline-grid" style={{ "--chart-width": `${chartWidth}px` } as CSSProperties}>
              <div className="ruler timeline-line">
                <div className="row-label ruler-label" ref={rowLabel}><PiRows /> Rows</div>
                <div className="ruler-axis" aria-label="Years">
                  {ticks.map(tick => <span className="tick" key={tick} style={{ left: position(historyYear(tick)) }}>{yearLabel(historyYear(tick))}</span>)}
                </div>
              </div>
              {board.rows.map(row => {
                const entries = visibleEntries.filter(entry => entry.row === row.id);
                const { blocks, lanes } = arrange(entries, position, chartWidth);
                const laneHeight = row.compact ? 32 : 36;
                const offset = row.compact ? 10 : 13;
                const height = row.collapsed ? 48 : Math.max(row.compact ? 54 : 76, lanes * laneHeight + offset * 2);
                return <div key={row.id} className={`timeline-line ${row.tone}`} style={{ minHeight: height }}>
                  <div className="row-label track-label">
                    <button className="row-toggle" aria-label={`${row.collapsed ? "Expand" : "Collapse"} ${row.name}`} aria-expanded={!row.collapsed}
                      onClick={() => setBoard(previous => ({ ...previous, rows: previous.rows.map(item => item.id === row.id ? { ...item, collapsed: !item.collapsed } : item) }))}>
                      {row.collapsed ? <PiCaretRight /> : <PiCaretDown />}<span className="row-dot" /><span>{row.name}</span>
                    </button>
                    <div className="row-options">
                      <button className="icon-button" aria-label={`Options for ${row.name}`} onClick={() => setPanel({ type: "row", id: row.id })}><PiDotsThree /></button>
                    </div>
                  </div>
                  <div className={`track${dropRow === row.id ? " drop-target" : ""}`}
                    onDragOver={event => {
                      if (!dragId.current) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = dragId.current === newItem ? "copy" : "move";
                      setDropRow(row.id);
                    }}
                    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropRow(undefined); }}
                    onDrop={event => drop(event, row)}>
                    {ticks.map(tick => <span className="gridline" key={tick} style={{ left: position(historyYear(tick)) }} />)}
                    {row.collapsed ? <span className="empty-row">{entries.length} hidden</span> : !entries.length ?
                      <button className="empty-row add-empty" onClick={() => setPanel({ type: "item", row: row.id })}><PiPlus /> Add an item here</button> :
                      blocks.map(({ entry, left, duration, lane, inline, labelAtLeft, textWidth }) => (
                        <button key={entry.id}
                          className={`timeline-item ${entry.kind.toLowerCase()} ${inline ? "inline" : "external"}${labelAtLeft ? " label-left" : ""}${row.compact ? " compact" : ""}`}
                          style={{ left, top: offset + lane * laneHeight, "--duration": `${Math.max(8, duration)}px`, "--text-width": `${textWidth}px` } as CSSProperties}
                          aria-label={`${entry.name}, ${entryDates(entry)}`} title={`${entry.name} · ${entryDates(entry)}`}
                          onClick={() => setPanel({ type: "details", id: entry.id })}
                          draggable onDragStart={event => beginDrag(event, entry.id)} onDragEnd={() => { dragId.current = null; setDropRow(undefined); }}>
                          <span className="duration" />
                          <span className="item-text">{entry.name}</span>
                        </button>
                      ))}
                  </div>
                </div>;
              })}
            </div>
          </div>
          <div className="board-footer">
            <button className="button add-row" onClick={() => setPanel({ type: "row" })}><PiPlus /> Add row</button>
            <span><PiArrowsHorizontal /> <span>Scroll sideways to explore</span></span>
          </div>
        </section>
        <p className="board-tip">Tap an item to see its dates. Drag it to another row, or change its row in Edit item.</p>
        <p className="sr-only" role="status">{message}</p>
      </main>
      {panel?.type === "item" && <EntryEditor key={panel.id ?? "new"} entry={activeEntry} rows={board.rows} initialRow={panel.row} initialYear={panel.year} close={closePanel} save={saveEntry}
        remove={id => {
          setBoard(previous => ({ ...previous, entries: previous.entries.filter(entry => entry.id !== id) }));
          setPanel(null);
          setMessage("Item removed");
        }} />}
      {panel?.type === "details" && activeEntry && <EntryDetails entry={activeEntry} close={closePanel} edit={() => setPanel({ type: "item", id: activeEntry.id })} />}
      {panel?.type === "row" && <RowEditor row={activeRow} count={board.entries.filter(entry => entry.row === activeRow?.id).length} close={closePanel} save={saveRow}
        addItem={activeRow ? () => setPanel({ type: "item", row: activeRow.id }) : undefined}
        moveUp={activeRowIndex > 0 ? () => { reorderRow(activeRowIndex, -1); closePanel(); } : undefined}
        moveDown={activeRowIndex >= 0 && activeRowIndex < board.rows.length - 1 ? () => { reorderRow(activeRowIndex, 1); closePanel(); } : undefined}
        remove={activeRow && board.rows.length > 1 ? () => removeRow(activeRow.id) : undefined} />}
      {panel?.type === "title" && <Dialog title="Rename timeline" close={closePanel}>
        <form className="dialog-body" onSubmit={event => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get("name")).trim();
          if (!name) return;
          setBoard(previous => ({ ...previous, name }));
          closePanel();
        }}>
          <label>Timeline name<input name="name" defaultValue={board.name} required maxLength={100} autoFocus /></label>
          <div className="dialog-actions"><button className="button primary push">Save name</button></div>
        </form>
      </Dialog>}
      {panel?.type === "blank" && <Dialog title="Start a new timeline?" close={closePanel}>
        <div className="dialog-body">
          <p className="entry-notes">Your browser stores one timeline. Starting a new one replaces the timeline you have open.</p>
          <div className="dialog-actions">
            <button className="button secondary push" onClick={closePanel}>Cancel</button>
            <button className="button primary" onClick={() => {
              setBoard({ name: "My timeline", rows: [{ id: crypto.randomUUID(), name: "My first row", tone: "green" }], entries: [] });
              setFilter("All");
              fit();
              closePanel();
              setMessage("New timeline created");
            }}>Start fresh</button>
          </div>
        </div>
      </Dialog>}
    </>
  );
}
