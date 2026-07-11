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

  // ── 環境配樂：作曲式循環（C – Am – F – G），柔和 pad + 卡林巴旋律 + 低音 + 輕脈動 ──
  var BPM = 72, BEAT = 60 / BPM, LOOP_BEATS = 16;
  var nextLoopTime = 0;
  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // 柔和 pad：多個微失諧正弦、慢起慢落、過低通，鋪出溫暖和弦底
  function pad(midis, when, dur, gain) {
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + 0.9);
    env.gain.setValueAtTime(gain, when + Math.max(1.0, dur - 1.0));
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    lp.connect(env); env.connect(master);
    var layers = [];
    midis.forEach(function (mi) { layers.push([mi, 0]); layers.push([mi, 0.004]); });
    var per = 0.9 / layers.length;
    layers.forEach(function (l) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = m2f(l[0]) * (1 + l[1]);
      var og = ctx.createGain(); og.gain.value = per;
      o.connect(og); og.connect(lp); o.start(when); o.stop(when + dur + 0.1);
    });
  }
  // 卡林巴（拇指琴）：正弦 + 泛音、快速衰減，溫暖撥音（很適合部落主題）
  function kalimba(midi, when, dur, gain) {
    var f = m2f(midi);
    [[1, gain], [2, gain * 0.25], [3, gain * 0.08]].forEach(function (p) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * p[0];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(p[1], when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(master); o.start(when); o.stop(when + dur + 0.05);
    });
  }
  function bassNote(midi, when, dur, gain) {
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = m2f(midi);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + dur + 0.05);
  }
  // 輕柔脈動（像遠處手鼓心跳，給一點律動）
  function pulse(when, gain) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.26);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.3);
  }

  var CHORDS = [
    { pad: [60, 64, 67], bass: 36 }, // C
    { pad: [57, 60, 64], bass: 45 }, // Am
    { pad: [53, 57, 60], bass: 41 }, // F
    { pad: [55, 59, 62], bass: 43 }  // G
  ];
  // 旋律：卡林巴，C 大調五聲，幾乎全落在當拍和弦內音（[beat, midi, durBeats]）
  var MELODY = [
    [0, 67, 1], [1.5, 72, 0.5], [2, 76, 1.5],
    [4, 72, 1], [5.5, 69, 0.5], [6, 76, 1.5],
    [8, 69, 1], [9.5, 72, 0.5], [10, 74, 1.5],
    [12, 74, 1], [13.5, 67, 0.5], [14, 71, 1.5]
  ];
  function scheduleLoop(startAt) {
    for (var b = 0; b < 4; b++) {
      var t = startAt + b * 4 * BEAT;
      pad(CHORDS[b].pad, t, 4 * BEAT + 0.1, 0.06);
      bassNote(CHORDS[b].bass, t, 4 * BEAT * 0.9, 0.09);
      pulse(t, 0.05); pulse(t + 2 * BEAT, 0.032);
    }
    MELODY.forEach(function (n) { kalimba(n[1], startAt + n[0] * BEAT, n[2] * BEAT * 1.15, 0.12); });
  }
  function loopTick() {
    if (!ambientOn) return;
    scheduleLoop(nextLoopTime);
    nextLoopTime += LOOP_BEATS * BEAT;
    ambientTimers.push(setTimeout(loopTick, LOOP_BEATS * BEAT * 1000 - 250)); // 提早排下一輪，無縫接
  }
  function startAmbient() {
    if (ambientOn || muted) return;
    if (!ensureCtx()) return;
    resume();
    ambientOn = true;
    nextLoopTime = t0() + 0.2;
    loopTick();
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
