/* Friendsgiving RSVP + potluck list.
   Shared storage is a Google Sheet behind a tiny Apps Script web app
   (see friendsgiving-apps-script.gs). Paste its URL below.
   With no URL set, the page runs in demo mode using this browser's localStorage. */

const ENDPOINT = "https://script.google.com/macros/s/AKfycbw7wSAqyySyVosHRbuwqWtTEHqBUBu1hLyofiWWfzWZmGGI81svSV9I2qo7HL-cYwS3/exec";

const CATEGORIES = ["Main", "Side", "Appetizer", "Dessert", "Drinks", "Other"];
const MAX_DISHES = 8;
const DEMO_KEY = "friendsgiving-demo-v3";

const listEl = document.getElementById("fg-list");
const guestsEl = document.getElementById("fg-guests");
const guestListEl = document.getElementById("fg-guest-list");
const summaryEl = document.getElementById("fg-summary");
const demoEl = document.getElementById("fg-demo");
const form = document.getElementById("fg-form");
const statusEl = document.getElementById("fg-status");
const submitBtn = document.getElementById("fg-submit");
const bringQ = document.getElementById("fg-bring-q");
const dishFields = document.getElementById("fg-dish-fields");
const dishesEl = document.getElementById("fg-dishes");
const addDishBtn = document.getElementById("fg-add-dish");

document.getElementById("year").textContent = new Date().getFullYear();

// state.rsvps:  [{ name, coming }]            one per person
// state.dishes: [{ name, dish, category, notes }]  any number per person
let state = { rsvps: [], dishes: [] };

// "  Sam   Lee " and "sam lee" count as the same person
const keyOf = n => String(n).trim().replace(/\s+/g, " ").toLowerCase();

/* ---------- storage ---------- */

// Apply one person's RSVP to a state object. Returns true if they'd RSVP'd before.
function applyRsvp(s, p) {
  const k = keyOf(p.name);
  const at = s.rsvps.findIndex(r => keyOf(r.name) === k);
  const rsvp = { name: p.name, coming: p.coming };
  if (at >= 0) s.rsvps[at] = rsvp; else s.rsvps.push(rsvp);
  s.dishes = s.dishes.filter(d => keyOf(d.name) !== k);
  p.dishes.forEach(d => s.dishes.push({ name: p.name, ...d }));
  return at >= 0;
}

function demoRead() {
  try {
    const d = JSON.parse(localStorage.getItem(DEMO_KEY));
    return { rsvps: d.rsvps || [], dishes: d.dishes || [] };
  } catch (e) {
    return { rsvps: [], dishes: [] };
  }
}

async function loadState() {
  if (!ENDPOINT) {
    demoEl.hidden = false;
    return demoRead();
  }
  const res = await fetch(ENDPOINT, { cache: "no-store" });
  if (!res.ok) throw new Error("load failed");
  const data = await res.json();
  return {
    rsvps: Array.isArray(data.rsvps) ? data.rsvps : [],
    dishes: Array.isArray(data.dishes) ? data.dishes : [],
  };
}

async function saveRsvp(p) {
  if (!ENDPOINT) {
    const s = demoRead();
    applyRsvp(s, p);
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return;
  }
  // text/plain avoids a CORS preflight, which Apps Script can't answer
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(p),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "save failed");
}

