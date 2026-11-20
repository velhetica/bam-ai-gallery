import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { createExhibition } from './exhibition.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compact = window.matchMedia('(max-width: 759px)').matches;
const canvas = document.querySelector('#installation');
const exhibition = createExhibition(canvas, { reduced, compact });
const ledger = document.querySelector('.ledger');
const wordmark = document.querySelector('.wordmark');
const heroLines = document.querySelectorAll('.room-hero .line > span');
const heroAction = document.querySelector('.room-hero .action');

const INK_LINE = 'rgba(233, 226, 210, 0.045)';
const INK_DRAW = 'rgba(233, 226, 210, 0.11)';
const ROOM_SPAN = 5;

let metrics = null;
let cell = null;
let baseCol = 0;
let baseRow = 0;
let introDone = false;
let intro = null;

function gridMetrics() {
  const dpr = window.devicePixelRatio || 1;
  const colPx = Math.max(1, Math.round(96 * dpr));
  const rowPx = Math.max(1, Math.round(64 * dpr));
  const mark = wordmark?.getBoundingClientRect().left || 0;
  return {
    dpr,
    line: 1 / dpr,
    col: colPx / dpr,
    row: rowPx / dpr,
    originX: Math.round(mark * dpr) / dpr,
    originY: 0,
  };
}

function makeLine(className) {
  const el = document.createElement('div');
  el.className = `ledger-line ${className}`;
  el.style.background = INK_DRAW;
  return el;
}

function placeCell(step) {
  if (!cell || !metrics) return;
  let col = baseCol;
  let row = baseRow;
  const maxCol = Math.floor((window.innerWidth - metrics.originX - metrics.col) / metrics.col);
  for (let i = 0; i < step; i += 1) {
    if (col + 1 > maxCol) {
      col = baseCol;
      row += 1;
    } else {
      col += 1;
    }
  }
  cell.style.left = `${metrics.originX + col * metrics.col}px`;
  cell.style.top = `${metrics.originY + row * metrics.row}px`;
  cell.style.width = `${metrics.col}px`;
  cell.style.height = `${metrics.row}px`;
}

function chooseCell(grid) {
  const headline = document.querySelector('.room-hero h1')?.getBoundingClientRect();
  const width = window.innerWidth;
  const height = window.innerHeight;
  let left = width * (width < 760 ? 0.5 : 0.58);
  if (headline && headline.top < height * 0.62) {
    left = Math.max(left, headline.right + grid.col);
  }
  let col = Math.ceil((left - grid.originX) / grid.col);
  const maxCol = Math.floor((width - grid.originX - grid.col) / grid.col);
  col = Math.max(0, Math.min(maxCol, col));
  let row = Math.round((height * 0.42) / grid.row);
  const maxRow = Math.floor((height - grid.row) / grid.row);
  row = Math.max(1, Math.min(maxRow, row));
  if (headline) {
    const top = row * grid.row;
    const box = {
      left: grid.originX + col * grid.col,
      right: grid.originX + (col + 1) * grid.col,
      top,
      bottom: top + grid.row,
    };
    const hits = !(box.right <= headline.left || box.left >= headline.right || box.bottom <= headline.top || box.top >= headline.bottom);
    if (hits) row = Math.min(maxRow, Math.ceil(headline.bottom / grid.row) + 1);
  }
  return { col, row };
}

function buildLedger() {
  metrics = gridMetrics();
  const width = window.innerWidth;
  const height = window.innerHeight;
  ledger.replaceChildren();

  const columns = [];
  const leftColumns = [];
  for (let x = metrics.originX; x < width + 1; x += metrics.col) {
    const line = makeLine('is-col');
    line.style.left = `${x}px`;
    line.style.width = `${metrics.line}px`;
    line.style.height = `${height}px`;
    columns.push(line);
  }
  for (let x = metrics.originX - metrics.col; x > -metrics.col; x -= metrics.col) {
    const line = makeLine('is-col');
    line.style.left = `${x}px`;
    line.style.width = `${metrics.line}px`;
    line.style.height = `${height}px`;
    leftColumns.push(line);
  }

  const rows = [];
  for (let y = 0; y < height + 1; y += metrics.row) {
    const line = makeLine('is-row');
    line.style.top = `${y}px`;
    line.style.height = `${metrics.line}px`;
    line.style.width = `${width}px`;
    rows.push(line);
  }

  cell = document.createElement('div');
  cell.className = 'ledger-cell';
  const picked = chooseCell(metrics);
  baseCol = picked.col;
  baseRow = picked.row;
  ledger.append(...leftColumns, ...columns, ...rows, cell);
  placeCell(0);

  return { columns, leftColumns, rows };
}

