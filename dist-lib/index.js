import { c as se, g as W, a as re, b as ie, l as ne, d as oe, D as $, e as X, r as ae, f as ce, h as le, i as ue, j as de, k as he, m as pe, n as ge, s as Y, F as fe, o as me, p as ve, q as ye, t as be, u as Ce, v as Se, w as we, x as je } from "./MoveAdapter-DmKjAVq3.js";
import { L as ft, y as mt, z as vt, A as yt, B as bt, C as Ct, E as St, G as wt, H as jt, I as Mt } from "./MoveAdapter-DmKjAVq3.js";
class G {
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
class Me {
  constructor() {
    this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new G();
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
        const r = this.controlled.get(e);
        (r == null ? void 0 : r.ownerSessionId) === t && (this.controlled.delete(e), this.events.emit(e));
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
    let r = this.channelOwners.get(e);
    r || (r = /* @__PURE__ */ new Map(), this.channelOwners.set(e, r)), r.set(t, s);
    let i = !1;
    return {
      release: () => {
        i || (i = !0, r.get(t) === s && (r.delete(t), r.size === 0 && this.channelOwners.delete(e)));
      }
    };
  }
  ownsChannel(e, t, s) {
    var r;
    return ((r = this.channelOwners.get(e)) == null ? void 0 : r.get(t)) === s;
  }
}
class xe {
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
  trackTargetListener(e, t, s, r) {
    e.addEventListener(t, s, r), this.track(() => e.removeEventListener(t, s, r));
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
      } catch (r) {
        t.push(r);
      } finally {
      }
    t.length > 0 && console.error("Cleanup disposal failed", t);
  }
}
const Re = {
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
let Le = 1;
class J {
  constructor(e, t, s) {
    this.type = e, this.objectId = t, this.owner = s, this.state = "prepare", this.endReason = "finish", this.cleanup = new xe(), this.leases = [], this.id = `session-${Le++}`;
  }
  transition(e) {
    if (this.state !== e) {
      if (!Re[this.state].includes(e))
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
class q extends J {
  constructor(e, t, s, r = {}) {
    const i = [...new Set(e)];
    if (i.length === 0) throw new Error("GroupDragSession requires at least one object");
    if (!i.includes(t))
      throw new Error(`Primary object is not part of group: ${t}`);
    super(r.type ?? "move", t, s), this.leasedObjectIds = /* @__PURE__ */ new Set(), this.objectIds = Object.freeze(i), this.primaryObjectId = t, this.offsets = r.offsets ? new Map(r.offsets) : /* @__PURE__ */ new Map();
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
class Ie {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.events = new G(), this.generations = /* @__PURE__ */ new Map();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "object-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const r = this.items.delete(e);
    return r && this.events.emit({ type: "object-removed", id: e }), r;
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
    return s ? (Object.entries(t).some(([i, n]) => s[i] !== n) && (Object.assign(s, t), this.events.emit({ type: "object-changed", id: e })), !0) : !1;
  }
}
class Oe {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new G();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "surface-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const r = this.items.delete(e);
    return r && this.events.emit({ type: "surface-removed", id: e }), r;
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
    return s ? (Object.entries(t).some(([i, n]) => s[i] !== n) && (Object.assign(s, t), this.events.emit({ type: "surface-changed", id: e })), !0) : !1;
  }
  /** 空 accepts 数组表示不限制类型。 */
  accepts(e, t) {
    const s = this.items.get(e);
    return s ? s.accepts.length === 0 || s.accepts.includes(t) : !1;
  }
}
class Te {
  constructor() {
    this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new G();
  }
  register(e) {
    const t = (this.generations.get(e.id) ?? 0) + 1;
    return this.generations.set(e.id, t), this.items.set(e.id, { ...e, generation: t }), this.events.emit({ type: "target-added", id: e.id }), t;
  }
  unregister(e, t) {
    const s = this.items.get(e);
    if (t !== void 0 && (s == null ? void 0 : s.generation) !== t) return !1;
    const r = this.items.delete(e);
    return r && this.events.emit({ type: "target-removed", id: e }), r;
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
    return s ? (Object.entries(t).some(([i, n]) => s[i] !== n) && (Object.assign(s, t), this.events.emit({ type: "target-changed", id: e })), !0) : !1;
  }
  findForSurface(e, t) {
    return this.snapshot().filter((s) => s.surfaceId === e).filter((s) => !t || s.accepts.length === 0 || s.accepts.includes(t)).filter((s) => {
      var r;
      return (r = s.element) == null ? void 0 : r.isConnected;
    }).sort((s, r) => (r.priority ?? 0) - (s.priority ?? 0))[0];
  }
  subscribe(e) {
    return this.events.subscribe(e);
  }
}
class Ae {
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
class ke {
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
class B {
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
    var r, i, n;
    const t = this.getContext(e.session.id), s = (n = (i = (r = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : r.layout) == null ? void 0 : i.capture) == null ? void 0 : n.call(i, e);
    t.layoutSnapshot = s;
  }
  playLayout(e, t = !1) {
    var i, n;
    const s = this.getContext(e.session.id), r = this.sessionLifecycles.get(e.session.id);
    s.layoutSnapshot !== void 0 && ((n = (i = r == null ? void 0 : r.layout) == null ? void 0 : i.play) == null || n.call(i, e, s.layoutSnapshot, t));
  }
  /** 列尾追加专用：等下一帧（Vue patch 落地）再量布局执行 Invert。 */
  playLayoutOnRaf(e) {
    this.playLayout(e, !0);
  }
  cancelLayout(e, t) {
    var i, n, o;
    const s = this.getContext(e.session.id), r = s.layoutSnapshot;
    r !== void 0 && ((o = (n = (i = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : i.layout) == null ? void 0 : n.cancel) == null || o.call(n, e, r, t)), s.layoutSnapshot = void 0;
  }
  getContext(e) {
    let t = this.contexts.get(e);
    return t || (t = {
      transaction: new ke(),
      sourceElement: null,
      dragOffset: { x: 0, y: 0 }
    }, this.contexts.set(e, t)), t;
  }
  driverFor(e) {
    return this.sessionDrivers.get(e) ?? this.driver;
  }
  prepare(e, t) {
    var c, d, a, l, h;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("prepare");
    const r = ((d = (c = e.visual) == null ? void 0 : c.resolveSource) == null ? void 0 : d.call(c, t.objectId)) ?? null;
    s.sourceElement = r, s.transaction.source = r;
    const i = t.input.event instanceof PointerEvent ? t.input.event : null;
    if (r && i) {
      const p = r.getBoundingClientRect();
      s.dragOffset = {
        x: i.clientX - p.left,
        y: i.clientY - p.top
      };
    }
    const n = (l = (a = this.driverFor(e.session.id)).prepare) == null ? void 0 : l.call(a, e, t), o = this.sessionLifecycles.get(e.session.id);
    return n && typeof n.then == "function" ? Promise.resolve(n).then(async () => {
      var p;
      return (p = o == null ? void 0 : o.beginDrag) == null ? void 0 : p.call(o, e);
    }) : (h = o == null ? void 0 : o.beginDrag) == null ? void 0 : h.call(o, e);
  }
  update(e, t) {
    var i, n;
    if (e.session.state !== "active") return;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("active");
    const r = t.event instanceof PointerEvent ? t.event : null;
    (n = (i = this.driverFor(e.session.id)).update) == null || n.call(i, e, t), r && s.followElement && (s.followElement.style.left = `${r.clientX - s.dragOffset.x}px`, s.followElement.style.top = `${r.clientY - s.dragOffset.y}px`);
  }
  release(e, t) {
    var n;
    const s = this.getContext(e.session.id);
    s.transaction.setPhase("release");
    const r = this.driverFor(e.session.id), i = (n = r.resolveDestination) == null ? void 0 : n.call(r, e, t);
    return Ee(i) ? i.then((o) => (o && o.accepted && o.destination !== void 0 && (s.destination = o.destination, s.transaction.destination = o.destination), o)) : (i && i.accepted && i.destination !== void 0 && (s.destination = i.destination, s.transaction.destination = i.destination), i);
  }
  commit(e, t) {
    this.getContext(e.session.id).transaction.setPhase("landing");
    const s = this.driverFor(e.session.id);
    if (s.commit)
      return s.commit(e, t);
  }
  cancel(e, t) {
    var r, i, n, o;
    const s = this.getContext(e.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (i = (r = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : r.cancel) == null || i.call(r, e, t), (o = (n = this.driverFor(e.session.id)).cancel) == null || o.call(n, e, t);
  }
  interrupt(e, t) {
    var r, i, n, o;
    const s = this.getContext(e.session.id).transaction;
    s.invalidate(), s.setPhase("cancelled"), (i = (r = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : r.cancel) == null || i.call(r, e, t), (o = (n = this.driverFor(e.session.id)).interrupt) == null || o.call(n, e, t);
  }
  dispose(e) {
    var s, r;
    const t = this.getContext(e.session.id).transaction;
    t.phase !== "cancelled" && t.setPhase("disposed"), (r = (s = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : s.dispose) == null || r.call(s, e), this.unbindSession(e.session.id);
  }
  landing(e, t) {
    var o;
    const s = this.getContext(e.session.id);
    if (s.transaction.setPhase("landing"), s.landingStarted)
      return s.landingPromise ?? { completed: s.landingCompleted === !0 };
    s.landingStarted = !0, s.destination = t;
    const r = this.sessionLifecycles.get(e.session.id), i = (o = r == null ? void 0 : r.landing) == null ? void 0 : o.call(r, e, t), n = Promise.resolve(i).then((c) => ((!c || c.completed) && (s.landingCompleted = !0), c));
    return s.landingPromise = n, n;
  }
  reveal(e, t) {
    var r, i;
    const s = this.getContext(e.session.id);
    if (!s.revealCommitted && !(s.landingStarted && !s.landingCompleted))
      return s.revealCommitted = !0, s.transaction.setPhase("handoff"), (i = (r = this.sessionLifecycles.get(e.session.id)) == null ? void 0 : r.reveal) == null ? void 0 : i.call(r, e, t);
  }
}
const Pe = [
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
function Be(u) {
  const e = getComputedStyle(u);
  return Object.fromEntries(
    Pe.map((t) => [t, e[t]])
  );
}
function Ve(u, e) {
  Object.assign(u.style, e);
}
function Fe(u, e) {
  Ve(e, Be(u));
}
class F {
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
    var r, i;
    const t = ((i = (r = this.runtime) == null ? void 0 : r.objects.get(e)) == null ? void 0 : i.element) ?? null;
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
    const t = se(e.beforeContent, e.sourceRect, { layout: e.proxyLayout }), s = W(t), r = !!((n = e.proxyLayout) != null && n.compact);
    Fe(e.sourceElement, s);
    const i = e.visualSnapshot;
    return i && (s.style.boxShadow = i.boxShadow, s.style.borderRadius = i.borderRadius, s.style.backgroundColor = i.background, i.backgroundImage && i.backgroundImage !== "none" && (s.style.backgroundImage = i.backgroundImage), s.style.opacity = i.opacity, re(t).style.transform = `scale(${r ? 1 : 1.03})`), de() && he(s), s.querySelectorAll("[class]").forEach((o) => {
      const c = getComputedStyle(o);
      c.opacity === "0" && c.pointerEvents === "none" && (o.style.opacity = "1");
    }), { element: t };
  }
  land(e, t, s) {
    var v, j, C, L, S, I, T, w, R, z, H;
    const r = e.element;
    if (!((v = s.targetSnapshot) != null && v.rect) && !t.isConnected)
      return Promise.resolve({ completed: !1, reason: "target-disconnected" });
    const i = ((j = s.targetSnapshot) == null ? void 0 : j.rect) ?? t.getBoundingClientRect(), n = {
      left: i.left ?? i.x,
      top: i.top ?? i.y,
      width: i.width,
      height: i.height
    }, o = (O) => {
      var A;
      const V = (A = s.landingBounds) == null ? void 0 : A.call(s);
      return V ? pe(O, V) : O;
    }, c = o(n);
    s.preserveTarget || ie(t, s.sessionId), r.style.transition = "none";
    const d = s.landingMode === "target", a = W(r).dataset.runtimeCompact === "true", l = s.targetSnapshot, h = !!(l && (l.background && l.background !== "transparent" && l.background !== "rgba(0, 0, 0, 0)" || l.backgroundImage && l.backgroundImage !== "none" || l.boxShadow && l.boxShadow !== "none")), p = d ? !s.disableTargetVisualMorph && h : !!l, g = s.landingMode === "target" ? ((L = (C = s.motion) == null ? void 0 : C.target) == null ? void 0 : L.landing) ?? ((S = s.motion) == null ? void 0 : S.landing) : (I = s.motion) == null ? void 0 : I.landing;
    d || (r.style.width = `${c.width}px`, r.style.height = `${c.height}px`);
    const f = s.motionEnabled === !1 ? ne : oe, { finished: b, retarget: y } = f(r, c, {
      duration: (g == null ? void 0 : g.duration) ?? X.landing.duration,
      easing: (g == null ? void 0 : g.easing) ?? X.landing.easing,
      // 面包屑是透明文本节点，只提供位置和消失时机，不能把它的透明表面
      // 样式覆盖到代理卡片；有可见表面的文件夹卡仍完整执行视觉 morph。
      targetShadow: p ? l == null ? void 0 : l.boxShadow : void 0,
      targetRadius: p ? l == null ? void 0 : l.borderRadius : void 0,
      targetBorder: p ? l == null ? void 0 : l.border : void 0,
      targetBackdropFilter: p ? l == null ? void 0 : l.backdropFilter : void 0,
      targetBackground: p ? l == null ? void 0 : l.background : void 0,
      targetBackgroundImage: p ? l == null ? void 0 : l.backgroundImage : void 0,
      targetOpacity: p ? l == null ? void 0 : l.opacity : void 0,
      // 透明面包屑/列表行没有可复用的卡片式内容结构，不能参与 content morph——列表行是
      // grid 多列布局，套这套给卡片设计的结构级 morph 会把列挤错位（类型跑到文件名下面）。
      // compact 列表代理与目标卡结构相同，只需要让同一份内容跟随宽度恢复；如果再挂一层
      // 目标 Grid，右侧文件大小会因为 justify-self:end 在 landing 第一帧瞬间回到完整宽度。
      // 只有真正有背景/阴影且不是 compact 列表的目标才复用结构级 content morph。
      targetContent: h && !a ? t : void 0,
      landingMode: s.landingMode,
      targetMotion: d ? (w = (T = s.motion) == null ? void 0 : T.target) == null ? void 0 : w.motion : void 0,
      dismiss: d ? (z = (R = s.motion) == null ? void 0 : R.target) == null ? void 0 : z.dismiss : void 0,
      readTarget: () => o(t.getBoundingClientRect()),
      motionState: s.motionState,
      coast: {
        duration: $.coastSeconds,
        friction: ge,
        maxDistance: $.maxCoast,
        minVelocity: $.minVelocity
      },
      releaseDamping: $.dampingRatio
    });
    if (this.runtime) {
      const O = (H = s.targetSnapshot) == null ? void 0 : H.rect, V = () => {
        const A = t.getBoundingClientRect();
        return A.width > 0 && A.height > 0 ? o(A) : O && O.width > 0 && O.height > 0 ? o({
          left: O.x,
          top: O.y,
          width: O.width,
          height: O.height
        }) : o(A);
      };
      this.runtime.trackLandingTarget(s.sessionId, t, () => {
        y(V());
      });
    }
    return b.then(() => ({ completed: !0 }));
  }
  reveal(e, t, s) {
    t.style.transition = "", ae(t, s.sessionId);
  }
  dispose(e, t) {
    var r;
    const s = e.element;
    (r = e.dispose) == null || r.call(e), ce(s);
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
class Ge {
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
function _(u, e) {
  return e.x >= u.left && e.x <= u.right && e.y >= u.top && e.y <= u.bottom;
}
function De(u, e, t, s) {
  const r = u.get(s), i = () => e.snapshot().filter((n) => {
    var o;
    return (o = n.element) == null ? void 0 : o.isConnected;
  }).filter((n) => r ? e.accepts(n.id, r.type) : !1);
  return {
    findSurface(n) {
      var d;
      const o = t.snapshot().filter((a) => {
        var l;
        return (l = a.element) == null ? void 0 : l.isConnected;
      }).filter((a) => a.accepts.length === 0 || a.accepts.includes((r == null ? void 0 : r.type) ?? "")).filter((a) => _(a.element.getBoundingClientRect(), n)).sort((a, l) => (l.priority ?? 0) - (a.priority ?? 0)).map((a) => e.get(a.surfaceId)).find((a) => !!(a && e.accepts(a.id, (r == null ? void 0 : r.type) ?? "")));
      return o || (((d = i().map((a) => ({
        surface: a,
        rect: a.element.getBoundingClientRect()
      })).filter(({ rect: a }) => _(a, n)).sort((a, l) => a.rect.width * a.rect.height - l.rect.width * l.rect.height)[0]) == null ? void 0 : d.surface) ?? null);
    },
    findTarget(n, o, c) {
      var l;
      const d = (l = u.get(s)) == null ? void 0 : l.type, a = t.snapshot().filter((h) => h.surfaceId === n.id && h.id !== `object-target:${c}`).filter((h) => h.accepts.length === 0 || h.accepts.includes(d ?? "")).filter((h) => {
        var p;
        return (p = h.element) == null ? void 0 : p.isConnected;
      }).sort((h, p) => (p.priority ?? 0) - (h.priority ?? 0)).find((h) => _(h.element.getBoundingClientRect(), o));
      return a != null && a.element ? a.element : [...u.values()].filter((h) => h.id !== c && h.surfaceId === n.id).map((h) => h.element).filter((h) => !!(h != null && h.isConnected)).find((h) => _(h.getBoundingClientRect(), o)) ?? null;
    },
    findIndex(n, o, c) {
      const d = [...u.values()].filter((a) => a.id !== c && a.surfaceId === n.id).map((a) => a.element).filter((a) => !!(a != null && a.isConnected)).map((a) => ({ element: a, rect: a.getBoundingClientRect() })).sort((a, l) => a.rect.top - l.rect.top || a.rect.left - l.rect.left);
      for (let a = 0; a < d.length; a += 1) {
        const { rect: l } = d[a];
        if (o.y < l.top + l.height / 2) return a;
      }
      return d.length;
    }
  };
}
class $e {
  constructor() {
    this.visuals = new Ge(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
class ze {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
  }
  create(e, t, s) {
    const r = new J(e, t, s);
    return this.sessions.set(r.id, r), r;
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
    for (const r of this.sessions.values())
      r.hasObject(e) && (r.trackCleanup(t), s = !0);
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
    const r = this.sessions.get(e);
    if (r)
      return s == null || s(r), r.interrupt(t), this.sessions.delete(e), r;
  }
}
class He {
  constructor(e) {
    this.sessions = e;
  }
  finalize(e, t, s, r, i) {
    try {
      this.sessions.finalize(e.id, (n) => r(n.id));
    } finally {
      i(t, s);
    }
  }
  terminate(e, t, s, r, i, n, o, c) {
    try {
      n(t, s, r);
    } catch (d) {
      console.error(`Behavior ${i} failed`, d);
    } finally {
      try {
        o(e), i === "cancel" ? this.sessions.cancel(e.id) : this.sessions.interrupt(e.id, r === "regrab" ? "regrab" : "cancel");
      } finally {
        c(t, s);
      }
    }
  }
}
function qe(u) {
  return !!(u && typeof u.then == "function");
}
class N {
  constructor(e, t, s, r) {
    this.updateCoordinator = e, this.releaseCoordinator = t, this.commitCoordinator = s, this.landingCoordinator = r;
  }
  static fromPorts(e, t, s) {
    return new N(
      new _e(e),
      new We(),
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
  async commit(e, t, s, r = !0) {
    return this.commitCoordinator.commit(e, t, s, r);
  }
  async land(e, t, s) {
    return this.landingCoordinator.run(e, t, s);
  }
  release(e, t, s) {
    var d;
    const r = s.getSession(e), i = this.prepareRelease(r, t);
    if (i.kind === "ignore") return Promise.resolve();
    if (i.kind === "cancel")
      return r && s.cancel(r.id, i.reason), Promise.resolve();
    const n = i.session, o = s.getBehavior(n.type);
    o instanceof B && s.captureLayout(n.id);
    let c;
    try {
      c = (d = o == null ? void 0 : o.release) == null ? void 0 : d.call(o, s.createContext(n), t);
    } catch (a) {
      return s.cancel(n.id, a instanceof Error ? a.message : "release-failed"), Promise.resolve();
    }
    return qe(c) ? Promise.resolve(c).then((a) => this.finishRelease(n, o, a, s), (a) => {
      s.cancel(n.id, a instanceof Error ? a.message : "release-failed");
    }) : this.finishRelease(n, o, c, s);
  }
  async finishRelease(e, t, s, r) {
    if (r.getSession(e.id) !== e) return;
    const i = s;
    if ((i == null ? void 0 : i.accepted) === !1) {
      r.cancel(e.id, "no-valid-drop");
      return;
    }
    if (e.state === "release" && e.transition("landing"), !(t instanceof B)) {
      r.end(e);
      return;
    }
    const n = i == null ? void 0 : i.destination;
    if (n === void 0) {
      r.cancel(e.id, "invalid-release-result");
      return;
    }
    try {
      await this.commit(e, t, n, (i == null ? void 0 : i.emitAction) !== !1);
    } catch (o) {
      r.cancel(e.id, o instanceof Error ? o.message : "commit-failed");
      return;
    }
    await this.land(e, t, n);
  }
  start(e, t) {
    var o;
    const s = t.getBehavior(e.type);
    if (!s) throw new Error(`Unknown interaction behavior: ${e.type}`);
    const r = t.createSession(e.type, e.objectId), i = t.getVisualStrategy(e.objectId);
    i && t.bindLifecycle(r.id, i);
    const n = t.createContext(r);
    try {
      const c = (o = s.prepare) == null ? void 0 : o.call(s, n, e);
      c && typeof c.then == "function" && c.catch((d) => {
        t.isCurrent(r.id) && t.cancel(r.id, d instanceof Error ? d.message : "prepare-failed");
      });
    } catch (c) {
      t.cancel(r.id, c instanceof Error ? c.message : "prepare-failed");
    }
    return t.isCurrent(r.id) && r.state === "prepare" && r.transition("active"), {
      id: r.id,
      get state() {
        return r.state;
      },
      cancel: (c) => t.cancel(r.id, c ?? "cancelled"),
      interrupt: (c) => t.interrupt(r.id, c ?? "interrupted")
    };
  }
}
class _e {
  constructor(e) {
    this.port = e;
  }
  update(e, t) {
    var r, i;
    const s = this.port.getSession(e);
    !s || s.state !== "active" || (i = (r = this.port.getBehavior(s.type)) == null ? void 0 : r.update) == null || i.call(r, this.port.createContext(e), t);
  }
}
class We {
  prepare(e, t) {
    return e ? t.kind === "pointercancel" || t.kind === "blur" || t.kind === "lostpointercapture" ? { kind: "cancel", reason: t.kind } : e.state === "prepare" ? { kind: "cancel", reason: "interaction-not-ready" } : (e.state === "active" && e.transition("release"), e.state === "release" ? { kind: "continue", session: e } : { kind: "ignore" }) : { kind: "ignore" };
  }
}
class Ne {
  constructor(e, t) {
    this.port = e, this.actions = t;
  }
  resolveIsAppend(e, t) {
    var i, n, o, c, d, a;
    if (!t) return !1;
    const s = (n = (i = this.port).getObjectIndex) == null ? void 0 : n.call(i, e, t.toSurfaceId), r = (c = (o = this.port).getSurfaceObjectCount) == null ? void 0 : c.call(o, t.toSurfaceId);
    return (a = (d = this.port).hasLayoutAnchor) != null && a.call(d, t.toSurfaceId) ? !1 : s !== void 0 && s >= 0 && r !== void 0 ? s >= r - 1 : t.toIndex !== void 0 && r !== void 0 && t.toIndex >= r - 1;
  }
  async commit(e, t, s, r = !0) {
    var d, a, l, h;
    const i = this.port.createContext(e);
    if (await t.commit(i, s), !r) {
      const p = this.port.normalize(e.objectId, s);
      p && (t.getContext(e.id).transaction.destination = p), this.resolveIsAppend(e.objectId, p) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
      return;
    }
    const n = this.port.getLifecycle(e.id), o = this.port.normalize(e.objectId, s);
    o && await ((a = (d = n == null ? void 0 : n.surface) == null ? void 0 : d.leave) == null ? void 0 : a.call(d, i, o.fromSurfaceId)), await this.actions.emit(e.objectId, t.getContext(e.id).destination, t.getContext(e.id).transaction), o && await ((h = (l = n == null ? void 0 : n.surface) == null ? void 0 : l.enter) == null ? void 0 : h.call(l, i, o.toSurfaceId)), this.resolveIsAppend(e.objectId, o) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
  }
}
class Ue {
  constructor(e) {
    this.port = e;
  }
  async run(e, t, s) {
    try {
      const r = await t.landing(this.port.createContext(e), s), i = this.port.getSession(e.id);
      if (i !== e || i.state === "disposed" || i.state === "interrupt") return;
      if (r && !r.completed) return this.port.cancel(e.id, r.reason ?? "landing-failed");
      r && r.reveal && await r.reveal(), e.handoff(), t.reveal && await t.reveal(this.port.createContext(e), s), this.port.getSession(e.id) === e && this.port.end(e);
    } catch (r) {
      this.port.getSession(e.id) === e && this.port.cancel(e.id, r instanceof Error ? r.message : "landing-failed");
    }
  }
}
class Xe {
  constructor(e) {
    this.port = e;
  }
  normalize(e, t) {
    if (this.isDestination(t)) return t;
    if (!t || typeof t != "object") return null;
    const s = t;
    if (typeof s.columnId != "string") return null;
    const r = this.port.getObjectSurface(e);
    return r ? { fromSurfaceId: r, toSurfaceId: s.columnId, ...typeof s.index == "number" ? { toIndex: s.index } : {} } : null;
  }
  async emit(e, t, s) {
    var n, o;
    if (s.actionEmitted) return !1;
    const r = this.normalize(e, t);
    if (!r) return !1;
    s.actionEmitted = !0, s.destination = r;
    const i = (o = (n = this.port).getGroup) == null ? void 0 : o.call(n, e);
    return i && i.objectIds.length > 1 ? await this.port.emit({
      type: "move-group",
      objectId: i.primaryObjectId,
      primaryObjectId: i.primaryObjectId,
      objectIds: i.objectIds,
      fromSurfaceId: r.fromSurfaceId,
      toSurfaceId: r.toSurfaceId,
      ...r.toIndex === void 0 ? {} : { toIndex: r.toIndex },
      timestamp: Date.now()
    }) : await this.port.emit({ type: "move", objectId: e, fromSurfaceId: r.fromSurfaceId, toSurfaceId: r.toSurfaceId, ...r.toIndex === void 0 ? {} : { toIndex: r.toIndex }, timestamp: Date.now() }), !0;
  }
  isDestination(e) {
    if (!e || typeof e != "object") return !1;
    const t = e;
    return typeof t.fromSurfaceId == "string" && typeof t.toSurfaceId == "string";
  }
}
function Ye(u) {
  let e = null, t = null, s = !1;
  const r = Math.max(0, u.stableFrameLimit ?? 2), i = Math.max(1, u.idlePollInterval ?? 4);
  let n = 0, o = 0, c = null;
  const d = () => {
    s || (s = !0, t !== null && cancelAnimationFrame(t), t = null, e == null || e.disconnect(), e = null);
  };
  if (typeof ResizeObserver > "u") return d;
  const a = () => {
    if (s || !u.target.isConnected) return;
    const h = u.target.getBoundingClientRect();
    c = h, n = 0, o = 0, u.retarget(h);
  };
  if (e = new ResizeObserver(a), e.observe(u.target), u.observeAncestors !== !1) {
    const h = typeof document < "u" ? document.body : null, p = u.stopAt === void 0 ? h : u.stopAt;
    let g = u.target.parentElement;
    for (; g && g !== p; )
      e.observe(g), g = g.parentElement;
  }
  const l = () => {
    if (s || (t = requestAnimationFrame(l), !u.target.isConnected) || (o += 1, n >= r && o % i !== 0)) return;
    const h = u.target.getBoundingClientRect();
    if (c && Math.abs(h.left - c.left) < 0.5 && Math.abs(h.top - c.top) < 0.5 && Math.abs(h.width - c.width) < 0.5 && Math.abs(h.height - c.height) < 0.5) {
      n += 1;
      return;
    }
    n = 0, c = h, u.retarget(h);
  };
  return t = requestAnimationFrame(l), u.cleanup.track(d), d;
}
class Ze {
  constructor(e) {
    this.port = e;
  }
  resolveTarget(e, t) {
    var r, i;
    const s = ((i = (r = this.port.getAdapter(e)).resolveTarget) == null ? void 0 : i.call(r, e, t)) ?? new F().resolveTarget(e);
    return s != null && s.isConnected ? s : null;
  }
  apply(e, t, s) {
    (this.port.getAdapter(e).applyState ?? new F().applyState)(t, s);
  }
  capture(e, t) {
    return (this.port.getAdapter(e).captureVisualState ?? new F().captureVisualState)(t);
  }
  trackTarget(e, t, s, r = {}) {
    return Ye({ ...r, cleanup: e, target: t, retarget: s });
  }
}
class Je {
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
class Ke {
  constructor(e, t) {
    this.port = e, this.proxies = t;
  }
  getAdapter(e, t) {
    var s, r;
    return t != null && t.group ? ((r = (s = this.port).getGroupAdapter) == null ? void 0 : r.call(s, e.objectId)) ?? this.port.getAdapter(e.objectId) : this.port.getAdapter(e.objectId);
  }
  create(e, t) {
    var i, n;
    const s = this.port.getSession(e);
    if (!s) return;
    const r = (n = (i = this.getAdapter(s, t)).createProxy) == null ? void 0 : n.call(i, t);
    if (r)
      return this.proxies.register(e, r), r;
  }
  async land(e, t, s) {
    var c, d;
    const r = this.port.getSession(e), i = this.proxies.get(e);
    if (!r || !i) return { completed: !1, reason: "visual-proxy-missing" };
    const n = s ?? this.port.createContext(e, void 0, t), o = await ((d = (c = this.getAdapter(r, n)).land) == null ? void 0 : d.call(c, i, t, n));
    return o || { completed: !0 };
  }
  update(e, t) {
    var n, o;
    const s = this.port.getSession(e), r = this.proxies.get(e);
    if (!s || !r) return;
    const i = t ?? this.port.createContext(e);
    (o = (n = this.getAdapter(s, i)).updateProxy) == null || o.call(n, r, i);
  }
  async reveal(e, t, s) {
    var o, c;
    const r = this.port.getSession(e), i = this.proxies.get(e);
    if (!r || !i) return;
    const n = s ?? this.port.createContext(e, void 0, t);
    await ((c = (o = this.getAdapter(r, n)).reveal) == null ? void 0 : c.call(o, i, t, n));
  }
}
function Qe(u, e, t = {}) {
  const s = t.target ?? window, r = t.captureTarget;
  let i = !1, n = null, o = null;
  const c = (g) => {
    n = g, o === null && (o = s.requestAnimationFrame(() => {
      o = null;
      const f = n;
      n = null, !(i || !f) && u.update(e.id, { kind: "pointermove", event: f });
    }));
  }, d = (g) => {
    p(), u.release(e.id, { kind: "pointerup", event: g });
  }, a = (g) => {
    p(), u.release(e.id, { kind: "pointercancel", event: g });
  }, l = () => {
    p(), u.release(e.id, { kind: "blur" });
  }, h = (g) => {
    p(), u.release(e.id, { kind: "lostpointercapture", event: g });
  };
  function p() {
    i || (i = !0, n = null, o !== null && (s.cancelAnimationFrame(o), o = null), s.removeEventListener("pointermove", c), s.removeEventListener("pointerup", d), s.removeEventListener("pointercancel", a), s.removeEventListener("blur", l), r == null || r.removeEventListener("lostpointercapture", h));
  }
  return s.addEventListener("pointermove", c), s.addEventListener("pointerup", d), s.addEventListener("pointercancel", a), s.addEventListener("blur", l), r == null || r.addEventListener("lostpointercapture", h), e.cleanup.track(p), p;
}
class et {
  constructor(e) {
    this.port = e, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
  }
  bind(e, t, s = {}) {
    var c, d;
    (c = this.disposers.get(e)) == null || c(), (d = this.bindings.get(t)) == null || d();
    let r = null;
    const i = () => {
      r && (window.removeEventListener("pointermove", r.move), window.removeEventListener("pointerup", r.up), window.removeEventListener("pointercancel", r.up), r = null);
    }, n = (a) => {
      if (!(a instanceof PointerEvent) || a.button !== 0 && a.pointerType === "mouse") return;
      if (!a.pointerType) {
        this.port.startObjectPointer(e, t, a);
        return;
      }
      i();
      const l = a.clientX, h = a.clientY, p = (f) => {
        if (!(f instanceof PointerEvent)) return;
        const b = Math.max(0, s.dragThreshold ?? 5);
        Math.hypot(f.clientX - l, f.clientY - h) < b || (i(), f.preventDefault(), this.port.startObjectPointer(e, t, a));
      }, g = () => i();
      r = { down: a, move: p, up: g }, window.addEventListener("pointermove", p), window.addEventListener("pointerup", g), window.addEventListener("pointercancel", g);
    };
    t.addEventListener("pointerdown", n);
    const o = () => {
      t.removeEventListener("pointerdown", n), i();
    };
    return this.bindings.set(t, o), this.disposers.set(e, o), o;
  }
  sync(e) {
    var r;
    const t = this.port.objects.get(e);
    if ((r = this.disposers.get(e)) == null || r(), this.disposers.delete(e), !(t != null && t.element) || !this.port.registry.objectTypes.has(t.visual ?? t.type)) return;
    const s = this.port.registry.objectTypes.get(t.visual ?? t.type);
    this.bind(e, t.element, s == null ? void 0 : s.pointerInput);
  }
  remove(e) {
    var t;
    (t = this.disposers.get(e)) == null || t(), this.disposers.delete(e);
  }
  bindRegrabTarget(e, t, s, r) {
    this.port.registerRegrab(t, r);
    const i = (n) => {
      n instanceof PointerEvent && this.port.regrab(t, n);
    };
    s.addEventListener("pointerdown", i), e.cleanup.trackTargetListener(s, "pointerdown", i);
  }
  bindSession(e, t = {}) {
    return Qe({
      update: (s, r) => this.port.update(s, r),
      release: (s, r) => this.port.release(s, r)
    }, e, t);
  }
}
class tt {
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
const D = {
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
function st(u) {
  return {
    maxModifiers: Math.max(0, (u == null ? void 0 : u.maxModifiers) ?? D.maxModifiers),
    foldDuration: Math.max(0, (u == null ? void 0 : u.foldDuration) ?? D.foldDuration),
    modifierFadeDuration: Math.max(0, (u == null ? void 0 : u.modifierFadeDuration) ?? D.modifierFadeDuration),
    spread: (u == null ? void 0 : u.spread) ?? D.spread,
    tight: (u == null ? void 0 : u.tight) ?? D.tight
  };
}
function rt(u, e) {
  e && (u.dataset.runtimeProxyContent = "true", u.dataset.runtimeCompact = "true", u.style.boxSizing = "border-box", u.style.left = e.left ?? "50%", u.style.width = e.width, e.gridTemplateColumns && (u.style.gridTemplateColumns = e.gridTemplateColumns));
}
function it(u, e = new F(u)) {
  var r, i, n, o;
  const t = /* @__PURE__ */ new WeakMap();
  function s(c, d) {
    var V, A, U;
    const a = d.group;
    if (!a || a.primaryObjectId !== d.objectId || t.has(c.element)) return;
    const l = W(c.element), h = c.element.querySelector('[data-runtime-proxy-scale-shell="true"]') ?? c.element;
    if (h.style.overflow = "visible", l.style.zIndex = "2", !(d.sourceRect ?? ((V = d.sourceElement) == null ? void 0 : V.getBoundingClientRect()))) return;
    const g = st(d.groupDrag), f = (A = d.proxyLayout) == null ? void 0 : A.compact, b = [], y = [], v = [], j = a.objectIds.map((m) => {
      var x;
      return (x = u.objects.get(m)) == null ? void 0 : x.element;
    }).filter((m) => !!(m != null && m.isConnected));
    for (const m of j)
      b.push({
        element: m,
        cssText: m.style.cssText,
        marker: m.dataset.runtimeGroupGhost,
        opacity: getComputedStyle(m).opacity
      }), m.dataset.runtimeGroupGhost = "true", m.style.visibility = "visible", m.style.opacity = "0.35", m.style.pointerEvents = "none", m.style.transition = "none";
    const C = g.spread.map((m, x) => ({ spread: m, tight: g.tight[x] })).filter((m) => !!m.tight), L = a.objectIds.filter((m) => m !== a.primaryObjectId).slice(0, Math.min(g.maxModifiers, C.length));
    for (const [m, x] of L.entries()) {
      const k = (U = u.objects.get(x)) == null ? void 0 : U.element;
      if (!k || !k.isConnected) continue;
      const M = k.getBoundingClientRect(), E = C[m];
      if (!E) continue;
      const P = k.cloneNode(!0);
      Object.assign(P.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: `${M.width}px`,
        height: `${M.height}px`,
        margin: "0",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: String(1 - m),
        opacity: "1",
        willChange: "transform, opacity",
        backdropFilter: m === 0 ? "blur(6px) saturate(1.15)" : "none",
        WebkitBackdropFilter: m === 0 ? "blur(6px) saturate(1.15)" : "none",
        transform: `${(f == null ? void 0 : f.transform) ?? (f ? "translateX(-50%)" : "")}${f ? " " : ""}translate3d(${E.spread.x}px, ${E.spread.y}px, 0) rotateZ(${E.spread.rotate}deg) scale(${E.spread.scale})`,
        transformOrigin: "center center"
      }), rt(P, f), P.dataset.runtimeGroupModifier = "true", delete P.dataset.runtimeGroupGhost, h.insertBefore(P, l), v.push(P), y.push({ element: P, spread: E.spread, tight: E.tight });
    }
    let S = null;
    const I = performance.now(), T = (m) => {
      const x = Math.min(1, (m - I) / g.foldDuration), k = 1 - Math.pow(1 - x, 2);
      for (const M of y) {
        const E = M.spread.x + (M.tight.x - M.spread.x) * k, P = M.spread.y + (M.tight.y - M.spread.y) * k, Q = M.spread.rotate + (M.tight.rotate - M.spread.rotate) * k, ee = M.spread.scale + (M.tight.scale - M.spread.scale) * k, te = f ? f.transform ?? "translateX(-50%)" : "";
        M.element.style.transform = `${te} translate3d(${E.toFixed(2)}px, ${P.toFixed(2)}px, 0) rotateZ(${Q.toFixed(2)}deg) scale(${ee.toFixed(4)})`;
      }
      x < 1 ? S = requestAnimationFrame(T) : S = null;
    };
    y.length && (S = requestAnimationFrame(T));
    let w = !1, R = null;
    const z = () => {
      if (!w) {
        w = !0, S !== null && (cancelAnimationFrame(S), S = null);
        for (const m of v)
          m.style.transition = `opacity ${g.modifierFadeDuration}ms ease`, m.style.opacity = "0";
        R = window.setTimeout(() => {
          for (const m of v) m.remove();
          R = null;
        }, g.modifierFadeDuration + 20);
      }
    }, H = (m) => {
      for (const x of b)
        x.element.isConnected && (x.element.style.transition = `opacity ${m}ms cubic-bezier(.22,1,.36,1)`, x.element.style.opacity = x.opacity);
    }, O = () => {
      S !== null && cancelAnimationFrame(S), R !== null && window.clearTimeout(R);
      for (const m of v) m.remove();
      for (const m of b)
        m.element.isConnected && (m.element.style.cssText = m.cssText, m.marker === void 0 ? delete m.element.dataset.runtimeGroupGhost : m.element.dataset.runtimeGroupGhost = m.marker);
    };
    t.set(c.element, { modifiers: v, dismissModifiers: z, restoreGhosts: H, cleanup: O });
  }
  return {
    resolveSource: (r = e.resolveSource) == null ? void 0 : r.bind(e),
    resolveTarget: (i = e.resolveTarget) == null ? void 0 : i.bind(e),
    captureVisualState: (n = e.captureVisualState) == null ? void 0 : n.bind(e),
    applyState: (o = e.applyState) == null ? void 0 : o.bind(e),
    createProxy(c) {
      var a;
      const d = (a = e.createProxy) == null ? void 0 : a.call(e, c);
      if (!d) throw new Error("group visual requires a base proxy");
      return s(d, c), d;
    },
    updateProxy(c, d) {
      var a;
      (a = e.updateProxy) == null || a.call(e, c, d), s(c, d);
    },
    land: (c, d, a) => {
      var h, p, g, f, b;
      const l = t.get(c.element);
      if (!a.group || !l) return (h = e.land) == null ? void 0 : h.call(e, c, d, a);
      if (l.dismissModifiers(), a.landingMode !== "target") {
        const y = ((g = (p = a.motion) == null ? void 0 : p.landing) == null ? void 0 : g.duration) ?? 420;
        l.restoreGhosts(y);
        const v = a.targetSnapshot ? { ...a.targetSnapshot, opacity: "0" } : void 0;
        return (f = e.land) == null ? void 0 : f.call(e, c, d, { ...a, targetSnapshot: v });
      }
      return (b = e.land) == null ? void 0 : b.call(e, c, d, a);
    },
    reveal: (c, d, a) => {
      var l;
      return (l = e.reveal) == null ? void 0 : l.call(e, c, d, a);
    },
    dispose: (c, d) => {
      var a, l;
      (a = t.get(c.element)) == null || a.cleanup(), t.delete(c.element), (l = e.dispose) == null || l.call(e, c, d);
    }
  };
}
function nt(u, e = {}) {
  const t = e.edgeSize ?? 48, s = e.maxSpeed ?? 16;
  let r = null, i = null, n = null, o = !1, c = null, d = 0, a = null, l = null, h = null;
  const p = () => {
    if (!r || !r.isConnected) {
      c = null;
      return;
    }
    c = r.getBoundingClientRect(), d = 0;
  }, g = (v) => {
    if (a !== v) {
      if (l == null || l.disconnect(), a = v, !v || typeof ResizeObserver > "u") {
        l = null;
        return;
      }
      l = new ResizeObserver(p), l.observe(v);
    }
  }, f = (v, j) => {
    const C = (t - v) / t;
    return Math.ceil(s * C * (j * 60));
  }, b = (v) => {
    var I, T;
    if (o) return;
    n = requestAnimationFrame(b);
    const j = Math.min(0.05, Math.max(0, (v - (h ?? v)) / 1e3));
    if (h = v, !r || !i || !r.isConnected) return;
    (!c || d++ >= 8) && p();
    const C = c;
    if (!C || i.x < C.left || i.x > C.right) return;
    const L = i.y - C.top, S = C.bottom - i.y;
    if (L < t) {
      const w = r.scrollTop;
      r.scrollTop -= f(L, j), r.scrollTop !== w && ((I = e.onScroll) == null || I.call(e, i));
    } else if (S < t) {
      const w = r.scrollTop;
      r.scrollTop += f(S, j), r.scrollTop !== w && ((T = e.onScroll) == null || T.call(e, i));
    }
  }, y = () => {
    o || (o = !0, n !== null && cancelAnimationFrame(n), n = null, l == null || l.disconnect(), l = null, a = null, c = null);
  };
  return n = requestAnimationFrame(b), u.track(y), {
    update(v, j) {
      o || (r !== v && (c = null, d = 0, g(v)), r = v, i = j, c === null && p());
    },
    stop: y
  };
}
class ot {
  constructor() {
    this.owner = new Me(), this.objects = new Ie(), this.surfaces = new Oe(), this.targets = new Te(), this.behaviors = new Ae(), this.registry = new $e(), this.hitResolver = null, this.sessionCoordinator = new ze(), this.runtimeSession = new He(this.sessionCoordinator), this.events = new G(), this.actions = new G(), this.visualProxyCoordinator = new Je(), this.groupVisualAdapters = /* @__PURE__ */ new Map(), this.surfaceScrollFrames = /* @__PURE__ */ new WeakMap(), this.defaultVisualAdapter = new F(this), this.moveBehavior = new B(), this.inputCoordinator = new et({
      objects: this.objects,
      registry: this.registry,
      startObjectPointer: (e, t, s) => this.startObjectPointer(e, t, s),
      registerRegrab: (e, t) => this.registerRegrab(e, t),
      regrab: (e, t) => this.regrab(e, t),
      update: (e, t) => this.update(e, t),
      release: (e, t) => this.release(e, t)
    }), this.moveActions = new Xe({
      getObjectSurface: (e) => {
        var t;
        return (t = this.objects.get(e)) == null ? void 0 : t.surfaceId;
      },
      getGroup: (e) => {
        const t = this.sessionCoordinator.snapshot().find((s) => s.hasObject(e));
        if (t instanceof q)
          return { primaryObjectId: t.primaryObjectId, objectIds: t.objectIds };
      },
      emit: (e) => this.actions.emitAsync(e)
    }), this.moveCommit = new Ne({
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
    }, this.moveActions), this.moveLanding = new Ue({
      createContext: (e) => this.createBehaviorContext(e),
      getSession: (e) => this.sessionCoordinator.get(e),
      cancel: (e, t) => this.cancel(e, t),
      end: (e) => this.endSession(e)
    }), this.runtimeMove = N.fromPorts({
      getSession: (e) => this.sessionCoordinator.get(e),
      getBehavior: (e) => this.behaviors.get(e),
      createContext: (e) => this.createBehaviorContext(this.sessionCoordinator.get(e))
    }, this.moveCommit, this.moveLanding), this.visualState = new Ze({ getAdapter: (e) => this.getObjectVisualAdapter(e) }), this.visualMotion = new Ke({
      getSession: (e) => this.sessionCoordinator.get(e),
      getAdapter: (e) => this.getObjectVisualAdapter(e),
      getGroupAdapter: (e) => this.getObjectGroupVisualAdapter(e),
      createContext: (e, t, s) => this.createVisualLifecycleContext(e, t, s)
    }, this.visualProxyCoordinator), this.dispatcher = new tt({
      start: (e) => this.startInternal(e),
      update: (e, t) => this.updateInternal(e, t),
      release: (e, t) => this.releaseInternal(e, t),
      cancel: (e, t) => this.cancelInternal(e, t),
      interrupt: (e, t) => this.interruptInternal(e, t)
    }), this.behaviors.register(this.moveBehavior), Y(this.registry.motionProfile), this.objects.subscribe((e) => {
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
    const { id: r, element: i, ...n } = t.target, o = i ?? t.element;
    if (this.targets.get(s)) {
      this.targets.update(s, n), this.targets.setElement(s, o ?? null);
      return;
    }
    this.targets.register({ ...n, id: s, element: o ?? null });
  }
  configureMotion(e) {
    const { profile: t, controller: s, ...r } = e, i = t ?? (Object.keys(r).length ? r : void 0);
    i && this.registry.setMotionProfile(i), s && (this.registry.setMotionController(s), s.follow && Object.assign(fe.position, s.follow), s.rotation && Object.assign(me, s.rotation), s.release && Object.assign($, s.release)), Y(this.registry.motionProfile);
  }
  /** 配置 Runtime 默认代理视觉；业务也可以完全关闭并由 VisualAdapter 自行绘制。 */
  configureVisual(e) {
    e.dragGlass !== void 0 && ve(e.dragGlass), e.layoutPresence !== void 0 && ye(e.layoutPresence);
  }
  getMotionProfile() {
    return this.registry.motionProfile;
  }
  /**
   * 返回与矩形相交的已注册对象。
   * Runtime 只负责对象命中计算，选择状态仍由业务保存；代理节点、断开节点和
   * 不可见节点不会进入结果，避免框选把落地代理或隐藏列表项带进来。
   */
  getObjectsInRect(e, t) {
    return [...this.objects.values()].filter((s) => s.surfaceId === e).filter((s) => {
      const r = s.element;
      if (!(r != null && r.isConnected) || r.dataset.runtimeProxy === "true") return !1;
      const i = r.getBoundingClientRect();
      return i.width <= 0 || i.height <= 0 ? !1 : i.left < t.right && i.right > t.left && i.top < t.bottom && i.bottom > t.top;
    }).map((s) => s.id);
  }
  startObjectPointer(e, t, s, r, i) {
    if (this.getRegrab(e))
      return this.startObjectPointerInSession(e, t, s, r, i);
    const n = this.objects.get(e);
    if (n != null && n.selected) {
      const o = [...this.objects.values()].filter((c) => {
        var d;
        return c.selected && c.surfaceId === n.surfaceId && ((d = c.element) == null ? void 0 : d.isConnected) && c.abilities.includes("move");
      }).map((c) => c.id);
      if (o.length > 1)
        return this.startGroupObjectPointer(o, e, t, s, r, i);
    }
    return this.startObjectPointerInSession(e, t, s, r, i);
  }
  /**
   * 以一个主卡启动多对象移动。主卡仍复用单卡 MoveBehavior，GroupDragSession
   * 负责其余对象的 ownership 和批量 Action；视觉适配器可以据 objectIds 创建
   * 主代理及修饰代理。
   */
  startGroupObjectPointer(e, t, s, r, i, n) {
    var h;
    const o = [...new Set(e)];
    if (o.length < 2 || !o.includes(t)) return !1;
    const c = s.getBoundingClientRect(), d = /* @__PURE__ */ new Map();
    for (const p of o) {
      const g = (h = this.objects.get(p)) == null ? void 0 : h.element;
      if (!g) continue;
      const f = g.getBoundingClientRect();
      d.set(p, { x: f.left - c.left, y: f.top - c.top });
    }
    const a = this.startGroupSession(o, t, { offsets: d });
    a.takeObjects();
    const l = this.startObjectPointerInSession(t, s, r, i, n, a.id);
    return l || a.cancel(), l;
  }
  startObjectPointerInSession(e, t, s, r, i, n) {
    var g;
    const o = this.getRegrab(e);
    if (o)
      return o(s), !0;
    const c = this.objects.get(e);
    if (!c) return !1;
    const d = this.registry.objectTypes.get(c.visual ?? c.type);
    if (!d) return !1;
    c.element !== t && this.objects.setElement(e, t);
    const a = {
      objectId: e,
      element: t,
      event: s,
      mode: c.visualMode ?? d.defaultVisualMode,
      fromRect: r,
      returnRect: i
    }, p = ((g = d.visual) == null ? void 0 : g.createMove) ?? d.createMove ?? (() => this.defaultVisualAdapter.createMove(a));
    if (p) {
      const f = p(a);
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
  /** 按对象类型读取运动策略；未显式关闭（`motion.enabled !== false`）时默认使用 MotionController。 */
  getObjectMotionEnabled(e) {
    var r;
    const t = this.objects.get(e), s = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
    return ((r = s == null ? void 0 : s.motion) == null ? void 0 : r.enabled) !== !1;
  }
  /** 按对象注册解析抓取代理布局，供 detach 浮动入口与生命周期入口共用。 */
  getObjectProxyLayout(e, t) {
    var o;
    const s = this.objects.get(e), r = s ? this.registry.objectTypes.get(s.visual ?? s.type) : void 0, i = r == null ? void 0 : r.proxyLayout, n = t ?? (s == null ? void 0 : s.element) ?? void 0;
    if (!((o = i == null ? void 0 : i.compact) != null && o.selector) || n != null && n.matches(i.compact.selector)) return i;
  }
  getObjectVisualAdapter(e) {
    const t = this.objects.get(e), s = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
    return s != null && s.visual ? s.visual : this.getVisualAdapter((t == null ? void 0 : t.visual) ?? (t == null ? void 0 : t.type) ?? "");
  }
  getObjectGroupVisualAdapter(e) {
    const t = this.objects.get(e), s = (t == null ? void 0 : t.visual) ?? (t == null ? void 0 : t.type), r = s ? this.registry.objectTypes.get(s) : void 0, i = r == null ? void 0 : r.groupVisual;
    if (i === "none") return;
    if (i && i !== "default") return i;
    if (!s) return;
    const n = this.groupVisualAdapters.get(s);
    if (n) return n;
    const o = it(this, this.getObjectVisualAdapter(e));
    return this.groupVisualAdapters.set(s, o), o;
  }
  createVisualLifecycleContext(e, t, s, r) {
    var y, v, j, C, L, S, I, T;
    const i = this.sessionCoordinator.get(e), n = i ? this.objects.get(i.objectId) : void 0, o = (n == null ? void 0 : n.element) ?? void 0, c = i ? this.getObjectVisualAdapter(i.objectId) : this.defaultVisualAdapter, d = new F(), a = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, l = (y = a == null ? void 0 : a.motion) == null ? void 0 : y.profile, h = this.registry.motionProfile, p = l || h ? {
      ...h,
      ...l,
      flip: { ...h == null ? void 0 : h.flip, ...l == null ? void 0 : l.flip },
      resize: { ...h == null ? void 0 : h.resize, ...l == null ? void 0 : l.resize },
      landing: { ...h == null ? void 0 : h.landing, ...l == null ? void 0 : l.landing },
      target: {
        ...h == null ? void 0 : h.target,
        ...l == null ? void 0 : l.target,
        motion: { ...(v = h == null ? void 0 : h.target) == null ? void 0 : v.motion, ...(j = l == null ? void 0 : l.target) == null ? void 0 : j.motion },
        landing: { ...(C = h == null ? void 0 : h.target) == null ? void 0 : C.landing, ...(L = l == null ? void 0 : l.target) == null ? void 0 : L.landing },
        dismiss: { ...(S = h == null ? void 0 : h.target) == null ? void 0 : S.dismiss, ...(I = l == null ? void 0 : l.target) == null ? void 0 : I.dismiss }
      },
      group: { ...h == null ? void 0 : h.group, ...l == null ? void 0 : l.group }
    } : void 0, g = typeof t == "object" && t !== null && t.invalidReturn === !0, f = !!(s && o && s === o), b = this.getObjectProxyLayout((i == null ? void 0 : i.objectId) ?? "", o);
    return {
      objectId: (i == null ? void 0 : i.objectId) ?? "",
      sessionId: e,
      mode: (n == null ? void 0 : n.visualMode) ?? "detach",
      destination: t,
      sourceElement: o,
      beforeContent: r,
      targetElement: s,
      sourceRect: o == null ? void 0 : o.getBoundingClientRect(),
      visualSnapshot: o ? (c.captureVisualState ?? d.captureVisualState)(o) : void 0,
      targetSnapshot: s ? (c.captureVisualState ?? d.captureVisualState)(s) : void 0,
      preserveTarget: (a == null ? void 0 : a.preserveMoveTarget) ?? !1,
      // 无效落点是回到原位，不是飞入语义目标；即使对象类型配置了
      // target landing，也必须保留普通 landing 的完整回位表现。
      landingMode: !g && !f && (a == null ? void 0 : a.landingMode) === "target" ? "target" : "default",
      disableTargetVisualMorph: (a == null ? void 0 : a.disableTargetVisualMorph) ?? !1,
      landingBounds: () => {
        const w = this.getDestinationSurfaceId(t), R = w ? this.resolveMoveSurfaceViewport(w) : null;
        return R && s && !R.contains(s) ? null : (R == null ? void 0 : R.getBoundingClientRect()) ?? null;
      },
      motion: p,
      motionEnabled: (T = a == null ? void 0 : a.motion) == null ? void 0 : T.enabled,
      proxyLayout: b,
      groupDrag: a == null ? void 0 : a.groupDrag,
      group: i instanceof q ? {
        primaryObjectId: i.primaryObjectId,
        objectIds: i.objectIds,
        offsets: new Map(i.objectIds.map((w) => [w, i.offsetFor(w)]).filter((w) => !!w[1]))
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
    var i;
    const t = this.visualProxyCoordinator.get(e);
    if (!t) return;
    const s = this.sessionCoordinator.get(e);
    let r = !1;
    if (s) {
      const n = this.createVisualLifecycleContext(e), o = n.group ? this.getObjectGroupVisualAdapter(s.objectId) ?? this.getObjectVisualAdapter(s.objectId) : this.getObjectVisualAdapter(s.objectId);
      o.dispose && (o.dispose(t, n), r = !0);
    }
    r || (i = t.dispose) == null || i.call(t), this.visualProxyCoordinator.remove(e);
  }
  createCompletionGate(e, t) {
    let s = !1, r;
    const n = {
      promise: new Promise((o) => {
        r = o;
      }),
      complete: (o) => {
        s || (s = !0, r(o), this.sessionCoordinator.removeGate(e, n));
      },
      fail: () => {
        s || (s = !0, r(t), this.sessionCoordinator.removeGate(e, n));
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
    return De(this.objects, this.surfaces, this.targets, e);
  }
  /** 将自定义或注册表默认命中统一归一成业务无关的 Surface id 与插入索引。 */
  resolveMoveHit(e, t, s) {
    var d;
    const r = this.objects.get(e), i = r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0, n = (d = i == null ? void 0 : i.resolveMoveHit) == null ? void 0 : d.call(i, { objectId: e, x: t, y: s });
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
    var i;
    if (this.hitResolver) return this.hitResolver.findSurface({ x: t, y: s });
    const r = this.createRegisteredHitResolver(e).findSurface({ x: t, y: s });
    return ((i = r == null ? void 0 : r.viewport) == null ? void 0 : i.call(r)) ?? (r == null ? void 0 : r.element) ?? null;
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
    return s ? nt(s.cleanup, t) : null;
  }
  /**
   * 将落地目标滚动到注册 Surface 的可视范围内。
   *
   * 松手后的滚动由 Runtime 用 rAF 驱动，时长跟 landing 基准时长一致，
   * 不再交给浏览器的原生 smooth scroll。这样代理从松手立即开始飞行时，
   * 容器滚动不会比代理慢一大截，避免代理先完成并被销毁而容器仍在滚动。
   */
  keepSurfaceTargetVisible(e, t) {
    var h, p;
    const s = this.resolveMoveSurfaceViewport(e);
    if (!s || !t.isConnected || !s.contains(t)) return;
    const r = this.surfaceScrollFrames.get(s);
    r !== void 0 && (cancelAnimationFrame(r), this.surfaceScrollFrames.delete(s));
    const i = () => {
      const g = s.getBoundingClientRect(), f = t.getBoundingClientRect(), b = f.top < g.top ? s.scrollTop - (g.top - f.top) : f.bottom > g.bottom ? s.scrollTop + (f.bottom - g.bottom) : s.scrollTop, y = Math.max(0, s.scrollHeight - s.clientHeight);
      return Math.max(0, Math.min(b, y));
    };
    let n = i();
    if (Math.abs(n - s.scrollTop) < 0.5) return;
    const o = s.scrollTop, c = Math.max(200, ((p = (h = this.registry.motionProfile) == null ? void 0 : h.landing) == null ? void 0 : p.duration) ?? 250);
    if (typeof requestAnimationFrame > "u") {
      s.scrollTop = n;
      return;
    }
    const d = performance.now(), a = (g) => {
      const f = Math.min(1, (g - d) / c), b = 1 - (1 - f) ** 3;
      if (n = i(), s.scrollTop = o + (n - o) * b, f >= 1 && (s.scrollTop = n), f >= 1) {
        this.surfaceScrollFrames.delete(s);
        return;
      }
      const y = requestAnimationFrame(a);
      this.surfaceScrollFrames.set(s, y);
    }, l = requestAnimationFrame(a);
    this.surfaceScrollFrames.set(s, l);
  }
  /** 已注册对象按屏幕布局排序后的索引，不依赖业务 DOM 的 data 属性。 */
  getObjectSurfaceIndex(e, t) {
    const s = this.objects.get(e), r = t ?? (s == null ? void 0 : s.surfaceId);
    return !s || !r ? -1 : [...this.objects.values()].filter((i) => i.surfaceId === r).map((i) => i.id).sort((i, n) => {
      var d, a, l, h;
      const o = (a = (d = this.objects.get(i)) == null ? void 0 : d.element) == null ? void 0 : a.getBoundingClientRect(), c = (h = (l = this.objects.get(n)) == null ? void 0 : l.element) == null ? void 0 : h.getBoundingClientRect();
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
    !(s instanceof B) || !t || s.captureLayout(this.createBehaviorContext(t));
  }
  /** 由 Runtime 统一播放移动事务的布局 FLIP。 */
  playMoveLayout(e, t = !1) {
    const s = this.sessionCoordinator.get(e), r = s ? this.behaviors.get(s.type) : void 0;
    !(r instanceof B) || !s || r.playLayout(this.createBehaviorContext(s), t);
  }
  /** 捕获 Runtime 管理的 Surface / group / collection 布局快照。 */
  captureLayout(e, t = document, s = !0, r) {
    return be(e, t, s, r);
  }
  /** 按统一时序播放布局快照；列尾追加可选择等待 Vue patch 的下一帧。 */
  scheduleLayout(e, t = !1) {
    t ? Ce(e) : Se(e);
  }
  /** 统一编排组展开/收起、容器 resize、兄弟 FLIP 与可选 presence。 */
  runGroupToggle(e) {
    return we(e);
  }
  /** 组件卸载/弹窗关闭时取消根节点下尚未完成的布局动画。 */
  cancelLayoutAnimations(e) {
    je(e);
  }
  resolveMoveTarget(e, t, s) {
    var g, f, b, y;
    const r = this.sessionCoordinator.get(e);
    if (!r) return null;
    const i = this.createBehaviorContext(r), n = this.objects.get(r.objectId), o = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, c = (g = o == null ? void 0 : o.resolveMoveTarget) == null ? void 0 : g.call(o, { objectId: r.objectId, destination: t }), d = (b = (f = i.visual) == null ? void 0 : f.resolveTarget) == null ? void 0 : b.call(f, r.objectId, t), a = s == null ? void 0 : s(), l = (y = this.objects.get(r.objectId)) == null ? void 0 : y.element, h = this.targets.findForSurface(this.getDestinationSurfaceId(t) ?? "", n == null ? void 0 : n.type), p = c ?? d ?? a ?? (h == null ? void 0 : h.element) ?? l ?? null;
    return !p || !p.isConnected ? null : (this.moveBehavior.getContext(e).transaction.target = p, p);
  }
  resolveMoveLandingTarget(e, t, s) {
    var l;
    const r = this.sessionCoordinator.get(e);
    if (!r) return null;
    const i = this.objects.get(r.objectId), n = i ? this.registry.objectTypes.get(i.visual ?? i.type) : void 0, o = (l = n == null ? void 0 : n.resolveMoveLandingTarget) == null ? void 0 : l.call(n, { objectId: r.objectId, destination: t }), c = (s == null ? void 0 : s()) ?? null, d = this.targets.findForSurface(this.getDestinationSurfaceId(t) ?? "", i == null ? void 0 : i.type), a = o ?? c ?? (d == null ? void 0 : d.element) ?? this.resolveMoveTarget(e, t);
    return !a || !a.isConnected ? null : a;
  }
  /**
   * 统一取得 landing 交接目标：先尝试当前帧的同步目标，再等待业务 Action
   * 触发的 DOM 重渲染。视觉 adapter 不需要再组合这两个阶段，也不会各自
   * 实现一套跨 Surface 的等待规则。
   */
  async resolveLandingTarget(e, t, s = 6) {
    const r = this.resolveMoveLandingTarget(e, t);
    if (r) {
      const i = r.getBoundingClientRect();
      if (i.width > 0 && i.height > 0)
        return r;
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
    var p, g;
    const r = this.sessionCoordinator.get(e);
    if (!r) return null;
    const i = this.moveBehavior.getContext(e);
    i.sourceElement;
    const n = this.getDestinationSurfaceId(t), o = this.objects.get(r.objectId), c = o ? this.registry.objectTypes.get(o.visual ?? o.type) : void 0, d = !!(c != null && c.resolveMoveLandingTarget), a = i.transaction.destination, l = typeof (a == null ? void 0 : a.fromSurfaceId) == "string" ? a.fromSurfaceId : null, h = !!n && n !== l;
    for (let f = 0; f < s; f += 1) {
      const b = this.sessionCoordinator.get(e);
      if (b !== r || b.state === "disposed" || b.state === "interrupt") return null;
      const y = this.resolveMoveLandingTarget(e, t), v = y == null ? void 0 : y.getBoundingClientRect(), j = !!(v && v.width > 0 && v.height > 0), C = d || !n || (o == null ? void 0 : o.surfaceId) === n, L = d || (n && y ? ((g = (p = this.surfaces.get(n)) == null ? void 0 : p.element) == null ? void 0 : g.contains(y)) ?? !1 : !1);
      if (y && j && C && (d || (h ? L : !0))) return y;
      await new Promise((I) => requestAnimationFrame(() => I()));
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
  bindRegrabTarget(e, t, s, r) {
    const i = this.sessionCoordinator.get(e);
    i && this.inputCoordinator.bindRegrabTarget(i, t, s, r);
  }
  createRegrabContext(e, t, s, r) {
    const i = this.sessionCoordinator.get(e);
    if (!i || i.state !== "landing") return null;
    const n = s.getBoundingClientRect(), o = r.getBoundingClientRect(), c = r.offsetWidth || o.width, d = r.offsetHeight || o.height, a = new DOMRect(n.left, n.top, c, d);
    return {
      sessionId: e,
      objectId: i.objectId,
      event: t,
      proxyElement: s,
      sourceElement: r,
      proxyRect: n,
      regrabRect: a,
      interrupt: (l) => this.interrupt(e, l ?? "regrab")
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
  trackLandingTarget(e, t, s, r = {}) {
    const i = this.sessionCoordinator.get(e);
    return i ? this.visualState.trackTarget(i.cleanup, t, s, r) : () => {
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
    const r = this.getMoveContext(s.id);
    if (t.followElement !== void 0 && (r.followElement = t.followElement), t.driver && this.bindMoveSession(s.id, t.driver), t.lifecycle ? this.bindMoveLifecycle(s.id, t.lifecycle) : t.visualStrategy && this.bindMoveLifecycle(s.id, t.visualStrategy), t.sessionId && t.prepareExisting) {
      const n = this.behaviors.get(s.type);
      if (n instanceof B)
        try {
          n.prepare(this.createBehaviorContext(s), e), s.state === "prepare" && s.transition("active");
        } catch (o) {
          this.cancel(s.id, o instanceof Error ? o.message : "prepare-failed");
        }
    }
    const i = this.bindPointerSessionInput(s.id, t.pointerInput);
    return {
      id: s.id,
      get state() {
        return s.state;
      },
      get moveContext() {
        return r;
      },
      cancel: (n) => this.cancel(s.id, n ?? "cancelled"),
      interrupt: (n) => this.interrupt(s.id, n ?? "interrupted"),
      dispose: () => {
        i();
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
      getSession: (r) => this.sessionCoordinator.get(r),
      getBehavior: (r) => this.behaviors.get(r),
      createContext: (r) => this.createBehaviorContext(r),
      captureLayout: (r) => this.captureMoveLayout(r),
      playLayout: (r, i) => this.playMoveLayout(r, i),
      cancel: (r, i) => this.cancel(r, i),
      end: (r) => this.endSession(r)
    };
    return this.runtimeMove.release(e, t, s);
  }
  cancel(e, t = "cancelled") {
    this.dispatcher.cancel(e, t);
  }
  cancelInternal(e, t = "cancelled") {
    const s = this.sessionCoordinator.get(e);
    if (!s) return;
    const r = this.behaviors.get(s.type), i = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      r,
      i,
      t,
      "cancel",
      (n, o, c) => {
        var d;
        n instanceof B && n.cancelLayout(o, c), (d = n == null ? void 0 : n.cancel) == null || d.call(n, o, c);
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
    const r = this.behaviors.get(s.type), i = this.createBehaviorContext(s);
    this.runtimeSession.terminate(
      s,
      r,
      i,
      t,
      "interrupt",
      (n, o, c) => {
        var d;
        n instanceof B && n.cancelLayout(o, c), (d = n == null ? void 0 : n.interrupt) == null || d.call(n, o, c);
      },
      (n) => this.failCompletionGates(n.id),
      (n, o) => this.disposeBehavior(n, o)
    );
  }
  startSession(e, t = "") {
    return this.sessionCoordinator.create(e, t, this.owner);
  }
  startGroupSession(e, t, s = {}) {
    const r = new q(e, t, this.owner, s);
    return this.sessionCoordinator.set(r), r;
  }
  getSession(e) {
    return this.sessionCoordinator.get(e);
  }
  /** 返回多对象会话的公开元数据，供视觉层决定源节点占位策略。 */
  getGroup(e) {
    const t = this.sessionCoordinator.get(e);
    if (t instanceof q)
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
    const t = this.behaviors.get(e.type), s = this.createBehaviorContext(e);
    this.runtimeSession.finalize(
      e,
      t,
      s,
      (r) => this.disposeVisualProxy(r),
      (r, i) => this.disposeBehavior(r, i)
    );
  }
  failCompletionGates(e) {
    this.sessionCoordinator.failGates(e), this.disposeVisualProxy(e);
  }
  disposeBehavior(e, t) {
    var s, r, i, n;
    try {
      e instanceof B && ((i = (r = (s = e.getLifecycle(t.session.id)) == null ? void 0 : s.surface) == null ? void 0 : r.dispose) == null || i.call(r, t)), (n = e == null ? void 0 : e.dispose) == null || n.call(e, t);
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
const ct = new ot();
function K(u) {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
  return {
    bindObject(i, n) {
      const o = u.objects.get(i);
      if (o) {
        if (n === null) {
          const c = e.get(i);
          if (c && o.element !== c) return;
          e.delete(i);
        } else
          e.set(i, n);
        u.objects.setElement(i, n);
      }
    },
    bindSurface(i, n) {
      const o = u.surfaces.get(i);
      if (o) {
        if (n === null) {
          const c = t.get(i);
          if (c && o.element !== c) return;
          t.delete(i);
        } else
          t.set(i, n);
        u.surfaces.setElement(i, n);
      }
    },
    bindTarget(i, n, o) {
      const c = s.get(i) ?? n.id ?? `runtime-target:${i}`;
      if (s.set(i, c), !o) {
        const d = r.get(i), a = u.targets.get(c);
        if (d && (a == null ? void 0 : a.element) !== d) return;
        r.delete(i), u.targets.unregister(c), s.delete(i);
        return;
      }
      r.set(i, o), u.targets.register({ ...n, id: c, element: o });
    },
    getSurfaceElement(i) {
      var n;
      return ((n = u.surfaces.get(i)) == null ? void 0 : n.element) ?? null;
    },
    async runLayoutMutation(i) {
      var o;
      const n = i.elements.length > 0 ? u.captureLayout(i.elements, i.root, !0) : null;
      await i.mutate(), await ((o = i.waitForPatch) == null ? void 0 : o.call(i)), n && u.scheduleLayout(n);
    },
    dispose() {
      for (const i of s.values()) u.targets.unregister(i);
      e.clear(), t.clear(), s.clear(), r.clear();
    }
  };
}
function lt(u) {
  return K(u);
}
function ut(u) {
  return K(u);
}
function Z(u, e) {
  const t = u.getBoundingClientRect();
  return e.x >= t.left && e.x <= t.right && e.y >= t.top && e.y <= t.bottom;
}
function dt(u) {
  return {
    findSurface(e) {
      return Array.from(document.querySelectorAll(u.surfaceSelector)).find((t) => Z(t, e)) ?? null;
    },
    findTarget(e, t, s) {
      return Array.from(e.querySelectorAll(u.targetSelector)).filter((r) => r.dataset.card !== s).find((r) => Z(r, t)) ?? null;
    },
    findIndex(e, t, s) {
      const r = Array.from(e.querySelectorAll(u.targetSelector)).filter((i) => i.dataset.card !== s);
      for (let i = 0; i < r.length; i += 1) {
        const n = r[i].getBoundingClientRect();
        if (t.y < n.top + n.height / 2) return i;
      }
      return r.length;
    }
  };
}
function ht(u, e, t, s) {
  const r = u.findSurface({ x: e, y: t });
  if (!r) return null;
  const i = r.dataset.column;
  if (!i) return null;
  const n = u.findIndex(r, { x: e, y: t }, s);
  return { columnId: i, index: n };
}
export {
  D as DEFAULT_GROUP_DRAG_CONFIG,
  $ as DEFAULT_RELEASE_PROFILE,
  F as DefaultVisualAdapter,
  fe as FOLLOW_PROFILE,
  me as FOLLOW_ROTATION,
  q as GroupDragSession,
  ft as LANDING_PROFILE,
  Xe as MoveActionCoordinator,
  B as MoveBehavior,
  Ne as MoveCommitCoordinator,
  Ue as MoveLandingCoordinator,
  We as MoveReleaseCoordinator,
  ke as MoveTransaction,
  _e as MoveUpdateCoordinator,
  Ie as ObjectStore,
  ot as Runtime,
  tt as RuntimeDispatcher,
  et as RuntimeInputCoordinator,
  N as RuntimeMoveCoordinator,
  $e as RuntimeRegistry,
  He as RuntimeSessionCoordinator,
  J as Session,
  ze as SessionCoordinator,
  Oe as SurfaceStore,
  Te as TargetStore,
  Ge as VisualAdapters,
  Ke as VisualMotionCoordinator,
  Je as VisualProxyCoordinator,
  Ze as VisualStateCoordinator,
  mt as acquireSourceVisualLease,
  Qe as bindPointerSessionInput,
  je as cancelLayoutAnimations,
  vt as captureCollectionPresence,
  be as captureLayoutFlip,
  yt as coastOffset,
  bt as createCardMotionController,
  ue as createDetachMoveFromAdapter,
  dt as createDomHitResolver,
  it as createGroupVisualAdapter,
  ut as createReactRuntimeAdapter,
  De as createRegisteredHitResolver,
  lt as createVueRuntimeAdapter,
  ht as hitWithResolver,
  Ct as integrateSpring,
  St as playCollectionPresence,
  wt as playLayoutFlip,
  st as resolveGroupDragConfig,
  we as runGroupToggle,
  ct as runtime,
  ye as setLayoutPresenceEnabled,
  jt as shapeReleaseVelocity,
  Ye as trackLandingTarget,
  Mt as transitionGroupHeight
};
