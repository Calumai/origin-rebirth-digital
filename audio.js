/*
 * 《原地重生・返璞歸真》程序化配樂／音效（Web Audio API，零外部音檔）
 * ==================================================================
 * 「依遊戲狀態變化」的分層音樂系統（不是一直放同一首）：
 *   1. 主選單 menu：霧林電影感，以鐘琴、柔和撥弦與低頻風聲營造安靜空間。
 *   2. 選族 setup：稍有節奏的準備音樂；所有族群共用中性的選擇確認音。
 *   3. 對局桌 board：低存在感循環（3 首變體隨機輪播），低鼓、木琴、蟲鳴、風聲。
 *   4. 玩家互動 cue：交易/購卡/偷襲/建築/工藝/文化，各自一段短音疊上去。
 *   5. 公共事件卡 event：6 張各有專屬音效。
 *   6. 回合結束鐘聲；結算依勝/平/負播不同音樂。
 * 核心原則：卡牌需要「安靜思考時間」——底層循環很輕，互動發生時聲音才跳出來。
 *
 * 瀏覽器自動播放政策：AudioContext 於「第一次使用者互動」時才啟動。
 * 右下角浮動靜音鈕，偏好記在 localStorage。
 * 全域出口：window.Sound = {
 *   sfx, cue, event, tribe, scene, turnBell, toggleMute, startAmbient, isMuted
 * }
 */
