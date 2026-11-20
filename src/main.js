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

window.addEventListener('resize', () => {
  exhibition.resize();
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
