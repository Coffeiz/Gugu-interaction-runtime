const ct = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }
}, Wt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, yn = 8;
function _t(t, e = Wt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, a = t.y * e.velocityScale, i = Math.hypot(o, a);
  if (i <= e.maxVelocity || i === 0) return { x: o, y: a };
  const r = e.maxVelocity / i;
  return { x: o * r, y: a * r };
}
function gn(t, e = Wt) {
  const n = _t(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const a = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * a, y: n.y * e.coastSeconds * a };
}
function Nt(t, e, n, o, a, i = 1 / 120) {
  let r = Math.max(0, a);
  for (; r > 1e-4; ) {
    const s = Math.min(r, i);
    r -= s;
    const l = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += c * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const Mt = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, ye = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, jt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, ge = { position: 0.35, velocity: 5 };
function Zt(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? ge, o = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    scaleX: 1,
    scaleY: 1,
    scaleVX: 0,
    scaleVY: 0,
    rotateX: 0,
    rotateZ: 0
  };
  let a = { x: 0, y: 0 }, i = Mt, r = null, s = null, l = !1, c = 0, d = 0, u = "settle", f = 0;
  function T() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function O(p) {
    var D;
    if (!l) return;
    const C = Math.min(0.032, Math.max(0, (p - (s ?? p)) / 1e3));
    if (s = p, u === "coast") {
      const y = Math.exp(-v.friction * C);
      o.vx *= y, o.vy *= y;
      const A = o.vx * C, x = o.vy * C, B = f + Math.hypot(A, x);
      if (B >= v.maxDistance) {
        const k = Math.max(0, v.maxDistance - f), X = Math.hypot(A, x), V = X > 0 ? k / X : 0;
        o.x += A * V, o.y += x * V, o.vx = 0, o.vy = 0, u = "settle";
      } else
        o.x += A, o.y += x, f = B, ((p - (F ?? p)) / 1e3 >= v.duration || Math.hypot(o.vx, o.vy) <= v.minVelocity) && (u = "settle");
    }
    if (u === "settle") {
      const y = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      Nt(y, { x: a.x, y: a.y }, i.position.stiffness, i.position.damping, C), o.x = y.position.x, o.y = y.position.y, o.vx = y.velocity.x, o.vy = y.velocity.y;
    }
    const M = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (Nt(M, { x: a.scaleX ?? o.scaleX, y: a.scaleY ?? o.scaleY }, i.scale.stiffness, i.scale.damping, C), o.scaleX = M.position.x, o.scaleY = M.position.y, o.scaleVX = M.velocity.x, o.scaleVY = M.velocity.y, e === "follow") {
      const y = t.followRotation, A = -Math.log(1 - (y.smoothing ?? 0.2)) * 60, x = 1 - Math.exp(-A * C);
      c += (o.vx - c) * x, d += (o.vy - d) * x, o.rotateZ = Math.max(-(y.maxSway ?? 5), Math.min(y.maxSway ?? 5, c / 60 * y.sway));
      const B = Math.max(-(y.maxTiltDelta ?? 4), Math.min(y.maxTiltDelta ?? 4, d / 60 * (y.verticalTiltFactor ?? 0.16)));
      o.rotateX = y.tilt + B;
    } else {
      const y = Math.exp(-10 * C);
      o.rotateX *= y, o.rotateZ *= y;
    }
    if (T(), e === "follow") {
      r = requestAnimationFrame(O);
      return;
    }
    if (u === "settle" && Math.abs(a.x - o.x) < n.position && Math.abs(a.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      l = !1, r = null, (D = t.onArrived) == null || D.call(t);
      return;
    }
    r = requestAnimationFrame(O);
  }
  let v = null, F = null;
  return {
    seed(p) {
      Object.assign(o, p);
    },
    setTarget(p) {
      a = { ...p };
    },
    retarget(p) {
      a = { ...p };
    },
    setProfile(p) {
      i = p;
    },
    getState() {
      return o;
    },
    start() {
      l || (l = !0, u = "settle", v = null, F = null, s = null, T(), r = requestAnimationFrame(O));
    },
    startCoastThenSettle(p) {
      if (l) return;
      l = !0, u = "coast", v = p, f = 0, F = null;
      const C = Math.hypot(o.vx, o.vy), M = p.maxDistance / Math.max(p.duration, 1 / 60);
      if (C > M && C > 0) {
        const w = M / C;
        o.vx *= w, o.vy *= w;
      }
      s = null, T(), r = requestAnimationFrame((w) => {
        F = w, O(w);
      });
    },
    interrupt() {
      return l = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    cancel() {
      return l = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    stop() {
      l = !1, r !== null && cancelAnimationFrame(r), r = null;
    }
  };
}
function me(t) {
  const e = getComputedStyle(t);
  return {
    fontFamily: e.fontFamily,
    color: e.color,
    fontSize: e.fontSize,
    fontWeight: e.fontWeight,
    lineHeight: e.lineHeight,
    letterSpacing: e.letterSpacing,
    textAlign: e.textAlign,
    direction: e.direction,
    wordSpacing: e.wordSpacing,
    whiteSpace: e.whiteSpace,
    textIndent: e.textIndent
  };
}
function pe(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Lt(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function he(t, e = t.getBoundingClientRect(), n = {}) {
  var d;
  const o = (d = n.layout) == null ? void 0 : d.compact, a = o ? 1 : 1.03, i = document.createElement("div"), r = document.createElement("div"), s = t.cloneNode(!0);
  r.dataset.runtimeProxyScaleShell = "true", s.dataset.runtimeProxyContent = "true", Object.assign(r.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    transformOrigin: "0 0",
    pointerEvents: "none"
  }), Object.assign(s.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    margin: "0",
    pointerEvents: "none"
  }), s.dataset.runtimePhase = "grab-start", r.appendChild(s), i.appendChild(r), i.className = "", i.style.position = "fixed", i.style.left = `${e.left}px`, i.style.top = `${e.top}px`, i.style.boxSizing = "border-box", i.style.width = `${e.width}px`, i.style.height = `${e.height}px`, i.style.margin = "0", i.style.zIndex = "2147483647", i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = `perspective(760px) rotateX(5deg) scale(${a})`, Pt && n.glass !== !1 ? Kt(s) : s.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o && (s.dataset.runtimeCompact = "true");
  const l = (o == null ? void 0 : o.duration) ?? 200, c = (o == null ? void 0 : o.easing) ?? "cubic-bezier(.22,1,.36,1)";
  return s.style.transition = `left ${l}ms ${c}, width ${l}ms ${c}, transform ${l}ms ${c}, grid-template-columns ${l}ms ${c}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, i.style.transition = "transform .15s ease", document.documentElement.appendChild(i), requestAnimationFrame(() => {
    i.isConnected && s.dataset.runtimePhase === "grab-start" && (s.dataset.runtimePhase = "grabbing", o && (s.style.left = o.left ?? "50%", s.style.width = o.width, s.style.transform = o.transform ?? "translateX(-50%)", o.gridTemplateColumns && (s.style.gridTemplateColumns = o.gridTemplateColumns)));
  }), Rt.add(i), i;
}
function mn(t) {
  return t;
}
function Xt(t) {
  return t.querySelector(
    "[data-runtime-proxy-content]:not([data-runtime-group-modifier])"
  ) ?? t;
}
function Ft(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function qt(t) {
  const e = [];
  for (const n of Array.from(t.childNodes)) {
    if (n.nodeType === Node.COMMENT_NODE) {
      n.remove();
      continue;
    }
    if (n.nodeType === Node.TEXT_NODE) {
      if (!(n.textContent ?? "").trim()) {
        n.remove();
        continue;
      }
      const o = document.createElement("span");
      o.textContent = n.textContent, n.replaceWith(o), e.push(o);
      continue;
    }
    n.nodeType === Node.ELEMENT_NODE && e.push(n);
  }
  return e;
}
function Ut(t, e) {
  const n = getComputedStyle(e), o = parseFloat(n.paddingTop) || 0, a = parseFloat(n.paddingRight) || 0, i = parseFloat(n.paddingBottom) || 0, s = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${o}px`,
    right: `${a}px`,
    bottom: `${i}px`,
    pointerEvents: "none"
  }, l = document.createElement("div");
  Object.assign(l.style, { ...s });
  const c = getComputedStyle(t);
  for (l.style.display = c.display, l.style.flexDirection = c.flexDirection, l.style.flexWrap = c.flexWrap, l.style.alignItems = c.alignItems, l.style.justifyContent = c.justifyContent, l.style.gap = c.gap; t.firstChild; ) l.appendChild(t.firstChild);
  const d = qt(l), u = new Set(d.map(Ft)), f = document.createElement("div");
  Object.assign(f.style, { ...s, pointerEvents: "" }), f.style.display = n.display, f.style.gridTemplateColumns = n.gridTemplateColumns, f.style.gridTemplateRows = n.gridTemplateRows, f.style.gridAutoColumns = n.gridAutoColumns, f.style.gridAutoRows = n.gridAutoRows, f.style.gridAutoFlow = n.gridAutoFlow, f.style.justifyItems = n.justifyItems, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.alignContent = n.alignContent, f.style.columnGap = n.columnGap, f.style.rowGap = n.rowGap, f.style.flexDirection = n.flexDirection, f.style.flexWrap = n.flexWrap, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.gap = n.gap, f.style.overflow = "hidden";
  const T = e.cloneNode(!0);
  for (T.style.visibility = "visible", T.style.display = ""; T.firstChild; ) f.appendChild(T.firstChild);
  const O = me(e);
  pe(f, O);
  const v = qt(f), F = new Set(v.map(Ft)), p = v.filter((w) => !u.has(Ft(w)));
  for (const w of p) w.style.opacity = "0";
  const C = d.filter((w) => !F.has(Ft(w))), M = new Set(C);
  for (const w of d)
    M.has(w) || (w.style.opacity = "0");
  return t.appendChild(f), C.length > 0 && t.appendChild(l), { enteringEls: p, leavingEls: C };
}
function pn(t, e) {
  const n = Math.max(e.left, e.right - t.width), o = Math.max(e.top, e.bottom - t.height);
  return {
    left: Math.min(Math.max(t.left, e.left), n),
    top: Math.min(Math.max(t.top, e.top), o),
    width: t.width,
    height: t.height
  };
}
function hn(t, e, n = {}) {
  const o = n.duration ?? ct.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, d = n.targetOpacity, u = Xt(t), f = n.targetContent ? Ut(u, n.targetContent) : null;
  if (f) {
    for (const h of f.enteringEls) h.style.transition = `opacity ${o}ms ${a}`;
    for (const h of f.leavingEls) h.style.transition = `opacity ${o}ms ${a}`;
  }
  const T = parseFloat(t.style.left) || 0, O = parseFloat(t.style.top) || 0;
  let v = !1, F = e;
  const p = performance.now();
  let C = () => {
  }, M = () => {
  };
  const w = new Promise((h) => {
    M = h;
  }), D = () => {
    const h = t.getBoundingClientRect();
    return Math.abs(h.left - F.left) < 2 && Math.abs(h.top - F.top) < 2 && Math.abs(h.width - F.width) < 2 && Math.abs(h.height - F.height) < 2;
  };
  let y = null, A = null, x = 0;
  const B = 60, k = (h) => {
    v || (v = !0, t.removeEventListener("transitionend", C), A !== null && (window.clearTimeout(A), A = null), M());
  }, X = () => {
    if (!v) {
      if (D()) {
        k();
        return;
      }
      if (performance.now() - p >= o + 500) {
        k();
        return;
      }
      window.requestAnimationFrame(X);
    }
  }, V = (h, $ = o) => {
    F = h;
    const j = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${j.width.toFixed(2)}px`, t.style.height = `${j.height.toFixed(2)}px`, t.style.transform = `translate3d(${(j.left - T).toFixed(2)}px, ${(j.top - O).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const q = `translate3d(${(h.left - T).toFixed(2)}px, ${(h.top - O).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${$}ms ${a}, width ${$}ms ${a}, height ${$}ms ${a}`, u.style.transition = [
      `box-shadow ${$}ms ease`,
      `border-radius ${$}ms ease`,
      `border-color ${$}ms ease`,
      `backdrop-filter ${$}ms ease`,
      `-webkit-backdrop-filter ${$}ms ease`,
      `background-color ${$}ms ease`,
      `background-image ${$}ms ease`,
      `opacity ${$}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = q, t.style.width = `${h.width.toFixed(2)}px`, t.style.height = `${h.height.toFixed(2)}px`, i != null && (u.style.boxShadow = i), r != null && (u.style.borderRadius = r), s != null && (u.style.border = s), l != null && (u.style.backdropFilter = l, u.style.setProperty("-webkit-backdrop-filter", l)), c != null && (u.style.backgroundColor = c, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), d != null && (u.style.opacity = d), f) {
        for (const _ of f.enteringEls) _.style.opacity = "1";
        for (const _ of f.leavingEls) _.style.opacity = "0";
      }
    });
  };
  C = (h) => {
    h.target !== t || !(h.propertyName === "transform" || h.propertyName === "width" || h.propertyName === "height") || D() && k(`transitionend:${h.propertyName}`);
  }, t.addEventListener("transitionend", C), V(e), window.setTimeout(X, o + 40);
  const Q = (h) => {
    var j;
    x = performance.now();
    const $ = Math.max(80, o - (x - p));
    V(((j = n.readTarget) == null ? void 0 : j.call(n)) ?? h, $);
  };
  return { finished: w, retarget: (h) => {
    if (v) return;
    const $ = Math.abs(h.left - F.left), j = Math.abs(h.top - F.top), q = Math.abs(h.width - F.width), _ = Math.abs(h.height - F.height);
    if ($ < 0.5 && j < 0.5 && q < 0.5 && _ < 0.5) return;
    const Z = performance.now() - x;
    if (Z >= B) {
      Q(h);
      return;
    }
    y = h, A === null && (A = window.setTimeout(() => {
      if (A = null, v || !y) return;
      const W = y;
      y = null, Q(W);
    }, B - Z));
  } };
}
function xn(t, e, n = {}) {
  var St, vt, yt, g, m, S, R, U, z, G, P, Y, L;
  const o = n.duration ?? ct.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, d = n.targetOpacity, u = Xt(t), f = t.querySelector("[data-runtime-proxy-scale-shell]"), T = n.targetContent ? Ut(u, n.targetContent) : null;
  if (T) {
    for (const b of T.enteringEls) b.style.transition = `opacity ${o}ms ${a}`;
    for (const b of T.leavingEls) b.style.transition = `opacity ${o}ms ${a}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const O = parseFloat(t.style.left) || t.getBoundingClientRect().left, v = parseFloat(t.style.top) || t.getBoundingClientRect().top, F = t.getBoundingClientRect(), p = F.width || e.width, C = F.height || e.height, M = (b) => ({
    left: b.left - (p - b.width) / 2,
    top: b.top - (C - b.height) / 2,
    width: b.width,
    height: b.height
  });
  let w = e, D = !1;
  const y = n.landingMode === "target" && !!f, A = y ? ((St = n.dismiss) == null ? void 0 : St.duration) ?? o : 0;
  let x = !1, B = !y, k = null, X = null, V = 0, Q = () => {
  };
  const it = new Promise((b) => {
    Q = b;
  }), h = () => {
    D || (D = !0, q.stop(), k !== null && window.clearTimeout(k), X !== null && window.clearTimeout(X), k = null, X = null, Q());
  }, $ = () => {
    x && B && h();
  }, j = () => {
    D || (x = !0, $());
  }, q = Zt({
    mode: "settle",
    onFrame: (b) => {
      const N = p * b.scaleX, I = C * b.scaleY, H = b.x + (p - N) / 2, st = b.y + (C - I) / 2;
      t.style.transform = `perspective(760px) translate3d(${(H - O).toFixed(2)}px, ${(st - v).toFixed(2)}px, 0) rotateX(${b.rotateX.toFixed(2)}deg) rotateZ(${b.rotateZ.toFixed(2)}deg)`, t.style.width = `${N.toFixed(2)}px`, t.style.height = `${I.toFixed(2)}px`;
    },
    onArrived: j
  }), _ = Math.hypot(((vt = n.motionState) == null ? void 0 : vt.vx) ?? 0, ((yt = n.motionState) == null ? void 0 : yt.vy) ?? 0), Z = n.releaseDamping ?? 0.78, W = n.targetMotion ? {
    position: { ...Mt.position, ...n.targetMotion.position },
    scale: { ...Mt.scale, ...n.targetMotion.scale }
  } : Mt;
  q.setProfile(_ > 30 ? {
    ...W,
    position: {
      ...W.position,
      damping: W.position.damping * Z
    }
  } : W), q.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((g = n.motionState) == null ? void 0 : g.x) ?? F.left,
    y: ((m = n.motionState) == null ? void 0 : m.y) ?? F.top,
    vx: ((S = n.motionState) == null ? void 0 : S.vx) ?? 0,
    vy: ((R = n.motionState) == null ? void 0 : R.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((U = n.motionState) == null ? void 0 : U.scaleX) ?? 1,
    scaleY: ((z = n.motionState) == null ? void 0 : z.scaleY) ?? 1,
    rotateX: ((G = n.motionState) == null ? void 0 : G.rotateX) ?? 0,
    rotateZ: ((P = n.motionState) == null ? void 0 : P.rotateZ) ?? 0
  });
  const rt = M(e), bt = n.landingMode === "target" ? { scaleX: 1, scaleY: 1 } : { scaleX: rt.width / p, scaleY: rt.height / C };
  q.setTarget({
    x: rt.left,
    y: rt.top,
    scaleX: bt.scaleX,
    scaleY: bt.scaleY
  }), t.style.transition = "", u.style.transition = [
    ...n.landingMode !== "target" ? [
      `left ${o}ms ${a}`,
      `width ${o}ms ${a}`,
      `transform ${o}ms ${a}`,
      `grid-template-columns ${o}ms ${a}`
    ] : [],
    `box-shadow ${o}ms ${a}`,
    `border-radius ${o}ms ${a}`,
    `border-color ${o}ms ${a}`,
    `backdrop-filter ${o}ms ${a}`,
    `-webkit-backdrop-filter ${o}ms ${a}`,
    `background-color ${o}ms ${a}`,
    `background-image ${o}ms ${a}`,
    `opacity ${o}ms ${a}`
  ].join(", "), requestAnimationFrame(() => {
    var b, N;
    if (!D) {
      if (n.landingMode !== "target" && (u.dataset.runtimePhase = "landing", u.dataset.runtimeCompact === "true" && (u.style.left = "0", u.style.width = "100%", u.style.transform = "none", u.style.gridTemplateColumns = "", delete u.dataset.runtimeCompact)), i != null && (u.style.boxShadow = i), r != null && (u.style.borderRadius = r), s != null && (u.style.border = s), l != null && (u.style.backdropFilter = l, u.style.setProperty("-webkit-backdrop-filter", l)), c != null && (u.style.backgroundColor = c, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), d != null && (u.style.opacity = d), y && f) {
        const I = ((b = n.dismiss) == null ? void 0 : b.easing) ?? a, H = ((N = n.dismiss) == null ? void 0 : N.scale) ?? 0.72;
        f.style.transformOrigin = "50% 50%", f.style.transition = `transform ${A}ms ${I}`, u.style.transition = `opacity ${A}ms ${I}`, f.style.transform = `scale(${H})`, u.style.opacity = "0", X = window.setTimeout(() => {
          X = null, B = !0, $();
        }, A + 40);
      }
      if (T) {
        for (const I of T.enteringEls) I.style.opacity = "1";
        for (const I of T.leavingEls) I.style.opacity = "0";
      }
    }
  });
  const at = (b = 0) => {
    k !== null && window.clearTimeout(k), V = performance.now() + Math.max(2e3, o * 8, 5e3) + b, k = window.setTimeout(() => {
      k = null, !D && performance.now() >= V && j();
    }, Math.max(2e3, o * 8, 5e3) + b);
  };
  at();
  const nt = n.coast;
  return nt && nt.maxDistance > 0 && Math.hypot(((Y = n.motionState) == null ? void 0 : Y.vx) ?? 0, ((L = n.motionState) == null ? void 0 : L.vy) ?? 0) > nt.minVelocity ? q.startCoastThenSettle(nt) : q.start(), {
    finished: it,
    retarget(b) {
      if (D) return;
      w = b, at(1e3);
      const N = M(w);
      q.setTarget({
        x: N.left,
        y: N.top,
        scaleX: n.landingMode === "target" ? 1 : N.width / p,
        scaleY: n.landingMode === "target" ? 1 : N.height / C
      });
    }
  };
}
function bn(t) {
  Rt.has(t) && (Rt.delete(t), t.remove());
}
const kt = /* @__PURE__ */ new WeakMap(), ut = /* @__PURE__ */ new WeakMap(), Bt = /* @__PURE__ */ new WeakSet();
function xe(t, e, n = {}) {
  var r;
  kt.set(t, { style: t.getAttribute("style") ?? "" });
  const o = he(t, e, { glass: !1, layout: n.layout }), a = Xt(o), i = !!((r = n.layout) != null && r.compact);
  o.style.zIndex = "1000", o.style.transform = "scale(1)", o.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", Bt.add(o), ut.set(t, o), n.keepSourceVisible || (t.style.visibility = "hidden"), requestAnimationFrame(() => {
    o.isConnected && (Pt ? Kt(a) : a.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o.style.transform = `scale(${i ? 1 : 1.03})`);
  });
}
function Yt(t) {
  return ut.get(t);
}
function be(t) {
  const e = ut.get(t);
  if (e)
    return Bt.delete(e), ut.delete(t), kt.delete(t), e.style.zIndex = "2147483647", e;
}
function Ct(t) {
  const e = ut.get(t);
  e && (Bt.delete(e), e.remove(), Rt.delete(e), ut.delete(t));
  const n = kt.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), kt.delete(t);
}
const Rt = /* @__PURE__ */ new Set();
let Pt = !1;
function Sn(t) {
  Pt = t;
}
function vn() {
  return Pt;
}
function Kt(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", t.style.boxShadow = "0 22px 50px rgba(30, 35, 60, 0.30)", t.style.opacity = "0.97";
}
const dt = /* @__PURE__ */ new Map();
function wn(t, e) {
  dt.set(t, e), t.style.visibility = "hidden";
}
function Se(t, e) {
  (t.style.visibility === "hidden" || getComputedStyle(t).visibility === "hidden") && dt.set(t, e);
}
function Fn(t, e) {
  const n = dt.get(t) === e;
  return n && (t.style.visibility = "", dt.delete(t)), n;
}
function ve(t, e) {
  dt.get(t) === e && dt.delete(t);
}
const Et = /* @__PURE__ */ new WeakMap();
function we(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  Et.set(t, n);
  const o = () => Et.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, Et.delete(t), !0) : !1,
    isOwner: o
  };
}
function Fe(t) {
  const e = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    scaleX: 1,
    scaleY: 1,
    scaleVX: 0,
    scaleVY: 0,
    rotateX: 0,
    rotateZ: 0
  };
  return {
    setTarget(n) {
      e.x = n.x, e.y = n.y, t.onFrame({ x: e.x, y: e.y, scaleX: 1, scaleY: 1, rotateX: 0, rotateZ: 0 });
    },
    getState: () => e,
    stop() {
    }
  };
}
const gt = /* @__PURE__ */ new WeakMap(), mt = /* @__PURE__ */ new WeakMap();
function Jt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [o, a, i, r] = n;
  return (s) => {
    let l = 0, c = 1;
    for (let u = 0; u < 12; u += 1) {
      const f = (l + c) / 2;
      3 * (1 - f) ** 2 * f * o + 3 * (1 - f) * f ** 2 * i + f ** 3 < s ? l = f : c = f;
    }
    const d = (l + c) / 2;
    return 3 * (1 - d) ** 2 * d * a + 3 * (1 - d) * d ** 2 * r + d ** 3;
  };
}
function Ot(t) {
  const e = gt.get(t);
  e && (cancelAnimationFrame(e.frame), gt.delete(t), t.style.transform = "");
}
function Ce(t, e, n, o, a, i) {
  Ot(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Jt(a)
  };
  gt.set(t, r);
  const s = (l) => {
    if (gt.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), d = r.easing(c);
    if (t.style.transform = `translate(${(r.fromX * (1 - d)).toFixed(3)}px, ${(r.fromY * (1 - d)).toFixed(3)}px)`, c >= 1) {
      gt.delete(t), t.style.transform = "", i == null || i();
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
function Dt(t) {
  const e = mt.get(t);
  e && (cancelAnimationFrame(e.frame), mt.delete(t), t.style.height = "");
}
function Te(t, e, n, o, a, i) {
  Dt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Jt(a)
  };
  mt.set(t, r);
  const s = (l) => {
    if (mt.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), d = r.fromX + (r.fromY - r.fromX) * r.easing(c);
    if (t.style.height = `${d}px`, c >= 1) {
      mt.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
const pt = ct.flip.duration, ht = ct.flip.easing;
function Me(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((o) => n.set(o, (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect())), n;
}
function Qt(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, Ot(n), n.style.setProperty("transition", "none", "important");
}
function ke(t, e, n = pt, o = ht, a) {
  Qt(t);
  const i = [];
  for (const r of t) {
    if (r.dataset.runtimeProxy === "true" || r.dataset.runtimePlaceholder === "true" || r.dataset.runtimeActive === "true")
      continue;
    const s = e.get(r);
    if (!s)
      continue;
    const l = (a == null ? void 0 : a.rect(r)) ?? r.getBoundingClientRect(), c = s.left - l.left, d = s.top - l.top;
    if (Math.abs(c) < 0.5 && Math.abs(d) < 0.5) {
      r.style.transition = "";
      continue;
    }
    i.push({ element: r, dx: c, dy: d });
  }
  for (const { element: r, dx: s, dy: l } of i) {
    r.style.setProperty("transition", "none", "important"), r.style.transform = `translate(${s}px, ${l}px)`;
    const c = String(Number(r.dataset.runtimeFlipToken ?? "0") + 1);
    r.dataset.runtimeFlip = "true", r.dataset.runtimeFlipToken = c, Ce(r, s, l, n, o, () => {
      r.dataset.runtimeFlipToken === c && (r.style.transition = "", delete r.dataset.runtimeFlip);
    });
  }
}
function te(t) {
  return t.dataset.layoutKey ?? t.dataset.card ?? "";
}
const Tt = /* @__PURE__ */ new WeakMap();
function Re(t) {
  const e = t.closest('[data-layout-open="false"]');
  return e !== null && e.dataset.runtimeGroupAnimating !== "true";
}
function ee(t, e) {
  if (Re(t)) return null;
  const n = t.closest("[data-layout-collection]");
  if (!n) return null;
  const o = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect(), a = (e == null ? void 0 : e.rect(n)) ?? n.getBoundingClientRect();
  return o.width > 0 && o.height > 0 && a.width > 0 && o.width <= a.width * 1.25 && o.left >= a.left - 1 && o.right <= a.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function ne(t, e) {
  return !e || e.length === 0 ? !0 : e.some((n) => n === t || n.contains(t));
}
function oe(t, e, n) {
  if (!n || n.length === 0)
    return Array.from(t.querySelectorAll(e));
  const o = [], a = /* @__PURE__ */ new Set();
  for (const i of n)
    i.matches(e) && !a.has(i) && (a.add(i), o.push(i)), i.querySelectorAll(e).forEach((r) => {
      a.has(r) || (a.add(r), o.push(r));
    });
  return o;
}
function $e(t, e, n = te, o, a, i) {
  const r = /* @__PURE__ */ new Map(), s = oe(t, e, a).map((l) => {
    if (o != null && o(l) || !ne(l, a)) return null;
    const c = ee(l, i);
    if (!c) return null;
    const d = n(l);
    if (!d) return null;
    const u = (i == null ? void 0 : i.rect(l)) ?? l.getBoundingClientRect();
    return r.set(d, c.collectionId), {
      key: d,
      element: l,
      rect: { left: u.left, top: u.top, width: u.width, height: u.height },
      contentHTML: l.outerHTML
    };
  }).filter((l) => l !== null);
  return { root: t, selector: e, collectionByKey: r, entries: s, ignore: o, scopeSurfaces: a };
}
function Ae(t, e = {}, n) {
  const o = e.duration ?? 250, a = e.easing ?? "cubic-bezier(.22,1,.36,1)", i = e.key ?? te, r = /* @__PURE__ */ new Map();
  oe(t.root, t.selector, t.scopeSurfaces).filter((l) => {
    var u;
    if ((u = t.ignore) != null && u.call(t, l) || !ne(l, t.scopeSurfaces)) return !1;
    const c = ee(l, n);
    if (!c) return !1;
    const d = i(l);
    return d ? (r.set(d, c.collectionId), !0) : !1;
  }).filter((l) => {
    const c = i(l);
    if (!c) return !1;
    const d = t.collectionByKey.get(c);
    return d === void 0 || d !== r.get(c);
  }).forEach((l) => {
    var d;
    (d = Tt.get(l)) == null || d.cancel();
    const c = l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o, easing: a, fill: "both" });
    Tt.set(l, c), c.finished.then(() => {
      Tt.get(l) === c && Tt.delete(l);
    }).catch(() => {
    });
  }), t.entries.forEach((l) => {
    if (r.has(l.key)) return;
    const c = document.createElement("template");
    c.innerHTML = l.contentHTML;
    const d = c.content.firstElementChild;
    if (!d) return;
    d.removeAttribute("data-file-id"), d.removeAttribute("data-layout-key"), d.removeAttribute("data-layout-role"), d.dataset.runtimePresenceGhost = "true";
    const u = l.rect;
    d.style.position = "fixed", d.style.left = `${u.left}px`, d.style.top = `${u.top}px`, d.style.width = `${u.width}px`, d.style.height = `${u.height}px`, d.style.margin = "0", d.style.pointerEvents = "none", d.style.zIndex = "2147483646", document.body.appendChild(d), d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o, easing: a, fill: "both" }).finished.then(() => d.remove()).catch(() => d.remove());
  });
}
function ie() {
  const t = /* @__PURE__ */ new WeakMap();
  return {
    rect(e) {
      const n = t.get(e);
      if (n) return n;
      const o = e.getBoundingClientRect();
      return t.set(e, o), o;
    }
  };
}
let re = null, ae = !1;
const It = /* @__PURE__ */ new WeakMap();
function Cn(t) {
  re = t;
}
function Tn(t) {
  ae = t;
}
function se() {
  const t = re;
  return {
    flip: (t == null ? void 0 : t.flip) ?? ct.flip,
    resize: (t == null ? void 0 : t.resize) ?? ct.resize
  };
}
function Pe(t, e, n) {
  const o = (s) => !n || n.length === 0 ? !0 : n.some((l) => l === s || l.contains(s)), a = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(o), i = [], r = [];
  for (const s of t)
    o(s) && (s.closest("[data-layout-group]") !== null ? i.push(s) : r.push(s));
  return { groups: a, groupLeaves: i, flatCards: r };
}
function Vt(t, e = document, n = !0, o, a = {}) {
  const i = (v) => {
    const F = a.scopeSurfaces;
    return !F || F.length === 0 ? !0 : F.some((p) => p === v || p.contains(v));
  }, r = Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i), s = r.map((v) => ({ element: v, rect: xt(v), inlineStyle: ue(v) }));
  ce(s);
  const l = ie(), { groups: c, groupLeaves: d, flatCards: u } = Pe(t, e, a.scopeSurfaces), f = We(r, l), T = (a.scopeSurfaces ?? [e]).some(
    (v) => v instanceof HTMLElement ? v.matches("[data-layout-collection]") || v.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), O = {
    root: e,
    group: c.length > 0 ? { before: Ge([...c, ...d], l) } : void 0,
    flat: u.length > 0 ? { elements: u, before: Me(u, l) } : void 0,
    surfaces: f,
    presence: n && T ? $e(e, '[data-layout-role="card"]', void 0, o, a.scopeSurfaces, l) : void 0
  };
  return Oe(e, O);
}
function zt(t) {
  const e = ie(), n = se(), o = t.group ? Ie(t.group.before) : null;
  t.group && je(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && ke(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), _e(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && Ae(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), o && Le(o, n.flip.duration + 50);
}
const ft = /* @__PURE__ */ new WeakMap();
let Ee = 0;
function Ie(t) {
  const e = t.filter((i) => i.rect.height > 0).map((i) => ({ element: i.element, overflow: i.element.style.overflow })).filter((i) => i.element.isConnected).filter((i) => i.element.dataset.runtimeGroupAnimating !== "true").filter((i) => getComputedStyle(i.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), o = ft.get(n);
  o == null || o.entries.forEach(({ element: i, overflow: r }) => {
    i.style.overflow = r;
  }), e.forEach(({ element: i }) => {
    i.style.overflow = "visible";
  });
  const a = { token: String(++Ee), entries: e };
  return ft.set(n, a), a;
}
function Le(t, e) {
  var o;
  const n = (o = t.entries[0]) == null ? void 0 : o.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var a;
    ((a = ft.get(n)) == null ? void 0 : a.token) === t.token && (t.entries.forEach(({ element: i, overflow: r }) => {
      i.style.overflow = r;
    }), ft.delete(n));
  }, e));
}
function Xe(t) {
  et.set(t.root, t), queueMicrotask(() => {
    et.get(t.root) === t && (et.delete(t.root), zt(t));
  });
}
function Be(t) {
  et.set(t.root, t), requestAnimationFrame(() => {
    et.get(t.root) === t && (et.delete(t.root), zt(t));
  });
}
function Oe(t, e) {
  const n = et.get(t);
  if (!n) return e;
  const o = ze(e.surfaces, n.surfaces), a = De(e.flat, n.flat), i = Ve(e.group, n.group);
  return { ...e, flat: a, group: i, surfaces: o };
}
function De(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const a = e.before.get(o);
    a && n.set(o, a);
  }
  return { ...t, before: n };
}
function Ve(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function ze(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const a = n.get(o.element);
    return a ? { ...o, rect: a.rect, inlineStyle: a.inlineStyle } : o;
  });
}
const et = /* @__PURE__ */ new WeakMap(), $t = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakMap(), lt = /* @__PURE__ */ new WeakMap();
function xt(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function Ge(t, e) {
  const n = t.filter((a) => {
    const i = (e == null ? void 0 : e.rect(a)) ?? a.getBoundingClientRect();
    return i.width > 0 && i.height > 0;
  }), o = new Set(n);
  return n.map((a) => ({
    element: a,
    parent: Ne(a, o),
    rect: xt(a, e)
  }));
}
function Ne(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function je(t, e = pt, n = ht, o) {
  Qt(t.map((i) => i.element));
  const a = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = xt(i.element, o);
    a.set(i.element, {
      x: i.rect.left - r.left,
      y: i.rect.top - r.top
    });
  }
  for (const i of t) {
    const r = a.get(i.element), s = i.parent ? a.get(i.parent) : void 0, l = r.x - ((s == null ? void 0 : s.x) ?? 0), c = r.y - ((s == null ? void 0 : s.y) ?? 0);
    if (i.element.dataset.runtimeProxy === "true" || i.element.dataset.runtimePlaceholder === "true" || i.element.dataset.runtimeActive === "true" || Math.abs(l) < 0.5 && Math.abs(c) < 0.5) {
      i.element.dataset.runtimeGroupAnimating !== "true" && (i.element.style.transition = "");
      continue;
    }
    i.element.style.transform = `translate(${l}px, ${c}px)`, i.element.style.transition = "none";
    const d = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = d;
    const u = lt.get(i.element);
    u !== void 0 && (cancelAnimationFrame(u), lt.delete(i.element));
    const f = requestAnimationFrame(() => {
      lt.delete(i.element), i.element.dataset.runtimeFlipToken === d && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    });
    lt.set(i.element, f);
    const T = window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === d && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip, At.delete(i.element));
    }, e + 40);
    At.set(i.element, T);
  }
}
function qe(t, e, n = pt, o = ht, a) {
  le(t);
  const i = a ?? t.getBoundingClientRect().height, r = String(Number(t.dataset.runtimeGroupToken ?? "0") + 1);
  t.dataset.runtimeGroupToken = r;
  const s = Math.abs(Math.max(0, e) - i), c = Math.min(Math.max(s / 8, 200), 350);
  t.dataset.runtimeGroupAnimating = "true", t.style.overflow = "hidden", t.style.height = `${i}px`, t.style.transition = `height ${c}ms ${o}`, t.offsetHeight;
  const d = { frame: null, timeout: null };
  $t.set(t, d), d.frame = requestAnimationFrame(() => {
    d.frame = null, t.style.height = `${Math.max(0, e)}px`;
  }), d.timeout = window.setTimeout(() => {
    t.dataset.runtimeGroupToken === r && (e <= 0 ? (t.style.height = "0px", t.style.overflow = "hidden") : (t.style.height = "", t.style.overflow = ""), t.style.transition = "", delete t.dataset.runtimeGroupAnimating, $t.delete(t));
  }, c + 40);
}
function le(t) {
  const e = $t.get(t);
  e && (e.frame !== null && cancelAnimationFrame(e.frame), e.timeout !== null && window.clearTimeout(e.timeout), $t.delete(t));
}
function Mn(t) {
  et.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, o = ft.get(n);
  o && (o.timeout !== void 0 && window.clearTimeout(o.timeout), o.entries.forEach(({ element: i, overflow: r }) => {
    e && !t.contains(i) || (i.style.overflow = r);
  }), ft.delete(n));
  const a = [];
  t instanceof HTMLElement && a.push(t), typeof t.querySelectorAll == "function" && a.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const i of a) {
    const r = At.get(i), s = lt.get(i), l = r !== void 0 || i.dataset.runtimeFlip === "true" || i.dataset.runtimeGroupAnimating === "true" || i.dataset.runtimeSurfaceResize === "true";
    r !== void 0 && (window.clearTimeout(r), At.delete(i)), s !== void 0 && (cancelAnimationFrame(s), lt.delete(i)), Ot(i), Dt(i), le(i);
    const c = J.get(i);
    c && (Gt(i, c.baseStyle), J.delete(i)), i.dataset.runtimeGroupAnimating === "true" && (i.style.height = i.dataset.layoutOpen === "false" ? "0px" : "", i.style.overflow = i.dataset.layoutOpen === "false" ? "hidden" : "", i.style.transition = ""), l && (i.style.transform = ""), i.dataset.runtimeFlip === "true" && delete i.dataset.runtimeFlip, delete i.dataset.runtimeSurfaceResize, delete i.dataset.runtimeSurfaceResizeToken, delete i.dataset.runtimeGroupAnimating;
  }
}
async function kn(t) {
  const e = (It.get(t.content) ?? 0) + 1;
  It.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll(".done-card-item")), o = (n.length > 0 ? n : Array.from(t.root.querySelectorAll("[data-card]"))).filter((s) => {
    const l = s.getBoundingClientRect();
    return l.width > 0 && l.height > 0;
  }), a = Vt(o, t.root, !1), i = t.content.getBoundingClientRect().height, r = ae ? Ye(t.content, t.opening, t.duration, t.easing) : null;
  t.mutate(), await t.waitForLayout(), It.get(t.content) === e && (t.isCurrent && !t.isCurrent() || (qe(t.content, t.opening ? t.content.scrollHeight : 0, t.duration, t.easing, i), r && He(r, t.opening), zt(a)));
}
function Ye(t, e, n = pt, o = ht) {
  const a = Array.from(t.querySelectorAll(".done-card-item")), i = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = i, a.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: a, token: i, duration: n };
}
function He(t, e) {
  const { content: n, elements: o, token: a, duration: i } = t;
  requestAnimationFrame(() => {
    n.dataset.runtimePresenceToken === a && o.forEach((r) => {
      r.animate(
        [{ opacity: e ? 0 : 1 }, { opacity: e ? 1 : 0 }],
        { duration: i, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }
      );
    });
  }), window.setTimeout(() => {
    n.dataset.runtimePresenceToken === a && o.forEach((r) => {
      r.style.opacity = "";
    });
  }, i + 40);
}
function We(t, e) {
  return t.map((n) => {
    var o;
    return {
      element: n,
      rect: xt(n, e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = J.get(n)) == null ? void 0 : o.baseStyle) ?? ue(n)
    };
  });
}
function _e(t, e = pt, n = ht, o) {
  var i;
  ce(t);
  const a = t.filter((r) => r.element.isConnected).map((r) => {
    const s = xt(r.element, o), l = se();
    return {
      item: r,
      next: s,
      profile: l.resize,
      fromHeight: Ht(r.element, r.rect.height),
      toHeight: Ht(r.element, s.height)
    };
  }).filter(({ item: r, next: s }) => Math.abs(r.rect.height - s.height) >= 0.5);
  for (const { item: r, fromHeight: s } of a) {
    const l = r.element.style, c = {
      baseStyle: ((i = J.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++Ze)
    };
    J.set(r.element, c), l.overflow = "hidden", l.transition = "none", l.height = `${s}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = c.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: s, toHeight: l, profile: c } of a) {
      const d = r.element.style, u = J.get(r.element);
      if (!u || r.element.dataset.runtimeSurfaceResizeToken !== u.token) continue;
      const f = u.token;
      d.transition = "none", Te(r.element, s, l, c.duration, c.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== f) return;
        const T = J.get(r.element);
        !T || T.token !== f || (Gt(r.element, T.baseStyle), J.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, c.duration + 40);
    }
  });
}
function ce(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0)
    for (const { element: n } of e) {
      const o = J.get(n);
      o && (Dt(n), Gt(n, o.baseStyle), J.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
}
const J = /* @__PURE__ */ new WeakMap();
let Ze = 0;
function ue(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function Gt(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function Ht(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
function Ue(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function Ke(t, e, n, o, a) {
  const i = o ?? e.getBoundingClientRect(), r = (a == null ? void 0 : a.align) ?? "center", s = r === "pointer" ? n.clientX - i.left : i.width / 2, l = r === "pointer" ? n.clientY - i.top : i.height / 2, c = s - ((a == null ? void 0 : a.offsetX) ?? 0), d = l - ((a == null ? void 0 : a.offsetY) ?? 0);
  return o && (t.dragOffset = { x: c, y: d }), { rect: i, offsetX: c, offsetY: d };
}
function de(t) {
  return (e) => e === t || e.contains(t);
}
function Je(t, e, n) {
  const o = t.cloneNode(!0), a = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: Vt(a, document, !0, de(t), {
      scopeSurfaces: n == null ? void 0 : n()
    })
  };
}
function Qe(t, e, n) {
  let o = t, a = null;
  return {
    update(i, r) {
      const s = e(i);
      return s ? (n(s, a) || (o = r(s), a = s), a) : (a = null, null);
    },
    release() {
      return a;
    },
    get currentSurface() {
      return o;
    }
  };
}
function tn(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function en(t) {
  t.event.stopPropagation(), Lt(t.proxy, !1), t.clearRegrab(), ve(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden";
}
function nn(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function on(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function rn(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function an(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function sn(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function ln(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function cn(t, e) {
  return t() ?? e();
}
function un(t) {
  return {
    landing: () => {
      const e = t.createGate();
      return t.onGate(e), t.clearDragging(), t.scheduleLanding(), e.promise;
    },
    reveal: () => {
      t.clearRegrab(), t.finishReveal();
    }
  };
}
function dn(t, e, n) {
  let o = 0;
  return {
    capture: () => (o += 1, Vt(
      e().filter((a) => a !== t && a.dataset.runtimeProxy !== "true"),
      document,
      !0,
      de(t),
      { scopeSurfaces: n == null ? void 0 : n() }
    )),
    play: (a, i, r = !1) => {
      const s = ++o;
      if (r) {
        requestAnimationFrame(() => {
          s === o && Be(i);
        });
        return;
      }
      Xe(i);
    }
  };
}
function fn(t) {
  var yt;
  const { runtime: e, objectId: n, element: o, event: a, fromRect: i, clone: r = !1 } = t, s = e.objects.get(n), l = e.surfaces.snapshot(), c = l.map((g) => g.id), d = (g) => {
    var m;
    return (m = e.objects.get(g)) == null ? void 0 : m.surfaceId;
  }, u = (s == null ? void 0 : s.surfaceId) ?? ((yt = l[0]) == null ? void 0 : yt.id), f = (g) => g.closest('[data-layout-content][data-layout-open="false"]') !== null, T = () => {
    const g = [...e.objects.values()].map((S) => S.element).filter((S) => !!(S != null && S.isConnected)), m = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...g, ...m])).filter((S) => !f(S));
  };
  let O, v, F, p = null, C = null, M = null, w = null, D = !1, y = null, A = null, x = null, B = null, k = null, X, V = { x: 0, y: 0 }, Q = null, it = !1, h = !1, $ = null;
  function j(g, m) {
    if (!m || $ || m.scrollHeight >= g) return;
    const S = g - m.scrollHeight;
    if (S <= 0.5) return;
    const R = document.createElement("div");
    R.dataset.runtimeScrollCompensation = "true", R.style.width = "1px", R.style.height = `${S}px`, R.style.flex = "0 0 auto", R.style.pointerEvents = "none", R.style.visibility = "hidden", m.appendChild(R), $ = R, m.scrollTop = Math.min(m.scrollTop, m.scrollHeight - m.clientHeight);
  }
  function q() {
    $ == null || $.remove(), $ = null;
  }
  const _ = () => {
    const g = /* @__PURE__ */ new Set();
    return u && g.add(u), p != null && p.columnId && g.add(p.columnId), e.surfaces.snapshot().filter((m) => g.has(m.id)).map((m) => m.element).filter((m) => !!(m != null && m.isConnected));
  };
  function Z() {
    var g;
    return y ? (g = e.getSession(y)) == null ? void 0 : g.state : void 0;
  }
  function W(g, m) {
    if (Z() !== "active" || !F) return;
    const S = tn({
      active: Z() === "active",
      event: { clientX: g, clientY: m },
      state: F,
      getSurface: (R) => R.columnId
    });
    S && (p = S);
  }
  function rt(g) {
    it = !0, k == null || k.setTarget({
      x: g.clientX - V.x,
      y: g.clientY - V.y
    }), W(g.clientX, g.clientY), B == null || B.update(
      e.resolveMoveSurfaceElement(n, g.clientX, g.clientY),
      { x: g.clientX, y: g.clientY }
    );
  }
  function bt(g) {
    var z, G;
    if (D) return { accepted: !1 };
    if (D = !0, X = k ? { ...k.getState() } : void 0, X) {
      const P = _t({ x: X.vx, y: X.vy });
      X.vx = P.x, X.vy = P.y;
    }
    if (k == null || k.stop(), k = null, B == null || B.stop(), !F || !y) return { accepted: !1 };
    g && W(g.clientX, g.clientY), p = F.release(), !p && !it && X && Math.hypot(X.vx, X.vy) < 0.5 && u && (p = {
      columnId: u,
      index: Q ?? Math.max(0, e.getObjectSurfaceIndex(n, u))
    });
    const m = !p;
    if (m && u && (p = {
      columnId: u,
      index: Q ?? Math.max(0, e.getObjectSurfaceIndex(n, u)),
      invalidReturn: !0
    }), !p) return { accepted: !1 };
    const S = p, R = (w == null ? void 0 : w.getBoundingClientRect()) ?? ((z = e.getVisualProxy(y)) == null ? void 0 : z.element.getBoundingClientRect()) ?? ((G = Yt(o)) == null ? void 0 : G.getBoundingClientRect()) ?? o.getBoundingClientRect();
    delete o.dataset.runtimeActive, m && (h || x == null || x.restoreLayoutHidden(), A == null || A.release());
    const U = (P, Y) => {
      if (Z() !== "landing") return;
      const L = on({
        resolve: () => Y,
        applyState: (I) => e.applyVisualState(n, I, { phase: "revealing", hovered: !1, selected: I.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!L) {
        M == null || M.complete({ completed: !1, reason: "target-not-registered" }), M = null;
        return;
      }
      e.keepSurfaceTargetVisible(S.columnId, L);
      const b = rn((I) => e.captureVisualState(n, I), L), N = an({
        createContext: () => e.createVisualLifecycleContext(P, S, L, O),
        source: o,
        sourceRect: R,
        visualSnapshot: v,
        targetSnapshot: b,
        motionState: X
      });
      w = sn({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
        createProxy: () => e.getVisualProxy(P) ?? e.createVisualProxy(P, N) ?? null,
        enableProxy: (I) => Lt(I, !0),
        bindRegrab: (I) => {
          var st;
          e.bindRegrabTarget(P, n, I, (tt) => nt(tt, n));
          const H = e.getGroup(P);
          if (H)
            for (const tt of H.objectIds) {
              const ot = (st = e.objects.get(tt)) == null ? void 0 : st.element;
              ot != null && ot.isConnected && (ot.style.pointerEvents = "auto", tt !== n && e.registerRegrab(tt, (wt) => nt(wt, tt)));
            }
        },
        land: () => e.landVisualProxy(P, L, N),
        onMissing: () => {
          M == null || M.complete({ completed: !1, reason: "visual-proxy-missing" }), M = null;
        },
        onComplete: (I) => {
          ln({
            active: Z() === "landing",
            result: I,
            complete: (H) => M == null ? void 0 : M.complete(H),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(P, L, N).then(() => {
              w && (e.disposeVisualProxy(P), w = null);
            })
          }), M = null;
        }
      });
    };
    return C = nn(() => {
    }, () => {
      const P = y;
      e.resolveLandingTarget(P, S).then((Y) => U(P, Y));
    }), { accepted: !0, destination: p, ...m ? { emitAction: !1 } : {} };
  }
  function at(g) {
    for (const m of (g == null ? void 0 : g.objectIds) ?? [n]) e.clearRegrab(m);
  }
  function nt(g, m = n) {
    var Y, L;
    if (Z() !== "landing") return;
    const S = w;
    if (!S || !y) return;
    const R = e.getGroup(y), U = R ? (Y = e.objects.get(R.primaryObjectId)) == null ? void 0 : Y.visual : void 0, z = R ? ((L = e.objects.get(R.primaryObjectId)) == null ? void 0 : L.element) ?? null : cn(
      () => e.resolveVisualTarget(y, p),
      () => {
        var b;
        return ((b = e.objects.get(n)) == null ? void 0 : b.element) ?? null;
      }
    );
    if (!z) return;
    const G = e.createRegrabContext(y, g, S, z);
    if (!G) return;
    en({
      event: G.event,
      sessionId: y,
      proxy: S,
      source: z,
      interrupt: () => e.takeoverRegrab(y),
      clearRegrab: () => at(R)
    });
    const P = z.getBoundingClientRect();
    R ? (U && e.objects.update(R.primaryObjectId, { visual: U }), e.startGroupObjectPointer(
      R.objectIds,
      R.primaryObjectId,
      z,
      g,
      G.regrabRect,
      P
    )) : e.startObjectPointer(m, z, g, G.regrabRect, P);
  }
  const St = {
    prepare(g) {
      var wt;
      y = g.session.id, it = !1;
      const m = o.style.visibility === "hidden" || getComputedStyle(o).visibility === "hidden";
      if (B = e.createAutoScroller(y, {
        onScroll: (E) => W(E.x, E.y)
      }), g.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", m && (o.style.transition = ""), A = e.acquireObject(y, n), e.takeSurfaces(y, c);
      const S = e.getGroup(y);
      h = !!S;
      const { beforePickup: R } = Je(o, T, _);
      Q = e.getObjectSurfaceIndex(n, u), O = o.cloneNode(!0);
      const U = e.getMoveContext(y), z = Ke(U, o, a, i, e.getObjectGrabAlign(n)), G = z.rect;
      V = { x: z.offsetX, y: z.offsetY }, document.body.classList.add("kb-dragging"), e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), v = Ue((E, K) => e.captureVisualState(n, K), n, o), x = we(o, y);
      const P = e.getObjectProxyLayout(n, o), Y = !!(P != null && P.compact), L = u ? e.resolveMoveSurfaceViewport(u) : null, b = !!(L && L.scrollHeight > L.clientHeight && L.scrollTop >= L.scrollHeight - L.clientHeight - 1), N = (L == null ? void 0 : L.scrollHeight) ?? 0;
      xe(o, G, {
        layout: P,
        // 多选时源卡是布局幽灵，不能像单卡 detach 一样整张隐藏；主代理
        // 负责跟手，源节点保留在原位并由 group visual 降低透明度。
        keepSourceVisible: !!(S && S.objectIds.length > 1)
      }), Se(o, y);
      const I = be(o);
      I && e.registerVisualProxy(y, { element: I }), I && e.updateVisualProxy(y), o.style.pointerEvents = "none", !r && !S && (x.detachFromLayout(), b && j(N, L)), o.style.transition = "none", S || e.scheduleLayout(R), o.dataset.runtimeActive = "true";
      const H = ((wt = e.getVisualProxy(y)) == null ? void 0 : wt.element) ?? Yt(o);
      if (!H) return;
      const st = G.left, tt = G.top, ot = (E) => {
        if (!H.isConnected) return;
        const K = E.x - st, fe = E.y - tt;
        H.style.transform = `translate3d(${K.toFixed(2)}px, ${fe.toFixed(2)}px, 0) perspective(760px) rotateX(${E.rotateX.toFixed(2)}deg) rotateZ(${E.rotateZ.toFixed(2)}deg) scale(${E.scaleX.toFixed(4)}, ${E.scaleY.toFixed(4)})`;
      };
      if (e.getObjectMotionEnabled(n)) {
        const E = Zt({
          mode: "follow",
          followRotation: jt,
          onFrame: ot
        });
        E.setProfile(ye), E.seed({ x: G.left, y: G.top, scaleX: Y ? 1 : 1.03, scaleY: Y ? 1 : 1.03, rotateX: jt.tilt, rotateZ: 0 }), E.setTarget({ x: a.clientX - V.x, y: a.clientY - V.y }), E.start(), k = E;
      } else {
        const E = Fe({ onFrame: ot });
        E.setTarget({ x: a.clientX - V.x, y: a.clientY - V.y }), k = E;
      }
      F = Qe(
        d(n),
        (E) => e.resolveMoveHit(n, E.clientX, E.clientY),
        (E, K) => E.columnId === (K == null ? void 0 : K.columnId) && E.index === (K == null ? void 0 : K.index)
      ), W(a.clientX, a.clientY);
    },
    update(g, m) {
      m.event instanceof PointerEvent && rt(m.event);
    },
    resolveDestination(g, m) {
      return bt(m.event instanceof PointerEvent ? m.event : void 0);
    },
    commit: (g, m) => {
      e.getVisualProxy(y) || Ct(o);
      const S = typeof m == "object" && m !== null && m.invalidReturn === !0, R = typeof m == "object" && m !== null ? m.toSurfaceId ?? m.columnId : void 0;
      h || (r || S || !S && typeof R == "string" && R === u ? x == null || x.restoreLayoutHidden() : x == null || x.detachFromLayout()), document.body.classList.remove("kb-dragging");
    },
    cancel(g, m) {
      D = !0, k == null || k.stop(), k = null, e.getVisualProxy(y) ? e.disposeVisualProxy(y) : w ? (e.disposeVisualProxy(y), w = null) : Ct(o), at(e.getGroup(y)), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, Ct(o), x == null || x.restore(), x = null, q();
    }
  }, vt = {
    layout: dn(o, T, _),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => A == null ? void 0 : A.release()
    },
    ...un({
      createGate: () => e.createCompletionGate(y, { completed: !1, reason: "landing-cancelled" }),
      onGate: (g) => {
        M = g;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        C == null || C(), C = null;
      },
      clearRegrab: () => at(e.getGroup(y)),
      finishReveal: () => {
        w && Lt(w, !1), Ct(o), x == null || x.restore(), x = null, q();
      }
    })
  };
  return { driver: St, lifecycle: vt };
}
function Rn(t) {
  return fn({ ...t, clone: !0 });
}
export {
  gn as A,
  Zt as B,
  Nt as C,
  Wt as D,
  Ae as E,
  ye as F,
  zt as G,
  _t as H,
  qe as I,
  Mt as L,
  mn as a,
  wn as b,
  he as c,
  xn as d,
  ct as e,
  bn as f,
  Xt as g,
  Rn as h,
  fn as i,
  vn as j,
  Kt as k,
  hn as l,
  pn as m,
  yn as n,
  jt as o,
  Sn as p,
  Tn as q,
  Fn as r,
  Cn as s,
  Vt as t,
  Be as u,
  Xe as v,
  kn as w,
  Mn as x,
  we as y,
  $e as z
};
