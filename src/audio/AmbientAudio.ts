/**
 * Ambient Audio System — looping background soundscapes using Web Audio API.
 *
 * Generates procedural ambient loops that respond to weather and time-of-day:
 *   - Rain patter: filtered noise bursts simulating rainfall
 *   - Cricket chirps: high-frequency triangle oscillators at night
 *   - Office keyboard hum: low rhythmic square-wave tapping during day
 *   - Wind: sweeping filtered noise during storms/rain
 *
 * Shares the AudioContext with GBAAudio via getCtx/getMaster helpers.
 */

import { isMuted, getVolume } from './GBAAudio'

type WeatherType = 'clear' | 'rain' | 'snow' | 'fog'
type TimePhase = 'dawn' | 'day' | 'golden' | 'dusk' | 'night'

// ─── Ambient layer interface ────────────────────────────────────────

interface AmbientLayer {
  id: string
  /** Create and connect nodes, return a stop function */
  start: (ctx: AudioContext, dest: GainNode) => () => void
  /** Currently running stop function */
  stop: (() => void) | null
  /** Gain node for crossfading */
  gain: GainNode | null
  /** Target volume (0 = off) */
  targetVol: number
  /** Current volume */
  currentVol: number
}

// ─── Shared context (mirrors GBAAudio singleton) ────────────────────

let ctx: AudioContext | null = null
let ambientMaster: GainNode | null = null

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

function ensureMaster(): GainNode {
  const c = getCtx()
  if (!ambientMaster) {
    ambientMaster = c.createGain()
    ambientMaster.gain.value = isMuted() ? 0 : getVolume() * 0.4
    ambientMaster.connect(c.destination)
  }
  return ambientMaster
}

// ─── Noise buffer (cached) ──────────────────────────────────────────

