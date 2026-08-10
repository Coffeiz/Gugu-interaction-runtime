const rt = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }
}, Nt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, an = 8;
function qt(t, e = Nt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, a = t.y * e.velocityScale, i = Math.hypot(o, a);
  if (i <= e.maxVelocity || i === 0) return { x: o, y: a };
  const r = e.maxVelocity / i;
  return { x: o * r, y: a * r };
}
function sn(t, e = Nt) {
  const n = qt(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const a = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * a, y: n.y * e.coastSeconds * a };
}
function Ot(t, e, n, o, a, i = 1 / 120) {
  let r = Math.max(0, a);
  for (; r > 1e-4; ) {
    const s = Math.min(r, i);
    r -= s;
    const l = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += c * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const bt = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, se = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, Xt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, le = { position: 0.35, velocity: 5 };
function Gt(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? le, o = {
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
  let a = { x: 0, y: 0 }, i = bt, r = null, s = null, l = !1, c = 0, u = 0, d = "settle", f = 0;
  function k() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function B(g) {
    var O;
    if (!l) return;
    const T = Math.min(0.032, Math.max(0, (g - (s ?? g)) / 1e3));
    if (s = g, d === "coast") {
      const y = Math.exp(-w.friction * T);
      o.vx *= y, o.vy *= y;
      const R = o.vx * T, b = o.vy * T, I = f + Math.hypot(R, b);
      if (I >= w.maxDistance) {
        const v = Math.max(0, w.maxDistance - f), A = Math.hypot(R, b), V = A > 0 ? v / A : 0;
        o.x += R * V, o.y += b * V, o.vx = 0, o.vy = 0, d = "settle";
      } else
        o.x += R, o.y += b, f = I, ((g - (C ?? g)) / 1e3 >= w.duration || Math.hypot(o.vx, o.vy) <= w.minVelocity) && (d = "settle");
    }
    if (d === "settle") {
      const y = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      Ot(y, { x: a.x, y: a.y }, i.position.stiffness, i.position.damping, T), o.x = y.position.x, o.y = y.position.y, o.vx = y.velocity.x, o.vy = y.velocity.y;
    }
    const M = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (Ot(M, { x: a.scaleX ?? o.scaleX, y: a.scaleY ?? o.scaleY }, i.scale.stiffness, i.scale.damping, T), o.scaleX = M.position.x, o.scaleY = M.position.y, o.scaleVX = M.velocity.x, o.scaleVY = M.velocity.y, e === "follow") {
      const y = t.followRotation, R = -Math.log(1 - (y.smoothing ?? 0.2)) * 60, b = 1 - Math.exp(-R * T);
      c += (o.vx - c) * b, u += (o.vy - u) * b, o.rotateZ = Math.max(-(y.maxSway ?? 5), Math.min(y.maxSway ?? 5, c / 60 * y.sway));
      const I = Math.max(-(y.maxTiltDelta ?? 4), Math.min(y.maxTiltDelta ?? 4, u / 60 * (y.verticalTiltFactor ?? 0.16)));
      o.rotateX = y.tilt + I;
    } else {
      const y = Math.exp(-10 * T);
      o.rotateX *= y, o.rotateZ *= y;
    }
    if (k(), e === "follow") {
      r = requestAnimationFrame(B);
      return;
    }
    if (d === "settle" && Math.abs(a.x - o.x) < n.position && Math.abs(a.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      l = !1, r = null, (O = t.onArrived) == null || O.call(t);
      return;
    }
    r = requestAnimationFrame(B);
  }
  let w = null, C = null;
  return {
    seed(g) {
      Object.assign(o, g);
    },
    setTarget(g) {
      a = { ...g };
    },
    retarget(g) {
      a = { ...g };
    },
    setProfile(g) {
      i = g;
    },
    getState() {
      return o;
    },
    start() {
      l || (l = !0, d = "settle", w = null, C = null, s = null, k(), r = requestAnimationFrame(B));
    },
    startCoastThenSettle(g) {
      if (l) return;
      l = !0, d = "coast", w = g, f = 0, C = null;
      const T = Math.hypot(o.vx, o.vy), M = g.maxDistance / Math.max(g.duration, 1 / 60);
      if (T > M && T > 0) {
        const F = M / T;
        o.vx *= F, o.vy *= F;
      }
      s = null, k(), r = requestAnimationFrame((F) => {
        C = F, B(F);
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
function ce(t) {
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
function ue(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Rt(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function de(t, e = t.getBoundingClientRect(), n = {}) {
  var u;
  const o = (u = n.layout) == null ? void 0 : u.compact, a = o ? 1 : 1.03, i = document.createElement("div"), r = document.createElement("div"), s = t.cloneNode(!0);
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
  }), s.dataset.runtimePhase = "grab-start", r.appendChild(s), i.appendChild(r), i.className = "", i.style.position = "fixed", i.style.left = `${e.left}px`, i.style.top = `${e.top}px`, i.style.boxSizing = "border-box", i.style.width = `${e.width}px`, i.style.height = `${e.height}px`, i.style.margin = "0", i.style.zIndex = "2147483647", i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = `perspective(760px) rotateX(5deg) scale(${a})`, Ct && n.glass !== !1 ? jt(s) : s.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o && (s.dataset.runtimeCompact = "true");
  const l = (o == null ? void 0 : o.duration) ?? 200, c = (o == null ? void 0 : o.easing) ?? "cubic-bezier(.22,1,.36,1)";
  return s.style.transition = `left ${l}ms ${c}, width ${l}ms ${c}, transform ${l}ms ${c}, grid-template-columns ${l}ms ${c}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, i.style.transition = "transform .15s ease", document.documentElement.appendChild(i), requestAnimationFrame(() => {
    i.isConnected && s.dataset.runtimePhase === "grab-start" && (s.dataset.runtimePhase = "grabbing", o && (s.style.left = o.left ?? "50%", s.style.width = o.width, s.style.transform = o.transform ?? "translateX(-50%)", o.gridTemplateColumns && (s.style.gridTemplateColumns = o.gridTemplateColumns)));
  }), St.add(i), i;
}
function ln(t) {
  return t;
}
function $t(t) {
  return t.querySelector("[data-runtime-proxy-content]") ?? t;
}
function pt(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function Dt(t) {
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
function Yt(t, e) {
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
  const u = Dt(l), d = new Set(u.map(pt)), f = document.createElement("div");
  Object.assign(f.style, { ...s, pointerEvents: "" }), f.style.display = n.display, f.style.gridTemplateColumns = n.gridTemplateColumns, f.style.gridTemplateRows = n.gridTemplateRows, f.style.gridAutoColumns = n.gridAutoColumns, f.style.gridAutoRows = n.gridAutoRows, f.style.gridAutoFlow = n.gridAutoFlow, f.style.justifyItems = n.justifyItems, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.alignContent = n.alignContent, f.style.columnGap = n.columnGap, f.style.rowGap = n.rowGap, f.style.flexDirection = n.flexDirection, f.style.flexWrap = n.flexWrap, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.gap = n.gap, f.style.overflow = "hidden";
  const k = e.cloneNode(!0);
  for (k.style.visibility = "visible", k.style.display = ""; k.firstChild; ) f.appendChild(k.firstChild);
  const B = ce(e);
  ue(f, B);
  const w = Dt(f), C = new Set(w.map(pt)), g = w.filter((F) => !d.has(pt(F)));
  for (const F of g) F.style.opacity = "0";
  const T = u.filter((F) => !C.has(pt(F))), M = new Set(T);
  for (const F of u)
    M.has(F) || (F.style.opacity = "0");
  return t.appendChild(f), T.length > 0 && t.appendChild(l), { enteringEls: g, leavingEls: T };
}
function cn(t, e) {
  const n = Math.max(e.left, e.right - t.width), o = Math.max(e.top, e.bottom - t.height);
  return {
    left: Math.min(Math.max(t.left, e.left), n),
    top: Math.min(Math.max(t.top, e.top), o),
    width: t.width,
    height: t.height
  };
}
function un(t, e, n = {}) {
  const o = n.duration ?? rt.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, u = n.targetOpacity, d = $t(t), f = n.targetContent ? Yt(d, n.targetContent) : null;
  if (f) {
    for (const x of f.enteringEls) x.style.transition = `opacity ${o}ms ${a}`;
    for (const x of f.leavingEls) x.style.transition = `opacity ${o}ms ${a}`;
  }
  const k = parseFloat(t.style.left) || 0, B = parseFloat(t.style.top) || 0;
  let w = !1, C = e;
  const g = performance.now();
  let T = () => {
  }, M = () => {
  };
  const F = new Promise((x) => {
    M = x;
  }), O = () => {
    const x = t.getBoundingClientRect();
    return Math.abs(x.left - C.left) < 2 && Math.abs(x.top - C.top) < 2 && Math.abs(x.width - C.width) < 2 && Math.abs(x.height - C.height) < 2;
  };
  let y = null, R = null, b = 0;
  const I = 60, v = (x) => {
    w || (w = !0, t.removeEventListener("transitionend", T), R !== null && (window.clearTimeout(R), R = null), M());
  }, A = () => {
    if (!w) {
      if (O()) {
        v();
        return;
      }
      if (performance.now() - g >= o + 500) {
        v();
        return;
      }
      window.requestAnimationFrame(A);
    }
  }, V = (x, P = o) => {
    C = x;
    const L = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${L.width.toFixed(2)}px`, t.style.height = `${L.height.toFixed(2)}px`, t.style.transform = `translate3d(${(L.left - k).toFixed(2)}px, ${(L.top - B).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const X = `translate3d(${(x.left - k).toFixed(2)}px, ${(x.top - B).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${P}ms ${a}, width ${P}ms ${a}, height ${P}ms ${a}`, d.style.transition = [
      `box-shadow ${P}ms ease`,
      `border-radius ${P}ms ease`,
      `border-color ${P}ms ease`,
      `backdrop-filter ${P}ms ease`,
      `-webkit-backdrop-filter ${P}ms ease`,
      `background-color ${P}ms ease`,
      `background-image ${P}ms ease`,
      `opacity ${P}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = X, t.style.width = `${x.width.toFixed(2)}px`, t.style.height = `${x.height.toFixed(2)}px`, i != null && (d.style.boxShadow = i), r != null && (d.style.borderRadius = r), s != null && (d.style.border = s), l != null && (d.style.backdropFilter = l, d.style.setProperty("-webkit-backdrop-filter", l)), c != null && (d.style.backgroundColor = c, n.targetBackgroundImage && (d.style.backgroundImage = n.targetBackgroundImage)), u != null && (d.style.opacity = u), f) {
        for (const Z of f.enteringEls) Z.style.opacity = "1";
        for (const Z of f.leavingEls) Z.style.opacity = "0";
      }
    });
  };
  T = (x) => {
    x.target !== t || !(x.propertyName === "transform" || x.propertyName === "width" || x.propertyName === "height") || O() && v(`transitionend:${x.propertyName}`);
  }, t.addEventListener("transitionend", T), V(e), window.setTimeout(A, o + 40);
  const _ = (x) => {
    var L;
    b = performance.now();
    const P = Math.max(80, o - (b - g));
    V(((L = n.readTarget) == null ? void 0 : L.call(n)) ?? x, P);
  };
  return { finished: F, retarget: (x) => {
    if (w) return;
    const P = Math.abs(x.left - C.left), L = Math.abs(x.top - C.top), X = Math.abs(x.width - C.width), Z = Math.abs(x.height - C.height);
    if (P < 0.5 && L < 0.5 && X < 0.5 && Z < 0.5) return;
    const nt = performance.now() - b;
    if (nt >= I) {
      _(x);
      return;
    }
    y = x, R === null && (R = window.setTimeout(() => {
      if (R = null, w || !y) return;
      const U = y;
      y = null, _(U);
    }, I - nt));
  } };
}
function dn(t, e, n = {}) {
  var h, S, z, N, q, G, $, j, Y, K, J, D, tt;
  const o = n.duration ?? rt.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, u = n.targetOpacity, d = $t(t), f = t.querySelector("[data-runtime-proxy-scale-shell]"), k = n.targetContent ? Yt(d, n.targetContent) : null;
  if (k) {
    for (const p of k.enteringEls) p.style.transition = `opacity ${o}ms ${a}`;
    for (const p of k.leavingEls) p.style.transition = `opacity ${o}ms ${a}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const B = parseFloat(t.style.left) || t.getBoundingClientRect().left, w = parseFloat(t.style.top) || t.getBoundingClientRect().top, C = t.getBoundingClientRect(), g = C.width || e.width, T = C.height || e.height, M = (p) => ({
    left: p.left - (g - p.width) / 2,
    top: p.top - (T - p.height) / 2,
    width: p.width,
    height: p.height
  });
  let F = e, O = !1;
  const y = n.landingMode === "target" && !!f, R = y ? ((h = n.dismiss) == null ? void 0 : h.duration) ?? o : 0;
  let b = !1, I = !y, v = null, A = null, V = 0, _ = () => {
  };
  const et = new Promise((p) => {
    _ = p;
  }), x = () => {
    O || (O = !0, X.stop(), v !== null && window.clearTimeout(v), A !== null && window.clearTimeout(A), v = null, A = null, _());
  }, P = () => {
    b && I && x();
  }, L = () => {
    O || (b = !0, P());
  }, X = Gt({
    mode: "settle",
    onFrame: (p) => {
      const E = g * p.scaleX, W = T * p.scaleY, Tt = p.x + (g - E) / 2, ae = p.y + (T - W) / 2;
      t.style.transform = `perspective(760px) translate3d(${(Tt - B).toFixed(2)}px, ${(ae - w).toFixed(2)}px, 0) rotateX(${p.rotateX.toFixed(2)}deg) rotateZ(${p.rotateZ.toFixed(2)}deg)`, t.style.width = `${E.toFixed(2)}px`, t.style.height = `${W.toFixed(2)}px`;
    },
    onArrived: L
  }), Z = Math.hypot(((S = n.motionState) == null ? void 0 : S.vx) ?? 0, ((z = n.motionState) == null ? void 0 : z.vy) ?? 0), nt = n.releaseDamping ?? 0.78, U = n.targetMotion ? {
    position: { ...bt.position, ...n.targetMotion.position },
    scale: { ...bt.scale, ...n.targetMotion.scale }
  } : bt;
  X.setProfile(Z > 30 ? {
    ...U,
    position: {
      ...U.position,
      damping: U.position.damping * nt
    }
  } : U), X.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((N = n.motionState) == null ? void 0 : N.x) ?? C.left,
    y: ((q = n.motionState) == null ? void 0 : q.y) ?? C.top,
    vx: ((G = n.motionState) == null ? void 0 : G.vx) ?? 0,
    vy: (($ = n.motionState) == null ? void 0 : $.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((j = n.motionState) == null ? void 0 : j.scaleX) ?? 1,
    scaleY: ((Y = n.motionState) == null ? void 0 : Y.scaleY) ?? 1,
    rotateX: ((K = n.motionState) == null ? void 0 : K.rotateX) ?? 0,
    rotateZ: ((J = n.motionState) == null ? void 0 : J.rotateZ) ?? 0
  });
  const ot = M(e), mt = n.landingMode === "target" ? { scaleX: 1, scaleY: 1 } : { scaleX: ot.width / g, scaleY: ot.height / T };
  X.setTarget({
    x: ot.left,
    y: ot.top,
    scaleX: mt.scaleX,
    scaleY: mt.scaleY
  }), t.style.transition = "", d.style.transition = [
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
    var p, E;
    if (!O) {
      if (n.landingMode !== "target" && (d.dataset.runtimePhase = "landing", d.dataset.runtimeCompact === "true" && (d.style.left = "0", d.style.width = "100%", d.style.transform = "none", d.style.gridTemplateColumns = "")), i != null && (d.style.boxShadow = i), r != null && (d.style.borderRadius = r), s != null && (d.style.border = s), l != null && (d.style.backdropFilter = l, d.style.setProperty("-webkit-backdrop-filter", l)), c != null && (d.style.backgroundColor = c, n.targetBackgroundImage && (d.style.backgroundImage = n.targetBackgroundImage)), u != null && (d.style.opacity = u), y && f) {
        const W = ((p = n.dismiss) == null ? void 0 : p.easing) ?? a, Tt = ((E = n.dismiss) == null ? void 0 : E.scale) ?? 0.72;
        f.style.transformOrigin = "50% 50%", f.style.transition = `transform ${R}ms ${W}`, d.style.transition = `opacity ${R}ms ${W}`, f.style.transform = `scale(${Tt})`, d.style.opacity = "0", A = window.setTimeout(() => {
          A = null, I = !0, P();
        }, R + 40);
      }
      if (k) {
        for (const W of k.enteringEls) W.style.opacity = "1";
        for (const W of k.leavingEls) W.style.opacity = "0";
      }
    }
  });
  const ct = (p = 0) => {
    v !== null && window.clearTimeout(v), V = performance.now() + Math.max(2e3, o * 8, 5e3) + p, v = window.setTimeout(() => {
      v = null, !O && performance.now() >= V && L();
    }, Math.max(2e3, o * 8, 5e3) + p);
  };
  ct();
  const m = n.coast;
  return m && m.maxDistance > 0 && Math.hypot(((D = n.motionState) == null ? void 0 : D.vx) ?? 0, ((tt = n.motionState) == null ? void 0 : tt.vy) ?? 0) > m.minVelocity ? X.startCoastThenSettle(m) : X.start(), {
    finished: et,
    retarget(p) {
      if (O) return;
      F = p, ct(1e3);
      const E = M(F);
      X.setTarget({
        x: E.left,
        y: E.top,
        scaleX: n.landingMode === "target" ? 1 : E.width / g,
        scaleY: n.landingMode === "target" ? 1 : E.height / T
      });
    }
  };
}
function fn(t) {
  St.has(t) && (St.delete(t), t.remove());
}
const vt = /* @__PURE__ */ new WeakMap(), at = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakSet();
function fe(t, e, n = {}) {
  var r;
  vt.set(t, { style: t.getAttribute("style") ?? "" });
  const o = de(t, e, { glass: !1, layout: n.layout }), a = $t(o), i = !!((r = n.layout) != null && r.compact);
  o.style.zIndex = "1000", o.style.transform = "scale(1)", o.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", At.add(o), at.set(t, o), n.keepSourceVisible || (t.style.visibility = "hidden"), requestAnimationFrame(() => {
    o.isConnected && (Ct ? jt(a) : a.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o.style.transform = `scale(${i ? 1 : 1.03})`);
  });
}
function Vt(t) {
  return at.get(t);
}
function ye(t) {
  const e = at.get(t);
  if (e)
    return At.delete(e), at.delete(t), vt.delete(t), e.style.zIndex = "2147483647", e;
}
function ht(t) {
  const e = at.get(t);
  e && (At.delete(e), e.remove(), St.delete(e), at.delete(t));
  const n = vt.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), vt.delete(t);
}
const St = /* @__PURE__ */ new Set();
let Ct = !1;
function yn(t) {
  Ct = t;
}
function gn() {
  return Ct;
}
function jt(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", t.style.boxShadow = "0 22px 50px rgba(30, 35, 60, 0.30)", t.style.opacity = "0.97";
}
const st = /* @__PURE__ */ new Map();
function mn(t, e) {
  st.set(t, e), t.style.visibility = "hidden";
}
function ge(t, e) {
  (t.style.visibility === "hidden" || getComputedStyle(t).visibility === "hidden") && st.set(t, e);
}
function pn(t, e) {
  const n = st.get(t) === e;
  return n && (t.style.visibility = "", st.delete(t)), n;
}
function me(t, e) {
  st.get(t) === e && st.delete(t);
}
const kt = /* @__PURE__ */ new WeakMap();
function pe(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  kt.set(t, n);
  const o = () => kt.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, kt.delete(t), !0) : !1,
    isOwner: o
  };
}
const ut = /* @__PURE__ */ new WeakMap(), dt = /* @__PURE__ */ new WeakMap();
function Wt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [o, a, i, r] = n;
  return (s) => {
    let l = 0, c = 1;
    for (let d = 0; d < 12; d += 1) {
      const f = (l + c) / 2;
      3 * (1 - f) ** 2 * f * o + 3 * (1 - f) * f ** 2 * i + f ** 3 < s ? l = f : c = f;
    }
    const u = (l + c) / 2;
    return 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * r + u ** 3;
  };
}
function Pt(t) {
  const e = ut.get(t);
  e && (cancelAnimationFrame(e.frame), ut.delete(t), t.style.transform = "");
}
function he(t, e, n, o, a, i) {
  Pt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Wt(a)
  };
  ut.set(t, r);
  const s = (l) => {
    if (ut.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), u = r.easing(c);
    if (t.style.transform = `translate(${(r.fromX * (1 - u)).toFixed(3)}px, ${(r.fromY * (1 - u)).toFixed(3)}px)`, c >= 1) {
      ut.delete(t), t.style.transform = "", i == null || i();
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
function Et(t) {
  const e = dt.get(t);
  e && (cancelAnimationFrame(e.frame), dt.delete(t), t.style.height = "");
}
function xe(t, e, n, o, a, i) {
  Et(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Wt(a)
  };
  dt.set(t, r);
  const s = (l) => {
    if (dt.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), u = r.fromX + (r.fromY - r.fromX) * r.easing(c);
    if (t.style.height = `${u}px`, c >= 1) {
      dt.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
const ft = rt.flip.duration, yt = rt.flip.easing;
function be(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((o) => n.set(o, (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect())), n;
}
function Ht(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, Pt(n), n.style.setProperty("transition", "none", "important");
}
function ve(t, e, n = ft, o = yt, a) {
  Ht(t);
  const i = [];
  for (const r of t) {
    if (r.dataset.runtimeProxy === "true" || r.dataset.runtimePlaceholder === "true" || r.dataset.runtimeActive === "true")
      continue;
    const s = e.get(r);
    if (!s)
      continue;
    const l = (a == null ? void 0 : a.rect(r)) ?? r.getBoundingClientRect(), c = s.left - l.left, u = s.top - l.top;
    if (Math.abs(c) < 0.5 && Math.abs(u) < 0.5) {
      r.style.transition = "";
      continue;
    }
    i.push({ element: r, dx: c, dy: u });
  }
  for (const { element: r, dx: s, dy: l } of i) {
    r.style.setProperty("transition", "none", "important"), r.style.transform = `translate(${s}px, ${l}px)`;
    const c = String(Number(r.dataset.runtimeFlipToken ?? "0") + 1);
    r.dataset.runtimeFlip = "true", r.dataset.runtimeFlipToken = c, he(r, s, l, n, o, () => {
      r.dataset.runtimeFlipToken === c && (r.style.transition = "", delete r.dataset.runtimeFlip);
    });
  }
}
function _t(t) {
  return t.dataset.layoutKey ?? t.dataset.card ?? "";
}
const xt = /* @__PURE__ */ new WeakMap();
function Se(t) {
  const e = t.closest('[data-layout-open="false"]');
  return e !== null && e.dataset.runtimeGroupAnimating !== "true";
}
function Zt(t, e) {
  if (Se(t)) return null;
  const n = t.closest("[data-layout-collection]");
  if (!n) return null;
  const o = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect(), a = (e == null ? void 0 : e.rect(n)) ?? n.getBoundingClientRect();
  return o.width > 0 && o.height > 0 && a.width > 0 && o.width <= a.width * 1.25 && o.left >= a.left - 1 && o.right <= a.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function Ut(t, e) {
  return !e || e.length === 0 ? !0 : e.some((n) => n === t || n.contains(t));
}
function Kt(t, e, n) {
  if (!n || n.length === 0)
    return Array.from(t.querySelectorAll(e));
  const o = [], a = /* @__PURE__ */ new Set();
  for (const i of n)
    i.matches(e) && !a.has(i) && (a.add(i), o.push(i)), i.querySelectorAll(e).forEach((r) => {
      a.has(r) || (a.add(r), o.push(r));
    });
  return o;
}
function we(t, e, n = _t, o, a, i) {
  const r = /* @__PURE__ */ new Map(), s = Kt(t, e, a).map((l) => {
    if (o != null && o(l) || !Ut(l, a)) return null;
    const c = Zt(l, i);
    if (!c) return null;
    const u = n(l);
    if (!u) return null;
    const d = (i == null ? void 0 : i.rect(l)) ?? l.getBoundingClientRect();
    return r.set(u, c.collectionId), {
      key: u,
      element: l,
      rect: { left: d.left, top: d.top, width: d.width, height: d.height },
      contentHTML: l.outerHTML
    };
  }).filter((l) => l !== null);
  return { root: t, selector: e, collectionByKey: r, entries: s, ignore: o, scopeSurfaces: a };
}
function Fe(t, e = {}, n) {
  const o = e.duration ?? 250, a = e.easing ?? "cubic-bezier(.22,1,.36,1)", i = e.key ?? _t, r = /* @__PURE__ */ new Map();
  Kt(t.root, t.selector, t.scopeSurfaces).filter((l) => {
    var d;
    if ((d = t.ignore) != null && d.call(t, l) || !Ut(l, t.scopeSurfaces)) return !1;
    const c = Zt(l, n);
    if (!c) return !1;
    const u = i(l);
    return u ? (r.set(u, c.collectionId), !0) : !1;
  }).filter((l) => {
    const c = i(l);
    if (!c) return !1;
    const u = t.collectionByKey.get(c);
    return u === void 0 || u !== r.get(c);
  }).forEach((l) => {
    var u;
    (u = xt.get(l)) == null || u.cancel();
    const c = l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o, easing: a, fill: "both" });
    xt.set(l, c), c.finished.then(() => {
      xt.get(l) === c && xt.delete(l);
    }).catch(() => {
    });
  }), t.entries.forEach((l) => {
    if (r.has(l.key)) return;
    const c = document.createElement("template");
    c.innerHTML = l.contentHTML;
    const u = c.content.firstElementChild;
    if (!u) return;
    u.removeAttribute("data-file-id"), u.removeAttribute("data-layout-key"), u.removeAttribute("data-layout-role"), u.dataset.runtimePresenceGhost = "true";
    const d = l.rect;
    u.style.position = "fixed", u.style.left = `${d.left}px`, u.style.top = `${d.top}px`, u.style.width = `${d.width}px`, u.style.height = `${d.height}px`, u.style.margin = "0", u.style.pointerEvents = "none", u.style.zIndex = "2147483646", document.body.appendChild(u), u.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o, easing: a, fill: "both" }).finished.then(() => u.remove()).catch(() => u.remove());
  });
}
function Jt() {
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
let Qt = null, te = !1;
const Mt = /* @__PURE__ */ new WeakMap();
function hn(t) {
  Qt = t;
}
function xn(t) {
  te = t;
}
function ee() {
  const t = Qt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? rt.flip,
    resize: (t == null ? void 0 : t.resize) ?? rt.resize
  };
}
function Ce(t, e, n) {
  const o = (s) => !n || n.length === 0 ? !0 : n.some((l) => l === s || l.contains(s)), a = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(o), i = [], r = [];
  for (const s of t)
    o(s) && (s.closest("[data-layout-group]") !== null ? i.push(s) : r.push(s));
  return { groups: a, groupLeaves: i, flatCards: r };
}
function It(t, e = document, n = !0, o, a = {}) {
  const i = (w) => {
    const C = a.scopeSurfaces;
    return !C || C.length === 0 ? !0 : C.some((g) => g === w || g.contains(w));
  }, r = Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i), s = r.map((w) => ({ element: w, rect: gt(w), inlineStyle: ie(w) }));
  oe(s);
  const l = Jt(), { groups: c, groupLeaves: u, flatCards: d } = Ce(t, e, a.scopeSurfaces), f = ze(r, l), k = (a.scopeSurfaces ?? [e]).some(
    (w) => w instanceof HTMLElement ? w.matches("[data-layout-collection]") || w.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), B = {
    root: e,
    group: c.length > 0 ? { before: Le([...c, ...u], l) } : void 0,
    flat: d.length > 0 ? { elements: d, before: be(d, l) } : void 0,
    surfaces: f,
    presence: n && k ? we(e, '[data-layout-role="card"]', void 0, o, a.scopeSurfaces, l) : void 0
  };
  return Ae(e, B);
}
function Lt(t) {
  const e = Jt(), n = ee(), o = t.group ? ke(t.group.before) : null;
  t.group && Oe(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && ve(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), Ne(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && Fe(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), o && Me(o, n.flip.duration + 50);
}
const lt = /* @__PURE__ */ new WeakMap();
let Te = 0;
function ke(t) {
  const e = t.filter((i) => i.rect.height > 0).map((i) => ({ element: i.element, overflow: i.element.style.overflow })).filter((i) => i.element.isConnected).filter((i) => i.element.dataset.runtimeGroupAnimating !== "true").filter((i) => getComputedStyle(i.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), o = lt.get(n);
  o == null || o.entries.forEach(({ element: i, overflow: r }) => {
    i.style.overflow = r;
  }), e.forEach(({ element: i }) => {
    i.style.overflow = "visible";
  });
  const a = { token: String(++Te), entries: e };
  return lt.set(n, a), a;
}
function Me(t, e) {
  var o;
  const n = (o = t.entries[0]) == null ? void 0 : o.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var a;
    ((a = lt.get(n)) == null ? void 0 : a.token) === t.token && (t.entries.forEach(({ element: i, overflow: r }) => {
      i.style.overflow = r;
    }), lt.delete(n));
  }, e));
}
function Re(t) {
  Q.set(t.root, t), queueMicrotask(() => {
    Q.get(t.root) === t && (Q.delete(t.root), Lt(t));
  });
}
function $e(t) {
  Q.set(t.root, t), requestAnimationFrame(() => {
    Q.get(t.root) === t && (Q.delete(t.root), Lt(t));
  });
}
function Ae(t, e) {
  const n = Q.get(t);
  if (!n) return e;
  const o = Ie(e.surfaces, n.surfaces), a = Pe(e.flat, n.flat), i = Ee(e.group, n.group);
  return { ...e, flat: a, group: i, surfaces: o };
}
function Pe(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const a = e.before.get(o);
    a && n.set(o, a);
  }
  return { ...t, before: n };
}
function Ee(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function Ie(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const a = n.get(o.element);
    return a ? { ...o, rect: a.rect, inlineStyle: a.inlineStyle } : o;
  });
}
const Q = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ new WeakMap(), Ft = /* @__PURE__ */ new WeakMap(), it = /* @__PURE__ */ new WeakMap();
function gt(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function Le(t, e) {
  const n = t.filter((a) => {
    const i = (e == null ? void 0 : e.rect(a)) ?? a.getBoundingClientRect();
    return i.width > 0 && i.height > 0;
  }), o = new Set(n);
  return n.map((a) => ({
    element: a,
    parent: Be(a, o),
    rect: gt(a, e)
  }));
}
function Be(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function Oe(t, e = ft, n = yt, o) {
  Ht(t.map((i) => i.element));
  const a = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = gt(i.element, o);
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
    const u = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = u;
    const d = it.get(i.element);
    d !== void 0 && (cancelAnimationFrame(d), it.delete(i.element));
    const f = requestAnimationFrame(() => {
      it.delete(i.element), i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    });
    it.set(i.element, f);
    const k = window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip, Ft.delete(i.element));
    }, e + 40);
    Ft.set(i.element, k);
  }
}
function Xe(t, e, n = ft, o = yt, a) {
  ne(t);
  const i = a ?? t.getBoundingClientRect().height, r = String(Number(t.dataset.runtimeGroupToken ?? "0") + 1);
  t.dataset.runtimeGroupToken = r;
  const s = Math.abs(Math.max(0, e) - i), c = Math.min(Math.max(s / 8, 200), 350);
  t.dataset.runtimeGroupAnimating = "true", t.style.overflow = "hidden", t.style.height = `${i}px`, t.style.transition = `height ${c}ms ${o}`, t.offsetHeight;
  const u = { frame: null, timeout: null };
  wt.set(t, u), u.frame = requestAnimationFrame(() => {
    u.frame = null, t.style.height = `${Math.max(0, e)}px`;
  }), u.timeout = window.setTimeout(() => {
    t.dataset.runtimeGroupToken === r && (e <= 0 ? (t.style.height = "0px", t.style.overflow = "hidden") : (t.style.height = "", t.style.overflow = ""), t.style.transition = "", delete t.dataset.runtimeGroupAnimating, wt.delete(t));
  }, c + 40);
}
function ne(t) {
  const e = wt.get(t);
  e && (e.frame !== null && cancelAnimationFrame(e.frame), e.timeout !== null && window.clearTimeout(e.timeout), wt.delete(t));
}
function bn(t) {
  Q.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, o = lt.get(n);
  o && (o.timeout !== void 0 && window.clearTimeout(o.timeout), o.entries.forEach(({ element: i, overflow: r }) => {
    e && !t.contains(i) || (i.style.overflow = r);
  }), lt.delete(n));
  const a = [];
  t instanceof HTMLElement && a.push(t), typeof t.querySelectorAll == "function" && a.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const i of a) {
    const r = Ft.get(i), s = it.get(i), l = r !== void 0 || i.dataset.runtimeFlip === "true" || i.dataset.runtimeGroupAnimating === "true" || i.dataset.runtimeSurfaceResize === "true";
    r !== void 0 && (window.clearTimeout(r), Ft.delete(i)), s !== void 0 && (cancelAnimationFrame(s), it.delete(i)), Pt(i), Et(i), ne(i);
    const c = H.get(i);
    c && (Bt(i, c.baseStyle), H.delete(i)), i.dataset.runtimeGroupAnimating === "true" && (i.style.height = i.dataset.layoutOpen === "false" ? "0px" : "", i.style.overflow = i.dataset.layoutOpen === "false" ? "hidden" : "", i.style.transition = ""), l && (i.style.transform = ""), i.dataset.runtimeFlip === "true" && delete i.dataset.runtimeFlip, delete i.dataset.runtimeSurfaceResize, delete i.dataset.runtimeSurfaceResizeToken, delete i.dataset.runtimeGroupAnimating;
  }
}
async function vn(t) {
  const e = (Mt.get(t.content) ?? 0) + 1;
  Mt.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll(".done-card-item")), o = (n.length > 0 ? n : Array.from(t.root.querySelectorAll("[data-card]"))).filter((s) => {
    const l = s.getBoundingClientRect();
    return l.width > 0 && l.height > 0;
  }), a = It(o, t.root, !1), i = t.content.getBoundingClientRect().height, r = te ? De(t.content, t.opening, t.duration, t.easing) : null;
  t.mutate(), await t.waitForLayout(), Mt.get(t.content) === e && (t.isCurrent && !t.isCurrent() || (Xe(t.content, t.opening ? t.content.scrollHeight : 0, t.duration, t.easing, i), r && Ve(r, t.opening), Lt(a)));
}
function De(t, e, n = ft, o = yt) {
  const a = Array.from(t.querySelectorAll(".done-card-item")), i = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = i, a.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: a, token: i, duration: n };
}
function Ve(t, e) {
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
function ze(t, e) {
  return t.map((n) => {
    var o;
    return {
      element: n,
      rect: gt(n, e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = H.get(n)) == null ? void 0 : o.baseStyle) ?? ie(n)
    };
  });
}
function Ne(t, e = ft, n = yt, o) {
  var i;
  oe(t);
  const a = t.filter((r) => r.element.isConnected).map((r) => {
    const s = gt(r.element, o), l = ee();
    return {
      item: r,
      next: s,
      profile: l.resize,
      fromHeight: zt(r.element, r.rect.height),
      toHeight: zt(r.element, s.height)
    };
  }).filter(({ item: r, next: s }) => Math.abs(r.rect.height - s.height) >= 0.5);
  for (const { item: r, fromHeight: s } of a) {
    const l = r.element.style, c = {
      baseStyle: ((i = H.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++qe)
    };
    H.set(r.element, c), l.overflow = "hidden", l.transition = "none", l.height = `${s}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = c.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: s, toHeight: l, profile: c } of a) {
      const u = r.element.style, d = H.get(r.element);
      if (!d || r.element.dataset.runtimeSurfaceResizeToken !== d.token) continue;
      const f = d.token;
      u.transition = "none", xe(r.element, s, l, c.duration, c.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== f) return;
        const k = H.get(r.element);
        !k || k.token !== f || (Bt(r.element, k.baseStyle), H.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, c.duration + 40);
    }
  });
}
function oe(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0)
    for (const { element: n } of e) {
      const o = H.get(n);
      o && (Et(n), Bt(n, o.baseStyle), H.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
}
const H = /* @__PURE__ */ new WeakMap();
let qe = 0;
function ie(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function Bt(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function zt(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
function Ge(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function Ye(t, e, n, o, a) {
  const i = o ?? e.getBoundingClientRect(), r = (a == null ? void 0 : a.align) ?? "center", s = r === "pointer" ? n.clientX - i.left : i.width / 2, l = r === "pointer" ? n.clientY - i.top : i.height / 2, c = s - ((a == null ? void 0 : a.offsetX) ?? 0), u = l - ((a == null ? void 0 : a.offsetY) ?? 0);
  return o && (t.dragOffset = { x: c, y: u }), { rect: i, offsetX: c, offsetY: u };
}
function re(t) {
  return (e) => e === t || e.contains(t);
}
function je(t, e, n) {
  const o = t.cloneNode(!0), a = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: It(a, document, !0, re(t), {
      scopeSurfaces: n == null ? void 0 : n()
    })
  };
}
function We(t, e, n) {
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
function He(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function _e(t) {
  t.event.stopPropagation(), Rt(t.proxy, !1), t.clearRegrab(), me(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden";
}
function Ze(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function Ue(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function Ke(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function Je(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function Qe(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function tn(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function en(t, e) {
  return t() ?? e();
}
function nn(t) {
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
function on(t, e, n) {
  let o = 0;
  return {
    capture: () => (o += 1, It(
      e().filter((a) => a !== t && a.dataset.runtimeProxy !== "true"),
      document,
      !0,
      re(t),
      { scopeSurfaces: n == null ? void 0 : n() }
    )),
    play: (a, i, r = !1) => {
      const s = ++o;
      if (r) {
        requestAnimationFrame(() => {
          s === o && $e(i);
        });
        return;
      }
      Re(i);
    }
  };
}
function rn(t) {
  var ct;
  const { runtime: e, objectId: n, element: o, event: a, fromRect: i, clone: r = !1 } = t, s = e.objects.get(n), l = e.surfaces.snapshot(), c = l.map((m) => m.id), u = (m) => {
    var h;
    return (h = e.objects.get(m)) == null ? void 0 : h.surfaceId;
  }, d = (s == null ? void 0 : s.surfaceId) ?? ((ct = l[0]) == null ? void 0 : ct.id), f = (m) => m.closest('[data-layout-content][data-layout-open="false"]') !== null, k = () => {
    const m = [...e.objects.values()].map((S) => S.element).filter((S) => !!(S != null && S.isConnected)), h = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...m, ...h])).filter((S) => !f(S));
  };
  let B, w, C, g = null, T = null, M = null, F = null, O = !1, y = null, R = null, b = null, I = null, v = null, A, V = { x: 0, y: 0 }, _ = null, et = !1, x = !1;
  const P = () => {
    const m = /* @__PURE__ */ new Set();
    return d && m.add(d), g != null && g.columnId && m.add(g.columnId), e.surfaces.snapshot().filter((h) => m.has(h.id)).map((h) => h.element).filter((h) => !!(h != null && h.isConnected));
  };
  function L() {
    var m;
    return y ? (m = e.getSession(y)) == null ? void 0 : m.state : void 0;
  }
  function X(m, h) {
    if (L() !== "active" || !C) return;
    const S = He({
      active: L() === "active",
      event: { clientX: m, clientY: h },
      state: C,
      getSurface: (z) => z.columnId
    });
    S && (g = S);
  }
  function Z(m) {
    et = !0, v == null || v.setTarget({
      x: m.clientX - V.x,
      y: m.clientY - V.y
    }), X(m.clientX, m.clientY), I == null || I.update(
      e.resolveMoveSurfaceElement(n, m.clientX, m.clientY),
      { x: m.clientX, y: m.clientY }
    );
  }
  function nt(m) {
    var q, G;
    if (O) return { accepted: !1 };
    if (O = !0, A = v ? { ...v.getState() } : void 0, A) {
      const $ = qt({ x: A.vx, y: A.vy });
      A.vx = $.x, A.vy = $.y;
    }
    if (v == null || v.stop(), v = null, I == null || I.stop(), !C || !y) return { accepted: !1 };
    m && X(m.clientX, m.clientY), g = C.release(), !g && !et && A && Math.hypot(A.vx, A.vy) < 0.5 && d && (g = {
      columnId: d,
      index: _ ?? Math.max(0, e.getObjectSurfaceIndex(n, d))
    });
    const h = !g;
    if (h && d && (g = {
      columnId: d,
      index: _ ?? Math.max(0, e.getObjectSurfaceIndex(n, d)),
      invalidReturn: !0
    }), !g) return { accepted: !1 };
    const S = g, z = (F == null ? void 0 : F.getBoundingClientRect()) ?? ((q = e.getVisualProxy(y)) == null ? void 0 : q.element.getBoundingClientRect()) ?? ((G = Vt(o)) == null ? void 0 : G.getBoundingClientRect()) ?? o.getBoundingClientRect();
    delete o.dataset.runtimeActive, h && (x || b == null || b.restoreLayoutHidden(), R == null || R.release());
    const N = ($, j) => {
      if (L() !== "landing") return;
      const Y = Ue({
        resolve: () => j,
        applyState: (D) => e.applyVisualState(n, D, { phase: "revealing", hovered: !1, selected: D.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!Y) {
        M == null || M.complete({ completed: !1, reason: "target-not-registered" }), M = null;
        return;
      }
      e.keepSurfaceTargetVisible(S.columnId, Y);
      const K = Ke((D) => e.captureVisualState(n, D), Y), J = Je({
        createContext: () => e.createVisualLifecycleContext($, S, Y, B),
        source: o,
        sourceRect: z,
        visualSnapshot: w,
        targetSnapshot: K,
        motionState: A
      });
      F = Qe({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
        createProxy: () => e.getVisualProxy($) ?? e.createVisualProxy($, J) ?? null,
        enableProxy: (D) => Rt(D, !0),
        bindRegrab: (D) => e.bindRegrabTarget($, n, D, U),
        land: () => e.landVisualProxy($, Y, J),
        onMissing: () => {
          M == null || M.complete({ completed: !1, reason: "visual-proxy-missing" }), M = null;
        },
        onComplete: (D) => {
          tn({
            active: L() === "landing",
            result: D,
            complete: (tt) => M == null ? void 0 : M.complete(tt),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy($, Y, J).then(() => {
              F && (e.disposeVisualProxy($), F = null);
            })
          }), M = null;
        }
      });
    };
    return T = Ze(() => {
    }, () => {
      const $ = y;
      e.resolveLandingTarget($, S).then((j) => N($, j));
    }), { accepted: !0, destination: g, ...h ? { emitAction: !1 } : {} };
  }
  function U(m) {
    var $;
    if (L() !== "landing") return;
    const h = F;
    if (!h || !y) return;
    const S = e.getGroup(y), z = S ? ($ = e.objects.get(S.primaryObjectId)) == null ? void 0 : $.visual : void 0, N = en(
      () => e.resolveVisualTarget(y, g),
      () => {
        var j;
        return ((j = e.objects.get(n)) == null ? void 0 : j.element) ?? null;
      }
    );
    if (!N) return;
    const q = e.createRegrabContext(y, m, h, N);
    if (!q) return;
    _e({
      event: q.event,
      sessionId: y,
      proxy: h,
      source: N,
      interrupt: () => e.takeoverRegrab(y),
      clearRegrab: () => e.clearRegrab(n)
    });
    const G = N.getBoundingClientRect();
    S ? (z && e.objects.update(S.primaryObjectId, { visual: z }), e.startGroupObjectPointer(
      S.objectIds,
      S.primaryObjectId,
      N,
      m,
      q.regrabRect,
      G
    )) : e.startObjectPointer(n, N, m, q.regrabRect, G);
  }
  const ot = {
    prepare(m) {
      var tt;
      y = m.session.id, et = !1;
      const h = o.style.visibility === "hidden" || getComputedStyle(o).visibility === "hidden";
      if (I = e.createAutoScroller(y, {
        onScroll: (p) => X(p.x, p.y)
      }), m.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", h && (o.style.transition = ""), R = e.acquireObject(y, n), e.takeSurfaces(y, c);
      const S = e.getGroup(y);
      x = !!S;
      const { beforePickup: z } = je(o, k, P);
      _ = e.getObjectSurfaceIndex(n, d), B = o.cloneNode(!0);
      const N = e.getMoveContext(y), q = Ye(N, o, a, i, e.getObjectGrabAlign(n)), G = q.rect;
      V = { x: q.offsetX, y: q.offsetY }, document.body.classList.add("kb-dragging"), e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), w = Ge((p, E) => e.captureVisualState(n, E), n, o), b = pe(o, y);
      const $ = e.getObjectProxyLayout(n, o), j = !!($ != null && $.compact);
      fe(o, G, {
        layout: $,
        // 多选时源卡是布局幽灵，不能像单卡 detach 一样整张隐藏；主代理
        // 负责跟手，源节点保留在原位并由 group visual 降低透明度。
        keepSourceVisible: !!(S && S.objectIds.length > 1)
      }), ge(o, y);
      const Y = ye(o);
      Y && e.registerVisualProxy(y, { element: Y }), Y && e.updateVisualProxy(y), o.style.pointerEvents = "none", !r && !S && b.detachFromLayout(), o.style.transition = "none", S || e.scheduleLayout(z), o.dataset.runtimeActive = "true";
      const K = ((tt = e.getVisualProxy(y)) == null ? void 0 : tt.element) ?? Vt(o);
      if (!K) return;
      const J = G.left, D = G.top;
      v = Gt({
        mode: "follow",
        followRotation: Xt,
        onFrame: (p) => {
          if (!K.isConnected) return;
          const E = p.x - J, W = p.y - D;
          K.style.transform = `translate3d(${E.toFixed(2)}px, ${W.toFixed(2)}px, 0) perspective(760px) rotateX(${p.rotateX.toFixed(2)}deg) rotateZ(${p.rotateZ.toFixed(2)}deg) scale(${p.scaleX.toFixed(4)}, ${p.scaleY.toFixed(4)})`;
        }
      }), v.setProfile(se), v.seed({ x: G.left, y: G.top, scaleX: j ? 1 : 1.03, scaleY: j ? 1 : 1.03, rotateX: Xt.tilt, rotateZ: 0 }), v.setTarget({ x: a.clientX - V.x, y: a.clientY - V.y }), v.start(), C = We(
        u(n),
        (p) => e.resolveMoveHit(n, p.clientX, p.clientY),
        (p, E) => p.columnId === (E == null ? void 0 : E.columnId) && p.index === (E == null ? void 0 : E.index)
      ), X(a.clientX, a.clientY);
    },
    update(m, h) {
      h.event instanceof PointerEvent && Z(h.event);
    },
    resolveDestination(m, h) {
      return nt(h.event instanceof PointerEvent ? h.event : void 0);
    },
    commit: (m, h) => {
      e.getVisualProxy(y) || ht(o);
      const S = typeof h == "object" && h !== null && h.invalidReturn === !0, z = typeof h == "object" && h !== null ? h.toSurfaceId ?? h.columnId : void 0;
      x || (r || S || !S && typeof z == "string" && z === d ? b == null || b.restoreLayoutHidden() : b == null || b.detachFromLayout()), document.body.classList.remove("kb-dragging");
    },
    cancel(m, h) {
      O = !0, v == null || v.stop(), v = null, e.getVisualProxy(y) ? e.disposeVisualProxy(y) : F ? (e.disposeVisualProxy(y), F = null) : ht(o), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, ht(o), b == null || b.restore(), b = null;
    }
  }, mt = {
    layout: on(o, k, P),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => R == null ? void 0 : R.release()
    },
    ...nn({
      createGate: () => e.createCompletionGate(y, { completed: !1, reason: "landing-cancelled" }),
      onGate: (m) => {
        M = m;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        T == null || T(), T = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        F && Rt(F, !1), ht(o), b == null || b.restore(), b = null;
      }
    })
  };
  return { driver: ot, lifecycle: mt };
}
function Sn(t) {
  return rn({ ...t, clone: !0 });
}
export {
  sn as A,
  Gt as B,
  Ot as C,
  Nt as D,
  Fe as E,
  se as F,
  Lt as G,
  qt as H,
  Xe as I,
  bt as L,
  ln as a,
  mn as b,
  de as c,
  dn as d,
  rt as e,
  fn as f,
  $t as g,
  Sn as h,
  rn as i,
  gn as j,
  jt as k,
  un as l,
  cn as m,
  an as n,
  Xt as o,
  yn as p,
  xn as q,
  pn as r,
  hn as s,
  It as t,
  $e as u,
  Re as v,
  vn as w,
  bn as x,
  pe as y,
  we as z
};
