import { test } from "node:test";
import assert from "node:assert/strict";
import { nehezSzam, idoSzam, idoKerekit, osszesit } from "../becsles.js";
import { ujdonsagok } from "../ujdonsag.js";

test("szűrés: rosszindulatú vagy érvénytelen érték → 0", () => {
  assert.equal(nehezSzam("<img src=x onerror=alert(1)>"), 0);
  assert.equal(nehezSzam(7), 0);
  assert.equal(nehezSzam("3"), 3);
  assert.equal(idoSzam(3), 0);              // nincs ilyen időfokozat
  assert.equal(idoSzam("8"), 8);
  assert.equal(idoSzam({ toString: () => "<b>" }), 0);
});

test("összesítés: nehézség átlag, idő medián a legközelebbi fokozatra kerekítve", () => {
  const r = osszesit([{ nehez: 2, ido: 4 }, { nehez: 3, ido: 8 }, { nehez: 5, ido: 52 }, { pont: 9 }]);
  assert.equal(r.nehez, 3.3);
  assert.equal(r.nehezDb, 3);
  assert.equal(r.ido, 8);
  assert.equal(r.idoDb, 3);
  assert.equal(osszesit([{ ido: 4 }, { ido: 8 }]).ido, 4);   // medián 6 → 4 és 8 közül az első a közelebbi-egyenlő
  assert.equal(idoKerekit(10), 8);
});

test("összesítés becslés nélkül: null, nem 0", () => {
  const r = osszesit([{ pont: 5 }, { nehez: "x", ido: -1 }]);
  assert.equal(r.nehez, null);
  assert.equal(r.ido, null);
});

test("újdonság: a csak becslést adó bejegyzés 'becsles' típusú", () => {
  const emberek = { "anna.json": { nev: "Anna", ertekelesek: {
    o1: { kik: "Majmok", mit: "főznek", hol: "űrben", nehez: 3, ido: 8, modositva: "2026-10-14T10:00:00Z" } } } };
  const u = ujdonsagok(emberek, "peti.json", "2026-10-14T09:00:00Z");
  assert.equal(u.length, 1);
  assert.equal(u[0].tipus, "becsles");
});