let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(): AudioBuffer {
  const c = getCtx()
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer
  const len = c.sampleRate * 2
  noiseBuffer = c.createBuffer(1, len, c.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

// ─── Layer factories ────────────────────────────────────────────────

function createRainLayer(): (ctx: AudioContext, dest: GainNode) => () => void {
  return (c, dest) => {
    // Filtered noise for rain patter
    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer()
    src.loop = true

    // Highpass to remove rumble, bandpass for rain character
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 800

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 3000
    bp.Q.value = 0.8

    // Gentle amplitude modulation for patter texture
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 4.5
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.15
    lfo.connect(lfoGain)

    const modGain = c.createGain()
    modGain.gain.value = 0.85
    lfoGain.connect(modGain.gain)

    src.connect(hp)
    hp.connect(bp)
    bp.connect(modGain)
    modGain.connect(dest)

    src.start()
    lfo.start()

    return () => {
      try { src.stop() } catch {}
      try { lfo.stop() } catch {}
      src.disconnect()
      lfo.disconnect()
      hp.disconnect()
      bp.disconnect()
      modGain.disconnect()
      lfoGain.disconnect()
    }
  }
}

function createWindLayer(): (ctx: AudioContext, dest: GainNode) => () => void {
  return (c, dest) => {
    // Low sweeping noise for wind
    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer()
    src.loop = true

    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 400

    // Slow sweep on the filter frequency
    const sweepLfo = c.createOscillator()
    sweepLfo.type = 'sine'
    sweepLfo.frequency.value = 0.15
    const sweepGain = c.createGain()
    sweepGain.gain.value = 200
    sweepLfo.connect(sweepGain)
    sweepGain.connect(lp.frequency)

    // Volume wobble
    const volLfo = c.createOscillator()
    volLfo.type = 'sine'
    volLfo.frequency.value = 0.3
    const volLfoGain = c.createGain()
    volLfoGain.gain.value = 0.3
    volLfo.connect(volLfoGain)

    const modGain = c.createGain()
    modGain.gain.value = 0.7
    volLfoGain.connect(modGain.gain)

    src.connect(lp)
    lp.connect(modGain)
    modGain.connect(dest)

    src.start()
    sweepLfo.start()
    volLfo.start()

    return () => {
      try { src.stop() } catch {}
      try { sweepLfo.stop() } catch {}
      try { volLfo.stop() } catch {}
      src.disconnect()
      lp.disconnect()
      sweepLfo.disconnect()
      sweepGain.disconnect()
      volLfo.disconnect()
      volLfoGain.disconnect()
      modGain.disconnect()
    }
  }
}

function createCricketLayer(): (ctx: AudioContext, dest: GainNode) => () => void {
  return (c, dest) => {
    // Two detuned triangle oscillators pulsing on/off for chirp pattern
    const osc1 = c.createOscillator()
    osc1.type = 'triangle'
    osc1.frequency.value = 4200

    const osc2 = c.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = 4400

    // Chirp envelope via rapid on/off LFO
    const chirpLfo = c.createOscillator()
    chirpLfo.type = 'square'
    chirpLfo.frequency.value = 12

    const chirpGain = c.createGain()
    chirpGain.gain.value = 0

    // Slower rhythm: chirps happen in bursts
    const burstLfo = c.createOscillator()
    burstLfo.type = 'sine'
    burstLfo.frequency.value = 0.8
    const burstGain = c.createGain()
    burstGain.gain.value = 0.5
    burstLfo.connect(burstGain)
    burstGain.connect(chirpGain.gain)

    chirpLfo.connect(chirpGain.gain)

    const mix = c.createGain()
    mix.gain.value = 0.12

    osc1.connect(chirpGain)
    osc2.connect(chirpGain)
    chirpGain.connect(mix)
    mix.connect(dest)

    osc1.start()
    osc2.start()
    chirpLfo.start()
    burstLfo.start()

    return () => {
      try { osc1.stop() } catch {}
      try { osc2.stop() } catch {}
      try { chirpLfo.stop() } catch {}
      try { burstLfo.stop() } catch {}
      osc1.disconnect()
      osc2.disconnect()
      chirpLfo.disconnect()
      chirpGain.disconnect()
      burstLfo.disconnect()
      burstGain.disconnect()
      mix.disconnect()
    }
  }
}

function createKeyboardHumLayer(): (ctx: AudioContext, dest: GainNode) => () => void {
  return (c, dest) => {
    // Rhythmic low clicks/taps simulating office keyboard ambiance
    const src = c.createBufferSource()
    src.buffer = getNoiseBuffer()
    src.loop = true

    // Very narrow bandpass for "clicky" character
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 3

    // Rapid rhythmic gating for tap pattern
    const gateLfo = c.createOscillator()
    gateLfo.type = 'square'
    gateLfo.frequency.value = 7

    const gateGain = c.createGain()
    gateGain.gain.value = 0

    // Random-ish pattern modulation
    const patternLfo = c.createOscillator()
    patternLfo.type = 'sawtooth'
    patternLfo.frequency.value = 1.3
    const patternGain = c.createGain()
    patternGain.gain.value = 4
    patternLfo.connect(patternGain)
    patternGain.connect(gateLfo.frequency)

    gateLfo.connect(gateGain.gain)

    const mix = c.createGain()
    mix.gain.value = 0.08

    src.connect(bp)
    bp.connect(gateGain)
    gateGain.connect(mix)
    mix.connect(dest)

    src.start()
    gateLfo.start()
    patternLfo.start()

    return () => {
      try { src.stop() } catch {}
      try { gateLfo.stop() } catch {}
      try { patternLfo.stop() } catch {}
      src.disconnect()
      bp.disconnect()
      gateLfo.disconnect()
      gateGain.disconnect()
      patternLfo.disconnect()
      patternGain.disconnect()
      mix.disconnect()
    }
  }
}

// ─── Ambient controller ─────────────────────────────────────────────

const FADE_SPEED = 0.8 // volume units per second (0→1 in ~1.2s)

const layers: AmbientLayer[] = [
  { id: 'rain', start: createRainLayer(), stop: null, gain: null, targetVol: 0, currentVol: 0 },
  { id: 'wind', start: createWindLayer(), stop: null, gain: null, targetVol: 0, currentVol: 0 },
  { id: 'crickets', start: createCricketLayer(), stop: null, gain: null, targetVol: 0, currentVol: 0 },
  { id: 'keyboard', start: createKeyboardHumLayer(), stop: null, gain: null, targetVol: 0, currentVol: 0 },
]

function ensureLayerRunning(layer: AmbientLayer) {
  if (layer.stop) return // already running
  const c = getCtx()
  const master = ensureMaster()
  const gain = c.createGain()
  gain.gain.value = 0
  gain.connect(master)
  layer.gain = gain
  layer.stop = layer.start(c, gain)
  layer.currentVol = 0
}

function stopLayer(layer: AmbientLayer) {
  if (layer.stop) {
    layer.stop()
    layer.stop = null
  }
  if (layer.gain) {
    layer.gain.disconnect()
    layer.gain = null
  }
  layer.currentVol = 0
}

function getLayer(id: string): AmbientLayer {
  return layers.find(l => l.id === id)!
}

/** Set target volumes based on weather and time phase */
function computeTargets(weather: WeatherType, phase: TimePhase) {
  const isNight = phase === 'night' || phase === 'dusk'
  const isDay = phase === 'day' || phase === 'golden' || phase === 'dawn'

  // Rain patter
  getLayer('rain').targetVol = weather === 'rain' ? 1.0 : 0

  // Wind — during rain (storms) and snow
  getLayer('wind').targetVol =
    weather === 'rain' ? 0.7 :
    weather === 'snow' ? 0.4 :
    weather === 'fog' ? 0.2 : 0

  // Cricket chirps — night time, not during heavy rain
  getLayer('crickets').targetVol =
    isNight && weather !== 'rain' ? 0.8 :
    isNight && weather === 'rain' ? 0.2 :
    phase === 'golden' && weather === 'clear' ? 0.3 : 0

  // Office keyboard hum — daytime, clear/fog weather
  getLayer('keyboard').targetVol =
    isDay && (weather === 'clear' || weather === 'fog') ? 0.6 :
    isDay && weather === 'rain' ? 0.2 : 0
}

// ─── Public API ─────────────────────────────────────────────────────

let _currentWeather: WeatherType = 'clear'
let _currentPhase: TimePhase = 'day'

export function updateAmbient(delta: number, weather: WeatherType, phase: TimePhase) {
  if (isMuted()) {
    // Silence all layers immediately
    for (const layer of layers) {
      if (layer.gain) layer.gain.gain.value = 0
      layer.currentVol = 0
    }
    return
  }

  // Recompute targets on state change
  if (weather !== _currentWeather || phase !== _currentPhase) {
    _currentWeather = weather
    _currentPhase = phase
    computeTargets(weather, phase)
  }

  // Update master volume to track GBAAudio settings
  if (ambientMaster) {
    ambientMaster.gain.value = getVolume() * 0.4
  }

  const dt = delta / 1000

  for (const layer of layers) {
    // Start layers that should be audible
    if (layer.targetVol > 0 && !layer.stop) {
      ensureLayerRunning(layer)
    }

    // Crossfade toward target
    if (layer.currentVol < layer.targetVol) {
      layer.currentVol = Math.min(layer.targetVol, layer.currentVol + FADE_SPEED * dt)
    } else if (layer.currentVol > layer.targetVol) {
      layer.currentVol = Math.max(layer.targetVol, layer.currentVol - FADE_SPEED * dt)
    }

    // Apply gain
    if (layer.gain) {
      layer.gain.gain.value = layer.currentVol
    }

    // Stop layers that have fully faded out
    if (layer.currentVol <= 0 && layer.stop) {
      stopLayer(layer)
    }
  }
}

export function stopAllAmbient() {
  for (const layer of layers) {
    layer.targetVol = 0
    stopLayer(layer)
  }
}
