import { test } from "node:test";
import assert from "node:assert/strict";
import { parKulcs, kovetkezoPar, rangsor } from "../parbaj.js";
import { ujdonsagok } from "../ujdonsag.js";
import { osszefesul } from "../tarolo.js";

test("pár-kulcs független a sorrendtől", () => {
  assert.equal(parKulcs("o2", "o1"), parKulcs("o1", "o2"));
});

test("következő pár: kevesebb mint 2 ötletnél null; a már eldöntött párt kerüli", () => {
  assert.equal(kovetkezoPar(["o1"]), null);
  const sajat = { [parKulcs("o1", "o2")]: { gyoztes: "o1" }, [parKulcs("o1", "o3")]: { gyoztes: "o3" } };
  for (let i = 0; i < 20; i++) {
    const p = kovetkezoPar(["o1", "o2", "o3"], sajat);
    assert.equal(parKulcs(p[0], p[1]), parKulcs("o2", "o3"));
  }
});

test("következő pár: ha mindent eldöntöttem, akkor is ad párt", () => {
  const sajat = { [parKulcs("o1", "o2")]: { gyoztes: "o1" } };
  assert.ok(kovetkezoPar(["o1", "o2"], sajat));
});

test("rangsor: mindenki párbaja számít, a 9/10 megelőzi az 1/1-et, a hibás bejegyzés kimarad", () => {
  const peti = {}, anna = {};
  for (let i = 0; i < 9; i++) peti["x" + i] = { a: "A", b: "C", gyoztes: "A" };
  anna.y = { a: "A", b: "C", gyoztes: "C" };
  anna.z = { a: "B", b: "C", gyoztes: "B" };
  anna.rossz = { a: "B", b: "nincs", gyoztes: "B" };
  anna.rossz2 = { a: "<img>", b: 5, gyoztes: "x" };
  const r = rangsor([peti, anna], ["A", "B", "C"]);
  assert.equal(r.A.meccs, 10); assert.equal(r.A.gyozelem, 9);
  assert.equal(r.B.meccs, 1);
  assert.ok(r.A.arany > r.B.arany);
});

test("újdonságok: csak mások változásai a látogatás óta; első látogatáskor üres", () => {
  const emberek = {
    "en.json": { nev: "Én", szavak: { w: { oszlop: "kik", szoveg: "Saját", modositva: "2026-10-13T12:00:00Z" } } },
    "peti.json": {
      nev: "Peti",
      szavak: { w1: { oszlop: "kik", szoveg: "Hattyúk", modositva: "2026-10-13T12:00:00Z" },
                w0: { oszlop: "kik", szoveg: "Régi", modositva: "2026-10-12T00:00:00Z" },
                wt: { oszlop: "kik", szoveg: "Törölt", torolve: true, modositva: "2026-10-13T12:00:00Z" } },
      ertekelesek: { o1: { kik: "A", mit: "B", hol: "C", kedvenc: true, modositva: "2026-10-13T13:00:00Z" } },
      koncepciok: { o1: { pitch: "Bomba!", modositva: "2026-10-13T14:00:00Z" } },
    },
  };
  assert.deepEqual(ujdonsagok(emberek, "en.json", ""), []);
  const u = ujdonsagok(emberek, "en.json", "2026-10-13T00:00:00Z");
  assert.deepEqual(u.map((x) => x.tipus), ["koncepcio", "kedvenc", "elem"]);
  assert.ok(u.every((x) => x.nev === "Peti"));
});

test("régi fájl (koncepciok/parbajok nélkül) összefésülése nem hibázik", () => {
  const r = osszefesul({ nev: "Peti", szavak: {} }, { ertekelesek: {} });
  assert.deepEqual(r.koncepciok, {});
  assert.deepEqual(r.parbajok, {});
});