/* ---------- rendering (textContent only, so entries can't inject HTML) ---------- */

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function render() {
  listEl.replaceChildren();
  guestListEl.replaceChildren();

  const coming = r => (["Yes", "Maybe", "No"].includes(r.coming) ? r.coming : "Yes");
  const yes = state.rsvps.filter(r => coming(r) === "Yes");
  const maybe = state.rsvps.filter(r => coming(r) === "Maybe");
  const attending = new Set([...yes, ...maybe].map(r => keyOf(r.name)));
  const dishes = state.dishes.filter(d => attending.has(keyOf(d.name)));

  if (!attending.size) {
    summaryEl.textContent = "No RSVPs yet. Be the first below.";
    guestsEl.hidden = true;
    return;
  }

  const parts = [`${yes.length} coming`];
  if (maybe.length) parts.push(`${maybe.length} maybe`);
  parts.push(`${dishes.length} ${dishes.length === 1 ? "dish" : "dishes"} so far`);
  summaryEl.textContent = parts.join(" · ");

  guestsEl.hidden = false;
  yes.forEach(r => guestListEl.append(el("li", "", r.name)));
  maybe.forEach(r => guestListEl.append(el("li", "is-maybe", r.name + " (maybe)")));

  const known = new Set(CATEGORIES);
  CATEGORIES.forEach(cat => {
    const group = dishes.filter(d => (known.has(d.category) ? d.category : "Other") === cat);
    if (!group.length) return;

    const section = el("section", "fg-group");
    const h = el("h3", null, cat);
    h.append(el("span", "fg-count", String(group.length)));
    section.append(h);

    const ul = el("ul", "fg-items");
    group.forEach(d => {
      const li = el("li", "fg-item");
      li.append(el("p", "fg-dish", d.dish));
      li.append(el("p", "fg-who", d.name));
      if (d.notes) li.append(el("p", "fg-note", d.notes));
      ul.append(li);
    });
    section.append(ul);
    listEl.append(section);
  });
}

/* ---------- dish rows ---------- */

let rowSeq = 0;

function field(cls, labelText, control) {
  const wrap = el("div", "fg-field " + cls);
  const id = "d" + (++rowSeq);
  control.id = id;
  const label = el("label", null, labelText);
  label.htmlFor = id;
  wrap.append(label, control);
  return wrap;
}

function addDishRow(v = {}) {
  if (dishesEl.querySelectorAll(".fg-dish-row").length >= MAX_DISHES) return;

  const row = el("div", "fg-dish-row");

  const head = el("div", "fg-dish-head");
  const title = el("span", "fg-dish-title");
  const rm = el("button", "fg-link", "Remove");
  rm.type = "button";
  rm.addEventListener("click", () => { row.remove(); refreshRows(); });
  head.append(title, rm);

  const dish = el("input", "d-dish");
  dish.type = "text"; dish.maxLength = 100; dish.placeholder = "e.g. Green bean casserole";
  dish.value = v.dish || "";

  const cat = el("select", "d-cat");
  CATEGORIES.forEach(c => {
    const o = el("option", null, c === "Other" ? "Other (plates, ice, etc.)" : c);
    o.value = c;
    cat.append(o);
  });
  cat.value = CATEGORIES.includes(v.category) ? v.category : "Side";

  const notes = el("input", "d-notes");
  notes.type = "text"; notes.maxLength = 160; notes.placeholder = "Vegetarian, contains nuts, serves ~8…";
  notes.value = v.notes || "";

  row.append(
    head,
    field("", "What are you bringing?", dish),
    field("", "Category", cat),
    field("fg-dish-notes", "", notes)
  );
  // notes label carries an inline "(optional)" span
  const nl = row.querySelector(".fg-dish-notes label");
  nl.replaceChildren("Notes ", el("span", "opt", "(optional)"));

  dishesEl.append(row);
  refreshRows();
}

function refreshRows() {
  const rows = dishesEl.querySelectorAll(".fg-dish-row");
  dishesEl.classList.toggle("is-multi", rows.length > 1);
  rows.forEach((r, i) => { r.querySelector(".fg-dish-title").textContent = "Dish " + (i + 1); });
  addDishBtn.hidden = rows.length >= MAX_DISHES;
}

function resetDishRows(list) {
  dishesEl.replaceChildren();
  (list && list.length ? list : [{}]).forEach(addDishRow);
}

