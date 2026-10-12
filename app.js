import { ALAP, otletId } from "./szavak.js";
import { keszitTarolo, fajlnevNevbol, osszefesul } from "./tarolo.js";
import { BEALLIT } from "./beallit.js";

const KEYS = ["kik", "mit", "hol", "csavar"];
const LABELS = { kik: "Kik?", mit: "Mit csinálnak?", hol: "Hol?", csavar: "Csavar" };
const PAGE = 100;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
// A többiek fájljából jövő pont bármi lehet (a token nyilvános): mindig 0–10 egész számmá alakítjuk,
// mielőtt HTML-be kerül, különben egy "pont": "<img onerror=…>" kódot futtatna a többiek böngészőjében.
const pontSzam = (v) => { const n = Math.round(Number(v)); return n >= 1 && n <= 10 ? n : 0; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const tarolo = keszitTarolo({ repo: BEALLIT.repo, token: (BEALLIT.darabok || []).join("") });

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* tiltott helyi tár */ } }

/* ---------- állapot ---------- */
let nev = null, fajl = null;
let emberek = {};          // fájlnév → { nev, szavak, ertekelesek }
let naplo = [];            // saját pörgetések, legújabb elöl (csak ebben a böngészőben)
const cur = { kik: "Három majom", mit: "bombát hatástalanítanak", hol: "egy furgonban", csavar: "" };
const locked = { kik: false, mit: false, hol: false, csavar: false };
let twistOn = false, spinning = false, shown = PAGE, tab = "kozos";

const sajat = () => emberek[fajl] || osszefesul({}, {});
const nevOf = (f) => (typeof emberek[f]?.nev === "string" && emberek[f].nev.trim() ? emberek[f].nev.slice(0, 30) : f.replace(/\.json$/, ""));
const activeKeys = () => (twistOn ? KEYS : KEYS.slice(0, 3));
const curIdea = () => ({ kik: cur.kik, mit: cur.mit, hol: cur.hol, csavar: twistOn ? cur.csavar : null });
const enErtekelesem = (id) => sajat().ertekelesek?.[id] || null;
const htmlOf = (o) => `<b>${esc(o.kik)}</b> ${esc(o.mit)} <b>${esc(o.hol)}</b>${o.csavar ? ", " + esc(o.csavar) : ""}.`;
const textOf = (o) => `${o.kik} ${o.mit} ${o.hol}${o.csavar ? ", " + o.csavar : ""}.`;

/* ---------- elemek (beépített + haverok sajátjai) ---------- */
function sajatElemek(oszlop) {
  const out = [];
  for (const [f, d] of Object.entries(emberek)) {
    for (const [id, w] of Object.entries(d.szavak || {})) {
      if (w && !w.torolve && w.oszlop === oszlop && typeof w.szoveg === "string" && w.szoveg.trim()) {
        out.push({ id, f, szoveg: w.szoveg.slice(0, 120), szerzo: String(nevOf(f)), modositva: String(w.modositva || "") });
      }
    }
  }
  return out;
}
function keszlet(oszlop) {
  const lattuk = new Set(), out = [];
  for (const s of [...ALAP[oszlop], ...sajatElemek(oszlop).map((w) => w.szoveg)]) {
    const k = s.trim().toLowerCase();
    if (!lattuk.has(k)) { lattuk.add(k); out.push(s); }
  }
  return out;
}
function szerzoje(oszlop, szoveg) {
  const k = szoveg.trim().toLowerCase();
  if (ALAP[oszlop].some((s) => s.toLowerCase() === k)) return null;
  return sajatElemek(oszlop).find((w) => w.szoveg.trim().toLowerCase() === k)?.szerzo || null;
}
function pick(oszlop, kerul) {
  const a = keszlet(oszlop);
  let v;
  do { v = a[Math.floor(Math.random() * a.length)]; } while (a.length > 1 && v === kerul);
  return v;
}

