import { f as L, g as E, l as j, h as k, D as y, j as O, r as V, k as A, e as I, n as T, o as x, F as B, a as F } from "./DetachAdapter-CsjtZIYW.js";
class b {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
  }
  subscribe(t) {
    return this.listeners.add(t), () => this.listeners.delete(t);
  }
  emit(t) {
    this.listeners.forEach((e) => e(t));
  }
  /**
   * 与同步广播保持并存的事务广播。业务可以返回框架渲染完成的 Promise，
   * 让调用方在读取新 DOM 前等待；没有返回值的既有订阅仍然是同步兼容的。
   */
  async emitAsync(t) {
    await Promise.all([...this.listeners].map((e) => Promise.resolve(e(t))));
  }
}
class D {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new b();
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
        const i = this.controlled.get(t);
        (i == null ? void 0 : i.ownerSessionId) === e && (this.controlled.delete(t), this.events.emit(t));
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
    let i = this.channelOwners.get(t);
    i || (i = /* @__PURE__ */ new Map(), this.channelOwners.set(t, i)), i.set(e, s);
    let n = !1;
    return {
      release: () => {
        n || (n = !0, i.get(e) === s && (i.delete(e), i.size === 0 && this.channelOwners.delete(t)));
      }
    };
  }
  ownsChannel(t, e, s) {
    var i;
    return ((i = this.channelOwners.get(t)) == null ? void 0 : i.get(e)) === s;
  }
}
class z {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new b();
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
class G {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new b();
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
class _ {
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
class $ {
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
class v {
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
    var i, n, r;
    const e = this.getContext(t.session.id), s = (r = (n = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.layout) == null ? void 0 : n.capture) == null ? void 0 : r.call(n, t);
    e.layoutSnapshot = s;
  }
  playLayout(t) {
    var i, n;
    const e = this.getContext(t.session.id), s = this.sessionLifecycles.get(t.session.id);
    e.layoutSnapshot !== void 0 && ((n = (i = s == null ? void 0 : s.layout) == null ? void 0 : i.play) == null || n.call(i, t, e.layoutSnapshot));
  }
  cancelLayout(t, e) {
    var n, r, o;
    const s = this.getContext(t.session.id), i = s.layoutSnapshot;
    i !== void 0 && ((o = (r = (n = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : n.layout) == null ? void 0 : r.cancel) == null || o.call(r, t, i, e)), s.layoutSnapshot = void 0;
  }
  getContext(t) {
    let e = this.contexts.get(t);
    return e || (e = {
      transaction: new $(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(t, e)), e;
  }
  driverFor(t) {
    return this.sessionDrivers.get(t) ?? this.driver;
  }
  prepare(t, e) {
    var a, c, h, u, d;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("prepare");
    const i = ((c = (a = t.visual) == null ? void 0 : a.resolveSource) == null ? void 0 : c.call(a, e.objectId)) ?? null;
    s.sourceElement = i, s.transaction.source = i;
    const n = e.input.event instanceof PointerEvent ? e.input.event : null;
    if (i && n) {
      const p = i.getBoundingClientRect();
      s.dragOffset = {
        x: n.clientX - p.left,
        y: n.clientY - p.top
      };
    }
    const r = (u = (h = this.driverFor(t.session.id)).prepare) == null ? void 0 : u.call(h, t, e), o = this.sessionLifecycles.get(t.session.id);
    return r && typeof r.then == "function" ? Promise.resolve(r).then(async () => {
      var p;
      return (p = o == null ? void 0 : o.beginDrag) == null ? void 0 : p.call(o, t);
    }) : (d = o == null ? void 0 : o.beginDrag) == null ? void 0 : d.call(o, t);
  }
  update(t, e) {
    var n, r;
    if (t.session.state !== "active") return;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("active");
    const i = e.event instanceof PointerEvent ? e.event : null;
    i && s.followElement && (s.followElement.style.left = `${i.clientX - s.dragOffset.x}px`, s.followElement.style.top = `${i.clientY - s.dragOffset.y}px`), (r = (n = this.driverFor(t.session.id)).update) == null || r.call(n, t, e);
  }
  release(t, e) {
    var r;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("release");
    const i = this.driverFor(t.session.id);
    if (i.resolveDestination)
      return Promise.resolve(i.resolveDestination(t, e)).then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o));
    const n = (r = i.release) == null ? void 0 : r.call(i, t, e);
    return Promise.resolve(n).then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o));
  }
  commit(t, e) {
    this.getContext(t.session.id).transaction.setPhase("landing");
    const s = this.driverFor(t.session.id);
    if (s.commit)
      return s.commit(t, e);
  }
  cancel(t, e) {
    var i, n, r, o;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (n = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.cancel) == null || n.call(i, t, e), (o = (r = this.driverFor(t.session.id)).cancel) == null || o.call(r, t, e);
  }
  interrupt(t, e) {
    var i, n, r, o;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (n = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.cancel) == null || n.call(i, t, e), (o = (r = this.driverFor(t.session.id)).interrupt) == null || o.call(r, t, e);
  }
  dispose(t) {
    var s, i;
    const e = this.getContext(t.session.id).transaction;
    e.phase !== "cancelled" && e.setPhase("disposed"), (i = (s = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : s.dispose) == null || i.call(s, t), this.unbindSession(t.session.id);
  }
  landing(t, e) {
    var o;
    const s = this.getContext(t.session.id);
    if (s.transaction.setPhase("landing"), s.landingStarted)
      return s.landingPromise ?? { completed: s.landingCompleted === !0 };
    s.landingStarted = !0, s.destination = e;
    const i = this.sessionLifecycles.get(t.session.id), n = (o = i == null ? void 0 : i.landing) == null ? void 0 : o.call(i, t, e), r = Promise.resolve(n).then((a) => ((!a || a.completed) && (s.landingCompleted = !0), a));
    return s.landingPromise = r, r;
  }
  reveal(t, e) {
    var i, n;
    const s = this.getContext(t.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (n = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.reveal) == null ? void 0 : n.call(i, t, e);
  }
}
const H = [
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
function N(l) {
  const t = getComputedStyle(l);
  return Object.fromEntries(
    H.map((e) => [e, t[e]])
  );
}
function U(l, t) {
  Object.assign(l.style, t);
}
function W(l, t) {
  U(t, N(l));
}
class C {
  constructor(t) {
    this.runtime = t;
  }
  /** 设置/更新 runtime 引用（在 registerObjectType 时自动设置） */
  setRuntime(t) {
    this.runtime = t;
  }
  resolveSource(t) {
    var e, s;
    return ((s = (e = this.runtime) == null ? void 0 : e.objects.get(t)) == null ? void 0 : s.element) ?? null;
  }
  resolveTarget(t) {
    var i, n;
    const e = ((n = (i = this.runtime) == null ? void 0 : i.objects.get(t)) == null ? void 0 : n.element) ?? null;
    if (!(e != null && e.isConnected) || e.dataset.runtimeProxy === "true") return null;
    const s = e.getBoundingClientRect();
    return s.width > 0 && s.height > 0 ? e : null;
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
    const e = L(t.beforeContent, t.sourceRect);
    W(t.sourceElement, e);
    const s = t.visualSnapshot;
    return s && (e.style.boxShadow = s.boxShadow, e.style.borderRadius = s.borderRadius, e.style.backgroundColor = s.background, e.style.opacity = s.opacity, e.style.transform = s.transform || "scale(1.03)"), { element: e };
  }
  land(t, e, s) {
    var h, u, d, p, f, g, m, w;
    const i = t.element;
    if (!((h = s.targetSnapshot) != null && h.rect) && !e.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const n = ((u = s.targetSnapshot) == null ? void 0 : u.rect) ?? e.getBoundingClientRect(), r = {
      left: n.left ?? n.x,
      top: n.top ?? n.y,
      width: n.width,
      height: n.height
    };
    E(e, s.sessionId), i.style.transition = "none", i.style.width = `${r.width}px`, i.style.height = `${r.height}px`;
    const o = s.motionEnabled === !1 ? j : k, { finished: a, retarget: c } = o(i, r, {
      duration: ((p = (d = s.motion) == null ? void 0 : d.landing) == null ? void 0 : p.duration) ?? O.landing.duration,
      targetShadow: (f = s.targetSnapshot) == null ? void 0 : f.boxShadow,
      targetRadius: (g = s.targetSnapshot) == null ? void 0 : g.borderRadius,
      targetBackground: (m = s.targetSnapshot) == null ? void 0 : m.background,
      targetOpacity: (w = s.targetSnapshot) == null ? void 0 : w.opacity,
      targetContent: e,
      readTarget: () => e.getBoundingClientRect(),
      motionState: s.motionState,
      coast: {
        duration: y.coastSeconds,
        friction: T,
        maxDistance: y.maxCoast,
        minVelocity: y.minVelocity
      },
      releaseDamping: y.dampingRatio
    });
    return this.runtime && this.runtime.trackLandingTarget(s.sessionId, e, () => {
      var R;
      (R = s.targetSnapshot) != null && R.rect && !e.closest("[data-layout-surface]") ? c({
        left: s.targetSnapshot.rect.x,
        top: s.targetSnapshot.rect.y,
        width: s.targetSnapshot.rect.width,
        height: s.targetSnapshot.rect.height
      }) : c(e.getBoundingClientRect());
    }), a.then(() => ({ completed: !0 }));
  }
  reveal(t, e, s) {
    V(e, s.sessionId);
  }
  dispose(t, e) {
    var i;
    const s = t.element;
    (i = t.dispose) == null || i.call(t), A(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(t) {
    const e = this.runtime;
    return !e || !e.objects.hasAbility(t.objectId, "move") ? {} : (t.event.preventDefault(), I({
      runtime: e,
      objectId: t.objectId,
      element: t.element,
      event: t.event,
      fromRect: t.fromRect,
      returnRect: t.returnRect
    }));
  }
}
class X {
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
function M(l, t) {
  const e = l.getBoundingClientRect();
  return t.x >= e.left && t.x <= e.right && t.y >= e.top && t.y <= e.bottom;
}
function P(l) {
  var e;
  const t = (e = l.element) == null ? void 0 : e.getBoundingClientRect();
  return t ? t.width * t.height : Number.POSITIVE_INFINITY;
}
function Y(l, t, e) {
  const s = l.get(e), i = () => t.snapshot().filter((n) => {
    var r;
    return (r = n.element) == null ? void 0 : r.isConnected;
  }).filter((n) => s ? t.accepts(n.id, s.type) : !1);
  return {
    findSurface(n) {
      return i().filter((r) => M(r.element, n)).sort((r, o) => P(r) - P(o))[0] ?? null;
    },
    findTarget(n, r, o) {
      return [...l.values()].filter((a) => a.id !== o && a.surfaceId === n.id).map((a) => a.element).filter((a) => !!(a != null && a.isConnected)).find((a) => M(a, r)) ?? null;
    },
    findIndex(n, r, o) {
      const a = [...l.values()].filter((c) => c.id !== o && c.surfaceId === n.id).map((c) => c.element).filter((c) => !!(c != null && c.isConnected)).sort((c, h) => {
        const u = c.getBoundingClientRect(), d = h.getBoundingClientRect();
        return u.top - d.top || u.left - d.left;
      });
      for (let c = 0; c < a.length; c += 1) {
        const h = a[c].getBoundingClientRect();
        if (r.y < h.top + h.height / 2) return c;
      }
      return a.length;
    }
  };
}
class q {
  constructor() {
    this.visuals = new X(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
class J {
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
  trackTargetListener(t, e, s, i) {
    t.addEventListener(e, s, i), this.track(() => t.removeEventListener(e, s, i));
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
      } catch (i) {
        e.push(i);
      } finally {
      }
    e.length > 0 && console.error("Cleanup disposal failed", e);
  }
}
const K = {
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
let Q = 1;
class Z {
  constructor(t, e, s) {
    this.type = t, this.objectId = e, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new J(), this.leases = [], this.id = `session-${Q++}`;
  }
  transition(t) {
    if (this.state !== t) {
      if (!K[this.state].includes(t))
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
class tt {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(t, e, s) {
    const i = new Z(t, e, s);
    return this.sessions.set(i.id, i), i;
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
    const i = this.sessions.get(t);
    if (i)
      return s == null || s(i), i.interrupt(e), this.sessions.delete(t), i;
  }
}
class et {
  constructor(t) {
    this.sessions = t;
  }
  finalize(t, e, s, i, n) {
    try {
      this.sessions.finalize(t.id, (r) => i(r.id));
    } finally {
      n(e, s);
    }
  }
  terminate(t, e, s, i, n, r, o, a) {
    try {
      r(e, s, i);
    } catch (c) {
      console.error(`Behavior ${n} failed`, c);
    } finally {
      try {
        o(t), n === "cancel" ? this.sessions.cancel(t.id) : this.sessions.interrupt(t.id, i === "regrab" ? "regrab" : "cancel");
      } finally {
        a(e, s);
      }
    }
  }
}
class S {
  constructor(t, e, s, i) {
    this.updateCoordinator = t, this.releaseCoordinator = e, this.commitCoordinator = s, this.landingCoordinator = i;
  }
  static fromPorts(t, e, s) {
    return new S(
      new st(t),
      new it(),
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
  async commit(t, e, s, i = !0) {
    return this.commitCoordinator.commit(t, e, s, i);
  }
  async land(t, e, s) {
    return this.landingCoordinator.run(t, e, s);
  }
  async release(t, e, s) {
    var u;
    const i = s.getSession(t), n = this.prepareRelease(i, e);
    if (n.kind === "ignore") return;
    if (n.kind === "cancel") {
      i && s.cancel(i.id, n.reason);
      return;
    }
    const r = n.session, o = s.getBehavior(r.type);
    o instanceof v && o.captureLayout(s.createContext(r));
    let a;
    try {
      a = await ((u = o == null ? void 0 : o.release) == null ? void 0 : u.call(o, s.createContext(r), e));
    } catch (d) {
      s.cancel(r.id, d instanceof Error ? d.message : "release-failed");
      return;
    }
    if (s.getSession(r.id) !== r) return;
    const c = a;
    if ((c == null ? void 0 : c.accepted) === !1) {
      s.cancel(r.id, "no-valid-drop");
      return;
    }
    if (r.state === "release" && r.transition("landing"), !(o instanceof v)) {
      s.end(r);
      return;
    }
    const h = c == null ? void 0 : c.destination;
    if (h === void 0) {
      s.cancel(r.id, "invalid-release-result");
      return;
    }
    try {
      await this.commit(r, o, h, (c == null ? void 0 : c.emitAction) !== !1);
    } catch (d) {
      s.cancel(r.id, d instanceof Error ? d.message : "commit-failed");
      return;
    }
    await this.land(r, o, h);
  }
  start(t, e) {
    var o;
    const s = e.getBehavior(t.type);
    if (!s) throw new Error(`Unknown interaction behavior: ${t.type}`);
    const i = e.createSession(t.type, t.objectId), n = e.getVisualStrategy(t.objectId);
    n && e.bindLifecycle(i.id, n);
    const r = e.createContext(i);
    try {
      const a = (o = s.prepare) == null ? void 0 : o.call(s, r, t);
      a && typeof a.then == "function" && a.catch((c) => {
        e.isCurrent(i.id) && e.cancel(i.id, c instanceof Error ? c.message : "prepare-failed");
      });
    } catch (a) {
      e.cancel(i.id, a instanceof Error ? a.message : "prepare-failed");
    }
    return e.isCurrent(i.id) && i.state === "prepare" && i.transition("active"), {
      id: i.id,
      get state() {
        return i.state;
      },
      cancel: (a) => e.cancel(i.id, a ?? "cancelled"),
      interrupt: (a) => e.interrupt(i.id, a ?? "interrupted")
    };
  }
}
class st {
  constructor(t) {
    this.port = t;
  }
  update(t, e) {
    var i, n;
    const s = this.port.getSession(t);
    !s || s.state !== "active" || (n = (i = this.port.getBehavior(s.type)) == null ? void 0 : i.update) == null || n.call(i, this.port.createContext(t), e);
  }
}
class it {
  prepare(t, e) {
    return t ? e.kind === "pointercancel" || e.kind === "blur" || e.kind === "lostpointercapture" ? { kind: "cancel", reason: e.kind } : t.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (t.state === "active" && t.transition("release"), t.state === "release" ? { kind: "continue", session: t } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class rt {
  constructor(t, e) {
    this.port = t, this.actions = e;
  }
  async commit(t, e, s, i = !0) {
    var a, c, h, u;
    const n = this.port.createContext(t);
    if (await e.commit(n, s), !i) {
      e.playLayout(n);
      return;
    }
    const r = this.port.getLifecycle(t.id), o = this.port.normalize(t.objectId, s);
    o && await ((c = (a = r == null ? void 0 : r.surface) == null ? void 0 : a.leave) == null ? void 0 : c.call(a, n, o.fromSurfaceId)), await this.actions.emit(t.objectId, e.getContext(t.id).destination, e.getContext(t.id).transaction), o && await ((u = (h = r == null ? void 0 : r.surface) == null ? void 0 : h.enter) == null ? void 0 : u.call(h, n, o.toSurfaceId)), await this.port.waitForRender(t, s) && e.playLayout(n);
  }
}
class nt {
  constructor(t) {
    this.port = t;
  }
  async run(t, e, s) {
    try {
      const i = await e.landing(this.port.createContext(t), s), n = this.port.getSession(t.id);
      if (n !== t || n.state === "disposed" || n.state === "interrupt") return;
      if (i && !i.completed) return this.port.cancel(t.id, i.reason ?? "landing-failed");
      i && i.reveal && await i.reveal(), t.handoff(), e.reveal && await e.reveal(this.port.createContext(t), s), this.port.getSession(t.id) === t && this.port.end(t);
    } catch (i) {
      this.port.getSession(t.id) === t && this.port.cancel(t.id, i instanceof Error ? i.message : "landing-failed");
    }
  }
}
class ot {
  constructor(t) {
    this.port = t;
  }
  normalize(t, e) {
    if (this.isDestination(e)) return e;
    if (!e || typeof e != "object") return null;
    const s = e;
    if (typeof s.columnId != "string") return null;
    const i = this.port.getObjectSurface(t);
    return i ? { fromSurfaceId: i, toSurfaceId: s.columnId, ...typeof s.index == "number" ? { toIndex: s.index } : {} } : null;
  }
  async emit(t, e, s) {
    if (s.actionEmitted) return !1;
    const i = this.normalize(t, e);
    return i ? (s.actionEmitted = !0, s.destination = i, await this.port.emit({ type: "move", objectId: t, fromSurfaceId: i.fromSurfaceId, toSurfaceId: i.toSurfaceId, ...i.toIndex === void 0 ? {} : { toIndex: i.toIndex }, timestamp: Date.now() }), !0) : !1;
  }
  isDestination(t) {
    if (!t || typeof t != "object") return !1;
    const e = t;
    return typeof e.fromSurfaceId == "string" && typeof e.toSurfaceId == "string";
  }
}
function at(l) {
  let t = null, e = null, s = !1;
  const i = () => {
    s || (s = !0, e !== null && cancelAnimationFrame(e), e = null, t == null || t.disconnect(), t = null);
  };
  if (typeof ResizeObserver > "u") return i;
  const n = () => {
    s || !l.target.isConnected || l.retarget(l.target.getBoundingClientRect());
  };
  if (t = new ResizeObserver(n), t.observe(l.target), l.observeAncestors !== !1) {
    const a = typeof document < "u" ? document.body : null, c = l.stopAt === void 0 ? a : l.stopAt;
    let h = l.target.parentElement;
    for (; h && h !== c; )
      t.observe(h), h = h.parentElement;
  }
  let r = null;
  const o = () => {
    if (s || (e = requestAnimationFrame(o), !l.target.isConnected)) return;
    const a = l.target.getBoundingClientRect();
    r && Math.abs(a.left - r.left) < 0.5 && Math.abs(a.top - r.top) < 0.5 && Math.abs(a.width - r.width) < 0.5 && Math.abs(a.height - r.height) < 0.5 || (r = a, l.retarget(a));
  };
  return e = requestAnimationFrame(o), l.cleanup.track(i), i;
}
class ct {
  constructor(t) {
    this.port = t;
  }
  resolveTarget(t, e) {
    var i, n;
    const s = ((n = (i = this.port.getAdapter(t)).resolveTarget) == null ? void 0 : n.call(i, t, e)) ?? new C().resolveTarget(t);
    return s != null && s.isConnected ? s : null;
  }
  apply(t, e, s) {
    (this.port.getAdapter(t).applyState ?? new C().applyState)(e, s);
  }
  capture(t, e) {
    return (this.port.getAdapter(t).captureVisualState ?? new C().captureVisualState)(e);
  }
  trackTarget(t, e, s, i = {}) {
    return at({ ...i, cleanup: t, target: e, retarget: s });
  }
}
class lt {
  constructor() {
    this.proxies = /* @__PURE__ */ new Map();
  }
  register(t, e) {
    var s, i;
    (i = (s = this.proxies.get(t)) == null ? void 0 : s.dispose) == null || i.call(s), this.proxies.set(t, e);
  }
  get(t) {
    return this.proxies.get(t);
  }
  remove(t) {
    const e = this.proxies.get(t);
    return this.proxies.delete(t), e;
  }
}
class dt {
  constructor(t, e) {
    this.port = t, this.proxies = e;
  }
  create(t, e) {
    var n, r;
    const s = this.port.getSession(t);
    if (!s) return;
    const i = (r = (n = this.port.getAdapter(s.objectId)).createProxy) == null ? void 0 : r.call(n, e);
    if (i)
      return this.proxies.register(t, i), i;
  }
  async land(t, e, s) {
    var a, c;
    const i = this.port.getSession(t), n = this.proxies.get(t);
    if (!i || !n) return { completed: !1, reason: "visual-proxy-missing" };
    const r = s ?? this.port.createContext(t, void 0, e), o = await ((c = (a = this.port.getAdapter(i.objectId)).land) == null ? void 0 : c.call(a, n, e, r));
    return o || { completed: !0 };
  }
  update(t, e) {
    var n, r;
    const s = this.port.getSession(t), i = this.proxies.get(t);
    !s || !i || (r = (n = this.port.getAdapter(s.objectId)).updateProxy) == null || r.call(n, i, e ?? this.port.createContext(t));
  }
  async reveal(t, e, s) {
    var r, o;
    const i = this.port.getSession(t), n = this.proxies.get(t);
    !i || !n || await ((o = (r = this.port.getAdapter(i.objectId)).reveal) == null ? void 0 : o.call(r, n, e, s ?? this.port.createContext(t, void 0, e)));
  }
}
function ht(l, t, e = {}) {
  const s = e.target ?? window, i = e.captureTarget;
  let n = !1;
  const r = (d) => {
    l.update(t.id, { kind: "pointermove", event: d });
  }, o = (d) => {
    u(), l.release(t.id, { kind: "pointerup", event: d });
  }, a = (d) => {
    u(), l.release(t.id, { kind: "pointercancel", event: d });
  }, c = () => {
    u(), l.release(t.id, { kind: "blur" });
  }, h = (d) => {
    u(), l.release(t.id, { kind: "lostpointercapture", event: d });
  };
  function u() {
    n || (n = !0, s.removeEventListener("pointermove", r), s.removeEventListener("pointerup", o), s.removeEventListener("pointercancel", a), s.removeEventListener("blur", c), i == null || i.removeEventListener("lostpointercapture", h));
  }
  return s.addEventListener("pointermove", r), s.addEventListener("pointerup", o), s.addEventListener("pointercancel", a), s.addEventListener("blur", c), i == null || i.addEventListener("lostpointercapture", h), t.cleanup.track(u), u;
}
class ut {
  constructor(t) {
    this.port = t, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(t, e) {
    var n, r;
    (n = this.disposers.get(t)) == null || n(), (r = this.bindings.get(e)) == null || r();
    const s = (o) => {
      o instanceof PointerEvent && this.port.startObjectPointer(t, e, o);
    };
    e.addEventListener("pointerdown", s);
    const i = () => e.removeEventListener("pointerdown", s);
    return this.bindings.set(e, i), this.disposers.set(t, i), i;
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
  bindRegrabTarget(t, e, s, i) {
    this.port.registerRegrab(e, i);
    const n = (r) => {
      r instanceof PointerEvent && this.port.regrab(e, r);
    };
    s.addEventListener("pointerdown", n), t.cleanup.trackTargetListener(s, "pointerdown", n);
  }
  bindSession(t, e = {}) {
    return ht({
      update: (s, i) => this.port.update(s, i),
      release: (s, i) => this.port.release(s, i)
    }, t, e);
  }
}
class pt {
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
class gt {
  constructor() {
    this.owner = new D(), this.objects = new z(), this.surfaces = new G(), this.behaviors = new _(), this.registry = new q(), this.hitResolver = null, this.sessionCoordinator = new tt(), this.runtimeSession = new et(this.sessionCoordinator), this.events = new b(), this.actions = new b(), this.visualProxyCoordinator = new lt(), this.defaultVisualAdapter = new C(this), this.moveBehavior = new v(), this.inputCoordinator = new ut({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (t, e, s) => this.startObjectPointer(t, e, s),
      registerRegrab: (t, e) => this.registerRegrab(t, e),
      regrab: (t, e) => this.regrab(t, e),
      update: (t, e) => this.update(t, e),
      release: (t, e) => this.release(t, e)
    }), this.moveActions = new ot({
      getObjectSurface: (t) => {
        var e;
        return (e = this.objects.get(t)) == null ? void 0 : e.surfaceId;
      },
      emit: (t) => this.actions.emitAsync(t)
    }), this.moveCommit = new rt({
      createContext: (t) => this.createBehaviorContext(t),
      getLifecycle: (t) => this.moveBehavior.getLifecycle(t),
      normalize: (t, e) => this.moveActions.normalize(t, e),
      waitForRender: (t, e) => this.waitForMoveRender(t, e)
    }, this.moveActions), this.moveLanding = new nt({
      createContext: (t) => this.createBehaviorContext(t),
      getSession: (t) => this.sessionCoordinator.get(t),
      cancel: (t, e) => this.cancel(t, e),
      end: (t) => this.endSession(t)
    }), this.runtimeMove = S.fromPorts({
      getSession: (t) => this.sessionCoordinator.get(t),
      getBehavior: (t) => this.behaviors.get(t),
      createContext: (t) => this.createBehaviorContext(this.sessionCoordinator.get(t))
    }, this.moveCommit, this.moveLanding), this.visualState = new ct({ getAdapter: (t) => this.getObjectVisualAdapter(t) }), this.visualMotion = new dt({
      getSession: (t) => this.sessionCoordinator.get(t),
      getAdapter: (t) => this.getObjectVisualAdapter(t),
      createContext: (t, e, s) => this.createVisualLifecycleContext(t, e, s)
    }, this.visualProxyCoordinator), this.dispatcher = new pt({
      start: (t) => this.startInternal(t),
      update: (t, e) => this.updateInternal(t, e),
      release: (t, e) => this.releaseInternal(t, e),
      cancel: (t, e) => this.cancelInternal(t, e),
      interrupt: (t, e) => this.interruptInternal(t, e)
    }), this.behaviors.register(this.moveBehavior), x(this.registry.motionProfile), this.objects.subscribe((t) => {
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
    const { profile: e, controller: s, ...i } = t, n = e ?? (Object.keys(i).length ? i : void 0);
    n && this.registry.setMotionProfile(n), s && (this.registry.setMotionController(s), s.follow && Object.assign(B.position, s.follow), s.rotation && Object.assign(F, s.rotation), s.release && Object.assign(y, s.release)), x(this.registry.motionProfile);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  startObjectPointer(t, e, s, i, n) {
    var p, f;
    const r = this.getRegrab(t);
    if (r)
      return r(s), !0;
    const o = this.objects.get(t);
    if (!o) return !1;
    const a = this.registry.objectTypes.get(o.visual ?? o.type);
    if (!a) return !1;
    o.element !== e && this.objects.setElement(t, e);
    const c = {
      objectId: t,
      element: e,
      event: s,
      mode: o.visualMode ?? a.defaultVisualMode,
      fromRect: i,
      returnRect: n
    }, d = ((p = a.visual) == null ? void 0 : p.createMove) ?? a.createMove ?? (() => this.defaultVisualAdapter.createMove(c));
    if (d) {
      const g = d(c);
      return !g.driver && !g.lifecycle ? ((f = a.start) == null || f.call(a, c), !0) : (this.orchestrateMoveSession(
        g.request ?? {
          type: "move",
          objectId: t,
          input: { kind: "pointerdown", event: s }
        },
        {
          driver: g.driver,
          lifecycle: g.lifecycle,
          pointerInput: g.pointerInput,
          // 默认 detach driver 已由 MotionController 接管跟手；这里再把业务
          // 本体设为 followElement 会在同一 pointermove 写两次 left/top。
          // 跟手节点应由 Runtime visual driver 自行指定，业务 DOM 不参与。
          followElement: null
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
  createVisualLifecycleContext(t, e, s, i) {
    var f, g;
    const n = this.sessionCoordinator.get(t), r = n ? this.objects.get(n.objectId) : void 0, o = (r == null ? void 0 : r.element) ?? void 0, a = n ? this.getObjectVisualAdapter(n.objectId) : this.defaultVisualAdapter, c = new C(), h = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, u = (f = h == null ? void 0 : h.motion) == null ? void 0 : f.profile, d = this.registry.motionProfile, p = u || d ? {
      ...d,
      ...u,
      flip: { ...d == null ? void 0 : d.flip, ...u == null ? void 0 : u.flip },
      resize: { ...d == null ? void 0 : d.resize, ...u == null ? void 0 : u.resize },
      landing: { ...d == null ? void 0 : d.landing, ...u == null ? void 0 : u.landing },
      group: { ...d == null ? void 0 : d.group, ...u == null ? void 0 : u.group }
    } : void 0;
    return {
      objectId: (n == null ? void 0 : n.objectId) ?? "",
      sessionId: t,
      mode: (r == null ? void 0 : r.visualMode) ?? "detach",
      destination: e,
      sourceElement: o,
      beforeContent: i,
      targetElement: s,
      sourceRect: o == null ? void 0 : o.getBoundingClientRect(),
      visualSnapshot: o ? (a.captureVisualState ?? c.captureVisualState)(o) : void 0,
      targetSnapshot: s ? (a.captureVisualState ?? c.captureVisualState)(s) : void 0,
      motion: p,
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
    var i, n, r;
    const e = this.visualProxyCoordinator.get(t);
    if (!e) return;
    const s = this.sessionCoordinator.get(t);
    if (s) {
      const o = this.createVisualLifecycleContext(t);
      (n = (i = this.getObjectVisualAdapter(s.objectId)).dispose) == null || n.call(i, e, o);
    }
    (r = e.dispose) == null || r.call(e), this.visualProxyCoordinator.remove(t);
  }
  createCompletionGate(t, e) {
    let s = !1, i;
    const r = {
      promise: new Promise((o) => {
        i = o;
      }),
      complete: (o) => {
        s || (s = !0, i(o), this.sessionCoordinator.removeGate(t, r));
      },
      fail: () => {
        s || (s = !0, i(e), this.sessionCoordinator.removeGate(t, r));
      }
    };
    return this.sessionCoordinator.addGate(t, r), r;
  }
  setHitResolver(t) {
    this.hitResolver = t;
  }
  getHitResolver() {
    return this.hitResolver;
  }
  /** 默认命中由已注册 Object/Surface 推导；特殊几何才需 setHitResolver()。 */
  createRegisteredHitResolver(t) {
    return Y(this.objects, this.surfaces, t);
  }
  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(t, e, s) {
    if (this.hitResolver) {
      const r = this.hitResolver.findSurface({ x: e, y: s });
      return r != null && r.dataset.column ? {
        columnId: r.dataset.column,
        index: this.hitResolver.findIndex(r, { x: e, y: s }, t)
      } : null;
    }
    const i = this.createRegisteredHitResolver(t), n = i.findSurface({ x: e, y: s });
    return n ? { columnId: n.id, index: i.findIndex(n, { x: e, y: s }, t) } : null;
  }
  /** 自动滚动只需要当前命中 Surface 的真实滚动元素。 */
  resolveMoveSurfaceElement(t, e, s) {
    var n;
    if (this.hitResolver) return this.hitResolver.findSurface({ x: e, y: s });
    const i = this.createRegisteredHitResolver(t).findSurface({ x: e, y: s });
    return ((n = i == null ? void 0 : i.viewport) == null ? void 0 : n.call(i)) ?? (i == null ? void 0 : i.element) ?? null;
  }
  /** 取得指定 Surface 的滚动视口，不让视觉 driver 探查业务 DOM 结构。 */
  resolveMoveSurfaceViewport(t) {
    var s;
    const e = this.surfaces.get(t);
    return ((s = e == null ? void 0 : e.viewport) == null ? void 0 : s.call(e)) ?? (e == null ? void 0 : e.element) ?? null;
  }
  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(t, e) {
    const s = this.objects.get(t), i = e ?? (s == null ? void 0 : s.surfaceId);
    return !s || !i ? -1 : [...this.objects.values()].filter((n) => n.surfaceId === i).map((n) => n.id).sort((n, r) => {
      var c, h, u, d;
      const o = (h = (c = this.objects.get(n)) == null ? void 0 : c.element) == null ? void 0 : h.getBoundingClientRect(), a = (d = (u = this.objects.get(r)) == null ? void 0 : u.element) == null ? void 0 : d.getBoundingClientRect();
      return !o || !a ? 0 : o.top - a.top || o.left - a.left;
    }).indexOf(t);
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
  /**
   * 等待 Action 触发的 Vue/React DOM 提交。两帧覆盖同步 Store 更新与框架
   * patch；每帧都校验 Session，避免旧事务在 regrab 后继续读取 target。
   */
  async waitForMoveRender(t, e) {
    for (let s = 0; s < 2; s += 1)
      if (await new Promise((i) => requestAnimationFrame(() => i())), this.sessionCoordinator.get(t.id) !== t || t.state === "disposed" || t.state === "interrupt")
        return !1;
    return !0;
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
    var h, u, d;
    const i = this.sessionCoordinator.get(t);
    if (!i) return null;
    const r = (u = (h = this.createBehaviorContext(i).visual) == null ? void 0 : h.resolveTarget) == null ? void 0 : u.call(h, i.objectId, e), o = s == null ? void 0 : s(), a = (d = this.objects.get(i.objectId)) == null ? void 0 : d.element, c = r ?? o ?? a ?? null;
    return !c || !c.isConnected ? null : (this.moveBehavior.getContext(t).transaction.target = c, c);
  }
  /**
   * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
   *
   * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
   * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
   * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
   */
  async waitForMoveTarget(t, e, s = 6) {
    const i = this.sessionCoordinator.get(t);
    if (!i) return null;
    const n = this.moveBehavior.getContext(t), r = n.sourceElement, o = this.getDestinationSurfaceId(e), a = n.transaction.destination, c = typeof (a == null ? void 0 : a.fromSurfaceId) == "string" ? a.fromSurfaceId : null;
    for (let h = 0; h < s; h += 1) {
      const u = this.sessionCoordinator.get(t);
      if (u !== i || u.state === "disposed" || u.state === "interrupt") return null;
      const d = this.objects.get(i.objectId), p = this.resolveMoveTarget(t, e), f = !o || (d == null ? void 0 : d.surfaceId) === o;
      if (p && f && (o === c || p !== r)) return p;
      await new Promise((m) => requestAnimationFrame(() => m()));
    }
    return null;
  }
  getDestinationSurfaceId(t) {
    if (!t || typeof t != "object") return null;
    const e = t;
    return typeof e.toSurfaceId == "string" ? e.toSurfaceId : typeof e.columnId == "string" ? e.columnId : null;
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
  bindRegrabTarget(t, e, s, i) {
    const n = this.sessionCoordinator.get(t);
    n && this.inputCoordinator.bindRegrabTarget(n, e, s, i);
  }
  createRegrabContext(t, e, s, i) {
    const n = this.sessionCoordinator.get(t);
    return !n || n.state !== "landing" ? null : {
      sessionId: t,
      objectId: n.objectId,
      event: e,
      proxyElement: s,
      sourceElement: i,
      proxyRect: s.getBoundingClientRect(),
      interrupt: (r) => this.interrupt(t, r ?? "regrab")
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
  trackLandingTarget(t, e, s, i = {}) {
    const n = this.sessionCoordinator.get(t);
    return n ? this.visualState.trackTarget(n.cleanup, e, s, i) : () => {
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
      const r = this.sessionCoordinator.get(e.sessionId);
      if (!r) throw new Error(`Session not found: ${e.sessionId}`);
      s = r;
    } else {
      e.driver && this.moveBehavior.setDriver(e.driver);
      const r = this.start(t);
      e.driver && this.moveBehavior.setDriver({}), s = this.sessionCoordinator.get(r.id);
    }
    const i = this.getMoveContext(s.id);
    e.followElement !== void 0 && (i.followElement = e.followElement), e.driver && this.bindMoveSession(s.id, e.driver), e.lifecycle ? this.bindMoveLifecycle(s.id, e.lifecycle) : e.visualStrategy && this.bindMoveLifecycle(s.id, e.visualStrategy);
    const n = this.bindPointerSessionInput(s.id, e.pointerInput);
    return {
      id: s.id,
      get state() {
        return s.state;
      },
      get moveContext() {
        return i;
      },
      cancel: (r) => this.cancel(s.id, r ?? "cancelled"),
      interrupt: (r) => this.interrupt(s.id, r ?? "interrupted"),
      dispose: () => {
        n();
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
      getSession: (i) => this.sessionCoordinator.get(i),
      getBehavior: (i) => this.behaviors.get(i),
      createContext: (i) => this.createBehaviorContext(i),
      cancel: (i, n) => this.cancel(i, n),
      end: (i) => this.endSession(i)
    };
    return this.runtimeMove.release(t, e, s);
  }
  cancel(t, e = "cancelled") {
    this.dispatcher.cancel(t, e);
  }
  cancelInternal(t, e = "cancelled") {
    const s = this.sessionCoordinator.get(t);
    if (!s) return;
    const i = this.behaviors.get(s.type), n = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      n,
      e,
      "cancel",
      (r, o, a) => {
        var c;
        r instanceof v && r.cancelLayout(o, a), (c = r == null ? void 0 : r.cancel) == null || c.call(r, o, a);
      },
      (r) => this.failCompletionGates(r.id),
      (r, o) => this.disposeBehavior(r, o)
    );
  }
  interrupt(t, e = "cancel") {
    this.dispatcher.interrupt(t, e);
  }
  interruptInternal(t, e = "cancel") {
    const s = this.sessionCoordinator.get(t);
    if (!s) return;
    const i = this.behaviors.get(s.type), n = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      n,
      e,
      "interrupt",
      (r, o, a) => {
        var c;
        r instanceof v && r.cancelLayout(o, a), (c = r == null ? void 0 : r.interrupt) == null || c.call(r, o, a);
      },
      (r) => this.failCompletionGates(r.id),
      (r, o) => this.disposeBehavior(r, o)
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
      (i) => this.disposeVisualProxy(i),
      (i, n) => this.disposeBehavior(i, n)
    );
  }
  failCompletionGates(t) {
    this.sessionCoordinator.failGates(t), this.disposeVisualProxy(t);
  }
  disposeBehavior(t, e) {
    var s, i, n, r;
    try {
      t instanceof v && ((n = (i = (s = t.getLifecycle(e.session.id)) == null ? void 0 : s.surface) == null ? void 0 : i.dispose) == null || n.call(i, e)), (r = t == null ? void 0 : t.dispose) == null || r.call(t, e);
    } catch (o) {
      console.error("Behavior dispose failed", o);
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
const vt = new gt();
export {
  C as D,
  ot as M,
  z as O,
  gt as R,
  Z as S,
  X as V,
  v as a,
  rt as b,
  nt as c,
  it as d,
  $ as e,
  st as f,
  pt as g,
  ut as h,
  S as i,
  q as j,
  et as k,
  tt as l,
  G as m,
  dt as n,
  lt as o,
  ct as p,
  ht as q,
  Y as r,
  vt as s,
  at as t
};
