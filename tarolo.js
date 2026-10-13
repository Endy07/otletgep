/**
 * Tároló-réteg (a Hermes Studio `webes/kozos/tarolo.js` mintájára).
 *
 * Mindenki a SAJÁT fájlját írja: adat/<nev>.json. Mindenkiét olvassa.
 * Két szabály, amitől semmi nem veszhet el:
 *  1. minden mentés ELŐSZÖR a helyi tárba megy, és csak utána a hálózatra;
 *  2. hálózati hiba sosem dob kivételt, csak `mentve: false`-t ad vissza.
 */

const API = "https://api.github.com/repos";
const MAX_PROBALKOZAS = 3;
export const TERKEPEK = ["szavak", "ertekelesek", "koncepciok", "parbajok"];

function base64Kodol(szoveg) {
  const bajtok = new TextEncoder().encode(szoveg);
  let bin = "";
  for (const b of bajtok) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64Dekodol(base64) {
  const nyers = atob(base64.replace(/\n/g, ""));
  const bajtok = Uint8Array.from(nyers, (k) => k.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bajtok);
}

/** Bejegyzésenként a frissebb `modositva` nyer. Időbélyeg nélküli saját rekordot nem dobunk el. */
export function osszefesulTerkep(sajat = {}, tavoli = {}) {
  const eredmeny = { ...tavoli };
  for (const [kulcs, sajatErtek] of Object.entries(sajat)) {
    const tavoliErtek = tavoli[kulcs];
    const sajatNyer = !tavoliErtek || !sajatErtek?.modositva || sajatErtek.modositva >= (tavoliErtek.modositva ?? "");
    if (sajatNyer) eredmeny[kulcs] = sajatErtek;
  }
  return eredmeny;
}

export function osszefesul(sajat = {}, tavoli = {}) {
  const eredmeny = { nev: sajat.nev || tavoli.nev };
  for (const t of TERKEPEK) eredmeny[t] = osszefesulTerkep(sajat[t], tavoli[t]);
  return eredmeny;
}

/** Fájlnév a névből: kisbetű, ékezet nélkül, csak [a-z0-9-]. */
export function fajlnevNevbol(nev) {
  const slug = nev.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug ? `${slug}.json` : null;
}

export function keszitTarolo({ repo, token, fetchImpl = fetch, tarhely = localStorage }) {
  const shaCache = new Map();
  const fejlec = { Authorization: `token ${token}`, Accept: "application/vnd.github+json" };
  const helyiKulcs = (f) => `otletgep:${f}`;

  function helyiOlvas(f) {
    try { return JSON.parse(tarhely.getItem(helyiKulcs(f)) ?? "{}"); } catch { return {}; }
  }
  function helyiIr(f, adat) {
    try { tarhely.setItem(helyiKulcs(f), JSON.stringify(adat)); } catch { /* tiltott vagy teli helyi tár */ }
  }

  /** {adat, ok}: ok=false, ha a hálózat vagy a GitHub hibázott (NEM ugyanaz, mint az üres fájl). */
  async function tavoliOlvas(f) {
    let valasz;
    try {
      valasz = await fetchImpl(`${API}/${repo}/contents/adat/${f}`, { headers: fejlec, cache: "no-store" });
    } catch { return { adat: {}, ok: false, hiba: "nincs hálózat" }; }
    if (valasz.status === 404) { shaCache.delete(f); return { adat: {}, ok: true }; }
    if (!valasz.ok) return { adat: {}, ok: false, hiba: `GitHub ${valasz.status}` };
    try {
      const torzs = await valasz.json();
      if (torzs?.sha) shaCache.set(f, torzs.sha);
      return { adat: JSON.parse(base64Dekodol(torzs.content)), ok: true };
    } catch { return { adat: {}, ok: false, hiba: "sérült fájl" }; }
  }

  async function tavoliIr(f, adat) {
    const torzs = { message: `Mentés: ${f}`, content: base64Kodol(JSON.stringify(adat, null, 2)) };
    const sha = shaCache.get(f);
    if (sha) torzs.sha = sha;
    const valasz = await fetchImpl(`${API}/${repo}/contents/adat/${f}`, {
      method: "PUT", headers: { ...fejlec, "Content-Type": "application/json" }, body: JSON.stringify(torzs),
    });
    if (valasz.ok) {
      let ujSha;
      try { ujSha = (await valasz.json())?.content?.sha; } catch { ujSha = undefined; }
      if (ujSha) shaCache.set(f, ujSha); else shaCache.delete(f);
    }
    return valasz;
  }

  /** Az összes fájl listája az adat/ mappában. null = nem sikerült lekérni (nem üres!). */
  async function listaz() {
    try {
      const v = await fetchImpl(`${API}/${repo}/contents/adat`, { headers: fejlec, cache: "no-store" });
      if (v.status === 404) return [];
      if (!v.ok) return null;
      const lista = await v.json();
      return lista.filter((x) => x.type === "file" && x.name.endsWith(".json")).map((x) => x.name);
    } catch { return null; }
  }

  /** Mindenki fájlja; a sajátot a helyivel összefésülve. {emberek: {fajl: adat}, ok, hiba} */
  async function mindetBetolt(sajatFajl) {
    const fajlok = await listaz();
    if (fajlok === null) {
      return { emberek: { [sajatFajl]: osszefesul(helyiOlvas(sajatFajl), {}) }, ok: false, hiba: "a GitHub nem érhető el", sajatValtozott: false };
    }
    if (!fajlok.includes(sajatFajl)) fajlok.push(sajatFajl);
    const emberek = {};
    let ok = true, hiba = "", sajatTavoli = {};
    await Promise.all(fajlok.map(async (f) => {
      const r = await tavoliOlvas(f);
      if (!r.ok) { ok = false; hiba = r.hiba; }
      if (f === sajatFajl) sajatTavoli = r.adat; else emberek[f] = r.adat;
    }));
    // A saját fájlt a hálózati kör UTÁN fésüljük a FRISS helyi állapottal: a várakozás alatt
    // a felhasználó módosíthatott, és egy korábbi pillanatkép azt némán felülírná.
    emberek[sajatFajl] = osszefesul(helyiOlvas(sajatFajl), sajatTavoli);
    helyiIr(sajatFajl, emberek[sajatFajl]);
    const sajatValtozott = JSON.stringify(emberek[sajatFajl]) !== JSON.stringify(osszefesul({}, sajatTavoli));
    return { emberek, ok, hiba, sajatValtozott };
  }

  async function feltolt(f) {
    for (let p = 0; p < MAX_PROBALKOZAS; p += 1) {
      try {
        if (!shaCache.has(f)) {
          // Különben egy létező fájlt sha nélkül írnánk felül (422/409), vagy elavult képpel.
          const r = await tavoliOlvas(f);
          if (!r.ok) return { mentve: false, hiba: r.hiba };
          helyiIr(f, osszefesul(helyiOlvas(f), r.adat));
        }
        const valasz = await tavoliIr(f, helyiOlvas(f));
        if (valasz.ok) return { mentve: true };
        if (valasz.status === 409 || valasz.status === 422) {
          // A kör UTÁNI friss helyi állapotot fésüljük, sosem az indításkori pillanatképet.
          shaCache.delete(f);
          continue;
        }
        return { mentve: false, hiba: `GitHub ${valasz.status}` };
      } catch {
        return { mentve: false, hiba: "nincs hálózat" };
      }
    }
    return { mentve: false, hiba: "ütközés, 3 próba után sem sikerült" };
  }

  /** Egy bejegyzés módosítása a saját fájlban (helyben azonnal; a feltöltés külön, gyűjtve). */
  function modosit(f, terkep, id, ertek) {
    const adat = helyiOlvas(f);
    adat[terkep] = adat[terkep] || {};
    adat[terkep][id] = { ...adat[terkep][id], ...ertek, modositva: new Date().toISOString() };
    helyiIr(f, adat);
    return adat;
  }

  function nevBeallit(f, nev) {
    const adat = helyiOlvas(f);
    if (adat.nev !== nev) { adat.nev = nev; helyiIr(f, adat); }
  }

  return { mindetBetolt, feltolt, modosit, nevBeallit, helyiOlvas };
}
