import Phaser from 'phaser'

const CRT_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uScanlineIntensity;
uniform float uBarrelDistortion;
uniform float uChromaOffset;
uniform float uVignetteStrength;

varying vec2 outTexCoord;

// Barrel distortion
vec2 barrelDistort(vec2 uv) {
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  return uv + cc * dist * uBarrelDistortion;
}

void main() {
  // Apply barrel distortion
  vec2 uv = barrelDistort(outTexCoord);

  // Clip pixels outside the distorted area
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // RGB subpixel fringing (chromatic aberration)
  float offset = uChromaOffset / uResolution.x;
  float r = texture2D(uMainSampler, vec2(uv.x + offset, uv.y)).r;
  float g = texture2D(uMainSampler, uv).g;
  float b = texture2D(uMainSampler, vec2(uv.x - offset, uv.y)).b;
  vec3 color = vec3(r, g, b);

  // Scanlines
  float scanline = sin(uv.y * uResolution.y * 3.14159) * 0.5 + 0.5;
  scanline = pow(scanline, 1.5);
  color *= 1.0 - uScanlineIntensity * (1.0 - scanline);

  // Subtle RGB subpixel columns (every 3rd pixel)
  float subpixel = mod(gl_FragCoord.x, 3.0);
  vec3 mask = vec3(1.0);
  if (subpixel < 1.0) mask = vec3(1.0, 0.85, 0.85);
  else if (subpixel < 2.0) mask = vec3(0.85, 1.0, 0.85);
  else mask = vec3(0.85, 0.85, 1.0);
  color *= mix(vec3(1.0), mask, 0.15);

  // Vignette
  vec2 vigUV = outTexCoord * (1.0 - outTexCoord);
  float vig = vigUV.x * vigUV.y * 15.0;
  vig = pow(vig, uVignetteStrength);
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`

export class CRTPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private _time = 0

  scanlineIntensity = 0.18
  barrelDistortion = 0.12
  chromaOffset = 1.2
  vignetteStrength = 0.25

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'CRTPostFX',
      fragShader: CRT_FRAG,
    })
  }

  onPreRender() {
    const renderer = this.renderer
    this.set2f('uResolution', renderer.width, renderer.height)
    this.set1f('uTime', this._time)
    this.set1f('uScanlineIntensity', this.scanlineIntensity)
    this.set1f('uBarrelDistortion', this.barrelDistortion)
    this.set1f('uChromaOffset', this.chromaOffset)
    this.set1f('uVignetteStrength', this.vignetteStrength)
  }

  update(_time: number, delta: number) {
    this._time += delta / 1000
  }
}
