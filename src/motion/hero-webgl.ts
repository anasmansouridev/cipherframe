/**
 * M1 Tier A: WebGL "transaction field" (OGL). Lazy-loaded only on Tier A.
 * Particles flow along four curved paths (curl-noise perturbed) into the hexagon,
 * shift blue → mint on arrival, a coral one is rejected every ~5s, the pointer repels
 * the flow, and on scroll-out everything converges into the Cipherframe mark, then dissolves.
 */
import { Geometry, Mesh, Program, Renderer } from "ogl";
import { FIELD_H, FIELD_W, HEX, PATHS, bezier, flashReject, isPhone, markTargets, rng, visibleLoop, type HeroController } from "./field";

const glsl = (n: number) => n.toFixed(1);
const pathConsts = PATHS.map(
  (p, i) => `const vec2 P${i}A = vec2(${glsl(p[0][0])}, ${glsl(p[0][1])}); const vec2 P${i}B = vec2(${glsl(p[1][0])}, ${glsl(p[1][1])});
  const vec2 P${i}C = vec2(${glsl(p[2][0])}, ${glsl(p[2][1])}); const vec2 P${i}D = vec2(${glsl(p[3][0])}, ${glsl(p[3][1])});`,
).join("\n");

const vertex = /* glsl */ `#version 300 es
precision highp float;
in vec4 position; // x: path, y: phase, z: speed, w: size
in vec4 aSeed;
in vec3 aTarget;  // xy: point on the mark, z: 0 bracket / 1 diamond
uniform float uTime;
uniform float uConverge;
uniform float uDissolve;
uniform float uDpr;
uniform vec2 uPointer;
uniform float uRepel;
uniform float uRepelR;
out vec3 vColor;
out float vAlpha;

${pathConsts}
const vec2 HEX = vec2(${glsl(HEX.x)}, ${glsl(HEX.y)});
const vec3 BLUE = vec3(0.482, 0.608, 1.0);
const vec3 MINT = vec3(0.169, 0.894, 0.627);
const vec3 TEXT = vec3(0.918, 0.941, 0.980);

vec2 bez(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
  float u = 1.0 - t;
  return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 curl(vec2 p) {
  float e = 0.08;
  float a = noise(p + vec2(0.0, e)); float b = noise(p - vec2(0.0, e));
  float c = noise(p + vec2(e, 0.0)); float d = noise(p - vec2(e, 0.0));
  return vec2(a - b, -(c - d)) / (2.0 * e);
}

void main() {
  float t = fract(position.y + uTime * position.z);
  int pi = int(position.x + 0.5);
  vec2 A = P0A; vec2 B = P0B; vec2 C = P0C; vec2 D = P0D;
  if (pi == 1) { A = P1A; B = P1B; C = P1C; D = P1D; }
  else if (pi == 2) { A = P2A; B = P2B; C = P2C; D = P2D; }
  else if (pi == 3) { A = P3A; B = P3B; C = P3C; D = P3D; }

  vec2 pos;
  if (t < 0.78) {
    float k = t / 0.78;
    pos = bez(A, B, C, D, k);
    float amp = sin(3.14159 * k) * (14.0 + 18.0 * aSeed.x);
    pos += curl(pos * 0.0065 + aSeed.xy * 3.0 + uTime * 0.06) * amp;
    pos.y += (aSeed.y - 0.5) * 18.0 * sin(3.14159 * k);
  } else {
    float k = (t - 0.78) / 0.22;
    float ang = aSeed.z * 6.2831 + uTime * (0.5 + aSeed.w * 0.8);
    float r = mix(118.0, 14.0 + aSeed.x * 52.0, smoothstep(0.0, 1.0, k)) * (0.55 + 0.45 * aSeed.y);
    vec2 orbit = HEX + vec2(cos(ang), sin(ang) * 0.92) * r;
    pos = mix(D, orbit, smoothstep(0.0, 0.4, k));
  }

  vColor = mix(BLUE, MINT, smoothstep(0.7, 0.84, t));
  vAlpha = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.92, 1.0, t)) * (0.6 + 0.4 * aSeed.w);

  vec2 dp = pos - uPointer;
  float dist = length(dp);
  if (dist < uRepelR) pos += (dp / max(dist, 0.001)) * (uRepelR - dist) * 0.55 * uRepel;

  float cv = clamp(uConverge * 1.25 - aSeed.w * 0.25, 0.0, 1.0);
  cv = cv * cv * (3.0 - 2.0 * cv);
  vec2 tgt = aTarget.xy + vec2(sin(uTime * 1.3 + aSeed.x * 6.28), cos(uTime * 1.1 + aSeed.y * 6.28)) * 1.6;
  pos = mix(pos, tgt, cv);
  vColor = mix(vColor, aTarget.z > 0.5 ? MINT : TEXT, cv);
  vAlpha = mix(vAlpha, 0.85, cv);

  vec2 out_ = pos - HEX;
  pos += (out_ / max(length(out_), 0.001)) * uDissolve * (60.0 + aSeed.x * 220.0);
  vAlpha *= 1.0 - uDissolve;

  vec2 uv = pos / vec2(${glsl(FIELD_W)}, ${glsl(FIELD_H)});
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  gl_PointSize = position.w * uDpr * mix(1.0, 1.3, cv);
}`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  fragColor = vec4(vColor * a, a);
}`;

const coralVertex = /* glsl */ `#version 300 es
precision highp float;
in vec2 position;
uniform vec2 uPos;
uniform float uSize;
void main() {
  vec2 uv = uPos / vec2(${glsl(FIELD_W)}, ${glsl(FIELD_H)});
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  gl_PointSize = uSize;
}`;
const coralFragment = /* glsl */ `#version 300 es
precision highp float;
uniform float uAlpha;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * uAlpha;
  fragColor = vec4(vec3(1.0, 0.42, 0.341) * a, a);
}`;

export interface WebGLOptions {
  /** 1 = hero density; the final CTA uses 0.4. */
  density?: number;
  /** "flow": hero behaviour; "diamond": hold converged on the mark (final CTA). */
  mode?: "flow" | "diamond";
  interactive?: boolean;
}

export function mountWebGL(host: HTMLElement, opts: WebGLOptions = {}): HeroController | null {
  const { density = 1, mode = "flow", interactive = true } = opts;
  const phone = isPhone();
  const count = Math.round((phone ? 2500 : 6000) * density);
  const dpr = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2);

  let renderer: Renderer;
  try {
    renderer = new Renderer({ dpr, alpha: true, antialias: false, premultipliedAlpha: true, webgl: 2, depth: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const gl = renderer.gl;
  if (!gl || !(gl as WebGL2RenderingContext).createVertexArray) return null;
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const rand = rng(11);
  const data = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = Math.floor(rand() * 4);
    data[i * 4 + 1] = rand();
    data[i * 4 + 2] = 0.11 + rand() * 0.09; // ~5–9s per lap
    data[i * 4 + 3] = 1.8 + rand() * rand() * 3.2;
    for (let k = 0; k < 4; k++) seeds[i * 4 + k] = rand();
  }
  const geometry = new Geometry(gl, {
    position: { size: 4, data },
    aSeed: { size: 4, data: seeds },
    aTarget: { size: 3, data: markTargets(count, rand) },
  });
  const uniforms = {
    uTime: { value: 0 },
    uConverge: { value: mode === "diamond" ? 0.85 : 0 },
    uDissolve: { value: 0 },
    uDpr: { value: dpr },
    uPointer: { value: [-9999, -9999] },
    uRepel: { value: 0 },
    uRepelR: { value: 120 },
  };
  const program = new Program(gl, { vertex, fragment, uniforms, transparent: true, depthTest: false, depthWrite: false });
  program.setBlendFunc(gl.ONE, gl.ONE);
  const mesh = new Mesh(gl, { geometry, program, mode: gl.POINTS });

  const coralUniforms = { uPos: { value: [-100, -100] }, uSize: { value: 7 * dpr }, uAlpha: { value: 0 } };
  const coralProgram = new Program(gl, {
    vertex: coralVertex,
    fragment: coralFragment,
    uniforms: coralUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  coralProgram.setBlendFunc(gl.ONE, gl.ONE);
  const coral = new Mesh(gl, { geometry: new Geometry(gl, { position: { size: 2, data: new Float32Array([0, 0]) } }), program: coralProgram, mode: gl.POINTS });

  let fieldScale = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height);
    fieldScale = FIELD_W / r.width;
    uniforms.uRepelR.value = 120 * fieldScale;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Pointer repel (desktop only)
  const pointer = { x: -9999, y: -9999, on: 0 };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = host.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) * fieldScale;
    pointer.y = (e.clientY - r.top) * fieldScale;
    pointer.on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? 1 : 0;
  };
  const pointerOn = interactive && matchMedia("(pointer: fine)").matches;
  if (pointerOn) addEventListener("pointermove", onMove, { passive: true });

  // Scroll-linked converge/dissolve, smoothed
  const target = { converge: uniforms.uConverge.value, dissolve: 0 };

  // Coral rejection every ~5s
  let coralT = -1;
  let nextCoral = 2.2;
  let coralPath = 0;
  let flashed = false;

  let time = 0;
  const loop = visibleLoop(host, (dt) => {
    time += dt;
    uniforms.uTime.value = time;
    if (mode === "diamond") target.converge = 0.84 + Math.sin(time * 0.7) * 0.06;
    uniforms.uConverge.value += (target.converge - uniforms.uConverge.value) * Math.min(1, dt * 6);
    uniforms.uDissolve.value += (target.dissolve - uniforms.uDissolve.value) * Math.min(1, dt * 6);
    uniforms.uRepel.value += (pointer.on - uniforms.uRepel.value) * Math.min(1, dt * 5);
    uniforms.uPointer.value = [pointer.x, pointer.y];

    if (mode === "flow") {
      if (coralT < 0 && time > nextCoral) {
        coralT = 0;
        coralPath = Math.floor(Math.random() * 4);
        flashed = false;
      }
      if (coralT >= 0) {
        coralT += dt / 1.8;
        const approach = Math.min(1, coralT / 0.62);
        const along = coralT < 0.62 ? 0.35 + approach * 0.65 : 1 - ((coralT - 0.62) / 0.38) * 0.3;
        const [x, y] = bezier(PATHS[coralPath], along);
        coralUniforms.uPos.value = [x, y];
        coralUniforms.uAlpha.value = coralT < 0.62 ? Math.min(1, coralT * 6) : Math.max(0, 1 - (coralT - 0.62) / 0.38);
        if (coralT >= 0.62 && !flashed) {
          flashed = true;
          flashReject(host, x, y);
        }
        if (coralT >= 1) {
          coralT = -1;
          nextCoral = time + 4.2 + Math.random() * 1.6;
          coralUniforms.uAlpha.value = 0;
        }
      }
    }
    coralUniforms.uAlpha.value *= 1 - uniforms.uConverge.value;
    renderer.render({ scene: mesh });
    if (coralUniforms.uAlpha.value > 0.01) renderer.render({ scene: coral, clear: false });
  });

  const onLost = (e: Event) => {
    e.preventDefault();
    controller.destroy();
    host.classList.remove("is-live");
  };
  canvas.addEventListener("webglcontextlost", onLost);

  requestAnimationFrame(() => host.classList.add("is-live"));

  const controller: HeroController = {
    kind: "webgl",
    setScroll(p: number) {
      if (mode !== "flow") return;
      const s = (a: number, b: number, x: number) => {
        const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return k * k * (3 - 2 * k);
      };
      target.converge = s(0.02, 0.5, p);
      target.dissolve = s(0.62, 0.95, p);
    },
    destroy() {
      loop.stop();
      ro.disconnect();
      if (pointerOn) removeEventListener("pointermove", onMove);
      canvas.removeEventListener("webglcontextlost", onLost);
      host.classList.remove("is-live");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
  return controller;
}
