import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ledger = document.querySelector('.ledger');
const wordmark = document.querySelector('.wordmark');
const heroLines = document.querySelectorAll('.room-hero .line > span');
const heroAction = document.querySelector('.room-hero .action');
const rooms = [...document.querySelectorAll('.room')];

const INK_LINE = 'rgba(233, 226, 210, 0.045)';
const MAJOR = 'rgba(200, 185, 148, 0.55)';

let metrics = null;
let cell = null;
let baseCol = 0;
let baseRow = 0;

function gridMetrics() {
  const dpr = window.devicePixelRatio || 1;
  const colPx = Math.max(1, Math.round(96 * dpr));
  const rowPx = Math.max(1, Math.round(64 * dpr));
  const mark = wordmark?.getBoundingClientRect().left || 0;
  return {
    line: 1 / dpr,
    col: colPx / dpr,
    row: rowPx / dpr,
    originX: Math.round(mark * dpr) / dpr,
  };
}

function paintGrain() {
  const grain = document.querySelector('.grain');
  if (!grain) return;
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const context = tile.getContext('2d');
  const image = context.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = Math.random();
    if (n < 0.9) continue;
    const light = n > 0.975;
    image.data[i] = light ? 214 : 10;
    image.data[i + 1] = light ? 204 : 9;
    image.data[i + 2] = light ? 184 : 8;
    image.data[i + 3] = light ? 26 : 34;
  }
  context.putImageData(image, 0, 0);
  grain.style.backgroundImage = `url(${tile.toDataURL()})`;
  grain.style.backgroundSize = '128px 128px';
}

function mountSectionRules() {
  const line = gridMetrics().line;
  rooms.forEach((section) => {
    const rule = document.createElement('div');
    rule.className = 'section-rule';
    rule.style.height = `${line}px`;
    const bar = document.createElement('div');
    bar.className = 'section-rule-bar';
    rule.append(bar);
    section.prepend(rule);
    section._rule = { rule, bar, line, drawn: false };
  });
}

function cornerOf(step) {
  return step % 2 === 0 ? 'br' : 'tr';
}

function hiddenClip(corner) {
  return corner === 'br' ? 'inset(100% 0 0 100%)' : 'inset(0 0 100% 100%)';
}

function cellBox(step) {
  const maxCol = Math.floor((window.innerWidth - metrics.originX - metrics.col) / metrics.col);
  const col = Math.max(1, Math.min(maxCol, baseCol - step));
  const row = Math.max(1, baseRow - (step % 2));
  return {
    left: metrics.originX + col * metrics.col,
    top: row * metrics.row,
    corner: cornerOf(step),
  };
}

function placeCell(step, animate) {
  if (!cell || !metrics) return;
  const box = cellBox(step);
  cell.style.left = `${box.left + metrics.line}px`;
  cell.style.top = `${box.top + metrics.line}px`;
  cell.style.width = `${metrics.col - metrics.line}px`;
  cell.style.height = `${metrics.row - metrics.line}px`;
  if (!animate || reduced) {
    cell.style.clipPath = 'inset(0% 0% 0% 0%)';
    return;
  }
  gsap.fromTo(
    cell,
    { clipPath: hiddenClip(box.corner) },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.38, ease: 'power2.out' },
  );
}

function buildLedger() {
  metrics = gridMetrics();
  const width = window.innerWidth;
  const height = window.innerHeight;
  ledger.replaceChildren();
  const lines = [];

  const addCol = (x) => {
    const line = document.createElement('div');
    line.className = 'ledger-line is-col';
    line.style.background = INK_LINE;
    line.style.left = `${x}px`;
    line.style.top = '0';
    line.style.width = `${metrics.line}px`;
    line.style.height = `${height}px`;
    lines.push(line);
  };
  const addRow = (y) => {
    const line = document.createElement('div');
    line.className = 'ledger-line is-row';
    line.style.background = INK_LINE;
    line.style.left = '0';
    line.style.top = `${y}px`;
    line.style.width = `${width}px`;
    line.style.height = `${metrics.line}px`;
    lines.push(line);
  };

  for (let x = metrics.originX; x < width + 1; x += metrics.col) addCol(x);
  for (let x = metrics.originX - metrics.col; x > -metrics.col; x -= metrics.col) addCol(x);
  for (let y = 0; y < height + 1; y += metrics.row) addRow(y);

  cell = document.createElement('div');
  cell.className = 'ledger-cell';
  ledger.append(...lines, cell);

  const markBottom = (wordmark?.getBoundingClientRect().bottom || 48) + 20;
  const headline = document.querySelector('.room-hero h1')?.getBoundingClientRect();
  baseRow = Math.max(2, Math.ceil(markBottom / metrics.row));
  let left = width * (width < 760 ? 0.5 : 0.62);
  if (headline && headline.top < height * 0.72) left = Math.max(left, headline.right + metrics.col);
  const maxCol = Math.floor((width - metrics.originX - metrics.col) / metrics.col);
  baseCol = Math.max(1, Math.min(maxCol, Math.ceil((left - metrics.originX) / metrics.col)));

  const heroRule = document.querySelector('#entrance .section-rule');
  if (heroRule) heroRule.style.top = `${baseRow * metrics.row}px`;
  placeCell(0, false);
  return lines;
}

