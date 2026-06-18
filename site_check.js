
// ══ SUPABASE ══
const SUPA_URL = 'https://zbcdeglxwrappriwpxwt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiY2RlZ2x4d3JhcHByaXdweHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyODUsImV4cCI6MjA4OTUxMzI4NX0.IMGxd2IIRvVWgA441aLFtH2VujrZgVRehv2Hb2qNEus';
const { createClient } = supabase;
const sb = createClient(SUPA_URL, SUPA_KEY);

// ══ RESPONSIVE IMAGES ══
// Supabase serves on-the-fly resized JPEGs from /render/image/. A full-res
// original is ~400KB+; a 480px copy is ~35KB. We serve small copies for grid
// thumbnails (huge win on mobile/cellular) and keep full-res only in the print
// preview, where print-quality matters.
function thumbURL(src, width, quality) {
  if (!src || typeof src !== 'string') return src;
  // Only transform our own Supabase storage objects.
  const marker = '/storage/v1/object/public/';
  const i = src.indexOf(marker);
  if (i === -1) return src;
  const rest = src.slice(i + marker.length); // e.g. "photos/photo_123.jpg"
  const q = (quality != null ? quality : 62);
  return src.slice(0, i) + '/storage/v1/render/image/public/' + rest +
    '?width=' + width + '&quality=' + q + '&resize=contain';
}
// Build a srcset so the browser picks the right size for the device/DPR.
function thumbSrcset(src, widths) {
  return widths.map(function(w){ return thumbURL(src, w, 62) + ' ' + w + 'w'; }).join(', ');
}

// ══ TRACKS ══
const TRACKS = [
  { num:"01", title:"Rearview", artist:"Luke Lasso", role:"writer / producer", spotify:"0UdpxBj2JbkVtyK37eKVQY", yt:"xt6HggDzMDY" },
  { num:"02", title:"happy for you", artist:"Stacey Kelleher", role:"writer", spotify:"4X3YqAkHyQqWQxi5pgwaPj", yt:"HN-3kgQuNh0" },
  { num:"03", title:"I Don't Wanna Know", artist:"Preston Wayne", role:"writer / producer", spotify:"72q09xagLbGM5eo4HvImqI", yt:"gX7zBdtMQFA" },
  { num:"04", title:"Summertime", artist:"Luke Lasso", role:"writer / producer", spotify:"4cxXqqUrgVboKHj1jV7cXS", yt:"SyeMVKnTp-s" },
  { num:"05", title:"The Way Things Go", artist:"Luke Lasso", role:"writer / producer", spotify:"3vymu3fBpcisORqtS8KDKh", yt:"qdZEznxADj0" },
  { num:"06", title:"Icing", artist:"Hew G., Casein, Wonkerz", role:"writer / producer", spotify:"67hn2UvcxQGYxYphwiBsaJ", yt:"xR0xW5AoLvk" },
  { num:"07", title:"Miracles", artist:"just_omalley", role:"writer / producer", spotify:"10XM2akXy5A2rNwSG2qOuj", yt:"Lqki0jmkQR4" },
  { num:"08", title:"Dreams", artist:"Jyou, Casein, Wonkerz", role:"writer / producer", spotify:"4tLy74vr5DmehOw4auAtIo", yt:"1Zv3fFfrkgc" },
  { num:"09", title:"Piece of Cake", artist:"Hew G., Casein, Wonkerz", role:"writer / producer", spotify:"0m8vNfmWERRuTnOFL2LgiI", yt:"xyx8tYE9ZVI" },
  { num:"10", title:"Blue Jean Crazy", artist:"Laura Bryna", role:"writer", spotify:"5R6rwKrbPCjYzX7P3aZ3mQ", yt:null },
  { num:"11", title:"soberimwitchu", artist:"Jyou, Casein", role:"writer / producer", spotify:"6xKJYv1SWnFOtFIEFfoOGp", yt:null },
  { num:"12", title:"addict", artist:"Jyou, Casein", role:"writer / producer", spotify:"1rZlj2GxALeJ3RGcnIl3Zj", yt:null },
  { num:"13", title:"Who Are You", artist:"Nathan Fouts", role:"writer / producer", spotify:"3dhd1j2RRQjcWsx8aKC5mJ", yt:"q2OqUZxbPkU" },
  { num:"14", title:"Chocolate", artist:"Hew G., Casein", role:"writer / producer", spotify:"3s8aoIib95wmDK6xuZPKD6", yt:null },
  { num:"15", title:"Surfboard", artist:"Abraysiv, Casein", role:"writer / producer", spotify:"3JnsSb6zSxDzE8BQHQ5QNe", yt:null },
  { num:"16", title:"No Pressure", artist:"Goody, Casein", role:"writer / producer", spotify:"1SXbE4fmhRJ0rv00NYh2nL", yt:null }
];

function renderTracks(tracks) {
  const list = document.getElementById('track-list');
  const COLOR_CLASSES = ["color-r","color-b","color-y"];
  const NUM_CLASSES   = ["track-num-r","track-num-b","track-num-y"];
  list.innerHTML = tracks.map(t => {
    const n = parseInt(t.num.replace(/^0+/,""), 10);
    const idx = n % 3 === 1 ? 0 : n % 3 === 2 ? 1 : 2;
    const colorCls = COLOR_CLASSES[idx];
    const numCls   = NUM_CLASSES[idx];
    const hasYT = !!t.yt;
    const playBtn = `<button class="play-btn" onclick="event.preventDefault();${hasYT
      ? `openYT('${t.yt}','${t.title.replace(/'/g,"\\'")}','${t.artist}')`
      : t.spotify
        ? `window.open('https://open.spotify.com/track/${t.spotify}','_blank')`
        : `openYT('${t.yt}','${t.title.replace(/'/g,"\\'")}','${t.artist}')`
    }" aria-label="Play"><svg width="9" height="11" viewBox="0 0 9 11"><path d="M1 1L8 5.5L1 10V1Z" fill="#ccc"/></svg></button>`;
    const href = t.spotify ? `https://open.spotify.com/track/${t.spotify}` : `javascript:void(0)`;
    const targetAttr = t.spotify ? `target="_blank" rel="noopener"` : `onclick="event.preventDefault()"`;
    return `<a class="track-row ${colorCls}" href="${href}" ${targetAttr}>
      <div class="track-num ${numCls}">${t.num}</div>${playBtn}
      <div class="track-info"><div class="track-title">${t.title}</div><div class="track-meta">${t.artist} · ${t.role}</div></div>
      <div class="track-arrow">↗</div>
    </a>`;
  }).join('');
  addHover('.play-btn');
}

// == BEATS ==
var BEATS = [
  { num:"01", title:"yoru",          artist:"Casein, David Chief", role:"producer", spotify:"4Eg9lHd6ghvEh7ws7YNmAB", yt:null },
  { num:"02", title:"reimbursement", artist:"Casein, Wonkerz",     role:"producer", spotify:"3uqCGyQePfkza7P0NsqJCT", yt:null },
  { num:"03", title:"aqueous",       artist:"Casein, Wonkerz",     role:"producer", spotify:"6qUHwRsfHRWZyMREomBois", yt:null },
  { num:"04", title:"truff",         artist:"Casein, Wonkerz",     role:"producer", spotify:"35ryd6EGdTzmas4iN3NzB3", yt:null },
  { num:"05", title:"riz",           artist:"Casein",              role:"producer", spotify:null, yt:"4fVD6x7FPm8" },
  { num:"06", title:"lounge",        artist:"Casein",              role:"producer", spotify:null, yt:"pk-Tq2A1GPM" },
  { num:"07", title:"locust",        artist:"Casein, David Chief", role:"producer", spotify:null, yt:"z02gy599aZM" },
  { num:"08", title:"retrospective", artist:"Wonkerz, Casein",     role:"producer", spotify:null, yt:"jXttzcYbjHE" },
  { num:"09", title:"fees",          artist:"Casein",              role:"producer", spotify:null, yt:"vGbE5jVf98k" },
  { num:"10", title:"lamana",        artist:"Wonkerz, Casein",     role:"producer", spotify:null, yt:"vcuZTwqe_fA" },
  { num:"11", title:"tonburi",       artist:"znof, Casein",        role:"producer", spotify:null, yt:"a9BJIF2DR9Y" },
  { num:"12", title:"kigen",         artist:"Casein",              role:"producer", spotify:null, yt:"-TPzE-FBe3I" },
  { num:"13", title:"tangie",        artist:"Casein",              role:"producer", spotify:null, yt:"L9rIV1unvJI" },
  { num:"14", title:"goro",          artist:"Casein",              role:"producer", spotify:null, yt:"NI7M7JRz7Gk" }
];
var currentMusicTab = "songs";
function switchMusicTab(tab) {
  currentMusicTab = tab;
  var mp = document.getElementById("music-page");
  var ts = document.getElementById("tab-songs");
  var tb = document.getElementById("tab-beats");
  if (tab === "beats") {
    mp.classList.add("tab-beats"); mp.classList.remove("tab-songs");
    ts.classList.remove("active-songs"); tb.classList.add("active-beats");
    renderTracks(BEATS);
  } else {
    mp.classList.remove("tab-beats"); mp.classList.add("tab-songs");
    ts.classList.add("active-songs"); tb.classList.remove("active-beats");
    renderTracks(TRACKS);
  }
}

renderTracks(TRACKS);

// ══ PHOTOS WITH TAG FILTER ══
// ══ PHOTOS — load from Supabase ══
const FALLBACK_PHOTOS = [];

let PHOTOS = [];
let activeTags = new Set();
let selectedFile = null;
let selectedSpan = '';

// Resolves the first time loadPhotos() finishes (success or fallback). Deep-link
// routing (e.g. /shop?buy=<id>) awaits this so it never opens a buy modal before
// PHOTOS is populated — previously a fixed 900ms timer raced the network and
// left the modal empty on cold direct loads.
let _resolvePhotosReady;
const photosReady = new Promise(res => { _resolvePhotosReady = res; });

async function loadPhotos() {
  try {
    const { data, error } = await sb.from('photos').select('*').eq('hidden', false).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (error || !data || data.length === 0) throw new Error('empty');
    PHOTOS = data.map(p => ({ ...p, tags: p.tags || '' }));
  } catch {
    PHOTOS = FALLBACK_PHOTOS;
  }
  renderCameraFilter();
  renderTagCloud();
  renderPhotos();
  updateLocationSub();
  if (_resolvePhotosReady) { _resolvePhotosReady(PHOTOS); _resolvePhotosReady = null; }
}
loadPhotos();

function getTagsArray(photo) {
  return (photo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
}


function updateLocationSub() {
  var locs = ["nashville","brentwood","new york","los angeles","paris","monte carlo","versailles","washington dc","san juan","cannes","london","tokyo","beaulieu sur mer","villefranche sur mer"];
  var found = [];
  PHOTOS.forEach(function(p) {
    (p.tags||"").split(",").forEach(function(t) {
      t = t.trim().toLowerCase();
      if (locs.indexOf(t) > -1 && found.indexOf(t) === -1) found.push(t);
    });
  });
  var el = document.getElementById("photos-locations");
  if (el && found.length) el.textContent = found.join(" - ");
}
function tagScopePhotos() {
  // Tags shown should reflect the active view: shop=for_sale only, gallery=active camera
  if (shopMode) return PHOTOS.filter(p => p.for_sale);
  if (activeCamera !== 'all') return PHOTOS.filter(p => photoCamera(p) === activeCamera);
  return PHOTOS;
}
function renderTagCloud() {
  const scope = tagScopePhotos();
  const tagCount = {};
  scope.forEach(p => getTagsArray(p).forEach(t => { tagCount[t] = (tagCount[t]||0)+1; }));
  const maxCount = Math.max(1, ...Object.values(tagCount));
  const cloud = document.getElementById('tag-cloud');
  if (!cloud) return;
  cloud.innerHTML = Object.entries(tagCount)
    .sort((a,b) => b[1]-a[1])
    .map(([tag, count]) => {
      const size = 10 + Math.round((count/maxCount) * 10);
      const active = activeTags.has(tag);
      const compatible = activeTags.size === 0 || PHOTOS.some(p =>
        getTagsArray(p).includes(tag) && [...activeTags].every(at => getTagsArray(p).includes(at))
      );
      const cls = active ? 'active' : (!compatible ? 'dimmed' : '');
      return `<button class="photo-tag ${cls}" style="font-size:${size}px;" onclick="toggleTag('${tag}')">${tag}</button>`;
    }).join('');
  addHover('.photo-tag');
}

let shopMode = false;

// === CAMERA SUB-SECTIONS (gallery only) — separate galleries, Fuji is default ===
let activeCamera = 'fujifilm-xt5';
const CAMERA_LABELS = { 'fujifilm-xt5': 'Fujifilm X-T5', 'nomo': 'Nomo', 'campsnap': 'CampSnap' };
const CAMERA_ORDER = ['fujifilm-xt5', 'nomo', 'campsnap'];

function photoCamera(p) { return p.camera || 'fujifilm-xt5'; }

// Storage bucket per camera: fuji lives in "photos", others in "photos-<cam>"
function bucketForCamera(cam) { return cam === 'fujifilm-xt5' ? 'photos' : 'photos-' + cam; }

// Admin: which camera new uploads + the admin list belong to (independent of gallery view)
let adminCamera = 'fujifilm-xt5';
function setAdminCamera(cam) {
  adminCamera = cam;
  document.querySelectorAll('#admin-camera-picker .cam-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.cam === cam);
  });
  loadAdminPhotos();
}

function renderCameraFilter() {
  const el = document.getElementById('camera-filter');
  if (!el) return;
  // hide camera filter in shop mode
  if (shopMode) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const counts = {};
  PHOTOS.forEach(p => { const c = photoCamera(p); counts[c] = (counts[c]||0)+1; });
  const cams = CAMERA_ORDER.filter(c => counts[c]);
  if (cams.length <= 1) { el.style.display = 'none'; el.innerHTML = ''; return; }
  // make sure the active camera actually has photos; else fall back to first available
  if (!counts[activeCamera]) activeCamera = cams[0];
  el.innerHTML = cams.map(c =>
    `<button class="cam-btn ${activeCamera===c?'active':''}" onclick="setCamera('${c}')">${CAMERA_LABELS[c]||c}<span class="cam-count">${counts[c]}</span></button>`
  ).join('');
  addHover('.cam-btn');
}

