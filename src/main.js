import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ledger = document.querySelector('.ledger');
const wordmark = document.querySelector('.wordmark');
const heroAction = document.querySelector('.room-hero .action');
const rooms = [...document.querySelectorAll('.room')];

let metrics = null;
let cell = null;
let headRows = [];
let accentRows = [];
let headIndex = -1;
let baseRow = 2;
let plate = -1;
let reveal = 0;
let introDone = false;
let scheduled = false;
let mastRule = null;
let mastDrawn = false;
let breath = 1;
let bandHeight = 0;
let gaugeX = 0;
let routeLayer = null;
let activeRoutes = [];
let lastPulse = 0;
const SVG_NS = 'http://www.w3.org/2000/svg';
let headDrift = 0;
let ambientOn = false;
let ambientRaf = 0;
let glintTimer = 0;
let cellTimer = 0;
let lastHeadStep = 0;
let nudgeToken = 0;

function gridMetrics() {
  const dpr = window.devicePixelRatio || 1;
  const narrow = window.innerWidth < 768;
  const colPx = Math.max(1, Math.round((narrow ? 48 : 96) * dpr));
  const rowPx = Math.max(1, Math.round((narrow ? 32 : 64) * dpr));
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
    if (section.classList.contains('room-hero')) return;
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
  const minor = metrics.col / 6;
  const major = metrics.col;
  for (let x = tickStart; x <= tickEnd + 0.1; x += minor) {
    const tick = document.createElement('div');
    tick.className = 'section-tick';
    const long = Math.abs((x - tickStart) % major) < minor * 0.6;
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
  nudgeToken += 1;
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
  gsap.to(cell, { left, top, duration: 0.26, ease: 'power2.out', overwrite: 'auto' });
}

function build() {
  document.documentElement.classList.toggle('is-narrow', window.innerWidth < 768);
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

  ledger.replaceChildren(base, accent);
  document.body.append(float);
  headIndex = -1;

  const mastEl = document.querySelector('.mast');
  const cover = Math.ceil(mastEl?.getBoundingClientRect().bottom || (wordmark?.getBoundingClientRect().bottom || 48) + 20);
  bandHeight = cover;
  const rows = Math.max(1, Math.ceil(cover / metrics.row));
  baseRow = rows;
  layoutStage();
  placeCell(introDone ? plateIndex(window.scrollY) : 0, false);
  buildMastRule();
  ensureRouteLayer();
  placeBranches();
  applyBand();
  return baseLines;
}

function applyBand() {
  let band = document.querySelector('.mast-band');
  if (!band) {
    band = document.createElement('div');
    band.className = 'mast-band';
    band.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(band, document.querySelector('.mast'));
  }
  band.style.height = `${bandHeight}px`;
  band.style.background = '#080807';
  document.documentElement.style.setProperty('--mast', `${bandHeight}px`);
  ledger.style.webkitMaskImage = 'none';
  ledger.style.maskImage = 'none';
}

function layoutStage() {
  const width = window.innerWidth;
  const narrow = width < 768;
  const textRight = document.querySelector('.room-hero .placard')?.getBoundingClientRect().right ?? width * 0.42;
  if (narrow) {
    gaugeX = snap(Math.max(2, metrics.originX - metrics.col));
    return;
  }
  let ruleX = metrics.originX + metrics.col;
  const minX = textRight + metrics.col * 0.5;
  for (let x = metrics.originX; x < width - metrics.col; x += metrics.col) {
    if (x >= minX) {
      ruleX = snap(x);
      break;
    }
  }
  gaugeX = ruleX;
}

function buildMastRule() {
  if (!mastRule) {
    mastRule = document.createElement('div');
    mastRule.className = 'mast-rule';
    mastRule.setAttribute('aria-hidden', 'true');
    const track = document.createElement('div');
    track.className = 'gauge-track';
    const fill = document.createElement('div');
    fill.className = 'gauge-fill';
    const mark = document.createElement('div');
    mark.className = 'gauge-mark';
    mark.innerHTML = '<i class="gauge-mark-tick"></i><i class="gauge-mark-square"></i>';
    mastRule.append(track, fill, mark);
    mastRule._track = track;
    mastRule._fill = fill;
    mastRule._mark = mark;
  }
  mastRule.querySelectorAll('.mast-tick').forEach((tick) => tick.remove());
  const height = window.innerHeight - bandHeight;
  const ruleX = gaugeX;
  const ticksGoLeft = ruleX >= metrics.originX;
  const minor = Math.max(8, metrics.col / 6);
  const count = Math.max(1, Math.floor(height / minor));
  const ticks = [];
  for (let i = 1; i <= count; i += 1) {
    const tick = document.createElement('div');
    tick.className = 'mast-tick';
    const y = snap(i * minor);
    const tickW = i % 6 === 0 ? 11 : 5;
    tick.style.top = `${y}px`;
    tick.style.width = `${tickW}px`;
    tick.style.height = `${metrics.line}px`;
    tick.style.left = ticksGoLeft ? `${-tickW}px` : `${metrics.line}px`;
    mastRule.append(tick);
    ticks.push({ tick, at: y / Math.max(height, 1) });
  }
  mastRule._ticks = ticks;
  mastRule.style.left = `${ruleX}px`;
  mastRule.style.top = `${bandHeight}px`;
  mastRule.style.width = `${metrics.line}px`;
  mastRule.style.height = `${height}px`;
  const square = 6;
  const markTick = mastRule.querySelector('.gauge-mark-tick');
  const markSquare = mastRule.querySelector('.gauge-mark-square');
  markTick.style.width = `${metrics.col * 0.22}px`;
  markTick.style.height = `${metrics.line}px`;
  markTick.style.left = ticksGoLeft ? `${-metrics.col * 0.22}px` : '0px';
  markSquare.style.width = `${square}px`;
  markSquare.style.height = `${square}px`;
  markSquare.style.left = `${-square / 2}px`;
  markSquare.style.top = `${-square / 2}px`;
  ledger.append(mastRule);
  if (reduced || mastDrawn) {
    mastRule._track.style.transform = 'none';
    mastRule._mark.style.opacity = '1';
    ticks.forEach(({ tick }) => {
      tick.style.opacity = '1';
    });
  }
}

function drawMast(timeline, start) {
  if (!mastRule || mastDrawn) return;
  mastDrawn = true;
  const ticks = mastRule._ticks || [];
  if (reduced || !timeline) {
    mastRule._track.style.transform = 'none';
    mastRule._mark.style.opacity = '1';
    ticks.forEach(({ tick }) => {
      tick.style.opacity = '1';
    });
    return;
  }
  timeline.fromTo(mastRule._track, { scaleY: 0 }, { scaleY: 1, duration: 1.05, ease: 'power2.inOut' }, start);
  ticks.forEach(({ tick, at }) => {
    timeline.fromTo(tick, { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'none' }, start + at * 1.05);
  });
  timeline.set(mastRule._mark, { opacity: 1 }, start + 0.2);
}

function mountBranches() {
  rooms.forEach((section) => {
    if (section._branch) return;
    const branch = document.createElement('div');
    branch.className = 'gauge-branch';
    const bar = document.createElement('div');
    bar.className = 'gauge-branch-bar';
    branch.append(bar);
    section.append(branch);
    section._branch = { branch, bar, drawn: false };
  });
}

function placeBranches() {
  const ruleX = gaugeX || metrics.originX;
  const scrollY = window.scrollY;
  rooms.forEach((section) => {
    const pack = section._branch;
    const title = section.querySelector('h1, .plate, h2');
    if (!pack || !title) return;
    const y = title.getBoundingClientRect().top + scrollY - (section.getBoundingClientRect().top + scrollY);
    const from = Math.min(ruleX, metrics.originX);
    const width = Math.abs(ruleX - metrics.originX);
    pack.branch.style.left = `${from}px`;
    pack.branch.style.width = `${Math.max(metrics.col, width)}px`;
    pack.branch.style.top = `${y}px`;
    pack.branch.style.height = `${metrics.line}px`;
    pack.bar.style.transformOrigin = ruleX >= metrics.originX ? 'right center' : 'left center';
  });
}

function drawBranch(section, timeline, start) {
  const pack = section?._branch;
  if (!pack || pack.drawn) return;
  pack.drawn = true;
  if (reduced || !timeline) {
    pack.bar.style.transform = 'none';
    return;
  }
  const at = start || 0;
  timeline.fromTo(pack.bar, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power1.out' }, at);
}

function circleTarget(progress) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const swing = Math.sin(Math.PI * progress);
  if (w < 768) {
    const radius = Math.min(w, h) * (0.34 + 0.05 * swing);
    return {
      x: w + w * 0.02,
      y: bandHeight - radius * 0.72 + progress * h * 0.9,
      radius,
    };
  }
  return {
    x: w + Math.min(w * 0.08, 120) - swing * w * 0.16,
    y: bandHeight - h * 0.22 + progress * h * 1.2,
    radius: h * (0.7 + 0.12 * swing),
  };
}

function applyGauge(progress) {
  if (!mastRule) return;
  const span = Math.max(1, window.innerHeight - bandHeight);
  const filled = progress * span;
  mastRule._fill.style.height = `${filled}px`;
  const row = Math.max(0, Math.round(filled / metrics.row) * metrics.row);
  const y = Math.min(span - metrics.line, row);
  mastRule._mark.style.top = `${y}px`;
  (mastRule._ticks || []).forEach(({ tick }) => {
    const top = parseFloat(tick.style.top);
    tick.classList.toggle('is-lit', top <= y + 0.5);
  });
  mastRule._pulseY = y;
}

function applyCircle(progress) {
  const accent = ledger.querySelector('.ledger-accent');
  if (!accent) return;
  const target = circleTarget(progress);
  accent.style.setProperty('--mask-x', `${target.x}px`);
  accent.style.setProperty('--mask-y', `${target.y}px`);
  accent.style.setProperty('--mask-r', `${target.radius * reveal * breath}px`);
}

function applyHead(progress) {
  const count = headRows.length;
  if (!count) return;
  const base = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
  const index = (base + headDrift) % count;
  if (index === headIndex) return;
  if (headIndex >= 0) {
    headRows[headIndex]?.classList.remove('is-head');
    accentRows[headIndex]?.classList.remove('is-head');
  }
  headIndex = index;
  headRows[index]?.classList.add('is-head');
  accentRows[index]?.classList.add('is-head');
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
  applyGauge(progress);
  applyQuiet();
  clearMast();
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
  document.querySelectorAll('.plot-ink, .line > span, .plate, .note, .action').forEach((el) => {
    el.style.clipPath = 'none';
    el.style.transform = 'none';
  });
  document.querySelectorAll('.plot-pen').forEach((pen) => {
    pen.style.opacity = '0';
  });
  if (cell) cell.style.clipPath = 'inset(0% 0% 0% 0%)';
  ledger.querySelectorAll('.ledger-line').forEach((line) => {
    line.style.opacity = '1';
  });
  if (mastRule) {
    if (mastRule._track) mastRule._track.style.transform = 'none';
    if (mastRule._mark) mastRule._mark.style.opacity = '1';
    mastRule.querySelectorAll('.mast-tick').forEach((tick) => {
      tick.style.opacity = '1';
    });
  }
}

function hostFor(el) {
  if (el.classList.contains('line')) {
    const ink = el.querySelector(':scope > span');
    ink.classList.add('plot-ink');
    let pen = el.querySelector(':scope > .plot-pen');
    if (!pen) {
      pen = document.createElement('i');
      pen.className = 'plot-pen';
      pen.setAttribute('aria-hidden', 'true');
      el.append(pen);
    }
    el.classList.add('plot-line');
    pen.style.width = `${metrics.line}px`;
    return { ink, pen };
  }
  if (el.parentElement?.classList.contains('plot-line')) {
    const pen = el.parentElement.querySelector('.plot-pen');
    pen.style.width = `${metrics.line}px`;
    return { ink: el, pen };
  }
  const host = document.createElement('span');
  host.className = 'plot-line';
  el.parentNode.insertBefore(host, el);
  host.append(el);
  el.classList.add('plot-ink');
  const pen = document.createElement('i');
  pen.className = 'plot-pen';
  pen.setAttribute('aria-hidden', 'true');
  pen.style.width = `${metrics.line}px`;
  host.append(pen);
  return { ink: el, pen };
}

function plotInk(el, tl, at, duration) {
  const { ink, pen } = hostFor(el);
  if (reduced) {
    ink.style.clipPath = 'none';
    pen.style.opacity = '0';
    return;
  }
  tl.fromTo(
    ink,
    { clipPath: 'inset(0 0 0 100%)' },
    { clipPath: 'inset(0 0 0 0%)', duration, ease: 'power1.out' },
    at,
  );
  tl.fromTo(pen, { left: '100%', opacity: 1 }, { left: '0%', opacity: 1, duration, ease: 'power1.out' }, at);
  tl.to(pen, { opacity: 0, duration: 0.08, ease: 'none' }, at + Math.max(0, duration - 0.02));
}

function heroPlots(tl, start) {
  const lines = [...document.querySelectorAll('.room-hero .line')];
  lines.forEach((line, index) => {
    const duration = line.closest('.note') ? 0.62 : 0.8;
    plotInk(line, tl, start + index * 0.12, duration);
  });
  if (heroAction) plotInk(heroAction, tl, start + lines.length * 0.12, 0.5);
}

function plotSection(section) {
  if (reduced || section.dataset.plotted) return;
  section.dataset.plotted = '1';
  const bits = [...section.querySelectorAll('.plate, .note, .action')];
  const tl = gsap.timeline();
  bits.forEach((el, index) => {
    const duration = el.classList.contains('plate') ? 0.74 : 0.55;
    plotInk(el, tl, index * 0.12, duration);
  });
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function ensureRouteLayer() {
  if (!routeLayer) {
    routeLayer = document.createElementNS(SVG_NS, 'svg');
    routeLayer.setAttribute('class', 'route-layer');
  }
  routeLayer.setAttribute('width', `${window.innerWidth}`);
  routeLayer.setAttribute('height', `${window.innerHeight}`);
  routeLayer.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  ledger.append(routeLayer);
}

function routePoints() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const textRight = document.querySelector('.room-hero .placard')?.getBoundingClientRect().right ?? width * 0.4;
  const xs = [];
  const ys = [];
  for (let x = metrics.originX; x <= width - metrics.line; x += metrics.col) {
    if (x > textRight + metrics.col * 0.4) xs.push(snap(x));
  }
  for (let y = bandHeight; y <= height - metrics.row; y += metrics.row) ys.push(snap(y));
  if (xs.length < 2 || ys.length < 2) return null;
  const kind = ['right', 'tr', 'br'][Math.floor(Math.random() * 3)];
  let x = xs[xs.length - 1];
  let y = ys[Math.floor(Math.random() * ys.length)];
  if (kind === 'tr') {
    x = xs[Math.max(0, xs.length - 1 - Math.floor(Math.random() * Math.min(3, xs.length)))];
    y = ys[0];
  } else if (kind === 'br') {
    x = xs[Math.max(0, xs.length - 1 - Math.floor(Math.random() * Math.min(3, xs.length)))];
    y = ys[ys.length - 1];
  }
  const points = [{ x, y }];
  let horizontal = kind === 'right' || Math.random() < 0.5;
  if (kind !== 'right') horizontal = kind === 'tr' ? false : Math.random() < 0.5;
  const turns = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < turns; i += 1) {
    if (horizontal) {
      const options = xs.filter((nx) => nx !== x);
      if (!options.length) break;
      x = options[Math.floor(Math.random() * options.length)];
    } else {
      const options = ys.filter((ny) => ny !== y);
      if (!options.length) break;
      y = options[Math.floor(Math.random() * options.length)];
    }
    points.push({ x, y });
    horizontal = !horizontal;
  }
  return points.length > 1 ? points : null;
}

