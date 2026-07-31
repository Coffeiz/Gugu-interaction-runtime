const W = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 250 }
}, yt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, ge = 8;
function pt(t, e = yt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, i = t.y * e.velocityScale, r = Math.hypot(o, i);
  if (r <= e.maxVelocity || r === 0) return { x: o, y: i };
  const a = e.maxVelocity / r;
  return { x: o * a, y: i * a };
}
function he(t, e = yt) {
  const n = pt(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const i = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * i, y: n.y * e.coastSeconds * i };
}
function ot(t, e, n, o, i, r = 1 / 120) {
  let a = Math.max(0, i);
  for (; a > 1e-4; ) {
    const s = Math.min(a, r);
    a -= s;
    const l = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += c * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const U = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Et = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, Lt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Xt = { position: 0.35, velocity: 5 };
function gt(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? Xt, o = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    scaleX: 1,
    scaleY: 1,
    scaleVX: 0,
    scaleVY: 0,
    rotateX: 0,
    rotateZ: 0,
    rotateVX: 0,
    rotateVZ: 0
  };
  let i = { x: 0, y: 0 }, r = U, a = null, s = null, l = !1, c = 0, v = 0, y = "settle", d = 0;
  function R() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function $(g) {
    var F;
    if (!l) return;
    const h = Math.min(0.032, s == null ? 1 / 60 : Math.max(0, (g - s) / 1e3));
    if (s = g, y === "coast") {
      const p = Math.exp(-w.friction * h);
      o.vx *= p, o.vy *= p;
      const S = o.vx * h, E = o.vy * h, b = d + Math.hypot(S, E);
      if (b >= w.maxDistance) {
        const T = Math.max(0, w.maxDistance - d), I = Math.hypot(S, E), u = I > 0 ? T / I : 0;
        o.x += S * u, o.y += E * u, o.vx = 0, o.vy = 0, y = "settle";
      } else
        o.x += S, o.y += E, d = b, ((g - (M ?? g)) / 1e3 >= w.duration || Math.hypot(o.vx, o.vy) <= w.minVelocity) && (y = "settle");
    }
    if (y === "settle") {
      const p = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      ot(p, { x: i.x, y: i.y }, r.position.stiffness, r.position.damping, h), o.x = p.position.x, o.y = p.position.y, o.vx = p.velocity.x, o.vy = p.velocity.y;
    }
    const f = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (ot(f, { x: i.scaleX ?? o.scaleX, y: i.scaleY ?? o.scaleY }, r.scale.stiffness, r.scale.damping, h), o.scaleX = f.position.x, o.scaleY = f.position.y, o.scaleVX = f.velocity.x, o.scaleVY = f.velocity.y, e === "follow") {
      const p = t.followRotation, S = -Math.log(1 - (p.smoothing ?? 0.2)) * 60, E = 1 - Math.exp(-S * h), b = c, T = v;
      c += (o.vx - c) * E, v += (o.vy - v) * E;
      const I = 0.025;
      o.rotateVZ += (b - c) * I, o.rotateVX += (T - v) * I * 0.7;
      const u = Math.max(-(p.maxSway ?? 5), Math.min(p.maxSway ?? 5, c / 60 * p.sway)), A = Math.max(-(p.maxTiltDelta ?? 4), Math.min(p.maxTiltDelta ?? 4, v / 60 * (p.verticalTiltFactor ?? 0.16))), L = p.tilt + A, k = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      ot(k, { x: L, y: u }, 150, 2 * 0.72 * Math.sqrt(150), h), o.rotateX = k.position.x, o.rotateZ = k.position.y, o.rotateVX = k.velocity.x, o.rotateVZ = k.velocity.y;
    } else {
      const p = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      ot(p, { x: 0, y: 0 }, 150, 2 * 0.82 * Math.sqrt(150), h), o.rotateX = p.position.x, o.rotateZ = p.position.y, o.rotateVX = p.velocity.x, o.rotateVZ = p.velocity.y;
    }
    if (R(), e === "follow") {
      a = requestAnimationFrame($);
      return;
    }
    if (y === "settle" && Math.abs(i.x - o.x) < n.position && Math.abs(i.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      l = !1, a = null, (F = t.onArrived) == null || F.call(t);
      return;
    }
    a = requestAnimationFrame($);
  }
  let w = null, M = null;
  return {
    seed(g) {
      Object.assign(o, g);
    },
    setTarget(g) {
      i = { ...g };
    },
    retarget(g) {
      i = { ...g };
    },
    setProfile(g) {
      r = g;
    },
    getState() {
      return o;
    },
    start() {
      l || (l = !0, y = "settle", w = null, M = null, s = null, R(), a = requestAnimationFrame($));
    },
    startCoastThenSettle(g) {
      if (l) return;
      l = !0, y = "coast", w = g, d = 0, M = null;
      const h = Math.hypot(o.vx, o.vy), f = g.maxDistance / Math.max(g.duration, 1 / 60);
      if (h > f && h > 0) {
        const X = f / h;
        o.vx *= X, o.vy *= X;
      }
      s = null, R(), a = requestAnimationFrame((X) => {
        M = X, $(X);
      });
    },
    interrupt() {
      return l = !1, a !== null && cancelAnimationFrame(a), a = null, { ...o };
    },
    cancel() {
      return l = !1, a !== null && cancelAnimationFrame(a), a = null, { ...o };
    },
    stop() {
      l = !1, a !== null && cancelAnimationFrame(a), a = null;
    }
  };
}
let q = null;
function Vt(t) {
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
function kt(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Pt() {
  return (!q || !q.isConnected) && (q = document.createElement("div"), q.dataset.runtimeOverlay = "true", Object.assign(q.style, {
    position: "fixed",
    inset: "0",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "2147483647"
  }), new MutationObserver((t) => {
    for (const e of t)
      for (const n of Array.from(e.removedNodes))
        n instanceof HTMLElement && n.dataset.runtimeProxy;
  }).observe(q, { childList: !0 })), q.parentElement !== document.documentElement && document.documentElement.appendChild(q), q;
}
function st(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function xe(t, e = t.getBoundingClientRect()) {
  const n = t.cloneNode(!0);
  return n.classList.remove("kb-card-dragging-source"), n.style.position = "fixed", n.style.left = `${e.left}px`, n.style.top = `${e.top}px`, n.style.boxSizing = "border-box", n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.margin = "0", n.style.zIndex = "1", n.style.pointerEvents = "none", n.style.visibility = "visible", n.style.display = "block", n.dataset.runtimeProxy = "true", n.style.transformOrigin = "0 0", n.style.transform = "scale(1.03)", n.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transition = "transform .15s ease, box-shadow .15s ease", Pt().appendChild(n), lt.add(n), n;
}
function it(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function ft(t) {
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
function ht(t, e) {
  const n = getComputedStyle(e), o = parseFloat(n.paddingTop) || 0, i = parseFloat(n.paddingRight) || 0, r = parseFloat(n.paddingBottom) || 0, s = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${o}px`,
    right: `${i}px`,
    bottom: `${r}px`,
    pointerEvents: "none"
  }, l = document.createElement("div");
  for (Object.assign(l.style, { ...s }); t.firstChild; ) l.appendChild(t.firstChild);
  const c = ft(l), v = new Set(c.map(it)), y = document.createElement("div");
  Object.assign(y.style, { ...s, pointerEvents: "" });
  const d = e.cloneNode(!0);
  for (d.style.visibility = "visible", d.style.display = ""; d.firstChild; ) y.appendChild(d.firstChild);
  const R = Vt(e);
  kt(y, R);
  const $ = ft(y), w = new Set($.map(it)), M = $.filter((f) => !v.has(it(f)));
  for (const f of M) f.style.opacity = "0";
  const g = c.filter((f) => !w.has(it(f))), h = new Set(g);
  for (const f of c)
    h.has(f) || (f.style.opacity = "0");
  return t.appendChild(y), g.length > 0 && t.appendChild(l), { enteringEls: M, leavingEls: g };
}
function ve(t, e, n = {}) {
  const o = n.duration ?? W.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, l = n.targetOpacity, c = n.targetContent ? ht(t, n.targetContent) : null;
  if (c) {
    for (const u of c.enteringEls) u.style.transition = `opacity ${o}ms ${i}`;
    for (const u of c.leavingEls) u.style.transition = `opacity ${o}ms ${i}`;
  }
  const v = parseFloat(t.style.left) || 0, y = parseFloat(t.style.top) || 0;
  let d = !1, R = e;
  const $ = performance.now();
  let w = () => {
  }, M = () => {
  };
  const g = new Promise((u) => {
    M = u;
  }), h = () => {
    const u = t.getBoundingClientRect();
    return Math.abs(u.left - R.left) < 2 && Math.abs(u.top - R.top) < 2 && Math.abs(u.width - R.width) < 2 && Math.abs(u.height - R.height) < 2;
  };
  let f = null, X = null, F = 0;
  const p = 60, S = (u) => {
    d || (d = !0, t.removeEventListener("transitionend", w), X !== null && (window.clearTimeout(X), X = null), M());
  }, E = () => {
    if (!d) {
      if (h()) {
        S();
        return;
      }
      if (performance.now() - $ >= o + 500) {
        S();
        return;
      }
      window.requestAnimationFrame(E);
    }
  }, b = (u, A = o) => {
    R = u;
    const L = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${L.width.toFixed(2)}px`, t.style.height = `${L.height.toFixed(2)}px`, t.style.transform = `translate3d(${(L.left - v).toFixed(2)}px, ${(L.top - y).toFixed(2)}px, 0)`, t.offsetWidth;
    const k = `translate3d(${(u.left - v).toFixed(2)}px, ${(u.top - y).toFixed(2)}px, 0)`;
    t.style.transition = [
      `transform ${A}ms ${i}`,
      `width ${A}ms ${i}`,
      `height ${A}ms ${i}`,
      `box-shadow ${A}ms ease`,
      `border-radius ${A}ms ease`,
      `background-color ${A}ms ease`,
      `opacity ${A}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = k, t.style.width = `${u.width.toFixed(2)}px`, t.style.height = `${u.height.toFixed(2)}px`, r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.background = s), l != null && (t.style.opacity = l), c) {
        for (const z of c.enteringEls) z.style.opacity = "1";
        for (const z of c.leavingEls) z.style.opacity = "0";
      }
    });
  };
  w = (u) => {
    u.target !== t || !(u.propertyName === "transform" || u.propertyName === "width" || u.propertyName === "height") || h() && S(`transitionend:${u.propertyName}`);
  }, t.addEventListener("transitionend", w), b(e), window.setTimeout(E, o + 40);
  const T = (u) => {
    var L;
    F = performance.now();
    const A = Math.max(80, o - (F - $));
    b(((L = n.readTarget) == null ? void 0 : L.call(n)) ?? u, A);
  };
  return { finished: g, retarget: (u) => {
    if (d) return;
    const A = Math.abs(u.left - R.left), L = Math.abs(u.top - R.top), k = Math.abs(u.width - R.width), z = Math.abs(u.height - R.height);
    if (A < 0.5 && L < 0.5 && k < 0.5 && z < 0.5) return;
    const Z = performance.now() - F;
    if (Z >= p) {
      T(u);
      return;
    }
    f = u, X === null && (X = window.setTimeout(() => {
      if (X = null, d || !f) return;
      const _ = f;
      f = null, T(_);
    }, p - Z));
  } };
}
function Se(t, e, n = {}) {
  var I, u, A, L, k, z, Z, _, et, nt, j, m, C, P;
  const o = n.duration ?? W.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, l = n.targetOpacity, c = n.targetContent ? ht(t, n.targetContent) : null;
  if (c) {
    for (const x of c.enteringEls) x.style.transition = `opacity ${o}ms ${i}`;
    for (const x of c.leavingEls) x.style.transition = `opacity ${o}ms ${i}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "none");
  const v = parseFloat(t.style.left) || t.getBoundingClientRect().left, y = parseFloat(t.style.top) || t.getBoundingClientRect().top, d = t.getBoundingClientRect(), R = d.width || e.width, $ = d.height || e.height;
  let w = e, M = !1, g = null, h = 0, f = () => {
  };
  const X = new Promise((x) => {
    f = x;
  }), F = () => {
    M || (M = !0, p.stop(), g !== null && window.clearTimeout(g), g = null, f());
  }, p = gt({
    mode: "settle",
    onFrame: (x) => {
      t.style.transform = `perspective(760px) translate3d(${(x.x - v).toFixed(2)}px, ${(x.y - y).toFixed(2)}px, 0) rotateX(${x.rotateX.toFixed(2)}deg) rotateZ(${x.rotateZ.toFixed(2)}deg)`, t.style.width = `${(R * x.scaleX).toFixed(2)}px`, t.style.height = `${($ * x.scaleY).toFixed(2)}px`;
    },
    onArrived: F
  }), S = Math.hypot(((I = n.motionState) == null ? void 0 : I.vx) ?? 0, ((u = n.motionState) == null ? void 0 : u.vy) ?? 0), E = n.releaseDamping ?? 0.78;
  p.setProfile(S > 30 ? {
    ...U,
    position: {
      ...U.position,
      damping: U.position.damping * E
    }
  } : U), p.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((A = n.motionState) == null ? void 0 : A.x) ?? d.left,
    y: ((L = n.motionState) == null ? void 0 : L.y) ?? d.top,
    vx: ((k = n.motionState) == null ? void 0 : k.vx) ?? 0,
    vy: ((z = n.motionState) == null ? void 0 : z.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((Z = n.motionState) == null ? void 0 : Z.scaleX) ?? 1,
    scaleY: ((_ = n.motionState) == null ? void 0 : _.scaleY) ?? 1,
    rotateX: ((et = n.motionState) == null ? void 0 : et.rotateX) ?? 0,
    rotateZ: ((nt = n.motionState) == null ? void 0 : nt.rotateZ) ?? 0,
    rotateVX: ((j = n.motionState) == null ? void 0 : j.rotateVX) ?? 0,
    rotateVZ: ((m = n.motionState) == null ? void 0 : m.rotateVZ) ?? 0
  }), p.setTarget({
    x: e.left,
    y: e.top,
    scaleX: e.width / R,
    scaleY: e.height / $
  }), t.style.transition = [
    `box-shadow ${o}ms ${i}`,
    `border-radius ${o}ms ${i}`,
    `background-color ${o}ms ${i}`,
    `opacity ${o}ms ${i}`
  ].join(", "), requestAnimationFrame(() => {
    if (!M && (r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.background = s), l != null && (t.style.opacity = l), c)) {
      for (const x of c.enteringEls) x.style.opacity = "1";
      for (const x of c.leavingEls) x.style.opacity = "0";
    }
  });
  const b = (x = 0) => {
    g !== null && window.clearTimeout(g), h = performance.now() + Math.max(2e3, o * 8, 5e3) + x, g = window.setTimeout(() => {
      g = null, !M && performance.now() >= h && F();
    }, Math.max(2e3, o * 8, 5e3) + x);
  };
  b();
  const T = n.coast;
  return T && T.maxDistance > 0 && Math.hypot(((C = n.motionState) == null ? void 0 : C.vx) ?? 0, ((P = n.motionState) == null ? void 0 : P.vy) ?? 0) > T.minVelocity ? p.startCoastThenSettle(T) : p.start(), {
    finished: X,
    retarget(x) {
      M || (w = x, b(1e3), p.setTarget({
        x: w.left,
        y: w.top,
        scaleX: w.width / R,
        scaleY: w.height / $
      }));
    }
  };
}
function be(t) {
  lt.has(t) && (lt.delete(t), t.remove());
}
const lt = /* @__PURE__ */ new Set(), Q = /* @__PURE__ */ new Map();
function we(t, e) {
  Q.set(t, e), t.style.visibility = "hidden";
}
function Fe(t, e) {
  const n = Q.get(t) === e;
  return n && (t.style.visibility = "", Q.delete(t)), n;
}
function Ot(t, e) {
  Q.get(t) === e && Q.delete(t);
}
function It(t, e = {}) {
  const n = e.edgeSize ?? 48, o = e.maxSpeed ?? 16;
  let i = null, r = null, a = null, s = !1;
  const l = (y) => {
    const d = (n - y) / n;
    return Math.ceil(o * d);
  }, c = () => {
    var $, w;
    if (s || (a = requestAnimationFrame(c), !i || !r || !i.isConnected)) return;
    const y = i.getBoundingClientRect();
    if (r.x < y.left || r.x > y.right) return;
    const d = r.y - y.top, R = y.bottom - r.y;
    d < n ? (i.scrollTop -= l(d), ($ = e.onScroll) == null || $.call(e, r)) : R < n && (i.scrollTop += l(R), (w = e.onScroll) == null || w.call(e, r));
  }, v = () => {
    s || (s = !0, a !== null && cancelAnimationFrame(a), a = null);
  };
  return a = requestAnimationFrame(c), t.track(v), {
    update(y, d) {
      s || (i = y, r = d);
    },
    stop: v
  };
}
const J = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap();
function xt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [o, i, r, a] = n;
  return (s) => {
    let l = 0, c = 1;
    for (let y = 0; y < 12; y += 1) {
      const d = (l + c) / 2;
      3 * (1 - d) ** 2 * d * o + 3 * (1 - d) * d ** 2 * r + d ** 3 < s ? l = d : c = d;
    }
    const v = (l + c) / 2;
    return 3 * (1 - v) ** 2 * v * i + 3 * (1 - v) * v ** 2 * a + v ** 3;
  };
}
function vt(t) {
  const e = J.get(t);
  e && (cancelAnimationFrame(e.frame), J.delete(t), t.style.transform = "");
}
function Dt(t, e, n, o, i, r) {
  vt(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: xt(i)
  };
  J.set(t, a);
  const s = (l) => {
    if (J.get(t) !== a) return;
    const c = Math.min(1, (l - a.started) / a.duration), v = a.easing(c);
    if (t.style.transform = `translate(${(a.fromX * (1 - v)).toFixed(3)}px, ${(a.fromY * (1 - v)).toFixed(3)}px)`, c >= 1) {
      J.delete(t), t.style.transform = "", r == null || r();
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
function St(t) {
  const e = K.get(t);
  e && (cancelAnimationFrame(e.frame), K.delete(t), t.style.height = "");
}
function Nt(t, e, n, o, i, r) {
  St(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: xt(i)
  };
  K.set(t, a);
  const s = (l) => {
    if (K.get(t) !== a) return;
    const c = Math.min(1, (l - a.started) / a.duration), v = a.fromX + (a.fromY - a.fromX) * a.easing(c);
    if (t.style.height = `${v}px`, c >= 1) {
      K.delete(t);
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
const ct = W.flip.duration, ut = W.flip.easing;
function zt(t) {
  const e = /* @__PURE__ */ new Map();
  return t.forEach((n) => e.set(n, n.getBoundingClientRect())), e;
}
function bt(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0) {
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, vt(n), n.style.setProperty("transition", "none", "important");
    e[0].offsetHeight;
  }
}
function Yt(t, e, n = ct, o = ut) {
  bt(t);
  for (const i of t) {
    if (i.dataset.runtimeProxy === "true" || i.dataset.runtimePlaceholder === "true" || i.dataset.runtimeActive === "true") continue;
    const r = e.get(i);
    if (!r) continue;
    const a = i.getBoundingClientRect(), s = r.left - a.left, l = r.top - a.top;
    if (Math.abs(s) < 0.5 && Math.abs(l) < 0.5) {
      i.style.transition = "";
      continue;
    }
    i.style.setProperty("transition", "none", "important"), i.style.transform = `translate(${s}px, ${l}px)`;
    const c = String(Number(i.dataset.runtimeFlipToken ?? "0") + 1);
    i.dataset.runtimeFlip = "true", i.dataset.runtimeFlipToken = c, i.offsetHeight, Dt(i, s, l, n, o, () => {
      i.dataset.runtimeFlipToken === c && (i.style.transition = "", delete i.dataset.runtimeFlip);
    });
  }
}
let wt = null;
function Re(t) {
  wt = t;
}
function Ft() {
  const t = wt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? W.flip,
    resize: (t == null ? void 0 : t.resize) ?? W.resize
  };
}
function qt(t, e) {
  const n = Array.from(e.querySelectorAll("[data-layout-group]")), o = [], i = [];
  for (const r of t)
    r.closest("[data-layout-group]") !== null ? o.push(r) : i.push(r);
  return { groups: n, groupLeaves: o, flatCards: i };
}
function Rt(t, e = document) {
  const n = Array.from(e.querySelectorAll("[data-layout-surface]")).map((l) => ({ element: l, rect: tt(l), inlineStyle: Ct(l) }));
  Tt(n);
  const { groups: o, groupLeaves: i, flatCards: r } = qt(t, e), a = Jt(Array.from(e.querySelectorAll("[data-layout-surface]"))), s = {
    root: e,
    group: o.length > 0 ? { before: jt([...o, ...i]) } : void 0,
    flat: r.length > 0 ? { elements: r, before: zt(r) } : void 0,
    surfaces: a
  };
  return Zt(e, s);
}
function Bt(t) {
  const e = Ft();
  t.group && Ut(t.group.before, e.flip.duration, e.flip.easing), t.flat && Yt(t.flat.elements, t.flat.before, e.flip.duration, e.flip.easing), Kt(t.surfaces, e.resize.duration, e.resize.easing);
}
function Mt(t) {
  rt.set(t.root, t), requestAnimationFrame(() => {
    rt.get(t.root) === t && (rt.delete(t.root), Bt(t));
  });
}
function Zt(t, e) {
  const n = rt.get(t);
  if (!n) return e;
  const o = Wt(e.surfaces, n.surfaces), i = _t(e.flat, n.flat), r = Ht(e.group, n.group);
  return { ...e, flat: i, group: r, surfaces: o };
}
function _t(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const i = e.before.get(o);
    i && n.set(o, i);
  }
  return { ...t, before: n };
}
function Ht(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function Wt(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const i = n.get(o.element);
    return i ? { ...o, rect: i.rect, inlineStyle: i.inlineStyle } : o;
  });
}
const rt = /* @__PURE__ */ new WeakMap();
function tt(t) {
  const e = t.getBoundingClientRect();
  return { top: e.top, left: e.left, width: e.width, height: e.height };
}
function jt(t) {
  const e = new Set(t);
  return t.map((n) => ({
    element: n,
    parent: Gt(n, e),
    rect: tt(n)
  }));
}
function Gt(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function Ut(t, e = ct, n = ut) {
  bt(t.map((i) => i.element));
  const o = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = tt(i.element);
    o.set(i.element, {
      x: i.rect.left - r.left,
      y: i.rect.top - r.top
    });
  }
  for (const i of t) {
    const r = o.get(i.element), a = i.parent ? o.get(i.parent) : void 0, s = r.x - ((a == null ? void 0 : a.x) ?? 0), l = r.y - ((a == null ? void 0 : a.y) ?? 0);
    if (i.element.dataset.runtimeProxy === "true" || i.element.dataset.runtimePlaceholder === "true" || i.element.dataset.runtimeActive === "true" || Math.abs(s) < 0.5 && Math.abs(l) < 0.5) {
      i.element.style.transition = "";
      continue;
    }
    i.element.style.transform = `translate(${s}px, ${l}px)`, i.element.style.transition = "none";
    const c = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = c, requestAnimationFrame(() => {
      i.element.dataset.runtimeFlipToken === c && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    }), window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === c && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip);
    }, e + 40);
  }
}
function Jt(t) {
  return t.map((e) => {
    var n;
    return {
      element: e,
      rect: tt(e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((n = B.get(e)) == null ? void 0 : n.baseStyle) ?? Ct(e)
    };
  });
}
function Kt(t, e = ct, n = ut) {
  var i;
  Tt(t);
  const o = t.filter((r) => r.element.isConnected).map((r) => {
    const a = tt(r.element);
    r.element.dataset.surfaceType;
    const s = Ft();
    return {
      item: r,
      next: a,
      profile: s.resize,
      fromHeight: dt(r.element, r.rect.height),
      toHeight: dt(r.element, a.height)
    };
  }).filter(({ item: r, next: a }) => Math.abs(r.rect.height - a.height) >= 0.5);
  for (const { item: r, fromHeight: a } of o) {
    const s = r.element.style, l = {
      baseStyle: ((i = B.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++Qt)
    };
    B.set(r.element, l), s.overflow = "hidden", s.transition = "none", s.height = `${a}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = l.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: a, toHeight: s, profile: l } of o) {
      const c = r.element.style, v = B.get(r.element);
      if (!v || r.element.dataset.runtimeSurfaceResizeToken !== v.token) continue;
      const y = v.token;
      c.transition = "none", Nt(r.element, a, s, l.duration, l.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== y) return;
        const d = B.get(r.element);
        !d || d.token !== y || ($t(r.element, d.baseStyle), B.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, l.duration + 40);
    }
  });
}
function Tt(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0) {
    for (const { element: n } of e) {
      const o = B.get(n);
      o && (St(n), $t(n, o.baseStyle), B.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
    e[0].element.offsetHeight;
  }
}
const B = /* @__PURE__ */ new WeakMap();
let Qt = 0;
function Ct(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function $t(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function dt(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
const at = /* @__PURE__ */ new WeakMap();
function te(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  at.set(t, n);
  const o = () => at.get(t) === n, i = (r) => o() ? (r(), !0) : !1;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => i(() => {
      t.style.display = "none", t.style.pointerEvents = "none";
    }),
    restoreLayoutHidden: () => i(() => {
      t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none";
    }),
    restore: () => i(() => {
      t.style.cssText = n.cssText, at.delete(t);
    }),
    isOwner: o
  };
}
function ee(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function ne(t, e, n, o) {
  const i = o ?? e.getBoundingClientRect(), r = o ? n.clientX - i.left : t.dragOffset.x, a = o ? n.clientY - i.top : t.dragOffset.y;
  return o && (t.dragOffset = { x: r, y: a }), { rect: i, offsetX: r, offsetY: a };
}
function oe(t, e) {
  const n = t.cloneNode(!0), o = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return { beforeContent: n, beforePickup: Rt(o) };
}
function ie(t, e, n) {
  let o = t, i = null;
  return {
    update(r, a) {
      const s = e(r);
      return s ? (n(s, i) || (o = a(s), i = s), i) : (i = null, null);
    },
    release() {
      return i;
    },
    get currentSurface() {
      return o;
    }
  };
}
function re(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function ae(t) {
  t.event.stopPropagation(), st(t.proxy, !1), t.clearRegrab(), Ot(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden", t.disposeProxy();
}
function se(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function le(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function ce(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function mt(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function ue(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function fe(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function de(t, e) {
  return t() ?? e();
}
function me(t) {
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
function ye(t, e) {
  let n = 0;
  return {
    capture: () => (n += 1, Rt(
      e().filter((o) => o !== t && o.dataset.runtimeProxy !== "true")
    )),
    play: (o, i) => {
      const r = ++n;
      requestAnimationFrame(() => {
        r === n && Mt(i);
      });
    }
  };
}
function pe(t, e) {
  const n = t.getBoundingClientRect(), o = e.getBoundingClientRect();
  if (o.top < n.top) {
    const i = -(n.top - o.top);
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  } else if (o.bottom > n.bottom) {
    const i = o.bottom - n.bottom;
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  }
}
function Me(t) {
  var j;
  const { runtime: e, objectId: n, element: o, event: i, fromRect: r, returnRect: a } = t, s = e.objects.get(n), l = e.surfaces.snapshot(), c = l.map((m) => m.id), v = (m) => {
    var C;
    return (C = e.objects.get(m)) == null ? void 0 : C.surfaceId;
  }, y = (s == null ? void 0 : s.surfaceId) ?? ((j = l[0]) == null ? void 0 : j.id), d = () => [...e.objects.values()].map((m) => m.element).filter((m) => !!(m != null && m.isConnected));
  let R, $, w, M = null, g = null, h = null, f = null, X = !1, F = null, p = null, S = null, E = null, b = null, T, I = { x: 0, y: 0 }, u = null, A = !1;
  function L() {
    var m;
    return F ? (m = e.getSession(F)) == null ? void 0 : m.state : void 0;
  }
  function k(m, C) {
    if (L() !== "active" || !w) return;
    const P = re({
      active: L() === "active",
      event: { clientX: m, clientY: C },
      state: w,
      getSurface: (x) => x.columnId
    });
    P && (M = P);
  }
  function z(m) {
    A = !0, b == null || b.setTarget({
      x: m.clientX - I.x,
      y: m.clientY - I.y
    }), k(m.clientX, m.clientY), E == null || E.update(
      e.resolveMoveSurfaceElement(n, m.clientX, m.clientY),
      { x: m.clientX, y: m.clientY }
    );
  }
  function Z(m) {
    if (X) return { accepted: !1 };
    if (X = !0, T = b ? { ...b.getState() } : void 0, T) {
      const O = pt({ x: T.vx, y: T.vy });
      T.vx = O.x, T.vy = O.y;
    }
    if (b == null || b.stop(), b = null, E == null || E.stop(), !w || !F) return { accepted: !1 };
    m && k(m.clientX, m.clientY), M = w.release(), !M && !A && T && Math.hypot(T.vx, T.vy) < 0.5 && y && (M = {
      columnId: y,
      index: u ?? Math.max(0, e.getObjectSurfaceIndex(n, y))
    });
    const C = !M;
    if (C && y && (M = {
      columnId: y,
      index: u ?? Math.max(0, e.getObjectSurfaceIndex(n, y))
    }), !M) return { accepted: !1 };
    const P = M, x = (f == null ? void 0 : f.getBoundingClientRect()) ?? o.getBoundingClientRect();
    return S == null || S.restoreLayoutHidden(), delete o.dataset.runtimeActive, p == null || p.release(), g = se(() => {
    }, () => {
      const O = F;
      e.waitForMoveTarget(O, P).then((H) => {
        if (L() !== "landing") return;
        const N = le({
          resolve: () => H,
          applyState: (Y) => e.applyVisualState(n, Y, { phase: "revealing", hovered: !1, selected: Y.classList.contains("is-selected"), grabbed: !1 })
        });
        if (!N) {
          h == null || h.complete({ completed: !1, reason: "target-not-registered" }), h = null;
          return;
        }
        const G = e.resolveMoveSurfaceViewport(P.columnId);
        G && pe(G, N);
        const V = ce((Y) => e.captureVisualState(n, Y), N), D = mt({
          createContext: () => e.createVisualLifecycleContext(O, P, N, R),
          source: o,
          sourceRect: x,
          visualSnapshot: $,
          targetSnapshot: V,
          motionState: T
        });
        f = ue({
          // proxy 已在 prepare 阶段创建，landing 只能复用这一个实例。
          createProxy: () => e.getVisualProxy(O) ?? e.createVisualProxy(O, D) ?? null,
          enableProxy: (Y) => st(Y, !0),
          bindRegrab: (Y) => e.bindRegrabTarget(O, n, Y, _),
          land: () => e.landVisualProxy(O, N, D),
          onMissing: () => {
            h == null || h.complete({ completed: !1, reason: "visual-proxy-missing" }), h = null;
          },
          onComplete: (Y) => {
            fe({ active: L() === "landing", result: Y, complete: (At) => h == null ? void 0 : h.complete(At), reveal: () => e.revealVisualProxy(O, N, D) }), h = null;
          }
        });
      });
    }), { accepted: !0, destination: M, ...C ? { emitAction: !1 } : {} };
  }
  function _(m) {
    if (L() !== "landing") return;
    const C = f;
    if (!C || !F) return;
    const P = de(
      () => e.resolveVisualTarget(F, M),
      () => {
        var H;
        return ((H = e.objects.get(n)) == null ? void 0 : H.element) ?? null;
      }
    );
    if (!P) return;
    const x = e.createRegrabContext(F, m, C, P);
    if (!x) return;
    ae({
      event: x.event,
      sessionId: F,
      proxy: C,
      source: P,
      interrupt: () => x.interrupt("regrab"),
      clearRegrab: () => e.clearRegrab(n),
      disposeProxy: () => e.disposeVisualProxy(F)
    });
    const O = P.getBoundingClientRect();
    e.startObjectPointer(n, P, m, x.proxyRect, O);
  }
  const et = {
    prepare(m) {
      var G;
      if (F = m.session.id, A = !1, E = It(m.session.cleanup, {
        onScroll: (V) => k(V.x, V.y)
      }), m.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", p = e.acquireObject(F, n), e.takeSurfaces(F, c);
      const { beforePickup: C } = oe(o, d);
      u = e.getObjectSurfaceIndex(n, y), R = o.cloneNode(!0);
      const P = e.getMoveContext(F), x = ne(P, o, i, r), O = x.rect;
      I = { x: x.offsetX, y: x.offsetY }, e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), $ = ee((V, D) => e.captureVisualState(n, D), n, o);
      const H = mt({
        createContext: () => e.createVisualLifecycleContext(F, void 0, void 0, R),
        source: o,
        sourceRect: O,
        visualSnapshot: $,
        targetSnapshot: $
      });
      if (f = ((G = e.createVisualProxy(F, H)) == null ? void 0 : G.element) ?? null, !f) throw new Error("Runtime failed to create detach pickup proxy");
      S = te(o, F), S.detachFromLayout(), Mt(C), o.dataset.runtimeActive = "true", b = gt({
        mode: "follow",
        followRotation: Lt,
        onFrame: (V) => {
          f != null && f.isConnected && (f.style.left = `${V.x}px`, f.style.top = `${V.y}px`, f.style.transform = `perspective(760px) rotateX(${V.rotateX.toFixed(2)}deg) rotateZ(${V.rotateZ.toFixed(2)}deg) scale(${V.scaleX.toFixed(4)}, ${V.scaleY.toFixed(4)})`);
        }
      }), b.setProfile(Et);
      const N = a ?? O;
      N.left, N.top, N.width, N.height, b.seed({ x: O.left, y: O.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 }), b.setTarget({ x: i.clientX - I.x, y: i.clientY - I.y }), b.start(), w = ie(
        v(n),
        (V) => e.resolveMoveHit(n, V.clientX, V.clientY),
        (V, D) => V.columnId === (D == null ? void 0 : D.columnId) && V.index === (D == null ? void 0 : D.index)
      ), k(i.clientX, i.clientY);
    },
    update(m, C) {
      C.event instanceof PointerEvent && z(C.event);
    },
    resolveDestination(m, C) {
      return Z(C.event instanceof PointerEvent ? C.event : void 0);
    },
    commit: () => {
      S == null || S.restoreLayoutHidden(), document.body.classList.remove("kb-dragging");
    },
    cancel(m, C) {
      X = !0, b == null || b.stop(), b = null, f && (e.disposeVisualProxy(F), f = null), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, S == null || S.restore(), S = null;
    }
  }, nt = {
    layout: ye(o, d),
    ...me({
      createGate: () => e.createCompletionGate(F, { completed: !1, reason: "landing-cancelled" }),
      onGate: (m) => {
        h = m;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        g == null || g(), g = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        f && st(f, !1), S == null || S.restore(), S = null;
      }
    })
  };
  return { driver: et, lifecycle: nt };
}
export {
  yt as D,
  Et as F,
  U as L,
  Lt as a,
  te as b,
  he as c,
  gt as d,
  Me as e,
  xe as f,
  we as g,
  Se as h,
  ot as i,
  W as j,
  be as k,
  ve as l,
  Pt as m,
  ge as n,
  Re as o,
  Fe as r,
  pt as s
};
