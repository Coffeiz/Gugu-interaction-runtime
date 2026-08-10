import { c as W, g as G, a as N, b as U, l as X, d as Y, D as E, e as H, r as J, f as K, h as Q, i as Z, j as ee, k as te, m as se, n as ie, s as $, F as re, o as ne, p as oe, q as ae, t as ce, u as le, v as ue, w as de, x as he } from "./DetachAdapter-DY-ZY6Kh.js";
import { L as tt, y as st, z as it, A as rt, B as nt, C as ot, E as at, G as ct, H as lt, I as ut } from "./DetachAdapter-DY-ZY6Kh.js";
class T {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
  }
  subscribe(e) {
    return this.listeners.add(e), () => this.listeners.delete(e);
  }
  emit(e) {
    this.listeners.forEach((t) => t(e));
  }
  /**
   * 与同步广播保持并存的事务广播。业务可以返回框架渲染完成的 Promise，
   * 让调用方在读取新 DOM 前等待；没有返回值的既有订阅仍然是同步兼容的。
   */
  async emitAsync(e) {
    await Promise.all([...this.listeners].map((t) => Promise.resolve(t(e))));
  }
}
class ge {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new T();
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
  takeObject(e, t) {
    this.controlled.set(e, { mode: "runtime", ownerSessionId: t }), this.events.emit(e);
    let s = !1;
    return {
      release: () => {
        if (s) return;
        s = !0;
        const i = this.controlled.get(e);
        (i == null ? void 0 : i.ownerSessionId) === t && (this.controlled.delete(e), this.events.emit(e));
      }
    };
  }
  takeSurface(e, t) {
    const s = this.controlled.get(e);
    return s && s.ownerSessionId !== t ? { release: () => {
    } } : this.takeObject(e, t);
  }
  isControlled(e) {
    var t;
    return ((t = this.controlled.get(e)) == null ? void 0 : t.mode) === "runtime";
  }
  isOwnedBy(e, t) {
    var s;
    return ((s = this.controlled.get(e)) == null ? void 0 : s.ownerSessionId) === t;
  }
  takeChannel(e, t, s) {
    let i = this.channelOwners.get(e);
    i || (i = /* @__PURE__ */ new Map(), this.channelOwners.set(e, i)), i.set(t, s);
    let r = !1;
    return {
      release: () => {
        r || (r = !0, i.get(t) === s && (i.delete(t), i.size === 0 && this.channelOwners.delete(e)));
      }
    };
  }
  ownsChannel(e, t, s) {
    var i;
    return ((i = this.channelOwners.get(e)) == null ? void 0 : i.get(t)) === s;
  }
}
class pe {
  constructor() {
    this.disposers = [], this.disposed = !1;
  }
  /** 是否已执行清理。 */
  get isDisposed() {
    return this.disposed;
  }
  track(e) {
    if (this.disposed) {
      e();
      return;
    }
    this.disposers.push(e);
  }
  /**
   * 登记 Window 事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackListener(e, t, s) {
    e.addEventListener(t, s), this.track(() => e.removeEventListener(t, s));
  }
  /**
   * 登记任意 EventTarget 上的事件监听器。
   * 清理时自动 removeEventListener。
   */
  trackTargetListener(e, t, s, i) {
    e.addEventListener(t, s, i), this.track(() => e.removeEventListener(t, s, i));
  }
  /** 登记 requestAnimationFrame ID，清理时自动 cancelAnimationFrame。 */
  trackRaf(e) {
    this.track(() => cancelAnimationFrame(e));
  }
  /** 登记 setTimeout ID，清理时自动 clearTimeout。 */
  trackTimeout(e) {
    this.track(() => clearTimeout(e));
  }
  /** 登记 setInterval ID，清理时自动 clearInterval。 */
  trackInterval(e) {
    this.track(() => clearInterval(e));
  }
  disposeAll() {
    if (this.disposed) return;
    this.disposed = !0;
    const e = this.disposers;
    this.disposers = [];
    const t = [];
    for (const s of e.reverse())
      try {
        s();
      } catch (i) {
        t.push(i);
      } finally {
      }
    t.length > 0 && console.error("Cleanup disposal failed", t);
  }
}
const fe = {
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
let me = 1;
class q {
  constructor(e, t, s) {
    this.type = e, this.objectId = t, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new pe(), this.leases = [], this.id = `session-${me++}`;
  }
  transition(e) {
    if (this.state !== e) {
      if (!fe[this.state].includes(e))
        throw new Error(`Invalid session transition: ${this.state} -> ${e}`);
      this.state = e;
    }
  }
  /** 判断对象是否属于本次会话；GroupDragSession 会扩展为多对象判断。 */
  hasObject(e) {
    return this.objectId === e;
  }
  takeObject(e) {
    const t = this.owner.takeObject(e, this.id);
    return this.leases.push(t), t;
  }
  trackCleanup(e) {
    this.cleanup.track(e);
  }
  takeSurface(e) {
    this.leases.push(this.owner.takeSurface(e, this.id));
  }
  handoff() {
    this.transition("handoff");
  }
  dispose() {
    this.state !== "disposed" && (this.state === "interrupt" ? this.transition("disposed") : (this.state !== "done" && this.state !== "cancelled" && this.transition("done"), this.transition("disposed")), this.leases.forEach((e) => e.release()), this.leases = [], this.cleanup.disposeAll());
  }
  cancel() {
    this.state !== "disposed" && (this.state !== "cancelled" && this.transition("cancelled"), this.dispose());
  }
  interrupt(e = "cancel") {
    if (this.endReason = e, e === "regrab") {
      if (this.state === "disposed") return;
      this.state !== "interrupt" && this.state !== "cancelled" && this.state !== "done" && this.transition("interrupt"), (this.state === "interrupt" || this.state === "cancelled" || this.state === "done") && this.transition("disposed"), this.leases.forEach((t) => t.release()), this.leases = [], this.cleanup.disposeAll();
      return;
    }
    (this.state === "prepare" || this.state === "active" || this.state === "release" || this.state === "landing" || this.state === "saving") && this.transition("interrupt"), this.dispose();
  }
}
class B extends q {
  constructor(e, t, s, i = {}) {
    const r = [...new Set(e)];
    if (r.length === 0) throw new Error("GroupDragSession requires at least one object");
    if (!r.includes(t))
      throw new Error(`Primary object is not part of group: ${t}`);
    super(i.type ?? "move", t, s), this.leasedObjectIds = /* @__PURE__ */ new Set(), this.objectIds = Object.freeze(r), this.primaryObjectId = t, this.offsets = i.offsets ? new Map(i.offsets) : /* @__PURE__ */ new Map();
  }
  hasObject(e) {
    return this.objectIds.includes(e);
  }
  offsetFor(e) {
    return this.offsets.get(e);
  }
  /** 获取 group 内尚未获取的对象 Lease，保证重复调用不会重复登记。 */
  takeObject(e) {
    if (!this.hasObject(e)) throw new Error(`Object is not part of group: ${e}`);
    if (this.leasedObjectIds.has(e))
      return { release: () => {
      } };
    const t = super.takeObject(e);
    return this.leasedObjectIds.add(e), t;
  }
  takeObjects() {
    return this.objectIds.map((e) => this.takeObject(e));
  }
}
class ve {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new T(), this.generations = /* @__PURE__ */ new Map();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "object-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const i = this.items.delete(e);
    return i && this.events.emit({ type: "object-removed", id: e }), i;
  }
  get(e) {
    return this.items.get(e);
  }
  has(e) {
    return this.items.has(e);
  }
  values() {
    return this.items.values();
  }
  snapshot() {
    return [...this.items.values()];
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
  hasAbility(e, t) {
    var s;
    return ((s = this.items.get(e)) == null ? void 0 : s.abilities.includes(t)) ?? !1;
  }
  setElement(e, t) {
    const s = this.items.get(e);
    s && s.element !== t && (s.element = t, this.events.emit({ type: "object-changed", id: e }));
  }
  setSurface(e, t) {
    this.update(e, { surfaceId: t });
  }
  update(e, t) {
    const s = this.items.get(e);
    return s ? (Object.entries(t).some(([r, n]) => s[r] !== n) && (Object.assign(s, t), this.events.emit({ type: "object-changed", id: e })), !0) : !1;
  }
}
class ye {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new T();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "surface-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const i = this.items.delete(e);
    return i && this.events.emit({ type: "surface-removed", id: e }), i;
  }
  get(e) {
    return this.items.get(e);
  }
  has(e) {
    return this.items.has(e);
  }
  values() {
    return this.items.values();
  }
  snapshot() {
    return [...this.items.values()];
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
  setElement(e, t) {
    const s = this.items.get(e);
    s && s.element !== t && (s.element = t, this.events.emit({ type: "surface-changed", id: e }));
  }
  update(e, t) {
    const s = this.items.get(e);
    return s ? (Object.entries(t).some(([r, n]) => s[r] !== n) && (Object.assign(s, t), this.events.emit({ type: "surface-changed", id: e })), !0) : !1;
  }
  /** 空 accepts 数组表示不限制类型。 */
  accepts(e, t) {
    const s = this.items.get(e);
    return s ? s.accepts.length === 0 || s.accepts.includes(t) : !1;
  }
}
class be {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new T();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "target-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const i = this.items.delete(e);
    return i && this.events.emit({ type: "target-removed", id: e }), i;
  }
  get(e) {
    return this.items.get(e);
  }
  values() {
    return this.items.values();
  }
  snapshot() {
    return [...this.items.values()];
  }
  setElement(e, t) {
    const s = this.items.get(e);
    s && s.element !== t && (s.element = t, this.events.emit({ type: "target-changed", id: e }));
  }
  update(e, t) {
    const s = this.items.get(e);
    return s ? (Object.entries(t).some(([r, n]) => s[r] !== n) && (Object.assign(s, t), this.events.emit({ type: "target-changed", id: e })), !0) : !1;
  }
  findForSurface(e, t) {
    return this.snapshot().filter((s) => s.surfaceId === e).filter((s) => !t || s.accepts.length === 0 || s.accepts.includes(t)).filter((s) => {
      var i;
      return (i = s.element) == null ? void 0 : i.isConnected;
    }).sort((s, i) => (i.priority ?? 0) - (s.priority ?? 0))[0];
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
}
class Ce {
  constructor() {
    this.items = /* @__PURE__ */ new Map();
  }
  register(e) {
    if (this.items.has(e.type)) throw new Error(`Behavior already exists: ${e.type}`);
    this.items.set(e.type, e);
  }
  get(e) {
    return this.items.get(e);
  }
  has(e) {
    return this.items.has(e);
  }
}
class Se {
  constructor() {
    this.phase = "prepare", this.source = null, this.destination = null, this.target = null, this.actionEmitted = !1, this.tokenValue = 0;
  }
  get token() {
    return this.tokenValue;
  }
  setPhase(e) {
    this.phase = e;
  }
  invalidate() {
    return this.tokenValue += 1, this.tokenValue;
  }
  isCurrent(e) {
    return e === this.tokenValue && this.phase !== "cancelled" && this.phase !== "disposed";
  }
}
function we(u) {
  return !!(u && typeof u.then == "function");
}
class L {
  constructor(e = {}) {
    this.driver = e, this.type = "move", this.sessionDrivers = /* @__PURE__ */ new Map(), this.sessionLifecycles = /* @__PURE__ */ new Map(), this.contexts = /* @__PURE__ */ new Map(), this.landingRegrabs = /* @__PURE__ */ new Map();
  }
  registerRegrab(e, t) {
    this.landingRegrabs.set(e, t);
  }
  getRegrab(e) {
    return this.landingRegrabs.get(e);
  }
  clearRegrab(e, t) {
    t && this.landingRegrabs.get(e) !== t || this.landingRegrabs.delete(e);
  }
  setDriver(e) {
    this.driver = e;
  }
  bindSession(e, t) {
    this.sessionDrivers.set(e, t);
  }
  unbindSession(e) {
    this.sessionDrivers.delete(e), this.sessionLifecycles.delete(e), this.contexts.delete(e);
  }
  bindLifecycle(e, t) {
    this.sessionLifecycles.set(e, t);
  }
  getLifecycle(e) {
    return this.sessionLifecycles.get(e);
  }
  captureLayout(e) {
    var i, r, n;
    const t = this.getContext(e.session.id), s = (n = (r = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.layout) == null ? void 0 : r.capture) == null ? void 0 : n.call(r, e);
    t.layoutSnapshot = s;
  }
  playLayout(e, t = !1) {
    var r, n;
    const s = this.getContext(e.session.id), i = this.sessionLifecycles.get(e.session.id);
    s.layoutSnapshot !== void 0 && ((n = (r = i == null ? void 0 : i.layout) == null ? void 0 : r.play) == null || n.call(r, e, s.layoutSnapshot, t));
  }
  /** 列尾追加专用：等下一帧（Vue patch 落地）再量布局执行 Invert。 */
  playLayoutOnRaf(e) {
    this.playLayout(e, !0);
  }
  cancelLayout(e, t) {
    var r, n, o;
    const s = this.getContext(e.session.id), i = s.layoutSnapshot;
    i !== void 0 && ((o = (n = (r = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : r.layout) == null ? void 0 : n.cancel) == null || o.call(n, e, i, t)), s.layoutSnapshot = void 0;
  }
  getContext(e) {
    let t = this.contexts.get(e);
    return t || (t = {
      transaction: new Se(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(e, t)), t;
  }
  driverFor(e) {
    return this.sessionDrivers.get(e) ?? this.driver;
  }
  prepare(e, t) {
    var l, h, a, c, d;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("prepare");
    const i = ((h = (l = e.visual) == null ? void 0 : l.resolveSource) == null ? void 0 : h.call(l, t.objectId)) ?? null;
    s.sourceElement = i, s.transaction.source = i;
    const r = t.input.event instanceof PointerEvent ? t.input.event : null;
    if (i && r) {
      const g = i.getBoundingClientRect();
      s.dragOffset = {
        x: r.clientX - g.left,
        y: r.clientY - g.top
      };
    }
    const n = (c = (a = this.driverFor(e.session.id)).prepare) == null ? void 0 : c.call(a, e, t), o = this.sessionLifecycles.get(e.session.id);
    return n && typeof n.then == "function" ? Promise.resolve(n).then(async () => {
      var g;
      return (g = o == null ? void 0 : o.beginDrag) == null ? void 0 : g.call(o, e);
    }) : (d = o == null ? void 0 : o.beginDrag) == null ? void 0 : d.call(o, e);
  }
  update(e, t) {
    var r, n;
    if (e.session.state !== "active") return;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("active");
    const i = t.event instanceof PointerEvent ? t.event : null;
    (n = (r = this.driverFor(e.session.id)).update) == null || n.call(r, e, t), i && s.followElement && (s.followElement.style.left = `${i.clientX - s.dragOffset.x}px`, s.followElement.style.top = `${i.clientY - s.dragOffset.y}px`);
  }
  release(e, t) {
    var n;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("release");
    const i = this.driverFor(e.session.id), r = (n = i.resolveDestination) == null ? void 0 : n.call(i, e, t);
    return we(r) ? r.then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o)) : (r && r.accepted && r.destination !== void 0 && (s.destination = r.destination, s.transaction.destination = r.destination), r);
  }
  commit(e, t) {
    this.getContext(e.session.id).transaction.setPhase("landing");
    const s = this.driverFor(e.session.id);
    if (s.commit)
      return s.commit(e, t);
  }
  cancel(e, t) {
    var i, r, n, o;
    const s = this.getContext(e.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.cancel) == null || r.call(i, e, t), (o = (n = this.driverFor(e.session.id)).cancel) == null || o.call(n, e, t);
  }
  interrupt(e, t) {
    var i, r, n, o;
    const s = this.getContext(e.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (r = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.cancel) == null || r.call(i, e, t), (o = (n = this.driverFor(e.session.id)).interrupt) == null || o.call(n, e, t);
  }
  dispose(e) {
    var s, i;
    const t = this.getContext(e.session.id).transaction;
    t.phase !== "cancelled" && t.setPhase("disposed"), (i = (s = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : s.dispose) == null || i.call(s, e), this.unbindSession(e.session.id);
  }
  landing(e, t) {
    var o;
    const s = this.getContext(e.session.id);
    if (s.transaction.setPhase("landing"), s.landingStarted)
      return s.landingPromise ?? { completed: s.landingCompleted === !0 };
    s.landingStarted = !0, s.destination = t;
    const i = this.sessionLifecycles.get(e.session.id), r = (o = i == null ? void 0 : i.landing) == null ? void 0 : o.call(i, e, t), n = Promise.resolve(r).then((l) => ((!l || l.completed) && (s.landingCompleted = !0), l));
    return s.landingPromise = n, n;
  }
  reveal(e, t) {
    var i, r;
    const s = this.getContext(e.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (r = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.reveal) == null ? void 0 : r.call(i, e, t);
  }
}
const je = [
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
function Me(u) {
  const e = getComputedStyle(u);
  return Object.fromEntries(
    je.map((t) => [t, e[t]])
  );
}
function Re(u, e) {
  Object.assign(u.style, e);
}
function Le(u, e) {
  Re(e, Me(u));
}
class A {
  constructor(e) {
    this.runtime = e;
  }
  /** 设置/更新 runtime 引用（在 registerObjectType 时自动设置） */
  setRuntime(e) {
    this.runtime = e;
  }
  resolveSource(e) {
    var t, s;
    return ((s = (t = this.runtime) == null ? void 0 : t.objects.get(e)) == null ? void 0 : s.element) ?? null;
  }
  resolveTarget(e) {
    var i, r;
    const t = ((r = (i = this.runtime) == null ? void 0 : i.objects.get(e)) == null ? void 0 : r.element) ?? null;
    if (!(t != null && t.isConnected) || t.dataset.runtimeProxy === "true") return null;
    const s = t.getBoundingClientRect();
    return s.width > 0 && s.height > 0 ? t : null;
  }
  captureVisualState(e) {
    const t = getComputedStyle(e);
    return {
      rect: e.getBoundingClientRect(),
      borderRadius: t.borderRadius,
      boxShadow: t.boxShadow,
      border: t.border,
      backdropFilter: t.backdropFilter,
      background: t.backgroundColor,
      backgroundImage: t.backgroundImage,
      opacity: t.opacity,
      transform: t.transform
    };
  }
  applyState(e, t) {
    e.dataset.runtimePhase = t.phase, e.classList.toggle("is-hovered", t.hovered), e.classList.toggle("is-grabbed", t.grabbed), e.classList.toggle("is-selected", t.selected);
  }
  createProxy(e) {
    var n;
    if (!e.sourceElement || !e.sourceRect || !e.beforeContent)
      throw new Error("visual proxy requires source snapshot");
    const t = W(e.beforeContent, e.sourceRect, { layout: e.proxyLayout }), s = G(t), i = !!((n = e.proxyLayout) != null && n.compact);
    Le(e.sourceElement, s);
    const r = e.visualSnapshot;
    return r && (s.style.boxShadow = r.boxShadow, s.style.borderRadius = r.borderRadius, s.style.backgroundColor = r.background, r.backgroundImage && r.backgroundImage !== "none" && (s.style.backgroundImage = r.backgroundImage), s.style.opacity = r.opacity, N(t).style.transform = `scale(${i ? 1 : 1.03})`), ee() && te(s), s.querySelectorAll("[class]").forEach((o) => {
      const l = getComputedStyle(o);
      l.opacity === "0" && l.pointerEvents === "none" && (o.style.opacity = "1");
    }), { element: t };
  }
  land(e, t, s) {
    var m, C, b, w, R, j, I, S, x, F, D;
    const i = e.element;
    if (!((m = s.targetSnapshot) != null && m.rect) && !t.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const r = ((C = s.targetSnapshot) == null ? void 0 : C.rect) ?? t.getBoundingClientRect(), n = {
      left: r.left ?? r.x,
      top: r.top ?? r.y,
      width: r.width,
      height: r.height
    }, o = (M) => {
      var O;
      const k = (O = s.landingBounds) == null ? void 0 : O.call(s);
      return k ? se(M, k) : M;
    }, l = o(n);
    s.preserveTarget || U(t, s.sessionId), i.style.transition = "none";
    const h = s.landingMode === "target", a = G(i).dataset.runtimeCompact === "true", c = s.targetSnapshot, d = !!(c && (c.background && c.background !== "transparent" && c.background !== "rgba(0, 0, 0, 0)" || c.backgroundImage && c.backgroundImage !== "none" || c.boxShadow && c.boxShadow !== "none")), g = h ? !s.disableTargetVisualMorph && d : !!c, p = s.landingMode === "target" ? ((w = (b = s.motion) == null ? void 0 : b.target) == null ? void 0 : w.landing) ?? ((R = s.motion) == null ? void 0 : R.landing) : (j = s.motion) == null ? void 0 : j.landing;
    h || (i.style.width = `${l.width}px`, i.style.height = `${l.height}px`);
    const f = s.motionEnabled === !1 ? X : Y, { finished: y, retarget: v } = f(i, l, {
      duration: (p == null ? void 0 : p.duration) ?? H.landing.duration,
      easing: (p == null ? void 0 : p.easing) ?? H.landing.easing,
      // 面包屑是透明文本节点，只提供位置和消失时机，不能把它的透明表面
      // 样式覆盖到代理卡片；有可见表面的文件夹卡仍完整执行视觉 morph。
      targetShadow: g ? c == null ? void 0 : c.boxShadow : void 0,
      targetRadius: g ? c == null ? void 0 : c.borderRadius : void 0,
      targetBorder: g ? c == null ? void 0 : c.border : void 0,
      targetBackdropFilter: g ? c == null ? void 0 : c.backdropFilter : void 0,
      targetBackground: g ? c == null ? void 0 : c.background : void 0,
      targetBackgroundImage: g ? c == null ? void 0 : c.backgroundImage : void 0,
      targetOpacity: g ? c == null ? void 0 : c.opacity : void 0,
      // 透明面包屑/列表行没有可复用的卡片式内容结构，不能参与 content morph——列表行是
      // grid 多列布局，套这套给卡片设计的结构级 morph 会把列挤错位（类型跑到文件名下面）。
      // compact 列表代理与目标卡结构相同，只需要让同一份内容跟随宽度恢复；如果再挂一层
      // 目标 Grid，右侧文件大小会因为 justify-self:end 在 landing 第一帧瞬间回到完整宽度。
      // 只有真正有背景/阴影且不是 compact 列表的目标才复用结构级 content morph。
      targetContent: d && !a ? t : void 0,
      landingMode: s.landingMode,
      targetMotion: h ? (S = (I = s.motion) == null ? void 0 : I.target) == null ? void 0 : S.motion : void 0,
      dismiss: h ? (F = (x = s.motion) == null ? void 0 : x.target) == null ? void 0 : F.dismiss : void 0,
      readTarget: () => o(t.getBoundingClientRect()),
      motionState: s.motionState,
      coast: {
        duration: E.coastSeconds,
        friction: ie,
        maxDistance: E.maxCoast,
        minVelocity: E.minVelocity
      },
      releaseDamping: E.dampingRatio
    });
    if (this.runtime) {
      const M = (D = s.targetSnapshot) == null ? void 0 : D.rect, k = () => {
        const O = t.getBoundingClientRect();
        return O.width > 0 && O.height > 0 ? o(O) : M && M.width > 0 && M.height > 0 ? o({
          left: M.x,
          top: M.y,
          width: M.width,
          height: M.height
        }) : o(O);
      };
      this.runtime.trackLandingTarget(s.sessionId, t, () => {
        v(k());
      });
    }
    return y.then(() => ({ completed: !0 }));
  }
  reveal(e, t, s) {
    t.style.transition = "", J(t, s.sessionId);
  }
  dispose(e, t) {
    var i;
    const s = e.element;
    (i = e.dispose) == null || i.call(e), K(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(e) {
    const t = this.runtime;
    return !t || !t.objects.hasAbility(e.objectId, "move") ? {} : (e.event.preventDefault(), (e.mode === "clone" ? Q : Z)({
      runtime: t,
      objectId: e.objectId,
      element: e.element,
      event: e.event,
      fromRect: e.fromRect,
      returnRect: e.returnRect
    }));
  }
}
class Ie {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
  }
  register(e, t) {
    this.adapters.set(e, t);
  }
  get(e) {
    return this.adapters.get(e);
  }
  remove(e) {
    this.adapters.delete(e);
  }
}
function P(u, e) {
  return e.x >= u.left && e.x <= u.right && e.y >= u.top && e.y <= u.bottom;
}
function xe(u, e, t, s) {
  const i = u.get(s), r = () => e.snapshot().filter((n) => {
    var o;
    return (o = n.element) == null ? void 0 : o.isConnected;
  }).filter((n) => i ? e.accepts(n.id, i.type) : !1);
  return {
    findSurface(n) {
      var h;
      const o = t.snapshot().filter((a) => {
        var c;
        return (c = a.element) == null ? void 0 : c.isConnected;
      }).filter((a) => a.accepts.length === 0 || a.accepts.includes((i == null ? void 0 : i.type) ?? "")).filter((a) => P(a.element.getBoundingClientRect(), n)).sort((a, c) => (c.priority ?? 0) - (a.priority ?? 0)).map((a) => e.get(a.surfaceId)).find((a) => !!(a && e.accepts(a.id, (i == null ? void 0 : i.type) ?? "")));
      return o || (((h = r().map((a) => ({
        surface: a,
        rect: a.element.getBoundingClientRect()
      })).filter(({ rect: a }) => P(a, n)).sort((a, c) => a.rect.width * a.rect.height - c.rect.width * c.rect.height)[0]) == null ? void 0 : h.surface) ?? null);
    },
    findTarget(n, o, l) {
      var c;
      const h = (c = u.get(s)) == null ? void 0 : c.type, a = t.snapshot().filter((d) => d.surfaceId === n.id && d.id !== `object-target:${l}`).filter((d) => d.accepts.length === 0 || d.accepts.includes(h ?? "")).filter((d) => {
        var g;
        return (g = d.element) == null ? void 0 : g.isConnected;
      }).sort((d, g) => (g.priority ?? 0) - (d.priority ?? 0)).find((d) => P(d.element.getBoundingClientRect(), o));
      return a != null && a.element ? a.element : [...u.values()].filter((d) => d.id !== l && d.surfaceId === n.id).map((d) => d.element).filter((d) => !!(d != null && d.isConnected)).find((d) => P(d.getBoundingClientRect(), o)) ?? null;
    },
    findIndex(n, o, l) {
      const h = [...u.values()].filter((a) => a.id !== l && a.surfaceId === n.id).map((a) => a.element).filter((a) => !!(a != null && a.isConnected)).map((a) => ({ element: a, rect: a.getBoundingClientRect() })).sort((a, c) => a.rect.top - c.rect.top || a.rect.left - c.rect.left);
      for (let a = 0; a < h.length; a += 1) {
        const { rect: c } = h[a];
        if (o.y < c.top + c.height / 2) return a;
      }
      return h.length;
    }
  };
}
class Oe {
  constructor() {
    this.visuals = new Ie(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
  }
  registerVisualAdapter(e, t) {
    this.visuals.register(e, t);
  }
  registerVisualStrategy(e, t) {
    this.visualStrategies.set(e, t);
  }
  registerObjectType(e, t) {
    this.objectTypes.set(e, t), t.visual && this.visuals.register(e, t.visual);
  }
  setMotionProfile(e) {
    this.motionProfile = e;
  }
  setMotionController(e) {
    this.motionController = e;
  }
}
class Te {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(e, t, s) {
    const i = new q(e, t, s);
    return this.sessions.set(i.id, i), i;
  }
  get(e) {
    return this.sessions.get(e);
  }
  snapshot() {
    return [...this.sessions.values()];
  }
  set(e) {
    this.sessions.set(e.id, e);
  }
  delete(e) {
    this.sessions.delete(e);
  }
  addGate(e, t) {
    const s = this.completionGates.get(e) ?? /* @__PURE__ */ new Set();
    s.add(t), this.completionGates.set(e, s);
  }
  trackForObject(e, t) {
    let s = !1;
    for (const i of this.sessions.values())
      i.hasObject(e) && (i.trackCleanup(t), s = !0);
    return s;
  }
  removeGate(e, t) {
    var s;
    (s = this.completionGates.get(e)) == null || s.delete(t);
  }
  failGates(e) {
    const t = this.completionGates.get(e);
    if (t) {
      for (const s of [...t]) s.fail();
      this.completionGates.delete(e);
    }
  }
  acquireObject(e, t) {
    const s = this.sessions.get(e);
    return s ? s.takeObject(t) : null;
  }
  track(e, t) {
    var s;
    (s = this.sessions.get(e)) == null || s.trackCleanup(t);
  }
  finalize(e, t) {
    const s = this.sessions.get(e);
    if (s)
      return t == null || t(s), s.dispose(), this.failGates(e), this.sessions.delete(e), s;
  }
  cancel(e, t) {
    const s = this.sessions.get(e);
    if (s)
      return t == null || t(s), s.cancel(), this.sessions.delete(e), s;
  }
  interrupt(e, t, s) {
    const i = this.sessions.get(e);
    if (i)
      return s == null || s(i), i.interrupt(t), this.sessions.delete(e), i;
  }
}
class Ee {
  constructor(e) {
    this.sessions = e;
  }
  finalize(e, t, s, i, r) {
    try {
      this.sessions.finalize(e.id, (n) => i(n.id));
    } finally {
      r(t, s);
    }
  }
  terminate(e, t, s, i, r, n, o, l) {
    try {
      n(t, s, i);
    } catch (h) {
      console.error(`Behavior ${r} failed`, h);
    } finally {
      try {
        o(e), r === "cancel" ? this.sessions.cancel(e.id) : this.sessions.interrupt(e.id, i === "regrab" ? "regrab" : "cancel");
      } finally {
        l(t, s);
      }
    }
  }
}
function Ae(u) {
  return !!(u && typeof u.then == "function");
}
class V {
  constructor(e, t, s, i) {
    this.updateCoordinator = e, this.releaseCoordinator = t, this.commitCoordinator = s, this.landingCoordinator = i;
  }
  static fromPorts(e, t, s) {
    return new V(
      new ke(e),
      new Pe(),
      t,
      s
    );
  }
  update(e, t) {
    this.updateCoordinator.update(e, t);
  }
  prepareRelease(e, t) {
    return this.releaseCoordinator.prepare(e, t);
  }
  async commit(e, t, s, i = !0) {
    return this.commitCoordinator.commit(e, t, s, i);
  }
  async land(e, t, s) {
    return this.landingCoordinator.run(e, t, s);
  }
  release(e, t, s) {
    var h;
    const i = s.getSession(e), r = this.prepareRelease(i, t);
    if (r.kind === "ignore") return Promise.resolve();
    if (r.kind === "cancel")
      return i && s.cancel(i.id, r.reason), Promise.resolve();
    const n = r.session, o = s.getBehavior(n.type);
    o instanceof L && s.captureLayout(n.id);
    let l;
    try {
      l = (h = o == null ? void 0 : o.release) == null ? void 0 : h.call(o, s.createContext(n), t);
    } catch (a) {
      return s.cancel(n.id, a instanceof Error ? a.message : "release-failed"), Promise.resolve();
    }
    return Ae(l) ? Promise.resolve(l).then((a) => this.finishRelease(n, o, a, s), (a) => {
      s.cancel(n.id, a instanceof Error ? a.message : "release-failed");
    }) : this.finishRelease(n, o, l, s);
  }
  async finishRelease(e, t, s, i) {
    if (i.getSession(e.id) !== e) return;
    const r = s;
    if ((r == null ? void 0 : r.accepted) === !1) {
      i.cancel(e.id, "no-valid-drop");
      return;
    }
    if (e.state === "release" && e.transition("landing"), !(t instanceof L)) {
      i.end(e);
      return;
    }
    const n = r == null ? void 0 : r.destination;
    if (n === void 0) {
      i.cancel(e.id, "invalid-release-result");
      return;
    }
    try {
      await this.commit(e, t, n, (r == null ? void 0 : r.emitAction) !== !1);
    } catch (o) {
      i.cancel(e.id, o instanceof Error ? o.message : "commit-failed");
      return;
    }
    await this.land(e, t, n);
  }
  start(e, t) {
    var o;
    const s = t.getBehavior(e.type);
    if (!s) throw new Error(`Unknown interaction behavior: ${e.type}`);
    const i = t.createSession(e.type, e.objectId), r = t.getVisualStrategy(e.objectId);
    r && t.bindLifecycle(i.id, r);
    const n = t.createContext(i);
    try {
      const l = (o = s.prepare) == null ? void 0 : o.call(s, n, e);
      l && typeof l.then == "function" && l.catch((h) => {
        t.isCurrent(i.id) && t.cancel(i.id, h instanceof Error ? h.message : "prepare-failed");
      });
    } catch (l) {
      t.cancel(i.id, l instanceof Error ? l.message : "prepare-failed");
    }
    return t.isCurrent(i.id) && i.state === "prepare" && i.transition("active"), {
      id: i.id,
      get state() {
        return i.state;
      },
      cancel: (l) => t.cancel(i.id, l ?? "cancelled"),
      interrupt: (l) => t.interrupt(i.id, l ?? "interrupted")
    };
  }
}
class ke {
  constructor(e) {
    this.port = e;
  }
  update(e, t) {
    var i, r;
    const s = this.port.getSession(e);
    !s || s.state !== "active" || (r = (i = this.port.getBehavior(s.type)) == null ? void 0 : i.update) == null || r.call(i, this.port.createContext(e), t);
  }
}
class Pe {
  prepare(e, t) {
    return e ? t.kind === "pointercancel" || t.kind === "blur" || t.kind === "lostpointercapture" ? { kind: "cancel", reason: t.kind } : e.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (e.state === "active" && e.transition("release"), e.state === "release" ? { kind: "continue", session: e } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class Be {
  constructor(e, t) {
    this.port = e, this.actions = t;
  }
  resolveIsAppend(e, t) {
    var r, n, o, l, h, a;
    if (!t) return !1;
    const s = (n = (r = this.port).getObjectIndex) == null ? void 0 : n.call(r, e, t.toSurfaceId), i = (l = (o = this.port).getSurfaceObjectCount) == null ? void 0 : l.call(o, t.toSurfaceId);
    return (a = (h = this.port).hasLayoutAnchor) != null && a.call(h, t.toSurfaceId) ? !1 : s !== void 0 && s >= 0 && i !== void 0 ? s >= i - 1 : t.toIndex !== void 0 && i !== void 0 && t.toIndex >= i - 1;
  }
  async commit(e, t, s, i = !0) {
    var h, a, c, d;
    const r = this.port.createContext(e);
    if (await t.commit(r, s), !i) {
      const g = this.port.normalize(e.objectId, s);
      g && (t.getContext(e.id).transaction.destination = g), this.resolveIsAppend(e.objectId, g) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
      return;
    }
    const n = this.port.getLifecycle(e.id), o = this.port.normalize(e.objectId, s);
    o && await ((a = (h = n == null ? void 0 : n.surface) == null ? void 0 : h.leave) == null ? void 0 : a.call(h, r, o.fromSurfaceId)), await this.actions.emit(e.objectId, t.getContext(e.id).destination, t.getContext(e.id).transaction), o && await ((d = (c = n == null ? void 0 : n.surface) == null ? void 0 : c.enter) == null ? void 0 : d.call(c, r, o.toSurfaceId)), this.resolveIsAppend(e.objectId, o) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
  }
}
class Ve {
  constructor(e) {
    this.port = e;
  }
  async run(e, t, s) {
    try {
      const i = await t.landing(this.port.createContext(e), s), r = this.port.getSession(e.id);
      if (r !== e || r.state === "disposed" || r.state === "interrupt") return;
      if (i && !i.completed) return this.port.cancel(e.id, i.reason ?? "landing-failed");
      i && i.reveal && await i.reveal(), e.handoff(), t.reveal && await t.reveal(this.port.createContext(e), s), this.port.getSession(e.id) === e && this.port.end(e);
    } catch (i) {
      this.port.getSession(e.id) === e && this.port.cancel(e.id, i instanceof Error ? i.message : "landing-failed");
    }
  }
}
class Fe {
  constructor(e) {
    this.port = e;
  }
  normalize(e, t) {
    if (this.isDestination(t)) return t;
    if (!t || typeof t != "object") return null;
    const s = t;
    if (typeof s.columnId != "string") return null;
    const i = this.port.getObjectSurface(e);
    return i ? { fromSurfaceId: i, toSurfaceId: s.columnId, ...typeof s.index == "number" ? { toIndex: s.index } : {} } : null;
  }
  async emit(e, t, s) {
    var n, o;
    if (s.actionEmitted) return !1;
    const i = this.normalize(e, t);
    if (!i) return !1;
    s.actionEmitted = !0, s.destination = i;
    const r = (o = (n = this.port).getGroup) == null ? void 0 : o.call(n, e);
    return r && r.objectIds.length > 1 ? await this.port.emit({
      type: "move-group",
      objectId: r.primaryObjectId,
      primaryObjectId: r.primaryObjectId,
      objectIds: r.objectIds,
      fromSurfaceId: i.fromSurfaceId,
      toSurfaceId: i.toSurfaceId,
      ...i.toIndex === void 0 ? {} : { toIndex: i.toIndex },
      timestamp: Date.now()
    }) : await this.port.emit({ type: "move", objectId: e, fromSurfaceId: i.fromSurfaceId, toSurfaceId: i.toSurfaceId, ...i.toIndex === void 0 ? {} : { toIndex: i.toIndex }, timestamp: Date.now() }), !0;
  }
  isDestination(e) {
    if (!e || typeof e != "object") return !1;
    const t = e;
    return typeof t.fromSurfaceId == "string" && typeof t.toSurfaceId == "string";
  }
}
function De(u) {
  let e = null, t = null, s = !1;
  const i = Math.max(0, u.stableFrameLimit ?? 2), r = Math.max(1, u.idlePollInterval ?? 4);
  let n = 0, o = 0, l = null;
  const h = () => {
    s || (s = !0, t !== null && cancelAnimationFrame(t), t = null, e == null || e.disconnect(), e = null);
  };
  if (typeof ResizeObserver > "u") return h;
  const a = () => {
    if (s || !u.target.isConnected) return;
    const d = u.target.getBoundingClientRect();
    l = d, n = 0, o = 0, u.retarget(d);
  };
  if (e = new ResizeObserver(a), e.observe(u.target), u.observeAncestors !== !1) {
    const d = typeof document < "u" ? document.body : null, g = u.stopAt === void 0 ? d : u.stopAt;
    let p = u.target.parentElement;
    for (; p && p !== g; )
      e.observe(p), p = p.parentElement;
  }
  const c = () => {
    if (s || (t = requestAnimationFrame(c), !u.target.isConnected) || (o += 1, n >= i && o % r !== 0)) return;
    const d = u.target.getBoundingClientRect();
    if (l && Math.abs(d.left - l.left) < 0.5 && Math.abs(d.top - l.top) < 0.5 && Math.abs(d.width - l.width) < 0.5 && Math.abs(d.height - l.height) < 0.5) {
      n += 1;
      return;
    }
    n = 0, l = d, u.retarget(d);
  };
  return t = requestAnimationFrame(c), u.cleanup.track(h), h;
}
class Ge {
  constructor(e) {
    this.port = e;
  }
  resolveTarget(e, t) {
    var i, r;
    const s = ((r = (i = this.port.getAdapter(e)).resolveTarget) == null ? void 0 : r.call(i, e, t)) ?? new A().resolveTarget(e);
    return s != null && s.isConnected ? s : null;
  }
  apply(e, t, s) {
    (this.port.getAdapter(e).applyState ?? new A().applyState)(t, s);
  }
  capture(e, t) {
    return (this.port.getAdapter(e).captureVisualState ?? new A().captureVisualState)(t);
  }
  trackTarget(e, t, s, i = {}) {
    return De({ ...i, cleanup: e, target: t, retarget: s });
  }
}
class He {
  constructor() {
    this.proxies = /* @__PURE__ */ new Map();
  }
  register(e, t) {
    this.proxies.set(e, t);
  }
  get(e) {
    return this.proxies.get(e);
  }
  remove(e) {
    const t = this.proxies.get(e);
    return this.proxies.delete(e), t;
  }
}
class $e {
  constructor(e, t) {
    this.port = e, this.proxies = t;
  }
  create(e, t) {
    var r, n;
    const s = this.port.getSession(e);
    if (!s) return;
    const i = (n = (r = this.port.getAdapter(s.objectId)).createProxy) == null ? void 0 : n.call(r, t);
    if (i)
      return this.proxies.register(e, i), i;
  }
  async land(e, t, s) {
    var l, h;
    const i = this.port.getSession(e), r = this.proxies.get(e);
    if (!i || !r) return { completed: !1, reason: "visual-proxy-missing" };
    const n = s ?? this.port.createContext(e, void 0, t), o = await ((h = (l = this.port.getAdapter(i.objectId)).land) == null ? void 0 : h.call(l, r, t, n));
    return o || { completed: !0 };
  }
  update(e, t) {
    var r, n;
    const s = this.port.getSession(e), i = this.proxies.get(e);
    !s || !i || (n = (r = this.port.getAdapter(s.objectId)).updateProxy) == null || n.call(r, i, t ?? this.port.createContext(e));
  }
  async reveal(e, t, s) {
    var n, o;
    const i = this.port.getSession(e), r = this.proxies.get(e);
    !i || !r || await ((o = (n = this.port.getAdapter(i.objectId)).reveal) == null ? void 0 : o.call(n, r, t, s ?? this.port.createContext(e, void 0, t)));
  }
}
function ze(u, e, t = {}) {
  const s = t.target ?? window, i = t.captureTarget;
  let r = !1, n = null, o = null;
  const l = (p) => {
    n = p, o === null && (o = s.requestAnimationFrame(() => {
      o = null;
      const f = n;
      n = null, !(r || !f) && u.update(e.id, { kind: "pointermove", event: f });
    }));
  }, h = (p) => {
    g(), u.release(e.id, { kind: "pointerup", event: p });
  }, a = (p) => {
    g(), u.release(e.id, { kind: "pointercancel", event: p });
  }, c = () => {
    g(), u.release(e.id, { kind: "blur" });
  }, d = (p) => {
    g(), u.release(e.id, { kind: "lostpointercapture", event: p });
  };
  function g() {
    r || (r = !0, n = null, o !== null && (s.cancelAnimationFrame(o), o = null), s.removeEventListener("pointermove", l), s.removeEventListener("pointerup", h), s.removeEventListener("pointercancel", a), s.removeEventListener("blur", c), i == null || i.removeEventListener("lostpointercapture", d));
  }
  return s.addEventListener("pointermove", l), s.addEventListener("pointerup", h), s.addEventListener("pointercancel", a), s.addEventListener("blur", c), i == null || i.addEventListener("lostpointercapture", d), e.cleanup.track(g), g;
}
class qe {
  constructor(e) {
    this.port = e, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(e, t, s = {}) {
    var l, h;
    (l = this.disposers.get(e)) == null || l(), (h = this.bindings.get(t)) == null || h();
    let i = null;
    const r = () => {
      i && (window.removeEventListener("pointermove", i.move), window.removeEventListener("pointerup", i.up), window.removeEventListener("pointercancel", i.up), i = null);
    }, n = (a) => {
      if (!(a instanceof PointerEvent) || a.button !== 0 && a.pointerType === "mouse") return;
      if (!a.pointerType) {
        this.port.startObjectPointer(e, t, a);
        return;
      }
      r();
      const c = a.clientX, d = a.clientY, g = (f) => {
        if (!(f instanceof PointerEvent)) return;
        const y = Math.max(0, s.dragThreshold ?? 5);
        Math.hypot(f.clientX - c, f.clientY - d) < y || (r(), f.preventDefault(), this.port.startObjectPointer(e, t, a));
      }, p = () => r();
      i = { down: a, move: g, up: p }, window.addEventListener("pointermove", g), window.addEventListener("pointerup", p), window.addEventListener("pointercancel", p);
    };
    t.addEventListener("pointerdown", n);
    const o = () => {
      t.removeEventListener("pointerdown", n), r();
    };
    return this.bindings.set(t, o), this.disposers.set(e, o), o;
  }
  sync(e) {
    var i;
    const t = this.port.objects.get(e);
    if ((i = this.disposers.get(e)) == null || i(), this.disposers.delete(e), !(t != null && t.element) || !this.port.registry.objectTypes.has(t.visual ?? t.type)) return;
    const s = this.port.registry.objectTypes.get(t.visual ?? t.type);
    this.bind(e, t.element, s == null ? void 0 : s.pointerInput);
  }
  remove(e) {
    var t;
    (t = this.disposers.get(e)) == null || t(), this.disposers.delete(e);
  }
  bindRegrabTarget(e, t, s, i) {
    this.port.registerRegrab(t, i);
    const r = (n) => {
      n instanceof PointerEvent && this.port.regrab(t, n);
    };
    s.addEventListener("pointerdown", r), e.cleanup.trackTargetListener(s, "pointerdown", r);
  }
  bindSession(e, t = {}) {
    return ze({
      update: (s, i) => this.port.update(s, i),
      release: (s, i) => this.port.release(s, i)
    }, e, t);
  }
}
class _e {
  constructor(e) {
    this.handlers = e;
  }
  start(e) {
    return this.handlers.start(e);
  }
  update(e, t) {
    this.handlers.update(e, t);
  }
  release(e, t) {
    return this.handlers.release(e, t);
  }
  cancel(e, t) {
    this.handlers.cancel(e, t);
  }
  interrupt(e, t) {
    this.handlers.interrupt(e, t);
  }
}
function We(u, e = {}) {
  const t = e.edgeSize ?? 48, s = e.maxSpeed ?? 16;
  let i = null, r = null, n = null, o = !1, l = null, h = 0, a = null, c = null, d = null;
  const g = () => {
    if (!i || !i.isConnected) {
      l = null;
      return;
    }
    l = i.getBoundingClientRect(), h = 0;
  }, p = (m) => {
    if (a !== m) {
      if (c == null || c.disconnect(), a = m, !m || typeof ResizeObserver > "u") {
        c = null;
        return;
      }
      c = new ResizeObserver(g), c.observe(m);
    }
  }, f = (m, C) => {
    const b = (t - m) / t;
    return Math.ceil(s * b * (C * 60));
  }, y = (m) => {
    var j, I;
    if (o) return;
    n = requestAnimationFrame(y);
    const C = Math.min(0.05, Math.max(0, (m - (d ?? m)) / 1e3));
    if (d = m, !i || !r || !i.isConnected) return;
    (!l || h++ >= 8) && g();
    const b = l;
    if (!b || r.x < b.left || r.x > b.right) return;
    const w = r.y - b.top, R = b.bottom - r.y;
    if (w < t) {
      const S = i.scrollTop;
      i.scrollTop -= f(w, C), i.scrollTop !== S && ((j = e.onScroll) == null || j.call(e, r));
    } else if (R < t) {
      const S = i.scrollTop;
      i.scrollTop += f(R, C), i.scrollTop !== S && ((I = e.onScroll) == null || I.call(e, r));
    }
  }, v = () => {
    o || (o = !0, n !== null && cancelAnimationFrame(n), n = null, c == null || c.disconnect(), c = null, a = null, l = null);
  };
  return n = requestAnimationFrame(y), u.track(v), {
    update(m, C) {
      o || (i !== m && (l = null, h = 0, p(m)), i = m, r = C, l === null && g());
    },
    stop: v
  };
}
class Ne {
  constructor() {
    this.owner = new ge(), this.objects = new ve(), this.surfaces = new ye(), this.targets = new be(), this.behaviors = new Ce(), this.registry = new Oe(), this.hitResolver = null, this.sessionCoordinator = new Te(), this.runtimeSession = new Ee(this.sessionCoordinator), this.events = new T(), this.actions = new T(), this.visualProxyCoordinator = new He(), this.surfaceScrollFrames = /* @__PURE__ */ new WeakMap(), this.defaultVisualAdapter = new A(this), this.moveBehavior = new L(), this.inputCoordinator = new qe({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (e, t, s) => this.startObjectPointer(e, t, s),
      registerRegrab: (e, t) => this.registerRegrab(e, t),
      regrab: (e, t) => this.regrab(e, t),
      update: (e, t) => this.update(e, t),
      release: (e, t) => this.release(e, t)
    }), this.moveActions = new Fe({
      getObjectSurface: (e) => {
        var t;
        return (t = this.objects.get(e)) == null ? void 0 : t.surfaceId;
      },
      getGroup: (e) => {
        const t = this.sessionCoordinator.snapshot().find((s) => s.hasObject(e));
        if (t instanceof B)
          return { primaryObjectId: t.primaryObjectId, objectIds: t.objectIds };
      },
      emit: (e) => this.actions.emitAsync(e)
    }), this.moveCommit = new Be({
      createContext: (e) => this.createBehaviorContext(e),
      getLifecycle: (e) => this.moveBehavior.getLifecycle(e),
      playLayout: (e, t) => this.playMoveLayout(e, t),
      normalize: (e, t) => this.moveActions.normalize(e, t),
      getSurfaceObjectCount: (e) => [...this.objects.values()].filter((t) => t.surfaceId === e).length,
      hasLayoutAnchor: (e) => {
        var t, s;
        return ((s = (t = this.surfaces.get(e)) == null ? void 0 : t.element) == null ? void 0 : s.querySelector("[data-flip-target]")) !== null;
      },
      getObjectIndex: (e, t) => this.getObjectSurfaceIndex(e, t)
    }, this.moveActions), this.moveLanding = new Ve({
      createContext: (e) => this.createBehaviorContext(e),
      getSession: (e) => this.sessionCoordinator.get(e),
      cancel: (e, t) => this.cancel(e, t),
      end: (e) => this.endSession(e)
    }), this.runtimeMove = V.fromPorts({
      getSession: (e) => this.sessionCoordinator.get(e),
      getBehavior: (e) => this.behaviors.get(e),
      createContext: (e) => this.createBehaviorContext(this.sessionCoordinator.get(e))
    }, this.moveCommit, this.moveLanding), this.visualState = new Ge({ getAdapter: (e) => this.getObjectVisualAdapter(e) }), this.visualMotion = new $e({
      getSession: (e) => this.sessionCoordinator.get(e),
      getAdapter: (e) => this.getObjectVisualAdapter(e),
      createContext: (e, t, s) => this.createVisualLifecycleContext(e, t, s)
    }, this.visualProxyCoordinator), this.dispatcher = new _e({
      start: (e) => this.startInternal(e),
      update: (e, t) => this.updateInternal(e, t),
      release: (e, t) => this.releaseInternal(e, t),
      cancel: (e, t) => this.cancelInternal(e, t),
      interrupt: (e, t) => this.interruptInternal(e, t)
    }), this.behaviors.register(this.moveBehavior), $(this.registry.motionProfile), this.objects.subscribe((e) => {
      this.events.emit(e), (e.type === "object-added" || e.type === "object-changed") && (this.syncObjectPointerBinding(e.id), this.syncObjectTarget(e.id)), e.type === "object-removed" && (this.inputCoordinator.remove(e.id), this.targets.unregister(`object-target:${e.id}`));
    }), this.surfaces.subscribe((e) => this.events.emit(e)), this.targets.subscribe((e) => this.events.emit(e)), this.owner.subscribe((e) => this.events.emit({ type: "ownership-changed", id: e }));
  }
  /** 兼容现有调用方；新的注册逻辑统一落在 registry。 */
  get visuals() {
    return this.registry.visuals;
  }
  registerVisualAdapter(e, t) {
    this.registry.registerVisualAdapter(e, t);
  }
  registerVisualStrategy(e, t) {
    this.registry.registerVisualStrategy(e, t);
  }
  /** 查询某个 Object/Surface 当前是否由 Runtime 接管视觉状态。 */
  isControlled(e) {
    return this.owner.isControlled(e);
  }
  /** 订阅 Runtime 接管权变化，供框架层刷新 DOM 编排状态。 */
  onOwnershipChange(e) {
    return this.owner.subscribe(e);
  }
  registerObjectType(e, t) {
    this.registry.registerObjectType(e, t);
    for (const s of this.objects.values())
      (s.type === e || s.visual === e) && this.syncObjectPointerBinding(s.id);
  }
  syncObjectTarget(e) {
    const t = this.objects.get(e), s = `object-target:${e}`;
    if (!(t != null && t.target)) {
      this.targets.unregister(s);
      return;
    }
    const { id: i, element: r, ...n } = t.target, o = r ?? t.element;
    if (this.targets.get(s)) {
      this.targets.update(s, n), this.targets.setElement(s, o ?? null);
      return;
    }
    this.targets.register({ ...n, id: s, element: o ?? null });
  }
  configureMotion(e) {
    const { profile: t, controller: s, ...i } = e, r = t ?? (Object.keys(i).length ? i : void 0);
    r && this.registry.setMotionProfile(r), s && (this.registry.setMotionController(s), s.follow && Object.assign(re.position, s.follow), s.rotation && Object.assign(ne, s.rotation), s.release && Object.assign(E, s.release)), $(this.registry.motionProfile);
  }
  /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
  configureVisual(e) {
    e.dragGlass !== void 0 && oe(e.dragGlass), e.layoutPresence !== void 0 && ae(e.layoutPresence);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  startObjectPointer(e, t, s, i, r) {
    return this.startObjectPointerInSession(e, t, s, i, r);
  }
  /**
   * 以一个主卡启动多对象移动。主卡仍复用单卡 MoveBehavior，GroupDragSession
   * 负责其余对象的 ownership 和批量 Action；视觉适配器可以据 objectIds 创建
   * 主代理及修饰代理。
   */
  startGroupObjectPointer(e, t, s, i, r, n) {
    var d;
    const o = [...new Set(e)];
    if (o.length < 2 || !o.includes(t)) return !1;
    const l = s.getBoundingClientRect(), h = /* @__PURE__ */ new Map();
    for (const g of o) {
      const p = (d = this.objects.get(g)) == null ? void 0 : d.element;
      if (!p) continue;
      const f = p.getBoundingClientRect();
      h.set(g, { x: f.left - l.left, y: f.top - l.top });
    }
    const a = this.startGroupSession(o, t, { offsets: h });
    a.takeObjects();
    const c = this.startObjectPointerInSession(t, s, i, r, n, a.id);
    return c || a.cancel(), c;
  }
  startObjectPointerInSession(e, t, s, i, r, n) {
    var p;
    const o = this.getRegrab(e);
    if (o)
      return o(s), !0;
    const l = this.objects.get(e);
    if (!l) return !1;
    const h = this.registry.objectTypes.get(l.visual ?? l.type);
    if (!h) return !1;
    l.element !== t && this.objects.setElement(e, t);
    const a = {
      objectId: e,
      element: t,
      event: s,
      mode: l.visualMode ?? h.defaultVisualMode,
      fromRect: i,
      returnRect: r
    }, g = ((p = h.visual) == null ? void 0 : p.createMove) ?? h.createMove ?? (() => this.defaultVisualAdapter.createMove(a));
    if (g) {
      const f = g(a);
      return !f.driver && !f.lifecycle || this.orchestrateMoveSession(
        f.request ?? {
          type: "move",
          objectId: e,
          input: { kind: "pointerdown", event: s }
        },
        {
          driver: f.driver,
          lifecycle: f.lifecycle,
          pointerInput: f.pointerInput,
          // 默认 detach driver 已由 MotionController 接管跟手；这里再把业务
          // 本体设为 followElement 会在同一 pointermove 写两次 left/top。
          // 跟手节点应由 Runtime visual driver 自行指定，业务 DOM 不参与。
          followElement: null,
          sessionId: n,
          prepareExisting: !!n
        }
      ), !0;
    }
    return !1;
  }
  bindObjectPointer(e, t) {
    return this.inputCoordinator.bind(e, t);
  }
  syncObjectPointerBinding(e) {
    this.inputCoordinator.sync(e);
  }
  getVisualAdapter(e) {
    return this.registry.visuals.get(e) ?? this.defaultVisualAdapter;
  }
  /** 按对象类型读取抓取对齐配置；未注册的类型返回 undefined，调用方按纯居中兜底。 */
  getObjectGrabAlign(e) {
    const t = this.objects.get(e), s = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
    return s == null ? void 0 : s.grabAlign;
  }
  /** 按对象注册解析抓取代理布局，供 detach 浮动入口与生命周期入口共用。 */
  getObjectProxyLayout(e, t) {
    var o;
    const s = this.objects.get(e), i = s ? this.registry.objectTypes.get(s.visual ?? s.type) : void 0, r = i == null ? void 0 : i.proxyLayout, n = t ?? (s == null ? void 0 : s.element) ?? void 0;
    if (!((o = r == null ? void 0 : r.compact) != null && o.selector) || n != null && n.matches(r.compact.selector)) return r;
  }
  getObjectVisualAdapter(e) {
    const t = this.objects.get(e), s = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
    return s != null && s.visual ? s.visual : this.getVisualAdapter((t == null ? void 0 : t.visual) ?? (t == null ? void 0 : t.type) ?? "");
  }
  createVisualLifecycleContext(e, t, s, i) {
    var v, m, C, b, w, R, j, I;
    const r = this.sessionCoordinator.get(e), n = r ? this.objects.get(r.objectId) : void 0, o = (n == null ? void 0 : n.element) ?? void 0, l = r ? this.getObjectVisualAdapter(r.objectId) : this.defaultVisualAdapter, h = new A(), a = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, c = (v = a == null ? void 0 : a.motion) == null ? void 0 : v.profile, d = this.registry.motionProfile, g = c || d ? {
      ...d,
      ...c,
      flip: { ...d == null ? void 0 : d.flip, ...c == null ? void 0 : c.flip },
      resize: { ...d == null ? void 0 : d.resize, ...c == null ? void 0 : c.resize },
      landing: { ...d == null ? void 0 : d.landing, ...c == null ? void 0 : c.landing },
      target: {
        ...d == null ? void 0 : d.target,
        ...c == null ? void 0 : c.target,
        motion: { ...(m = d == null ? void 0 : d.target) == null ? void 0 : m.motion, ...(C = c == null ? void 0 : c.target) == null ? void 0 : C.motion },
        landing: { ...(b = d == null ? void 0 : d.target) == null ? void 0 : b.landing, ...(w = c == null ? void 0 : c.target) == null ? void 0 : w.landing },
        dismiss: { ...(R = d == null ? void 0 : d.target) == null ? void 0 : R.dismiss, ...(j = c == null ? void 0 : c.target) == null ? void 0 : j.dismiss }
      },
      group: { ...d == null ? void 0 : d.group, ...c == null ? void 0 : c.group }
    } : void 0, p = typeof t == "object" && t !== null && t.invalidReturn === !0, f = !!(s && o && s === o), y = this.getObjectProxyLayout((r == null ? void 0 : r.objectId) ?? "", o);
    return {
      objectId: (r == null ? void 0 : r.objectId) ?? "",
      sessionId: e,
      mode: (n == null ? void 0 : n.visualMode) ?? "detach",
      destination: t,
      sourceElement: o,
      beforeContent: i,
      targetElement: s,
      sourceRect: o == null ? void 0 : o.getBoundingClientRect(),
      visualSnapshot: o ? (l.captureVisualState ?? h.captureVisualState)(o) : void 0,
      targetSnapshot: s ? (l.captureVisualState ?? h.captureVisualState)(s) : void 0,
      preserveTarget: (a == null ? void 0 : a.preserveMoveTarget) ?? !1,
      // 无效落点是回到原位，不是飞入语义目标；即使对象类型配置了
      // target landing，也必须保留普通 landing 的完整回位表现。
      landingMode: !p && !f && (a == null ? void 0 : a.landingMode) === "target" ? "target" : "default",
      disableTargetVisualMorph: (a == null ? void 0 : a.disableTargetVisualMorph) ?? !1,
      landingBounds: () => {
        const S = this.getDestinationSurfaceId(t), x = S ? this.resolveMoveSurfaceViewport(S) : null;
        return x && s && !x.contains(s) ? null : (x == null ? void 0 : x.getBoundingClientRect()) ?? null;
      },
      motion: g,
      motionEnabled: (I = a == null ? void 0 : a.motion) == null ? void 0 : I.enabled,
      proxyLayout: y,
      group: r instanceof B ? {
        primaryObjectId: r.primaryObjectId,
        objectIds: r.objectIds,
        offsets: new Map(r.objectIds.map((S) => [S, r.offsetFor(S)]).filter((S) => !!S[1]))
      } : void 0
    };
  }
  /** 由注册的 VisualAdapter 创建并登记当前 session 的唯一视觉代理。 */
  createVisualProxy(e, t) {
    return this.visualMotion.create(e, t);
  }
  /** 调用当前对象适配器的 landing，并保证无代理时也有确定结果。 */
  async landVisualProxy(e, t, s) {
    return this.visualMotion.land(e, t, s);
  }
  /** 将跟手或重定位更新转发给当前 session 的视觉适配器。 */
  updateVisualProxy(e, t) {
    this.visualMotion.update(e, t);
  }
  /** 通过对象 VisualAdapter 解析最终揭示目标，并过滤已断开的节点。 */
  resolveVisualTarget(e, t) {
    const s = this.sessionCoordinator.get(e);
    return s ? this.visualState.resolveTarget(s.objectId, t) : null;
  }
  /** 将对象的生命周期视觉状态交给其适配器写入。 */
  applyVisualState(e, t, s) {
    this.visualState.apply(e, t, s);
  }
  /** 获取对象当前视觉快照；未覆盖时使用默认 DOM 样式快照。 */
  captureVisualState(e, t) {
    return this.visualState.capture(e, t);
  }
  /** 调用当前对象适配器的 reveal；交接只允许由 Runtime 触发。 */
  async revealVisualProxy(e, t, s) {
    await this.visualMotion.reveal(e, t, s);
  }
  registerVisualProxy(e, t) {
    this.visualProxyCoordinator.get(e) && this.disposeVisualProxy(e), this.visualProxyCoordinator.register(e, t);
  }
  getVisualProxy(e) {
    return this.visualProxyCoordinator.get(e);
  }
  disposeVisualProxy(e) {
    var r;
    const t = this.visualProxyCoordinator.get(e);
    if (!t) return;
    const s = this.sessionCoordinator.get(e);
    let i = !1;
    if (s) {
      const n = this.createVisualLifecycleContext(e), o = this.getObjectVisualAdapter(s.objectId);
      o.dispose && (o.dispose(t, n), i = !0);
    }
    i || (r = t.dispose) == null || r.call(t), this.visualProxyCoordinator.remove(e);
  }
  createCompletionGate(e, t) {
    let s = !1, i;
    const n = {
      promise: new Promise((o) => {
        i = o;
      }),
      complete: (o) => {
        s || (s = !0, i(o), this.sessionCoordinator.removeGate(e, n));
      },
      fail: () => {
        s || (s = !0, i(t), this.sessionCoordinator.removeGate(e, n));
      }
    };
    return this.sessionCoordinator.addGate(e, n), n;
  }
  setHitResolver(e) {
    this.hitResolver = e;
  }
  getHitResolver() {
    return this.hitResolver;
  }
  /** 默认命中由已注册 Object/Surface 推导；特殊几何才需 setHitResolver()。 */
  createRegisteredHitResolver(e) {
    return xe(this.objects, this.surfaces, this.targets, e);
  }
  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(e, t, s) {
    var h;
    const i = this.objects.get(e), r = i ? this.registry.objectTypes.get(i.visual ?? i.type) : void 0, n = (h = r == null ? void 0 : r.resolveMoveHit) == null ? void 0 : h.call(r, { objectId: e, x: t, y: s });
    if (n) return n;
    if (this.hitResolver) {
      const a = this.hitResolver.findSurface({ x: t, y: s });
      return a != null && a.dataset.column ? {
        columnId: a.dataset.column,
        index: this.hitResolver.findIndex(a, { x: t, y: s }, e)
      } : null;
    }
    const o = this.createRegisteredHitResolver(e), l = o.findSurface({ x: t, y: s });
    return l ? { columnId: l.id, index: o.findIndex(l, { x: t, y: s }, e) } : null;
  }
  /** 自动滚动只需要当前命中 Surface 的真实滚动元素。 */
  resolveMoveSurfaceElement(e, t, s) {
    var r;
    if (this.hitResolver) return this.hitResolver.findSurface({ x: t, y: s });
    const i = this.createRegisteredHitResolver(e).findSurface({ x: t, y: s });
    return ((r = i == null ? void 0 : i.viewport) == null ? void 0 : r.call(i)) ?? (i == null ? void 0 : i.element) ?? null;
  }
  /** 取得指定 Surface 的滚动视口，不让视觉 driver 探查业务 DOM 结构。 */
  resolveMoveSurfaceViewport(e) {
    var s;
    const t = this.surfaces.get(e);
    return ((s = t == null ? void 0 : t.viewport) == null ? void 0 : s.call(t)) ?? (t == null ? void 0 : t.element) ?? null;
  }
  /** 创建绑定当前 Session 的自动滚动控制器；滚动资源随 Session 自动清理。 */
  createAutoScroller(e, t = {}) {
    const s = this.sessionCoordinator.get(e);
    return s ? We(s.cleanup, t) : null;
  }
  /**
   * 将落地目标滚动到注册 Surface 的可视范围内。
   *
   * 松手后的滚动由 Runtime 用 rAF 驱动，时长跟 landing 基准时长一致，
   * 不再交给浏览器的原生 smooth scroll。这样代理从松手立即开始飞行时，
   * 容器滚动不会比代理慢一大截，避免代理先完成并被销毁而容器仍在滚动。
   */
  keepSurfaceTargetVisible(e, t) {
    var d, g;
    const s = this.resolveMoveSurfaceViewport(e);
    if (!s || !t.isConnected || !s.contains(t)) return;
    const i = this.surfaceScrollFrames.get(s);
    i !== void 0 && (cancelAnimationFrame(i), this.surfaceScrollFrames.delete(s));
    const r = () => {
      const p = s.getBoundingClientRect(), f = t.getBoundingClientRect(), y = f.top < p.top ? s.scrollTop - (p.top - f.top) : f.bottom > p.bottom ? s.scrollTop + (f.bottom - p.bottom) : s.scrollTop, v = Math.max(0, s.scrollHeight - s.clientHeight);
      return Math.max(0, Math.min(y, v));
    };
    let n = r();
    if (Math.abs(n - s.scrollTop) < 0.5) return;
    const o = s.scrollTop, l = Math.max(200, ((g = (d = this.registry.motionProfile) == null ? void 0 : d.landing) == null ? void 0 : g.duration) ?? 250);
    if (typeof requestAnimationFrame > "u") {
      s.scrollTop = n;
      return;
    }
    const h = performance.now(), a = (p) => {
      const f = Math.min(1, (p - h) / l), y = 1 - (1 - f) ** 3;
      if (n = r(), s.scrollTop = o + (n - o) * y, f >= 1 && (s.scrollTop = n), f >= 1) {
        this.surfaceScrollFrames.delete(s);
        return;
      }
      const v = requestAnimationFrame(a);
      this.surfaceScrollFrames.set(s, v);
    }, c = requestAnimationFrame(a);
    this.surfaceScrollFrames.set(s, c);
  }
  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(e, t) {
    const s = this.objects.get(e), i = t ?? (s == null ? void 0 : s.surfaceId);
    return !s || !i ? -1 : [...this.objects.values()].filter((r) => r.surfaceId === i).map((r) => r.id).sort((r, n) => {
      var h, a, c, d;
      const o = (a = (h = this.objects.get(r)) == null ? void 0 : h.element) == null ? void 0 : a.getBoundingClientRect(), l = (d = (c = this.objects.get(n)) == null ? void 0 : c.element) == null ? void 0 : d.getBoundingClientRect();
      return !o || !l ? 0 : o.top - l.top || o.left - l.left;
    }).indexOf(e);
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
  onAction(e) {
    return this.actions.subscribe(e);
  }
  emitAction(e) {
    this.actions.emit(e);
  }
  snapshot() {
    return {
      objects: this.objects.snapshot(),
      surfaces: this.surfaces.snapshot()
    };
  }
  registerBehavior(e) {
    this.behaviors.register(e);
  }
  setMoveDriver(e) {
    this.moveBehavior.setDriver(e);
  }
  bindMoveSession(e, t) {
    this.moveBehavior.bindSession(e, t);
  }
  bindMoveLifecycle(e, t) {
    this.moveBehavior.bindLifecycle(e, t);
  }
  getMoveContext(e) {
    return this.moveBehavior.getContext(e);
  }
  /** 由 Runtime 统一捕获当前移动事务的布局快照。 */
  captureMoveLayout(e) {
    const t = this.sessionCoordinator.get(e), s = t ? this.behaviors.get(t.type) : void 0;
    !(s instanceof L) || !t || s.captureLayout(this.createBehaviorContext(t));
  }
  /** 由 Runtime 统一播放移动事务的布局 FLIP。 */
  playMoveLayout(e, t = !1) {
    const s = this.sessionCoordinator.get(e), i = s ? this.behaviors.get(s.type) : void 0;
    !(i instanceof L) || !s || i.playLayout(this.createBehaviorContext(s), t);
  }
  /** 捕获 Runtime 管理的 Surface / group / collection 布局快照。 */
  captureLayout(e, t = document, s = !0, i) {
    return ce(e, t, s, i);
  }
  /** 按统一时序播放布局快照；列尾追加可选择等待 Vue patch 的下一帧。 */
  scheduleLayout(e, t = !1) {
    t ? le(e) : ue(e);
  }
  /** 统一编排组展开/收起、容器 resize、兄弟 FLIP 与可选 presence。 */
  runGroupToggle(e) {
    return de(e);
  }
  /** 组件卸载/弹窗关闭时取消根节点下尚未完成的布局动画。 */
  cancelLayoutAnimations(e) {
    he(e);
  }
  resolveMoveTarget(e, t, s) {
    var p, f, y, v;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.createBehaviorContext(i), n = this.objects.get(i.objectId), o = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, l = (p = o == null ? void 0 : o.resolveMoveTarget) == null ? void 0 : p.call(o, { objectId: i.objectId, destination: t }), h = (y = (f = r.visual) == null ? void 0 : f.resolveTarget) == null ? void 0 : y.call(f, i.objectId, t), a = s == null ? void 0 : s(), c = (v = this.objects.get(i.objectId)) == null ? void 0 : v.element, d = this.targets.findForSurface(this.getDestinationSurfaceId(t) ?? "", n == null ? void 0 : n.type), g = l ?? h ?? a ?? (d == null ? void 0 : d.element) ?? c ?? null;
    return !g || !g.isConnected ? null : (this.moveBehavior.getContext(e).transaction.target = g, g);
  }
  resolveMoveLandingTarget(e, t, s) {
    var c;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.objects.get(i.objectId), n = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, o = (c = n == null ? void 0 : n.resolveMoveLandingTarget) == null ? void 0 : c.call(n, { objectId: i.objectId, destination: t }), l = (s == null ? void 0 : s()) ?? null, h = this.targets.findForSurface(this.getDestinationSurfaceId(t) ?? "", r == null ? void 0 : r.type), a = o ?? l ?? (h == null ? void 0 : h.element) ?? this.resolveMoveTarget(e, t);
    return !a || !a.isConnected ? null : a;
  }
  /**
   * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
   * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
   * 实现一套跨 Surface 的等待规则。
   */
  async resolveLandingTarget(e, t, s = 6) {
    const i = this.resolveMoveLandingTarget(e, t);
    if (i) {
      const r = i.getBoundingClientRect();
      if (r.width > 0 && r.height > 0)
        return i;
    }
    return this.waitForMoveTarget(e, t, s);
  }
  /**
   * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
   *
   * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
   * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
   * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
   */
  async waitForMoveTarget(e, t, s = 6) {
    var g, p;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.moveBehavior.getContext(e);
    r.sourceElement;
    const n = this.getDestinationSurfaceId(t), o = this.objects.get(i.objectId), l = o ? this.registry.objectTypes.get(o.visual ?? o.type) : void 0, h = !!(l != null && l.resolveMoveLandingTarget), a = r.transaction.destination, c = typeof (a == null ? void 0 : a.fromSurfaceId) == "string" ? a.fromSurfaceId : null, d = !!n && n !== c;
    for (let f = 0; f < s; f += 1) {
      const y = this.sessionCoordinator.get(e);
      if (y !== i || y.state === "disposed" || y.state === "interrupt") return null;
      const v = this.resolveMoveLandingTarget(e, t), m = v == null ? void 0 : v.getBoundingClientRect(), C = !!(m && m.width > 0 && m.height > 0), b = h || !n || (o == null ? void 0 : o.surfaceId) === n, w = h || (n && v ? ((p = (g = this.surfaces.get(n)) == null ? void 0 : g.element) == null ? void 0 : p.contains(v)) ?? !1 : !1);
      if (v && C && b && (h || (d ? w : !0))) return v;
      await new Promise((j) => requestAnimationFrame(() => j()));
    }
    return null;
  }
  getDestinationSurfaceId(e) {
    if (!e || typeof e != "object") return null;
    const t = e;
    return typeof t.toSurfaceId == "string" ? t.toSurfaceId : typeof t.columnId == "string" ? t.columnId : null;
  }
  registerRegrab(e, t) {
    this.moveBehavior.registerRegrab(e, t);
  }
  getRegrab(e) {
    return this.moveBehavior.getRegrab(e);
  }
  regrab(e, t) {
    const s = this.moveBehavior.getRegrab(e);
    return s ? (s(t), !0) : !1;
  }
  clearRegrab(e, t) {
    this.moveBehavior.clearRegrab(e, t);
  }
  /** 将落地代理的 regrab 监听与当前 Session 清理绑定。 */
  bindRegrabTarget(e, t, s, i) {
    const r = this.sessionCoordinator.get(e);
    r && this.inputCoordinator.bindRegrabTarget(r, t, s, i);
  }
  createRegrabContext(e, t, s, i) {
    const r = this.sessionCoordinator.get(e);
    if (!r || r.state !== "landing") return null;
    const n = s.getBoundingClientRect(), o = i.getBoundingClientRect(), l = i.offsetWidth || o.width, h = i.offsetHeight || o.height, a = new DOMRect(n.left, n.top, l, h);
    return {
      sessionId: e,
      objectId: r.objectId,
      event: t,
      proxyElement: s,
      sourceElement: i,
      proxyRect: n,
      regrabRect: a,
      interrupt: (c) => this.interrupt(e, c ?? "regrab")
    };
  }
  /**
   * 统一完成 landing → regrab 的旧 Session 接管。视觉 adapter 只处理
   * source 可见性和监听器，旧 Session、completion gate 与 landing proxy
   * 的失效由 Runtime 保证。
   */
  takeoverRegrab(e) {
    const t = this.sessionCoordinator.get(e);
    return !t || t.state !== "landing" ? !1 : (this.interrupt(e, "regrab"), this.disposeVisualProxy(e), !0);
  }
  /**
   * 绑定 active 阶段的全局 pointer 输入。pointerup 会先立即解绑监听器，再把
   * release 交回 Runtime；cancel/interrupt 时由 Session Cleanup 兜底。
   */
  bindPointerSessionInput(e, t = {}) {
    const s = this.sessionCoordinator.get(e);
    return s ? this.inputCoordinator.bindSession(s, t) : () => {
    };
  }
  /**
   * landing 期间追踪真实目标及其祖先的布局变化，并自动登记到 Session Cleanup。
   */
  trackLandingTarget(e, t, s, i = {}) {
    const r = this.sessionCoordinator.get(e);
    return r ? this.visualState.trackTarget(r.cleanup, t, s, i) : () => {
    };
  }
  start(e) {
    return this.dispatcher.start(e);
  }
  startInternal(e) {
    return this.runtimeMove.start(e, {
      getBehavior: (t) => this.behaviors.get(t),
      createSession: (t, s) => this.startSession(t, s),
      getVisualStrategy: (t) => {
        const s = this.objects.get(t);
        return s ? this.registry.visualStrategies.get(s.type) : void 0;
      },
      bindLifecycle: (t, s) => this.moveBehavior.bindLifecycle(t, s),
      createContext: (t) => this.createBehaviorContext(t),
      isCurrent: (t) => !!this.sessionCoordinator.get(t),
      cancel: (t, s) => this.cancel(t, s),
      interrupt: (t, s) => this.interrupt(t, s)
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
  orchestrateMoveSession(e, t = {}) {
    let s;
    if (t.sessionId) {
      const n = this.sessionCoordinator.get(t.sessionId);
      if (!n) throw new Error(`Session not found: ${t.sessionId}`);
      s = n;
    } else {
      t.driver && this.moveBehavior.setDriver(t.driver);
      const n = this.start(e);
      t.driver && this.moveBehavior.setDriver({}), s = this.sessionCoordinator.get(n.id);
    }
    const i = this.getMoveContext(s.id);
    if (t.followElement !== void 0 && (i.followElement = t.followElement), t.driver && this.bindMoveSession(s.id, t.driver), t.lifecycle ? this.bindMoveLifecycle(s.id, t.lifecycle) : t.visualStrategy && this.bindMoveLifecycle(s.id, t.visualStrategy), t.sessionId && t.prepareExisting) {
      const n = this.behaviors.get(s.type);
      if (n instanceof L)
        try {
          n.prepare(this.createBehaviorContext(s), e), s.state === "prepare" && s.transition("active");
        } catch (o) {
          this.cancel(s.id, o instanceof Error ? o.message : "prepare-failed");
        }
    }
    const r = this.bindPointerSessionInput(s.id, t.pointerInput);
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
  update(e, t) {
    this.dispatcher.update(e, t);
  }
  updateInternal(e, t) {
    this.runtimeMove.update(e, t);
  }
  async release(e, t) {
    return this.dispatcher.release(e, t);
  }
  async releaseInternal(e, t) {
    const s = {
      getSession: (i) => this.sessionCoordinator.get(i),
      getBehavior: (i) => this.behaviors.get(i),
      createContext: (i) => this.createBehaviorContext(i),
      captureLayout: (i) => this.captureMoveLayout(i),
      playLayout: (i, r) => this.playMoveLayout(i, r),
      cancel: (i, r) => this.cancel(i, r),
      end: (i) => this.endSession(i)
    };
    return this.runtimeMove.release(e, t, s);
  }
  cancel(e, t = "cancelled") {
    this.dispatcher.cancel(e, t);
  }
  cancelInternal(e, t = "cancelled") {
    const s = this.sessionCoordinator.get(e);
    if (!s) return;
    const i = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      r,
      t,
      "cancel",
      (n, o, l) => {
        var h;
        n instanceof L && n.cancelLayout(o, l), (h = n == null ? void 0 : n.cancel) == null || h.call(n, o, l);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    );
  }
  interrupt(e, t = "cancel") {
    this.dispatcher.interrupt(e, t);
  }
  interruptInternal(e, t = "cancel") {
    const s = this.sessionCoordinator.get(e);
    if (!s) return;
    const i = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      i,
      r,
      t,
      "interrupt",
      (n, o, l) => {
        var h;
        n instanceof L && n.cancelLayout(o, l), (h = n == null ? void 0 : n.interrupt) == null || h.call(n, o, l);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    );
  }
  startSession(e, t = "") {
    return this.sessionCoordinator.create(e, t, this.owner);
  }
  startGroupSession(e, t, s = {}) {
    const i = new B(e, t, this.owner, s);
    return this.sessionCoordinator.set(i), i;
  }
  getSession(e) {
    return this.sessionCoordinator.get(e);
  }
  takeSurface(e, t) {
    const s = this.sessionCoordinator.get(e);
    return s ? (s.takeSurface(t), this.owner.isOwnedBy(t, e)) : !1;
  }
  /** 获取需要在 landing 前提前释放的对象 Lease（例如 detach 本体）。 */
  acquireObject(e, t) {
    return this.sessionCoordinator.acquireObject(e, t);
  }
  /**
   * 组件因业务重排卸载时延迟注销对象。
   *
   * 跨 Surface 移动会先触发业务状态更新，再触发 landing；Vue 组件可能在
   * landing 解析前卸载。如果对象仍被当前 session 持有，必须把注销推迟到
   * session cleanup，并由 generation 防止新实例接管后被旧实例误删。
   */
  unregisterObjectWhenIdle(e, t) {
    const s = () => this.objects.unregister(e, t);
    this.sessionCoordinator.trackForObject(e, s) || s();
  }
  /** 将 Surface placeholder 的销毁纳入当前移动事务清理。 */
  trackPlaceholder(e, t) {
    this.sessionCoordinator.track(e, t);
  }
  takeSurfaces(e, t) {
    return t.every((s) => this.takeSurface(e, s));
  }
  endSession(e) {
    const t = this.behaviors.get(e.type), s = this.createBehaviorContext(e);
    this.runtimeSession.finalize(
      e,
      t,
      s,
      (i) => this.disposeVisualProxy(i),
      (i, r) => this.disposeBehavior(i, r)
    );
  }
  failCompletionGates(e) {
    this.sessionCoordinator.failGates(e), this.disposeVisualProxy(e);
  }
  disposeBehavior(e, t) {
    var s, i, r, n;
    try {
      e instanceof L && ((r = (i = (s = e.getLifecycle(t.session.id)) == null ? void 0 : s.surface) == null ? void 0 : i.dispose) == null || r.call(i, t)), (n = e == null ? void 0 : e.dispose) == null || n.call(e, t);
    } catch (o) {
      console.error("Behavior dispose failed", o);
    }
  }
  createBehaviorContext(e) {
    const t = this.objects.get(e.objectId);
    return {
      session: e,
      emitAction: (s) => this.actions.emit(s),
      // 行为准备阶段仍使用可解析 DOM 的通用适配器；对象注册的 VisualAdapter
      // 通过 createVisualProxy/生命周期入口逐步接管视觉，不改变现有 demo 的
      // source 解析与拖拽起点。
      visual: t ? this.getVisualAdapter(t.visual ?? t.type) : void 0,
      hit: this.hitResolver
    };
  }
}
const Xe = new Ne();
function _(u) {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  return {
    bindObject(r, n) {
      const o = u.objects.get(r);
      if (o) {
        if (n === null) {
          const l = e.get(r);
          if (l && o.element !== l) return;
          e.delete(r);
        } else
          e.set(r, n);
        u.objects.setElement(r, n);
      }
    },
    bindSurface(r, n) {
      const o = u.surfaces.get(r);
      if (o) {
        if (n === null) {
          const l = t.get(r);
          if (l && o.element !== l) return;
          t.delete(r);
        } else
          t.set(r, n);
        u.surfaces.setElement(r, n);
      }
    },
    bindTarget(r, n, o) {
      const l = s.get(r) ?? n.id ?? `runtime-target:${r}`;
      if (s.set(r, l), !o) {
        const h = i.get(r), a = u.targets.get(l);
        if (h && (a == null ? void 0 : a.element) !== h) return;
        i.delete(r), u.targets.unregister(l), s.delete(r);
        return;
      }
      i.set(r, o), u.targets.register({ ...n, id: l, element: o });
    },
    getSurfaceElement(r) {
      var n;
      return ((n = u.surfaces.get(r)) == null ? void 0 : n.element) ?? null;
    },
    async runLayoutMutation(r) {
      var o;
      const n = r.elements.length > 0 ? u.captureLayout(r.elements, r.root, !0) : null;
      await r.mutate(), await ((o = r.waitForPatch) == null ? void 0 : o.call(r)), n && u.scheduleLayout(n);
    },
    dispose() {
      for (const r of s.values()) u.targets.unregister(r);
      e.clear(), t.clear(), s.clear(), i.clear();
    }
  };
}
function Ye(u) {
  return _(u);
}
function Je(u) {
  return _(u);
}
function z(u, e) {
  const t = u.getBoundingClientRect();
  return e.x >= t.left && e.x <= t.right && e.y >= t.top && e.y <= t.bottom;
}
function Ke(u) {
  return {
    findSurface(e) {
      return Array.from(document.querySelectorAll(u.surfaceSelector)).find((t) => z(t, e)) ?? null;
    },
    findTarget(e, t, s) {
      return Array.from(e.querySelectorAll(u.targetSelector)).filter((i) => i.dataset.card !== s).find((i) => z(i, t)) ?? null;
    },
    findIndex(e, t, s) {
      const i = Array.from(e.querySelectorAll(u.targetSelector)).filter((r) => r.dataset.card !== s);
      for (let r = 0; r < i.length; r += 1) {
        const n = i[r].getBoundingClientRect();
        if (t.y < n.top + n.height / 2) return r;
      }
      return i.length;
    }
  };
}
function Qe(u, e, t, s) {
  const i = u.findSurface({ x: e, y: t });
  if (!i) return null;
  const r = i.dataset.column;
  if (!r) return null;
  const n = u.findIndex(i, { x: e, y: t }, s);
  return { columnId: r, index: n };
}
export {
  E as DEFAULT_RELEASE_PROFILE,
  A as DefaultVisualAdapter,
  re as FOLLOW_PROFILE,
  ne as FOLLOW_ROTATION,
  B as GroupDragSession,
  tt as LANDING_PROFILE,
  Fe as MoveActionCoordinator,
  L as MoveBehavior,
  Be as MoveCommitCoordinator,
  Ve as MoveLandingCoordinator,
  Pe as MoveReleaseCoordinator,
  Se as MoveTransaction,
  ke as MoveUpdateCoordinator,
  ve as ObjectStore,
  Ne as Runtime,
  _e as RuntimeDispatcher,
  qe as RuntimeInputCoordinator,
  V as RuntimeMoveCoordinator,
  Oe as RuntimeRegistry,
  Ee as RuntimeSessionCoordinator,
  q as Session,
  Te as SessionCoordinator,
  ye as SurfaceStore,
  be as TargetStore,
  Ie as VisualAdapters,
  $e as VisualMotionCoordinator,
  He as VisualProxyCoordinator,
  Ge as VisualStateCoordinator,
  st as acquireSourceVisualLease,
  ze as bindPointerSessionInput,
  he as cancelLayoutAnimations,
  it as captureCollectionPresence,
  ce as captureLayoutFlip,
  rt as coastOffset,
  nt as createCardMotionController,
  Z as createDetachMoveFromAdapter,
  Ke as createDomHitResolver,
  Je as createReactRuntimeAdapter,
  xe as createRegisteredHitResolver,
  Ye as createVueRuntimeAdapter,
  Qe as hitWithResolver,
  ot as integrateSpring,
  at as playCollectionPresence,
  ct as playLayoutFlip,
  de as runGroupToggle,
  Xe as runtime,
  ae as setLayoutPresenceEnabled,
  lt as shapeReleaseVelocity,
  De as trackLandingTarget,
  ut as transitionGroupHeight
};
