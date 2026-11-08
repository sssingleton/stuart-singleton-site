/* Solar WB — UI. Needs exifr + SolarCore. Everything runs locally. */
(function () {
  const $ = id => document.getElementById(id);
  const S = window.SolarCore;
  const NS = 'http://www.w3.org/2000/svg';
  const D2R = Math.PI / 180;
  const ROMAN = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];

  const st = {
    lat: 36.1627, lon: -86.7816, alt: 180, offMin: -new Date().getTimezoneOffset(),
    local: null, /* {y,mo,d,h,mi} wall clock at the photo's place */
    haze: 0.3, light: 'sun', corr: 0.7, tint: 0,
    photo: null, fileName: null, source: 'demo'
  };

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const fmtOff = m => (m < 0 ? '-' : '+') + pad(Math.floor(Math.abs(m) / 60)) + ':' + pad(Math.abs(m) % 60);
  function parseOff(s) {
    const m = String(s || '').trim().match(/^([+-])?(\d{1,2})(?::?(\d{2}))?$/);
    if (!m) return null;
    const v = (+m[2]) * 60 + (+(m[3] || 0));
    return (m[1] === '-' ? -1 : 1) * v;
  }
  function instant() {
    const l = st.local; if (!l) return null;
    return new Date(Date.UTC(l.y, l.mo - 1, l.d, l.h, l.mi) - st.offMin * 60000);
  }
  function localOf(date) { /* wall clock at st.offMin */
    const t = new Date(date.getTime() + st.offMin * 60000);
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
  }
  function parseLL(s) {
    const m = String(s || '').match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i);
    if (!m) return null;
    let a = +m[1], b = +m[3];
    if (m[2] && /s/i.test(m[2])) a = -Math.abs(a);
    if (m[4] && /w/i.test(m[4])) b = -Math.abs(b);
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return [a, b];
  }
  const fmtLat = v => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'N' : 'S');
  const fmtLon = v => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? 'E' : 'W');
  function compass(az) { return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(az / 22.5) % 16]; }
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function status(html) { $('status').innerHTML = html; }

  /* ---------- model ---------- */
  function compute() {
    const t = instant();
    if (!t || !isFinite(st.lat)) return null;
    const p = S.sunPosition(t, st.lat, st.lon);
    const sc = S.sceneKelvin(p.elevation, st.alt, st.haze, st.light);
    let wb = null;
    if (sc.kelvin) wb = Math.round((5500 + st.corr * (sc.kelvin - 5500)) / 50) * 50;
    return { t, p, sc, wb, am: p.elevation > -0.5 ? S.airMass(p.elevation) * Math.exp(-st.alt / 8434) : null };
  }

  /* ---------- dial ---------- */
  const C = 350, R = 250;
  const rOf = e => (90 - e) / 102 * R;
  const xy = (e, az) => { const r = rOf(e); return [C + r * Math.sin(az * D2R), C - r * Math.cos(az * D2R)]; };

  function dayTrack(dateUTCmid, lat, lon, stepMin) {
    const pts = [];
    for (let m = 0; m <= 1440; m += stepMin) {
      const d = new Date(dateUTCmid.getTime() + m * 60000);
      const p = S.sunPosition(d, lat, lon);
      pts.push({ m, d, e: p.elevation, az: p.azimuth });
    }
    return pts;
  }
  function pathD(pts, minE) {
    let d = '', pen = false;
    for (const q of pts) {
      if (q.e < minE) { pen = false; continue; }
      const [x, y] = xy(q.e, q.az);
      d += (pen ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      pen = true;
    }
    return d;
  }

  function drawDial(res) {
    const svg = $('dial'); svg.innerHTML = '';
    const defs = el('defs', {}, svg);
    defs.innerHTML = `
      <radialGradient id="sunG"><stop offset="0" stop-color="#fff6d6"/><stop offset=".45" stop-color="#f4b552"/><stop offset="1" stop-color="#b8571c"/></radialGradient>
      <radialGradient id="glowG"><stop offset="0" stop-color="#f6c070" stop-opacity=".55"/><stop offset="1" stop-color="#f6c070" stop-opacity="0"/></radialGradient>
      <clipPath id="plateClip"><circle cx="${C}" cy="${C}" r="66"/></clipPath>
      <path id="arcText" d="M ${C - 312} ${C} A 312 312 0 1 1 ${C + 312} ${C}"/>
      <path id="arcText2" d="M ${C - 316} ${C} A 316 316 0 0 0 ${C + 316} ${C}"/>`;
    const gold = '#c9a55c';

    /* twilight + golden bands */
    el('circle', { cx: C, cy: C, r: rOf(-12), fill: '#1c1626', opacity: .9 }, svg);
    el('circle', { cx: C, cy: C, r: rOf(-6), fill: '#2a2147', opacity: .9 }, svg);
    el('circle', { cx: C, cy: C, r: rOf(0), fill: '#3a2a2a', opacity: .55 }, svg);
    el('circle', { cx: C, cy: C, r: rOf(6), fill: '#1d1722' }, svg);

    /* outer engraved rings + degree ticks */
    const g = el('g', { stroke: gold, fill: 'none' }, svg);
    [rOf(-12), 286, 296, 330].forEach((r, i) => el('circle', { cx: C, cy: C, r, 'stroke-width': i === 0 ? 1.2 : .7, opacity: i === 0 ? .8 : .55 }, g));
    for (let a = 0; a < 360; a += 2) {
      const long = a % 10 === 0, r1 = 286, r2 = long ? 296 : 291;
      const s = Math.sin(a * D2R), c = Math.cos(a * D2R);
      el('line', { x1: C + r1 * s, y1: C - r1 * c, x2: C + r2 * s, y2: C - r2 * c, 'stroke-width': long ? .9 : .5, opacity: .6 }, g);
    }
    /* altitude circles */
    for (let e = 0; e < 90; e += 10) el('circle', { cx: C, cy: C, r: rOf(e), 'stroke-width': e === 0 ? 1.3 : .5, opacity: e === 0 ? .9 : .32 }, g);
    /* azimuth spokes */
    for (let a = 0; a < 360; a += 15) {
      const s = Math.sin(a * D2R), c = Math.cos(a * D2R), r0 = a % 90 === 0 ? 0 : rOf(80);
      el('line', { x1: C + r0 * s, y1: C - r0 * c, x2: C + rOf(-12) * s, y2: C - rOf(-12) * c, 'stroke-width': a % 45 === 0 ? .7 : .35, opacity: a % 45 === 0 ? .5 : .28 }, g);
    }
    /* labels */
    const lab = el('g', { fill: gold, 'font-family': 'Cormorant Garamond, serif' }, svg);
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => {
      const r = 268, x = C + r * Math.sin(a * D2R), y = C - r * Math.cos(a * D2R) + 9;
      const n = el('text', { x, y, 'text-anchor': 'middle', 'font-size': 28, 'font-style': 'italic' }, lab); n.textContent = t;
    });
    const at = (e, a) => [C + rOf(e) * Math.sin(a * D2R), C - rOf(e) * Math.cos(a * D2R)];
    [[30, '30°'], [60, '60°'], [3, 'horizon'], [-3.2, 'blue hour']].forEach(([e, t]) => {
      const [x, y] = at(e, 322);
      const n = el('text', { x, y, 'font-size': e > 0 ? 12 : 11, opacity: e >= 0 ? .8 : .6, 'font-style': e < 0 ? 'italic' : 'normal', 'text-anchor': 'middle', transform: `rotate(-38 ${x} ${y})`, dy: 4 }, lab);
      n.textContent = t;
    });
    [['LVX · TEMPVS · LOCVS', '47%', 'end'], ['ALTITVDO · SOLIS', '53%', 'start']].forEach(([txt, off, anc]) => {
      const t1 = el('text', { 'font-size': 13, 'letter-spacing': 6, opacity: .8 }, lab);
      const tp = el('textPath', { href: '#arcText', startOffset: off, 'text-anchor': anc }, t1);
      tp.textContent = txt;
    });
    const nStar = el('path', { d: `M${C} ${C - 322} l5 10 -5 -3 -5 3z`, fill: gold }, lab);
    const t2 = el('text', { 'font-size': 12, 'letter-spacing': 5, opacity: .7 }, lab);
    const tp2 = el('textPath', { href: '#arcText2', startOffset: '50%', 'text-anchor': 'middle' }, t2);
    tp2.textContent = res ? (fmtLat(st.lat) + ' · ' + fmtLon(st.lon) + ' · ' + Math.round(st.alt) + ' M').toUpperCase() : 'SOLAR WHITE BALANCE';

    if (!res) return;
    const mid = new Date(Date.UTC(st.local.y, st.local.mo - 1, st.local.d) - st.offMin * 60000);

    /* solstice paths for context */
    [[6, 21, 'XXI · VI'], [12, 21, 'XXI · XII']].forEach(([mo, d, name]) => {
      const m0 = new Date(Date.UTC(st.local.y, mo - 1, d) - st.offMin * 60000);
      const pts = dayTrack(m0, st.lat, st.lon, 10);
      el('path', { d: pathD(pts, -12), fill: 'none', stroke: gold, 'stroke-width': .8, 'stroke-dasharray': '2 5', opacity: .45 }, svg);
      const top = pts.reduce((a, b) => b.e > a.e ? b : a);
      if (top.e > -6) { const [x, y] = xy(top.e, top.az); const n = el('text', { x: x + 10, y: y + (mo === 6 ? -10 : 18), fill: gold, 'font-family': 'Cormorant Garamond, serif', 'font-size': 11, opacity: .6 }, svg); n.textContent = name; }
    });

    /* the day's path */
    const pts = dayTrack(mid, st.lat, st.lon, 4);
    el('path', { d: pathD(pts, 0), fill: 'none', stroke: gold, 'stroke-width': 2.2 }, svg);
    el('path', { d: pathD(pts, -12), fill: 'none', stroke: gold, 'stroke-width': 1, opacity: .45, 'stroke-dasharray': '1 3' }, svg);
    /* hour beads */
    pts.filter(q => q.m % 60 === 0 && q.e > -12).forEach(q => {
      const [x, y] = xy(q.e, q.az);
      const hr = localOf(q.d).h;
      el('circle', { cx: x, cy: y, r: q.e > 0 ? 5 : 3.5, fill: q.e > 0 ? gold : 'none', stroke: gold, 'stroke-width': 1 }, svg);
      const dx = x - C, dy = y - C, L = Math.hypot(dx, dy) || 1;
      const n = el('text', { x: x + dx / L * 16, y: y + dy / L * 16 + 4, fill: gold, 'font-family': 'Cormorant Garamond, serif', 'font-size': 12, 'text-anchor': 'middle', opacity: q.e > 0 ? .95 : .55 }, svg);
      n.textContent = ROMAN[hr];
    });

    /* photo plate at the zenith */
    if (st.photo) {
      el('image', { href: st.photo, x: C - 66, y: C - 66, width: 132, height: 132, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#plateClip)', opacity: .92 }, svg);
    } else {
      const n = el('text', { x: C, y: C + 4, fill: gold, 'font-family': 'Share Tech Mono, monospace', 'font-size': 10, 'letter-spacing': 3, 'text-anchor': 'middle', opacity: .55 }, svg);
      n.textContent = 'ZENITH';
    }
    el('circle', { cx: C, cy: C, r: 66, fill: 'none', stroke: gold, 'stroke-width': 1.4 }, svg);
    el('circle', { cx: C, cy: C, r: 71, fill: 'none', stroke: gold, 'stroke-width': .5, opacity: .6 }, svg);

    /* the sun at the photo's moment */
    const e = res.p.elevation, az = res.p.azimuth;
    if (e > -12) {
      const [x, y] = xy(e, az);
      el('line', { x1: C, y1: C, x2: x, y2: y, stroke: '#e0177e', 'stroke-width': 1.2, 'stroke-dasharray': '3 4', opacity: .9 }, svg);
      el('circle', { cx: x, cy: y, r: 40, fill: 'url(#glowG)' }, svg);
      const sg = el('g', { transform: `translate(${x} ${y})` }, svg);
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5 * D2R, r1 = 15, r2 = i % 2 ? 22 : 28, w = .17;
        el('path', { d: `M${(r1 * Math.sin(a - w)).toFixed(1)} ${(-r1 * Math.cos(a - w)).toFixed(1)} L${(r2 * Math.sin(a)).toFixed(1)} ${(-r2 * Math.cos(a)).toFixed(1)} L${(r1 * Math.sin(a + w)).toFixed(1)} ${(-r1 * Math.cos(a + w)).toFixed(1)}Z`, fill: e > 0 ? '#e9b45a' : '#8a7ab0' }, sg);
      }
      el('circle', { r: 13, fill: e > 0 ? 'url(#sunG)' : '#6f62a0', stroke: '#fff3cf', 'stroke-width': .6 }, sg);
    } else {
      const n = el('text', { x: C, y: C + rOf(-12) - 14, fill: gold, 'font-family': 'Cormorant Garamond, serif', 'font-size': 16, 'font-style': 'italic', 'text-anchor': 'middle' }, svg);
      n.textContent = 'the sun is under the world';
    }
  }

  /* ---------- day strip ---------- */
  function drawDay(res) {
    const svg = $('day'); svg.innerHTML = '';
    if (!res) return;
    const mid = new Date(Date.UTC(st.local.y, st.local.mo - 1, st.local.d) - st.offMin * 60000);
    const pts = dayTrack(mid, st.lat, st.lon, 5).map(q => ({ ...q, k: S.sceneKelvin(q.e, st.alt, st.haze, st.light).kelvin }));
    const lit = pts.filter(q => q.k);
    if (!lit.length) { $('dayLabel').textContent = 'polar night: no daylight on this date'; return; }
    const m0 = lit[0].m, m1 = lit[lit.length - 1].m, W = Math.max(280, Math.round(svg.getBoundingClientRect().width || 1200)), H = 60;
    svg.setAttribute('viewBox', `0 -14 ${W} 122`);
    const every = W < 520 ? 3 : W < 820 ? 2 : 1;
    const X = m => (m - m0) / Math.max(1, m1 - m0) * W;
    const defs = el('defs', {}, svg);
    const lg = el('linearGradient', { id: 'dayG', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    lit.forEach(q => { const [r, g, b] = S.kelvinRGB(q.k); el('stop', { offset: (X(q.m) / W).toFixed(4), 'stop-color': `rgb(${r},${g},${b})` }, lg); });
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#dayG)' }, svg);
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'none', stroke: '#151317', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, svg);
    /* hour ticks */
    lit.filter(q => q.m % 60 === 0).forEach(q => {
      const x = X(q.m), h = localOf(q.d).h;
      el('line', { x1: x, y1: H, x2: x, y2: H + 8, stroke: '#151317', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, svg);
      if (h % every) return;
      const n = el('text', { x, y: H + 22, 'font-family': 'Share Tech Mono, monospace', 'font-size': 11, 'text-anchor': x > W - 24 ? 'end' : x < 24 ? 'start' : 'middle', fill: '#151317' }, svg);
      n.textContent = pad(h) + ':00';
    });
    /* sunrise / sunset marks */
    let rise = null, set = null;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].e < -0.833 && pts[i].e >= -0.833 && !rise) rise = pts[i];
      if (pts[i - 1].e >= -0.833 && pts[i].e < -0.833) set = pts[i];
    }
    [[rise, 'sunrise'], [set, 'sunset']].forEach(([q, name]) => {
      if (!q) return;
      const x = X(q.m);
      el('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#151317', 'stroke-width': 1, 'stroke-dasharray': '2 3', 'vector-effect': 'non-scaling-stroke', opacity: .55 }, svg);
      const lt = localOf(q.d);
      const n = el('text', { x: x + (name === 'sunrise' ? 5 : -5), y: 13, 'font-family': 'Share Tech Mono, monospace', 'font-size': 10, fill: '#151317', 'text-anchor': name === 'sunrise' ? 'start' : 'end', opacity: .75 }, svg);
      n.textContent = name + ' ' + pad(lt.h) + ':' + pad(lt.mi);
    });
    /* photo marker */
    const pm = (res.t - mid) / 60000;
    if (pm >= m0 && pm <= m1) {
      const x = X(pm);
      el('line', { x1: x, y1: -6, x2: x, y2: H + 6, stroke: '#e0177e', 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke' }, svg);
      el('path', { d: `M${x - 7} -12 L${x + 7} -12 L${x} -3Z`, fill: '#e0177e' }, svg);
      if (res.sc.kelvin) {
        const n = el('text', { x: x, y: H + 38, 'font-family': 'Courier Prime, monospace', 'font-weight': 700, 'font-size': 13, fill: '#e0177e', 'text-anchor': x > W - 80 ? 'end' : x < 80 ? 'start' : 'middle' }, svg);
        n.textContent = Math.round(res.sc.kelvin) + 'K at the shot';
      }
    }
    const lt0 = localOf(lit[0].d), lt1 = localOf(lit[lit.length - 1].d);
    $('dayLabel').textContent = `${st.local.y}.${pad(st.local.mo)}.${pad(st.local.d)} · first light ${pad(lt0.h)}:${pad(lt0.mi)} → last light ${pad(lt1.h)}:${pad(lt1.mi)}`;
  }

  /* ---------- render ---------- */
  const PHASE = { night: 'night · no sun to balance', blue: 'blue hour', golden: 'golden hour', low: 'low sun', day: 'daylight' };
  function render() {
    const res = compute();
    drawDial(res); drawDay(res);
    if (!res) return;
    const { p, sc, wb } = res;
    const l = st.local;
    $('v-time').textContent = `${l.y}.${pad(l.mo)}.${pad(l.d)} · ${pad(l.h)}:${pad(l.mi)} ${fmtOff(st.offMin)}`;
    $('v-lat').textContent = 'lat ' + fmtLat(st.lat);
    $('v-lon').textContent = 'lon ' + fmtLon(st.lon);
    $('v-alt').textContent = 'alt ' + Math.round(st.alt) + ' m';
    $('v-sun').textContent = `sun ${p.elevation.toFixed(1)}° · az ${Math.round(p.azimuth)}° ${compass(p.azimuth)}`;
    $('v-am').textContent = 'air mass ' + (res.am ? res.am.toFixed(1) : '—');
    $('in-elev').value = `${p.elevation.toFixed(1)}° ${p.elevation >= 0 ? 'up' : 'down'}`;
    $('r-ghost1').textContent = `SUN ${p.elevation.toFixed(1)}°`;
    $('r-k').textContent = sc.kelvin ? Math.round(sc.kelvin) + 'K' : 'NIGHT';
    $('r-ghost2').textContent = (st.light === 'sun' ? 'DIRECT' : st.light.toUpperCase()) + (wb ? ' → ' + wb : '');
    $('phase').textContent = (st.source === 'demo' ? 'right now in Nashville · ' : '') + PHASE[sc.phase] + (sc.kelvin ? ' · the light' : '');
    $('o-temp').textContent = wb ? wb : '—';
    $('o-tint').textContent = (st.tint >= 0 ? '+' : '') + st.tint;
    $('dl').disabled = !wb; $('copy').disabled = !wb;
    /* keep a soft wash of the light colour behind the readout */
    if (sc.kelvin) {
      const [r, g, b] = S.kelvinRGB(sc.kelvin);
      document.querySelector('.readout').style.background = `linear-gradient(90deg, rgba(${r},${g},${b},.35), rgba(${r},${g},${b},0) 85%)`;
    }
  }

  function syncInputs() {
    const l = st.local;
    $('in-dt').value = `${l.y}-${pad(l.mo)}-${pad(l.d)}T${pad(l.h)}:${pad(l.mi)}`;
    $('in-off').value = fmtOff(st.offMin);
    $('in-ll').value = isFinite(st.lat) ? `${st.lat.toFixed(5)}, ${st.lon.toFixed(5)}` : '';
    $('in-alt').value = Math.round(st.alt);
  }

  /* ---------- file reading ---------- */
  const PICK = ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude', 'GPSAltitudeRef', 'GPSDateStamp', 'GPSTimeStamp', 'Make', 'Model'];
  const num = v => (v && typeof v === 'object' && 0 in v) ? +v[0] : +v;

  async function readFile(file) {
    status('reading ' + file.name + '…');
    const buf = await file.arrayBuffer();
    let src = buf, preview = null;
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(16, buf.byteLength)));
    if (head.startsWith('FUJIFILMCCD-RAW')) { /* RAF: embedded JPEG holds the EXIF */
      const dv = new DataView(buf), off = dv.getUint32(84), len = dv.getUint32(88);
      src = buf.slice(off, off + len);
      preview = URL.createObjectURL(new Blob([src], { type: 'image/jpeg' }));
    }
    let t = null;
    try {
      t = await exifr.parse(src, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false, reviveValues: false, translateValues: false, mergeOutput: true, pick: PICK });
    } catch (e) { t = null; }
    if (!preview) {
      if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)) preview = URL.createObjectURL(file);
      else { try { preview = await exifr.thumbnailUrl(src); } catch (e) { preview = null; } }
      if (!preview && /heic|heif/i.test(file.type + file.name)) preview = URL.createObjectURL(file); /* Safari can show HEIC */
    }
    st.photo = preview; st.fileName = file.name; st.source = 'photo';
    $('dropHint').style.display = 'none';
    applyTags(t || {});
  }

  function applyTags(t) {
    const notes = [];
    const camera = [t.Make, t.Model].filter(Boolean).join(' ');
    /* place */
    const hasGPS = isFinite(t.latitude) && isFinite(t.longitude);
    if (hasGPS) {
      st.lat = t.latitude; st.lon = t.longitude;
      if (t.GPSAltitude != null) st.alt = num(t.GPSAltitude) * (num(t.GPSAltitudeRef) === 1 ? -1 : 1);
      else notes.push('no altitude in the file, check it');
    } else notes.push('<span class="warn">no GPS in this file</span>: paste coordinates or use your location');
    /* time */
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
      if (off != null) st.offMin = off;
      else if (gpsUTC != null) { /* derive offset from camera clock vs GPS clock */
        const wall = Date.UTC(st.local.y, st.local.mo - 1, st.local.d, st.local.h, st.local.mi);
        st.offMin = Math.round((wall - gpsUTC) / 60000 / 15) * 15;
      } else {
        st.offMin = Math.round(st.lon / 15) * 60;
        notes.push('<span class="warn">time zone guessed from longitude</span>, check the UTC offset');
      }
    } else if (gpsUTC != null) {
      st.offMin = Math.round(st.lon / 15) * 60; st.local = localOf(new Date(gpsUTC));
    } else notes.push('<span class="warn">no capture time</span>, set it below');
    status([(camera || st.fileName) + (hasGPS ? ' · GPS read locally' : ''), ...notes].join(' · '));
    syncInputs(); render();
  }

  /* ---------- inputs ---------- */
  function readInputs() {
    const v = $('in-dt').value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (v) st.local = { y: +v[1], mo: +v[2], d: +v[3], h: +v[4], mi: +v[5] };
    const o = parseOff($('in-off').value); if (o != null) st.offMin = o;
    const ll = parseLL($('in-ll').value); if (ll) { st.lat = ll[0]; st.lon = ll[1]; }
    const a = parseFloat($('in-alt').value); if (isFinite(a)) st.alt = a;
    if (st.source === 'demo') st.source = 'manual';
    render();
  }
  ['in-dt', 'in-off', 'in-ll', 'in-alt'].forEach(id => $(id).addEventListener('change', readInputs));
  $('in-ll').addEventListener('paste', () => setTimeout(readInputs, 0));
  $('seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st.light = b.dataset.l;
    [...$('seg').children].forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('in-haze').addEventListener('input', e => { st.haze = e.target.value / 100; $('hazeVal').textContent = 'haze ' + e.target.value; render(); });
  $('in-corr').addEventListener('input', e => { st.corr = e.target.value / 100; $('corrVal').textContent = e.target.value + '%'; render(); });
  $('in-tint').addEventListener('input', e => { st.tint = +e.target.value; $('tintVal').textContent = 'tint ' + (st.tint >= 0 ? '+' : '') + st.tint; render(); });
  $('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return status('<span class="warn">location not available in this browser</span>');
    status('asking for your location…');
    navigator.geolocation.getCurrentPosition(pos => {
      st.lat = pos.coords.latitude; st.lon = pos.coords.longitude;
      if (pos.coords.altitude != null) st.alt = pos.coords.altitude;
      if (st.source === 'demo') st.source = 'manual';
      status('using your current location' + (pos.coords.altitude == null ? ' · altitude not given, check it' : ''));
      syncInputs(); render();
    }, () => status('<span class="warn">location permission denied</span>, paste coordinates instead'), { enableHighAccuracy: false, timeout: 10000 });
  });
  $('file').addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f).catch(err => status('<span class="warn">could not read that file</span> (' + err.message + ')')); });

  /* drag anywhere */
  let dragDepth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('panel').classList.add('dragging'); $('dropBtn').classList.add('dragging'); });
  window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('panel').classList.remove('dragging'); $('dropBtn').classList.remove('dragging'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; $('panel').classList.remove('dragging'); $('dropBtn').classList.remove('dragging');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f).catch(err => status('<span class="warn">could not read that file</span> (' + err.message + ')'));
  });

  /* ---------- export ---------- */
  function uuid() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function presetXMP(wb, tint, res) {
    const name = `Solar WB ${wb}K ${tint >= 0 ? '+' : ''}${tint}`;
    const desc = `Sun ${res.p.elevation.toFixed(1)}° at ${fmtLat(st.lat)}, ${fmtLon(st.lon)}, ${Math.round(st.alt)} m. Light ≈ ${Math.round(res.sc.kelvin)}K (${st.light}), ${Math.round(st.corr * 100)}% toward neutral. stuartsingleton.com/solar`;
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00        ">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:PresetType="Normal"
   crs:Cluster=""
   crs:UUID="${uuid()}"
   crs:SupportsAmount="False"
   crs:SupportsColor="True"
   crs:SupportsMonochrome="True"
   crs:SupportsHighDynamicRange="True"
   crs:SupportsNormalDynamicRange="True"
   crs:SupportsSceneReferred="True"
   crs:SupportsOutputReferred="True"
   crs:RequiresRGBTables="False"
   crs:CameraModelRestriction=""
   crs:Copyright="Stuart Singleton"
   crs:ContactInfo="stuartsingleton.com"
   crs:Version="15.0"
   crs:ProcessVersion="11.0"
   crs:WhiteBalance="Custom"
   crs:Temperature="${wb}"
   crs:Tint="${tint >= 0 ? '+' : ''}${tint}"
   crs:HasSettings="True">
   <crs:Name>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${esc(name)}</rdf:li>
    </rdf:Alt>
   </crs:Name>
   <crs:ShortName>
    <rdf:Alt>
     <rdf:li xml:lang="x-default"/>
    </rdf:Alt>
   </crs:ShortName>
   <crs:SortName>
    <rdf:Alt>
     <rdf:li xml:lang="x-default"/>
    </rdf:Alt>
   </crs:SortName>
   <crs:Group>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">Solar WB</rdf:li>
    </rdf:Alt>
   </crs:Group>
   <crs:Description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${esc(desc)}</rdf:li>
    </rdf:Alt>
   </crs:Description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
`;
  }
  $('dl').addEventListener('click', () => {
    const res = compute(); if (!res || !res.wb) return;
    const xml = presetXMP(res.wb, st.tint, res);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([xml], { type: 'application/rdf+xml' }));
    a.download = `Solar-WB-${res.wb}K${st.tint >= 0 ? '+' : ''}${st.tint}.xmp`;
    document.body.appendChild(a); a.click(); a.remove();
    try { window.__ssSend && window.__ssSend('solar_preset_download', null, { k: res.wb }); } catch (e) {}
  });
  $('copy').addEventListener('click', async () => {
    const res = compute(); if (!res || !res.wb) return;
    try { await navigator.clipboard.writeText(`Temp ${res.wb} · Tint ${st.tint >= 0 ? '+' : ''}${st.tint}`); $('copy').textContent = 'Copied'; setTimeout(() => $('copy').textContent = 'Copy', 1400); } catch (e) {}
  });

  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawDay(compute()), 120); });

  /* expose for testing */
  window.__solar = { st, applyTags, render, compute };

  /* boot: right now, Nashville */
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'longOffset' }).formatToParts(new Date()).find(x => x.type === 'timeZoneName');
    const o = parseOff((part && part.value || '').replace('GMT', '')); if (o != null) st.offMin = o;
  } catch (e) { st.offMin = -360; }
  st.local = localOf(new Date());
  syncInputs(); render();
})();
