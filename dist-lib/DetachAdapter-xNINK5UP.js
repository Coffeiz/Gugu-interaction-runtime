const H = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 250 }
}, xt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, $e = 8;
function St(t, e = xt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, i = t.y * e.velocityScale, r = Math.hypot(o, i);
  if (r <= e.maxVelocity || r === 0) return { x: o, y: i };
  const a = e.maxVelocity / r;
  return { x: o * a, y: i * a };
}
function Ee(t, e = xt) {
  const n = St(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const i = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * i, y: n.y * e.coastSeconds * i };
}
function nt(t, e, n, o, i, r = 1 / 120) {
  let a = Math.max(0, i);
  for (; a > 1e-4; ) {
    const s = Math.min(a, r);
    a -= s;
    const c = n * (e.x - t.position.x) - o * t.velocity.x, u = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += c * s, t.velocity.y += u * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const j = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Lt = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, kt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Xt = { position: 0.35, velocity: 5 };
function vt(t) {
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
  let i = { x: 0, y: 0 }, r = j, a = null, s = null, c = !1, u = 0, S = 0, m = "settle", f = 0;
  function F() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function M(p) {
    var A;
    if (!c) return;
    const h = Math.min(0.032, s == null ? 1 / 60 : Math.max(0, (p - s) / 1e3));
    if (s = p, m === "coast") {
      const y = Math.exp(-w.friction * h);
      o.vx *= y, o.vy *= y;
      const $ = o.vx * h, b = o.vy * h, T = f + Math.hypot($, b);
      if (T >= w.maxDistance) {
        const L = Math.max(0, w.maxDistance - f), z = Math.hypot($, b), d = z > 0 ? L / z : 0;
        o.x += $ * d, o.y += b * d, o.vx = 0, o.vy = 0, m = "settle";
      } else
        o.x += $, o.y += b, f = T, ((p - (R ?? p)) / 1e3 >= w.duration || Math.hypot(o.vx, o.vy) <= w.minVelocity) && (m = "settle");
    }
    if (m === "settle") {
      const y = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      nt(y, { x: i.x, y: i.y }, r.position.stiffness, r.position.damping, h), o.x = y.position.x, o.y = y.position.y, o.vx = y.velocity.x, o.vy = y.velocity.y;
    }
    const v = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (nt(v, { x: i.scaleX ?? o.scaleX, y: i.scaleY ?? o.scaleY }, r.scale.stiffness, r.scale.damping, h), o.scaleX = v.position.x, o.scaleY = v.position.y, o.scaleVX = v.velocity.x, o.scaleVY = v.velocity.y, e === "follow") {
      const y = t.followRotation, $ = -Math.log(1 - (y.smoothing ?? 0.2)) * 60, b = 1 - Math.exp(-$ * h), T = u, L = S;
      u += (o.vx - u) * b, S += (o.vy - S) * b;
      const z = 0.025;
      o.rotateVZ += (T - u) * z, o.rotateVX += (L - S) * z * 0.7;
      const d = Math.max(-(y.maxSway ?? 5), Math.min(y.maxSway ?? 5, u / 60 * y.sway)), C = Math.max(-(y.maxTiltDelta ?? 4), Math.min(y.maxTiltDelta ?? 4, S / 60 * (y.verticalTiltFactor ?? 0.16))), k = y.tilt + C, X = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      nt(X, { x: k, y: d }, 150, 2 * 0.72 * Math.sqrt(150), h), o.rotateX = X.position.x, o.rotateZ = X.position.y, o.rotateVX = X.velocity.x, o.rotateVZ = X.velocity.y;
    } else {
      const y = {
        position: { x: o.rotateX, y: o.rotateZ },
        velocity: { x: o.rotateVX, y: o.rotateVZ }
      };
      nt(y, { x: 0, y: 0 }, 150, 2 * 0.82 * Math.sqrt(150), h), o.rotateX = y.position.x, o.rotateZ = y.position.y, o.rotateVX = y.velocity.x, o.rotateVZ = y.velocity.y;
    }
    if (F(), e === "follow") {
      a = requestAnimationFrame(M);
      return;
    }
    if (m === "settle" && Math.abs(i.x - o.x) < n.position && Math.abs(i.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      c = !1, a = null, (A = t.onArrived) == null || A.call(t);
      return;
    }
    a = requestAnimationFrame(M);
  }
  let w = null, R = null;
  return {
    seed(p) {
      Object.assign(o, p);
    },
    setTarget(p) {
      i = { ...p };
    },
    retarget(p) {
      i = { ...p };
    },
    setProfile(p) {
      r = p;
    },
    getState() {
      return o;
    },
    start() {
      c || (c = !0, m = "settle", w = null, R = null, s = null, F(), a = requestAnimationFrame(M));
    },
    startCoastThenSettle(p) {
      if (c) return;
      c = !0, m = "coast", w = p, f = 0, R = null;
      const h = Math.hypot(o.vx, o.vy), v = p.maxDistance / Math.max(p.duration, 1 / 60);
      if (h > v && h > 0) {
        const P = v / h;
        o.vx *= P, o.vy *= P;
      }
      s = null, F(), a = requestAnimationFrame((P) => {
        R = P, M(P);
      });
    },
    interrupt() {
      return c = !1, a !== null && cancelAnimationFrame(a), a = null, { ...o };
    },
    cancel() {
      return c = !1, a !== null && cancelAnimationFrame(a), a = null, { ...o };
    },
    stop() {
      c = !1, a !== null && cancelAnimationFrame(a), a = null;
    }
  };
}
let Y = null;
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
function It(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Ot() {
  return (!Y || !Y.isConnected) && (Y = document.createElement("div"), Y.dataset.runtimeOverlay = "true", Object.assign(Y.style, {
    position: "fixed",
    inset: "0",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "2147483647"
  }), new MutationObserver((t) => {
    for (const e of t)
      for (const n of Array.from(e.removedNodes))
        n instanceof HTMLElement && n.dataset.runtimeProxy;
  }).observe(Y, { childList: !0 })), Y.parentElement !== document.documentElement && document.documentElement.appendChild(Y), Y;
}
function at(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function Dt(t, e = t.getBoundingClientRect()) {
  const n = t.cloneNode(!0);
  return n.classList.remove("kb-card-dragging-source"), n.style.position = "fixed", n.style.left = `${e.left}px`, n.style.top = `${e.top}px`, n.style.boxSizing = "border-box", n.style.width = `${e.width}px`, n.style.height = `${e.height}px`, n.style.margin = "0", n.style.zIndex = "1", n.style.pointerEvents = "none", n.style.visibility = "visible", n.style.display = "block", n.dataset.runtimeProxy = "true", n.style.transformOrigin = "0 0", n.style.transform = "scale(1.03)", n.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transition = "transform .15s ease, box-shadow .15s ease", Ot().appendChild(n), lt.add(n), n;
}
function ot(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function yt(t) {
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
function bt(t, e) {
  const n = getComputedStyle(e), o = parseFloat(n.paddingTop) || 0, i = parseFloat(n.paddingRight) || 0, r = parseFloat(n.paddingBottom) || 0, s = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${o}px`,
    right: `${i}px`,
    bottom: `${r}px`,
    pointerEvents: "none"
  }, c = document.createElement("div");
  for (Object.assign(c.style, { ...s }); t.firstChild; ) c.appendChild(t.firstChild);
  const u = yt(c), S = new Set(u.map(ot)), m = document.createElement("div");
  Object.assign(m.style, { ...s, pointerEvents: "" });
  const f = e.cloneNode(!0);
  for (f.style.visibility = "visible", f.style.display = ""; f.firstChild; ) m.appendChild(f.firstChild);
  const F = Vt(e);
  It(m, F);
  const M = yt(m), w = new Set(M.map(ot)), R = M.filter((v) => !S.has(ot(v)));
  for (const v of R) v.style.opacity = "0";
  const p = u.filter((v) => !w.has(ot(v))), h = new Set(p);
  for (const v of u)
    h.has(v) || (v.style.opacity = "0");
  return t.appendChild(m), p.length > 0 && t.appendChild(c), { enteringEls: R, leavingEls: p };
}
function Pe(t, e, n = {}) {
  const o = n.duration ?? H.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, c = n.targetOpacity, u = n.targetContent ? bt(t, n.targetContent) : null;
  if (u) {
    for (const d of u.enteringEls) d.style.transition = `opacity ${o}ms ${i}`;
    for (const d of u.leavingEls) d.style.transition = `opacity ${o}ms ${i}`;
  }
  const S = parseFloat(t.style.left) || 0, m = parseFloat(t.style.top) || 0;
  let f = !1, F = e;
  const M = performance.now();
  let w = () => {
  }, R = () => {
  };
  const p = new Promise((d) => {
    R = d;
  }), h = () => {
    const d = t.getBoundingClientRect();
    return Math.abs(d.left - F.left) < 2 && Math.abs(d.top - F.top) < 2 && Math.abs(d.width - F.width) < 2 && Math.abs(d.height - F.height) < 2;
  };
  let v = null, P = null, A = 0;
  const y = 60, $ = (d) => {
    f || (f = !0, t.removeEventListener("transitionend", w), P !== null && (window.clearTimeout(P), P = null), R());
  }, b = () => {
    if (!f) {
      if (h()) {
        $();
        return;
      }
      if (performance.now() - M >= o + 500) {
        $();
        return;
      }
      window.requestAnimationFrame(b);
    }
  }, T = (d, C = o) => {
    F = d;
    const k = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${k.width.toFixed(2)}px`, t.style.height = `${k.height.toFixed(2)}px`, t.style.transform = `translate3d(${(k.left - S).toFixed(2)}px, ${(k.top - m).toFixed(2)}px, 0)`, t.offsetWidth;
    const X = `translate3d(${(d.left - S).toFixed(2)}px, ${(d.top - m).toFixed(2)}px, 0)`;
    t.style.transition = [
      `transform ${C}ms ${i}`,
      `width ${C}ms ${i}`,
      `height ${C}ms ${i}`,
      `box-shadow ${C}ms ease`,
      `border-radius ${C}ms ease`,
      `background-color ${C}ms ease`,
      `opacity ${C}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = X, t.style.width = `${d.width.toFixed(2)}px`, t.style.height = `${d.height.toFixed(2)}px`, r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.background = s), c != null && (t.style.opacity = c), u) {
        for (const q of u.enteringEls) q.style.opacity = "1";
        for (const q of u.leavingEls) q.style.opacity = "0";
      }
    });
  };
  w = (d) => {
    d.target !== t || !(d.propertyName === "transform" || d.propertyName === "width" || d.propertyName === "height") || h() && $(`transitionend:${d.propertyName}`);
  }, t.addEventListener("transitionend", w), T(e), window.setTimeout(b, o + 40);
  const L = (d) => {
    var k;
    A = performance.now();
    const C = Math.max(80, o - (A - M));
    T(((k = n.readTarget) == null ? void 0 : k.call(n)) ?? d, C);
  };
  return { finished: p, retarget: (d) => {
    if (f) return;
    const C = Math.abs(d.left - F.left), k = Math.abs(d.top - F.top), X = Math.abs(d.width - F.width), q = Math.abs(d.height - F.height);
    if (C < 0.5 && k < 0.5 && X < 0.5 && q < 0.5) return;
    const _ = performance.now() - A;
    if (_ >= y) {
      L(d);
      return;
    }
    v = d, P === null && (P = window.setTimeout(() => {
      if (P = null, f || !v) return;
      const Z = v;
      v = null, L(Z);
    }, y - _));
  } };
}
function Le(t, e, n = {}) {
  var z, d, C, k, X, q, _, Z, Q, tt, et, W, x, g;
  const o = n.duration ?? H.landing.duration, i = n.easing ?? "cubic-bezier(.22,1,.36,1)", r = n.targetShadow, a = n.targetRadius, s = n.targetBackground, c = n.targetOpacity, u = n.targetContent ? bt(t, n.targetContent) : null;
  if (u) {
    for (const l of u.enteringEls) l.style.transition = `opacity ${o}ms ${i}`;
    for (const l of u.leavingEls) l.style.transition = `opacity ${o}ms ${i}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "none");
  const S = parseFloat(t.style.left) || t.getBoundingClientRect().left, m = parseFloat(t.style.top) || t.getBoundingClientRect().top, f = t.getBoundingClientRect(), F = f.width || e.width, M = f.height || e.height;
  let w = e, R = !1, p = null, h = 0, v = () => {
  };
  const P = new Promise((l) => {
    v = l;
  }), A = () => {
    R || (R = !0, y.stop(), p !== null && window.clearTimeout(p), p = null, v());
  }, y = vt({
    mode: "settle",
    onFrame: (l) => {
      t.style.transform = `perspective(760px) translate3d(${(l.x - S).toFixed(2)}px, ${(l.y - m).toFixed(2)}px, 0) rotateX(${l.rotateX.toFixed(2)}deg) rotateZ(${l.rotateZ.toFixed(2)}deg)`, t.style.width = `${(F * l.scaleX).toFixed(2)}px`, t.style.height = `${(M * l.scaleY).toFixed(2)}px`;
    },
    onArrived: A
  }), $ = Math.hypot(((z = n.motionState) == null ? void 0 : z.vx) ?? 0, ((d = n.motionState) == null ? void 0 : d.vy) ?? 0), b = n.releaseDamping ?? 0.78;
  y.setProfile($ > 30 ? {
    ...j,
    position: {
      ...j.position,
      damping: j.position.damping * b
    }
  } : j), y.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((C = n.motionState) == null ? void 0 : C.x) ?? f.left,
    y: ((k = n.motionState) == null ? void 0 : k.y) ?? f.top,
    vx: ((X = n.motionState) == null ? void 0 : X.vx) ?? 0,
    vy: ((q = n.motionState) == null ? void 0 : q.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((_ = n.motionState) == null ? void 0 : _.scaleX) ?? 1,
    scaleY: ((Z = n.motionState) == null ? void 0 : Z.scaleY) ?? 1,
    rotateX: ((Q = n.motionState) == null ? void 0 : Q.rotateX) ?? 0,
    rotateZ: ((tt = n.motionState) == null ? void 0 : tt.rotateZ) ?? 0,
    rotateVX: ((et = n.motionState) == null ? void 0 : et.rotateVX) ?? 0,
    rotateVZ: ((W = n.motionState) == null ? void 0 : W.rotateVZ) ?? 0
  }), y.setTarget({
    x: e.left,
    y: e.top,
    scaleX: e.width / F,
    scaleY: e.height / M
  }), t.style.transition = [
    `box-shadow ${o}ms ${i}`,
    `border-radius ${o}ms ${i}`,
    `background-color ${o}ms ${i}`,
    `opacity ${o}ms ${i}`
  ].join(", "), requestAnimationFrame(() => {
    if (!R && (r != null && (t.style.boxShadow = r), a != null && (t.style.borderRadius = a), s != null && (t.style.background = s), c != null && (t.style.opacity = c), u)) {
      for (const l of u.enteringEls) l.style.opacity = "1";
      for (const l of u.leavingEls) l.style.opacity = "0";
    }
  });
  const T = (l = 0) => {
    p !== null && window.clearTimeout(p), h = performance.now() + Math.max(2e3, o * 8, 5e3) + l, p = window.setTimeout(() => {
      p = null, !R && performance.now() >= h && A();
    }, Math.max(2e3, o * 8, 5e3) + l);
  };
  T();
  const L = n.coast;
  return L && L.maxDistance > 0 && Math.hypot(((x = n.motionState) == null ? void 0 : x.vx) ?? 0, ((g = n.motionState) == null ? void 0 : g.vy) ?? 0) > L.minVelocity ? y.startCoastThenSettle(L) : y.start(), {
    finished: P,
    retarget(l) {
      R || (w = l, T(1e3), y.setTarget({
        x: w.left,
        y: w.top,
        scaleX: w.width / F,
        scaleY: w.height / M
      }));
    }
  };
}
function mt(t) {
  lt.has(t) && (lt.delete(t), t.remove());
}
const st = /* @__PURE__ */ new WeakMap();
function zt(t, e) {
  st.set(t, { style: t.getAttribute("style") ?? "" }), t.style.position = "fixed", t.style.left = `${e.left}px`, t.style.top = `${e.top}px`, t.style.width = `${e.width}px`, t.style.height = `${e.height}px`, t.style.margin = "0", t.style.zIndex = "1000", t.style.boxSizing = "border-box", t.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", t.style.transform = "scale(1.03)", t.style.transition = "transform .15s ease, box-shadow .15s ease";
}
function rt(t) {
  const e = st.get(t);
  t.setAttribute("style", (e == null ? void 0 : e.style) ?? ""), st.delete(t);
}
function pt(t) {
  t.style.position = "", t.style.left = "", t.style.top = "", t.style.width = "", t.style.height = "", t.style.margin = "", t.style.transform = "", t.style.visibility = "hidden";
}
const lt = /* @__PURE__ */ new Set(), J = /* @__PURE__ */ new Map();
function ke(t, e) {
  J.set(t, e), t.style.visibility = "hidden";
}
function Xe(t, e) {
  const n = J.get(t) === e;
  return n && (t.style.visibility = "", J.delete(t)), n;
}
function qt(t, e) {
  J.get(t) === e && J.delete(t);
}
const Nt = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textTransform",
  "direction",
  "writingMode"
];
function Yt(t) {
  const e = getComputedStyle(t);
  return Object.fromEntries(
    Nt.map((n) => [n, e[n]])
  );
}
function Bt(t, e) {
  Object.assign(t.style, e);
}
function _t(t, e) {
  Bt(e, Yt(t));
}
function gt(t, e) {
  const n = t.getBoundingClientRect();
  return e.x >= n.left && e.x <= n.right && e.y >= n.top && e.y <= n.bottom;
}
function Zt(t) {
  return {
    findSurface(e) {
      return Array.from(document.querySelectorAll(t.surfaceSelector)).find((n) => gt(n, e)) ?? null;
    },
    findTarget(e, n, o) {
      return Array.from(e.querySelectorAll(t.targetSelector)).filter((i) => i.dataset.card !== o).find((i) => gt(i, n)) ?? null;
    },
    findIndex(e, n, o) {
      const i = Array.from(e.querySelectorAll(t.targetSelector)).filter((r) => r.dataset.card !== o);
      for (let r = 0; r < i.length; r += 1) {
        const a = i[r].getBoundingClientRect();
        if (n.y < a.top + a.height / 2) return r;
      }
      return i.length;
    }
  };
}
function Ht(t, e, n, o) {
  const i = t.findSurface({ x: e, y: n });
  if (!i) return null;
  const r = i.dataset.column;
  if (!r) return null;
  const a = t.findIndex(i, { x: e, y: n }, o);
  return { columnId: r, index: a };
}
function Wt(t, e = {}) {
  const n = e.edgeSize ?? 48, o = e.maxSpeed ?? 16;
  let i = null, r = null, a = null, s = !1;
  const c = (m) => {
    const f = (n - m) / n;
    return Math.ceil(o * f);
  }, u = () => {
    var M, w;
    if (s || (a = requestAnimationFrame(u), !i || !r || !i.isConnected)) return;
    const m = i.getBoundingClientRect();
    if (r.x < m.left || r.x > m.right) return;
    const f = r.y - m.top, F = m.bottom - r.y;
    f < n ? (i.scrollTop -= c(f), (M = e.onScroll) == null || M.call(e, r)) : F < n && (i.scrollTop += c(F), (w = e.onScroll) == null || w.call(e, r));
  }, S = () => {
    s || (s = !0, a !== null && cancelAnimationFrame(a), a = null);
  };
  return a = requestAnimationFrame(u), t.track(S), {
    update(m, f) {
      s || (i = m, r = f);
    },
    stop: S
  };
}
const G = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap();
function wt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [o, i, r, a] = n;
  return (s) => {
    let c = 0, u = 1;
    for (let m = 0; m < 12; m += 1) {
      const f = (c + u) / 2;
      3 * (1 - f) ** 2 * f * o + 3 * (1 - f) * f ** 2 * r + f ** 3 < s ? c = f : u = f;
    }
    const S = (c + u) / 2;
    return 3 * (1 - S) ** 2 * S * i + 3 * (1 - S) * S ** 2 * a + S ** 3;
  };
}
function Ft(t) {
  const e = G.get(t);
  e && (cancelAnimationFrame(e.frame), G.delete(t), t.style.transform = "");
}
function jt(t, e, n, o, i, r) {
  Ft(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: wt(i)
  };
  G.set(t, a);
  const s = (c) => {
    if (G.get(t) !== a) return;
    const u = Math.min(1, (c - a.started) / a.duration), S = a.easing(u);
    if (t.style.transform = `translate(${(a.fromX * (1 - S)).toFixed(3)}px, ${(a.fromY * (1 - S)).toFixed(3)}px)`, u >= 1) {
      G.delete(t), t.style.transform = "", r == null || r();
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
function Rt(t) {
  const e = U.get(t);
  e && (cancelAnimationFrame(e.frame), U.delete(t), t.style.height = "");
}
function Gt(t, e, n, o, i, r) {
  Rt(t);
  const a = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: wt(i)
  };
  U.set(t, a);
  const s = (c) => {
    if (U.get(t) !== a) return;
    const u = Math.min(1, (c - a.started) / a.duration), S = a.fromX + (a.fromY - a.fromX) * a.easing(u);
    if (t.style.height = `${S}px`, u >= 1) {
      U.delete(t);
      return;
    }
    a.frame = requestAnimationFrame(s);
  };
  a.frame = requestAnimationFrame(s);
}
const ct = H.flip.duration, ut = H.flip.easing;
function Ut(t) {
  const e = /* @__PURE__ */ new Map();
  return t.forEach((n) => e.set(n, n.getBoundingClientRect())), e;
}
function At(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0) {
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, Ft(n), n.style.setProperty("transition", "none", "important");
    e[0].offsetHeight;
  }
}
function Jt(t, e, n = ct, o = ut) {
  At(t);
  for (const i of t) {
    if (i.dataset.runtimeProxy === "true" || i.dataset.runtimePlaceholder === "true" || i.dataset.runtimeActive === "true") continue;
    const r = e.get(i);
    if (!r) continue;
    const a = i.getBoundingClientRect(), s = r.left - a.left, c = r.top - a.top;
    if (Math.abs(s) < 0.5 && Math.abs(c) < 0.5) {
      i.style.transition = "";
      continue;
    }
    i.style.setProperty("transition", "none", "important"), i.style.transform = `translate(${s}px, ${c}px)`;
    const u = String(Number(i.dataset.runtimeFlipToken ?? "0") + 1);
    i.dataset.runtimeFlip = "true", i.dataset.runtimeFlipToken = u, i.offsetHeight, jt(i, s, c, n, o, () => {
      i.dataset.runtimeFlipToken === u && (i.style.transition = "", delete i.dataset.runtimeFlip);
    });
  }
}
let Tt = null;
function Ve(t) {
  Tt = t;
}
function Ct() {
  const t = Tt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? H.flip,
    resize: (t == null ? void 0 : t.resize) ?? H.resize
  };
}
function Kt(t, e) {
  const n = Array.from(e.querySelectorAll("[data-layout-group]")), o = [], i = [];
  for (const r of t)
    r.closest("[data-layout-group]") !== null ? o.push(r) : i.push(r);
  return { groups: n, groupLeaves: o, flatCards: i };
}
function dt(t, e = document) {
  const n = Array.from(e.querySelectorAll("[data-layout-surface]")).map((c) => ({ element: c, rect: K(c), inlineStyle: $t(c) }));
  Mt(n);
  const { groups: o, groupLeaves: i, flatCards: r } = Kt(t, e), a = se(Array.from(e.querySelectorAll("[data-layout-surface]"))), s = {
    root: e,
    group: o.length > 0 ? { before: ie([...o, ...i]) } : void 0,
    flat: r.length > 0 ? { elements: r, before: Ut(r) } : void 0,
    surfaces: a
  };
  return te(e, s);
}
function Qt(t) {
  const e = Ct();
  t.group && ae(t.group.before, e.flip.duration, e.flip.easing), t.flat && Jt(t.flat.elements, t.flat.before, e.flip.duration, e.flip.easing), le(t.surfaces, e.resize.duration, e.resize.easing);
}
function ft(t) {
  it.set(t.root, t), requestAnimationFrame(() => {
    it.get(t.root) === t && (it.delete(t.root), Qt(t));
  });
}
function te(t, e) {
  const n = it.get(t);
  if (!n) return e;
  const o = oe(e.surfaces, n.surfaces), i = ee(e.flat, n.flat), r = ne(e.group, n.group);
  return { ...e, flat: i, group: r, surfaces: o };
}
function ee(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const i = e.before.get(o);
    i && n.set(o, i);
  }
  return { ...t, before: n };
}
function ne(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function oe(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const i = n.get(o.element);
    return i ? { ...o, rect: i.rect, inlineStyle: i.inlineStyle } : o;
  });
}
const it = /* @__PURE__ */ new WeakMap();
function K(t) {
  const e = t.getBoundingClientRect();
  return { top: e.top, left: e.left, width: e.width, height: e.height };
}
function ie(t) {
  const e = new Set(t);
  return t.map((n) => ({
    element: n,
    parent: re(n, e),
    rect: K(n)
  }));
}
function re(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function ae(t, e = ct, n = ut) {
  At(t.map((i) => i.element));
  const o = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = K(i.element);
    o.set(i.element, {
      x: i.rect.left - r.left,
      y: i.rect.top - r.top
    });
  }
  for (const i of t) {
    const r = o.get(i.element), a = i.parent ? o.get(i.parent) : void 0, s = r.x - ((a == null ? void 0 : a.x) ?? 0), c = r.y - ((a == null ? void 0 : a.y) ?? 0);
    if (i.element.dataset.runtimeProxy === "true" || i.element.dataset.runtimePlaceholder === "true" || i.element.dataset.runtimeActive === "true" || Math.abs(s) < 0.5 && Math.abs(c) < 0.5) {
      i.element.style.transition = "";
      continue;
    }
    i.element.style.transform = `translate(${s}px, ${c}px)`, i.element.style.transition = "none";
    const u = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = u, requestAnimationFrame(() => {
      i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    }), window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip);
    }, e + 40);
  }
}
function se(t) {
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
function le(t, e = ct, n = ut) {
  var i;
  Mt(t);
  const o = t.filter((r) => r.element.isConnected).map((r) => {
    const a = K(r.element);
    r.element.dataset.surfaceType;
    const s = Ct();
    return {
      item: r,
      next: a,
      profile: s.resize,
      fromHeight: ht(r.element, r.rect.height),
      toHeight: ht(r.element, a.height)
    };
  }).filter(({ item: r, next: a }) => Math.abs(r.rect.height - a.height) >= 0.5);
  for (const { item: r, fromHeight: a } of o) {
    const s = r.element.style, c = {
      baseStyle: ((i = B.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++ce)
    };
    B.set(r.element, c), s.overflow = "hidden", s.transition = "none", s.height = `${a}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = c.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: a, toHeight: s, profile: c } of o) {
      const u = r.element.style, S = B.get(r.element);
      if (!S || r.element.dataset.runtimeSurfaceResizeToken !== S.token) continue;
      const m = S.token;
      u.transition = "none", Gt(r.element, a, s, c.duration, c.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== m) return;
        const f = B.get(r.element);
        !f || f.token !== m || (Et(r.element, f.baseStyle), B.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, c.duration + 40);
    }
  });
}
function Mt(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0) {
    for (const { element: n } of e) {
      const o = B.get(n);
      o && (Rt(n), Et(n, o.baseStyle), B.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
    e[0].element.offsetHeight;
  }
}
const B = /* @__PURE__ */ new WeakMap();
let ce = 0;
function $t(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function Et(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function ht(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
function ue(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function de(t, e, n, o) {
  const i = o ?? e.getBoundingClientRect(), r = o ? n.clientX - i.left : t.dragOffset.x, a = o ? n.clientY - i.top : t.dragOffset.y;
  return o && (t.dragOffset = { x: r, y: a }), { rect: i, offsetX: r, offsetY: a };
}
function fe(t, e, n, o, i) {
  n.style.transform = "", zt(n, o), document.body.classList.add("kb-dragging"), i && (n.style.transition = "none"), t(e, n, {
    phase: "dragging",
    hovered: n.matches(":hover"),
    selected: n.classList.contains("is-selected"),
    grabbed: !0
  });
}
function ye(t) {
  const e = t.cloneNode(!0), n = Array.from(document.querySelectorAll("[data-card]")).filter((o) => o !== t && o.dataset.runtimeProxy !== "true");
  return { beforeContent: e, beforePickup: dt(n) };
}
function me(t, e, n) {
  let o = t, i = null;
  return {
    update(r, a) {
      const s = e(r);
      return !s || n(s, i) || (o = a(s), i = s), i;
    },
    release() {
      return i;
    },
    get currentSurface() {
      return o;
    }
  };
}
function pe(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function ge(t) {
  t.event.stopPropagation(), at(t.proxy, !1), t.clearRegrab(), qt(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden", t.disposeProxy();
}
function he(t) {
  document.body.classList.remove("kb-dragging");
  const e = Array.from(document.querySelectorAll("[data-card]")).filter((o) => o !== t.source && o.dataset.runtimeProxy !== "true"), n = dt(e);
  t.cancel(), t.clearFloating(t.source), t.clearActive(), t.releaseObject(), ft(n);
}
function xe(t) {
  const e = t.source.getBoundingClientRect();
  return t.settle(t.source), t.clearActive(), t.releaseObject(), e;
}
function Se(t, e) {
  return () => requestAnimationFrame(() => {
    t(), e();
  });
}
function ve(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function be(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function we(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function Fe(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function Re(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function Ae(t, e) {
  return t() ?? e();
}
function Te(t) {
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
function Ce(t) {
  let e = 0;
  return {
    capture: () => (e += 1, dt(
      Array.from(document.querySelectorAll("[data-card]")).filter((n) => n !== t && n.dataset.runtimeProxy !== "true")
    )),
    play: (n, o) => {
      const i = ++e;
      requestAnimationFrame(() => {
        i === e && ft(o);
      });
    }
  };
}
function Me(t, e) {
  const n = t.getBoundingClientRect(), o = e.getBoundingClientRect();
  if (o.top < n.top) {
    const i = -(n.top - o.top);
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  } else if (o.bottom > n.bottom) {
    const i = o.bottom - n.bottom;
    t.scrollTo({ top: t.scrollTop + i, behavior: "smooth" });
  }
}
function Ie(t) {
  var W;
  const { runtime: e, objectId: n, element: o, event: i, fromRect: r, returnRect: a } = t, s = e.objects.get(n), c = e.surfaces.snapshot(), u = c.map((x) => x.id), S = (x) => {
    var g;
    return (g = e.objects.get(x)) == null ? void 0 : g.surfaceId;
  }, m = (s == null ? void 0 : s.surfaceId) ?? ((W = c[0]) == null ? void 0 : W.id), f = Zt({ surfaceSelector: "[data-column]", targetSelector: "[data-card]" });
  let F, M, w, R = null, p = null, h = null, v = null, P = !1, A = null, y = null, $ = null, b = null, T, L = { x: 0, y: 0 }, z = null, d = null, C = 0, k = !1;
  function X() {
    var x;
    return A ? (x = e.getSession(A)) == null ? void 0 : x.state : void 0;
  }
  function q(x, g) {
    if (X() !== "active" || !w) return;
    const l = pe({
      active: X() === "active",
      event: { clientX: x, clientY: g },
      state: w,
      getSurface: (V) => V.columnId
    });
    l && (R = l);
  }
  function _(x) {
    k = !0, b == null || b.setTarget({
      x: x.clientX - L.x,
      y: x.clientY - L.y
    }), q(x.clientX, x.clientY), $ == null || $.update(
      (e.getHitResolver() ?? f).findSurface({ x: x.clientX, y: x.clientY }),
      { x: x.clientX, y: x.clientY }
    );
  }
  function Z() {
    if (P) return { accepted: !1 };
    if (P = !0, T = b ? { ...b.getState() } : void 0, T) {
      const g = St({ x: T.vx, y: T.vy });
      T.vx = g.x, T.vy = g.y;
    }
    if (b == null || b.stop(), b = null, $ == null || $.stop(), !w || !A) return { accepted: !1 };
    if (R = w.release(), !R && !k && T && Math.hypot(T.vx, T.vy) < 0.5) {
      const g = o.closest("[data-column]") ?? (m ? document.querySelector(`[data-column="${CSS.escape(m.replace(/^column:/, ""))}"]`) : null), l = g == null ? void 0 : g.dataset.column;
      if (g && l) {
        const V = Array.from(g.querySelectorAll("[data-card]")).filter((D) => D !== o && D.dataset.runtimeProxy !== "true");
        R = { columnId: l, index: d ?? V.length };
      }
    }
    if (!R) {
      const g = o.style.visibility, l = Dt(o, o.getBoundingClientRect()), V = ++C;
      l.dataset.runtimeCancelProxy = "true", _t(o, l);
      const D = getComputedStyle(o);
      l.style.width = D.width, l.style.height = D.height, l.style.transition = "none", o.style.visibility = "hidden";
      const N = z;
      return requestAnimationFrame(() => {
        N && (l.style.transition = "left 250ms cubic-bezier(.22,1,.36,1), top 250ms cubic-bezier(.22,1,.36,1), transform 250ms cubic-bezier(.22,1,.36,1), box-shadow 250ms cubic-bezier(.22,1,.36,1)", l.style.left = `${N.left}px`, l.style.top = `${N.top}px`, l.style.transform = "scale(1)", l.style.boxShadow = getComputedStyle(o).boxShadow);
      }), window.setTimeout(() => {
        C === V && (mt(l), o.style.visibility = g);
      }, 290), he({
        source: o,
        cancel: () => e.cancel(A, "no-valid-drop"),
        clearFloating: rt,
        clearActive: () => delete o.dataset.runtimeActive,
        releaseObject: () => y == null ? void 0 : y.release()
      }), o.style.visibility = "hidden", { accepted: !1 };
    }
    const x = xe({
      source: o,
      settle: pt,
      clearActive: () => delete o.dataset.runtimeActive,
      releaseObject: () => y == null ? void 0 : y.release()
    });
    return p = Se(() => rt(o), () => {
      const g = A, l = ve({
        resolve: () => e.resolveMoveTarget(g, R, () => document.querySelector(`[data-card="${n}"]`) ?? null),
        applyState: (I) => e.applyVisualState(n, I, { phase: "revealing", hovered: !1, selected: I.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!l) {
        h == null || h.complete({ completed: !0, reason: "" }), h = null;
        return;
      }
      const V = l.closest("[data-column]");
      V && Me(V, l);
      const D = be((I) => e.captureVisualState(n, I), l), N = we({
        createContext: () => e.createVisualLifecycleContext(g, R, l, F),
        source: o,
        sourceRect: x,
        visualSnapshot: M,
        targetSnapshot: D,
        motionState: T
      });
      v = Fe({
        createProxy: () => e.createVisualProxy(g, N) ?? null,
        enableProxy: (I) => at(I, !0),
        bindRegrab: (I) => e.bindRegrabTarget(g, n, I, Q),
        land: () => e.landVisualProxy(g, l, N),
        onMissing: () => {
          h == null || h.complete({ completed: !1, reason: "visual-proxy-missing" }), h = null;
        },
        onComplete: (I) => {
          Re({ active: X() === "landing", result: I, complete: (E) => h == null ? void 0 : h.complete(E), reveal: () => {
            e.revealVisualProxy(g, l, N);
          } }), h = null;
        }
      });
    }), { accepted: !0, destination: R };
  }
  function Q(x) {
    if (X() !== "landing") return;
    const g = v;
    if (!g || !A) return;
    const l = Ae(
      () => e.resolveVisualTarget(A, R),
      () => document.querySelector(`[data-card="${n}"]`)
    );
    if (!l) return;
    const V = e.createRegrabContext(A, x, g, l);
    if (!V) return;
    ge({
      event: V.event,
      sessionId: A,
      proxy: g,
      source: l,
      interrupt: () => V.interrupt("regrab"),
      clearRegrab: () => e.clearRegrab(n),
      disposeProxy: () => e.disposeVisualProxy(A)
    });
    const D = l.getBoundingClientRect();
    e.startObjectPointer(n, l, x, V.proxyRect, D);
  }
  const tt = {
    prepare(x) {
      if (A = x.session.id, k = !1, document.querySelectorAll('[data-runtime-cancel-proxy="true"]').forEach(mt), C += 1, $ = Wt(x.session.cleanup, {
        onScroll: (E) => q(E.x, E.y)
      }), x.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", y = e.acquireObject(A, n), e.takeSurfaces(A, u);
      const { beforePickup: g } = ye(o), l = o.closest("[data-column]");
      l && (d = Array.from(l.querySelectorAll("[data-card]")).filter((O) => O.dataset.runtimeProxy !== "true").findIndex((O) => O === o)), F = o.cloneNode(!0), ft(g);
      const V = e.getMoveContext(A), D = de(V, o, i, r), N = D.rect;
      L = { x: D.offsetX, y: D.offsetY }, fe((E, O, Pt) => e.applyVisualState(n, O, Pt), n, o, N, r), o.style.transition = "none", M = ue((E, O) => e.captureVisualState(n, O), n, o), o.dataset.runtimeActive = "true", b = vt({
        mode: "follow",
        followRotation: kt,
        onFrame: (E) => {
          o.style.left = `${E.x}px`, o.style.top = `${E.y}px`, o.style.transform = `perspective(760px) rotateX(${E.rotateX.toFixed(2)}deg) rotateZ(${E.rotateZ.toFixed(2)}deg) scale(${E.scaleX.toFixed(4)}, ${E.scaleY.toFixed(4)})`;
        }
      }), b.setProfile(Lt);
      const I = a ?? N;
      z = { left: I.left, top: I.top, width: I.width, height: I.height }, b.seed({ x: N.left, y: N.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 }), b.setTarget({ x: i.clientX - L.x, y: i.clientY - L.y }), b.start(), w = me(
        S(n),
        (E) => Ht(e.getHitResolver() ?? f, E.clientX, E.clientY, n),
        (E, O) => E.columnId === (O == null ? void 0 : O.columnId) && E.index === (O == null ? void 0 : O.index)
      ), q(i.clientX, i.clientY);
    },
    update(x, g) {
      g.event instanceof PointerEvent && _(g.event);
    },
    resolveDestination() {
      return Z();
    },
    commit: () => {
      pt(o), document.body.classList.remove("kb-dragging");
    },
    cancel(x, g) {
      P = !0, b == null || b.stop(), b = null, v && (e.disposeVisualProxy(A), v = null), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, rt(o);
    }
  }, et = {
    layout: Ce(o),
    ...Te({
      createGate: () => e.createCompletionGate(A, { completed: !1, reason: "landing-cancelled" }),
      onGate: (x) => {
        h = x;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        p == null || p(), p = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        v && at(v, !1);
      }
    })
  };
  return { driver: tt, lifecycle: et };
}
export {
  xt as D,
  Lt as F,
  j as L,
  ke as a,
  Le as b,
  Dt as c,
  H as d,
  mt as e,
  Ie as f,
  $e as g,
  kt as h,
  Ee as i,
  vt as j,
  Zt as k,
  Pe as l,
  Ht as m,
  nt as n,
  Ot as o,
  _t as p,
  St as q,
  Xe as r,
  Ve as s
};
