const FB_CONFIG = window.APP_CONFIG.FB_CONFIG;
const ADMIN_PIN = window.APP_CONFIG.ADMIN_PIN;
let FB = false;

const cv = document.getElementById('c'),
  ctx = cv.getContext('2d'),
  W = 860,
  H = 640,
  S = 40;

const ST = { x: 140, y: 20, w: 560, h: 360 };
const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

const F = [];
const stands = [
  { x: 110, y: 450, name: 'Trụ T trái (khán giả)' },
  { x: 740, y: 450, name: 'Trụ T phải (khán giả)' }
];
let n = 0;

function add(o) {
  o.id = n++;
  o.int = 0;
  o.col = [255, 255, 255];
  o.strobe = 0;
  F.push(o);
  return o;
}

[[215, 28], [320, 28], [540, 28], [645, 28]].forEach((p, i) =>
  add({
    type: 'par',
    name: 'Par ' + (i + 1) + ' (sàn, đánh phông)',
    x: p[0] + (i < 2 ? 15 : -15),
    y: 62,
    tx: p[0],
    ty: p[1],
    beam: 55,
    dmx: 1 + 7 * i
  })
);

for (let s = 0; s < 2; s++) {
  const sx = stands[s].x, dx = s ? -1 : 1, sy = stands[s].y;
  [0, 1].forEach(i =>
    add({
      type: 'par',
      name: 'Par trụ ' + (s ? 'phải ' : 'trái ') + (i + 1),
      x: sx + dx * 20,
      y: sy - 42 + i * 28,
      tx: s ? 520 : 320,
      ty: i ? 310 : 190,
      beam: 40,
      stand: s,
      dmx: 29 + 7 * (s * 2 + i)
    })
  );
  [0, 1].forEach(i =>
    add({
      type: 'bl',
      name: 'Blinder trụ ' + (s ? 'phải ' : 'trái ') + (i + 1),
      x: sx + dx * 20,
      y: sy + 14 + i * 28,
      tx: s ? 510 : 330,
      ty: i ? 290 : 200,
      beam: 75,
      on: true,
      stand: s,
      dmx: 57 + s * 2 + i
    })
  );
}

add({ type: 'mh', name: 'Moving head 1', x: 165, y: 50, tx: 330, ty: 200, beam: 7, dmx: 65, sweep: 0 });
add({ type: 'mh', name: 'Moving head 2', x: 675, y: 50, tx: 510, ty: 200, beam: 7, dmx: 81, sweep: 0 });

let master = 1, fogOn = false, fogD = 0.5, sel = null, auto = null, drag = null, scene = -1;
const pars = F.filter(f => f.type == 'par'),
  bls = F.filter(f => f.type == 'bl'),
  mhs = F.filter(f => f.type == 'mh');

const mhHome = [[380, 150], [480, 150]];
const SC = [
  ['Tắt hết', () => { F.forEach(f => f.int = 0); }, 'Tối hoàn toàn, dùng để chuyển cảnh.'],
  ['Sáng chung', () => { F.forEach(f => f.int = 0); bls.forEach(f => { f.int = 0.8; f.col = [255, 214, 160]; }); pars.forEach(f => { f.int = 0.7; f.col = [255, 200, 140]; }); }, 'Blinder ấm cùng Par trắng ấm, dùng cho tập dợt và chào khán giả.'],
  ['Ban ngày', () => { F.forEach(f => f.int = 0); pars.forEach(f => { f.int = 0.8; f.col = [255, 245, 225]; }); bls.forEach(f => { f.int = 0.35; f.col = [255, 240, 210]; }); }, 'Sáng đều, tự nhiên.'],
  ['Ban đêm', () => { F.forEach(f => f.int = 0); pars.forEach(f => { f.int = 0.55; f.col = [40, 70, 255]; }); mhs.forEach((f, i) => { f.int = 0.7; f.col = [180, 200, 255]; f.tx = mhHome[i][0]; f.ty = mhHome[i][1]; }); }, 'Par xanh lạnh, moving head làm trăng. Bật khói cho đẹp.'],
  ['Căng thẳng', () => { F.forEach(f => f.int = 0); pars.forEach((f, i) => { f.int = 0.7; f.col = i % 2 ? [255, 20, 20] : [120, 0, 30]; }); mhs.forEach(f => { f.int = 1; f.col = [255, 255, 255]; }); auto = 'tense'; }, 'Đỏ thẫm, hai moving head quét chậm như đèn pha.'],
  ['Tiệc / Spaws', () => { F.forEach(f => f.int = 0.9); auto = 'party'; }, 'Đổi màu liên tục, moving head quét, blinder nháy.']
];

const sc = document.getElementById('scenes');
SC.forEach((s, i) => {
  const b = document.createElement('button');
  b.textContent = (i + 1) + '. ' + s[0];
  b.onclick = () => setScene(i);
  sc.appendChild(b);
});

function setScene(i) {
  auto = null;
  scene = i;
  SC[i][1]();
  document.getElementById('scenenote').textContent = SC[i][2];
  [...sc.children].forEach((b, j) => b.classList.toggle('on', j == i));
  renderSel();
}

addEventListener('keydown', e => {
  if (e.target.tagName != 'INPUT' && e.key >= '1' && e.key <= '6') setScene(+e.key - 1);
});

master_ = document.getElementById('master');
master_.oninput = e => master = e.target.value / 100;

document.getElementById('fog').oninput = e => fogD = e.target.value / 100;
const fb = document.getElementById('fogbtn');
fb.onclick = () => {
  fogOn = !fogOn;
  fb.classList.toggle('on', fogOn);
  fb.textContent = fogOn ? 'Tắt khói' : 'Bật khói';
};

function blinders(k) {
  bls.forEach((f, i) => f.on = k == 4 || (i == 0 || i == 2));
  document.getElementById('b2').classList.toggle('on', k == 2);
  document.getElementById('b4').classList.toggle('on', k == 4);
}
document.getElementById('b2').onclick = () => blinders(2);
document.getElementById('b4').onclick = () => blinders(4);

function renderSel() {
  const d = document.getElementById('sel');
  if (!sel) {
    d.innerHTML = '<h2>Đèn đang chọn</h2><p class="note">Bấm vào một đèn trên sơ đồ để chỉnh.</p>';
    return;
  }
  const f = sel, ch = f.type == 'par' ? '7 kênh' : f.type == 'mh' ? '16 kênh' : '1 kênh';
  d.innerHTML = `<h2>${f.name}</h2><p class="note">Địa chỉ DMX gợi ý: ${String(f.dmx).padStart(3, '0')} (${ch})</p>
 <label><b>Độ sáng</b><input type="range" id="p_int" min="0" max="100" value="${f.int * 100}"></label>
 <label><b>Màu</b><input type="color" id="p_col" value="${hex(f.col)}"></label>
 <label><b>Góc chùm</b><input type="range" id="p_beam" min="${f.type == 'mh' ? 3 : 15}" max="${f.type == 'mh' ? 30 : f.type == 'bl' ? 120 : 70}" value="${f.beam}"></label>
 <label><b>Nháy (strobe)</b><input type="range" id="p_str" min="0" max="20" value="${f.strobe}"></label>
 ${f.type == 'mh' ? `<label><b>Quét tự động</b><input type="checkbox" id="p_sw" ${f.sweep ? 'checked' : ''}></label>` : ''}`;
  
  const $ = i => document.getElementById(i);
  $('p_int').oninput = e => f.int = e.target.value / 100;
  $('p_col').oninput = e => f.col = rgb(e.target.value);
  $('p_beam').oninput = e => f.beam = +e.target.value;
  $('p_str').oninput = e => f.strobe = +e.target.value;
  if ($('p_sw')) $('p_sw').onchange = e => f.sweep = e.target.checked ? 1 : 0;
}

