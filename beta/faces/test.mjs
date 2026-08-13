/* Автотест прототипу осі граней · запуск: node beta/faces/test.mjs
   Перевіряє закони, а не пікселі: якір ядра, 6 сот на грані, речовину,
   DAO DE DO на vlad, одну кімнату іншого на сторону, фолбек хеша, a11y. */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

const pageErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', err => {
  const s = String(err && err.message || err);
  /* jsdom не парсить частину сучасного CSS — це не помилка сторінки */
  if (s.includes('Could not parse CSS')) return;
  pageErrors.push(s);
});

const dom = new JSDOM(html, {
  url: 'http://localhost:8137/beta/faces/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

const { window } = dom;
const { document } = window;
const tick = () => new Promise(r => setTimeout(r, 25));
const goFace = async id => { window.location.hash = '#/' + id; await tick(); };

let passed = 0, failed = 0;
function ok(cond, name){
  if (cond){ passed++; console.log('  ✓ ' + name); }
  else     { failed++; console.log('  ✗ ' + name); }
}

function cellsOf(){ return [...document.querySelectorAll('#cells .cell')]; }
function checkFaceCells(faceId){
  const cs = cellsOf();
  ok(cs.length === 6, faceId + ': 6 сот у g#cells');
  ok(cs.every(c => c.getAttribute('tabindex') === '0'), faceId + ': у всіх сот tabindex=0');
  ok(cs.every(c => (c.getAttribute('aria-label') || '').length > 0), faceId + ': у всіх сот aria-label');
}

const frame = document.getElementById('frame');
const svg = document.getElementById('hive');

console.log('\n137lab · вісь граней · автотест\n');

/* ── структура сцени: два .pulse → g#bg → g#cells → g#core ── */
const layers = [...svg.children].map(n => n.getAttribute('id') || n.getAttribute('class'));
ok(layers.length === 5 &&
   layers[0].includes('pulse') && layers[1].includes('pulse') &&
   layers[2] === 'bg' && layers[3] === 'cells' && layers[4] === 'core',
   'шари: pulse ×2 → g#bg → g#cells → g#core');

/* ── якір: запамʼятовуємо САМ вузол ядра і його геометрію ── */
const coreRef = document.getElementById('core');
const coreD   = coreRef.querySelector('path').getAttribute('d');
const coreNum = coreRef.querySelector('.core-num');
const coreXY  = coreNum.getAttribute('x') + ',' + coreNum.getAttribute('y');

/* ── старт: lab ── */
ok(frame.dataset.face === 'lab', 'старт без хеша → грань lab');
checkFaceCells('lab');

/* ── перехід 1: liza ── */
await goFace('liza');
ok(frame.dataset.face === 'liza', 'хеш #/liza → material liza (щільна)');
checkFaceCells('liza');
ok(document.querySelectorAll('#cells .cell.room').length === 1 &&
   !!document.querySelector('#cells .cell.room[data-id="kimnata-vlada"]'),
   'liza: рівно одна кімната іншого (room) — Кімната Влада');

/* ── перехід 2: vlad ── */
await goFace('vlad');
ok(frame.dataset.face === 'vlad', 'хеш #/vlad → material vlad (розріджена)');
checkFaceCells('vlad');
const dao = document.querySelector('#cells .cell[data-id="daodedo"]');
ok(!!dao && dao.textContent.includes('DAO DE DO'), 'vlad: нода DAO DE DO на місці (slot 0)');
ok(document.querySelectorAll('#cells .cell.room').length === 1 &&
   !!document.querySelector('#cells .cell.room[data-id="kimnata-lizy"]'),
   'vlad: рівно одна кімната іншого (room) — Кімната Лізи');

/* ── закон якоря: після двох переходів #core — ТОЙ ЖЕ вузол DOM ── */
const coreNow = document.getElementById('core');
ok(coreNow === coreRef, 'якір: #core — той самий вузол DOM після двох переходів');
ok(coreNow.querySelector('path').getAttribute('d') === coreD, 'якір: геометрія гекса ядра не змінилась');
ok(coreNow.querySelector('.core-num').getAttribute('x') + ',' +
   coreNow.querySelector('.core-num').getAttribute('y') === coreXY, 'якір: «137» стоїть у тій самій точці');

/* ── невідома грань: #/meta не роняє сторінку і падає в lab ── */
await goFace('meta');
ok(frame.dataset.face === 'lab', 'хеш #/meta → фолбек у lab');
ok(cellsOf().length === 6, 'після #/meta вулик живий: 6 сот lab');

/* ── свайп по зоні гексагонів: механіка DAODEDO — поріг 46px У РУСІ ──
   PointerEvent з явними числовими pointerId: MouseEvent без pointerId
   робить усі id-перевірки вакуумними (undefined === undefined). */
ok(typeof window.PointerEvent === 'function', 'jsdom має PointerEvent — id-перевірки не вакуумні');
function pev(type, x, y, id){
  svg.dispatchEvent(new window.PointerEvent(type, { bubbles:true, clientX:x, clientY:y, pointerId:id }));
}
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));

