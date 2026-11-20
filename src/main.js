import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ledger = document.querySelector('.ledger');
const wordmark = document.querySelector('.wordmark');
const heroLines = document.querySelectorAll('.room-hero .line > span');
const heroAction = document.querySelector('.room-hero .action');
const rooms = [...document.querySelectorAll('.room')];

let metrics = null;
let cell = null;
let shifts = [];
let headRows = [];
let accentRows = [];
let headIndex = -1;
let baseRow = 2;
let plate = -1;
let reveal = 0;
let introDone = false;
let scheduled = false;

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

function snap(value) {
  const dpr = window.devicePixelRatio || 1;
  return Math.round(value * dpr) / dpr;
}

function accentThickness() {
  const dpr = window.devicePixelRatio || 1;
  const min = Math.ceil(1.5 * dpr);
  const max = Math.max(min, Math.floor(2 * dpr));
  let px = Math.round(1.75 * dpr);
  if (px < min) px = min;
  if (px > max) px = max;
  if (px % 2 === 0) {
    if (px + 1 <= max) px += 1;
    else if (px - 1 >= min) px -= 1;
  }
  return px / dpr;
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

function lineEl(className, x, y, w, h) {
  const line = document.createElement('div');
  line.className = className;
  line.style.left = `${x}px`;
  line.style.top = `${y}px`;
  line.style.width = `${w}px`;
  line.style.height = `${h}px`;
  return line;
}

function cellBox(step) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const maxCol = Math.max(0, Math.floor((width - metrics.originX - metrics.col) / metrics.col));
  const maxRow = Math.max(1, Math.floor((height - metrics.row) / metrics.row));
  const textRight = width < 800 ? width * 0.55 : Math.min(width * 0.46, 720);
  let minCol = Math.ceil((textRight - metrics.originX) / metrics.col);
  if (minCol > maxCol) minCol = maxCol;
  const startCol = Math.max(minCol, maxCol - (maxCol > minCol + 1 ? 1 : 0));
  const startRow = Math.min(maxRow - 1, Math.max(1, baseRow));
  const steps = [
    [0, 0],
    [-1, 0],
    [0, 1],
    [-1, 0],
    [0, 1],
    [-1, 0],
  ];
  let col = startCol;
  let row = startRow;
  const count = Math.max(0, Math.min(step, steps.length - 1));
  for (let i = 1; i <= count; i += 1) {
    const [dx, dy] = steps[i];
    const nextCol = Math.max(minCol, Math.min(maxCol, col + dx));
    const nextRow = Math.max(1, Math.min(maxRow, row + dy));
    if (nextCol === col && nextRow === row) {
      if (dx !== 0) row = Math.min(maxRow, row + 1);
      else col = Math.max(minCol, col - 1);
    } else {
      col = nextCol;
      row = nextRow;
    }
  }
  return {
    left: metrics.originX + col * metrics.col,
    top: row * metrics.row,
  };
}

function placeCell(step, animate) {
  if (!cell || !metrics) return;
  const box = cellBox(step);
  const left = box.left + metrics.line;
  const top = box.top + metrics.line;
  cell.style.width = `${metrics.col - metrics.line}px`;
  cell.style.height = `${metrics.row - metrics.line}px`;
  if (!animate || reduced) {
    gsap.set(cell, { left, top });
    if (introDone || reduced) cell.style.clipPath = 'inset(0% 0% 0% 0%)';
    return;
  }
  gsap.to(cell, { left, top, duration: 0.5, ease: 'power2.inOut', overwrite: 'auto' });
}

function build() {
  metrics = gridMetrics();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const thick = accentThickness();
  const xs = [];
  const ys = [];
  for (let x = metrics.originX; x <= width + metrics.col; x += metrics.col) xs.push(snap(x));
  for (let x = metrics.originX - metrics.col; x >= -metrics.col * 2; x -= metrics.col) xs.push(snap(x));
  for (let y = 0; y <= height; y += metrics.row) ys.push(snap(y));
  ys.push(snap(-metrics.row));

  const base = document.createElement('div');
  base.className = 'ledger-shift';
  const accentShift = document.createElement('div');
  accentShift.className = 'ledger-shift';
  const accent = document.createElement('div');
  accent.className = 'ledger-accent';
  accent.append(accentShift);
  const float = document.createElement('div');
  float.className = 'ledger-float';
  cell = document.createElement('div');
  cell.className = 'ledger-cell';
  float.append(cell);

  const baseLines = [];
  headRows = [];
  accentRows = [];
  const colSpan = height + metrics.row * 2;
  const rowSpan = width + metrics.col * 2;

  xs.forEach((x) => {
    const col = lineEl('ledger-line is-col', x, -metrics.row, metrics.line, colSpan);
    base.append(col);
    baseLines.push(col);
    const ax = snap(x + (metrics.line - thick) / 2);
    accentShift.append(lineEl('ledger-line is-col', ax, -metrics.row, thick, colSpan));
  });
  ys.forEach((y) => {
    const row = lineEl('ledger-line is-row', -metrics.col, y, rowSpan, metrics.line);
    base.append(row);
    baseLines.push(row);
    const ay = snap(y + (metrics.line - thick) / 2);
    const accentRow = lineEl('ledger-line is-row', -metrics.col, ay, rowSpan, thick);
    accentShift.append(accentRow);
    if (y >= metrics.row && y <= height - metrics.row) {
      headRows.push(row);
      accentRows.push(accentRow);
    }
  });

  ledger.replaceChildren(base, accent, float);
  shifts = [base, accentShift, float];
  headIndex = -1;

  const markBottom = (wordmark?.getBoundingClientRect().bottom || 48) + 12;
  baseRow = Math.max(1, Math.ceil(markBottom / metrics.row));
  const heroRule = document.querySelector('#entrance .section-rule');
  if (heroRule) heroRule.style.top = `${baseRow * metrics.row}px`;
  placeCell(introDone ? plateIndex(window.scrollY) : 0, false);
  return baseLines;
}