function setCamera(cam) {
  activeCamera = cam;
  renderCameraFilter();
  renderTagCloud();
  renderPhotos();
}

function priceHint(p) {
  // cheapest paper size = first PRINT_SIZES entry
  try { return '$' + Math.round(PRINT_SIZES[0].price / 100); } catch (e) { return '$35'; }
}

function renderPhotos() {
  if (shopMode) { renderShop(); return; }
  const masonry = document.getElementById('photo-masonry');
  if (!masonry) return;
  const visible = [];
  PHOTOS.forEach(p => {
    if (photoCamera(p) !== activeCamera) return; // separate galleries per camera
    const tags = getTagsArray(p);
    const match = activeTags.size === 0 || [...activeTags].every(t => tags.includes(t));
    if (match) {
      const badge = p.for_sale
        ? `<button class="photo-buy-btn" onclick="event.stopPropagation();openPrintModal('${p.id}')">Buy Print</button>`
        : `<button class="photo-request-btn" onclick="event.stopPropagation();openRequestModal('${p.id}')">Request a print</button>`;
      const itemClick = p.for_sale ? `openPrintModal('${p.id}')` : `openRequestModal('${p.id}')`;
      visible.push(`<div class="photo-item ${p.span||''}" onclick="${itemClick}">
      <img src="${thumbURL(p.src, 480, 62)}" srcset="${thumbSrcset(p.src, [300, 480, 760])}" sizes="(max-width:600px) 48vw, 200px" alt="${tags[0]||''}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${p.src}'">
      <div class="photo-item-label">${tags.join(' · ')}</div>
      ${badge}
    </div>`);
    }
  });
  masonry.innerHTML = visible.join('');
  const emptyEl = document.getElementById('shop-empty');
  if (emptyEl) emptyEl.style.display = 'none';
  addHover('.photo-buy-btn,.photo-request-btn');
  // Dynamically limit columns so filtered results don't bunch in left column
  const count = visible.length;
  if (activeTags.size > 0 && count <= 3) {
    masonry.style.columnCount = Math.max(1, count);
  } else if (activeTags.size > 0 && count <= 8) {
    masonry.style.columnCount = Math.min(3, count);
  } else {
    masonry.style.columnCount = '';
  }
}

// === SHOP VIEW (white product cards) ===
function renderShop() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;
  const forSaleCount = PHOTOS.filter(p => p.for_sale).length;
  const headEl = document.getElementById('shop-head');
  if (headEl) {
    headEl.innerHTML = forSaleCount
      ? `<div class="shop-head-row"><span class="shop-head-title">Fine-Art Prints</span><span class="shop-head-count">${forSaleCount} available</span></div>
         <div class="shop-head-sub">Museum-quality giclée prints &amp; framed editions · printed on demand · shipped worldwide</div>`
      : '';
  }
  const cards = [];
  PHOTOS.forEach(p => {
    if (!p.for_sale) return; // shop = listed prints only
    const tags = getTagsArray(p);
    const match = activeTags.size === 0 || [...activeTags].every(t => tags.includes(t));
    if (!match) return;
    const cam = photoCamera(p);
    const camLabel = CAMERA_LABELS[cam] || '';
    // build a human title from the most descriptive tags (skip the camera tag)
    const titleTags = tags.filter(t => t !== cam).slice(0, 3);
    const title = titleTags.length ? titleTags.join(' · ') : 'Fine-art print';
    // All cards share a uniform image-box height (CSS); each photo is centered inside
    // via object-fit:contain, so landscapes fill the width and portraits sit in the
    // same-height box — rows line up cleanly and nothing is ever cropped.
    cards.push(`<div class="shop-card" onclick="openPrintModal('${p.id}')">
      <div class="shop-card-imgwrap"><img src="${thumbURL(p.src, 480, 62)}" srcset="${thumbSrcset(p.src, [300, 480, 700])}" sizes="(max-width:600px) 46vw, 240px" alt="${title}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${p.src}'"></div>
      <div class="shop-card-body">
        <div class="shop-card-title">${title}</div>
        ${camLabel ? `<div class="shop-card-cam">${camLabel}</div>` : ''}
        <div class="shop-card-meta">
          <span class="shop-card-price"><span class="from">from</span>${priceHint(p)}</span>
        </div>
        <button class="shop-card-buy" onclick="event.stopPropagation();openPrintModal('${p.id}')">Buy Print</button>
      </div>
    </div>`);
  });
  grid.innerHTML = cards.join('');
  const emptyEl = document.getElementById('shop-empty');
  if (emptyEl) emptyEl.style.display = cards.length === 0 ? 'block' : 'none';
  addHover('.shop-card,.shop-card-buy');
}

function toggleTag(tag) {
  if (activeTags.has(tag)) activeTags.delete(tag);
  else activeTags.add(tag);
  renderTagCloud();
  renderPhotos();
}

function setShopMode(on) {
  shopMode = !!on;
  const page = document.getElementById('photos-page');
  const hero = document.getElementById('photos-hero');
  const sub = document.getElementById('photos-locations');
  const gBtn = document.getElementById('pm-gallery');
  const sBtn = document.getElementById('pm-shop');
  const masonry = document.getElementById('photo-masonry');
  const grid = document.getElementById('shop-grid');
  const head = document.getElementById('shop-head');
  const tagCloud = document.getElementById('tag-cloud');
  const camFilter = document.getElementById('camera-filter');
  if (page) page.classList.toggle('shop-on', shopMode);
  if (gBtn) gBtn.classList.toggle('active', !shopMode);
  if (sBtn) sBtn.classList.toggle('active', shopMode);
  if (hero) hero.textContent = shopMode ? 'SHOP' : 'PHOTOS';
  if (sub) sub.textContent = shopMode ? 'fine-art prints · shipped worldwide' : 'nashville · brentwood · on the road';
  if (masonry) masonry.style.display = shopMode ? 'none' : '';
  if (grid) grid.style.display = shopMode ? 'grid' : 'none';
  if (head) head.style.display = shopMode ? 'block' : 'none';
  // tag cloud + camera tabs are gallery chrome — hide them in the shop
  if (tagCloud) tagCloud.style.display = shopMode ? 'none' : '';
  if (camFilter) camFilter.style.display = shopMode ? 'none' : 'flex';
  renderCameraFilter();
  renderTagCloud();
  renderPhotos();
  // Keep the URL honest so /shop is shareable
  const targetPath = shopMode ? '/shop' : '/photos';
  if (window.location.pathname !== targetPath) {
    history.replaceState({ page: shopMode ? 'shop' : 'photos' }, '', targetPath);
  }
}