/* ---------- mentés ---------- */
function setStatus(text, cls) { const s = $("status"); s.textContent = text; s.className = "status" + (cls ? " " + cls : ""); }
let lanc = Promise.resolve(), mentesTimer = null, ujraTimer = null;
function mentes() {
  if (!(BEALLIT.darabok || []).length) { setStatus("Nincs beállítva a mentés (token); minden csak helyben marad", "bad"); return; }
  setStatus("Mentés…");
  clearTimeout(mentesTimer);
  mentesTimer = setTimeout(() => {
    lanc = lanc.then(async () => {
      const r = await tarolo.feltolt(fajl);
      clearTimeout(ujraTimer);
      if (r.mentve) setStatus("GitHubra mentve", "ok");
      else {
        setStatus(`Csak ebben a böngészőben mentve (${r.hiba}); újrapróbálom`, "bad");
        ujraTimer = setTimeout(mentes, 30000);
      }
    });
  }, 800);
}
function modosit(terkep, id, ertek) {
  emberek[fajl] = osszefesul(tarolo.modosit(fajl, terkep, id, ertek), {});
  mentes();
}
function ertekel(o, patch) {
  modosit("ertekelesek", otletId(o), { kik: o.kik, mit: o.mit, hol: o.hol, csavar: o.csavar || null, ...patch });
  renderAll();
}

let frissitesFut = false;
async function frissit() {
  if (frissitesFut || !fajl || !(BEALLIT.darabok || []).length) return;
  frissitesFut = true;
  const r = await tarolo.mindetBetolt(fajl);
  frissitesFut = false;
  emberek = r.emberek;
  if (!r.ok) setStatus(`A közös adat nem érhető el (${r.hiba}); a változásaid helyben megmaradnak`, "bad");
  else if (r.sajatValtozott) mentes();
  else setStatus("GitHubra mentve", "ok");
  renderAll();
}

/* ---------- név ---------- */
function nevBeallit(uj) {
  const f = fajlnevNevbol(uj);
  if (!f) return false;
  nev = uj.trim(); fajl = f;
  lsSet("otletgep:nev", nev);
  const u = new URL(location.href); u.searchParams.set("nev", nev); history.replaceState(null, "", u);
  tarolo.nevBeallit(fajl, nev);
  naplo = lsGet(`otletgep:naplo:${fajl}`, []);
  $("me").textContent = nev;
  return true;
}
function nevKeres() { $("name-overlay").hidden = false; $("name-input").value = nev || ""; $("name-input").focus(); }
$("name-form").onsubmit = async (ev) => {
  ev.preventDefault();
  if (!nevBeallit($("name-input").value)) { toast("Írj be egy nevet betűkkel vagy számokkal"); return; }
  $("name-overlay").hidden = true;
  emberek = { [fajl]: osszefesul(tarolo.helyiOlvas(fajl), {}) };
  renderAll();
  await frissit();
};
$("rename").onclick = nevKeres;

/* ---------- tárcsák ---------- */
function buildReels() {
  const root = $("reels");
  root.className = "reels" + (twistOn ? " has-twist" : "");
  root.innerHTML = "";
  for (const k of activeKeys()) {
    const el = document.createElement("div");
    el.className = "reel" + (locked[k] ? " locked" : "");
    el.innerHTML = `<div><span class="label">${LABELS[k]}</span></div>
      <div class="value" id="val-${k}"></div>
      <div class="reel-actions">
        <button class="chip" data-lock="${k}" aria-pressed="${locked[k]}">${locked[k] ? "🔒 Zárolva" : "Zárolás"}</button>
        <button class="chip" data-one="${k}">Csak ezt</button>
      </div>
      <form class="add" data-add="${k}">
        <input id="add-${k}" maxlength="80" placeholder="+ Saját elem…" aria-label="Saját elem: ${LABELS[k]}">
        <button class="chip" type="submit">Hozzáad</button>
      </form>`;
    root.appendChild(el);
    showValue(k);
  }
}
function showValue(k, szoveg = cur[k], porog = false) {
  const el = $("val-" + k);
  if (!el) return;
  const by = porog ? null : szerzoje(k, szoveg);
  el.innerHTML = esc(szoveg) + (by ? `<span class="by">— ${esc(by)} eleme</span>` : "");
}
$("reels").addEventListener("click", (ev) => {
  const lock = ev.target.closest("[data-lock]")?.dataset.lock;
  if (lock) { locked[lock] = !locked[lock]; buildReels(); return; }
  const one = ev.target.closest("[data-one]")?.dataset.one;
  if (one) spin([one]);
});
$("reels").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const k = ev.target.dataset.add, inp = $("add-" + k);
  const szoveg = inp.value.trim().replace(/\s+/g, " ");
  if (!szoveg) return;
  const mar = keszlet(k).find((s) => s.toLowerCase() === szoveg.toLowerCase());
  if (mar) { toast("Ez már benne van a tárcsában"); cur[k] = mar; }
  else {
    modosit("szavak", "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), { oszlop: k, szoveg, torolve: false });
    cur[k] = szoveg;
    toast("Hozzáadva — a többiek is látják");
  }
  inp.value = "";
  rogzit();
  buildReels(); renderAll();
});

