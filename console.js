/* Bàn DMX 512: fader từng đèn, master, blackout, flash, DMX monitor, bảng patch.
   Chạy sau app.js, dùng lại các biến toàn cục của app.js (F, master, sel, auto, fade...). */
(function () {
  const $ = id => document.getElementById(id);
  const TYPE = { par: 'Par LED 54x3W', bl: 'Blinder', mh: 'Moving head beam' };
  const NCH = { par: 7, bl: 1, mh: 16 };
  const LBL = {
    par: ['Dimmer', 'Đỏ', 'Xanh lá', 'Xanh dương', 'Strobe', 'Macro', 'Tốc độ'],
    bl: ['Dimmer'],
    mh: ['Pan', 'Pan mịn', 'Tilt', 'Tilt mịn', 'Tốc độ', 'Dimmer', 'Strobe', 'Đỏ', 'Xanh lá', 'Xanh dương', 'Dự phòng', 'Dự phòng', 'Dự phòng', 'Dự phòng', 'Dự phòng', 'Dự phòng']
  };
  const COL = { par: '#6aa8ff', bl: '#ffb347', mh: '#5eead4' };
  const pad = (n, k = 3) => String(n).padStart(k, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- fader tự vẽ ----------
  function mkFader(onChange) {
    const el = document.createElement('div');
    el.className = 'fader'; el.tabIndex = 0;
    el.innerHTML = '<div class="trk"><div class="fill"></div></div><div class="cap"></div>';
    let v = 0, drag = false;
    const set = x => { v = Math.max(0, Math.min(1, x)); el.style.setProperty('--v', v); };
    const fromEv = e => { const r = el.getBoundingClientRect(); return 1 - (e.clientY - r.top - 9) / (r.height - 18); };
    el.onpointerdown = e => { drag = true; el.setPointerCapture(e.pointerId); set(fromEv(e)); onChange(v); e.preventDefault(); };
    el.onpointermove = e => { if (drag) { set(fromEv(e)); onChange(v); } };
    el.onpointerup = el.onpointercancel = () => { drag = false; };
    el.onkeydown = e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { set(v + (e.key === 'ArrowUp' ? 0.02 : -0.02)); onChange(v); e.preventDefault(); }
    };
    return { el, set, isDrag: () => drag };
  }

  // ---------- strip cho từng đèn ----------
  const strips = [], cnt = { par: 0, bl: 0, mh: 0 };
  const box = $('faders');
  F.forEach(f => {
    const k = ++cnt[f.type], nm = { par: 'PAR', bl: 'BLD', mh: 'MH' }[f.type] + k;
    const d = document.createElement('div'); d.className = 'ch'; d.title = f.name;
    const addr = document.createElement('div'); addr.className = 'ch-addr'; addr.textContent = pad(f.dmx);
    const val = document.createElement('div'); val.className = 'ch-val';
    const fd = mkFader(v => { auto = null; fade = null; f.int = v; });
    const col = document.createElement('input'); col.type = 'color'; col.className = 'ch-col'; col.title = 'Màu ' + f.name;
    col.oninput = () => { auto = null; fade = null; f.col = rgb(col.value); };
    const b = document.createElement('div'); b.className = 'ch-btns';
    const bs = document.createElement('button'); bs.textContent = 'SEL'; bs.title = 'Chọn đèn này';
    bs.onclick = () => { sel = f; selO = null; renderSel(); };
    const bf = document.createElement('button'); bf.textContent = 'FLASH'; bf.title = 'Giữ để đèn sáng hết cỡ';
    let keep = null;
    bf.onpointerdown = e => { bf.setPointerCapture(e.pointerId); keep = f.int; f.int = 1; };
    bf.onpointerup = bf.onpointercancel = () => { if (keep !== null) { f.int = keep; keep = null; } };
    b.append(bs, bf);
    const name = document.createElement('div'); name.className = 'ch-nm'; name.textContent = nm;
    d.append(addr, val, fd.el, col, b, name);
    box.appendChild(d);
    strips.push({ f, d, val, fd, col, bs });
  });

  // ---------- master + blackout ----------
  let boPrev = null;
  const mf = mkFader(v => { master = v; boPrev = null; $('bo').classList.remove('on'); $('master').value = Math.round(v * 100); });
  $('master-fader').appendChild(mf.el);
  $('bo').onclick = () => {
    if (boPrev === null) { boPrev = master; master = 0; $('bo').classList.add('on'); }
    else { master = boPrev; boPrev = null; $('bo').classList.remove('on'); }
    $('master').value = Math.round(master * 100);
  };
  $('con_go').onclick = () => $('cu_go').click();
  $('con_back').onclick = () => $('cu_back').click();

  // ---------- DMX 512 ----------
  const meta = new Array(512).fill(null);
  F.forEach(f => { for (let j = 0; j < NCH[f.type]; j++) if (f.dmx - 1 + j < 512) meta[f.dmx - 1 + j] = { f, label: LBL[f.type][j], type: f.type }; });
  function dmxFrame() {
    const u = new Uint8Array(512), put = (a, arr) => arr.forEach((v, j) => { if (a + j < 512) u[a + j] = v; });
    F.forEach(f => {
      const I = (f.type === 'bl' && !f.on) ? 0 : f.int * master;
      const d = Math.round(Math.max(0, Math.min(1, I)) * 255), c = f.col.map(x => Math.round(x));
      const st = Math.round(Math.min(20, f.strobe || 0) / 20 * 255), a = f.dmx - 1;
      if (f.type === 'par') put(a, [d, c[0], c[1], c[2], st, 0, 0]);
      else if (f.type === 'bl') put(a, [d]);
      else {
        const dx = f.tx - f.x, dy = f.ty - f.y;
        const pan = Math.round((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 255);
        const tilt = Math.round(Math.min(1, Math.hypot(dx, dy) / 450) * 255);
        put(a, [pan, 0, tilt, 0, 0, d, st, c[0], c[1], c[2], 0, 0, 0, 0, 0, 0]);
      }
    });
    return u;
  }
  const mon = $('mon'), mc = mon.getContext('2d'), CW = 26, CH = 21, COLS = 32;
  let hov = -1, last = new Uint8Array(512);
  function drawMon() {
    const u = last = dmxFrame();
    mc.clearRect(0, 0, mon.width, mon.height);
    mc.textAlign = 'center';
    for (let i = 0; i < 512; i++) {
      const x = (i % COLS) * CW, y = Math.floor(i / COLS) * CH, v = u[i];
      mc.fillStyle = '#121118'; mc.fillRect(x + 1, y + 1, CW - 2, CH - 2);
      if (v) { mc.fillStyle = 'rgba(255,179,71,' + (0.12 + v / 255 * 0.75) + ')'; mc.fillRect(x + 1, y + 1, CW - 2, CH - 2); }
      if (meta[i]) { mc.fillStyle = COL[meta[i].type]; mc.fillRect(x + 1, y + 1, CW - 2, 2); }
      mc.font = '7px ui-monospace,Consolas,monospace'; mc.fillStyle = '#6f6a82'; mc.fillText(i + 1, x + CW / 2, y + 9);
      mc.font = '10px ui-monospace,Consolas,monospace'; mc.fillStyle = v ? '#fff' : '#4a4658'; mc.fillText(v, x + CW / 2, y + 18);
      if (i === hov) { mc.strokeStyle = '#fff'; mc.strokeRect(x + 1.5, y + 1.5, CW - 3, CH - 3); }
    }
  }
  const cellAt = e => { const r = mon.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * mon.width, y = (e.clientY - r.top) / r.height * mon.height; return Math.floor(y / CH) * COLS + Math.floor(x / CW); };
  mon.onpointermove = e => {
    hov = cellAt(e); const m = meta[hov];
    $('mon_rd').textContent = 'CH ' + pad(hov + 1) + ' = ' + last[hov] + (m ? '  |  ' + m.f.name + '  |  ' + m.label : '  |  chưa gán');
  };
  mon.onpointerleave = () => { hov = -1; $('mon_rd').textContent = 'Rê chuột vào một ô để xem kênh.'; };
  mon.onclick = e => { const m = meta[cellAt(e)]; if (m) { sel = m.f; selO = null; renderSel(); } };
  $('mon_t').onclick = () => { const s = $('dmxmon'); s.hidden = !s.hidden; $('mon_t').classList.toggle('on', !s.hidden); };

  // ---------- bảng patch ----------
  const posOf = f => f.type === 'mh' ? (f.x < 420 ? 'Sàn góc sau trái' : 'Sàn góc sau phải') :
    f.stand === undefined ? 'Sàn, đánh phông' : 'Trụ T ' + (f.stand ? 'phải' : 'trái') + ' (khán giả)';
  const rows = () => F.map(f => [f.name, TYPE[f.type], f.dmx, NCH[f.type], f.dmx + NCH[f.type] - 1, posOf(f)]);
  const HEAD = ['Thiết bị', 'Loại', 'Địa chỉ', 'Số kênh', 'Kênh cuối', 'Vị trí'];
  $('patch_csv').onclick = () => {
    const csv = '\ufeff' + [HEAD, ...rows()].map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    saveFile('bang-patch-dmx.csv', csv);
  };
  $('patch_print').onclick = () => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><meta charset="utf-8"><title>Bảng patch DMX</title><style>body{font:14px sans-serif;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:6px 8px;text-align:left}th{background:#eee}</style><h2>Bảng patch DMX 512, Universe 1</h2><table><tr>' +
      HEAD.map(h => '<th>' + h + '</th>').join('') + '</tr>' + rows().map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') +
      '</table><p>Chế độ kênh: Par 7CH, Blinder 1CH, Moving head 16CH. Hãy đối chiếu với tài liệu của đèn thật.</p>');
    w.document.close(); w.focus(); w.print();
  };

  // ---------- đồng bộ liên tục ----------
  function tick() {
    strips.forEach(s => {
      const f = s.f, off = f.type === 'bl' && !f.on;
      if (!s.fd.isDrag()) s.fd.set(f.int);
      s.val.textContent = pad(off ? 0 : Math.round(Math.min(1, f.int * master) * 255));
      if (document.activeElement !== s.col) s.col.value = hex(f.col);
      s.d.classList.toggle('off', off);
      s.d.classList.toggle('sel', sel === f);
    });
    if (!mf.isDrag()) mf.set(master);
    $('master-val').textContent = Math.round(master * 100) + '%';
    $('con_cue').textContent = $('cu_st').textContent;
    if (!$('dmxmon').hidden && mon.offsetParent !== null) drawMon();
  }
  setInterval(tick, 90);
  tick();
})();

