(function () {
  "use strict";

  var STORAGE_KEY = "site-lang";

  function detectLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
    var browserLangs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];
    for (var i = 0; i < browserLangs.length; i++) {
      if (/^ru/i.test(browserLangs[i])) return "ru";
    }
    return "en";
  }

  var state = { lang: detectLang() };
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- small DOM helpers ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else if (key === "html") node.innerHTML = attrs[key];
      else if (key in node) node[key] = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }
  function $(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- drag/press survives crossing an iframe's edge ----------
     A press that starts inside a playable (e.g. holding a joystick) looks
     "stuck" the moment the cursor overshoots the phone's edge: the browser
     only ever delivers mousemove/mouseup to whichever document is actually
     under the cursor, so the iframe stops hearing anything the instant it's
     no longer that document — same-origin or not. These playables are
     same-origin (plain iframe.src, no sandbox), so the fix doesn't need
     postMessage: once a real mousedown is seen inside the frame, the page
     just keeps replaying move/up on the frame's own document directly,
     using whatever document.elementFromPoint finds there, until the button
     is actually released. */
  function wireDragThrough(iframe) {
    var down = false;
    var lastTarget = null;

    function onFrameDown(e) { down = true; lastTarget = e.target; }
    function onFrameUp() { down = false; lastTarget = null; }

    // contentDocument swaps to a brand new document on every navigation
    // (including the reloads this site does when a phone goes inactive),
    // so the listeners have to be reattached each time it loads.
    iframe.addEventListener("load", function () {
      var win = iframe.contentWindow;
      if (!win) return;
      win.addEventListener("mousedown", onFrameDown, true);
      win.addEventListener("mouseup", onFrameUp, true);
    });

    function fire(type, x, y, buttons) {
      var doc;
      try { doc = iframe.contentDocument; } catch (e) { return; }
      if (!doc) return;
      var target = (lastTarget && lastTarget.isConnected && lastTarget.ownerDocument === doc)
        ? lastTarget
        : doc.elementFromPoint(x, y);
      if (!target) return;
      var opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: buttons };
      target.dispatchEvent(new MouseEvent("mouse" + type, opts));
      try {
        opts.pointerId = 1; opts.pointerType = "mouse"; opts.isPrimary = true;
        target.dispatchEvent(new PointerEvent("pointer" + type, opts));
      } catch (err) { /* older browsers: the mouse event above is enough */ }
    }

    document.addEventListener("mousemove", function (e) {
      if (!down) return;
      if (e.buttons === 0) { onFrameUp(); return; } // button let go outside the page entirely
      var r = iframe.getBoundingClientRect();
      fire("move", e.clientX - r.left, e.clientY - r.top, 1);
    });
    document.addEventListener("mouseup", function (e) {
      if (!down) return;
      var r = iframe.getBoundingClientRect();
      onFrameUp();
      fire("up", e.clientX - r.left, e.clientY - r.top, 0);
    });
    window.addEventListener("blur", onFrameUp);
  }

  /* ---------- playable modal (reused by hero + playables carousel) ----------
     Every playable now opens here and only here — the small phones in the
     hero and the carousel are just a muted preview loop with a "tap to
     play" badge (see buildPlayablePhone / the hero wiring in
     renderProjects); nothing ever runs inline, so there's only ever one
     live playable iframe on the page at a time. */
  var modal = $("playerModal");
  var playerFrame = $("playerFrame");
  var playerBackdrop = $("playerBackdrop");
  var playerLoadingFill = $("playerLoadingFill");
  var playerLoadingLabel = $("playerLoadingLabel");
  var playerTitle = $("playerModalTitle");
  var playerGenre = $("playerModalGenre");
  var playerOpenNewTab = $("playerOpenNewTab");
  var currentPlayableUrl = "";
  var currentPlayablePreview = "";
  var currentPlayableSize = 0;
  var playerLoadAbort = null;

  var playerPhone = modal.querySelector(".phone--lg");
  playerFrame.addEventListener("load", function () {
    playerPhone.classList.remove("is-loading");
  });
  wireDragThrough(playerFrame);

  // Circumference read from the ring's own radius so it never has to be
  // kept in sync by hand with the SVG markup.
  var loadingRingCircumference = 2 * Math.PI * parseFloat(playerLoadingFill.getAttribute("r"));
  playerLoadingFill.style.strokeDasharray = String(loadingRingCircumference);

  function setLoadingProgress(loaded, total) {
    // Clamped defensively: loaded counts actual decoded bytes out of the
    // reader, which can land a byte or two past a known total right at
    // the last chunk — never past it by much, but "N/All" reading over
    // 100% at all looks broken, so cap the display at the total.
    var shown = total ? Math.min(loaded, total) : loaded;
    var pct = total ? shown / total : 0;
    playerLoadingFill.style.strokeDashoffset = String(loadingRingCircumference * (1 - pct));
    var toMb = function (bytes) { return (bytes / (1024 * 1024)).toFixed(1); };
    var unit = state.lang === "ru" ? "МБ" : "MB";
    playerLoadingLabel.textContent = toMb(shown) + " / " + (total ? toMb(total) : "—") + " " + unit;
  }
  setLoadingProgress(0, 0);

  // Freezes the modal's blurred backdrop on the playable's own preview
  // clip (see CSS .phone.is-loading #playerBackdrop) so there's a real
  // frame to blur behind the progress ring instead of plain black.
  function primeBackdrop(previewSrc) {
    playerBackdrop.pause();
    if (!previewSrc) { playerBackdrop.removeAttribute("src"); return; }
    playerBackdrop.src = previewSrc;
    playerBackdrop.currentTime = 0;
    var p = playerBackdrop.play();
    if (p && p.then) p.then(function () { playerBackdrop.pause(); }).catch(function () {});
  }

  // Streams the playable's own (self-contained, 1-5MB) HTML file through
  // fetch() so the ring and the N/All label are driven by real bytes read
  // off the reader. The total comes from knownSize (the file's actual
  // on-disk byte count, passed down from SITE_DATA — see i18n.js "size"),
  // not the response's Content-Length: when a host gzips the HTML in
  // transit, Content-Length reports the compressed wire size while the
  // reader still hands back the larger decompressed bytes, so "received"
  // would sail past it. Handing the fully-downloaded text to the iframe
  // via srcdoc (once done) avoids a second iframe.src navigation that
  // would have to re-fetch the whole thing — or silently hope the HTTP
  // cache has it — to actually show anything.
  function loadIntoPlayer(url, knownSize) {
    if (playerLoadAbort) playerLoadAbort.abort();
    var controller = new AbortController();
    playerLoadAbort = controller;
    playerPhone.classList.add("is-loading");
    var total = knownSize || 0;
    setLoadingProgress(0, total);

    fetch(url, { signal: controller.signal }).then(function (res) {
      if (!res.body) { playerFrame.src = url; return; }
      var reader = res.body.getReader();
      var received = 0;
      var chunks = [];
      function pump() {
        return reader.read().then(function (result) {
          if (result.done) {
            return new Blob(chunks).text().then(function (html) {
              if (!controller.signal.aborted) playerFrame.srcdoc = html;
            });
          }
          chunks.push(result.value);
          received += result.value.length;
          setLoadingProgress(received, total);
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (err && err.name !== "AbortError" && !controller.signal.aborted) playerFrame.src = url;
    });
  }

  function resetPlayer() {
    if (playerLoadAbort) playerLoadAbort.abort();
    playerFrame.src = "about:blank";
    playerFrame.removeAttribute("srcdoc");
    playerPhone.classList.remove("is-loading");
    playerBackdrop.pause();
    playerBackdrop.removeAttribute("src");
  }

  function openPlayable(url, title, genre, previewSrc, size) {
    currentPlayableUrl = url;
    currentPlayablePreview = previewSrc || "";
    currentPlayableSize = size || 0;
    playerTitle.textContent = title;
    playerGenre.textContent = genre || "";
    playerOpenNewTab.href = url;
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
    primeBackdrop(currentPlayablePreview);
    loadIntoPlayer(url, currentPlayableSize);
  }
  function closePlayable() {
    modal.close ? modal.close() : modal.removeAttribute("open");
    resetPlayer();
  }
  $("playerRestart").addEventListener("click", function () {
    if (currentPlayableUrl) {
      primeBackdrop(currentPlayablePreview);
      loadIntoPlayer(currentPlayableUrl, currentPlayableSize);
    }
  });
  $("playerClose").addEventListener("click", closePlayable);
  modal.addEventListener("click", function (e) {
    var box = modal.getBoundingClientRect();
    var inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    if (!inside) closePlayable();
  });
  modal.addEventListener("cancel", resetPlayer);

  /* ---------- hero phone: muted preview loop, tap opens the modal ----------
     No inline iframe here anymore — the hero is just the featured
     playable's preview clip plus a "tap to play" badge; the real game
     only ever loads once it's opened in the modal above. The click
     target's aria-label and handler are wired in renderProjects, once the
     featured playable's title/url are known. */
  var heroPreview = $("heroPreview");
  if (heroPreview) {
    var heroPlayPromise = heroPreview.play();
    if (heroPlayPromise && heroPlayPromise.catch) heroPlayPromise.catch(function () {});
  }

  /* ---------- reveal on scroll ---------- */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  function observeReveals(root) {
    root.querySelectorAll("[data-reveal]").forEach(function (node) {
      revealObserver.observe(node);
    });
  }

  /* ---------- phone idle wobble ----------
     No cursor tracking — a slow ambient sway around the resting pose, so the
     phone always feels alive without depending on mouse input at all. */
  function enableTilt(target) {
    if (!target || prefersReducedMotion) return;
    var restX = 6;
    var restY = -18;
    var idleAmp = 4;
    var idlePeriodX = 12400;
    var idlePeriodY = 14800;
    var startedAt = performance.now();

    var edge = target.querySelector(":scope > .phone__edge");
    var edgeAmount = edge ? parseFloat(getComputedStyle(target).getPropertyValue("--phone-edge-amount")) || 0 : 0;
    // Degrees-to-offset rate, shared by both axes so the offset tracks the
    // actual tilt angle: 0 at dead-on (0deg), growing with how far the phone
    // is turned. Anchored to restY (the dominant turn) rather than restX, so
    // the gentler up/down tilt doesn't get an inflated rate of its own.
    var degToOffset = edgeAmount / Math.abs(restY);

    function frame(now) {
      var t = now - startedAt;
      var waveX = Math.sin((t / idlePeriodX) * Math.PI * 2);
      var waveY = Math.sin((t / idlePeriodY) * Math.PI * 2);
      var rx = restX + waveX * idleAmp;
      var ry = restY + waveY * idleAmp;
      target.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
      if (edge) {
        var offsetX = -degToOffset * ry;
        var offsetY = degToOffset * rx;
        edge.style.transform = "translate(" + offsetX.toFixed(2) + "%, " + offsetY.toFixed(2) + "%)";
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Game Feel interactive demo ---------- */
  var gfEaseSpring = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  var gfEaseOut = "cubic-bezier(0.22, 1, 0.36, 1)";

  function gfRandom(a, b) { return a + Math.random() * (b - a); }

  function gfColors(scopeEl) {
    var cs = getComputedStyle(scopeEl || document.documentElement);
    return {
      accent: cs.getPropertyValue("--accent").trim() || "#E8452C",
      ink: cs.getPropertyValue("--ink").trim() || "#17171A",
      coin: cs.getPropertyValue("--coin").trim() || "#F0B429"
    };
  }

  /* Canvas particle engine: a tiny rAF loop that owns a list of fx and redraws them each frame. */
  function GfParticleEngine(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.items = [];
    this.frame = 0;
    this.last = 0;
    this.width = 0;
    this.height = 0;
    var self = this;
    this._tick = function (now) { self.tick(now); };
    if (window.ResizeObserver) {
      this.observer = new ResizeObserver(function () { self.resize(); });
      this.observer.observe(canvas);
    }
    this.resize();
  }
  GfParticleEngine.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    /* Scale derived from the measured box (not devicePixelRatio alone) so canvas drawing
       coordinates stay in the same units as getBoundingClientRect() even under CSS zoom. */
    this.ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
  };
  GfParticleEngine.prototype.add = function (item) {
    this.items.push(item);
    if (!this.frame) {
      this.last = 0;
      this.frame = requestAnimationFrame(this._tick);
    }
  };
  GfParticleEngine.prototype.tick = function (now) {
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    var alive = [];
    for (var i = 0; i < this.items.length; i++) {
      var p = this.items[i];
      if (p.update(dt)) { p.draw(ctx); alive.push(p); }
    }
    this.items = alive;
    this.frame = this.items.length ? requestAnimationFrame(this._tick) : 0;
  };
  GfParticleEngine.prototype.ring = function (x, y, radius, color, life) {
    this.add(new GfRing(x, y, radius, color, life));
  };
  GfParticleEngine.prototype.burst = function (x, y, opts) {
    opts = opts || {};
    var count = opts.count || 14;
    for (var i = 0; i < count; i++) this.add(new GfSpark(x, y, opts));
  };

  /* Expanding ring at the tap point. */
  function GfRing(x, y, radius, color, life) {
    this.x = x; this.y = y; this.radius = radius; this.color = color; this.life = life; this.age = 0;
  }
  GfRing.prototype.update = function (dt) { this.age += dt; return this.age < this.life; };
  GfRing.prototype.draw = function (ctx) {
    var t = this.age / this.life;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1 + 5 * (1 - t);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (1 - Math.pow(1 - t, 3)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  /* Gravity-driven spark thrown out from the tap point. */
  function GfSpark(x, y, opts) {
    var angle = (opts.angle || 0) + gfRandom(-0.5, 0.5) * (opts.spread || Math.PI * 2);
    var speedRange = opts.speed || [120, 360];
    var sizeRange = opts.size || [3, 7];
    var speed = gfRandom(speedRange[0], speedRange[1]);
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = gfRandom(0.45, 0.8);
    this.size = gfRandom(sizeRange[0], sizeRange[1]);
    this.color = opts.color || "#E8452C";
    this.gravity = opts.gravity || 900;
    this.age = 0;
  }
  GfSpark.prototype.update = function (dt) {
    this.age += dt;
    if (this.age >= this.life) return false;
    var drag = Math.exp(-dt * 4);
    this.vx *= drag;
    this.vy = this.vy * drag + this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return true;
  };
  GfSpark.prototype.draw = function (ctx) {
    var t = 1 - this.age / this.life;
    ctx.globalAlpha = Math.min(1, t * 2.5);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (0.35 + 0.65 * t), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  /* A coin flying from the tap point to the counter — straight line, or a curved arc when easing is on. */
  function GfCoin(from, toFn, eased, delay, onArrive, colors) {
    this.x = from.x; this.y = from.y;
    var angle = -Math.PI / 2 + gfRandom(-1.2, 1.2);
    var speed = eased ? gfRandom(240, 420) : 0;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.delay = delay;
    this.eased = eased;
    this.toFn = toFn;
    this.onArrive = onArrive;
    this.bend = gfRandom(-90, 90);
    this.from = null;
    this.age = 0;
    this.travel = eased ? 0.5 : 0.42;
    this.colors = colors;
    this.progress = 0;
  }
  GfCoin.prototype.update = function (dt) {
    this.age += dt;
    if (this.age < this.delay) {
      var decay = Math.exp(-dt * 7);
      this.vx *= decay; this.vy *= decay;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return true;
    }
    if (!this.from) this.from = { x: this.x, y: this.y };
    var t = Math.min(1, (this.age - this.delay) / this.travel);
    this.progress = t;
    var target = this.toFn();
    if (this.eased) {
      var e = t * t * t;
      var mid = { x: (this.from.x + target.x) / 2 + this.bend, y: Math.min(this.from.y, target.y) - 40 };
      var inv = 1 - e;
      this.x = inv * inv * this.from.x + 2 * inv * e * mid.x + e * e * target.x;
      this.y = inv * inv * this.from.y + 2 * inv * e * mid.y + e * e * target.y;
    } else {
      this.x = this.from.x + (target.x - this.from.x) * t;
      this.y = this.from.y + (target.y - this.from.y) * t;
    }
    if (t >= 1) { this.onArrive(); return false; }
    return true;
  };
  GfCoin.prototype.draw = function (ctx) {
    var wobble = this.eased ? Math.max(0.25, Math.abs(Math.cos(this.age * 9))) : 1;
    /* Shrink to nothing over the last 10% of the flight so the coin doesn't just pop at arrival. */
    var landing = Math.max(0, (this.progress - 0.9) / 0.1);
    var shrink = 1 - landing;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(wobble * shrink, shrink);
    ctx.fillStyle = this.colors.ink;
    ctx.beginPath(); ctx.arc(0, 4, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.colors.coin;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- tiny Web Audio synth: two-note sweeps, no audio files ---------- */
  var gfAudioCtx = null;
  function gfAudio() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!gfAudioCtx) gfAudioCtx = new Ctor();
    if (gfAudioCtx.state === "suspended") gfAudioCtx.resume();
    return gfAudioCtx;
  }
  function gfTone(type, freqFrom, freqTo, delay, duration, gain) {
    var ctx = gfAudio();
    if (!ctx) return;
    var start = ctx.currentTime + delay;
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(freqTo, start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
  function gfTapSound(mult) {
    gfTone("triangle", 420 * mult, 160 * mult, 0, 0.12, 0.22);
    gfTone("sine", 1100 * mult, 700 * mult, 0, 0.05, 0.06);
  }
  function gfCoinSound(mult) {
    gfTone("square", 988 * mult, 988 * mult, 0, 0.06, 0.045);
    gfTone("square", 1319 * mult, 1319 * mult, 0.06, 0.12, 0.045);
  }

  function initGameFeel() {
    var btn = $("gfButton");
    var stage = $("gfStage");
    var countEl = $("gfCount");
    var counterChip = stage.querySelector(".gamefeel__counter");
    var coinIcon = stage.querySelector(".gamefeel__coin-icon") || stage.querySelector(".gamefeel__coin");
    var fxCanvas = $("gfFx");
    var toggleAllBtn = $("gfToggleAll");
    var engine = fxCanvas ? new GfParticleEngine(fxCanvas) : null;
    var colors = gfColors(document.getElementById("gamefeel"));

    var effects = { easing: true, squash: true, particles: true, counter: true, shake: true, sound: true };
    var combo = { count: 0, at: 0 };
    var counter = { value: 0, shown: 0, frame: 0 };
    var coinsPerTap = 5;

    function toggleEl(key) {
      return document.querySelector('.toggle[data-effect="' + key + '"]');
    }
    function applyEasingClass() {
      stage.classList.toggle("is-eased", effects.easing);
    }
    applyEasingClass();

    Object.keys(effects).forEach(function (key) {
      var t = toggleEl(key);
      if (!t) return;
      t.addEventListener("click", function () {
        effects[key] = !effects[key];
        t.setAttribute("aria-pressed", String(effects[key]));
        if (key === "easing") applyEasingClass();
        if (key === "sound" && effects.sound) gfTapSound(1);
      });
    });

    var nonSoundKeys = Object.keys(effects).filter(function (k) { return k !== "sound"; });
    toggleAllBtn.addEventListener("click", function () {
      var allOn = nonSoundKeys.every(function (k) { return effects[k]; });
      var next = !allOn;
      nonSoundKeys.forEach(function (key) {
        effects[key] = next;
        var t = toggleEl(key);
        if (t) t.setAttribute("aria-pressed", String(next));
      });
      if (!next) {
        effects.sound = false;
        var soundToggle = toggleEl("sound");
        if (soundToggle) soundToggle.setAttribute("aria-pressed", "false");
      }
      applyEasingClass();
    });

    function updateCounterDisplay(animate) {
      cancelAnimationFrame(counter.frame);
      if (!animate || prefersReducedMotion) {
        counter.shown = counter.value;
        countEl.textContent = String(counter.value);
        return;
      }
      var from = counter.shown;
      var start = performance.now();
      function frame(now) {
        var t = Math.min(1, (now - start) / 380);
        counter.shown = from + (counter.value - from) * (1 - Math.pow(1 - t, 3));
        countEl.textContent = String(Math.round(counter.shown));
        if (t < 1) counter.frame = requestAnimationFrame(frame);
      }
      counter.frame = requestAnimationFrame(frame);
    }

    function pulseCounter() {
      if (prefersReducedMotion || !counterChip.animate) return;
      if (effects.easing) {
        counterChip.animate([
          { transform: "scale(1)", easing: gfEaseOut },
          { transform: "scale(1.18)", offset: 0.25, easing: gfEaseSpring },
          { transform: "scale(1)" }
        ], { duration: 360 });
      } else {
        counterChip.animate([{ transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 90 });
      }
    }

    function squashButton() {
      if (prefersReducedMotion || !btn.animate) return;
      if (effects.squash) {
        var keyframes = effects.easing ? [
          { transform: "translate(-50%, -50%) scale(1, 1)", easing: gfEaseOut },
          { transform: "translate(-50%, -50%) scale(1.24, 0.74)", offset: 0.16, easing: gfEaseOut },
          { transform: "translate(-50%, -50%) scale(0.88, 1.15)", offset: 0.42, easing: gfEaseSpring },
          { transform: "translate(-50%, -50%) scale(1, 1)" }
        ] : [
          { transform: "translate(-50%, -50%) scale(1, 1)" },
          { transform: "translate(-50%, -50%) scale(1.24, 0.74)", offset: 0.3 },
          { transform: "translate(-50%, -50%) scale(0.88, 1.15)", offset: 0.65 },
          { transform: "translate(-50%, -50%) scale(1, 1)" }
        ];
        btn.animate(keyframes, { duration: effects.easing ? 560 : 260 });
      } else if (effects.easing) {
        btn.animate([
          { transform: "translate(-50%, -50%) scale(1)", easing: gfEaseOut },
          { transform: "translate(-50%, -50%) scale(0.86)", offset: 0.18, easing: gfEaseSpring },
          { transform: "translate(-50%, -50%) scale(1)" }
        ], { duration: 480 });
      }
    }

    function shakeStage() {
      if (prefersReducedMotion || !stage.animate) return;
      var offsets = [0, -8, 7, -5, 4, -2, 0];
      stage.animate(offsets.map(function (x, i) {
        return { transform: "translate(" + x + "px, " + (i % 2 ? x * 0.6 : -x * 0.4) + "px)" };
      }), { duration: 300 });
    }

    /* Measured against the fx canvas itself (not the stage) so the point we draw at always
       lines up with the point the browser reports for the click, regardless of the page's
       CSS zoom or any rounding drift between sibling elements' boxes. */
    function elementCenter(node) {
      var r = node.getBoundingClientRect();
      var canvasRect = fxCanvas.getBoundingClientRect();
      return { x: r.left + r.width / 2 - canvasRect.left, y: r.top + r.height / 2 - canvasRect.top };
    }

    function handleTap(clientPoint) {
      var now = performance.now();
      combo.count = now - combo.at < 450 ? Math.min(combo.count + 1, 8) : 0;
      combo.at = now;
      var mult = 1 + combo.count * 0.05;
      var canvasRect = fxCanvas.getBoundingClientRect();
      var point = clientPoint
        ? { x: clientPoint.x - canvasRect.left, y: clientPoint.y - canvasRect.top }
        : elementCenter(btn);

      squashButton();
      if (effects.shake) shakeStage();
      if (effects.sound) gfTapSound(mult);
      if (effects.particles && engine && !prefersReducedMotion) {
        engine.ring(point.x, point.y, 112, colors.accent, 0.4);
        engine.burst(point.x, point.y, { count: 16, speed: [160, 420], gravity: 760, size: [6, 12], color: colors.accent });
      }

      if (effects.counter && engine && !prefersReducedMotion) {
        for (var i = 0; i < coinsPerTap; i++) {
          (function (index) {
            var delay = effects.easing ? 0.22 + index * 0.07 : index * 0.06;
            engine.add(new GfCoin(point, function () { return elementCenter(coinIcon); }, effects.easing, delay, function () {
              counter.value += 1;
              updateCounterDisplay(true);
              pulseCounter();
              if (effects.sound) gfCoinSound(1 + index * 0.04);
            }, colors));
          })(i);
        }
      } else {
        counter.value += coinsPerTap;
        updateCounterDisplay(true);
        if (effects.easing) pulseCounter();
        if (effects.sound) gfCoinSound(mult);
      }
    }

    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      handleTap({ x: e.clientX, y: e.clientY });
    });
    btn.addEventListener("click", function (e) {
      if (e.detail === 0) handleTap(null);
    });
  }

  /* ---------- phone builder ---------- */
  function buildPlayablePhone(p) {
    var phone = el("div", { className: "phone phone--static" });
    phone.appendChild(el("div", { className: "phone__edge" }));
    var body = el("div", { className: "phone__body" });
    var screen = el("div", { className: "phone__screen" });
    // Just a muted looping clip, forever — the real playable never runs
    // inline, only in the modal (see openPlayable), so there's nothing
    // here to load or swap.
    var video = el("video", { muted: true, loop: true, playsInline: true, preload: "auto", autoplay: true });
    if (p.preview) video.src = p.preview;
    var selectBtn = el("button", { type: "button", className: "phone__select", "aria-label": p.ctaPlay + " " + p.title });
    screen.appendChild(video);
    screen.appendChild(selectBtn);
    body.appendChild(screen);
    phone.appendChild(body);
    phone.appendChild(el("div", { className: "phone__notch" }));
    phone.appendChild(el("div", { className: "phone__frame" }));
    phone._video = video;
    phone._selectBtn = selectBtn;
    return phone;
  }

  /* ---------- playables carousel ----------
     Every phone here is just its preview clip, forever — tapping one
     either centers it (if it wasn't the active one) or opens the full
     playable in the shared modal (if it already was). Nothing ever loads
     or runs inline, so there's no background queue and no per-phone
     "ready" state to track.

     A phone's box is always a constant width — active/inactive is purely
     a transform: scale() in CSS, never a width change, so the row's
     height is rock solid. Clicking one hands it the red "active" border,
     scales it up, and centers it.

     The row is paged entirely by code, never by the user dragging or
     swiping it: .playables-grid (see CSS) is a plain overflow:hidden
     viewport, and .playables-track — the actual flex row of cards — is
     moved by setting its own `transform: translateX()`, which touch/click
     never drives on its own. A swipe or tap landing anywhere in this area
     is therefore just a normal page-scroll/tap everywhere outside it
     would be: nothing here intercepts it. */
  function setupPlayablesCarousel(grid, track, entries, navButtons) {
    var activeIndex = -1;
    var trackX = 0;

    function centerCard(card, instant) {
      var gridRect = grid.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      // getBoundingClientRect() reports post-zoom (visual) pixels, but
      // transform: translateX operates in pre-zoom (layout) pixels — under
      // the site's `zoom: 0.8` (see styles.css) those units disagree, so a
      // delta measured in rect-space has to be rescaled before it's added
      // to the track's offset, or every jump lands short (converging only
      // on repeat clicks to the same card, since each call corrects part of
      // the gap its predecessor left behind). clientWidth/gridRect.width is
      // 1 when there's no zoom, so this is a no-op outside this page's setup.
      var zoomRatio = grid.clientWidth / gridRect.width;
      var delta = ((cardRect.left + cardRect.width / 2) - (gridRect.left + gridRect.width / 2)) * zoomRatio;
      trackX -= delta;
      track.style.transition = (instant || prefersReducedMotion) ? "none" : "transform 420ms ease";
      track.style.transform = "translateX(" + trackX + "px)";
    }

    function selectPlayable(index, opts) {
      opts = opts || {};
      var entry = entries[index];
      if (index !== activeIndex) {
        if (activeIndex !== -1) {
          entries[activeIndex].phone.classList.remove("is-active");
          if (navButtons) navButtons[activeIndex].classList.remove("is-active");
        }
        entry.phone.classList.add("is-active");
        if (navButtons) navButtons[index].classList.add("is-active");
        activeIndex = index;
        centerCard(entry.card, opts.instant);
      } else {
        openPlayable(entry.url, entry.title, entry.genre, entry.preview, entry.size);
      }
    }

    // Pausing the preview clips while the whole row is scrolled out of
    // view is a cheap battery/CPU win now that there's nothing heavier
    // (no live iframes) running behind them — resumed the moment it's
    // back on screen.
    if (grid._carouselVisibility) grid._carouselVisibility.disconnect();
    var visibilityObserver = new IntersectionObserver(function (obsEntries) {
      obsEntries.forEach(function (e) {
        entries.forEach(function (entry) {
          if (e.isIntersecting) entry.video.play();
          else entry.video.pause();
        });
      });
    });
    visibilityObserver.observe(grid);
    grid._carouselVisibility = visibilityObserver;

    entries.forEach(function (entry, index) {
      entry.selectBtn.addEventListener("click", function () { selectPlayable(index); });
      entry.card.addEventListener("click", function (e) {
        if (e.target === entry.selectBtn) return;
        selectPlayable(index);
      });
    });

    if (navButtons) {
      navButtons.forEach(function (btn, index) {
        btn.addEventListener("click", function () { selectPlayable(index); });
      });
    }

    if (grid._carouselResize) window.removeEventListener("resize", grid._carouselResize);
    var resizeTimer = null;
    grid._carouselResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (activeIndex !== -1) centerCard(entries[activeIndex].card, true);
      }, 150);
    };
    window.addEventListener("resize", grid._carouselResize);

    var initial = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].featured) { initial = i; break; }
    }
    selectPlayable(initial, { instant: true });
  }

  /* ---------- section renderers ---------- */
  function renderHeader(d) {
    $("headerName").textContent = d.header.name;
    var nav = $("headerNav");
    clear(nav);
    d.header.nav.forEach(function (item) {
      nav.appendChild(el("a", { href: item.href, text: item.label }));
    });
    $("headerResumeLabel").textContent = d.header.resume;
  }

  function renderHero(d) {
    $("heroEyebrow").textContent = d.hero.eyebrow;
    $("heroTitle").innerHTML = d.hero.titleHtml;
    var lede = $("heroLede");
    clear(lede);
    d.hero.lede.forEach(function (p) {
      lede.appendChild(el("p", { className: "hero__lede", text: p }));
    });
  }

  function renderExperience(d) {
    $("expIndex").textContent = d.experience.index;
    $("expTitle").textContent = d.experience.title;
    var list = $("expList");
    clear(list);
    d.experience.items.forEach(function (item) {
      var bullets = el("ul", { className: "exp-item__bullets" });
      item.bullets.forEach(function (b) {
        bullets.appendChild(el("li", { text: b }));
      });
      var row = el("div", { className: "exp-item", "data-reveal": "" }, [
        el("div", { className: "exp-item__dates mono", text: item.dates }),
        el("div", {}, [
          el("div", { className: "exp-item__role", text: item.role }),
          el("div", { className: "exp-item__org", text: item.org }),
          bullets
        ])
      ]);
      list.appendChild(row);
    });
  }

  function renderProjects(d) {
    $("projIndex").textContent = d.projects.index;
    $("projTitle").textContent = d.projects.title;
    $("playablesTitle").textContent = d.projects.playablesTitle;
    $("playablesTagline").textContent = d.projects.playablesTagline;
    $("playablesNavTagline").textContent = d.projects.playablesNavTagline;
    $("gamesTitle").textContent = d.projects.gamesTitle;

    var playablesGrid = $("playablesGrid");
    clear(playablesGrid);
    var playablesTrack = el("div", { className: "playables-track" });
    playablesGrid.appendChild(playablesTrack);
    var ordered = d.projects.playables;
    var playableEntries = ordered.map(function (p) {
      var phone = buildPlayablePhone(p);
      var card = el("div", { className: "playable-card", "data-reveal": "" }, [
        phone,
        el("div", { className: "playable-card__caption" }, [
          el("div", { className: "playable-card__title", text: p.title }),
          el("div", { className: "playable-card__genre", text: p.genre })
        ])
      ]);
      playablesTrack.appendChild(card);
      return {
        card: card, phone: phone, video: phone._video, selectBtn: phone._selectBtn,
        url: p.url, title: p.title, genre: p.genre, preview: p.preview, size: p.size, featured: !!p.featured
      };
    });

    var playablesNav = $("playablesNav");
    clear(playablesNav);
    var navButtons = ordered.map(function (p) {
      var btn = el("button", { type: "button", className: "playables-nav__item", "aria-label": p.title }, [
        el("div", { className: "playables-nav__icon" }, [
          el("img", { src: p.icon, alt: p.title })
        ]),
        el("div", { className: "playables-nav__title", text: p.title }),
        el("div", { className: "playables-nav__genre", text: p.genre })
      ]);
      playablesNav.appendChild(btn);
      return btn;
    });

    setupPlayablesCarousel(playablesGrid, playablesTrack, playableEntries, navButtons);

    // Hero's phone shows the same featured playable — wire its tap target
    // now that this language's title/url/preview are known. Re-render
    // (language switch) replaces the handler instead of stacking another.
    var heroPlayBtn = $("heroPlayBtn");
    if (heroPlayBtn) {
      var featured = ordered.filter(function (p) { return p.featured; })[0] || ordered[0];
      heroPlayBtn.setAttribute("aria-label", featured.ctaPlay + " " + featured.title);
      if (heroPlayBtn._clickHandler) heroPlayBtn.removeEventListener("click", heroPlayBtn._clickHandler);
      heroPlayBtn._clickHandler = function () {
        openPlayable(featured.url, featured.title, featured.genre, featured.preview, featured.size);
      };
      heroPlayBtn.addEventListener("click", heroPlayBtn._clickHandler);
    }

    var gamesRow = $("gamesRow");
    clear(gamesRow);
    d.projects.games.forEach(function (g) {
      var tile = el("a", {
        className: "game-tile",
        href: g.url,
        target: "_blank",
        rel: "noopener",
        "data-reveal": ""
      }, [
        el("div", { className: "game-tile__icon" }, [
          el("img", { src: g.icon, alt: g.title })
        ]),
        el("div", { className: "game-tile__title", text: g.title }),
        el("div", { className: "game-tile__meta", text: g.genre })
      ]);
      gamesRow.appendChild(tile);
    });
  }

  function renderStack(d) {
    $("stackIndex").textContent = d.stack.index;
    $("stackTitle").textContent = d.stack.title;
    var groups = $("stackGroups");
    clear(groups);
    d.stack.groups.forEach(function (g) {
      var tagsWrap = el("div", { className: "stack-group__tags" });
      g.tags.forEach(function (t) {
        tagsWrap.appendChild(el("span", { className: "tag", text: t }));
      });
      groups.appendChild(el("div", { className: "stack-group", "data-reveal": "" }, [
        el("div", { className: "stack-group__title", text: g.title }),
        tagsWrap
      ]));
    });
    var langRow = $("languagesRow");
    clear(langRow);
    d.stack.languages.forEach(function (lng) {
      langRow.appendChild(el("div", { className: "lang-item" }, [
        el("div", { className: "lang-item__name", text: lng.name }),
        el("div", { className: "lang-item__level mono", text: lng.level })
      ]));
    });
  }

  function renderContact(d) {
    $("contactIndex").textContent = d.contact.index;
    $("contactLede").textContent = d.contact.lede;
    var list = $("contactList");
    clear(list);
    d.contact.items.forEach(function (item) {
      var isDownload = item.label === "Резюме" || item.label === "Resume";
      var a = el("a", { href: item.href }, [
        el("span", { text: item.label }),
        el("span", { className: "mono", text: item.value })
      ]);
      if (item.href.indexOf("http") === 0) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      if (isDownload) a.setAttribute("download", "");
      list.appendChild(el("li", {}, [a]));
    });
  }

  function renderFooter(d) {
    $("footerText").textContent = d.footer.text;
    $("footerYear").textContent = new Date().getFullYear();
  }

  function renderGameFeel(d) {
    $("gfEyebrow").textContent = d.gameFeel.eyebrow;
    $("gfTitle").textContent = d.gameFeel.title;
    $("gfDesc").textContent = d.gameFeel.desc;
    $("gfButton").setAttribute("aria-label", d.gameFeel.tapButton);
    $("gfCounterSrLabel").textContent = d.gameFeel.counterSrLabel;
    $("gfToggleEasingLabel").textContent = d.gameFeel.toggles.easing;
    $("gfToggleSquashLabel").textContent = d.gameFeel.toggles.squash;
    $("gfToggleParticlesLabel").textContent = d.gameFeel.toggles.particles;
    $("gfToggleCounterLabel").textContent = d.gameFeel.toggles.counter;
    $("gfToggleShakeLabel").textContent = d.gameFeel.toggles.shake;
    $("gfToggleSoundLabel").textContent = d.gameFeel.toggles.sound;
    $("gfToggleAll").textContent = d.gameFeel.turnOffAll;
  }

  function render(lang) {
    var d = window.SITE_DATA[lang];
    document.documentElement.lang = lang;
    document.title = d.meta.title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", d.meta.description);
    ["meta[property=\"og:title\"]", "meta[name=\"twitter:title\"]"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute("content", d.meta.title);
    });
    ["meta[property=\"og:description\"]", "meta[name=\"twitter:description\"]"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute("content", d.meta.description);
    });
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute("content", lang === "en" ? "en_US" : "ru_RU");

    renderHeader(d);
    renderHero(d);
    renderGameFeel(d);
    renderExperience(d);
    renderProjects(d);
    renderStack(d);
    renderContact(d);
    renderFooter(d);

    $("langRu").setAttribute("aria-pressed", String(lang === "ru"));
    $("langEn").setAttribute("aria-pressed", String(lang === "en"));

    observeReveals(document);
  }

  function setLang(lang) {
    state.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    render(lang);
  }

  $("langRu").addEventListener("click", function () { setLang("ru"); });
  $("langEn").addEventListener("click", function () { setLang("en"); });

  enableTilt($("heroPhone"));
  initGameFeel();

  render(state.lang);
})();
