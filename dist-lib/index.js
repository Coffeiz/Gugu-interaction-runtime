import { c as se, g as Z, p as ie, a as re, u as ne, b as oe, D as q, d as U, r as ae, e as ce, f as le, h as ue, i as de, j as he, k as ge, l as pe, m as fe, n as me, s as K, F as ve, o as ye, q as be, t as Ce, v as Se, w as we, x as je, y as Me, z as Ie } from "./MoveAdapter-Ciw0f0rt.js";
import { L as gt, A as pt, B as ft, C as mt, E as vt, G as yt, H as bt, I as Ct, J as St, K as wt, M as jt, N as Mt, O as It } from "./MoveAdapter-Ciw0f0rt.js";
class _ {
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
class Le {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new _();
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
class Re {
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
const Oe = {
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
let Te = 1;
class ee {
  constructor(e, t, s) {
    this.type = e, this.objectId = t, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new Re(), this.leases = [], this.id = `session-${Te++}`;
  }
  transition(e) {
    if (this.state !== e) {
      if (!Oe[this.state].includes(e))
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
class X extends ee {
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
class xe {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new _(), this.generations = /* @__PURE__ */ new Map();
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
class ke {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new _();
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
class Ae {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new _();
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
class Pe {
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
class Ve {
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
function Ee(u) {
  return !!(u && typeof u.then == "function");
}
class F {
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
      transaction: new Ve(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(e, t)), t;
  }
  driverFor(e) {
    return this.sessionDrivers.get(e) ?? this.driver;
  }
  prepare(e, t) {
    var c, l, a, d, f;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("prepare");
    const i = ((l = (c = e.visual) == null ? void 0 : c.resolveSource) == null ? void 0 : l.call(c, t.objectId)) ?? null;
    s.sourceElement = i, s.transaction.source = i;
    const r = t.input.event instanceof PointerEvent ? t.input.event : null;
    if (i && r) {
      const g = i.getBoundingClientRect();
      s.dragOffset = {
        x: r.clientX - g.left,
        y: r.clientY - g.top
      };
    }
    const n = (d = (a = this.driverFor(e.session.id)).prepare) == null ? void 0 : d.call(a, e, t), o = this.sessionLifecycles.get(e.session.id);
    return n && typeof n.then == "function" ? Promise.resolve(n).then(async () => {
      var g;
      return (g = o == null ? void 0 : o.beginDrag) == null ? void 0 : g.call(o, e);
    }) : (f = o == null ? void 0 : o.beginDrag) == null ? void 0 : f.call(o, e);
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
    return Ee(r) ? r.then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o)) : (r && r.accepted && r.destination !== void 0 && (s.destination = r.destination, s.transaction.destination = r.destination), r);
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
    const i = this.sessionLifecycles.get(e.session.id), r = (o = i == null ? void 0 : i.landing) == null ? void 0 : o.call(i, e, t), n = Promise.resolve(r).then((c) => ((!c || c.completed) && (s.landingCompleted = !0), c));
    return s.landingPromise = n, n;
  }
  reveal(e, t) {
    var i, r;
    const s = this.getContext(e.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (r = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.reveal) == null ? void 0 : r.call(i, e, t);
  }
}
class H {
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
    const t = se(e.beforeContent, e.sourceRect, {
      layout: e.proxyLayout,
      contentScale: e.contentScale
    }), s = Z(t), i = !!((n = e.proxyLayout) != null && n.compact);
    ie(e.sourceElement, s);
    const r = e.visualSnapshot;
    return r && (s.style.setProperty("box-shadow", r.boxShadow, "important"), s.style.borderRadius = r.borderRadius, s.style.backgroundColor = r.background, r.backgroundImage && r.backgroundImage !== "none" && (s.style.backgroundImage = r.backgroundImage), s.style.opacity = r.opacity, re(t).style.transform = `scale(${i ? 1 : 1.03})`), de() && he(s), s.querySelectorAll("[class]").forEach((o) => {
      const c = getComputedStyle(o);
      c.opacity === "0" && c.pointerEvents === "none" && (o.style.opacity = "1");
    }), { element: t };
  }
  updateProxy(e, t) {
    ne(e.element, t.contentScale);
  }
  land(e, t, s) {
    var E, $, N, z, B, D, G, m, j, R, C, O, T;
    const i = e.element, r = "getBoundingClientRect" in t ? t : void 0, n = r ? void 0 : t;
    if (!s.targetRect && !((E = s.targetSnapshot) != null && E.rect) && !n && (!r || !r.isConnected))
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const o = s.targetRect ?? (($ = s.targetSnapshot) == null ? void 0 : $.rect) ?? n ?? r.getBoundingClientRect(), c = {
      left: o.left,
      top: o.top,
      width: o.width,
      height: o.height
    }, l = (L) => {
      var x;
      if (s.landingMode === "free") return L;
      const k = (x = s.landingBounds) == null ? void 0 : x.call(s);
      return k ? ge(L, k) : L;
    }, a = l(c);
    r && !s.preserveTarget && oe(r, s.sessionId), i.style.transition = "none";
    const d = s.landingMode === "target", f = Z(i).dataset.runtimeCompact === "true", g = !!(s.sourceSurfaceId && s.destinationSurfaceId && s.sourceSurfaceId !== s.destinationSurfaceId), h = g && s.disableTargetVisualMorph, p = s.targetSnapshot, b = !!(p && (p.background && p.background !== "transparent" && p.background !== "rgba(0, 0, 0, 0)" || p.backgroundImage && p.backgroundImage !== "none" || p.boxShadow && p.boxShadow !== "none")), v = !h && (d ? !s.disableTargetVisualMorph && b : !!p), y = !h && !s.disableTargetVisualMorph && b && !f, S = p != null && p.boxShadow ? p.boxShadow : void 0, M = g && !d ? "1" : p == null ? void 0 : p.opacity, w = s.landingMode === "free" ? ((N = s.motion) == null ? void 0 : N.freeLanding) ?? ((z = s.motion) == null ? void 0 : z.landing) : s.landingMode === "target" ? ((D = (B = s.motion) == null ? void 0 : B.target) == null ? void 0 : D.landing) ?? ((G = s.motion) == null ? void 0 : G.landing) : (m = s.motion) == null ? void 0 : m.landing, I = s.motionEnabled === !1 || s.releaseMode === "normal";
    !d && I && (i.style.width = `${a.width}px`, i.style.height = `${a.height}px`);
    const A = I ? pe : fe, { finished: P, retarget: V } = A(i, a, {
      duration: (w == null ? void 0 : w.duration) ?? (s.landingMode === "free" ? U.freeLanding.duration : U.landing.duration),
      easing: (w == null ? void 0 : w.easing) ?? (s.landingMode === "free" ? U.freeLanding.easing : U.landing.easing),
      // 面包屑是透明文本节点，只提供位置和消失时机，不能把它的透明表面
      // 样式覆盖到代理卡片；有可见表面的文件夹卡仍完整执行视觉 morph。
      targetShadow: v || h ? S : void 0,
      targetRadius: v ? p == null ? void 0 : p.borderRadius : void 0,
      targetBorder: v ? p == null ? void 0 : p.border : void 0,
      targetBackdropFilter: v ? p == null ? void 0 : p.backdropFilter : void 0,
      targetBackground: v ? p == null ? void 0 : p.background : void 0,
      targetBackgroundImage: v ? p == null ? void 0 : p.backgroundImage : void 0,
      targetOpacity: v ? M : void 0,
      // 透明面包屑/列表行没有可复用的卡片式内容结构，不能参与 content morph——列表行是
      // grid 多列布局，套这套给卡片设计的结构级 morph 会把列挤错位（类型跑到文件名下面）。
      // compact 列表代理与目标卡结构相同，只需要让同一份内容跟随宽度恢复；如果再挂一层
      // 目标 Grid，右侧文件大小会因为 justify-self:end 在 landing 第一帧瞬间回到完整宽度。
      // 只有真正有背景/阴影且不是 compact 列表的目标才复用结构级 content morph。
      targetContent: y ? r : void 0,
      landingMode: s.landingMode,
      targetMotion: d ? (R = (j = s.motion) == null ? void 0 : j.target) == null ? void 0 : R.motion : void 0,
      dismiss: d ? (O = (C = s.motion) == null ? void 0 : C.target) == null ? void 0 : O.dismiss : void 0,
      readTarget: r ? () => l(r.getBoundingClientRect()) : void 0,
      cameraOrigin: s.landingMode === "free" ? s.cameraOrigin : void 0,
      // contentScale 描述的是对象所在画布的视觉缩放，不是 free landing
      // 专属配置。拖出 viewport 后会回到 default landing，但仍必须沿用
      // 松手瞬间的画布比例，否则代理会按 100% 尺寸回飞。
      contentScale: s.contentScale,
      motionState: s.releaseMode === "normal" ? void 0 : s.motionState,
      coast: {
        duration: q.coastSeconds,
        friction: me,
        maxDistance: q.maxCoast,
        minVelocity: q.minVelocity
      },
      releaseDamping: q.dampingRatio
    });
    if (this.runtime && r) {
      const L = (T = s.targetSnapshot) == null ? void 0 : T.rect, k = () => {
        const x = r.getBoundingClientRect();
        return x.width > 0 && x.height > 0 ? l(x) : L && L.width > 0 && L.height > 0 ? l({
          left: L.x,
          top: L.y,
          width: L.width,
          height: L.height
        }) : l(x);
      };
      this.runtime.trackLandingTarget(s.sessionId, r, () => {
        V(k());
      });
    }
    return P.then(() => ({ completed: !0 }));
  }
  reveal(e, t, s) {
    t.style.transition = "", ae(t, s.sessionId);
  }
  dispose(e, t) {
    var i;
    const s = e.element;
    (i = e.dispose) == null || i.call(e), ce(s);
  }
  /** 创建 detach 拖拽 move，从 Runtime 注册表自动获取 surface 信息 */
  createMove(e) {
    const t = this.runtime;
    return !t || !t.objects.hasAbility(e.objectId, "move") ? {} : (e.event.preventDefault(), (e.mode === "clone" ? le : ue)({
      runtime: t,
      objectId: e.objectId,
      element: e.element,
      event: e.event,
      fromRect: e.fromRect,
      returnRect: e.returnRect
    }));
  }
}
class Fe {
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
function Y(u, e) {
  return e.x >= u.left && e.x <= u.right && e.y >= u.top && e.y <= u.bottom;
}
function Be(u, e, t, s) {
  const i = u.get(s), r = () => e.snapshot().filter((n) => {
    var o;
    return (o = n.element) == null ? void 0 : o.isConnected;
  }).filter((n) => i ? e.accepts(n.id, i.type) : !1);
  return {
    findSurface(n) {
      var l;
      const o = t.snapshot().filter((a) => {
        var d;
        return (d = a.element) == null ? void 0 : d.isConnected;
      }).filter((a) => a.accepts.length === 0 || a.accepts.includes((i == null ? void 0 : i.type) ?? "")).filter((a) => Y(a.element.getBoundingClientRect(), n)).sort((a, d) => (d.priority ?? 0) - (a.priority ?? 0)).map((a) => e.get(a.surfaceId)).find((a) => !!(a && e.accepts(a.id, (i == null ? void 0 : i.type) ?? "")));
      return o || (((l = r().map((a) => ({
        surface: a,
        rect: a.element.getBoundingClientRect()
      })).filter(({ rect: a }) => Y(a, n)).sort((a, d) => a.rect.width * a.rect.height - d.rect.width * d.rect.height)[0]) == null ? void 0 : l.surface) ?? null);
    },
    findTarget(n, o, c) {
      var d;
      const l = (d = u.get(s)) == null ? void 0 : d.type, a = t.snapshot().filter((f) => f.surfaceId === n.id && f.id !== `object-target:${c}`).filter((f) => f.accepts.length === 0 || f.accepts.includes(l ?? "")).filter((f) => {
        var g;
        return (g = f.element) == null ? void 0 : g.isConnected;
      }).sort((f, g) => (g.priority ?? 0) - (f.priority ?? 0)).find((f) => Y(f.element.getBoundingClientRect(), o));
      return a != null && a.element ? a.element : [...u.values()].filter((f) => f.id !== c && f.surfaceId === n.id).map((f) => f.element).filter((f) => !!(f != null && f.isConnected)).find((f) => Y(f.getBoundingClientRect(), o)) ?? null;
    },
    findIndex(n, o, c) {
      const l = [...u.values()].filter((a) => a.id !== c && a.surfaceId === n.id).map((a) => a.element).filter((a) => !!(a != null && a.isConnected)).map((a) => ({ element: a, rect: a.getBoundingClientRect() })).sort((a, d) => a.rect.top - d.rect.top || a.rect.left - d.rect.left);
      for (let a = 0; a < l.length; a += 1) {
        const { rect: d } = l[a];
        if (o.y < d.top + d.height / 2) return a;
      }
      return l.length;
    }
  };
}
class De {
  constructor() {
    this.visuals = new Fe(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
class Ge {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(e, t, s) {
    const i = new ee(e, t, s);
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
class $e {
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
  terminate(e, t, s, i, r, n, o, c) {
    try {
      n(t, s, i);
    } catch (l) {
      console.error(`Behavior ${r} failed`, l);
    } finally {
      try {
        o(e), r === "cancel" ? this.sessions.cancel(e.id) : this.sessions.interrupt(e.id, i === "regrab" ? "regrab" : "cancel");
      } finally {
        c(t, s);
      }
    }
  }
}
function Ne(u) {
  return !!(u && typeof u.then == "function");
}
class J {
  constructor(e, t, s, i) {
    this.updateCoordinator = e, this.releaseCoordinator = t, this.commitCoordinator = s, this.landingCoordinator = i;
  }
  static fromPorts(e, t, s) {
    return new J(
      new ze(e),
      new qe(),
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
    var l;
    const i = s.getSession(e), r = this.prepareRelease(i, t);
    if (r.kind === "ignore") return Promise.resolve();
    if (r.kind === "cancel")
      return i && s.cancel(i.id, r.reason), Promise.resolve();
    const n = r.session, o = s.getBehavior(n.type);
    o instanceof F && s.captureLayout(n.id);
    let c;
    try {
      c = (l = o == null ? void 0 : o.release) == null ? void 0 : l.call(o, s.createContext(n), t);
    } catch (a) {
      return s.cancel(n.id, a instanceof Error ? a.message : "release-failed"), Promise.resolve();
    }
    return Ne(c) ? Promise.resolve(c).then((a) => this.finishRelease(n, o, a, s), (a) => {
      s.cancel(n.id, a instanceof Error ? a.message : "release-failed");
    }) : this.finishRelease(n, o, c, s);
  }
  async finishRelease(e, t, s, i) {
    if (i.getSession(e.id) !== e) return;
    const r = s;
    if ((r == null ? void 0 : r.accepted) === !1) {
      i.cancel(e.id, "no-valid-drop");
      return;
    }
    if (e.state === "release" && e.transition("landing"), !(t instanceof F)) {
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
      const c = (o = s.prepare) == null ? void 0 : o.call(s, n, e);
      c && typeof c.then == "function" && c.catch((l) => {
        t.isCurrent(i.id) && t.cancel(i.id, l instanceof Error ? l.message : "prepare-failed");
      });
    } catch (c) {
      t.cancel(i.id, c instanceof Error ? c.message : "prepare-failed");
    }
    return t.isCurrent(i.id) && i.state === "prepare" && i.transition("active"), {
      id: i.id,
      get state() {
        return i.state;
      },
      cancel: (c) => t.cancel(i.id, c ?? "cancelled"),
      interrupt: (c) => t.interrupt(i.id, c ?? "interrupted")
    };
  }
}
class ze {
  constructor(e) {
    this.port = e;
  }
  update(e, t) {
    var i, r;
    const s = this.port.getSession(e);
    !s || s.state !== "active" || (r = (i = this.port.getBehavior(s.type)) == null ? void 0 : i.update) == null || r.call(i, this.port.createContext(e), t);
  }
}
class qe {
  prepare(e, t) {
    return e ? t.kind === "pointercancel" || t.kind === "blur" || t.kind === "lostpointercapture" ? { kind: "cancel", reason: t.kind } : e.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (e.state === "active" && e.transition("release"), e.state === "release" ? { kind: "continue", session: e } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class He {
  constructor(e, t) {
    this.port = e, this.actions = t;
  }
  resolveIsAppend(e, t) {
    var r, n, o, c, l, a;
    if (!t) return !1;
    const s = (n = (r = this.port).getObjectIndex) == null ? void 0 : n.call(r, e, t.toSurfaceId), i = (c = (o = this.port).getSurfaceObjectCount) == null ? void 0 : c.call(o, t.toSurfaceId);
    return (a = (l = this.port).hasLayoutAnchor) != null && a.call(l, t.toSurfaceId) ? !1 : s !== void 0 && s >= 0 && i !== void 0 ? s >= i - 1 : t.toIndex !== void 0 && i !== void 0 && t.toIndex >= i - 1;
  }
  async commit(e, t, s, i = !0) {
    var l, a, d, f;
    const r = this.port.createContext(e);
    if (await t.commit(r, s), !i) {
      const g = this.port.normalize(e.objectId, s);
      g && (t.getContext(e.id).transaction.destination = g), this.resolveIsAppend(e.objectId, g) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
      return;
    }
    const n = this.port.getLifecycle(e.id), o = this.port.normalize(e.objectId, s);
    o && await ((a = (l = n == null ? void 0 : n.surface) == null ? void 0 : l.leave) == null ? void 0 : a.call(l, r, o.fromSurfaceId)), await this.actions.emit(e.objectId, t.getContext(e.id).destination, t.getContext(e.id).transaction), o && await ((f = (d = n == null ? void 0 : n.surface) == null ? void 0 : d.enter) == null ? void 0 : f.call(d, r, o.toSurfaceId)), this.resolveIsAppend(e.objectId, o) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
  }
}
class _e {
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
class We {
  constructor(e) {
    this.port = e;
  }
  normalize(e, t) {
    if (this.isDestination(t)) return t;
    if (!t || typeof t != "object") return null;
    const s = t;
    if (typeof s.columnId != "string") return null;
    const i = this.port.getObjectSurface(e);
    if (!i) return null;
    const r = s.point, n = s.releaseVelocity;
    return {
      fromSurfaceId: i,
      toSurfaceId: s.columnId,
      ...typeof s.index == "number" ? { toIndex: s.index } : {},
      ...r && typeof r.x == "number" && typeof r.y == "number" ? { point: { x: r.x, y: r.y } } : {},
      ...n && typeof n.x == "number" && typeof n.y == "number" ? { releaseVelocity: { x: n.x, y: n.y } } : {}
    };
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
      ...i.point === void 0 ? {} : { point: i.point },
      ...i.releaseVelocity === void 0 ? {} : { releaseVelocity: i.releaseVelocity },
      timestamp: Date.now()
    }) : await this.port.emit({
      type: "move",
      objectId: e,
      fromSurfaceId: i.fromSurfaceId,
      toSurfaceId: i.toSurfaceId,
      ...i.toIndex === void 0 ? {} : { toIndex: i.toIndex },
      ...i.point === void 0 ? {} : { point: i.point },
      ...i.releaseVelocity === void 0 ? {} : { releaseVelocity: i.releaseVelocity },
      timestamp: Date.now()
    }), !0;
  }
  isDestination(e) {
    if (!e || typeof e != "object") return !1;
    const t = e;
    return typeof t.fromSurfaceId == "string" && typeof t.toSurfaceId == "string";
  }
}
function Ue(u) {
  let e = null, t = null, s = !1;
  const i = Math.max(0, u.stableFrameLimit ?? 2), r = Math.max(1, u.idlePollInterval ?? 4);
  let n = 0, o = 0, c = null;
  const l = () => {
    s || (s = !0, t !== null && cancelAnimationFrame(t), t = null, e == null || e.disconnect(), e = null);
  };
  if (typeof ResizeObserver > "u") return l;
  const a = () => {
    if (s || !u.target.isConnected) return;
    const f = u.target.getBoundingClientRect();
    c = f, n = 0, o = 0, u.retarget(f);
  };
  if (e = new ResizeObserver(a), e.observe(u.target), u.observeAncestors !== !1) {
    const f = typeof document < "u" ? document.body : null, g = u.stopAt === void 0 ? f : u.stopAt;
    let h = u.target.parentElement;
    for (; h && h !== g; )
      e.observe(h), h = h.parentElement;
  }
  const d = () => {
    if (s || (t = requestAnimationFrame(d), !u.target.isConnected) || (o += 1, n >= i && o % r !== 0)) return;
    const f = u.target.getBoundingClientRect();
    if (c && Math.abs(f.left - c.left) < 0.5 && Math.abs(f.top - c.top) < 0.5 && Math.abs(f.width - c.width) < 0.5 && Math.abs(f.height - c.height) < 0.5) {
      n += 1;
      return;
    }
    n = 0, c = f, u.retarget(f);
  };
  return t = requestAnimationFrame(d), u.cleanup.track(l), l;
}
class Xe {
  constructor(e) {
    this.port = e;
  }
  resolveTarget(e, t) {
    var i, r;
    const s = ((r = (i = this.port.getAdapter(e)).resolveTarget) == null ? void 0 : r.call(i, e, t)) ?? new H().resolveTarget(e);
    return s != null && s.isConnected ? s : null;
  }
  apply(e, t, s) {
    (this.port.getAdapter(e).applyState ?? new H().applyState)(t, s);
  }
  capture(e, t) {
    return (this.port.getAdapter(e).captureVisualState ?? new H().captureVisualState)(t);
  }
  trackTarget(e, t, s, i = {}) {
    return Ue({ ...i, cleanup: e, target: t, retarget: s });
  }
}
class Ye {
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
class Ze {
  constructor(e, t) {
    this.port = e, this.proxies = t;
  }
  getAdapter(e, t) {
    var s, i;
    return t != null && t.group ? ((i = (s = this.port).getGroupAdapter) == null ? void 0 : i.call(s, e.objectId)) ?? this.port.getAdapter(e.objectId) : this.port.getAdapter(e.objectId);
  }
  create(e, t) {
    var r, n;
    const s = this.port.getSession(e);
    if (!s) return;
    const i = (n = (r = this.getAdapter(s, t)).createProxy) == null ? void 0 : n.call(r, t);
    if (i)
      return this.proxies.register(e, i), i;
  }
  async land(e, t, s) {
    var c, l;
    const i = this.port.getSession(e), r = this.proxies.get(e);
    if (!i || !r) return { completed: !1, reason: "visual-proxy-missing" };
    const n = s ?? this.port.createContext(e, void 0, t), o = await ((l = (c = this.getAdapter(i, n)).land) == null ? void 0 : l.call(c, r, t, n));
    return o || { completed: !0 };
  }
  update(e, t) {
    var n, o;
    const s = this.port.getSession(e), i = this.proxies.get(e);
    if (!s || !i) return;
    const r = t ?? this.port.createContext(e);
    (o = (n = this.getAdapter(s, r)).updateProxy) == null || o.call(n, i, r);
  }
  async reveal(e, t, s) {
    var o, c;
    const i = this.port.getSession(e), r = this.proxies.get(e);
    if (!i || !r) return;
    const n = s ?? this.port.createContext(e, void 0, t);
    await ((c = (o = this.getAdapter(i, n)).reveal) == null ? void 0 : c.call(o, r, t, n));
  }
}
function Je(u, e, t = {}) {
  const s = t.target ?? window, i = t.captureTarget;
  let r = !1, n = null, o = null;
  const c = (h) => {
    n = h, o === null && (o = s.requestAnimationFrame(() => {
      o = null;
      const p = n;
      n = null, !(r || !p) && u.update(e.id, { kind: "pointermove", event: p });
    }));
  }, l = (h) => {
    g(), u.release(e.id, { kind: "pointerup", event: h });
  }, a = (h) => {
    g(), u.release(e.id, { kind: "pointercancel", event: h });
  }, d = () => {
    g(), u.release(e.id, { kind: "blur" });
  }, f = (h) => {
    g(), u.release(e.id, { kind: "lostpointercapture", event: h });
  };
  function g() {
    r || (r = !0, n = null, o !== null && (s.cancelAnimationFrame(o), o = null), s.removeEventListener("pointermove", c), s.removeEventListener("pointerup", l), s.removeEventListener("pointercancel", a), s.removeEventListener("blur", d), i == null || i.removeEventListener("lostpointercapture", f));
  }
  return s.addEventListener("pointermove", c), s.addEventListener("pointerup", l), s.addEventListener("pointercancel", a), s.addEventListener("blur", d), i == null || i.addEventListener("lostpointercapture", f), e.cleanup.track(g), g;
}
class Ke {
  constructor(e) {
    this.port = e, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(e, t, s = {}) {
    var c, l;
    (c = this.disposers.get(e)) == null || c(), (l = this.bindings.get(t)) == null || l();
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
      const d = a.clientX, f = a.clientY, g = (p) => {
        if (!(p instanceof PointerEvent)) return;
        const b = Math.max(0, s.dragThreshold ?? 5);
        Math.hypot(p.clientX - d, p.clientY - f) < b || (r(), p.preventDefault(), this.port.startObjectPointer(e, t, a));
      }, h = () => r();
      i = { down: a, move: g, up: h }, window.addEventListener("pointermove", g), window.addEventListener("pointerup", h), window.addEventListener("pointercancel", h);
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
    return Je({
      update: (s, i) => this.port.update(s, i),
      release: (s, i) => this.port.release(s, i)
    }, e, t);
  }
}
class Qe {
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
const W = {
  maxModifiers: 2,
  foldDuration: 300,
  modifierFadeDuration: 180,
  spread: [
    { x: 50, y: -20, rotate: 20, scale: 1 },
    { x: 90, y: -38, rotate: 34, scale: 1 }
  ],
  tight: [
    { x: 7, y: 6, rotate: 4, scale: 0.97 },
    { x: 13, y: 12, rotate: 8, scale: 0.94 }
  ]
};
function et(u) {
  return {
    maxModifiers: Math.max(0, (u == null ? void 0 : u.maxModifiers) ?? W.maxModifiers),
    foldDuration: Math.max(0, (u == null ? void 0 : u.foldDuration) ?? W.foldDuration),
    modifierFadeDuration: Math.max(0, (u == null ? void 0 : u.modifierFadeDuration) ?? W.modifierFadeDuration),
    spread: (u == null ? void 0 : u.spread) ?? W.spread,
    tight: (u == null ? void 0 : u.tight) ?? W.tight
  };
}
function tt(u, e) {
  e && (u.dataset.runtimeProxyContent = "true", u.dataset.runtimeCompact = "true", u.style.boxSizing = "border-box", u.style.left = e.left ?? "50%", u.style.width = e.width, e.gridTemplateColumns && (u.style.gridTemplateColumns = e.gridTemplateColumns));
}
function st(u, e = new H(u)) {
  var i, r, n, o;
  const t = /* @__PURE__ */ new WeakMap();
  function s(c, l) {
    var B, D, G;
    const a = l.group;
    if (!a || a.primaryObjectId !== l.objectId || t.has(c.element)) return;
    const d = Z(c.element), f = c.element.querySelector('[data-runtime-proxy-scale-shell="true"]') ?? c.element;
    if (f.style.overflow = "visible", d.style.zIndex = "2", !(l.sourceRect ?? ((B = l.sourceElement) == null ? void 0 : B.getBoundingClientRect()))) return;
    const h = et(l.groupDrag), p = (D = l.proxyLayout) == null ? void 0 : D.compact, b = [], v = [], y = [], S = a.objectIds.map((m) => {
      var j;
      return (j = u.objects.get(m)) == null ? void 0 : j.element;
    }).filter((m) => !!(m != null && m.isConnected));
    for (const m of S)
      b.push({
        element: m,
        cssText: m.style.cssText,
        marker: m.dataset.runtimeGroupGhost,
        opacity: getComputedStyle(m).opacity
      }), m.dataset.runtimeGroupGhost = "true", m.style.visibility = "visible", m.style.opacity = "0.35", m.style.pointerEvents = "none", m.style.transition = "none";
    const M = h.spread.map((m, j) => ({ spread: m, tight: h.tight[j] })).filter((m) => !!m.tight), w = a.objectIds.filter((m) => m !== a.primaryObjectId).slice(0, Math.min(h.maxModifiers, M.length));
    for (const [m, j] of w.entries()) {
      const R = (G = u.objects.get(j)) == null ? void 0 : G.element;
      if (!R || !R.isConnected) continue;
      const C = R.getBoundingClientRect(), O = M[m];
      if (!O) continue;
      const T = R.cloneNode(!0);
      Object.assign(T.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: `${C.width}px`,
        height: `${C.height}px`,
        margin: "0",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: String(1 - m),
        opacity: "1",
        willChange: "transform, opacity",
        backdropFilter: m === 0 ? "blur(6px) saturate(1.15)" : "none",
        WebkitBackdropFilter: m === 0 ? "blur(6px) saturate(1.15)" : "none",
        transform: `${(p == null ? void 0 : p.transform) ?? (p ? "translateX(-50%)" : "")}${p ? " " : ""}translate3d(${O.spread.x}px, ${O.spread.y}px, 0) rotateZ(${O.spread.rotate}deg) scale(${O.spread.scale})`,
        transformOrigin: "center center"
      }), tt(T, p), T.dataset.runtimeGroupModifier = "true", delete T.dataset.runtimeGroupGhost, f.insertBefore(T, d), y.push(T), v.push({ element: T, spread: O.spread, tight: O.tight });
    }
    let I = null;
    const A = performance.now(), P = (m) => {
      const j = Math.min(1, (m - A) / h.foldDuration), R = 1 - Math.pow(1 - j, 2);
      for (const C of v) {
        const O = C.spread.x + (C.tight.x - C.spread.x) * R, T = C.spread.y + (C.tight.y - C.spread.y) * R, L = C.spread.rotate + (C.tight.rotate - C.spread.rotate) * R, k = C.spread.scale + (C.tight.scale - C.spread.scale) * R, x = p ? p.transform ?? "translateX(-50%)" : "";
        C.element.style.transform = `${x} translate3d(${O.toFixed(2)}px, ${T.toFixed(2)}px, 0) rotateZ(${L.toFixed(2)}deg) scale(${k.toFixed(4)})`;
      }
      j < 1 ? I = requestAnimationFrame(P) : I = null;
    };
    v.length && (I = requestAnimationFrame(P));
    let V = !1, E = null;
    const $ = () => {
      if (!V) {
        V = !0, I !== null && (cancelAnimationFrame(I), I = null);
        for (const m of y)
          m.style.transition = `opacity ${h.modifierFadeDuration}ms ease`, m.style.opacity = "0";
        E = window.setTimeout(() => {
          for (const m of y) m.remove();
          E = null;
        }, h.modifierFadeDuration + 20);
      }
    }, N = (m) => {
      for (const j of b)
        j.element.isConnected && (j.element.style.transition = `opacity ${m}ms cubic-bezier(.22,1,.36,1)`, j.element.style.opacity = j.opacity);
    }, z = () => {
      I !== null && cancelAnimationFrame(I), E !== null && window.clearTimeout(E);
      for (const m of y) m.remove();
      for (const m of b)
        m.element.isConnected && (m.element.style.cssText = m.cssText, m.marker === void 0 ? delete m.element.dataset.runtimeGroupGhost : m.element.dataset.runtimeGroupGhost = m.marker);
    };
    t.set(c.element, { modifiers: y, dismissModifiers: $, restoreGhosts: N, cleanup: z });
  }
  return {
    resolveSource: (i = e.resolveSource) == null ? void 0 : i.bind(e),
    resolveTarget: (r = e.resolveTarget) == null ? void 0 : r.bind(e),
    captureVisualState: (n = e.captureVisualState) == null ? void 0 : n.bind(e),
    applyState: (o = e.applyState) == null ? void 0 : o.bind(e),
    createProxy(c) {
      var a;
      const l = (a = e.createProxy) == null ? void 0 : a.call(e, c);
      if (!l) throw new Error("group visual requires a base proxy");
      return s(l, c), l;
    },
    updateProxy(c, l) {
      var a;
      (a = e.updateProxy) == null || a.call(e, c, l), s(c, l);
    },
    land: (c, l, a) => {
      var f, g, h, p, b;
      const d = t.get(c.element);
      if (!a.group || !d) return (f = e.land) == null ? void 0 : f.call(e, c, l, a);
      if (d.dismissModifiers(), a.landingMode !== "target") {
        const v = ((h = (g = a.motion) == null ? void 0 : g.landing) == null ? void 0 : h.duration) ?? 420;
        d.restoreGhosts(v);
        const y = !!(a.sourceSurfaceId && a.destinationSurfaceId && a.sourceSurfaceId !== a.destinationSurfaceId), S = a.targetSnapshot ? y ? a.targetSnapshot : { ...a.targetSnapshot, opacity: "0" } : void 0;
        return (p = e.land) == null ? void 0 : p.call(e, c, l, { ...a, targetSnapshot: S });
      }
      return (b = e.land) == null ? void 0 : b.call(e, c, l, a);
    },
    reveal: (c, l, a) => {
      var d;
      return (d = e.reveal) == null ? void 0 : d.call(e, c, l, a);
    },
    dispose: (c, l) => {
      var a, d;
      (a = t.get(c.element)) == null || a.cleanup(), t.delete(c.element), (d = e.dispose) == null || d.call(e, c, l);
    }
  };
}
function it(u, e = {}) {
  const t = e.edgeSize ?? 48, s = e.maxSpeed ?? 16;
  let i = null, r = null, n = null, o = !1, c = null, l = 0, a = null, d = null, f = null;
  const g = () => {
    if (!i || !i.isConnected) {
      c = null;
      return;
    }
    c = i.getBoundingClientRect(), l = 0;
  }, h = (y) => {
    if (a !== y) {
      if (d == null || d.disconnect(), a = y, !y || typeof ResizeObserver > "u") {
        d = null;
        return;
      }
      d = new ResizeObserver(g), d.observe(y);
    }
  }, p = (y, S) => {
    const M = (t - y) / t;
    return Math.ceil(s * M * (S * 60));
  }, b = (y) => {
    var A, P;
    if (o) return;
    n = requestAnimationFrame(b);
    const S = Math.min(0.05, Math.max(0, (y - (f ?? y)) / 1e3));
    if (f = y, !i || !r || !i.isConnected) return;
    (!c || l++ >= 8) && g();
    const M = c;
    if (!M || r.x < M.left || r.x > M.right) return;
    const w = r.y - M.top, I = M.bottom - r.y;
    if (w < t) {
      const V = i.scrollTop;
      i.scrollTop -= p(w, S), i.scrollTop !== V && ((A = e.onScroll) == null || A.call(e, r));
    } else if (I < t) {
      const V = i.scrollTop;
      i.scrollTop += p(I, S), i.scrollTop !== V && ((P = e.onScroll) == null || P.call(e, r));
    }
  }, v = () => {
    o || (o = !0, n !== null && cancelAnimationFrame(n), n = null, d == null || d.disconnect(), d = null, a = null, c = null);
  };
  return n = requestAnimationFrame(b), u.track(v), {
    update(y, S) {
      o || (i !== y && (c = null, l = 0, h(y)), i = y, r = S, c === null && g());
    },
    stop: v
  };
}
class rt {
  constructor() {
    this.owner = new Le(), this.objects = new xe(), this.surfaces = new ke(), this.targets = new Ae(), this.behaviors = new Pe(), this.registry = new De(), this.hitResolver = null, this.sessionCoordinator = new Ge(), this.runtimeSession = new $e(this.sessionCoordinator), this.events = new _(), this.actions = new _(), this.visualProxyCoordinator = new Ye(), this.groupVisualAdapters = /* @__PURE__ */ new Map(), this.surfaceScrollFrames = /* @__PURE__ */ new WeakMap(), this.activeNodeConnection = null, this.nodeConnections = /* @__PURE__ */ new Set(), this.moveVisualFrames = /* @__PURE__ */ new Map(), this.moveVisualPhases = /* @__PURE__ */ new Map(), this.moveContentScales = /* @__PURE__ */ new Map(), this.defaultVisualAdapter = new H(this), this.moveBehavior = new F(), this.inputCoordinator = new Ke({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (e, t, s) => this.startObjectPointer(e, t, s),
      registerRegrab: (e, t) => this.registerRegrab(e, t),
      regrab: (e, t) => this.regrab(e, t),
      update: (e, t) => this.update(e, t),
      release: (e, t) => this.release(e, t)
    }), this.moveActions = new We({
      getObjectSurface: (e) => {
        var t;
        return (t = this.objects.get(e)) == null ? void 0 : t.surfaceId;
      },
      getGroup: (e) => {
        const t = this.sessionCoordinator.snapshot().find((s) => s.hasObject(e));
        if (t instanceof X)
          return { primaryObjectId: t.primaryObjectId, objectIds: t.objectIds };
      },
      emit: (e) => this.actions.emitAsync(e)
    }), this.moveCommit = new He({
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
    }, this.moveActions), this.moveLanding = new _e({
      createContext: (e) => this.createBehaviorContext(e),
      getSession: (e) => this.sessionCoordinator.get(e),
      cancel: (e, t) => this.cancel(e, t),
      end: (e) => this.endSession(e)
    }), this.runtimeMove = J.fromPorts({
      getSession: (e) => this.sessionCoordinator.get(e),
      getBehavior: (e) => this.behaviors.get(e),
      createContext: (e) => this.createBehaviorContext(this.sessionCoordinator.get(e))
    }, this.moveCommit, this.moveLanding), this.visualState = new Xe({ getAdapter: (e) => this.getObjectVisualAdapter(e) }), this.visualMotion = new Ze({
      getSession: (e) => this.sessionCoordinator.get(e),
      getAdapter: (e) => this.getObjectVisualAdapter(e),
      getGroupAdapter: (e) => this.getObjectGroupVisualAdapter(e),
      createContext: (e, t, s) => this.createVisualLifecycleContext(e, t, s)
    }, this.visualProxyCoordinator), this.dispatcher = new Qe({
      start: (e) => this.startInternal(e),
      update: (e, t) => this.updateInternal(e, t),
      release: (e, t) => this.releaseInternal(e, t),
      cancel: (e, t) => this.cancelInternal(e, t),
      interrupt: (e, t) => this.interruptInternal(e, t)
    }), this.behaviors.register(this.moveBehavior), K(this.registry.motionProfile), this.objects.subscribe((e) => {
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
    this.registry.registerObjectType(e, t), this.groupVisualAdapters.delete(e);
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
    r && this.registry.setMotionProfile(r), s && (this.registry.setMotionController(s), s.follow && Object.assign(ve.position, s.follow), s.rotation && Object.assign(ye, s.rotation), s.release && Object.assign(q, s.release)), K(this.registry.motionProfile);
  }
  /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
  configureVisual(e) {
    e.dragGlass !== void 0 && be(e.dragGlass), e.layoutPresence !== void 0 && Ce(e.layoutPresence);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  /**
   * 返回对象释放时使用的速度档案。
   * free landing 可以按对象类型覆写速度倍率和上限；其它落地模式始终使用
   * 全局档案，避免列表/网格卡片被画布调参影响。
   */
  getObjectReleaseMotionProfile(e, t) {
    var o, c, l, a, d, f;
    const s = this.objects.get(e), i = s ? this.registry.objectTypes.get(s.visual ?? s.type) : void 0, r = this.getDestinationSurfaceId(t) ?? (s == null ? void 0 : s.surfaceId), n = r && ((o = this.surfaces.get(r)) == null ? void 0 : o.layout) === "free" ? ((a = (l = (c = i == null ? void 0 : i.motion) == null ? void 0 : c.profile) == null ? void 0 : l.freeLanding) == null ? void 0 : a.release) ?? ((f = (d = this.registry.motionProfile) == null ? void 0 : d.freeLanding) == null ? void 0 : f.release) : void 0;
    return n ? { ...q, ...n } : q;
  }
  getSurfaceCameraScale(e) {
    var s;
    const t = e ? (s = this.surfaces.get(e)) == null ? void 0 : s.camera : void 0;
    return t == null ? void 0 : t.scale;
  }
  /** Surface 可选择让抓取代理从 1x 平滑过渡到当前相机倍率。 */
  getSurfaceCameraPickupScale(e, t) {
    var c;
    if (t) {
      const l = this.moveContentScales.get(t);
      if (l !== void 0) return l;
    }
    const s = e ? (c = this.surfaces.get(e)) == null ? void 0 : c.camera : void 0;
    if (!s) return;
    const i = s.pickupDuration;
    if (!i || i <= 0)
      return s.scale;
    const r = performance.now(), n = () => {
      const l = typeof s.scale == "function" ? s.scale() : s.scale;
      return typeof l == "number" && Number.isFinite(l) && l > 0 ? l : 1;
    }, o = () => {
      const a = 1 - (1 - Math.min(1, Math.max(0, (performance.now() - r) / i))) ** 3;
      return 1 + (n() - 1) * a;
    };
    return t && this.moveContentScales.set(t, o), o;
  }
  getSessionContentScale(e, t) {
    return this.moveContentScales.get(e) ?? this.getSurfaceCameraScale(t);
  }
  clearSessionContentScale(e) {
    this.moveContentScales.delete(e);
  }
  getSurfaceCameraOrigin(e) {
    var t, s;
    return e ? (s = (t = this.surfaces.get(e)) == null ? void 0 : t.camera) == null ? void 0 : s.origin : void 0;
  }
  /**
   * 返回与矩形相交的已注册对象。
   * Runtime 只负责对象命中计算，选择状态仍由业务保存；代理节点、断开节点和
   * 不可见节点不会进入结果，避免框选把落地代理或隐藏列表项带进来。
   */
  getObjectsInRect(e, t) {
    return [...this.objects.values()].filter((s) => s.surfaceId === e).filter((s) => {
      const i = s.element;
      if (!(i != null && i.isConnected) || i.dataset.runtimeProxy === "true") return !1;
      const r = i.getBoundingClientRect();
      return r.width <= 0 || r.height <= 0 ? !1 : r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
    }).map((s) => s.id);
  }
  startObjectPointer(e, t, s, i, r) {
    if (this.getRegrab(e))
      return this.startObjectPointerInSession(e, t, s, i, r);
    const n = this.objects.get(e);
    if (n != null && n.selected) {
      const o = [...this.objects.values()].filter((c) => {
        var l;
        return c.selected && c.surfaceId === n.surfaceId && ((l = c.element) == null ? void 0 : l.isConnected) && c.abilities.includes("move");
      }).map((c) => c.id);
      if (o.length > 1)
        return this.startGroupObjectPointer(o, e, t, s, i, r);
    }
    return this.startObjectPointerInSession(e, t, s, i, r);
  }
  /**
   * 以一个主卡启动多对象移动。主卡仍复用单卡 MoveBehavior，GroupDragSession
   * 负责其余对象的 ownership 和批量 Action；视觉适配器可以据 objectIds 创建
   * 主代理及修饰代理。
   */
  startGroupObjectPointer(e, t, s, i, r, n) {
    var f;
    const o = [...new Set(e)];
    if (o.length < 2 || !o.includes(t)) return !1;
    const c = s.getBoundingClientRect(), l = /* @__PURE__ */ new Map();
    for (const g of o) {
      const h = (f = this.objects.get(g)) == null ? void 0 : f.element;
      if (!h) continue;
      const p = h.getBoundingClientRect();
      l.set(g, { x: p.left - c.left, y: p.top - c.top });
    }
    const a = this.startGroupSession(o, t, { offsets: l });
    a.takeObjects();
    const d = this.startObjectPointerInSession(t, s, i, r, n, a.id);
    return d || a.cancel(), d;
  }
  startObjectPointerInSession(e, t, s, i, r, n) {
    var h;
    const o = this.getRegrab(e);
    if (o)
      return o(s), !0;
    const c = this.objects.get(e);
    if (!c) return !1;
    const l = this.registry.objectTypes.get(c.visual ?? c.type);
    if (!l) return !1;
    c.element !== t && this.objects.setElement(e, t);
    const a = {
      objectId: e,
      element: t,
      event: s,
      mode: c.visualMode ?? l.defaultVisualMode,
      fromRect: i,
      returnRect: r
    }, g = ((h = l.visual) == null ? void 0 : h.createMove) ?? l.createMove ?? (() => this.defaultVisualAdapter.createMove(a));
    if (g) {
      const p = g(a);
      return !p.driver && !p.lifecycle || this.orchestrateMoveSession(
        p.request ?? {
          type: "move",
          objectId: e,
          input: { kind: "pointerdown", event: s }
        },
        {
          driver: p.driver,
          lifecycle: p.lifecycle,
          pointerInput: p.pointerInput,
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
  /** 按对象类型读取运动策略；未显式关闭（`motion.enabled !== false`）时默认使用 MotionController。 */
  getObjectMotionEnabled(e) {
    var i;
    const t = this.objects.get(e), s = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
    return ((i = s == null ? void 0 : s.motion) == null ? void 0 : i.enabled) !== !1;
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
  getObjectGroupVisualAdapter(e) {
    const t = this.objects.get(e), s = (t == null ? void 0 : t.visual) ?? (t == null ? void 0 : t.type), i = s ? this.registry.objectTypes.get(s) : void 0, r = i == null ? void 0 : i.groupVisual;
    if (r === "none") return;
    if (r && r !== "default") return r;
    if (!s) return;
    const n = this.groupVisualAdapters.get(s);
    if (n) return n;
    const o = st(this, this.getObjectVisualAdapter(e));
    return this.groupVisualAdapters.set(s, o), o;
  }
  createVisualLifecycleContext(e, t, s, i) {
    var $, N, z, B, D, G, m, j, R, C, O, T, L;
    const r = this.sessionCoordinator.get(e), n = r ? this.objects.get(r.objectId) : void 0, o = (n == null ? void 0 : n.element) ?? void 0, c = r ? this.getObjectVisualAdapter(r.objectId) : this.defaultVisualAdapter, l = new H(), a = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, d = this.getDestinationSurfaceId(t), f = d ? this.surfaces.get(d) : void 0, g = ($ = a == null ? void 0 : a.motion) == null ? void 0 : $.profile, h = this.registry.motionProfile, p = g || h ? {
      ...h,
      ...g,
      flip: { ...h == null ? void 0 : h.flip, ...g == null ? void 0 : g.flip },
      resize: { ...h == null ? void 0 : h.resize, ...g == null ? void 0 : g.resize },
      landing: { ...h == null ? void 0 : h.landing, ...g == null ? void 0 : g.landing },
      freeLanding: {
        ...h == null ? void 0 : h.freeLanding,
        ...g == null ? void 0 : g.freeLanding,
        release: {
          ...(N = h == null ? void 0 : h.freeLanding) == null ? void 0 : N.release,
          ...(z = g == null ? void 0 : g.freeLanding) == null ? void 0 : z.release
        }
      },
      target: {
        ...h == null ? void 0 : h.target,
        ...g == null ? void 0 : g.target,
        motion: { ...(B = h == null ? void 0 : h.target) == null ? void 0 : B.motion, ...(D = g == null ? void 0 : g.target) == null ? void 0 : D.motion },
        landing: { ...(G = h == null ? void 0 : h.target) == null ? void 0 : G.landing, ...(m = g == null ? void 0 : g.target) == null ? void 0 : m.landing },
        dismiss: { ...(j = h == null ? void 0 : h.target) == null ? void 0 : j.dismiss, ...(R = g == null ? void 0 : g.target) == null ? void 0 : R.dismiss }
      },
      group: { ...h == null ? void 0 : h.group, ...g == null ? void 0 : g.group }
    } : void 0, b = typeof t == "object" && t !== null && t.invalidReturn === !0, v = s && "getBoundingClientRect" in s ? s : void 0, y = s && !v ? s : void 0, S = !!(v && o && v === o), M = !!(v && (f == null ? void 0 : f.element) === v), w = this.getObjectProxyLayout((r == null ? void 0 : r.objectId) ?? "", o), I = (C = a == null ? void 0 : a.resolveMoveLandingTarget) == null ? void 0 : C.call(a, { objectId: (r == null ? void 0 : r.objectId) ?? "", destination: t }), A = (O = c.resolveTarget) == null ? void 0 : O.call(c, (r == null ? void 0 : r.objectId) ?? "", t), P = d ? (T = this.targets.findForSurface(d, n == null ? void 0 : n.type)) == null ? void 0 : T.element : null, E = !b && !S ? !!(v && !S && !M && (v === I || v === A || v === P)) ? "target" : (f == null ? void 0 : f.layout) === "free" ? "free" : "default" : "default";
    return {
      objectId: (r == null ? void 0 : r.objectId) ?? "",
      sessionId: e,
      sourceSurfaceId: n == null ? void 0 : n.surfaceId,
      destinationSurfaceId: d ?? void 0,
      mode: (n == null ? void 0 : n.visualMode) ?? "detach",
      destination: t,
      sourceElement: o,
      beforeContent: i,
      targetElement: v,
      targetRect: y,
      sourceRect: o == null ? void 0 : o.getBoundingClientRect(),
      visualSnapshot: o ? (c.captureVisualState ?? l.captureVisualState)(o) : void 0,
      targetSnapshot: v ? (c.captureVisualState ?? l.captureVisualState)(v) : void 0,
      preserveTarget: (a == null ? void 0 : a.preserveMoveTarget) ?? !1,
      // 无效落点是回到原位，不是飞入语义目标；即使对象类型配置了
      // target landing，也必须保留普通 landing 的完整回位表现。
      landingMode: E,
      releaseMode: (a == null ? void 0 : a.releaseMode) ?? "physical",
      contentScale: this.getSessionContentScale(e, (n == null ? void 0 : n.surfaceId) ?? void 0),
      cameraOrigin: this.getSurfaceCameraOrigin(n == null ? void 0 : n.surfaceId),
      disableTargetVisualMorph: (a == null ? void 0 : a.disableTargetVisualMorph) ?? !1,
      landingBounds: () => {
        const k = this.getDestinationSurfaceId(t), x = k ? this.resolveMoveSurfaceViewport(k) : null;
        return x && v && !x.contains(v) ? null : (x == null ? void 0 : x.getBoundingClientRect()) ?? null;
      },
      motion: p,
      motionEnabled: (L = a == null ? void 0 : a.motion) == null ? void 0 : L.enabled,
      proxyLayout: w,
      groupDrag: a == null ? void 0 : a.groupDrag,
      group: r instanceof X ? {
        primaryObjectId: r.primaryObjectId,
        objectIds: r.objectIds,
        offsets: new Map(r.objectIds.map((k) => [k, r.offsetFor(k)]).filter((k) => !!k[1]))
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
  /** 跨 Surface 重抓时，将业务重挂载后的真实 DOM 反查回 Runtime Object。 */
  findObjectIdByElement(e, t) {
    for (const s of this.objects.values())
      if (s.id !== t && s.element === e) return s.id;
    return null;
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
      const n = this.createVisualLifecycleContext(e), o = n.group ? this.getObjectGroupVisualAdapter(s.objectId) ?? this.getObjectVisualAdapter(s.objectId) : this.getObjectVisualAdapter(s.objectId);
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
    return Be(this.objects, this.surfaces, this.targets, e);
  }
  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(e, t, s) {
    var l;
    const i = this.objects.get(e), r = i ? this.registry.objectTypes.get(i.visual ?? i.type) : void 0, n = (l = r == null ? void 0 : r.resolveMoveHit) == null ? void 0 : l.call(r, { objectId: e, x: t, y: s });
    if (n) return n;
    if (this.hitResolver) {
      const a = this.hitResolver.findSurface({ x: t, y: s });
      return a != null && a.dataset.column ? {
        columnId: a.dataset.column,
        index: this.hitResolver.findIndex(a, { x: t, y: s }, e)
      } : null;
    }
    const o = this.createRegisteredHitResolver(e), c = o.findSurface({ x: t, y: s });
    return c ? { columnId: c.id, index: o.findIndex(c, { x: t, y: s }, e) } : null;
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
    return s ? it(s.cleanup, t) : null;
  }
  /**
   * 将落地目标滚动到注册 Surface 的可视范围内。
   *
   * 松手后的滚动由 Runtime 用 rAF 驱动，时长跟 landing 基准时长一致，
   * 不再交给浏览器的原生 smooth scroll。这样代理从松手立即开始飞行时，
   * 容器滚动不会比代理慢一大截，避免代理先完成并被销毁而容器仍在滚动。
   */
  keepSurfaceTargetVisible(e, t) {
    var f, g;
    const s = this.resolveMoveSurfaceViewport(e);
    if (!s || !t.isConnected || !s.contains(t)) return;
    const i = this.surfaceScrollFrames.get(s);
    i !== void 0 && (cancelAnimationFrame(i), this.surfaceScrollFrames.delete(s));
    const r = () => {
      const h = s.getBoundingClientRect(), p = t.getBoundingClientRect(), b = p.top < h.top ? s.scrollTop - (h.top - p.top) : p.bottom > h.bottom ? s.scrollTop + (p.bottom - h.bottom) : s.scrollTop, v = Math.max(0, s.scrollHeight - s.clientHeight);
      return Math.max(0, Math.min(b, v));
    };
    let n = r();
    if (Math.abs(n - s.scrollTop) < 0.5) return;
    const o = s.scrollTop, c = Math.max(200, ((g = (f = this.registry.motionProfile) == null ? void 0 : f.landing) == null ? void 0 : g.duration) ?? 250);
    if (typeof requestAnimationFrame > "u") {
      s.scrollTop = n;
      return;
    }
    const l = performance.now(), a = (h) => {
      const p = Math.min(1, (h - l) / c), b = 1 - (1 - p) ** 3;
      if (n = r(), s.scrollTop = o + (n - o) * b, p >= 1 && (s.scrollTop = n), p >= 1) {
        this.surfaceScrollFrames.delete(s);
        return;
      }
      const v = requestAnimationFrame(a);
      this.surfaceScrollFrames.set(s, v);
    }, d = requestAnimationFrame(a);
    this.surfaceScrollFrames.set(s, d);
  }
  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(e, t) {
    const s = this.objects.get(e), i = t ?? (s == null ? void 0 : s.surfaceId);
    return !s || !i ? -1 : [...this.objects.values()].filter((r) => r.surfaceId === i).map((r) => r.id).sort((r, n) => {
      var l, a, d, f;
      const o = (a = (l = this.objects.get(r)) == null ? void 0 : l.element) == null ? void 0 : a.getBoundingClientRect(), c = (f = (d = this.objects.get(n)) == null ? void 0 : d.element) == null ? void 0 : f.getBoundingClientRect();
      return !o || !c ? 0 : o.top - c.top || o.left - c.left;
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
  /** 读取对象当前端口；位置始终来自当前 DOMRect，不缓存拖拽/相机变换后的坐标。 */
  getNodePorts(e) {
    var n;
    const t = this.objects.get(e), s = t == null ? void 0 : t.element, i = (n = t == null ? void 0 : t.node) == null ? void 0 : n.ports;
    if (!t || !(s != null && s.isConnected) || !i) return [];
    const r = s.getBoundingClientRect();
    return i.map((o) => {
      const c = Math.max(0, Math.min(1, o.position ?? 0.5)), l = o.side === "left" ? r.left : r.right, a = r.top + r.height * c, d = o.hitRadius ?? 10;
      return {
        ...o,
        position: c,
        objectId: e,
        point: { x: l, y: a },
        rect: new DOMRect(l - d, a - d, d * 2, d * 2)
      };
    });
  }
  /** 在实时端点附近命中一个端口；命中结果按距离和对象 DOM 顺序稳定返回。 */
  hitNodePort(e, t = {}) {
    var r;
    return ((r = (t.objectId ? this.getNodePorts(t.objectId) : [...this.objects.values()].flatMap((n) => this.getNodePorts(n.id))).filter((n) => t.objectType ? !n.accepts || n.accepts.length === 0 || n.accepts.includes(t.objectType) : !0).map((n) => ({ port: n, distance: Math.hypot(e.x - n.point.x, e.y - n.point.y) })).filter((n) => n.distance <= (n.port.hitRadius ?? 10)).sort((n, o) => n.distance - o.distance)[0]) == null ? void 0 : r.port) ?? null;
  }
  beginNodeConnection(e, t) {
    const s = this.getNodePorts(e).find((i) => i.id === t);
    return s ? (this.activeNodeConnection = {
      sourceObjectId: e,
      sourcePortId: t,
      source: s,
      currentPoint: { ...s.point }
    }, this.activeNodeConnection) : null;
  }
  updateNodeConnection(e) {
    return this.activeNodeConnection ? (this.activeNodeConnection = { ...this.activeNodeConnection, currentPoint: { ...e } }, this.activeNodeConnection) : null;
  }
  finishNodeConnection(e, t) {
    var c;
    const s = this.activeNodeConnection, i = this.getNodePorts(e).find((l) => l.id === t);
    if (!s || !i || s.sourceObjectId === e) return !1;
    const r = this.objects.get(e), n = this.objects.get(s.sourceObjectId);
    if (!r || !n || (c = i.accepts) != null && c.length && !i.accepts.includes(n.type)) return !1;
    const o = this.nodeConnectionId(s.sourceObjectId, s.sourcePortId, e, t);
    return this.nodeConnections.has(o) ? !1 : (this.nodeConnections.add(o), this.activeNodeConnection = null, this.actions.emit({
      type: "connection-create",
      objectId: s.sourceObjectId,
      sourceObjectId: s.sourceObjectId,
      sourcePortId: s.sourcePortId,
      targetObjectId: e,
      targetPortId: t,
      timestamp: Date.now()
    }), !0);
  }
  cancelNodeConnection() {
    const e = this.activeNodeConnection;
    e && (this.activeNodeConnection = null, this.actions.emit({
      type: "connection-cancel",
      objectId: e.sourceObjectId,
      sourceObjectId: e.sourceObjectId,
      sourcePortId: e.sourcePortId,
      timestamp: Date.now()
    }));
  }
  deleteNodeConnection(e) {
    return this.nodeConnections.delete(e) ? (this.actions.emit({ type: "connection-delete", objectId: e, connectionId: e, timestamp: Date.now() }), !0) : !1;
  }
  get activeConnection() {
    return this.activeNodeConnection;
  }
  /** 注册宿主已经持久化的连接，避免首次连接时只校验当前 Runtime 会话。 */
  registerNodeConnection(e) {
    const t = this.nodeConnectionId(
      e.sourceObjectId,
      e.sourcePortId,
      e.targetObjectId,
      e.targetPortId
    );
    return this.nodeConnections.add(t), t;
  }
  unregisterNodeConnection(e) {
    const t = typeof e == "string" ? e : this.nodeConnectionId(
      e.sourceObjectId,
      e.sourcePortId,
      e.targetObjectId,
      e.targetPortId
    );
    return this.nodeConnections.delete(t);
  }
  hasNodeConnection(e) {
    return this.nodeConnections.has(this.nodeConnectionId(
      e.sourceObjectId,
      e.sourcePortId,
      e.targetObjectId,
      e.targetPortId
    ));
  }
  nodeConnectionId(e, t, s, i) {
    return `${e}:${t}->${s}:${i}`;
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
    !(s instanceof F) || !t || s.captureLayout(this.createBehaviorContext(t));
  }
  /** 由 Runtime 统一播放移动事务的布局 FLIP。 */
  playMoveLayout(e, t = !1) {
    const s = this.sessionCoordinator.get(e), i = s ? this.behaviors.get(s.type) : void 0;
    !(i instanceof F) || !s || i.playLayout(this.createBehaviorContext(s), t);
  }
  /** 捕获 Runtime 管理的 Surface / group / collection 布局快照。 */
  captureLayout(e, t = document, s = !0, i) {
    return Se(e, t, s, i);
  }
  /** 按统一时序播放布局快照；列尾追加可选择等待 Vue patch 的下一帧。 */
  scheduleLayout(e, t = !1) {
    t ? we(e) : je(e);
  }
  /** 统一编排组展开/收起、容器 resize、兄弟 FLIP 与可选 presence。 */
  runGroupToggle(e) {
    return Me(e);
  }
  /** 组件卸载/弹窗关闭时取消根节点下尚未完成的布局动画。 */
  cancelLayoutAnimations(e) {
    Ie(e);
  }
  resolveMoveTarget(e, t, s) {
    var p, b, v, y;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.createBehaviorContext(i), n = this.objects.get(i.objectId), o = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, c = (p = o == null ? void 0 : o.resolveMoveTarget) == null ? void 0 : p.call(o, { objectId: i.objectId, destination: t }), l = (v = (b = r.visual) == null ? void 0 : b.resolveTarget) == null ? void 0 : v.call(b, i.objectId, t), a = s == null ? void 0 : s(), d = (y = this.objects.get(i.objectId)) == null ? void 0 : y.element, f = this.getDestinationSurfaceId(t), g = this.targets.findForSurface(f ?? "", n == null ? void 0 : n.type), h = c ?? l ?? (g == null ? void 0 : g.element) ?? a ?? d ?? null;
    return !h || !h.isConnected ? null : (this.moveBehavior.getContext(e).transaction.target = h, h);
  }
  resolveMoveLandingTarget(e, t, s) {
    var d;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.objects.get(i.objectId), n = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, o = (d = n == null ? void 0 : n.resolveMoveLandingTarget) == null ? void 0 : d.call(n, { objectId: i.objectId, destination: t }), c = this.getDestinationSurfaceId(t), l = this.targets.findForSurface(c ?? "", r == null ? void 0 : r.type), a = o ?? (l == null ? void 0 : l.element) ?? (s == null ? void 0 : s()) ?? this.resolveMoveTarget(e, t);
    return !a || !a.isConnected ? null : a;
  }
  /**
   * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
   * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
   * 实现一套跨 Surface 的等待规则。
   */
  async resolveLandingTarget(e, t, s = 6) {
    const i = this.resolveMoveLandingResolution(e, t);
    if ((i == null ? void 0 : i.kind) === "rect") return i;
    if ((i == null ? void 0 : i.kind) === "element") {
      const n = i.element.getBoundingClientRect();
      if (n.width > 0 && n.height > 0)
        return i;
    }
    const r = await this.waitForMoveTarget(e, t, s);
    return r ? { kind: "element", element: r } : null;
  }
  /**
   * 解析最终落地形态。保留 resolveMoveLandingTarget 的 HTMLElement 旧契约，
   * 仅由新入口增加 free 的纯矩形分支，避免影响项目/文件现有接入。
   */
  resolveMoveLandingResolution(e, t, s) {
    var p, b, v, y, S, M;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.objects.get(i.objectId), n = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, o = typeof t == "object" && t !== null && t.invalidReturn === !0, c = this.getDestinationSurfaceId(t), l = c ? (p = this.surfaces.get(c)) == null ? void 0 : p.layout : void 0, a = (b = n == null ? void 0 : n.resolveMoveLandingTarget) == null ? void 0 : b.call(n, { objectId: i.objectId, destination: t }), d = c ? ((v = this.targets.findForSurface(c, r == null ? void 0 : r.type)) == null ? void 0 : v.element) ?? null : null, f = a ?? d;
    if (f)
      return { kind: "element", element: f };
    if (!o && l === "free") {
      const w = (y = n == null ? void 0 : n.resolveFreeLandingRect) == null ? void 0 : y.call(n, { objectId: i.objectId, destination: t });
      if (w && w.width > 0 && w.height > 0) return { kind: "rect", rect: w };
    }
    const g = ((M = (S = this.getObjectVisualAdapter(i.objectId)).resolveTarget) == null ? void 0 : M.call(S, i.objectId, t)) ?? null;
    if (g) return { kind: "element", element: g };
    const h = this.resolveMoveLandingTarget(e, t, s);
    return h ? { kind: "element", element: h } : null;
  }
  /**
   * 等待 Action 引起的业务 DOM 重渲染并取得落地目标。
   *
   * 跨 Surface 时框架通常会先更新对象所属 Surface，再在随后一两帧销毁旧
   * 组件、登记新组件。不能把仍是源节点的 hidden element 当成 target；同
   * Surface 放回则允许复用原业务节点。业务 adapter 不需要自行轮询 DOM。
   */
  async waitForMoveTarget(e, t, s = 6) {
    var g, h;
    const i = this.sessionCoordinator.get(e);
    if (!i) return null;
    const r = this.moveBehavior.getContext(e);
    r.sourceElement;
    const n = this.getDestinationSurfaceId(t), o = this.objects.get(i.objectId), c = o ? this.registry.objectTypes.get(o.visual ?? o.type) : void 0, l = !!(c != null && c.resolveMoveLandingTarget), a = r.transaction.destination, d = typeof (a == null ? void 0 : a.fromSurfaceId) == "string" ? a.fromSurfaceId : null, f = !!n && n !== d;
    for (let p = 0; p < s; p += 1) {
      const b = this.sessionCoordinator.get(e);
      if (b !== i || b.state === "disposed" || b.state === "interrupt") return null;
      const v = this.resolveMoveLandingTarget(e, t), y = v == null ? void 0 : v.getBoundingClientRect(), S = !!(y && y.width > 0 && y.height > 0), M = l || !n || (o == null ? void 0 : o.surfaceId) === n, w = l || (n && v ? ((h = (g = this.surfaces.get(n)) == null ? void 0 : g.element) == null ? void 0 : h.contains(v)) ?? !1 : !1);
      if (v && S && M && (l || (f ? w : !0))) return v;
      await new Promise((A) => requestAnimationFrame(() => A()));
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
    const n = s.getBoundingClientRect(), o = i.getBoundingClientRect(), c = o.width || n.width, l = o.height || n.height, a = new DOMRect(n.left, n.top, c, l);
    return {
      sessionId: e,
      objectId: r.objectId,
      event: t,
      proxyElement: s,
      sourceElement: i,
      proxyRect: n,
      regrabRect: a,
      interrupt: (d) => this.interrupt(e, d ?? "regrab")
    };
  }
  /**
   * 统一完成 landing → regrab 的旧 Session 接管。视觉 adapter 只处理
   * source 可见性和监听器，旧 Session、completion gate 与 landing proxy
   * 的失效由 Runtime 保证。
   */
  takeoverRegrab(e) {
    var s;
    const t = this.sessionCoordinator.get(e);
    return !t || t.state !== "landing" ? !1 : ((s = this.visualProxyCoordinator.get(e)) == null || s.element, this.interrupt(e, "regrab"), this.disposeVisualProxy(e), !0);
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
    const t = this.runtimeMove.start(e, {
      getBehavior: (s) => this.behaviors.get(s),
      createSession: (s, i) => this.startSession(s, i),
      getVisualStrategy: (s) => {
        const i = this.objects.get(s);
        return i ? this.registry.visualStrategies.get(i.type) : void 0;
      },
      bindLifecycle: (s, i) => this.moveBehavior.bindLifecycle(s, i),
      createContext: (s) => this.createBehaviorContext(s),
      isCurrent: (s) => !!this.sessionCoordinator.get(s),
      cancel: (s, i) => this.cancel(s, i),
      interrupt: (s, i) => this.interrupt(s, i)
    });
    return this.startMoveVisualTracking(t.id, "active"), t;
  }
  startMoveVisualTracking(e, t) {
    if (typeof requestAnimationFrame != "function" || (this.moveVisualPhases.set(e, t), this.moveVisualFrames.has(e))) return;
    const s = () => {
      var c, l;
      const i = this.sessionCoordinator.get(e);
      if (!i) {
        this.moveVisualFrames.delete(e), this.moveVisualPhases.delete(e);
        return;
      }
      const r = (c = this.visualProxyCoordinator.get(e)) == null ? void 0 : c.element, n = r != null && r.isConnected ? r : (l = this.objects.get(i.objectId)) == null ? void 0 : l.element, o = n == null ? void 0 : n.getBoundingClientRect();
      o && o.width > 0 && o.height > 0 && this.events.emit({
        type: "move-visual-update",
        sessionId: e,
        objectId: i.objectId,
        phase: this.moveVisualPhases.get(e) ?? t,
        rect: { x: o.x, y: o.y, width: o.width, height: o.height }
      }), this.moveVisualFrames.set(e, requestAnimationFrame(s));
    };
    this.moveVisualFrames.set(e, requestAnimationFrame(s));
  }
  setMoveVisualPhase(e, t) {
    this.moveVisualPhases.has(e) && this.moveVisualPhases.set(e, t);
  }
  stopMoveVisualTracking(e) {
    const t = this.moveVisualFrames.has(e.id) || this.moveVisualPhases.has(e.id), s = this.moveVisualFrames.get(e.id);
    s !== void 0 && typeof cancelAnimationFrame == "function" && cancelAnimationFrame(s), this.moveVisualFrames.delete(e.id), this.moveVisualPhases.delete(e.id), t && this.events.emit({ type: "move-visual-end", sessionId: e.id, objectId: e.objectId });
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
      if (n instanceof F)
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
    this.setMoveVisualPhase(e, "landing");
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
    this.stopMoveVisualTracking(s), this.runtimeSession.terminate(
      s,
      i,
      r,
      t,
      "cancel",
      (n, o, c) => {
        var l;
        n instanceof F && n.cancelLayout(o, c), (l = n == null ? void 0 : n.cancel) == null || l.call(n, o, c);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    ), this.clearSessionContentScale(e);
  }
  interrupt(e, t = "cancel") {
    this.dispatcher.interrupt(e, t);
  }
  interruptInternal(e, t = "cancel") {
    const s = this.sessionCoordinator.get(e);
    if (!s) return;
    const i = this.behaviors.get(s.type), r = this.createBehaviorContext(s);
    this.stopMoveVisualTracking(s), this.runtimeSession.terminate(
      s,
      i,
      r,
      t,
      "interrupt",
      (n, o, c) => {
        var l;
        n instanceof F && n.cancelLayout(o, c), (l = n == null ? void 0 : n.interrupt) == null || l.call(n, o, c);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    ), this.clearSessionContentScale(e);
  }
  startSession(e, t = "") {
    return this.sessionCoordinator.create(e, t, this.owner);
  }
  startGroupSession(e, t, s = {}) {
    const i = new X(e, t, this.owner, s);
    return this.sessionCoordinator.set(i), i;
  }
  getSession(e) {
    return this.sessionCoordinator.get(e);
  }
  /** 返回多对象会话的公开元数据，供视觉层决定源节点占位策略。 */
  getGroup(e) {
    const t = this.sessionCoordinator.get(e);
    if (t instanceof X)
      return { primaryObjectId: t.primaryObjectId, objectIds: t.objectIds };
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
    this.stopMoveVisualTracking(e);
    const t = this.behaviors.get(e.type), s = this.createBehaviorContext(e);
    this.runtimeSession.finalize(
      e,
      t,
      s,
      (i) => this.disposeVisualProxy(i),
      (i, r) => this.disposeBehavior(i, r)
    ), this.clearSessionContentScale(e.id);
  }
  failCompletionGates(e) {
    this.sessionCoordinator.failGates(e), this.disposeVisualProxy(e);
  }
  disposeBehavior(e, t) {
    var s, i, r, n;
    try {
      e instanceof F && ((r = (i = (s = e.getLifecycle(t.session.id)) == null ? void 0 : s.surface) == null ? void 0 : i.dispose) == null || r.call(i, t)), (n = e == null ? void 0 : e.dispose) == null || n.call(e, t);
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
const ot = new rt();
function te(u) {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
  return {
    bindObject(r, n) {
      const o = u.objects.get(r);
      if (o) {
        if (n === null) {
          const c = e.get(r);
          if (c && o.element !== c) return;
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
          const c = t.get(r);
          if (c && o.element !== c) return;
          t.delete(r);
        } else
          t.set(r, n);
        u.surfaces.setElement(r, n);
      }
    },
    bindTarget(r, n, o) {
      const c = s.get(r) ?? n.id ?? `runtime-target:${r}`;
      if (s.set(r, c), !o) {
        const l = i.get(r), a = u.targets.get(c);
        if (l && (a == null ? void 0 : a.element) !== l) return;
        i.delete(r), u.targets.unregister(c), s.delete(r);
        return;
      }
      i.set(r, o), u.targets.register({ ...n, id: c, element: o });
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
function at(u) {
  return te(u);
}
function ct(u) {
  return te(u);
}
function Q(u, e) {
  const t = u.getBoundingClientRect();
  return e.x >= t.left && e.x <= t.right && e.y >= t.top && e.y <= t.bottom;
}
function lt(u) {
  return {
    findSurface(e) {
      return Array.from(document.querySelectorAll(u.surfaceSelector)).find((t) => Q(t, e)) ?? null;
    },
    findTarget(e, t, s) {
      return Array.from(e.querySelectorAll(u.targetSelector)).filter((i) => i.dataset.card !== s).find((i) => Q(i, t)) ?? null;
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
function ut(u, e, t, s) {
  const i = u.findSurface({ x: e, y: t });
  if (!i) return null;
  const r = i.dataset.column;
  if (!r) return null;
  const n = u.findIndex(i, { x: e, y: t }, s);
  return { columnId: r, index: n };
}
export {
  W as DEFAULT_GROUP_DRAG_CONFIG,
  q as DEFAULT_RELEASE_PROFILE,
  H as DefaultVisualAdapter,
  ve as FOLLOW_PROFILE,
  ye as FOLLOW_ROTATION,
  X as GroupDragSession,
  gt as LANDING_PROFILE,
  We as MoveActionCoordinator,
  F as MoveBehavior,
  He as MoveCommitCoordinator,
  _e as MoveLandingCoordinator,
  qe as MoveReleaseCoordinator,
  Ve as MoveTransaction,
  ze as MoveUpdateCoordinator,
  xe as ObjectStore,
  rt as Runtime,
  Qe as RuntimeDispatcher,
  Ke as RuntimeInputCoordinator,
  J as RuntimeMoveCoordinator,
  De as RuntimeRegistry,
  $e as RuntimeSessionCoordinator,
  ee as Session,
  Ge as SessionCoordinator,
  ke as SurfaceStore,
  Ae as TargetStore,
  Fe as VisualAdapters,
  Ze as VisualMotionCoordinator,
  Ye as VisualProxyCoordinator,
  Xe as VisualStateCoordinator,
  pt as acquireSourceVisualLease,
  Je as bindPointerSessionInput,
  Ie as cancelLayoutAnimations,
  ft as captureCollectionPresence,
  Se as captureLayoutFlip,
  mt as coastOffset,
  vt as createCardMotionController,
  yt as createCubicBezierEasing,
  ue as createDetachMoveFromAdapter,
  lt as createDomHitResolver,
  bt as createFreeLandingMotion,
  st as createGroupVisualAdapter,
  ct as createReactRuntimeAdapter,
  Be as createRegisteredHitResolver,
  at as createVueRuntimeAdapter,
  ut as hitWithResolver,
  Ct as integrateSpring,
  St as playCollectionPresence,
  wt as playLayoutFlip,
  jt as resolveFreeLandingEasing,
  et as resolveGroupDragConfig,
  Me as runGroupToggle,
  ot as runtime,
  Ce as setLayoutPresenceEnabled,
  Mt as shapeReleaseVelocity,
  Ue as trackLandingTarget,
  It as transitionGroupHeight
};