function sectionEngaged(id) {
  const section = document.querySelector(id);
  if (!section) return false;
  const rect = section.getBoundingClientRect();
  const visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return visible > 72;
}

function clearMast() {
  const mast = document.querySelector('.mast');
  if (!mast) return;
  const limit = mast.getBoundingClientRect().bottom + 2;
  document.querySelectorAll('.action').forEach((el) => {
    const rect = el.getBoundingClientRect();
    const cover = rect.top < limit && rect.bottom > 0;
    el.style.visibility = cover ? 'hidden' : '';
  });
}

function applyQuiet() {
  const industry = sectionEngaged('#industry');
  const works = sectionEngaged('#works');
  document.body.classList.toggle('is-industry', industry && !works);
  document.body.classList.toggle('is-works', works);
  const quiet = industry || works;
  if (routeLayer) routeLayer.style.visibility = quiet ? 'hidden' : '';
  if (!quiet) return;
  activeRoutes.forEach((route) => route.kill());
  activeRoutes = [];
}

function spawnRoute() {
  if (reduced || document.hidden || !routeLayer || activeRoutes.length >= 2 || sectionEngaged('#industry') || sectionEngaged('#works')) return;
  const points = routePoints();
  if (!points) return;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
  path.setAttribute('stroke-width', `${metrics.line}`);
  const end = points[points.length - 1];
  const node = document.createElementNS(SVG_NS, 'rect');
  const size = 5;
  node.setAttribute('x', `${end.x - size / 2}`);
  node.setAttribute('y', `${end.y - size / 2}`);
  node.setAttribute('width', `${size}`);
  node.setAttribute('height', `${size}`);
  node.setAttribute('opacity', '0');
  routeLayer.append(path, node);
  const length = path.getTotalLength();
  const speed = 150 + Math.random() * 100;
  const duration = Math.max(0.6, length / speed);
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  const state = { killed: false };
  const kill = () => {
    state.killed = true;
    gsap.killTweensOf([path, node]);
    path.remove();
    node.remove();
    activeRoutes = activeRoutes.filter((item) => item !== state);
  };
  state.kill = kill;
  activeRoutes.push(state);
  gsap.to(path, {
    strokeDashoffset: 0,
    duration,
    ease: 'none',
    onComplete: () => {
      if (state.killed) return;
      gsap.fromTo(
        node,
        { opacity: 0.4 },
        {
          opacity: 1,
          duration: 1,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 5,
          onComplete: () => {
            if (state.killed) return;
            gsap.to(path, {
              strokeDashoffset: length,
              duration: Math.max(0.45, duration * 0.75),
              ease: 'power1.in',
              onComplete: () => {
                gsap.to(node, { opacity: 0, duration: 0.2, onComplete: kill });
              },
            });
          },
        },
      );
    },
  });
}

