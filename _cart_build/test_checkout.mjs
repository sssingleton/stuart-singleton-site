// Offline test harness: ports the PURE logic from create-checkout-session v24
// and asserts it against realistic inputs. No network — Supabase is mocked.
const PRICES_CENTS = {
  "GLOBAL-FAP-4X6":2900,"GLOBAL-FAP-6X9":3500,"GLOBAL-FAP-8X12":4500,"GLOBAL-FAP-16X24":7900,
  "GLOBAL-FAP-24X36":11500,"GLOBAL-FAP-6X8":2900,"GLOBAL-FAP-9X12":4500,"GLOBAL-FAP-12X16":5900,
  "GLOBAL-FAP-8X10":3500,"GLOBAL-FAP-12X18":5900,"GLOBAL-FAP-18X24":8500,
  "GLOBAL-CFPM-MOTH-8X12":11900,"GLOBAL-CFPM-MOTH-16X24":24500,
  "GLOBAL-CFPM-8X10":12000,"GLOBAL-CFPM-12X16":16000,"GLOBAL-CFPM-16X24":20900,
};
const MIN_PRINT_DPI=200, RATIO_TOLERANCE=0.06, NO_MASTER_ASSUMED_LONG_PX=2048;
const SKU_PRINT_DIMS={
  "GLOBAL-FAP-4X6":{shortIn:4,longIn:6,ratio:1.5},"GLOBAL-FAP-6X9":{shortIn:6,longIn:9,ratio:1.5},
  "GLOBAL-FAP-8X12":{shortIn:8,longIn:12,ratio:1.5},"GLOBAL-FAP-16X24":{shortIn:16,longIn:24,ratio:1.5},
  "GLOBAL-FAP-24X36":{shortIn:24,longIn:36,ratio:1.5},"GLOBAL-CFPM-MOTH-8X12":{shortIn:8,longIn:12,ratio:1.5},
  "GLOBAL-CFPM-MOTH-16X24":{shortIn:16,longIn:24,ratio:1.5},"GLOBAL-FAP-6X8":{shortIn:6,longIn:8,ratio:4/3},
  "GLOBAL-FAP-9X12":{shortIn:9,longIn:12,ratio:4/3},"GLOBAL-FAP-12X16":{shortIn:12,longIn:16,ratio:4/3},
};
function sizeAllowed(skuUpper, masterLong, masterShort){
  const dims=SKU_PRINT_DIMS[skuUpper]; if(!dims) return {ok:true};
  const need=dims.longIn*MIN_PRINT_DPI;
  if(!masterLong||!masterShort){ return NO_MASTER_ASSUMED_LONG_PX>=need?{ok:true}:{ok:false,reason:"prepping larger version"}; }
  if(masterLong<need) return {ok:false,reason:"below print quality"};
  if(Math.abs(masterLong/masterShort-dims.ratio)>RATIO_TOLERANCE) return {ok:false,reason:"ratio mismatch"};
  return {ok:true};
}
const FRAMED_BLOCKED=["CA"], ALL=["US","CA","GB","AU"];

// mock DB: photos + master dims
const PHOTOS={ 192:{for_sale:true,master:[4032,2688]}, 122:{for_sale:true,master:null}, 350:{for_sale:true,master:[6000,4000]}, 999:{for_sale:false,master:[4032,2688]} };
function masterDims(id){ const m=PHOTOS[id]&&PHOTOS[id].master; return m?{long:Math.max(...m),short:Math.min(...m)}:{long:null,short:null}; }

// core: validate + build (mirrors the edge fn control flow, returns {status, ...})
function build(body){
  if(!body.successUrl||!body.cancelUrl) return {status:400,error:"urls"};
  let raw;
  if(Array.isArray(body.items)&&body.items.length) raw=body.items;
  else if(body.photoId&&body.sku) raw=[{photoId:body.photoId,sku:body.sku,frameColor:body.frameColor,variant:body.variant,copies:body.copies??1}];
  else return {status:400,error:"need items or photoId+sku"};
  if(raw.length>30) return {status:400,error:"too many"};
  const clean=[]; let anyFramed=false, amountTotal=0;
  for(const r of raw){
    const sku=String(r.sku||"").toUpperCase();
    const copies=Math.max(1,Math.min(20,parseInt(r.copies??1,10)||1));
    if(!r.photoId||!sku) return {status:400,error:"item missing"};
    const price=PRICES_CENTS[sku]; if(!price) return {status:400,error:"unknown sku "+sku};
    const p=PHOTOS[r.photoId]; if(!p) return {status:404,error:"photo not found"};
    if(!p.for_sale) return {status:403,error:"not for sale"};
    const md=masterDims(r.photoId); const g=sizeAllowed(sku,md.long,md.short);
    if(!g.ok) return {status:422,error:g.reason};
    if(sku.startsWith("GLOBAL-CFPM")) anyFramed=true;
    amountTotal+=price*copies;
    clean.push({sku,copies,price,variant:(r.variant==="bordered"||r.variant==="alt-crop")?r.variant:"print-master"});
  }
  const countries=anyFramed?ALL.filter(c=>!FRAMED_BLOCKED.includes(c)):ALL;
  return {status:200, lineItems:clean.length, amountTotal, countries, items:clean};
}

