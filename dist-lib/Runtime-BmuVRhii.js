import { l as I, m as O, n as V, o as B, q as F, u as D, D as L, v as G, w as z, x as H, h as $, y as _, z as q, A as W, B as N, C as k, F as U, a as X, E as Y, s as J, e as K, G as Q, H as Z, r as tt, c as et } from "./DetachAdapter-D_Wg8Wh-.js";
class x {
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
class st {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new x();
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
    let r = !1;
    return {
      release: () => {
        r || (r = !0, i.get(e) === s && (i.delete(e), i.size === 0 && this.channelOwners.delete(t)));
      }
    };
  }
  ownsChannel(t, e, s) {
    var i;
    return ((i = this.channelOwners.get(t)) == null ? void 0 : i.get(e)) === s;
  }
}
class it {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new x(), this.generations = /* @__PURE__ */ new Map();
  }
  register(t) {
    const e = (this.generations.get(t.id) ?? 0) + 1;
    return this.generations.set(t.id, e), this.items.set(t.id, { ...t, generation: e }), this.events.emit({ type: "object-added", id: t.id }), e;
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
class rt {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new x();
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
class nt {
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
class ot {
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
function T(l) {
  return !!(l && typeof l.then == "function");
}
class C {
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
    var i, r, n;
    const e = this.getContext(t.session.id), s = (n = (r = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.layout) == null ? void 0 : r.capture) == null ? void 0 : n.call(r, t);
    e.layoutSnapshot = s;
  }
  playLayout(t, e = !1) {
    var r, n;
    const s = this.getContext(t.session.id), i = this.sessionLifecycles.get(t.session.id);
    s.layoutSnapshot !== void 0 && ((n = (r = i == null ? void 0 : i.layout) == null ? void 0 : r.play) == null || n.call(r, t, s.layoutSnapshot, e));
  }
  /** 列尾追加专用：等下一帧（Vue patch 落地）再量布局执行 Invert。 */
  playLayoutOnRaf(t) {
    this.playLayout(t, !0);
  }
  cancelLayout(t, e) {
    var r, n, o;
    const s = this.getContext(t.session.id), i = s.layoutSnapshot;
    i !== void 0 && ((o = (n = (r = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : r.layout) == null ? void 0 : n.cancel) == null || o.call(n, t, i, e)), s.layoutSnapshot = void 0;
  }
  getContext(t) {
    let e = this.contexts.get(t);
    return e || (e = {
      transaction: new ot(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(t, e)), e;
  }
  driverFor(t) {
    return this.sessionDrivers.get(t) ?? this.driver;
  }
  prepare(t, e) {
    var a, c, d, h, u;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("prepare");
    const i = ((c = (a = t.visual) == null ? void 0 : a.resolveSource) == null ? void 0 : c.call(a, e.objectId)) ?? null;
    s.sourceElement = i, s.transaction.source = i;
    const r = e.input.event instanceof PointerEvent ? e.input.event : null;
    if (i && r) {
      const g = i.getBoundingClientRect();
      s.dragOffset = {
        x: r.clientX - g.left,
        y: r.clientY - g.top
      };
    }
    const n = (h = (d = this.driverFor(t.session.id)).prepare) == null ? void 0 : h.call(d, t, e), o = this.sessionLifecycles.get(t.session.id);
    return n && typeof n.then == "function" ? Promise.resolve(n).then(async () => {
      var g;
      return (g = o == null ? void 0 : o.beginDrag) == null ? void 0 : g.call(o, t);
    }) : (u = o == null ? void 0 : o.beginDrag) == null ? void 0 : u.call(o, t);
  }
  update(t, e) {
    var r, n;
    if (t.session.state !== "active") return;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("active");
    const i = e.event instanceof PointerEvent ? e.event : null;
    (n = (r = this.driverFor(t.session.id)).update) == null || n.call(r, t, e), i && s.followElement && (s.followElement.style.left = `${i.clientX - s.dragOffset.x}px`, s.followElement.style.top = `${i.clientY - s.dragOffset.y}px`);
  }
  release(t, e) {
    var n;
    const s = this.getContext(t.session.id);
    s.transaction.setPhase("release");
    const i = this.driverFor(t.session.id);
    if (i.resolveDestination) {
      const o = i.resolveDestination(t, e);
      return T(o) ? o.then((a) => (a && a.accepted && a.destination !== void 0 && (s.destination = a.destination, s.transaction.destination = a.destination), a)) : (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o);
    }
    const r = (n = i.release) == null ? void 0 : n.call(i, t, e);
    return T(r) ? r.then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o)) : (r && r.accepted && r.destination !== void 0 && (s.destination = r.destination, s.transaction.destination = r.destination), r);
  }
  commit(t, e) {
    this.getContext(t.session.id).transaction.setPhase("landing");
    const s = this.driverFor(t.session.id);
    if (s.commit)
      return s.commit(t, e);
  }
  cancel(t, e) {
    var i, r, n, o;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.cancel) == null || r.call(i, t, e), (o = (n = this.driverFor(t.session.id)).cancel) == null || o.call(n, t, e);
  }
  interrupt(t, e) {
    var i, r, n, o;
    const s = this.getContext(t.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.cancel) == null || r.call(i, t, e), (o = (n = this.driverFor(t.session.id)).interrupt) == null || o.call(n, t, e);
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
    const i = this.sessionLifecycles.get(t.session.id), r = (o = i == null ? void 0 : i.landing) == null ? void 0 : o.call(i, t, e), n = Promise.resolve(r).then((a) => ((!a || a.completed) && (s.landingCompleted = !0), a));
    return s.landingPromise = n, n;
  }
  reveal(t, e) {
    var i, r;
    const s = this.getContext(t.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (r = (i = this.sessionLifecycles.get(t.session.id)) == null ? void 0 : i.reveal) == null ? void 0 : r.call(i, t, e);
  }
}
const at = [
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
function ct(l) {
  const t = getComputedStyle(l);
  return Object.fromEntries(
    at.map((e) => [e, t[e]])
  );
}
function lt(l, t) {
  Object.assign(l.style, t);
}
function dt(l, t) {
  lt(t, ct(l));
}
class M {
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
    var i, r;
    const e = ((r = (i = this.runtime) == null ? void 0 : i.objects.get(t)) == null ? void 0 : r.element) ?? null;
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
      backgroundImage: e.backgroundImage,
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
    const e = I(t.beforeContent, t.sourceRect), s = O(e);
    dt(t.sourceElement, s);
    const i = t.visualSnapshot;
    return i && (s.style.boxShadow = i.boxShadow, s.style.borderRadius = i.borderRadius, s.style.backgroundColor = i.background, i.backgroundImage && i.backgroundImage !== "none" && (s.style.backgroundImage = i.backgroundImage), s.style.opacity = i.opacity, V(e).style.transform = "scale(1.03)"), _() && q(s), s.querySelectorAll("[class]").forEach((r) => {
      const n = getComputedStyle(r);
      n.opacity === "0" && n.pointerEvents === "none" && (r.style.opacity = "1");
    }), { element: e };
  }
  land(t, e, s) {
    var u, g, p, f, v, m, y, S, R;
    const i = t.element;
    if (!((u = s.targetSnapshot) != null && u.rect) && !e.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const r = ((g = s.targetSnapshot) == null ? void 0 : g.rect) ?? e.getBoundingClientRect(), n = {
      left: r.left ?? r.x,
      top: r.top ?? r.y,
      width: r.width,
      height: r.height
    }, o = (b) => {
      var j;
      const w = (j = s.landingBounds) == null ? void 0 : j.call(s);
      return w ? W(b, w) : b;
    }, a = o(n);
    B(e, s.sessionId), i.style.transition = "none", i.style.width = `${a.width}px`, i.style.height = `${a.height}px`;
    const c = s.motionEnabled === !1 ? F : D, { finished: d, retarget: h } = c(i, a, {
      duration: ((f = (p = s.motion) == null ? void 0 : p.landing) == null ? void 0 : f.duration) ?? G.landing.duration,
      targetShadow: (v = s.targetSnapshot) == null ? void 0 : v.boxShadow,
      targetRadius: (m = s.targetSnapshot) == null ? void 0 : m.borderRadius,
      targetBackground: (y = s.targetSnapshot) == null ? void 0 : y.background,
      targetBackgroundImage: (S = s.targetSnapshot) == null ? void 0 : S.backgroundImage,
      targetOpacity: (R = s.targetSnapshot) == null ? void 0 : R.opacity,
      targetContent: e,
      readTarget: () => o(e.getBoundingClientRect()),
      motionState: s.motionState,
      coast: {
        duration: L.coastSeconds,
        friction: N,
        maxDistance: L.maxCoast,
        minVelocity: L.minVelocity
      },
      releaseDamping: L.dampingRatio
    });
    return this.runtime && this.runtime.trackLandingTarget(s.sessionId, e, () => {
      var b;
      (b = s.targetSnapshot) != null && b.rect && !e.closest("[data-layout-surface]") ? h(o({
        left: s.targetSnapshot.rect.x,
        top: s.targetSnapshot.rect.y,
        width: s.targetSnapshot.rect.width,
        height: s.targetSnapshot.rect.height
      })) : h(o(e.getBoundingClientRect()));
    }), d.then(() => ({ completed: !0 }));
  }
  reveal(t, e, s) {
    z(e, s.sessionId);
  }
  dispose(t, e) {
    var i;
    const s = t.element;
    (i = t.dispose) == null || i.call(t), H(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(t) {
    const e = this.runtime;
    return !e || !e.objects.hasAbility(t.objectId, "move") ? {} : (t.event.preventDefault(), $({
      runtime: e,
      objectId: t.objectId,
      element: t.element,
      event: t.event,
      fromRect: t.fromRect,
      returnRect: t.returnRect
    }));
  }
}
class ut {
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
function A(l, t) {
  const e = l.getBoundingClientRect();
  return t.x >= e.left && t.x <= e.right && t.y >= e.top && t.y <= e.bottom;
}
function E(l) {
  var e;
  const t = (e = l.element) == null ? void 0 : e.getBoundingClientRect();
  return t ? t.width * t.height : Number.POSITIVE_INFINITY;
}
function ht(l, t, e) {
  const s = l.get(e), i = () => t.snapshot().filter((r) => {
    var n;
    return (n = r.element) == null ? void 0 : n.isConnected;
  }).filter((r) => s ? t.accepts(r.id, s.type) : !1);
  return {
    findSurface(r) {
      return i().filter((n) => A(n.element, r)).sort((n, o) => E(n) - E(o))[0] ?? null;
    },
    findTarget(r, n, o) {
      return [...l.values()].filter((a) => a.id !== o && a.surfaceId === r.id).map((a) => a.element).filter((a) => !!(a != null && a.isConnected)).find((a) => A(a, n)) ?? null;
    },
    findIndex(r, n, o) {
      const a = [...l.values()].filter((c) => c.id !== o && c.surfaceId === r.id).map((c) => c.element).filter((c) => !!(c != null && c.isConnected)).sort((c, d) => {
        const h = c.getBoundingClientRect(), u = d.getBoundingClientRect();
        return h.top - u.top || h.left - u.left;
      });
      for (let c = 0; c < a.length; c += 1) {
        const d = a[c].getBoundingClientRect();
        if (n.y < d.top + d.height / 2) return c;
      }
      return a.length;
    }
  };
}
class pt {
  constructor() {
    this.visuals = new ut(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
class gt {
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
const ft = {
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
let mt = 1;
class vt {
  constructor(t, e, s) {
    this.type = t, this.objectId = e, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new gt(), this.leases = [], this.id = `session-${mt++}`;
  }
  transition(t) {
    if (this.state !== t) {
      if (!ft[this.state].includes(t))
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
      this.state !== "interrupt" && this.state !== "cancelled" && this.state !== "done" && this.transition("interrupt"), (this.state === "interrupt" || this.state === "cancelled" || this.state === "done") && this.transition("disposed"), this.leases.forEach((e) => e.release()), this.leases = [], this.cleanup.disposeAll();
      return;
    }
    (this.state === "prepare" || this.state === "active" || this.state === "release" || this.state === "landing" || this.state === "saving") && this.transition("interrupt"), this.dispose();
  }
}
class yt {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(t, e, s) {
    const i = new vt(t, e, s);
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
class bt {
  constructor(t) {
    this.sessions = t;
  }
  finalize(t, e, s, i, r) {
    try {
      this.sessions.finalize(t.id, (n) => i(n.id));
    } finally {
      r(e, s);
    }
  }
  terminate(t, e, s, i, r, n, o, a) {
    try {
      n(e, s, i);
    } catch (c) {
      console.error(`Behavior ${r} failed`, c);
    } finally {
      try {
        o(t), r === "cancel" ? this.sessions.cancel(t.id) : this.sessions.interrupt(t.id, i === "regrab" ? "regrab" : "cancel");
      } finally {
        a(e, s);
      }
    }
  }
}
function Ct(l) {
  return !!(l && typeof l.then == "function");
}
class P {
  constructor(t, e, s, i) {
    this.updateCoordinator = t, this.releaseCoordinator = e, this.commitCoordinator = s, this.landingCoordinator = i;
  }
  static fromPorts(t, e, s) {
    return new P(
      new St(t),
      new wt(),
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
  release(t, e, s) {
    var c;
    const i = s.getSession(t), r = this.prepareRelease(i, e);
    if (r.kind === "ignore") return Promise.resolve();
    if (r.kind === "cancel")
      return i && s.cancel(i.id, r.reason), Promise.resolve();
    const n = r.session, o = s.getBehavior(n.type);
    o instanceof C && s.captureLayout(n.id);
    let a;
    try {
      a = (c = o == null ? void 0 : o.release) == null ? void 0 : c.call(o, s.createContext(n), e);
    } catch (d) {
      return s.cancel(n.id, d instanceof Error ? d.message : "release-failed"), Promise.resolve();
    }
    return Ct(a) ? Promise.resolve(a).then((d) => this.finishRelease(n, o, d, s), (d) => {
      s.cancel(n.id, d instanceof Error ? d.message : "release-failed");
    }) : this.finishRelease(n, o, a, s);
  }
  async finishRelease(t, e, s, i) {
    if (i.getSession(t.id) !== t) return;
    const r = s;
    if ((r == null ? void 0 : r.accepted) === !1) {
      i.cancel(t.id, "no-valid-drop");
      return;
    }
    if (t.state === "release" && t.transition("landing"), !(e instanceof C)) {
      i.end(t);
      return;
    }
    const n = r == null ? void 0 : r.destination;
    if (n === void 0) {
      i.cancel(t.id, "invalid-release-result");
      return;
    }
    try {
      await this.commit(t, e, n, (r == null ? void 0 : r.emitAction) !== !1);
    } catch (o) {
      i.cancel(t.id, o instanceof Error ? o.message : "commit-failed");
      return;
    }
    await this.land(t, e, n);
  }
  start(t, e) {
    var o;
    const s = e.getBehavior(t.type);
    if (!s) throw new Error(`Unknown interaction behavior: ${t.type}`);
    const i = e.createSession(t.type, t.objectId), r = e.getVisualStrategy(t.objectId);
    r && e.bindLifecycle(i.id, r);
    const n = e.createContext(i);
    try {
      const a = (o = s.prepare) == null ? void 0 : o.call(s, n, t);
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
class St {
  constructor(t) {
    this.port = t;
  }
  update(t, e) {
    var i, r;
    const s = this.port.getSession(t);
    !s || s.state !== "active" || (r = (i = this.port.getBehavior(s.type)) == null ? void 0 : i.update) == null || r.call(i, this.port.createContext(t), e);
  }
}
class wt {
  prepare(t, e) {
    return t ? e.kind === "pointercancel" || e.kind === "blur" || e.kind === "lostpointercapture" ? { kind: "cancel", reason: e.kind } : t.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (t.state === "active" && t.transition("release"), t.state === "release" ? { kind: "continue", session: t } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class Rt {
  constructor(t, e) {
    this.port = t, this.actions = e;
  }
  resolveIsAppend(t, e) {
    var r, n, o, a;
    if (!e) return !1;
    const s = (n = (r = this.port).getObjectIndex) == null ? void 0 : n.call(r, t, e.toSurfaceId), i = (a = (o = this.port).getSurfaceObjectCount) == null ? void 0 : a.call(o, e.toSurfaceId);
    return s !== void 0 && s >= 0 && i !== void 0 ? s >= i - 1 : e.toIndex !== void 0 && i !== void 0 && e.toIndex >= i - 1;
  }
  async commit(t, e, s, i = !0) {
    var c, d, h, u;
    const r = this.port.createContext(t);
    if (await e.commit(r, s), !i) {
      const g = this.port.normalize(t.objectId, s);
      g && (e.getContext(t.id).transaction.destination = g), this.resolveIsAppend(t.objectId, g) ? this.port.playLayout(t.id, !0) : this.port.playLayout(t.id);
      return;
    }
    const n = this.port.getLifecycle(t.id), o = this.port.normalize(t.objectId, s);
    o && await ((d = (c = n == null ? void 0 : n.surface) == null ? void 0 : c.leave) == null ? void 0 : d.call(c, r, o.fromSurfaceId)), await this.actions.emit(t.objectId, e.getContext(t.id).destination, e.getContext(t.id).transaction), o && await ((u = (h = n == null ? void 0 : n.surface) == null ? void 0 : h.enter) == null ? void 0 : u.call(h, r, o.toSurfaceId)), this.resolveIsAppend(t.objectId, o) ? this.port.playLayout(t.id, !0) : this.port.playLayout(t.id);
  }
}
class Lt {
  constructor(t) {
    this.port = t;
  }
  async run(t, e, s) {
    try {
      const i = await e.landing(this.port.createContext(t), s), r = this.port.getSession(t.id);
      if (r !== t || r.state === "disposed" || r.state === "interrupt") return;
      if (i && !i.completed) return this.port.cancel(t.id, i.reason ?? "landing-failed");
      i && i.reveal && await i.reveal(), t.handoff(), e.reveal && await e.reveal(this.port.createContext(t), s), this.port.getSession(t.id) === t && this.port.end(t);
    } catch (i) {
      this.port.getSession(t.id) === t && this.port.cancel(t.id, i instanceof Error ? i.message : "landing-failed");
    }
  }
}
class Mt {
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
function xt(l) {
  let t = null, e = null, s = !1;
  const i = Math.max(0, l.stableFrameLimit ?? 2), r = Math.max(1, l.idlePollInterval ?? 4);
  let n = 0, o = 0, a = null;
  const c = () => {
    s || (s = !0, e !== null && cancelAnimationFrame(e), e = null, t == null || t.disconnect(), t = null);
  };
  if (typeof ResizeObserver > "u") return c;
  const d = () => {
    if (s || !l.target.isConnected) return;
    const u = l.target.getBoundingClientRect();
    a = u, n = 0, o = 0, l.retarget(u);
  };
  if (t = new ResizeObserver(d), t.observe(l.target), l.observeAncestors !== !1) {
    const u = typeof document < "u" ? document.body : null, g = l.stopAt === void 0 ? u : l.stopAt;
    let p = l.target.parentElement;
    for (; p && p !== g; )
      t.observe(p), p = p.parentElement;
  }
  const h = () => {
    if (s || (e = requestAnimationFrame(h), !l.target.isConnected) || (o += 1, n >= i && o % r !== 0)) return;
    const u = l.target.getBoundingClientRect();
    if (a && Math.abs(u.left - a.left) < 0.5 && Math.abs(u.top - a.top) < 0.5 && Math.abs(u.width - a.width) < 0.5 && Math.abs(u.height - a.height) < 0.5) {
      n += 1;
      return;
    }
    n = 0, a = u, l.retarget(u);
  };
  return e = requestAnimationFrame(h), l.cleanup.track(c), c;
}
class Pt {
  constructor(t) {
    this.port = t;
  }
  resolveTarget(t, e) {
    var i, r;
    const s = ((r = (i = this.port.getAdapter(t)).resolveTarget) == null ? void 0 : r.call(i, t, e)) ?? new M().resolveTarget(t);
    return s != null && s.isConnected ? s : null;
  }
  apply(t, e, s) {
    (this.port.getAdapter(t).applyState ?? new M().applyState)(e, s);
  }
  capture(t, e) {
    return (this.port.getAdapter(t).captureVisualState ?? new M().captureVisualState)(e);
  }
  trackTarget(t, e, s, i = {}) {
    return xt({ ...i, cleanup: t, target: e, retarget: s });
  }
}
class jt {
  constructor() {
    this.proxies = /* @__PURE__ */ new Map();
  }
  register(t, e) {
    this.proxies.set(t, e);
  }
  get(t) {
    return this.proxies.get(t);
  }
  remove(t) {
    const e = this.proxies.get(t);
    return this.proxies.delete(t), e;
  }
}
class kt {
  constructor(t, e) {
    this.port = t, this.proxies = e;
  }
  create(t, e) {
    var r, n;
    const s = this.port.getSession(t);
    if (!s) return;
    const i = (n = (r = this.port.getAdapter(s.objectId)).createProxy) == null ? void 0 : n.call(r, e);
    if (i)
      return this.proxies.register(t, i), i;
  }
  async land(t, e, s) {
    var a, c;
    const i = this.port.getSession(t), r = this.proxies.get(t);
    if (!i || !r) return { completed: !1, reason: "visual-proxy-missing" };
    const n = s ?? this.port.createContext(t, void 0, e), o = await ((c = (a = this.port.getAdapter(i.objectId)).land) == null ? void 0 : c.call(a, r, e, n));
    return o || { completed: !0 };
  }
  update(t, e) {
    var r, n;
    const s = this.port.getSession(t), i = this.proxies.get(t);
    !s || !i || (n = (r = this.port.getAdapter(s.objectId)).updateProxy) == null || n.call(r, i, e ?? this.port.createContext(t));
  }
  async reveal(t, e, s) {
    var n, o;
    const i = this.port.getSession(t), r = this.proxies.get(t);
    !i || !r || await ((o = (n = this.port.getAdapter(i.objectId)).reveal) == null ? void 0 : o.call(n, r, e, s ?? this.port.createContext(t, void 0, e)));
  }
}
function Tt(l, t, e = {}) {
  const s = e.target ?? window, i = e.captureTarget;
  let r = !1, n = null, o = null;
  const a = (p) => {
    n = p, o === null && (o = s.requestAnimationFrame(() => {
      o = null;
      const f = n;
      n = null, !(r || !f) && l.update(t.id, { kind: "pointermove", event: f });
    }));
  }, c = (p) => {
    g(), l.release(t.id, { kind: "pointerup", event: p });
  }, d = (p) => {
    g(), l.release(t.id, { kind: "pointercancel", event: p });
  }, h = () => {
    g(), l.release(t.id, { kind: "blur" });
  }, u = (p) => {
    g(), l.release(t.id, { kind: "lostpointercapture", event: p });
  };
  function g() {
    r || (r = !0, n = null, o !== null && (s.cancelAnimationFrame(o), o = null), s.removeEventListener("pointermove", a), s.removeEventListener("pointerup", c), s.removeEventListener("pointercancel", d), s.removeEventListener("blur", h), i == null || i.removeEventListener("lostpointercapture", u));
  }
  return s.addEventListener("pointermove", a), s.addEventListener("pointerup", c), s.addEventListener("pointercancel", d), s.addEventListener("blur", h), i == null || i.addEventListener("lostpointercapture", u), t.cleanup.track(g), g;
}
class At {
  constructor(t) {
    this.port = t, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(t, e, s = {}) {
    var a, c;
    (a = this.disposers.get(t)) == null || a(), (c = this.bindings.get(e)) == null || c();
    let i = null;
    const r = () => {
      i && (window.removeEventListener("pointermove", i.move), window.removeEventListener("pointerup", i.up), window.removeEventListener("pointercancel", i.up), i = null);
    }, n = (d) => {
      if (!(d instanceof PointerEvent) || d.button !== 0 && d.pointerType === "mouse") return;
      if (!d.pointerType) {
        this.port.startObjectPointer(t, e, d);
        return;
      }
      r();
      const h = d.clientX, u = d.clientY, g = (f) => {
        if (!(f instanceof PointerEvent)) return;
        const v = Math.max(0, s.dragThreshold ?? 5);
        Math.hypot(f.clientX - h, f.clientY - u) < v || (r(), f.preventDefault(), this.port.startObjectPointer(t, e, d));
      }, p = () => r();
      i = { down: d, move: g, up: p }, window.addEventListener("pointermove", g), window.addEventListener("pointerup", p), window.addEventListener("pointercancel", p);
    };
    e.addEventListener("pointerdown", n);
    const o = () => {
      e.removeEventListener("pointerdown", n), r();
    };
    return this.bindings.set(e, o), this.disposers.set(t, o), o;
  }
  sync(t) {
    var i;
    const e = this.port.objects.get(t);
    if ((i = this.disposers.get(t)) == null || i(), this.disposers.delete(t), !(e != null && e.element) || !this.port.registry.objectTypes.has(e.visual ?? e.type)) return;
    const s = this.port.registry.objectTypes.get(e.visual ?? e.type);
    this.bind(t, e.element, s == null ? void 0 : s.pointerInput);
  }
  remove(t) {
    var e;
    (e = this.disposers.get(t)) == null || e(), this.disposers.delete(t);
  }
  bindRegrabTarget(t, e, s, i) {
    this.port.registerRegrab(e, i);
    const r = (n) => {
      n instanceof PointerEvent && this.port.regrab(e, n);
    };
    s.addEventListener("pointerdown", r), t.cleanup.trackTargetListener(s, "pointerdown", r);
  }
  bindSession(t, e = {}) {
    return Tt({
      update: (s, i) => this.port.update(s, i),
      release: (s, i) => this.port.release(s, i)
    }, t, e);
  }
}
class Et {
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
function It(l, t = {}) {
  const e = t.edgeSize ?? 48, s = t.maxSpeed ?? 16;
  let i = null, r = null, n = null, o = !1, a = null, c = 0, d = null, h = null;
  const u = () => {
    if (!i || !i.isConnected) {
      a = null;
      return;
    }
    a = i.getBoundingClientRect(), c = 0;
  }, g = (m) => {
    if (d !== m) {
      if (h == null || h.disconnect(), d = m, !m || typeof ResizeObserver > "u") {
        h = null;
        return;
      }
      h = new ResizeObserver(u), h.observe(m);
    }
  }, p = (m) => {
    const y = (e - m) / e;
    return Math.ceil(s * y);
  }, f = () => {
    var R, b;
    if (o || (n = requestAnimationFrame(f), !i || !r || !i.isConnected)) return;
    (!a || c++ >= 8) && u();
    const m = a;
    if (!m || r.x < m.left || r.x > m.right) return;
    const y = r.y - m.top, S = m.bottom - r.y;
    if (y < e) {
      const w = i.scrollTop;
      i.scrollTop -= p(y), i.scrollTop !== w && ((R = t.onScroll) == null || R.call(t, r));
    } else if (S < e) {
      const w = i.scrollTop;
      i.scrollTop += p(S), i.scrollTop !== w && ((b = t.onScroll) == null || b.call(t, r));
    }
  }, v = () => {
    o || (o = !0, n !== null && cancelAnimationFrame(n), n = null, h == null || h.disconnect(), h = null, d = null, a = null);
  };
  return n = requestAnimationFrame(f), l.track(v), {
    update(m, y) {
      o || (i !== m && (a = null, c = 0, g(m)), i = m, r = y, a === null && u());
    },
    stop: v
  };
}
class Ot {
  constructor() {
    this.owner = new st(), this.objects = new it(), this.surfaces = new rt(), this.behaviors = new nt(), this.registry = new pt(), this.hitResolver = null, this.sessionCoordinator = new yt(), this.runtimeSession = new bt(this.sessionCoordinator), this.events = new x(), this.actions = new x(), this.visualProxyCoordinator = new jt(), this.surfaceScrollFrames = /* @__PURE__ */ new WeakMap(), this.defaultVisualAdapter = new M(this), this.moveBehavior = new C(), this.inputCoordinator = new At({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (t, e, s) => this.startObjectPointer(t, e, s),
      registerRegrab: (t, e) => this.registerRegrab(t, e),
      regrab: (t, e) => this.regrab(t, e),
      update: (t, e) => this.update(t, e),
      release: (t, e) => this.release(t, e)
    }), this.moveActions = new Mt({
      getObjectSurface: (t) => {
        var e;
        return (e = this.objects.get(t)) == null ? void 0 : e.surfaceId;
      },
      emit: (t) => this.actions.emitAsync(t)
    }), this.moveCommit = new Rt({
      createContext: (t) => this.createBehaviorContext(t),
      getLifecycle: (t) => this.moveBehavior.getLifecycle(t),
      playLayout: (t, e) => this.playMoveLayout(t, e),
      normalize: (t, e) => this.moveActions.normalize(t, e),
      getSurfaceObjectCount: (t) => [...this.objects.values()].filter((e) => e.surfaceId === t).length,
      getObjectIndex: (t, e) => this.getObjectSurfaceIndex(t, e)
    }, this.moveActions), this.moveLanding = new Lt({
      createContext: (t) => this.createBehaviorContext(t),
      getSession: (t) => this.sessionCoordinator.get(t),
      cancel: (t, e) => this.cancel(t, e),
      end: (t) => this.endSession(t)
    }), this.runtimeMove = P.fromPorts({
      getSession: (t) => this.sessionCoordinator.get(t),
      getBehavior: (t) => this.behaviors.get(t),
      createContext: (t) => this.createBehaviorContext(this.sessionCoordinator.get(t))
    }, this.moveCommit, this.moveLanding), this.visualState = new Pt({ getAdapter: (t) => this.getObjectVisualAdapter(t) }), this.visualMotion = new kt({
      getSession: (t) => this.sessionCoordinator.get(t),
      getAdapter: (t) => this.getObjectVisualAdapter(t),
      createContext: (t, e, s) => this.createVisualLifecycleContext(t, e, s)
    }, this.visualProxyCoordinator), this.dispatcher = new Et({
      start: (t) => this.startInternal(t),
      update: (t, e) => this.updateInternal(t, e),
      release: (t, e) => this.releaseInternal(t, e),
      cancel: (t, e) => this.cancelInternal(t, e),
      interrupt: (t, e) => this.interruptInternal(t, e)
    }), this.behaviors.register(this.moveBehavior), k(this.registry.motionProfile), this.objects.subscribe((t) => {
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
    const { profile: e, controller: s, ...i } = t, r = e ?? (Object.keys(i).length ? i : void 0);
    r && this.registry.setMotionProfile(r), s && (this.registry.setMotionController(s), s.follow && Object.assign(U.position, s.follow), s.rotation && Object.assign(X, s.rotation), s.release && Object.assign(L, s.release)), k(this.registry.motionProfile);
  }
  /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
  configureVisual(t) {
    t.dragGlass !== void 0 && Y(t.dragGlass), t.layoutPresence !== void 0 && J(t.layoutPresence);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  startObjectPointer(t, e, s, i, r) {
    var g, p;
    const n = this.getRegrab(t);
    if (n)
      return n(s), !0;
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
      returnRect: r
    }, u = ((g = a.visual) == null ? void 0 : g.createMove) ?? a.createMove ?? (() => this.defaultVisualAdapter.createMove(c));
    if (u) {
      const f = u(c);
      return !f.driver && !f.lifecycle ? ((p = a.start) == null || p.call(a, c), !0) : (this.orchestrateMoveSession(
        f.request ?? {
          type: "move",
          objectId: t,
          input: { kind: "pointerdown", event: s }
        },
        {
          driver: f.driver,
          lifecycle: f.lifecycle,
          pointerInput: f.pointerInput,
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
  /** 按对象类型读取抓取对齐配置；未注册的类型返回 undefined，调用方按纯居中兜底。 */
  getObjectGrabAlign(t) {
    const e = this.objects.get(t), s = e ? this.registry.objectTypes.get(e.visual ?? e.type) : void 0;
    return s == null ? void 0 : s.grabAlign;
  }
  getObjectVisualAdapter(t) {
    const e = this.objects.get(t), s = e ? this.registry.objectTypes.get(e.visual ?? e.type) : void 0;
    return s != null && s.visual ? s.visual : this.getVisualAdapter((e == null ? void 0 : e.visual) ?? (e == null ? void 0 : e.type) ?? "");
  }
  createVisualLifecycleContext(t, e, s, i) {
    var p, f;
    const r = this.sessionCoordinator.get(t), n = r ? this.objects.get(r.objectId) : void 0, o = (n == null ? void 0 : n.element) ?? void 0, a = r ? this.getObjectVisualAdapter(r.objectId) : this.defaultVisualAdapter, c = new M(), d = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, h = (p = d == null ? void 0 : d.motion) == null ? void 0 : p.profile, u = this.registry.motionProfile, g = h || u ? {
      ...u,
      ...h,
      flip: { ...u == null ? void 0 : u.flip, ...h == null ? void 0 : h.flip },
      resize: { ...u == null ? void 0 : u.resize, ...h == null ? void 0 : h.resize },
      landing: { ...u == null ? void 0 : u.landing, ...h == null ? void 0 : h.landing },
      group: { ...u == null ? void 0 : u.group, ...h == null ? void 0 : h.group }
    } : void 0;
    return {
      objectId: (r == null ? void 0 : r.objectId) ?? "",
      sessionId: t,
      mode: (n == null ? void 0 : n.visualMode) ?? "detach",
      destination: e,
      sourceElement: o,
      beforeContent: i,
      targetElement: s,
      sourceRect: o == null ? void 0 : o.getBoundingClientRect(),
      visualSnapshot: o ? (a.captureVisualState ?? c.captureVisualState)(o) : void 0,
      targetSnapshot: s ? (a.captureVisualState ?? c.captureVisualState)(s) : void 0,
      landingBounds: () => {
        const v = this.getDestinationSurfaceId(e), m = v ? this.resolveMoveSurfaceViewport(v) : null;
        return (m == null ? void 0 : m.getBoundingClientRect()) ?? null;
      },
      motion: g,
      motionEnabled: (f = d == null ? void 0 : d.motion) == null ? void 0 : f.enabled
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
    this.visualProxyCoordinator.get(t) && this.disposeVisualProxy(t), this.visualProxyCoordinator.register(t, e);
  }
  getVisualProxy(t) {
    return this.visualProxyCoordinator.get(t);
  }
  disposeVisualProxy(t) {
    var r;
    const e = this.visualProxyCoordinator.get(t);
    if (!e) return;
    const s = this.sessionCoordinator.get(t);
    let i = !1;
    if (s) {
      const n = this.createVisualLifecycleContext(t), o = this.getObjectVisualAdapter(s.objectId);
      o.dispose && (o.dispose(e, n), i = !0);
    }
    i || (r = e.dispose) == null || r.call(e), this.visualProxyCoordinator.remove(t);
  }
  createCompletionGate(t, e) {
    let s = !1, i;
    const n = {
      promise: new Promise((o) => {
        i = o;
      }),
      complete: (o) => {
        s || (s = !0, i(o), this.sessionCoordinator.removeGate(t, n));
      },
      fail: () => {
        s || (s = !0, i(e), this.sessionCoordinator.removeGate(t, n));
      }
    };
    return this.sessionCoordinator.addGate(t, n), n;
  }
  setHitResolver(t) {
    this.hitResolver = t;
  }
  getHitResolver() {
    return this.hitResolver;
  }
  /** 默认命中由已注册 Object/Surface 推导；特殊几何才需 setHitResolver()。 */
  createRegisteredHitResolver(t) {
    return ht(this.objects, this.surfaces, t);
  }
  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(t, e, s) {
    if (this.hitResolver) {
      const n = this.hitResolver.findSurface({ x: e, y: s });
      return n != null && n.dataset.column ? {
        columnId: n.dataset.column,
        index: this.hitResolver.findIndex(n, { x: e, y: s }, t)
      } : null;
    }
    const i = this.createRegisteredHitResolver(t), r = i.findSurface({ x: e, y: s });
    return r ? { columnId: r.id, index: i.findIndex(r, { x: e, y: s }, t) } : null;
  }
  /** 自动滚动只需要当前命中 Surface 的真实滚动元素。 */
  resolveMoveSurfaceElement(t, e, s) {
    var r;
    if (this.hitResolver) return this.hitResolver.findSurface({ x: e, y: s });
    const i = this.createRegisteredHitResolver(t).findSurface({ x: e, y: s });
    return ((r = i == null ? void 0 : i.viewport) == null ? void 0 : r.call(i)) ?? (i == null ? void 0 : i.element) ?? null;
  }
  /** 取得指定 Surface 的滚动视口，不让视觉 driver 探查业务 DOM 结构。 */
  resolveMoveSurfaceViewport(t) {
    var s;
    const e = this.surfaces.get(t);
    return ((s = e == null ? void 0 : e.viewport) == null ? void 0 : s.call(e)) ?? (e == null ? void 0 : e.element) ?? null;
  }
  /** 创建绑定当前 Session 的自动滚动控制器；滚动资源随 Session 自动清理。 */
  createAutoScroller(t, e = {}) {
    const s = this.sessionCoordinator.get(t);
    return s ? It(s.cleanup, e) : null;
  }
  /**
   * 将落地目标滚动到注册 Surface 的可视范围内。
   *
   * 松手后的滚动由 Runtime 用 rAF 驱动，时长跟 landing 基准时长一致，
   * 不再交给浏览器的原生 smooth scroll。这样代理从松手立即开始飞行时，
   * 容器滚动不会比代理慢一大截，避免代理先完成并被销毁而容器仍在滚动。
   */
  keepSurfaceTargetVisible(t, e) {
    var u, g;
    const s = this.resolveMoveSurfaceViewport(t);
    if (!s || !e.isConnected) return;
    const i = this.surfaceScrollFrames.get(s);
    i !== void 0 && (cancelAnimationFrame(i), this.surfaceScrollFrames.delete(s));
    const r = () => {
      const p = s.getBoundingClientRect(), f = e.getBoundingClientRect(), v = f.top < p.top ? s.scrollTop - (p.top - f.top) : f.bottom > p.bottom ? s.scrollTop + (f.bottom - p.bottom) : s.scrollTop, m = Math.max(0, s.scrollHeight - s.clientHeight);
      return Math.max(0, Math.min(v, m));
    };
    let n = r();
    if (Math.abs(n - s.scrollTop) < 0.5) return;
    const o = s.scrollTop, a = Math.max(200, ((g = (u = this.registry.motionProfile) == null ? void 0 : u.landing) == null ? void 0 : g.duration) ?? 250);
    if (typeof requestAnimationFrame > "u") {
      s.scrollTop = n;
      return;
    }
    const c = performance.now(), d = (p) => {
      const f = Math.min(1, (p - c) / a), v = 1 - (1 - f) ** 3;
      if (n = r(), s.scrollTop = o + (n - o) * v, f >= 1 && (s.scrollTop = n), f >= 1) {
        this.surfaceScrollFrames.delete(s);
        return;
      }
      const m = requestAnimationFrame(d);
      this.surfaceScrollFrames.set(s, m);
    }, h = requestAnimationFrame(d);
    this.surfaceScrollFrames.set(s, h);
  }
  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(t, e) {
    const s = this.objects.get(t), i = e ?? (s == null ? void 0 : s.surfaceId);
    return !s || !i ? -1 : [...this.objects.values()].filter((r) => r.surfaceId === i).map((r) => r.id).sort((r, n) => {
      var c, d, h, u;
      const o = (d = (c = this.objects.get(r)) == null ? void 0 : c.element) == null ? void 0 : d.getBoundingClientRect(), a = (u = (h = this.objects.get(n)) == null ? void 0 : h.element) == null ? void 0 : u.getBoundingClientRect();
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
  /** 由 Runtime 统一捕获当前移动事务的布局快照。 */
  captureMoveLayout(t) {
    const e = this.sessionCoordinator.get(t), s = e ? this.behaviors.get(e.type) : void 0;
    !(s instanceof C) || !e || s.captureLayout(this.createBehaviorContext(e));
  }
  /** 由 Runtime 统一播放移动事务的布局 FLIP。 */
  playMoveLayout(t, e = !1) {
    const s = this.sessionCoordinator.get(t), i = s ? this.behaviors.get(s.type) : void 0;
    !(i instanceof C) || !s || i.playLayout(this.createBehaviorContext(s), e);
  }
  /** 捕获 Runtime 管理的 Surface / group / collection 布局快照。 */
  captureLayout(t, e = document, s = !0, i) {
    return K(t, e, s, i);
  }
  /** 按统一时序播放布局快照；列尾追加可选择等待 Vue patch 的下一帧。 */
  scheduleLayout(t, e = !1) {
    e ? Q(t) : Z(t);
  }
  /** 统一编排组展开/收起、容器 resize、兄弟 FLIP 与可选 presence。 */
  runGroupToggle(t) {
    return tt(t);
  }
  /** 组件卸载/弹窗关闭时取消根节点下尚未完成的布局动画。 */
  cancelLayoutAnimations(t) {
    et(t);
  }
  resolveMoveTarget(t, e, s) {
    var d, h, u;
    const i = this.sessionCoordinator.get(t);
    if (!i) return null;
    const n = (h = (d = this.createBehaviorContext(i).visual) == null ? void 0 : d.resolveTarget) == null ? void 0 : h.call(d, i.objectId, e), o = s == null ? void 0 : s(), a = (u = this.objects.get(i.objectId)) == null ? void 0 : u.element, c = n ?? o ?? a ?? null;
    return !c || !c.isConnected ? null : (this.moveBehavior.getContext(t).transaction.target = c, c);
  }
  /**
   * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
   * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
   * 实现一套跨 Surface 的等待规则。
   */
  async resolveLandingTarget(t, e, s = 6) {
    return this.resolveMoveTarget(t, e) ?? this.waitForMoveTarget(t, e, s);
  }
  /**
   * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
   *
   * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
   * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
   * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
   */
  async waitForMoveTarget(t, e, s = 6) {
    var d, h;
    const i = this.sessionCoordinator.get(t);
    if (!i) return null;
    const r = this.moveBehavior.getContext(t);
    r.sourceElement;
    const n = this.getDestinationSurfaceId(e), o = r.transaction.destination, a = typeof (o == null ? void 0 : o.fromSurfaceId) == "string" ? o.fromSurfaceId : null, c = !!n && n !== a;
    for (let u = 0; u < s; u += 1) {
      const g = this.sessionCoordinator.get(t);
      if (g !== i || g.state === "disposed" || g.state === "interrupt") return null;
      const p = this.objects.get(i.objectId), f = this.resolveMoveTarget(t, e), v = !n || (p == null ? void 0 : p.surfaceId) === n, m = n && f ? ((h = (d = this.surfaces.get(n)) == null ? void 0 : d.element) == null ? void 0 : h.contains(f)) ?? !1 : !1;
      if (f && v && (c ? m : !0)) return f;
      await new Promise((S) => requestAnimationFrame(() => S()));
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
    const r = this.sessionCoordinator.get(t);
    r && this.inputCoordinator.bindRegrabTarget(r, e, s, i);
  }
  createRegrabContext(t, e, s, i) {
    const r = this.sessionCoordinator.get(t);
    if (!r || r.state !== "landing") return null;
    const n = s.getBoundingClientRect(), o = i.getBoundingClientRect(), a = i.offsetWidth || o.width, c = i.offsetHeight || o.height, d = new DOMRect(n.left, n.top, a, c);
    return {
      sessionId: t,
      objectId: r.objectId,
      event: e,
      proxyElement: s,
      sourceElement: i,
      proxyRect: n,
      regrabRect: d,
      interrupt: (h) => this.interrupt(t, h ?? "regrab")
    };
  }
  /**
   * 统一完成 landing → regrab 的旧 Session 接管。视觉 adapter 只处理
   * source 可见性和监听器，旧 Session、completion gate 与 landing proxy
   * 的失效由 Runtime 保证。
   */
  takeoverRegrab(t) {
    const e = this.sessionCoordinator.get(t);
    return !e || e.state !== "landing" ? !1 : (this.interrupt(t, "regrab"), this.disposeVisualProxy(t), !0);
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
    const r = this.sessionCoordinator.get(t);
    return r ? this.visualState.trackTarget(r.cleanup, e, s, i) : () => {
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
      const n = this.sessionCoordinator.get(e.sessionId);
      if (!n) throw new Error(`Session not found: ${e.sessionId}`);
      s = n;
    } else {
      e.driver && this.moveBehavior.setDriver(e.driver);
      const n = this.start(t);
      e.driver && this.moveBehavior.setDriver({}), s = this.sessionCoordinator.get(n.id);
    }
    const i = this.getMoveContext(s.id);
    e.followElement !== void 0 && (i.followElement = e.followElement), e.driver && this.bindMoveSession(s.id, e.driver), e.lifecycle ? this.bindMoveLifecycle(s.id, e.lifecycle) : e.visualStrategy && this.bindMoveLifecycle(s.id, e.visualStrategy);
    const r = this.bindPointerSessionInput(s.id, e.pointerInput);
    return {
      id: s.id,
      get state() {
        return s.state;
      },
      get moveContext() {
        return i;
      },
      cancel: (n) => this.cancel(s.id, n ?? "cancelled"),
      interrupt: (n) => this.interrupt(s.id, n ?? "interrupted"),
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
      getSession: (i) => this.sessionCoordinator.get(i),
      getBehavior: (i) => this.behaviors.get(i),
      createContext: (i) => this.createBehaviorContext(i),
      captureLayout: (i) => this.captureMoveLayout(i),
      playLayout: (i, r) => this.playMoveLayout(i, r),
      cancel: (i, r) => this.cancel(i, r),
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
    const i = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      r,
      e,
      "cancel",
      (n, o, a) => {
        var c;
        n instanceof C && n.cancelLayout(o, a), (c = n == null ? void 0 : n.cancel) == null || c.call(n, o, a);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    );
  }
  interrupt(t, e = "cancel") {
    this.dispatcher.interrupt(t, e);
  }
  interruptInternal(t, e = "cancel") {
    const s = this.sessionCoordinator.get(t);
    if (!s) return;
    const i = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      r,
      e,
      "interrupt",
      (n, o, a) => {
        var c;
        n instanceof C && n.cancelLayout(o, a), (c = n == null ? void 0 : n.interrupt) == null || c.call(n, o, a);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
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
      (i, r) => this.disposeBehavior(i, r)
    );
  }
  failCompletionGates(t) {
    this.sessionCoordinator.failGates(t), this.disposeVisualProxy(t);
  }
  disposeBehavior(t, e) {
    var s, i, r, n;
    try {
      t instanceof C && ((r = (i = (s = t.getLifecycle(e.session.id)) == null ? void 0 : s.surface) == null ? void 0 : i.dispose) == null || r.call(i, e)), (n = t == null ? void 0 : t.dispose) == null || n.call(t, e);
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
const Bt = new Ot();
export {
  M as D,
  Mt as M,
  it as O,
  Ot as R,
  vt as S,
  ut as V,
  C as a,
  Rt as b,
  Lt as c,
  wt as d,
  ot as e,
  St as f,
  Et as g,
  At as h,
  P as i,
  pt as j,
  bt as k,
  yt as l,
  rt as m,
  kt as n,
  jt as o,
  Pt as p,
  Tt as q,
  ht as r,
  Bt as s,
  xt as t
};