function pt(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
const K = () => {
  const w = cv.getBoundingClientRect().width;
  return w > 0 ? Math.max(1, W / w) : 1;
};

function hitAny(p) {
  const k = K();
  if (sel && Math.hypot(p.x - sel.tx, p.y - sel.ty) < 12 * k) return true;
  if (F.some(f => Math.hypot(p.x - f.x, p.y - f.y) < 13 * k)) return true;
  if ([...actors, ...props].some(o => o.k == 'a' ? Math.hypot(p.x - o.x, p.y - o.y) < 14 * k : o.t == 'tree' ? Math.hypot(p.x - o.x, p.y - o.y) < o.w / 2 : Math.abs(p.x - o.x) < o.w / 2 && Math.abs(p.y - o.y) < Math.max(o.h / 2, 8))) return true;
  return stands.some(s => Math.abs(p.x - s.x) < 18 * k && Math.abs(p.y - s.y) < 60);
}

cv.addEventListener('touchstart', e => {
  const t = e.touches[0], r = cv.getBoundingClientRect();
  if (t && hitAny({ x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height })) e.preventDefault();
}, { passive: false });

cv.onpointerdown = e => {
  const p = pt(e);
  cv.setPointerCapture(e.pointerId);
  if (sel && Math.hypot(p.x - sel.tx, p.y - sel.ty) < 12 * K()) { drag = { k: 'aim', f: sel }; return; }
  for (const f of F) if (Math.hypot(p.x - f.x, p.y - f.y) < 13 * K()) { sel = f; selO = null; drag = { k: 'f', f, ox: p.x - f.x, oy: p.y - f.y }; renderSel(); return; }
  for (const o of [...actors, ...props.slice().reverse()]) {
    const hit = o.k == 'a' ? Math.hypot(p.x - o.x, p.y - o.y) < 14 * K() : (o.t == 'tree' ? Math.hypot(p.x - o.x, p.y - o.y) < o.w / 2 : Math.abs(p.x - o.x) < o.w / 2 && Math.abs(p.y - o.y) < Math.max(o.h / 2, 8));
    if (hit) { selO = o; sel = null; drag = { k: 'o', o, ox: p.x - o.x, oy: p.y - o.y }; renderSel(); return; }
  }
  for (let i = 0; i < 2; i++) {
    const s = stands[i];
    if (Math.abs(p.x - s.x) < 18 * K() && Math.abs(p.y - s.y) < 60) { drag = { k: 's', i, px: p.x, py: p.y }; return; }
  }
  sel = null; selO = null; renderSel();
};

cv.onpointermove = e => {
  if (!drag) return;
  const p = pt(e);
  if (drag.k == 'aim') { drag.f.tx = p.x; drag.f.ty = p.y; }
  else if (drag.k == 'o') { drag.o.x = p.x - drag.ox; drag.o.y = p.y - drag.oy; }
  else if (drag.k == 'f') { const f = drag.f, dx = p.x - drag.ox - f.x, dy = p.y - drag.oy - f.y; f.x += dx; f.y += dy; f.tx += dx; f.ty += dy; }
  else { const dx = p.x - drag.px, dy = p.y - drag.py; drag.px = p.x; drag.py = p.y; stands[drag.i].x += dx; stands[drag.i].y += dy; F.filter(f => f.stand === drag.i).forEach(f => { f.x += dx; f.y += dy; f.tx += dx; f.ty += dy; }); }
};

cv.onpointerup = cv.onpointercancel = () => drag = null;

const fog = [];
for (let i = 0; i < 70; i++) fog.push({ x: Math.random() * ST.w + ST.x, y: Math.random() * ST.h + ST.y, r: 40 + Math.random() * 60, v: Math.random() * 0.3 + 0.1, p: Math.random() * 6 });

function beam(f, t) {
  let I = f.int * master;
  if (f.type == 'bl' && !f.on) I = 0;
  if (I <= 0.01) return;
  if (f.strobe && Math.floor(t * f.strobe * 1.5) % 2) return;

  const [r, g, b] = f.col, dx = f.tx - f.x, dy = f.ty - f.y, L = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx), h = f.beam * Math.PI / 360;
  const fa = fogOn ? 0.04 + fogD * 0.3 : 0.035, k = f.type == 'bl' ? 0.6 : 1;
  const o = 0;
  ctx.save();
  ctx.translate(o, 0);
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.arc(f.x, f.y, L * 1.05, a - h, a + h);
  ctx.closePath();

  let gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, L * 1.05);
  const c = (al) => `rgba(${r},${g},${b},${al})`;
  const bo = f.type == 'mh' ? 2.2 : 1;
  gr.addColorStop(0, c(Math.min(1, fa * bo * I * 1.6)));
  gr.addColorStop(1, c(fa * bo * I * 0.5));
  ctx.fillStyle = gr;
  ctx.fill();

  const pr = Math.max(10, Math.tan(h) * L);
  ctx.translate(dx * 0.0, 0);
  const pg = ctx.createRadialGradient(f.tx, f.ty, 0, f.tx, f.ty, pr * 1.25);
  const pa = (f.type == 'mh' ? 0.95 : 0.55 * k) * I;
  pg.addColorStop(0, c(pa));
  pg.addColorStop(0.6, c(pa * 0.5));
  pg.addColorStop(1, c(0));
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(f.tx, f.ty, pr * 1.25, pr * 0.9, a, 0, 7);
  ctx.fill();
  ctx.restore();
}