function readDishes() {
  return [...dishesEl.querySelectorAll(".fg-dish-row")]
    .map(r => ({
      dish: r.querySelector(".d-dish").value.trim(),
      category: r.querySelector(".d-cat").value,
      notes: r.querySelector(".d-notes").value.trim(),
    }))
    .filter(d => d.dish); // ignore blank extra rows
}

addDishBtn.addEventListener("click", () => {
  addDishRow();
  const rows = dishesEl.querySelectorAll(".fg-dish-row");
  rows[rows.length - 1].querySelector(".d-dish").focus();
});

/* ---------- form ---------- */

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = "fg-status" + (kind ? " is-" + kind : "");
}

function radio(name) {
  const c = form.querySelector(`input[name="${name}"]:checked`);
  return c ? c.value : "";
}

function setRadio(name, value) {
  form.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = i.value === value; });
}

// show the follow-up questions only when they apply
function syncFields() {
  const c = radio("coming");
  const attending = c === "Yes" || c === "Maybe";
  bringQ.hidden = !attending;
  dishFields.hidden = !(attending && radio("bringing") === "Yes");
}
form.addEventListener("change", syncFields);
form.addEventListener("reset", () => setTimeout(syncFields));

// Returning guest: load their previous answers so editing doesn't wipe their dishes
form.elements.name.addEventListener("change", () => {
  const k = keyOf(form.elements.name.value);
  if (!k || radio("coming")) return; // don't overwrite answers they're mid-way through
  const r = state.rsvps.find(x => keyOf(x.name) === k);
  if (!r) return;
  const mine = state.dishes.filter(d => keyOf(d.name) === k);
  setRadio("coming", r.coming);
  setRadio("bringing", r.coming === "No" ? "" : mine.length ? "Yes" : "No");
  resetDishRows(mine);
  syncFields();
  setStatus("Found your RSVP. Change anything and send it again.");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  if (fd.get("website")) return; // honeypot tripped

  const coming = radio("coming");
  const attending = coming === "Yes" || coming === "Maybe";
  const bringing = attending && radio("bringing") === "Yes";

  const payload = {
    name: String(fd.get("name") || "").trim(),
    coming,
    dishes: bringing ? readDishes() : [],
  };

  // validate, focusing the first problem
  const problems = [];
  const nameInput = form.elements.name;
  nameInput.setAttribute("aria-invalid", payload.name ? "false" : "true");
  if (!payload.name) problems.push([nameInput, "Please add your name."]);

  const comingSet = form.querySelector('input[name="coming"]').closest("fieldset");
  comingSet.classList.toggle("is-invalid", !coming);
  if (!coming) problems.push([form.querySelector('input[name="coming"]'), "Please say whether you're coming."]);

  if (attending && !radio("bringing")) {
    bringQ.classList.add("is-invalid");
    problems.push([bringQ.querySelector("input"), "Please say whether you're bringing something."]);
  } else {
    bringQ.classList.remove("is-invalid");
  }

  const firstDish = dishesEl.querySelector(".d-dish");
  const dishMissing = bringing && payload.dishes.length === 0;
  firstDish.setAttribute("aria-invalid", dishMissing ? "true" : "false");
  if (dishMissing) problems.push([firstDish, "Please say what you're bringing."]);

  if (problems.length) {
    problems[0][0].focus();
    setStatus(problems[0][1], "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Sending…");
  try {
    await saveRsvp(payload);
    const wasUpdate = applyRsvp(state, payload);
    render();
    form.reset();
    resetDishRows();
    setStatus(
      (wasUpdate ? "Updated your RSVP. " : "") +
        (coming === "No" ? "Got it, thanks for letting me know." : "You're on the list. See you there!"),
      "ok"
    );
  } catch (err) {
    setStatus("Couldn't save that. Please try again in a moment.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- init ---------- */

resetDishRows();
loadState()
  .then(s => { state = s; render(); })
  .catch(() => { summaryEl.textContent = "Couldn't load the list right now. Try refreshing."; });