import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
const MAJOR = 'rgba(200, 185, 148, 0.5)';
const ROOM_SPAN = 5;

let metrics = null;
let cell = null;
let baseCol = 0;
let baseRow = 0;
let channel = null;
let posts = [];
let introDone = false;
let intro = null;
let shownStep = 0;

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
  el.style.background = INK_LINE;
  return el;
}

function pxBox(el, x, y, w, h) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

function addCrosshair(x, y, parent = ledger) {
  const mark = document.createElement('div');
  mark.className = 'crosshair';
  const arm = 12;
  const gap = 2;
  const mid = metrics.line / 2;
  const cx = x + mid;
  const cy = y + mid;
  const arms = [
    [cx - gap - arm, cy - mid, arm, metrics.line],
    [cx + gap, cy - mid, arm, metrics.line],
    [cx - mid, cy - gap - arm, metrics.line, arm],
    [cx - mid, cy + gap, metrics.line, arm],
  ];
  arms.forEach(([ax, ay, w, h]) => {
    const piece = document.createElement('div');
    piece.className = 'cross-arm';
    pxBox(piece, ax, ay, w, h);
    mark.append(piece);
  });
  parent.append(mark);
  return mark;
}

function addTicksAlong(x0, y0, x1, y1, horizontal, parent = ledger) {
  const ticks = [];
  const span = horizontal ? x1 - x0 : y1 - y0;
  const step = 16;
  for (let d = 0; d <= span + 0.1; d += step) {
    const along = horizontal ? x0 + d : y0 + d;
    const onModule = horizontal
      ? Math.abs((along - metrics.originX) % metrics.col) < 0.8
      || Math.abs(metrics.col - ((along - metrics.originX) % metrics.col)) < 0.8
      : Math.abs(along % metrics.row) < 0.8
      || Math.abs(metrics.row - (along % metrics.row)) < 0.8;
    const length = onModule ? 11 : 5;
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.dataset.along = String(d / Math.max(span, 1));
    if (horizontal) {
      pxBox(tick, along, y0 + metrics.line, metrics.line, length);
      tick.style.transformOrigin = 'center top';
    } else {
      pxBox(tick, x0 + metrics.line, along, length, metrics.line);
      tick.style.transformOrigin = 'left center';
    }
    parent.append(tick);
    ticks.push(tick);
  }
  return ticks;
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
  cell.style.left = `${metrics.originX + col * metrics.col + metrics.line}px`;
  cell.style.top = `${metrics.originY + row * metrics.row + metrics.line}px`;
  cell.style.width = `${Math.max(1, metrics.col - metrics.line)}px`;
  cell.style.height = `${Math.max(1, metrics.row - metrics.line)}px`;
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
  const topY = metrics.originY + baseRow * metrics.row;
  const leftX = metrics.originX + baseCol * metrics.col;
  const ruleLeft = Math.max(metrics.originX, leftX - metrics.col);
  const ruleRight = Math.min(width - metrics.line, leftX + metrics.col * 3);
  const ruleTop = Math.max(0, topY - metrics.row);
  const ruleBottom = Math.min(height - metrics.line, topY + metrics.row * 2);

  const topRule = document.createElement('div');
  topRule.className = 'major-rule is-h';
  pxBox(topRule, ruleLeft, topY, ruleRight - ruleLeft, metrics.line);
  const bottomRule = document.createElement('div');
  bottomRule.className = 'major-rule is-h';
  pxBox(bottomRule, ruleLeft, topY + metrics.row, ruleRight - ruleLeft, metrics.line);
  const side = document.createElement('div');
  side.className = 'major-rule is-v';
  pxBox(side, leftX, ruleTop, metrics.line, ruleBottom - ruleTop);

  const topTicks = addTicksAlong(ruleLeft, topY, ruleRight, topY, true);
  const bottomTicks = addTicksAlong(ruleLeft, topY + metrics.row, ruleRight, topY + metrics.row, true);
  const sideTicks = addTicksAlong(leftX, ruleTop, leftX, ruleBottom, false);
  const crossTop = addCrosshair(leftX, topY);
  const crossBottom = addCrosshair(leftX, topY + metrics.row);
  const glints = [topRule, side, bottomRule].map(() => {
    const glint = document.createElement('div');
    glint.className = 'glint';
    ledger.append(glint);
    return glint;
  });

  ledger.append(...leftColumns, ...columns, ...rows, topRule, bottomRule, side, cell);
  channel = { topY, leftX, ruleLeft, ruleRight, ruleTop, ruleBottom, topRule, bottomRule, side, topTicks, bottomTicks, sideTicks, crossTop, crossBottom, glints };
  posts = [side];
  shownStep = 0;
  placeCell(0);

  return {
    columns,
    leftColumns,
    rows,
    topRule,
    bottomRule,
    side,
    topTicks,
    bottomTicks,
    sideTicks,
    crossTop,
    crossBottom,
    glints,
    ruleLeft,
    ruleRight,
    ruleTop,
    ruleBottom,
    topY,
    leftX,
  };
}

