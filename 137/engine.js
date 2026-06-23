/* 137lab v4 — движок журея.
   Контент живёт в journey.json — здесь только рендер, переходы, жесты, звук.
   Без фреймворков. Канвас 9:16, --u = ширина канваса / 100. */

(() => {
'use strict';

const frame = document.getElementById('frame');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE_KEY = '137lab-v4-journey';

let DATA = null;
let state = { i: 0, profile: {} };
let activeLayer = null;
let audioCtx = null;          // разблокируется первым жестом
let currentVoice = null;      // активный voice chip
let depthEl = null;

/* ---------- утилиты ---------- */
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const svgIcon = d => {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', d);
  s.appendChild(p);
  return s;
};
const ICON_PLAY = 'M8 5v14l11-7z';
const ICON_PAUSE = 'M6 5h4v14H6zM14 5h4v14h-4z';

const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };
const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } };

function setUnit() {
  document.documentElement.style.setProperty('--u', (frame.clientWidth / 100) + 'px');
}

/* ---------- аудио ---------- */
function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

/* Плейсхолдер войса: тихий двутональный гул через WebAudio.
   Когда появятся реальные файлы — в JSON блока voice добавить src, и зазвучит <audio>. */
function makeVoicePlayer(block, onProgress, onEnd) {
  if (block.src) {
    const a = new Audio(block.src);
    let raf;
    const tick = () => { onProgress(a.currentTime / (a.duration || block.dur || 1)); raf = requestAnimationFrame(tick); };
    a.addEventListener('ended', () => { cancelAnimationFrame(raf); onEnd(); });
    return {
      start() { a.play(); tick(); },
      stop() { a.pause(); a.currentTime = 0; cancelAnimationFrame(raf); }
    };
  }
  let osc1, osc2, gain, t0, raf, stopped = false;
  const dur = block.dur || 15;
  const player = {
    start() {
      unlockAudio();
      if (!audioCtx) { onEnd(); return; }
      gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.4);
      osc1 = audioCtx.createOscillator(); osc1.frequency.value = 137;
      osc2 = audioCtx.createOscillator(); osc2.frequency.value = 205.5;
      osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
      osc1.start(); osc2.start();
      t0 = performance.now();
      const tick = () => {
        const p = (performance.now() - t0) / (dur * 1000);
        if (p >= 1) { player.stop(); onEnd(); return; }
        onProgress(p);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (stopped) return; stopped = true;
      cancelAnimationFrame(raf);
      if (gain && audioCtx) {
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        setTimeout(() => { try { osc1.stop(); osc2.stop(); } catch (e) {} }, 200);
      }
    }
  };
  return player;
}

