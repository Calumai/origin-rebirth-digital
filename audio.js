/*
 * 《原地重生・返璞歸真》程序化配樂／音效（Web Audio API，零外部音檔）
 * ------------------------------------------------------------------
 * - 環境配樂：五聲音階（原住民風）笛聲 + 低頻手鼓 + 風聲氛圍，自由節奏、緩慢冥想感。
 * - 音效：按鈕、擲骰、抽牌、猜拳勝/敗、勝利、提示。
 * - 瀏覽器自動播放政策：AudioContext 於「第一次使用者互動」時才啟動。
 * - 右下角浮動靜音鈕，偏好記在 localStorage。
 * 全域出口：window.Sound = { sfx, toggleMute, startAmbient, isMuted }
 */
(function () {
  'use strict';

  var ctx = null, master = null;
  var ambientOn = false, ambientTimers = [];
  var muted = false;

  try { muted = localStorage.getItem('rebirthMuted') === '1'; } catch (e) {}

  // 五聲音階（大調五聲：Do Re Mi Sol La）半音位移
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
  var ROOT = 220; // A3
  function penta(i, octave) {
    var n = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length];
    return ROOT * Math.pow(2, (n + (octave || 0) * 12) / 12);
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function t0() { return ctx.currentTime; }

  // 單音：帶柔和進出的音符（笛/撥弦感）
  function tone(freq, when, dur, opts) {
    opts = opts || {};
    var type = opts.type || 'triangle';
    var peak = opts.gain == null ? 0.09 : opts.gain;
    var atk = opts.attack == null ? 0.04 : opts.attack;
    var rel = opts.release == null ? Math.max(0.12, dur * 0.6) : opts.release;
    var dest = opts.dest || master;

    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + rel);

    osc.connect(g); g.connect(dest);
    osc.start(when);
    osc.stop(when + dur + rel + 0.05);

    // 輕微顫音，讓笛聲活一點
    if (opts.vibrato) {
      var lfo = ctx.createOscillator(); lfo.frequency.value = 5;
      var lg = ctx.createGain(); lg.gain.value = freq * 0.006;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(when); lfo.stop(when + dur + rel + 0.05);
    }
  }

  // 低頻手鼓：一記悶悶的鼓點
  function thump(when, gain) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(55, when + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.12, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    osc.connect(g); g.connect(master);
    osc.start(when); osc.stop(when + 0.36);
  }

  // 噪音緩衝（風聲、鼓的敲擊質感、抽牌 swish 共用）
  var noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noiseSource() { var s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true; return s; }

  // 持續風聲氛圍（帶通噪音，很輕）
  var windNodes = null;
  function startWind() {
    if (windNodes) return;
    var s = noiseSource();
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
    var g = ctx.createGain(); g.gain.value = 0.0001;
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start();
    g.gain.exponentialRampToValueAtTime(0.016, t0() + 4);
    // 讓風聲音量緩慢起伏
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    var lg = ctx.createGain(); lg.gain.value = 0.01;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    windNodes = { s: s, g: g, lfo: lfo };
  }

  // 持續低音鋪底（根音 + 五度）
  var droneNodes = null;
  function startDrone() {
    if (droneNodes) return;
    var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
    var g = ctx.createGain(); g.gain.value = 0.0001;
    filt.connect(g); g.connect(master);
    var freqs = [110, 110 * Math.pow(2, 7 / 12)]; // A2 + E3
    var oscs = freqs.map(function (f) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      var og = ctx.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(filt); o.start();
      return o;
    });
    g.gain.exponentialRampToValueAtTime(0.05, t0() + 5);
    droneNodes = { g: g, oscs: oscs, filt: filt };
  }

  // 排一段旋律樂句（自由節奏）
  function schedulePhrase() {
    if (!ambientOn) return;
    var when = t0() + 0.1;
    var n = 1 + Math.floor(Math.random() * 3); // 1~3 音
    var idx = Math.floor(Math.random() * PENTA.length);
    for (var i = 0; i < n; i++) {
      if (Math.random() < 0.2) { idx += (Math.random() < 0.5 ? 1 : -1); continue; } // 偶爾休止
      idx += (Math.random() < 0.5 ? 1 : -1) * (Math.random() < 0.7 ? 1 : 2);
      var oct = Math.random() < 0.3 ? 1 : 0;
      var dur = 0.5 + Math.random() * 0.8;
      tone(penta(idx, 1 + oct), when, dur, { type: 'triangle', gain: 0.075, attack: 0.06, vibrato: true });
      when += dur * (0.7 + Math.random() * 0.6);
    }
    // 偶爾一記鼓
    if (Math.random() < 0.5) thump(t0() + 0.2 + Math.random() * 1.5, 0.09);

    var next = 2200 + Math.random() * 3200; // 2.2~5.4s 後再來一句
    ambientTimers.push(setTimeout(schedulePhrase, next));
  }

  function startAmbient() {
    if (ambientOn || muted) return;
    if (!ensureCtx()) return;
    resume();
    ambientOn = true;
    startDrone();
    startWind();
    schedulePhrase();
  }
  function stopAmbient() {
    ambientOn = false;
    ambientTimers.forEach(clearTimeout); ambientTimers = [];
  }

  // ── 音效 ─────────────────────────────────────────────
  function swish(when, up) {
    var s = noiseSource();
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(up ? 400 : 1600, when);
    bp.frequency.exponentialRampToValueAtTime(up ? 1800 : 500, when + 0.18);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(when); s.stop(when + 0.28);
  }
  function tick(when, freq, gain, dur) {
    var s = noiseSource();
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = freq || 2000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.06, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + (dur || 0.05));
    s.connect(hp); hp.connect(g); g.connect(master);
    s.start(when); s.stop(when + (dur || 0.05) + 0.02);
  }

  var SFX = {
    click: function () { tone(660, t0(), 0.04, { type: 'triangle', gain: 0.03, attack: 0.002, release: 0.05 }); },
    dice: function () {
      var s = t0();
      for (var i = 0; i < 4; i++) tick(s + i * 0.06, 2600, 0.05, 0.04); // 骰子滾動
      thump(s + 0.28, 0.13); // 落定
    },
    draw: function () { swish(t0(), true); },
    toast: function () { var s = t0(); tone(penta(2, 1), s, 0.18, { gain: 0.06 }); tone(penta(4, 1), s + 0.1, 0.28, { gain: 0.06 }); },
    build: function () { var s = t0(); thump(s, 0.14); tone(penta(0, 1), s + 0.05, 0.25, { gain: 0.08 }); tone(penta(2, 1), s + 0.16, 0.3, { gain: 0.08 }); },
    win: function () { var s = t0();[0, 2, 4].forEach(function (k, i) { tone(penta(k, 1), s + i * 0.09, 0.3, { gain: 0.09, vibrato: true }); }); },
    lose: function () { var s = t0();[4, 2, 0].forEach(function (k, i) { tone(penta(k, 0) * 0.98, s + i * 0.11, 0.34, { type: 'sine', gain: 0.07 }); }); },
    victory: function () {
      var s = t0();
      [0, 2, 4, 7].forEach(function (k, i) { tone(penta(k, 1), s + i * 0.12, 1.1, { gain: 0.1, vibrato: true, release: 0.9 }); });
      tone(penta(0, 0), s, 1.6, { type: 'sine', gain: 0.09, release: 1.2 });
      thump(s, 0.14); thump(s + 0.5, 0.1);
    }
  };
  function sfx(name) {
    if (muted) return;
    if (!ensureCtx()) return;
    resume();
    (SFX[name] || function () {})();
  }

  // ── 靜音切換 ──────────────────────────────────────────
  var toggleBtn = null;
  function updateBtn() {
    if (!toggleBtn) return;
    toggleBtn.textContent = muted ? '🔇' : '🔊';
    toggleBtn.setAttribute('aria-label', muted ? '開啟聲音' : '關閉聲音');
    toggleBtn.classList.toggle('is-muted', muted);
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('rebirthMuted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, t0(), 0.05);
    if (muted) stopAmbient(); else { ensureCtx(); resume(); startAmbient(); }
    updateBtn();
    return muted;
  }
  function makeToggle() {
    if (toggleBtn) return;
    toggleBtn = document.createElement('button');
    toggleBtn.className = 'audio-toggle';
    toggleBtn.type = 'button';
    toggleBtn.onclick = function (e) { e.stopPropagation(); ensureCtx(); resume(); toggleMute(); };
    document.body.appendChild(toggleBtn);
    updateBtn();
  }

  // 第一次互動：解鎖音訊 + 起配樂（若未靜音）
  function unlock() {
    ensureCtx(); resume();
    if (!muted) startAmbient();
  }
  document.addEventListener('pointerdown', function h() {
    unlock();
    document.removeEventListener('pointerdown', h);
  });
  // 一般按鈕點擊給個很輕的 tick（配樂鈕自己不觸發，見 stopPropagation）
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button');
    if (b && !b.classList.contains('audio-toggle')) sfx('click');
  });

  if (document.body) makeToggle();
  else document.addEventListener('DOMContentLoaded', makeToggle);

  window.Sound = { sfx: sfx, toggleMute: toggleMute, startAmbient: startAmbient, isMuted: function () { return muted; } };
})();