function rogzit() {
  naplo.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ido: new Date().toISOString(), ...curIdea() });
  lsSet(`otletgep:naplo:${fajl}`, naplo);
}

function spin(keys) {
  if (spinning) return;
  keys = keys || activeKeys().filter((k) => !locked[k]);
  if (!keys.length) { toast("Minden tárcsa zárolva"); return; }
  const kesz = () => { rogzit(); renderAll(); };
  if (reduce) { keys.forEach((k) => { cur[k] = pick(k, cur[k]); showValue(k); }); kesz(); return; }
  spinning = true;
  keys.forEach((k, i) => {
    const el = $("val-" + k); el.classList.add("spinning");
    const stopAt = performance.now() + 550 + i * 260;
    const tick = () => {
      if (performance.now() < stopAt) { showValue(k, pick(k), true); setTimeout(tick, 55); }
      else {
        cur[k] = pick(k, cur[k]); showValue(k); el.classList.remove("spinning");
        if (i === keys.length - 1) { spinning = false; kesz(); }
      }
    };
    tick();
  });
}

function betolt(o) {
  cur.kik = o.kik; cur.mit = o.mit; cur.hol = o.hol;
  twistOn = !!o.csavar; $("twist").checked = twistOn;
  if (o.csavar) cur.csavar = o.csavar;
  buildReels(); renderAll();
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/* ---------- csillagok ---------- */
function starsHtml(value) {
  value = pontSzam(value);
  let h = "";
  for (let n = 1; n <= 10; n++) h += `<button class="star${n <= value ? " on" : ""}" data-star="${n}" aria-label="${n} pont">★<small>${n}</small></button>`;
  return h + `<span class="score">${value ? value + "/10" : "–/10"}</span>`;
}

/* ---------- aktuális ötlet ---------- */
function renderCurrent() {
  const o = curIdea(), e = enErtekelesem(otletId(o));
  $("pitch").innerHTML = htmlOf(o);
  $("cur-stars").innerHTML = starsHtml(e?.pont || 0);
  if (document.activeElement !== $("cur-note")) $("cur-note").value = e?.megjegyzes || "";
  const fav = !!e?.kedvenc;
  $("fav").textContent = fav ? "♥ Kedvenc (megosztva)" : "♡ Kedvenc & megosztás";
  $("fav").setAttribute("aria-pressed", String(fav));
}
$("cur-stars").onclick = (ev) => {
  const b = ev.target.closest("[data-star]"); if (!b) return;
  const o = curIdea(), n = +b.dataset.star, regi = enErtekelesem(otletId(o))?.pont || 0;
  ertekel(o, { pont: regi === n ? 0 : n });
};
let jegyzetTimer;
$("cur-note").oninput = (ev) => {
  const o = curIdea(), v = ev.target.value;
  clearTimeout(jegyzetTimer);
  jegyzetTimer = setTimeout(() => ertekel(o, { megjegyzes: v }), 400);
};
$("fav").onclick = () => {
  const o = curIdea(), most = !enErtekelesem(otletId(o))?.kedvenc;
  ertekel(o, { kedvenc: most });
  toast(most ? "Megosztva a többiekkel" : "Kivetted a kedvencek közül");
};

/* ---------- közös ötletek ---------- */
function kozosOtletek() {
  const map = new Map();
  for (const [f, d] of Object.entries(emberek)) {
    for (const [id, e] of Object.entries(d.ertekelesek || {})) {
      if (!e || typeof e.kik !== "string" || typeof e.mit !== "string" || typeof e.hol !== "string") continue;
      let o = map.get(id);
      if (!o) { o = { id, kik: e.kik, mit: e.mit, hol: e.hol, csavar: typeof e.csavar === "string" ? e.csavar : null, szivek: [], pontok: [], utolso: "" }; map.set(id, o); }
      const modositva = String(e.modositva || "");
      if (e.kedvenc === true) { o.szivek.push(String(nevOf(f))); if (modositva > o.utolso) o.utolso = modositva; }
      const pont = pontSzam(e.pont), megjegyzes = typeof e.megjegyzes === "string" ? e.megjegyzes : "";
      if (pont > 0 || megjegyzes.trim()) o.pontok.push({ nev: String(nevOf(f)), pont, megjegyzes, en: f === fajl });
    }
  }
  const lista = [...map.values()].filter((o) => o.szivek.length);
  for (const o of lista) {
    const p = o.pontok.filter((x) => x.pont > 0).map((x) => x.pont);
    o.atlag = p.length ? Math.round((p.reduce((a, b) => a + b, 0) / p.length) * 10) / 10 : null;
    o.db = p.length;
  }
  const s = $("kozos-sort").value;
  lista.sort((a, b) =>
    s === "hearts" ? b.szivek.length - a.szivek.length || (b.atlag ?? 0) - (a.atlag ?? 0)
    : s === "new" ? b.utolso.localeCompare(a.utolso)
    : (b.atlag ?? -1) - (a.atlag ?? -1) || b.szivek.length - a.szivek.length);
  return lista;
}
function renderKozos() {
  const ul = $("kozos");
  if (ul.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return; // gépelés közben ne rajzoljuk újra
  const lista = kozosOtletek();
  const emberSzam = Object.keys(emberek).length;
  $("kozos-count").textContent = `${lista.length} közös ötlet · ${emberSzam} játékos`;
  ul.innerHTML = "";
  if (!lista.length) { ul.innerHTML = `<li class="empty">Még senki nem osztott meg ötletet. Pörgess, és ha tetszik, nyomd meg a ♡ gombot: az ötlet ide kerül, és a többiek is pontozhatják.</li>`; return; }
  const curId = otletId(curIdea());
  for (const o of lista) {
    const en = enErtekelesem(o.id);
    const li = document.createElement("li");
    li.className = "entry" + (o.id === curId ? " current" : "");
    li.dataset.id = o.id;
    const szavazatok = o.pontok.map((p) => `<div class="vote"><span class="n">${esc(p.nev)}${p.en ? " (te)" : ""}</span><span class="p">${p.pont ? p.pont + "/10" : "–"}</span><span class="m">${esc(p.megjegyzes)}</span></div>`).join("");
    li.innerHTML = `<div class="entry-top">
        <div class="entry-text">${htmlOf(o)}<div class="hearts">♥ ${esc(o.szivek.join(", "))}</div></div>
        <div class="avg">${o.atlag ?? "–"}<small>${o.db ? `átlag, ${o.db} pontozó` : "még nincs pont"}</small></div>
      </div>
      ${szavazatok ? `<div class="votes">${szavazatok}</div>` : ""}
      <div class="entry-tools">
        <span class="stars">${starsHtml(en?.pont || 0)}</span>
        <button class="chip heart" data-act="fav" aria-pressed="${!!en?.kedvenc}">${en?.kedvenc ? "♥ Kedvencem" : "♡ Kedvelem"}</button>
        <button class="chip" data-act="load">Betöltés a gépbe</button>
      </div>
      <textarea data-note placeholder="A te megjegyzésed (a többiek is látják)…" aria-label="Megjegyzésed"></textarea>`;
    li.querySelector("textarea").value = en?.megjegyzes || "";
    ul.appendChild(li);
  }
}

/* ---------- saját napló ---------- */
function naploSzurt() {
  const q = $("q").value.trim().toLowerCase(), f = $("filter").value;
  let list = naplo.map((n) => ({ ...n, e: enErtekelesem(otletId(n)) || {} })).filter((n) => {
    if (f === "fav" && !n.e.kedvenc) return false;
    if (f === "rated" && !n.e.pont) return false;
    if (f === "top" && !(n.e.pont >= 8)) return false;
    if (f === "noted" && !(n.e.megjegyzes || "").trim()) return false;
    return !q || (textOf(n) + " " + (n.e.megjegyzes || "")).toLowerCase().includes(q);
  });
  if ($("sort").value === "score") list = list.sort((a, b) => (b.e.pont || 0) - (a.e.pont || 0) || b.ido.localeCompare(a.ido));
  return list;
}
const fmt = (iso) => new Date(iso).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function renderNaplo() {
  const ul = $("naplo");
  if (ul.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;
  const list = naploSzurt();
  $("naplo-count").textContent = list.length === naplo.length ? `${naplo.length} pörgetés (csak ebben a böngészőben)` : `${list.length} / ${naplo.length}`;
  ul.innerHTML = "";
  if (!list.length) { ul.innerHTML = `<li class="empty">${naplo.length ? "Nincs találat ezzel a szűréssel." : "Még nincs pörgetés. Minden pörgetésed ide kerül."}</li>`; $("more").hidden = true; return; }
  const curId = otletId(curIdea());
  for (const n of list.slice(0, shown)) {
    const li = document.createElement("li");
    li.className = "entry" + (otletId(n) === curId ? " current" : "");
    li.dataset.nid = n.id;
    li.innerHTML = `<div class="entry-top">
        <div class="entry-text">${htmlOf(n)}</div>
        <div class="entry-tools">
          <span class="stars">${starsHtml(n.e.pont || 0)}</span>
          <button class="chip heart" data-act="fav" aria-pressed="${!!n.e.kedvenc}">${n.e.kedvenc ? "♥" : "♡"}</button>
          <button class="chip" data-act="load">Betöltés</button>
          <button class="chip" data-act="del">Törlés</button>
        </div>
      </div>
      <textarea data-note placeholder="Megjegyzés…" aria-label="Megjegyzés"></textarea>
      <span class="meta">${fmt(n.ido)}</span>`;
    li.querySelector("textarea").value = n.e.megjegyzes || "";
    ul.appendChild(li);
  }
  $("more").hidden = list.length <= shown;
}

/* listák közös kezelése: csillag, ♥, betöltés, megjegyzés */
function otletALista(li) {
  if (li.dataset.nid) return naplo.find((n) => n.id === li.dataset.nid);
  return kozosOtletek().find((o) => o.id === li.dataset.id);
}
for (const id of ["kozos", "naplo"]) {
  $(id).addEventListener("click", (ev) => {
    const li = ev.target.closest(".entry"); if (!li) return;
    const o = otletALista(li); if (!o) return;
    const idea = { kik: o.kik, mit: o.mit, hol: o.hol, csavar: o.csavar || null };
    const en = enErtekelesem(otletId(idea));
    const star = ev.target.closest("[data-star]");
    if (star) { const n = +star.dataset.star; ertekel(idea, { pont: (en?.pont || 0) === n ? 0 : n }); return; }
    const b = ev.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "fav") ertekel(idea, { kedvenc: !en?.kedvenc });
    if (b.dataset.act === "load") betolt(idea);
    if (b.dataset.act === "del") {
      if (b.dataset.armed) { naplo = naplo.filter((n) => n.id !== o.id); lsSet(`otletgep:naplo:${fajl}`, naplo); renderNaplo(); }
      else {
        b.dataset.armed = "1"; b.textContent = "Biztos?"; b.classList.add("danger");
        setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "Törlés"; b.classList.remove("danger"); } }, 2500);
      }
    }
  });
  const noteTimers = new Map();
  $(id).addEventListener("input", (ev) => {
    if (!ev.target.matches("[data-note]")) return;
    const li = ev.target.closest(".entry"), o = otletALista(li); if (!o) return;
    const idea = { kik: o.kik, mit: o.mit, hol: o.hol, csavar: o.csavar || null }, v = ev.target.value, k = otletId(idea);
    clearTimeout(noteTimers.get(k));
    noteTimers.set(k, setTimeout(() => {
      emberek[fajl] = osszefesul(tarolo.modosit(fajl, "ertekelesek", k, { ...idea, megjegyzes: v }), {});
      mentes(); renderCurrent();
    }, 400));
  });
  $(id).addEventListener("focusout", () => setTimeout(renderAll, 0));
}