// == ADMIN PHOTO MANAGER ==
function selectSpan(btn, span) {
  selectedSpan = span;
  document.querySelectorAll(".admin-span-btn").forEach(function(b) { b.classList.remove("admin-span-active"); });
  btn.classList.add("admin-span-active");
}
function handleFileSelect(input) {
  if (input.files[0]) {
    selectedFile = input.files[0];
    document.getElementById("selected-file-name").textContent = selectedFile.name;
    document.getElementById("photo-meta").style.display = "flex";
    detectAspectRatio(selectedFile);
  }
}
function detectAspectRatio(file) {
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function() {
    var w = img.naturalWidth, h = img.naturalHeight;
    var spanBtn;
    if (h > w) { spanBtn = document.querySelector("[data-span=tall]"); }
    else if (w / h >= 2.0) { spanBtn = document.querySelector("[data-span=span-2]"); }
    else { spanBtn = document.querySelector("[data-span=\"\"]"); }
    if (spanBtn) selectSpan(spanBtn, spanBtn.dataset.span);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
async function uploadAndSave() {
  if (!selectedFile) return;
  var status = document.getElementById("upload-status");
  var btn = document.getElementById("save-photo-btn");
  var tags = document.getElementById("photo-tags").value.trim();
  if (!tags) { status.style.color="#c44"; status.textContent="add at least one tag"; return; }
  btn.textContent = "Uploading..."; status.textContent = "";
  var ext = selectedFile.name.split(".").pop();
  var filename = "photo_" + Date.now() + "." + ext;
  var cam = adminCamera || 'fujifilm-xt5';
  var bucket = bucketForCamera(cam);
  try {
    var storageResult = await sb.storage.from(bucket).upload(filename, selectedFile, { contentType: selectedFile.type });
    if (storageResult.error) throw storageResult.error;
    var urlData = sb.storage.from(bucket).getPublicUrl(filename);
    var src = urlData.data.publicUrl;
    var dbResult = await sb.from("photos").insert({ src: src, tags: tags, span: selectedSpan, camera: cam });
    if (dbResult.error) throw dbResult.error;
    status.style.color="#4a8"; status.textContent="photo saved to " + (CAMERA_LABELS[cam]||cam);
    btn.textContent="Upload & Save ->";
    selectedFile = null;
    document.getElementById("photo-file-input").value = "";
    document.getElementById("selected-file-name").textContent = "";
    document.getElementById("photo-tags").value = "";
    document.getElementById("photo-meta").style.display = "none";
    selectSpan(document.querySelector("[data-span=\"\"]"), "");
    await loadPhotos();
    await loadAdminPhotos();
  } catch(err) {
    status.style.color="#c44"; status.textContent="error: " + err.message;
    btn.textContent="Upload & Save ->";
  }
}
var adminDragSrc = null;
async function loadAdminPhotos() {
  var list = document.getElementById("admin-photo-list");
  var count = document.getElementById("photo-count");
  if (!list) return;
  try {
    var res = await sb.from("photos").select("*").order("sort_order", {ascending:true}).order("created_at", {ascending:false});
    if (res.error) throw res.error;
    var data = res.data || [];
    // Show only the admin-selected camera's photos
    data = data.filter(function(p){ return photoCamera(p) === adminCamera; });
    count.textContent = "(" + data.length + ")";
    if (!data.length) { list.innerHTML = "<div style=\"font-size:9px;color:#333\">no photos yet</div>"; return; }
    var html = "";
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      var pid = p.id;
      var ptags = (p.tags || "").replace(/"/g, "&quot;");
      var pspan = p.span || "";
      var isHid = !!p.hidden;
      html += "<div class=\"admin-photo-row\" data-id=\"" + pid + "\" data-span=\"" + pspan + "\" data-hidden=\"" + isHid + "\" draggable=\"true\">";
      html += "<span class=\"admin-drag-handle\">&#8942;</span>";
      html += "<img class=\"admin-photo-thumb" + (isHid ? " admin-thumb-hidden" : "") + "\" src=\"" + thumbURL(p.src||"", 120, 60) + "\" onerror=\"this.onerror=null;this.src='" + (p.src||"") + "';this.style.background='#222'\">";
      html += "<div class=\"admin-photo-info\"><span>" + (p.tags||"no tags") + "</span>";
      html += "<span style=\"color:#2a2a2a\">" + (pspan||"normal") + (isHid ? " hidden" : "") + "</span></div>";
      html += "<button class=\"admin-edit-btn\" data-action=\"edit\" data-id=\"" + pid + "\">edit</button>";
      html += "<button class=\"admin-edit-btn\" data-action=\"versions\" data-id=\"" + pid + "\" data-cam=\"" + photoCamera(p) + "\" title=\"Manage print master / preview versions\">versions</button>";
      html += "<button class=\"admin-edit-btn\" data-action=\"mockups\" data-id=\"" + pid + "\" title=\"Upload framed wall mockups (per frame colour)\">mockups</button>";
      html += "<button class=\"admin-hide-btn" + (isHid ? " is-hidden" : "") + "\" data-action=\"hide\" data-id=\"" + pid + "\" data-hidden=\"" + isHid + "\">" + (isHid ? "show" : "hide") + "</button>";
      var isForSale = !!p.for_sale;
      html += "<button class=\"admin-edit-btn" + (isForSale ? " admin-span-active" : "") + "\" data-action=\"forsale\" data-id=\"" + pid + "\" data-forsale=\"" + isForSale + "\" title=\"Toggle print sale\">" + (isForSale ? "for sale ✓" : "for sale") + "</button>";
      html += "<button class=\"admin-delete-btn\" data-action=\"del\" data-id=\"" + pid + "\" data-src=\"" + (p.src||"") + "\">x</button>";
      html += "</div>";
      html += "<div class=\"admin-edit-row\" id=\"er" + pid + "\" style=\"display:none\">";
      html += "<input type=\"text\" id=\"et" + pid + "\" value=\"" + ptags + "\" placeholder=\"tags\">";
      html += "<div class=\"admin-edit-actions\">";
      html += "<button class=\"admin-span-btn" + (!pspan ? " admin-span-active" : "") + "\" data-action=\"span\" data-id=\"" + pid + "\" data-span=\"\">Normal</button>";
      html += "<button class=\"admin-span-btn" + (pspan==="span-2" ? " admin-span-active" : "") + "\" data-action=\"span\" data-id=\"" + pid + "\" data-span=\"span-2\">Wide</button>";
      html += "<button class=\"admin-span-btn" + (pspan==="tall" ? " admin-span-active" : "") + "\" data-action=\"span\" data-id=\"" + pid + "\" data-span=\"tall\">Tall</button>";
      html += "<button class=\"admin-btn\" data-action=\"save\" data-id=\"" + pid + "\">Save</button>";
      html += "<button class=\"admin-delete-btn\" data-action=\"cancel\" data-id=\"" + pid + "\">Cancel</button>";
      html += "</div></div>";
      html += "<div class=\"admin-versions-row\" id=\"vr" + pid + "\" data-cam=\"" + photoCamera(p) + "\" data-src=\"" + (p.src||"").replace(/"/g,"&quot;") + "\" style=\"display:none\"></div>";
      html += "<div class=\"admin-versions-row\" id=\"mk" + pid + "\" style=\"display:none\"></div>";
    }
    list.innerHTML = html;
    list.onclick = function(e) {
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var act = btn.dataset.action, id = btn.dataset.id;
      var er = document.getElementById("er" + id);
      if (act === "edit") { if(er) er.style.display = er.style.display==="none" ? "flex" : "none"; }
      else if (act === "versions") {
        var vr = document.getElementById("vr" + id);
        if (vr) {
          if (vr.style.display === "none") { vr.style.display = "block"; renderVersionsPanel(id, vr.dataset.cam, vr.dataset.src); }
          else { vr.style.display = "none"; }
        }
      }
      else if (act === "mockups") {
        var mk = document.getElementById("mk" + id);
        if (mk) {
          if (mk.style.display === "none") { mk.style.display = "block"; renderMockupsPanel(id); }
          else { mk.style.display = "none"; }
        }
      }
      else if (act === "cancel") { if(er) er.style.display="none"; }
      else if (act === "span") {
        if (!er) return;
        er.dataset.chosenSpan = btn.dataset.span;
        er.querySelectorAll("[data-action=span]").forEach(function(b){b.classList.remove("admin-span-active");});
        btn.classList.add("admin-span-active");
      } else if (act === "save") {
        if (!er) return;
        var tags = document.getElementById("et"+id).value.trim();
        var span = er.dataset.chosenSpan !== undefined ? er.dataset.chosenSpan : btn.closest(".admin-photo-row").dataset.span;
        sb.from("photos").update({tags:tags, span:span}).eq("id",id).then(function(res){
          if (res.error){alert("Save failed");return;}
          er.style.display="none";
          loadPhotos(); loadAdminPhotos();
        });
      } else if (act === "hide") {
        var isH = btn.dataset.hidden==="true";
        sb.from("photos").update({hidden:!isH}).eq("id",id).then(function(){loadPhotos();loadAdminPhotos();});
      } else if (act === "forsale") {
        var isFS = btn.dataset.forsale==="true";
        sb.from("photos").update({for_sale:!isFS}).eq("id",id).then(function(){loadPhotos();loadAdminPhotos();});
      } else if (act === "del") {
        if (!confirm("Delete this photo?")) return;
        var src = btn.dataset.src;
        var fn = src.split("/").pop();
        // Derive the storage bucket from the public URL so nomo/campsnap files are removed too
        var bm = src.match(/\/object\/public\/([^/]+)\//);
        var delBucket = bm ? bm[1] : "photos";
        sb.storage.from(delBucket).remove([fn]).then(function(){
          sb.from("photos").delete().eq("id",id).then(function(){loadPhotos();loadAdminPhotos();});
        });
      }
    };
    list.querySelectorAll(".admin-photo-row").forEach(function(row){
      row.addEventListener("dragstart",function(e){adminDragSrc=row;row.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
      row.addEventListener("dragend",function(){row.classList.remove("dragging");list.querySelectorAll(".admin-photo-row").forEach(function(r){r.classList.remove("drag-over");});});
      row.addEventListener("dragover",function(e){e.preventDefault();list.querySelectorAll(".admin-photo-row").forEach(function(r){r.classList.remove("drag-over");});row.classList.add("drag-over");});
      row.addEventListener("drop",async function(e){
        e.preventDefault();
        if(adminDragSrc===row)return;
        var rows=Array.from(list.querySelectorAll(".admin-photo-row"));
        var si=rows.indexOf(adminDragSrc),ti=rows.indexOf(row);
        var esr=document.getElementById("er"+adminDragSrc.dataset.id);
        if(si<ti){row.after(adminDragSrc);if(esr)row.after(esr);}else{row.before(adminDragSrc);if(esr)row.before(esr);}
        var nr=Array.from(list.querySelectorAll(".admin-photo-row"));
        for(var i=0;i<nr.length;i++){await sb.from("photos").update({sort_order:i}).eq("id",nr[i].dataset.id);}
      });
    });
    addHover(".admin-delete-btn,.admin-hide-btn,.admin-edit-btn,.admin-drag-handle");
  } catch(err) {
    list.innerHTML = "<div style=\"font-size:9px;color:#c44\">could not load photos</div>";
  }
}

// ══ PHASE 2 — PER-PHOTO MANAGE VERSIONS (print-master + preview) ══
// Each photo can have asset variants in photo_assets. print-master = full-res
// JPG in the PRIVATE photos-masters bucket (Prodigi gets a signed URL at order
// time). preview = the public web image shown in gallery/shop. This panel lists
// existing variants and lets Stuart upload either. Bordered/alt-crop deferred.
const MASTERS_BUCKET = 'photos-masters';

// Read an image File's pixel dimensions in-browser (no server round-trip).
function measureImage(file) {
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){ var d={width:img.naturalWidth,height:img.naturalHeight}; URL.revokeObjectURL(url); resolve(d); };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('could not read image')); };
    img.src = url;
  });
}

async function renderVersionsPanel(photoId, cam, src) {
  var vr = document.getElementById('vr' + photoId);
  if (!vr) return;
  vr.innerHTML = '<div class="ver-status" style="color:#555">loading versions…</div>';
  var res = await sb.from('photo_assets').select('id,variant,bucket,path,width,height,bytes,is_print_default,is_display_default').eq('photo_id', photoId).order('variant');
  var assets = (res && res.data) ? res.data : [];
  var hasMaster = assets.some(function(a){ return a.variant === 'print-master'; });
  var listHtml = '';
  if (!assets.length) {
    listHtml = '<div class="ver-item" style="color:#444">no variants recorded</div>';
  } else {
    assets.forEach(function(a){
      var dims = (a.width && a.height) ? (a.width + '×' + a.height) : '?';
      var mb = a.bytes ? (a.bytes/1048576).toFixed(1) + ' MB' : '';
      var cls = a.variant === 'print-master' ? 'master' : (a.variant === 'preview' ? 'preview' : '');
      listHtml += '<div class="ver-item">'
        + '<span class="ver-tag ' + cls + '">' + a.variant + '</span>'
        + '<span>' + dims + (mb ? ' · ' + mb : '') + '</span>'
        + (a.variant === 'print-master' ? '<button class="admin-delete-btn" data-ver-del="' + a.id + '" data-bucket="' + (a.bucket||'') + '" data-path="' + (a.path||'').replace(/"/g,'&quot;') + '" data-photo="' + photoId + '" title="Remove this master">x</button>' : '')
        + '</div>';
    });
  }
  // Uploader. Default variant = master if none yet, else preview.
  var defaultVar = hasMaster ? 'preview' : 'print-master';
  vr.innerHTML =
    '<div class="ver-list">' + listHtml + '</div>'
    + '<div class="ver-uploader" data-photo="' + photoId + '" data-cam="' + cam + '" data-src="' + (src||'').replace(/"/g,'&quot;') + '" data-chosen="' + defaultVar + '">'
    + '<div class="ver-variant-pick">'
    + '<button type="button" class="ver-variant-btn' + (defaultVar==='print-master'?' active':'') + '" data-var="print-master" title="Full-res original → private bucket, used for printing">print-master</button>'
    + '<button type="button" class="ver-variant-btn' + (defaultVar==='preview'?' active':'') + '" data-var="preview" title="Web image shown in gallery/shop">preview</button>'
    + '</div>'
    + '<input type="file" accept="image/jpeg,image/jpg,image/png" id="vfile' + photoId + '" style="font-family:var(--mono);font-size:9px;color:#777">'
    + '<button class="admin-btn" data-ver-upload="' + photoId + '">Upload version →</button>'
    + '<div class="ver-status" id="vstatus' + photoId + '"></div>'
    + '</div>';
  addHover('#vr' + photoId + ' .ver-variant-btn, #vr' + photoId + ' .admin-btn, #vr' + photoId + ' .admin-delete-btn');
  // Wire variant picker + upload + delete (scoped to this panel).
  vr.onclick = function(e){
    var pick = e.target.closest('.ver-variant-btn');
    if (pick) {
      var up = vr.querySelector('.ver-uploader');
      up.dataset.chosen = pick.dataset.var;
      vr.querySelectorAll('.ver-variant-btn').forEach(function(b){ b.classList.remove('active'); });
      pick.classList.add('active');
      return;
    }
    var del = e.target.closest('[data-ver-del]');
    if (del) { deleteMaster(del.dataset.verDel, del.dataset.bucket, del.dataset.path, del.dataset.photo); return; }
    var upBtn = e.target.closest('[data-ver-upload]');
    if (upBtn) { uploadVariant(upBtn.dataset.verUpload); return; }
  };
}

async function uploadVariant(photoId) {
  var vr = document.getElementById('vr' + photoId);
  var up = vr.querySelector('.ver-uploader');
  var variant = up.dataset.chosen;
  var cam = up.dataset.cam;
  var oldSrc = up.dataset.src;
  var fileInput = document.getElementById('vfile' + photoId);
  var status = document.getElementById('vstatus' + photoId);
  var file = fileInput.files && fileInput.files[0];
  if (!file) { status.style.color = '#c44'; status.textContent = 'pick a file first'; return; }
  status.style.color = '#555'; status.textContent = 'measuring…';
  try {
    var dims = await measureImage(file).catch(function(){ return { width: null, height: null }; });
    // Route to the right bucket. Masters → private; preview → the camera's public bucket.
    var bucket = variant === 'print-master' ? MASTERS_BUCKET : bucketForCamera(cam);
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var path = variant === 'print-master'
      ? (photoId + '/master_' + Date.now() + '.' + ext)
      : ('photo_' + Date.now() + '.' + ext);
    status.textContent = 'uploading to ' + bucket + '…';
    var upRes = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (upRes.error) throw upRes.error;
    // Insert the photo_assets row. For masters, mark print-default. For preview,
    // mark display-default AND update photos.src so the public image updates.
    var row = {
      photo_id: parseInt(photoId), variant: variant, bucket: bucket, path: path,
      width: dims.width, height: dims.height, bytes: file.size,
      is_print_default: variant === 'print-master',
      is_display_default: variant === 'preview'
    };
    var insRes = await sb.from('photo_assets').insert(row);
    if (insRes.error) throw insRes.error;
    if (variant === 'preview') {
      // New public preview becomes the photo's src (gallery/shop/emails use it).
      var pub = sb.storage.from(bucket).getPublicUrl(path);
      var newSrc = pub.data.publicUrl;
      await sb.from('photos').update({ src: newSrc }).eq('id', photoId);
      up.dataset.src = newSrc;
    }
    status.style.color = '#4a8';
    status.textContent = variant === 'print-master'
      ? 'master uploaded ✓ (now used for printing)'
      : 'preview uploaded ✓ (gallery updated)';
    fileInput.value = '';
    _dashCache = null; // dashboard recomputes missing-master / dims next open
    // Refresh the panel + lists so the new variant + badges show.
    await renderVersionsPanel(photoId, cam, up.dataset.src);
    if (variant === 'preview') { loadPhotos(); loadAdminPhotos(); }
  } catch(err) {
    status.style.color = '#c44';
    status.textContent = 'error: ' + (err.message || err);
  }
}

async function deleteMaster(assetId, bucket, path, photoId) {
  if (!confirm('Remove this print master? Orders will fall back to the web preview until you upload a new one.')) return;
  try {
    if (bucket && path) { await sb.storage.from(bucket).remove([path]); }
    await sb.from('photo_assets').delete().eq('id', assetId);
    _dashCache = null;
    var vr = document.getElementById('vr' + photoId);
    var up = vr ? vr.querySelector('.ver-uploader') : null;
    await renderVersionsPanel(photoId, up ? up.dataset.cam : 'fujifilm-xt5', up ? up.dataset.src : '');
  } catch(err) {
    alert('Delete failed: ' + (err.message || err));
  }
}

// ══ FRAMED WALL-MOCKUP MANAGER ══
// Lets Stuart upload a hand-made room/wall photo per frame colour. When a buyer
// picks that colour on a framed size, the buy modal shows the real wall shot
// instead of the CSS frame mockup. Stored in the public 'photo-mockups' bucket;
// the URL is saved to photos.mockup_frame_{black,white,natural}.
const MOCKUPS_BUCKET = 'photo-mockups';
const MOCKUP_COLORS = ['black', 'white', 'natural'];

async function renderMockupsPanel(photoId) {
  var mk = document.getElementById('mk' + photoId);
  if (!mk) return;
  mk.innerHTML = '<div class="ver-status" style="color:#555">loading mockups…</div>';
  var res = await sb.from('photos').select('mockup_frame_black,mockup_frame_white,mockup_frame_natural').eq('id', photoId).single();
  var row = (res && res.data) ? res.data : {};
  var current = {
    black: row.mockup_frame_black || null,
    white: row.mockup_frame_white || null,
    natural: row.mockup_frame_natural || null
  };
  var html = '<div class="mk-intro" style="font-size:9px;color:#777;letter-spacing:.05em;margin-bottom:10px;">'
    + 'Framed wall mockups (your Gemini room shots). Buyers see the matching one when they pick a frame colour on a framed size. Optional — colours without an image fall back to the standard frame preview.</div>';
  html += '<div class="mk-grid" style="display:flex;flex-wrap:wrap;gap:14px;">';
  MOCKUP_COLORS.forEach(function(color){
    var url = current[color];
    var thumb = url
      ? '<img src="' + url + '" alt="" style="width:88px;height:88px;object-fit:cover;border:1px solid #1c1c1c;display:block;">'
      : '<div style="width:88px;height:88px;border:1px dashed #2a2a2a;display:flex;align-items:center;justify-content:center;color:#444;font-size:8px;">none</div>';
    html += '<div class="mk-slot" data-color="' + color + '" style="display:flex;flex-direction:column;gap:6px;">'
      + '<span class="ver-tag" style="text-transform:capitalize;">' + color + ' frame</span>'
      + thumb
      + '<input type="file" accept="image/jpeg,image/jpg,image/png" id="mkfile_' + photoId + '_' + color + '" style="font-family:var(--mono);font-size:8px;color:#777;width:140px;">'
      + '<div style="display:flex;gap:6px;">'
      + '<button class="admin-btn" data-mk-upload="' + color + '" data-photo="' + photoId + '">Upload →</button>'
      + (url ? '<button class="admin-delete-btn" data-mk-del="' + color + '" data-photo="' + photoId + '" title="Remove this mockup">x</button>' : '')
      + '</div>'
      + '<div class="ver-status" id="mkstatus_' + photoId + '_' + color + '"></div>'
      + '</div>';
  });
  html += '</div>';
  mk.innerHTML = html;
  addHover('#mk' + photoId + ' .admin-btn, #mk' + photoId + ' .admin-delete-btn');
  mk.onclick = function(e){
    var up = e.target.closest('[data-mk-upload]');
    if (up) { uploadMockup(up.dataset.photo, up.dataset.mkUpload); return; }
    var del = e.target.closest('[data-mk-del]');
    if (del) { deleteMockup(del.dataset.photo, del.dataset.mkDel); return; }
  };
}

async function uploadMockup(photoId, color) {
  var fileInput = document.getElementById('mkfile_' + photoId + '_' + color);
  var status = document.getElementById('mkstatus_' + photoId + '_' + color);
  var file = fileInput.files && fileInput.files[0];
  if (!file) { status.style.color = '#c44'; status.textContent = 'pick a file first'; return; }
  status.style.color = '#555'; status.textContent = 'uploading…';
  try {
    var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    var path = photoId + '/' + color + '_' + Date.now() + '.' + ext;
    var upRes = await sb.storage.from(MOCKUPS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upRes.error) throw upRes.error;
    var pub = sb.storage.from(MOCKUPS_BUCKET).getPublicUrl(path);
    var col = 'mockup_frame_' + color;
    var patch = {}; patch[col] = pub.data.publicUrl;
    var updRes = await sb.from('photos').update(patch).eq('id', photoId);
    if (updRes.error) throw updRes.error;
    status.style.color = '#4a8'; status.textContent = color + ' mockup uploaded ✓';
    await renderMockupsPanel(photoId);
    loadPhotos(); // refresh PHOTOS so the buy modal picks it up
  } catch(err) {
    status.style.color = '#c44'; status.textContent = 'error: ' + (err.message || err);
  }
}

async function deleteMockup(photoId, color) {
  if (!confirm('Remove the ' + color + ' frame mockup? Buyers will see the standard frame preview for that colour.')) return;
  try {
    var col = 'mockup_frame_' + color;
    var patch = {}; patch[col] = null;
    await sb.from('photos').update(patch).eq('id', photoId);
    await renderMockupsPanel(photoId);
    loadPhotos();
  } catch(err) {
    alert('Delete failed: ' + (err.message || err));
  }
}

function showTagSuggestions() {
  var input = document.getElementById("photo-tags");
  if (!input) return;
  sb.from("photos").select("tags").then(function(res) {
    if (!res.data) return;
    var all = {};
    res.data.forEach(function(p){(p.tags||"").split(",").forEach(function(t){t=t.trim();if(t)all[t]=1;});});
    var container = document.getElementById("tag-suggestions");
    if (!container) return;
    var current = input.value.split(",").map(function(t){return t.trim();}).filter(Boolean);
    container.innerHTML = Object.keys(all).sort().map(function(tag){
      var sel = current.indexOf(tag)>-1 ? " selected" : "";
      return "<button type=\"button\" class=\"admin-tag-pill"+sel+"\" data-tag=\""+tag.replace(/"/g,"&quot;")+"\">"+tag+"</button>";
    }).join("");
    container.onclick = function(e) {
      var b = e.target.closest(".admin-tag-pill"); if(!b)return;
      var tag = b.dataset.tag;
      var tags = input.value.split(",").map(function(t){return t.trim();}).filter(Boolean);
      var idx = tags.indexOf(tag);
      if(idx>-1){tags.splice(idx,1);b.classList.remove("selected");}else{tags.push(tag);b.classList.add("selected");}
      input.value = tags.join(", ");
    };
    addHover(".admin-tag-pill");
  });
}
// ══ YOUTUBE ══
function openYT(videoId, title, artist) {
  document.getElementById('yt-iframe').src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  document.getElementById('yt-modal-title').textContent = title;
  document.getElementById('yt-modal-meta').textContent = artist;
  document.getElementById('yt-modal').classList.add('active');
}
function closeYT() {
  document.getElementById('yt-modal').classList.remove('active');
  document.getElementById('yt-iframe').src = '';
}
document.getElementById('yt-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('yt-modal')) closeYT();
});

// ══ CURSOR ══
const cursor = document.getElementById('cursor');
let cursorX = 0, cursorY = 0;
document.addEventListener('mousemove', e => {
  cursorX = e.clientX;
  cursorY = e.clientY;
  cursor.style.left = cursorX + 'px';
  cursor.style.top  = cursorY + 'px';
});
function addHover(sel) {
  document.querySelectorAll(sel).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });
}
addHover('button, .choice-btn, .track-row, .photo-item, .photo-tag, .photo-link, .photos-ig, .lab-card, .back-btn, .music-cta, .admin-btn, #admin-login-btn, #admin-close, #admin-logout, #yt-modal-close, a');

// ══ SECRET ADMIN TRIGGER ══
let adminBuffer = '';
document.addEventListener('keydown', e => {
  if (document.getElementById('admin-overlay').classList.contains('active')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  adminBuffer += e.key.toLowerCase();
  adminBuffer = adminBuffer.slice(-5);
  if (adminBuffer === 'admin') openAdmin();
});

// ══ ADMIN ══
let adminAuthed = false;
function getAdminPanelHTML(fullpage) {
  // In fullpage mode (route /mr.manager) the sections are split into two columns:
  // left = Add Photo + Manage Photos, right = Resolution Dashboard + Print Requests
  // + Quick Links. In modal mode these wrappers are empty so it stays a single stack.
  const colsOpen  = fullpage ? '<div class="admin-cols"><div class="admin-col-left">' : '';
  const colsSplit = fullpage ? '</div><div class="admin-col-right">' : '';
  const colsClose = fullpage ? '</div></div>' : '';
  return colsOpen + `
      <div class="admin-section">
        <div class="admin-section-title">Add Photo</div>
        <div id="admin-camera-picker" style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
          <button class="cam-btn active" data-cam="fujifilm-xt5" onclick="setAdminCamera('fujifilm-xt5')">Fujifilm X-T5</button>
          <button class="cam-btn" data-cam="nomo" onclick="setAdminCamera('nomo')">Nomo</button>
          <button class="cam-btn" data-cam="campsnap" onclick="setAdminCamera('campsnap')">CampSnap</button>
        </div>
        <div class="admin-upload-area" id="upload-area">
          <p id="upload-area-label">Drag & drop or click to select</p>
          <input type="file" id="photo-file-input" accept="image/*" onchange="handleFileSelect(this)" style="display:none">
          <button class="admin-btn" onclick="document.getElementById('photo-file-input').click()">Select File</button>
        </div>
        <div id="selected-file-name" style="font-size:9px;color:#555;letter-spacing:.1em;margin-top:8px;min-height:14px;"></div>
        <div id="photo-meta" style="display:none;margin-top:16px;display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="display:block;font-size:9px;letter-spacing:.2em;color:#444;text-transform:uppercase;margin-bottom:6px;">Tags <span style="color:#2a2a2a;">(comma separated)</span></label>
            <input type="text" id="photo-tags" placeholder="travel, night, europe, color"
              style="width:100%;background:#111;border:1px solid #1c1c1c;color:#fff;font-family:var(--mono);font-size:11px;padding:10px 12px;outline:none;letter-spacing:.04em;"
              onfocus="this.style.borderColor='#444';showTagSuggestions()" onblur="this.style.borderColor='#1c1c1c'">
            <div id="tag-suggestions" class="admin-tag-suggestions"></div>
          </div>
          <div>
            <label style="display:block;font-size:9px;letter-spacing:.2em;color:#444;text-transform:uppercase;margin-bottom:6px;">Grid Size</label>
            <div style="display:flex;gap:8px;">
              <button class="admin-span-btn admin-span-active" data-span="" onclick="selectSpan(this,'')">Normal</button>
              <button class="admin-span-btn" data-span="span-2" onclick="selectSpan(this,'span-2')">Wide</button>
              <button class="admin-span-btn" data-span="tall" onclick="selectSpan(this,'tall')">Tall</button>
            </div>
          </div>
          <button class="admin-btn" onclick="uploadAndSave()" id="save-photo-btn" style="margin-top:4px;">Upload & Save →</button>
        </div>
        <div id="upload-status" style="font-size:9px;color:#555;letter-spacing:.1em;margin-top:10px;min-height:14px;"></div>
      </div>
      <div class="admin-section">
        <div class="admin-section-title">Manage Photos <span id="photo-count" style="color:#2a2a2a;"></span></div>
        <div id="admin-photo-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;"></div>
      </div>` + colsSplit + `
      <div class="admin-section">
        <div class="admin-section-title">Resolution Dashboard <span id="dash-count" style="color:#2a2a2a;"></span></div>
        <div class="dash-filters" id="dash-filters">
          <button class="dash-filter-btn active" data-filter="all">All</button>
          <button class="dash-filter-btn" data-filter="forsale">For Sale</button>
          <button class="dash-filter-btn" data-filter="lowres">Low-res only</button>
          <button class="dash-filter-btn" data-filter="nomaster">No master</button>
          <button class="dash-filter-btn" data-filter="fujifilm-xt5">Fuji</button>
          <button class="dash-filter-btn" data-filter="nomo">Nomo</button>
          <button class="dash-filter-btn" data-filter="campsnap">CampSnap</button>
        </div>
        <div id="dash-list" style="display:flex;flex-direction:column;gap:0;max-height:340px;overflow-y:auto;"></div>
      </div>
      <div class="admin-section">
        <div class="admin-section-title">Print Requests <span id="request-count" style="color:#2a2a2a;"></span></div>
        <div id="admin-request-list" style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;"></div>
      </div>
      <div class="admin-section">
        <div class="admin-section-title">Quick Links</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="https://github.com/sssingleton/stuart-singleton-site" target="_blank" class="admin-btn" style="text-decoration:none;">GitHub ↗</a>
          <a href="https://supabase.com/dashboard/project/zbcdeglxwrappriwpxwt" target="_blank" class="admin-btn" style="text-decoration:none;">Supabase ↗</a>
          <a href="https://vercel.com" target="_blank" class="admin-btn" style="text-decoration:none;">Vercel ↗</a>
        </div>
      </div>
      <button id="admin-logout" onclick="adminLogout()">Sign Out</button>` + colsClose;
}
function showAdminPanel() {
  const panel = document.getElementById('admin-panel');
  const fullpage = document.getElementById('admin-overlay').classList.contains('fullpage');
  panel.innerHTML = getAdminPanelHTML(fullpage);
  panel.style.display = 'block';
  document.getElementById('admin-login').style.display = 'none';
  initUploadArea();
  adminCamera = 'fujifilm-xt5';
  addHover('#admin-camera-picker .cam-btn');
  loadAdminPhotos();
  loadPrintRequests();
  loadDashboard();
}

// ══ ADMIN RESOLUTION DASHBOARD (Phase 1 — read-only) ══
// Joins photo_assets (real measured dims) with photos so Stuart can SEE, per photo:
// resolution + MP, max crisp print size @200/@300 DPI, ratio + size-family, for-sale
// status + exact sizes a buyer sees, and missing-version flags. Pure display, no writes.
let dashFilter = 'all';
let _dashCache = null;

function maxCrispSize(longestPx, photoRatio, dpi) {
  // Largest PRINT_SIZES entry whose long edge fits at the given DPI AND matches ratio.
  let best = null;
  for (const s of PRINT_SIZES) {
    const fitsRes = longestPx >= s.longIn * dpi;
    const fitsRatio = !photoRatio || Math.abs(s.ratio - photoRatio) <= RATIO_TOLERANCE;
    if (fitsRes && fitsRatio && (!best || s.longIn > best.longIn)) best = s;
  }
  return best ? best.label.replace(' Framed','') : '—';
}

async function loadDashboard() {
  const list = document.getElementById('dash-list');
  const count = document.getElementById('dash-count');
  if (!list) return;
  try {
    if (!_dashCache) {
      // Pull photos + their preview variant (real dims). One query each, joined in JS.
      const [ph, as] = await Promise.all([
        sb.from('photos').select('id,src,tags,for_sale,hidden,camera').order('id'),
        sb.from('photo_assets').select('photo_id,variant,width,height,bytes,is_print_default')
      ]);
      if (ph.error) throw ph.error;
      if (as.error) throw as.error;
      const byPhoto = {};
      (as.data || []).forEach(a => { (byPhoto[a.photo_id] = byPhoto[a.photo_id] || []).push(a); });
      _dashCache = (ph.data || []).map(p => {
        const variants = byPhoto[p.id] || [];
        const preview = variants.find(v => v.variant === 'preview') || variants[0] || null;
        const hasMaster = variants.some(v => v.variant === 'print-master');
        const hasBordered = variants.some(v => v.variant === 'bordered');
        return { p, preview, variants, hasMaster, hasBordered };
      });
    }
    // Apply the active filter.
    const rows = _dashCache.filter(d => {
      const longest = d.preview ? Math.max(d.preview.width, d.preview.height) : 0;
      const cam = photoCamera(d.p);
      if (dashFilter === 'all') return true;
      if (dashFilter === 'forsale') return !!d.p.for_sale;
      if (dashFilter === 'lowres') return longest > 0 && longest <= 2048;
      if (dashFilter === 'nomaster') return !d.hasMaster;
      return cam === dashFilter; // camera filters
    });
    count.textContent = '(' + rows.length + ')';
    if (!rows.length) { list.innerHTML = '<div style="font-size:9px;color:#333;padding:8px 0">none match this filter</div>'; return; }
    let html = '';
    for (const d of rows) {
      const p = d.p, pv = d.preview;
      const w = pv ? pv.width : 0, h = pv ? pv.height : 0;
      const longest = Math.max(w, h), shortest = Math.min(w, h);
      const mp = longest ? ((w * h) / 1e6).toFixed(1) : '?';
      const ratio = longest && shortest ? longest / shortest : 0;
      // Size-family by ratio
      let fam = '—';
      if (ratio) fam = Math.abs(ratio - 1.5) <= RATIO_TOLERANCE ? '3:2'
                     : Math.abs(ratio - 4/3) <= RATIO_TOLERANCE ? '4:3'
                     : ratio.toFixed(2) + ':1';
      const crisp200 = longest ? maxCrispSize(longest, ratio, 200) : '—';
      const crisp300 = longest ? maxCrispSize(longest, ratio, 300) : '—';
      const offered = longest ? sizesForPhoto(longest, ratio) : [];
      const offeredLabels = offered.map(s => s.label).join(', ') || 'none';
      // Badges
      const badges = [];
      if (!pv) badges.push('<span class="dash-badge warn">no dims</span>');
      if (!d.hasMaster) badges.push('<span class="dash-badge warn">no master</span>');
      if (longest && longest <= 2048) badges.push('<span class="dash-badge warn">low-res only</span>');
      if (!d.hasBordered) badges.push('<span class="dash-badge info">no bordered</span>');
      if (p.for_sale) badges.push('<span class="dash-badge ok">for sale</span>');
      if (p.hidden) badges.push('<span class="dash-badge">hidden</span>');
      html += '<div class="dash-row">';
      html += '<img class="dash-thumb" src="' + thumbURL(p.src||'', 120, 60) + '" onerror="this.onerror=null;this.src=\'' + (p.src||'') + '\'">';
      html += '<div class="dash-info">';
      html += '<span class="dash-dims">' + (longest ? w + '×' + h + ' · ' + mp + ' MP · ' + fam : 'no measured dims') + '</span><br>';
      html += '<span class="dash-meta">crisp @200: ' + crisp200 + ' · @300: ' + crisp300 + '</span><br>';
      html += '<span class="dash-sale">offers: ' + offeredLabels + '</span>';
      html += '<div class="dash-badges">' + badges.join('') + '</div>';
      html += '</div></div>';
    }
    list.innerHTML = html;
    const fb = document.getElementById('dash-filters');
    if (fb && !fb._wired) {
      fb._wired = true;
      fb.onclick = function(e){
        const b = e.target.closest('.dash-filter-btn'); if (!b) return;
        dashFilter = b.dataset.filter;
        fb.querySelectorAll('.dash-filter-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        loadDashboard();
      };
      addHover('.dash-filter-btn');
    }
  } catch(err) {
    list.innerHTML = '<div style="font-size:9px;color:#c44;padding:8px 0">could not load dashboard</div>';
  }
}

async function loadPrintRequests() {
  var list = document.getElementById('admin-request-list');
  var count = document.getElementById('request-count');
  if (!list) return;
  try {
    var res = await sb.from('print_requests').select('*').order('created_at', { ascending: false });
    if (res.error) throw res.error;
    // Only show still-open requests. Accepted/declined/listed/dismissed drop off the list.
    var OPEN = function(s){ return s === 'new' || s == null; };
    var data = (res.data || []).filter(function(r){ return OPEN(r.status); });
    if (count) count.textContent = '(' + data.length + ' new)';
    if (!data.length) { list.innerHTML = '<div style="font-size:9px;color:#333">no open requests</div>'; return; }
    var html = '';
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var when = new Date(r.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' });
      html += '<div class="admin-photo-row" data-req-row="' + r.id + '">';
      html += '<img class="admin-photo-thumb" src="' + (r.photo_src||'') + '" onerror="this.style.background=\'#222\'">';
      html += '<div class="admin-photo-info">';
      html += '<span style="color:#888">' + (r.email||'(no email)') + '</span>';
      html += '<span>' + (r.message ? r.message.replace(/</g,'&lt;') : 'no note') + '</span>';
      html += '<span style="color:#2a2a2a">photo #' + (r.photo_id==null?'?':r.photo_id) + ' · ' + when + '</span>';
      html += '</div>';
      // Accept = list photo for sale + email requester. Disabled if no photo to list.
      var canAccept = r.photo_id != null;
      html += '<button class="admin-edit-btn" data-req-action="accept" data-id="' + r.id + '" data-photo="' + (r.photo_id==null?'':r.photo_id) + '"' + (canAccept?'':' disabled style="opacity:.3"') + ' title="List photo for sale + email requester">accept</button>';
      html += '<button class="admin-hide-btn" data-req-action="decline" data-id="' + r.id + '" title="Decline (no email)">decline</button>';
      html += '</div>';
    }
    list.innerHTML = html;
    addHover('#admin-request-list .admin-edit-btn, #admin-request-list .admin-hide-btn');
    list.onclick = function(e) {
      var btn = e.target.closest('[data-req-action]');
      if (!btn || btn.disabled) return;
      var act = btn.dataset.reqAction, id = btn.dataset.id;
      var row = list.querySelector('[data-req-row="' + id + '"]');
      if (act === 'accept') {
        var photoId = btn.dataset.photo;
        btn.disabled = true; btn.textContent = '…';
        sb.from('photos').update({ for_sale: true }).eq('id', photoId).then(function(res){
          if (res.error) { alert('Could not flag photo: ' + res.error.message); btn.disabled=false; btn.textContent='accept'; return; }
          sb.from('print_requests').update({ status: 'accepted' }).eq('id', id).then(function(){
            // Email the requester their photo is now buyable (best-effort; never blocks the accept).
            try {
              fetch('https://zbcdeglxwrappriwpxwt.supabase.co/functions/v1/notify-request-listed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: id })
              }).then(function(r){ return r.json(); }).then(function(d){
                if (d && d.emailed) { console.log('Requester notified:', d.to); }
                else { console.warn('Requester not emailed:', d && (d.reason || d.error)); }
              }).catch(function(e){ console.warn('notify-request-listed failed:', e); });
            } catch (e) {}
            if (row) row.remove();
            loadPhotos(); loadAdminPhotos(); loadPrintRequests();
          });
        });
      } else if (act === 'decline') {
        // No email. Just mark declined so it drops off the list.
        sb.from('print_requests').update({ status: 'declined' }).eq('id', id).then(function(){
          if (row) row.remove();
          loadPrintRequests();
        });
      }
    };
  } catch (err) {
    list.innerHTML = '<div style="font-size:9px;color:#c44">requests error: ' + (err.message||err) + '</div>';
  }
}
function initUploadArea() {
  const area = document.getElementById('upload-area');
  if (!area) return;
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => { e.preventDefault(); area.classList.remove('dragover'); if(e.dataTransfer.files[0]){selectedFile=e.dataTransfer.files[0];document.getElementById('selected-file-name').textContent=selectedFile.name;document.getElementById('photo-meta').style.display='flex';} });
}
async function openAdmin(fullpage) {
  const overlay = document.getElementById('admin-overlay');
  overlay.classList.add('active');
  overlay.classList.toggle('fullpage', !!fullpage);
  // Check for existing Supabase session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    adminAuthed = true;
    showAdminPanel();
  } else {
    setTimeout(() => document.getElementById('admin-password').focus(), 100);
  }
}
function closeAdmin() {
  const overlay = document.getElementById('admin-overlay');
  const wasFull = overlay.classList.contains('fullpage');
  overlay.classList.remove('active');
  overlay.classList.remove('fullpage');
  document.getElementById('admin-error').textContent = '';
  document.getElementById('admin-password').value = '';
  // If we arrived via the /mr.manager URL, send the address bar back home.
  if (wasFull && window.location.pathname === '/mr.manager') {
    history.pushState({ page: 'home' }, '', '/');
  }
}
async function adminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const pw = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-error');
  errEl.textContent = 'authenticating...';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) {
    errEl.textContent = error.message || 'authentication failed';
    document.getElementById('admin-password').value = '';
    return;
  }
  adminAuthed = true;
  showAdminPanel();
}
async function adminLogout() {
  await sb.auth.signOut();
  adminAuthed = false;
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = '';
  panel.style.display = 'none';
  document.getElementById('admin-login').style.display = 'block';
  closeAdmin();
}
document.getElementById('admin-password').addEventListener('keydown', e => { if (e.key==='Enter') adminLogin(); });

