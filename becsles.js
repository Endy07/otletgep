// Becslés: milyen nehéz és mennyi idő megcsinálni egy ötletet. Mindenki a saját értékelésében becsül
// (`nehez`, `ido`), a közös listán a csoport összesítése látszik. Tiszta függvények, tesztelhető.

/** Nehézség 1–5. */
export const NEHEZSEGEK = { 1: "nagyon könnyű", 2: "könnyű", 3: "közepes", 4: "nehéz", 5: "nagyon nehéz" };
/** Idő hetekben → felirat. Csak ezek az értékek érvényesek. */
export const IDOK = { 1: "1 hét", 2: "2 hét", 4: "1 hónap", 8: "2 hónap", 13: "3 hónap", 26: "fél év", 52: "1 év+" };
const IDO_ERTEKEK = Object.keys(IDOK).map(Number);

// A többiek fájljából jövő érték bármi lehet (a token nyilvános): HTML elé mindig ezeken megy át.
export const nehezSzam = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
export const idoSzam = (v) => { const n = Number(v); return IDO_ERTEKEK.includes(n) ? n : 0; };

/** A medián hetet a legközelebbi érvényes időre kerekíti (a feliratért). */
export const idoKerekit = (het) => IDO_ERTEKEK.reduce((a, b) => (Math.abs(b - het) < Math.abs(a - het) ? b : a));

/**
 * @param ertekelesek  egy ötlet értékelései mindenkitől: [{ nehez, ido }, …] (szűretlenül)
 * @returns { nehez: átlag 1 tizedesre | null, nehezDb, ido: medián hét (érvényes érték) | null, idoDb }
 */
export function osszesit(ertekelesek) {
  const n = ertekelesek.map((e) => nehezSzam(e?.nehez)).filter(Boolean);
  const i = ertekelesek.map((e) => idoSzam(e?.ido)).filter(Boolean).sort((a, b) => a - b);
  const median = i.length ? (i.length % 2 ? i[(i.length - 1) / 2] : (i[i.length / 2 - 1] + i[i.length / 2]) / 2) : null;
  return {
    nehez: n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null,
    nehezDb: n.length,
    ido: median === null ? null : idoKerekit(median),
    idoDb: i.length,
  };
}
