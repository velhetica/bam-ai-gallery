import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { createExhibition } from './exhibition.js';

gsap.registerPlugin(ScrollTrigger);

const pixelGrid = document.querySelector('.pixel-grid');

function alignPixelGrid() {
  if (!pixelGrid) return;
  const dpr = window.devicePixelRatio || 1;
  const modulePx = Math.max(1, Math.round(64 * dpr));
  const canvas = document.createElement('canvas');
  canvas.width = modulePx;
  canvas.height = modulePx;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, modulePx, modulePx);
  context.strokeStyle = 'rgba(233, 226, 210, 0.045)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0.5, 0);
  context.lineTo(0.5, modulePx);
  context.moveTo(0, 0.5);
  context.lineTo(modulePx, 0.5);
  context.stroke();
  const wordmark = document.querySelector('.wordmark');
  const origin = wordmark ? wordmark.getBoundingClientRect().left : 0;
  const snapped = Math.round(origin * dpr) / dpr;
  const moduleCss = modulePx / dpr;
  pixelGrid.style.backgroundImage = `url(${canvas.toDataURL()})`;
  pixelGrid.style.backgroundSize = `${moduleCss}px ${moduleCss}px`;
  pixelGrid.style.backgroundPosition = `${snapped}px 0px`;
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

alignPixelGrid();

window.addEventListener('resize', () => {
  exhibition.resize();
  alignPixelGrid();
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