let last = 0;
function frame(ms) {
  const t = ms / 1000, dt = Math.min(0.05, t - last);
  last = t;
  if (fade) {
    const k = Math.min(1, (t - fade.t0) / fade.secs), e = k * k * (3 - 2 * k);
    F.forEach((f, i) => {
      const a = fade.from[i], b = fade.to[i];
      ['tx', 'ty', 'int', 'beam', 'strobe'].forEach(p => f[p] = a[p] + (b[p] - a[p]) * e);
      f.col = a.col.map((v, j) => v + (b.col[j] - v) * e);
    });
    bgCol = hex(fade.bg0.map((v, j) => v + (fade.bg1[j] - v) * e));
    if (k >= 1) { auto = fade.au; bgCol = fade.bgEnd; fade = null; }
  }

  if (auto == 'party') {
    F.forEach((f, i) => {
      if (f.type != 'bl') {
        const hh = (t * 60 + i * 45) % 360;
        f.col = hsl(hh);
        f.int = 0.95;
      } else {
        f.col = [255, 255, 255];
        f.int = Math.floor(t * 3) % 4 == i ? 1 : 0;
      }
    });
    mhs.forEach((f, i) => {
      f.tx = 430 + Math.sin(t * 1.5 + i * 2) * 200 * (i ? -1 : 1);
      f.ty = 170 + Math.cos(t * 2.1 + i) * 90;
    });
  }

  if (auto == 'tense') {
    mhs.forEach((f, i) => {
      f.tx = 430 + Math.sin(t * 0.5 + i * 3) * 150;
      f.ty = 160 + Math.sin(t * 0.7 + i) * 70;
    });
    pars.forEach((f, i) => f.int = 0.55 + 0.25 * Math.sin(t * 1.2 + i));
  }

  mhs.forEach((f, i) => {
    if (f.sweep && !auto) {
      f.tx = 430 + Math.sin(t * 1.1 + i * 2.5) * 190;
      f.ty = 170 + Math.cos(t * 1.6 + i) * 80;
    }
  });

  if (v3) { draw3(t); requestAnimationFrame(frame); return; }

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#14121a';
  ctx.fillRect(ST.x, ST.y, ST.w, ST.h);
  ctx.strokeStyle = '#201d29';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ST.x; x <= ST.x + ST.w; x += S) { ctx.moveTo(x, ST.y); ctx.lineTo(x, ST.y + ST.h); }
  for (let y = ST.y; y <= ST.y + ST.h; y += S) { ctx.moveTo(ST.x, y); ctx.lineTo(ST.x + ST.w, y); }
  ctx.stroke();

  ctx.fillStyle = bgCol;
  ctx.fillRect(ST.x, ST.y, ST.w, 10);
  ctx.strokeStyle = '#4a4560';
  ctx.strokeRect(ST.x, ST.y, ST.w, ST.h);

  ctx.fillStyle = '#6f6a82';
  ctx.font = '12px sans-serif';
  ctx.fillText('SÂN KHẤU (hậu đài ở trên) · mỗi ô = 1 m', ST.x + 8, ST.y + ST.h - 8);

  ctx.fillStyle = '#1b1923';
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 26; c++)
      ctx.fillRect(ST.x + 8 + c * 21, ST.y + ST.h + 14 + r * 16, 14, 10);

  ctx.fillStyle = '#6f6a82';
  ctx.fillText('KHÁN PHÒNG', ST.x + ST.w / 2 - 35, H - 12);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  F.forEach(f => beam(f, t));

  if (fogOn) {
    const tot = F.reduce((s, f) => s + f.int * master, 0) / F.length;
    fog.forEach(p => {
      p.x += Math.sin(t * 0.3 + p.p) * 0.25 + 0.35;
      p.y -= p.v * 1.5;
      if (p.y < ST.y - 40 || p.x > ST.x + ST.w + 40) {
        p.x = stands[0].x + 20 + Math.random() * 30;
        p.y = stands[0].y + 60 + Math.random() * 20;
      }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      const al = fogD * (0.025 + tot * 0.06);
      g.addColorStop(0, `rgba(200,205,230,${al})`);
      g.addColorStop(1, 'rgba(200,205,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    });
  }

  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  drawObjs();

  ctx.fillStyle = '#6f6a82';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = fogOn ? '#c8cde6' : '#5a5668';
  ctx.fillRect(stands[0].x + 8, stands[0].y + 58, 26, 12);
  ctx.fillStyle = '#6f6a82';
  ctx.fillText('Máy khói', stands[0].x + 8, stands[0].y + 86);

  stands.forEach(s => {
    ctx.fillStyle = '#8a859b';
    ctx.fillRect(s.x - 3, s.y - 60, 6, 120);
    ctx.fillRect(s.x - 16, s.y - 60, 32, 4);
    ctx.fillStyle = '#6f6a82';
    ctx.font = '11px sans-serif';
    ctx.fillText(s.name, s.x - 24, s.y - 68);
  });

  ctx.font = '10px sans-serif';
  F.forEach(f => {
    const on = f.int * master > 0.02 && (f.type != 'bl' || f.on), c = hex(f.col);
    ctx.fillStyle = on ? c : '#3a3648';
    ctx.strokeStyle = f === sel ? '#ffb347' : '#a39db4';
    ctx.lineWidth = f === sel ? 2.5 : 1;
    ctx.beginPath();
    if (f.type == 'mh') {
      ctx.moveTo(f.x, f.y - 10);
      ctx.lineTo(f.x + 10, f.y);
      ctx.lineTo(f.x, f.y + 10);
      ctx.lineTo(f.x - 10, f.y);
    } else if (f.type == 'bl') {
      ctx.rect(f.x - 8, f.y - 6, 16, 12);
    } else {
      ctx.arc(f.x, f.y, 8, 0, 7);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (f.type == 'bl' && !f.on) {
      ctx.strokeStyle = '#f55';
      ctx.beginPath();
      ctx.moveTo(f.x - 8, f.y - 6);
      ctx.lineTo(f.x + 8, f.y + 6);
      ctx.stroke();
    }
  });

  if (sel) {
    ctx.strokeStyle = '#ffb347';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sel.x, sel.y);
    ctx.lineTo(sel.tx, sel.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sel.tx, sel.ty, 7, 0, 7);
    ctx.stroke();
  }

  requestAnimationFrame(frame);
}

function hsl(h) {
  const f = n => {
    const k = (n + h / 30) % 12;
    return 255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

let bgCol = '#3a3f6a', selO = null, v3 = false, R, sc3, cam, bd, az = 0, el = 0.3, rad = 15;
const lt = [], actors = [], props = [];

const PT = {
  wall: { n: 'Tường', w: 120, h: 10, ht: 2.6, col: '#8a7a62' },
  plat: { n: 'Bục', w: 100, h: 60, ht: 0.4, col: '#6b5444' },
  table: { n: 'Bàn', w: 50, h: 30, ht: 0.8, col: '#9a6a44' },
  tree: { n: 'Cây', w: 36, h: 36, ht: 3, col: '#2f7a3f' }
};
const AC = ['#d9534f', '#4a90d9', '#e8b630', '#58b368', '#b06ad9', '#e8e8e8'];

function addActor(x, y) {
  if (actors.length < 8) actors.push({ k: 'a', x, y, col: AC[actors.length % 6], n: 'Diễn viên ' + (actors.length + 1) });
}
function addProp(t, x, y) {
  const d = PT[t];
  props.push({ k: 'p', t, x, y, w: d.w, h: d.h, ht: d.ht, col: d.col, n: d.n });
}

addActor(340, 270);
addActor(500, 260);
addProp('table', 420, 200);

const ob = document.getElementById('objbtns');
const mkb = (t, fn) => {
  const b = document.createElement('button');
  b.textContent = t;
  b.onclick = fn;
  ob.appendChild(b);
};

mkb('+ Diễn viên', () => addActor(420, 300));
Object.keys(PT).forEach(k => mkb('+ ' + PT[k].n, () => addProp(k, 420, 180)));

document.getElementById('del').onclick = () => {
  if (!selO) return;
  const a = selO.k == 'a' ? actors : props;
  a.splice(a.indexOf(selO), 1);
  if (selO._m && sc3) sc3.remove(selO._m);
  selO = null;
};
document.getElementById('bgc').oninput = e => bgCol = e.target.value;

function lightAt(x, y) {
  let r = 0, g = 0, b = 0;
  F.forEach(f => {
    let I = f.int * master;
    if (f.type == 'bl' && !f.on) I = 0;
    if (I < 0.01) return;

    const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy), L = Math.hypot(f.tx - f.x, f.ty - f.y) || 1;
    if (d > L * 1.35 || d < 1) return;

    let da = Math.abs(Math.atan2(dy, dx) - Math.atan2(f.ty - f.y, f.tx - f.x));
    if (da > Math.PI) da = 2 * Math.PI - da;

    const h = f.beam * Math.PI / 360 * 1.15;
    if (da > h) return;

    const k = I * (1 - 0.5 * da / h) * (f.type == 'mh' ? 0.9 : 0.7);
    r += k * f.col[0] / 255;
    g += k * f.col[1] / 255;
    b += k * f.col[2] / 255;
  });
  return [r, g, b];
}

function lit(c, l) {
  return hex(rgb(c).map((x, i) => Math.min(255, x * (0.1 + l[i] * 1.1))));
}

function drawObjs() {
  ctx.font = '10px sans-serif';
  props.forEach(p => {
    ctx.fillStyle = lit(p.col, lightAt(p.x, p.y));
    ctx.beginPath();
    if (p.t == 'tree') ctx.arc(p.x, p.y, p.w / 2, 0, 7);
    else ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.fill();
    ctx.strokeStyle = p === selO ? '#ffb347' : '#4a4560';
    ctx.lineWidth = p === selO ? 2.5 : 1;
    ctx.stroke();
    ctx.fillStyle = '#9a94a8';
    ctx.fillText(p.n, p.x - 10, p.y + (p.h > 14 ? 3 : -8));
  });

  actors.forEach(a => {
    const l = lightAt(a.x, a.y);
    ctx.fillStyle = lit(a.col, l);
    ctx.beginPath();
    ctx.arc(a.x, a.y, 10, 0, 7);
    ctx.fill();
    ctx.fillStyle = lit('#e0b890', l);
    ctx.beginPath();
    ctx.arc(a.x, a.y, 5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = a === selO ? '#ffb347' : '#4a4560';
    ctx.lineWidth = a === selO ? 2.5 : 1;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 10, 0, 7);
    ctx.stroke();
    ctx.fillStyle = '#9a94a8';
    ctx.fillText(a.n, a.x - 24, a.y + 23);
  });
}

const mx = x => (x - 420) / S, mz = y => (y - 200) / S;
const H3 = f => f.type == 'mh' ? 0.3 : f.stand === undefined ? 0.25 : f.type == 'bl' ? 2.8 : 3.3,
  T3 = f => f.type == 'mh' ? 0.2 : f.stand === undefined ? 3 : 0.9,
  GN = { par: 2.2, bl: 1.6, mh: 4 };

const M3 = c => new THREE.MeshLambertMaterial({ color: c });

function tex(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  fn(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const TX = {
  wood: () => tex((g, n) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'hsl(30,' + (30 + Math.random() * 12) + '%,' + (30 + Math.random() * 14) + '%)';
      g.fillRect(0, i * 32, n, 32);
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = 'rgba(50,28,10,.22)';
        g.beginPath();
        const y = i * 32 + Math.random() * 30;
        g.moveTo(0, y);
        g.lineTo(n, y + Math.random() * 4 - 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.fillRect(0, i * 32, n, 2);
      g.fillRect((i * 89) % n, i * 32, 2, 32);
    }
  }),
  carpet: () => tex((g, n) => {
    g.fillStyle = '#4a1d26';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,160,160') + ',.12)';
      g.fillRect(Math.random() * n, Math.random() * n, 2, 2);
    }
  }),
  brick: () => tex((g, n) => {
    g.fillStyle = '#8b8378';
    g.fillRect(0, 0, n, n);
    for (let r = 0; r < 10; r++)
      for (let c = -1; c < 8; c++) {
        g.fillStyle = 'hsl(14,' + (40 + Math.random() * 10) + '%,' + (30 + Math.random() * 10) + '%)';
        g.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 25.6 + 1, 30, 23);
      }
  }),
  fabric: () => tex((g, n) => {
    for (let x = 0; x < n; x++) {
      const v = 60 + 28 * Math.sin(x / n * Math.PI * 8) + 6 * Math.sin(x * 0.9);
      g.fillStyle = 'hsl(0,0%,' + v + '%)';
      g.fillRect(x, 0, 1, n);
    }
  })
};

const mapM = (t, c, rx, ry) => {
  t.repeat.set(rx, ry);
  return new THREE.MeshLambertMaterial({ color: c, map: t });
};

function mkFix(f) {
  const g = new THREE.Group(), L = [], dk = M3(f.type == 'mh' ? 0xcfcfd8 : f.type == 'bl' ? 0x5a4a3a : 0x1b1b20);
  const ln = r => {
    const l = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    L.push(l);
    return l;
  };

  if (f.type == 'par') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 16), dk);
    c.rotation.x = Math.PI / 2;
    g.add(c);
    const l = ln(0.15);
    l.position.z = 0.185;
    g.add(l);
  } else if (f.type == 'bl') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.22), dk));
    const l = ln(0.2);
    l.position.z = 0.115;
    g.add(l);
    const rg = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 20), M3(0xd8c27a));
    rg.position.z = 0.117;
    g.add(rg);
  } else {
    const bs = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), dk);
    bs.position.z = -0.25;
    g.add(bs);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 16), dk);
    hd.rotation.x = Math.PI / 2;
    g.add(hd);
    const l = ln(0.1);
    l.position.z = 0.255;
    g.add(l);
    [-0.2, 0.2].forEach(x => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), M3(0x9a9aa4));
      a.position.set(x, 0, -0.1);
      g.add(a);
    });
  }

  const cv2 = document.createElement('canvas');
  cv2.width = 256;
  cv2.height = 64;
  const x = cv2.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.6)';
  x.fillRect(0, 8, 256, 48);
  x.font = 'bold 24px sans-serif';
  x.textAlign = 'center';
  x.fillStyle = f.type == 'par' ? '#ffcf6b' : f.type == 'bl' ? '#ff9a6b' : '#7be0ff';
  x.fillText(f.name.replace(/ \(.*\)/, ''), 128, 40);

  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv2), depthTest: false, transparent: true }));
  s.scale.set(1.8, 0.45, 1);
  return { g, L, s };
}

