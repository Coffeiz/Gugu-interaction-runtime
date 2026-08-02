const j = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 250 }
}, At = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, He = 8;
function $t(t, e = At) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, a = t.y * e.velocityScale, i = Math.hypot(o, a);
  if (i <= e.maxVelocity || i === 0) return { x: o, y: a };
  const r = e.maxVelocity / i;
  return { x: o * r, y: a * r };
}
function _e(t, e = At) {
  const n = $t(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const a = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * a, y: n.y * e.coastSeconds * a };
}
function Mt(t, e, n, o, a, i = 1 / 120) {
  let r = Math.max(0, a);
  for (; r > 1e-4; ) {
    const l = Math.min(r, i);
    r -= l;
    const s = n * (e.x - t.position.x) - o * t.velocity.x, u = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += s * l, t.velocity.y += u * l, t.position.x += t.velocity.x * l, t.position.y += t.velocity.y * l;
  }
}
const K = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Ut = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, Tt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Kt = { position: 0.35, velocity: 5 };
function Et(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? Kt, o = {
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
  let a = { x: 0, y: 0 }, i = K, r = null, l = null, s = !1, u = 0, c = 0, f = "settle", y = 0;
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
  function h(x) {
    var E;
    if (!s) return;
    const b = Math.min(0.032, l == null ? 1 / 60 : Math.max(0, (x - l) / 1e3));
    if (l = x, f === "coast") {
      const d = Math.exp(-v.friction * b);
      o.vx *= d, o.vy *= d;
      const P = o.vx * b, S = o.vy * b, L = y + Math.hypot(P, S);
      if (L >= v.maxDistance) {
        const N = Math.max(0, v.maxDistance - y), X = Math.hypot(P, S), z = X > 0 ? N / X : 0;
        o.x += P * z, o.y += S * z, o.vx = 0, o.vy = 0, f = "settle";
      } else
        o.x += P, o.y += S, y = L, ((x - (A ?? x)) / 1e3 >= v.duration || Math.hypot(o.vx, o.vy) <= v.minVelocity) && (f = "settle");
    }
    if (f === "settle") {
      const d = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      Mt(d, { x: a.x, y: a.y }, i.position.stiffness, i.position.damping, b), o.x = d.position.x, o.y = d.position.y, o.vx = d.velocity.x, o.vy = d.velocity.y;
    }
    const T = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (Mt(T, { x: a.scaleX ?? o.scaleX, y: a.scaleY ?? o.scaleY }, i.scale.stiffness, i.scale.damping, b), o.scaleX = T.position.x, o.scaleY = T.position.y, o.scaleVX = T.velocity.x, o.scaleVY = T.velocity.y, e === "follow") {
      const d = t.followRotation, P = -Math.log(1 - (d.smoothing ?? 0.2)) * 60, S = 1 - Math.exp(-P * b);
      u += (o.vx - u) * S, c += (o.vy - c) * S, o.rotateZ = Math.max(-(d.maxSway ?? 5), Math.min(d.maxSway ?? 5, u / 60 * d.sway));
      const L = Math.max(-(d.maxTiltDelta ?? 4), Math.min(d.maxTiltDelta ?? 4, c / 60 * (d.verticalTiltFactor ?? 0.16)));
      o.rotateX = d.tilt + L;
    } else {
      const d = Math.exp(-10 * b);
      o.rotateX *= d, o.rotateZ *= d;
    }
    if (C(), e === "follow") {
      r = requestAnimationFrame(h);
      return;
    }
    if (f === "settle" && Math.abs(a.x - o.x) < n.position && Math.abs(a.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      s = !1, r = null, (E = t.onArrived) == null || E.call(t);
      return;
    }
    r = requestAnimationFrame(h);
  }
  let v = null, A = null;
  return {
    seed(x) {
      Object.assign(o, x);
    },
    setTarget(x) {
      a = { ...x };
    },
    retarget(x) {
      a = { ...x };
    },
    setProfile(x) {
      i = x;
    },
    getState() {
      return o;
    },
    start() {
      s || (s = !0, f = "settle", v = null, A = null, l = null, C(), r = requestAnimationFrame(h));
    },
    startCoastThenSettle(x) {
      if (s) return;
      s = !0, f = "coast", v = x, y = 0, A = null;
      const b = Math.hypot(o.vx, o.vy), T = x.maxDistance / Math.max(x.duration, 1 / 60);
      if (b > T && b > 0) {
        const g = T / b;
        o.vx *= g, o.vy *= g;
      }
      l = null, C(), r = requestAnimationFrame((g) => {
        A = g, h(g);
      });
    },
    interrupt() {
      return s = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    cancel() {
      return s = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    stop() {
      s = !1, r !== null && cancelAnimationFrame(r), r = null;
    }
  };
}
function Jt(t) {
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
function Qt(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function ht(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function te(t, e = t.getBoundingClientRect(), n = {}) {
  const o = document.createElement("div"), a = document.createElement("div"), i = t.cloneNode(!0);
  return a.dataset.runtimeProxyScaleShell = "true", i.dataset.runtimeProxyContent = "true", Object.assign(a.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    transformOrigin: "0 0",
    pointerEvents: "none"
  }), Object.assign(i.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    margin: "0",
    pointerEvents: "none"
  }), a.appendChild(i), o.appendChild(a), o.className = "", o.style.position = "fixed", o.style.left = `${e.left}px`, o.style.top = `${e.top}px`, o.style.boxSizing = "border-box", o.style.width = `${e.width}px`, o.style.height = `${e.height}px`, o.style.margin = "0", o.style.zIndex = "2147483647", o.style.pointerEvents = "none", o.style.visibility = "visible", o.style.display = "", o.dataset.runtimeProxy = "true", o.style.transformOrigin = "50% 50%", o.style.transform = "perspective(760px) rotateX(5deg) scale(1.03)", ft && n.glass !== !1 ? It(i) : i.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", i.style.transition = "box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease", o.style.transition = "transform .15s ease", document.documentElement.appendChild(o), lt.add(o), o;
}
function je(t) {
  return t;
}
function vt(t) {
  return t.querySelector("[data-runtime-proxy-content]") ?? t;
}
function rt(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function Rt(t) {
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
function Pt(t, e) {
  const n = getComputedStyle(e), o = parseFloat(n.paddingTop) || 0, a = parseFloat(n.paddingRight) || 0, i = parseFloat(n.paddingBottom) || 0, l = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${o}px`,
    right: `${a}px`,
    bottom: `${i}px`,
    pointerEvents: "none"
  }, s = document.createElement("div");
  Object.assign(s.style, { ...l });
  const u = getComputedStyle(t);
  for (s.style.display = u.display, s.style.flexDirection = u.flexDirection, s.style.flexWrap = u.flexWrap, s.style.alignItems = u.alignItems, s.style.justifyContent = u.justifyContent, s.style.gap = u.gap; t.firstChild; ) s.appendChild(t.firstChild);
  const c = Rt(s), f = new Set(c.map(rt)), y = document.createElement("div");
  Object.assign(y.style, { ...l, pointerEvents: "" }), y.style.display = n.display, y.style.flexDirection = n.flexDirection, y.style.flexWrap = n.flexWrap, y.style.alignItems = n.alignItems, y.style.justifyContent = n.justifyContent, y.style.gap = n.gap, y.style.overflow = "hidden";
  const C = e.cloneNode(!0);
  for (C.style.visibility = "visible", C.style.display = ""; C.firstChild; ) y.appendChild(C.firstChild);
  const h = Jt(e);
  Qt(y, h);
  const v = Rt(y), A = new Set(v.map(rt)), x = v.filter((g) => !f.has(rt(g)));
  for (const g of x) g.style.opacity = "0";
  const b = c.filter((g) => !A.has(rt(g))), T = new Set(b);
  for (const g of c)
    T.has(g) || (g.style.opacity = "0");
  return t.appendChild(y), b.length > 0 && t.appendChild(s), { enteringEls: x, leavingEls: b };
}
function Ze(t, e) {
  const n = Math.max(e.left, e.right - t.width), o = Math.max(e.top, e.bottom - t.height);
  return {
    left: Math.min(Math.max(t.left, e.left), n),
    top: Math.min(Math.max(t.top, e.top), o),
    width: t.width,
    height: t.height
  };
}
function Ue(t, e, n = {}) {
  const o = n.duration ?? j.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, l = n.targetBackground, s = n.targetOpacity, u = vt(t), c = n.targetContent ? Pt(u, n.targetContent) : null;
  if (c) {
    for (const m of c.enteringEls) m.style.transition = `opacity ${o}ms ${a}`;
    for (const m of c.leavingEls) m.style.transition = `opacity ${o}ms ${a}`;
  }
  const f = parseFloat(t.style.left) || 0, y = parseFloat(t.style.top) || 0;
  let C = !1, h = e;
  const v = performance.now();
  let A = () => {
  }, x = () => {
  };
  const b = new Promise((m) => {
    x = m;
  }), T = () => {
    const m = t.getBoundingClientRect();
    return Math.abs(m.left - h.left) < 2 && Math.abs(m.top - h.top) < 2 && Math.abs(m.width - h.width) < 2 && Math.abs(m.height - h.height) < 2;
  };
  let g = null, E = null, d = 0;
  const P = 60, S = (m) => {
    C || (C = !0, t.removeEventListener("transitionend", A), E !== null && (window.clearTimeout(E), E = null), x());
  }, L = () => {
    if (!C) {
      if (T()) {
        S();
        return;
      }
      if (performance.now() - v >= o + 500) {
        S();
        return;
      }
      window.requestAnimationFrame(L);
    }
  }, N = (m, $ = o) => {
    h = m;
    const I = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${I.width.toFixed(2)}px`, t.style.height = `${I.height.toFixed(2)}px`, t.style.transform = `translate3d(${(I.left - f).toFixed(2)}px, ${(I.top - y).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const Y = `translate3d(${(m.left - f).toFixed(2)}px, ${(m.top - y).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${$}ms ${a}, width ${$}ms ${a}, height ${$}ms ${a}`, u.style.transition = [
      `box-shadow ${$}ms ease`,
      `border-radius ${$}ms ease`,
      `background-color ${$}ms ease`,
      `background-image ${$}ms ease`,
      `opacity ${$}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = Y, t.style.width = `${m.width.toFixed(2)}px`, t.style.height = `${m.height.toFixed(2)}px`, i != null && (u.style.boxShadow = i), r != null && (u.style.borderRadius = r), l != null && (u.style.backgroundColor = l, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), s != null && (u.style.opacity = s), c) {
        for (const q of c.enteringEls) q.style.opacity = "1";
        for (const q of c.leavingEls) q.style.opacity = "0";
      }
    });
  };
  A = (m) => {
    m.target !== t || !(m.propertyName === "transform" || m.propertyName === "width" || m.propertyName === "height") || T() && S(`transitionend:${m.propertyName}`);
  }, t.addEventListener("transitionend", A), N(e), window.setTimeout(L, o + 40);
  const X = (m) => {
    var I;
    d = performance.now();
    const $ = Math.max(80, o - (d - v));
    N(((I = n.readTarget) == null ? void 0 : I.call(n)) ?? m, $);
  };
  return { finished: b, retarget: (m) => {
    if (C) return;
    const $ = Math.abs(m.left - h.left), I = Math.abs(m.top - h.top), Y = Math.abs(m.width - h.width), q = Math.abs(m.height - h.height);
    if ($ < 0.5 && I < 0.5 && Y < 0.5 && q < 0.5) return;
    const G = performance.now() - d;
    if (G >= P) {
      X(m);
      return;
    }
    g = m, E === null && (E = window.setTimeout(() => {
      if (E = null, C || !g) return;
      const H = g;
      g = null, X(H);
    }, P - G));
  } };
}
function Ke(t, e, n = {}) {
  var $, I, Y, q, G, H, it, U, p, F, R, O;
  const o = n.duration ?? j.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, l = n.targetBackground, s = n.targetOpacity, u = vt(t), c = n.targetContent ? Pt(u, n.targetContent) : null;
  if (c) {
    for (const w of c.enteringEls) w.style.transition = `opacity ${o}ms ${a}`;
    for (const w of c.leavingEls) w.style.transition = `opacity ${o}ms ${a}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const f = parseFloat(t.style.left) || t.getBoundingClientRect().left, y = parseFloat(t.style.top) || t.getBoundingClientRect().top, C = t.getBoundingClientRect(), h = C.width || e.width, v = C.height || e.height, A = (w) => ({
    left: w.left - (h - w.width) / 2,
    top: w.top - (v - w.height) / 2,
    width: w.width,
    height: w.height
  });
  let x = e, b = !1, T = null, g = 0, E = () => {
  };
  const d = new Promise((w) => {
    E = w;
  }), P = () => {
    b || (b = !0, S.stop(), T !== null && window.clearTimeout(T), T = null, E());
  }, S = Et({
    mode: "settle",
    onFrame: (w) => {
      const M = h * w.scaleX, k = v * w.scaleY, D = w.x + (h - M) / 2, dt = w.y + (v - k) / 2;
      t.style.transform = `perspective(760px) translate3d(${(D - f).toFixed(2)}px, ${(dt - y).toFixed(2)}px, 0) rotateX(${w.rotateX.toFixed(2)}deg) rotateZ(${w.rotateZ.toFixed(2)}deg)`, t.style.width = `${M.toFixed(2)}px`, t.style.height = `${k.toFixed(2)}px`;
    },
    onArrived: P
  }), L = Math.hypot((($ = n.motionState) == null ? void 0 : $.vx) ?? 0, ((I = n.motionState) == null ? void 0 : I.vy) ?? 0), N = n.releaseDamping ?? 0.78;
  S.setProfile(L > 30 ? {
    ...K,
    position: {
      ...K.position,
      damping: K.position.damping * N
    }
  } : K), S.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((Y = n.motionState) == null ? void 0 : Y.x) ?? C.left,
    y: ((q = n.motionState) == null ? void 0 : q.y) ?? C.top,
    vx: ((G = n.motionState) == null ? void 0 : G.vx) ?? 0,
    vy: ((H = n.motionState) == null ? void 0 : H.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((it = n.motionState) == null ? void 0 : it.scaleX) ?? 1,
    scaleY: ((U = n.motionState) == null ? void 0 : U.scaleY) ?? 1,
    rotateX: ((p = n.motionState) == null ? void 0 : p.rotateX) ?? 0,
    rotateZ: ((F = n.motionState) == null ? void 0 : F.rotateZ) ?? 0
  });
  const X = A(e);
  S.setTarget({
    x: X.left,
    y: X.top,
    scaleX: X.width / h,
    scaleY: X.height / v
  }), t.style.transition = "", u.style.transition = [
    `box-shadow ${o}ms ${a}`,
    `border-radius ${o}ms ${a}`,
    `background-color ${o}ms ${a}`,
    `background-image ${o}ms ${a}`,
    `opacity ${o}ms ${a}`
  ].join(", "), requestAnimationFrame(() => {
    if (!b && (i != null && (u.style.boxShadow = i), r != null && (u.style.borderRadius = r), l != null && (u.style.backgroundColor = l, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), s != null && (u.style.opacity = s), c)) {
      for (const w of c.enteringEls) w.style.opacity = "1";
      for (const w of c.leavingEls) w.style.opacity = "0";
    }
  });
  const z = (w = 0) => {
    T !== null && window.clearTimeout(T), g = performance.now() + Math.max(2e3, o * 8, 5e3) + w, T = window.setTimeout(() => {
      T = null, !b && performance.now() >= g && P();
    }, Math.max(2e3, o * 8, 5e3) + w);
  };
  z();
  const m = n.coast;
  return m && m.maxDistance > 0 && Math.hypot(((R = n.motionState) == null ? void 0 : R.vx) ?? 0, ((O = n.motionState) == null ? void 0 : O.vy) ?? 0) > m.minVelocity ? S.startCoastThenSettle(m) : S.start(), {
    finished: d,
    retarget(w) {
      if (b) return;
      x = w, z(1e3);
      const M = A(x);
      S.setTarget({
        x: M.left,
        y: M.top,
        scaleX: M.width / h,
        scaleY: M.height / v
      });
    }
  };
}
function Je(t) {
  lt.has(t) && (lt.delete(t), t.remove());
}
const xt = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ new WeakMap(), Lt = /* @__PURE__ */ new WeakSet();
function ee(t, e) {
  xt.set(t, { style: t.getAttribute("style") ?? "" });
  const n = te(t, e, { glass: !1 }), o = vt(n);
  n.style.zIndex = "1000", n.style.transform = "scale(1)", n.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", Lt.add(n), st.set(t, n), t.style.visibility = "hidden", requestAnimationFrame(() => {
    n.isConnected && (ft ? It(o) : o.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transform = "scale(1.03)");
  });
}
function ne(t) {
  return st.get(t);
}
function gt(t) {
  const e = st.get(t);
  e && (Lt.delete(e), e.remove(), lt.delete(e), st.delete(t));
  const n = xt.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), xt.delete(t);
}
const lt = /* @__PURE__ */ new Set();
let ft = !1;
function Qe(t) {
  ft = t;
}
function tn() {
  return ft;
}
function It(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", t.style.boxShadow = "0 22px 50px rgba(30, 35, 60, 0.30)", t.style.opacity = "0.97";
}
const tt = /* @__PURE__ */ new Map();
function en(t, e) {
  tt.set(t, e), t.style.visibility = "hidden";
}
function nn(t, e) {
  const n = tt.get(t) === e;
  return n && (t.style.visibility = "", tt.delete(t)), n;
}
function oe(t, e) {
  tt.get(t) === e && tt.delete(t);
}
const pt = /* @__PURE__ */ new WeakMap();
function ie(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  pt.set(t, n);
  const o = () => pt.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, pt.delete(t), !0) : !1,
    isOwner: o
  };
}
const J = /* @__PURE__ */ new WeakMap(), Q = /* @__PURE__ */ new WeakMap();
function Dt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (l) => l * l * (3 - 2 * l);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((l) => !Number.isFinite(l)))
    return (l) => l * l * (3 - 2 * l);
  const [o, a, i, r] = n;
  return (l) => {
    let s = 0, u = 1;
    for (let f = 0; f < 12; f += 1) {
      const y = (s + u) / 2;
      3 * (1 - y) ** 2 * y * o + 3 * (1 - y) * y ** 2 * i + y ** 3 < l ? s = y : u = y;
    }
    const c = (s + u) / 2;
    return 3 * (1 - c) ** 2 * c * a + 3 * (1 - c) * c ** 2 * r + c ** 3;
  };
}
function St(t) {
  const e = J.get(t);
  e && (cancelAnimationFrame(e.frame), J.delete(t), t.style.transform = "");
}
function re(t, e, n, o, a, i) {
  St(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Dt(a)
  };
  J.set(t, r);
  const l = (s) => {
    if (J.get(t) !== r) return;
    const u = Math.min(1, (s - r.started) / r.duration), c = r.easing(u);
    if (t.style.transform = `translate(${(r.fromX * (1 - c)).toFixed(3)}px, ${(r.fromY * (1 - c)).toFixed(3)}px)`, u >= 1) {
      J.delete(t), t.style.transform = "", i == null || i();
      return;
    }
    r.frame = requestAnimationFrame(l);
  };
  r.frame = requestAnimationFrame(l);
}
function wt(t) {
  const e = Q.get(t);
  e && (cancelAnimationFrame(e.frame), Q.delete(t), t.style.height = "");
}
function ae(t, e, n, o, a, i) {
  wt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Dt(a)
  };
  Q.set(t, r);
  const l = (s) => {
    if (Q.get(t) !== r) return;
    const u = Math.min(1, (s - r.started) / r.duration), c = r.fromX + (r.fromY - r.fromX) * r.easing(u);
    if (t.style.height = `${c}px`, u >= 1) {
      Q.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(l);
  };
  r.frame = requestAnimationFrame(l);
}
const et = j.flip.duration, nt = j.flip.easing;
function se(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((o) => n.set(o, (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect())), n;
}
function Xt(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, St(n), n.style.setProperty("transition", "none", "important");
}
function le(t, e, n = et, o = nt, a) {
  Xt(t);
  const i = [];
  for (const r of t) {
    if (r.dataset.runtimeProxy === "true" || r.dataset.runtimePlaceholder === "true" || r.dataset.runtimeActive === "true")
      continue;
    const l = e.get(r);
    if (!l)
      continue;
    const s = (a == null ? void 0 : a.rect(r)) ?? r.getBoundingClientRect(), u = l.left - s.left, c = l.top - s.top;
    if (Math.abs(u) < 0.5 && Math.abs(c) < 0.5) {
      r.style.transition = "";
      continue;
    }
    i.push({ element: r, dx: u, dy: c });
  }
  for (const { element: r, dx: l, dy: s } of i) {
    r.style.setProperty("transition", "none", "important"), r.style.transform = `translate(${l}px, ${s}px)`;
    const u = String(Number(r.dataset.runtimeFlipToken ?? "0") + 1);
    r.dataset.runtimeFlip = "true", r.dataset.runtimeFlipToken = u, re(r, l, s, n, o, () => {
      r.dataset.runtimeFlipToken === u && (r.style.transition = "", delete r.dataset.runtimeFlip);
    });
  }
}
function Ot(t) {
  return t.dataset.layoutKey ?? t.dataset.card ?? "";
}
const at = /* @__PURE__ */ new WeakMap();
function ce(t) {
  const e = t.closest('[data-layout-open="false"]');
  return e !== null && e.dataset.runtimeGroupAnimating !== "true";
}
function Nt(t, e) {
  if (ce(t)) return null;
  const n = t.closest("[data-layout-collection]");
  if (!n) return null;
  const o = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect(), a = (e == null ? void 0 : e.rect(n)) ?? n.getBoundingClientRect();
  return o.width > 0 && o.height > 0 && a.width > 0 && o.width <= a.width * 1.25 && o.left >= a.left - 1 && o.right <= a.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function zt(t, e) {
  return !e || e.length === 0 ? !0 : e.some((n) => n === t || n.contains(t));
}
function qt(t, e, n) {
  if (!n || n.length === 0)
    return Array.from(t.querySelectorAll(e));
  const o = [], a = /* @__PURE__ */ new Set();
  for (const i of n)
    i.matches(e) && !a.has(i) && (a.add(i), o.push(i)), i.querySelectorAll(e).forEach((r) => {
      a.has(r) || (a.add(r), o.push(r));
    });
  return o;
}
function ue(t, e, n = Ot, o, a, i) {
  const r = /* @__PURE__ */ new Map(), l = qt(t, e, a).map((s) => {
    if (o != null && o(s) || !zt(s, a)) return null;
    const u = Nt(s, i);
    if (!u) return null;
    const c = n(s);
    if (!c) return null;
    const f = (i == null ? void 0 : i.rect(s)) ?? s.getBoundingClientRect();
    return r.set(c, u.collectionId), {
      key: c,
      element: s,
      rect: { left: f.left, top: f.top, width: f.width, height: f.height },
      contentHTML: s.outerHTML
    };
  }).filter((s) => s !== null);
  return { root: t, selector: e, collectionByKey: r, entries: l, ignore: o, scopeSurfaces: a };
}
function fe(t, e = {}, n) {
  const o = e.duration ?? 250, a = e.easing ?? "cubic-bezier(.22,1,.36,1)", i = e.key ?? Ot, r = /* @__PURE__ */ new Map();
  qt(t.root, t.selector, t.scopeSurfaces).filter((s) => {
    var f;
    if ((f = t.ignore) != null && f.call(t, s) || !zt(s, t.scopeSurfaces)) return !1;
    const u = Nt(s, n);
    if (!u) return !1;
    const c = i(s);
    return c ? (r.set(c, u.collectionId), !0) : !1;
  }).filter((s) => {
    const u = i(s);
    if (!u) return !1;
    const c = t.collectionByKey.get(u);
    return c === void 0 || c !== r.get(u);
  }).forEach((s) => {
    var c;
    (c = at.get(s)) == null || c.cancel();
    const u = s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o, easing: a, fill: "both" });
    at.set(s, u), u.finished.then(() => {
      at.get(s) === u && at.delete(s);
    }).catch(() => {
    });
  }), t.entries.forEach((s) => {
    if (r.has(s.key)) return;
    const u = document.createElement("template");
    u.innerHTML = s.contentHTML;
    const c = u.content.firstElementChild;
    if (!c) return;
    const f = s.rect;
    c.style.position = "fixed", c.style.left = `${f.left}px`, c.style.top = `${f.top}px`, c.style.width = `${f.width}px`, c.style.height = `${f.height}px`, c.style.margin = "0", c.style.pointerEvents = "none", c.style.zIndex = "2147483646", document.body.appendChild(c), c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o, easing: a, fill: "both" }).finished.then(() => c.remove()).catch(() => c.remove());
  });
}
function Bt() {
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
let Vt = null, Yt = !1;
const mt = /* @__PURE__ */ new WeakMap();
function on(t) {
  Vt = t;
}
function rn(t) {
  Yt = t;
}
function Wt() {
  const t = Vt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? j.flip,
    resize: (t == null ? void 0 : t.resize) ?? j.resize
  };
}
function de(t, e, n) {
  const o = (l) => !n || n.length === 0 ? !0 : n.some((s) => s === l || s.contains(l)), a = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(o), i = [], r = [];
  for (const l of t)
    o(l) && (l.closest("[data-layout-group]") !== null ? i.push(l) : r.push(l));
  return { groups: a, groupLeaves: i, flatCards: r };
}
function bt(t, e = document, n = !0, o, a = {}) {
  const i = (h) => {
    const v = a.scopeSurfaces;
    return !v || v.length === 0 ? !0 : v.some((A) => A === h || A.contains(h));
  }, r = Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i).map((h) => ({ element: h, rect: ot(h), inlineStyle: _t(h) }));
  Ht(r);
  const l = Bt(), { groups: s, groupLeaves: u, flatCards: c } = de(t, e, a.scopeSurfaces), f = ke(Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i), l), y = (a.scopeSurfaces ?? [e]).some(
    (h) => h instanceof HTMLElement ? h.matches("[data-layout-collection]") || h.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), C = {
    root: e,
    group: s.length > 0 ? { before: be([...s, ...u], l) } : void 0,
    flat: c.length > 0 ? { elements: c, before: se(c, l) } : void 0,
    surfaces: f,
    presence: n && y ? ue(e, '[data-layout-role="card"]', void 0, o, a.scopeSurfaces, l) : void 0
  };
  return xe(e, C);
}
function Ft(t) {
  const e = Bt(), n = Wt(), o = t.group ? ge(t.group.before) : null;
  t.group && Ce(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && le(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), Ae(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && fe(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), o && pe(o, n.flip.duration + 50);
}
const Z = /* @__PURE__ */ new WeakMap();
let ye = 0;
function ge(t) {
  const e = t.filter((i) => i.rect.height > 0).map((i) => ({ element: i.element, overflow: i.element.style.overflow })).filter((i) => i.element.isConnected).filter((i) => i.element.dataset.runtimeGroupAnimating !== "true").filter((i) => getComputedStyle(i.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), o = Z.get(n);
  o == null || o.entries.forEach(({ element: i, overflow: r }) => {
    i.style.overflow = r;
  }), e.forEach(({ element: i }) => {
    i.style.overflow = "visible";
  });
  const a = { token: String(++ye), entries: e };
  return Z.set(n, a), a;
}
function pe(t, e) {
  var o;
  const n = (o = t.entries[0]) == null ? void 0 : o.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var a;
    ((a = Z.get(n)) == null ? void 0 : a.token) === t.token && (t.entries.forEach(({ element: i, overflow: r }) => {
      i.style.overflow = r;
    }), Z.delete(n));
  }, e));
}
function me(t) {
  W.set(t.root, t), queueMicrotask(() => {
    W.get(t.root) === t && (W.delete(t.root), Ft(t));
  });
}
function he(t) {
  W.set(t.root, t), requestAnimationFrame(() => {
    W.get(t.root) === t && (W.delete(t.root), Ft(t));
  });
}
function xe(t, e) {
  const n = W.get(t);
  if (!n) return e;
  const o = we(e.surfaces, n.surfaces), a = ve(e.flat, n.flat), i = Se(e.group, n.group);
  return { ...e, flat: a, group: i, surfaces: o };
}
function ve(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const a = e.before.get(o);
    a && n.set(o, a);
  }
  return { ...t, before: n };
}
function Se(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function we(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const a = n.get(o.element);
    return a ? { ...o, rect: a.rect, inlineStyle: a.inlineStyle } : o;
  });
}
const W = /* @__PURE__ */ new WeakMap(), ct = /* @__PURE__ */ new WeakMap(), ut = /* @__PURE__ */ new WeakMap(), _ = /* @__PURE__ */ new WeakMap();
function ot(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function be(t, e) {
  const n = t.filter((a) => {
    const i = (e == null ? void 0 : e.rect(a)) ?? a.getBoundingClientRect();
    return i.width > 0 && i.height > 0;
  }), o = new Set(n);
  return n.map((a) => ({
    element: a,
    parent: Fe(a, o),
    rect: ot(a, e)
  }));
}
function Fe(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function Ce(t, e = et, n = nt, o) {
  Xt(t.map((i) => i.element));
  const a = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = ot(i.element, o);
    a.set(i.element, {
      x: i.rect.left - r.left,
      y: i.rect.top - r.top
    });
  }
  for (const i of t) {
    const r = a.get(i.element), l = i.parent ? a.get(i.parent) : void 0, s = r.x - ((l == null ? void 0 : l.x) ?? 0), u = r.y - ((l == null ? void 0 : l.y) ?? 0);
    if (i.element.dataset.runtimeProxy === "true" || i.element.dataset.runtimePlaceholder === "true" || i.element.dataset.runtimeActive === "true" || Math.abs(s) < 0.5 && Math.abs(u) < 0.5) {
      i.element.dataset.runtimeGroupAnimating !== "true" && (i.element.style.transition = "");
      continue;
    }
    i.element.style.transform = `translate(${s}px, ${u}px)`, i.element.style.transition = "none";
    const c = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = c;
    const f = _.get(i.element);
    f !== void 0 && (cancelAnimationFrame(f), _.delete(i.element));
    const y = requestAnimationFrame(() => {
      _.delete(i.element), i.element.dataset.runtimeFlipToken === c && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    });
    _.set(i.element, y);
    const C = window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === c && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip, ut.delete(i.element));
    }, e + 40);
    ut.set(i.element, C);
  }
}
function Me(t, e, n = et, o = nt, a) {
  Gt(t);
  const i = a ?? t.getBoundingClientRect().height, r = String(Number(t.dataset.runtimeGroupToken ?? "0") + 1);
  t.dataset.runtimeGroupToken = r;
  const l = Math.abs(Math.max(0, e) - i), u = Math.min(Math.max(l / 8, 200), 350);
  t.dataset.runtimeGroupAnimating = "true", t.style.overflow = "hidden", t.style.height = `${i}px`, t.style.transition = `height ${u}ms ${o}`, t.offsetHeight;
  const c = { frame: null, timeout: null };
  ct.set(t, c), c.frame = requestAnimationFrame(() => {
    c.frame = null, t.style.height = `${Math.max(0, e)}px`;
  }), c.timeout = window.setTimeout(() => {
    t.dataset.runtimeGroupToken === r && (e <= 0 ? (t.style.height = "0px", t.style.overflow = "hidden") : (t.style.height = "", t.style.overflow = ""), t.style.transition = "", delete t.dataset.runtimeGroupAnimating, ct.delete(t));
  }, u + 40);
}
function Gt(t) {
  const e = ct.get(t);
  e && (e.frame !== null && cancelAnimationFrame(e.frame), e.timeout !== null && window.clearTimeout(e.timeout), ct.delete(t));
}
function an(t) {
  W.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, o = Z.get(n);
  o && (o.timeout !== void 0 && window.clearTimeout(o.timeout), o.entries.forEach(({ element: i, overflow: r }) => {
    e && !t.contains(i) || (i.style.overflow = r);
  }), Z.delete(n));
  const a = [];
  t instanceof HTMLElement && a.push(t), typeof t.querySelectorAll == "function" && a.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const i of a) {
    const r = ut.get(i), l = _.get(i), s = r !== void 0 || i.dataset.runtimeFlip === "true" || i.dataset.runtimeGroupAnimating === "true" || i.dataset.runtimeSurfaceResize === "true";
    r !== void 0 && (window.clearTimeout(r), ut.delete(i)), l !== void 0 && (cancelAnimationFrame(l), _.delete(i)), St(i), wt(i), Gt(i);
    const u = V.get(i);
    u && (Ct(i, u.baseStyle), V.delete(i)), i.dataset.runtimeGroupAnimating === "true" && (i.style.height = i.dataset.layoutOpen === "false" ? "0px" : "", i.style.overflow = i.dataset.layoutOpen === "false" ? "hidden" : "", i.style.transition = ""), s && (i.style.transform = ""), i.dataset.runtimeFlip === "true" && delete i.dataset.runtimeFlip, delete i.dataset.runtimeSurfaceResize, delete i.dataset.runtimeSurfaceResizeToken, delete i.dataset.runtimeGroupAnimating;
  }
}
async function sn(t) {
  const e = (mt.get(t.content) ?? 0) + 1;
  mt.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll(".done-card-item")), o = (n.length > 0 ? n : Array.from(t.root.querySelectorAll("[data-card]"))).filter((l) => {
    const s = l.getBoundingClientRect();
    return s.width > 0 && s.height > 0;
  }), a = bt(o, t.root, !1), i = t.content.getBoundingClientRect().height, r = Yt ? Te(t.content, t.opening, t.duration, t.easing) : null;
  t.mutate(), await t.waitForLayout(), mt.get(t.content) === e && (t.isCurrent && !t.isCurrent() || (Me(t.content, t.opening ? t.content.scrollHeight : 0, t.duration, t.easing, i), r && Re(r, t.opening), Ft(a)));
}
function Te(t, e, n = et, o = nt) {
  const a = Array.from(t.querySelectorAll(".done-card-item")), i = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = i, a.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: a, token: i, duration: n };
}
function Re(t, e) {
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
function ke(t, e) {
  return t.map((n) => {
    var o;
    return {
      element: n,
      rect: ot(n, e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = V.get(n)) == null ? void 0 : o.baseStyle) ?? _t(n)
    };
  });
}
function Ae(t, e = et, n = nt, o) {
  var i;
  Ht(t);
  const a = t.filter((r) => r.element.isConnected).map((r) => {
    const l = ot(r.element, o), s = Wt();
    return {
      item: r,
      next: l,
      profile: s.resize,
      fromHeight: kt(r.element, r.rect.height),
      toHeight: kt(r.element, l.height)
    };
  }).filter(({ item: r, next: l }) => Math.abs(r.rect.height - l.height) >= 0.5);
  for (const { item: r, fromHeight: l } of a) {
    const s = r.element.style, u = {
      baseStyle: ((i = V.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++$e)
    };
    V.set(r.element, u), s.overflow = "hidden", s.transition = "none", s.height = `${l}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = u.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: l, toHeight: s, profile: u } of a) {
      const c = r.element.style, f = V.get(r.element);
      if (!f || r.element.dataset.runtimeSurfaceResizeToken !== f.token) continue;
      const y = f.token;
      c.transition = "none", ae(r.element, l, s, u.duration, u.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== y) return;
        const C = V.get(r.element);
        !C || C.token !== y || (Ct(r.element, C.baseStyle), V.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, u.duration + 40);
    }
  });
}
function Ht(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0)
    for (const { element: n } of e) {
      const o = V.get(n);
      o && (wt(n), Ct(n, o.baseStyle), V.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
}
const V = /* @__PURE__ */ new WeakMap();
let $e = 0;
function _t(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function Ct(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function kt(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
function Ee(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function Pe(t, e, n, o, a) {
  const i = o ?? e.getBoundingClientRect(), r = (a == null ? void 0 : a.align) ?? "center", l = r === "pointer" ? n.clientX - i.left : i.width / 2, s = r === "pointer" ? n.clientY - i.top : i.height / 2, u = l - ((a == null ? void 0 : a.offsetX) ?? 0), c = s - ((a == null ? void 0 : a.offsetY) ?? 0);
  return o && (t.dragOffset = { x: u, y: c }), { rect: i, offsetX: u, offsetY: c };
}
function jt(t) {
  return (e) => e === t || e.contains(t);
}
function Le(t, e, n) {
  const o = t.cloneNode(!0), a = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: bt(a, document, !0, jt(t), {
      scopeSurfaces: n == null ? void 0 : n()
    })
  };
}
function Ie(t, e, n) {
  let o = t, a = null;
  return {
    update(i, r) {
      const l = e(i);
      return l ? (n(l, a) || (o = r(l), a = l), a) : (a = null, null);
    },
    release() {
      return a;
    },
    get currentSurface() {
      return o;
    }
  };
}
function De(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function Xe(t) {
  t.event.stopPropagation(), ht(t.proxy, !1), t.clearRegrab(), oe(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden";
}
function Oe(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function Ne(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function ze(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function qe(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function Be(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function Ve(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function Ye(t, e) {
  return t() ?? e();
}
function We(t) {
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
function Ge(t, e, n) {
  let o = 0;
  return {
    capture: () => (o += 1, bt(
      e().filter((a) => a !== t && a.dataset.runtimeProxy !== "true"),
      document,
      !0,
      jt(t),
      { scopeSurfaces: n == null ? void 0 : n() }
    )),
    play: (a, i, r = !1) => {
      const l = ++o;
      if (r) {
        requestAnimationFrame(() => {
          l === o && he(i);
        });
        return;
      }
      me(i);
    }
  };
}
function ln(t) {
  var U;
  const { runtime: e, objectId: n, element: o, event: a, fromRect: i } = t, r = e.objects.get(n), l = e.surfaces.snapshot(), s = l.map((p) => p.id), u = (p) => {
    var F;
    return (F = e.objects.get(p)) == null ? void 0 : F.surfaceId;
  }, c = (r == null ? void 0 : r.surfaceId) ?? ((U = l[0]) == null ? void 0 : U.id), f = () => {
    const p = [...e.objects.values()].map((R) => R.element).filter((R) => !!(R != null && R.isConnected)), F = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...p, ...F]));
  };
  let y, C, h, v = null, A = null, x = null, b = null, T = !1, g = null, E = null, d = null, P = null, S = null, L, N = { x: 0, y: 0 }, X = null, z = !1;
  const m = () => {
    const p = /* @__PURE__ */ new Set();
    return c && p.add(c), v != null && v.columnId && p.add(v.columnId), e.surfaces.snapshot().filter((F) => p.has(F.id)).map((F) => F.element).filter((F) => !!(F != null && F.isConnected));
  };
  function $() {
    var p;
    return g ? (p = e.getSession(g)) == null ? void 0 : p.state : void 0;
  }
  function I(p, F) {
    if ($() !== "active" || !h) return;
    const R = De({
      active: $() === "active",
      event: { clientX: p, clientY: F },
      state: h,
      getSurface: (O) => O.columnId
    });
    R && (v = R);
  }
  function Y(p) {
    z = !0, S == null || S.setTarget({
      x: p.clientX - N.x,
      y: p.clientY - N.y
    }), I(p.clientX, p.clientY), P == null || P.update(
      e.resolveMoveSurfaceElement(n, p.clientX, p.clientY),
      { x: p.clientX, y: p.clientY }
    );
  }
  function q(p) {
    if (T) return { accepted: !1 };
    if (T = !0, L = S ? { ...S.getState() } : void 0, L) {
      const M = $t({ x: L.vx, y: L.vy });
      L.vx = M.x, L.vy = M.y;
    }
    if (S == null || S.stop(), S = null, P == null || P.stop(), !h || !g) return { accepted: !1 };
    p && I(p.clientX, p.clientY), v = h.release(), !v && !z && L && Math.hypot(L.vx, L.vy) < 0.5 && c && (v = {
      columnId: c,
      index: X ?? Math.max(0, e.getObjectSurfaceIndex(n, c))
    });
    const F = !v;
    if (F && c && (v = {
      columnId: c,
      index: X ?? Math.max(0, e.getObjectSurfaceIndex(n, c))
    }), !v) return { accepted: !1 };
    const R = v, O = (b == null ? void 0 : b.getBoundingClientRect()) ?? o.getBoundingClientRect();
    d == null || d.restoreLayoutHidden(), delete o.dataset.runtimeActive, F && (E == null || E.release());
    const w = (M, k) => {
      if ($() !== "landing") return;
      const D = Ne({
        resolve: () => k,
        applyState: (B) => e.applyVisualState(n, B, { phase: "revealing", hovered: !1, selected: B.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!D) {
        x == null || x.complete({ completed: !1, reason: "target-not-registered" }), x = null;
        return;
      }
      e.keepSurfaceTargetVisible(R.columnId, D);
      const dt = ze((B) => e.captureVisualState(n, B), D), yt = qe({
        createContext: () => e.createVisualLifecycleContext(M, R, D, y),
        source: o,
        sourceRect: O,
        visualSnapshot: C,
        targetSnapshot: dt,
        motionState: L
      });
      b = Be({
        // 抓取阶段没有 proxy（源节点自己飞），这里现建；getVisualProxy 兜底只是防御
        // regrab 等场景下 proxy 已经存在的情况，不是复用 prepare 阶段建的实例。
        createProxy: () => e.getVisualProxy(M) ?? e.createVisualProxy(M, yt) ?? null,
        enableProxy: (B) => ht(B, !0),
        bindRegrab: (B) => e.bindRegrabTarget(M, n, B, G),
        land: () => e.landVisualProxy(M, D, yt),
        onMissing: () => {
          x == null || x.complete({ completed: !1, reason: "visual-proxy-missing" }), x = null;
        },
        onComplete: (B) => {
          Ve({
            active: $() === "landing",
            result: B,
            complete: (Zt) => x == null ? void 0 : x.complete(Zt),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(M, D, yt).then(() => {
              b && (e.disposeVisualProxy(M), b = null);
            })
          }), x = null;
        }
      });
    };
    return A = Oe(() => {
    }, () => {
      const M = g;
      e.resolveLandingTarget(M, R).then((k) => w(M, k));
    }), { accepted: !0, destination: v, ...F ? { emitAction: !1 } : {} };
  }
  function G(p) {
    if ($() !== "landing") return;
    const F = b;
    if (!F || !g) return;
    const R = Ye(
      () => e.resolveVisualTarget(g, v),
      () => {
        var M;
        return ((M = e.objects.get(n)) == null ? void 0 : M.element) ?? null;
      }
    );
    if (!R) return;
    const O = e.createRegrabContext(g, p, F, R);
    if (!O) return;
    Xe({
      event: O.event,
      sessionId: g,
      proxy: F,
      source: R,
      interrupt: () => e.takeoverRegrab(g),
      clearRegrab: () => e.clearRegrab(n)
    });
    const w = R.getBoundingClientRect();
    e.startObjectPointer(n, R, p, O.regrabRect, w);
  }
  const H = {
    prepare(p) {
      if (g = p.session.id, z = !1, P = e.createAutoScroller(g, {
        onScroll: (k) => I(k.x, k.y)
      }), p.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", E = e.acquireObject(g, n), e.takeSurfaces(g, s);
      const { beforePickup: F } = Le(o, f, m);
      X = e.getObjectSurfaceIndex(n, c), y = o.cloneNode(!0);
      const R = e.getMoveContext(g), O = Pe(R, o, a, i, e.getObjectGrabAlign(n)), w = O.rect;
      N = { x: O.offsetX, y: O.offsetY }, e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), C = Ee((k, D) => e.captureVisualState(n, D), n, o), d = ie(o, g), ee(o, w), o.style.transition = "none", e.scheduleLayout(F), o.dataset.runtimeActive = "true";
      const M = ne(o);
      S = Et({
        mode: "follow",
        followRotation: Tt,
        onFrame: (k) => {
          M.isConnected && (M.style.left = `${k.x}px`, M.style.top = `${k.y}px`, M.style.transform = `perspective(760px) rotateX(${k.rotateX.toFixed(2)}deg) rotateZ(${k.rotateZ.toFixed(2)}deg) scale(${k.scaleX.toFixed(4)}, ${k.scaleY.toFixed(4)})`);
        }
      }), S.setProfile(Ut), S.seed({ x: w.left, y: w.top, scaleX: 1.03, scaleY: 1.03, rotateX: Tt.tilt, rotateZ: 0 }), S.setTarget({ x: a.clientX - N.x, y: a.clientY - N.y }), S.start(), h = Ie(
        u(n),
        (k) => e.resolveMoveHit(n, k.clientX, k.clientY),
        (k, D) => k.columnId === (D == null ? void 0 : D.columnId) && k.index === (D == null ? void 0 : D.index)
      ), I(a.clientX, a.clientY);
    },
    update(p, F) {
      F.event instanceof PointerEvent && Y(F.event);
    },
    resolveDestination(p, F) {
      return q(F.event instanceof PointerEvent ? F.event : void 0);
    },
    commit: () => {
      gt(o), d == null || d.restoreLayoutHidden(), document.body.classList.remove("kb-dragging");
    },
    cancel(p, F) {
      T = !0, S == null || S.stop(), S = null, b && (e.disposeVisualProxy(g), b = null), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, gt(o), d == null || d.restore(), d = null;
    }
  }, it = {
    layout: Ge(o, f, m),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => E == null ? void 0 : E.release()
    },
    ...We({
      createGate: () => e.createCompletionGate(g, { completed: !1, reason: "landing-cancelled" }),
      onGate: (p) => {
        x = p;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        A == null || A(), A = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        b && ht(b, !1), gt(o), d == null || d.restore(), d = null;
      }
    })
  };
  return { driver: H, lifecycle: it };
}
export {
  Ze as A,
  He as B,
  on as C,
  At as D,
  Qe as E,
  Ut as F,
  he as G,
  me as H,
  K as L,
  Tt as a,
  ie as b,
  an as c,
  ue as d,
  bt as e,
  _e as f,
  Et as g,
  ln as h,
  Mt as i,
  Ft as j,
  $t as k,
  te as l,
  vt as m,
  je as n,
  en as o,
  fe as p,
  Ue as q,
  sn as r,
  rn as s,
  Me as t,
  Ke as u,
  j as v,
  nn as w,
  Je as x,
  tn as y,
  It as z
};
