/**
 * Stroke plates for the exhibition.
 * Coordinates are in a right-handed scene: +x right, +y up, +z toward the camera.
 * Dense geometry stays on the right so the left field can hold the placards.
 * `fine` strokes are omitted on small screens.
 */

const CREAM = 0xe9e2d2;
const BRIGHT = 0xe1d3af;

function stroke(points, opts) {
  return {
    points,
    color: CREAM,
    width: 1,
    room: 0,
    opening: false,
    fine: false,
    rig: null,
    rigPosition: null,
    ...opts,
  };
}

function line(x1, y1, x2, y2, z, opts) {
  return stroke([x1, y1, z, x2, y2, z], opts);
}

function seg(x1, y1, z1, x2, y2, z2, opts) {
  return stroke([x1, y1, z1, x2, y2, z2], opts);
}

function arc(cx, cy, z, r, a0, a1, opts) {
  const span = Math.abs(a1 - a0);
  const segments = Math.max(10, Math.ceil(span / (Math.PI / 48)));
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = a0 + ((a1 - a0) * i) / segments;
    points.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
  }
  return stroke(points, opts);
}

function ticks(x0, y0, x1, y1, z, divisions, minor, major, opts) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const marks = [];
  for (let i = 0; i <= divisions; i += 1) {
    const t = i / divisions;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    const majorMark = i % 4 === 0;
    const L = majorMark ? major : minor;
    marks.push(
      line(px, py, px + nx * L, py + ny * L, z, {
        ...opts,
        width: majorMark ? (opts.width || 1) + 0.15 : opts.width || 0.85,
        fine: opts.fine || !majorMark,
      }),
    );
  }
  return marks;
}

