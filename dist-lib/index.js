class tt {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
  }
  subscribe(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  emit(t) {
    this.listeners.forEach((e) => e(t));
  }
}
class Dt {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new tt();
  }
  subscribe(t) {
    return this.events.subscribe(t);
  }
  takeObject(t, e) {
    this.controlled.set(t, { mode: "runtime", ownerSessionId: e }), this.events.emit(t);
    let s = !1;
    return {
      release: () => {
        if (s) return;
        s = !0;
        const n = this.controlled.get(t);
        (n == null ? void 0 : n.ownerSessionId) === e && (this.controlled.delete(t), this.events.emit(t));
      }
    };
  }
  takeSurface(t, e) {
    const s = this.controlled.get(t);
    return s && s.ownerSessionId !== e ? { release: () => {
    } } : this.takeObject(t, e);
  }
  isControlled(t) {
    var e;
    return ((e = this.controlled.get(t)) == null ? void 0 : e.mode) === "runtime";
  }
  isOwnedBy(t, e) {
    var s;
    return ((s = this.controlled.get(t)) == null ? void 0 : s.ownerSessionId) === e;
  }
  takeChannel(t, e, s) {
    let n = this.channelOwners.get(t);
    n || (n = /* @__PURE__ */ new Map(), this.channelOwners.set(t, n)), n.set(e, s);
    let r = !1;
    return {
      release: () => {
        r || (r = !0, n.get(e) === s && (n.delete(e), n.size === 0 && this.channelOwners.delete(t)));
      }
    };
  }
  ownsChannel(t, e, s) {
    var n;
    return ((n = this.channelOwners.get(t)) == null ? void 0 : n.get(e)) === s;
  }
}
class qt {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new tt();
  }
  register(t) {
    this.items.set(t.id, t), this.events.emit({ type: "object-added", id: t.id });
  }
  unregister(t) {
    const e = this.items.delete(t);
    return e && this.events.emit({ type: "object-removed", id: t }), e;
  }
  get(t) {
    return this.items.get(t);
  }
  has(t) {
    return this.items.has(t);
  }
  values() {
    return this.items.values();
  }
  snapshot() {
    return [...this.items.values()];
  }
  subscribe(t) {
    return this.events.subscribe(t);
  }
  hasAbility(t, e) {
    var s;
    return ((s = this.items.get(t)) == null ? void 0 : s.abilities.includes(e)) ?? !1;
  }
  setElement(t, e) {
    const s = this.items.get(t);
    s && s.element !== e && (s.element = e, this.events.emit({ type: "object-changed", id: t }));
  }
  setSurface(t, e) {
    const s = this.items.get(t);
    s && s.surfaceId !== e && (s.surfaceId = e, this.events.emit({ type: "object-changed", id: t }));
  }
}
class Nt {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new tt();
  }
  register(t) {
    this.items.set(t.id, t), this.events.emit({ type: "surface-added", id: t.id });
  }
  unregister(t) {
    const e = this.items.delete(t);
    return e && this.events.emit({ type: "surface-removed", id: t }), e;
  }
  get(t) {
    return this.items.get(t);
  }
  has(t) {
    return this.items.has(t);
  }
  values() {
    return this.items.values();
  }
  snapshot() {
    return [...this.items.values()];
  }
  subscribe(t) {
    return this.events.subscribe(t);
  }
  setElement(t, e) {
    const s = this.items.get(t);
    s && s.element !== e && (s.element = e, this.events.emit({ type: "surface-changed", id: t }));
  }
  /** 空 accepts 数组表示不限制类型。 */
  accepts(t, e) {
    const s = this.items.get(t);
    return s ? s.accepts.length === 0 || s.accepts.includes(e) : !1;
  }
}
class Yt {
  constructor() {
    this.items = /* @__PURE__ */ new Map();
  }
  register(t) {
    if (this.items.has(t.type)) throw new Error(`Behavior already exists: ${t.type}`);
    this.items.set(t.type, t);
  }
  get(t) {
    return this.items.get(t);
  }
  has(t) {
    return this.items.has(t);
  }
}
class Gt {
  constructor() {
    this.phase = "prepare", this.source = null, this.destination = null, this.target = null, this.actionEmitted = !1, this.tokenValue = 0;
  }
  get token() {
    return this.tokenValue;
  }
  setPhase(t) {
    this.phase = t;
  }
  invalidate() {
    return this.tokenValue += 1, this.tokenValue;
  }
  isCurrent(t) {
    return t === this.tokenValue && this.phase !== "cancelled" && this.phase !== "disposed";
  }
}
class W {
  constructor(t = {}) {
    this.driver = t, this.type = "move", this.sessionDrivers = /* @__PURE__ */ new Map(), this.sessionLifecycles = /* @__PURE__ */ new Map(), this.contexts = /* @__PURE__ */ new Map(), this.landingRegrabs = /* @__PURE__ */ new Map();
  }
  registerRegrab(t, e) {
    this.landingRegrabs.set(t, e);
  }
  getRegrab(t) {
    return this.landingRegrabs.get(t);
  }
  clearRegrab(t, e) {
    e && this.landingRegrabs.get(t) !== e || this.landingRegrabs.delete(t);
  }
  setDriver(t) {
    this.driver = t;
  }
  bindSession(t, e) {
    this.sessionDrivers.set(t, e);
  }
  unbindSession(t) {
    this.sessionDrivers.delete(t), this.sessionLifecycles.delete(t), this.contexts.delete(t);
  }
  bindLifecycle(t, e) {
    this.sessionLifecycles.set(t, e);
  }
  getLifecycle(t) {
    return this.sessionLifecycles.get(t);
  }
  captureLayout(t) {
    var n, r, o;
    const e = this.getContext(t.session.id), s = (o = (r = (n = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : n.layout) == null ? void 0 : r.capture) == null ? void 0 : o.call(r, t);
    e.layoutSnapshot = s;
  }
  playLayout(t) {
    var n, r;
    const e = this.getContext(t.session.id), s = this.sessionLifecycles.get(t.session.id);
    e.layoutSnapshot !== void 0 && ((r = (n = s == null ? void 0 : s.layout) == null ? void 0 : n.play) == null || r.call(n, t, e.layoutSnapshot));
  }
  cancelLayout(t, e) {
    var r, o, a;
    const s = this.getContext(t.session.id), n = s.layoutSnapshot;
    n !== void 0 && ((a = (o = (r = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : r.layout) == null ? void 0 : o.cancel) == null || a.call(o, t, n, e)), s.layoutSnapshot = void 0;
  }
  getContext(t) {
    let e = this.contexts.get(t);
    return e || (e = {
      transaction: new Gt(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(t, e)), e;
  }
  driverFor(t) {
    return this.sessionDrivers.get(t) ?? this.driver;
  }
  prepare(t, e) {
    var l, c, h, d, u;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("prepare");
    const n = ((c = (l = t.visual) == null ? void 0 : l.resolveSource) == null ? void 0 : c.call(l, e.objectId)) ?? null;
    s.sourceElement = n, s.transaction.source = n;
    const r = e.input.event instanceof PointerEvent ? e.input.event : null;
    if (n && r) {
      const y = n.getBoundingClientRect();
      s.dragOffset = {
        x: r.clientX - y.left,
        y: r.clientY - y.top
      };
    }
    const o = (d = (h = this.driverFor(t.session.id)).prepare) == null ? void 0 : d.call(h, t, e), a = this.sessionLifecycles.get(t.session.id);
    return o && typeof o.then == "function" ? Promise.resolve(o).then(async () => {
      var y;
      return (y = a == null ? void 0 : a.beginDrag) == null ? void 0 : y.call(a, t);
    }) : (u = a == null ? void 0 : a.beginDrag) == null ? void 0 : u.call(a, t);
  }
  update(t, e) {
    var r, o;
    if (t.session.state !== "active") return;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("active");
    const n = e.event instanceof PointerEvent ? e.event : null;
    n && s.followElement && (s.followElement.style.left = `${n.clientX - s.dragOffset.x}px`, s.followElement.style.top = `${n.clientY - s.dragOffset.y}px`), (o = (r = this.driverFor(t.session.id)).update) == null || o.call(r, t, e);
  }
  release(t, e) {
    var o;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("release");
    const n = this.driverFor(t.session.id);
    if (n.resolveDestination)
      return Promise.resolve(n.resolveDestination(t, e)).then((a) => (a != null && a.accepted && a.destination !== void 0 && (s.destination = a.destination, s.transaction.destination = a.destination), a));
    const r = (o = n.release) == null ? void 0 : o.call(n, t, e);
    return Promise.resolve(r).then((a) => (a != null && a.accepted && a.destination !== void 0 && (s.destination = a.destination, s.transaction.destination = a.destination), a));
  }
  commit(t, e) {
    this.getContext(t.session.id).transaction.setPhase("landing");
    const s = this.driverFor(t.session.id);
    if (s.commit)
      return s.commit(t, e);
  }
  cancel(t, e) {
    var n, r, o, a;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (n = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : n.cancel) == null || r.call(n, t, e), (a = (o = this.driverFor(t.session.id)).cancel) == null || a.call(o, t, e);
  }
  interrupt(t, e) {
    var n, r, o, a;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (n = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : n.cancel) == null || r.call(n, t, e), (a = (o = this.driverFor(t.session.id)).interrupt) == null || a.call(o, t, e);
  }
  dispose(t) {
    var s, n;
    const e = this.getContext(t.session.id).transaction;
    e.phase !== "cancelled" && e.setPhase("disposed"), (n = (s = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : s.dispose) == null || n.call(s, t), this.unbindSession(t.session.id);
  }
  landing(t, e) {
    var a;
    const s = this.getContext(t.session.id);
    if (s.transaction.setPhase("landing"), s.landingStarted)
      return s.landingPromise ?? { completed: s.landingCompleted === !0 };
    s.landingStarted = !0, s.destination = e;
    const n = this.sessionLifecycles.get(t.session.id), r = (a = n == null ? void 0 : n.landing) == null ? void 0 : a.call(n, t, e), o = Promise.resolve(r).then((l) => ((!l || l.completed) && (s.landingCompleted = !0), l));
    return s.landingPromise = o, o;
  }
  reveal(t, e) {
    var n, r;
    const s = this.getContext(t.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (r = (n = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : n.reveal) == null ? void 0 : r.call(n, t, e);
  }
}
const _ = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 250 }
}, G = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, _t = 8;
function Rt(i, t = G) {
  if (Math.hypot(i.x, i.y) < t.minVelocity) return { x: 0, y: 0 };
  const s = i.x * t.velocityScale, n = i.y * t.velocityScale, r = Math.hypot(s, n);
  if (r <= t.maxVelocity || r === 0) return { x: s, y: n };
  const o = t.maxVelocity / r;
  return { x: s * o, y: n * o };
}
function hs(i, t = G) {
  const e = Rt(i, t), s = Math.hypot(e.x, e.y) * t.coastSeconds;
  if (s <= 0 || t.maxCoast <= 0) return { x: 0, y: 0 };
  const n = Math.min(1, t.maxCoast / s);
  return { x: e.x * t.coastSeconds * n, y: e.y * t.coastSeconds * n };
}
function ot(i, t, e, s, n, r = 1 / 120) {
  let o = Math.max(0, n);
  for (; o > 1e-4; ) {
    const a = Math.min(o, r);
    o -= a;
    const l = e * (t.x - i.position.x) - s * i.velocity.x, c = e * (t.y - i.position.y) - s * i.velocity.y;
    i.velocity.x += l * a, i.velocity.y += c * a, i.position.x += i.velocity.x * a, i.position.y += i.velocity.y * a;
  }
}
const U = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Mt = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, At = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Ht = { position: 0.35, velocity: 5 };
function Ft(i) {
  const t = i.mode ?? "settle";
  if (t === "follow" && !i.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const e = i.arriveThreshold ?? Ht, s = {
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
  let n = { x: 0, y: 0 }, r = U, o = null, a = null, l = !1, c = 0, h = 0, d = "settle", u = 0;
  function y() {
    i.onFrame({
      x: s.x,
      y: s.y,
      scaleX: s.scaleX,
      scaleY: s.scaleY,
      rotateX: s.rotateX,
      rotateZ: s.rotateZ
    });
  }
  function M(v) {
    var A;
    if (!l) return;
    const b = Math.min(0.032, a == null ? 1 / 60 : Math.max(0, (v - a) / 1e3));
    if (a = v, d === "coast") {
      const m = Math.exp(-g.friction * b);
      s.vx *= m, s.vy *= m;
      const P = s.vx * b, C = s.vy * b, F = u + Math.hypot(P, C);
      if (F >= g.maxDistance) {
        const E = Math.max(0, g.maxDistance - u), X = Math.hypot(P, C), p = X > 0 ? E / X : 0;
        s.x += P * p, s.y += C * p, s.vx = 0, s.vy = 0, d = "settle";
      } else
        s.x += P, s.y += C, u = F, ((v - (R ?? v)) / 1e3 >= g.duration || Math.hypot(s.vx, s.vy) <= g.minVelocity) && (d = "settle");
    }
    if (d === "settle") {
      const m = { position: { x: s.x, y: s.y }, velocity: { x: s.vx, y: s.vy } };
      ot(m, { x: n.x, y: n.y }, r.position.stiffness, r.position.damping, b), s.x = m.position.x, s.y = m.position.y, s.vx = m.velocity.x, s.vy = m.velocity.y;
    }
    const w = { position: { x: s.scaleX, y: s.scaleY }, velocity: { x: s.scaleVX, y: s.scaleVY } };
    if (ot(w, { x: n.scaleX ?? s.scaleX, y: n.scaleY ?? s.scaleY }, r.scale.stiffness, r.scale.damping, b), s.scaleX = w.position.x, s.scaleY = w.position.y, s.scaleVX = w.velocity.x, s.scaleVY = w.velocity.y, t === "follow") {
      const m = i.followRotation, P = -Math.log(1 - (m.smoothing ?? 0.2)) * 60, C = 1 - Math.exp(-P * b), F = c, E = h;
      c += (s.vx - c) * C, h += (s.vy - h) * C;
      const X = 0.025;
      s.rotateVZ += (F - c) * X, s.rotateVX += (E - h) * X * 0.7;
      const p = Math.max(-(m.maxSway ?? 5), Math.min(m.maxSway ?? 5, c / 60 * m.sway)), k = Math.max(-(m.maxTiltDelta ?? 4), Math.min(m.maxTiltDelta ?? 4, h / 60 * (m.verticalTiltFactor ?? 0.16))), V = m.tilt + k, O = {
        position: { x: s.rotateX, y: s.rotateZ },
        velocity: { x: s.rotateVX, y: s.rotateVZ }
      };
      ot(O, { x: V, y: p }, 150, 2 * 0.72 * Math.sqrt(150), b), s.rotateX = O.position.x, s.rotateZ = O.position.y, s.rotateVX = O.velocity.x, s.rotateVZ = O.velocity.y;
    } else {
      const m = {
        position: { x: s.rotateX, y: s.rotateZ },
        velocity: { x: s.rotateVX, y: s.rotateVZ }
      };
      ot(m, { x: 0, y: 0 }, 150, 2 * 0.82 * Math.sqrt(150), b), s.rotateX = m.position.x, s.rotateZ = m.position.y, s.rotateVX = m.velocity.x, s.rotateVZ = m.velocity.y;
    }
    if (y(), t === "follow") {
      o = requestAnimationFrame(M);
      return;
    }
    if (d === "settle" && Math.abs(n.x - s.x) < e.position && Math.abs(n.y - s.y) < e.position && Math.abs(s.vx) < e.velocity && Math.abs(s.vy) < e.velocity) {
      l = !1, o = null, (A = i.onArrived) == null || A.call(i);
      return;
    }
    o = requestAnimationFrame(M);
  }
  let g = null, R = null;
  return {
    seed(v) {
      Object.assign(s, v);
    },
    setTarget(v) {
      n = { ...v };
    },
    retarget(v) {
      n = { ...v };
    },
    setProfile(v) {
      r = v;
    },
    getState() {
      return s;
    },
    start() {
      l || (l = !0, d = "settle", g = null, R = null, a = null, y(), o = requestAnimationFrame(M));
    },
    startCoastThenSettle(v) {
      if (l) return;
      l = !0, d = "coast", g = v, u = 0, R = null;
      const b = Math.hypot(s.vx, s.vy), w = v.maxDistance / Math.max(v.duration, 1 / 60);
      if (b > w && b > 0) {
        const T = w / b;
        s.vx *= T, s.vy *= T;
      }
      a = null, y(), o = requestAnimationFrame((T) => {
        R = T, M(T);
      });
    },
    interrupt() {
      return l = !1, o !== null && cancelAnimationFrame(o), o = null, { ...s };
    },
    cancel() {
      return l = !1, o !== null && cancelAnimationFrame(o), o = null, { ...s };
    },
    stop() {
      l = !1, o !== null && cancelAnimationFrame(o), o = null;
    }
  };
}
let q = null;
function Wt(i) {
  const t = getComputedStyle(i);
  return {
    fontFamily: t.fontFamily,
    color: t.color,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textAlign: t.textAlign,
    direction: t.direction,
    wordSpacing: t.wordSpacing,
    whiteSpace: t.whiteSpace,
    textIndent: t.textIndent
  };
}
function Zt(i, t) {
  i.style.fontFamily = t.fontFamily, i.style.color = t.color, i.style.fontSize = t.fontSize, i.style.fontWeight = t.fontWeight, i.style.lineHeight = t.lineHeight, i.style.letterSpacing = t.letterSpacing, i.style.textAlign = t.textAlign, i.style.direction = t.direction, i.style.wordSpacing = t.wordSpacing, i.style.whiteSpace = t.whiteSpace, i.style.textIndent = t.textIndent;
}
function Ut() {
  return (!q || !q.isConnected) && (q = document.createElement("div"), q.dataset.runtimeOverlay = "true", Object.assign(q.style, {
    position: "fixed",
    inset: "0",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "2147483647"
  }), new MutationObserver((i) => {
    for (const t of i)
      for (const e of Array.from(t.removedNodes))
        e instanceof HTMLElement && e.dataset.runtimeProxy;
  }).observe(q, { childList: !0 })), q.parentElement !== document.documentElement && document.documentElement.appendChild(q), q;
}
function ut(i, t) {
  i.style.pointerEvents = t ? "auto" : "none";
}
function kt(i, t = i.getBoundingClientRect()) {
  const e = i.cloneNode(!0);
  return e.classList.remove("kb-card-dragging-source"), e.style.position = "fixed", e.style.left = `${t.left}px`, e.style.top = `${t.top}px`, e.style.boxSizing = "border-box", e.style.width = `${t.width}px`, e.style.height = `${t.height}px`, e.style.margin = "0", e.style.zIndex = "1", e.style.pointerEvents = "none", e.style.visibility = "visible", e.style.display = "block", e.dataset.runtimeProxy = "true", e.style.transformOrigin = "0 0", e.style.transform = "scale(1.03)", e.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", e.style.transition = "transform .15s ease, box-shadow .15s ease", Ut().appendChild(e), ft.add(e), e;
}
function at(i) {
  return `${i.tagName}:${(i.textContent ?? "").trim()}`;
}
function bt(i) {
  const t = [];
  for (const e of Array.from(i.childNodes)) {
    if (e.nodeType === Node.COMMENT_NODE) {
      e.remove();
      continue;
    }
    if (e.nodeType === Node.TEXT_NODE) {
      if (!(e.textContent ?? "").trim()) {
        e.remove();
        continue;
      }
      const s = document.createElement("span");
      s.textContent = e.textContent, e.replaceWith(s), t.push(s);
      continue;
    }
    e.nodeType === Node.ELEMENT_NODE && t.push(e);
  }
  return t;
}
function Pt(i, t) {
  const e = getComputedStyle(t), s = parseFloat(e.paddingTop) || 0, n = parseFloat(e.paddingRight) || 0, r = parseFloat(e.paddingBottom) || 0, a = {
    position: "absolute",
    left: `${parseFloat(e.paddingLeft) || 0}px`,
    top: `${s}px`,
    right: `${n}px`,
    bottom: `${r}px`,
    pointerEvents: "none"
  }, l = document.createElement("div");
  for (Object.assign(l.style, { ...a }); i.firstChild; ) l.appendChild(i.firstChild);
  const c = bt(l), h = new Set(c.map(at)), d = document.createElement("div");
  Object.assign(d.style, { ...a, pointerEvents: "" });
  const u = t.cloneNode(!0);
  for (u.style.visibility = "visible", u.style.display = ""; u.firstChild; ) d.appendChild(u.firstChild);
  const y = Wt(t);
  Zt(d, y);
  const M = bt(d), g = new Set(M.map(at)), R = M.filter((w) => !h.has(at(w)));
  for (const w of R) w.style.opacity = "0";
  const v = c.filter((w) => !g.has(at(w))), b = new Set(v);
  for (const w of c)
    b.has(w) || (w.style.opacity = "0");
  return i.appendChild(d), v.length > 0 && i.appendChild(l), { enteringEls: R, leavingEls: v };
}
function Jt(i, t, e = {}) {
  const s = e.duration ?? _.landing.duration, n = e.easing ?? "cubic-bezier(.22,1,.36,1)", r = e.targetShadow, o = e.targetRadius, a = e.targetBackground, l = e.targetOpacity, c = e.targetContent ? Pt(i, e.targetContent) : null;
  if (c) {
    for (const p of c.enteringEls) p.style.transition = `opacity ${s}ms ${n}`;
    for (const p of c.leavingEls) p.style.transition = `opacity ${s}ms ${n}`;
  }
  const h = parseFloat(i.style.left) || 0, d = parseFloat(i.style.top) || 0;
  let u = !1, y = t;
  const M = performance.now();
  let g = () => {
  }, R = () => {
  };
  const v = new Promise((p) => {
    R = p;
  }), b = () => {
    const p = i.getBoundingClientRect();
    return Math.abs(p.left - y.left) < 2 && Math.abs(p.top - y.top) < 2 && Math.abs(p.width - y.width) < 2 && Math.abs(p.height - y.height) < 2;
  };
  let w = null, T = null, A = 0;
  const m = 60, P = (p) => {
    u || (u = !0, i.removeEventListener("transitionend", g), T !== null && (window.clearTimeout(T), T = null), R());
  }, C = () => {
    if (!u) {
      if (b()) {
        P();
        return;
      }
      if (performance.now() - M >= s + 500) {
        P();
        return;
      }
      window.requestAnimationFrame(C);
    }
  }, F = (p, k = s) => {
    y = p;
    const V = i.getBoundingClientRect();
    i.style.transition = "none", i.style.width = `${V.width.toFixed(2)}px`, i.style.height = `${V.height.toFixed(2)}px`, i.style.transform = `translate3d(${(V.left - h).toFixed(2)}px, ${(V.top - d).toFixed(2)}px, 0)`, i.offsetWidth;
    const O = `translate3d(${(p.left - h).toFixed(2)}px, ${(p.top - d).toFixed(2)}px, 0)`;
    i.style.transition = [
      `transform ${k}ms ${n}`,
      `width ${k}ms ${n}`,
      `height ${k}ms ${n}`,
      `box-shadow ${k}ms ease`,
      `border-radius ${k}ms ease`,
      `background-color ${k}ms ease`,
      `opacity ${k}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (i.style.transform = O, i.style.width = `${p.width.toFixed(2)}px`, i.style.height = `${p.height.toFixed(2)}px`, r != null && (i.style.boxShadow = r), o != null && (i.style.borderRadius = o), a != null && (i.style.background = a), l != null && (i.style.opacity = l), c) {
        for (const z of c.enteringEls) z.style.opacity = "1";
        for (const z of c.leavingEls) z.style.opacity = "0";
      }
    });
  };
  g = (p) => {
    p.target !== i || !(p.propertyName === "transform" || p.propertyName === "width" || p.propertyName === "height") || b() && P(`transitionend:${p.propertyName}`);
  }, i.addEventListener("transitionend", g), F(t), window.setTimeout(C, s + 40);
  const E = (p) => {
    var V;
    A = performance.now();
    const k = Math.max(80, s - (A - M));
    F(((V = e.readTarget) == null ? void 0 : V.call(e)) ?? p, k);
  };
  return { finished: v, retarget: (p) => {
    if (u) return;
    const k = Math.abs(p.left - y.left), V = Math.abs(p.top - y.top), O = Math.abs(p.width - y.width), z = Math.abs(p.height - y.height);
    if (k < 0.5 && V < 0.5 && O < 0.5 && z < 0.5) return;
    const Y = performance.now() - A;
    if (Y >= m) {
      E(p);
      return;
    }
    w = p, T === null && (T = window.setTimeout(() => {
      if (T = null, u || !w) return;
      const H = w;
      w = null, E(H);
    }, m - Y));
  } };
}
function Kt(i, t, e = {}) {
  var X, p, k, V, O, z, Y, H, it, nt, rt, Z, x, S;
  const s = e.duration ?? _.landing.duration, n = e.easing ?? "cubic-bezier(.22,1,.36,1)", r = e.targetShadow, o = e.targetRadius, a = e.targetBackground, l = e.targetOpacity, c = e.targetContent ? Pt(i, e.targetContent) : null;
  if (c) {
    for (const f of c.enteringEls) f.style.transition = `opacity ${s}ms ${n}`;
    for (const f of c.leavingEls) f.style.transition = `opacity ${s}ms ${n}`;
  }
  e.motionState && (i.style.left = `${e.motionState.x}px`, i.style.top = `${e.motionState.y}px`, i.style.transform = "none");
  const h = parseFloat(i.style.left) || i.getBoundingClientRect().left, d = parseFloat(i.style.top) || i.getBoundingClientRect().top, u = i.getBoundingClientRect(), y = u.width || t.width, M = u.height || t.height;
  let g = t, R = !1, v = null, b = 0, w = () => {
  };
  const T = new Promise((f) => {
    w = f;
  }), A = () => {
    R || (R = !0, m.stop(), v !== null && window.clearTimeout(v), v = null, w());
  }, m = Ft({
    mode: "settle",
    onFrame: (f) => {
      i.style.transform = `perspective(760px) translate3d(${(f.x - h).toFixed(2)}px, ${(f.y - d).toFixed(2)}px, 0) rotateX(${f.rotateX.toFixed(2)}deg) rotateZ(${f.rotateZ.toFixed(2)}deg)`, i.style.width = `${(y * f.scaleX).toFixed(2)}px`, i.style.height = `${(M * f.scaleY).toFixed(2)}px`;
    },
    onArrived: A
  }), P = Math.hypot(((X = e.motionState) == null ? void 0 : X.vx) ?? 0, ((p = e.motionState) == null ? void 0 : p.vy) ?? 0), C = e.releaseDamping ?? 0.78;
  m.setProfile(P > 30 ? {
    ...U,
    position: {
      ...U.position,
      damping: U.position.damping * C
    }
  } : U), m.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((k = e.motionState) == null ? void 0 : k.x) ?? u.left,
    y: ((V = e.motionState) == null ? void 0 : V.y) ?? u.top,
    vx: ((O = e.motionState) == null ? void 0 : O.vx) ?? 0,
    vy: ((z = e.motionState) == null ? void 0 : z.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((Y = e.motionState) == null ? void 0 : Y.scaleX) ?? 1,
    scaleY: ((H = e.motionState) == null ? void 0 : H.scaleY) ?? 1,
    rotateX: ((it = e.motionState) == null ? void 0 : it.rotateX) ?? 0,
    rotateZ: ((nt = e.motionState) == null ? void 0 : nt.rotateZ) ?? 0,
    rotateVX: ((rt = e.motionState) == null ? void 0 : rt.rotateVX) ?? 0,
    rotateVZ: ((Z = e.motionState) == null ? void 0 : Z.rotateVZ) ?? 0
  }), m.setTarget({
    x: t.left,
    y: t.top,
    scaleX: t.width / y,
    scaleY: t.height / M
  }), i.style.transition = [
    `box-shadow ${s}ms ${n}`,
    `border-radius ${s}ms ${n}`,
    `background-color ${s}ms ${n}`,
    `opacity ${s}ms ${n}`
  ].join(", "), requestAnimationFrame(() => {
    if (!R && (r != null && (i.style.boxShadow = r), o != null && (i.style.borderRadius = o), a != null && (i.style.background = a), l != null && (i.style.opacity = l), c)) {
      for (const f of c.enteringEls) f.style.opacity = "1";
      for (const f of c.leavingEls) f.style.opacity = "0";
    }
  });
  const F = (f = 0) => {
    v !== null && window.clearTimeout(v), b = performance.now() + Math.max(2e3, s * 8, 5e3) + f, v = window.setTimeout(() => {
      v = null, !R && performance.now() >= b && A();
    }, Math.max(2e3, s * 8, 5e3) + f);
  };
  F();
  const E = e.coast;
  return E && E.maxDistance > 0 && Math.hypot(((x = e.motionState) == null ? void 0 : x.vx) ?? 0, ((S = e.motionState) == null ? void 0 : S.vy) ?? 0) > E.minVelocity ? m.startCoastThenSettle(E) : m.start(), {
    finished: T,
    retarget(f) {
      R || (g = f, F(1e3), m.setTarget({
        x: g.left,
        y: g.top,
        scaleX: g.width / y,
        scaleY: g.height / M
      }));
    }
  };
}
function dt(i) {
  ft.has(i) && (ft.delete(i), i.remove());
}
const ht = /* @__PURE__ */ new WeakMap();
function Qt(i, t) {
  ht.set(i, { style: i.getAttribute("style") ?? "" }), i.style.position = "fixed", i.style.left = `${t.left}px`, i.style.top = `${t.top}px`, i.style.width = `${t.width}px`, i.style.height = `${t.height}px`, i.style.margin = "0", i.style.zIndex = "1000", i.style.boxSizing = "border-box", i.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", i.style.transform = "scale(1.03)", i.style.transition = "transform .15s ease, box-shadow .15s ease";
}
function ct(i) {
  const t = ht.get(i);
  i.setAttribute("style", (t == null ? void 0 : t.style) ?? ""), ht.delete(i);
}
function St(i) {
  i.style.position = "", i.style.left = "", i.style.top = "", i.style.width = "", i.style.height = "", i.style.margin = "", i.style.transform = "", i.style.visibility = "hidden";
}
const ft = /* @__PURE__ */ new Set(), et = /* @__PURE__ */ new Map();
function te(i, t) {
  et.set(i, t), i.style.visibility = "hidden";
}
function ee(i, t) {
  const e = et.get(i) === t;
  return e && (i.style.visibility = "", et.delete(i)), e;
}
function se(i, t) {
  et.get(i) === t && et.delete(i);
}
const ie = [
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
function ne(i) {
  const t = getComputedStyle(i);
  return Object.fromEntries(
    ie.map((e) => [e, t[e]])
  );
}
function re(i, t) {
  Object.assign(i.style, t);
}
function Lt(i, t) {
  re(t, ne(i));
}
function xt(i, t) {
  const e = i.getBoundingClientRect();
  return t.x >= e.left && t.x <= e.right && t.y >= e.top && t.y <= e.bottom;
}
function oe(i) {
  return {
    findSurface(t) {
      return Array.from(document.querySelectorAll(i.surfaceSelector)).find((e) => xt(e, t)) ?? null;
    },
    findTarget(t, e, s) {
      return Array.from(t.querySelectorAll(i.targetSelector)).filter((n) => n.dataset.card !== s).find((n) => xt(n, e)) ?? null;
    },
    findIndex(t, e, s) {
      const n = Array.from(t.querySelectorAll(i.targetSelector)).filter((r) => r.dataset.card !== s);
      for (let r = 0; r < n.length; r += 1) {
        const o = n[r].getBoundingClientRect();
        if (e.y < o.top + o.height / 2) return r;
      }
      return n.length;
    }
  };
}
function ae(i, t, e, s) {
  const n = i.findSurface({ x: t, y: e });
  if (!n) return null;
  const r = n.dataset.column;
  if (!r) return null;
  const o = i.findIndex(n, { x: t, y: e }, s);
  return { columnId: r, index: o };
}
function le(i, t = {}) {
  const e = t.edgeSize ?? 48, s = t.maxSpeed ?? 16;
  let n = null, r = null, o = null, a = !1;
  const l = (d) => {
    const u = (e - d) / e;
    return Math.ceil(s * u);
  }, c = () => {
    var M, g;
    if (a || (o = requestAnimationFrame(c), !n || !r || !n.isConnected)) return;
    const d = n.getBoundingClientRect();
    if (r.x < d.left || r.x > d.right) return;
    const u = r.y - d.top, y = d.bottom - r.y;
    u < e ? (n.scrollTop -= l(u), (M = t.onScroll) == null || M.call(t, r)) : y < e && (n.scrollTop += l(y), (g = t.onScroll) == null || g.call(t, r));
  }, h = () => {
    a || (a = !0, o !== null && cancelAnimationFrame(o), o = null);
  };
  return o = requestAnimationFrame(c), i.track(h), {
    update(d, u) {
      a || (n = d, r = u);
    },
    stop: h
  };
}
const J = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap();
function Tt(i) {
  const t = i.match(/cubic-bezier\(([^)]+)\)/);
  if (!t) return (a) => a * a * (3 - 2 * a);
  const e = t[1].split(",").map(Number);
  if (e.length !== 4 || e.some((a) => !Number.isFinite(a)))
    return (a) => a * a * (3 - 2 * a);
  const [s, n, r, o] = e;
  return (a) => {
    let l = 0, c = 1;
    for (let d = 0; d < 12; d += 1) {
      const u = (l + c) / 2;
      3 * (1 - u) ** 2 * u * s + 3 * (1 - u) * u ** 2 * r + u ** 3 < a ? l = u : c = u;
    }
    const h = (l + c) / 2;
    return 3 * (1 - h) ** 2 * h * n + 3 * (1 - h) * h ** 2 * o + h ** 3;
  };
}
function Et(i) {
  const t = J.get(i);
  t && (cancelAnimationFrame(t.frame), J.delete(i), i.style.transform = "");
}
function ce(i, t, e, s, n, r) {
  Et(i);
  const o = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, s),
    fromX: t,
    fromY: e,
    easing: Tt(n)
  };
  J.set(i, o);
  const a = (l) => {
    if (J.get(i) !== o) return;
    const c = Math.min(1, (l - o.started) / o.duration), h = o.easing(c);
    if (i.style.transform = `translate(${(o.fromX * (1 - h)).toFixed(3)}px, ${(o.fromY * (1 - h)).toFixed(3)}px)`, c >= 1) {
      J.delete(i), i.style.transform = "", r == null || r();
      return;
    }
    o.frame = requestAnimationFrame(a);
  };
  o.frame = requestAnimationFrame(a);
}
function Vt(i) {
  const t = K.get(i);
  t && (cancelAnimationFrame(t.frame), K.delete(i), i.style.height = "");
}
function ue(i, t, e, s, n, r) {
  Vt(i);
  const o = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, s),
    fromX: t,
    fromY: e,
    easing: Tt(n)
  };
  K.set(i, o);
  const a = (l) => {
    if (K.get(i) !== o) return;
    const c = Math.min(1, (l - o.started) / o.duration), h = o.fromX + (o.fromY - o.fromX) * o.easing(c);
    if (i.style.height = `${h}px`, c >= 1) {
      K.delete(i);
      return;
    }
    o.frame = requestAnimationFrame(a);
  };
  o.frame = requestAnimationFrame(a);
}
const pt = _.flip.duration, gt = _.flip.easing;
function de(i) {
  const t = /* @__PURE__ */ new Map();
  return i.forEach((e) => t.set(e, e.getBoundingClientRect())), t;
}
function Ot(i) {
  const t = i.filter((e) => e.dataset.runtimeFlip === "true");
  if (t.length !== 0) {
    for (const e of t)
      e.dataset.runtimeFlipToken = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1), delete e.dataset.runtimeFlip, Et(e), e.style.setProperty("transition", "none", "important");
    t[0].offsetHeight;
  }
}
function he(i, t, e = pt, s = gt) {
  Ot(i);
  for (const n of i) {
    if (n.dataset.runtimeProxy === "true" || n.dataset.runtimePlaceholder === "true" || n.dataset.runtimeActive === "true") continue;
    const r = t.get(n);
    if (!r) continue;
    const o = n.getBoundingClientRect(), a = r.left - o.left, l = r.top - o.top;
    if (Math.abs(a) < 0.5 && Math.abs(l) < 0.5) {
      n.style.transition = "";
      continue;
    }
    n.style.setProperty("transition", "none", "important"), n.style.transform = `translate(${a}px, ${l}px)`;
    const c = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1);
    n.dataset.runtimeFlip = "true", n.dataset.runtimeFlipToken = c, n.offsetHeight, ce(n, a, l, e, s, () => {
      n.dataset.runtimeFlipToken === c && (n.style.transition = "", delete n.dataset.runtimeFlip);
    });
  }
}
let $t = null;
function wt(i) {
  $t = i;
}
function jt() {
  const i = $t;
  return {
    flip: (i == null ? void 0 : i.flip) ?? _.flip,
    resize: (i == null ? void 0 : i.resize) ?? _.resize
  };
}
function fe(i, t) {
  const e = Array.from(t.querySelectorAll("[data-layout-group]")), s = [], n = [];
  for (const r of i)
    r.closest("[data-layout-group]") !== null ? s.push(r) : n.push(r);
  return { groups: e, groupLeaves: s, flatCards: n };
}
function mt(i, t = document) {
  const e = Array.from(t.querySelectorAll("[data-layout-surface]")).map((l) => ({ element: l, rect: st(l), inlineStyle: Bt(l) }));
  It(e);
  const { groups: s, groupLeaves: n, flatCards: r } = fe(i, t), o = we(Array.from(t.querySelectorAll("[data-layout-surface]"))), a = {
    root: t,
    group: s.length > 0 ? { before: be([...s, ...n]) } : void 0,
    flat: r.length > 0 ? { elements: r, before: de(r) } : void 0,
    surfaces: o
  };
  return ge(t, a);
}
function pe(i) {
  const t = jt();
  i.group && xe(i.group.before, t.flip.duration, t.flip.easing), i.flat && he(i.flat.elements, i.flat.before, t.flip.duration, t.flip.easing), Ce(i.surfaces, t.resize.duration, t.resize.easing);
}
function yt(i) {
  lt.set(i.root, i), requestAnimationFrame(() => {
    lt.get(i.root) === i && (lt.delete(i.root), pe(i));
  });
}
function ge(i, t) {
  const e = lt.get(i);
  if (!e) return t;
  const s = ve(t.surfaces, e.surfaces), n = me(t.flat, e.flat), r = ye(t.group, e.group);
  return { ...t, flat: n, group: r, surfaces: s };
}
function me(i, t) {
  if (!i || !t) return i;
  const e = new Map(i.before);
  for (const s of i.elements) {
    const n = t.before.get(s);
    n && e.set(s, n);
  }
  return { ...i, before: e };
}
function ye(i, t) {
  if (!i || !t) return i;
  const e = new Map(t.before.map((s) => [s.element, s.rect]));
  return { before: i.before.map((s) => ({ ...s, rect: e.get(s.element) ?? s.rect })) };
}
function ve(i, t) {
  const e = new Map(t.map((s) => [s.element, s]));
  return i.map((s) => {
    const n = e.get(s.element);
    return n ? { ...s, rect: n.rect, inlineStyle: n.inlineStyle } : s;
  });
}
const lt = /* @__PURE__ */ new WeakMap();
function st(i) {
  const t = i.getBoundingClientRect();
  return { top: t.top, left: t.left, width: t.width, height: t.height };
}
function be(i) {
  const t = new Set(i);
  return i.map((e) => ({
    element: e,
    parent: Se(e, t),
    rect: st(e)
  }));
}
function Se(i, t) {
  let e = i.parentElement;
  for (; e; ) {
    if (t.has(e)) return e;
    e = e.parentElement;
  }
  return null;
}
function xe(i, t = pt, e = gt) {
  Ot(i.map((n) => n.element));
  const s = /* @__PURE__ */ new Map();
  for (const n of i) {
    const r = st(n.element);
    s.set(n.element, {
      x: n.rect.left - r.left,
      y: n.rect.top - r.top
    });
  }
  for (const n of i) {
    const r = s.get(n.element), o = n.parent ? s.get(n.parent) : void 0, a = r.x - ((o == null ? void 0 : o.x) ?? 0), l = r.y - ((o == null ? void 0 : o.y) ?? 0);
    if (n.element.dataset.runtimeProxy === "true" || n.element.dataset.runtimePlaceholder === "true" || n.element.dataset.runtimeActive === "true" || Math.abs(a) < 0.5 && Math.abs(l) < 0.5) {
      n.element.style.transition = "";
      continue;
    }
    n.element.style.transform = `translate(${a}px, ${l}px)`, n.element.style.transition = "none";
    const c = String(Number(n.element.dataset.runtimeFlipToken ?? "0") + 1);
    n.element.dataset.runtimeFlip = "true", n.element.dataset.runtimeFlipToken = c, requestAnimationFrame(() => {
      n.element.dataset.runtimeFlipToken === c && (n.element.style.transition = `transform ${t}ms ${e}`, n.element.style.transform = "");
    }), window.setTimeout(() => {
      n.element.dataset.runtimeFlipToken === c && (n.element.style.transition = "", n.element.style.transform = "", delete n.element.dataset.runtimeFlip);
    }, t + 40);
  }
}
function we(i) {
  return i.map((t) => {
    var e;
    return {
      element: t,
      rect: st(t),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((e = N.get(t)) == null ? void 0 : e.baseStyle) ?? Bt(t)
    };
  });
}
function Ce(i, t = pt, e = gt) {
  var n;
  It(i);
  const s = i.filter((r) => r.element.isConnected).map((r) => {
    const o = st(r.element);
    r.element.dataset.surfaceType;
    const a = jt();
    return {
      item: r,
      next: o,
      profile: a.resize,
      fromHeight: Ct(r.element, r.rect.height),
      toHeight: Ct(r.element, o.height)
    };
  }).filter(({ item: r, next: o }) => Math.abs(r.rect.height - o.height) >= 0.5);
  for (const { item: r, fromHeight: o } of s) {
    const a = r.element.style, l = {
      baseStyle: ((n = N.get(r.element)) == null ? void 0 : n.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++Re)
    };
    N.set(r.element, l), a.overflow = "hidden", a.transition = "none", a.height = `${o}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = l.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: o, toHeight: a, profile: l } of s) {
      const c = r.element.style, h = N.get(r.element);
      if (!h || r.element.dataset.runtimeSurfaceResizeToken !== h.token) continue;
      const d = h.token;
      c.transition = "none", ue(r.element, o, a, l.duration, l.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== d) return;
        const u = N.get(r.element);
        !u || u.token !== d || (Xt(r.element, u.baseStyle), N.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, l.duration + 40);
    }
  });
}
function It(i) {
  const t = i.filter((e) => e.element.dataset.runtimeSurfaceResize === "true");
  if (t.length !== 0) {
    for (const { element: e } of t) {
      const s = N.get(e);
      s && (Vt(e), Xt(e, s.baseStyle), N.delete(e), delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken);
    }
    t[0].element.offsetHeight;
  }
}
const N = /* @__PURE__ */ new WeakMap();
let Re = 0;
function Bt(i) {
  return {
    height: i.style.height,
    overflow: i.style.overflow,
    transition: i.style.transition
  };
}
function Xt(i, t) {
  i.style.height = t.height, i.style.overflow = t.overflow, i.style.transition = t.transition;
}
function Ct(i, t) {
  const e = getComputedStyle(i);
  if (e.boxSizing === "border-box") return t;
  const s = Number.parseFloat(e.paddingTop) + Number.parseFloat(e.paddingBottom) + Number.parseFloat(e.borderTopWidth) + Number.parseFloat(e.borderBottomWidth);
  return Math.max(0, t - s);
}
function Me(i, t, e) {
  const s = i(t, e);
  return {
    ...s,
    boxShadow: e.style.boxShadow || s.boxShadow,
    transform: e.style.transform || s.transform
  };
}
function Ae(i, t, e, s) {
  const n = s ?? t.getBoundingClientRect(), r = s ? e.clientX - n.left : i.dragOffset.x, o = s ? e.clientY - n.top : i.dragOffset.y;
  return s && (i.dragOffset = { x: r, y: o }), { rect: n, offsetX: r, offsetY: o };
}
function Fe(i, t, e, s, n) {
  e.style.transform = "", Qt(e, s), document.body.classList.add("kb-dragging"), n && (e.style.transition = "none"), i(t, e, {
    phase: "dragging",
    hovered: e.matches(":hover"),
    selected: e.classList.contains("is-selected"),
    grabbed: !0
  });
}
function ke(i) {
  const t = i.cloneNode(!0), e = Array.from(document.querySelectorAll("[data-card]")).filter((s) => s !== i && s.dataset.runtimeProxy !== "true");
  return { beforeContent: t, beforePickup: mt(e) };
}
function Pe(i, t, e) {
  let s = i, n = null;
  return {
    update(r, o) {
      const a = t(r);
      return !a || e(a, n) || (s = o(a), n = a), n;
    },
    release() {
      return n;
    },
    get currentSurface() {
      return s;
    }
  };
}
function Le(i) {
  return i.active ? i.state.update(i.event, i.getSurface) : null;
}
function Te(i) {
  i.event.stopPropagation(), ut(i.proxy, !1), i.clearRegrab(), se(i.source, i.sessionId), i.interrupt(), i.source.style.visibility = "hidden", i.disposeProxy();
}
function Ee(i) {
  document.body.classList.remove("kb-dragging");
  const t = Array.from(document.querySelectorAll("[data-card]")).filter((s) => s !== i.source && s.dataset.runtimeProxy !== "true"), e = mt(t);
  i.cancel(), i.clearFloating(i.source), i.clearActive(), i.releaseObject(), yt(e);
}
function Ve(i) {
  const t = i.source.getBoundingClientRect();
  return i.settle(i.source), i.clearActive(), i.releaseObject(), t;
}
function Oe(i, t) {
  return () => requestAnimationFrame(() => {
    i(), t();
  });
}
function $e(i) {
  const t = i.resolve();
  return t ? (i.applyState(t), t) : null;
}
function je(i, t) {
  const e = t.style.transition;
  t.dataset.runtimeLandingCapture = "true", t.style.transition = "none", t.offsetWidth;
  const s = i(t);
  return t.style.transition = e, delete t.dataset.runtimeLandingCapture, s;
}
function Ie(i) {
  return {
    ...i.createContext(),
    sourceElement: i.source,
    sourceRect: i.sourceRect,
    visualSnapshot: i.visualSnapshot,
    targetSnapshot: i.targetSnapshot,
    motionState: i.motionState
  };
}
function Be(i) {
  const t = i.createProxy();
  return t ? (i.enableProxy(t.element), i.bindRegrab(t.element), i.land(t.element).then(i.onComplete), t.element) : (i.onMissing(), null);
}
function Xe(i) {
  i.active && i.complete({
    completed: i.result.completed,
    reason: i.result.reason ?? "",
    reveal: i.result.completed ? i.reveal : void 0
  });
}
function ze(i, t) {
  return i() ?? t();
}
function De(i) {
  return {
    landing: () => {
      const t = i.createGate();
      return i.onGate(t), i.clearDragging(), i.scheduleLanding(), t.promise;
    },
    reveal: () => {
      i.clearRegrab(), i.finishReveal();
    }
  };
}
function qe(i) {
  let t = 0;
  return {
    capture: () => (t += 1, mt(
      Array.from(document.querySelectorAll("[data-card]")).filter((e) => e !== i && e.dataset.runtimeProxy !== "true")
    )),
    play: (e, s) => {
      const n = ++t;
      requestAnimationFrame(() => {
        n === t && yt(s);
      });
    }
  };
}
function Ne(i, t) {
  const e = i.getBoundingClientRect(), s = t.getBoundingClientRect();
  if (s.top < e.top) {
    const n = -(e.top - s.top);
    i.scrollTo({ top: i.scrollTop + n, behavior: "smooth" });
  } else if (s.bottom > e.bottom) {
    const n = s.bottom - e.bottom;
    i.scrollTo({ top: i.scrollTop + n, behavior: "smooth" });
  }
}
function Ye(i) {
  var Z;
  const { runtime: t, objectId: e, element: s, event: n, fromRect: r, returnRect: o } = i, a = t.objects.get(e), l = t.surfaces.snapshot(), c = l.map((x) => x.id), h = (x) => {
    var S;
    return (S = t.objects.get(x)) == null ? void 0 : S.surfaceId;
  }, d = (a == null ? void 0 : a.surfaceId) ?? ((Z = l[0]) == null ? void 0 : Z.id), u = oe({ surfaceSelector: "[data-column]", targetSelector: "[data-card]" });
  let y, M, g, R = null, v = null, b = null, w = null, T = !1, A = null, m = null, P = null, C = null, F, E = { x: 0, y: 0 }, X = null, p = null, k = 0, V = !1;
  function O() {
    var x;
    return A ? (x = t.getSession(A)) == null ? void 0 : x.state : void 0;
  }
  function z(x, S) {
    if (O() !== "active" || !g) return;
    const f = Le({
      active: O() === "active",
      event: { clientX: x, clientY: S },
      state: g,
      getSurface: ($) => $.columnId
    });
    f && (R = f);
  }
  function Y(x) {
    V = !0, C == null || C.setTarget({
      x: x.clientX - E.x,
      y: x.clientY - E.y
    }), z(x.clientX, x.clientY), P == null || P.update(
      (t.getHitResolver() ?? u).findSurface({ x: x.clientX, y: x.clientY }),
      { x: x.clientX, y: x.clientY }
    );
  }
  function H() {
    if (T) return { accepted: !1 };
    if (T = !0, F = C ? { ...C.getState() } : void 0, F) {
      const S = Rt({ x: F.vx, y: F.vy });
      F.vx = S.x, F.vy = S.y;
    }
    if (C == null || C.stop(), C = null, P == null || P.stop(), !g || !A) return { accepted: !1 };
    if (R = g.release(), !R && !V && F && Math.hypot(F.vx, F.vy) < 0.5) {
      const S = s.closest("[data-column]") ?? (d ? document.querySelector(`[data-column="${CSS.escape(d.replace(/^column:/, ""))}"]`) : null), f = S == null ? void 0 : S.dataset.column;
      if (S && f) {
        const $ = Array.from(S.querySelectorAll("[data-card]")).filter((B) => B !== s && B.dataset.runtimeProxy !== "true");
        R = { columnId: f, index: p ?? $.length };
      }
    }
    if (!R) {
      const S = s.style.visibility, f = kt(s, s.getBoundingClientRect()), $ = ++k;
      f.dataset.runtimeCancelProxy = "true", Lt(s, f);
      const B = getComputedStyle(s);
      f.style.width = B.width, f.style.height = B.height, f.style.transition = "none", s.style.visibility = "hidden";
      const D = X;
      return requestAnimationFrame(() => {
        D && (f.style.transition = "left 250ms cubic-bezier(.22,1,.36,1), top 250ms cubic-bezier(.22,1,.36,1), transform 250ms cubic-bezier(.22,1,.36,1), box-shadow 250ms cubic-bezier(.22,1,.36,1)", f.style.left = `${D.left}px`, f.style.top = `${D.top}px`, f.style.transform = "scale(1)", f.style.boxShadow = getComputedStyle(s).boxShadow);
      }), window.setTimeout(() => {
        k === $ && (dt(f), s.style.visibility = S);
      }, 290), Ee({
        source: s,
        cancel: () => t.cancel(A, "no-valid-drop"),
        clearFloating: ct,
        clearActive: () => delete s.dataset.runtimeActive,
        releaseObject: () => m == null ? void 0 : m.release()
      }), s.style.visibility = "hidden", { accepted: !1 };
    }
    const x = Ve({
      source: s,
      settle: St,
      clearActive: () => delete s.dataset.runtimeActive,
      releaseObject: () => m == null ? void 0 : m.release()
    });
    return v = Oe(() => ct(s), () => {
      const S = A, f = $e({
        resolve: () => t.resolveMoveTarget(S, R, () => document.querySelector(`[data-card="${e}"]`) ?? null),
        applyState: (j) => t.applyVisualState(e, j, { phase: "revealing", hovered: !1, selected: j.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!f) {
        b == null || b.complete({ completed: !0, reason: "" }), b = null;
        return;
      }
      const $ = f.closest("[data-column]");
      $ && Ne($, f);
      const B = je((j) => t.captureVisualState(e, j), f), D = Ie({
        createContext: () => t.createVisualLifecycleContext(S, R, f, y),
        source: s,
        sourceRect: x,
        visualSnapshot: M,
        targetSnapshot: B,
        motionState: F
      });
      w = Be({
        createProxy: () => t.createVisualProxy(S, D) ?? null,
        enableProxy: (j) => ut(j, !0),
        bindRegrab: (j) => t.bindRegrabTarget(S, e, j, it),
        land: () => t.landVisualProxy(S, f, D),
        onMissing: () => {
          b == null || b.complete({ completed: !1, reason: "visual-proxy-missing" }), b = null;
        },
        onComplete: (j) => {
          Xe({ active: O() === "landing", result: j, complete: (L) => b == null ? void 0 : b.complete(L), reveal: () => {
            t.revealVisualProxy(S, f, D);
          } }), b = null;
        }
      });
    }), { accepted: !0, destination: R };
  }
  function it(x) {
    if (O() !== "landing") return;
    const S = w;
    if (!S || !A) return;
    const f = ze(
      () => t.resolveVisualTarget(A, R),
      () => document.querySelector(`[data-card="${e}"]`)
    );
    if (!f) return;
    const $ = t.createRegrabContext(A, x, S, f);
    if (!$) return;
    Te({
      event: $.event,
      sessionId: A,
      proxy: S,
      source: f,
      interrupt: () => $.interrupt("regrab"),
      clearRegrab: () => t.clearRegrab(e),
      disposeProxy: () => t.disposeVisualProxy(A)
    });
    const B = f.getBoundingClientRect();
    t.startObjectPointer(e, f, x, $.proxyRect, B);
  }
  const nt = {
    prepare(x) {
      if (A = x.session.id, V = !1, document.querySelectorAll('[data-runtime-cancel-proxy="true"]').forEach(dt), k += 1, P = le(x.session.cleanup, {
        onScroll: (L) => z(L.x, L.y)
      }), x.session.state !== "prepare") return;
      t.objects.setElement(e, s), s.style.visibility = "", m = t.acquireObject(A, e), t.takeSurfaces(A, c);
      const { beforePickup: S } = ke(s), f = s.closest("[data-column]");
      f && (p = Array.from(f.querySelectorAll("[data-card]")).filter((I) => I.dataset.runtimeProxy !== "true").findIndex((I) => I === s)), y = s.cloneNode(!0), yt(S);
      const $ = t.getMoveContext(A), B = Ae($, s, n, r), D = B.rect;
      E = { x: B.offsetX, y: B.offsetY }, Fe((L, I, zt) => t.applyVisualState(e, I, zt), e, s, D, r), s.style.transition = "none", M = Me((L, I) => t.captureVisualState(e, I), e, s), s.dataset.runtimeActive = "true", C = Ft({
        mode: "follow",
        followRotation: At,
        onFrame: (L) => {
          s.style.left = `${L.x}px`, s.style.top = `${L.y}px`, s.style.transform = `perspective(760px) rotateX(${L.rotateX.toFixed(2)}deg) rotateZ(${L.rotateZ.toFixed(2)}deg) scale(${L.scaleX.toFixed(4)}, ${L.scaleY.toFixed(4)})`;
        }
      }), C.setProfile(Mt);
      const j = o ?? D;
      X = { left: j.left, top: j.top, width: j.width, height: j.height }, C.seed({ x: D.left, y: D.top, scaleX: 1.03, scaleY: 1.03, rotateX: 5, rotateZ: 0 }), C.setTarget({ x: n.clientX - E.x, y: n.clientY - E.y }), C.start(), g = Pe(
        h(e),
        (L) => ae(t.getHitResolver() ?? u, L.clientX, L.clientY, e),
        (L, I) => L.columnId === (I == null ? void 0 : I.columnId) && L.index === (I == null ? void 0 : I.index)
      ), z(n.clientX, n.clientY);
    },
    update(x, S) {
      S.event instanceof PointerEvent && Y(S.event);
    },
    resolveDestination() {
      return H();
    },
    commit: () => {
      St(s), document.body.classList.remove("kb-dragging");
    },
    cancel(x, S) {
      T = !0, C == null || C.stop(), C = null, w && (t.disposeVisualProxy(A), w = null), t.clearRegrab(e), document.body.classList.remove("kb-dragging"), delete s.dataset.runtimeActive, ct(s);
    }
  }, rt = {
    layout: qe(s),
    ...De({
      createGate: () => t.createCompletionGate(A, { completed: !1, reason: "landing-cancelled" }),
      onGate: (x) => {
        b = x;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        v == null || v(), v = null;
      },
      clearRegrab: () => t.clearRegrab(e),
      finishReveal: () => {
        w && ut(w, !1);
      }
    })
  };
  return { driver: nt, lifecycle: rt };
}
class Q {
  constructor(t) {
    this.runtime = t;
  }
  /** 设置/更新 runtime 引用（在 registerObjectType 时自动设置） */
  setRuntime(t) {
    this.runtime = t;
  }
  resolveSource(t) {
    return document.querySelector(`[data-card="${CSS.escape(t)}"]`);
  }
  resolveTarget(t) {
    return Array.from(document.querySelectorAll(`[data-card="${CSS.escape(t)}"]`)).filter((e) => e.dataset.runtimeProxy !== "true" && e.isConnected && e.closest("[data-layout-surface]") !== null).find((e) => {
      const s = e.getBoundingClientRect();
      return s.width > 0 && s.height > 0;
    }) ?? null;
  }
  captureVisualState(t) {
    const e = getComputedStyle(t);
    return {
      rect: t.getBoundingClientRect(),
      borderRadius: e.borderRadius,
      boxShadow: e.boxShadow,
      background: e.backgroundColor,
      opacity: e.opacity,
      transform: e.transform
    };
  }
  applyState(t, e) {
    t.dataset.runtimePhase = e.phase, t.classList.toggle("is-hovered", e.hovered), t.classList.toggle("is-grabbed", e.grabbed), t.classList.toggle("is-selected", e.selected);
  }
  createProxy(t) {
    if (!t.sourceElement || !t.sourceRect || !t.beforeContent)
      throw new Error("visual proxy requires source snapshot");
    const e = kt(t.beforeContent, t.sourceRect);
    Lt(t.sourceElement, e);
    const s = t.visualSnapshot;
    return s && (e.style.boxShadow = s.boxShadow, e.style.borderRadius = s.borderRadius, e.style.backgroundColor = s.background, e.style.opacity = s.opacity, e.style.transform = s.transform || "scale(1.03)"), { element: e };
  }
  land(t, e, s) {
    var h, d, u, y, M, g, R, v;
    const n = t.element;
    if (!((h = s.targetSnapshot) != null && h.rect) && !e.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const r = ((d = s.targetSnapshot) == null ? void 0 : d.rect) ?? e.getBoundingClientRect(), o = {
      left: r.left ?? r.x,
      top: r.top ?? r.y,
      width: r.width,
      height: r.height
    };
    te(e, s.sessionId), n.style.transition = "none", n.style.width = `${o.width}px`, n.style.height = `${o.height}px`;
    const a = s.motionEnabled === !1 ? Jt : Kt, { finished: l, retarget: c } = a(n, o, {
      duration: ((y = (u = s.motion) == null ? void 0 : u.landing) == null ? void 0 : y.duration) ?? _.landing.duration,
      targetShadow: (M = s.targetSnapshot) == null ? void 0 : M.boxShadow,
      targetRadius: (g = s.targetSnapshot) == null ? void 0 : g.borderRadius,
      targetBackground: (R = s.targetSnapshot) == null ? void 0 : R.background,
      targetOpacity: (v = s.targetSnapshot) == null ? void 0 : v.opacity,
      targetContent: e,
      readTarget: () => e.getBoundingClientRect(),
      motionState: s.motionState,
      coast: {
        duration: G.coastSeconds,
        friction: _t,
        maxDistance: G.maxCoast,
        minVelocity: G.minVelocity
      },
      releaseDamping: G.dampingRatio
    });
    return this.runtime && this.runtime.trackLandingTarget(s.sessionId, e, () => {
      var b;
      (b = s.targetSnapshot) != null && b.rect && !e.closest("[data-layout-surface]") ? c({
        left: s.targetSnapshot.rect.x,
        top: s.targetSnapshot.rect.y,
        width: s.targetSnapshot.rect.width,
        height: s.targetSnapshot.rect.height
      }) : c(e.getBoundingClientRect());
    }), l.then(() => ({ completed: !0 }));
  }
  reveal(t, e, s) {
    ee(e, s.sessionId);
  }
  dispose(t, e) {
    var n;
    const s = t.element;
    (n = t.dispose) == null || n.call(t), dt(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(t) {
    const e = this.runtime;
    return !e || !e.objects.hasAbility(t.objectId, "move") ? {} : (t.event.preventDefault(), Ye({
      runtime: e,
      objectId: t.objectId,
      element: t.element,
      event: t.event,
      fromRect: t.fromRect,
      returnRect: t.returnRect
    }));
  }
}
class Ge {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
  }
  register(t, e) {
    this.adapters.set(t, e);
  }
  get(t) {
    return this.adapters.get(t);
  }
  remove(t) {
    this.adapters.delete(t);
  }
}
class _e {
  constructor() {
    this.visuals = new Ge(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
  }
  registerVisualAdapter(t, e) {
    this.visuals.register(t, e);
  }
  registerVisualStrategy(t, e) {
    this.visualStrategies.set(t, e);
  }
  registerObjectType(t, e) {
    this.objectTypes.set(t, e), e.visual && this.visuals.register(t, e.visual);
  }
  setMotionProfile(t) {
    this.motionProfile = t;
  }
  setMotionController(t) {
    this.motionController = t;
  }
}
class He {
  constructor() {
    this.disposers = [], this.disposed = !1;
  }
  /** 是否已执行清理。 */
  get isDisposed() {
    return this.disposed;
  }
  track(t) {
    if (this.disposed) {
      t();
      return;
    }
    this.disposers.push(t);
  }
  /**
   * 登记 Window 事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackListener(t, e, s) {
    t.addEventListener(e, s), this.track(() => t.removeEventListener(e, s));
  }
  /**
   * 登记任意 EventTarget 上的事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackTargetListener(t, e, s, n) {
    t.addEventListener(e, s, n), this.track(() => t.removeEventListener(e, s, n));
  }
  /** 登记 requestAnimationFrame ID，清理时自动 cancelAnimationFrame。 */
  trackRaf(t) {
    this.track(() => cancelAnimationFrame(t));
  }
  /** 登记 setTimeout ID，清理时自动 clearTimeout。 */
  trackTimeout(t) {
    this.track(() => clearTimeout(t));
  }
  /** 登记 setInterval ID，清理时自动 clearInterval。 */
  trackInterval(t) {
    this.track(() => clearInterval(t));
  }
  disposeAll() {
    if (this.disposed) return;
    this.disposed = !0;
    const t = this.disposers;
    this.disposers = [];
    const e = [];
    for (const s of t.reverse())
      try {
        s();
      } catch (n) {
        e.push(n);
      } finally {
      }
    e.length > 0 && console.error("Cleanup disposal failed", e);
  }
}
const We = {
  prepare: ["active", "interrupt", "cancelled"],
  active: ["release", "landing", "interrupt", "cancelled"],
  release: ["landing", "saving", "interrupt", "cancelled"],
  landing: ["saving", "handoff", "done", "interrupt", "cancelled"],
  saving: ["handoff", "rollback", "interrupt", "cancelled"],
  handoff: ["done", "cancelled"],
  rollback: ["done", "cancelled"],
  interrupt: ["disposed", "cancelled"],
  done: ["disposed"],
  cancelled: ["disposed"],
  disposed: []
};
let Ze = 1;
class Ue {
  constructor(t, e, s) {
    this.type = t, this.objectId = e, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new He(), this.leases = [], this.id = `session-${Ze++}`;
  }
  transition(t) {
    if (this.state !== t) {
      if (!We[this.state].includes(t))
        throw new Error(`Invalid session transition: ${this.state} -> ${t}`);
      this.state = t;
    }
  }
  takeObject(t) {
    const e = this.owner.takeObject(t, this.id);
    return this.leases.push(e), e;
  }
  trackCleanup(t) {
    this.cleanup.track(t);
  }
  takeSurface(t) {
    this.leases.push(this.owner.takeSurface(t, this.id));
  }
  handoff() {
    this.transition("handoff");
  }
  dispose() {
    this.state !== "disposed" && (this.state === "interrupt" ? this.transition("disposed") : (this.state !== "done" && this.state !== "cancelled" && this.transition("done"), this.transition("disposed")), this.leases.forEach((t) => t.release()), this.leases = [], this.cleanup.disposeAll());
  }
  cancel() {
    this.state !== "disposed" && (this.state !== "cancelled" && this.transition("cancelled"), this.dispose());
  }
  interrupt(t = "cancel") {
    if (this.endReason = t, t === "regrab") {
      if (this.state === "disposed") return;
      this.state !== "interrupt" && this.state !== "cancelled" && this.state !== "done" && this.transition("interrupt"), (this.state === "interrupt" || this.state === "cancelled" || this.state === "done") && this.transition("disposed"), this.leases.forEach((e) => e.release()), this.leases = [];
      return;
    }
    (this.state === "prepare" || this.state === "active" || this.state === "release" || this.state === "landing" || this.state === "saving") && this.transition("interrupt"), this.dispose();
  }
}
class Je {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(t, e, s) {
    const n = new Ue(t, e, s);
    return this.sessions.set(n.id, n), n;
  }
  get(t) {
    return this.sessions.get(t);
  }
  set(t) {
    this.sessions.set(t.id, t);
  }
  delete(t) {
    this.sessions.delete(t);
  }
  addGate(t, e) {
    const s = this.completionGates.get(t) ?? /* @__PURE__ */ new Set();
    s.add(e), this.completionGates.set(t, s);
  }
  removeGate(t, e) {
    var s;
    (s = this.completionGates.get(t)) == null || s.delete(e);
  }
  failGates(t) {
    const e = this.completionGates.get(t);
    if (e) {
      for (const s of [...e]) s.fail();
      this.completionGates.delete(t);
    }
  }
  acquireObject(t, e) {
    const s = this.sessions.get(t);
    return s ? s.takeObject(e) : null;
  }
  track(t, e) {
    var s;
    (s = this.sessions.get(t)) == null || s.trackCleanup(e);
  }
  finalize(t, e) {
    const s = this.sessions.get(t);
    if (s)
      return e == null || e(s), s.dispose(), this.failGates(t), this.sessions.delete(t), s;
  }
  cancel(t, e) {
    const s = this.sessions.get(t);
    if (s)
      return e == null || e(s), s.cancel(), this.sessions.delete(t), s;
  }
  interrupt(t, e, s) {
    const n = this.sessions.get(t);
    if (n)
      return s == null || s(n), n.interrupt(e), this.sessions.delete(t), n;
  }
}
class Ke {
  constructor(t) {
    this.sessions = t;
  }
  finalize(t, e, s, n, r) {
    try {
      this.sessions.finalize(t.id, (o) => n(o.id));
    } finally {
      r(e, s);
    }
  }
  terminate(t, e, s, n, r, o, a, l) {
    try {
      o(e, s, n);
    } catch (c) {
      console.error(`Behavior ${r} failed`, c);
    } finally {
      try {
        a(t), r === "cancel" ? this.sessions.cancel(t.id) : this.sessions.interrupt(t.id, n === "regrab" ? "regrab" : "cancel");
      } finally {
        l(e, s);
      }
    }
  }
}
class vt {
  constructor(t, e, s, n) {
    this.updateCoordinator = t, this.releaseCoordinator = e, this.commitCoordinator = s, this.landingCoordinator = n;
  }
  static fromPorts(t, e, s) {
    return new vt(
      new Qe(t),
      new ts(),
      e,
      s
    );
  }
  update(t, e) {
    this.updateCoordinator.update(t, e);
  }
  prepareRelease(t, e) {
    return this.releaseCoordinator.prepare(t, e);
  }
  async commit(t, e, s) {
    return this.commitCoordinator.commit(t, e, s);
  }
  async land(t, e, s) {
    return this.landingCoordinator.run(t, e, s);
  }
  async release(t, e, s) {
    var d;
    const n = s.getSession(t), r = this.prepareRelease(n, e);
    if (r.kind === "ignore") return;
    if (r.kind === "cancel") {
      n && s.cancel(n.id, r.reason);
      return;
    }
    const o = r.session, a = s.getBehavior(o.type);
    a instanceof W && a.captureLayout(s.createContext(o));
    let l;
    try {
      l = await ((d = a == null ? void 0 : a.release) == null ? void 0 : d.call(a, s.createContext(o), e));
    } catch (u) {
      s.cancel(o.id, u instanceof Error ? u.message : "release-failed");
      return;
    }
    if (s.getSession(o.id) !== o) return;
    const c = l;
    if ((c == null ? void 0 : c.accepted) === !1) {
      s.cancel(o.id, "no-valid-drop");
      return;
    }
    if (o.state === "release" && o.transition("landing"), !(a instanceof W)) {
      s.end(o);
      return;
    }
    const h = c == null ? void 0 : c.destination;
    if (h === void 0) {
      s.cancel(o.id, "invalid-release-result");
      return;
    }
    try {
      await this.commit(o, a, h);
    } catch (u) {
      s.cancel(o.id, u instanceof Error ? u.message : "commit-failed");
      return;
    }
    await this.land(o, a, h);
  }
  start(t, e) {
    var a;
    const s = e.getBehavior(t.type);
    if (!s) throw new Error(`Unknown interaction behavior: ${t.type}`);
    const n = e.createSession(t.type, t.objectId), r = e.getVisualStrategy(t.objectId);
    r && e.bindLifecycle(n.id, r);
    const o = e.createContext(n);
    try {
      const l = (a = s.prepare) == null ? void 0 : a.call(s, o, t);
      l && typeof l.then == "function" && l.catch((c) => {
        e.isCurrent(n.id) && e.cancel(n.id, c instanceof Error ? c.message : "prepare-failed");
      });
    } catch (l) {
      e.cancel(n.id, l instanceof Error ? l.message : "prepare-failed");
    }
    return e.isCurrent(n.id) && n.state === "prepare" && n.transition("active"), {
      id: n.id,
      get state() {
        return n.state;
      },
      cancel: (l) => e.cancel(n.id, l ?? "cancelled"),
      interrupt: (l) => e.interrupt(n.id, l ?? "interrupted")
    };
  }
}
class Qe {
  constructor(t) {
    this.port = t;
  }
  update(t, e) {
    var n, r;
    const s = this.port.getSession(t);
    !s || s.state !== "active" || (r = (n = this.port.getBehavior(s.type)) == null ? void 0 : n.update) == null || r.call(n, this.port.createContext(t), e);
  }
}
class ts {
  prepare(t, e) {
    return t ? e.kind === "pointercancel" || e.kind === "blur" || e.kind === "lostpointercapture" ? { kind: "cancel", reason: e.kind } : t.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (t.state === "active" && t.transition("release"), t.state === "release" ? { kind: "continue", session: t } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class es {
  constructor(t, e) {
    this.port = t, this.actions = e;
  }
  async commit(t, e, s) {
    var a, l, c, h;
    const n = this.port.createContext(t);
    await e.commit(n, s), e.playLayout(n);
    const r = this.port.getLifecycle(t.id), o = this.port.normalize(t.objectId, s);
    o && await ((l = (a = r == null ? void 0 : r.surface) == null ? void 0 : a.leave) == null ? void 0 : l.call(a, n, o.fromSurfaceId)), this.actions.emit(t.objectId, e.getContext(t.id).destination, e.getContext(t.id).transaction), o && await ((h = (c = r == null ? void 0 : r.surface) == null ? void 0 : c.enter) == null ? void 0 : h.call(c, n, o.toSurfaceId));
  }
}
class ss {
  constructor(t) {
    this.port = t;
  }
  async run(t, e, s) {
    var n;
    try {
      const r = await e.landing(this.port.createContext(t), s), o = this.port.getSession(t.id);
      if (o !== t || o.state === "disposed" || o.state === "interrupt") return;
      if (r && !r.completed) return this.port.cancel(t.id, r.reason ?? "landing-failed");
      (n = r == null ? void 0 : r.reveal) == null || n.call(r), t.handoff(), e.reveal && await e.reveal(this.port.createContext(t), s), this.port.getSession(t.id) === t && this.port.end(t);
    } catch (r) {
      this.port.getSession(t.id) === t && this.port.cancel(t.id, r instanceof Error ? r.message : "landing-failed");
    }
  }
}
class is {
  constructor(t) {
    this.port = t;
  }
  normalize(t, e) {
    if (this.isDestination(e)) return e;
    if (!e || typeof e != "object") return null;
    const s = e;
    if (typeof s.columnId != "string") return null;
    const n = this.port.getObjectSurface(t);
    return n ? { fromSurfaceId: n, toSurfaceId: s.columnId.startsWith("column:") ? s.columnId : `column:${s.columnId}`, ...typeof s.index == "number" ? { toIndex: s.index } : {} } : null;
  }
  emit(t, e, s) {
    if (s.actionEmitted) return !1;
    const n = this.normalize(t, e);
    return n ? (s.actionEmitted = !0, this.port.emit({ type: "move", objectId: t, fromSurfaceId: n.fromSurfaceId, toSurfaceId: n.toSurfaceId, ...n.toIndex === void 0 ? {} : { toIndex: n.toIndex }, timestamp: Date.now() }), !0) : !1;
  }
  isDestination(t) {
    if (!t || typeof t != "object") return !1;
    const e = t;
    return typeof e.fromSurfaceId == "string" && typeof e.toSurfaceId == "string";
  }
}
function ns(i) {
  let t = null, e = null, s = !1;
  const n = () => {
    s || (s = !0, e !== null && cancelAnimationFrame(e), e = null, t == null || t.disconnect(), t = null);
  };
  if (typeof ResizeObserver > "u") return n;
  const r = () => {
    s || !i.target.isConnected || i.retarget(i.target.getBoundingClientRect());
  };
  if (t = new ResizeObserver(r), t.observe(i.target), i.observeAncestors !== !1) {
    const l = typeof document < "u" ? document.body : null, c = i.stopAt === void 0 ? l : i.stopAt;
    let h = i.target.parentElement;
    for (; h && h !== c; )
      t.observe(h), h = h.parentElement;
  }
  let o = null;
  const a = () => {
    if (s || (e = requestAnimationFrame(a), !i.target.isConnected)) return;
    const l = i.target.getBoundingClientRect();
    o && Math.abs(l.left - o.left) < 0.5 && Math.abs(l.top - o.top) < 0.5 && Math.abs(l.width - o.width) < 0.5 && Math.abs(l.height - o.height) < 0.5 || (o = l, i.retarget(l));
  };
  return e = requestAnimationFrame(a), i.cleanup.track(n), n;
}
class rs {
  constructor(t) {
    this.port = t;
  }
  resolveTarget(t, e) {
    var n, r;
    const s = ((r = (n = this.port.getAdapter(t)).resolveTarget) == null ? void 0 : r.call(n, t, e)) ?? new Q().resolveTarget(t);
    return s != null && s.isConnected ? s : null;
  }
  apply(t, e, s) {
    (this.port.getAdapter(t).applyState ?? new Q().applyState)(e, s);
  }
  capture(t, e) {
    return (this.port.getAdapter(t).captureVisualState ?? new Q().captureVisualState)(e);
  }
  trackTarget(t, e, s, n = {}) {
    return ns({ ...n, cleanup: t, target: e, retarget: s });
  }
}
class os {
  constructor() {
    this.proxies = /* @__PURE__ */ new Map();
  }
  register(t, e) {
    var s, n;
    (n = (s = this.proxies.get(t)) == null ? void 0 : s.dispose) == null || n.call(s), this.proxies.set(t, e);
  }
  get(t) {
    return this.proxies.get(t);
  }
  remove(t) {
    const e = this.proxies.get(t);
    return this.proxies.delete(t), e;
  }
}
class as {
  constructor(t, e) {
    this.port = t, this.proxies = e;
  }
  create(t, e) {
    var r, o;
    const s = this.port.getSession(t);
    if (!s) return;
    const n = (o = (r = this.port.getAdapter(s.objectId)).createProxy) == null ? void 0 : o.call(r, e);
    if (n)
      return this.proxies.register(t, n), n;
  }
  async land(t, e, s) {
    var a, l;
    const n = this.port.getSession(t), r = this.proxies.get(t);
    if (!n || !r) return { completed: !1, reason: "visual-proxy-missing" };
    const o = s ?? this.port.createContext(t, void 0, e);
    return await ((l = (a = this.port.getAdapter(n.objectId)).land) == null ? void 0 : l.call(a, r, e, o)) ?? { completed: !0 };
  }
  update(t, e) {
    var r, o;
    const s = this.port.getSession(t), n = this.proxies.get(t);
    !s || !n || (o = (r = this.port.getAdapter(s.objectId)).updateProxy) == null || o.call(r, n, e ?? this.port.createContext(t));
  }
  async reveal(t, e, s) {
    var o, a;
    const n = this.port.getSession(t), r = this.proxies.get(t);
    !n || !r || await ((a = (o = this.port.getAdapter(n.objectId)).reveal) == null ? void 0 : a.call(o, r, e, s ?? this.port.createContext(t, void 0, e)));
  }
}
function ls(i, t, e = {}) {
  const s = e.target ?? window, n = e.captureTarget;
  let r = !1;
  const o = (u) => {
    i.update(t.id, { kind: "pointermove", event: u });
  }, a = (u) => {
    d(), i.release(t.id, { kind: "pointerup", event: u });
  }, l = (u) => {
    d(), i.release(t.id, { kind: "pointercancel", event: u });
  }, c = () => {
    d(), i.release(t.id, { kind: "blur" });
  }, h = (u) => {
    d(), i.release(t.id, { kind: "lostpointercapture", event: u });
  };
  function d() {
    r || (r = !0, s.removeEventListener("pointermove", o), s.removeEventListener("pointerup", a), s.removeEventListener("pointercancel", l), s.removeEventListener("blur", c), n == null || n.removeEventListener("lostpointercapture", h));
  }
  return s.addEventListener("pointermove", o), s.addEventListener("pointerup", a), s.addEventListener("pointercancel", l), s.addEventListener("blur", c), n == null || n.addEventListener("lostpointercapture", h), t.cleanup.track(d), d;
}
class cs {
  constructor(t) {
    this.port = t, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(t, e) {
    var r, o;
    (r = this.disposers.get(t)) == null || r(), (o = this.bindings.get(e)) == null || o();
    const s = (a) => {
      a instanceof PointerEvent && this.port.startObjectPointer(t, e, a);
    };
    e.addEventListener("pointerdown", s);
    const n = () => e.removeEventListener("pointerdown", s);
    return this.bindings.set(e, n), this.disposers.set(t, n), n;
  }
  sync(t) {
    var s;
    const e = this.port.objects.get(t);
    (s = this.disposers.get(t)) == null || s(), this.disposers.delete(t), !(!(e != null && e.element) || !this.port.registry.objectTypes.has(e.visual ?? e.type)) && this.bind(t, e.element);
  }
  remove(t) {
    var e;
    (e = this.disposers.get(t)) == null || e(), this.disposers.delete(t);
  }
  bindRegrabTarget(t, e, s, n) {
    this.port.registerRegrab(e, n);
    const r = (o) => {
      o instanceof PointerEvent && this.port.regrab(e, o);
    };
    s.addEventListener("pointerdown", r), t.cleanup.trackTargetListener(s, "pointerdown", r);
  }
  bindSession(t, e = {}) {
    return ls({
      update: (s, n) => this.port.update(s, n),
      release: (s, n) => this.port.release(s, n)
    }, t, e);
  }
}
class us {
  constructor(t) {
    this.handlers = t;
  }
  start(t) {
    return this.handlers.start(t);
  }
  update(t, e) {
    this.handlers.update(t, e);
  }
  release(t, e) {
    return this.handlers.release(t, e);
  }
  cancel(t, e) {
    this.handlers.cancel(t, e);
  }
  interrupt(t, e) {
    this.handlers.interrupt(t, e);
  }
}
class ds {
  constructor() {
    this.owner = new Dt(), this.objects = new qt(), this.surfaces = new Nt(), this.behaviors = new Yt(), this.registry = new _e(), this.hitResolver = null, this.sessionCoordinator = new Je(), this.runtimeSession = new Ke(this.sessionCoordinator), this.events = new tt(), this.actions = new tt(), this.visualProxyCoordinator = new os(), this.defaultVisualAdapter = new Q(this), this.moveBehavior = new W(), this.inputCoordinator = new cs({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (t, e, s) => this.startObjectPointer(t, e, s),
      registerRegrab: (t, e) => this.registerRegrab(t, e),
      regrab: (t, e) => this.regrab(t, e),
      update: (t, e) => this.update(t, e),
      release: (t, e) => this.release(t, e)
    }), this.moveActions = new is({
      getObjectSurface: (t) => {
        var e;
        return (e = this.objects.get(t)) == null ? void 0 : e.surfaceId;
      },
      emit: (t) => this.actions.emit(t)
    }), this.moveCommit = new es({
      createContext: (t) => this.createBehaviorContext(t),
      getLifecycle: (t) => this.moveBehavior.getLifecycle(t),
      normalize: (t, e) => this.moveActions.normalize(t, e)
    }, this.moveActions), this.moveLanding = new ss({
      createContext: (t) => this.createBehaviorContext(t),
      getSession: (t) => this.sessionCoordinator.get(t),
      cancel: (t, e) => this.cancel(t, e),
      end: (t) => this.endSession(t)
    }), this.runtimeMove = vt.fromPorts({
      getSession: (t) => this.sessionCoordinator.get(t),
      getBehavior: (t) => this.behaviors.get(t),
      createContext: (t) => this.createBehaviorContext(this.sessionCoordinator.get(t))
    }, this.moveCommit, this.moveLanding), this.visualState = new rs({ getAdapter: (t) => this.getObjectVisualAdapter(t) }), this.visualMotion = new as({
      getSession: (t) => this.sessionCoordinator.get(t),
      getAdapter: (t) => this.getObjectVisualAdapter(t),
      createContext: (t, e, s) => this.createVisualLifecycleContext(t, e, s)
    }, this.visualProxyCoordinator), this.dispatcher = new us({
      start: (t) => this.startInternal(t),
      update: (t, e) => this.updateInternal(t, e),
      release: (t, e) => this.releaseInternal(t, e),
      cancel: (t, e) => this.cancelInternal(t, e),
      interrupt: (t, e) => this.interruptInternal(t, e)
    }), this.behaviors.register(this.moveBehavior), wt(this.registry.motionProfile), this.objects.subscribe((t) => {
      this.events.emit(t), (t.type === "object-added" || t.type === "object-changed") && this.syncObjectPointerBinding(t.id), t.type === "object-removed" && this.inputCoordinator.remove(t.id);
    }), this.surfaces.subscribe((t) => this.events.emit(t)), this.owner.subscribe((t) => this.events.emit({ type: "ownership-changed", id: t }));
  }
  /** 兼容现有调用方；新的注册逻辑统一落在 registry。 */
  get visuals() {
    return this.registry.visuals;
  }
  registerVisualAdapter(t, e) {
    this.registry.registerVisualAdapter(t, e);
  }
  registerVisualStrategy(t, e) {
    this.registry.registerVisualStrategy(t, e);
  }
  registerObjectType(t, e) {
    this.registry.registerObjectType(t, e);
    for (const s of this.objects.values())
      (s.type === t || s.visual === t) && this.syncObjectPointerBinding(s.id);
  }
  registerSurface(t) {
    this.surfaces.register(t);
  }
  configureMotion(t) {
    const { profile: e, controller: s, ...n } = t, r = e ?? (Object.keys(n).length ? n : void 0);
    r && this.registry.setMotionProfile(r), s && (this.registry.setMotionController(s), s.follow && Object.assign(Mt.position, s.follow), s.rotation && Object.assign(At, s.rotation), s.release && Object.assign(G, s.release)), wt(this.registry.motionProfile);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  startObjectPointer(t, e, s, n, r) {
    var y, M;
    const o = this.getRegrab(t);
    if (o)
      return o(s), !0;
    const a = this.objects.get(t);
    if (!a) return !1;
    const l = this.registry.objectTypes.get(a.visual ?? a.type);
    if (!l) return !1;
    a.element !== e && this.objects.setElement(t, e);
    const c = {
      objectId: t,
      element: e,
      event: s,
      mode: a.visualMode ?? l.defaultVisualMode,
      fromRect: n,
      returnRect: r
    }, u = ((y = l.visual) == null ? void 0 : y.createMove) ?? l.createMove ?? (() => this.defaultVisualAdapter.createMove(c));
    if (u) {
      const g = u(c);
      return !g.driver && !g.lifecycle ? ((M = l.start) == null || M.call(l, c), !0) : (this.orchestrateMoveSession(
        g.request ?? {
          type: "move",
          objectId: t,
          input: { kind: "pointerdown", event: s }
        },
        {
          driver: g.driver,
          lifecycle: g.lifecycle,
          pointerInput: g.pointerInput,
          followElement: e
        }
      ), !0);
    }
    return !1;
  }
  bindObjectPointer(t, e) {
    return this.inputCoordinator.bind(t, e);
  }
  syncObjectPointerBinding(t) {
    this.inputCoordinator.sync(t);
  }
  getVisualAdapter(t) {
    return this.registry.visuals.get(t) ?? this.defaultVisualAdapter;
  }
  getObjectVisualAdapter(t) {
    const e = this.objects.get(t), s = e ? this.registry.objectTypes.get(e.visual ?? e.type) : void 0;
    return s != null && s.visual ? s.visual : this.getVisualAdapter((e == null ? void 0 : e.visual) ?? (e == null ? void 0 : e.type) ?? "");
  }
  createVisualLifecycleContext(t, e, s, n) {
    var M, g;
    const r = this.sessionCoordinator.get(t), o = r ? this.objects.get(r.objectId) : void 0, a = (o == null ? void 0 : o.element) ?? void 0, l = r ? this.getObjectVisualAdapter(r.objectId) : this.defaultVisualAdapter, c = new Q(), h = o ? this.registry.objectTypes.get(o.visual ?? o.type) : void 0, d = (M = h == null ? void 0 : h.motion) == null ? void 0 : M.profile, u = this.registry.motionProfile, y = d || u ? {
      ...u,
      ...d,
      flip: { ...u == null ? void 0 : u.flip, ...d == null ? void 0 : d.flip },
      resize: { ...u == null ? void 0 : u.resize, ...d == null ? void 0 : d.resize },
      landing: { ...u == null ? void 0 : u.landing, ...d == null ? void 0 : d.landing },
      group: { ...u == null ? void 0 : u.group, ...d == null ? void 0 : d.group }
    } : void 0;
    return {
      objectId: (r == null ? void 0 : r.objectId) ?? "",
      sessionId: t,
      mode: (o == null ? void 0 : o.visualMode) ?? "detach",
      destination: e,
      sourceElement: a,
      beforeContent: n,
      targetElement: s,
      sourceRect: a == null ? void 0 : a.getBoundingClientRect(),
      visualSnapshot: a ? (l.captureVisualState ?? c.captureVisualState)(a) : void 0,
      targetSnapshot: s ? (l.captureVisualState ?? c.captureVisualState)(s) : void 0,
      motion: y,
      motionEnabled: (g = h == null ? void 0 : h.motion) == null ? void 0 : g.enabled
    };
  }
  /** 由注册的 VisualAdapter 创建并登记当前 session 的唯一视觉代理。 */
  createVisualProxy(t, e) {
    return this.visualMotion.create(t, e);
  }
  /** 调用当前对象适配器的 landing，并保证无代理时也有确定结果。 */
  async landVisualProxy(t, e, s) {
    return this.visualMotion.land(t, e, s);
  }
  /** 将跟手或重定位更新转发给当前 session 的视觉适配器。 */
  updateVisualProxy(t, e) {
    this.visualMotion.update(t, e);
  }
  /** 通过对象 VisualAdapter 解析最终揭示目标，并过滤已断开的节点。 */
  resolveVisualTarget(t, e) {
    const s = this.sessionCoordinator.get(t);
    return s ? this.visualState.resolveTarget(s.objectId, e) : null;
  }
  /** 将对象的生命周期视觉状态交给其适配器写入。 */
  applyVisualState(t, e, s) {
    this.visualState.apply(t, e, s);
  }
  /** 获取对象当前视觉快照；未覆盖时使用默认 DOM 样式快照。 */
  captureVisualState(t, e) {
    return this.visualState.capture(t, e);
  }
  /** 调用当前对象适配器的 reveal；交接只允许由 Runtime 触发。 */
  async revealVisualProxy(t, e, s) {
    await this.visualMotion.reveal(t, e, s);
  }
  registerVisualProxy(t, e) {
    this.visualProxyCoordinator.register(t, e);
  }
  getVisualProxy(t) {
    return this.visualProxyCoordinator.get(t);
  }
  disposeVisualProxy(t) {
    var n, r, o;
    const e = this.visualProxyCoordinator.get(t);
    if (!e) return;
    const s = this.sessionCoordinator.get(t);
    if (s) {
      const a = this.createVisualLifecycleContext(t);
      (r = (n = this.getObjectVisualAdapter(s.objectId)).dispose) == null || r.call(n, e, a);
    }
    (o = e.dispose) == null || o.call(e), this.visualProxyCoordinator.remove(t);
  }
  createCompletionGate(t, e) {
    let s = !1, n;
    const o = {
      promise: new Promise((a) => {
        n = a;
      }),
      complete: (a) => {
        s || (s = !0, n(a), this.sessionCoordinator.removeGate(t, o));
      },
      fail: () => {
        s || (s = !0, n(e), this.sessionCoordinator.removeGate(t, o));
      }
    };
    return this.sessionCoordinator.addGate(t, o), o;
  }
  setHitResolver(t) {
    this.hitResolver = t;
  }
  getHitResolver() {
    return this.hitResolver;
  }
  subscribe(t) {
    return this.events.subscribe(t);
  }
  onAction(t) {
    return this.actions.subscribe(t);
  }
  emitAction(t) {
    this.actions.emit(t);
  }
  snapshot() {
    return {
      objects: this.objects.snapshot(),
      surfaces: this.surfaces.snapshot()
    };
  }
  registerBehavior(t) {
    this.behaviors.register(t);
  }
  setMoveDriver(t) {
    this.moveBehavior.setDriver(t);
  }
  bindMoveSession(t, e) {
    this.moveBehavior.bindSession(t, e);
  }
  bindMoveLifecycle(t, e) {
    this.moveBehavior.bindLifecycle(t, e);
  }
  getMoveContext(t) {
    return this.moveBehavior.getContext(t);
  }
  resolveMoveTarget(t, e, s) {
    var c, h;
    const n = this.sessionCoordinator.get(t);
    if (!n) return null;
    const o = (h = (c = this.createBehaviorContext(n).visual) == null ? void 0 : c.resolveTarget) == null ? void 0 : h.call(c, n.objectId, e), a = s == null ? void 0 : s(), l = o ?? a ?? null;
    return !l || !l.isConnected ? null : (this.moveBehavior.getContext(t).transaction.target = l, l);
  }
  registerRegrab(t, e) {
    this.moveBehavior.registerRegrab(t, e);
  }
  getRegrab(t) {
    return this.moveBehavior.getRegrab(t);
  }
  regrab(t, e) {
    const s = this.moveBehavior.getRegrab(t);
    return s ? (s(e), !0) : !1;
  }
  clearRegrab(t, e) {
    this.moveBehavior.clearRegrab(t, e);
  }
  /** 将落地代理的 regrab 监听与当前 Session 清理绑定。 */
  bindRegrabTarget(t, e, s, n) {
    const r = this.sessionCoordinator.get(t);
    r && this.inputCoordinator.bindRegrabTarget(r, e, s, n);
  }
  createRegrabContext(t, e, s, n) {
    const r = this.sessionCoordinator.get(t);
    return !r || r.state !== "landing" ? null : {
      sessionId: t,
      objectId: r.objectId,
      event: e,
      proxyElement: s,
      sourceElement: n,
      proxyRect: s.getBoundingClientRect(),
      interrupt: (o) => this.interrupt(t, o ?? "regrab")
    };
  }
  /**
   * 绑定 active 阶段的全局 pointer 输入。pointerup 会先立即解绑监听器，再把
   * release 交回 Runtime；cancel/interrupt 时由 Session Cleanup 兜底。
   */
  bindPointerSessionInput(t, e = {}) {
    const s = this.sessionCoordinator.get(t);
    return s ? this.inputCoordinator.bindSession(s, e) : () => {
    };
  }
  /**
   * landing 期间追踪真实目标及其祖先的布局变化，并自动登记到 Session Cleanup。
   */
  trackLandingTarget(t, e, s, n = {}) {
    const r = this.sessionCoordinator.get(t);
    return r ? this.visualState.trackTarget(r.cleanup, e, s, n) : () => {
    };
  }
  start(t) {
    return this.dispatcher.start(t);
  }
  startInternal(t) {
    return this.runtimeMove.start(t, {
      getBehavior: (e) => this.behaviors.get(e),
      createSession: (e, s) => this.startSession(e, s),
      getVisualStrategy: (e) => {
        const s = this.objects.get(e);
        return s ? this.registry.visualStrategies.get(s.type) : void 0;
      },
      bindLifecycle: (e, s) => this.moveBehavior.bindLifecycle(e, s),
      createContext: (e) => this.createBehaviorContext(e),
      isCurrent: (e) => !!this.sessionCoordinator.get(e),
      cancel: (e, s) => this.cancel(e, s),
      interrupt: (e, s) => this.interrupt(e, s)
    });
  }
  /**
   * 编排一次完整的 move Session：start → bind driver → bind lifecycle →
   * bind pointer input，一步到位。
   *
   * 调用方只需提供 driver（跟手阶段的行为）和 lifecycle（落地/揭示阶段的
   * 视觉逻辑），不需要手动调用 bindMoveSession/bindMoveLifecycle/
   * bindPointerSessionInput。
   *
   * 返回的 handle 包含 session id、moveContext、state 以及 dispose() 方法。
   */
  orchestrateMoveSession(t, e = {}) {
    let s;
    if (e.sessionId) {
      const o = this.sessionCoordinator.get(e.sessionId);
      if (!o) throw new Error(`Session not found: ${e.sessionId}`);
      s = o;
    } else {
      e.driver && this.moveBehavior.setDriver(e.driver);
      const o = this.start(t);
      e.driver && this.moveBehavior.setDriver({}), s = this.sessionCoordinator.get(o.id);
    }
    const n = this.getMoveContext(s.id);
    e.followElement !== void 0 && (n.followElement = e.followElement), e.driver && this.bindMoveSession(s.id, e.driver), e.lifecycle ? this.bindMoveLifecycle(s.id, e.lifecycle) : e.visualStrategy && this.bindMoveLifecycle(s.id, e.visualStrategy);
    const r = this.bindPointerSessionInput(s.id, e.pointerInput);
    return {
      id: s.id,
      get state() {
        return s.state;
      },
      get moveContext() {
        return n;
      },
      cancel: (o) => this.cancel(s.id, o ?? "cancelled"),
      interrupt: (o) => this.interrupt(s.id, o ?? "interrupted"),
      dispose: () => {
        r();
      }
    };
  }
  update(t, e) {
    this.dispatcher.update(t, e);
  }
  updateInternal(t, e) {
    this.runtimeMove.update(t, e);
  }
  async release(t, e) {
    return this.dispatcher.release(t, e);
  }
  async releaseInternal(t, e) {
    const s = {
      getSession: (n) => this.sessionCoordinator.get(n),
      getBehavior: (n) => this.behaviors.get(n),
      createContext: (n) => this.createBehaviorContext(n),
      cancel: (n, r) => this.cancel(n, r),
      end: (n) => this.endSession(n)
    };
    return this.runtimeMove.release(t, e, s);
  }
  cancel(t, e = "cancelled") {
    this.dispatcher.cancel(t, e);
  }
  cancelInternal(t, e = "cancelled") {
    const s = this.sessionCoordinator.get(t);
    if (!s) return;
    const n = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      n,
      r,
      e,
      "cancel",
      (o, a, l) => {
        var c;
        o instanceof W && o.cancelLayout(a, l), (c = o == null ? void 0 : o.cancel) == null || c.call(o, a, l);
      },
      (o) => this.failCompletionGates(o.id),
      (o, a) => this.disposeBehavior(o, a)
    );
  }
  interrupt(t, e = "cancel") {
    this.dispatcher.interrupt(t, e);
  }
  interruptInternal(t, e = "cancel") {
    const s = this.sessionCoordinator.get(t);
    if (!s) return;
    const n = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      n,
      r,
      e,
      "interrupt",
      (o, a, l) => {
        var c;
        o instanceof W && o.cancelLayout(a, l), (c = o == null ? void 0 : o.interrupt) == null || c.call(o, a, l);
      },
      (o) => this.failCompletionGates(o.id),
      (o, a) => this.disposeBehavior(o, a)
    );
  }
  startSession(t, e = "") {
    return this.sessionCoordinator.create(t, e, this.owner);
  }
  getSession(t) {
    return this.sessionCoordinator.get(t);
  }
  takeSurface(t, e) {
    const s = this.sessionCoordinator.get(t);
    return s ? (s.takeSurface(e), this.owner.isOwnedBy(e, t)) : !1;
  }
  /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
  acquireObject(t, e) {
    return this.sessionCoordinator.acquireObject(t, e);
  }
  /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
  trackPlaceholder(t, e) {
    this.sessionCoordinator.track(t, e);
  }
  takeSurfaces(t, e) {
    return e.every((s) => this.takeSurface(t, s));
  }
  endSession(t) {
    const e = this.behaviors.get(t.type), s = this.createBehaviorContext(t);
    this.runtimeSession.finalize(
      t,
      e,
      s,
      (n) => this.disposeVisualProxy(n),
      (n, r) => this.disposeBehavior(n, r)
    );
  }
  failCompletionGates(t) {
    this.sessionCoordinator.failGates(t), this.disposeVisualProxy(t);
  }
  disposeBehavior(t, e) {
    var s, n, r, o;
    try {
      t instanceof W && ((r = (n = (s = t.getLifecycle(e.session.id)) == null ? void 0 : s.surface) == null ? void 0 : n.dispose) == null || r.call(n, e)), (o = t == null ? void 0 : t.dispose) == null || o.call(t, e);
    } catch (a) {
      console.error("Behavior dispose failed", a);
    }
  }
  createBehaviorContext(t) {
    const e = this.objects.get(t.objectId);
    return {
      session: t,
      emitAction: (s) => this.actions.emit(s),
      // 行为准备阶段仍使用可解析 DOM 的通用适配器；对象注册的 VisualAdapter
      // 通过 createVisualProxy/生命周期入口逐步接管视觉，不改变现有 demo 的
      // source 解析与拖拽起点。
      visual: e ? this.getVisualAdapter(e.visual ?? e.type) : void 0,
      hit: this.hitResolver
    };
  }
}
const fs = new ds();
export {
  G as DEFAULT_RELEASE_PROFILE,
  Q as DefaultVisualAdapter,
  Mt as FOLLOW_PROFILE,
  At as FOLLOW_ROTATION,
  U as LANDING_PROFILE,
  is as MoveActionCoordinator,
  W as MoveBehavior,
  es as MoveCommitCoordinator,
  ss as MoveLandingCoordinator,
  ts as MoveReleaseCoordinator,
  Gt as MoveTransaction,
  Qe as MoveUpdateCoordinator,
  qt as ObjectStore,
  ds as Runtime,
  us as RuntimeDispatcher,
  cs as RuntimeInputCoordinator,
  vt as RuntimeMoveCoordinator,
  _e as RuntimeRegistry,
  Ke as RuntimeSessionCoordinator,
  Ue as Session,
  Je as SessionCoordinator,
  Nt as SurfaceStore,
  Ge as VisualAdapters,
  as as VisualMotionCoordinator,
  os as VisualProxyCoordinator,
  rs as VisualStateCoordinator,
  ls as bindPointerSessionInput,
  hs as coastOffset,
  Ft as createCardMotionController,
  Ye as createDetachMoveFromAdapter,
  oe as createDomHitResolver,
  ae as hitWithResolver,
  ot as integrateSpring,
  Ut as mountVisualOverlay,
  fs as runtime,
  Rt as shapeReleaseVelocity,
  ns as trackLandingTarget
};
