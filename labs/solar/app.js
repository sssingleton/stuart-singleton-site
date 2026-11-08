/* Solar WB — UI. Needs exifr + SolarCore. The photo never leaves the browser;
   only typed/picked places go to Photon (search) and Open-Meteo (time zone + elevation). */
(function () {
  const $ = id => document.getElementById(id);
  const S = window.SolarCore;
  const NS = 'http://www.w3.org/2000/svg';
  const D2R = Math.PI / 180;
  const GOLD = '#c9a55c';
  const ROMAN = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const st = {
    lat: 36.1627, lon: -86.7816, alt: 180, offMin: -360, local: null,
    haze: 0.3, light: 'sun', corr: 0.7, tint: 0,
    photo: false, fileName: null, source: 'demo', place: 'Nashville, Tennessee',
    offSrc: 'demo', altSrc: 'demo', tz: 'America/Chicago'
  };

  /* inject animation styles for the dial */
  const css = document.createElement('style');
  css.textContent = `.bead{transform-box:fill-box;transform-origin:center}
    .bead.pop{opacity:0;animation:beadpop .35s cubic-bezier(.2,1.6,.4,1) forwards}
    @keyframes beadpop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}
    .sunmark.pop{opacity:0;animation:beadpop .5s cubic-bezier(.2,1.6,.4,1) forwards}`;
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const fmtOff = m => (m < 0 ? '−' : '+') + pad(Math.floor(Math.abs(m) / 60)) + ':' + pad(Math.abs(m) % 60);
  const fmtOffInput = m => (m < 0 ? '-' : '+') + pad(Math.floor(Math.abs(m) / 60)) + ':' + pad(Math.abs(m) % 60);
  function parseOff(s) {
    s = String(s || '').trim().replace('−', '-');
    if (s === '' ) return null;
    if (/^(GMT|UTC|Z)$/i.test(s)) return 0;
    const m = s.replace(/^(GMT|UTC)/i, '').match(/^([+-])?(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const v = (+m[2]) * 60 + (+(m[3] || 0));
    return (m[1] === '-' ? -1 : 1) * v;
  }
  function instant() {
    const l = st.local; if (!l) return null;
    return new Date(Date.UTC(l.y, l.mo - 1, l.d, l.h, l.mi) - st.offMin * 60000);
  }
  function localOf(date) {
    const t = new Date(date.getTime() + st.offMin * 60000);
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
  }
  function tzOffset(tz, l) { /* minutes east of UTC for wall clock l in IANA zone tz */
    let guess = Date.UTC(l.y, l.mo - 1, l.d, l.h, l.mi), off = 0;
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    for (let i = 0; i < 2; i++) {
      const p = fmt.formatToParts(new Date(guess)).find(x => x.type === 'timeZoneName');
      off = parseOff(p ? p.value : 'GMT') || 0;
      guess = Date.UTC(l.y, l.mo - 1, l.d, l.h, l.mi) - off * 60000;
    }
    return off;
  }
  /* coordinates or a Google Maps link */
  function parseLL(s) {
    s = String(s || '');
    let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
      s.match(/[?&](?:q|ll|query|center|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i);
    if (m) return [+m[1], +m[2]];
    m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i);
    if (!m) return null;
    let a = +m[1], b = +m[3];
    if (m[2] && /s/i.test(m[2])) a = -Math.abs(a);
    if (m[4] && /w/i.test(m[4])) b = -Math.abs(b);
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return [a, b];
  }
  const fmtLat = v => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'N' : 'S');
  const fmtLon = v => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'E' : 'W');
  const compass = az => ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(az / 22.5) % 16];
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function status(html) { const n = $('status'); n.innerHTML = html; n.classList.toggle('warnbox', /class="warn"/.test(html)); }
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  /* ---------- model ---------- */
  function compute() {
    const t = instant();
    if (!t || !isFinite(st.lat)) return null;
    const p = S.sunPosition(t, st.lat, st.lon);
    const sc = S.sceneKelvin(p.elevation, st.alt, st.haze, st.light);
    const wb = sc.kelvin ? Math.round((5500 + st.corr * (sc.kelvin - 5500)) / 50) * 50 : null;
    return { t, p, sc, wb, am: p.elevation > -0.5 ? S.airMass(p.elevation) * Math.exp(-st.alt / 8434) : null };
  }

  /* ---------- dial: photo at the centre, sky as a ring around it ---------- */
  const C = 400, R_IN = 170, R_H = 284, R_OUT = 308;
  const rOf = e => e >= 0 ? R_IN + (90 - Math.min(90, e)) / 90 * (R_H - R_IN) : R_H + Math.min(12, -e) / 12 * (R_OUT - R_H);
  const xy = (e, az) => { const r = rOf(e); return [C + r * Math.sin(az * D2R), C - r * Math.cos(az * D2R)]; };
  function dayTrack(mid, stepMin) {
    const pts = [];
    for (let m = 0; m <= 1440; m += stepMin) {
      const d = new Date(mid.getTime() + m * 60000), p = S.sunPosition(d, st.lat, st.lon);
      pts.push({ m, d, e: p.elevation, az: p.azimuth });
    }
    return pts;
  }
  function pathD(pts, minE) {
    let d = '', pen = false;
    for (const q of pts) {
      if (q.e < minE) { pen = false; continue; }
      const [x, y] = xy(q.e, q.az);
      d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); pen = true;
    }
    return d;
  }
  const midnight = () => new Date(Date.UTC(st.local.y, st.local.mo - 1, st.local.d) - st.offMin * 60000);

  function drawDial(res, anim) {
    const svg = $('dial'); svg.innerHTML = '';
    el('defs', {}, svg).innerHTML = `
      <radialGradient id="sunG"><stop offset="0" stop-color="#fff6d6"/><stop offset=".45" stop-color="#f4b552"/><stop offset="1" stop-color="#b8571c"/></radialGradient>
      <radialGradient id="glowG"><stop offset="0" stop-color="#f6c070" stop-opacity=".6"/><stop offset="1" stop-color="#f6c070" stop-opacity="0"/></radialGradient>
      <path id="arcTop" d="M ${C - 362} ${C} A 362 362 0 1 1 ${C + 362} ${C}"/>
      <path id="arcBot" d="M ${C - 374} ${C} A 374 374 0 0 0 ${C + 374} ${C}"/>`;
    /* bands: night, blue hour, golden hour */
    el('circle', { cx: C, cy: C, r: R_OUT, fill: '#1c1626' }, svg);
    el('circle', { cx: C, cy: C, r: rOf(-6), fill: '#2b2249' }, svg);
    el('circle', { cx: C, cy: C, r: R_H, fill: '#3c2c2a', opacity: .75 }, svg);
    el('circle', { cx: C, cy: C, r: rOf(6), fill: '#1d1722' }, svg);
    const g = el('g', { stroke: GOLD, fill: 'none' }, svg);
    [R_OUT, 314, 324].forEach((r, i) => el('circle', { cx: C, cy: C, r, 'stroke-width': i ? .7 : 1.2, opacity: i ? .55 : .85 }, g));
    el('circle', { cx: C, cy: C, r: 392, 'stroke-width': .6, opacity: .4 }, g);
    for (let a = 0; a < 360; a += 2) {
      const long = a % 10 === 0, s = Math.sin(a * D2R), c = Math.cos(a * D2R), r2 = long ? 324 : 319;
      el('line', { x1: C + 314 * s, y1: C - 314 * c, x2: C + r2 * s, y2: C - r2 * c, 'stroke-width': long ? .9 : .5, opacity: .6 }, g);
    }
    [0, 15, 30, 45, 60, 75].forEach(e => el('circle', { cx: C, cy: C, r: rOf(e), 'stroke-width': e === 0 ? 1.3 : .5, opacity: e === 0 ? .9 : .3 }, g));
    for (let a = 0; a < 360; a += 15) {
      const s = Math.sin(a * D2R), c = Math.cos(a * D2R);
      el('line', { x1: C + R_IN * s, y1: C - R_IN * c, x2: C + R_OUT * s, y2: C - R_OUT * c, 'stroke-width': a % 45 === 0 ? .7 : .35, opacity: a % 45 === 0 ? .5 : .26 }, g);
    }
    const lab = el('g', { fill: GOLD, 'font-family': 'Cormorant Garamond, serif' }, svg);
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => {
      const r = 342, n = el('text', { x: C + r * Math.sin(a * D2R), y: C - r * Math.cos(a * D2R) + 9, 'text-anchor': 'middle', 'font-size': 26, 'font-style': 'italic' }, lab);
      n.textContent = t;
    });
    [[15, '15°'], [45, '45°'], [3, 'horizon'], [-3, 'blue hour'], [-9, 'night']].forEach(([e, t]) => {
      const a = 322, x = C + rOf(e) * Math.sin(a * D2R), y = C - rOf(e) * Math.cos(a * D2R);
      const n = el('text', { x, y, dy: 3.5, 'font-size': e > 0 && e !== 3 ? 11 : 9.5, opacity: e >= 0 ? .8 : .6, 'font-style': e < 0 ? 'italic' : 'normal', 'text-anchor': 'middle', transform: `rotate(-38 ${x} ${y})` }, lab);
      n.textContent = t;
    });
    el('path', { d: `M${C} ${C - 334} l5 10 -5 -3 -5 3z`, fill: GOLD }, lab);
    if (!res) return;

    const mid = midnight();
    [[6, 21, 'XXI·VI'], [12, 21, 'XXI·XII']].forEach(([mo, d, name]) => {
      const m0 = new Date(Date.UTC(st.local.y, mo - 1, d) - st.offMin * 60000);
      const pts = dayTrack.call(null, m0, 10);
      el('path', { d: pathD(pts, -12), fill: 'none', stroke: GOLD, 'stroke-width': .8, 'stroke-dasharray': '2 5', opacity: .42 }, svg);
      const top = pts.reduce((a, b) => b.e > a.e ? b : a);
      if (top.e > 0) { const [x, y] = xy(top.e, top.az); el('text', { x, y: y + (mo === 6 ? -8 : 15), fill: GOLD, 'font-family': 'Cormorant Garamond, serif', 'font-size': 10, opacity: .55, 'text-anchor': 'middle' }, svg).textContent = name; }
    });
    const pts = dayTrack(mid, 4);
    el('path', { d: pathD(pts, -12), fill: 'none', stroke: GOLD, 'stroke-width': 1, opacity: .4, 'stroke-dasharray': '1 3' }, svg);
    const main = el('path', { d: pathD(pts, 0), fill: 'none', stroke: GOLD, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg);
    const beads = pts.filter(q => q.m % 60 === 0 && q.e > -12);
    beads.forEach((q, i) => {
      const [x, y] = xy(q.e, q.az), hr = localOf(q.d).h;
      const gB = el('g', { class: anim ? 'bead pop' : 'bead', style: anim ? `animation-delay:${(0.55 + i / beads.length * 1.3).toFixed(2)}s` : '' }, svg);
      el('circle', { cx: x, cy: y, r: q.e > 0 ? 5 : 3.5, fill: q.e > 0 ? GOLD : 'none', stroke: GOLD, 'stroke-width': 1 }, gB);
      const dx = x - C, dy = y - C, L = Math.hypot(dx, dy) || 1, out = q.e > 0 ? 15 : 13;
      el('text', { x: x + dx / L * out, y: y + dy / L * out + 4, fill: GOLD, 'font-family': 'Cormorant Garamond, serif', 'font-size': 11.5, 'text-anchor': 'middle', opacity: q.e > 0 ? .95 : .5 }, gB).textContent = ROMAN[hr];
    });
    if (anim && !REDUCED) {
      const len = main.getTotalLength();
      main.style.strokeDasharray = len; main.style.strokeDashoffset = len;
      main.getBoundingClientRect();
      main.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.6,0,.3,1) .5s';
      main.style.strokeDashoffset = 0;
    }
    /* the sun at the shot, tied to the photo by a pink line */
    const e = res.p.elevation, az = res.p.azimuth;
    if (e > -12) {
      const [x, y] = xy(e, az);
      const ux = Math.sin(az * D2R), uy = -Math.cos(az * D2R);
      el('line', { x1: C + 152 * ux, y1: C + 152 * uy, x2: x, y2: y, stroke: '#e0177e', 'stroke-width': 1.6, 'stroke-dasharray': '3 4' }, svg);
      const sg = el('g', { transform: `translate(${x} ${y})` }, svg);
      const sgi = el('g', { class: anim ? 'sunmark pop' : 'sunmark', style: anim ? 'animation-delay:1.9s' : '' }, sg);
      el('circle', { r: 38, fill: 'url(#glowG)' }, sgi);
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5 * D2R, r1 = 14, r2 = i % 2 ? 21 : 27, w = .17;
        el('path', { d: `M${(r1 * Math.sin(a - w)).toFixed(1)} ${(-r1 * Math.cos(a - w)).toFixed(1)} L${(r2 * Math.sin(a)).toFixed(1)} ${(-r2 * Math.cos(a)).toFixed(1)} L${(r1 * Math.sin(a + w)).toFixed(1)} ${(-r1 * Math.cos(a + w)).toFixed(1)}Z`, fill: e > 0 ? '#e9b45a' : '#8a7ab0' }, sgi);
      }
      el('circle', { r: 12, fill: e > 0 ? 'url(#sunG)' : '#6f62a0', stroke: '#fff3cf', 'stroke-width': .6 }, sgi);
    } else {
      el('text', { x: C, y: C + R_OUT + 2, fill: GOLD, 'font-family': 'Cormorant Garamond, serif', 'font-size': 15, 'font-style': 'italic', 'text-anchor': 'middle' }, svg).textContent = 'the sun is under the world';
    }
  }

  /* ---------- day strip ---------- */
  function drawDay(res) {
    const svg = $('day'); svg.innerHTML = '';
    if (!res) return;
    const mid = midnight();
    const pts = dayTrack(mid, 5).map(q => ({ ...q, k: S.sceneKelvin(q.e, st.alt, st.haze, st.light).kelvin }));
    const lit = pts.filter(q => q.k);
    if (!lit.length) { $('dayLabel').textContent = 'polar night: no daylight on this date'; return; }
    const m0 = lit[0].m, m1 = lit[lit.length - 1].m;
    const W = Math.max(280, Math.round(svg.getBoundingClientRect().width || 1200)), H = 60;
    svg.setAttribute('viewBox', `0 -14 ${W} 122`);
    const every = W < 520 ? 3 : W < 820 ? 2 : 1;
    const X = m => (m - m0) / Math.max(1, m1 - m0) * W;
    const lg = el('linearGradient', { id: 'dayG', x1: 0, x2: 1, y1: 0, y2: 0 }, el('defs', {}, svg));
    lit.forEach(q => { const [r, g, b] = S.kelvinRGB(q.k); el('stop', { offset: (X(q.m) / W).toFixed(4), 'stop-color': `rgb(${r},${g},${b})` }, lg); });
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#dayG)', stroke: '#151317', 'stroke-width': 1 }, svg);
    lit.filter(q => q.m % 60 === 0).forEach(q => {
      const x = X(q.m), h = localOf(q.d).h;
      el('line', { x1: x, y1: H, x2: x, y2: H + 8, stroke: '#151317', 'stroke-width': 1 }, svg);
      if (h % every) return;
      el('text', { x, y: H + 22, 'font-family': 'Share Tech Mono, monospace', 'font-size': 11, 'text-anchor': x > W - 24 ? 'end' : x < 24 ? 'start' : 'middle', fill: '#151317' }, svg).textContent = pad(h) + ':00';
    });
    let rise = null, set = null;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].e < -0.833 && pts[i].e >= -0.833 && !rise) rise = pts[i];
      if (pts[i - 1].e >= -0.833 && pts[i].e < -0.833) set = pts[i];
    }
    [[rise, 'sunrise'], [set, 'sunset']].forEach(([q, name]) => {
      if (!q) return;
      const x = X(q.m), lt = localOf(q.d);
      el('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#151317', 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: .55 }, svg);
      el('text', { x: x + (name === 'sunrise' ? 5 : -5), y: 13, 'font-family': 'Share Tech Mono, monospace', 'font-size': 10, fill: '#151317', 'text-anchor': name === 'sunrise' ? 'start' : 'end', opacity: .75 }, svg).textContent = name + ' ' + pad(lt.h) + ':' + pad(lt.mi);
    });
    const pm = (res.t - mid) / 60000;
    if (pm >= m0 && pm <= m1) {
      const x = X(pm);
      el('line', { x1: x, y1: -6, x2: x, y2: H + 6, stroke: '#e0177e', 'stroke-width': 2.5 }, svg);
      el('path', { d: `M${x - 7} -12 L${x + 7} -12 L${x} -3Z`, fill: '#e0177e' }, svg);
      if (res.sc.kelvin) el('text', { x, y: H + 38, 'font-family': 'Courier Prime, monospace', 'font-weight': 700, 'font-size': 13, fill: '#e0177e', 'text-anchor': x > W - 80 ? 'end' : x < 80 ? 'start' : 'middle' }, svg).textContent = Math.round(res.sc.kelvin) + 'K at the shot';
    }
    const a = localOf(lit[0].d), b = localOf(lit[lit.length - 1].d);
    $('dayLabel').textContent = `${st.local.y}.${pad(st.local.mo)}.${pad(st.local.d)} · first light ${pad(a.h)}:${pad(a.mi)} → last light ${pad(b.h)}:${pad(b.mi)}`;
  }

  /* ---------- render ---------- */
  const PHASE = { night: 'night · no sun to balance', blue: 'blue hour', golden: 'golden hour', low: 'low sun', day: 'daylight' };
  function render(anim) {
    const res = compute();
    drawDial(res, anim); drawDay(res);
    if (!res) return;
    const { p, sc, wb } = res, l = st.local;
    $('c-date').textContent = `${pad(l.d)} ${MONTHS[l.mo - 1]} ${l.y}`;
    $('c-time').textContent = `${pad(l.h)}:${pad(l.mi)} UTC${fmtOff(st.offMin)}`;
    $('c-place').textContent = st.place ? st.place.split(',')[0] : 'here';
    $('c-ll').textContent = `${fmtLat(st.lat)} · ${fmtLon(st.lon)}`;
    $('c-alt').textContent = Math.round(st.alt) + ' m up';
    $('c-elev').textContent = `${p.elevation.toFixed(1)}° high`;
    $('c-az').textContent = `az ${Math.round(p.azimuth)}° ${compass(p.azimuth)}`;
    $('c-am').textContent = res.am ? `air ×${res.am.toFixed(1)}` : 'below horizon';
    $('c-k').textContent = sc.kelvin ? Math.round(sc.kelvin) + 'K' : 'night';
    $('c-phase').textContent = PHASE[sc.phase].split(' · ')[0];
    $('r-temp').textContent = wb ? wb : '—';
    $('r-tint').textContent = 'TINT ' + (st.tint >= 0 ? '+' : '') + st.tint;
    $('phase').textContent = (st.source === 'demo' ? 'right now in Nashville · ' : '') + PHASE[sc.phase] +
      (sc.kelvin ? ` · light ${Math.round(sc.kelvin)}K` : '');
    $('dl').disabled = !wb; $('copy').disabled = !wb;
    schedulePreview(wb);
    return res;
  }
  function syncInputs() {
    const l = st.local;
    $('in-dt').value = `${l.y}-${pad(l.mo)}-${pad(l.d)}T${pad(l.h)}:${pad(l.mi)}`;
    $('in-off').value = fmtOffInput(st.offMin);
    $('in-ll').value = `${st.lat.toFixed(5)}, ${st.lon.toFixed(5)}`;
    $('in-alt').value = Math.round(st.alt);
  }

  /* ---------- "thinking" overlay: the maths, written out around the photo ---------- */
  let mindRun = 0;
  function runMind(res) {
    if (REDUCED || !res) return;
    const run = ++mindRun;
    const cv = $('mind'), box = cv.getBoundingClientRect(), pr = $('panel').getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const W = box.width, H = box.height;
    const cx = pr.left - box.left + pr.width / 2, cy = pr.top - box.top + pr.height / 2, P = pr.width;
    const p = res.p, f2 = v => v.toFixed(2), f4 = v => v.toFixed(4);
    const x = st.local;
    const texts = [
      `JD = ${p.jd.toFixed(4)}`, `T = ${p.T.toFixed(6)}`, `L₀ = ${f2(p.L0)}°`, `M = ${f2(p.M)}°`, `ε = ${f4(p.eps)}°`,
      `δ = asin(sin ε · sin λ)`, `δ = ${f2(p.declination)}°`, `EoT = ${f2(p.eqTime)} min`, `h = ${f2(p.hourAngle)}°`,
      `cos z = sin φ sin δ + cos φ cos δ cos h`, `z = ${f2(p.zenith)}°`, `φ = ${f4(st.lat)}°`, `λ = ${f4(st.lon)}°`,
      `AM = 1 / (cos z + 0.506(96.08 − z)^−1.636)`, res.am ? `AM = ${f2(res.am)}` : 'AM → ∞',
      `p/p₀ = e^(−${Math.round(st.alt)}/8434)`, `τ(λ) = 0.00857 λ⁻⁴`, `τₐ = β λ^−1.3`, `E(λ) = E₀ e^(−τ·AM)`,
      `X = ∫ E(λ) x̄(λ) dλ`, `n = (x − 0.332)/(0.1858 − y)`, `CCT = 449n³ + 3525n² + 6823n + 5520`,
      `az = ${f2(p.azimuth)}°`, `${x.y}·${pad(x.mo)}·${pad(x.d)}  ${pad(x.h)}:${pad(x.mi)}`, `UTC${fmtOff(st.offMin)}`,
      res.sc.kelvin ? `T꜀ = ${Math.round(res.sc.kelvin)} K` : 'T꜀ = —', res.wb ? `5500 + ${st.corr.toFixed(2)}(T꜀ − 5500) = ${res.wb}` : '',
      `Δ ∝ 1/λ⁴`, `sin²(ε/2)`, `π/180`, `∑ ∂`, `r = ${f2(p.refraction * 60)}′`
    ].filter(Boolean);
    /* place fragments on a ring around the photo, avoiding the centre */
    const frags = texts.map((t, i) => {
      let fx, fy, tries = 0;
      do {
        const a = Math.random() * Math.PI * 2, r = P * (0.27 + Math.random() * 0.36);
        fx = cx + Math.cos(a) * r; fy = cy + Math.sin(a) * r * 0.92; tries++;
      } while ((fx < 8 || fx > W - 150 || fy < 14 || fy > H - 8) && tries < 20);
      const isEq = /[=∫∑]/.test(t) && t.length > 14;
      return { t, x: fx, y: fy, t0: 80 + i * (1500 / texts.length) + Math.random() * 120, eq: isEq,
        size: isEq ? 13 + Math.random() * 3 : 12 + Math.random() * 5, lit: Math.random() < 0.5 };
    });
    const litOrder = frags.filter(f => f.lit).sort((a, b) => a.t0 - b.t0);
    const T_END = 2700;
    cv.classList.add('on');
    const start = performance.now();
    function frame(now) {
      if (run !== mindRun) return;
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      const fade = t > T_END - 450 ? Math.max(0, (T_END - t) / 450) : 1;
      /* sweeping arm + expanding rings */
      ctx.save(); ctx.globalAlpha = 0.85 * fade;
      const ang = -Math.PI / 2 + t / 1000 * Math.PI * 1.6;
      const grad = ctx.createLinearGradient(cx, cy, cx + Math.cos(ang) * P * 0.48, cy + Math.sin(ang) * P * 0.48);
      grad.addColorStop(0, 'rgba(255,240,200,0)'); grad.addColorStop(1, 'rgba(255,230,170,.9)');
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * P * .19, cy + Math.sin(ang) * P * .19); ctx.lineTo(cx + Math.cos(ang) * P * .5, cy + Math.sin(ang) * P * .5); ctx.stroke();
      ctx.strokeStyle = 'rgba(224,23,126,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, P * .19 + 6, ang - 1.2, ang); ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const ph = ((t / 900) + k / 3) % 1;
        ctx.globalAlpha = (1 - ph) * 0.5 * fade;
        ctx.strokeStyle = '#e9c27a';
        ctx.beginPath(); ctx.arc(cx, cy, P * (0.19 + ph * 0.34), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      /* constellation lines between lit fragments, drawn as they light */
      ctx.save(); ctx.lineWidth = 1;
      for (let i = 1; i < litOrder.length; i++) {
        const a = litOrder[i - 1], b = litOrder[i], tb = b.t0 + 250;
        if (t < tb) break;
        const k = Math.min(1, (t - tb) / 260);
        ctx.globalAlpha = 0.75 * fade;
        ctx.strokeStyle = i % 3 ? 'rgba(255,214,140,.9)' : 'rgba(224,23,126,.85)';
        ctx.beginPath(); ctx.moveTo(a.x + 4, a.y - 4); ctx.lineTo(a.x + 4 + (b.x - a.x) * k, a.y - 4 + (b.y - a.y) * k); ctx.stroke();
        if (i % 4 === 0 && k === 1) { /* spoke into the photo */
          ctx.globalAlpha = 0.35 * fade; ctx.beginPath(); ctx.moveTo(b.x + 4, b.y - 4); ctx.lineTo(cx, cy); ctx.stroke();
        }
      }
      ctx.restore();
      /* the fragments, typed out */
      for (const fr of frags) {
        if (t < fr.t0) continue;
        const n = Math.min(fr.t.length, Math.floor((t - fr.t0) / 22));
        const s = fr.t.slice(0, n);
        ctx.save();
        ctx.globalAlpha = fade * (fr.lit ? 1 : 0.8);
        ctx.font = (fr.eq ? 'italic ' : '') + fr.size + 'px ' + (fr.eq ? '"Cormorant Garamond", serif' : '"Share Tech Mono", monospace');
        const pulse = fr.lit ? 0.5 + 0.5 * Math.sin((t - fr.t0) / 110) : 0;
        ctx.shadowColor = fr.lit ? 'rgba(255,236,190,.95)' : 'rgba(224,23,126,.6)';
        ctx.shadowBlur = fr.lit ? 8 + pulse * 10 : 4;
        ctx.fillStyle = fr.lit ? '#fff3d6' : '#ff5aa8';
        ctx.fillText(s, fr.x, fr.y);
        ctx.restore();
      }
      if (t < T_END) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); cv.classList.remove('on'); }
    }
    requestAnimationFrame(frame);
    /* numbers settle after the maths */
    scramble($('c-k'), 1350, 900); scramble($('r-temp'), 1500, 900); scramble($('c-elev'), 900, 800); scramble($('c-az'), 1000, 800);
  }
  function scramble(node, delay, dur) {
    const final = node.textContent, start = performance.now() + delay, run = mindRun;
    function step(now) {
      if (run !== mindRun) { node.textContent = final; return; }
      const k = (now - start) / dur;
      if (k >= 1) { node.textContent = final; return; }
      node.textContent = final.replace(/\d/g, (d, i) => (k > 0 && i / final.length < k) ? d : String(Math.floor(Math.random() * 10)));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function think() { const res = render(true); runMind(res); }

  /* ---------- photo preview: before / after ---------- */
  const pv = { base: null, w: 0, h: 0, raf: 0, split: 0.5, msplit: 0.5, toLin: null, toSrgb: null };
  (function luts() {
    pv.toLin = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const c = i / 255; pv.toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    pv.toSrgb = new Uint8ClampedArray(4096);
    for (let i = 0; i < 4096; i++) { const c = i / 4095; pv.toSrgb[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
  })();
  const loadImage = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = url; });
  let heicLoading = null;
  function loadHeicDecoder() {
    if (window.HeicTo) return Promise.resolve();
    if (!heicLoading) heicLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/labs/solar/heic-to.js'; s.onload = res; s.onerror = () => rej(new Error('decoder')); document.head.appendChild(s); });
    return heicLoading;
  }
  async function decodePhoto(url, file, isHeic) {
    let im = null;
    if (url) { try { im = await loadImage(url); } catch (e) { im = null; } }
    if (!im && isHeic) {
      try { await loadHeicDecoder(); const blob = await window.HeicTo({ blob: file, type: 'image/jpeg', quality: 0.9 }); im = await loadImage(URL.createObjectURL(blob)); } catch (e) { im = null; }
    }
    return im;
  }
  function setPhoto(im) {
    const max = 1600, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    pv.w = Math.round(im.naturalWidth * sc); pv.h = Math.round(im.naturalHeight * sc);
    const cb = $('cvBefore'), ca = $('cvAfter');
    cb.width = ca.width = pv.w; cb.height = ca.height = pv.h;
    const ctx = cb.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(im, 0, 0, pv.w, pv.h);
    pv.base = ctx.getImageData(0, 0, pv.w, pv.h);
    st.photo = true;
    $('plate').classList.add('loaded'); $('panel').classList.add('has-photo');
    setSplit(0.5);
  }
  function schedulePreview(wb) {
    if (!pv.base) return;
    cancelAnimationFrame(pv.raf);
    pv.raf = requestAnimationFrame(() => drawAfter(wb));
  }
  function drawAfter(wb) {
    const ca = $('cvAfter'), ctx = ca.getContext('2d');
    if (!wb) ctx.putImageData(pv.base, 0, 0);
    else {
      const w0 = S.whiteLinear(5500), w1 = S.whiteLinear(wb);
      let gr = w0[0] / w1[0], gg = 1 - st.tint / 220, gb = w0[2] / w1[2];
      const norm = 1 / Math.max(0.0001, 0.2126 * gr + 0.7152 * gg + 0.0722 * gb);
      gr *= norm; gg *= norm; gb *= norm;
      const src = pv.base.data, out = ctx.createImageData(pv.w, pv.h), d = out.data, L = pv.toLin, E = pv.toSrgb;
      for (let i = 0; i < src.length; i += 4) {
        d[i] = E[Math.min(4095, (L[src[i]] * gr * 4095) | 0)];
        d[i + 1] = E[Math.min(4095, (L[src[i + 1]] * gg * 4095) | 0)];
        d[i + 2] = E[Math.min(4095, (L[src[i + 2]] * gb * 4095) | 0)];
        d[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
    if ($('modal').classList.contains('open')) paintModal();
  }
  /* plate uses object-fit: cover, so the split is a plain fraction of its width */
  function setSplit(f) {
    pv.split = Math.max(0, Math.min(1, f));
    $('divider').style.left = (pv.split * 100) + '%';
    $('cvAfter').style.clipPath = `inset(0 0 0 ${pv.split * 100}%)`;
  }
  function setMSplit(f) { /* modal uses object-fit: contain: map to the visible picture */
    pv.msplit = Math.max(0, Math.min(1, f));
    const v = $('mview'), W = v.clientWidth, H = v.clientHeight, sc = Math.min(W / pv.w, H / pv.h), dw = pv.w * sc, ox = (W - dw) / 2, x = ox + dw * pv.msplit;
    $('mdivider').style.left = x + 'px';
    $('mAfter').style.clipPath = `inset(0 0 0 ${x}px)`;
  }
  function paintModal() {
    const b = $('mBefore'), a = $('mAfter');
    b.width = a.width = pv.w; b.height = a.height = pv.h;
    b.getContext('2d').drawImage($('cvBefore'), 0, 0); a.getContext('2d').drawImage($('cvAfter'), 0, 0);
    setMSplit(pv.msplit);
  }
  function dragSplit(elm, getFrac, apply) {
    let down = false;
    elm.addEventListener('pointerdown', e => { if (!pv.base) return; down = true; elm.setPointerCapture(e.pointerId); apply(getFrac(e)); e.preventDefault(); });
    elm.addEventListener('pointermove', e => { if (down) apply(getFrac(e)); });
    ['pointerup', 'pointercancel'].forEach(k => elm.addEventListener(k, () => { down = false; }));
  }
  dragSplit($('plate'), e => { const r = $('plate').getBoundingClientRect(); return (e.clientX - r.left) / r.width; }, setSplit);
  dragSplit($('mview'), e => { const v = $('mview'), r = v.getBoundingClientRect(), sc = Math.min(r.width / pv.w, r.height / pv.h), dw = pv.w * sc; return (e.clientX - r.left - (r.width - dw) / 2) / dw; }, setMSplit);
  $('plate').addEventListener('click', () => { if (!pv.base) $('file').click(); });
  $('plate').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !pv.base) { e.preventDefault(); $('file').click(); } });
  $('chooseBtn').addEventListener('click', () => $('file').click());
  $('expand').addEventListener('click', () => { $('modal').classList.add('open'); paintModal(); });
  $('closeModal').addEventListener('click', () => $('modal').classList.remove('open'));
  window.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').classList.remove('open'); });
  window.addEventListener('resize', () => { if ($('modal').classList.contains('open')) setMSplit(pv.msplit); clearTimeout(window.__rz); window.__rz = setTimeout(() => drawDay(compute()), 120); });

  /* ---------- file reading ---------- */
  const PICK = ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude', 'GPSAltitudeRef', 'GPSDateStamp', 'GPSTimeStamp', 'Make', 'Model'];
  const num = v => (v && typeof v === 'object' && 0 in v) ? +v[0] : +v;
  async function readFile(file) {
    status('reading ' + file.name + '…');
    const buf = await file.arrayBuffer();
    let src = buf, preview = null;
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
    if (head.startsWith('FUJIFILMCCD-RAW')) {
      const dv = new DataView(buf), off = dv.getUint32(84), len = dv.getUint32(88);
      src = buf.slice(off, off + len);
      preview = URL.createObjectURL(new Blob([src], { type: 'image/jpeg' }));
    }
    let t = null;
    try { t = await exifr.parse(src, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false, reviveValues: false, translateValues: false, mergeOutput: true, pick: PICK }); } catch (e) { t = null; }
    const ftyp = new TextDecoder().decode(new Uint8Array(buf, 4, Math.min(8, Math.max(0, buf.byteLength - 4))));
    const isHeic = /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)/.test(ftyp) || /\.(heic|heif)$/i.test(file.name);
    if (!preview) {
      if (isHeic || /^image\//.test(file.type) || /\.(jpe?g|png|webp|avif|gif)$/i.test(file.name)) preview = URL.createObjectURL(file);
      else { try { preview = await exifr.thumbnailUrl(src); } catch (e) { preview = null; } }
    }
    st.fileName = file.name; st.source = 'photo';
    if (!pv.base) $('plate').querySelector('.big').innerHTML = 'reading<br>the sky<i>…</i>';
    const decoding = decodePhoto(preview, file, isHeic);
    applyTags(t || {}, true);
    think();
    const im = await decoding;
    if (im) { setPhoto(im); const r = compute(); schedulePreview(r && r.wb); }
    else status($('status').innerHTML + ' · <span class="warn">this browser could not show the picture</span>, the white balance still works');
  }
  function applyTags(t, quiet) {
    const notes = [], camera = [t.Make, t.Model].filter(Boolean).join(' ');
    const hasGPS = isFinite(t.latitude) && isFinite(t.longitude);
    if (hasGPS) {
      st.lat = t.latitude; st.lon = t.longitude; st.place = 'Photo GPS';
      if (t.GPSAltitude != null) { st.alt = num(t.GPSAltitude) * (num(t.GPSAltitudeRef) === 1 ? -1 : 1); st.altSrc = 'exif'; }
      else { st.altSrc = 'guess'; notes.push('no altitude in the file, check it'); }
    } else { st.altSrc = 'guess'; notes.push('<span class="warn">no GPS in this file</span>: search the place in 02'); }
    const dto = t.DateTimeOriginal || t.CreateDate;
    const dm = typeof dto === 'string' && dto.match(/(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
    const off = parseOff(t.OffsetTimeOriginal || t.OffsetTime);
    let gpsUTC = null;
    if (typeof t.GPSDateStamp === 'string' && Array.isArray(t.GPSTimeStamp)) {
      const g = t.GPSDateStamp.match(/(\d{4}):(\d{2}):(\d{2})/);
      if (g) gpsUTC = Date.UTC(+g[1], +g[2] - 1, +g[3], t.GPSTimeStamp[0], t.GPSTimeStamp[1], Math.floor(t.GPSTimeStamp[2] || 0));
    }
    if (dm) {
      st.local = { y: +dm[1], mo: +dm[2], d: +dm[3], h: +dm[4], mi: +dm[5] };
      if (off != null) { st.offMin = off; st.offSrc = 'exif'; }
      else if (gpsUTC != null) { st.offMin = Math.round((Date.UTC(st.local.y, st.local.mo - 1, st.local.d, st.local.h, st.local.mi) - gpsUTC) / 60000 / 15) * 15; st.offSrc = 'gps'; }
      else if (hasGPS && window.tzlookup) { try { st.tz = tzlookup(st.lat, st.lon); st.offMin = tzOffset(st.tz, st.local); st.offSrc = 'place'; } catch (e) { st.offMin = Math.round(st.lon / 15) * 60; st.offSrc = 'guess'; } }
      else if (st.tz && !hasGPS) { st.offMin = tzOffset(st.tz, st.local); st.offSrc = 'place'; }
      else { st.offMin = Math.round(st.lon / 15) * 60; st.offSrc = 'guess'; notes.push('<span class="warn">time zone guessed</span>, searching the place sets it'); }
    } else if (gpsUTC != null) { st.offMin = Math.round(st.lon / 15) * 60; st.offSrc = 'guess'; st.local = localOf(new Date(gpsUTC)); }
    else notes.push('<span class="warn">no capture time</span>, set it in 02');
    if (!hasGPS) st.place = 'No GPS · set a place';
    status([(camera || st.fileName) + (hasGPS ? ' · GPS read on your device' : ''), ...notes].join(' · '));
    syncInputs(); if (!quiet) render();
  }

  /* ---------- place search (Photon / OpenStreetMap) + time zone & elevation (Open-Meteo) ---------- */
  let searchTimer = 0, searchSeq = 0, results = [], hi = -1;
  const res$ = $('results'), q$ = $('in-search');
  function label(pr) { return [pr.name, pr.city && pr.city !== pr.name ? pr.city : null, pr.state, pr.country].filter(Boolean).join(', '); }
  q$.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = q$.value.trim();
    const ll = parseLL(q);
    if (ll) { showResults([{ ll, title: 'Use these coordinates', sub: `${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}` }]); return; }
    if (/goo\.gl|maps\.app/i.test(q)) { showResults([], 'Short Google links can\'t be read here. Open it, then copy the address-bar link or the numbers.'); return; }
    if (q.length < 3) { showResults([]); return; }
    searchTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      try {
        const r = await fetch('https://photon.komoot.io/api/?limit=6&lang=en&q=' + encodeURIComponent(q));
        const j = await r.json();
        if (seq !== searchSeq) return;
        showResults((j.features || []).map(f => ({ ll: [f.geometry.coordinates[1], f.geometry.coordinates[0]], title: f.properties.name || label(f.properties), sub: label(f.properties), name: label(f.properties) })), 'No matches. Try a town, a landmark, or paste coordinates.');
      } catch (e) { showResults([], 'Search is not reachable right now. Paste coordinates instead.'); }
    }, 260);
  });
  function showResults(list, emptyMsg) {
    results = list; hi = -1; res$.innerHTML = '';
    if (!list.length) { if (emptyMsg && q$.value.trim().length >= 3) { res$.innerHTML = `<button type="button" disabled>${emptyMsg}</button>`; res$.classList.add('open'); } else res$.classList.remove('open'); return; }
    list.forEach((it, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'option');
      b.innerHTML = `<b></b><span></span>`; b.querySelector('b').textContent = it.title; b.querySelector('span').textContent = it.sub;
      b.addEventListener('mousedown', e => { e.preventDefault(); pick(i); });
      res$.appendChild(b);
    });
    res$.classList.add('open');
  }
  q$.addEventListener('keydown', e => {
    if (!res$.classList.contains('open') || !results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length; [...res$.children].forEach((b, i) => b.classList.toggle('hi', i === hi)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(hi < 0 ? 0 : hi); }
    if (e.key === 'Escape') res$.classList.remove('open');
  });
  q$.addEventListener('blur', () => setTimeout(() => res$.classList.remove('open'), 150));
  function pick(i) {
    const it = results[i]; if (!it) return;
    res$.classList.remove('open');
    q$.value = it.name || it.sub;
    setPlace(it.ll[0], it.ll[1], it.name || null);
  }
  async function setPlace(lat, lon, name) {
    st.lat = lat; st.lon = lon; st.place = name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    if (st.source === 'demo') st.source = 'manual';
    const bits = [];
    /* time zone: worked out on this device from the coordinates */
    try {
      st.tz = tzlookup(lat, lon);
      if (st.offSrc !== 'exif' && st.offSrc !== 'gps' && st.offSrc !== 'manual') { st.offMin = tzOffset(st.tz, st.local); st.offSrc = 'place'; }
      bits.push(`${st.tz.replace(/_/g, ' ')} · UTC${fmtOff(st.offMin)} that day`);
    } catch (e) { bits.push('<span class="warn">time zone unknown</span>, check the UTC offset'); }
    syncInputs(); think();
    status(`${name || 'Coordinates'} · ${bits.join(' · ')} · elevation…`);
    /* elevation: best effort from Open-Meteo */
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`);
      const j = await r.json();
      const ev = j && Array.isArray(j.elevation) ? j.elevation[0] : NaN;
      if (!isFinite(ev)) throw new Error('no elevation');
      if (st.altSrc !== 'manual') { st.alt = ev; st.altSrc = 'place'; }
      bits.push(`elevation ${Math.round(ev)} m`);
      syncInputs(); render();
    } catch (e) { bits.push('<span class="warn">elevation lookup busy</span>, set altitude if it matters'); }
    status(`${name || 'Coordinates'} · ${bits.join(' · ')}`);
  }

  /* ---------- inputs ---------- */
  $('in-dt').addEventListener('change', () => {
    const v = $('in-dt').value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (v) st.local = { y: +v[1], mo: +v[2], d: +v[3], h: +v[4], mi: +v[5] };
    if (st.offSrc === 'place' && st.tz) { st.offMin = tzOffset(st.tz, st.local); $('in-off').value = fmtOffInput(st.offMin); }
    if (st.source === 'demo') st.source = 'manual';
    render();
  });
  $('in-off').addEventListener('change', () => { const o = parseOff($('in-off').value); if (o != null) { st.offMin = o; st.offSrc = 'manual'; render(); } });
  $('in-alt').addEventListener('change', () => { const a = parseFloat($('in-alt').value); if (isFinite(a)) { st.alt = a; st.altSrc = 'manual'; render(); } });
  function llFromField() { const ll = parseLL($('in-ll').value); if (ll) setPlace(ll[0], ll[1], null); else if (/goo\.gl|maps\.app/i.test($('in-ll').value)) status('<span class="warn">short Google links can\'t be read here</span>: open it and copy the numbers'); }
  $('in-ll').addEventListener('change', llFromField);
  $('in-ll').addEventListener('paste', () => setTimeout(llFromField, 0));
  $('seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st.light = b.dataset.l; [...$('seg').children].forEach(x => x.classList.toggle('on', x === b)); render();
  });
  $('in-haze').addEventListener('input', e => { st.haze = e.target.value / 100; $('hazeVal').textContent = 'haze ' + e.target.value; render(); });
  $('in-corr').addEventListener('input', e => { st.corr = e.target.value / 100; $('corrVal').textContent = e.target.value + '% to neutral'; render(); });
  $('in-tint').addEventListener('input', e => { st.tint = +e.target.value; $('tintVal').textContent = 'tint ' + (st.tint >= 0 ? '+' : '') + st.tint; render(); });
  $('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return status('<span class="warn">location not available in this browser</span>');
    status('asking for your location…');
    navigator.geolocation.getCurrentPosition(pos => setPlace(pos.coords.latitude, pos.coords.longitude, 'Your location'),
      () => status('<span class="warn">location permission denied</span>, search or paste a place instead'), { timeout: 10000 });
  });
  $('file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) readFile(f).catch(err => status('<span class="warn">could not read that file</span> (' + err.message + ')')); });

  let dragDepth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('panel').classList.add('dragging'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('panel').classList.remove('dragging'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; $('panel').classList.remove('dragging');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f).catch(err => status('<span class="warn">could not read that file</span> (' + err.message + ')'));
  });

  /* ---------- export ---------- */
  function uuid() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function presetXMP(wb, tint, res) {
    const ts = (tint >= 0 ? '+' : '') + tint;
    const name = `Solar WB ${wb}K ${ts}`;
    const desc = `Sun ${res.p.elevation.toFixed(1)}° at ${fmtLat(st.lat)}, ${fmtLon(st.lon)}, ${Math.round(st.alt)} m. Light ≈ ${Math.round(res.sc.kelvin)}K (${st.light}), ${Math.round(st.corr * 100)}% toward neutral. stuartsingleton.com/solar`;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const alt = v => `\n    <rdf:Alt>\n     <rdf:li xml:lang="x-default">${v}</rdf:li>\n    </rdf:Alt>\n   `;
    return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:PresetType="Normal" crs:Cluster="" crs:UUID="${uuid()}"
   crs:SupportsAmount="False" crs:SupportsColor="True" crs:SupportsMonochrome="True"
   crs:SupportsHighDynamicRange="True" crs:SupportsNormalDynamicRange="True"
   crs:SupportsSceneReferred="True" crs:SupportsOutputReferred="True"
   crs:RequiresRGBTables="False" crs:CameraModelRestriction=""
   crs:Copyright="Stuart Singleton" crs:ContactInfo="stuartsingleton.com"
   crs:Version="15.0" crs:ProcessVersion="11.0"
   crs:WhiteBalance="Custom" crs:Temperature="${wb}" crs:Tint="${ts}"
   crs:HasSettings="True">
   <crs:Name>${alt(esc(name))}</crs:Name>
   <crs:ShortName>${alt('')}</crs:ShortName>
   <crs:SortName>${alt('')}</crs:SortName>
   <crs:Group>${alt('Solar WB')}</crs:Group>
   <crs:Description>${alt(esc(desc))}</crs:Description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
`;
  }
  $('dl').addEventListener('click', () => {
    const res = compute(); if (!res || !res.wb) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([presetXMP(res.wb, st.tint, res)], { type: 'application/rdf+xml' }));
    a.download = `Solar-WB-${res.wb}K${st.tint >= 0 ? '+' : ''}${st.tint}.xmp`;
    document.body.appendChild(a); a.click(); a.remove();
    try { window.__ssSend && window.__ssSend('solar_preset_download', null, { k: res.wb }); } catch (e) {}
  });
  $('copy').addEventListener('click', async () => {
    const res = compute(); if (!res || !res.wb) return;
    try { await navigator.clipboard.writeText(`Temp ${res.wb} · Tint ${st.tint >= 0 ? '+' : ''}${st.tint}`); $('copy').textContent = 'Copied'; setTimeout(() => $('copy').textContent = 'Copy', 1400); } catch (e) {}
  });

  window.__solar = { st, render, compute, setPlace, think };

  /* boot: right now, Nashville */
  try { st.offMin = tzOffset('America/Chicago', localOf(new Date())); } catch (e) {}
  st.local = localOf(new Date());
  try { st.offMin = tzOffset('America/Chicago', st.local); } catch (e) {}
  syncInputs(); render();
})();