function nudgeCell() {
  if (reduced || document.hidden || !introDone || !cell || !metrics) return;
  const homePlate = plate < 0 ? 0 : plate;
  const box = cellBox(homePlate);
  const token = nudgeToken;
  const dir = box.left - metrics.col >= metrics.originX ? -1 : 1;
  gsap.to(cell, {
    left: box.left + dir * metrics.col + metrics.line,
    top: box.top + metrics.line,
    duration: 0.24,
    ease: 'power2.out',
    overwrite: 'auto',
    onComplete: () => {
      if (token !== nudgeToken || plate !== homePlate) return;
      gsap.to(cell, {
        left: box.left + metrics.line,
        top: box.top + metrics.line,
        duration: 0.24,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    },
  });
}

function scheduleGlint() {
  clearTimeout(glintTimer);
  glintTimer = window.setTimeout(() => {
    if (!document.hidden) spawnRoute();
    if (ambientOn) scheduleGlint();
  }, rand(6000, 9000));
}

function scheduleNudge() {
  clearTimeout(cellTimer);
  cellTimer = window.setTimeout(() => {
    if (!document.hidden) nudgeCell();
    if (ambientOn) scheduleNudge();
  }, rand(18000, 28000));
}

function ambientFrame(now) {
  if (!ambientOn || document.hidden) return;
  breath = 1 + 0.03 * Math.sin((now / 14000) * Math.PI * 2);
  if (now - lastHeadStep >= 4500) {
    lastHeadStep = now;
    headDrift = (headDrift + 1) % Math.max(1, headRows.length);
    headIndex = -1;
    applyHead(scrollProgress());
  }
  if (now - lastPulse >= 4000 && mastRule) {
    lastPulse = now;
    const y = mastRule._pulseY ?? 0;
    const nearest = (mastRule._ticks || []).reduce((best, item) => {
      const top = parseFloat(item.tick.style.top);
      if (!best) return item;
      return Math.abs(top - y) < Math.abs(parseFloat(best.tick.style.top) - y) ? item : best;
    }, null);
    if (nearest) {
      nearest.tick.classList.add('is-pulse');
      window.setTimeout(() => nearest.tick.classList.remove('is-pulse'), 220);
    }
  }
  applyCircle(scrollProgress());
  ambientRaf = requestAnimationFrame(ambientFrame);
}

function startAmbient() {
  if (reduced || ambientOn) return;
  ambientOn = true;
  lastHeadStep = performance.now();
  scheduleGlint();
  scheduleNudge();
  ambientRaf = requestAnimationFrame(ambientFrame);
}

function pauseAmbient() {
  ambientOn = false;
  cancelAnimationFrame(ambientRaf);
  clearTimeout(glintTimer);
  clearTimeout(cellTimer);
  activeRoutes.forEach((route) => route.kill());
  activeRoutes = [];
}

function playIntro(lines) {
  const intro = gsap.timeline();
  intro.fromTo(lines, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0);
  drawMast(intro, 0.35);
  placeCell(0, false);
  intro.fromTo(
    cell,
    { clipPath: 'inset(0 0 100% 100%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, ease: 'power2.out' },
    1.15,
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
    0.45,
  );
  heroPlots(intro, 0.7);
  intro.eventCallback('onComplete', () => {
    introDone = true;
    reveal = 1;
    plate = plateIndex(window.scrollY);
    placeCell(plate, false);
    applyScroll();
    if (!document.hidden) startAmbient();
  });
}

function layout() {
  const lines = build();
  applyScroll();
  if (reduced) {
    reveal = 1;
    introDone = true;
    showType();
    rooms.forEach((section) => {
      drawSectionRule(section, { immediate: true });
      drawBranch(section);
    });
    plate = plateIndex(window.scrollY);
    placeCell(plate, false);
    applyScroll();
    return;
  }
  playIntro(lines);
}

function revealPlacard(section) {
  plotSection(section);
}

function pointOf(el, origin) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - origin.left + rect.width / 2,
    y: rect.top - origin.top + rect.height / 2,
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

function layoutFlow(section) {
  const board = section.querySelector('[data-flow]');
  const svg = board?.querySelector('.flow-svg');
  if (!board || !svg) return null;
  const width = board.clientWidth;
  const height = board.clientHeight;
  if (width < 2 || height < 2) return null;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const origin = board.getBoundingClientRect();
  const square = (name) => pointOf(board.querySelector(`[data-node="${name}"] .sq`), origin);
  const insurer = square('insurer');
  const denied = square('denied');
  const appeal = square('appeal');
  const practice = square('practice');
  const deniedCopy = board.querySelector('[data-node="denied"] .node-copy').getBoundingClientRect();
  const narrow = window.innerWidth <= 759;
  let main;
  let leak;
  let curve;
  const rejoin = square('rejoin');
  if (narrow) {
    const rail = insurer.left + insurer.width + 6;
    main = `M ${rail} ${insurer.y} V ${practice.y}`;
    leak = `M ${rail} ${denied.y} V ${appeal.y}`;
    curve = `M ${appeal.left + appeal.width} ${appeal.y} Q ${rail + 2} ${(appeal.y + rejoin.y) / 2} ${rail} ${rejoin.y}`;
  } else {
    const gutter = denied.left - 16;
    const lowY = Math.max(appeal.y, deniedCopy.bottom - origin.top + 22);
    main = `M ${insurer.x} ${insurer.y} H ${practice.x}`;
    leak = `M ${denied.x} ${denied.y} H ${gutter} V ${appeal.y} H ${appeal.x}`;
    curve = `M ${appeal.x} ${appeal.y} C ${rejoin.x} ${lowY}, ${rejoin.x} ${(lowY + rejoin.y) / 2}, ${rejoin.x} ${rejoin.y}`;
  }
  const drawn = {
    main: svg.querySelector('[data-draw="main"]'),
    leak: svg.querySelector('[data-draw="leak"]'),
    curve: svg.querySelector('[data-draw="curve"]'),
  };
  drawn.main.setAttribute('d', main);
  drawn.leak.setAttribute('d', leak);
  drawn.curve.setAttribute('d', curve);
  const played = section.dataset.played === '1' || reduced;
  Object.values(drawn).forEach((path) => {
    const length = path.getTotalLength() || 1;
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = played ? '0' : `${length}`;
  });
  return svg;
}

function prepareJourney(section) {
  layoutFlow(section);
  if (reduced) {
    section.querySelectorAll('.sq.is-paid, .step-cell').forEach((el) => {
      el.style.opacity = '1';
    });
    section.querySelectorAll('.step').forEach((step) => {
      step.style.setProperty('--rule', '1');
    });
  }
}

function flowSvg(section) {
  const svg = section.querySelector('.flow-svg');
  if (!svg || !svg.getClientRects().length) return null;
  return svg;
}

function drawJourney(section, tl, start) {
  const svg = flowSvg(section);
  if (!svg) return;
  const paths = [...svg.querySelectorAll('path[data-draw]')];
  paths.forEach((path, index) => {
    const length = path.getTotalLength() || 1;
    path.style.strokeDasharray = `${length}`;
    tl.fromTo(path, { strokeDashoffset: length }, { strokeDashoffset: 0, duration: path.dataset.draw === 'curve' ? 1.15 : 0.85, ease: 'power1.out' }, start + index * 0.16);
  });
  const paid = section.querySelector('.sq.is-paid');
  if (paid) tl.to(paid, { opacity: 1, duration: 0.25, ease: 'none' }, start + Math.max(0.4, paths.length * 0.16));
}

let moneyOn = false;
let moneyRaf = 0;
let moneyStamp = 0;
let moneySpawn = 0;
let moneySerial = 0;
const moneyPackets = [];

function flowPaths(svg) {
  const main = svg.querySelector('[data-draw="main"]');
  const leak = svg.querySelector('[data-draw="leak"]');
  const curve = svg.querySelector('[data-draw="curve"]');
  if (!main || !leak || !curve) return null;
  const mainLen = main.getTotalLength();
  const nearest = (target) => {
    let at = 0;
    let best = Infinity;
    for (let i = 0; i <= 64; i += 1) {
      const d = (mainLen * i) / 64;
      const point = main.getPointAtLength(d);
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      const dist = dx * dx + dy * dy;
      if (dist < best) {
        best = dist;
        at = d;
      }
    }
    return at;
  };
  return {
    svg,
    main,
    leak,
    curve,
    mainLen,
    leakLen: leak.getTotalLength(),
    curveLen: curve.getTotalLength(),
    join: nearest(leak.getPointAtLength(0)),
    rejoin: nearest(curve.getPointAtLength(curve.getTotalLength())),
  };
}

function placePacket(el, path, distance, svg) {
  const point = path.getPointAtLength(Math.max(0, Math.min(distance, path.getTotalLength())));
  const box = svg.viewBox.baseVal;
  el.style.left = `${(point.x / box.width) * 100}%`;
  el.style.top = `${(point.y / box.height) * 100}%`;
}

function spawnPacket(host, divert, appeal) {
  if (moneyPackets.length >= 3) return;
  const el = document.createElement('i');
  el.className = 'packet';
  host.append(el);
  moneyPackets.push({ el, leg: 'main', dist: 0, divert, appeal, hold: 0 });
}

function moneyFrame(now) {
  if (!moneyOn) return;
  moneyRaf = requestAnimationFrame(moneyFrame);
  if (document.hidden) return;
  const section = document.querySelector('.story-industry');
  const svg = section && flowSvg(section);
  const flow = svg && flowPaths(svg);
  const host = svg && svg.parentElement.querySelector('.packets');
  if (!flow || !host) return;
  const dt = Math.min(0.05, (now - moneyStamp) / 1000);
  moneyStamp = now;
  const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width || 1;
  const step = (72 / scale) * dt;
  if (now - moneySpawn > 1900) {
    moneySpawn = now;
    moneySerial += 1;
    spawnPacket(host, moneySerial % 5 === 0, moneySerial % 20 === 0);
  }
  for (let i = moneyPackets.length - 1; i >= 0; i -= 1) {
    const packet = moneyPackets[i];
    if (packet.hold) {
      packet.hold -= dt;
      if (packet.hold <= 0) {
        packet.el.remove();
        moneyPackets.splice(i, 1);
      }
      continue;
    }
    packet.dist += step;
    if (packet.leg === 'main' && packet.divert && packet.dist >= flow.join && packet.dist - step < flow.join) {
      packet.leg = 'leak';
      packet.dist = 0;
    }
    const path = packet.leg === 'leak' ? flow.leak : packet.leg === 'curve' ? flow.curve : flow.main;
    const length = packet.leg === 'leak' ? flow.leakLen : packet.leg === 'curve' ? flow.curveLen : flow.mainLen;
    if (packet.dist >= length) {
      if (packet.leg === 'leak' && packet.appeal) {
        packet.leg = 'curve';
        packet.dist = 0;
        placePacket(packet.el, flow.curve, 0, svg);
        continue;
      }
      if (packet.leg === 'curve') {
        packet.leg = 'main';
        packet.dist = flow.rejoin + 6;
        packet.divert = false;
        placePacket(packet.el, flow.main, packet.dist, svg);
        continue;
      }
      if (packet.leg === 'leak') {
        packet.el.classList.add('is-dim');
        packet.el.style.opacity = '0.14';
        packet.hold = 1.6;
        placePacket(packet.el, flow.leak, length, svg);
        continue;
      }
      packet.el.remove();
      moneyPackets.splice(i, 1);
      continue;
    }
    placePacket(packet.el, path, packet.dist, svg);
    const progress = length ? Math.min(1, packet.dist / length) : 0;
    packet.el.style.opacity = String(0.12 + 0.32 * Math.sin(Math.PI * progress));
  }
}

function startMoney() {
  if (reduced || moneyOn) return;
  moneyOn = true;
  moneyStamp = performance.now();
  moneySpawn = moneyStamp - 1200;
  moneyRaf = requestAnimationFrame(moneyFrame);
}

function stopMoney() {
  moneyOn = false;
  cancelAnimationFrame(moneyRaf);
}

function freezePackets(section) {
  const svg = flowSvg(section);
  const host = svg && svg.parentElement.querySelector('.packets');
  const flow = svg && flowPaths(svg);
  if (!host || !flow) return;
  host.replaceChildren();
  [0.15, 0.4, 0.7].forEach((at) => {
    const el = document.createElement('i');
    el.className = 'packet';
    host.append(el);
    placePacket(el, flow.main, flow.mainLen * at, svg);
  });
  const dim = document.createElement('i');
  dim.className = 'packet is-dim';
  host.append(dim);
  placePacket(dim, flow.leak, flow.leakLen, svg);
}

function enterIndustry(section) {
  if (section.dataset.played) return;
  layoutFlow(section);
  section.dataset.played = '1';
  if (reduced) {
    freezePackets(section);
    return;
  }
  const tl = gsap.timeline();
  drawJourney(section, tl, 0);
  [...section.querySelectorAll('.line')].forEach((line, index) => {
    plotInk(line, tl, 0.2 + index * 0.12, line.closest('.story-title') ? 0.8 : 0.62);
  });
  tl.add(() => startMoney());
}

function enterWorks(section) {
  if (section.dataset.played) return;
  section.dataset.played = '1';
  const steps = [...section.querySelectorAll('.step')];
  const marker = section.querySelector('.step-cell');
  if (reduced) return;
  const tl = gsap.timeline();
  steps.forEach((step, index) => {
    const rule = { value: 0 };
    tl.to(rule, {
      value: 1,
      duration: 0.55,
      ease: 'power1.out',
      onUpdate: () => step.style.setProperty('--rule', rule.value),
    }, index * 0.12);
    const line = step.querySelector('.line');
    if (line) plotInk(line, tl, 0.08 + index * 0.12, 0.62);
  });
  const eyebrow = section.querySelector('.eyebrow .line');
  if (eyebrow) plotInk(eyebrow, tl, 0, 0.55);
  [...section.querySelectorAll('.story-title .line')].forEach((line, index) => {
    plotInk(line, tl, 0.08 + index * 0.12, 0.72);
  });
  if (!marker || !steps.length) return;
  steps.forEach((step, index) => {
    tl.to(marker, { top: step.offsetTop, duration: 0.26, ease: 'power2.out' }, 0.35 + index * 0.28);
  });
}

function boot() {
  paintGrain();
  mountSectionRules();
  mountBranches();
  layout();
  document.querySelectorAll('.story-industry').forEach(prepareJourney);
  rooms.forEach((section) => {
    if (section.classList.contains('room-hero')) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: () => {
        drawSectionRule(section);
        drawBranch(section, gsap.timeline(), 0);
        revealPlacard(section);
      },
    });
  });
  document.querySelectorAll('.story-industry').forEach((section) => {
    if (reduced) {
      enterIndustry(section);
      return;
    }
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: () => enterIndustry(section),
    });
  });
  document.querySelectorAll('.story-works').forEach((section) => {
    if (reduced) {
      enterWorks(section);
      return;
    }
    ScrollTrigger.create({
      trigger: section,
      start: 'top 72%',
      once: true,
      onEnter: () => enterWorks(section),
    });
  });
  if (!reduced) window.addEventListener('scroll', onScroll, { passive: true });
  else window.addEventListener('scroll', () => {
    applyQuiet();
    clearMast();
  }, { passive: true });
  applyQuiet();
  clearMast();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAmbient();
      stopMoney();
    } else if (!reduced) {
      if (introDone) startAmbient();
      if (document.querySelector('.story-industry')?.dataset.played) startMoney();
    }
  });
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
    document.querySelectorAll('.story-industry').forEach((section) => {
      layoutFlow(section);
    });
    moneyPackets.splice(0).forEach((packet) => packet.el.remove());
  } else {
    lines.forEach((line) => {
      line.style.opacity = '0';
    });
    applyScroll();
  }
  ScrollTrigger.refresh();
});
