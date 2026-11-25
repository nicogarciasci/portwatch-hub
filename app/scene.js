'use strict';

/* =========================================================================
   PORTWATCH HUB — módulo separado
   ========================================================================= */

/* =========================================================================
   CENA — céu, skyline e paralaxe
   ========================================================================= */

function buildStars() {
  const wrap = $('#stars');
  if (!wrap) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 90; i += 1) {
    const star = document.createElement('span');
    const size = Math.random() < 0.82 ? 1.2 : 2;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.pow(Math.random(), 1.35) * 68}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.setProperty('--d', `${(3 + Math.random() * 6).toFixed(1)}s`);
    star.style.setProperty('--delay', `${(-Math.random() * 8).toFixed(1)}s`);
    star.style.opacity = String(0.2 + Math.random() * 0.5);
    frag.appendChild(star);
  }
  wrap.appendChild(frag);
}

const SKYLINE_TILE = 1600;

function skylineTile(profile) {
  const base = 160;
  let x = 0;
  let html = '';

  while (x < SKYLINE_TILE - 6) {
    const width = profile.minWidth + Math.random() * profile.widthSpan;
    if (x + width > SKYLINE_TILE - 4) break;

    let height = profile.minHeight + Math.random() * profile.heightSpan;
    if (Math.random() < profile.tallChance) height *= 1.55;

    if (profile.dip) {
      const mid = x + width / 2;
      const distance = Math.min(1, Math.abs(mid / SKYLINE_TILE - 0.58) * 3.4);
      height *= 0.34 + 0.66 * distance;
    }

    height = Math.min(height, base - 2);
    const y = base - height;

    html += `<rect class="bld" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" />`;

    if (height > 48 && Math.random() < profile.antennaChance) {
      const ax = x + width / 2;
      const tip = y - 8 - Math.random() * 16;
      html += `<line class="antenna" x1="${ax.toFixed(1)}" y1="${y.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${tip.toFixed(1)}" />`;
    }

    if (height > profile.windowMin) {
      const cols = Math.max(1, Math.floor(width / 7));
      const rows = Math.max(1, Math.floor(height / 11));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (Math.random() < 0.075) {
            html += `<rect class="win" x="${(x + 3 + c * 7).toFixed(1)}" y="${(y + 5 + r * 11).toFixed(1)}" width="2" height="3" />`;
          }
        }
      }
    }

    x += width + profile.minGap + Math.random() * profile.gapSpan;
  }

  return `<svg class="skyline-tile" viewBox="0 0 1600 160" preserveAspectRatio="none" aria-hidden="true">${html}</svg>`;
}

function buildSkylines() {
  const far = $('#skylineFar');
  const near = $('#skylineNear');
  const reflectFar = $('#skylineReflectFar');
  const reflectNear = $('#skylineReflectNear');

  if (far) {
    const tile = skylineTile({
      minWidth: 10,
      widthSpan: 30,
      minHeight: 8,
      heightSpan: 36,
      tallChance: 0.07,
      antennaChance: 0.14,
      windowMin: 999,
      minGap: 4,
      gapSpan: 8,
      dip: false,
    });
    far.innerHTML = tile.repeat(5);
    if (reflectFar) reflectFar.innerHTML = tile.repeat(5);
  }

  if (near) {
    const tile = skylineTile({
      minWidth: 13,
      widthSpan: 36,
      minHeight: 9,
      heightSpan: 72,
      tallChance: 0.13,
      antennaChance: 0.24,
      windowMin: 56,
      minGap: 4,
      gapSpan: 9,
      dip: true,
    });
    near.innerHTML = tile.repeat(5);
    if (reflectNear) reflectNear.innerHTML = tile.repeat(5);
  }
}

function bindParallax() {
  const scene = $('#scene');
  if (!scene) return;
  let frame = null;
  window.addEventListener('pointermove', (event) => {
    if (state.config.reduceMotion) return;
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      scene.style.setProperty('--mx', x.toFixed(3));
      scene.style.setProperty('--my', y.toFixed(3));
    });
  });
}

function startClock() {
  const tick = () => {
    const clock = $('#clock');
    if (!clock) return;
    const now = new Date();
    clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  window.setInterval(tick, 15000);
}