function init3() {
  const w = document.getElementById('w3');
  R = new THREE.WebGLRenderer({ antialias: true });
  R.setSize(860, 640);
  const e = R.domElement;
  e.style.cssText = 'width:100%;height:auto;display:block;touch-action:none;cursor:grab';
  w.appendChild(e);

  sc3 = new THREE.Scene();
  sc3.background = new THREE.Color(0x050407);
  cam = new THREE.PerspectiveCamera(45, 860 / 640, 0.1, 100);
  sc3.add(new THREE.AmbientLight(0xffffff, 0.12));

  const hall = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mapM(TX.carpet(), 0xffffff, 10, 8));
  hall.rotation.x = -Math.PI / 2;
  hall.position.z = 6;
  sc3.add(hall);

  const stg = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), mapM(TX.wood(), 0xffffff, 3, 2));
  stg.rotation.x = -Math.PI / 2;
  stg.position.y = 0.02;
  sc3.add(stg);

  bd = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mapM(TX.fabric(), bgCol, 3, 1));
  bd.position.set(0, 3, -4.5);
  sc3.add(bd);

  [-1, 1].forEach(s => [-3.3, -0.8].forEach(z => {
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 5.5, 1.6), mapM(TX.fabric(), 0x1a1a1a, 1, 1));
    lg.position.set(s * 7.2, 2.75, z);
    sc3.add(lg);
  }));

  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), M3(0x7a2433), 156),
    mm = new THREE.Matrix4();
  let q = 0;

  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 26; c++) {
      mm.setPosition(mx(ST.x + 15 + c * 21), 0.25, mz(ST.y + ST.h + 19 + r * 16));
      im.setMatrixAt(q++, mm);
    }
  sc3.add(im);

  stands.forEach(s => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6), M3(0x8a859b));
    p.position.set(mx(s.x), 1.8, mz(s.y));
    sc3.add(p);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), M3(0x8a859b));
    tb.position.set(mx(s.x), 3.6, mz(s.y));
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 20), M3(0x555560));
    bs.position.set(mx(s.x), 0.03, mz(s.y));
    sc3.add(tb, bs);
  });

  F.forEach(f => {
    const sp = new THREE.SpotLight(0xffffff, 0, 0, 0.3, 0.35, 1);
    sc3.add(sp, sp.target);
    const cg = new THREE.ConeGeometry(1, 1, 24, 1, true);
    cg.translate(0, -0.5, 0);
    cg.rotateX(-Math.PI / 2);

    const cm = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
    sc3.add(cm);

    const fx = mkFix(f);
    sc3.add(fx.g, fx.s);
    lt.push({ sp, cm, body: fx.g, lens: fx.L, lb: fx.s });
  });

  let dg = null;
  e.onpointerdown = ev => { dg = [ev.clientX, ev.clientY]; e.setPointerCapture(ev.pointerId); };
  e.onpointerup = () => dg = null;
  e.onpointermove = ev => {
    if (!dg) return;
    az -= (ev.clientX - dg[0]) * 0.008;
    el = Math.max(0.02, Math.min(1.3, el + (ev.clientY - dg[1]) * 0.006));
    dg = [ev.clientX, ev.clientY];
  };
  e.onwheel = ev => {
    ev.preventDefault();
    rad = Math.max(6, Math.min(28, rad + ev.deltaY * 0.01));
  };
}

