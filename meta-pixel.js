/* Meta Pixel for stuartsingleton.com — feeds the Commerce Manager catalog match rate.
   v5 (2026-10-16): content_ids are the catalog's own item ids (<photoId>-<SKU minus "GLOBAL-">,
   e.g. "14-FAP-8X12") with content_type "product". Commerce Manager reported 0 ViewContent /
   AddToCart "received" for the catalog while Events Manager showed them arriving as
   product_group + photo id, so events now name the exact rows. The id list comes from
   /catalog-titles.json (the same feed generator writes it). If that file hasn't loaded within
   1.5s, or a photo isn't in the catalog, the event falls back to product_group + photo id.
   Usage: <script src="/meta-pixel.js" data-view="14" async> fires ViewContent for photo 14.
          index.html's ssTrack() calls window.ssMetaPixel(event, opts) for the buy flow.
   Purchase is server-side only (stripe-webhook, Conversions API). */
(function () {
  var PIXEL = '1049528497730577';
  // Only the real domain reports; old mirrors (stuartsingleton.netlify.app, Vercel previews) stay silent.
  if (!/(^|\.)stuartsingleton\.com$/.test(location.hostname)) return;
  try { if (localStorage.getItem('ss_admin') === '1') return; } catch (e) {}
  if (location.pathname === '/mr.manager') return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL);
  fbq('track', 'PageView');

  var PENDING = 'ss_meta_pending';
  function uniq(list) { return list.map(function (x) { return String(x); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }
  function cartLines() { try { var c = JSON.parse(localStorage.getItem('sss_cart_v1') || '[]'); return Array.isArray(c) ? c : []; } catch (e) { return []; } }

  // ── Catalog ids ── loaded once per page; events wait for it (max 1.5s) then fall back.
  var CAT = null, catWaiters = [];
  function catReady() { var w = catWaiters; catWaiters = []; w.forEach(function (f) { f(); }); }
  try {
    fetch('/catalog-titles.json', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { CAT = d && typeof d === 'object' ? d : {}; catReady(); })
      .catch(function () { CAT = {}; catReady(); });
  } catch (e) { CAT = {}; }
  function whenCat(fn) {
    if (CAT) return fn();
    var done = false, run = function () { if (!done) { done = true; fn(); } };
    catWaiters.push(run); setTimeout(run, 1500);
  }
  function itemId(photoId, sku) {
    if (!photoId || !sku || !CAT) return null;
    var id = String(photoId) + '-' + String(sku).toUpperCase().replace(/^GLOBAL-/, '');
    return Object.prototype.hasOwnProperty.call(CAT, id) ? id : null;
  }
  function photoItems(photoId) {
    if (!CAT || !photoId) return [];
    var pre = String(photoId) + '-';
    return Object.keys(CAT).filter(function (k) { return k.indexOf(pre) === 0; });
  }
  // lines: [{ photoId, sku?, copies? }] -> pixel params using catalog item ids where possible.
  function params(lines, extra) {
    var ids = [], contents = [], fallback = false;
    lines.forEach(function (l) {
      var one = itemId(l.photoId, l.sku);
      var set = one ? [one] : photoItems(l.photoId);
      if (!set.length) { fallback = true; return; }
      set.forEach(function (id) { ids.push(id); });
      if (one) contents.push({ id: one, quantity: l.copies || 1 });
    });
    var p;
    if (fallback || !ids.length) {
      p = { content_ids: uniq(lines.map(function (l) { return l.photoId; })), content_type: 'product_group' };
    } else {
      p = { content_ids: uniq(ids), content_type: 'product' };
      if (contents.length) p.contents = contents;
    }
    p.currency = 'USD';
    for (var k in extra) if (extra[k] != null) p[k] = extra[k];
    return p;
  }

  var viewed = {};
  function view(id) {
    id = id == null ? '' : String(id);
    if (!id || viewed[id]) return; viewed[id] = 1;
    whenCat(function () { fbq('track', 'ViewContent', params([{ photoId: id }], {})); });
  }

  window.ssMetaPixel = function (event, opts) {
    opts = opts || {}; var m = opts.m || {};
    if (event === 'buy_modal') return view(opts.id);
    if (event === 'add_to_cart') {
      return whenCat(function () {
        fbq('track', 'AddToCart', params([{ photoId: opts.id, sku: m.sku }], { value: (m.cents || 0) / 100 }));
      });
    }
    if (event === 'checkout_start') {
      var lines = cartLines(), use, value;
      if ((m.items || 1) > 1 || (!m.sku && lines.length)) {
        use = lines.map(function (l) { return { photoId: l.photoId, sku: l.sku, copies: l.copies }; });
        value = lines.reduce(function (s, l) { return s + (l.priceCents || 0) * (l.copies || 1); }, 0) / 100;
      } else { use = [{ photoId: opts.id, sku: m.sku, copies: 1 }]; value = (m.cents || 0) / 100; }
      var n = use.reduce(function (s, l) { return s + (l.copies || 1); }, 0);
      return whenCat(function () { fbq('track', 'InitiateCheckout', params(use, { value: value, num_items: n })); });
    }
  };

  // Deep links (/shop?buy=14, /p?id=14) can open the buy modal before this async script loads,
  // so ssTrack('buy_modal') finds no ssMetaPixel and the ViewContent is lost. Fire it from the URL.
  try {
    var q = new URLSearchParams(location.search), deep = q.get('buy') || (location.pathname === '/p' ? q.get('id') : null);
    if (deep && /^\d+$/.test(deep)) view(deep);
  } catch (e) {}

  var me = document.currentScript;
  if (me && me.getAttribute('data-view')) view(me.getAttribute('data-view'));
  if (me && me.hasAttribute('data-checkout')) {
    // Meta shop checkout: ?products=14-FAP-8X12:2,106-CFPM-MOTH-8X12:1 — already catalog item ids.
    var raw = new URLSearchParams(location.search).get('products') || '';
    var rows = raw.split(',').map(function (s) {
      var mm = s.trim().match(/^((\d+)-[A-Z0-9-]+?)(?::(\d+))?$/i);
      return mm ? { id: mm[1].toUpperCase().replace(/^(\d+)-/, '$1-'), photoId: mm[2], qty: parseInt(mm[3] || '1', 10) || 1 } : null;
    }).filter(Boolean);
    if (rows.length) {
      fbq('track', 'InitiateCheckout', {
        content_ids: uniq(rows.map(function (r) { return r.id; })), content_type: 'product',
        contents: rows.map(function (r) { return { id: r.id, quantity: r.qty }; }),
        currency: 'USD', num_items: rows.reduce(function (s, r) { return s + r.qty; }, 0),
      });
    }
  }
  // Purchase is sent server-side by stripe-webhook (Conversions API, event_id = Stripe session),
  // which sees every paid order. Firing it here too would double count, so /print-success only
  // clears the old pending checkout record.
  if (location.pathname === '/print-success') {
    try { localStorage.removeItem(PENDING); } catch (e) {}
  }
})();
