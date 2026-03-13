/**
 * GBA Audio System — 8-bit sound effects using Web Audio API.
 *
 * Uses square/triangle/noise waveforms to emulate Game Boy Advance
 * style audio. Provides named SFX for menus, buttons, notifications,
 * and agent actions. Shares a single AudioContext.
 */

// ─── Types ───────────────────────────────────────────────────────────

type WaveType = OscillatorType | 'noise'

interface Note {
  freq: number
  duration: number
  wave: WaveType
  /** Delay from start of SFX in seconds */
  delay?: number
  /** 0-1, default 1 */
  volume?: number
  /** Pitch slide target frequency */
  slide?: number
}

interface SFXDef {
  notes: Note[]
  gain: number
}

// ─── Singleton Context ───────────────────────────────────────────────

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let _muted = false
let _volume = 0.35

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    masterGain = ctx.createGain()
    masterGain.gain.value = _muted ? 0 : _volume
    masterGain.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

function getMaster(): GainNode {
  getCtx()
  return masterGain!
}

// ─── White noise buffer (cached) ─────────────────────────────────────

let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const c = getCtx()
  const len = c.sampleRate * 0.5
  noiseBuffer = c.createBuffer(1, len, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

// ─── Core playback ───────────────────────────────────────────────────

function playSFX(def: SFXDef) {
  if (_muted) return
  try {
    const c = getCtx()
    const master = getMaster()
    const sfxGain = c.createGain()
    sfxGain.gain.value = def.gain
    sfxGain.connect(master)

    let maxEnd = 0

    for (const note of def.notes) {
      const delay = note.delay ?? 0
      const start = c.currentTime + delay
      const end = start + note.duration
      const vol = note.volume ?? 1
      if (end > maxEnd) maxEnd = end

      const noteGain = c.createGain()
      noteGain.gain.setValueAtTime(vol, start)
      noteGain.gain.exponentialRampToValueAtTime(0.001, end)
      noteGain.connect(sfxGain)

      if (note.wave === 'noise') {
        const src = c.createBufferSource()
        src.buffer = getNoiseBuffer()
        // Bandpass filter for tonal noise
        const filter = c.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = note.freq
        filter.Q.value = 2
        src.connect(filter)
        filter.connect(noteGain)
        src.start(start)
        src.stop(end)
      } else {
        const osc = c.createOscillator()
        osc.type = note.wave
        osc.frequency.setValueAtTime(note.freq, start)
        if (note.slide) {
          osc.frequency.linearRampToValueAtTime(note.slide, end)
        }
        osc.connect(noteGain)
        osc.start(start)
        osc.stop(end)
      }
    }

    // Cleanup gain node after SFX ends
    const cleanupDelay = (maxEnd - getCtx().currentTime + 0.1) * 1000
    setTimeout(() => {
      sfxGain.disconnect()
    }, Math.max(cleanupDelay, 100))
  } catch {
    /* audio not available */
  }
}

// ─── SFX Definitions ─────────────────────────────────────────────────

const SFX: Record<string, SFXDef> = {
  // --- Menu / Navigation ---
  menuOpen: {
    gain: 0.5,
    notes: [
      { freq: 440, duration: 0.06, wave: 'square', delay: 0 },
      { freq: 587, duration: 0.06, wave: 'square', delay: 0.06 },
      { freq: 740, duration: 0.08, wave: 'square', delay: 0.12 },
    ],
  },
  menuClose: {
    gain: 0.4,
    notes: [
      { freq: 740, duration: 0.06, wave: 'square', delay: 0 },
      { freq: 587, duration: 0.06, wave: 'square', delay: 0.05 },
      { freq: 440, duration: 0.08, wave: 'square', delay: 0.10 },
    ],
  },
  menuNav: {
    gain: 0.3,
    notes: [
      { freq: 660, duration: 0.04, wave: 'square' },
    ],
  },
  menuSelect: {
    gain: 0.45,
    notes: [
      { freq: 523, duration: 0.05, wave: 'square', delay: 0 },
      { freq: 784, duration: 0.1, wave: 'square', delay: 0.05 },
    ],
  },

  // --- Buttons ---
  buttonClick: {
    gain: 0.35,
    notes: [
      { freq: 800, duration: 0.04, wave: 'square' },
    ],
  },
  buttonHover: {
    gain: 0.15,
    notes: [
      { freq: 1200, duration: 0.02, wave: 'square' },
    ],
  },

  // --- Notifications ---
  notifyAgent: {
    gain: 0.4,
    notes: [
      { freq: 523, duration: 0.07, wave: 'square', delay: 0 },
      { freq: 659, duration: 0.07, wave: 'square', delay: 0.08 },
      { freq: 784, duration: 0.09, wave: 'square', delay: 0.16 },
    ],
  },
  notifyAlert: {
    gain: 0.5,
    notes: [
      { freq: 440, duration: 0.08, wave: 'square', delay: 0 },
      { freq: 330, duration: 0.08, wave: 'square', delay: 0.09 },
      { freq: 220, duration: 0.12, wave: 'square', delay: 0.18 },
    ],
  },
  notifyMail: {
    gain: 0.4,
    notes: [
      { freq: 587, duration: 0.07, wave: 'square', delay: 0 },
      { freq: 740, duration: 0.07, wave: 'square', delay: 0.08 },
      { freq: 880, duration: 0.09, wave: 'square', delay: 0.16 },
    ],
  },
  notifySystem: {
    gain: 0.35,
    notes: [
      { freq: 659, duration: 0.06, wave: 'square', delay: 0 },
      { freq: 784, duration: 0.08, wave: 'square', delay: 0.07 },
    ],
  },

  // --- Agent Actions ---
  agentSpawn: {
    gain: 0.45,
    notes: [
      { freq: 262, duration: 0.1, wave: 'triangle', delay: 0 },
      { freq: 330, duration: 0.1, wave: 'triangle', delay: 0.1 },
      { freq: 392, duration: 0.1, wave: 'triangle', delay: 0.2 },
      { freq: 523, duration: 0.15, wave: 'triangle', delay: 0.3 },
    ],
  },
  agentDespawn: {
    gain: 0.35,
    notes: [
      { freq: 523, duration: 0.08, wave: 'triangle', delay: 0, slide: 131 },
    ],
  },
  agentComplete: {
    gain: 0.5,
    notes: [
      { freq: 523, duration: 0.08, wave: 'square', delay: 0 },
      { freq: 659, duration: 0.08, wave: 'square', delay: 0.08 },
      { freq: 784, duration: 0.08, wave: 'square', delay: 0.16 },
      { freq: 1047, duration: 0.2, wave: 'square', delay: 0.24 },
    ],
  },
  agentError: {
    gain: 0.45,
    notes: [
      { freq: 200, duration: 0.15, wave: 'square', delay: 0 },
      { freq: 200, duration: 0.15, wave: 'square', delay: 0.2 },
      { freq: 150, duration: 0.25, wave: 'square', delay: 0.4 },
    ],
  },

  // --- Boot / Transitions ---
  bootChime: {
    gain: 0.45,
    notes: [
      { freq: 392, duration: 0.15, wave: 'triangle', delay: 0 },
      { freq: 523, duration: 0.15, wave: 'triangle', delay: 0.15 },
      { freq: 659, duration: 0.15, wave: 'triangle', delay: 0.3 },
      { freq: 784, duration: 0.3, wave: 'triangle', delay: 0.45 },
    ],
  },
  transitionIn: {
    gain: 0.3,
    notes: [
      { freq: 200, duration: 0.15, wave: 'noise', delay: 0 },
      { freq: 440, duration: 0.08, wave: 'square', delay: 0.05 },
    ],
  },
  transitionOut: {
    gain: 0.3,
    notes: [
      { freq: 440, duration: 0.08, wave: 'square', delay: 0 },
      { freq: 200, duration: 0.15, wave: 'noise', delay: 0.05 },
    ],
  },

  // --- Beads ---
  beadPickup: {
    gain: 0.4,
    notes: [
      { freq: 880, duration: 0.05, wave: 'square', delay: 0 },
      { freq: 1175, duration: 0.05, wave: 'square', delay: 0.05 },
      { freq: 1397, duration: 0.08, wave: 'square', delay: 0.1 },
    ],
  },
  beadDrop: {
    gain: 0.3,
    notes: [
      { freq: 600, duration: 0.06, wave: 'square', delay: 0, slide: 300 },
    ],
  },
}

// ─── Public API ──────────────────────────────────────────────────────

export type SFXName = keyof typeof SFX

export function sfx(name: SFXName) {
  const def = SFX[name]
  if (def) playSFX(def)
}

export function setVolume(v: number) {
  _volume = Math.max(0, Math.min(1, v))
  if (masterGain) {
    masterGain.gain.value = _muted ? 0 : _volume
  }
}

export function getVolume(): number {
  return _volume
}

export function setMuted(m: boolean) {
  _muted = m
  if (masterGain) {
    masterGain.gain.value = _muted ? 0 : _volume
  }
}

export function isMuted(): boolean {
  return _muted
}

export function toggleMute(): boolean {
  setMuted(!_muted)
  return _muted
}

/** Initialize audio context on first user gesture */
export function initAudio() {
  getCtx()
}