function engravePost(step, animate) {
  if (!channel || posts[step]) return;
  const col = baseCol + step;
  const x = metrics.originX + col * metrics.col;
  if (x + metrics.col > window.innerWidth - 4) return;
  const y0 = channel.topY;
  const y1 = channel.topY + metrics.row;
  const group = document.createElement('div');
  group.className = 'post';
  const rule = document.createElement('div');
  rule.className = 'major-rule is-v';
  pxBox(rule, x, y0, metrics.line, y1 - y0);
  group.append(rule);
  const ticks = addTicksAlong(x, y0, x, y1, false, group);
  const cross = addCrosshair(x, y0, group);
  ledger.append(group);
  posts[step] = group;
  if (!animate) {
    rule.style.transform = 'none';
    ticks.forEach((tick) => {
      tick.style.opacity = '1';
    });
    cross.style.opacity = '1';
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  tl.fromTo(rule, { scaleY: 0 }, { scaleY: 1, duration: 0.42 }, 0);
  ticks.forEach((tick) => {
    const along = Number(tick.dataset.along) || 0;
    tl.fromTo(tick, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: 'power1.out' }, along * 0.42);
  });
  tl.fromTo(cross, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'power2.out' }, 0.34);
}

function syncPosts(step, animate) {
  for (let i = posts.length - 1; i > step; i -= 1) {
    if (!posts[i] || i === 0) continue;
    posts[i].remove();
    posts[i] = null;
  }
  posts.length = Math.max(1, step + 1);
  for (let i = 1; i <= step; i += 1) engravePost(i, animate);
}

function showSettled() {
  ledger.querySelectorAll('.ledger-line, .tick, .crosshair').forEach((el) => {
    el.style.opacity = '1';
  });
  ledger.querySelectorAll('.major-rule, .ledger-cell').forEach((el) => {
    el.style.transform = 'none';
  });
  ledger.querySelectorAll('.glint').forEach((el) => {
    el.style.opacity = '0';
  });
  if (wordmark) wordmark.style.clipPath = 'none';
  drawSectionRule(document.querySelector('#entrance'));
  heroLines.forEach((line) => {
    line.style.transform = 'none';
  });
  if (heroAction) heroAction.style.clipPath = 'none';
}

function plotRule(rule, ticks, glint, axis, start, duration, cross, crossAt) {
  const scale = axis === 'x' ? 'scaleX' : 'scaleY';
  intro.fromTo(rule, { [scale]: 0 }, { [scale]: 1, duration, ease: 'power2.inOut' }, start);
  ticks.forEach((tick) => {
    const along = Number(tick.dataset.along) || 0;
    intro.fromTo(tick, { opacity: 0 }, { opacity: 1, duration: 0.045, ease: 'power1.out' }, start + along * duration);
  });
  if (glint) {
    const travel = axis === 'x' ? parseFloat(rule.style.width) - 18 : parseFloat(rule.style.height) - 10;
    glint.style.left = rule.style.left;
    glint.style.top = rule.style.top;
    glint.style.width = axis === 'x' ? '18px' : `${metrics.line}px`;
    glint.style.height = axis === 'x' ? `${metrics.line}px` : '10px';
    intro.fromTo(
      glint,
      { opacity: 1, x: 0, y: 0 },
      { x: axis === 'x' ? Math.max(0, travel) : 0, y: axis === 'y' ? Math.max(0, travel) : 0, duration, ease: 'none' },
      start,
    );
    intro.to(glint, { opacity: 0, duration: 0.1, ease: 'power1.out' }, start + duration);
  }
  if (cross) {
    intro.fromTo(cross, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'power2.out' }, start + crossAt * duration);
  }
}