export function createStrokes(compact) {
  const strokes = [];

  const push = (item) => {
    if (compact && item.fine) return;
    strokes.push(item);
  };

  const many = (items) => {
    items.forEach(push);
  };

  // Persistent architecture for the later plates. Hidden on the hero.
  push(line(2.45, 2.28, 8.5, 2.28, -13, { room: 'persist', width: 0.75 }));
  push(line(7.65, -2.55, 7.65, 2.6, -13, { room: 'persist', width: 0.75 }));
  push(
    arc(6.7, 1.35, -12.4, 1.85, -0.15, 0.82, {
      room: 'persist',
      width: 0.7,
      fine: true,
    }),
  );
  push(line(2.3, -1.78, 7.9, -1.78, -4.4, { room: 'persist', width: 0.9 }));
  push(line(6.9, -2.15, 6.9, 2.2, -3.5, { room: 'persist', width: 0.9 }));
  push(line(2.15, 2.42, 6.55, 2.42, -1.6, { room: 'persist', width: 0.8 }));
  push(line(5.45, 0.15, 5.45, 2.2, 3.55, { room: 'persist', width: 1.2 }));
  push(line(4.65, 1.62, 6.55, 1.62, 3.95, { room: 'persist', width: 1.05 }));

  // Hero wafer. The flat ledger grid, the route and the inlay live in the page.
  const cx = 6.15;
  const cz = -0.55;
  const radius = 4.55;
  const rim = (r, y, a0, a1) => {
    const steps = Math.max(28, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 80)));
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      points.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    }
    return points;
  };

  const rimStart = 2.22;
  const rimEnd = -0.22;
  push(
    stroke(rim(radius, 0.012, rimStart, rimEnd), {
      room: 0,
      opening: true,
      role: 'rim',
      at: 1.15,
      dur: 1.7,
      width: 1.05,
      opacity: 0.92,
    }),
  );

  const tickCount = compact ? 7 : 13;
  for (let i = 0; i <= tickCount; i += 1) {
    const a = rimStart + ((rimEnd - rimStart) * i) / tickCount;
    const major = i % 3 === 0;
    if (compact && !major) continue;
    const px = cx + Math.cos(a) * radius;
    const pz = cz + Math.sin(a) * radius;
    const len = major ? 0.34 : 0.16;
    push(
      seg(px, 0.012, pz, px, 0.012 + len, pz, {
        room: 0,
        opening: true,
        at: 2.65 + i * 0.065,
        dur: 0.3,
        width: major ? 1.05 : 0.8,
        opacity: major ? 0.92 : 0.62,
        fine: !major,
      }),
    );
  }

  push(
    stroke(rim(radius + 0.045, 0.028, rimStart, rimEnd), {
      room: 0,
      opening: true,
      role: 'horizon',
      at: 5.15,
      dur: 1.75,
      width: 1.65,
      color: BRIGHT,
      opacity: 1,
    }),
  );

  // Plate I. A registration gate. One vertical where the reading aligns.
  push(line(2.35, 1.68, 6.05, 1.68, 0.06, { room: 1, width: 1.05 }));
  push(line(6.05, 1.68, 6.05, -1.18, 0.06, { room: 1, width: 1.05 }));
  push(line(6.05, -1.18, 2.35, -1.18, 0.06, { room: 1, width: 1.05 }));
  push(line(4.2, -1.18, 4.2, 1.68, 0.14, { room: 1, width: 1.45, color: BRIGHT }));

  const corners = [
    [2.35, 1.68],
    [6.05, 1.68],
    [6.05, -1.18],
    [2.35, -1.18],
  ];
  const cornerArms = [
    [1, 0, 0, -1],
    [-1, 0, 0, -1],
    [-1, 0, 0, 1],
    [1, 0, 0, 1],
  ];
  corners.forEach(([x, y], index) => {
    const [hx, hy, vx, vy] = cornerArms[index];
    const arm = 0.18;
    push(line(x, y, x + hx * arm, y + hy * arm, 0.18, { room: 1, width: 0.9 }));
    push(line(x, y, x + vx * arm, y + vy * arm, 0.18, { room: 1, width: 0.9 }));
  });

  many(
    ticks(6.05, -1.18, 2.35, -1.18, 0.02, compact ? 8 : 12, 0.09, 0.2, {
      room: 1,
      width: 0.85,
    }),
  );

  // Plate II. A closed travel limit. One corner is a machined fillet.
  const x0 = 2.5;
  const y0 = -1.22;
  const x1 = 5.95;
  const y1 = 1.58;
  const fillet = 0.4;
  push(line(x0, y0, x1 - fillet, y0, 0.06, { room: 2, width: 1.05 }));
  push(
    arc(x1 - fillet, y0 + fillet, 0.1, fillet, -Math.PI / 2, 0, {
      room: 2,
      width: 1.55,
      color: BRIGHT,
    }),
  );
  push(line(x1, y0 + fillet, x1, y1, 0.06, { room: 2, width: 1.05 }));
  push(line(x1, y1, x0, y1, 0.06, { room: 2, width: 1.05 }));
  push(line(x0, y1, x0, y0, 0.06, { room: 2, width: 1.05 }));
  push(line(x0 - 0.28, y1, x0 - 0.08, y1, 0.16, { room: 2, width: 0.9, fine: true }));
  push(line(x0 - 0.18, y1 - 0.1, x0 - 0.18, y1 + 0.1, 0.16, { room: 2, width: 0.9, fine: true }));

  // Plate III. A ruled card. Even spacing, one column, two entries.
  const rules = [1.66, 0.96, 0.26, -0.44, -1.14];
  rules.forEach((y) => {
    push(line(2.2, y, 6.3, y, 0.04, { room: 3, width: 0.95 }));
  });
  push(line(4.08, 1.66, 4.08, -1.14, 0.1, { room: 3, width: 1.05 }));
  push(line(2.42, 1.06, 3.72, 1.06, 0.16, { room: 3, width: 1.35, color: BRIGHT }));
  push(line(4.32, -0.34, 5.85, -0.34, 0.16, { room: 3, width: 1.35, color: BRIGHT }));
  push(line(2.2, 1.66, 2.2, 1.84, 0.16, { room: 3, width: 0.85, fine: true }));
  push(line(6.3, -1.14, 6.3, -1.32, 0.16, { room: 3, width: 0.85, fine: true }));

  // Plate IV. The line breaks. A right-angle bypass carries it through.
  const breakY = 0.32;
  push(line(2.15, breakY, 3.82, breakY, 0.06, { room: 4, width: 1.15 }));
  push(line(4.72, breakY, 6.4, breakY, 0.06, { room: 4, width: 1.15 }));
  push(line(3.82, breakY, 3.82, -0.58, 0.1, { room: 4, width: 1.05 }));
  push(line(3.82, -0.58, 4.72, -0.58, 0.14, { room: 4, width: 1.6, color: BRIGHT }));
  push(line(4.72, -0.58, 4.72, breakY, 0.1, { room: 4, width: 1.05 }));

  // Plate V. One settled line and a terminus. The room is almost empty.
  push(line(2.1, 0.18, 6.45, 0.18, 0.08, { room: 5, width: 1.3 }));
  push(line(6.45, -0.18, 6.45, 0.62, 0.14, { room: 5, width: 1.15 }));
  push(line(3.45, 0.18, 3.45, 0.4, 0.16, { room: 5, width: 0.9 }));
  push(line(4.7, 0.18, 4.7, 0.4, 0.16, { room: 5, width: 0.9 }));

  return strokes;
}
