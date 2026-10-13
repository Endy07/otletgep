// Újdonságok: mi történt a MÁSOK fájljaiban a legutóbbi látogatásom óta. Tiszta függvény, tesztelhető.

const str = (v) => (typeof v === "string" ? v : "");

/**
 * @param emberek  { fajl: { nev, szavak, ertekelesek, koncepciok } }
 * @param sajatFajl a saját fájl (azt kihagyjuk)
 * @param mióta    ISO időbélyeg; üres = első látogatás → nincs újdonság (különben minden "új" lenne)
 * @returns rendezett lista: [{ ido, nev, tipus, szoveg, otletId? }], legújabb elöl
 */
export function ujdonsagok(emberek, sajatFajl, miota) {
  if (!miota) return [];
  const out = [];
  for (const [f, d] of Object.entries(emberek)) {
    if (f === sajatFajl || !d) continue;
    const nev = str(d.nev) || f.replace(/\.json$/, "");
    for (const w of Object.values(d.szavak || {})) {
      const ido = str(w?.modositva);
      if (ido > miota && !w.torolve && str(w.szoveg)) out.push({ ido, nev, tipus: "elem", szoveg: str(w.szoveg) });
    }
    for (const [id, e] of Object.entries(d.ertekelesek || {})) {
      const ido = str(e?.modositva);
      if (!(ido > miota) || !str(e.kik)) continue;
      const cim = `${str(e.kik)} ${str(e.mit)} ${str(e.hol)}`;
      if (e.kedvenc === true) out.push({ ido, nev, tipus: "kedvenc", szoveg: cim, otletId: id });
      else if (Number(e.pont) > 0 || str(e.megjegyzes).trim()) out.push({ ido, nev, tipus: "pont", szoveg: cim, otletId: id });
      else if (Number(e.nehez) > 0 || Number(e.ido) > 0) out.push({ ido, nev, tipus: "becsles", szoveg: cim, otletId: id });
    }
    for (const [id, k] of Object.entries(d.koncepciok || {})) {
      const ido = str(k?.modositva);
      if (ido > miota) out.push({ ido, nev, tipus: "koncepcio", szoveg: str(k.pitch) || "koncepció", otletId: id });
    }
  }
  return out.sort((a, b) => b.ido.localeCompare(a.ido));
}
