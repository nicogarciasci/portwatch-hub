'use strict';

/* =========================================================================
   PORTWATCH HUB — módulo separado
   ========================================================================= */

/* =========================================================================
   RÁDIO — sintetizador local
   ========================================================================= */

const audio = {
  ctx: null,
  music: null,
  arp: null,
  noise: null,
  radioOn: false,
  timer: null,
  retuneTimer: null,
  step: 0,
  next: 0,
  trackIndex: 0,
  trackPrimed: false,
};

const RADIO_STATIONS = [
  {
    id: 'neon',
    name: 'NEON FM',
    frequency: '98.7',
    tagline: 'Midnight Coast',
    ls: { name: 'VINEWOOD FM', tagline: 'City Lights' },
    bpm: 92,
    padType: 'triangle',
    bassType: 'sawtooth',
    arpType: 'triangle',
    padGain: 0.021,
    padFilter: [680, 1700],
    bassGain: 0.1,
    bassFilter: [420, 140],
    arpGain: 0.028,
    arpFilter: 2600,
    kickGain: 0.26,
    kickPattern: [0, 4, 8, 12],
    bassPattern: [0, 6, 8, 14],
    arpEvery: 2,
    clapPattern: [4, 12],
    clapGain: 1,
    hatPattern: [2, 6, 10, 14],
    hatGain: 1,
    chords: [
      { bass: 110.0, pad: [220.0, 261.63, 329.63, 392.0], arp: [440.0, 523.25, 659.25, 783.99] },
      { bass: 87.31, pad: [174.61, 220.0, 261.63, 329.63], arp: [349.23, 440.0, 523.25, 659.25] },
      { bass: 130.81, pad: [261.63, 329.63, 392.0, 493.88], arp: [523.25, 659.25, 783.99, 987.77] },
      { bass: 98.0, pad: [196.0, 246.94, 293.66, 369.99], arp: [392.0, 493.88, 587.33, 739.99] },
    ],
    progression: [0, 1, 2, 3, 0, 1, 2, 3],
    tracks: [
      {
        title: 'Neon Run',
        bpm: 100,
        progression: [0, 2, 1, 3, 0, 2, 3, 1],
        arpEvery: 2,
        padType: 'sawtooth',
        padGain: 0.018,
        arpGain: 0.025,
        kickPattern: [0, 4, 8, 12],
        bassPattern: [0, 4, 8, 12],
      },
      {
        title: 'Afterglow',
        bpm: 84,
        progression: [0, 1, 3, 2, 0, 3, 1, 2],
        arpEvery: 4,
        padType: 'sine',
        bassType: 'sine',
        arpType: 'sine',
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        clapGain: 0.5,
        hatGain: 0.6,
      },
    ],
  },
  {
    id: 'ocean',
    name: 'OCEAN DRIVE',
    frequency: '101.5',
    tagline: 'Sunset Cruise',
    ls: { name: 'VESPUCCI WAVES', tagline: 'Pacific Coast' },
    bpm: 84,
    padType: 'triangle',
    bassType: 'triangle',
    arpType: 'sine',
    padGain: 0.024,
    padFilter: [520, 1450],
    bassGain: 0.105,
    bassFilter: [320, 110],
    arpGain: 0.024,
    arpFilter: 2200,
    kickGain: 0.23,
    kickPattern: [0, 8],
    bassPattern: [0, 8],
    arpEvery: 4,
    clapPattern: [4, 12],
    clapGain: 0.55,
    hatPattern: [2, 6, 10, 14],
    hatGain: 0.65,
    chords: [
      { bass: 73.42, pad: [146.83, 174.61, 220.0, 261.63], arp: [293.66, 349.23, 440.0, 523.25] },
      { bass: 116.54, pad: [233.08, 293.66, 349.23, 440.0], arp: [466.16, 587.33, 698.46, 880.0] },
      { bass: 87.31, pad: [174.61, 220.0, 261.63, 329.63], arp: [349.23, 440.0, 523.25, 659.25] },
      { bass: 65.41, pad: [130.81, 164.81, 196.0, 246.94], arp: [261.63, 329.63, 392.0, 493.88] },
    ],
    progression: [0, 1, 2, 3, 0, 2, 1, 3],
    tracks: [
      {
        title: 'Pacific Drift',
        bpm: 78,
        progression: [0, 2, 3, 1, 0, 2, 1, 3],
        arpEvery: 4,
        padType: 'sine',
        arpType: 'triangle',
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        hatGain: 0.5,
      },
      {
        title: 'Golden Hour',
        bpm: 90,
        progression: [0, 1, 3, 2, 0, 1, 2, 3],
        arpEvery: 2,
        padType: 'triangle',
        arpType: 'sine',
        kickPattern: [0, 4, 8, 12],
        bassPattern: [0, 6, 8, 14],
        clapGain: 0.8,
        hatGain: 0.85,
      },
    ],
  },
  {
    id: 'night',
    name: 'NIGHT HAWK',
    frequency: '104.9',
    tagline: 'After Hours',
    ls: { name: 'DEL PERRO NIGHTS', tagline: 'After Dark' },
    bpm: 108,
    padType: 'sawtooth',
    bassType: 'square',
    arpType: 'sawtooth',
    padGain: 0.014,
    padFilter: [420, 1250],
    bassGain: 0.08,
    bassFilter: [380, 95],
    arpGain: 0.02,
    arpFilter: 1900,
    kickGain: 0.3,
    kickPattern: [0, 4, 8, 12],
    bassPattern: [0, 4, 8, 12],
    arpEvery: 2,
    clapPattern: [4, 12],
    clapGain: 1.15,
    hatPattern: [2, 6, 10, 14],
    hatGain: 1.1,
    chords: [
      { bass: 65.41, pad: [130.81, 155.56, 196.0, 233.08], arp: [261.63, 311.13, 392.0, 466.16] },
      { bass: 103.83, pad: [207.65, 261.63, 311.13, 392.0], arp: [415.3, 523.25, 622.25, 783.99] },
      { bass: 77.78, pad: [155.56, 196.0, 233.08, 293.66], arp: [311.13, 392.0, 466.16, 587.33] },
      { bass: 116.54, pad: [233.08, 293.66, 349.23, 440.0], arp: [466.16, 587.33, 698.46, 880.0] },
    ],
    progression: [0, 1, 2, 3, 0, 1, 3, 2],
    tracks: [
      {
        title: 'Chrome Pulse',
        bpm: 118,
        progression: [0, 2, 1, 3, 0, 2, 3, 1],
        arpEvery: 2,
        padType: 'square',
        bassType: 'sawtooth',
        padGain: 0.012,
        kickPattern: [0, 4, 8, 12],
        bassPattern: [0, 4, 8, 12],
        hatGain: 1.2,
      },
      {
        title: 'Rain Check',
        bpm: 96,
        progression: [0, 3, 2, 1, 0, 3, 1, 2],
        arpEvery: 4,
        padType: 'triangle',
        bassType: 'triangle',
        padGain: 0.018,
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        clapGain: 0.7,
        hatGain: 0.8,
      },
    ],
  },
  {
    id: 'palm',
    name: 'PALM FM',
    frequency: '88.3',
    tagline: 'Palm Breeze',
    ls: { name: 'SANDY SHORES', tagline: 'Desert Breeze' },
    bpm: 76,
    padType: 'triangle',
    bassType: 'sine',
    arpType: 'sine',
    padGain: 0.027,
    padFilter: [480, 1350],
    bassGain: 0.12,
    bassFilter: [260, 100],
    arpGain: 0.023,
    arpFilter: 1900,
    kickGain: 0.19,
    kickPattern: [0, 8],
    bassPattern: [0, 8],
    arpEvery: 4,
    clapPattern: [4, 12],
    clapGain: 0.4,
    hatPattern: [2, 6, 10, 14],
    hatGain: 0.5,
    chords: [
      { bass: 98.0, pad: [196.0, 246.94, 293.66, 369.99], arp: [392.0, 493.88, 587.33, 739.99] },
      { bass: 82.41, pad: [164.81, 196.0, 246.94, 293.66], arp: [329.63, 392.0, 493.88, 587.33] },
      { bass: 130.81, pad: [261.63, 329.63, 392.0, 493.88], arp: [523.25, 659.25, 783.99, 987.77] },
      { bass: 73.42, pad: [146.83, 185.0, 220.0, 261.63], arp: [293.66, 369.99, 440.0, 523.25] },
    ],
    progression: [0, 1, 2, 3, 0, 1, 2, 3],
    tracks: [
      {
        title: 'Desert Mirage',
        bpm: 72,
        progression: [0, 2, 1, 3, 0, 2, 3, 1],
        arpEvery: 4,
        padType: 'sine',
        bassType: 'triangle',
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        hatGain: 0.35,
      },
      {
        title: 'Coastline',
        bpm: 82,
        progression: [0, 1, 3, 2, 0, 1, 2, 3],
        arpEvery: 4,
        padType: 'triangle',
        arpType: 'triangle',
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        clapGain: 0.5,
      },
    ],
  },
  {
    id: 'vice',
    name: 'VICE 87.7',
    frequency: '87.7',
    tagline: 'Neon Vice',
    ls: { name: 'LOS SANTOS 87.7', tagline: 'Sunset Strip' },
    bpm: 96,
    padType: 'sawtooth',
    bassType: 'square',
    arpType: 'triangle',
    padGain: 0.018,
    padFilter: [620, 1800],
    bassGain: 0.095,
    bassFilter: [400, 120],
    arpGain: 0.026,
    arpFilter: 2500,
    kickGain: 0.27,
    kickPattern: [0, 4, 8, 12],
    bassPattern: [0, 4, 8, 12],
    arpEvery: 2,
    clapPattern: [4, 12],
    clapGain: 1,
    hatPattern: [2, 6, 10, 14],
    hatGain: 1,
    chords: [
      { bass: 82.41, pad: [164.81, 196.0, 246.94, 293.66], arp: [329.63, 392.0, 493.88, 587.33] },
      { bass: 65.41, pad: [130.81, 164.81, 196.0, 261.63], arp: [261.63, 329.63, 392.0, 523.25] },
      { bass: 98.0, pad: [196.0, 246.94, 293.66, 392.0], arp: [392.0, 493.88, 587.33, 783.99] },
      { bass: 73.42, pad: [146.83, 185.0, 220.0, 293.66], arp: [293.66, 369.99, 440.0, 587.33] },
    ],
    progression: [0, 1, 2, 3, 0, 2, 1, 3],
    tracks: [
      {
        title: 'Strip Runner',
        bpm: 104,
        progression: [0, 2, 3, 1, 0, 2, 1, 3],
        arpEvery: 2,
        kickPattern: [0, 4, 8, 12],
        bassPattern: [0, 4, 8, 12],
      },
      {
        title: 'Pink Horizon',
        bpm: 88,
        progression: [0, 1, 3, 2, 0, 3, 1, 2],
        arpEvery: 4,
        padType: 'triangle',
        bassType: 'sine',
        kickPattern: [0, 8],
        bassPattern: [0, 8],
        clapGain: 0.6,
      },
    ],
  },
];