/* ---------- генеративные Ч/Б фоны ---------- */
function startCanvasBg(canvas, variant) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, raf, running = true;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const t0 = performance.now();

  const draw = {
    /* интерференция: кольца от двух источников — свет и материя */
    interference(t) {
      ctx.clearRect(0, 0, w, h);
      const srcs = [[w * 0.28, h * 0.32], [w * 0.74, h * 0.66]];
      const gap = Math.max(w, h) / 14;
      srcs.forEach(([sx, sy], si) => {
        for (let k = 0; k < 16; k++) {
          const r = ((t * 0.022 + si * gap * 0.5) + k * gap) % (Math.max(w, h) * 1.2);
          const a = Math.max(0, 0.085 * (1 - r / (Math.max(w, h) * 1.2)));
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(10,10,10,${a})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    },
    /* туннель: концентрические рамки, бесконечный зум внутрь (скетч IMG_0914) */
    tunnel(t) {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const N = 11;
      for (let k = 0; k < N; k++) {
        const s = ((k / N) + (t * 0.000045)) % 1;
        const e = Math.pow(s, 1.6);
        const rw = (w * 1.1) * (1 - e), rh = (h * 1.1) * (1 - e);
        const a = 0.16 * Math.sin(Math.PI * s);
        const rad = Math.min(rw, rh) * 0.12;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, rad);
        else ctx.rect(cx - rw / 2, cy - rh / 2, rw, rh);
        ctx.strokeStyle = `rgba(10,10,10,${a})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },
    /* туш: мягкие серые пятна дрейфуют */
    ink(t) {
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < 4; k++) {
        const x = w * (0.5 + 0.38 * Math.sin(t * 0.00005 * (k + 1) + k * 2.1));
        const y = h * (0.5 + 0.38 * Math.cos(t * 0.00004 * (k + 1) + k * 1.3));
        const r = Math.min(w, h) * (0.28 + 0.1 * Math.sin(t * 0.00006 + k));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(10,10,10,0.055)');
        g.addColorStop(1, 'rgba(10,10,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }[variant];

  if (!draw) return null;
  if (REDUCED) { draw(20000); return { stop() {} }; }

  const loop = () => {
    if (!running) return;
    if (!document.hidden) draw(performance.now() - t0 + 20000);
    raf = requestAnimationFrame(loop);
  };
  loop();
  return { stop() { running = false; cancelAnimationFrame(raf); } };
}

/* ---------- блоки ---------- */
function renderBlocks(blocks, scene, content) {
  (blocks || []).forEach(b => {
    switch (b.k) {
      case 'kicker': content.appendChild(el('div', 'b-kicker', b.t)); break;
      case 'title': {
        const n = el('h1', 'b-title', b.t);
        if (b.scale) n.style.fontSize = `calc(var(--u) * ${(11.8 * b.scale).toFixed(2)})`;
        content.appendChild(n); break;
      }
      case 'lead': content.appendChild(el('p', 'b-lead', b.t)); break;
      case 'p': content.appendChild(el('p', 'b-p', b.t)); break;
      case 'numeral': content.appendChild(el('div', 'b-numeral', b.t)); break;
      case 'quote': {
        const q = el('blockquote', 'b-quote', b.t);
        if (b.cite) q.appendChild(el('cite', null, b.cite));
        content.appendChild(q); break;
      }
      case 'chips': {
        const box = el('div', 'b-chips');
        (b.items || []).forEach(c => box.appendChild(el('span', 'chip', c)));
        content.appendChild(box); break;
      }
      case 'voice': content.appendChild(buildVoiceChip(b)); break;
      case 'next': {
        const btn = el('button', 'b-next', b.t);
        btn.addEventListener('click', () => {
          if (b.unlocksAudio) unlockAudio();
          if (b.href){ location.href = b.href; return; }   /* вихід назовні (фінал без email-гейту) */
          if (b.goto) gotoId(b.goto); else next();
        });
        content.appendChild(btn); break;
      }
    }
  });
}

/* voice chip в стиле telegram */
function buildVoiceChip(block) {
  const chip = el('div', 'b-voice');
  const btn = el('button', 'vbtn');
  btn.setAttribute('aria-label', 'відтворити войс');
  btn.appendChild(svgIcon(ICON_PLAY));
  const wave = el('div', 'vwave');
  const bars = [];
  let seed = 137;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 28; i++) {
    const bar = el('i');
    bar.style.height = Math.round(18 + rnd() * 82) + '%';
    wave.appendChild(bar); bars.push(bar);
  }
  const meta = el('div', 'vmeta');
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  meta.appendChild(el('span', 'vlabel', block.label || 'войс'));
  const time = el('span', 'vtime', fmt(block.dur || 15));
  meta.appendChild(time);
  chip.appendChild(btn); chip.appendChild(wave); chip.appendChild(meta);

  let player = null, playing = false;
  const setIcon = d => { btn.replaceChildren(svgIcon(d)); };
  const reset = () => {
    playing = false;
    setIcon(ICON_PLAY);
    bars.forEach(x => x.classList.remove('played'));
    time.textContent = fmt(block.dur || 15);
  };

  chip.addEventListener('click', () => {
    if (playing) { player.stop(); reset(); currentVoice = null; return; }
    if (currentVoice) { currentVoice.stop(); currentVoice.resetUi(); }
    player = makeVoicePlayer(block,
      p => {
        bars.forEach((x, i) => x.classList.toggle('played', i / bars.length <= p));
        time.textContent = fmt((block.dur || 15) * (1 - p));
      },
      () => { reset(); currentVoice = null; });
    currentVoice = { stop: () => player.stop(), resetUi: reset };
    playing = true;
    setIcon(ICON_PAUSE);
    player.start();
  });
  return chip;
}

/* ---------- спец-сцены ---------- */
function renderPact(scene, content) {
  const zone = el('div', 'pact-zone');
  const hold = el('button', 'holdbtn');
  const fill = el('span', 'fill');
  const txt = el('span', 'htext', scene.holdLabel || 'Тримай, щоб підписати');
  hold.appendChild(fill); hold.appendChild(txt);
  const hint = el('div', 'pact-hint', '');
  const decline = el('button', 'declinebtn', scene.declineLabel || 'Ні');

  const HOLD_MS = (scene.holdSeconds || 3) * 1000;
  let t0 = null, raf = null, done = false;

  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
    fill.style.transform = `scaleX(${p})`;
    if (p >= 1) { complete(); return; }
    raf = requestAnimationFrame(tick);
  };
  const start = e => {
    if (done) return;
    e.preventDefault();
    unlockAudio();
    if (hold.setPointerCapture) { try { hold.setPointerCapture(e.pointerId); } catch (err) {} }
    t0 = performance.now();
    fill.style.transition = 'none';
    hint.textContent = '';
    raf = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (done || t0 === null) return;
    cancelAnimationFrame(raf); t0 = null;
    fill.style.transition = 'transform .3s ease';
    fill.style.transform = 'scaleX(0)';
    hint.textContent = 'Підпис — це утримання. Спробуй ще раз, не відпускаючи.';
  };
  const complete = () => {
    done = true; t0 = null;
    hold.classList.add('done');
    txt.textContent = 'Підписано';
    state.profile.pact = true; save();
    if (navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => { scene.onComplete ? gotoId(scene.onComplete) : next(); }, 650);
  };

  hold.addEventListener('pointerdown', start);
  hold.addEventListener('pointerup', cancel);
  hold.addEventListener('pointercancel', cancel);
  hold.addEventListener('pointerleave', cancel);
  hold.addEventListener('contextmenu', e => e.preventDefault());
  decline.addEventListener('click', () => gotoId(scene.onDecline || 'laugh'));

  zone.appendChild(hold); zone.appendChild(hint); zone.appendChild(decline);
  content.appendChild(zone);
}

function renderQuiz(scene, content) {
  const box = el('div', 'quiz-opts');
  (scene.options || []).forEach(o => {
    const btn = el('button', 'quiz-opt');
    btn.appendChild(el('span', 'qkey', o.key));
    btn.appendChild(el('span', null, o.label));
    btn.addEventListener('click', () => {
      box.querySelectorAll('.quiz-opt').forEach(x => { x.disabled = true; });
      btn.classList.add('picked');
      state.profile.quiz = o.key; save();
      setTimeout(next, 550);
    });
    box.appendChild(btn);
  });
  content.appendChild(box);
}

function renderReaction(scene, content) {
  content.appendChild(el('div', 'b-kicker', scene.kicker || ''));
  const key = state.profile.quiz || 'd';
  const text = (scene.variants && scene.variants[key]) || '';
  content.appendChild(el('p', 'b-lead', text));
  const btn = el('button', 'b-next', scene.nextLabel || 'Далі');
  btn.addEventListener('click', next);
  content.appendChild(btn);
}

function renderGate(scene, content) {
  const form = el('form', 'gate-form');
  const input = el('input');
  input.type = 'email'; input.required = true;
  input.placeholder = scene.placeholder || 'email';
  input.autocomplete = 'email';
  const btn = el('button', 'b-next', scene.submitLabel || 'Отримати ключ');
  btn.type = 'submit'; btn.style.marginTop = 'calc(var(--u)*4)';
  form.appendChild(input); form.appendChild(btn);
  form.addEventListener('submit', e => {
    e.preventDefault();
    state.profile.email = input.value; save();
    form.replaceWith(el('p', 'gate-thanks', scene.thanks || 'Прийнято.'));
  });
  content.appendChild(form);
}

/* ---------- бегущая строка ----------
   block: {k:'ticker', t, axis:'h'|'v', edge:'top'|'bottom'|'left'|'right',
           dir:'forward'|'reverse', speed: px/s, size: u, opacity: 0..1} */
function buildTicker(b) {
  const axis = b.axis === 'v' ? 'v' : 'h';
  const edge = b.edge || (axis === 'v' ? 'left' : 'bottom');
  const wrap = el('div', `ticker ${axis} ${edge}`);
  wrap.style.fontSize = `calc(var(--u) * ${b.size || 3.2})`;
  wrap.style.opacity = b.opacity != null ? b.opacity : 0.55;
  const tk = el('div', 'tk');
  const piece = (b.t || '') + ' · ';
  tk.textContent = piece.repeat(14);
  wrap.appendChild(tk);
  if (!REDUCED) {
    requestAnimationFrame(() => {
      const span = (axis === 'h' ? tk.scrollWidth : tk.scrollHeight) / 2;
      if (!span) return;
      const dist = span;
      const dur = (dist / (b.speed || 28)) * 1000;
      const prop = axis === 'h' ? 'translateX' : 'translateY';
      const from = b.dir === 'reverse' ? -dist : 0;
      const to = b.dir === 'reverse' ? 0 : -dist;
      tk.animate(
        [{ transform: `${prop}(${from}px)` }, { transform: `${prop}(${to}px)` }],
        { duration: Math.max(4000, dur), iterations: Infinity }
      );
    });
  }
  return wrap;
}

/* ---------- сцена и переходы ---------- */
function buildLayer(scene) {
  const layer = el('div', 'layer in');
  if (scene.invert) layer.classList.add('inv');

  const bgBox = el('div', 'bg');
  if (scene.bg) {
    if (scene.bg.video) {
      const v = document.createElement('video');
      v.src = scene.bg.video; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      if (scene.bg.bw) v.style.filter = 'grayscale(1)';
      bgBox.appendChild(v);
    } else if (scene.bg.image) {
      const img = document.createElement('img');
      img.src = scene.bg.image; img.alt = '';
      if (scene.bg.bw) img.style.filter = 'grayscale(1)';
      bgBox.appendChild(img);
    } else if (scene.bg.canvas) {
      const c = document.createElement('canvas');
      bgBox.appendChild(c);
      requestAnimationFrame(() => { layer._anim = startCanvasBg(c, scene.bg.canvas); });
    }
  }
  layer.appendChild(bgBox);

  const scrim = el('div', 'scrim');
  const sc = scene.bg || {};
  const scrimColor = sc.scrimColor === 'black' ? '#0a0a0a'
    : sc.scrimColor === 'white' ? '#ffffff' : 'var(--paper)';
  if (sc.scrimGradient === 'bottom') {
    scrim.style.background = `linear-gradient(to top, ${scrimColor} 30%, transparent 85%)`;
  } else if (sc.scrimGradient === 'top') {
    scrim.style.background = `linear-gradient(to bottom, ${scrimColor} 30%, transparent 85%)`;
  } else {
    scrim.style.background = scrimColor;
  }
  scrim.style.opacity = sc.scrim != null ? sc.scrim : 0;
  layer.appendChild(scrim);

  const content = el('div', 'content');
  if (scene.align === 'top') content.style.justifyContent = 'flex-start';
  if (scene.align === 'bottom') content.style.justifyContent = 'flex-end';
  const tickers = (scene.blocks || []).filter(b => b.k === 'ticker');
  renderBlocks((scene.blocks || []).filter(b => b.k !== 'ticker'), scene, content);
  if (scene.type === 'pact') renderPact(scene, content);
  if (scene.type === 'quiz') renderQuiz(scene, content);
  if (scene.type === 'reaction') renderReaction(scene, content);
  if (scene.type === 'gate') renderGate(scene, content);
  layer.appendChild(content);
  tickers.forEach(b => layer.appendChild(buildTicker(b)));

  return layer;
}

function showScene(index) {
  const scene = DATA.scenes[index];
  if (!scene) return;
  state.i = index; save();
  if (currentVoice) { currentVoice.stop(); currentVoice.resetUi(); currentVoice = null; }

  const fresh = buildLayer(scene);
  frame.insertBefore(fresh, depthEl);

  const old = activeLayer;
  activeLayer = fresh;

  if (!old) {
    // первая сцена — мгновенно, без fade: контент виден сразу при открытии
    fresh.style.transition = 'none';
    fresh.classList.remove('in');
    void fresh.offsetHeight;
    setTimeout(() => { fresh.style.transition = ''; }, 60);
  } else {
    setTimeout(() => {
      fresh.classList.remove('in');
      old.classList.add('out');
      setTimeout(() => {
        if (old._anim) old._anim.stop();
        old.remove();
      }, 600);
    }, 20);
  }

  depthEl.textContent = '— ' + (index + 1) + ' / ' + DATA.scenes.length + ' —';
}

const next = () => { if (state.i < DATA.scenes.length - 1) showScene(state.i + 1); };
const gotoId = id => {
  const idx = DATA.scenes.findIndex(s => s.id === id);
  if (idx >= 0) showScene(idx);
};

/* свайп вверх = «глибше» (только на сценах без обязательного действия) */
let touchY = null, touchScroll = 0;
frame.addEventListener('touchstart', e => {
  touchY = e.touches[0].clientY;
  const c = activeLayer && activeLayer.querySelector('.content');
  touchScroll = c ? (c.scrollHeight - c.scrollTop - c.clientHeight) : 0;
}, { passive: true });
frame.addEventListener('touchend', e => {
  if (touchY === null) return;
  const dy = e.changedTouches[0].clientY - touchY;
  touchY = null;
  const scene = DATA && DATA.scenes[state.i];
  if (!scene) return;
  const freeTypes = ['scene', 'reaction'];
  if (dy < -70 && touchScroll < 8 && freeTypes.includes(scene.type)) next();
});

/* ---------- старт ---------- */
depthEl = el('div', 'depthmark');
const restartBtn = el('button', 'restart', '↺ спочатку');
restartBtn.addEventListener('click', () => {
  state = { i: 0, profile: {} }; save(); showScene(0);
});

fetch('journey.json')
  .then(r => r.json())
  .then(d => {
    DATA = d;
    setUnit();
    addEventListener('resize', setUnit);
    frame.appendChild(depthEl);
    frame.appendChild(restartBtn);
    const saved = load();
    if (saved && saved.i > 0 && saved.i < d.scenes.length) state = saved;
    showScene(state.i);
  })
  .catch(err => {
    frame.appendChild(el('p', 'b-p', 'Не вдалося завантажити journey.json: ' + err.message));
  });

})();
