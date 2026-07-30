import { c as x, p as P, a as k, l as R, b as E, D as m, d as j, r as O, e as V, f as A, g as T, s as M, F as B, h as I } from "./DetachAdapter-xNINK5UP.js";
import { L as pt, i as gt, j as ft, k as vt, m as mt, n as yt, o as Ct, q as bt } from "./DetachAdapter-xNINK5UP.js";
class C {
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
class F {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new C();
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
class D {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new C();
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
    this.items = /* @__PURE__ */ new Map(), this.events = new C();
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
class z {
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
      return Promise.resolve(i.resolveDestination(t, e)).then((o) => (o != null && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o));
    const n = (r = i.release) == null ? void 0 : r.call(i, t, e);
    return Promise.resolve(n).then((o) => (o != null && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o));
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
class y {
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
    const e = x(t.beforeContent, t.sourceRect);
    P(t.sourceElement, e);
    const s = t.visualSnapshot;
    return s && (e.style.boxShadow = s.boxShadow, e.style.borderRadius = s.borderRadius, e.style.backgroundColor = s.background, e.style.opacity = s.opacity, e.style.transform = s.transform || "scale(1.03)"), { element: e };
  }
  land(t, e, s) {
    var h, u, d, p, f, g, b, w;
    const i = t.element;
    if (!((h = s.targetSnapshot) != null && h.rect) && !e.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const n = ((u = s.targetSnapshot) == null ? void 0 : u.rect) ?? e.getBoundingClientRect(), r = {
      left: n.left ?? n.x,
      top: n.top ?? n.y,
      width: n.width,
      height: n.height
    };
    k(e, s.sessionId), i.style.transition = "none", i.style.width = `${r.width}px`, i.style.height = `${r.height}px`;
    const o = s.motionEnabled === !1 ? R : E, { finished: a, retarget: c } = o(i, r, {
      duration: ((p = (d = s.motion) == null ? void 0 : d.landing) == null ? void 0 : p.duration) ?? j.landing.duration,
      targetShadow: (f = s.targetSnapshot) == null ? void 0 : f.boxShadow,
      targetRadius: (g = s.targetSnapshot) == null ? void 0 : g.borderRadius,
      targetBackground: (b = s.targetSnapshot) == null ? void 0 : b.background,
      targetOpacity: (w = s.targetSnapshot) == null ? void 0 : w.opacity,
      targetContent: e,
      readTarget: () => e.getBoundingClientRect(),
      motionState: s.motionState,
      coast: {
        duration: m.coastSeconds,
        friction: T,
        maxDistance: m.maxCoast,
        minVelocity: m.minVelocity
      },
      releaseDamping: m.dampingRatio
    });
    return this.runtime && this.runtime.trackLandingTarget(s.sessionId, e, () => {
      var L;
      (L = s.targetSnapshot) != null && L.rect && !e.closest("[data-layout-surface]") ? c({
        left: s.targetSnapshot.rect.x,
        top: s.targetSnapshot.rect.y,
        width: s.targetSnapshot.rect.width,
        height: s.targetSnapshot.rect.height
      }) : c(e.getBoundingClientRect());
    }), a.then(() => ({ completed: !0 }));
  }
  reveal(t, e, s) {
    O(e, s.sessionId);
  }
  dispose(t, e) {
    var i;
    const s = t.element;
    (i = t.dispose) == null || i.call(t), V(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(t) {
    const e = this.runtime;
    return !e || !e.objects.hasAbility(t.objectId, "move") ? {} : (t.event.preventDefault(), A({
      runtime: e,
      objectId: t.objectId,
      element: t.element,
      event: t.event,
      fromRect: t.fromRect,
      returnRect: t.returnRect
    }));
  }
}
class _ {
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
class U {
  constructor() {
    this.visuals = new _(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
class W {
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
const N = {
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
let H = 1;
class q {
  constructor(t, e, s) {
    this.type = t, this.objectId = e, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new W(), this.leases = [], this.id = `session-${H++}`;
  }
  transition(t) {
    if (this.state !== t) {
      if (!N[this.state].includes(t))
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
class X {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(t, e, s) {
    const i = new q(t, e, s);
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
class Y {
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
      new J(t),
      new K(),
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
      await this.commit(r, o, h);
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
class J {
  constructor(t) {
    this.port = t;
  }
  update(t, e) {
    var i, n;
    const s = this.port.getSession(t);
    !s || s.state !== "active" || (n = (i = this.port.getBehavior(s.type)) == null ? void 0 : i.update) == null || n.call(i, this.port.createContext(t), e);
  }
}
class K {
  prepare(t, e) {
    return t ? e.kind === "pointercancel" || e.kind === "blur" || e.kind === "lostpointercapture" ? { kind: "cancel", reason: e.kind } : t.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (t.state === "active" && t.transition("release"), t.state === "release" ? { kind: "continue", session: t } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class Q {
  constructor(t, e) {
    this.port = t, this.actions = e;
  }
  async commit(t, e, s) {
    var o, a, c, h;
    const i = this.port.createContext(t);
    await e.commit(i, s), e.playLayout(i);
    const n = this.port.getLifecycle(t.id), r = this.port.normalize(t.objectId, s);
    r && await ((a = (o = n == null ? void 0 : n.surface) == null ? void 0 : o.leave) == null ? void 0 : a.call(o, i, r.fromSurfaceId)), this.actions.emit(t.objectId, e.getContext(t.id).destination, e.getContext(t.id).transaction), r && await ((h = (c = n == null ? void 0 : n.surface) == null ? void 0 : c.enter) == null ? void 0 : h.call(c, i, r.toSurfaceId));
  }
}
class Z {
  constructor(t) {
    this.port = t;
  }
  async run(t, e, s) {
    var i;
    try {
      const n = await e.landing(this.port.createContext(t), s), r = this.port.getSession(t.id);
      if (r !== t || r.state === "disposed" || r.state === "interrupt") return;
      if (n && !n.completed) return this.port.cancel(t.id, n.reason ?? "landing-failed");
      (i = n == null ? void 0 : n.reveal) == null || i.call(n), t.handoff(), e.reveal && await e.reveal(this.port.createContext(t), s), this.port.getSession(t.id) === t && this.port.end(t);
    } catch (n) {
      this.port.getSession(t.id) === t && this.port.cancel(t.id, n instanceof Error ? n.message : "landing-failed");
    }
  }
}
class tt {
  constructor(t) {
    this.port = t;
  }
  normalize(t, e) {
    if (this.isDestination(e)) return e;
    if (!e || typeof e != "object") return null;
    const s = e;
    if (typeof s.columnId != "string") return null;
    const i = this.port.getObjectSurface(t);
    return i ? { fromSurfaceId: i, toSurfaceId: s.columnId.startsWith("column:") ? s.columnId : `column:${s.columnId}`, ...typeof s.index == "number" ? { toIndex: s.index } : {} } : null;
  }
  emit(t, e, s) {
    if (s.actionEmitted) return !1;
    const i = this.normalize(t, e);
    return i ? (s.actionEmitted = !0, this.port.emit({ type: "move", objectId: t, fromSurfaceId: i.fromSurfaceId, toSurfaceId: i.toSurfaceId, ...i.toIndex === void 0 ? {} : { toIndex: i.toIndex }, timestamp: Date.now() }), !0) : !1;
  }
  isDestination(t) {
    if (!t || typeof t != "object") return !1;
    const e = t;
    return typeof e.fromSurfaceId == "string" && typeof e.toSurfaceId == "string";
  }
}
function et(l) {
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
class st {
  constructor(t) {
    this.port = t;
  }
  resolveTarget(t, e) {
    var i, n;
    const s = ((n = (i = this.port.getAdapter(t)).resolveTarget) == null ? void 0 : n.call(i, t, e)) ?? new y().resolveTarget(t);
    return s != null && s.isConnected ? s : null;
  }
  apply(t, e, s) {
    (this.port.getAdapter(t).applyState ?? new y().applyState)(e, s);
  }
  capture(t, e) {
    return (this.port.getAdapter(t).captureVisualState ?? new y().captureVisualState)(e);
  }
  trackTarget(t, e, s, i = {}) {
    return et({ ...i, cleanup: t, target: e, retarget: s });
  }
}
class it {
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
class rt {
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
    var o, a;
    const i = this.port.getSession(t), n = this.proxies.get(t);
    if (!i || !n) return { completed: !1, reason: "visual-proxy-missing" };
    const r = s ?? this.port.createContext(t, void 0, e);
    return await ((a = (o = this.port.getAdapter(i.objectId)).land) == null ? void 0 : a.call(o, n, e, r)) ?? { completed: !0 };
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
function nt(l, t, e = {}) {
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
class ot {
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
    return nt({
      update: (s, i) => this.port.update(s, i),
      release: (s, i) => this.port.release(s, i)
    }, t, e);
  }
}
class at {
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
class ct {
  constructor() {
    this.owner = new F(), this.objects = new D(), this.surfaces = new G(), this.behaviors = new z(), this.registry = new U(), this.hitResolver = null, this.sessionCoordinator = new X(), this.runtimeSession = new Y(this.sessionCoordinator), this.events = new C(), this.actions = new C(), this.visualProxyCoordinator = new it(), this.defaultVisualAdapter = new y(this), this.moveBehavior = new v(), this.inputCoordinator = new ot({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (t, e, s) => this.startObjectPointer(t, e, s),
      registerRegrab: (t, e) => this.registerRegrab(t, e),
      regrab: (t, e) => this.regrab(t, e),
      update: (t, e) => this.update(t, e),
      release: (t, e) => this.release(t, e)
    }), this.moveActions = new tt({
      getObjectSurface: (t) => {
        var e;
        return (e = this.objects.get(t)) == null ? void 0 : e.surfaceId;
      },
      emit: (t) => this.actions.emit(t)
    }), this.moveCommit = new Q({
      createContext: (t) => this.createBehaviorContext(t),
      getLifecycle: (t) => this.moveBehavior.getLifecycle(t),
      normalize: (t, e) => this.moveActions.normalize(t, e)
    }, this.moveActions), this.moveLanding = new Z({
      createContext: (t) => this.createBehaviorContext(t),
      getSession: (t) => this.sessionCoordinator.get(t),
      cancel: (t, e) => this.cancel(t, e),
      end: (t) => this.endSession(t)
    }), this.runtimeMove = S.fromPorts({
      getSession: (t) => this.sessionCoordinator.get(t),
      getBehavior: (t) => this.behaviors.get(t),
      createContext: (t) => this.createBehaviorContext(this.sessionCoordinator.get(t))
    }, this.moveCommit, this.moveLanding), this.visualState = new st({ getAdapter: (t) => this.getObjectVisualAdapter(t) }), this.visualMotion = new rt({
      getSession: (t) => this.sessionCoordinator.get(t),
      getAdapter: (t) => this.getObjectVisualAdapter(t),
      createContext: (t, e, s) => this.createVisualLifecycleContext(t, e, s)
    }, this.visualProxyCoordinator), this.dispatcher = new at({
      start: (t) => this.startInternal(t),
      update: (t, e) => this.updateInternal(t, e),
      release: (t, e) => this.releaseInternal(t, e),
      cancel: (t, e) => this.cancelInternal(t, e),
      interrupt: (t, e) => this.interruptInternal(t, e)
    }), this.behaviors.register(this.moveBehavior), M(this.registry.motionProfile), this.objects.subscribe((t) => {
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
    n && this.registry.setMotionProfile(n), s && (this.registry.setMotionController(s), s.follow && Object.assign(B.position, s.follow), s.rotation && Object.assign(I, s.rotation), s.release && Object.assign(m, s.release)), M(this.registry.motionProfile);
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
  createVisualLifecycleContext(t, e, s, i) {
    var f, g;
    const n = this.sessionCoordinator.get(t), r = n ? this.objects.get(n.objectId) : void 0, o = (r == null ? void 0 : r.element) ?? void 0, a = n ? this.getObjectVisualAdapter(n.objectId) : this.defaultVisualAdapter, c = new y(), h = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, u = (f = h == null ? void 0 : h.motion) == null ? void 0 : f.profile, d = this.registry.motionProfile, p = u || d ? {
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
    const i = this.sessionCoordinator.get(t);
    if (!i) return null;
    const r = (h = (c = this.createBehaviorContext(i).visual) == null ? void 0 : c.resolveTarget) == null ? void 0 : h.call(c, i.objectId, e), o = s == null ? void 0 : s(), a = r ?? o ?? null;
    return !a || !a.isConnected ? null : (this.moveBehavior.getContext(t).transaction.target = a, a);
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
const dt = new ct();
export {
  m as DEFAULT_RELEASE_PROFILE,
  y as DefaultVisualAdapter,
  B as FOLLOW_PROFILE,
  I as FOLLOW_ROTATION,
  pt as LANDING_PROFILE,
  tt as MoveActionCoordinator,
  v as MoveBehavior,
  Q as MoveCommitCoordinator,
  Z as MoveLandingCoordinator,
  K as MoveReleaseCoordinator,
  $ as MoveTransaction,
  J as MoveUpdateCoordinator,
  D as ObjectStore,
  ct as Runtime,
  at as RuntimeDispatcher,
  ot as RuntimeInputCoordinator,
  S as RuntimeMoveCoordinator,
  U as RuntimeRegistry,
  Y as RuntimeSessionCoordinator,
  q as Session,
  X as SessionCoordinator,
  G as SurfaceStore,
  _ as VisualAdapters,
  rt as VisualMotionCoordinator,
  it as VisualProxyCoordinator,
  st as VisualStateCoordinator,
  nt as bindPointerSessionInput,
  gt as coastOffset,
  ft as createCardMotionController,
  A as createDetachMoveFromAdapter,
  vt as createDomHitResolver,
  mt as hitWithResolver,
  yt as integrateSpring,
  Ct as mountVisualOverlay,
  dt as runtime,
  bt as shapeReleaseVelocity,
  et as trackLandingTarget
};
