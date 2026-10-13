// Párbaj mód: két közös ötlet, melyik a jobb. Mindenki a saját fájljába írja a döntéseit
// (`parbajok: { "<a>|<b>": { a, b, gyoztes, modositva } }`), a rangsor mindenkiéből számolódik.

/** Pár-kulcs: a két id rendezve, így A|B és B|A ugyanaz a párbaj. */
export function parKulcs(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Következő pár a megadott ötlet-idkből. Előnyben: amit ÉN még nem döntöttem el, és ahol kevés
 * meccse van az ötletnek (így minden ötlet sorra kerül). null, ha 2-nél kevesebb ötlet van.
 */
export function kovetkezoPar(idk, sajatParbajok = {}, meccsSzam = {}, veletlen = Math.random) {
  if (idk.length < 2) return null;
  const osszes = [], dontetlen = [];
  for (let i = 0; i < idk.length; i++) {
    for (let j = i + 1; j < idk.length; j++) {
      osszes.push([idk[i], idk[j]]);
      if (!sajatParbajok[parKulcs(idk[i], idk[j])]) dontetlen.push([idk[i], idk[j]]);
    }
  }
  // Ha mindent eldöntöttem, újra jöhetnek a párok (a döntés felülírható).
  const jeloltek = dontetlen.length ? dontetlen : osszes;
  let legjobb = null, legjobbErtek = Infinity;
  for (const p of jeloltek) {
    const ertek = (meccsSzam[p[0]] || 0) + (meccsSzam[p[1]] || 0) + veletlen() * 1.5;
    if (ertek < legjobbErtek) { legjobbErtek = ertek; legjobb = p; }
  }
  return veletlen() < 0.5 ? legjobb : [legjobb[1], legjobb[0]];
}

/**
 * Rangsor mindenki párbajaiból. Pontszám: (győzelmek + 1) / (meccsek + 2) — így egy 1/1-es ötlet
 * nem előzi meg a 9/10-est. Csak a megadott (még közös) ötleteket számolja.
 * Visszaad: { [id]: { gyozelem, meccs, arany } }.
 */
export function rangsor(emberekParbajai, ervenyesIdk) {
  const ervenyes = new Set(ervenyesIdk);
  const r = {};
  for (const id of ervenyes) r[id] = { gyozelem: 0, meccs: 0, arany: 0.5 };
  for (const parbajok of emberekParbajai) {
    for (const p of Object.values(parbajok || {})) {
      if (!p || typeof p.a !== "string" || typeof p.b !== "string") continue;
      if (!ervenyes.has(p.a) || !ervenyes.has(p.b) || (p.gyoztes !== p.a && p.gyoztes !== p.b)) continue;
      r[p.a].meccs++; r[p.b].meccs++; r[p.gyoztes].gyozelem++;
    }
  }
  for (const x of Object.values(r)) x.arany = (x.gyozelem + 1) / (x.meccs + 2);
  return r;
}
