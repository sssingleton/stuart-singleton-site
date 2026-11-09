// Shared digital pricing + validation (2026-11-09, unified Shop).
// Profiles: launch tiers. Presets: flat per pack. 🔴 MIRRORED in index.html (DIGITAL_TIERS).
// deno-lint-ignore-file no-explicit-any
export const PRESET_CENTS = 500;
export const PROFILE_TIERS: Array<[number, number]> = [[1, 500], [5, 2000], [10, 3500], [15, 4500]];
export const PROFILE_COUNT = 15;

// Cheapest way to cover exactly m picks with tier bundles.
function exactCost(m: number): number {
  const dp = new Array(m + 1).fill(Infinity); dp[0] = 0;
  for (let i = 1; i <= m; i++) for (const [n, c] of PROFILE_TIERS) if (n <= i) dp[i] = Math.min(dp[i], dp[i - n] + c);
  return dp[m];
}
// Price for n chosen profiles = cheapest bundle set covering AT LEAST n (never charge more for
// fewer picks: 9 picks pay the pick-10 price, 14 pay the all-15 price and get all 15).
export function profilePrice(n: number): { cents: number; slots: number; all: boolean } {
  if (n <= 0) return { cents: 0, slots: 0, all: false };
  let best = { cents: Infinity, slots: n };
  for (let m = n; m <= PROFILE_COUNT; m++) { const c = exactCost(m); if (c <= best.cents) best = { cents: c, slots: m }; }
  return { ...best, all: best.slots >= PROFILE_COUNT };
}

export type DigitalLine = { name: string; description: string; cents: number; image?: string };
export type DigitalQuote = { packIds: string[]; lines: DigitalLine[]; cents: number; profiles: number; presets: number; allProfiles: boolean };

export async function quoteDigital(supabase: any, rawIds: unknown): Promise<DigitalQuote | { error: string; status: number }> {
  if (!Array.isArray(rawIds) || !rawIds.length) return { error: "No presets or profiles selected.", status: 400 };
  const ids = [...new Set(rawIds.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))] as string[];
  if (!ids.length || ids.length > 60) return { error: "Invalid selection.", status: 400 };
  const { data: packs, error } = await supabase.from("packs").select("id,name,kind,is_active,cover_image_url,sort_order").in("id", ids);
  if (error) return { error: "Could not load packs.", status: 500 };
  if ((packs ?? []).length !== ids.length || packs.some((p: any) => !p.is_active)) return { error: "Something in your cart is no longer available.", status: 409 };
  const profiles = packs.filter((p: any) => p.kind === "profile").sort((a: any, b: any) => a.sort_order - b.sort_order);
  const presets = packs.filter((p: any) => p.kind !== "profile");
  const lines: DigitalLine[] = [];
  let grant = ids;
  let allProfiles = false;
  if (profiles.length) {
    const pp = profilePrice(profiles.length);
    allProfiles = pp.all;
    if (pp.all) {
      const { data: every } = await supabase.from("packs").select("id").eq("kind", "profile").eq("is_active", true);
      grant = [...new Set([...presets.map((p: any) => p.id), ...(every ?? []).map((p: any) => p.id)])];
    }
    const names = pp.all ? "All 15 stocks" : profiles.map((p: any) => p.name).join(", ");
    lines.push({
      name: pp.all ? "Halation profiles: all 15" : profiles.length === 1 ? `Halation profile: ${profiles[0].name}` : `Halation profiles: ${profiles.length} picks`,
      description: `${names}. 4 looks each (Regular, Texture, Dev, Dev + Texture). Instant download.`.slice(0, 480),
      cents: pp.cents,
      image: profiles.length === 1 ? profiles[0].cover_image_url ?? undefined : undefined,
    });
  }
  for (const p of presets) lines.push({ name: `${p.name}: Lightroom preset pack`, description: "Instant download.", cents: PRESET_CENTS, image: p.cover_image_url ?? undefined });
  return { packIds: grant, lines, cents: lines.reduce((n, l) => n + l.cents, 0), profiles: profiles.length, presets: presets.length, allProfiles };
}

export function cleanSrc(v: unknown): string | null {
  return typeof v === "string" ? (v.replace(/[^a-z0-9_.-]/gi, "").slice(0, 40) || null) : null;
}