// ══ P5.JS (connection-line particles with cursor influence) ══
new p5(function(p) {
  let particles = [];
  const count = 80;

  p.setup = function() {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.parent('p5-canvas');
    for (let i = 0; i < count; i++) {
      particles.push({
        x: p.random(p.width), y: p.random(p.height),
        vx: p.random(-0.3, 0.3), vy: p.random(-0.3, 0.3),
        size: p.random(1, 2.5),
      });
    }
  };

  p.draw = function() {
    p.clear();
    const grav = (typeof gravityStrength !== 'undefined') ? gravityStrength : 0;
    // Draw connections — fade out during gravity
    if (grav < 0.5) {
      p.strokeWeight(0.5);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const d = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
          if (d < 140) {
            const alpha = p.map(d, 0, 140, 18, 0) * (1 - grav * 2);
            if (alpha > 0) {
              p.stroke(255, alpha);
              p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
            }
          }
        }
      }
    }
    // Draw and update particles
    p.noStroke();
    for (const pt of particles) {
      // Gravity effect
      if (grav > 0.01) {
        pt.vy += 0.12 * grav;
        pt.vx *= (1 - 0.015 * grav);
      }
      const dx = p.mouseX - pt.x;
      const dy = p.mouseY - pt.y;
      const dist = p.sqrt(dx * dx + dy * dy);
      let alpha = 40;
      if (dist < 200) {
        const force = (200 - dist) / 200 * 0.008 * (1 - grav * 0.8);
        pt.vx += dx * force; pt.vy += dy * force;
        alpha = p.map(dist, 0, 200, 90, 40);
      }
      alpha *= (1 - grav * 0.4);
      pt.vx *= 0.98; pt.vy *= 0.98;
      pt.x += pt.vx; pt.y += pt.vy;
      if (pt.x < 0) pt.x = p.width;
      if (pt.x > p.width) pt.x = 0;
      if (grav > 0.01 && pt.y > p.height + 10) {
        pt.y = -5; pt.x = Math.random() * p.width; pt.vy = Math.random() * 0.3;
      } else {
        if (pt.y < 0) pt.y = p.height;
        if (pt.y > p.height) pt.y = 0;
      }
      p.fill(255, alpha);
      p.ellipse(pt.x, pt.y, pt.size);
    }
  };

  p.windowResized = function() { p.resizeCanvas(p.windowWidth, p.windowHeight); };
});