function mk3(o) {
  const g = new THREE.Group();
  if (o.k == 'a') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 12), M3(o.col));
    b.position.y = 0.6;
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), M3(0xe0b890));
    h.position.y = 1.35;
    g.add(b, h);
  } else if (o.t == 'tree') {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1), M3(0x5a3a22));
    t.position.y = 0.5;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.8, o.ht - 0.8, 12), M3(o.col));
    c.position.y = 0.8 + (o.ht - 0.8) / 2;
    g.add(t, c);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(o.w / S, o.ht, o.h / S), mapM(o.t == 'wall' ? TX.brick() : TX.wood(), o.t == 'plat' ? 0xa89886 : 0xffffff, 1, 1));
    b.position.y = o.ht / 2;
    g.add(b);
  }
  sc3.add(g);
  return g;
}

function draw3(t) {
  bd.material.color.set(bgCol);
  F.forEach((f, i) => {
    const o = lt[i];
    let I = f.int * master;
    if (f.type == 'bl' && !f.on) I = 0;
    if (f.strobe && Math.floor(t * f.strobe * 1.5) % 2) I = 0;

    const c = new THREE.Color(f.col[0] / 255, f.col[1] / 255, f.col[2] / 255),
      px = mx(f.x), py = H3(f), pz = mz(f.y),
      tx = mx(f.tx), ty = T3(f), tz = mz(f.ty);

    o.sp.position.set(px, py, pz);
    o.sp.target.position.set(tx, ty, tz);
    o.sp.color = c;
    o.sp.intensity = I * GN[f.type];
    o.sp.angle = Math.max(0.03, f.beam * Math.PI / 360);
    o.body.position.set(px, py, pz);
    o.body.lookAt(tx, ty, tz);

    const kk = 0.15 + 0.85 * Math.min(1, I);
    o.lens.forEach(l => l.material.color.setRGB(c.r * kk, c.g * kk, c.b * kk));
    o.lb.position.set(px, py + 0.6, pz);
    o.lb.visible = document.getElementById('lbl').checked;

    const L = Math.hypot(tx - px, ty - py, tz - pz), r = L * Math.tan(o.sp.angle);
    o.cm.position.set(px, py, pz);
    o.cm.lookAt(tx, ty, tz);
    o.cm.scale.set(r, r, L);
    o.cm.material.color = c;
    o.cm.material.opacity = I * (fogOn ? 0.03 + fogD * 0.12 : 0.008) * (f.type == 'mh' ? 2.5 : 1);
  });

  [...actors, ...props].forEach(o => {
    if (!o._m) o._m = mk3(o);
    o._m.position.set(mx(o.x), 0, mz(o.y));
  });

  cam.position.set(Math.sin(az) * Math.cos(el) * rad, 1.3 + Math.sin(el) * rad, Math.cos(az) * Math.cos(el) * rad);
  cam.lookAt(0, 1.3, 0);
  R.render(sc3, cam);
}

function setView(v) {
  if (v && typeof THREE == 'undefined') {
    alert('Không tải được thư viện 3D. Hãy kiểm tra kết nối mạng.');
    return;
  }
  v3 = v;
  if (v && !R) init3();
  cv.style.display = v ? 'none' : 'block';
  document.getElementById('w3').style.display = v ? 'block' : 'none';
  document.getElementById('v2').classList.toggle('on', !v);
  document.getElementById('v3b').classList.toggle('on', v);
}

document.getElementById('v2').onclick = () => setView(false);
document.getElementById('v3b').onclick = () => setView(true);

const G = id => document.getElementById(id),
  MOODS = ['Vui tươi', 'Căng thẳng', 'Bí ẩn', 'Lãng mạn', 'Ban ngày', 'Ban đêm', 'Khác'];

let db = null, saves = [];

MOODS.forEach(m => {
  G('sv_m').add(new Option(m, m));
  G('sv_f').add(new Option(m, m));
});
G('sv_f').add(new Option('Tất cả mood', ''), 0);
G('sv_f').value = '';
G('sv_f').onchange = () => renderSaves();

const note = t => G('sv_note').textContent = t;

function snap() {
  return JSON.stringify({
    F: F.map(f => ({ x: f.x, y: f.y, tx: f.tx, ty: f.ty, int: f.int, col: f.col, strobe: f.strobe, beam: f.beam, on: f.on, sweep: f.sweep })),
    st: stands.map(s => ({ x: s.x, y: s.y })),
    a: actors.map(({ x, y, col, n }) => ({ x, y, col, n })),
    p: props.map(({ t, x, y, w, h, ht, col, n }) => ({ t, x, y, w, h, ht, col, n })),
    bg: bgCol,
    m: master,
    fog: [fogOn, fogD],
    auto,
    scene
  });
}

function applySnap(str) {
  const s = JSON.parse(str);
  if (!Array.isArray(s.F) || s.F.length != F.length) throw 0;
  s.F.forEach((d, i) => Object.assign(F[i], d));
  s.st.forEach((d, i) => Object.assign(stands[i], d));

  [...actors, ...props].forEach(o => { if (o._m && sc3) sc3.remove(o._m); });
  actors.length = 0;
  props.length = 0;

  s.a.forEach(o => actors.push({ ...o, k: 'a' }));
  s.p.forEach(o => props.push({ ...o, k: 'p' }));

  bgCol = s.bg;
  G('bgc').value = s.bg;
  master = s.m;
  G('master').value = s.m * 100;
  fogOn = s.fog[0];
  fogD = s.fog[1];
  fb.classList.toggle('on', fogOn);
  fb.textContent = fogOn ? 'Tắt khói' : 'Bật khói';
  G('fog').value = fogD * 100;

  const all = bls.every(f => f.on);
  G('b4').classList.toggle('on', all);
  G('b2').classList.toggle('on', !all);

  auto = s.auto;
  scene = s.scene;
  [...sc.children].forEach((b, j) => b.classList.toggle('on', j == scene));
  G('scenenote').textContent = scene >= 0 ? SC[scene][2] : '';
  sel = null;
  selO = null;
  renderSel();
}

