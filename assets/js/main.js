(function () {
  "use strict";

  var STORAGE_KEY = "site-lang";
  var state = { lang: localStorage.getItem(STORAGE_KEY) || "ru" };
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

  /* ---------- playable modal (reused by hero + project cards) ---------- */
  var modal = $("playerModal");
  var playerFrame = $("playerFrame");
  var playerTitle = $("playerModalTitle");
  var playerGenre = $("playerModalGenre");
  var playerOpenNewTab = $("playerOpenNewTab");
  var currentPlayableUrl = "";

  var playerPhone = modal.querySelector(".phone--lg");
  playerFrame.addEventListener("load", function () {
    playerPhone.classList.remove("is-loading");
  });

  function openPlayable(url, title, genre) {
    currentPlayableUrl = url;
    playerTitle.textContent = title;
    playerGenre.textContent = genre || "";
    playerPhone.classList.add("is-loading");
    playerFrame.src = url;
    playerOpenNewTab.href = url;
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }
  function closePlayable() {
    modal.close ? modal.close() : modal.removeAttribute("open");
    playerFrame.src = "about:blank";
  }
  $("playerRestart").addEventListener("click", function () {
    if (currentPlayableUrl) {
      playerPhone.classList.add("is-loading");
      playerFrame.src = currentPlayableUrl;
    }
  });
  $("playerClose").addEventListener("click", closePlayable);
  modal.addEventListener("click", function (e) {
    var box = modal.getBoundingClientRect();
    var inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
    if (!inside) closePlayable();
  });
  modal.addEventListener("cancel", function () {
    playerFrame.src = "about:blank";
  });

  /* ---------- defer heavy work off the page's own first paint ----------
     Unity WebGL startup (wasm instantiation, shader compile, GL context)
     is a genuinely heavy one-off hit on the main thread — kicking it off
     the instant a script runs competes with the page's own first paint
     and makes the whole page feel like it's lagging, not just the frame.
     Waiting for window.load, then an idle moment, means the page is done
     and quiet before any playable's startup cost lands. */
  function whenIdle(fn) {
    var run = function () {
      if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 2000 });
      else setTimeout(fn, 200);
    };
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run);
  }

  /* ---------- page load order: hero goes first, everyone else waits ----------
     The hero is the first thing a visitor sees, so it gets the network/CPU
     to itself; afterHeroLoads() lets the playables carousel (built later,
     in renderProjects) queue its own loading behind it instead of all four
     carousel iframes competing with the hero's load right out of the gate. */
  var HERO_URL = "https://yureck666.github.io/IdleMinerDemo/";
  var heroLoaded = false;
  var heroLoadWaiters = [];
  function afterHeroLoads(fn) {
    if (heroLoaded) fn();
    else heroLoadWaiters.push(fn);
  }
  function unblockAfterHero() {
    if (heroLoaded) return;
    heroLoaded = true;
    heroLoadWaiters.forEach(function (fn) { fn(); });
    heroLoadWaiters = [];
  }

  /* ---------- hero phone: preview loop while loading / off-screen ----------
     Same idea as the playables carousel below: a live iframe that isn't
     actually ready yet, or is sitting outside the viewport, is either
     showing nothing useful or wasting cost — so the muted preview loop
     covers both cases, swapping back (with a brief overlap so the
     iframe's repaint-after-hidden isn't visible as a black flash) once
     it's both loaded and on screen.
     Hidden with opacity, not display: display:none collapses the
     iframe's layout box (and so the canvas inside it) to 0x0, and the
     WebGL playable's still-ticking render loop then spams
     "GL_INVALID_FRAMEBUFFER_OPERATION: zero size" trying to draw into
     that. opacity keeps it sized — same cost, no error — and (see CSS)
     avoids visibility's own compositor-layer-recreation flash on top. */
  var heroPhone = $("heroPhone");
  var heroFrame = $("heroFrame");
  var heroPreview = $("heroPreview");
  if (heroPhone && heroFrame && heroPreview) {
    var heroReady = false;
    var heroOffscreen = false;
    var heroRevealTimer = null;
    function syncHero() {
      clearTimeout(heroRevealTimer);
      if (heroReady && !heroOffscreen) {
        // Freeze the mask on whatever frame it's already decoded *before*
        // the iframe goes visible, instead of leaving it decoding new
        // frames through the overlap: Unity's heavy WebGL/shader-compile
        // work lands on the GPU right as the iframe is revealed, and a
        // hardware video decoder starved by that contention can hand the
        // compositor a black frame for an instant — on top or not, a black
        // frame of the "mask" is still black. A paused frame has nothing
        // left to decode, so there's nothing for the GPU to starve.
        heroPreview.pause();
        heroFrame.style.opacity = "1";
        heroFrame.style.pointerEvents = "";
        // 450ms, not 150: the iframe's own load event fires once its HTML/JS
        // has downloaded, but Unity still needs a beat after that to actually
        // paint a real frame — too short an overlap here means a flash of
        // blank/black between "video gone" and "game actually drawing".
        heroRevealTimer = setTimeout(function () {
          heroPreview.style.display = "none";
        }, 450);
      } else {
        heroFrame.style.opacity = "0";
        heroFrame.style.pointerEvents = "none";
        heroPreview.style.display = "";
        heroPreview.play();
      }
    }
    syncHero(); // starts on the preview loop until the real frame loads
    heroFrame.addEventListener("load", function () {
      // Also fires for the "about:blank" unload below — ignore that one,
      // it's not the real game becoming ready.
      if (heroFrame.src === "about:blank") return;
      heroReady = true;
      heroPhone.classList.remove("is-loading");
      syncHero();
      unblockAfterHero();
    });
    new IntersectionObserver(function (obsEntries) {
      obsEntries.forEach(function (e) {
        var wasOffscreen = heroOffscreen;
        heroOffscreen = !e.isIntersecting;
        if (heroOffscreen && !wasOffscreen) {
          // Hiding it with opacity (see above) only stops the picture —
          // the game keeps running behind it, audio and all. Actually
          // unload it so sitting offscreen is silent too; reloaded fresh
          // on return below.
          heroReady = false;
          heroFrame.src = "about:blank";
        } else if (!heroOffscreen && wasOffscreen) {
          heroPhone.classList.add("is-loading");
          heroFrame.src = HERO_URL;
        }
        syncHero();
      });
    }).observe(heroPhone);
    whenIdle(function () { heroFrame.src = HERO_URL; }); // first in the queue, but only once the page itself is settled
    // Safety net: if the hero's load never fires (network hiccup, etc.),
    // don't leave the rest of the page's playables waiting on it forever.
    setTimeout(unblockAfterHero, 12000);
  } else {
    heroLoaded = true; // no hero on this page — nothing to wait for
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
    // Starts loading until setupPlayablesCarousel's startLoad() assigns a
    // real src and the iframe reports back, see there.
    var phone = el("div", { className: "phone phone--static is-loading" });
    phone.appendChild(el("div", { className: "phone__edge" }));
    var body = el("div", { className: "phone__body" });
    body.appendChild(el("div", { className: "phone__notch" }));
    var screen = el("div", { className: "phone__screen" });
    // No src yet — assigned by setupPlayablesCarousel, staggered so the
    // phones that aren't shown first don't all fight for bandwidth/CPU
    // at once on page load.
    var iframe = el("iframe", { title: p.title, allow: "accelerometer; gyroscope" });
    // Cheap stand-in for the inactive state: a muted looping clip instead
    // of a live (but hidden) iframe, so sitting inactive costs ~nothing.
    var video = el("video", { src: p.preview, muted: true, loop: true, playsInline: true, preload: "auto" });
    var selectBtn = el("button", { type: "button", className: "phone__select", "aria-label": p.ctaPlay + " " + p.title });
    var loader = el("div", { className: "phone__loader", "aria-hidden": "true" });
    screen.appendChild(iframe);
    screen.appendChild(video);
    screen.appendChild(selectBtn);
    screen.appendChild(loader);
    body.appendChild(screen);
    phone.appendChild(body);
    phone._iframe = iframe;
    phone._video = video;
    phone._selectBtn = selectBtn;
    return phone;
  }

  /* ---------- playables carousel ----------
     Every phone shows its real playable live and keeps running in the
     background. A phone's box (and the iframe inside it) is always
     260px wide — active/inactive is purely a transform: scale() in CSS,
     never a width change, so the row's height is rock solid and the
     iframe's content never has to notice a resize. Clicking one hands it
     the red "active" border, scales it up, and scrolls it to center; the
     phone that loses active status scales back down and reloads, so it's
     back to a clean start next time it's picked. Side padding equal to
     half the viewport (minus half a phone's width) is added so there's
     always room to scroll any phone to center, even when all of them
     already fit on screen without scrolling. */
  var PHONE_WIDTH = 260; // must match .phone width in styles.css

  function setupPlayablesCarousel(grid, entries, navButtons) {
    var activeIndex = -1;

    function layout() {
      var pad = Math.max(0, grid.clientWidth / 2 - PHONE_WIDTH / 2) + "px";
      grid.style.paddingLeft = pad;
      grid.style.paddingRight = pad;
    }

    function centerCard(card, instant) {
      var gridRect = grid.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var delta = (cardRect.left + cardRect.width / 2) - (gridRect.left + gridRect.width / 2);
      grid.scrollTo({ left: grid.scrollLeft + delta, behavior: (instant || prefersReducedMotion) ? "auto" : "smooth" });
    }

    // Points the iframe at url and tracks readiness; fires the pending
    // onReady callback (see below) once THIS navigation's load lands.
    function startLoad(entry, url) {
      entry._ready = false;
      entry.phone.classList.add("is-loading");
      entry.iframe.src = url;
      entry.iframe.onload = function () {
        entry._ready = true;
        entry.phone.classList.remove("is-loading");
        var cb = entry._onReady;
        entry._onReady = null;
        if (cb) cb();
      };
    }

    // Runs callback once entry's current load finishes — immediately if it
    // already has. Used by showIframe to know when it's safe to pull the
    // video away; showVideo cancels a pending one below (nothing left to
    // reveal once the phone's gone inactive again).
    function onReady(entry, callback) {
      if (entry._ready) callback();
      else entry._onReady = callback;
    }

    function loadEntry(entry, onDone) {
      entry._loaded = true; // reserved now so a second call can't double-trigger
      // Hero (top of page) gets the network/CPU first; everything here —
      // including the featured phone shown right away — queues behind it.
      // whenIdle gives the main thread a breather after whatever just
      // finished, rather than chaining the next heavy init instantly off
      // the previous one's load event.
      afterHeroLoads(function () {
        whenIdle(function () {
          startLoad(entry, entry.url);
          // A separate hook from onReady/_onReady above — this one drives
          // the background queue and must survive a showVideo() reset,
          // since the phone might get deactivated before its load lands.
          if (onDone) entry.iframe.addEventListener("load", onDone, { once: true });
        });
      });
    }

    // Starts the real src the first time — a fallback for when a phone
    // gets clicked before its turn in the background queue comes up.
    function ensureLoaded(entry) {
      if (!entry._loaded) loadEntry(entry, null);
    }

    // Swaps iframe->video. restart=true for an actual game switch (fresh
    // clip); omitted when just scrolling offscreen, where resuming the
    // clip wherever it was reads fine and there's no "new game" to signal.
    //
    // Hides the iframe with opacity, not display: display:none collapses
    // its layout box (and so the canvas inside it) to 0x0, and a WebGL
    // playable whose render loop is still ticking away behind it then spams
    // "GL_INVALID_FRAMEBUFFER_OPERATION: zero size" trying to draw into
    // that. opacity keeps the box (and canvas) its real size, so it still
    // just draws into a frame nobody sees — no error, same cost — and (see
    // CSS) avoids visibility's compositor-layer-recreation flash on top.
    function showVideo(entry, restart) {
      clearTimeout(entry._revealTimer);
      entry._onReady = null; // don't let a late load() from before yank the video away now
      entry.iframe.style.opacity = "0";
      entry.iframe.style.pointerEvents = "none";
      entry.video.style.display = "";
      if (restart) entry.video.currentTime = 0;
      entry.video.play();
    }

    // Swaps video->iframe. If the iframe isn't done loading yet (first
    // view, or still mid-reload from last time it was active), the video
    // keeps playing as a stand-in until it actually finishes — otherwise
    // a slow playable would show a blank/white iframe instead of motion.
    // Either way there's a short overlap after "ready" (see CSS z-index):
    // 450ms, not 150 — the load event fires once the HTML/JS is down, but
    // Unity still needs a beat after that to paint an actual frame, and a
    // too-short overlap just trades the flicker for a slightly later one.
    function showIframe(entry) {
      ensureLoaded(entry);
      entry.iframe.style.opacity = "1";
      entry.iframe.style.pointerEvents = "";
      clearTimeout(entry._revealTimer);
      onReady(entry, function () {
        // Freeze the mask the moment it's known the iframe is about to take
        // over, instead of leaving it decoding new frames through the
        // overlap: Unity's heavy WebGL/shader-compile work lands on the GPU
        // right as the iframe is revealed, and a hardware video decoder
        // starved by that contention can hand the compositor a black frame
        // for an instant — on top or not, a black "mask" frame is still
        // black. A paused frame has nothing left to decode, so there's
        // nothing for the GPU to starve.
        entry.video.pause();
        entry._revealTimer = setTimeout(function () {
          entry.video.style.display = "none";
        }, 450);
      });
    }

    function selectPlayable(index, opts) {
      opts = opts || {};
      var entry = entries[index];
      if (index !== activeIndex) {
        if (activeIndex !== -1) {
          var prev = entries[activeIndex];
          prev.phone.classList.remove("is-active");
          if (navButtons) navButtons[activeIndex].classList.remove("is-active");
          // Hidden (not just reloaded) so it stops costing anything while
          // inactive; reloaded too, so it's back to a clean start rather
          // than resuming mid-game next time it's picked. The reload runs
          // in the background behind display:none, invisible to the user.
          showVideo(prev, true);
          startLoad(prev, prev.url);
        }
        entry.phone.classList.add("is-active");
        if (navButtons) navButtons[index].classList.add("is-active");
        activeIndex = index;
        if (!isOffscreen) showIframe(entry);
      }
      centerCard(entry.card, opts.instant);
    }

    // Pause the active phone (and show its preview loop) while the whole
    // row is scrolled out of view, so walking away from it doesn't leave a
    // live game (and its audio) running unseen; reloads fresh on return,
    // same as switching games above — there's no "resume" once it's been
    // fully silenced.
    var isOffscreen = false;
    if (grid._carouselVisibility) grid._carouselVisibility.disconnect();
    var visibilityObserver = new IntersectionObserver(function (obsEntries) {
      obsEntries.forEach(function (e) {
        var wasOffscreen = isOffscreen;
        isOffscreen = !e.isIntersecting;
        if (activeIndex === -1) return;
        var active = entries[activeIndex];
        if (isOffscreen) {
          showVideo(active);
          if (!wasOffscreen) {
            // showVideo only swaps the picture — the iframe keeps running
            // (and making noise) behind it. Actually unload it so the row
            // is silent while scrolled away; startLoad below brings it
            // back fresh once it's back in view.
            active.iframe.src = "about:blank";
          }
        } else if (wasOffscreen) {
          startLoad(active, active.url);
          showIframe(active);
        }
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
        layout();
        if (activeIndex !== -1) centerCard(entries[activeIndex].card, true);
      }, 150);
    };
    window.addEventListener("resize", grid._carouselResize);

    var initial = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].featured) { initial = i; break; }
    }
    // Only the initially-active phone's iframe loads right away. The rest
    // start out hidden behind their preview clip and load strictly one at
    // a time — each only starts once the previous one's load event has
    // actually landed — instead of fixed timers (which can bunch up) or
    // all piling onto the network/CPU at once on page load.
    var queue = [];
    entries.forEach(function (entry, index) {
      if (index === initial) {
        entry.video.style.display = "none";
      } else {
        entry.iframe.style.opacity = "0";
        entry.iframe.style.pointerEvents = "none";
        entry.video.play();
        queue.push(entry);
      }
    });
    function loadNextQueued() {
      var next = queue.shift();
      if (!next) return;
      if (next._loaded) { loadNextQueued(); return; } // clicked early, already loading — skip
      loadEntry(next, loadNextQueued);
    }
    loadNextQueued();
    layout();
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
    var items = d.projects.playables;
    var featured = items.filter(function (p) { return p.featured; });
    var rest = items.filter(function (p) { return !p.featured; });
    var mid = Math.ceil(rest.length / 2);
    var ordered = rest.slice(0, mid).concat(featured, rest.slice(mid));
    var playableEntries = ordered.map(function (p) {
      var phone = buildPlayablePhone(p);
      var card = el("div", { className: "playable-card", "data-reveal": "" }, [
        phone,
        el("div", { className: "playable-card__caption" }, [
          el("div", { className: "playable-card__title", text: p.title }),
          el("div", { className: "playable-card__genre", text: p.genre })
        ])
      ]);
      playablesGrid.appendChild(card);
      return { card: card, phone: phone, iframe: phone._iframe, video: phone._video, selectBtn: phone._selectBtn, url: p.url, featured: !!p.featured };
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

    setupPlayablesCarousel(playablesGrid, playableEntries, navButtons);

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
