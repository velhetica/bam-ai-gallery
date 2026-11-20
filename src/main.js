import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { createExhibition } from './exhibition.js';

gsap.registerPlugin(ScrollTrigger);

const pixelGrid = document.querySelector('.pixel-grid');
const sheet = document.querySelector('.sheet');
let sheetReady = false;
let sheetTimeline = null;

function sheetMetrics() {
  const dpr = window.devicePixelRatio || 1;
  const colPx = Math.max(1, Math.round(96 * dpr));
  const rowPx = Math.max(1, Math.round(64 * dpr));
  const wordmark = document.querySelector('.wordmark');
  const originX = Math.round((wordmark?.getBoundingClientRect().left || 0) * dpr) / dpr;
  return {
    dpr,
    line: 1 / dpr,
    col: colPx / dpr,
    row: rowPx / dpr,
    colPx,
    rowPx,
    originX,
    originY: 0,
  };
}

function paintLedger(metrics) {
  if (!pixelGrid) return;
  const tile = document.createElement('canvas');
  tile.width = metrics.colPx;
  tile.height = metrics.rowPx;
  const context = tile.getContext('2d');
  context.clearRect(0, 0, tile.width, tile.height);
  context.strokeStyle = 'rgba(233, 226, 210, 0.045)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0.5, 0);
  context.lineTo(0.5, tile.height);
  context.moveTo(0, 0.5);
  context.lineTo(tile.width, 0.5);
  context.stroke();
  pixelGrid.style.backgroundImage = `url(${tile.toDataURL()})`;
  pixelGrid.style.backgroundSize = `${metrics.col}px ${metrics.row}px`;
  pixelGrid.style.backgroundPosition = `${metrics.originX}px ${metrics.originY}px`;
}

function intersects(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function layoutSheet() {
  const metrics = sheetMetrics();
  paintLedger(metrics);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const rows = [];
  for (let y = metrics.originY; y < height; y += metrics.row) rows.push(y);
  const rest = exhibition.snapHorizon(null);
  const headline = document.querySelector('h1')?.getBoundingClientRect();
  const restBottom = rest?.maxY ?? height * 0.72;
  let tangent = rows.reduce(
    (best, y) => (Math.abs(y - restBottom) < Math.abs(best - restBottom) ? y : best),
    rows[0],
  );
  if (headline && tangent > headline.top && tangent < headline.bottom + metrics.row) {
    const below = rows.find((y) => y >= headline.bottom + metrics.row);
    if (below != null) tangent = below;
  }
  const bounds = exhibition.snapHorizon(tangent) || exhibition.rimBounds();
  if (!bounds || !sheet) return metrics;

  const span = Math.max(metrics.col, bounds.maxX - bounds.minX);
  let left = bounds.minX + span * 0.56;
  left = metrics.originX + Math.round((left - metrics.originX) / metrics.col) * metrics.col;
  const minLeft = Math.max(metrics.originX + metrics.col, bounds.minX);
  const maxLeft = width - metrics.col - 16;
  left = Math.min(maxLeft, Math.max(minLeft, left));
  left = metrics.originX + Math.round((left - metrics.originX) / metrics.col) * metrics.col;
  const top = tangent - metrics.row;
  const cell = {
    left,
    top,
    right: left + metrics.col,
    bottom: top + metrics.row,
  };
  if (headline && intersects(cell, headline)) {
    left += metrics.col;
    cell.left = left;
    cell.right = left + metrics.col;
  }

  const routeY = top + metrics.row;
  let runX = left - metrics.col * 2;
  const note = document.querySelector('.room-hero .note')?.getBoundingClientRect();
  const blocked = [headline, note].filter(Boolean);
  const routeCrossesCopy = blocked.some(
    (box) => routeY >= box.top - 6 && routeY <= box.bottom + 6 && runX < box.right,
  );
  if (routeCrossesCopy) {
    runX = Math.max(runX, blocked.reduce((edge, box) => Math.max(edge, box.right), 0) + metrics.col);
  }
  if (runX > left - metrics.col) runX = left - metrics.col;
  runX = metrics.originX + Math.round((runX - metrics.originX) / metrics.col) * metrics.col;

  sheet.replaceChildren();
  const vertical = document.createElement('div');
  vertical.className = 'sheet-run is-vertical';
  vertical.style.left = `${runX}px`;
  vertical.style.top = `${routeY - metrics.row}px`;
  vertical.style.width = `${metrics.line}px`;
  vertical.style.height = `${metrics.row}px`;

  const horizontal = document.createElement('div');
  horizontal.className = 'sheet-run';
  horizontal.style.left = `${runX}px`;
  horizontal.style.top = `${routeY}px`;
  horizontal.style.width = `${Math.max(metrics.col, left - runX)}px`;
  horizontal.style.height = `${metrics.line}px`;

  const inlay = document.createElement('div');
  inlay.className = 'sheet-cell';
  inlay.style.left = `${left}px`;
  inlay.style.top = `${top}px`;
  inlay.style.width = `${metrics.col}px`;
  inlay.style.height = `${metrics.row}px`;
  sheet.append(vertical, horizontal, inlay);

  if (reduced) {
    pixelGrid.style.opacity = '1';
    vertical.style.transform = 'none';
    horizontal.style.transform = 'none';
    inlay.style.transform = 'none';
    return metrics;
  }

  const showFinal = reduced || sheetReady;
  if (showFinal) {
    pixelGrid.style.opacity = '1';
    vertical.style.transform = 'none';
    horizontal.style.transform = 'none';
    inlay.style.transform = 'none';
    return metrics;
  }
  sheetTimeline?.kill();
  sheetTimeline = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    onComplete: () => {
      sheetReady = true;
    },
  });
  sheetTimeline.to(pixelGrid, { opacity: 1, duration: 0.9 }, 0.15);
  sheetTimeline.to(vertical, { scaleY: 1, duration: 0.62 }, 3.45);
  sheetTimeline.to(horizontal, { scaleX: 1, duration: 0.7 }, 3.95);
  sheetTimeline.to(inlay, { scaleX: 1, duration: 0.55 }, 4.55);
  return metrics;
}

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const compact = window.matchMedia('(max-width: 759px)').matches;
const canvas = document.querySelector('#installation');
const exhibition = createExhibition(canvas, { reduced, compact });

const ROOM_SPAN = 5;
const rooms = document.querySelectorAll('.room');

function updatePlacards() {
  const height = window.innerHeight || 1;
  rooms.forEach((room) => {
    const placard = room.querySelector('.placard');
    if (!placard) return;
    const away = Math.abs(room.getBoundingClientRect().top) / height;
    const fade = Math.min(1, Math.max(0, (away - 0.04) / 0.18));
    placard.style.opacity = String(1 - fade);
    if (room.id === 'entrance' && sheet) {
      sheet.style.opacity = String(1 - fade);
    }
  });
}

ScrollTrigger.create({
  trigger: 'main',
  start: 'top top',
  end: 'bottom bottom',
  scrub: reduced ? true : 0.5,
  onUpdate: (self) => {
    exhibition.setScroll(self.progress * ROOM_SPAN);
  },
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

  const wordmark = document.querySelector('.wordmark');
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

function bootSheet() {
  const start = () => layoutSheet();
  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
}

bootSheet();

window.addEventListener('resize', () => {
  exhibition.resize();
  layoutSheet();
  ScrollTrigger.refresh();
});

function syncFromScroll() {
  const trigger = ScrollTrigger.getAll()[0];
  if (!trigger) return;
  exhibition.setScroll(trigger.progress * ROOM_SPAN);
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