function radioStationById(id) {
  return RADIO_STATIONS.find((station) => station.id === id) || RADIO_STATIONS[0];
}

function stationStep(station) {
  return 60 / station.bpm / 4;
}

function stationTrackCount(station) {
  return 1 + (Array.isArray(station.tracks) ? station.tracks.length : 0);
}

function stationTrack(station) {
  const count = stationTrackCount(station);
  const index = ((audio.trackIndex % count) + count) % count;
  if (index === 0 || !Array.isArray(station.tracks)) return station;
  return { ...station, ...station.tracks[index - 1] };
}

function ensureAudio() {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  const ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.3;
  comp.connect(ctx.destination);

  const music = ctx.createGain();
  music.gain.value = 0;
  music.connect(comp);

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.34;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  const arp = ctx.createGain();
  arp.connect(music);
  arp.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(music);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  audio.ctx = ctx;
  audio.music = music;
  audio.arp = arp;
  audio.noise = noise;
  return ctx;
}

function musicTarget() {
  const volume = draft && typeof draft.musicVolume === 'number' ? draft.musicVolume : state.config.musicVolume;
  return audio.radioOn ? (volume / 100) * 0.55 : 0;
}

function applyMusicVolume() {
  if (!audio.ctx || !audio.music) return;
  audio.music.gain.setTargetAtTime(musicTarget(), audio.ctx.currentTime, 0.06);
}