// ══ MATCH CHOICES WIDTH TO NAME ══
requestAnimationFrame(() => {
  const nameEl = document.querySelector('.term-name');
  if (nameEl) {
    const observer = new ResizeObserver(() => {
      const w = nameEl.offsetWidth;
      document.querySelector('.terminal-wrap').style.setProperty('--name-width', w + 'px');
    });
    observer.observe(nameEl);
    document.fonts.ready.then(() => {
      const w = nameEl.offsetWidth;
      document.querySelector('.terminal-wrap').style.setProperty('--name-width', w + 'px');
    });
  }
});

// ══ ABSTRACT PARTICLES (cursor-reactive) ══
const aCanvas = document.getElementById('particles-canvas');
const aCtx = aCanvas.getContext('2d');
let abstractParticles = [];

function resizeAbstract() {
  aCanvas.width = window.innerWidth;
  aCanvas.height = window.innerHeight;
}
resizeAbstract();
window.addEventListener('resize', resizeAbstract);

class AbstractParticle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * aCanvas.width;
    this.y = Math.random() * aCanvas.height;
    this.vx = (Math.random() - 0.5) * 0.25;
    this.vy = (Math.random() - 0.5) * 0.25;
    this.size = Math.random() * 1.5 + 0.5;
    this.alpha = Math.random() * 0.25 + 0.04;
    this.baseAlpha = this.alpha;
  }
  update() {
    const dx = cursorX - this.x;
    const dy = cursorY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 180) {
      const force = (180 - dist) / 180 * 0.012;
      this.vx += dx * force * 0.01;
      this.vy += dy * force * 0.01;
      this.alpha = this.baseAlpha + (180 - dist) / 180 * 0.18;
    } else {
      this.alpha += (this.baseAlpha - this.alpha) * 0.02;
    }
    this.vx *= 0.99; this.vy *= 0.99;
    this.x += this.vx; this.y += this.vy;
    if (this.x < 0 || this.x > aCanvas.width || this.y < 0 || this.y > aCanvas.height) this.reset();
  }
  draw() {
    aCtx.beginPath();
    aCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    aCtx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    aCtx.fill();
  }
}

const aCount = Math.min(150, Math.floor(window.innerWidth * window.innerHeight / 9000));
for (let i = 0; i < aCount; i++) abstractParticles.push(new AbstractParticle());

function drawAbstractConnections() {
  for (let i = 0; i < abstractParticles.length; i++) {
    for (let j = i + 1; j < abstractParticles.length; j++) {
      const dx = abstractParticles[i].x - abstractParticles[j].x;
      const dy = abstractParticles[i].y - abstractParticles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110) {
        const alpha = (1 - dist / 110) * 0.05;
        aCtx.beginPath();
        aCtx.moveTo(abstractParticles[i].x, abstractParticles[i].y);
        aCtx.lineTo(abstractParticles[j].x, abstractParticles[j].y);
        aCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        aCtx.lineWidth = 0.5;
        aCtx.stroke();
      }
    }
  }
}

function animateAbstract() {
  aCtx.clearRect(0, 0, aCanvas.width, aCanvas.height);
  abstractParticles.forEach(p => { p.update(); p.draw(); });
  drawAbstractConnections();
  requestAnimationFrame(animateAbstract);
}
animateAbstract();

