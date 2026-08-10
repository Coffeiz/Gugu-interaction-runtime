const at = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }
}, Vt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, an = 8;
function qt(t, e = Vt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, a = t.y * e.velocityScale, i = Math.hypot(o, a);
  if (i <= e.maxVelocity || i === 0) return { x: o, y: a };
  const r = e.maxVelocity / i;
  return { x: o * r, y: a * r };
}
function sn(t, e = Vt) {
  const n = qt(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const a = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * a, y: n.y * e.coastSeconds * a };
}
function Xt(t, e, n, o, a, i = 1 / 120) {
  let r = Math.max(0, a);
  for (; r > 1e-4; ) {
    const s = Math.min(r, i);
    r -= s;
    const l = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += c * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const vt = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, se = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, Dt = {
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
  let a = { x: 0, y: 0 }, i = vt, r = null, s = null, l = !1, c = 0, u = 0, d = "settle", f = 0;
  function C() {
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
    var X;
    if (!l) return;
    const F = Math.min(0.032, Math.max(0, (g - (s ?? g)) / 1e3));
    if (s = g, d === "coast") {
      const y = Math.exp(-b.friction * F);
      o.vx *= y, o.vy *= y;
      const R = o.vx * F, x = o.vy * F, L = f + Math.hypot(R, x);
      if (L >= b.maxDistance) {
        const v = Math.max(0, b.maxDistance - f), A = Math.hypot(R, x), z = A > 0 ? v / A : 0;
        o.x += R * z, o.y += x * z, o.vx = 0, o.vy = 0, d = "settle";
      } else
        o.x += R, o.y += x, f = L, ((g - (w ?? g)) / 1e3 >= b.duration || Math.hypot(o.vx, o.vy) <= b.minVelocity) && (d = "settle");
    }
    if (d === "settle") {
      const y = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      Xt(y, { x: a.x, y: a.y }, i.position.stiffness, i.position.damping, F), o.x = y.position.x, o.y = y.position.y, o.vx = y.velocity.x, o.vy = y.velocity.y;
    }
    const T = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (Xt(T, { x: a.scaleX ?? o.scaleX, y: a.scaleY ?? o.scaleY }, i.scale.stiffness, i.scale.damping, F), o.scaleX = T.position.x, o.scaleY = T.position.y, o.scaleVX = T.velocity.x, o.scaleVY = T.velocity.y, e === "follow") {
      const y = t.followRotation, R = -Math.log(1 - (y.smoothing ?? 0.2)) * 60, x = 1 - Math.exp(-R * F);
      c += (o.vx - c) * x, u += (o.vy - u) * x, o.rotateZ = Math.max(-(y.maxSway ?? 5), Math.min(y.maxSway ?? 5, c / 60 * y.sway));
      const L = Math.max(-(y.maxTiltDelta ?? 4), Math.min(y.maxTiltDelta ?? 4, u / 60 * (y.verticalTiltFactor ?? 0.16)));
      o.rotateX = y.tilt + L;
    } else {
      const y = Math.exp(-10 * F);
      o.rotateX *= y, o.rotateZ *= y;
    }
    if (C(), e === "follow") {
      r = requestAnimationFrame(B);
      return;
    }
    if (d === "settle" && Math.abs(a.x - o.x) < n.position && Math.abs(a.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      l = !1, r = null, (X = t.onArrived) == null || X.call(t);
      return;
    }
    r = requestAnimationFrame(B);
  }
  let b = null, w = null;
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
      l || (l = !0, d = "settle", b = null, w = null, s = null, C(), r = requestAnimationFrame(B));
    },
    startCoastThenSettle(g) {
      if (l) return;
      l = !0, d = "coast", b = g, f = 0, w = null;
      const F = Math.hypot(o.vx, o.vy), T = g.maxDistance / Math.max(g.duration, 1 / 60);
      if (F > T && F > 0) {
        const S = T / F;
        o.vx *= S, o.vy *= S;
      }
      s = null, C(), r = requestAnimationFrame((S) => {
        w = S, B(S);
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
  }), s.dataset.runtimePhase = "grab-start", r.appendChild(s), i.appendChild(r), i.className = "", i.style.position = "fixed", i.style.left = `${e.left}px`, i.style.top = `${e.top}px`, i.style.boxSizing = "border-box", i.style.width = `${e.width}px`, i.style.height = `${e.height}px`, i.style.margin = "0", i.style.zIndex = "2147483647", i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = `perspective(760px) rotateX(5deg) scale(${a})`, Ct && n.glass !== !1 ? Wt(s) : s.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o && (s.dataset.runtimeCompact = "true");
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
function Ot(t) {
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
  const u = Ot(l), d = new Set(u.map(pt)), f = document.createElement("div");
  Object.assign(f.style, { ...s, pointerEvents: "" }), f.style.display = n.display, f.style.gridTemplateColumns = n.gridTemplateColumns, f.style.gridTemplateRows = n.gridTemplateRows, f.style.gridAutoColumns = n.gridAutoColumns, f.style.gridAutoRows = n.gridAutoRows, f.style.gridAutoFlow = n.gridAutoFlow, f.style.justifyItems = n.justifyItems, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.alignContent = n.alignContent, f.style.columnGap = n.columnGap, f.style.rowGap = n.rowGap, f.style.flexDirection = n.flexDirection, f.style.flexWrap = n.flexWrap, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.gap = n.gap, f.style.overflow = "hidden";
  const C = e.cloneNode(!0);
  for (C.style.visibility = "visible", C.style.display = ""; C.firstChild; ) f.appendChild(C.firstChild);
  const B = ce(e);
  ue(f, B);
  const b = Ot(f), w = new Set(b.map(pt)), g = b.filter((S) => !d.has(pt(S)));
  for (const S of g) S.style.opacity = "0";
  const F = u.filter((S) => !w.has(pt(S))), T = new Set(F);
  for (const S of u)
    T.has(S) || (S.style.opacity = "0");
  return t.appendChild(f), F.length > 0 && t.appendChild(l), { enteringEls: g, leavingEls: F };
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
  const o = n.duration ?? at.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, u = n.targetOpacity, d = $t(t), f = n.targetContent ? Yt(d, n.targetContent) : null;
  if (f) {
    for (const h of f.enteringEls) h.style.transition = `opacity ${o}ms ${a}`;
    for (const h of f.leavingEls) h.style.transition = `opacity ${o}ms ${a}`;
  }
  const C = parseFloat(t.style.left) || 0, B = parseFloat(t.style.top) || 0;
  let b = !1, w = e;
  const g = performance.now();
  let F = () => {
  }, T = () => {
  };
  const S = new Promise((h) => {
    T = h;
  }), X = () => {
    const h = t.getBoundingClientRect();
    return Math.abs(h.left - w.left) < 2 && Math.abs(h.top - w.top) < 2 && Math.abs(h.width - w.width) < 2 && Math.abs(h.height - w.height) < 2;
  };
  let y = null, R = null, x = 0;
  const L = 60, v = (h) => {
    b || (b = !0, t.removeEventListener("transitionend", F), R !== null && (window.clearTimeout(R), R = null), T());
  }, A = () => {
    if (!b) {
      if (X()) {
        v();
        return;
      }
      if (performance.now() - g >= o + 500) {
        v();
        return;
      }
      window.requestAnimationFrame(A);
    }
  }, z = (h, $ = o) => {
    w = h;
    const I = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${I.width.toFixed(2)}px`, t.style.height = `${I.height.toFixed(2)}px`, t.style.transform = `translate3d(${(I.left - C).toFixed(2)}px, ${(I.top - B).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const V = `translate3d(${(h.left - C).toFixed(2)}px, ${(h.top - B).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${$}ms ${a}, width ${$}ms ${a}, height ${$}ms ${a}`, d.style.transition = [
      `box-shadow ${$}ms ease`,
      `border-radius ${$}ms ease`,
      `border-color ${$}ms ease`,
      `backdrop-filter ${$}ms ease`,
      `-webkit-backdrop-filter ${$}ms ease`,
      `background-color ${$}ms ease`,
      `background-image ${$}ms ease`,
      `opacity ${$}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = V, t.style.width = `${h.width.toFixed(2)}px`, t.style.height = `${h.height.toFixed(2)}px`, i != null && (d.style.boxShadow = i), r != null && (d.style.borderRadius = r), s != null && (d.style.border = s), l != null && (d.style.backdropFilter = l, d.style.setProperty("-webkit-backdrop-filter", l)), c != null && (d.style.backgroundColor = c, n.targetBackgroundImage && (d.style.backgroundImage = n.targetBackgroundImage)), u != null && (d.style.opacity = u), f) {
        for (const Z of f.enteringEls) Z.style.opacity = "1";
        for (const Z of f.leavingEls) Z.style.opacity = "0";
      }
    });
  };
  F = (h) => {
    h.target !== t || !(h.propertyName === "transform" || h.propertyName === "width" || h.propertyName === "height") || X() && v(`transitionend:${h.propertyName}`);
  }, t.addEventListener("transitionend", F), z(e), window.setTimeout(A, o + 40);
  const _ = (h) => {
    var I;
    x = performance.now();
    const $ = Math.max(80, o - (x - g));
    z(((I = n.readTarget) == null ? void 0 : I.call(n)) ?? h, $);
  };
  return { finished: S, retarget: (h) => {
    if (b) return;
    const $ = Math.abs(h.left - w.left), I = Math.abs(h.top - w.top), V = Math.abs(h.width - w.width), Z = Math.abs(h.height - w.height);
    if ($ < 0.5 && I < 0.5 && V < 0.5 && Z < 0.5) return;
    const nt = performance.now() - x;
    if (nt >= L) {
      _(h);
      return;
    }
    y = h, R === null && (R = window.setTimeout(() => {
      if (R = null, b || !y) return;
      const J = y;
      y = null, _(J);
    }, L - nt));
  } };
}
function dn(t, e, n = {}) {
  var k, O, Y, N, W, E, U, q, it, Q, D, P, G;
  const o = n.duration ?? at.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, c = n.targetBackground, u = n.targetOpacity, d = $t(t), f = t.querySelector("[data-runtime-proxy-scale-shell]"), C = n.targetContent ? Yt(d, n.targetContent) : null;
  if (C) {
    for (const M of C.enteringEls) M.style.transition = `opacity ${o}ms ${a}`;
    for (const M of C.leavingEls) M.style.transition = `opacity ${o}ms ${a}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const B = parseFloat(t.style.left) || t.getBoundingClientRect().left, b = parseFloat(t.style.top) || t.getBoundingClientRect().top, w = t.getBoundingClientRect(), g = w.width || e.width, F = w.height || e.height, T = (M) => ({
    left: M.left - (g - M.width) / 2,
    top: M.top - (F - M.height) / 2,
    width: M.width,
    height: M.height
  });
  let S = e, X = !1;
  const y = n.landingMode === "target" && !!f, R = y ? ((k = n.dismiss) == null ? void 0 : k.duration) ?? o : 0;
  let x = !1, L = !y, v = null, A = null, z = 0, _ = () => {
  };
  const et = new Promise((M) => {
    _ = M;
  }), h = () => {
    X || (X = !0, V.stop(), v !== null && window.clearTimeout(v), A !== null && window.clearTimeout(A), v = null, A = null, _());
  }, $ = () => {
    x && L && h();
  }, I = () => {
    X || (x = !0, $());
  }, V = Gt({
    mode: "settle",
    onFrame: (M) => {
      const j = g * M.scaleX, K = F * M.scaleY, Tt = M.x + (g - j) / 2, ae = M.y + (F - K) / 2;
      t.style.transform = `perspective(760px) translate3d(${(Tt - B).toFixed(2)}px, ${(ae - b).toFixed(2)}px, 0) rotateX(${M.rotateX.toFixed(2)}deg) rotateZ(${M.rotateZ.toFixed(2)}deg)`, t.style.width = `${j.toFixed(2)}px`, t.style.height = `${K.toFixed(2)}px`;
    },
    onArrived: I
  }), Z = Math.hypot(((O = n.motionState) == null ? void 0 : O.vx) ?? 0, ((Y = n.motionState) == null ? void 0 : Y.vy) ?? 0), nt = n.releaseDamping ?? 0.78, J = n.targetMotion ? {
    position: { ...vt.position, ...n.targetMotion.position },
    scale: { ...vt.scale, ...n.targetMotion.scale }
  } : vt;
  V.setProfile(Z > 30 ? {
    ...J,
    position: {
      ...J.position,
      damping: J.position.damping * nt
    }
  } : J), V.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((N = n.motionState) == null ? void 0 : N.x) ?? w.left,
    y: ((W = n.motionState) == null ? void 0 : W.y) ?? w.top,
    vx: ((E = n.motionState) == null ? void 0 : E.vx) ?? 0,
    vy: ((U = n.motionState) == null ? void 0 : U.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((q = n.motionState) == null ? void 0 : q.scaleX) ?? 1,
    scaleY: ((it = n.motionState) == null ? void 0 : it.scaleY) ?? 1,
    rotateX: ((Q = n.motionState) == null ? void 0 : Q.rotateX) ?? 0,
    rotateZ: ((D = n.motionState) == null ? void 0 : D.rotateZ) ?? 0
  });
  const ot = T(e), ut = n.landingMode === "target" ? { scaleX: 1, scaleY: 1 } : { scaleX: ot.width / g, scaleY: ot.height / F };
  V.setTarget({
    x: ot.left,
    y: ot.top,
    scaleX: ut.scaleX,
    scaleY: ut.scaleY
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
    var M, j;
    if (!X) {
      if (n.landingMode !== "target" && (d.dataset.runtimePhase = "landing", d.dataset.runtimeCompact === "true" && (d.style.left = "0", d.style.width = "100%", d.style.transform = "none", d.style.gridTemplateColumns = "")), i != null && (d.style.boxShadow = i), r != null && (d.style.borderRadius = r), s != null && (d.style.border = s), l != null && (d.style.backdropFilter = l, d.style.setProperty("-webkit-backdrop-filter", l)), c != null && (d.style.backgroundColor = c, n.targetBackgroundImage && (d.style.backgroundImage = n.targetBackgroundImage)), u != null && (d.style.opacity = u), y && f) {
        const K = ((M = n.dismiss) == null ? void 0 : M.easing) ?? a, Tt = ((j = n.dismiss) == null ? void 0 : j.scale) ?? 0.72;
        f.style.transformOrigin = "50% 50%", f.style.transition = `transform ${R}ms ${K}`, d.style.transition = `opacity ${R}ms ${K}`, f.style.transform = `scale(${Tt})`, d.style.opacity = "0", A = window.setTimeout(() => {
          A = null, L = !0, $();
        }, R + 40);
      }
      if (C) {
        for (const K of C.enteringEls) K.style.opacity = "1";
        for (const K of C.leavingEls) K.style.opacity = "0";
      }
    }
  });
  const m = (M = 0) => {
    v !== null && window.clearTimeout(v), z = performance.now() + Math.max(2e3, o * 8, 5e3) + M, v = window.setTimeout(() => {
      v = null, !X && performance.now() >= z && I();
    }, Math.max(2e3, o * 8, 5e3) + M);
  };
  m();
  const p = n.coast;
  return p && p.maxDistance > 0 && Math.hypot(((P = n.motionState) == null ? void 0 : P.vx) ?? 0, ((G = n.motionState) == null ? void 0 : G.vy) ?? 0) > p.minVelocity ? V.startCoastThenSettle(p) : V.start(), {
    finished: et,
    retarget(M) {
      if (X) return;
      S = M, m(1e3);
      const j = T(S);
      V.setTarget({
        x: j.left,
        y: j.top,
        scaleX: n.landingMode === "target" ? 1 : j.width / g,
        scaleY: n.landingMode === "target" ? 1 : j.height / F
      });
    }
  };
}
function fn(t) {
  St.has(t) && (St.delete(t), t.remove());
}
const bt = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ new WeakMap(), At = /* @__PURE__ */ new WeakSet();
function fe(t, e, n = {}) {
  var r;
  bt.set(t, { style: t.getAttribute("style") ?? "" });
  const o = de(t, e, { glass: !1, layout: n.layout }), a = $t(o), i = !!((r = n.layout) != null && r.compact);
  o.style.zIndex = "1000", o.style.transform = "scale(1)", o.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", At.add(o), st.set(t, o), t.style.visibility = "hidden", requestAnimationFrame(() => {
    o.isConnected && (Ct ? Wt(a) : a.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", o.style.transform = `scale(${i ? 1 : 1.03})`);
  });
}
function zt(t) {
  return st.get(t);
}
function ye(t) {
  const e = st.get(t);
  if (e)
    return At.delete(e), st.delete(t), bt.delete(t), e.style.zIndex = "2147483647", e;
}
function ht(t) {
  const e = st.get(t);
  e && (At.delete(e), e.remove(), St.delete(e), st.delete(t));
  const n = bt.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), bt.delete(t);
}
const St = /* @__PURE__ */ new Set();
let Ct = !1;
function yn(t) {
  Ct = t;
}
function gn() {
  return Ct;
}
function Wt(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", t.style.boxShadow = "0 22px 50px rgba(30, 35, 60, 0.30)", t.style.opacity = "0.97";
}
const lt = /* @__PURE__ */ new Map();
function mn(t, e) {
  lt.set(t, e), t.style.visibility = "hidden";
}
function ge(t, e) {
  (t.style.visibility === "hidden" || getComputedStyle(t).visibility === "hidden") && lt.set(t, e);
}
function pn(t, e) {
  const n = lt.get(t) === e;
  return n && (t.style.visibility = "", lt.delete(t)), n;
}
function me(t, e) {
  lt.get(t) === e && lt.delete(t);
}
const Mt = /* @__PURE__ */ new WeakMap();
function pe(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  Mt.set(t, n);
  const o = () => Mt.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, Mt.delete(t), !0) : !1,
    isOwner: o
  };
}
const dt = /* @__PURE__ */ new WeakMap(), ft = /* @__PURE__ */ new WeakMap();
function jt(t) {
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
  const e = dt.get(t);
  e && (cancelAnimationFrame(e.frame), dt.delete(t), t.style.transform = "");
}
function he(t, e, n, o, a, i) {
  Pt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: jt(a)
  };
  dt.set(t, r);
  const s = (l) => {
    if (dt.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), u = r.easing(c);
    if (t.style.transform = `translate(${(r.fromX * (1 - u)).toFixed(3)}px, ${(r.fromY * (1 - u)).toFixed(3)}px)`, c >= 1) {
      dt.delete(t), t.style.transform = "", i == null || i();
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
function Et(t) {
  const e = ft.get(t);
  e && (cancelAnimationFrame(e.frame), ft.delete(t), t.style.height = "");
}
function xe(t, e, n, o, a, i) {
  Et(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: jt(a)
  };
  ft.set(t, r);
  const s = (l) => {
    if (ft.get(t) !== r) return;
    const c = Math.min(1, (l - r.started) / r.duration), u = r.fromX + (r.fromY - r.fromX) * r.easing(c);
    if (t.style.height = `${u}px`, c >= 1) {
      ft.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
const yt = at.flip.duration, gt = at.flip.easing;
function ve(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((o) => n.set(o, (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect())), n;
}
function Ht(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, Pt(n), n.style.setProperty("transition", "none", "important");
}
function be(t, e, n = yt, o = gt, a) {
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
const kt = /* @__PURE__ */ new WeakMap();
function hn(t) {
  Qt = t;
}
function xn(t) {
  te = t;
}
function ee() {
  const t = Qt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? at.flip,
    resize: (t == null ? void 0 : t.resize) ?? at.resize
  };
}
function Ce(t, e, n) {
  const o = (s) => !n || n.length === 0 ? !0 : n.some((l) => l === s || l.contains(s)), a = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(o), i = [], r = [];
  for (const s of t)
    o(s) && (s.closest("[data-layout-group]") !== null ? i.push(s) : r.push(s));
  return { groups: a, groupLeaves: i, flatCards: r };
}
function Lt(t, e = document, n = !0, o, a = {}) {
  const i = (b) => {
    const w = a.scopeSurfaces;
    return !w || w.length === 0 ? !0 : w.some((g) => g === b || g.contains(b));
  }, r = Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i), s = r.map((b) => ({ element: b, rect: mt(b), inlineStyle: ie(b) }));
  oe(s);
  const l = Jt(), { groups: c, groupLeaves: u, flatCards: d } = Ce(t, e, a.scopeSurfaces), f = Ne(r, l), C = (a.scopeSurfaces ?? [e]).some(
    (b) => b instanceof HTMLElement ? b.matches("[data-layout-collection]") || b.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), B = {
    root: e,
    group: c.length > 0 ? { before: Ie([...c, ...u], l) } : void 0,
    flat: d.length > 0 ? { elements: d, before: ve(d, l) } : void 0,
    surfaces: f,
    presence: n && C ? we(e, '[data-layout-role="card"]', void 0, o, a.scopeSurfaces, l) : void 0
  };
  return Ae(e, B);
}
function It(t) {
  const e = Jt(), n = ee(), o = t.group ? Me(t.group.before) : null;
  t.group && Xe(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && be(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), Ve(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && Fe(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), o && ke(o, n.flip.duration + 50);
}
const ct = /* @__PURE__ */ new WeakMap();
let Te = 0;
function Me(t) {
  const e = t.filter((i) => i.rect.height > 0).map((i) => ({ element: i.element, overflow: i.element.style.overflow })).filter((i) => i.element.isConnected).filter((i) => i.element.dataset.runtimeGroupAnimating !== "true").filter((i) => getComputedStyle(i.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), o = ct.get(n);
  o == null || o.entries.forEach(({ element: i, overflow: r }) => {
    i.style.overflow = r;
  }), e.forEach(({ element: i }) => {
    i.style.overflow = "visible";
  });
  const a = { token: String(++Te), entries: e };
  return ct.set(n, a), a;
}
function ke(t, e) {
  var o;
  const n = (o = t.entries[0]) == null ? void 0 : o.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var a;
    ((a = ct.get(n)) == null ? void 0 : a.token) === t.token && (t.entries.forEach(({ element: i, overflow: r }) => {
      i.style.overflow = r;
    }), ct.delete(n));
  }, e));
}
function Re(t) {
  tt.set(t.root, t), queueMicrotask(() => {
    tt.get(t.root) === t && (tt.delete(t.root), It(t));
  });
}
function $e(t) {
  tt.set(t.root, t), requestAnimationFrame(() => {
    tt.get(t.root) === t && (tt.delete(t.root), It(t));
  });
}
function Ae(t, e) {
  const n = tt.get(t);
  if (!n) return e;
  const o = Le(e.surfaces, n.surfaces), a = Pe(e.flat, n.flat), i = Ee(e.group, n.group);
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
function Le(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const a = n.get(o.element);
    return a ? { ...o, rect: a.rect, inlineStyle: a.inlineStyle } : o;
  });
}
const tt = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ new WeakMap(), Ft = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap();
function mt(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function Ie(t, e) {
  const n = t.filter((a) => {
    const i = (e == null ? void 0 : e.rect(a)) ?? a.getBoundingClientRect();
    return i.width > 0 && i.height > 0;
  }), o = new Set(n);
  return n.map((a) => ({
    element: a,
    parent: Be(a, o),
    rect: mt(a, e)
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
function Xe(t, e = yt, n = gt, o) {
  Ht(t.map((i) => i.element));
  const a = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = mt(i.element, o);
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
    const d = rt.get(i.element);
    d !== void 0 && (cancelAnimationFrame(d), rt.delete(i.element));
    const f = requestAnimationFrame(() => {
      rt.delete(i.element), i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    });
    rt.set(i.element, f);
    const C = window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip, Ft.delete(i.element));
    }, e + 40);
    Ft.set(i.element, C);
  }
}
function De(t, e, n = yt, o = gt, a) {
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
function vn(t) {
  tt.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, o = ct.get(n);
  o && (o.timeout !== void 0 && window.clearTimeout(o.timeout), o.entries.forEach(({ element: i, overflow: r }) => {
    e && !t.contains(i) || (i.style.overflow = r);
  }), ct.delete(n));
  const a = [];
  t instanceof HTMLElement && a.push(t), typeof t.querySelectorAll == "function" && a.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const i of a) {
    const r = Ft.get(i), s = rt.get(i), l = r !== void 0 || i.dataset.runtimeFlip === "true" || i.dataset.runtimeGroupAnimating === "true" || i.dataset.runtimeSurfaceResize === "true";
    r !== void 0 && (window.clearTimeout(r), Ft.delete(i)), s !== void 0 && (cancelAnimationFrame(s), rt.delete(i)), Pt(i), Et(i), ne(i);
    const c = H.get(i);
    c && (Bt(i, c.baseStyle), H.delete(i)), i.dataset.runtimeGroupAnimating === "true" && (i.style.height = i.dataset.layoutOpen === "false" ? "0px" : "", i.style.overflow = i.dataset.layoutOpen === "false" ? "hidden" : "", i.style.transition = ""), l && (i.style.transform = ""), i.dataset.runtimeFlip === "true" && delete i.dataset.runtimeFlip, delete i.dataset.runtimeSurfaceResize, delete i.dataset.runtimeSurfaceResizeToken, delete i.dataset.runtimeGroupAnimating;
  }
}
async function bn(t) {
  const e = (kt.get(t.content) ?? 0) + 1;
  kt.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll(".done-card-item")), o = (n.length > 0 ? n : Array.from(t.root.querySelectorAll("[data-card]"))).filter((s) => {
    const l = s.getBoundingClientRect();
    return l.width > 0 && l.height > 0;
  }), a = Lt(o, t.root, !1), i = t.content.getBoundingClientRect().height, r = te ? Oe(t.content, t.opening, t.duration, t.easing) : null;
  t.mutate(), await t.waitForLayout(), kt.get(t.content) === e && (t.isCurrent && !t.isCurrent() || (De(t.content, t.opening ? t.content.scrollHeight : 0, t.duration, t.easing, i), r && ze(r, t.opening), It(a)));
}
function Oe(t, e, n = yt, o = gt) {
  const a = Array.from(t.querySelectorAll(".done-card-item")), i = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = i, a.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: a, token: i, duration: n };
}
function ze(t, e) {
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
function Ne(t, e) {
  return t.map((n) => {
    var o;
    return {
      element: n,
      rect: mt(n, e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = H.get(n)) == null ? void 0 : o.baseStyle) ?? ie(n)
    };
  });
}
function Ve(t, e = yt, n = gt, o) {
  var i;
  oe(t);
  const a = t.filter((r) => r.element.isConnected).map((r) => {
    const s = mt(r.element, o), l = ee();
    return {
      item: r,
      next: s,
      profile: l.resize,
      fromHeight: Nt(r.element, r.rect.height),
      toHeight: Nt(r.element, s.height)
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
        const C = H.get(r.element);
        !C || C.token !== f || (Bt(r.element, C.baseStyle), H.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
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
function Nt(t, e) {
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
function We(t, e, n) {
  const o = t.cloneNode(!0), a = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: Lt(a, document, !0, re(t), {
      scopeSurfaces: n == null ? void 0 : n()
    })
  };
}
function je(t, e, n) {
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
    capture: () => (o += 1, Lt(
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
  var ut;
  const { runtime: e, objectId: n, element: o, event: a, fromRect: i, clone: r = !1 } = t, s = e.objects.get(n), l = e.surfaces.snapshot(), c = l.map((m) => m.id), u = (m) => {
    var p;
    return (p = e.objects.get(m)) == null ? void 0 : p.surfaceId;
  }, d = (s == null ? void 0 : s.surfaceId) ?? ((ut = l[0]) == null ? void 0 : ut.id), f = (m) => m.closest('[data-layout-content][data-layout-open="false"]') !== null, C = () => {
    const m = [...e.objects.values()].map((k) => k.element).filter((k) => !!(k != null && k.isConnected)), p = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...m, ...p])).filter((k) => !f(k));
  };
  let B, b, w, g = null, F = null, T = null, S = null, X = !1, y = null, R = null, x = null, L = null, v = null, A, z = { x: 0, y: 0 }, _ = null, et = !1;
  const h = () => {
    const m = /* @__PURE__ */ new Set();
    return d && m.add(d), g != null && g.columnId && m.add(g.columnId), e.surfaces.snapshot().filter((p) => m.has(p.id)).map((p) => p.element).filter((p) => !!(p != null && p.isConnected));
  };
  function $() {
    var m;
    return y ? (m = e.getSession(y)) == null ? void 0 : m.state : void 0;
  }
  function I(m, p) {
    if ($() !== "active" || !w) return;
    const k = He({
      active: $() === "active",
      event: { clientX: m, clientY: p },
      state: w,
      getSurface: (O) => O.columnId
    });
    k && (g = k);
  }
  function V(m) {
    et = !0, v == null || v.setTarget({
      x: m.clientX - z.x,
      y: m.clientY - z.y
    }), I(m.clientX, m.clientY), L == null || L.update(
      e.resolveMoveSurfaceElement(n, m.clientX, m.clientY),
      { x: m.clientX, y: m.clientY }
    );
  }
  function Z(m) {
    var N, W;
    if (X) return { accepted: !1 };
    if (X = !0, A = v ? { ...v.getState() } : void 0, A) {
      const E = qt({ x: A.vx, y: A.vy });
      A.vx = E.x, A.vy = E.y;
    }
    if (v == null || v.stop(), v = null, L == null || L.stop(), !w || !y) return { accepted: !1 };
    m && I(m.clientX, m.clientY), g = w.release(), !g && !et && A && Math.hypot(A.vx, A.vy) < 0.5 && d && (g = {
      columnId: d,
      index: _ ?? Math.max(0, e.getObjectSurfaceIndex(n, d))
    });
    const p = !g;
    if (p && d && (g = {
      columnId: d,
      index: _ ?? Math.max(0, e.getObjectSurfaceIndex(n, d)),
      invalidReturn: !0
    }), !g) return { accepted: !1 };
    const k = g, O = (S == null ? void 0 : S.getBoundingClientRect()) ?? ((N = e.getVisualProxy(y)) == null ? void 0 : N.element.getBoundingClientRect()) ?? ((W = zt(o)) == null ? void 0 : W.getBoundingClientRect()) ?? o.getBoundingClientRect();
    delete o.dataset.runtimeActive, p && (x == null || x.restoreLayoutHidden(), R == null || R.release());
    const Y = (E, U) => {
      if ($() !== "landing") return;
      const q = Ue({
        resolve: () => U,
        applyState: (D) => e.applyVisualState(n, D, { phase: "revealing", hovered: !1, selected: D.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!q) {
        T == null || T.complete({ completed: !1, reason: "target-not-registered" }), T = null;
        return;
      }
      e.keepSurfaceTargetVisible(k.columnId, q);
      const it = Ke((D) => e.captureVisualState(n, D), q), Q = Je({
        createContext: () => e.createVisualLifecycleContext(E, k, q, B),
        source: o,
        sourceRect: O,
        visualSnapshot: b,
        targetSnapshot: it,
        motionState: A
      });
      S = Qe({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
        createProxy: () => e.getVisualProxy(E) ?? e.createVisualProxy(E, Q) ?? null,
        enableProxy: (D) => Rt(D, !0),
        bindRegrab: (D) => e.bindRegrabTarget(E, n, D, nt),
        land: () => e.landVisualProxy(E, q, Q),
        onMissing: () => {
          T == null || T.complete({ completed: !1, reason: "visual-proxy-missing" }), T = null;
        },
        onComplete: (D) => {
          tn({
            active: $() === "landing",
            result: D,
            complete: (P) => T == null ? void 0 : T.complete(P),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(E, q, Q).then(() => {
              S && (e.disposeVisualProxy(E), S = null);
            })
          }), T = null;
        }
      });
    };
    return F = Ze(() => {
    }, () => {
      const E = y;
      e.resolveLandingTarget(E, k).then((U) => Y(E, U));
    }), { accepted: !0, destination: g, ...p ? { emitAction: !1 } : {} };
  }
  function nt(m) {
    if ($() !== "landing") return;
    const p = S;
    if (!p || !y) return;
    const k = en(
      () => e.resolveVisualTarget(y, g),
      () => {
        var N;
        return ((N = e.objects.get(n)) == null ? void 0 : N.element) ?? null;
      }
    );
    if (!k) return;
    const O = e.createRegrabContext(y, m, p, k);
    if (!O) return;
    _e({
      event: O.event,
      sessionId: y,
      proxy: p,
      source: k,
      interrupt: () => e.takeoverRegrab(y),
      clearRegrab: () => e.clearRegrab(n)
    });
    const Y = k.getBoundingClientRect();
    e.startObjectPointer(n, k, m, O.regrabRect, Y);
  }
  const J = {
    prepare(m) {
      var D;
      y = m.session.id, et = !1;
      const p = o.style.visibility === "hidden" || getComputedStyle(o).visibility === "hidden";
      if (L = e.createAutoScroller(y, {
        onScroll: (P) => I(P.x, P.y)
      }), m.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", p && (o.style.transition = ""), R = e.acquireObject(y, n), e.takeSurfaces(y, c);
      const { beforePickup: k } = We(o, C, h);
      _ = e.getObjectSurfaceIndex(n, d), B = o.cloneNode(!0);
      const O = e.getMoveContext(y), Y = Ye(O, o, a, i, e.getObjectGrabAlign(n)), N = Y.rect;
      z = { x: Y.offsetX, y: Y.offsetY }, document.body.classList.add("kb-dragging"), e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), b = Ge((P, G) => e.captureVisualState(n, G), n, o), x = pe(o, y);
      const W = e.getObjectProxyLayout(n, o), E = !!(W != null && W.compact);
      fe(o, N, { layout: W }), ge(o, y);
      const U = ye(o);
      U && e.registerVisualProxy(y, { element: U }), o.style.pointerEvents = "none", r || x.detachFromLayout(), o.style.transition = "none", e.scheduleLayout(k), o.dataset.runtimeActive = "true";
      const q = ((D = e.getVisualProxy(y)) == null ? void 0 : D.element) ?? zt(o);
      if (!q) return;
      const it = N.left, Q = N.top;
      v = Gt({
        mode: "follow",
        followRotation: Dt,
        onFrame: (P) => {
          if (!q.isConnected) return;
          const G = P.x - it, M = P.y - Q;
          q.style.transform = `translate3d(${G.toFixed(2)}px, ${M.toFixed(2)}px, 0) perspective(760px) rotateX(${P.rotateX.toFixed(2)}deg) rotateZ(${P.rotateZ.toFixed(2)}deg) scale(${P.scaleX.toFixed(4)}, ${P.scaleY.toFixed(4)})`;
        }
      }), v.setProfile(se), v.seed({ x: N.left, y: N.top, scaleX: E ? 1 : 1.03, scaleY: E ? 1 : 1.03, rotateX: Dt.tilt, rotateZ: 0 }), v.setTarget({ x: a.clientX - z.x, y: a.clientY - z.y }), v.start(), w = je(
        u(n),
        (P) => e.resolveMoveHit(n, P.clientX, P.clientY),
        (P, G) => P.columnId === (G == null ? void 0 : G.columnId) && P.index === (G == null ? void 0 : G.index)
      ), I(a.clientX, a.clientY);
    },
    update(m, p) {
      p.event instanceof PointerEvent && V(p.event);
    },
    resolveDestination(m, p) {
      return Z(p.event instanceof PointerEvent ? p.event : void 0);
    },
    commit: (m, p) => {
      e.getVisualProxy(y) || ht(o);
      const k = typeof p == "object" && p !== null && p.invalidReturn === !0, O = typeof p == "object" && p !== null ? p.toSurfaceId ?? p.columnId : void 0;
      r || k || !k && typeof O == "string" && O === d ? x == null || x.restoreLayoutHidden() : x == null || x.detachFromLayout(), document.body.classList.remove("kb-dragging");
    },
    cancel(m, p) {
      X = !0, v == null || v.stop(), v = null, e.getVisualProxy(y) ? e.disposeVisualProxy(y) : S ? (e.disposeVisualProxy(y), S = null) : ht(o), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, ht(o), x == null || x.restore(), x = null;
    }
  }, ot = {
    layout: on(o, C, h),
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
        T = m;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        F == null || F(), F = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        S && Rt(S, !1), ht(o), x == null || x.restore(), x = null;
      }
    })
  };
  return { driver: J, lifecycle: ot };
}
function Sn(t) {
  return rn({ ...t, clone: !0 });
}
export {
  sn as A,
  Gt as B,
  Xt as C,
  Vt as D,
  Fe as E,
  se as F,
  It as G,
  qt as H,
  De as I,
  vt as L,
  ln as a,
  mn as b,
  de as c,
  dn as d,
  at as e,
  fn as f,
  $t as g,
  Sn as h,
  rn as i,
  gn as j,
  Wt as k,
  un as l,
  cn as m,
  an as n,
  Dt as o,
  yn as p,
  xn as q,
  pn as r,
  hn as s,
  Lt as t,
  $e as u,
  Re as v,
  bn as w,
  vn as x,
  pe as y,
  we as z
};