const lsGet = () => { try { return JSON.parse(localStorage.getItem('looks') || '{}'); } catch (e) { return {}; } };
const toArr = o => Object.keys(o).map(k => ({ id: k, ...o[k] }));

async function putSave(id, meta) {
  if (!canEd() || needName()) return;
  const d = {
    ...EXP(),
    by: G('g_me').value.trim(),
    name: meta.name,
    group: meta.group,
    gid: meta.gid !== undefined ? meta.gid : curG,
    mood: meta.mood,
    snap: snap(),
    ts: Date.now()
  };
  id = id || Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  try {
    if (db) {
      await db.collection('looks').doc(id).set(d);
    } else {
      const l = lsGet();
      l[id] = d;
      localStorage.setItem('looks', JSON.stringify(l));
      allSaves = toArr(l);
      refilter();
      renderSaves();
    }
    note('Đã lưu "' + meta.name + '".');
    gupd({});
  } catch (e) {
    note('Không lưu được: ' + ((e && (e.message || e.code)) || 'lỗi không rõ'));
  }
}

function two(b, label, fn) {
  const t = b.textContent;
  b.onclick = () => {
    if (b.dataset.arm) {
      clearTimeout(+b.dataset.arm);
      b.dataset.arm = '';
      b.textContent = t;
      fn();
      return;
    }
    b.textContent = label;
    b.dataset.arm = setTimeout(() => {
      b.dataset.arm = '';
      b.textContent = t;
    }, 3000);
  };
}

function renderSaves() {
  renderCues();
  const box = G('saves');
  box.textContent = '';
  const f = G('sv_f').value, arr = saves.filter(s => !f || s.mood === f).sort((a, b) => b.ts - a.ts);

  if (!arr.length) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'Chưa có bản lưu nào.';
    box.appendChild(p);
    return;
  }

  arr.forEach(s => {
    const d = document.createElement('div');
    d.className = 'sv';
    const nm = document.createElement('b');
    nm.textContent = s.name;
    const sm = document.createElement('small');
    sm.textContent = (s.group || 'Chưa ghi nhóm') + ' | ' + s.mood + ' | ' + new Date(s.ts).toLocaleDateString('vi-VN') + (s.by ? ' | ' + s.by : '');
    const r = document.createElement('div');
    r.className = 'row';

    const mb = (t, fn) => {
      const b = document.createElement('button');
      b.textContent = t;
      r.appendChild(b);
      return b;
    };

    mb('Mở').onclick = () => {
      try {
        applySnap(s.snap);
        note('Đã mở "' + s.name + '".');
      } catch (e) {
        note('Bản lưu này bị lỗi, không mở được.');
      }
    };
    two(mb('Ghi đè'), 'Bấm lần nữa để ghi đè', () => putSave(s.id, s));
    two(mb('Xóa'), 'Bấm lần nữa để xóa', async () => {
      if (!canEd()) return;
      try {
        if (db) await db.collection('looks').doc(s.id).delete();
        else {
          const l = lsGet();
          delete l[s.id];
          localStorage.setItem('looks', JSON.stringify(l));
          allSaves = toArr(l);
          refilter();
          renderSaves();
        }
      } catch (e) {
        note('Không xóa được.');
      }
    });

    d.append(nm, sm, r);
    box.appendChild(d);
  });
}

let groups = [], allSaves = [], curG = '', isAdmin = true, unsubC = null, lastKey = null;
try { curG = localStorage.getItem('curG') || ''; } catch (e) {}

const lsGetG = () => { try { return JSON.parse(localStorage.getItem('groups') || '{}'); } catch (e) { return {}; } };
const grp = () => groups.find(g => g.id == curG),
  gname = () => curG ? (grp() || {}).name || '(nhóm đã xóa)' : 'Chung';

const isLocked = () => !!(grp() && grp().locked) && !isAdmin;
const canEd = () => {
  if (isLocked()) {
    note('Nhóm này đang bị khóa, hãy nhờ giáo viên mở khóa.');
    return false;
  }
  return true;
};

const refilter = () => { saves = allSaves.filter(s => (s.gid || '') === curG); };
G('sv_g').closest('label').style.display = 'none';

function gupd(p, id = curG) {
  const g = groups.find(x => x.id == id);
  if (!id || !g) return;
  Object.assign(g, p, { ts: Date.now() });
  try {
    if (db) db.collection('groups').doc(id).update({ ...p, ts: g.ts, ...EXP() }).catch(() => {});
    else {
      const l = lsGetG();
      l[id] = g;
      localStorage.setItem('groups', JSON.stringify(l));
    }
  } catch (e) {}
  initGroups();
}

function gstatus() {
  const g = grp(), b = G('g_submit');
  b.style.display = g ? '' : 'none';
  if (g) b.textContent = (g.status || 'nháp') == 'nháp' ? 'Nộp kịch bản' : 'Nộp lại';
  G('g_st').textContent = g ? ('Trạng thái: ' + (g.status || 'nháp') + (g.locked ? ', đang khóa' : '') + (g.tnote ? '. Giáo viên nhắn: ' + g.tnote : '')) : 'Chọn hoặc tạo nhóm để bản lưu và cue của bạn nằm riêng.';
}

function initGroups() {
  G('tab_ql').style.display = isAdmin ? '' : 'none';
  G('tab_gv').style.display = (FB && !isAdmin) ? '' : 'none';
  const sl = G('g_sel'), v = curG;
  sl.textContent = '';
  sl.add(new Option('Chung (chưa chia nhóm)', ''));
  groups.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(g => sl.add(new Option(g.name, g.id)));
  sl.value = v;

  refilter();
  renderSaves();
  renderAdmin();
  gstatus();
  if (lastKey !== curG) {
    lastKey = curG;
    subCues();
  }
}

function subCues() {
  if (unsubC) {
    try { unsubC(); } catch (e) {}
    unsubC = null;
  }
  cues = [];
  cur = -1;
  const k = curG || 'main';

  if (db) {
    unsubC = db.doc('cues/' + k).onSnapshot(q => {
      try { cues = q.exists ? JSON.parse(q.data().list) : []; } catch (e) { cues = []; }
      renderCues();
    }, () => {});
  } else {
    try { cues = JSON.parse(localStorage.getItem('cues_' + k) || '[]'); } catch (e) { cues = []; }
  }
  renderCues();
}

