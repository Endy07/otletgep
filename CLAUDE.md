# CLAUDE.md — Közös Ötletgép

Lehetetlen Helyzet Gép, közös változat: https://endy07.github.io/otletgep/ — játékötlet-generátor
(Kik? × Mit csinálnak? × Hol? × Csavar), amit néhány haver közösen bővít, ♥-ez és pontoz 1–10-ig.
Szerver nincs: a böngésző a GitHub Contents API-n írja az `adat/<név>.json` fájlt ebbe a repóba.

A teljes háttér, a döntések indoklása és a hibamentes újraépítés a szülőmappában van:
`../docs/tortenet-es-dontesek.md`, `../docs/runbook-kozos-github-oldal.md`.

## Fájlok

| Fájl | Szerep |
|---|---|
| `index.html` | Felület + stílus (témafüggő tokenek, világos/sötét) |
| `app.js` | Logika: tárcsák, saját elemek, ♥/pont/megjegyzés, közös lista, napló, import/export |
| `tarolo.js` | GitHub-tároló (a Hermes Studio mintájára): helyi tár → hálózat, összefésülés, 409-kezelés |
| `becsles.js` | Nehézség (1–5) és idő (1 hét … 1 év+) szűrése és összesítése (átlag / medián) |
| `szavak.js` | Beépített tárcsa-elemek + `otletId()` (tartalom-hash) |
| `beallit.js` | Repó neve + token 4 darabban (**nem titkosítás**, csak a titok-szkenner ellen) |
| `teszt/logika.test.mjs` | `npm test` — összefésülés, id, fájlnév, szimulált GitHub 409-cel, hálózati hiba |
| `adat/` | **Élő felhasználói adat** — ne töröld, ne írd felül kézzel |

## Adatmodell — `adat/<név>.json`

```json
{ "nev": "Peti",
  "szavak":      { "<id>": { "oszlop": "kik|mit|hol|csavar", "szoveg": "…", "torolve": false, "modositva": "ISO" } },
  "ertekelesek": { "<otletId>": { "kik": "…", "mit": "…", "hol": "…", "csavar": "…|null",
                                  "kedvenc": true, "pont": 0, "megjegyzes": "",
                                  "nehez": 0, "ido": 0, "modositva": "ISO" } },
  "koncepciok":  { "<otletId>": { "pitch": "…", "ige": "…", "klip": "…", "helyszin": "…", "meret": "S|M|L",
                                  "bge": "…", "modositva": "ISO" } },
  "parbajok":    { "<idA>|<idB>": { "a": "<id>", "b": "<id>", "gyoztes": "<id>", "modositva": "ISO" } } }
```
- **Koncepciókártya**: bárki szerkesztheti; mindenki fájljából a legfrissebb `modositva` látszik, szerzővel.
- **Párbaj**: pár-kulcs rendezett (`parKulcs`); rangsor = (győzelem+1)/(meccs+2) mindenki párbajaiból (`parbaj.js`).
- **Újdonságok**: mások bejegyzései a `localStorage: otletgep:latogatas:<fájl>` óta (`ujdonsag.js`); első
  látogatáskor nincs újdonság; a lap elhagyásakor frissül az időbélyeg.
- **Ötlet-link**: `?otlet=<otletId>` → Közös fül, odagörget, kinyitja a kártyát, majd törli a paramétert.
- **Linkelőnézet**: `og:*` meta + `elonezet.png` (forrás: `eszkozok/elonezet.html`, 1200×630). Statikus oldalon
  minden linknek ugyanaz az előnézete; a Messenger gyorsítótáraz, változás után napokig a régit mutathatja.
- **Becslés**: `nehez` 1–5, `ido` hetekben csak a `IDOK` értékei (1, 2, 4, 8, 13, 26, 52); 0 = nincs becslés.
  Közös lista: nehézség átlag, idő medián a legközelebbi fokozatra kerekítve. „Gyors és jó" rendezés:
  átlagpont ÷ log2(idő+1). A koncepciókártya „Méret S/M/L" mezője ettől független, egy közös szöveges címke.
- Közös ötlet = amit legalább egy ember ♥-ezett (`kedvenc: true`). A szöveg az értékelésben utazik.
- Egy embernek ötletenként egy értékelése van; a napló és a közös lista ugyanazt mutatja.
- Törlés: `torolve: true` (különben az összefésülés visszahozná).
- A pörgetésnapló csak a böngészőben van (`localStorage: otletgep:naplo:<fájl>`).

## Szabályok

1. **Commit → `git pull --rebase` → push** — a böngészők közvetlenül commitolnak ide, és a rebase nem commitolt
   változásokkal megtagad.
2. **Más fájljából jövő adat megbízhatatlan**: HTML-be csak `esc()`-en át; pont csak `pontSzam()`-on át, becslés csak `nehezSzam()`/`idoSzam()`-on át;
   szöveg csak `typeof === "string"` után. Új mező = új szűrés + próba `<img onerror>` adattal.
3. A tároló szabályait (`tarolo.js` fejléce) ne lazítsd: helyi tár előbb; hálózati hiba nem dob; a hálózati kör
   UTÁN a friss helyi állapotot fésüld; „nem sikerült" ≠ „üres".
4. A token csak ennek a repónak a Contents jogát kaphatja. Csere: új token → publikálás → ellenőrzés → régi visszavonása.
5. Teszt után az `adat/teszt-*.json` fájlokat töröld — de előbb hagyd el a lapot és töröld a helyi tárat
   (`otletgep:*`), különben a nyitott lap visszatölti őket. A localhost-változat is az éles repóba ír.
6. Gépelés közben ne rajzold újra a listát (`renderKozos` kihagyja, ha input/textarea/select fókuszban van), és a
   `focusout` utáni újrarajzolás késleltetett (400 ms) — különben a mezőből egy gombra kattintás elveszik.
   Az Elemek fül (`renderElemek`) ugyanígy kihagyja, ha az űrlap mezője fókuszban van és nem üres.
7. **Mobilnézet** (≤640 px, egyetlen `@media` blokk az `index.html` végén): a gépház egy képernyő (2×2 kártya,
   alul csillagok + ♡ · Pörgetés · Csavar), a fejléc a lap aljára kerül (`order:99`), a megjegyzés, Másolás, súgó
   és a tárcsák alatti mondat rejtve. Gombokban a szöveg `<span class="txt">` (mobilon rejtve) + `aria-label`.
   Saját elem: `addFormHtml(k)` + `elemHozzaad` — a tárcsán (asztali) és az Elemek fülön (mindig). Új vezérlő a
   gépházba csak úgy, hogy 360×640-en is kiférjen. Részletek: `../docs/runbook-kozos-github-oldal.md` 10. pont.
8. **Felület-próba élesírás nélkül**: Playwrightban `context.route(/api\.github\.com/, r => r.abort())`, a végén
   `localStorage.clear()` (runbook 7/6.).
