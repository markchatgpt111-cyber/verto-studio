(() => {
  "use strict";

  const canvas = document.querySelector("[data-scene-canvas]");
  if (!canvas) return;

  const loading = document.querySelector("[data-scene-loading]");
  const loadingBar = document.querySelector("[data-scene-progress-bar]");
  const loadingLabel = document.querySelector("[data-scene-loading-label]");
  const sceneLabel = document.querySelector("[data-scene-label]");
  const sceneProgress = document.querySelector("[data-scene-progress]");
  const hudFill = document.querySelector("[data-scene-hud-fill]");
  const chapters = [...document.querySelectorAll("[data-flight-chapter]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sources = [
    "./assets/rocket-sequence/web/01-rocket-before-launch.jpg",
    "./assets/rocket-sequence/web/02-rocket-takeoff.jpg",
    "./assets/rocket-sequence/web/03-rocket-atmosphere.jpg",
    "./assets/rocket-sequence/web/04-rocket-space.jpg",
    "./assets/rocket-sequence/web/01-rocket-before-launch-mobile.jpg"
  ];
  let loadingTimeout = 0;

  const fallback = () => {
    window.clearTimeout(loadingTimeout);
    document.body.classList.add("scene-fallback");
    canvas.hidden = true;
    loading?.remove();
  };

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance"
  });
  if (!gl) { fallback(); return; }
  canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); fallback(); }, { once: true });

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * .5 + .5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_frame0;
    uniform sampler2D u_frame1;
    uniform sampler2D u_frame2;
    uniform sampler2D u_frame3;
    uniform sampler2D u_mobile;
    uniform float u_progress;
    uniform float u_aspect;
    uniform float u_mobileMode;
    uniform float u_reduced;

    vec2 coverUv(vec2 uv, float imageAspect) {
      float ratio = u_aspect / imageAspect;
      if (ratio > 1.0) uv.y = (uv.y - .5) / ratio + .5;
      else uv.x = (uv.x - .5) * ratio + .5;
      return uv;
    }
    vec3 sampleFrame(sampler2D frame, vec2 uv, float aspect) {
      return texture2D(frame, coverUv(uv, aspect)).rgb;
    }
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float stars(vec2 uv, float p) {
      vec2 grid = (uv + vec2(p * .03, p * .008)) * vec2(112.0, 69.0);
      vec2 cell = floor(grid);
      vec2 local = fract(grid) - .5;
      float seed = hash21(cell);
      float radius = mix(.025, .075, hash21(cell + 7.1));
      float point = 1.0 - smoothstep(radius * .4, radius, length(local));
      return point * step(.958, seed) * mix(.3, 1.0, hash21(cell + 2.4));
    }
    void main() {
      float p = clamp(u_progress, 0.0, 1.0);
      vec2 uv = v_uv;
      float launch = smoothstep(.07, .14, p) * (1.0 - smoothstep(.25, .32, p));
      float zoom = 1.0 + (1.0 - u_reduced) * (p * .065 + launch * .025);
      uv = (uv - vec2(.5, .48)) / zoom + vec2(.5, .48);
      uv += (1.0 - u_reduced) * vec2(p * .008 + launch * sin(p * 250.0) * .0012, p * .014);

      vec3 first = mix(sampleFrame(u_frame0, uv, 1.7778), sampleFrame(u_mobile, uv, .5625), u_mobileMode);
      vec3 color = mix(first, sampleFrame(u_frame1, uv, 1.7778), smoothstep(.055, .23, p));
      color = mix(color, sampleFrame(u_frame2, uv, 1.7778), smoothstep(.24, .43, p));
      color = mix(color, sampleFrame(u_frame3, uv, 1.7778), smoothstep(.44, .61, p));

      float starLight = stars(v_uv, p) * smoothstep(.31, .55, p);
      color += vec3(.72, .8, .94) * starLight;

      float destination = smoothstep(.85, .98, p);
      vec2 target = vec2(.79, .69);
      float distanceToTarget = length(v_uv - target);
      color += vec3(1.0, .64, .35) * destination * (.0025 / max(distanceToTarget, .009));
      float routeX = .5 + .29 * pow(clamp((v_uv.y - .06) / .63, 0.0, 1.0), 1.22);
      float route = 1.0 - smoothstep(.0008, .0024, abs(v_uv.x - routeX));
      route *= step(.07, v_uv.y) * (1.0 - step(.7, v_uv.y));
      route *= step(.5, fract(v_uv.y * 79.0));
      color += vec3(1.0, .61, .34) * route * destination * .42;

      float vignette = smoothstep(.94, .18, distance(v_uv, vec2(.5)));
      color *= mix(.82, 1.0, vignette);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
  } catch (error) {
    console.warn("Verto scene fallback:", error);
    fallback();
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    progress: gl.getUniformLocation(program, "u_progress"),
    aspect: gl.getUniformLocation(program, "u_aspect"),
    mobile: gl.getUniformLocation(program, "u_mobileMode"),
    reduced: gl.getUniformLocation(program, "u_reduced")
  };
  const textureUniforms = ["u_frame0", "u_frame1", "u_frame2", "u_frame3", "u_mobile"];
  let ready = false;
  let progress = 0;
  let frameRequested = false;
  const chapterProgress = [0, .12, .25, .38, .52, .56, .59, .62, .65, .68, .8, .88, 1];
  loadingTimeout = window.setTimeout(() => { if (!ready) fallback(); }, 12000);

  const render = () => {
    frameRequested = false;
    if (!ready || document.hidden || canvas.hidden) return;
    gl.uniform1f(uniforms.progress, progress);
    gl.uniform1f(uniforms.mobile, window.innerWidth <= 700 ? 1 : 0);
    gl.uniform1f(uniforms.reduced, reducedMotion ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
  const requestRender = () => {
    if (ready && !frameRequested && !document.hidden) {
      frameRequested = true;
      window.requestAnimationFrame(render);
    }
  };
  const readProgress = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const timelinePosition = Math.min(maxScroll, window.scrollY + Math.min(90, window.innerHeight * .1));
    const index = Math.max(0, chapters.findIndex((chapter, chapterIndex) => {
      const next = chapters[chapterIndex + 1];
      return timelinePosition >= chapter.offsetTop && (!next || timelinePosition < next.offsetTop);
    }));
    const start = chapters[index]?.offsetTop || 0;
    const end = chapters[index + 1]?.offsetTop || maxScroll;
    const local = Math.min(1, Math.max(0, (timelinePosition - start) / Math.max(1, end - start)));
    progress = window.scrollY < 2 ? 0 : chapterProgress[index] + local * (chapterProgress[index + 1] - chapterProgress[index]);
    if (window.scrollY >= maxScroll - 2) progress = 1;
    const midpoint = window.innerHeight * .52;
    let current = chapters[0];
    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();
      const inner = chapter.querySelector(".chapter-inner");
      if (rect.top <= midpoint && rect.bottom > midpoint) current = chapter;
      if (!inner) return;
      if (window.innerWidth <= 700) {
        inner.style.opacity = "";
        inner.style.pointerEvents = "";
        return;
      }
      const entering = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / midpoint));
      const leaving = Math.min(1, Math.max(0, (rect.bottom - midpoint) / (window.innerHeight - midpoint)));
      const opacity = Math.min(entering, leaving);
      inner.style.opacity = String(opacity);
      inner.style.pointerEvents = opacity < .12 ? "none" : "";
    });
    if (sceneLabel) sceneLabel.textContent = current?.dataset.sceneTitle || "VERTO STUDIO";
    if (sceneProgress) sceneProgress.textContent = `${String(Math.round(progress * 100)).padStart(2, "0")}%`;
    if (hudFill) hudFill.style.width = `${Math.round(progress * 100)}%`;
    document.body.classList.toggle("near-end", progress > .96);
    requestRender();
  };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth <= 700 ? 1.25 : 1.75);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uniforms.aspect, window.innerWidth / Math.max(1, window.innerHeight));
    readProgress();
  };

  const setTexture = (image, index) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, textureUniforms[index]), index);
  };

  let loaded = 0;
  const images = sources.map((src, index) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (canvas.hidden) return;
      setTexture(image, index);
      loaded += 1;
      const percent = Math.round((loaded / sources.length) * 100);
      if (loadingBar) loadingBar.style.width = `${percent}%`;
      if (loadingLabel) loadingLabel.textContent = `${percent}%`;
      if (loaded === sources.length) {
        ready = true;
        window.clearTimeout(loadingTimeout);
        resize();
        loading?.classList.add("is-ready");
        window.setTimeout(() => loading?.remove(), reducedMotion ? 0 : 550);
      }
    };
    image.onerror = fallback;
    image.src = src;
    return image;
  });
  void images;

  window.addEventListener("scroll", readProgress, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", requestRender);
  resize();
})();