function arm(parent, x, y, w, h) {
  const piece = document.createElement('div');
  piece.className = 'section-cross';
  piece.style.left = `${x}px`;
  piece.style.top = `${y}px`;
  piece.style.width = `${w}px`;
  piece.style.height = `${h}px`;
  parent.append(piece);
  return piece;
}

function drawSectionRule(section, options = {}) {
  const pack = section?._rule;
  if (!pack || pack.drawn) return;
  pack.drawn = true;
  const width = pack.rule.clientWidth || window.innerWidth - metrics.originX;
  const crossX = options.crossX ?? 0;
  const tickStart = options.tickStart ?? Math.max(0, width - 96);
  const tickEnd = options.tickEnd ?? width;
  const ticks = [];
  for (let x = tickStart; x <= tickEnd + 0.1; x += 16) {
    const tick = document.createElement('div');
    tick.className = 'section-tick';
    const long = Math.abs((x - tickStart) % 96) < 1;
    tick.style.left = `${x}px`;
    tick.style.top = `${pack.line}px`;
    tick.style.width = `${pack.line}px`;
    tick.style.height = `${long ? 11 : 5}px`;
    pack.rule.append(tick);
    const fromRight = width > 0 ? (width - x) / width : 0;
    ticks.push({ tick, at: fromRight });
  }
  const gap = 2;
  const reach = 12;
  const mid = pack.line / 2;
  const cross = [
    arm(pack.rule, crossX - gap - reach, -mid, reach, pack.line),
    arm(pack.rule, crossX + gap, -mid, reach, pack.line),
    arm(pack.rule, crossX - mid, -gap - reach, pack.line, reach),
    arm(pack.rule, crossX - mid, gap, pack.line, reach),
  ];
  const snapAt = width > 0 ? Math.min(0.96, Math.max(0.05, (width - crossX) / width)) : 0.9;
  if (reduced || options.immediate) {
    pack.bar.style.transform = 'none';
    ticks.forEach(({ tick }) => {
      tick.style.opacity = '1';
    });
    cross.forEach((piece) => {
      piece.style.opacity = '1';
    });
    return;
  }
  const tl = options.timeline || gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  const start = options.start || 0;
  tl.fromTo(pack.bar, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power2.inOut' }, start);
  ticks.forEach(({ tick, at }) => {
    tl.fromTo(tick, { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'power1.out' }, start + at * 1);
  });
  tl.fromTo(cross, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'power2.out' }, start + snapAt);
}

function showType() {
  if (wordmark) wordmark.style.clipPath = 'none';
  heroLines.forEach((line) => {
    line.style.transform = 'none';
  });
  if (heroAction) heroAction.style.clipPath = 'none';
  if (cell) cell.style.clipPath = 'inset(0% 0% 0% 0%)';
  ledger.querySelectorAll('.ledger-line').forEach((line) => {
    line.style.opacity = '1';
  });
}

function playIntro(lines) {
  const intro = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  if (wordmark) {
    intro.fromTo(wordmark, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5 }, 0);
  }
  intro.fromTo(lines, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0);

  const hero = document.querySelector('#entrance');
  const cellRight = metrics.originX + (baseCol + 1) * metrics.col;
  const crossX = cellRight - metrics.originX;
  drawSectionRule(hero, {
    timeline: intro,
    start: 0.4,
    crossX,
    tickStart: crossX,
    tickEnd: Math.min(hero._rule.rule.clientWidth || crossX + 96, crossX + 96),
  });

  intro.fromTo(
    cell,
    { clipPath: hiddenClip('br') },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.36, ease: 'power2.out' },
    1.35,
  );
  heroLines.forEach((line, index) => {
    intro.to(line, { y: 0, duration: 0.34, ease: 'power2.out' }, 1.75 + index * 0.14);
  });
  if (heroAction) {
    intro.fromTo(
      heroAction,
      { clipPath: 'inset(100% 0 0 0)' },
      { clipPath: 'inset(0% 0 0 0)', duration: 0.3, ease: 'power2.out' },
      1.75 + heroLines.length * 0.14,
    );
  }
}

function layout() {
  const lines = buildLedger();
  if (reduced) {
    showType();
    rooms.forEach((section) => drawSectionRule(section, { immediate: true }));
    return;
  }
  playIntro(lines);
}

function revealPlacard(section) {
  const placard = section.querySelector('.placard');
  if (!placard || reduced) return;
  gsap.fromTo(placard, { y: 8 }, { y: 0, duration: 0.4, ease: 'power2.out' });
}

function enterPlate(section) {
  const index = Number(section.dataset.room) || 0;
  placeCell(index, true);
  drawSectionRule(section);
  revealPlacard(section);
}

function boot() {
  paintGrain();
  mountSectionRules();
  layout();
  rooms.forEach((section) => {
    if (section.classList.contains('room-hero')) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: () => enterPlate(section),
    });
  });
  ScrollTrigger.refresh();
}

if (document.fonts?.ready) document.fonts.ready.then(boot);
else boot();

window.addEventListener('resize', () => {
  if (reduced) layout();
  ScrollTrigger.refresh();
});