/* ---------- bố cục: đổi giữa Bàn DMX và Cổ điển, vừa khít sân khấu, tab điện thoại ---------- */
(function () {
  const $ = id => document.getElementById(id), B = document.body;
  let lay = 'dmx'; try { lay = localStorage.getItem('layout') === 'classic' ? 'classic' : 'dmx'; } catch (e) {}

  function fit() {
    const wrap = $('stagewrap'); if (!wrap || wrap.offsetParent === null) return;
    const w = innerWidth, deskDmx = B.classList.contains('lay-dmx') && w >= 1100;
    const ah = deskDmx ? wrap.clientHeight : (w >= 1100 ? innerHeight - 130 : innerHeight * (w < 700 ? 0.34 : 0.42));
    const aw = wrap.clientWidth - 2;
    const s = Math.max(0.2, Math.min(aw / 860, (ah - 2) / 640));
    const cw = Math.floor(860 * s) + 'px', ch = Math.floor(640 * s) + 'px';
    [$('c'), document.querySelector('#w3 canvas')].forEach(c => { if (c) { c.style.width = cw; c.style.height = ch; } });
  }
  function applyLay() {
    B.classList.toggle('lay-dmx', lay === 'dmx');
    B.classList.toggle('lay-classic', lay === 'classic');
    $('lay_t').textContent = 'Bố cục: ' + (lay === 'dmx' ? 'Bàn DMX' : 'Cổ điển');
    fit(); setTimeout(fit, 60);
  }
  $('lay_t').onclick = () => { lay = lay === 'dmx' ? 'classic' : 'dmx'; try { localStorage.setItem('layout', lay); } catch (e) {} applyLay(); };

  const setTab = t => { B.dataset.tab = t; document.querySelectorAll('#mtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); };
  document.querySelectorAll('#mtabs button').forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
  // chọn đèn trên sân khấu thì tự nhảy sang tab Thiết bị (điện thoại)
  let before = null;
  $('c').addEventListener('pointerdown', () => { before = sel; });
  $('c').addEventListener('pointerup', () => { if (innerWidth < 1100 && sel && sel !== before) setTab('dev'); });

  $('con_fold').onclick = () => { const f = $('console').classList.toggle('folded'); $('con_fold').classList.toggle('on', f); $('con_fold').textContent = f ? 'Mở rộng' : 'Thu gọn'; fit(); };
  $('mon_t').addEventListener('click', () => setTimeout(fit, 30));
  $('v2').addEventListener('click', () => setTimeout(fit, 60));
  $('v3b').addEventListener('click', () => { setTimeout(fit, 60); setTimeout(fit, 400); });
  addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe($('stagewrap'));
  applyLay();
})();