// ══ 3D CODE SPHERE ══
const sCanvas = document.getElementById('sphere-canvas');
const sCtx = sCanvas.getContext('2d');
const sphereContainer = document.getElementById('sphere-container');
let sphereHover = false, hoverStrength = 0, sphereMouseX = 0, sphereMouseY = 0;

const SPHERE_SIZE = 180;
sCanvas.width = SPHERE_SIZE; sCanvas.height = SPHERE_SIZE;

sphereContainer.addEventListener('mouseenter', () => { sphereHover = true; });
sphereContainer.addEventListener('mouseleave', () => { sphereHover = false; });
sphereContainer.addEventListener('mousemove', (e) => {
  const rect = sphereContainer.getBoundingClientRect();
  sphereMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
  sphereMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
});

const codeSnippets = [
  'const render = () => {','transform: matrix3d','gl.drawArrays()','vec3 normal;','float intensity;',
  '#version 300 es','precision highp;','uniform mat4 proj;','void main() {','fragColor = vec4',
  'texture2D(uSamp','for(int i=0;','return normalize','dot(n, lightDir)','mix(color, fog,',
  'struct Material {','emit: particles','async function*','yield transform','export default',
  'import { mesh }','pipeline.flush()','node.traverse()','buffer.bind(gl)','shader.compile()',
];

class SpherePoint {
  constructor(phi, theta, text) {
    this.phi = phi; this.theta = theta; this.text = text; this.r = 55;
  }
  project(rotX, rotY, rotZ) {
    let x = this.r * Math.sin(this.phi) * Math.cos(this.theta);
    let y = this.r * Math.sin(this.phi) * Math.sin(this.theta);
    let z = this.r * Math.cos(this.phi);
    let cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    let x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY; x = x1; z = z1;
    let cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    let y1 = y * cosX - z * sinX, z2 = y * sinX + z * cosX; y = y1; z = z2;
    let cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
    let x2 = x * cosZ - y * sinZ, y2 = x * sinZ + y * cosZ; x = x2; y = y2;
    const scale = 160 / (160 + z);
    return {
      x: SPHERE_SIZE / 2 + x * scale, y: SPHERE_SIZE / 2 + y * scale,
      z, scale, alpha: Math.max(0, Math.min(1, (z + 55) / 110)) * 0.85 + 0.15
    };
  }
}

const spherePoints = [];
const sphereRows = 14;
for (let i = 0; i < sphereRows; i++) {
  const phi = (Math.PI / (sphereRows + 1)) * (i + 1);
  const count = Math.floor(Math.sin(phi) * 8) + 2;
  for (let j = 0; j < count; j++) {
    const theta = (Math.PI * 2 / count) * j;
    spherePoints.push(new SpherePoint(phi, theta, codeSnippets[Math.floor(Math.random() * codeSnippets.length)]));
  }
}

let sphereTime = 0, baseRotY = 0, baseRotX = 0.3;

function animateSphere() {
  sphereTime += 0.016;
  sCtx.clearRect(0, 0, SPHERE_SIZE, SPHERE_SIZE);
  if (sphereHover) { hoverStrength += (1 - hoverStrength) * 0.08; }
  else { hoverStrength += (0 - hoverStrength) * 0.05; }
  baseRotY += 0.006 + hoverStrength * 0.018;
  const rotY = baseRotY + sphereMouseX * 0.5 * hoverStrength;
  const rotX = baseRotX + sphereMouseY * 0.3 * hoverStrength;
  const rotZ = Math.sin(sphereTime * 0.3) * 0.04;
  // Wireframe circle
  sCtx.beginPath();
  sCtx.arc(SPHERE_SIZE / 2, SPHERE_SIZE / 2, 57, 0, Math.PI * 2);
  sCtx.strokeStyle = `rgba(255, 255, 255, ${0.025 + hoverStrength * 0.04})`;
  sCtx.lineWidth = 0.5; sCtx.stroke();
  const projected = spherePoints.map(p => ({ ...p.project(rotX, rotY, rotZ), text: p.text }));
  projected.sort((a, b) => a.z - b.z);
  projected.forEach(p => {
    const brightness = 0.35 + hoverStrength * 0.35;
    const alpha = p.alpha * brightness;
    sCtx.beginPath();
    sCtx.arc(p.x, p.y, 0.8 * p.scale, 0, Math.PI * 2);
    sCtx.fillStyle = `rgba(255, 255, 255, ${alpha})`; sCtx.fill();
    if (p.z > -20) {
      const fontSize = Math.max(4.5, 6.5 * p.scale);
      sCtx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      sCtx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
      const chars = Math.floor(p.text.length * p.scale * 0.8);
      sCtx.fillText(p.text.substring(0, chars), p.x + 2.5, p.y + 1.5);
    }
  });
  if (hoverStrength > 0.01) {
    const grad = sCtx.createRadialGradient(SPHERE_SIZE/2, SPHERE_SIZE/2, 15, SPHERE_SIZE/2, SPHERE_SIZE/2, 70);
    grad.addColorStop(0, `rgba(255, 255, 255, ${hoverStrength * 0.05})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sCtx.fillStyle = grad; sCtx.fillRect(0, 0, SPHERE_SIZE, SPHERE_SIZE);
  }
  requestAnimationFrame(animateSphere);
}
animateSphere();

// ══ MATRIX ══
const mCanvas=document.getElementById('matrix-canvas'), mCtx=mCanvas.getContext('2d');
let matrixRunning=false, matrixRAF=null, drops=[];
function startMatrix() {
  matrixRunning=true; mCanvas.width=window.innerWidth; mCanvas.height=window.innerHeight;
  drops=Array(Math.floor(mCanvas.width/14)).fill(1);
  function draw() {
    if(!matrixRunning) return;
    mCtx.fillStyle='rgba(1,15,5,0.065)'; mCtx.fillRect(0,0,mCanvas.width,mCanvas.height);
    mCtx.fillStyle='#0a3d18'; mCtx.font='13px "Share Tech Mono"';
    drops.forEach((y,i)=>{mCtx.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*14,y*14);if(y*14>mCanvas.height&&Math.random()>0.975)drops[i]=0;drops[i]++;});
    matrixRAF=requestAnimationFrame(draw);
  }
  draw();
}
function stopMatrix() {
  matrixRunning=false; if(matrixRAF) cancelAnimationFrame(matrixRAF);
  setTimeout(()=>mCtx.clearRect(0,0,mCanvas.width,mCanvas.height),500);
}

// ══ NAVIGATE ══
function navigate(dest) {
  const landing = document.getElementById('landing');
  const showPage = (id, delay) => {
    setTimeout(() => {
      landing.classList.add('hidden');
      const page = document.getElementById(id);
      page.classList.remove('gone');
      requestAnimationFrame(() => requestAnimationFrame(() => { page.classList.remove('hidden'); page.classList.add('page-enter'); }));
    }, delay);
  };
  if (dest==='music') {
    const tr=document.getElementById('music-transition'); tr.classList.add('active'); showPage('music-page',500);
    setTimeout(()=>{tr.classList.remove('active');tr.classList.add('done');},510); setTimeout(()=>tr.classList.remove('done'),1100);
  } else if (dest==='photos' || dest==='shop') {
    const tr=document.getElementById('photos-transition'); tr.classList.add('active'); showPage('photos-page',500);
    setTimeout(()=>{tr.classList.remove('active');tr.classList.add('done');},510); setTimeout(()=>tr.classList.remove('done'),1100);
    setTimeout(()=>setShopMode(dest==='shop'), 520);
  } else if (dest==='lab') {
    const tr=document.getElementById('lab-transition'); let f=0;
    const flash=()=>{tr.classList.add('active');setTimeout(()=>{tr.classList.remove('active');if(++f<3){setTimeout(flash,80);return;}setTimeout(()=>{landing.classList.add('hidden');const page=document.getElementById('lab-page');page.classList.remove('gone');startMatrix();requestAnimationFrame(()=>requestAnimationFrame(()=>{page.classList.remove('hidden');page.classList.add('page-enter');}));},100);},55);};
    flash();
  }
}

// ══ GO BACK ══
function goBack() {
  closeYT();
  ['music-page','photos-page','lab-page'].forEach(id=>{
    const el=document.getElementById(id);
    if(el.classList.contains('gone')) return;
    el.classList.remove('page-enter'); el.classList.add('hidden');
    setTimeout(()=>{el.classList.add('gone');const inner=el.querySelector('.page-inner');if(inner)inner.scrollTop=0;},720);
  });
  stopMatrix();
  if (shopMode) { shopMode = false; }
  const landing=document.getElementById('landing');
  landing.classList.remove('hidden','gone'); landing.style.zIndex='3';
  setTimeout(()=>{landing.style.zIndex='';},800);
  history.replaceState({ page: 'home' }, '', '/');
}

// ══ CONTACT MODAL ══
function openContact() {
  const m = document.getElementById('contact-modal');
  m.style.opacity='1'; m.style.pointerEvents='all';
}
function closeContact() {
  const m = document.getElementById('contact-modal');
  m.style.opacity='0'; m.style.pointerEvents='none';
}
async function handleContact(e) {
  e.preventDefault();
  const btn = document.getElementById('contact-submit');
  const status = document.getElementById('contact-status');
  btn.textContent = 'Sending...';
  try {
    const res = await fetch('https://formspree.io/f/mwvwevop', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: e.target.name.value, email: e.target.email.value, message: e.target.message.value })
    });
    if (res.ok) {
      status.style.color='#4a8'; status.textContent='✓ message sent';
      e.target.reset(); btn.textContent='Send Message →';
      setTimeout(closeContact, 2000);
    } else throw new Error();
  } catch {
    status.style.color='#c44'; status.textContent='something went wrong — try again';
    btn.textContent='Send Message →';
  }
}
document.getElementById('contact-modal').addEventListener('click', e => {
  if (e.target===document.getElementById('contact-modal')) closeContact();
});

window.addEventListener('resize',()=>{if(matrixRunning){mCanvas.width=window.innerWidth;mCanvas.height=window.innerHeight;}});

// ══ WHOAMI — PARTICLE GRAVITY EFFECT ══
let whoamiHovering = false;
let gravityStrength = 0; // 0 = normal, 1 = full gravity
const GRAVITY_RAMP_UP = 0.04;
const GRAVITY_RAMP_DOWN = 0.02;

function whoamiHoverOn() {
  whoamiHovering = true;
  cursor.classList.add('hover');
}
function whoamiHoverOff() {
  whoamiHovering = false;
  cursor.classList.remove('hover');
}

// Patch the abstract particle update to include gravity
const _origAbstractUpdate = AbstractParticle.prototype.update;
AbstractParticle.prototype.update = function() {
  // Apply gravity when whoami is hovered
  if (gravityStrength > 0.01) {
    // Gravity pulls down
    this.vy += 0.15 * gravityStrength;
    // Dampen horizontal to simulate "disconnect" — particles drift lazily
    this.vx *= (1 - 0.02 * gravityStrength);
    // Reduce cursor influence
    const dx = cursorX - this.x;
    const dy = cursorY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 180) {
      // Weaken attraction proportional to gravity
      const force = (180 - dist) / 180 * 0.012 * (1 - gravityStrength * 0.85);
      this.vx += dx * force * 0.01;
      this.vy += dy * force * 0.01;
      this.alpha = this.baseAlpha + (180 - dist) / 180 * 0.18 * (1 - gravityStrength * 0.6);
    } else {
      this.alpha += (this.baseAlpha * (1 - gravityStrength * 0.5) - this.alpha) * 0.02;
    }
    this.vx *= 0.99; this.vy *= 0.99;
    this.x += this.vx; this.y += this.vy;
    // Wrap horizontally, but let particles fall off bottom and respawn at top
    if (this.x < 0) this.x = aCanvas.width;
    if (this.x > aCanvas.width) this.x = 0;
    if (this.y > aCanvas.height + 20) {
      this.y = -10;
      this.x = Math.random() * aCanvas.width;
      this.vy = Math.random() * 0.5;
    }
    if (this.y < -20) this.y = aCanvas.height;
  } else {
    _origAbstractUpdate.call(this);
  }
};

// Patch the abstract connection drawing to fade connections during gravity
const _origDrawConnections = drawAbstractConnections;
drawAbstractConnections = function() {
  if (gravityStrength > 0.5) return; // No connections when fully disconnected
  for (let i = 0; i < abstractParticles.length; i++) {
    for (let j = i + 1; j < abstractParticles.length; j++) {
      const dx = abstractParticles[i].x - abstractParticles[j].x;
      const dy = abstractParticles[i].y - abstractParticles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110) {
        const alpha = (1 - dist / 110) * 0.05 * (1 - gravityStrength * 1.8);
        if (alpha > 0.001) {
          aCtx.beginPath();
          aCtx.moveTo(abstractParticles[i].x, abstractParticles[i].y);
          aCtx.lineTo(abstractParticles[j].x, abstractParticles[j].y);
          aCtx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, alpha)})`;
          aCtx.lineWidth = 0.5;
          aCtx.stroke();
        }
      }
    }
  }
};

// Update gravity strength each frame (called from animateAbstract indirectly via rAF)
const _origAnimateAbstract = animateAbstract;
animateAbstract = function() {
  // Ramp gravity up/down
  if (whoamiHovering) {
    gravityStrength = Math.min(1, gravityStrength + GRAVITY_RAMP_UP);
  } else {
    gravityStrength = Math.max(0, gravityStrength - GRAVITY_RAMP_DOWN);
  }
  aCtx.clearRect(0, 0, aCanvas.width, aCanvas.height);
  abstractParticles.forEach(p => { p.update(); p.draw(); });
  drawAbstractConnections();
  requestAnimationFrame(animateAbstract);
};

// ══ WHOAMI — ZOOM + NAVIGATE ══
let whoamiNavigating = false;

