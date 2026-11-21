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
  const main = document.querySelector('main');
  const rake = document.querySelector('.rake');
  const sheet = document.querySelector('.ledger');
  if (main) {
    if (sheet && sheet.parentElement !== main) main.prepend(sheet);
    if (rake && rake.parentElement !== main) main.prepend(rake);
    if (grain.parentElement !== main) main.prepend(grain);
  }
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

function textZones() {
  const padX = metrics.col * 0.45;
  const padY = metrics.row * 0.55;
  const zones = [];
  document.querySelectorAll('.placard, .story-title, .eyebrow, .works-copy, .flow, .callout-row, .sources, .agent-line').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (rect.bottom < bandHeight || rect.top > window.innerHeight) return;
    zones.push({
      left: rect.left - padX,
      right: rect.right + padX,
      top: rect.top - padY,
      bottom: rect.bottom + padY,
    });
  });
  return zones;
}

function segmentHits(x1, y1, x2, y2, zones) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  return zones.some((zone) => right > zone.left && left < zone.right && bottom > zone.top && top < zone.bottom);
}

function routePoints() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const xs = [];
  const ys = [];
  for (let x = metrics.originX; x <= width - metrics.line; x += metrics.col) xs.push(snap(x));
  const firstRow = snap(Math.ceil((bandHeight + metrics.row) / metrics.row) * metrics.row);
  for (let y = firstRow; y <= height - metrics.row; y += metrics.row) ys.push(snap(y));
  if (xs.length < 5 || ys.length < 5) return null;
  const zones = textZones();
  const minRun = 2;
  for (let attempt = 0; attempt < 28; attempt += 1) {
    const up = Math.random() < 0.5;
    const legs = 2 + Math.floor(Math.random() * 3);
    const startXI = Math.min(
      xs.length - minRun - 1,
      Math.max(1, Math.floor(xs.length * 0.42) + Math.floor(Math.random() * Math.max(1, xs.length * 0.28))),
    );
    const startYI = minRun + Math.floor(Math.random() * Math.max(1, ys.length - minRun * 2));
    let xi = startXI;
    let yi = Math.min(ys.length - minRun - 1, Math.max(minRun, startYI));
    const points = [{ x: xs[xi], y: ys[yi] }];
    let horizontal = Math.random() < 0.5;
    let movedRight = false;
    let movedVert = false;
    let ok = true;
    for (let leg = 0; leg < legs; leg += 1) {
      if (horizontal) {
        const room = xs.length - 1 - xi;
        if (room < minRun) {
          ok = false;
          break;
        }
        const step = minRun + Math.floor(Math.random() * Math.min(3, room - minRun + 1));
        const next = xi + step;
        if (segmentHits(xs[xi], ys[yi], xs[next], ys[yi], zones)) {
          ok = false;
          break;
        }
        xi = next;
        movedRight = true;
      } else {
        const dir = up ? -1 : 1;
        const room = dir < 0 ? yi : ys.length - 1 - yi;
        if (room < minRun) {
          ok = false;
          break;
        }
        const step = minRun + Math.floor(Math.random() * Math.min(4, room - minRun + 1));
        const next = yi + dir * step;
        if (segmentHits(xs[xi], ys[yi], xs[xi], ys[next], zones)) {
          ok = false;
          break;
        }
        yi = next;
        movedVert = true;
      }
      points.push({ x: xs[xi], y: ys[yi] });
      horizontal = !horizontal;
    }
    if (!ok || !movedRight || !movedVert || points.length < 3) continue;
    return points;
  }
  return null;
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
  if (reduced || document.hidden || !routeLayer || activeRoutes.length >= 1 || sectionEngaged('#industry') || sectionEngaged('#works')) return;
  const points = routePoints();
  if (!points) return;
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const probe = document.createElementNS(SVG_NS, 'path');
  probe.setAttribute('d', d);
  routeLayer.append(probe);
  const length = probe.getTotalLength();
  probe.remove();
  const tail = Math.min(length * 0.42, Math.max(metrics.col + metrics.row, metrics.col * 1.75));
  if (length < tail + metrics.col) return;
  const layers = [
    { len: tail, opacity: 0.24 },
    { len: tail * 0.58, opacity: 0.51 },
    { len: Math.max(metrics.col * 0.45, tail * 0.22), opacity: 1 },
  ];
  const paths = layers.map((layer) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke-width', `${metrics.line}`);
    path.style.opacity = String(layer.opacity);
    const gap = length + layer.len;
    path.style.strokeDasharray = `${layer.len} ${gap}`;
    path.style.strokeDashoffset = String(layer.len);
    path._tail = layer.len;
    routeLayer.append(path);
    return path;
  });
  const end = points[points.length - 1];
  const size = Math.max(4, metrics.line * 5);
  const node = document.createElementNS(SVG_NS, 'rect');
  node.setAttribute('width', `${size}`);
  node.setAttribute('height', `${size}`);
  node.setAttribute('opacity', '0');
  routeLayer.append(node);
  const cornerAt = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const head = { dist: 0 };
  const duration = length / (78 + Math.random() * 28);
  const state = { killed: false };
  const kill = () => {
    state.killed = true;
    gsap.killTweensOf([head, node, ...paths]);
    paths.forEach((path) => path.remove());
    node.remove();
    if (routeLayer) delete routeLayer.dataset.turn;
    activeRoutes = activeRoutes.filter((item) => item !== state);
  };
  state.kill = kill;
  activeRoutes.push(state);
  gsap.to(head, {
    dist: length,
    duration,
    ease: 'none',
    onUpdate: () => {
      if (state.killed) return;
      const at = head.dist;
      paths.forEach((path) => {
        path.style.strokeDashoffset = String(path._tail - at);
      });
      const point = paths[0].getPointAtLength(Math.min(at, length));
      node.setAttribute('x', `${point.x - size / 2}`);
      node.setAttribute('y', `${point.y - size / 2}`);
      node.setAttribute('opacity', at > 1 ? '0.85' : '0');
      if (routeLayer && at >= cornerAt && at <= cornerAt + tail) routeLayer.dataset.turn = '1';
    },
    onComplete: () => {
      if (state.killed) return;
      node.setAttribute('x', `${end.x - size / 2}`);
      node.setAttribute('y', `${end.y - size / 2}`);
      if (routeLayer) delete routeLayer.dataset.turn;
      gsap.to(paths, { opacity: 0, duration: 0.4, ease: 'power1.out' });
      gsap.fromTo(node, { opacity: 0.4 }, {
        opacity: 1,
        duration: 0.65,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 3,
        onComplete: () => {
          if (state.killed) return;
          gsap.to(node, { opacity: 0, duration: 0.25, onComplete: kill });
        },
      });
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

function pin(el, x, y) {
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

function headPath(x, y, dir) {
  const back = 11;
  const wing = 5.5;
  if (dir === 'right') return `M ${x - back} ${y - wing} L ${x} ${y} L ${x - back} ${y + wing}`;
  if (dir === 'left') return `M ${x + back} ${y - wing} L ${x} ${y} L ${x + back} ${y + wing}`;
  if (dir === 'down') return `M ${x - wing} ${y - back} L ${x} ${y} L ${x + wing} ${y - back}`;
  return `M ${x - wing} ${y + back} L ${x} ${y} L ${x + wing} ${y + back}`;
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
  const box = (name) => board.querySelector(`[data-box="${name}"]`).getBoundingClientRect();
  const rel = (rect) => ({
    left: rect.left - origin.left,
    right: rect.right - origin.left,
    top: rect.top - origin.top,
    bottom: rect.bottom - origin.top,
    cx: rect.left + rect.width / 2 - origin.left,
    cy: rect.top + rect.height / 2 - origin.top,
  });
  const claim = rel(box('claim'));
  const insurer = rel(box('insurer'));
  const paid = rel(box('paid'));
  const denied = rel(box('denied'));
  const appeal = rel(box('appeal'));
  const never = rel(box('never'));
  const gap = 4;
  const stack = window.innerWidth <= 600;
  const narrow = window.innerWidth <= 759;
  const spine = insurer.cx;
  const paths = {};
  const put = (name, d, x, y, dir) => {
    const shaft = svg.querySelector(`[data-draw="${name}"]`);
    const head = svg.querySelector(`[data-head="${name}"]`);
    shaft.setAttribute('d', d);
    head.setAttribute('d', headPath(x, y, dir));
    paths[name] = shaft;
  };
  if (stack) {
    const head = 11;
    const room = Math.max(16, paid.left - gap - head);
    const run = Math.min(28, room);
    const rail = Math.max(0, paid.left - gap - head - run);
    put('to-insurer', `M ${rail} ${claim.bottom} V ${insurer.top - gap}`, rail, insurer.top - gap, 'down');
    put('to-paid', `M ${rail} ${paid.cy} H ${paid.left - gap}`, paid.left - gap, paid.cy, 'right');
    put('to-denied', `M ${rail} ${insurer.bottom} V ${denied.top - gap}`, rail, denied.top - gap, 'down');
    put('to-appeal', `M ${rail} ${appeal.cy} H ${appeal.left - gap}`, appeal.left - gap, appeal.cy, 'right');
    const loopX = Math.min(width - 16, Math.max(appeal.right, paid.right) + 24);
    put('rejoin', `M ${appeal.right} ${appeal.cy} H ${loopX} V ${paid.cy} H ${paid.right}`, paid.right, paid.cy, 'left');
    put('to-never', `M ${rail} ${denied.bottom} V ${never.top - gap}`, rail, never.top - gap, 'down');
  } else if (narrow) {
    put('to-insurer', `M ${spine} ${claim.bottom} V ${insurer.top - gap}`, spine, insurer.top - gap, 'down');
    put('to-paid', `M ${insurer.right} ${insurer.cy} H ${paid.left - gap}`, paid.left - gap, insurer.cy, 'right');
    put('to-denied', `M ${spine} ${insurer.bottom} V ${denied.top - gap}`, spine, denied.top - gap, 'down');
    put('to-appeal', `M ${denied.right} ${denied.cy} H ${appeal.left - gap}`, appeal.left - gap, denied.cy, 'right');
    put('rejoin', `M ${appeal.cx} ${appeal.top} V ${paid.bottom + gap}`, appeal.cx, paid.bottom + gap, 'up');
    put('to-never', `M ${spine} ${denied.bottom} V ${never.top - gap}`, spine, never.top - gap, 'down');
  } else {
    put('to-insurer', `M ${claim.right} ${claim.cy} H ${insurer.left - gap}`, insurer.left - gap, claim.cy, 'right');
    put('to-paid', `M ${insurer.right} ${insurer.cy} H ${paid.left - gap}`, paid.left - gap, insurer.cy, 'right');
    put('to-denied', `M ${spine} ${insurer.bottom} V ${denied.top - gap}`, spine, denied.top - gap, 'down');
    put('to-appeal', `M ${denied.right} ${denied.cy} H ${appeal.left - gap}`, appeal.left - gap, denied.cy, 'right');
    put('rejoin', `M ${appeal.cx} ${appeal.top} V ${paid.bottom + gap}`, appeal.cx, paid.bottom + gap, 'up');
    put('to-never', `M ${spine} ${denied.bottom} V ${never.top - gap}`, spine, never.top - gap, 'down');
  }
  const win = board.querySelector('[data-stat="win"]');
  if (win) {
    const winW = win.offsetWidth || 72;
    const winH = win.offsetHeight || 36;
    const clear = 18;
    let left;
    let top;
    if (stack) {
      const loopX = Math.min(width - 16, Math.max(appeal.right, paid.right) + 24);
      left = Math.max(4, Math.min(paid.right - winW, loopX - winW - clear));
      top = paid.bottom + 14;
      if (top + winH > denied.top - 12) top = Math.max(paid.bottom + 12, denied.top - winH - 12);
    } else {
      left = appeal.cx + clear;
      top = (paid.bottom + appeal.top) / 2 - winH / 2;
      if (left + winW > width - 2) left = Math.max(4, appeal.cx - winW - clear);
      if (top < paid.bottom + 12) top = paid.bottom + 12;
      if (top + winH > appeal.top - 12) top = Math.max(paid.bottom + 12, appeal.top - winH - 12);
    }
    pin(win, left, top);
  }
  const played = section.dataset.played === '1' || reduced;
  Object.values(paths).forEach((path) => {
    const length = path.getTotalLength() || 1;
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = played ? '0' : `${length}`;
  });
  svg.querySelectorAll('[data-head]').forEach((head) => {
    head.style.opacity = played ? '1' : '0';
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
  const order = ['to-insurer', 'to-paid', 'to-denied', 'to-appeal', 'rejoin', 'to-never'];
  order.forEach((name, index) => {
    const path = svg.querySelector(`[data-draw="${name}"]`);
    const head = svg.querySelector(`[data-head="${name}"]`);
    if (!path) return;
    const length = path.getTotalLength() || 1;
    path.style.strokeDasharray = `${length}`;
    const at = start + index * 0.22;
    tl.fromTo(path, { strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.42, ease: 'power1.out' }, at);
    if (head) tl.to(head, { opacity: 1, duration: 0.12, ease: 'none' }, at + 0.32);
  });
}

let moneyOn = false;
let moneyRaf = 0;
let moneyStamp = 0;
let moneySpawn = 0;
let moneySerial = 0;
let denySerial = 0;
const moneyPackets = [];
const claimSpeed = 68;

function storyOf(svg) {
  return svg?._story || null;
}

function placeOn(el, path, distance) {
  const total = path.getTotalLength() || 0;
  const point = path.getPointAtLength(Math.max(0, Math.min(distance, total)));
  el.style.left = `${point.x}px`;
  el.style.top = `${point.y}px`;
}

function makeClaim(host, className) {
  const el = document.createElement('i');
  el.className = className;
  host.append(el);
  return el;
}

function parkInPile(packet, story) {
  const slot = story.slots.find((item) => !item.taken);
  if (!slot) {
    const oldest = moneyPackets.find((item) => item.leg === 'pile');
    if (oldest) {
      oldest.el.style.opacity = '0';
      oldest.hold = 0.7;
      oldest.leg = 'fade';
      if (oldest.slot) oldest.slot.taken = false;
    }
  }
  const free = story.slots.find((item) => !item.taken) || story.slots[0];
  free.taken = true;
  packet.slot = free;
  packet.leg = 'pile';
  packet.el.style.left = `${free.x}px`;
  packet.el.style.top = `${free.y}px`;
  packet.el.style.opacity = '0.9';
}

function moneyFrame(now) {
  if (!moneyOn) return;
  moneyRaf = requestAnimationFrame(moneyFrame);
  if (document.hidden) return;
  const section = document.querySelector('.story-industry');
  const svg = section && flowSvg(section);
  const story = storyOf(svg);
  const host = svg && svg.parentElement.querySelector('.packets');
  if (!story || !host) return;
  const dt = Math.min(0.05, (now - moneyStamp) / 1000);
  moneyStamp = now;
  if (now - moneySpawn > 1300 && moneyPackets.length < 36) {
    moneySpawn = now;
    moneySerial += 1;
    const deny = moneySerial % 5 === 0;
    const el = makeClaim(host, 'claim');
    moneyPackets.push({ el, leg: 'out', dist: 0, deny, appeal: false, won: false, hold: 0, slot: null });
  }
  for (let i = moneyPackets.length - 1; i >= 0; i -= 1) {
    const packet = moneyPackets[i];
    if (packet.leg === 'pile') continue;
    if (packet.leg === 'wait-loop') {
      packet.hold -= dt;
      if (packet.hold <= 0) {
        packet.leg = 'loop';
        packet.dist = 0;
        packet.el.classList.add('is-loop');
        placeOn(packet.el, story.loop, 0);
      }
      continue;
    }
    if (packet.leg === 'fade') {
      packet.hold -= dt;
      if (packet.hold <= 0) {
        packet.el.remove();
        moneyPackets.splice(i, 1);
      }
      continue;
    }
    const path = story[packet.leg];
    const length = path?.getTotalLength() || 0;
    if (!path || !length) continue;
    packet.dist += claimSpeed * dt;
    if (packet.dist < length) {
      placeOn(packet.el, path, packet.dist);
      continue;
    }
    if (packet.leg === 'out') {
      if (packet.deny) {
        denySerial += 1;
        packet.appeal = denySerial === 1 || denySerial % 8 === 0;
        packet.leg = 'drop';
        packet.dist = 0;
        placeOn(packet.el, story.drop, 0);
        continue;
      }
      packet.leg = 'back';
      packet.dist = 0;
      placeOn(packet.el, story.back, 0);
      continue;
    }
    if (packet.leg === 'drop') {
      if (packet.appeal) {
        packet.hold = 0.85;
        packet.leg = 'wait-loop';
        placeOn(packet.el, story.drop, length);
        continue;
      }
      parkInPile(packet, story);
      continue;
    }
    if (packet.leg === 'loop') {
      packet.won = denySerial % 5 !== 1;
      packet.leg = 'back';
      packet.dist = 0;
      packet.el.classList.remove('is-loop');
      if (packet.won) packet.el.classList.add('is-won');
      placeOn(packet.el, story.back, 0);
      continue;
    }
    packet.el.remove();
    moneyPackets.splice(i, 1);
  }
}

function seedPile(section) {
  return;
  const svg = flowSvg(section);
  const story = storyOf(svg);
  const host = section.querySelector('.packets');
  if (!story || !host) return;
  story.slots.slice(0, Math.min(14, story.slots.length)).forEach((slot) => {
    slot.taken = true;
    const el = makeClaim(host, 'claim');
    el.style.left = `${slot.x}px`;
    el.style.top = `${slot.y}px`;
    el.style.opacity = '0.9';
    moneyPackets.push({ el, leg: 'pile', dist: 0, deny: true, appeal: false, won: false, hold: 0, slot });
  });
}

function startMoney() {
  return;
  if (reduced || moneyOn) return;
  const section = document.querySelector('.story-industry');
  moneyOn = true;
  moneyStamp = performance.now();
  moneySpawn = moneyStamp - 900;
  if (section && moneyPackets.length === 0) seedPile(section);
  moneyRaf = requestAnimationFrame(moneyFrame);
}

function stopMoney() {
  moneyOn = false;
  cancelAnimationFrame(moneyRaf);
}

function freezePackets(section) {
  return;
  const svg = flowSvg(section);
  const host = svg && svg.parentElement.querySelector('.packets');
  const story = storyOf(svg);
  if (!host || !story) return;
  host.replaceChildren();
  [0.18, 0.42, 0.7].forEach((at) => {
    const el = makeClaim(host, 'claim');
    placeOn(el, story.out, story.out.getTotalLength() * at);
  });
  [0.25, 0.6].forEach((at) => {
    const el = makeClaim(host, 'claim');
    placeOn(el, story.back, story.back.getTotalLength() * at);
  });
  const won = makeClaim(host, 'claim is-won');
  placeOn(won, story.back, story.back.getTotalLength() * 0.45);
  story.slots.slice(0, 12).forEach((slot) => {
    const el = makeClaim(host, 'claim');
    el.style.left = `${slot.x}px`;
    el.style.top = `${slot.y}px`;
    slot.taken = true;
  });
}

function enterIndustry(section) {
  if (section.dataset.played) return;
  layoutFlow(section);
  section.dataset.played = '1';
  if (reduced) {
    freezePackets(section);
    return;
  }
  seedPile(section);
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
      moneyPackets.splice(0).forEach((packet) => packet.el.remove());
      if (reduced) freezePackets(section);
      else if (moneyOn) seedPile(section);
    });
  } else {
    lines.forEach((line) => {
      line.style.opacity = '0';
    });
    applyScroll();
  }
  ScrollTrigger.refresh();
});