/* ---------- elemek fül ---------- */
function renderElemek() {
  const root = $("words"); root.innerHTML = "";
  for (const k of KEYS) {
    const lista = sajatElemek(k).sort((a, b) => b.modositva.localeCompare(a.modositva));
    const col = document.createElement("div"); col.className = "wordcol";
    col.innerHTML = `<span class="label">${LABELS[k]}</span>` + (lista.length
      ? `<ul>${lista.map((w) => `<li><span>${esc(w.szoveg)}</span><em>${esc(w.szerzo)}</em>${w.f === fajl ? `<button class="chip" data-delword="${w.id}">Törlés</button>` : ""}</li>`).join("")}</ul>`
      : `<span class="empty">Még nincs saját elem.</span>`);
    root.appendChild(col);
  }
}
$("words").addEventListener("click", (ev) => {
  const id = ev.target.closest("[data-delword]")?.dataset.delword; if (!id) return;
  modosit("szavak", id, { torolve: true });
  renderAll(); buildReels();
});

/* ---------- fülek ---------- */
function setTab(t) {
  tab = t;
  for (const x of ["kozos", "naplo", "elemek"]) { $("tab-" + x).setAttribute("aria-selected", String(x === t)); $("pane-" + x).hidden = x !== t; }
  lsSet("otletgep:tab", t);
}
for (const x of ["kozos", "naplo", "elemek"]) $("tab-" + x).onclick = () => setTab(x);