function circleTarget(progress) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const swing = Math.sin(Math.PI * progress);
  return {
    x: w + Math.min(w * 0.08, 120) - swing * w * 0.16,
    y: -h * 0.16 + progress * h * 1.34,
    radius: h * (0.74 + 0.14 * swing),
  };
}

function applyCircle(progress) {
  const accent = ledger.querySelector('.ledger-accent');
  if (!accent) return;
  const target = circleTarget(progress);
  accent.style.setProperty('--mask-x', `${target.x}px`);
  accent.style.setProperty('--mask-y', `${target.y}px`);
  accent.style.setProperty('--mask-r', `${target.radius * reveal}px`);
}

function applyHead(progress) {
  const count = headRows.length;
  if (!count) return;
  const index = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
  if (index === headIndex) return;
  if (headIndex >= 0) {
    headRows[headIndex]?.classList.remove('is-head');
    accentRows[headIndex]?.classList.remove('is-head');
  }
  headIndex = index;
  headRows[index]?.classList.add('is-head');
  accentRows[index]?.classList.add('is-head');
}

function applyShift(scrollY) {
  const raw = reduced ? 0 : Math.sin((scrollY / window.innerHeight) * Math.PI) * metrics.col;
  const x = Math.abs(raw) < 0.4 ? 0 : raw;
  const value = x === 0 ? 'none' : `translate3d(${x}px, 0, 0)`;
  shifts.forEach((layer) => {
    layer.style.transform = value;
  });
}

function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / max));
}

function plateIndex(scrollY) {
  const mark = window.innerHeight * 0.72;
  let current = 0;
  rooms.forEach((section, index) => {
    if (scrollY >= section.offsetTop - mark) current = index;
  });
  return current;
}

function applyScroll() {
  const progress = scrollProgress();
  applyCircle(progress);
  applyHead(progress);
  applyShift(window.scrollY);
  if (!introDone) return;
  const next = plateIndex(window.scrollY);
  if (next === plate) return;
  plate = next;
  placeCell(plate, !reduced);
}

function onScroll() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyScroll();
  });
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
  const box = cellBox(0);
  const crossX = box.left + metrics.col - metrics.originX;
  drawSectionRule(hero, {
    timeline: intro,
    start: 0.4,
    crossX,
    tickStart: crossX,
    tickEnd: Math.min(hero._rule.rule.clientWidth || crossX + 96, crossX + 96),
  });

  placeCell(0, false);
  intro.fromTo(
    cell,
    { clipPath: 'inset(0 0 100% 100%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, ease: 'power2.out' },
    1.35,
  );

  const grow = { value: 0 };
  intro.to(
    grow,
    {
      value: 1,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        reveal = grow.value;
        applyScroll();
      },
    },
    0.5,
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

  intro.eventCallback('onComplete', () => {
    introDone = true;
    reveal = 1;
    plate = plateIndex(window.scrollY);
    placeCell(plate, false);
    applyScroll();
  });
}

function layout() {
  const lines = build();
  applyScroll();
  if (reduced) {
    reveal = 1;
    introDone = true;
    showType();
    rooms.forEach((section) => drawSectionRule(section, { immediate: true }));
    plate = plateIndex(window.scrollY);
    placeCell(plate, false);
    applyScroll();
    return;
  }
  playIntro(lines);
}

function revealPlacard(section) {
  const placard = section.querySelector('.placard');
  if (!placard || reduced) return;
  gsap.fromTo(placard, { y: 8 }, { y: 0, duration: 0.4, ease: 'power2.out' });
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
      onEnter: () => {
        drawSectionRule(section);
        revealPlacard(section);
      },
    });
  });
  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true });
  ScrollTrigger.refresh();
}

if (document.fonts?.ready) document.fonts.ready.then(boot);
else boot();

window.addEventListener('resize', () => {
  const lines = build();
  if (reduced || introDone) {
    reveal = 1;
    showType();
    plate = plateIndex(window.scrollY);
    placeCell(plate, false);
    applyScroll();
  } else {
    lines.forEach((line) => {
      line.style.opacity = '0';
    });
    applyScroll();
  }
  ScrollTrigger.refresh();
});
