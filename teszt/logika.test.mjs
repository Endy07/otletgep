// Futtatás: node --test teszt/
import { test } from "node:test";
import assert from "node:assert/strict";
import { osszefesul, osszefesulTerkep, fajlnevNevbol, keszitTarolo } from "../tarolo.js";
import { otletId } from "../szavak.js";

test("azonos kombináció → azonos ötlet-id, kis-nagybetűtől és szóköztől függetlenül", () => {
  const a = otletId({ kik: "Három majom", mit: "bombát hatástalanítanak", hol: "egy furgonban", csavar: null });
  const b = otletId({ kik: " három  majom", mit: "Bombát hatástalanítanak", hol: "egy furgonban ", csavar: "" });
  const c = otletId({ kik: "Három majom", mit: "bombát hatástalanítanak", hol: "egy furgonban", csavar: "de csak suttogni szabad" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("fájlnév a névből: ékezet nélkül, biztonságos", () => {
  assert.equal(fajlnevNevbol("Péter Ödön"), "peter-odon.json");
  assert.equal(fajlnevNevbol("../../etc"), "etc.json");
  assert.equal(fajlnevNevbol("!!!"), null);
});

test("összefésülés: bejegyzésenként a frissebb nyer, a régi nem írja felül", () => {
  const helyi = { a: { pont: 5, modositva: "2026-10-13T10:00:00Z" }, b: { pont: 1, modositva: "2026-10-13T08:00:00Z" } };
  const tavoli = { a: { pont: 9, modositva: "2026-10-13T09:00:00Z" }, b: { pont: 7, modositva: "2026-10-13T09:00:00Z" }, c: { pont: 3 } };
  const r = osszefesulTerkep(helyi, tavoli);
  assert.equal(r.a.pont, 5);
  assert.equal(r.b.pont, 7);
  assert.equal(r.c.pont, 3);
  const teljes = osszefesul({ nev: "Peti", szavak: {} }, { ertekelesek: tavoli });
  assert.equal(teljes.nev, "Peti");
  assert.equal(teljes.ertekelesek.c.pont, 3);
});

/* --- szimulált GitHub Contents API --- */
function hamisGithub() {
  const fajlok = new Map(); let n = 0;
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  async function fetchImpl(url, opt = {}) {
    const m = url.match(/contents\/adat(?:\/(.+))?$/);
    const valasz = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (!m[1]) return valasz(200, [...fajlok.keys()].map((name) => ({ name, type: "file" })));
    const f = m[1], van = fajlok.get(f);
    if ((opt.method || "GET") === "GET") return van ? valasz(200, { sha: van.sha, content: b64(van.tartalom) }) : valasz(404, {});
    const torzs = JSON.parse(opt.body);
    if (van && torzs.sha !== van.sha) return valasz(409, {});
    if (!van && torzs.sha) return valasz(409, {});
    if (van && !torzs.sha) return valasz(422, {});
    const sha = "s" + ++n;
    fajlok.set(f, { sha, tartalom: Buffer.from(torzs.content, "base64").toString("utf8") });
    return valasz(201, { content: { sha } });
  }
  return { fetchImpl, olvas: (f) => JSON.parse(fajlok.get(f).tartalom) };
}
function tar() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; }

test("két ember: mindenki a sajátját írja, mindenkiét látja", async () => {
  const gh = hamisGithub();
  const peti = keszitTarolo({ repo: "x/y", token: "t", fetchImpl: gh.fetchImpl, tarhely: tar() });
  const anna = keszitTarolo({ repo: "x/y", token: "t", fetchImpl: gh.fetchImpl, tarhely: tar() });
  peti.nevBeallit("peti.json", "Peti");
  peti.modosit("peti.json", "ertekelesek", "o1", { kik: "Majmok", kedvenc: true, pont: 8 });
  assert.deepEqual(await peti.feltolt("peti.json"), { mentve: true });
  anna.nevBeallit("anna.json", "Anna");
  anna.modosit("anna.json", "ertekelesek", "o1", { kik: "Majmok", pont: 6, megjegyzes: "vicces" });
  assert.deepEqual(await anna.feltolt("anna.json"), { mentve: true });
  const r = await peti.mindetBetolt("peti.json");
  assert.equal(r.ok, true);
  assert.equal(r.emberek["anna.json"].ertekelesek.o1.pont, 6);
  assert.equal(r.emberek["peti.json"].ertekelesek.o1.pont, 8);
});

test("ugyanaz az ember két lapon: az ütközés (409) után egyik módosítás sem vész el", async () => {
  const gh = hamisGithub();
  const lap1 = keszitTarolo({ repo: "x/y", token: "t", fetchImpl: gh.fetchImpl, tarhely: tar() });
  const lap2 = keszitTarolo({ repo: "x/y", token: "t", fetchImpl: gh.fetchImpl, tarhely: tar() });
  lap1.modosit("peti.json", "szavak", "w1", { oszlop: "kik", szoveg: "Hattyúk" });
  await lap1.feltolt("peti.json");
  await lap2.mindetBetolt("peti.json");               // lap2 ismeri az sha-t
  lap1.modosit("peti.json", "szavak", "w2", { oszlop: "hol", szoveg: "egy liftben" });
  await lap1.feltolt("peti.json");                    // lap2 sha-ja elavult
  lap2.modosit("peti.json", "szavak", "w3", { oszlop: "mit", szoveg: "táncolnak" });
  assert.deepEqual(await lap2.feltolt("peti.json"), { mentve: true });
  const vegso = gh.olvas("peti.json");
  assert.deepEqual(Object.keys(vegso.szavak).sort(), ["w1", "w2", "w3"]);
});

test("hálózati hiba: nem dob, mentve:false, és a helyi adat megmarad", async () => {
  const tarhely = tar();
  const t = keszitTarolo({ repo: "x/y", token: "t", fetchImpl: async () => { throw new Error("offline"); }, tarhely });
  t.modosit("peti.json", "ertekelesek", "o1", { pont: 9 });
  const r = await t.feltolt("peti.json");
  assert.equal(r.mentve, false);
  assert.equal(t.helyiOlvas("peti.json").ertekelesek.o1.pont, 9);
  const b = await t.mindetBetolt("peti.json");
  assert.equal(b.ok, false);
  assert.equal(b.emberek["peti.json"].ertekelesek.o1.pont, 9);
});
