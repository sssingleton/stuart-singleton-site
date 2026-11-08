/* Solar WB core — sun position (NOAA) + spectral daylight model.
   Pure functions, no DOM. Exposes window.SolarCore (or module.exports in node). */
(function (root) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const mod = (a, n) => ((a % n) + n) % n;

  /* NOAA solar position. date = JS Date (absolute instant), lat/lon degrees (east +). */
  function sunPosition(date, lat, lon) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Mr = M * D2R;
    const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
    const omega = (125.04 - 1934.136 * T) * D2R;
    const lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) * D2R;
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = (eps0 + 0.00256 * Math.cos(omega)) * D2R;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
    const y = Math.tan(eps / 2) ** 2, L0r = L0 * D2R;
    const eqt = 4 * R2D * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const tst = mod(utcMin + eqt + 4 * lon, 1440);
    let ha = tst / 4 - 180; if (ha < -180) ha += 360;
    const latr = lat * D2R, har = ha * D2R;
    let cz = Math.sin(latr) * Math.sin(decl) + Math.cos(latr) * Math.cos(decl) * Math.cos(har);
    cz = Math.max(-1, Math.min(1, cz));
    const zen = Math.acos(cz) * R2D;
    let elev = 90 - zen;
    /* atmospheric refraction (NOAA) */
    let ref = 0;
    if (elev <= 85) {
      const te = Math.tan(elev * D2R);
      if (elev > 5) ref = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
      else if (elev > -0.575) ref = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
      else ref = -20.772 / te;
      ref /= 3600;
    }
    elev += ref;
    let az;
    const sz = Math.sin(zen * D2R);
    if (Math.abs(sz) < 1e-9) az = 180;
    else {
      let ca = (Math.sin(latr) * cz - Math.sin(decl)) / (Math.cos(latr) * sz);
      ca = Math.max(-1, Math.min(1, ca));
      az = Math.acos(ca) * R2D;
      az = ha > 0 ? mod(az + 180, 360) : mod(540 - az, 360);
    }
    return { elevation: elev, azimuth: az, declination: decl * R2D, eqTime: eqt, solarNoonUtcMin: mod(720 - 4 * lon - eqt, 1440) };
  }

  /* ---------- spectral daylight model ---------- */
  const WL = []; for (let w = 380; w <= 780; w += 10) WL.push(w);
  const CMF = {"x":[0.00137,0.00424,0.01431,0.04351,0.13438,0.2839,0.34828,0.3362,0.2908,0.19536,0.09564,0.03201,0.0049,0.0093,0.06327,0.1655,0.2904,0.43345,0.5945,0.7621,0.9163,1.0263,1.0622,1.0026,0.85445,0.6424,0.4479,0.2835,0.1649,0.0874,0.04677,0.0227,0.01136,0.00579,0.0029,0.00144,0.00069,0.00035,0.00017,0.00008,0.00004],"y":[0.00004,0.00012,0.0004,0.0012,0.004,0.0116,0.023,0.038,0.06,0.09098,0.13902,0.20802,0.323,0.503,0.71,0.862,0.954,0.99495,0.995,0.952,0.87,0.757,0.631,0.503,0.381,0.265,0.175,0.107,0.061,0.032,0.017,0.00821,0.0041,0.00209,0.00105,0.00052,0.00025,0.00012,0.00006,0.00003,0.00001],"z":[0.00645,0.02005,0.06785,0.2074,0.6456,1.3856,1.74706,1.77211,1.6692,1.28764,0.81295,0.46518,0.272,0.1582,0.07825,0.04216,0.0203,0.00875,0.0039,0.0021,0.00165,0.0011,0.0008,0.00034,0.00019,0.00005,0.00002,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
  const planck = (wlnm, T) => { const l = wlnm * 1e-9; return 1 / (l ** 5 * (Math.exp(0.014388 / (l * T)) - 1)); };
  const SUN0 = WL.map(w => planck(w, 5778));
  const TAU_R = WL.map(w => { const u = w / 1000; return 0.008569 * u ** -4 * (1 + 0.0113 * u ** -2 + 0.00013 * u ** -4); });

  function airMass(elev) { /* Kasten-Young, geometric elevation */
    const e = Math.max(elev, -0.5);
    const z = 90 - e;
    return 1 / (Math.cos(z * D2R) + 0.50572 * Math.pow(96.07995 - z, -1.6364));
  }
  function specToXYZ(S) {
    let X = 0, Y = 0, Z = 0;
    for (let i = 0; i < WL.length; i++) { X += S[i] * CMF.x[i]; Y += S[i] * CMF.y[i]; Z += S[i] * CMF.z[i]; }
    return [X / Y, 1, Z / Y];
  }
  function xyzToCCT(xyz) { /* McCamy, good 2000–12500K */
    const s = xyz[0] + xyz[1] + xyz[2], x = xyz[0] / s, y = xyz[1] / s;
    const n = (x - 0.3320) / (0.1858 - y);
    return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  }
  const bbXYZ = T => specToXYZ(WL.map(w => planck(w, T)));

  /* haze: 0 clean … 1 heavy. Aerosol lives mostly in the lowest ~1.5 km. */
  const HAZE_BETA = h => 0.03 + 0.32 * h;

  /* Direct sun beam colour at elevation/altitude/haze. */
  function beamXYZ(elev, altM, haze) {
    const am = airMass(elev);
    const p = Math.exp(-altM / 8434);
    const beta = HAZE_BETA(haze) * Math.exp(-altM / 1500);
    const S = SUN0.map((s0, i) => s0 * Math.exp(-(TAU_R[i] * p + beta * (WL[i] / 1000) ** -1.3) * am));
    return specToXYZ(S);
  }
  const mix = (a, b, f) => [a[0] * (1 - f) + b[0] * f, 1, a[2] * (1 - f) + b[2] * f];

  /* Scene illuminant estimate. light: 'sun' | 'shade' | 'overcast' */
  function daylitK(elev, altM, haze, light, altK) {
    const sky = bbXYZ(8500 + 2000 * altK + 2500 * Math.exp(-Math.max(elev, 0) / 10));
    let xyz;
    if (light === 'shade') xyz = mix(sky, beamXYZ(elev, altM, haze), 0.08);
    else if (light === 'overcast') xyz = mix(bbXYZ(6400 - 300 * haze), sky, 0.25 * Math.exp(-Math.max(elev, 0) / 15));
    else {
      const fd = Math.min(0.6, 0.12 + 0.12 * haze + 0.35 * Math.exp(-Math.max(elev, 0) / 12) * (1 - 0.5 * altK));
      xyz = mix(beamXYZ(elev, altM, haze), sky, fd);
    }
    return Math.max(1800, Math.min(12500, xyzToCCT(xyz)));
  }
  function twilightK(elev, light, altK) { /* sun below horizon: skylight only, ozone-blue */
    const t = Math.min(1, Math.max(0, -elev / 6));
    return light === 'overcast' ? 7200 + 2600 * t : 7000 + 5000 * t + 800 * altK;
  }
  function sceneKelvin(elev, altM, haze, light) {
    const altK = Math.min(altM, 5000) / 5000;
    if (elev < -6) return { kelvin: null, phase: 'night' };
    let k;
    if (elev >= 1) k = daylitK(elev, altM, haze, light, altK);
    else if (elev <= -1) k = twilightK(elev, light, altK);
    else { /* blend in mired space across the horizon */
      const f = (elev + 1) / 2, a = 1e6 / daylitK(1, altM, haze, light, altK), b = 1e6 / twilightK(-1, light, altK);
      k = 1e6 / (a * f + b * (1 - f));
    }
    const phase = elev < 0 ? 'blue' : elev < 6 ? 'golden' : elev < 15 ? 'low' : 'day';
    return { kelvin: k, phase };
  }

  /* Approx sRGB swatch for a colour temperature (for UI only). */
  function kelvinRGB(K) {
    const t = K / 100; let r, g, b;
    if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
    else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
    const c = v => Math.round(Math.max(0, Math.min(255, v)));
    return [c(r), c(g), c(b)];
  }

  const api = { sunPosition, airMass, sceneKelvin, beamXYZ, xyzToCCT, kelvinRGB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SolarCore = api;
})(typeof window !== 'undefined' ? window : this);
