import * as THREE from 'three';

/**
 * Authentic PSX / Bad Parenting / Experiment Groceries Post-Processing Shader
 * Combines low-res nearest-neighbor sampling, 4x4 Bayer ordered dithering,
 * PS1 15/18-bit color quantization, cold night vignette, VHS scanlines,
 * and dynamic horror glitch/chromatic aberration.
 */
export function createPSXPostMaterial(renderTargetTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: renderTargetTexture },
      uResolution: { value: new THREE.Vector2(426, 240) },
      uTime: { value: 0 },
      uDitherStrength: { value: 0.85 },
      uColorSteps: { value: 28.0 },
      uCrtEnabled: { value: 1.0 },
      uHorrorIntensity: { value: 0.0 }, // 0..1 based on active anomalies
      uGlitchBurst: { value: 0.0 },     // 0..1 spikes during scares/jumpscares
      uBlinkClose: { value: 0.0 },      // 0..1 eyelid blink / micro-sleep
      uRedFlash: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;

      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uDitherStrength;
      uniform float uColorSteps;
      uniform float uCrtEnabled;
      uniform float uHorrorIntensity;
      uniform float uGlitchBurst;
      uniform float uBlinkClose;
      uniform float uRedFlash;

      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // 4x4 Bayer Matrix for authentic PS1 ordered dithering
      float bayer4x4(vec2 pixelCoord) {
        int x = int(mod(pixelCoord.x, 4.0));
        int y = int(mod(pixelCoord.y, 4.0));
        int idx = y * 4 + x;
        if (idx == 0) return 0.0 / 16.0;
        if (idx == 1) return 8.0 / 16.0;
        if (idx == 2) return 2.0 / 16.0;
        if (idx == 3) return 10.0 / 16.0;
        if (idx == 4) return 12.0 / 16.0;
        if (idx == 5) return 4.0 / 16.0;
        if (idx == 6) return 14.0 / 16.0;
        if (idx == 7) return 6.0 / 16.0;
        if (idx == 8) return 3.0 / 16.0;
        if (idx == 9) return 11.0 / 16.0;
        if (idx == 10) return 1.0 / 16.0;
        if (idx == 11) return 9.0 / 16.0;
        if (idx == 12) return 15.0 / 16.0;
        if (idx == 13) return 7.0 / 16.0;
        if (idx == 14) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      void main() {
        vec2 uv = vUv;

        // Horizontal VHS / Psychological Horror tear glitch
        float totalGlitch = clamp(uGlitchBurst + uHorrorIntensity * 0.22, 0.0, 1.0);
        if (totalGlitch > 0.01) {
          float band = floor(uv.y * 28.0 + uTime * 19.0);
          float n = hash(vec2(band, floor(uTime * 24.0)));
          if (n > 1.0 - totalGlitch * 0.38) {
            uv.x += (n - 0.5) * 0.08 * totalGlitch;
          }
        }

        // Snap UV to low-res pixel grid
        vec2 pixelCoord = floor(uv * uResolution);
        vec2 snappedUv = (pixelCoord + 0.5) / uResolution;

        // Chromatic aberration near screen edges & during horror spikes
        vec2 centerVec = snappedUv - 0.5;
        float caOffset = (0.0012 * uCrtEnabled) + (0.0045 * uHorrorIntensity) + (0.015 * uGlitchBurst);
        float r = texture2D(tDiffuse, clamp(snappedUv + centerVec * caOffset, 0.001, 0.999)).r;
        float g = texture2D(tDiffuse, clamp(snappedUv, 0.001, 0.999)).g;
        float b = texture2D(tDiffuse, clamp(snappedUv - centerVec * caOffset, 0.001, 0.999)).b;
        vec3 col = vec3(r, g, b);

        // Lift shadows gently so warm ceiling light & PSX dithering read clearly
        col = pow(max(col, vec3(0.0)), vec3(0.86));

        // PSX Bayer Dithering + Color Quantization
        float dither = (bayer4x4(pixelCoord) - 0.5) * (1.15 / uColorSteps) * uDitherStrength;
        col = clamp(col + dither, 0.0, 1.0);
        col = floor(col * uColorSteps + 0.5) / uColorSteps;

        // Optional subtle CRT scanline & film noise
        if (uCrtEnabled > 0.5) {
          float scanline = sin(pixelCoord.y * 3.14159) * 0.03;
          col -= scanline;
          float grain = (hash(pixelCoord + fract(uTime * 7.13)) - 0.5) * (0.025 + uHorrorIntensity * 0.05);
          col += grain;
        }

        // Atmospheric horror vignette (balanced so corners stay visible when yellow lamp is ON)
        float dist = length((vUv - 0.5) * vec2(1.12, 1.28));
        float vig = smoothstep(1.02, 0.36 - uHorrorIntensity * 0.12, dist);
        col *= mix(0.50, 1.0, vig);

        // Red panic / jumpscare tint
        if (uRedFlash > 0.001) {
          col = mix(col, vec3(col.r * 1.6 + 0.25, col.g * 0.15, col.b * 0.15), uRedFlash);
        }

        // Micro-sleep / Eyelid blink effect
        if (uBlinkClose > 0.001) {
          float lidDist = abs(vUv.y - 0.5) * 2.0;
          float openThreshold = 1.0 - uBlinkClose;
          float mask = smoothstep(openThreshold + 0.08, max(0.0, openThreshold - 0.04), lidDist);
          col *= mask;
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false
  });
}