function blip({ freq = 880, dur = 0.05, gain = 0.012, type = 'sine', slide = 0 } = {}) {
  if (!state.config.uiSounds) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function padChord(chord, t, station) {
  const ctx = audio.ctx;
  const dur = stationStep(station) * 16;
  const attack = Math.min(0.55, dur * 0.25);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(station.padFilter[0], t);
  filter.frequency.linearRampToValueAtTime(station.padFilter[1], t + dur * 0.55);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(station.padGain, t + attack);
  g.gain.setValueAtTime(station.padGain, t + dur - attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
  filter.connect(g);
  g.connect(audio.music);

  for (const freq of chord.pad) {
    for (const detune of [-5, 5]) {
      const osc = ctx.createOscillator();
      osc.type = station.padType;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.45);
    }
  }
}

function bass(freq, t, dur, station) {
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = station.bassType;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.Q.value = 3;
  filter.frequency.setValueAtTime(station.bassFilter[0], t);
  filter.frequency.exponentialRampToValueAtTime(station.bassFilter[1], t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(station.bassGain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(filter);
  filter.connect(g);
  g.connect(audio.music);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function arpNote(freq, t, station) {
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const decay = Math.max(0.18, stationStep(station) * 1.6);
  osc.type = station.arpType;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = station.arpFilter;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(station.arpGain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(filter);
  filter.connect(g);
  g.connect(audio.arp);
  osc.start(t);
  osc.stop(t + decay + 0.06);
}

function kick(t, station) {
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.14);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(station.kickGain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  osc.connect(g);
  g.connect(audio.music);
  osc.start(t);
  osc.stop(t + 0.3);
}

function noiseHit(t, { type = 'highpass', freq = 7000, dur = 0.05, gain = 0.022 } = {}) {
  const ctx = audio.ctx;
  const src = ctx.createBufferSource();
  src.buffer = audio.noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.music);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function playStep(step, t, station) {
  const bar = Math.floor(step / 16) % station.progression.length;
  const chord = station.chords[station.progression[bar]];
  const s = step % 16;
  const stepSec = stationStep(station);

  if (s === 0) padChord(chord, t, station);
  if (station.bassPattern.includes(s)) {
    bass(chord.bass, t, s === 0 ? stepSec * 9 : stepSec * 2.1, station);
  }
  if (s % station.arpEvery === 0) arpNote(chord.arp[(s / station.arpEvery) % 4], t, station);
  if (station.kickPattern.includes(s)) kick(t, station);
  if (station.clapPattern.includes(s)) {
    noiseHit(t, { type: 'bandpass', freq: 1700, dur: 0.14, gain: 0.08 * (station.clapGain ?? 1) });
  }
  if (station.hatPattern.includes(s)) {
    noiseHit(t, { freq: 8200, dur: 0.04, gain: 0.02 * (station.hatGain ?? 1) });
  }
}

function scheduleRadio() {
  if (!audio.radioOn || !audio.ctx) return;
  const station = radioStationById(state.config.radioStation);
  const horizon = audio.ctx.currentTime + 0.14;
  while (audio.next < horizon) {
    if (audio.step === 0) {
      if (audio.trackPrimed) {
        audio.trackIndex = (audio.trackIndex + 1) % stationTrackCount(station);
        updateRadioUI();
      } else {
        audio.trackPrimed = true;
      }
    }
    const track = stationTrack(station);
    playStep(audio.step, audio.next, track);
    audio.next += stationStep(track);
    audio.step = (audio.step + 1) % 128;
  }
}

function startRadio({ quiet = false } = {}) {
  const ctx = ensureAudio();
  if (!ctx) {
    if (!quiet) toast(t('toast.audio'), 'warn');
    return false;
  }
  clearTimeout(audio.retuneTimer);
  audio.retuneTimer = null;
  audio.radioOn = true;
  audio.step = 0;
  audio.trackIndex = 0;
  audio.trackPrimed = false;
  audio.next = ctx.currentTime + 0.08;
  applyMusicVolume();
  clearInterval(audio.timer);
  audio.timer = setInterval(scheduleRadio, 25);
  scheduleRadio();
  updateRadioUI();
  return true;
}

function stopRadio() {
  audio.radioOn = false;
  clearInterval(audio.timer);
  audio.timer = null;
  clearTimeout(audio.retuneTimer);
  audio.retuneTimer = null;
  applyMusicVolume();
  updateRadioUI();
}

function tuneRadio() {
  if (!audio.ctx || !audio.radioOn) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  clearTimeout(audio.retuneTimer);
  audio.music.gain.cancelScheduledValues(now);
  audio.music.gain.setTargetAtTime(0.0001, now, 0.035);
  audio.retuneTimer = window.setTimeout(() => {
    audio.retuneTimer = null;
    if (!audio.radioOn || !audio.ctx) return;
    audio.step = 0;
    audio.trackPrimed = false;
    audio.next = audio.ctx.currentTime + 0.09;
    applyMusicVolume();
    scheduleRadio();
  }, 190);
}

function resumeRadioIfEnabled() {
  if (!state.config.radioOn || audio.radioOn) return;
  startRadio({ quiet: true });
}

function rememberRadio(on) {
  state.config.radioOn = on;
  if (draft) draft.radioOn = on;
  if (IS_DESKTOP) {
    window.portwatch.saveConfig({ radioOn: on }).catch(() => {});
  } else {
    saveLocal(state.config);
  }
}

function rememberStation(id) {
  state.config.radioStation = id;
  if (draft) draft.radioStation = id;
  if (IS_DESKTOP) {
    window.portwatch.saveConfig({ radioStation: id }).catch(() => {});
  } else {
    saveLocal(state.config);
  }
}

function armAudioUnlock() {
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    if (state.config.radioOn && !audio.radioOn) startRadio({ quiet: true });
    else if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function isStationMenuOpen() {
  const menu = $('#radioMenu');
  return Boolean(menu && menu.classList.contains('open'));
}

function closeStationMenu({ focus = false } = {}) {
  const menu = $('#radioMenu');
  const picker = $('#radioPicker');
  if (!menu || !picker) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  picker.setAttribute('aria-expanded', 'false');
  if (focus) picker.focus({ preventScroll: true });
}

function toggleStationMenu() {
  const menu = $('#radioMenu');
  const picker = $('#radioPicker');
  if (!menu || !picker) return;

  if (menu.classList.contains('open')) {
    closeStationMenu({ focus: true });
    return;
  }

  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  picker.setAttribute('aria-expanded', 'true');
  blip({ freq: 930, slide: 1.15, dur: 0.05, gain: 0.008, type: 'sine' });

  const active = menu.querySelector('.station.is-active') || menu.querySelector('.station');
  if (active) window.setTimeout(() => active.focus({ preventScroll: true }), 70);
}

function buildStationMenu() {
  const list = $('#radioStations');
  if (!list) return;
  list.textContent = '';

  for (const station of RADIO_STATIONS) {
    const display = stationDisplay(station);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'station';
    btn.dataset.station = station.id;
    btn.setAttribute('role', 'option');
    btn.innerHTML =
      `<span class="station-freq">${station.frequency}</span>` +
      `<span class="station-txt"><b>${display.name}</b><small>${display.tagline}</small></span>` +
      `<span class="station-mark" aria-hidden="true"><i></i><i></i><i></i></span>`;
    btn.addEventListener('click', () => selectRadioStation(station.id));
    list.appendChild(btn);
  }
}

function selectRadioStation(id) {
  const station = radioStationById(id);
  const same = state.config.radioStation === station.id;
  const wasOn = audio.radioOn;

  rememberStation(station.id);
  if (!same) audio.trackIndex = 0;
  updateRadioUI();
  closeStationMenu({ focus: true });

  if (!wasOn) startRadio();
  else if (!same) tuneRadio();

  updateRadioUI();
  if (!same && audio.radioOn) {
    const display = stationDisplay(station);
    toast(t('radio.tuned', { name: display.name, frequency: station.frequency }), 'ok', 2400);
  }
}

function toggleRadio() {
  if (audio.radioOn) {
    stopRadio();
    rememberRadio(false);
  } else {
    const started = startRadio();
    rememberRadio(started);
  }
  closeStationMenu();
}

function updateRadioUI() {
  const station = radioStationById(state.config.radioStation);
  const btn = $('#radioBtn');
  const play = $('#radioPlay');
  const use = $('#radioPlay use');
  const nameEl = $('#radioName');
  const metaEl = $('#radioMeta');

  if (btn) btn.classList.toggle('playing', audio.radioOn);
  if (play) {
    const label = t(audio.radioOn ? 'radio.pause' : 'radio.play');
    play.setAttribute('aria-pressed', String(audio.radioOn));
    play.setAttribute('aria-label', label);
    play.title = label;
  }
  if (use) use.setAttribute('href', audio.radioOn ? '#i-pause' : '#i-play');
  const display = stationDisplay(station);
  const track = stationTrack(station);
  if (nameEl) nameEl.textContent = display.name;
  if (metaEl) {
    const trackTitle = track.title ? ` · ${track.title}` : '';
    metaEl.textContent = `${station.frequency} · ${display.tagline}${trackTitle}`;
  }

  $$('#radioStations .station').forEach((row) => {
    const active = row.dataset.station === station.id;
    row.classList.toggle('is-active', active);
    row.classList.toggle('is-playing', active && audio.radioOn);
    row.setAttribute('aria-selected', String(active));
  });
}