function navigateWhoami() {
  if (whoamiNavigating) return;
  whoamiNavigating = true;

  const landing = document.getElementById('landing');
  const zoomText = document.getElementById('whoami-zoom-text');
  const transition = document.getElementById('whoami-transition');

  // 1) Start the zoom text animation
  zoomText.classList.add('animating');

  // 2) After zoom text starts fading, fade to black
  setTimeout(() => {
    transition.classList.add('active');
  }, 600);

  // 3) After black screen, show the whoami page
  setTimeout(() => {
    landing.classList.add('hidden');
    const page = document.getElementById('whoami-page');
    page.classList.remove('gone');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      page.classList.remove('hidden');
      page.classList.add('page-enter');
      // Start timeline scroll reveal
      observeTimeline();
      // Add hover listeners
      addHover('#whoami-page .back-btn, #whoami-page a, .whoami-read-more');
    }));

    // Fade out the transition overlay
    setTimeout(() => {
      transition.classList.remove('active');
      zoomText.classList.remove('animating');
      whoamiNavigating = false;
    }, 400);
  }, 1200);

  // Update URL
  history.pushState({ page: 'whoami' }, '', '/whoami');
}

// ══ WHOAMI — BIO TOGGLE ══
function toggleBio() {
  const ext = document.getElementById('bio-extended');
  const btn = document.getElementById('bio-toggle');
  if (ext.classList.contains('expanded')) {
    ext.classList.remove('expanded');
    btn.textContent = '+ read more';
  } else {
    ext.classList.add('expanded');
    btn.textContent = '− read less';
  }
}

// ══ WHOAMI — TIMELINE SCROLL REVEAL ══
function observeTimeline() {
  const items = document.querySelectorAll('.tl-item');
  if (!items.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger the reveal slightly based on index within viewport
        setTimeout(() => {
          entry.target.classList.add('tl-visible');
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, root: document.querySelector('#whoami-page .page-inner') });
  items.forEach(item => observer.observe(item));
}

// ══ WHOAMI — UPDATE GOBACK ══
const _origGoBack = goBack;
goBack = function() {
  closeYT();
  ['music-page','photos-page','lab-page','whoami-page'].forEach(id=>{
    const el=document.getElementById(id);
    if(el.classList.contains('gone')) return;
    el.classList.remove('page-enter'); el.classList.add('hidden');
    setTimeout(()=>{el.classList.add('gone');const inner=el.querySelector('.page-inner');if(inner)inner.scrollTop=0;},720);
  });
  stopMatrix();
  if (shopMode) { shopMode = false; }
  const landing=document.getElementById('landing');
  landing.classList.remove('hidden','gone'); landing.style.zIndex='3';
  setTimeout(()=>{landing.style.zIndex='';},800);
  // Reset URL
  history.pushState({ page: 'home' }, '', '/');
};

// ══ FAST SINGLE-PHOTO DEEP LINK ══
// openProductFast(photoId) reveals the shop and opens the buy modal by fetching
// ONLY that one photo — it never waits for or renders the full ~335-card catalog.
// This is what makes /p?id= and /shop?buy= cold loads paint in <1s instead of ~1min.
// The full catalog is warmed lazily in the background so closing the modal lands
// on a populated shop.
async function openProductFast(photoId) {
  // Reveal the photos page immediately (same force-reveal the /shop router uses,
  // since a CSS transition can't start from a never-painted display:none element).
  var landing = document.getElementById('landing');
  if (landing) { landing.classList.add('hidden', 'gone'); }
  var page = document.getElementById('photos-page');
  if (page) {
    page.classList.remove('gone', 'hidden');
    page.classList.add('page-enter');
    page.style.opacity = '1';
    page.style.transform = 'none';
    page.style.pointerEvents = 'auto';
  }
  try {
    // Single-row fetch — the whole point: never pull the full catalog to show one print.
    var res = await sb.from('photos').select('*').eq('id', photoId).eq('hidden', false).single();
    var photo = res && res.data;
    if (!photo) {
      // Missing/hidden photo — fall back to the normal shop so the link isn't a dead end.
      try { navigate('shop'); } catch (e) {}
      photosReady.then(function () { try { setShopMode(true); renderShop(); } catch (e) {} });
      return;
    }
    photo.tags = photo.tags || '';
    // Seed PHOTOS with just this one so openPrintModal (which does PHOTOS.find) works
    // immediately. loadPhotos() below replaces it with the full set in the background.
    if (!Array.isArray(PHOTOS) || !PHOTOS.length) { PHOTOS = [photo]; }
    try { setShopMode(true); } catch (e) {}
    try { renderShop(); } catch (e) {}
    openPrintModal(photo.id);
    // Warm the full catalog off the critical path so closing the modal reveals the shop.
    try { loadPhotos(); } catch (e) {}
  } catch (e) {
    try { navigate('shop'); } catch (e2) {}
  }
}

// ══ URL ROUTING — direct /p product page (fast single-photo deep link) ══
// /p?id=<photoId> is the shareable per-photo product link (Pinterest/Etsy/email).
(function() {
  if (window.location.pathname !== '/p') return;
  var pid = null;
  try { pid = new URLSearchParams(window.location.search).get('id'); } catch (e) {}
  var go = function () {
    if (!pid) { try { navigate('shop'); } catch (e) {} return; }
    openProductFast(pid);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 0); });
  } else {
    setTimeout(go, 0);
  }
})();

// ══ URL ROUTING — direct /shop access ══
(function() {
  if (window.location.pathname === '/shop') {
    // Optional deep link: /shop?buy=<photoId> auto-opens that photo's buy modal
    // (used by Pinterest/Etsy product links + the "your requested print is now
    // available" email).
    var buyId = null;
    try { buyId = new URLSearchParams(window.location.search).get('buy'); } catch (e) {}
    // Fast path: if this is a per-photo deep link (?buy=<id>), open just that one
    // photo (single-row fetch) instead of waiting for the whole catalog. This makes
    // existing Pinterest/Etsy ?buy= links as fast as the newer /p?id= links.
    if (buyId) {
      var goBuy = function () { openProductFast(buyId); };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(goBuy, 0); });
      } else {
        setTimeout(goBuy, 0);
      }
      return;
    }
    // Direct URL access — reuse the SAME reveal path as a normal in-app click
    // (navigate('shop')). Rolling our own reveal here left the page stuck at the
    // hidden-state opacity:0/scale on a cold load, because a CSS transition can't
    // start from a display:none element that was never painted. navigate() is the
    // proven path: it runs the transition overlay, reveals the page, and flips
    // shop mode. We then await photosReady before opening the deep-linked buy
    // modal so it never fires against an empty PHOTOS array.
    var openShop = function () {
      // Kick the normal animated reveal (transition overlay + page-enter).
      try { navigate('shop'); } catch (e) {}
      // Guaranteed reveal: on a cold direct load the CSS transition can fail to
      // start (it can't animate from a never-painted display:none element), which
      // left the page stuck invisible at opacity:0. So once photos are loaded we
      // FORCE the photos page fully visible and in shop mode, independent of the
      // animation — then open the deep-linked buy modal. This is what makes the
      // Pinterest/Etsy ?buy= links reliable.
      photosReady.then(function () {
        var landing = document.getElementById('landing');
        if (landing) { landing.classList.add('hidden', 'gone'); }
        var page = document.getElementById('photos-page');
        if (page) {
          page.classList.remove('gone', 'hidden');
          page.classList.add('page-enter');
          page.style.opacity = '1';
          page.style.transform = 'none';
          page.style.pointerEvents = 'auto';
        }
        try { setShopMode(true); } catch (e) {}
        try { renderShop(); } catch (e) {}
        try { addHover('#photos-page .back-btn, #photos-page a'); } catch (e) {}
        if (buyId) {
          setTimeout(function () { try { openPrintModal(buyId); } catch (e) {} }, 300);
        }
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(openShop, 50); });
    } else {
      setTimeout(openShop, 50);
    }
  }
})();

// ══ URL ROUTING — direct /whoami access ══
(function() {
  const path = window.location.pathname;
  if (path === '/mr.manager') {
    // Hidden full-page admin workspace. Login-gated via Supabase.
    setTimeout(() => { openAdmin(true); }, 200);
    return;
  }
  if (path === '/whoami') {
    // Direct URL access — skip the zoom animation, go straight to page
    setTimeout(() => {
      const landing = document.getElementById('landing');
      landing.classList.add('hidden');
      setTimeout(() => { landing.classList.add('gone'); }, 100);
      const page = document.getElementById('whoami-page');
      page.classList.remove('gone');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        page.classList.remove('hidden');
        page.classList.add('page-enter');
        observeTimeline();
        addHover('#whoami-page .back-btn, #whoami-page a, .whoami-read-more');
      }));
    }, 300);
  }
})();

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page === 'whoami') {
    // Forward to whoami
    const landing = document.getElementById('landing');
    landing.classList.add('hidden');
    const page = document.getElementById('whoami-page');
    page.classList.remove('gone','hidden');
    page.classList.add('page-enter');
    observeTimeline();
  } else {
    // Back to landing
    goBack();
  }
});

// ══ PRINT MODAL ══
const SUPA_EDGE = 'https://zbcdeglxwrappriwpxwt.supabase.co/functions/v1';

// Print sizes offered. We ONLY list sizes whose aspect ratio matches the photo,
// so Prodigi never crops the image. The Fuji X-T5 archive is 3:2 / 2:3, so every
// size here is a true 2:3 (=1.5) ratio. `longIn` gates by resolution; `shortIn`/`longIn`
// give the print proportions used for the live crop-accurate preview. Prodigi
// auto-orients the asset, so one SKU serves both portrait and landscape.
// Prices are ALL-IN with FREE shipping (shipping cost is baked into the price,
// not added at checkout). Validated against live Prodigi cost + Stripe fees:
// every size holds 45–70% margin worldwide. Framed ships free to US/UK/AU only
// (Canada framed is blocked server-side — Prodigi's framed-CA shipping is ~$94).
// FRAMED SKUs are the VERIFIED Prodigi product GLOBAL-CFPM-MOTH-[size]: Classic
// Frame, EMA 200gsm Fine Art Print, Mounted/Matted, Motheye Glaze, snow-white
// mount — confirmed against the live Prodigi catalogue during the Etsy launch.
// Frame COLOUR (Black/White/Natural) is a real Prodigi option on this frame and
// is passed through to fulfillment; cost is the same across the three colours.
// Framed item costs (US, item only): 8×12 $45, 16×24 $116 (+~$25/$26 frame
// shipping). Retail matches Etsy so the channels don't undercut each other:
// 8×12 framed $119, 16×24 framed $245.
const PRINT_SIZES = [
  // 3:2 family (Fujifilm X-T5, Nomo) — ratio 1.5
  { sku: 'GLOBAL-FAP-4X6',    label: '4×6"',   price: 2900,  framed: false, shortIn: 4,  longIn: 6,  ratio: 1.5 },
  { sku: 'GLOBAL-FAP-6X9',    label: '6×9"',   price: 3500,  framed: false, shortIn: 6,  longIn: 9,  ratio: 1.5 },
  { sku: 'GLOBAL-FAP-8X12',   label: '8×12"',  price: 4500,  framed: false, shortIn: 8,  longIn: 12, ratio: 1.5 },
  { sku: 'GLOBAL-FAP-16X24',  label: '16×24"', price: 7900,  framed: false, shortIn: 16, longIn: 24, ratio: 1.5 },
  { sku: 'GLOBAL-FAP-24X36',  label: '24×36"', price: 11500, framed: false, shortIn: 24, longIn: 36, ratio: 1.5 },
  { sku: 'GLOBAL-CFPM-MOTH-8X12',  label: '8×12" Framed',  price: 11900, framed: true, shortIn: 8,  longIn: 12, ratio: 1.5 },
  { sku: 'GLOBAL-CFPM-MOTH-16X24', label: '16×24" Framed', price: 24500, framed: true, shortIn: 16, longIn: 24, ratio: 1.5 },
  // 4:3 family (CampSnap & any 4:3 crop) — ratio 1.3333 — so these photos get no-crop options too
  { sku: 'GLOBAL-FAP-6X8',    label: '6×8"',   price: 2900,  framed: false, shortIn: 6,  longIn: 8,  ratio: 4/3 },
  { sku: 'GLOBAL-FAP-9X12',   label: '9×12"',  price: 4500,  framed: false, shortIn: 9,  longIn: 12, ratio: 4/3 },
  { sku: 'GLOBAL-FAP-12X16',  label: '12×16"', price: 5900,  framed: false, shortIn: 12, longIn: 16, ratio: 4/3 },
];

// Minimum print quality floor. A size is offered only if the photo's long edge
// has at least (longIn × MIN_DPI) pixels. 200 = honest "sharp at arm's length"
// floor (raised from 150, which let web-optimized 2048px photos offer soft
// 8×12/9×12 prints that undercut the museum-quality positioning). Full-res,
// Nomo, and 3000px+ photos still offer their large sizes; only the
// web-optimized 2048px photos are now capped at ~6×9 / 6×8.
const MIN_PRINT_DPI = 200;
// Aspect-ratio tolerance: a print ratio within this of the photo ratio = "no crop".
const RATIO_TOLERANCE = 0.06;

// Returns the subset of PRINT_SIZES that BOTH fit the resolution AND match the
// photo's aspect ratio (so nothing is ever cropped).
function sizesForPhoto(longestPx, photoRatio) {
  return PRINT_SIZES.filter(s => {
    const fitsRes = !longestPx || longestPx >= s.longIn * MIN_PRINT_DPI;
    const fitsRatio = !photoRatio || Math.abs(s.ratio - photoRatio) <= RATIO_TOLERANCE;
    return fitsRes && fitsRatio;
  });
}

let _printPhotoId = null;
let _printSku = null;
let _printFrameColor = 'black';
let _printPriceCents = 0;
let _printPhotoSrc = '';
let _printPhotoIsPortrait = false;
let _printPhotoMockupUrl = null; // optional per-photo Prodigi hero mockup override
let _printFrameMockups = { black: null, white: null, natural: null }; // per-colour wall mockups
// ── Phase 2b: print finish variant. 'print-master' = full bleed; 'bordered' =
// the pre-generated white-border asset. Border option only shown when a
// 'bordered' photo_assets row exists for this photo. The chosen variant rides
// through checkout in metadata.variant; the webhook prints that asset.
let _printVariant = 'print-master';
let _printHasBordered = false;

