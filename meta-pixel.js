/* Meta Pixel for stuartsingleton.com — feeds the Commerce Manager catalog match rate.
   content_ids = photo id, which is the catalog item_group_id (rows are <photoId>-<SKU>),
   sent with content_type "product_group" so Meta matches every size of the photo.
   Usage: <script src="/meta-pixel.js" data-view="14" async> fires ViewContent for photo 14.
          index.html's ssTrack() calls window.ssMetaPixel(event, opts) for the buy flow. */
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
  function ids(list) { return list.map(function (x) { return String(x); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }
  function cartLines() { try { var c = JSON.parse(localStorage.getItem('sss_cart_v1') || '[]'); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  function view(id) { if (id) fbq('track', 'ViewContent', { content_ids: ids([id]), content_type: 'product_group', currency: 'USD' }); }

  window.ssMetaPixel = function (event, opts) {
    opts = opts || {}; var m = opts.m || {};
    if (event === 'buy_modal') return view(opts.id);
    if (event === 'add_to_cart') {
      return fbq('track', 'AddToCart', { content_ids: ids([opts.id]), content_type: 'product_group', value: (m.cents || 0) / 100, currency: 'USD' });
    }
    if (event === 'checkout_start') {
      var lines = cartLines(), list, value;
      if ((m.items || 1) > 1 || (!m.sku && lines.length)) {
        list = ids(lines.map(function (l) { return l.photoId; }));
        value = lines.reduce(function (s, l) { return s + (l.priceCents || 0) * (l.copies || 1); }, 0) / 100;
      } else { list = ids([opts.id]); value = (m.cents || 0) / 100; }
      try { localStorage.setItem(PENDING, JSON.stringify({ ids: list, value: value, t: Date.now() })); } catch (e) {}
      return fbq('track', 'InitiateCheckout', { content_ids: list, content_type: 'product_group', value: value, currency: 'USD', num_items: list.length });
    }
  };

  var me = document.currentScript;
  if (me && me.getAttribute('data-view')) view(me.getAttribute('data-view'));
  if (me && me.hasAttribute('data-checkout')) {
    var raw = new URLSearchParams(location.search).get('products') || '';
    var list = ids(raw.split(',').map(function (s) { var m = s.trim().match(/^(\d+)-/); return m ? m[1] : null; }));
    if (list.length) {
      try { localStorage.setItem(PENDING, JSON.stringify({ ids: list, value: 0, t: Date.now() })); } catch (e) {}
      fbq('track', 'InitiateCheckout', { content_ids: list, content_type: 'product_group', currency: 'USD', num_items: list.length });
    }
  }
  if (location.pathname === '/print-success') {
    try {
      var p = JSON.parse(localStorage.getItem(PENDING) || 'null');
      if (p && Date.now() - p.t < 864e5) fbq('track', 'Purchase', { content_ids: p.ids, content_type: 'product_group', value: p.value || 0, currency: 'USD' });
      localStorage.removeItem(PENDING);
    } catch (e) {}
  }
})();