function playIntro(parts) {
  intro?.kill();
  const minor = [...parts.leftColumns, ...parts.columns, ...parts.rows];
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
      { clipPath: 'inset(0 0% 0 0)', duration: 0.5 },
      0,
    );
  }

  intro.fromTo(minor, { opacity: 0 }, { opacity: 1, duration: 0.48, ease: 'power2.out' }, 0);

  const span = parts.ruleRight - parts.ruleLeft;
  const crossAt = span > 0 ? (parts.leftX - parts.ruleLeft) / span : 0.5;
  plotRule(parts.topRule, parts.topTicks, parts.glints[0], 'x', 0.42, 0.62, parts.crossTop, crossAt);
  plotRule(parts.side, parts.sideTicks, parts.glints[1], 'y', 1.02, 0.5, parts.crossBottom, 1);
  plotRule(parts.bottomRule, parts.bottomTicks, parts.glints[2], 'x', 1.48, 0.55, null, 0);

  intro.add(() => drawSectionRule(document.querySelector('#entrance')), 0.36);
  intro.fromTo(cell, { scaleX: 0 }, { scaleX: 1, duration: 0.32, ease: 'power2.inOut' }, 2.08);

  heroLines.forEach((line, index) => {
    intro.to(line, { y: 0, duration: 0.34, ease: 'power2.out' }, 2.42 + index * 0.15);
  });
  if (heroAction) {
    intro.fromTo(
      heroAction,
      { clipPath: 'inset(100% 0 0 0)' },
      { clipPath: 'inset(0% 0 0 0)', duration: 0.3, ease: 'power2.out' },
      2.42 + heroLines.length * 0.15,
    );
  }
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

function layoutLedger() {
  const step = shownStep;
  const parts = buildLedger();
  if (reduced || introDone) {
    showSettled();
    if (step > 0) syncPosts(step, false);
  } else {
    playIntro(parts);
  }
}

const rooms = document.querySelectorAll('.room');

function mountSectionRules() {
  const dpr = window.devicePixelRatio || 1;
  const line = 1 / dpr;
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

function drawSectionRule(section) {
  const pack = section?._rule;
  if (!pack || pack.drawn) return;
  pack.drawn = true;
  const width = pack.rule.clientWidth || pack.rule.getBoundingClientRect().width;
  const ticks = [];
  for (let x = 0; x <= width + 0.1; x += 16) {
    const tick = document.createElement('div');
    tick.className = 'section-tick';
    const long = Math.abs(x % 96) < 1;
    tick.style.left = `${x}px`;
    tick.style.top = `${pack.line}px`;
    tick.style.width = `${pack.line}px`;
    tick.style.height = `${long ? 11 : 5}px`;
    pack.rule.append(tick);
    ticks.push({ tick, along: width ? Math.min(1, x / width) : 0 });
  }
  const gap = 2;
  const arm = 12;
  const cross = [];
  [
    [-gap - arm, -pack.line / 2, arm, pack.line],
    [gap, -pack.line / 2, arm, pack.line],
    [-pack.line / 2, -gap - arm, pack.line, arm],
    [-pack.line / 2, gap, pack.line, arm],
  ].forEach(([x, y, w, h]) => {
    const piece = document.createElement('div');
    piece.className = 'section-cross';
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.width = `${w}px`;
    piece.style.height = `${h}px`;
    pack.rule.append(piece);
    cross.push(piece);
  });
  if (reduced) {
    pack.bar.style.transform = 'none';
    ticks.forEach(({ tick }) => {
      tick.style.opacity = '1';
    });
    cross.forEach((piece) => {
      piece.style.opacity = '1';
    });
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
  tl.fromTo(pack.bar, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
  ticks.forEach(({ tick, along }) => {
    tl.fromTo(tick, { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'power1.out' }, along * 1);
  });
  tl.fromTo(cross, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'power2.out' }, 0.06);
}

function revealPlacard(section) {
  const placard = section.querySelector('.placard');
  if (!placard || reduced) return;
  gsap.fromTo(placard, { y: 8 }, { y: 0, duration: 0.4, ease: 'power2.out' });
}

function enterPlate(section) {
  const index = Number(section.dataset.room) || 0;
  exhibition.setScroll(index);
  shownStep = index;
  placeCell(index);
  drawSectionRule(section);
  if (index > 0) revealPlacard(section);
}

rooms.forEach((section) => {
  if (section.classList.contains('room-hero')) return;
  ScrollTrigger.create({
    trigger: section,
    start: 'top 72%',
    once: true,
    onEnter: () => enterPlate(section),
  });
});

gsap.ticker.add(() => {
  exhibition.render();
});
gsap.ticker.lagSmoothing(0);

function boot() {
  paintGrain();
  mountSectionRules();
  layoutLedger();
}

if (document.fonts?.ready) document.fonts.ready.then(boot);
else boot();

window.addEventListener('resize', () => {
  exhibition.resize();
  ScrollTrigger.refresh();
  if (reduced || introDone) layoutLedger();
});

requestAnimationFrame(() => {
  ScrollTrigger.refresh();
});

document.fonts?.ready?.then(() => {
  ScrollTrigger.refresh();
});

window.addEventListener('beforeunload', () => {
  exhibition.destroy();
});
