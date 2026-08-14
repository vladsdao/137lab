/* Автотест прототипу осі граней · запуск: node beta/faces/test.mjs
   Перевіряє закони, а не пікселі: якір ядра, 6 сот на грані, шість доменів
   lab і їхній цикл, речовину, DAO DE DO на vlad, одну кімнату іншого на
   сторону, фолбек хеша, a11y. */
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
function dotsOf(){ return [...document.querySelectorAll('#fcompass button.f-dot')]; }
function checkFaceCells(faceId){
  const cs = cellsOf();
  ok(cs.length === 6, faceId + ': 6 сот у g#cells');
  ok(cs.every(c => c.getAttribute('tabindex') === '0'), faceId + ': у всіх сот tabindex=0');
  ok(cs.every(c => (c.getAttribute('aria-label') || '').length > 0), faceId + ': у всіх сот aria-label');
  ok(dotsOf().length === 3, faceId + ': компас — рівно 3 кнопки-двері');
}

const frame = document.getElementById('frame');
const svg = document.getElementById('hive');
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles:true }));
const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
const styleText = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');

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

/* ── грань lab: шість доменів дослідження (фінальний набір 2026-08-14) ──
   кільце читається проти годинникової від верхньої соти як цикл */
const CYCLE = ['СВІТОГЛЯД', 'СТАН', 'РИТМ', 'ПОЛЕ', 'ДОСВІД', 'ПРОЯВ'];
{
  const bySlot = cellsOf();   // renderFace додає соти відсортовані за slot
  const labels = bySlot.map(c => c.textContent);
  ok(new Set(labels).size === 6 && CYCLE.every(w => labels.includes(w)),
     'lab: підписи сот рівно — ' + CYCLE.join(' · '));
  ok(labels[0] === 'СВІТОГЛЯД', 'lab: slot0 (верх) = СВІТОГЛЯД');
  ok(labels[3] === 'ПОЛЕ', 'lab: slot3 (низ) = ПОЛЕ');
  ok([0, 5, 4, 3, 2, 1].map(s => labels[s]).join('·') === CYCLE.join('·'),
     'lab: проти годинникової від верхньої читається цикл, не список');

  /* двері й «скоро» — поведінково, крізь саму шторку: відкриваємо кожну
     соту і дивимось, що в зоні дії — посилання чи чесний статус */
  const doors = [], soons = [];
  let openedAll = true;
  for (const c of bySlot){
    click(c);
    if (!frame.classList.contains('open')) openedAll = false;
    const a = document.querySelector('#sact .s-open');
    const s = document.querySelector('#sact .s-status');
    if (a) doors.push(a.getAttribute('href'));
    if (!a && s && s.textContent === 'скоро') soons.push(c.textContent);
    esc();
    await tick();
  }
  ok(openedAll, 'lab: кожна сота відкриває шторку — і «скоро» теж');
  ok(doors.length === 4, 'lab: чотири соти мають href (двері живі)');
  ok(soons.length === 2 && soons.includes('СВІТОГЛЯД') && soons.includes('РИТМ'),
     'lab: дві соти — «скоро», шторка відкривається, дія чесно неактивна');
  ok(doors.includes('/daodedo/'), 'lab: ДОСВІД — тимчасові двері у /daodedo/');

  /* жодного кольору в спокої: ні інлайн-заливок, ні кольорових атрибутів;
     канон Ч/Б (--paper:#ffffff / --ink:#0a0a0a) на місці */
  ok(bySlot.every(c => {
       const p = c.querySelector('path');
       return !p.getAttribute('fill') && !p.getAttribute('style') && !c.getAttribute('style');
     }) && styleText.includes('--paper:#ffffff') && styleText.includes('--ink:#0a0a0a'),
     'lab: жодна нода не несе кольору/заливки у спокої — Ч/Б канону');
}

/* ── перехід 1: liza ── */
await goFace('liza');
ok(frame.dataset.face === 'liza', 'хеш #/liza → material liza (щільна)');
ok(styleText.includes('#frame[data-face="liza"] .lattice path') &&
   styleText.includes('#frame[data-face="vlad"] .lattice path'),
   'CSS: речовина сторін (щільна/розріджена решітка) перемикається з гранню');
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

/* несуча CSS-строка жесту: без touch-action:none браузер шле pointercancel
   посеред свайпу — jsdom цього не відтворить, тому smoke-перевірка тексту */
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

/* ── компас-двері (БРИФ 02): aria, тап = хеш, якір через нові двері ── */
{
  const comp = document.getElementById('fcompass');
  ok(!comp.hasAttribute('aria-hidden'), 'компас: aria-hidden знято — орган, не декорація');
  ok(dotsOf().every(b => (b.getAttribute('aria-label') || '').length > 0),
     'компас: у кожної кнопки aria-label (імʼя грані)');
  ok(dotsOf().every(b => b.tabIndex >= 0), 'компас: кнопки досяжні з клавіатури (tabindex ≥ 0)');
  const cur = dotsOf().filter(b => b.getAttribute('aria-current') === 'true');
  ok(cur.length === 1 && cur[0].dataset.face === frame.dataset.face,
     'компас: рівно одна aria-current="true" — і це поточна грань');

  /* тап по рисці liza: хеш міняється, hashchange рендерить, якір стоїть */
  click(dotsOf().find(b => b.dataset.face === 'liza'));
  await tick();
  ok(window.location.hash === '#/liza' && frame.dataset.face === 'liza',
     'компас: тап по рисці liza → hash #/liza і грань liza');
  ok(dotsOf().length === 3, 'компас: після навігації — знову рівно 3 кнопки (зона не стрибає)');
  const cur2 = dotsOf().filter(b => b.getAttribute('aria-current') === 'true');
  ok(cur2.length === 1 && cur2[0].dataset.face === 'liza', 'компас: aria-current переїхав на liza');
  const coreAfterDoor = document.getElementById('core');
  ok(coreAfterDoor === coreRef && coreAfterDoor.querySelector('path').getAttribute('d') === coreD,
     'якір: після навігації компасом #core — той самий вузол, та сама геометрія');
  ok(styleText.includes('min-height:115px'),
     'CSS: зона підпису тримає фіксовану висоту 115px');
}

/* ── ЕКСПЕРИМЕНТ · територія жесту: ?ta= керує data-атрибутом ── */
ok(document.documentElement.dataset.ta === 'none',
   'territory: без параметра — режим none (поточна поведінка)');
async function taOf(search){
  const d = new JSDOM(html, { url:'http://localhost:8137/beta/faces/' + search,
    runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc });
  await tick();
  const ta = d.window.document.documentElement.dataset.ta;
  d.window.close();
  return ta;
}
const taP = await taOf('?ta=pany'), taG = await taOf('?ta=guard');
ok(taP === 'pany' && taG === 'guard' && taP !== taG,
   'territory: ?ta=pany і ?ta=guard — різні значення data-ta');
ok(await taOf('?ta=vygadka') === 'none', 'territory: невідоме значення падає в none');

/* ── помилок на сторінці не було ── */
ok(pageErrors.length === 0, 'жодної JS-помилки за весь прогін' +
   (pageErrors.length ? ' — ' + pageErrors.join(' | ') : ''));

console.log('\n  ' + passed + ' passed · ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
