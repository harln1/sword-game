/* 검 강화하기 — 외부 라이브러리 없이 동작하는 단일 스크립트 */
(function () {
  'use strict';

  // ===================== 1. 규칙 설정값 =====================
  // 난이도 실험에서 바꾸는 값은 "decay"(단계당 성공률 감소폭) 하나뿐이고, 나머지는 고정이다.
  const CONFIG = Object.freeze({
    target: 10,          // 성공 조건: +10 도달
    maxLevel: 20,        // 계속 도전 최대 단계
    startGold: 15000,    // 시작 골드
    defaultDecay: 8,     // 난이도 값 기본: 단계당 성공률 감소폭(%p)
    decayOptions: [5, 6, 7, 8, 9, 10, 11],
    baseSuccess: 100,    // +0에서 성공 확률
    minSuccess: 15,      // 성공 확률 하한
    dropFrom: 5,         // 이 단계부터 실패 시 1단계 하락 (그 아래는 유지)
    destroyFrom: 6,      // 이 단계부터 파괴 가능
    destroyStep: 4,      // 단계당 파괴 확률 증가(%p)
    destroyMax: 30,      // 파괴 확률 상한
    costBase: 50,        // 강화 비용 = costBase + costStep × 단계
    costStep: 30,
    sellBase: 20,        // 판매가 = sellBase × sellRate^단계 (10G 단위 내림)
    sellRate: 1.8,
    historySize: 6,
    logLimit: 300,
  });

  const STORAGE_KEY = 'sword-enhance-save';
  const BACKUP_KEY = 'sword-enhance-save-corrupt-backup';
  const SCHEMA_VERSION = 1;

  function odds(level, decay) {
    const success = Math.max(CONFIG.minSuccess, CONFIG.baseSuccess - level * decay);
    const destroy = level < CONFIG.destroyFrom
      ? 0
      : Math.min(CONFIG.destroyMax, (level - CONFIG.destroyFrom + 1) * CONFIG.destroyStep);
    const fail = Math.max(0, 100 - success - destroy);
    return { success, fail, destroy, failType: level < CONFIG.dropFrom ? 'keep' : 'drop' };
  }
  const cost = (level) => CONFIG.costBase + CONFIG.costStep * level;
  const sellPrice = (level) =>
    level === 0 ? 0 : Math.floor((CONFIG.sellBase * Math.pow(CONFIG.sellRate, level)) / 10) * 10;

  // ===================== 2. 검 데이터와 SVG =====================
  const SWORDS = [
    { name: '낡은 나무 막대', blade: '#8b5a2b', edge: '#a87440', guard: '#5c3b1e', grip: '#3e2914' },
    { name: '나무검', blade: '#a77443', edge: '#c99460', guard: '#6b4423', grip: '#3e2914' },
    { name: '돌검', blade: '#7d838d', edge: '#a3a9b3', guard: '#5a5f68', grip: '#3e2914' },
    { name: '청동검', blade: '#b07a3a', edge: '#e0aa68', guard: '#7a4f1f', grip: '#4a2f17' },
    { name: '철검', blade: '#8f99a5', edge: '#c3cbd5', guard: '#5d6670', grip: '#2f2a26' },
    { name: '강철검', blade: '#aab6c4', edge: '#e3eaf2', guard: '#b8c2cf', grip: '#29323d' },
    { name: '은빛 기사검', blade: '#cfd8e3', edge: '#ffffff', guard: '#d4a017', grip: '#1e3a6e', gem: '#4aa3ff' },
    { name: '미스릴 검', blade: '#8fd3f0', edge: '#e6fbff', guard: '#c9d6e2', grip: '#1c3550', gem: '#7ff0ff', aura: '#7fe3ff' },
    { name: '수정 검', blade: '#b996ff', edge: '#f0e6ff', guard: '#e2d4ff', grip: '#3a2466', gem: '#e08bff', aura: '#c29bff' },
    { name: '화염 검', blade: '#ff7a33', edge: '#ffe0a3', guard: '#5a1d0b', grip: '#2b0e05', gem: '#ffd23f', aura: '#ff7a33', wings: true },
    { name: '용의 검', blade: '#f2b632', edge: '#fff3c4', guard: '#7a1f1f', grip: '#3a0d0d', gem: '#ff4040', aura: '#ffd24a', wings: true, stars: true },
    { name: '서리 용검', blade: '#7fcfff', edge: '#f2fbff', guard: '#1d4f7a', grip: '#0e2740', gem: '#bff4ff', aura: '#9fe0ff', wings: true, stars: true },
    { name: '천둥 검', blade: '#f6e05e', edge: '#fffbe0', guard: '#3b3f8f', grip: '#1c1f4a', gem: '#9fb4ff', aura: '#fff07a', wings: true, stars: true },
    { name: '심연 검', blade: '#6b4cff', edge: '#d6ccff', guard: '#1b1238', grip: '#0d0820', gem: '#ff3df2', aura: '#7a5cff', wings: true, stars: true },
    { name: '진홍 검', blade: '#ff4d6d', edge: '#ffd1da', guard: '#3a0a14', grip: '#1f050a', gem: '#ffe066', aura: '#ff4d6d', wings: true, stars: true },
    { name: '별빛 검', blade: '#a8ecff', edge: '#ffffff', guard: '#2a3a7a', grip: '#121a3d', gem: '#ffffff', aura: '#b8f2ff', wings: true, stars: true },
    { name: '태양 검', blade: '#ffb800', edge: '#fff6cc', guard: '#b33a00', grip: '#4d1a00', gem: '#ff5a00', aura: '#ffc93c', wings: true, stars: true },
    { name: '월광 검', blade: '#d9e2ff', edge: '#ffffff', guard: '#4a5694', grip: '#1f2547', gem: '#a9b8ff', aura: '#dfe6ff', wings: true, stars: true },
    { name: '혼돈의 검', blade: '#ff5cf0', edge: '#ffe0fb', guard: '#2b0b3a', grip: '#14051c', gem: '#5cfff1', aura: '#ff5cf0', wings: true, stars: true },
    { name: '신의 검', blade: '#fff0a8', edge: '#ffffff', guard: '#d4a017', grip: '#f5f5f5', gem: '#7cf0ff', aura: '#fff3b0', wings: true, stars: true },
    { name: '전설의 검', blade: 'rainbow', edge: '#ffffff', guard: '#ffd700', grip: '#222222', gem: '#ffffff', aura: '#ffffff', wings: true, stars: true },
  ];

  let svgUid = 0;
  function swordSVG(level) {
    const t = SWORDS[level];
    const id = 'sw' + (svgUid++);
    const lv = Math.min(level, 10);
    const tipY = 18 + (10 - lv) * 5;
    const half = 10 + lv * 0.7;
    const parts = [];
    const defs = [];

    if (t.blade === 'rainbow') {
      defs.push(`<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff6b6b"/><stop offset=".25" stop-color="#ffd93d"/>
        <stop offset=".5" stop-color="#6bff95"/><stop offset=".75" stop-color="#6bc8ff"/><stop offset="1" stop-color="#c77dff"/></linearGradient>`);
    } else {
      defs.push(`<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${t.blade}"/><stop offset=".5" stop-color="${t.blade}"/>
        <stop offset=".5" stop-color="${t.edge}"/><stop offset="1" stop-color="${t.blade}"/></linearGradient>`);
    }

    if (t.aura) {
      defs.push(`<radialGradient id="${id}a"><stop offset="0" stop-color="${t.aura}" stop-opacity=".9"/>
        <stop offset="1" stop-color="${t.aura}" stop-opacity="0"/></radialGradient>`);
      parts.push(`<ellipse class="aura" cx="50" cy="120" rx="48" ry="130" fill="url(#${id}a)"/>`);
    }

    if (level === 0) {
      // 나무 막대
      parts.push(`<rect x="43" y="48" width="14" height="165" rx="7" fill="${t.blade}" stroke="#4a2f17" stroke-width="2"/>`);
      parts.push(`<ellipse cx="48" cy="100" rx="2.5" ry="4" fill="#5c3b1e"/><ellipse cx="53" cy="160" rx="2" ry="3.5" fill="#5c3b1e"/>`);
      parts.push(`<rect x="42" y="213" width="16" height="50" rx="4" fill="${t.grip}"/>`);
    } else {
      // 칼날
      const tipShape = level <= 1
        ? `M50 ${tipY} Q${50 + half} ${tipY + 6} ${50 + half} ${tipY + 28}`
        : `M50 ${tipY} L${50 + half} ${tipY + 26}`;
      const leftTip = level <= 1
        ? `${50 - half} ${tipY + 28} Q${50 - half} ${tipY + 6} 50 ${tipY}`
        : `${50 - half} ${tipY + 26} Z`;
      parts.push(`<path d="${tipShape} L${50 + half} 200 L${50 - half} 200 L${leftTip}" fill="url(#${id}b)" stroke="rgba(0,0,0,.45)" stroke-width="1.5" stroke-linejoin="round"/>`);
      if (level >= 3) {
        parts.push(`<line x1="50" y1="${tipY + 34}" x2="50" y2="194" stroke="rgba(0,0,0,.28)" stroke-width="3" stroke-linecap="round"/>`);
      }
      if (level === 2) {
        parts.push(`<path d="M44 90 l6 8 l-3 10 M54 140 l-5 7" stroke="rgba(0,0,0,.35)" stroke-width="1.5" fill="none"/>`);
      }
      if (t.gem && level >= 6) {
        for (let i = 0; i < Math.min(5, level - 5); i++) {
          const y = 185 - i * 26;
          if (y > tipY + 36) parts.push(`<circle cx="50" cy="${y}" r="2.6" fill="${t.gem}" opacity=".95"/>`);
        }
      }
      if (t.wings) {
        parts.push(`<path d="M50 198 C28 196 14 186 6 170 C20 178 30 182 38 182 C30 176 26 168 24 160 C34 172 42 178 50 182 Z" fill="${t.guard}" stroke="rgba(0,0,0,.4)"/>`);
        parts.push(`<path d="M50 198 C72 196 86 186 94 170 C80 178 70 182 62 182 C70 176 74 168 76 160 C66 172 58 178 50 182 Z" fill="${t.guard}" stroke="rgba(0,0,0,.4)"/>`);
      }
      // 가드
      if (level < 3) {
        parts.push(`<rect x="32" y="199" width="36" height="10" rx="2" fill="${t.guard}" stroke="rgba(0,0,0,.4)"/>`);
      } else if (level < 6) {
        parts.push(`<rect x="22" y="198" width="56" height="11" rx="5.5" fill="${t.guard}" stroke="rgba(0,0,0,.4)"/>`);
      } else {
        parts.push(`<path d="M16 196 Q50 214 84 196 L84 206 Q50 222 16 206 Z" fill="${t.guard}" stroke="rgba(0,0,0,.4)"/>`);
      }
      if (t.gem) parts.push(`<circle cx="50" cy="205" r="5" fill="${t.gem}" stroke="rgba(0,0,0,.4)"/>`);
      // 손잡이
      parts.push(`<rect x="44" y="210" width="12" height="52" rx="3" fill="${t.grip}"/>`);
      for (let y = 216; y < 260; y += 8) {
        parts.push(`<line x1="44" y1="${y}" x2="56" y2="${y + 4}" stroke="rgba(255,255,255,.18)" stroke-width="2"/>`);
      }
    }
    // 폼멜
    parts.push(`<circle cx="50" cy="270" r="${level >= 6 ? 9 : 7}" fill="${level >= 6 ? t.guard : t.grip}" stroke="rgba(0,0,0,.4)"/>`);
    if (t.gem && level >= 6) parts.push(`<circle cx="50" cy="270" r="4" fill="${t.gem}"/>`);

    if (t.stars) {
      const star = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="#fff" opacity=".9"/>`;
      parts.push(star(20, 70, 6), star(82, 120, 5), star(26, 150, 4), star(76, 40, 4));
    }

    return `<svg viewBox="0 0 100 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="+${level} ${t.name}"><defs>${defs.join('')}</defs>${parts.join('')}</svg>`;
  }

  // ===================== 3. 저장 데이터 (보존 기록) =====================
  const prefersReduced = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  })();

  function defaultSave() {
    const codex = new Array(CONFIG.maxLevel + 1).fill(false);
    codex[0] = true;
    return {
      version: SCHEMA_VERSION,
      best: 0,
      clears: 0,
      plays: 0,
      totalDestroyed: 0,
      codex,
      settings: { mute: false, reduceMotion: prefersReduced, decay: CONFIG.defaultDecay },
      logs: [],
    };
  }

  const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

  function validLog(l) {
    return l && typeof l === 'object' &&
      isInt(l.no, 1, 1e9) && typeof l.date === 'string' && l.date.length < 40 &&
      isInt(l.decay, 1, 50) && (l.result === '성공' || l.result === '실패') &&
      typeof l.cause === 'string' && l.cause.length < 40 &&
      isInt(l.maxLevel, 0, CONFIG.maxLevel) && isInt(l.attempts, 0, 1e7) &&
      isInt(l.sells, 0, 1e7) && isInt(l.destroys, 0, 1e7) &&
      isInt(l.timeSec, 0, 1e8) && isInt(l.endGold, 0, 1e12);
  }

  // 반환: { data, status: 'ok' | 'empty' | 'repaired' | 'corrupt' | 'unavailable', detail }
  function loadSave() {
    let raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return { data: defaultSave(), status: 'unavailable', detail: '브라우저 저장소를 사용할 수 없어요.' };
    }
    if (raw === null || raw === '') {
      return { data: defaultSave(), status: 'empty', detail: '저장값이 없어 기본값으로 시작했어요.' };
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return corrupt(raw, 'JSON 형식이 아니에요.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return corrupt(raw, '객체가 아니에요.');
    if (parsed.version !== SCHEMA_VERSION) return corrupt(raw, '저장 형식 버전이 달라요.');

    const d = defaultSave();
    const fixed = [];
    const take = (key, ok) => {
      if (ok(parsed[key])) d[key] = parsed[key];
      else fixed.push(key);
    };
    take('best', (v) => isInt(v, 0, CONFIG.maxLevel));
    take('clears', (v) => isInt(v, 0, 1e9));
    take('plays', (v) => isInt(v, 0, 1e9));
    take('totalDestroyed', (v) => isInt(v, 0, 1e9));
    if (Array.isArray(parsed.codex) && parsed.codex.length === CONFIG.maxLevel + 1 && parsed.codex.every((x) => typeof x === 'boolean')) {
      d.codex = parsed.codex.slice();
      d.codex[0] = true;
    } else fixed.push('codex');
    const s = parsed.settings;
    if (s && typeof s === 'object') {
      if (typeof s.mute === 'boolean') d.settings.mute = s.mute; else fixed.push('settings.mute');
      if (typeof s.reduceMotion === 'boolean') d.settings.reduceMotion = s.reduceMotion; else fixed.push('settings.reduceMotion');
      if (CONFIG.decayOptions.includes(s.decay)) d.settings.decay = s.decay; else fixed.push('settings.decay');
    } else fixed.push('settings');
    if (Array.isArray(parsed.logs)) {
      const good = parsed.logs.filter(validLog);
      if (good.length !== parsed.logs.length) fixed.push('logs(' + (parsed.logs.length - good.length) + '건)');
      d.logs = good.slice(-CONFIG.logLimit);
    } else fixed.push('logs');
    // 도감과 최고 기록이 서로 맞지 않으면 최고 기록 기준으로 맞춘다
    for (let i = 0; i <= d.best; i++) d.codex[i] = true;

    if (fixed.length) {
      return { data: d, status: 'repaired', detail: '잘못된 항목을 기본값으로 고쳤어요: ' + fixed.join(', ') };
    }
    return { data: d, status: 'ok', detail: '정상적으로 불러왔어요.' };

    function corrupt(rawValue, why) {
      try { window.localStorage.setItem(BACKUP_KEY, String(rawValue).slice(0, 20000)); } catch (e) { /* 무시 */ }
      return { data: defaultSave(), status: 'corrupt', detail: '저장값이 손상되어 기본값으로 복구했어요. (' + why + ')' };
    }
  }

  let save;
  let saveFailed = false;
  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      saveFailed = false;
    } catch (e) {
      if (!saveFailed) showNotice('기록을 저장하지 못했어요. 게임은 계속할 수 있지만 새로고침하면 기록이 사라져요.', 'warn');
      saveFailed = true;
    }
  }

  // ===================== 4. 현재 판 상태 =====================
  function newRound() {
    return {
      level: 0,
      gold: CONFIG.startGold,
      attempts: 0,
      sells: 0,
      destroys: 0,
      drops: 0,
      maxLevel: 0,
      elapsedMs: 0,
      decay: save.settings.decay,
      cleared: false,
      logRef: null,
      lastLoss: null,     // { type: '파괴' | '하락' | '판매', level }
      history: [],
    };
  }

  const state = {
    phase: 'ready',       // ready | playing | paused | won | lost
    pauseReason: '',
    round: null,
    lastTick: performance.now(),
    lastShownSec: -1,
  };

  // 검사용 카운터
  const counters = { enhanceInputs: 0, enhanceProcessed: 0, enhanceRejected: 0, enhanceIgnored: 0 };
  const fxCount = { successEvents: 0, successFx: 0, successSkipped: 0, destroyEvents: 0, destroyFx: 0, destroySkipped: 0, sounds: 0, soundsMuted: 0 };

  // ===================== 5. DOM =====================
  const $ = (id) => document.getElementById(id);
  const el = {
    phase: $('phaseText'), gold: $('goldText'), time: $('timeText'), decay: $('decayText'),
    pauseBtn: $('pauseBtn'), notice: $('notice'), stage: $('stage'),
    swordWrap: $('swordWrap'), shards: $('shards'), level: $('levelText'), name: $('swordName'), result: $('resultText'),
    segS: $('segS'), segF: $('segF'), segD: $('segD'), oddS: $('oddS'), oddF: $('oddF'), oddD: $('oddD'), failLabel: $('failLabel'),
    enhanceBtn: $('enhanceBtn'), sellBtn: $('sellBtn'), costText: $('costText'), sellText: $('sellText'),
    overlay: $('overlay'), ovTitle: $('ovTitle'), ovBody: $('ovBody'), ovActions: $('ovActions'),
    roundMax: $('roundMax'), roundAttempts: $('roundAttempts'), roundSells: $('roundSells'), roundDestroys: $('roundDestroys'),
    history: $('history'), best: $('bestText'), clears: $('clearsText'), plays: $('playsText'), destroyed: $('destroyedText'),
    codex: $('codex'), codexCount: $('codexCount'),
    mute: $('muteToggle'), motion: $('motionToggle'),
    oddsTable: $('oddsTable'), tableDecay: $('tableDecay'),
    decaySelect: $('decaySelect'), decayNote: $('decayNote'), csvBtn: $('csvBtn'),
    summaryTable: $('summaryTable'), logTable: $('logTable'), logCount: $('logCount'),
    counterStats: $('counterStats'), fxStats: $('fxStats'), burstBtn: $('burstBtn'), burstResult: $('burstResult'),
    loadStatus: $('loadStatus'), showSaveBtn: $('showSaveBtn'), emptySaveBtn: $('emptySaveBtn'),
    corruptSaveBtn: $('corruptSaveBtn'), resetSaveBtn: $('resetSaveBtn'), saveView: $('saveView'),
  };

  const fmt = (n) => n.toLocaleString('ko-KR');
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showNotice(text, kind) {
    el.notice.className = 'notice' + (kind === 'info' ? ' info' : '');
    el.notice.innerHTML = '<span>' + escapeHTML(text) + '</span><button type="button" class="btn small" id="noticeClose">닫기</button>';
    el.notice.hidden = false;
    $('noticeClose').addEventListener('click', () => { el.notice.hidden = true; }, { once: true });
  }

  // ===================== 6. 소리 (Web Audio, 파일 없음) =====================
  let audioCtx = null;
  let master = null;
  const activeNodes = new Set();

  function ensureAudio() {
    if (audioCtx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = save.settings.mute ? 0 : 0.25;
      master.connect(audioCtx.destination);
      return true;
    } catch (e) {
      audioCtx = null;
      return false;
    }
  }

  function stopAllSounds() {
    activeNodes.forEach((n) => { try { n.stop(); } catch (e) { /* 이미 끝남 */ } });
    activeNodes.clear();
  }

  function tone(freq, start, dur, type, vol, endFreq) {
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    activeNodes.add(osc);
    osc.onended = () => { activeNodes.delete(osc); try { g.disconnect(); } catch (e) { /* 무시 */ } };
  }

  function noise(start, dur, vol) {
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(master);
    const t0 = audioCtx.currentTime + start;
    src.start(t0);
    activeNodes.add(src);
    src.onended = () => { activeNodes.delete(src); try { g.disconnect(); } catch (e) { /* 무시 */ } };
  }

  function playSound(kind) {
    if (save.settings.mute) { fxCount.soundsMuted++; return; }
    if (!ensureAudio()) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (kind === 'success') {
        tone(523, 0, 0.18, 'triangle', 0.6);
        tone(784, 0.09, 0.28, 'triangle', 0.6);
      } else if (kind === 'destroy') {
        noise(0, 0.45, 0.7);
        tone(180, 0, 0.5, 'sawtooth', 0.4, 50);
      }
      fxCount.sounds++;
    } catch (e) { /* 소리 실패는 게임에 영향 없음 */ }
  }

  // ===================== 7. 효과 (강화 성공, 파괴에서만 실행) =====================
  let fxTimers = [];

  function restartClass(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // 리플로우로 애니메이션 재시작
    node.classList.add(cls);
  }

  function fxSuccess() {
    fxCount.successEvents++;
    playSound('success');
    if (save.settings.reduceMotion) { fxCount.successSkipped++; return; }
    fxCount.successFx++;
    restartClass(el.swordWrap, 'fx-success');
    fxTimers.push(setTimeout(() => el.swordWrap.classList.remove('fx-success'), 600));
  }

  function fxDestroy() {
    fxCount.destroyEvents++;
    playSound('destroy');
    if (save.settings.reduceMotion) { fxCount.destroySkipped++; return; }
    fxCount.destroyFx++;
    restartClass(el.stage, 'fx-destroy');
    el.shards.textContent = '';
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('span');
      s.className = 'shard';
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      const dist = 90 + Math.random() * 60;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      el.shards.appendChild(s);
    }
    fxTimers.push(setTimeout(() => {
      el.stage.classList.remove('fx-destroy');
      el.shards.textContent = '';
    }, 750));
  }

  function stopAllEffects() {
    fxTimers.forEach(clearTimeout);
    fxTimers = [];
    el.swordWrap.classList.remove('fx-success');
    el.stage.classList.remove('fx-destroy');
    el.shards.textContent = '';
  }

  // ===================== 8. 게임 동작 =====================
  function pushHistory(icon, text) {
    const r = state.round;
    r.history.unshift(icon + ' ' + text);
    if (r.history.length > CONFIG.historySize) r.history.length = CONFIG.historySize;
  }

  function setResult(text, cls) {
    el.result.textContent = text;
    el.result.className = 'result' + (cls ? ' ' + cls : '');
  }

  function startGame() {
    stopAllEffects();
    state.round = newRound();
    state.phase = 'playing';
    state.pauseReason = '';
    state.lastTick = performance.now();
    state.lastShownSec = -1;
    setResult('강화를 시작하세요! 목표는 +' + CONFIG.target + '입니다.', '');
    updateDecayNote();
    render();
  }

  function enhance() {
    if (state.phase !== 'playing') { counters.enhanceIgnored++; renderTools(); return; }
    const r = state.round;
    if (r.level >= CONFIG.maxLevel) {
      counters.enhanceRejected++;
      setResult('최대 단계예요. 판매해서 골드로 바꿀 수 있어요.', 'warn');
      render();
      return;
    }
    const c = cost(r.level);
    if (r.gold < c) {
      counters.enhanceRejected++;
      setResult('골드가 부족해요! (필요 ' + fmt(c) + ' G) 검을 판매하세요.', 'warn');
      render();
      return;
    }
    counters.enhanceProcessed++;
    r.gold -= c;
    r.attempts++;
    const o = odds(r.level, r.decay);
    const roll = Math.random() * 100;
    const before = r.level;

    if (roll < o.success) {
      r.level++;
      if (r.level > r.maxLevel) r.maxLevel = r.level;
      setResult('강화 성공! +' + before + ' → +' + r.level, 'ok');
      pushHistory('✅', '+' + before + ' → +' + r.level + ' 성공');
      recordReach(r.level);
      fxSuccess();
    } else if (roll < o.success + o.fail) {
      if (o.failType === 'keep') {
        setResult('강화 실패… +' + r.level + ' 유지', 'warn');
        pushHistory('➖', '+' + r.level + ' 유지');
      } else {
        r.level--;
        r.drops++;
        r.lastLoss = { type: '하락', level: before };
        setResult('강화 실패! +' + before + ' → +' + r.level + ' 하락', 'warn');
        pushHistory('⬇️', '+' + before + ' → +' + r.level + ' 하락');
      }
    } else {
      r.level = 0;
      r.destroys++;
      r.lastLoss = { type: '파괴', level: before };
      save.totalDestroyed++;
      persist();
      setResult('검이 파괴되었어요! (+' + before + ') 나무 막대로 다시 시작해요.', 'bad');
      pushHistory('💥', '+' + before + ' 파괴');
      fxDestroy();
    }

    if (!r.cleared && r.level >= CONFIG.target) {
      winGame();
      return;
    }
    if (r.cleared && r.level >= CONFIG.maxLevel) {
      endChallenge('전설의 검 완성');
      return;
    }
    checkBankrupt();
    render();
  }

  function sell() {
    if (state.phase !== 'playing') return;
    const r = state.round;
    if (r.level === 0) {
      setResult('+0 나무 막대는 팔 수 없어요.', 'warn');
      render();
      return;
    }
    const price = sellPrice(r.level);
    const sold = r.level;
    r.gold += price;
    r.sells++;
    r.lastLoss = { type: '판매', level: sold };
    r.level = 0;
    setResult('+' + sold + ' ' + SWORDS[sold].name + ' 판매 → +' + fmt(price) + ' G', 'money');
    pushHistory('💰', '+' + sold + ' 판매 +' + fmt(price) + ' G');
    checkBankrupt();
    render();
  }

  function recordReach(level) {
    let changed = false;
    if (!save.codex[level]) { save.codex[level] = true; changed = true; }
    if (level > save.best) { save.best = level; changed = true; }
    if (changed) persist();
  }

  function checkBankrupt() {
    const r = state.round;
    if (state.phase !== 'playing') return;
    if (r.level === 0 && r.gold < cost(0)) {
      if (r.cleared) endChallenge('골드 소진');
      else loseGame();
    } else if (r.level > 0 && r.gold < cost(r.level)) {
      setResult(el.result.textContent + ' — 골드가 부족해요. 판매하세요!', el.result.className.replace('result', '').trim());
    }
  }

  function failCause(r) {
    if (!r.lastLoss) return '골드 소진';
    if (r.lastLoss.type === '파괴') return '+' + r.lastLoss.level + ' 파괴';
    if (r.lastLoss.type === '하락') return '하락 반복';
    return '판매 후 골드 부족';
  }

  function nowString() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function writeLog(result, cause) {
    const r = state.round;
    const last = save.logs.length ? save.logs[save.logs.length - 1].no : 0;
    const entry = {
      no: last + 1,
      date: nowString(),
      decay: r.decay,
      result,
      cause,
      maxLevel: r.maxLevel,
      attempts: r.attempts,
      sells: r.sells,
      destroys: r.destroys,
      timeSec: Math.round(r.elapsedMs / 1000),
      endGold: r.gold,
    };
    save.logs.push(entry);
    if (save.logs.length > CONFIG.logLimit) save.logs.splice(0, save.logs.length - CONFIG.logLimit);
    save.plays++;
    r.logRef = entry;
    persist();
    renderRecords();
  }

  function winGame() {
    const r = state.round;
    r.cleared = true;
    state.phase = 'won';
    save.clears++;
    writeLog('성공', '+' + CONFIG.target + ' 달성');
    render();
  }

  function loseGame() {
    state.phase = 'lost';
    writeLog('실패', failCause(state.round));
    render();
  }

  function continueChallenge() {
    if (state.phase !== 'won' || !state.round.cleared || state.round.level >= CONFIG.maxLevel) return;
    state.phase = 'playing';
    state.lastTick = performance.now();
    setResult('계속 도전! 최고 기록을 노려 보세요.', '');
    checkBankrupt();
    render();
  }

  function endChallenge(reason) {
    const r = state.round;
    state.phase = 'lost';
    state.round.challengeEnd = reason;
    if (r.logRef) {
      r.logRef.maxLevel = r.maxLevel;
      r.logRef.attempts = r.attempts;
      r.logRef.sells = r.sells;
      r.logRef.destroys = r.destroys;
      r.logRef.timeSec = Math.round(r.elapsedMs / 1000);
      r.logRef.endGold = r.gold;
      persist();
      renderRecords();
    }
    render();
  }

  function pause(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'paused';
    state.pauseReason = reason;
    stopAllEffects();
    render();
  }

  function resume() {
    if (state.phase !== 'paused') return;
    state.phase = 'playing';
    state.pauseReason = '';
    state.lastTick = performance.now();
    render();
  }

  function togglePause() {
    if (state.phase === 'playing') pause('직접 일시정지했어요.');
    else if (state.phase === 'paused') resume();
  }

  // ===================== 9. 화면 그리기 =====================
  const PHASE_LABEL = { ready: '준비', playing: '진행 중', paused: '일시정지', won: '성공', lost: '실패' };
  let lastSwordLevel = -1;

  function render() {
    const r = state.round;
    const level = r ? r.level : 0;
    const gold = r ? r.gold : CONFIG.startGold;
    const decay = r ? r.decay : save.settings.decay;

    el.phase.textContent = r && r.challengeEnd ? '도전 종료' : PHASE_LABEL[state.phase];
    el.gold.textContent = fmt(gold) + ' G';
    el.time.textContent = fmtTime(r ? r.elapsedMs : 0);
    el.decay.textContent = String(decay);
    el.pauseBtn.textContent = state.phase === 'paused' ? '계속하기 (P)' : '일시정지 (P)';
    el.pauseBtn.disabled = !(state.phase === 'playing' || state.phase === 'paused');

    if (level !== lastSwordLevel) {
      el.swordWrap.innerHTML = swordSVG(level);
      lastSwordLevel = level;
    }
    el.level.textContent = '+' + level;
    el.name.textContent = SWORDS[level].name;

    const o = odds(level, decay);
    const atMax = level >= CONFIG.maxLevel;
    el.segS.style.width = (atMax ? 0 : o.success) + '%';
    el.segF.style.width = (atMax ? 0 : o.fail) + '%';
    el.segD.style.width = (atMax ? 0 : o.destroy) + '%';
    el.oddS.textContent = (atMax ? 0 : o.success) + '%';
    el.oddF.textContent = (atMax ? 0 : o.fail) + '%';
    el.oddD.textContent = (atMax ? 0 : o.destroy) + '%';
    el.failLabel.textContent = o.failType === 'keep' ? '유지' : '하락';

    const playing = state.phase === 'playing';
    el.costText.textContent = atMax ? '최대 단계' : '비용 ' + fmt(cost(level)) + ' G';
    el.sellText.textContent = '판매가 ' + fmt(sellPrice(level)) + ' G';
    el.enhanceBtn.disabled = !playing;
    el.sellBtn.disabled = !playing || level === 0;

    el.roundMax.textContent = '+' + (r ? r.maxLevel : 0);
    el.roundAttempts.textContent = (r ? r.attempts : 0) + '회';
    el.roundSells.textContent = (r ? r.sells : 0) + '회';
    el.roundDestroys.textContent = (r ? r.destroys : 0) + '회';
    el.history.innerHTML = r && r.history.length
      ? r.history.map((h) => '<li>' + escapeHTML(h) + '</li>').join('')
      : '<li>아직 결과가 없어요.</li>';

    renderSaved();
    renderOverlay();
    renderTools();
  }

  function renderSaved() {
    el.best.textContent = '+' + save.best;
    el.clears.textContent = save.clears + '회';
    el.plays.textContent = save.plays + '판';
    el.destroyed.textContent = save.totalDestroyed + '회';
    const cells = el.codex.children;
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      const on = save.codex[i];
      if (on) count++;
      cells[i].classList.toggle('locked', !on);
      cells[i].title = on ? '+' + i + ' ' + SWORDS[i].name : '+' + i + ' ???';
    }
    el.codexCount.textContent = count + ' / ' + (CONFIG.maxLevel + 1);
    el.mute.checked = save.settings.mute;
    el.motion.checked = save.settings.reduceMotion;
    document.body.classList.toggle('reduce-motion', save.settings.reduceMotion);
  }

  function button(label, onClick, primary) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (primary ? ' primary' : '');
    b.innerHTML = label;
    b.addEventListener('click', onClick);
    return b;
  }

  let lastOverlayKey = '';
  function renderOverlay() {
    const r = state.round;
    const key = state.phase + '|' + state.pauseReason + '|' + (r && r.challengeEnd ? 'c' : '');
    if (state.phase === 'playing') {
      el.overlay.hidden = true;
      lastOverlayKey = key;
      return;
    }
    el.overlay.hidden = false;
    if (key === lastOverlayKey) return;
    lastOverlayKey = key;
    el.ovActions.textContent = '';

    if (state.phase === 'ready') {
      el.ovTitle.textContent = '⚔ 검 강화하기';
      el.ovBody.innerHTML =
        '<p>검을 <b>+' + CONFIG.target + '</b>까지 강화하면 성공!</p>' +
        '<p>골드가 바닥나고 팔 검도 없으면 <b>파산</b>이에요.</p>' +
        '<p>시작 골드 <b>' + fmt(CONFIG.startGold) + ' G</b> · 난이도 값 <b>' + save.settings.decay + '</b></p>';
      el.ovActions.appendChild(button('게임 시작 <kbd>Enter</kbd>', startGame, true));
    } else if (state.phase === 'paused') {
      el.ovTitle.textContent = '⏸ 일시정지';
      el.ovBody.innerHTML =
        '<p>' + escapeHTML(state.pauseReason) + '</p>' +
        '<p>시간이 멈췄고, 입력은 반영되지 않아요.</p>' +
        '<p>경과 시간 <b>' + fmtTime(r.elapsedMs) + '</b> · 현재 <b>+' + r.level + '</b> · <b>' + fmt(r.gold) + ' G</b></p>';
      el.ovActions.appendChild(button('계속하기 <kbd>Enter</kbd>', resume, true));
      el.ovActions.appendChild(button('처음부터 <kbd>R</kbd>', startGame));
    } else if (state.phase === 'won') {
      el.ovTitle.textContent = '🎉 성공! +' + CONFIG.target + ' 달성';
      el.ovBody.innerHTML =
        '<p><b>' + escapeHTML(SWORDS[r.level].name) + '</b>을(를) 완성했어요.</p>' +
        '<p>강화 <b>' + r.attempts + '회</b> · 판매 <b>' + r.sells + '회</b> · 파괴 <b>' + r.destroys + '회</b></p>' +
        '<p>시간 <b>' + fmtTime(r.elapsedMs) + '</b> · 남은 골드 <b>' + fmt(r.gold) + ' G</b></p>';
      el.ovActions.appendChild(button('새 게임 <kbd>Enter</kbd>', startGame, true));
      el.ovActions.appendChild(button('계속 도전 <kbd>C</kbd>', continueChallenge));
    } else if (state.phase === 'lost') {
      if (r.challengeEnd) {
        el.ovTitle.textContent = '🏁 도전 종료';
        el.ovBody.innerHTML =
          '<p>' + escapeHTML(r.challengeEnd) + ' · 이번 판 최고 <b>+' + r.maxLevel + '</b></p>' +
          '<p>강화 <b>' + r.attempts + '회</b> · 시간 <b>' + fmtTime(r.elapsedMs) + '</b></p>';
      } else {
        el.ovTitle.textContent = '💸 실패 — 파산';
        el.ovBody.innerHTML =
          '<p>원인: <b>' + escapeHTML(failCause(r)) + '</b></p>' +
          '<p>이번 판 최고 <b>+' + r.maxLevel + '</b> · 강화 <b>' + r.attempts + '회</b> · 파괴 <b>' + r.destroys + '회</b></p>' +
          '<p>시간 <b>' + fmtTime(r.elapsedMs) + '</b></p>';
      }
      el.ovActions.appendChild(button('다시 시작 <kbd>Enter</kbd>', startGame, true));
    }
  }

  function renderOddsTable() {
    const decay = save.settings.decay;
    el.tableDecay.textContent = '(난이도 값 ' + decay + ' 기준)';
    let html = '<thead><tr><th>현재 단계</th><th>강화 비용</th><th>성공</th><th>실패</th><th>실패하면</th><th>파괴</th><th>판매가</th></tr></thead><tbody>';
    for (let l = 0; l < CONFIG.maxLevel; l++) {
      const o = odds(l, decay);
      html += '<tr class="' + (l + 1 === CONFIG.target ? 'target' : '') + '"><td>+' + l + ' → +' + (l + 1) + '</td><td>' + fmt(cost(l)) +
        ' G</td><td>' + o.success + '%</td><td>' + o.fail + '%</td><td>' + (o.failType === 'keep' ? '유지' : '1단계 하락') +
        '</td><td>' + o.destroy + '%</td><td>' + fmt(sellPrice(l)) + ' G</td></tr>';
    }
    el.oddsTable.innerHTML = html + '</tbody>';
  }

  // ----- 기록표 -----
  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  const range = (arr) => (arr.length ? Math.min(...arr) + '~' + Math.max(...arr) : '-');

  function renderRecords() {
    const logs = save.logs;
    el.logCount.textContent = logs.length + '판';
    const groups = {};
    logs.forEach((l) => { (groups[l.decay] = groups[l.decay] || []).push(l); });
    const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);
    let s = '<thead><tr><th>난이도 값</th><th>판 수</th><th>성공</th><th>성공률</th><th>강화 시도 중앙값 (범위)</th><th>플레이 시간 중앙값 (범위, 초)</th><th>최고 단계 중앙값</th><th>실패 원인</th></tr></thead><tbody>';
    if (!keys.length) s += '<tr><td colspan="8">아직 기록이 없어요. 한 판을 끝내면 여기에 쌓여요.</td></tr>';
    keys.forEach((k) => {
      const g = groups[k];
      const wins = g.filter((l) => l.result === '성공').length;
      const att = g.map((l) => l.attempts);
      const t = g.map((l) => l.timeSec);
      const causes = {};
      g.filter((l) => l.result === '실패').forEach((l) => {
        const c = l.cause.indexOf('파괴') >= 0 ? '파괴' : l.cause;
        causes[c] = (causes[c] || 0) + 1;
      });
      const causeText = Object.keys(causes).map((c) => c + ' ' + causes[c]).join(', ') || '-';
      s += '<tr><td>' + k + '</td><td>' + g.length + '</td><td>' + wins + '</td><td>' + Math.round((wins / g.length) * 100) + '%</td><td>' +
        median(att) + ' (' + range(att) + ')</td><td>' + median(t) + ' (' + range(t) + ')</td><td>+' +
        median(g.map((l) => l.maxLevel)) + '</td><td>' + escapeHTML(causeText) + '</td></tr>';
    });
    el.summaryTable.innerHTML = s + '</tbody>';

    let h = '<thead><tr><th>#</th><th>날짜</th><th>난이도 값</th><th>결과</th><th>원인</th><th>최고 단계</th><th>강화 시도</th><th>판매</th><th>파괴</th><th>시간</th><th>남은 골드</th></tr></thead><tbody>';
    if (!logs.length) h += '<tr><td colspan="11">기록 없음</td></tr>';
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      h += '<tr><td>' + l.no + '</td><td>' + escapeHTML(l.date) + '</td><td>' + l.decay + '</td><td class="' + (l.result === '성공' ? 'win' : 'lose') + '">' +
        l.result + '</td><td>' + escapeHTML(l.cause) + '</td><td>+' + l.maxLevel + '</td><td>' + l.attempts + '</td><td>' + l.sells +
        '</td><td>' + l.destroys + '</td><td>' + fmtTime(l.timeSec * 1000) + '</td><td>' + fmt(l.endGold) + '</td></tr>';
    }
    el.logTable.innerHTML = h + '</tbody>';
  }

  function exportCSV() {
    const head = ['번호', '날짜', '난이도값', '결과', '원인', '최고단계', '강화시도', '판매', '파괴', '플레이시간(초)', '남은골드'];
    const rows = save.logs.map((l) => [l.no, l.date, l.decay, l.result, l.cause, l.maxLevel, l.attempts, l.sells, l.destroys, l.timeSec, l.endGold]);
    const csv = '﻿' + [head].concat(rows).map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sword-play-records.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ----- 검사 도구 -----
  function renderTools() {
    el.counterStats.innerHTML =
      '<div><dt>강화 입력 이벤트</dt><dd>' + counters.enhanceInputs + '</dd></div>' +
      '<div><dt>강화 처리(시도)</dt><dd>' + counters.enhanceProcessed + '</dd></div>' +
      '<div><dt>골드 부족 등 거절</dt><dd>' + counters.enhanceRejected + '</dd></div>' +
      '<div><dt>진행 중 아님(무시)</dt><dd>' + counters.enhanceIgnored + '</dd></div>';
    el.fxStats.innerHTML =
      '<div><dt>성공 이벤트</dt><dd>' + fxCount.successEvents + '</dd></div>' +
      '<div><dt>성공 효과 실행</dt><dd>' + fxCount.successFx + '</dd></div>' +
      '<div><dt>파괴 이벤트</dt><dd>' + fxCount.destroyEvents + '</dd></div>' +
      '<div><dt>파괴 효과 실행</dt><dd>' + fxCount.destroyFx + '</dd></div>' +
      '<div><dt>움직임 줄이기로 생략</dt><dd>' + (fxCount.successSkipped + fxCount.destroySkipped) + '</dd></div>' +
      '<div><dt>소리 재생 / 음소거 생략</dt><dd>' + fxCount.sounds + ' / ' + fxCount.soundsMuted + '</dd></div>';
  }

  function burstTest() {
    if (state.phase !== 'playing') {
      el.burstResult.textContent = '게임이 진행 중일 때만 검사할 수 있어요. 먼저 게임을 시작하세요.';
      return;
    }
    el.burstBtn.disabled = true;
    const before = { ...counters, attempts: state.round.attempts };
    let sent = 0;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
        sent++;
      }, i * 90);
    }
    setTimeout(() => {
      const inputs = counters.enhanceInputs - before.enhanceInputs;
      const done = counters.enhanceProcessed - before.enhanceProcessed;
      const rej = counters.enhanceRejected - before.enhanceRejected;
      const ign = counters.enhanceIgnored - before.enhanceIgnored;
      const att = (state.round ? state.round.attempts : 0) - before.attempts;
      const pass = sent === 10 && inputs === 10 && done + rej + ign === 10 && att === done;
      el.burstResult.textContent = (pass ? '통과 ✅ ' : '확인 필요 ⚠️ ') +
        '보낸 이벤트 ' + sent + '건 → 입력 ' + inputs + '건, 강화 처리 ' + done + '건, 거절 ' + rej + '건, 무시 ' + ign + '건 (강화 시도 +' + att + ')';
      el.burstBtn.disabled = false;
    }, 1000);
  }

  let resetArmed = false;
  let resetTimer = null;
  function resetSaveData() {
    if (!resetArmed) {
      resetArmed = true;
      el.resetSaveBtn.textContent = '정말 지울까요? 한 번 더 누르세요';
      resetTimer = setTimeout(() => { resetArmed = false; el.resetSaveBtn.textContent = '저장 데이터 전체 초기화'; }, 3000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    el.resetSaveBtn.textContent = '저장 데이터 전체 초기화';
    save = defaultSave();
    persist();
    state.phase = 'ready';
    state.round = null;
    lastOverlayKey = '';
    setResult('저장 데이터를 초기화했어요.', '');
    refreshAll();
    showNotice('저장 데이터(최고 기록, 도감, 설정, 플레이 기록)를 기본값으로 초기화했어요.', 'info');
  }

  function refreshAll() {
    renderOddsTable();
    renderRecords();
    el.decaySelect.value = String(save.settings.decay);
    updateDecayNote();
    render();
  }

  function updateDecayNote() {
    const cur = state.round ? state.round.decay : save.settings.decay;
    el.decayNote.textContent = cur === save.settings.decay
      ? '바꾸면 다음 판부터 적용돼요.'
      : '현재 판은 ' + cur + ', 다음 판부터 ' + save.settings.decay + '이(가) 적용돼요.';
  }

  // ===================== 10. 입력 =====================
  function isFormField(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  }

  function onKeyDown(e) {
    if (isFormField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    let handled = true;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        // 꾹 누르면 키보드 반복 입력 이벤트마다 강화 1회씩 (이벤트 1건 = 강화 1회)
        counters.enhanceInputs++;
        enhance();
        return;
      case 'KeyS':
        sell(); // 꾹 누르면 반복 입력 이벤트마다 판매 1회
        break;
      case 'KeyP':
      case 'Escape':
        if (!e.repeat) togglePause();
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (e.repeat) break;
        if (state.phase === 'ready' || state.phase === 'won' || state.phase === 'lost') startGame();
        else if (state.phase === 'paused') resume();
        else handled = false;
        break;
      case 'KeyR':
        if (!e.repeat && state.phase !== 'playing') startGame();
        break;
      case 'KeyC':
        if (!e.repeat) continueChallenge();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  }

  // 버튼에 포커스가 있을 때 Space/Enter가 버튼 클릭까지 일으켜 두 번 반영되는 것을 막는다
  function onKeyUp(e) {
    if (isFormField(e.target)) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') e.preventDefault();
  }

  function bind() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    el.enhanceBtn.addEventListener('click', () => { counters.enhanceInputs++; enhance(); });
    el.sellBtn.addEventListener('click', sell);
    el.pauseBtn.addEventListener('click', togglePause);

    window.addEventListener('blur', () => pause('창 포커스가 벗어나 자동으로 일시정지했어요.'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause('탭이 가려져 자동으로 일시정지했어요.');
    });

    el.mute.addEventListener('change', () => {
      save.settings.mute = el.mute.checked;
      if (master) master.gain.setValueAtTime(save.settings.mute ? 0 : 0.25, audioCtx.currentTime);
      if (save.settings.mute) stopAllSounds();
      persist();
      el.mute.blur();
    });
    el.motion.addEventListener('change', () => {
      save.settings.reduceMotion = el.motion.checked;
      if (save.settings.reduceMotion) stopAllEffects();
      document.body.classList.toggle('reduce-motion', save.settings.reduceMotion);
      persist();
      el.motion.blur();
    });

    CONFIG.decayOptions.forEach((d) => {
      const o = document.createElement('option');
      o.value = String(d);
      o.textContent = d + (d === CONFIG.defaultDecay ? ' (기본)' : '');
      el.decaySelect.appendChild(o);
    });
    el.decaySelect.addEventListener('change', () => {
      const v = Number(el.decaySelect.value);
      if (!CONFIG.decayOptions.includes(v)) return;
      save.settings.decay = v;
      persist();
      renderOddsTable();
      updateDecayNote();
      lastOverlayKey = '';
      render();
    });
    el.csvBtn.addEventListener('click', exportCSV);

    el.burstBtn.addEventListener('click', burstTest);
    el.showSaveBtn.addEventListener('click', () => {
      let raw = '';
      try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = '(저장소 사용 불가)'; }
      let pretty = raw;
      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { /* 그대로 표시 */ }
      el.saveView.textContent = pretty === null ? '(비어 있음)' : pretty;
      el.saveView.hidden = !el.saveView.hidden;
    });
    el.emptySaveBtn.addEventListener('click', () => {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 무시 */ }
      window.location.reload();
    });
    el.corruptSaveBtn.addEventListener('click', () => {
      try { window.localStorage.setItem(STORAGE_KEY, '{"version":1,"best":"열강","logs":[{"no":1,'); } catch (e) { /* 무시 */ }
      window.location.reload();
    });
    el.resetSaveBtn.addEventListener('click', resetSaveData);
  }

  // ===================== 11. 시간 (일시정지 중에는 멈춤) =====================
  function tick(now) {
    if (state.phase === 'playing' && state.round) {
      const dt = now - state.lastTick;
      if (dt > 0) state.round.elapsedMs += dt;
      const sec = Math.floor(state.round.elapsedMs / 1000);
      if (sec !== state.lastShownSec) {
        state.lastShownSec = sec;
        el.time.textContent = fmtTime(state.round.elapsedMs);
      }
    }
    state.lastTick = now;
    requestAnimationFrame(tick);
  }

  // ===================== 12. 시작 =====================
  function init() {
    const loaded = loadSave();
    save = loaded.data;
    const LABEL = { ok: '정상', empty: '빈 저장값 → 기본값', repaired: '일부 복구', corrupt: '손상 → 기본값 복구', unavailable: '저장소 사용 불가' };
    el.loadStatus.textContent = LABEL[loaded.status] + ' (' + loaded.detail + ')';
    if (loaded.status === 'corrupt' || loaded.status === 'repaired') {
      persist();
      showNotice(loaded.detail + ' 게임은 정상적으로 시작할 수 있어요.', 'warn');
    } else if (loaded.status === 'unavailable') {
      showNotice(loaded.detail + ' 이번 접속 동안만 기록이 유지돼요.', 'warn');
    } else if (loaded.status === 'empty') {
      persist();
    }

    // 도감 칸 만들기
    for (let i = 0; i <= CONFIG.maxLevel; i++) {
      const c = document.createElement('div');
      c.className = 'cell' + (i === CONFIG.target ? ' target' : '');
      c.innerHTML = swordSVG(i);
      el.codex.appendChild(c);
    }

    bind();
    refreshAll();
    requestAnimationFrame((t) => { state.lastTick = t; requestAnimationFrame(tick); });
  }

  init();
})();