function showSettled(parts) {
  [...parts.leftColumns, ...parts.columns, ...parts.rows].forEach((line) => {
    line.style.transform = 'none';
    line.style.background = INK_LINE;
  });
  cell.style.transform = 'none';
  if (wordmark) wordmark.style.clipPath = 'none';
  heroLines.forEach((line) => {
    line.style.transform = 'none';
  });
  if (heroAction) heroAction.style.clipPath = 'none';
}

function playIntro(parts) {
  intro?.kill();
  const lines = [...parts.leftColumns, ...parts.columns, ...parts.rows];
  intro = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    onComplete: () => {
      introDone = true;
    },
  });

  if (wordmark) {
    intro.fromTo(
      wordmark,
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 0.55 },
      0.02,
    );
  }

  const columnSpan = 0.62;
  const columnDur = 0.34;
  parts.leftColumns.forEach((line) => {
    intro.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: columnDur }, 0.02);
  });
  parts.columns.forEach((line, index) => {
    const at = parts.columns.length <= 1 ? 0 : (index / (parts.columns.length - 1)) * columnSpan;
    intro.fromTo(line, { scaleY: 0 }, { scaleY: 1, duration: columnDur }, 0.02 + at);
  });

  const rowStart = 0.72;
  const rowSpan = 0.48;
  const rowDur = 0.3;
  parts.rows.forEach((line, index) => {
    const at = parts.rows.length <= 1 ? 0 : (index / (parts.rows.length - 1)) * rowSpan;
    intro.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: rowDur }, rowStart + at);
  });

  intro.to(lines, { backgroundColor: INK_LINE, duration: 0.35, ease: 'power2.out' }, 1.28);
  intro.fromTo(cell, { scaleX: 0 }, { scaleX: 1, duration: 0.38, ease: 'power2.inOut' }, 1.55);

  heroLines.forEach((line, index) => {
    intro.to(line, { y: 0, duration: 0.4, ease: 'power2.out' }, 1.98 + index * 0.16);
  });
  if (heroAction) {
    intro.fromTo(
      heroAction,
      { clipPath: 'inset(100% 0 0 0)' },
      { clipPath: 'inset(0% 0 0 0)', duration: 0.34, ease: 'power2.out' },
      1.98 + heroLines.length * 0.16,
    );
  }
}

function layoutLedger() {
  const parts = buildLedger();
  if (reduced || introDone) showSettled(parts);
  else playIntro(parts);
}

const rooms = document.querySelectorAll('.room');

function updatePlacards() {
  const height = window.innerHeight || 1;
  rooms.forEach((room) => {
    const placard = room.querySelector('.placard');
    if (!placard) return;
    const away = Math.abs(room.getBoundingClientRect().top) / height;
    const fade = Math.min(1, Math.max(0, (away - 0.04) / 0.18));
    placard.style.opacity = String(1 - fade);
  });
}

function onScroll(progress) {
  const room = progress * ROOM_SPAN;
  exhibition.setScroll(room);
  placeCell(Math.max(0, Math.min(ROOM_SPAN, Math.round(room))));
}

ScrollTrigger.create({
  trigger: 'main',
  start: 'top top',
  end: 'bottom bottom',
  scrub: reduced ? true : 0.5,
  onUpdate: (self) => onScroll(self.progress),
});

let lenis = null;

if (!reduced) {
  lenis = new Lenis({
    duration: 1.08,
    easing: (t) => 1 - (1 - t) ** 3,
    smoothWheel: true,
    wheelMultiplier: 0.82,
    touchMultiplier: 1,
  });
  lenis.on('scroll', ScrollTrigger.update);

  wordmark?.addEventListener('click', (event) => {
    const href = wordmark.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    event.preventDefault();
    lenis.scrollTo(href);
  });
}

gsap.ticker.add((time) => {
  lenis?.raf(time * 1000);
  updatePlacards();
  exhibition.render();
});
gsap.ticker.lagSmoothing(0);

function boot() {
  layoutLedger();
}

if (document.fonts?.ready) document.fonts.ready.then(boot);
else boot();

window.addEventListener('resize', () => {
  exhibition.resize();
  ScrollTrigger.refresh();
  if (reduced || introDone) layoutLedger();
});

function syncFromScroll() {
  const trigger = ScrollTrigger.getAll()[0];
  if (!trigger) return;
  onScroll(trigger.progress);
}

requestAnimationFrame(() => {
  ScrollTrigger.refresh();
  syncFromScroll();
});

document.fonts?.ready?.then(() => {
  ScrollTrigger.refresh();
  syncFromScroll();
});

window.addEventListener('beforeunload', () => {
  exhibition.destroy();
  lenis?.destroy();
});