async function delGroup(g) {
  try {
    if (db) {
      for (const s of allSaves.filter(s => s.gid == g.id)) await db.collection('looks').doc(s.id).delete();
      await db.doc('cues/' + g.id).delete();
      await db.collection('groups').doc(g.id).delete();
    } else {
      const l = lsGetG();
      delete l[g.id];
      localStorage.setItem('groups', JSON.stringify(l));
      const ls = lsGet();
      Object.keys(ls).forEach(k => { if (ls[k].gid == g.id) delete ls[k]; });
      localStorage.setItem('looks', JSON.stringify(ls));
      localStorage.removeItem('cues_' + g.id);
      groups = toArr(l);
      allSaves = toArr(ls);
    }
    if (curG == g.id) curG = '';
    initGroups();
  } catch (e) {
    note('Không xóa được nhóm.');
  }
}

function renderAdmin() {
  refreshPurge();
  const box = G('adm');
  box.textContent = '';
  [{ id: '', name: 'Chung (chưa chia nhóm)', virtual: 1 }, ...groups.slice().sort((a, b) => a.name.localeCompare(b.name))].forEach(g => {
    const n = allSaves.filter(s => (s.gid || '') === g.id).length, d = document.createElement('div');
    d.className = 'sv';
    const nm = document.createElement('b');
    nm.textContent = g.name;
    const sm = document.createElement('small');
    sm.textContent = n + ' bản lưu' + (g.virtual ? '' : ' | ' + (g.ncue || 0) + ' cue | ' + (g.status || 'nháp') + (g.locked ? ' | đã khóa' : '') + ' | cập nhật ' + new Date(g.ts || 0).toLocaleString('vi-VN'));
    const r = document.createElement('div');
    r.className = 'row';

    const mb = (t, fn) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.onclick = fn;
      r.appendChild(b);
      return b;
    };

    mb('Mở nhóm', () => {
      curG = g.id;
      try { localStorage.setItem('curG', curG); } catch (e) {}
      initGroups();
      location.hash = 'thiet-ke';
    });

    if (!g.virtual) {
      mb(g.locked ? 'Mở khóa' : 'Khóa', () => gupd({ locked: !g.locked }, g.id));
      mb(g.status == 'đã duyệt' ? 'Bỏ duyệt' : 'Duyệt', () => gupd({ status: g.status == 'đã duyệt' ? 'nháp' : 'đã duyệt' }, g.id));
      two(mb('Xóa nhóm'), 'Bấm lần nữa để xóa', () => delGroup(g));
    }
    d.append(nm, sm, r);

    if (!g.virtual) {
      const tn = document.createElement('input');
      tn.type = 'text';
      tn.placeholder = 'Ghi chú gửi nhóm';
      tn.value = g.tnote || '';
      tn.maxLength = 120;
      tn.style.cssText = 'margin-top:6px;width:100%';
      tn.onchange = () => gupd({ tnote: tn.value.trim() }, g.id);
      d.appendChild(tn);
    }
    box.appendChild(d);
  });
}

function route() {
  const h = (location.hash || '#thiet-ke').slice(1),
    v = ['thiet-ke', 'huong-dan', 'quan-ly'].includes(h) ? h : 'thiet-ke',
    ok = v == 'quan-ly' && !isAdmin ? 'thiet-ke' : v;

  document.querySelector('main').style.display = ok == 'thiet-ke' ? '' : 'none';
  G('gbar').style.display = ok == 'thiet-ke' ? '' : 'none';
  G('v_huong-dan').style.display = ok == 'huong-dan' ? '' : 'none';
  G('v_quan-ly').style.display = ok == 'quan-ly' ? '' : 'none';
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') == '#' + ok));
}

addEventListener('hashchange', route);
G('g_sel').onchange = () => {
  curG = G('g_sel').value;
  try { localStorage.setItem('curG', curG); } catch (e) {}
  initGroups();
};
G('g_submit').onclick = () => { if (canEd()) gupd({ status: 'đã nộp' }); };
G('g_new').onclick = async () => {
  const n = G('g_name').value.trim();
  if (!n || needName()) return;
  const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    g = { id, name: n, locked: false, status: 'nháp', ncue: 0, by: G('g_me').value.trim(), ts: Date.now() };

  try {
    if (db) {
      const { id: _, ...rest } = g;
      await db.collection('groups').doc(id).set({ ...rest, ...EXP() });
    } else {
      const l = lsGetG();
      l[id] = g;
      localStorage.setItem('groups', JSON.stringify(l));
      groups = toArr(l);
    }
    curG = id;
    try { localStorage.setItem('curG', id); } catch (e) {}
    G('g_name').value = '';
    initGroups();
  } catch (e) {
    note('Không tạo được nhóm.');
  }
};

const EXP = () => FB ? { expireAt: new Date(Date.now() + 90 * 864e5) } : {};
const needName = () => {
  if (G('g_me').value.trim()) return false;
  G('g_st').textContent = 'Hãy nhập tên bạn ở ô "Tên bạn" trước.';
  G('g_me').focus();
  return true;
};

