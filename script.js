(function () {
  "use strict";

  var gallery = document.getElementById("gallery");
  var strip = document.getElementById("strip");
  var filtersEl = document.getElementById("filters");
  var emptyEl = document.getElementById("gallery-empty");
  var dialog = document.getElementById("lightbox");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");

  document.getElementById("year").textContent = new Date().getFullYear();

  var photos = [];
  var visible = [];
  var current = 0;
  var lastFocus = null;

  function src(p) { return "photos/" + p.file; }

  function makeButton(p, index, list) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Open photo: " + (p.title || p.alt || p.file));
    var img = document.createElement("img");
    img.src = src(p);
    img.alt = p.alt || p.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    if (p.w && p.h) { img.width = p.w; img.height = p.h; }
    btn.appendChild(img);
    btn.addEventListener("click", function () { open(list, index); });
    return btn;
  }

  function renderStrip() {
    if (!strip) return;
    var featured = photos.filter(function (p) { return p.featured; });
    if (!featured.length) featured = photos.slice(0, 6);
    strip.innerHTML = "";
    featured.forEach(function (p, i) {
      var li = document.createElement("li");
      li.appendChild(makeButton(p, i, featured));
      strip.appendChild(li);
    });
    strip.parentElement.hidden = featured.length === 0;
  }

  function renderGallery(tag) {
    if (!gallery) return;
    visible = tag === "All" ? photos.slice() : photos.filter(function (p) {
      return (p.tags || []).indexOf(tag) !== -1;
    });
    gallery.innerHTML = "";
    visible.forEach(function (p, i) {
      var fig = document.createElement("figure");
      fig.appendChild(makeButton(p, i, visible));
      gallery.appendChild(fig);
    });
    emptyEl.hidden = visible.length > 0;
  }

  function renderFilters() {
    if (!filtersEl) return;
    var tags = [];
    photos.forEach(function (p) {
      (p.tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    });
    filtersEl.innerHTML = "";
    if (tags.length < 2) return;
    ["All"].concat(tags).forEach(function (t, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(filtersEl.children, function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        renderGallery(t);
      });
      filtersEl.appendChild(b);
    });
  }

  /* lightbox */
  var list = [];
  function show(i) {
    current = (i + list.length) % list.length;
    var p = list[current];
    lbImg.src = src(p);
    lbImg.alt = p.alt || p.title || "";
    var cap = [p.title, p.place, p.date].filter(Boolean).join(", ");
    lbCap.textContent = "";
    var main = document.createElement("span");
    main.textContent = cap;
    lbCap.appendChild(main);

    var x = p.exif || {};
    var settings = [x.aperture, x.shutter, x.iso, x.focal_length].filter(Boolean).join("  \u00b7  ");
    var gear = [x.camera, x.lens].filter(Boolean).join("  \u00b7  ");
    if (settings) {
      var s = document.createElement("span");
      s.className = "lb-settings";
      s.textContent = settings;
      lbCap.appendChild(s);
    }
    if (gear) {
      var g = document.createElement("span");
      g.className = "lb-gear";
      g.textContent = gear;
      lbCap.appendChild(g);
    }
  }
  function open(l, i) {
    list = l;
    lastFocus = document.activeElement;
    show(i);
    if (!dialog.open) dialog.showModal();
  }
  function close() { dialog.close(); }

  document.getElementById("lb-close").addEventListener("click", close);
  document.getElementById("lb-prev").addEventListener("click", function () { show(current - 1); });
  document.getElementById("lb-next").addEventListener("click", function () { show(current + 1); });
  dialog.addEventListener("close", function () { if (lastFocus) lastFocus.focus(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
  document.addEventListener("keydown", function (e) {
    if (!dialog.open) return;
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  /* load photos.json */
  fetch("photos.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      photos = Array.isArray(data) ? data : (data.photos || []);
      renderStrip();
      renderFilters();
      renderGallery("All");
    })
    .catch(function () {
      if (strip) strip.parentElement.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
    });
})();