function renderAll() { renderCurrent(); renderKozos(); renderNaplo(); renderElemek(); }

/* ---------- egyéb vezérlők ---------- */
let tt;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 1800); }

$("spin").onclick = () => spin();
$("copy").onclick = () => { const s = $("pitch").textContent; navigator.clipboard?.writeText(s).then(() => toast("Kimásolva"), () => toast("A másolás nem sikerült, jelöld ki a szöveget")); };
$("twist").onchange = (ev) => { twistOn = ev.target.checked; if (twistOn && !cur.csavar) cur.csavar = pick("csavar"); buildReels(); renderAll(); };
$("kozos-sort").oninput = renderKozos;
$("refresh").onclick = async () => { await frissit(); toast("Frissítve"); };
["q", "filter", "sort"].forEach((id) => $(id).addEventListener("input", () => { shown = PAGE; renderNaplo(); }));
$("more").onclick = () => { shown += PAGE; renderNaplo(); };
$("export").onclick = () => {
  const adat = naplo.map((n) => { const e = enErtekelesem(otletId(n)) || {}; return { ...n, pont: e.pont || 0, megjegyzes: e.megjegyzes || "", kedvenc: !!e.kedvenc }; });
  const blob = new Blob([JSON.stringify(adat, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `otletgep-${nev}-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("import").onchange = async (ev) => {
  const file = ev.target.files[0]; ev.target.value = "";
  if (!file) return;
  let lista;
  try { lista = JSON.parse(await file.text()); } catch { toast("Ez nem érvényes JSON-fájl"); return; }
  if (!Array.isArray(lista)) { toast("Pörgetés-listát vártam (a helyi Ötletgép exportját)"); return; }
  let db = 0;
  for (const e of lista) {
    if (!e?.kik || !e?.mit || !e?.hol) continue;
    const idea = { kik: e.kik, mit: e.mit, hol: e.hol, csavar: e.csavar || null };
    naplo.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ido: e.ido || new Date().toISOString(), ...idea });
    if (e.pont || (e.megjegyzes || "").trim() || e.kedvenc) {
      emberek[fajl] = osszefesul(tarolo.modosit(fajl, "ertekelesek", otletId(idea), { ...idea, pont: e.pont || 0, megjegyzes: e.megjegyzes || "", kedvenc: !!e.kedvenc }), {});
    }
    db++;
  }
  naplo.sort((a, b) => b.ido.localeCompare(a.ido));
  lsSet(`otletgep:naplo:${fajl}`, naplo);
  mentes(); renderAll();
  toast(`${db} pörgetés importálva`);
};
document.addEventListener("keydown", (ev) => {
  if (ev.code === "Space" && !["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && $("name-overlay").hidden) { ev.preventDefault(); spin(); }
});
window.addEventListener("focus", frissit);
setInterval(() => { if (!document.hidden) frissit(); }, 60000);

/* ---------- indulás ---------- */
(async () => {
  setTab(lsGet("otletgep:tab", "kozos"));
  cur.csavar = ALAP.csavar[Math.floor(Math.random() * ALAP.csavar.length)];
  buildReels();
  const parameter = new URLSearchParams(location.search).get("nev");
  const kezdoNev = (parameter && parameter.trim()) || lsGet("otletgep:nev", null);
  if (!kezdoNev || !nevBeallit(kezdoNev)) { renderAll(); setStatus("Add meg a neved"); nevKeres(); return; }
  emberek = { [fajl]: osszefesul(tarolo.helyiOlvas(fajl), {}) };
  renderAll();
  if (!(BEALLIT.darabok || []).length) { setStatus("Nincs beállítva a mentés (token); minden csak helyben marad", "bad"); return; }
  await frissit();
  buildReels();
})();