/* несуча CSS-строка жесту: без touch-action:none браузер шле pointercancel
   посеред свайпу — jsdom цього не відтворить, тому smoke-перевірка тексту */
const styleText = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
ok(styleText.includes('.hivewrap, #hive{touch-action:none}'), 'CSS: touch-action:none на зоні жесту на місці');

/* жест 1: поріг, чужий палець, фліп у русі, один фліп на жест */
pev('pointerdown', 200, 400, 1);
pev('pointermove', 170, 402, 1);       // 30px — ще не поріг
ok(frame.dataset.face === 'lab', 'свайп: 30px не перетинає поріг 46px');
pev('pointermove', 130, 403, 2);       // чужий палець (id=2) за порогом
ok(frame.dataset.face === 'lab', 'мультитач: рух чужого pointerId не фліпає грань');
pev('pointermove', 140, 404, 1);       // 60px вліво своїм → фліп у русі
await tick();
ok(frame.dataset.face === 'vlad', 'свайп ліворуч по гексагонах → Влад ще до pointerup');
pev('pointermove', 110, 404, 1);       // той самий жест тягнеться далі
pev('pointermove', 80, 404, 1);
await tick();
ok(frame.dataset.face === 'vlad' && window.location.hash === '#/vlad' &&
   !svg.classList.contains('springx'), 'один фліп на жест: додаткові рухи не бʼються об стіну');

/* гашення тапа: click тієї ж серії — до setTimeout(0)-скидання */
pev('pointerup', 80, 404, 1);
const dao2 = document.querySelector('#cells .cell[data-id="daodedo"]');
click(dao2);
ok(!frame.classList.contains('open'), 'click тієї ж серії погашено — шторка не відкрилась');
await tick();
click(dao2);
ok(frame.classList.contains('open'), 'чистий тап після скидання відкриває шторку');
esc();
ok(!frame.classList.contains('open'), 'Esc закриває шторку');

/* стіна осі: свайп вліво з vlad — грань і хеш стоять, без #/undefined */
pev('pointerdown', 200, 400, 3);
pev('pointermove', 130, 400, 3);
await tick();
ok(frame.dataset.face === 'vlad' && window.location.hash === '#/vlad',
   'стіна осі: грань vlad і хеш стоять (не телепорт у #/undefined)');
pev('pointerup', 130, 400, 3);
await tick();

/* витік swipeOrigin: після стіни клавіатурний перехід — коловий ритм, не хвиля */
document.dispatchEvent(new window.KeyboardEvent('keydown', { key:'ArrowLeft', bubbles:true }));
await tick();
const circ = [...document.querySelectorAll('#cells .cell')].map(c => parseFloat(c.style.animationDelay));
ok(frame.dataset.face === 'lab', 'клавіатура ←: vlad → lab');
ok(circ.every((d, i) => Math.abs(d - i * 0.05) < 1e-6),
   'після стіни хвиля не приписується жесту, якого не було — коловий ритм i×0.05');

/* свайп праворуч: lab → Ліза; інваріанти хвилі від пальця */
pev('pointerdown', 100, 400, 4);
pev('pointermove', 160, 398, 4);
await tick();
ok(frame.dataset.face === 'liza', 'свайп праворуч → Простір Лізи');
const wave = [...document.querySelectorAll('#cells .cell')].map(c => parseFloat(c.style.animationDelay));
ok(wave.every(d => Number.isFinite(d) && d >= 0 && d <= 0.4),
   'хвиля від пальця: затримки скінченні, 0 ≤ dl ≤ 0.4с');
pev('pointerup', 160, 398, 4);
await tick();

/* pointercancel: системна відміна скидає жест, не цеглить сторінку */
pev('pointerdown', 200, 400, 5);
pev('pointermove', 140, 400, 5);       // liza → lab у русі
await tick();
ok(frame.dataset.face === 'lab', 'жест 5: liza → lab у русі');
pev('pointercancel', 140, 400, 5);
await tick();
pev('pointerdown', 200, 400, 6);
pev('pointermove', 140, 400, 6);
await tick();
ok(frame.dataset.face === 'vlad', 'після pointercancel жест скинуто — новий свайп фліпає');
pev('pointerup', 140, 400, 6);
await tick();
click(document.querySelector('#cells .cell[data-id="daodedo"]'));
ok(frame.classList.contains('open'), 'після cancel-серії чистий тап живий');
esc();

/* вертикаль → пружина, грань стоїть */
pev('pointerdown', 200, 300, 7);
pev('pointermove', 202, 380, 7);
await tick();
ok(frame.dataset.face === 'vlad', 'вертикальний рух — пружина, грань не змінюється');
pev('pointerup', 202, 380, 7);
await tick();

/* ── помилок на сторінці не було ── */
ok(pageErrors.length === 0, 'жодної JS-помилки за весь прогін' +
   (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));

console.log('\n  ' + passed + ' passed · ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