(function () {
  'use strict';

  var ctx = null, master = null;
  var muted = true;

  try { muted = localStorage.getItem('rebirthMuted') !== '0'; } catch (e) {}

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
  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ── 基礎樂器／音色 ─────────────────────────────────────

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

  // 柔和 pad：多個微失諧正弦、慢起慢落、過低通，鋪出溫暖和弦底
  function pad(midis, when, dur, gain, cutoff) {
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff || 1300;
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

  // 口簧琴（Jaw harp）：方波經帶通快速掃描 + 快衰減，帶「嗡～當」的金屬彈性
  function jawHarp(midi, when, gain) {
    var f = m2f(midi);
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
    bp.frequency.setValueAtTime(f * 6, when);
    bp.frequency.exponentialRampToValueAtTime(f * 1.5, when + 0.28);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    o.connect(bp); bp.connect(g); g.connect(master);
    o.start(when); o.stop(when + 0.4);
  }

  // 木頭敲擊（Woodblock）：短促帶通噪音 + 一點高音撥點
  function woodblock(when, gain, pitch) {
    var s = noiseSource();
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8; bp.frequency.value = pitch || 900;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.09, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(when); s.stop(when + 0.1);
    tone(pitch || 900, when, 0.03, { type: 'square', gain: (gain || 0.09) * 0.4, attack: 0.001, release: 0.05 });
  }

  // 清脆敲擊（Bamboo clack）：比木頭清脆、音高偏高
  function bamboo(when, gain) {
    var s = noiseSource();
    var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 12; hp.frequency.value = 2100;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.07, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    s.connect(hp); hp.connect(g); g.connect(master);
    s.start(when); s.stop(when + 0.07);
    tone(1650, when, 0.04, { type: 'triangle', gain: (gain || 0.07) * 0.5, attack: 0.001, release: 0.06 });
  }

  // 低頻敲擊（Stone）：低沉、乾、短，帶悶悶的重量
  function stone(when, gain) {
    var s = noiseSource();
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.11, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    s.connect(lp); lp.connect(g); g.connect(master);
    s.start(when); s.stop(when + 0.16);
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(70, when + 0.1);
    var og = ctx.createGain(); og.gain.setValueAtTime((gain || 0.11) * 0.7, when);
    og.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    o.connect(og); og.connect(master); o.start(when); o.stop(when + 0.2);
  }

  // 低鼓（Drum）：比 thump 更緊實、帶敲擊質感
  function drum(when, gain, low) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(low ? 120 : 190, when);
    o.frequency.exponentialRampToValueAtTime(low ? 46 : 70, when + 0.1);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain || 0.13, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.26);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.3);
    // 敲擊瞬態
    var s = noiseSource();
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1;
    var sg = ctx.createGain(); sg.gain.setValueAtTime((gain || 0.13) * 0.5, when);
    sg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    s.connect(bp); bp.connect(sg); sg.connect(master); s.start(when); s.stop(when + 0.07);
  }

  // 鐘（Bell）：幾個非諧正弦疊出金屬泛音、長衰減（回合結束／豐收）
  function bell(midi, when, gain, dur) {
    var f = m2f(midi);
    dur = dur || 1.6;
    [[1, 1], [2.01, 0.5], [2.76, 0.28], [3.9, 0.15]].forEach(function (p) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * p[0];
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime((gain || 0.08) * p[1], when + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(master); o.start(when); o.stop(when + dur + 0.05);
    });
  }

  // 鳥鳴（Bird chirp）：高音正弦快速上滑再收（豐收季）
  function birdChirp(when, base, gain) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(base || 2200, when);
    o.frequency.exponentialRampToValueAtTime((base || 2200) * 1.5, when + 0.06);
    o.frequency.exponentialRampToValueAtTime((base || 2200) * 1.2, when + 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.16);
  }

  // 拍手（Clap）：一小簇帶通噪音（文化祭典）
  function clap(when, gain) {
    [0, 0.012, 0.024].forEach(function (off, i) {
      var s = noiseSource();
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.5;
      var g = ctx.createGain();
      g.gain.setValueAtTime((gain || 0.06) * (1 - i * 0.25), when + off);
      g.gain.exponentialRampToValueAtTime(0.0001, when + off + 0.05);
      s.connect(bp); bp.connect(g); g.connect(master); s.start(when + off); s.stop(when + off + 0.07);
    });
  }

  // 火焰劈啪（Fire crackle）：隨機小噪音爆點（夜間集會）
  function fireCrackle(when, count, gain) {
    for (var i = 0; i < (count || 6); i++) {
      var t = when + Math.random() * 0.9;
      var s = noiseSource();
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800 + Math.random() * 1500;
      var g = ctx.createGain();
      var pk = (gain || 0.05) * (0.4 + Math.random() * 0.6);
      g.gain.setValueAtTime(pk, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.03);
      s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.08);
    }
  }

  // 空靈人聲 pad（Airy voice）：帶共振峰的正弦群 + 慢顫，用於文化卡的「靈」感
  function airyVoice(midi, when, dur, gain) {
    var f = m2f(midi);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.value = f * 3;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain || 0.05, when + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    bp.connect(env); env.connect(master);
    [1, 2, 3].forEach(function (h, i) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * h;
      var og = ctx.createGain(); og.gain.value = [0.6, 0.3, 0.12][i];
      o.connect(og); og.connect(bp); o.start(when); o.stop(when + dur + 0.1);
      // 人聲般的輕顫音
      var lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      var lg = ctx.createGain(); lg.gain.value = f * h * 0.008;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(when); lfo.stop(when + dur + 0.1);
    });
  }

  // 高音蟲鳴 tick（board 夜間氛圍）
  function cricket(when, gain) {
    var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 5200 + Math.random() * 800;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain || 0.012, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.04);
  }

  // ── 持續氛圍層（風聲）：開場景時起、換場景時停 ─────────
  var textureNodes = [];
  function startWind(gain) {
    if (!ctx) return;
    var s = noiseSource();
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.value = 500;
    var g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(gain, t0(), 1.5);
    // 緩慢起伏，像風的呼吸
    var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
    var lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(bp.frequency);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(); lfo.start();
    textureNodes.push({ nodes: [s, lfo], gain: g });
  }
  function stopTextures() {
    var now = ctx ? t0() : 0;
    textureNodes.forEach(function (tx) {
      try {
        tx.gain.gain.cancelScheduledValues(now);
        tx.gain.gain.setTargetAtTime(0.0001, now, 0.4);
        tx.nodes.forEach(function (n) { try { n.stop(now + 1.2); } catch (e) {} });
      } catch (e) {}
    });
    textureNodes = [];
  }

  // ── 場景音樂引擎 ───────────────────────────────────────
  // 每個場景 = 一段可無縫循環的樂句；換場景時 token 遞增，讓排在半路的
  // loopTick 自動失效（避免兩個場景疊在一起）。
  var currentScene = 'menu';   // 期望場景（即使尚未解鎖也記著）
  var sceneToken = 0;
  var sceneTimer = null;
  var boardVariant = -1;       // board 上一個變體，避免立刻重複

  function clearSceneTimer() { if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null; } }

  // ── 各場景樂句（回傳此段長度秒數）──────────────────────

  // 主選單：霧林氛圍，極慢、稀疏
  var MENU_BPM = 60, MENU_BEAT = 60 / 60;
  var MENU_CHORDS = [[57, 60, 64], [55, 60, 64], [53, 57, 60], [55, 59, 62]]; // Am – Csus – F – G
  function playMenu(startAt) {
    var beat = MENU_BEAT, bars = 4, barBeats = 4;
    for (var b = 0; b < bars; b++) {
      var t = startAt + b * barBeats * beat;
      pad(MENU_CHORDS[b], t, barBeats * beat + 0.5, 0.05, 1100);
      bassNote(MENU_CHORDS[b][0] - 12, t, barBeats * beat * 0.9, 0.06);
      if (b % 2 === 0) pulse(t, 0.03); // 遠處心跳，很淡
    }
    // 零星卡林巴＋口簧琴點綴（自由感）
    kalimba(72, startAt + 1.5 * beat, beat, 0.08);
    kalimba(76, startAt + 3.5 * beat, beat * 1.4, 0.07);
    jawHarp(48, startAt + 6 * beat, 0.045);
    kalimba(69, startAt + 9 * beat, beat, 0.07);
    kalimba(74, startAt + 11.5 * beat, beat * 1.4, 0.07);
    jawHarp(50, startAt + 14 * beat, 0.04);
    return bars * barBeats * beat;
  }

  // 選族：稍有節奏的準備感
  var SETUP_BPM = 84, SETUP_BEAT = 60 / 84;
  var SETUP_CHORDS = [[60, 64, 67], [57, 60, 64]]; // C – Am
  var SETUP_MEL = [0, 76, 72, 74, 76, 79, 76, 72];
  function playSetup(startAt) {
    var beat = SETUP_BEAT, bars = 2, barBeats = 4;
    for (var b = 0; b < bars; b++) {
      var t = startAt + b * barBeats * beat;
      pad(SETUP_CHORDS[b], t, barBeats * beat + 0.2, 0.045, 1300);
      bassNote(SETUP_CHORDS[b][0] - 12, t, beat * 1.4, 0.07);
      // 輕木琴節奏
      woodblock(t + beat * 2, 0.04, 1100);
      pulse(t + beat * 2, 0.03);
    }
    // 一句準備旋律
    SETUP_MEL.forEach(function (mi, i) {
      if (mi) kalimba(mi, startAt + i * beat, beat * 0.9, 0.075);
    });
    return bars * barBeats * beat;
  }

  // 對局桌：3 首低存在感變體，隨機輪播
  var BOARD_BPM = 66, BOARD_BEAT = 60 / 66, BOARD_BARS = 4, BOARD_BAR_BEATS = 4;
  var BOARD_VARIANTS = [
    { // A：溫暖木琴主題（原作曲循環）
      chords: [{ pad: [60, 64, 67], bass: 36 }, { pad: [57, 60, 64], bass: 45 }, { pad: [53, 57, 60], bass: 41 }, { pad: [55, 59, 62], bass: 43 }],
      melody: [[0, 67, 1], [1.5, 72, 0.5], [2, 76, 1.5], [4, 72, 1], [5.5, 69, 0.5], [6, 76, 1.5],
               [8, 69, 1], [9.5, 72, 0.5], [10, 74, 1.5], [12, 74, 1], [13.5, 67, 0.5], [14, 71, 1.5]]
    },
    { // B：低音行進、旋律更疏（更冥想）
      chords: [{ pad: [57, 60, 64], bass: 33 }, { pad: [53, 57, 60], bass: 41 }, { pad: [55, 59, 62], bass: 43 }, { pad: [57, 60, 64], bass: 45 }],
      melody: [[0, 69, 2], [3, 72, 1], [6, 74, 2], [8, 72, 1.5], [11, 69, 1], [12, 76, 2], [15, 72, 1]]
    },
    { // C：幾乎只有 pad＋零星點，最安靜
      chords: [{ pad: [53, 57, 60], bass: 41 }, { pad: [55, 60, 64], bass: 43 }, { pad: [57, 60, 64], bass: 45 }, { pad: [52, 55, 60], bass: 40 }],
      melody: [[1, 76, 1.5], [5, 72, 1.5], [9, 79, 1.5], [13, 74, 1.5]]
    }
  ];
  function playBoard(startAt) {
    var beat = BOARD_BEAT;
    // 隨機挑一個變體（不立刻重複）
    var v;
    do { v = Math.floor(Math.random() * BOARD_VARIANTS.length); } while (BOARD_VARIANTS.length > 1 && v === boardVariant);
    boardVariant = v;
    var V = BOARD_VARIANTS[v];
    for (var b = 0; b < BOARD_BARS; b++) {
      var t = startAt + b * BOARD_BAR_BEATS * beat;
      pad(V.chords[b].pad, t, BOARD_BAR_BEATS * beat + 0.1, 0.05, 1200);
      bassNote(V.chords[b].bass, t, BOARD_BAR_BEATS * beat * 0.9, 0.075);
      pulse(t, 0.04); pulse(t + 2 * beat, 0.026);
    }
    V.melody.forEach(function (n) { kalimba(n[1], startAt + n[0] * beat, n[2] * beat * 1.15, 0.095); });
    // 夜間蟲鳴：零星散落，讓桌面有生命但不搶戲
    var loopLen = BOARD_BARS * BOARD_BAR_BEATS * beat;
    for (var c = 0; c < 5; c++) cricket(startAt + Math.random() * loopLen, 0.009 + Math.random() * 0.006);
    return loopLen;
  }

  // 結算床樂（勝/平/負）——短前奏＋輕柔循環尾韻
  function playVictoryBed(startAt) {
    var beat = 0.5;
    [60, 64, 67, 72].forEach(function (mi, i) { kalimba(mi, startAt + i * beat, beat * 1.2, 0.09); });
    pad([60, 64, 67], startAt, 4, 0.05, 1400);
    bassNote(36, startAt, 3.5, 0.08);
    drum(startAt, 0.1); drum(startAt + 2 * beat, 0.08);
    return 8 * beat; // 4 秒循環尾韻
  }
  function playTieBed(startAt) {
    pad([57, 60, 64, 67], startAt, 4.5, 0.05, 1300); // Am add — 溫和有餘韻
    bassNote(45, startAt, 4, 0.07);
    kalimba(72, startAt + 0.6, 1.2, 0.07); kalimba(76, startAt + 2.2, 1.4, 0.06);
    return 4.5;
  }
  function playDefeatBed(startAt) {
    // 低沉但有希望：小調鋪底，尾端解到大三度亮音
    pad([53, 57, 60], startAt, 4.5, 0.05, 1000);
    bassNote(41, startAt, 4, 0.07);
    kalimba(69, startAt + 0.5, 1.5, 0.07);
    kalimba(72, startAt + 2.2, 1.5, 0.07);
    kalimba(76, startAt + 3.6, 1.6, 0.06); // 一抹亮光
    return 4.5;
  }

  var SCENES = {
    menu: { play: playMenu, wind: 0.02 },
    setup: { play: playSetup, wind: 0.015 },
    board: { play: playBoard, wind: 0.016 },
    victory: { play: playVictoryBed, wind: 0.012 },
    tie: { play: playTieBed, wind: 0.012 },
    defeat: { play: playDefeatBed, wind: 0.014 }
  };

  var nextLoopTime = 0;
  function runScene(name) {
    clearSceneTimer();
    var def = SCENES[name];
    if (!def) return;
    var token = sceneToken;
    nextLoopTime = t0() + 0.15;
    (function tick() {
      if (token !== sceneToken) return;      // 場景已切換 → 停手
      var len = def.play(nextLoopTime);
      nextLoopTime += len;
      sceneTimer = setTimeout(tick, len * 1000 - 260); // 提早排下一輪，無縫接
    })();
  }

  // 對外：切換場景（menu/setup/board/victory/tie/defeat/none）
  function scene(name) {
    // 背景音樂已移除：保留 API 只記錄場景，避免 app.js 既有呼叫失效。
    currentScene = name;
    sceneToken++;
    clearSceneTimer();
    stopTextures();
  }

  // ── 玩家互動音效層（短音，疊在底層音樂上）──────────────
  var CUES = {
    // 交易：一段友善上行木琴
    trade: function () { var s = t0(); kalimba(72, s, 0.35, 0.11); kalimba(76, s + 0.12, 0.4, 0.1); },
    // 購卡：兩個明亮上升音
    buy: function () { var s = t0(); tone(penta(2, 1), s, 0.16, { gain: 0.08 }); tone(penta(4, 1), s + 0.12, 0.26, { gain: 0.09 }); },
    // 偷襲：低鼓 + 快速下行弦音（緊張）
    raid: function () {
      var s = t0(); drum(s, 0.15, true);
      [72, 69, 65, 62].forEach(function (mi, i) {
        tone(m2f(mi), s + 0.04 + i * 0.05, 0.12, { type: 'sawtooth', gain: 0.05, attack: 0.002, release: 0.1 });
      });
    },
    // 建築完成：明亮和弦（上行琶音）
    buildDone: function () {
      var s = t0(); thump(s, 0.12);
      [60, 64, 67, 72].forEach(function (mi, i) { kalimba(mi, s + i * 0.06, 0.5, 0.1); });
    },
    // 完成工藝：敲擊 + 一小段旋律
    craft: function () {
      var s = t0(); woodblock(s, 0.09, 1000);
      [67, 72, 76].forEach(function (mi, i) { kalimba(mi, s + 0.05 + i * 0.11, 0.4, 0.1); });
    },
    // 文化卡：空靈人聲 + 一縷笛音
    culture: function () {
      var s = t0(); airyVoice(72, s, 1.1, 0.05);
      tone(m2f(79), s + 0.15, 0.5, { type: 'triangle', gain: 0.06, vibrato: true, release: 0.5 });
    }
  };
  function cue(name) {
    if (muted || !ctx) return; resume();
    (CUES[name] || function () {})();
  }

  // ── 公共事件卡音效：既有事件有專屬音效，新事件使用中性提示音 ──
  var EVENT_SFX = {
    harvest: function () { // 豐收季：鳥叫、木琴、鈴聲
      var s = t0();
      birdChirp(s, 2200, 0.05); birdChirp(s + 0.18, 2600, 0.045); birdChirp(s + 0.32, 2000, 0.04);
      [72, 76, 79].forEach(function (mi, i) { kalimba(mi, s + 0.1 + i * 0.1, 0.5, 0.08); });
      bell(84, s + 0.2, 0.05, 1.2);
    },
    festival: function () { // 文化祭典：鼓聲、群體拍手
      var s = t0();
      [0, 0.22, 0.44, 0.66].forEach(function (o, i) { drum(s + o, i % 2 ? 0.1 : 0.14, i % 2 === 0); });
      clap(s + 0.11, 0.06); clap(s + 0.33, 0.06); clap(s + 0.55, 0.06);
    },
    roadblock: function () { // 山路封閉：低沉石頭聲
      var s = t0(); stone(s, 0.12); stone(s + 0.22, 0.1); stone(s + 0.4, 0.13);
      pad([48, 51, 55], s, 1.6, 0.04, 700);
    },
    craftrace: function () { // 工藝競賽：快速鼓點
      var s = t0();
      for (var i = 0; i < 7; i++) drum(s + i * 0.09, 0.09 + (i === 6 ? 0.06 : 0), i % 2 === 0);
    },
    reinforce: function () { // 家屋加固：木頭敲擊
      var s = t0(); woodblock(s, 0.1, 800); woodblock(s + 0.16, 0.09, 950); woodblock(s + 0.34, 0.11, 720);
    },
    nightgather: function () { // 夜間集會：火焰、低聲吟唱
      var s = t0(); fireCrackle(s, 8, 0.05);
      airyVoice(50, s, 1.6, 0.05); airyVoice(57, s + 0.1, 1.5, 0.04);
      drum(s + 0.3, 0.09, true);
    }
  };
  function event(id) {
    if (muted || !ctx) return; resume();
    (EVENT_SFX[id] || function () {
      var s = t0();
      woodblock(s, 0.07, 880);
      tone(m2f(72), s + 0.08, 0.28, { type: 'triangle', gain: 0.055, release: 0.25 });
      tone(m2f(76), s + 0.2, 0.34, { type: 'triangle', gain: 0.05, release: 0.3 });
    })();
  }

  // ── 選族確認音（所有族群共用，不把合成音色宣稱為特定族群聲音）──
  function tribe() {
    if (muted || !ctx) return; resume();
    var s = t0();
    // 上行音程只表示介面已確認選擇，不代表任何文化音樂。
    kalimba(72, s + 0.08, 0.3, 0.08); kalimba(76, s + 0.2, 0.4, 0.08);
  }

  // 回合結束：一記柔和鐘聲
  function turnBell() {
    if (muted || !ctx) return; resume();
    bell(79, t0(), 0.05, 1.3);
  }

  // ── 一次性音效（沿用舊 API 名稱，app.js 既有呼叫相容）──
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
    toggleBtn.textContent = muted ? 'OFF' : 'ON';
    toggleBtn.setAttribute('aria-label', muted ? '開啟聲音' : '關閉聲音');
    toggleBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
    toggleBtn.setAttribute('data-label', muted ? '聲音已關閉' : '聲音已開啟');
    toggleBtn.title = muted ? '聲音已關閉，點擊開啟' : '聲音已開啟，點擊靜音';
    toggleBtn.classList.toggle('is-muted', muted);
  }
  function restartCurrentScene() {
    // 重新播放目前場景（例如取消靜音後）
    var name = currentScene;
    sceneToken++;
    clearSceneTimer();
    stopTextures();
    if (muted || !ctx || name === 'none' || !SCENES[name]) return;
    resume();
    if (SCENES[name].wind) startWind(SCENES[name].wind);
    runScene(name);
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('rebirthMuted', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, t0(), 0.05);
    sceneToken++;
    clearSceneTimer();
    stopTextures();
    if (!muted) { ensureCtx(); resume(); }
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

  // 第一次互動：只解鎖短音效，不再啟動背景音樂。
  function unlock() {
    ensureCtx(); resume();
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

  // startAmbient 舊名保留：背景音樂已移除，因此這裡不做任何播放。
  function startAmbient() {}

  window.Sound = {
    sfx: sfx,
    cue: cue,
    event: event,
    tribe: tribe,
    scene: scene,
    turnBell: turnBell,
    toggleMute: toggleMute,
    startAmbient: startAmbient,
    isMuted: function () { return muted; }
  };
})();