// ---- assertions ----
let pass=0, fail=0;
function eq(name,got,want){ const ok=JSON.stringify(got)===JSON.stringify(want); (ok?pass++:fail++); console.log((ok?"PASS":"FAIL")+" — "+name+(ok?"":`  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)); }

const U={successUrl:"/s",cancelUrl:"/c"};
// 1 legacy single
let r=build({...U,photoId:192,sku:"GLOBAL-FAP-8X12",copies:2});
eq("legacy single → 1 line, price 4500*2", [r.status,r.lineItems,r.amountTotal], [200,1,9000]);
// 2 cart of 3
r=build({...U,items:[{photoId:192,sku:"GLOBAL-FAP-8X12",copies:1},{photoId:350,sku:"GLOBAL-FAP-6X9",copies:2},{photoId:192,sku:"GLOBAL-FAP-4X6",copies:1}]});
eq("cart 3 items subtotal 4500+3500*2+2900", [r.status,r.lineItems,r.amountTotal], [200,3,4500+7000+2900]);
// 3 framed → no CA
r=build({...U,items:[{photoId:192,sku:"GLOBAL-CFPM-MOTH-8X12",frameColor:"black",copies:1}]});
eq("framed excludes CA", r.countries, ["US","GB","AU"]);
// 4 unframed keeps CA
r=build({...U,items:[{photoId:192,sku:"GLOBAL-FAP-8X12",copies:1}]});
eq("unframed keeps CA", r.countries, ["US","CA","GB","AU"]);
// 5 no-master 8x12 blocked (needs 2400px, assumed 2048)
r=build({...U,photoId:122,sku:"GLOBAL-FAP-8X12"});
eq("no-master 8x12 blocked(422)", r.status, 422);
// 6 no-master 6x9 allowed (needs 1800px <=2048)
r=build({...U,photoId:122,sku:"GLOBAL-FAP-6X9"});
eq("no-master 6x9 allowed", r.status, 200);
// 7 master 4032 requesting 24x36 (needs 7200) blocked
r=build({...U,photoId:192,sku:"GLOBAL-FAP-24X36"});
eq("4032px master 24x36 blocked", r.status, 422);
// 8 master 6000 requesting 24x36 (needs 7200) still blocked
r=build({...U,photoId:350,sku:"GLOBAL-FAP-24X36"});
eq("6000px master 24x36 blocked", r.status, 422);
// 9 ratio mismatch: 3:2 master requesting 4:3 (6x8) blocked
r=build({...U,photoId:192,sku:"GLOBAL-FAP-6X8"});
eq("3:2 master on 4:3 sku blocked", r.status, 422);
// 10 not-for-sale photo
r=build({...U,photoId:999,sku:"GLOBAL-FAP-4X6"});
eq("not-for-sale blocked(403)", r.status, 403);
// 11 unknown sku
r=build({...U,photoId:192,sku:"GLOBAL-FAP-99X99"});
eq("unknown sku blocked(400)", r.status, 400);
// 12 >30 items
r=build({...U,items:Array.from({length:31},()=>({photoId:192,sku:"GLOBAL-FAP-4X6",copies:1}))});
eq(">30 items blocked(400)", r.status, 400);
// 13 one bad item blocks whole cart
r=build({...U,items:[{photoId:192,sku:"GLOBAL-FAP-8X12",copies:1},{photoId:122,sku:"GLOBAL-FAP-8X12",copies:1}]});
eq("one bad item blocks cart(422)", r.status, 422);
// 14 copies clamp 0->1 and 50->20
r=build({...U,items:[{photoId:192,sku:"GLOBAL-FAP-4X6",copies:0}]});
eq("copies 0 clamps to 1", r.amountTotal, 2900);
r=build({...U,items:[{photoId:192,sku:"GLOBAL-FAP-4X6",copies:50}]});
eq("copies 50 clamps to 20", r.amountTotal, 2900*20);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
