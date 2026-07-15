/*
 * laser.js — fullscreen WebGL volumetric laser beam for the gtmos hero.
 *
 * Technique reference: LaserFlow effect by David Haz / react-bits
 * (github.com/DavidHDev/react-bits, MIT + Commons Clause). The GLSL below
 * is an original implementation written for this page — a 2D raymarched-
 * style beam (distance-to-centerline glow + fbm wisp noise + fog) inspired
 * by that project's visual approach, not copied from its source. No
 * react-bits code, assets, or dependencies are included here; this file
 * uses only the raw WebGLRenderingContext, with zero runtime dependencies.
 *
 * Behavior:
 *  - Renders a single fullscreen triangle; all visuals live in the
 *    fragment shader (raymarched-look beam + wisps + drift + vignette).
 *  - Respects prefers-reduced-motion: never starts the render loop, and
 *    lets styles.css show the static CSS glow fallback instead.
 *  - Pauses the rAF loop when the tab is hidden or the hero scrolls out
 *    of view (IntersectionObserver), resumes when both are true again.
 *  - Falls back to the static CSS glow if WebGL is unavailable.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('laser-canvas');
  var fallbackGlow = document.querySelector('.hero-fallback-glow');
  var heroSection = document.querySelector('.hero');
  if (!canvas) return;

  function useFallback() {
    canvas.style.display = 'none';
    if (fallbackGlow) fallbackGlow.classList.add('active');
  }

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    useFallback();
    return;
  }

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    useFallback();
    return;
  }

  var VERTEX_SRC =
    'attribute vec2 aPos;' +
    'void main() {' +
    '  gl_Position = vec4(aPos, 0.0, 1.0);' +
    '}';

  var FRAGMENT_SRC =
    'precision highp float;' +
    'uniform float iTime;' +
    'uniform vec2 iResolution;' +
    'uniform vec3 uColor;' +

    // hash + value noise + fbm — cheap procedural wisps/fog
    'float hash(vec2 p) {' +
    '  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453123);' +
    '}' +
    'float noise(vec2 p) {' +
    '  vec2 i = floor(p);' +
    '  vec2 f = fract(p);' +
    '  float a = hash(i);' +
    '  float b = hash(i + vec2(1.0, 0.0));' +
    '  float c = hash(i + vec2(0.0, 1.0));' +
    '  float d = hash(i + vec2(1.0, 1.0));' +
    '  vec2 u = f * f * (3.0 - 2.0 * f);' +
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);' +
    '}' +
    'float fbm(vec2 p) {' +
    '  float v = 0.0;' +
    '  float amp = 0.5;' +
    '  for (int i = 0; i < 5; i++) {' +
    '    v += amp * noise(p);' +
    '    p *= 2.02;' +
    '    amp *= 0.5;' +
    '  }' +
    '  return v;' +
    '}' +

    // slow horizontal drift of the beam's centerline as it falls
    'float beamCenter(float y, float t) {' +
    '  float drift = sin(y * 1.6 - t * 0.15) * 0.035;' +
    '  drift += sin(y * 3.7 + t * 0.08) * 0.015;' +
    '  return 0.63 + drift;' +
    '}' +

    'void main() {' +
    '  vec2 uv = gl_FragCoord.xy / iResolution.xy;' +
    '  float aspect = iResolution.x / max(iResolution.y, 1.0);' +
    '  float t = iTime;' +

    // fall-from-top: y=0 top of image in this coordinate frame
    '  float yTop = 1.0 - uv.y;' +
    '  float cx = beamCenter(yTop, t);' +
    '  float dx = (uv.x - cx) * aspect;' +

    // core beam: distance-to-centerline glow, raymarched-style falloff
    // (accumulated across a few virtual "steps" down the beam depth)
    '  float glow = 0.0;' +
    '  for (int i = 0; i < 6; i++) {' +
    '    float fi = float(i);' +
    '    float depth = fi / 6.0;' +
    '    float coreWidth = mix(0.006, 0.028, depth);' +
    '    float haloWidth = mix(0.05, 0.16, depth);' +
    '    float sampleY = yTop - depth * 0.12;' +
    '    float sCenter = beamCenter(sampleY, t);' +
    '    float sdx = (uv.x - sCenter) * aspect;' +
    '    float core = coreWidth / (abs(sdx) + coreWidth * 0.6);' +
    '    float halo = haloWidth / (abs(sdx) + haloWidth);' +
    '    glow += (core * 0.5 + halo * 0.18) * (1.0 - depth * 0.4);' +
    '  }' +
    '  glow /= 6.0;' +

    // fade the beam out near the bottom so it reads as "falling", not a full column
    '  float lengthFade = smoothstep(1.05, 0.15, yTop);' +
    '  float topFade = smoothstep(0.0, 0.12, yTop);' +
    '  glow *= lengthFade * topFade;' +

    // procedural wisp streaks drifting along the beam
    '  vec2 wispUv = vec2(dx * 3.0, yTop * 2.2 - t * 0.22);' +
    '  float wisp = fbm(wispUv * 2.5);' +
    '  wisp = pow(wisp, 2.2);' +
    '  float wispMask = smoothstep(0.09, 0.0, abs(dx)) * lengthFade;' +
    '  glow += wisp * wispMask * 0.55;' +

    // soft ambient fog noise around the beam, very low amplitude
    '  float fog = fbm(uv * 3.0 + vec2(0.0, -t * 0.05)) * 0.05;' +
    '  fog *= smoothstep(0.4, 0.0, abs(dx)) * topFade;' +

    '  float intensity = glow + fog;' +
    '  vec3 core = mix(uColor, vec3(1.0), clamp(intensity * 0.9, 0.0, 1.0));' +
    '  vec3 color = core * intensity;' +

    // gentle vignette so the beam reads against near-black, not a hard edge
    '  float vig = smoothstep(1.0, 0.25, length((uv - vec2(0.5, 0.15)) * vec2(aspect, 1.0)));' +
    '  color *= mix(0.6, 1.0, vig);' +

    '  gl_FragColor = vec4(color, clamp(intensity, 0.0, 1.0));' +
    '}';

  function compile(type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
  var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) {
    useFallback();
    return;
  }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    useFallback();
    return;
  }
  gl.useProgram(program);

  // fullscreen triangle (covers viewport without a quad's extra vertices)
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  var aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uTime = gl.getUniformLocation(program, 'iTime');
  var uRes = gl.getUniformLocation(program, 'iResolution');
  var uColor = gl.getUniformLocation(program, 'uColor');

  // emerald accent for the beam core
  gl.uniform3f(uColor, 0x10 / 255, 0xb9 / 255, 0x81 / 255);

  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    var w = canvas.clientWidth || canvas.parentElement.clientWidth;
    var h = canvas.clientHeight || canvas.parentElement.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  window.addEventListener('resize', resize);
  resize();

  var rafId = null;
  var startTime = performance.now();
  var heroVisible = true;
  var tabVisible = !document.hidden;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var t = (now - startTime) / 1000;
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function start() {
    if (rafId === null) {
      rafId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function syncLoop() {
    if (heroVisible && tabVisible) {
      start();
    } else {
      stop();
    }
  }

  document.addEventListener('visibilitychange', function () {
    tabVisible = !document.hidden;
    syncLoop();
  });

  if (heroSection && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          heroVisible = entry.isIntersecting;
        });
        syncLoop();
      },
      { threshold: 0.05 }
    );
    io.observe(heroSection);
  }

  syncLoop();
})();
