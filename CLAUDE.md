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
| `szavak.js` | Beépített tárcsa-elemek + `otletId()` (tartalom-hash) |
| `beallit.js` | Repó neve + token 4 darabban (**nem titkosítás**, csak a titok-szkenner ellen) |
| `teszt/logika.test.mjs` | `npm test` — összefésülés, id, fájlnév, szimulált GitHub 409-cel, hálózati hiba |
| `adat/` | **Élő felhasználói adat** — ne töröld, ne írd felül kézzel |

## Adatmodell — `adat/<név>.json`

```json
{ "nev": "Peti",
  "szavak":      { "<id>": { "oszlop": "kik|mit|hol|csavar", "szoveg": "…", "torolve": false, "modositva": "ISO" } },
  "ertekelesek": { "<otletId>": { "kik": "…", "mit": "…", "hol": "…", "csavar": "…|null",
                                  "kedvenc": true, "pont": 0, "megjegyzes": "", "modositva": "ISO" } } }
```
- Közös ötlet = amit legalább egy ember ♥-ezett (`kedvenc: true`). A szöveg az értékelésben utazik.
- Egy embernek ötletenként egy értékelése van; a napló és a közös lista ugyanazt mutatja.
- Törlés: `torolve: true` (különben az összefésülés visszahozná).
- A pörgetésnapló csak a böngészőben van (`localStorage: otletgep:naplo:<fájl>`).

## Szabályok

1. **Push előtt `git pull --rebase`** — a böngészők közvetlenül commitolnak ide.
2. **Más fájljából jövő adat megbízhatatlan**: HTML-be csak `esc()`-en át; pont csak `pontSzam()`-on át;
   szöveg csak `typeof === "string"` után. Új mező = új szűrés + próba `<img onerror>` adattal.
3. A tároló szabályait (`tarolo.js` fejléce) ne lazítsd: helyi tár előbb; hálózati hiba nem dob; a hálózati kör
   UTÁN a friss helyi állapotot fésüld; „nem sikerült" ≠ „üres".
4. A token csak ennek a repónak a Contents jogát kaphatja. Csere: új token → publikálás → ellenőrzés → régi visszavonása.
5. Teszt után az `adat/teszt-*.json` fájlokat töröld.