let DL = null;
async function saveFile(name, text) {
  try {
    if (DL) {
      await DL.save({ filename: name, data: text });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {}
}

async function loadFB() {
  const ld = u => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = u;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  await ld('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  await ld('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
  firebase.initializeApp(FB_CONFIG);
  return firebase.firestore();
}

async function backupAll() {
  const cu = {};
  for (const g of [{ id: '' }, ...groups]) {
    const k = g.id || 'main';
    try {
      if (db) {
        const q = await db.doc('cues/' + k).get();
        cu[k] = q.exists ? JSON.parse(q.data().list) : [];
      } else cu[k] = JSON.parse(localStorage.getItem('cues_' + k) || '[]');
    } catch (e) {}
  }
  await saveFile('sao-luu-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ at: Date.now(), groups, looks: allSaves, cues: cu }));
}

function oldStuff() {
  const c = Date.now() - 90 * 864e5,
    og = groups.filter(g => g.ts && g.ts < c),
    ol = allSaves.filter(s => s.ts && s.ts < c && !og.some(g => g.id == s.gid));
  return { og, ol };
}

function refreshPurge() {
  const { og, ol } = oldStuff();
  G('purge_n').textContent = 'Quá hạn 90 ngày: ' + og.length + ' nhóm, ' + ol.length + ' bản lưu lẻ.';
}

async function purgeOld() {
  const { og, ol } = oldStuff();
  try {
    for (const g of og) await delGroup(g);
    if (db) {
      for (const s of ol) await db.collection('looks').doc(s.id).delete();
    } else {
      const l = lsGet();
      ol.forEach(s => delete l[s.id]);
      localStorage.setItem('looks', JSON.stringify(l));
      allSaves = toArr(l);
      refilter();
      initGroups();
    }
    G('purge_n').textContent = 'Đã xóa ' + og.length + ' nhóm và ' + ol.length + ' bản lưu lẻ.';
  } catch (e) {
    G('purge_n').textContent = 'Không xóa hết được, hãy thử lại.';
  }
}

two(G('purge'), 'Bấm lần nữa để xóa', purgeOld);
G('bk').onclick = backupAll;

try { G('g_me').value = localStorage.getItem('me') || ''; } catch (e) {}
G('g_me').onchange = () => { try { localStorage.setItem('me', G('g_me').value.trim()); } catch (e) {} };

G('tab_gv').onclick = async () => {
  const p = prompt('Nhập mã giáo viên');
  if (p === null) return;

  // 1. Mã hóa chuỗi nhập vào sang UTF-8
  const msgUint8 = new TextEncoder().encode(p.trim());
  
  // 2. Tính SHA-256 bằng Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  
  // 3. Chuyển Buffer thành chuỗi Hex 64 ký tự chuẩn (bắt buộc padStart(2, '0'))
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 4. So sánh với mã SHA-256 chuẩn của thai140625
  if (hashHex === window.APP_CONFIG.ADMIN_PIN_HASH) {
    isAdmin = true;
    try { 
      sessionStorage.setItem('adm', '1'); 
    } catch (e) {}
    initGroups();
    location.hash = 'quan-ly';
    route();
  } else {
    G('g_st').textContent = 'Sai mã giáo viên.';
  }
};

let cues = [], cur = -1, fade = null;

function startFade(str, secs) {
  const s = JSON.parse(str);
  if (!Array.isArray(s.F) || s.F.length != F.length) throw 0;
  if (!(secs > 0.05)) {
    fade = null;
    applySnap(str);
    return;
  }
  const P = ['tx', 'ty', 'int', 'beam', 'strobe'],
    cp = f => {
      const o = { col: f.col.slice() };
      P.forEach(p => o[p] = f[p] || 0);
      return o;
    };

  const from = F.map(cp), bg0 = rgb(bgCol);
  fade = null;
  applySnap(str);
  const to = F.map(cp), bg1 = rgb(bgCol), bgEnd = bgCol, au = auto;

  F.forEach((f, i) => {
    P.forEach(p => f[p] = from[i][p]);
    f.col = from[i].col.slice();
  });
  auto = null;
  bgCol = hex(bg0);
  fade = { t0: performance.now() / 1000, secs, from, to, bg0, bg1, bgEnd, au };
}

function cueSave() {
  const s = JSON.stringify(cues), k = curG || 'main';
  try {
    if (db) db.doc('cues/' + k).set({ list: s, ts: Date.now(), ...EXP() });
    else localStorage.setItem('cues_' + k, s);
  } catch (e) {}
  gupd({ ncue: cues.length });
}

function playCue(i) {
  if (i < 0 || i >= cues.length) return;
  const c = cues[i], s = saves.find(x => x.id == c.sid);
  if (!s) {
    G('cu_st').textContent = 'Cue ' + (i + 1) + ': bản lưu đã bị xóa.';
    return;
  }
  try {
    startFade(s.snap, c.fade);
    cur = i;
    renderCues();
  } catch (e) {
    G('cu_st').textContent = 'Không chạy được cue ' + (i + 1) + '.';
  }
}

function mv(i, d) {
  if (!canEd()) return;
  const j = i + d;
  if (j < 0 || j >= cues.length) return;
  [cues[i], cues[j]] = [cues[j], cues[i]];
  if (cur == i) cur = j;
  else if (cur == j) cur = i;
  cueSave();
  renderCues();
}

function renderCues() {
  const sl = G('cu_s'), v = sl.value;
  sl.textContent = '';
  saves.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(s => sl.add(new Option(s.name + ' (' + s.mood + ')', s.id)));
  if (v) sl.value = v;

  const box = G('cues');
  box.textContent = '';

  cues.forEach((c, i) => {
    const s = saves.find(x => x.id == c.sid), d = document.createElement('div');
    d.className = 'sv';
    if (i == cur) d.style.borderColor = 'var(--acc)';
    const nm = document.createElement('b');
    nm.textContent = (i + 1) + '. ' + (s ? s.name : '(bản lưu đã xóa)');
    const sm = document.createElement('small');
    sm.textContent = 'Chuyển ' + c.fade + ' giây' + (c.note ? ' | ' + c.note : '');
    const r = document.createElement('div');
    r.className = 'row';

    const mb = (t, fn) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.onclick = fn;
      r.appendChild(b);
    };

    mb('Chạy', () => playCue(i));
    mb('▲', () => mv(i, -1));
    mb('▼', () => mv(i, 1));
    mb('Xóa', () => {
      if (!canEd()) return;
      cues.splice(i, 1);
      if (cur >= cues.length) cur = cues.length - 1;
      cueSave();
      renderCues();
    });

    d.append(nm, sm, r);
    box.appendChild(d);
  });

  G('cu_st').textContent = cues.length ? (cur >= 0 ? 'Đang ở cue ' + (cur + 1) + ' / ' + cues.length : 'Sẵn sàng, bấm GO để chạy cue 1.') : 'Thêm bản lưu vào danh sách để bắt đầu.';
}

G('cu_add').onclick = () => {
  if (!canEd()) return;
  const sid = G('cu_s').value;
  if (!sid) return;
  cues.push({ sid, fade: Math.max(0, Math.min(60, +G('cu_f').value || 0)), note: G('cu_n').value.trim() });
  G('cu_n').value = '';
  cueSave();
  renderCues();
};

G('cu_go').onclick = () => playCue(cur + 1 >= cues.length ? cur : cur + 1);
G('cu_back').onclick = () => playCue(Math.max(0, cur - 1));

addEventListener('keydown', e => {
  const t = e.target.tagName;
  if (t == 'INPUT' || t == 'SELECT' || t == 'TEXTAREA' || t == 'BUTTON') return;
  if (e.code == 'Space') {
    e.preventDefault();
    G('cu_go').click();
  } else if (e.key == 'ArrowLeft') {
    G('cu_back').click();
  }
});

G('sv_save').onclick = () => {
  const n = G('sv_n').value.trim();
  if (!n) {
    note('Hãy đặt tên cho bản lưu.');
    return;
  }
  putSave(null, { name: n, group: gname(), mood: G('sv_m').value });
};

(async () => {
  G('sv_exp').onclick = () => saveFile('ban-luu-anh-sang.json', JSON.stringify(saves.map(({ id, ...r }) => r)));

  if (typeof claude != 'undefined') {
    try { db = await claude.use('db'); } catch (e) { db = null; }
    if (db) {
      try {
        const u = await claude.use('user');
        isAdmin = !!(u && u.canEdit());
      } catch (e) { isAdmin = false; }
    }
    try {
      const dl = await claude.use('downloads');
      DL = dl;
      if (dl) {
        G('sv_exp').style.display = '';
        G('sv_exp').onclick = async () => {
          try { await dl.save({ filename: 'ban-luu-anh-sang.json', data: JSON.stringify(saves.map(({ id, ...r }) => r)) }); } catch (e) {}
        };
      }
    } catch (e) {}
  }

  if (!db && typeof claude == 'undefined' && FB_CONFIG) {
    try {
      db = await loadFB();
      FB = true;
      try { isAdmin = sessionStorage.getItem('adm') == '1'; } catch (e) { isAdmin = false; }
    } catch (e) { db = null; }
  }

  if (db) {
    db.collection('groups').onSnapshot(q => {
      groups = q.docs.map(d => ({ id: d.id, ...d.data() }));
      initGroups();
    }, () => {});
    db.collection('looks').onSnapshot(q => {
      allSaves = q.docs.map(d => ({ id: d.id, ...d.data() }));
      refilter();
      renderSaves();
      renderAdmin();
    }, e => note('Không đọc được bản lưu chung.'));
    note('Bản lưu dùng chung: mọi người mở trang này đều thấy.');
  } else {
    groups = toArr(lsGetG());
    allSaves = toArr(lsGet());
    initGroups();
    note('Bản lưu chỉ nằm trên máy này (chưa đăng nhập hoặc chưa có quyền).');
  }

  initGroups();
  route();
})();

route();
setScene(1);
requestAnimationFrame(frame);
