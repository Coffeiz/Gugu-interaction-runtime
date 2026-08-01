const _ = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 250 }
}, mt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, Se = 8;
function pt(t, e = mt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, i = t.y * e.velocityScale, r = Math.hypot(o, i);
  if (r <= e.maxVelocity || r === 0) return { x: o, y: i };
  const a = e.maxVelocity / r;
  return { x: o * a, y: i * a };
}
function be(t, e = mt) {
  const n = pt(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const i = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * i, y: n.y * e.coastSeconds * i };
}
function tt(t, e, n, o, i, r = 1 / 120) {
  let a = Math.max(0, i);
  for (; a > 1e-4; ) {
    const s = Math.min(a, r);
    a -= s;
    const l = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += c * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const j = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Et = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, It = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Pt = { position: 0.35, velocity: 5 };
function gt(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? Pt, o = {
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
  let i = { x: 0, y: 0 }, r = j, a = null, s = null, l = !1, c = 0, p = 0, v = "settle", u = 0;
  function w() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function C(y) {
    var L;
    if (!l) return;
    const x = Math.min(0.032, s == null ? 1 / 60 : Math.max(0, (y - s) / 1e3));
    if (s = y, v === "coast") {
      const f = Math.exp(-h.friction * x);
      o.vx *= f, o.vy *= f;
      const X = o.vx * x, S = o.vy * x, A = u + Math.hypot(X, S);
      if (A >= h.maxDistance) {
        const P = Math.max(0, h.maxDistance - u), D = Math.hypot(X, S), d = D > 0 ? P / D : 0;
        o.x += X * d, o.y += S * d, o.vx = 0, o.vy = 0, v = "settle";
      } else
        o.x += X, o.y += S, u = A, ((y - ($ ?? y)) / 1e3 >= h.duration || Math.hypot(o.vx, o.vy) <= h.minVelocity) && (v = "settle");
    }
    if (v === "settle") {
      const f = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      tt(f, { x: i.x, y: i.y }, r.position.stiffness, r.position.damping, x), o.x = f.position.x, o.y = f.position.y, o.vx = f.velocity.x, o.vy = f.velocity.y;
    }
    const T = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (tt(T, { x: i.scaleX ?? o.scaleX, y: i.scaleY ?? o.scaleY }, r.scale.stiffness, r.scale.damping, x), o.scaleX = T.position.x, o.scaleY = T.position.y, o.scaleVX = T.velocity.x, o.scaleVY = T.velocity.y, e === "follow") {
      const f = t.followRotation, X = -Math.log(1 - (f.smoothing ?? 0.2)) * 60, S = 1 - Math.exp(-X * x), A = c, P = p;
      c += (o.vx - c) * S, p += (o.vy - p) * S;
      const D = 0.025;
      o.rotateVZ += (A - c) * D, o.rotateVX += (P - p) * D * 0.7;
      const d = Math.max(-(f.maxSway ?? 5), Math.min(f.maxSway ?? 5, c / 60 * f.sway)), R = Math.max(-(f.maxTiltDelta ?? 4), Math.min(f.maxTiltDelta ?? 4, p / 60 * (f.verticalTiltFactor ?? 0.16))), I = f.tilt + R, z = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      tt(z, { x: I, y: d }, 150, 2 * 0.72 * Math.sqrt(150), x), o.rotateX = z.position.x, o.rotateZ = z.position.y, o.rotateVX = z.velocity.x, o.rotateVZ = z.velocity.y;
    } else {
      const f = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      tt(f, { x: 0, y: 0 }, 150, 2 * 0.82 * Math.sqrt(150), x), o.rotateX = f.position.x, o.rotateZ = f.position.y, o.rotateVX = f.velocity.x, o.rotateVZ = f.velocity.y;
    }
    if (w(), e === "follow") {
      a = requestAnimationFrame(C);
      return;
    }
    if (v === "settle" && Math.abs(i.x - o.x) < n.position && Math.abs(i.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      l = !1, a = null, (L = t.onArrived) == null || L.call(t);
      return;
    }
    a = requestAnimationFrame(C);
  }
  let h = null, $ = null;
  return {
    seed(y) {
      Object.assign(o, y);
    },
    setTarget(y) {
      i = { ...y };
    },
    retarget(y) {
      i = { ...y };
    },
    setProfile(y) {
      r = y;
    },
    getState() {
      return o;
    },
    start() {
      l || (l = !0, v = "settle", h = null, $ = null, s = null, w(), a = requestAnimationFrame(C));
    },
    startCoastThenSettle(y) {
      if (l) return;
      l = !0, v = "coast", h = y, u = 0, $ = null;
      const x = Math.hypot(o.vx, o.vy), T = y.maxDistance / Math.max(y.duration, 1 / 60);
      if (x > T && x > 0) {
        const m = T / x;
        o.vx *= m, o.vy *= m;
      }
      s = null, w(), a = requestAnimationFrame((m) => {
        $ = m, C(m);
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
function Lt(t) {
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
function Vt(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function at(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function we(t, e = t.getBoundingClientRect()) {
  const n = t.cloneNode(!0);
  return n.classList.remove("kb-card-dragging-source"), n.style.position = "fixed", n.style.left = `${e.left}px`, n.style.top = `${e.top}px`, n.style.boxSizing = "border-box", n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.margin = "0", n.style.zIndex = "2147483647", n.style.pointerEvents = "none", n.style.visibility = "visible", n.style.display = "", n.dataset.runtimeProxy = "true", n.style.transformOrigin = "50% 50%", n.style.transform = "scale(1.03)", n.style.transformOrigin = "50% 50%", n.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transition = "transform .15s ease, box-shadow .15s ease", document.documentElement.appendChild(n), lt.add(n), n;
}
function et(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function dt(t) {
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
  Object.assign(l.style, { ...s });
  const c = getComputedStyle(t);
  for (l.style.display = c.display, l.style.flexDirection = c.flexDirection, l.style.flexWrap = c.flexWrap, l.style.alignItems = c.alignItems, l.style.justifyContent = c.justifyContent, l.style.gap = c.gap; t.firstChild; ) l.appendChild(t.firstChild);
  const p = dt(l), v = new Set(p.map(et)), u = document.createElement("div");
  Object.assign(u.style, { ...s, pointerEvents: "" }), u.style.display = n.display, u.style.flexDirection = n.flexDirection, u.style.flexWrap = n.flexWrap, u.style.alignItems = n.alignItems, u.style.justifyContent = n.justifyContent, u.style.gap = n.gap, u.style.overflow = "hidden";
  const w = e.cloneNode(!0);
  for (w.style.visibility = "visible", w.style.display = ""; w.firstChild; ) u.appendChild(w.firstChild);
  const C = Lt(e);
  Vt(u, C);
  const h = dt(u), $ = new Set(h.map(et)), y = h.filter((m) => !v.has(et(m)));
  for (const m of y) m.style.opacity = "0";
  const x = p.filter((m) => !$.has(et(m))), T = new Set(x);
  for (const m of p)
    T.has(m) || (m.style.opacity = "0");
  return t.appendChild(u), x.length > 0 && t.appendChild(l), { enteringEls: y, leavingEls: x };
}
function Fe(t, e, n = {}) {
  const o = n.duration ?? _.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, l = n.targetOpacity, c = n.targetContent ? ht(t, n.targetContent) : null;
  if (c) {
    for (const d of c.enteringEls) d.style.transition = `opacity ${o}ms ${i}`;
    for (const d of c.leavingEls) d.style.transition = `opacity ${o}ms ${i}`;
  }
  const p = parseFloat(t.style.left) || 0, v = parseFloat(t.style.top) || 0;
  let u = !1, w = e;
  const C = performance.now();
  let h = () => {
  }, $ = () => {
  };
  const y = new Promise((d) => {
    $ = d;
  }), x = () => {
    const d = t.getBoundingClientRect();
    return Math.abs(d.left - w.left) < 2 && Math.abs(d.top - w.top) < 2 && Math.abs(d.width - w.width) < 2 && Math.abs(d.height - w.height) < 2;
  };
  let T = null, m = null, L = 0;
  const f = 60, X = (d) => {
    u || (u = !0, t.removeEventListener("transitionend", h), m !== null && (window.clearTimeout(m), m = null), $());
  }, S = () => {
    if (!u) {
      if (x()) {
        X();
        return;
      }
      if (performance.now() - C >= o + 500) {
        X();
        return;
      }
      window.requestAnimationFrame(S);
    }
  }, A = (d, R = o) => {
    w = d;
    const I = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${I.width.toFixed(2)}px`, t.style.height = `${I.height.toFixed(2)}px`, t.style.transform = `translate3d(${(I.left - p).toFixed(2)}px, ${(I.top - v).toFixed(2)}px, 0)`, t.offsetWidth;
    const z = `translate3d(${(d.left - p).toFixed(2)}px, ${(d.top - v).toFixed(2)}px, 0)`;
    t.style.transition = [
      `transform ${R}ms ${i}`,
      `width ${R}ms ${i}`,
      `height ${R}ms ${i}`,
      `box-shadow ${R}ms ease`,
      `border-radius ${R}ms ease`,
      `background-color ${R}ms ease`,
      `opacity ${R}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = z, t.style.width = `${d.width.toFixed(2)}px`, t.style.height = `${d.height.toFixed(2)}px`, r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.backgroundColor = s, n.targetBackgroundImage && (t.style.backgroundImage = n.targetBackgroundImage)), l != null && (t.style.opacity = l), c) {
        for (const N of c.enteringEls) N.style.opacity = "1";
        for (const N of c.leavingEls) N.style.opacity = "0";
      }
    });
  };
  h = (d) => {
    d.target !== t || !(d.propertyName === "transform" || d.propertyName === "width" || d.propertyName === "height") || x() && X(`transitionend:${d.propertyName}`);
  }, t.addEventListener("transitionend", h), A(e), window.setTimeout(S, o + 40);
  const P = (d) => {
    var I;
    L = performance.now();
    const R = Math.max(80, o - (L - C));
    A(((I = n.readTarget) == null ? void 0 : I.call(n)) ?? d, R);
  };
  return { finished: y, retarget: (d) => {
    if (u) return;
    const R = Math.abs(d.left - w.left), I = Math.abs(d.top - w.top), z = Math.abs(d.width - w.width), N = Math.abs(d.height - w.height);
    if (R < 0.5 && I < 0.5 && z < 0.5 && N < 0.5) return;
    const q = performance.now() - L;
    if (q >= f) {
      P(d);
      return;
    }
    T = d, m === null && (m = window.setTimeout(() => {
      if (m = null, u || !T) return;
      const Z = T;
      T = null, P(Z);
    }, f - q));
  } };
}
function Re(t, e, n = {}) {
  var D, d, R, I, z, N, q, Z, Q, H, g, F, E, O;
  const o = n.duration ?? _.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, l = n.targetOpacity, c = n.targetContent ? ht(t, n.targetContent) : null;
  if (c) {
    for (const b of c.enteringEls) b.style.transition = `opacity ${o}ms ${i}`;
    for (const b of c.leavingEls) b.style.transition = `opacity ${o}ms ${i}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const p = parseFloat(t.style.left) || t.getBoundingClientRect().left, v = parseFloat(t.style.top) || t.getBoundingClientRect().top, u = t.getBoundingClientRect(), w = u.width || e.width, C = u.height || e.height;
  let h = e, $ = !1, y = null, x = 0, T = () => {
  };
  const m = new Promise((b) => {
    T = b;
  }), L = () => {
    $ || ($ = !0, f.stop(), y !== null && window.clearTimeout(y), y = null, T());
  }, f = gt({
    mode: "settle",
    onFrame: (b) => {
      t.style.transform = `perspective(760px) translate3d(${(b.x - p).toFixed(2)}px, ${(b.y - v).toFixed(2)}px, 0) rotateX(${b.rotateX.toFixed(2)}deg) rotateZ(${b.rotateZ.toFixed(2)}deg) scale(${b.scaleX.toFixed(4)}, ${b.scaleY.toFixed(4)})`;
    },
    onArrived: L
  }), X = Math.hypot(((D = n.motionState) == null ? void 0 : D.vx) ?? 0, ((d = n.motionState) == null ? void 0 : d.vy) ?? 0), S = n.releaseDamping ?? 0.78;
  f.setProfile(X > 30 ? {
    ...j,
    position: {
      ...j.position,
      damping: j.position.damping * S
    }
  } : j), f.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((R = n.motionState) == null ? void 0 : R.x) ?? u.left,
    y: ((I = n.motionState) == null ? void 0 : I.y) ?? u.top,
    vx: ((z = n.motionState) == null ? void 0 : z.vx) ?? 0,
    vy: ((N = n.motionState) == null ? void 0 : N.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((q = n.motionState) == null ? void 0 : q.scaleX) ?? 1,
    scaleY: ((Z = n.motionState) == null ? void 0 : Z.scaleY) ?? 1,
    rotateX: ((Q = n.motionState) == null ? void 0 : Q.rotateX) ?? 0,
    rotateZ: ((H = n.motionState) == null ? void 0 : H.rotateZ) ?? 0,
    rotateVX: ((g = n.motionState) == null ? void 0 : g.rotateVX) ?? 0,
    rotateVZ: ((F = n.motionState) == null ? void 0 : F.rotateVZ) ?? 0
  }), f.setTarget({
    x: e.left,
    y: e.top,
    scaleX: e.width / w,
    scaleY: e.height / C
  }), t.style.transition = [
    `box-shadow ${o}ms ${i}`,
    `border-radius ${o}ms ${i}`,
    `background-color ${o}ms ${i}`,
    `opacity ${o}ms ${i}`
  ].join(", "), requestAnimationFrame(() => {
    if (!$ && (r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.backgroundColor = s, n.targetBackgroundImage && (t.style.backgroundImage = n.targetBackgroundImage)), l != null && (t.style.opacity = l), c)) {
      for (const b of c.enteringEls) b.style.opacity = "1";
      for (const b of c.leavingEls) b.style.opacity = "0";
    }
  });
  const A = (b = 0) => {
    y !== null && window.clearTimeout(y), x = performance.now() + Math.max(2e3, o * 8, 5e3) + b, y = window.setTimeout(() => {
      y = null, !$ && performance.now() >= x && L();
    }, Math.max(2e3, o * 8, 5e3) + b);
  };
  A();
  const P = n.coast;
  return P && P.maxDistance > 0 && Math.hypot(((E = n.motionState) == null ? void 0 : E.vx) ?? 0, ((O = n.motionState) == null ? void 0 : O.vy) ?? 0) > P.minVelocity ? f.startCoastThenSettle(P) : f.start(), {
    finished: m,
    retarget(b) {
      $ || (h = b, A(1e3), f.setTarget({
        x: h.left,
        y: h.top,
        scaleX: h.width / w,
        scaleY: h.height / C
      }));
    }
  };
}
function Me(t) {
  lt.has(t) && (lt.delete(t), t.remove());
}
const st = /* @__PURE__ */ new WeakMap(), nt = /* @__PURE__ */ new WeakMap();
function Dt(t, e) {
  st.set(t, { style: t.getAttribute("style") ?? "" });
  const n = t.cloneNode(!0);
  n.style.position = "fixed", n.style.left = `${e.left}px`, n.style.top = `${e.top}px`, n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.margin = "0", n.style.zIndex = "1000", n.style.boxSizing = "border-box", n.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transform = "scale(1.03)", n.style.transition = "transform .15s ease, box-shadow .15s ease", n.dataset.runtimeProxy = "true", document.documentElement.appendChild(n), nt.set(t, n), t.style.visibility = "hidden";
}
function Ot(t) {
  return nt.get(t);
}
function it(t) {
  const e = nt.get(t);
  e && (e.remove(), nt.delete(t));
  const n = st.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), st.delete(t);
}
const lt = /* @__PURE__ */ new Set(), J = /* @__PURE__ */ new Map();
function Te(t, e) {
  J.set(t, e), t.style.visibility = "hidden";
}
function Ce(t, e) {
  const n = J.get(t) === e;
  return n && (t.style.visibility = "", J.delete(t)), n;
}
function zt(t, e) {
  J.get(t) === e && J.delete(t);
}
function Nt(t, e = {}) {
  const n = e.edgeSize ?? 48, o = e.maxSpeed ?? 16;
  let i = null, r = null, a = null, s = !1;
  const l = (v) => {
    const u = (n - v) / n;
    return Math.ceil(o * u);
  }, c = () => {
    var C, h;
    if (s || (a = requestAnimationFrame(c), !i || !r || !i.isConnected)) return;
    const v = i.getBoundingClientRect();
    if (r.x < v.left || r.x > v.right) return;
    const u = r.y - v.top, w = v.bottom - r.y;
    u < n ? (i.scrollTop -= l(u), (C = e.onScroll) == null || C.call(e, r)) : w < n && (i.scrollTop += l(w), (h = e.onScroll) == null || h.call(e, r));
  }, p = () => {
    s || (s = !0, a !== null && cancelAnimationFrame(a), a = null);
  };
  return a = requestAnimationFrame(c), t.track(p), {
    update(v, u) {
      s || (i = v, r = u);
    },
    stop: p
  };
}
const G = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap();
function xt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [o, i, r, a] = n;
  return (s) => {
    let l = 0, c = 1;
    for (let v = 0; v < 12; v += 1) {
      const u = (l + c) / 2;
      3 * (1 - u) ** 2 * u * o + 3 * (1 - u) * u ** 2 * r + u ** 3 < s ? l = u : c = u;
    }
    const p = (l + c) / 2;
    return 3 * (1 - p) ** 2 * p * i + 3 * (1 - p) * p ** 2 * a + p ** 3;
  };
}
function vt(t) {
  const e = G.get(t);
  e && (cancelAnimationFrame(e.frame), G.delete(t), t.style.transform = "");
}
function Yt(t, e, n, o, i, r) {
  vt(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: xt(i)
  };
  G.set(t, a);
  const s = (l) => {
    if (G.get(t) !== a) return;
    const c = Math.min(1, (l - a.started) / a.duration), p = a.easing(c);
    if (t.style.transform = `translate(${(a.fromX * (1 - p)).toFixed(3)}px, ${(a.fromY * (1 - p)).toFixed(3)}px)`, c >= 1) {
      G.delete(t), t.style.transform = "", r == null || r();
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
function St(t) {
  const e = U.get(t);
  e && (cancelAnimationFrame(e.frame), U.delete(t), t.style.height = "");
}
function Bt(t, e, n, o, i, r) {
  St(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: xt(i)
  };
  U.set(t, a);
  const s = (l) => {
    if (U.get(t) !== a) return;
    const c = Math.min(1, (l - a.started) / a.duration), p = a.fromX + (a.fromY - a.fromX) * a.easing(c);
    if (t.style.height = `${p}px`, c >= 1) {
      U.delete(t);
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
const ct = _.flip.duration, ut = _.flip.easing;
function qt(t) {
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
function Wt(t, e, n = ct, o = ut) {
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
    i.dataset.runtimeFlip = "true", i.dataset.runtimeFlipToken = c, i.offsetHeight, Yt(i, s, l, n, o, () => {
      i.dataset.runtimeFlipToken === c && (i.style.transition = "", delete i.dataset.runtimeFlip);
    });
  }
}
let wt = null;
function $e(t) {
  wt = t;
}
function Ft() {
  const t = wt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? _.flip,
    resize: (t == null ? void 0 : t.resize) ?? _.resize
  };
}
function Zt(t, e) {
  const n = Array.from(e.querySelectorAll("[data-layout-group]")), o = [], i = [];
  for (const r of t)
    r.closest("[data-layout-group]") !== null ? o.push(r) : i.push(r);
  return { groups: n, groupLeaves: o, flatCards: i };
}
function Rt(t, e = document) {
  const n = Array.from(e.querySelectorAll("[data-layout-surface]")).map((l) => ({ element: l, rect: K(l), inlineStyle: $t(l) }));
  Ct(n);
  const { groups: o, groupLeaves: i, flatCards: r } = Zt(t, e), a = te(Array.from(e.querySelectorAll("[data-layout-surface]"))), s = {
    root: e,
    group: o.length > 0 ? { before: Jt([...o, ...i]) } : void 0,
    flat: r.length > 0 ? { elements: r, before: qt(r) } : void 0,
    surfaces: a
  };
  return Ht(e, s);
}
function Mt(t) {
  const e = Ft();
  t.group && Qt(t.group.before, e.flip.duration, e.flip.easing), t.flat && Wt(t.flat.elements, t.flat.before, e.flip.duration, e.flip.easing), ee(t.surfaces, e.resize.duration, e.resize.easing);
}
function Tt(t) {
  W.set(t.root, t), queueMicrotask(() => {
    W.get(t.root) === t && (W.delete(t.root), Mt(t));
  });
}
function _t(t) {
  W.set(t.root, t), requestAnimationFrame(() => {
    W.get(t.root) === t && (W.delete(t.root), Mt(t));
  });
}
function Ht(t, e) {
  const n = W.get(t);
  if (!n) return e;
  const o = Ut(e.surfaces, n.surfaces), i = jt(e.flat, n.flat), r = Gt(e.group, n.group);
  return { ...e, flat: i, group: r, surfaces: o };
}
function jt(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const i = e.before.get(o);
    i && n.set(o, i);
  }
  return { ...t, before: n };
}
function Gt(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function Ut(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const i = n.get(o.element);
    return i ? { ...o, rect: i.rect, inlineStyle: i.inlineStyle } : o;
  });
}
const W = /* @__PURE__ */ new WeakMap();
function K(t) {
  const e = t.getBoundingClientRect();
  return { top: e.top, left: e.left, width: e.width, height: e.height };
}
function Jt(t) {
  const e = new Set(t);
  return t.map((n) => ({
    element: n,
    parent: Kt(n, e),
    rect: K(n)
  }));
}
function Kt(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function Qt(t, e = ct, n = ut) {
  bt(t.map((i) => i.element));
  const o = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = K(i.element);
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
function te(t) {
  return t.map((e) => {
    var n;
    return {
      element: e,
      rect: K(e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((n = B.get(e)) == null ? void 0 : n.baseStyle) ?? $t(e)
    };
  });
}
function ee(t, e = ct, n = ut) {
  var i;
  Ct(t);
  const o = t.filter((r) => r.element.isConnected).map((r) => {
    const a = K(r.element);
    r.element.dataset.surfaceType;
    const s = Ft();
    return {
      item: r,
      next: a,
      profile: s.resize,
      fromHeight: yt(r.element, r.rect.height),
      toHeight: yt(r.element, a.height)
    };
  }).filter(({ item: r, next: a }) => Math.abs(r.rect.height - a.height) >= 0.5);
  for (const { item: r, fromHeight: a } of o) {
    const s = r.element.style, l = {
      baseStyle: ((i = B.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++ne)
    };
    B.set(r.element, l), s.overflow = "hidden", s.transition = "none", s.height = `${a}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = l.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: a, toHeight: s, profile: l } of o) {
      const c = r.element.style, p = B.get(r.element);
      if (!p || r.element.dataset.runtimeSurfaceResizeToken !== p.token) continue;
      const v = p.token;
      c.transition = "none", Bt(r.element, a, s, l.duration, l.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== v) return;
        const u = B.get(r.element);
        !u || u.token !== v || (At(r.element, u.baseStyle), B.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, l.duration + 40);
    }
  });
}
function Ct(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0) {
    for (const { element: n } of e) {
      const o = B.get(n);
      o && (St(n), At(n, o.baseStyle), B.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
    e[0].element.offsetHeight;
  }
}
const B = /* @__PURE__ */ new WeakMap();
let ne = 0;
function $t(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function At(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function yt(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
const rt = /* @__PURE__ */ new WeakMap();
function oe(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  rt.set(t, n);
  const o = () => rt.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, rt.delete(t), !0) : !1,
    isOwner: o
  };
}
function ie(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function re(t, e, n, o) {
  const i = o ?? e.getBoundingClientRect(), r = o ? n.clientX - i.left : t.dragOffset.x, a = o ? n.clientY - i.top : t.dragOffset.y;
  return o && (t.dragOffset = { x: r, y: a }), { rect: i, offsetX: r, offsetY: a };
}
function ae(t, e) {
  const n = t.cloneNode(!0), o = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return { beforeContent: n, beforePickup: Rt(o) };
}
function se(t, e, n) {
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
function le(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function ce(t) {
  t.event.stopPropagation(), at(t.proxy, !1), t.clearRegrab(), zt(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden", t.disposeProxy();
}
function ue(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function fe(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function de(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function ye(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function me(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function pe(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function ge(t, e) {
  return t() ?? e();
}
function he(t) {
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
function xe(t, e) {
  let n = 0;
  return {
    capture: () => (n += 1, Rt(
      e().filter((o) => o !== t && o.dataset.runtimeProxy !== "true")
    )),
    play: (o, i, r = !1) => {
      const a = ++n;
      if (r) {
        requestAnimationFrame(() => {
          a === n && _t(i);
        });
        return;
      }
      Tt(i);
    }
  };
}
function ve(t, e) {
  const n = t.getBoundingClientRect(), o = e.getBoundingClientRect();
  if (o.top < n.top) {
    const i = -(n.top - o.top);
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  } else if (o.bottom > n.bottom) {
    const i = o.bottom - n.bottom;
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  }
}
function Ae(t) {
  var H;
  const { runtime: e, objectId: n, element: o, event: i, fromRect: r } = t, a = e.objects.get(n), s = e.surfaces.snapshot(), l = s.map((g) => g.id), c = (g) => {
    var F;
    return (F = e.objects.get(g)) == null ? void 0 : F.surfaceId;
  }, p = (a == null ? void 0 : a.surfaceId) ?? ((H = s[0]) == null ? void 0 : H.id), v = () => [...e.objects.values()].map((g) => g.element).filter((g) => !!(g != null && g.isConnected));
  let u, w, C, h = null, $ = null, y = null, x = null, T = !1, m = null, L = null, f = null, X = null, S = null, A, P = { x: 0, y: 0 }, D = null, d = !1;
  function R() {
    var g;
    return m ? (g = e.getSession(m)) == null ? void 0 : g.state : void 0;
  }
  function I(g, F) {
    if (R() !== "active" || !C) return;
    const E = le({
      active: R() === "active",
      event: { clientX: g, clientY: F },
      state: C,
      getSurface: (O) => O.columnId
    });
    E && (h = E);
  }
  function z(g) {
    d = !0, S == null || S.setTarget({
      x: g.clientX - P.x,
      y: g.clientY - P.y
    }), I(g.clientX, g.clientY), X == null || X.update(
      e.resolveMoveSurfaceElement(n, g.clientX, g.clientY),
      { x: g.clientX, y: g.clientY }
    );
  }
  function N(g) {
    if (T) return { accepted: !1 };
    if (T = !0, A = S ? { ...S.getState() } : void 0, A) {
      const M = pt({ x: A.vx, y: A.vy });
      A.vx = M.x, A.vy = M.y;
    }
    if (S == null || S.stop(), S = null, X == null || X.stop(), !C || !m) return { accepted: !1 };
    g && I(g.clientX, g.clientY), h = C.release(), !h && !d && A && Math.hypot(A.vx, A.vy) < 0.5 && p && (h = {
      columnId: p,
      index: D ?? Math.max(0, e.getObjectSurfaceIndex(n, p))
    });
    const F = !h;
    if (F && p && (h = {
      columnId: p,
      index: D ?? Math.max(0, e.getObjectSurfaceIndex(n, p))
    }), !h) return { accepted: !1 };
    const E = h;
    m && p && D !== null && E.columnId === p && E.index === D && (e.getMoveContext(m).layoutSnapshot = void 0);
    const O = (x == null ? void 0 : x.getBoundingClientRect()) ?? o.getBoundingClientRect();
    f == null || f.restoreLayoutHidden(), delete o.dataset.runtimeActive, F && (L == null || L.release());
    const b = (M, k) => {
      if (R() !== "landing") return;
      const V = fe({
        resolve: () => k,
        applyState: (Y) => e.applyVisualState(n, Y, { phase: "revealing", hovered: !1, selected: Y.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!V) {
        y == null || y.complete({ completed: !1, reason: "target-not-registered" }), y = null;
        return;
      }
      const ft = e.resolveMoveSurfaceViewport(E.columnId);
      ft && ve(ft, V);
      const kt = de((Y) => e.captureVisualState(n, Y), V), ot = ye({
        createContext: () => e.createVisualLifecycleContext(M, E, V, u),
        source: o,
        sourceRect: O,
        visualSnapshot: w,
        targetSnapshot: kt,
        motionState: A
      });
      x = me({
        // 抓取阶段没有 proxy（源节点自己飞），这里现建；getVisualProxy 兜底只是防御
        // regrab 等场景下 proxy 已经存在的情况，不是复用 prepare 阶段建的实例。
        createProxy: () => e.getVisualProxy(M) ?? e.createVisualProxy(M, ot) ?? null,
        enableProxy: (Y) => at(Y, !0),
        bindRegrab: (Y) => e.bindRegrabTarget(M, n, Y, q),
        land: () => e.landVisualProxy(M, V, ot),
        onMissing: () => {
          y == null || y.complete({ completed: !1, reason: "visual-proxy-missing" }), y = null;
        },
        onComplete: (Y) => {
          pe({
            active: R() === "landing",
            result: Y,
            complete: (Xt) => y == null ? void 0 : y.complete(Xt),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(M, V, ot).then(() => {
              x && (e.disposeVisualProxy(M), x = null);
            })
          }), y = null;
        }
      });
    };
    return $ = ue(() => {
    }, () => {
      const M = m, k = e.resolveMoveTarget(M, E);
      if (k) {
        b(M, k);
        return;
      }
      e.waitForMoveTarget(M, E).then((V) => b(M, V));
    }), { accepted: !0, destination: h, ...F ? { emitAction: !1 } : {} };
  }
  function q(g) {
    if (R() !== "landing") return;
    const F = x;
    if (!F || !m) return;
    const E = ge(
      () => e.resolveVisualTarget(m, h),
      () => {
        var M;
        return ((M = e.objects.get(n)) == null ? void 0 : M.element) ?? null;
      }
    );
    if (!E) return;
    const O = e.createRegrabContext(m, g, F, E);
    if (!O) return;
    ce({
      event: O.event,
      sessionId: m,
      proxy: F,
      source: E,
      interrupt: () => O.interrupt("regrab"),
      clearRegrab: () => e.clearRegrab(n),
      disposeProxy: () => e.disposeVisualProxy(m)
    });
    const b = E.getBoundingClientRect();
    e.startObjectPointer(n, E, g, O.proxyRect, b);
  }
  const Z = {
    prepare(g) {
      if (m = g.session.id, d = !1, X = Nt(g.session.cleanup, {
        onScroll: (k) => I(k.x, k.y)
      }), g.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", L = e.acquireObject(m, n), e.takeSurfaces(m, l);
      const { beforePickup: F } = ae(o, v);
      D = e.getObjectSurfaceIndex(n, p), u = o.cloneNode(!0);
      const E = e.getMoveContext(m), O = re(E, o, i, r), b = O.rect;
      P = { x: O.offsetX, y: O.offsetY }, e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), w = ie((k, V) => e.captureVisualState(n, V), n, o), f = oe(o, m), Dt(o, b), o.style.transition = "none", Tt(F), o.dataset.runtimeActive = "true";
      const M = Ot(o);
      S = gt({
        mode: "follow",
        followRotation: It,
        onFrame: (k) => {
          M.isConnected && (M.style.left = `${k.x}px`, M.style.top = `${k.y}px`, M.style.transform = `perspective(760px) rotateX(${k.rotateX.toFixed(2)}deg) rotateZ(${k.rotateZ.toFixed(2)}deg) scale(${k.scaleX.toFixed(4)}, ${k.scaleY.toFixed(4)})`);
        }
      }), S.setProfile(Et), S.seed({ x: b.left, y: b.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 }), S.setTarget({ x: i.clientX - P.x, y: i.clientY - P.y }), S.start(), C = se(
        c(n),
        (k) => e.resolveMoveHit(n, k.clientX, k.clientY),
        (k, V) => k.columnId === (V == null ? void 0 : V.columnId) && k.index === (V == null ? void 0 : V.index)
      ), I(i.clientX, i.clientY);
    },
    update(g, F) {
      F.event instanceof PointerEvent && z(F.event);
    },
    resolveDestination(g, F) {
      return N(F.event instanceof PointerEvent ? F.event : void 0);
    },
    commit: () => {
      it(o), f == null || f.restoreLayoutHidden(), document.body.classList.remove("kb-dragging");
    },
    cancel(g, F) {
      T = !0, S == null || S.stop(), S = null, x && (e.disposeVisualProxy(m), x = null), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, it(o), f == null || f.restore(), f = null;
    }
  }, Q = {
    layout: xe(o, v),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => L == null ? void 0 : L.release()
    },
    ...he({
      createGate: () => e.createCompletionGate(m, { completed: !1, reason: "landing-cancelled" }),
      onGate: (g) => {
        y = g;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        $ == null || $(), $ = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        x && at(x, !1), it(o), f == null || f.restore(), f = null;
      }
    })
  };
  return { driver: Z, lifecycle: Q };
}
export {
  mt as D,
  Et as F,
  j as L,
  It as a,
  oe as b,
  be as c,
  gt as d,
  Ae as e,
  we as f,
  Te as g,
  Re as h,
  tt as i,
  _ as j,
  Me as k,
  Fe as l,
  Se as m,
  $e as n,
  Ce as r,
  pt as s
};