function openPrintModal(photoId) {
  const photo = PHOTOS.find(p => String(p.id) === String(photoId));
  if (!photo) return;
  _printPhotoId = photoId;
  _printSku = null;
  _printFrameColor = 'black';
  _printPriceCents = 0;
  _printPhotoSrc = photo.src || '';
  _printPhotoMockupUrl = photo.mockup_url || null;
  // Per-frame-colour wall mockups (hand-made Gemini room shots), if uploaded.
  _printFrameMockups = {
    black:   photo.mockup_frame_black   || null,
    white:   photo.mockup_frame_white   || null,
    natural: photo.mockup_frame_natural || null,
  };

  // Seed the preview with the bare photo (paper mode) until a size is chosen
  document.getElementById('print-preview-img').src = _printPhotoSrc;
  document.getElementById('print-preview-frame').className = 'pv-frame paper';
  document.getElementById('print-preview-frame').style.aspectRatio = '';
  document.getElementById('print-preview-caption').textContent = 'select a size to preview your print';
  document.getElementById('print-error').textContent = '';
  document.getElementById('print-copies').value = 1;
  document.getElementById('print-total-row').textContent = '';
  document.getElementById('print-checkout-btn').disabled = true;

  // Reset frame section
  document.getElementById('print-frame-section').style.display = 'none';
  document.querySelectorAll('.print-frame-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.color === 'black');
  });

  // Reset + resolve the white-border option. Default to full bleed; only reveal
  // the toggle once we confirm a 'bordered' variant exists for this photo.
  _printVariant = 'print-master';
  _printHasBordered = false;
  const borderSection = document.getElementById('print-border-section');
  if (borderSection) borderSection.style.display = 'none';
  document.querySelectorAll('.print-border-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.variant === 'print-master');
  });
  checkBorderedVariant(photoId);

  // Show modal first (with a measuring state), then gate sizes by real resolution
  const grid = document.getElementById('print-size-grid');
  grid.innerHTML = '<div class="print-measuring">checking print sizes…</div>';
  const modal = document.getElementById('print-modal');
  modal.classList.add('open');

  // Measure the photo's true pixel dimensions, then build only feasible sizes.
  measurePhotoAndBuildSizes(_printPhotoSrc);
}

function buildSizeGrid(sizes, note) {
  const grid = document.getElementById('print-size-grid');
  if (!sizes.length) {
    grid.innerHTML = '<div class="print-measuring">This photo isn’t available as a print at the moment — its resolution is below our print-quality floor. Use “Request a larger version”.</div>';
    return;
  }
  grid.innerHTML = sizes.map(s => {
    const dollars = (s.price / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
    return `<button class="print-size-btn" data-sku="${s.sku}" data-price="${s.price}" data-framed="${s.framed}" data-short="${s.shortIn}" data-long="${s.longIn}" onclick="selectSize(this)">
      <span class="ps-size">${s.label}</span>
      <span class="ps-price">${dollars}</span>
    </button>`;
  }).join('') + (note ? `<div class="print-size-note">${note}</div>` : '');
  addHover('.print-size-btn,.print-frame-btn,.print-checkout-btn');
}

function measurePhotoAndBuildSizes(src) {
  const img = new Image();
  img.onload = function() {
    const w = img.naturalWidth, h = img.naturalHeight;
    const longestPx = Math.max(w, h);
    _printPhotoIsPortrait = h > w;
    const photoRatio = longestPx / Math.min(w, h); // long/short, e.g. 1.5 for 3:2
    const feasible = sizesForPhoto(longestPx, photoRatio);
    const note = feasible.length
      ? `Only sizes that match this photo’s proportions are shown — your print is never cropped.`
      : '';
    buildSizeGrid(feasible, note);
  };
  img.onerror = function() {
    // If measuring fails, fall back to the smallest 3:2 sizes (the native Fuji/Nomo
    // ratio — the safe default). Ratio can't be checked without dimensions.
    buildSizeGrid(PRINT_SIZES.filter(s => Math.abs(s.ratio - 1.5) <= RATIO_TOLERANCE && s.longIn <= 12), '');
  };
  img.src = src;
}

// Render the live preview: photo at the selected size's true proportions,
// inside a paper or framed mockup. Honors an optional per-photo hero mockup URL.
function renderPrintPreview() {
  const stage = document.getElementById('print-preview-stage');
  const caption = document.getElementById('print-preview-caption');

  // Hero override: a hand-made Prodigi lifestyle mockup for this photo, if present.
  if (_printPhotoMockupUrl) {
    stage.innerHTML = `<img class="pv-mockup-img" src="${_printPhotoMockupUrl}" alt="">`;
    caption.textContent = _printSku ? 'product mockup' : 'select a size to preview your print';
    return;
  }

  const size = PRINT_SIZES.find(s => s.sku === _printSku);
  // proportions of the selected print, oriented to match the photo
  let arW = 2, arH = 3; // default portrait 2:3
  if (size) {
    if (_printPhotoIsPortrait) { arW = size.shortIn; arH = size.longIn; }
    else { arW = size.longIn; arH = size.shortIn; }
  } else {
    if (!_printPhotoIsPortrait) { arW = 3; arH = 2; }
  }

  const framed = !!(size && size.framed);

  // If this is a framed size AND a hand-made wall mockup exists for the chosen
  // frame colour, show that photo-real room shot instead of the CSS frame.
  if (framed) {
    const realMockup = _printFrameMockups[_printFrameColor];
    if (realMockup) {
      stage.innerHTML = `<img class="pv-mockup-img" src="${realMockup}" alt="">`;
      caption.textContent = `${size.label} · ${_printFrameColor} frame · shown on a wall`;
      return;
    }
  }

  const fc = framed ? ` fc-${_printFrameColor}` : '';
  // White-border variant: inset the image inside a white mat so the buyer sees
  // the border in the preview. ~5% padding mirrors the 4%-of-long-edge print border.
  const bordered = !framed && _printVariant === 'bordered';
  const imgStyle = bordered
    ? 'style="display:block;width:100%;height:100%;padding:5%;background:#fff;object-fit:contain"'
    : '';
  stage.innerHTML = `<div id="print-preview-frame" class="pv-frame ${framed ? 'framed' : 'paper'}${fc}" style="aspect-ratio:${arW}/${arH}">
      <img id="print-preview-img" src="${_printPhotoSrc}" alt="" ${imgStyle}>
    </div>`;
  const finishLabel = framed
    ? ` · ${_printFrameColor} frame`
    : (bordered ? ' · fine-art paper · white border' : ' · fine-art paper');
  caption.textContent = size
    ? `${size.label}${finishLabel} · actual proportions, no crop`
    : 'select a size to preview your print';
}

function closePrintModal() {
  document.getElementById('print-modal').classList.remove('open');
}

// Phase 2b — does this photo have a pre-generated white-border print asset?
// If so, reveal the Full bleed / White border toggle. Async + best-effort: on
// any error we simply leave the toggle hidden (full bleed remains the default).
async function checkBorderedVariant(photoId) {
  try {
    const { data, error } = await sb.from('photo_assets')
      .select('id').eq('photo_id', photoId).eq('variant', 'bordered').limit(1);
    if (error || !data || !data.length) return;
    // Photo may have changed while the query was in flight — ignore stale result.
    if (String(_printPhotoId) !== String(photoId)) return;
    _printHasBordered = true;
    const sec = document.getElementById('print-border-section');
    if (sec) sec.style.display = 'block';
    addHover('.print-border-btn');
  } catch (_) { /* leave toggle hidden */ }
}

function selectBorder(btn) {
  document.querySelectorAll('.print-border-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _printVariant = btn.dataset.variant; // 'print-master' | 'bordered'
  renderPrintPreview();
}

document.getElementById('print-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('print-modal')) closePrintModal();
});

// ══ REQUEST-A-PRINT MODAL ══
let _requestPhotoId = null;
let _requestPhotoSrc = '';
function openRequestModal(photoId) {
  const photo = PHOTOS.find(p => String(p.id) === String(photoId));
  if (!photo) return;
  _requestPhotoId = photoId;
  _requestPhotoSrc = photo.src || '';
  document.getElementById('request-modal-photo').src = _requestPhotoSrc;
  document.getElementById('request-email').value = '';
  document.getElementById('request-message').value = '';
  document.getElementById('request-error').textContent = '';
  const btn = document.getElementById('request-submit-btn');
  btn.disabled = false;
  btn.textContent = 'Send Request →';
  document.getElementById('request-modal').classList.add('open');
  addHover('.print-checkout-btn');
}
function closeRequestModal() {
  document.getElementById('request-modal').classList.remove('open');
}
document.getElementById('request-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('request-modal')) closeRequestModal();
});
async function submitRequest() {
  const email = document.getElementById('request-email').value.trim();
  const message = document.getElementById('request-message').value.trim();
  const errEl = document.getElementById('request-error');
  const btn = document.getElementById('request-submit-btn');
  errEl.textContent = '';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errEl.textContent = 'Please enter a valid email.';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    // 1) Save the request to Supabase (anon INSERT allowed by RLS)
    const ins = await sb.from('print_requests').insert({
      photo_id: _requestPhotoId,
      photo_src: _requestPhotoSrc,
      email: email,
      message: message || null,
      user_agent: navigator.userAgent
    });
    if (ins.error) throw ins.error;

    // 2) Notify Stuart by email via the existing Formspree endpoint (best-effort)
    try {
      await fetch('https://formspree.io/f/mwvwevop', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _subject: 'New print request — stuartsingleton.com',
          type: 'PRINT REQUEST',
          photo_id: _requestPhotoId,
          photo: _requestPhotoSrc,
          requester_email: email,
          note: message || '(none)'
        })
      });
    } catch (notifyErr) { /* notification is non-blocking; request already saved */ }

    btn.textContent = 'Request sent ✓';
    const body = document.querySelector('#request-modal .print-modal-body');
    body.innerHTML = `<p class="print-note" style="text-align:center;line-height:1.8;color:#888;">Thanks — your request is in.<br>Stuart will review this photo for sale and email you at <span style="color:#aaa;">${email}</span> if it's listed.</p>
      <button class="print-checkout-btn" onclick="closeRequestModal()" onmouseenter="cursor.classList.add('hover')" onmouseleave="cursor.classList.remove('hover')">Close</button>`;
    addHover('.print-checkout-btn');
  } catch (err) {
    errEl.textContent = (err && err.message) ? err.message : 'Could not send request. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Send Request →';
  }
}

function selectSize(btn) {
  document.querySelectorAll('.print-size-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _printSku = btn.dataset.sku;
  _printPriceCents = parseInt(btn.dataset.price, 10);
  const isFramed = btn.dataset.framed === 'true';
  document.getElementById('print-frame-section').style.display = isFramed ? 'block' : 'none';
  document.getElementById('print-checkout-btn').disabled = false;
  renderPrintPreview();
  updatePrintTotal();
}

function selectFrame(btn) {
  document.querySelectorAll('.print-frame-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _printFrameColor = btn.dataset.color;
  renderPrintPreview();
}

function adjustCopies(delta) {
  const input = document.getElementById('print-copies');
  const next = Math.max(1, Math.min(20, parseInt(input.value || 1, 10) + delta));
  input.value = next;
  updatePrintTotal();
}

function updatePrintTotal() {
  if (!_printSku) return;
  const copies = parseInt(document.getElementById('print-copies').value || 1, 10);
  const total = (_printPriceCents * copies) / 100;
  const formatted = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
  document.getElementById('print-total-row').innerHTML = `Total: <strong>${formatted}</strong> &middot; <span style="color:#3a7a3a">free shipping</span>`;
}

async function submitPrintOrder() {
  if (!_printPhotoId || !_printSku) return;
  const copies = parseInt(document.getElementById('print-copies').value || 1, 10);
  const btn = document.getElementById('print-checkout-btn');
  const errEl = document.getElementById('print-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Redirecting…';

  try {
    const res = await fetch(`${SUPA_EDGE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY },
      body: JSON.stringify({
        photoId: _printPhotoId,
        sku: _printSku,
        frameColor: _printFrameColor,
        variant: _printVariant, // 'print-master' (full bleed) or 'bordered'
        copies,
        successUrl: `${window.location.origin}/print-success`,
        cancelUrl: `${window.location.origin}/shop`
      })
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Could not create checkout session');
    }
    window.location.href = data.url;
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong. Please try again.';
    btn.disabled = false;
    btn.textContent = 'Proceed to Checkout →';
  }
}

// ══ PRINT SUCCESS PAGE ══
(function() {
  if (window.location.pathname === '/print-success') {
    const landing = document.getElementById('landing');
    landing.classList.add('hidden');
    setTimeout(() => { landing.classList.add('gone'); }, 100);
    // Show a simple thank-you overlay
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:#050505;';
    el.innerHTML = `<div style="text-align:center;font-family:var(--mono);max-width:440px;padding:40px 24px;">
      <div style="font-size:9px;letter-spacing:.3em;color:#333;text-transform:uppercase;margin-bottom:24px;">// order confirmed</div>
      <div style="font-size:13px;color:#888;letter-spacing:.08em;line-height:1.7;margin-bottom:32px;">
        Your print order has been received.<br>
        You'll get a confirmation email shortly.<br>
        <span style="color:#444;">Prints ship within 3–5 business days.</span>
      </div>
      <button onclick="window.location.href='/';"
        style="background:none;border:1px solid #222;color:#555;font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;padding:12px 28px;cursor:none;"
        onmouseenter="cursor.classList.add('hover')" onmouseleave="cursor.classList.remove('hover')">
        ← Back to Site
      </button>
    </div>`;
    document.body.appendChild(el);
    history.replaceState({ page: 'print-success' }, '', '/print-success');
  }
})();

// ══ ADMIN FOR_SALE TOGGLE ══
// Patched into loadAdminPhotos via event delegation — handled in admin photo list click handler
