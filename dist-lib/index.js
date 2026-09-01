import { _ as e, a as t, c as n, d as r, f as i, g as a, h as o, i as s, l as c, m as l, n as u, o as d, p as f, r as p, s as m, t as h, u as g, v as _, y as v } from "./GroupLayout-DZr40zZY.js";
import { C as y, D as b, E as x, O as S, S as C, T as w, _ as T, a as E, b as D, c as O, d as ee, f as te, g as k, h as A, i as j, l as M, m as N, n as P, o as F, p as ne, r as re, s as ie, t as ae, u as oe, v as se, w as ce, x as le, y as ue } from "./MoveAdapter-DNRA5ohW.js";
//#region src/core/Emitter.ts
var I = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
	}
	subscribe(e) {
		return this.listeners.add(e), () => this.listeners.delete(e);
	}
	emit(e) {
		this.listeners.forEach((t) => t(e));
	}
	async emitAsync(e) {
		await Promise.all([...this.listeners].map((t) => Promise.resolve(t(e))));
	}
}, de = class {
	constructor() {
		this.controlled = /* @__PURE__ */ new Map(), this.channelOwners = /* @__PURE__ */ new Map(), this.events = new I();
	}
	subscribe(e) {
		return this.events.subscribe(e);
	}
	takeObject(e, t) {
		this.controlled.set(e, {
			mode: "runtime",
			ownerSessionId: t
		}), this.events.emit(e);
		let n = !1;
		return { release: () => {
			n || (n = !0, this.controlled.get(e)?.ownerSessionId === t && (this.controlled.delete(e), this.events.emit(e)));
		} };
	}
	takeSurface(e, t) {
		let n = this.controlled.get(e);
		return n && n.ownerSessionId !== t ? { release: () => void 0 } : this.takeObject(e, t);
	}
	isControlled(e) {
		return this.controlled.get(e)?.mode === "runtime";
	}
	isOwnedBy(e, t) {
		return this.controlled.get(e)?.ownerSessionId === t;
	}
	takeChannel(e, t, n) {
		let r = this.channelOwners.get(e);
		r || (r = /* @__PURE__ */ new Map(), this.channelOwners.set(e, r)), r.set(t, n);
		let i = !1;
		return { release: () => {
			i || (i = !0, r.get(t) === n && (r.delete(t), r.size === 0 && this.channelOwners.delete(e)));
		} };
	}
	ownsChannel(e, t, n) {
		return this.channelOwners.get(e)?.get(t) === n;
	}
}, L = 0, fe = class {
	constructor() {
		this.disposers = [], this.disposed = !1;
	}
	get isDisposed() {
		return this.disposed;
	}
	track(e) {
		if (this.disposed) {
			e();
			return;
		}
		L++, this.disposers.push(e);
	}
	trackListener(e, t, n) {
		e.addEventListener(t, n), this.track(() => e.removeEventListener(t, n));
	}
	trackTargetListener(e, t, n, r) {
		e.addEventListener(t, n, r), this.track(() => e.removeEventListener(t, n, r));
	}
	trackRaf(e) {
		this.track(() => cancelAnimationFrame(e));
	}
	trackTimeout(e) {
		this.track(() => clearTimeout(e));
	}
	trackInterval(e) {
		this.track(() => clearInterval(e));
	}
	disposeAll() {
		if (this.disposed) return;
		this.disposed = !0;
		let e = this.disposers;
		this.disposers = [];
		let t = [];
		for (let n of e.reverse()) try {
			n();
		} catch (e) {
			t.push(e);
		} finally {
			L--;
		}
		t.length > 0 && console.error("Cleanup disposal failed", t);
	}
}, pe = {
	prepare: [
		"active",
		"interrupt",
		"cancelled"
	],
	active: [
		"release",
		"landing",
		"interrupt",
		"cancelled"
	],
	release: [
		"landing",
		"saving",
		"interrupt",
		"cancelled"
	],
	landing: [
		"saving",
		"handoff",
		"done",
		"interrupt",
		"cancelled"
	],
	saving: [
		"handoff",
		"rollback",
		"interrupt",
		"cancelled"
	],
	handoff: ["done", "cancelled"],
	rollback: ["done", "cancelled"],
	interrupt: ["disposed", "cancelled"],
	done: ["disposed"],
	cancelled: ["disposed"],
	disposed: []
}, me = 1, R = class {
	constructor(e, t, n) {
		this.type = e, this.objectId = t, this.owner = n, this.state = "prepare", this.endReason = "finish", this.cleanup = new fe(), this.leases = [], this.id = `session-${me++}`;
	}
	transition(e) {
		if (this.state !== e) {
			if (!pe[this.state].includes(e)) throw Error(`Invalid session transition: ${this.state} -> ${e}`);
			this.state = e;
		}
	}
	hasObject(e) {
		return this.objectId === e;
	}
	takeObject(e) {
		let t = this.owner.takeObject(e, this.id);
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
		this.state !== "disposed" && (this.state === "interrupt" || this.state !== "done" && this.state !== "cancelled" && this.transition("done"), this.transition("disposed"), this.leases.forEach((e) => e.release()), this.leases = [], this.cleanup.disposeAll());
	}
	cancel() {
		this.state !== "disposed" && (this.state !== "cancelled" && this.transition("cancelled"), this.dispose());
	}
	interrupt(e = "cancel") {
		if (this.endReason = e, e === "regrab") {
			if (this.state === "disposed") return;
			this.state !== "interrupt" && this.state !== "cancelled" && this.state !== "done" && this.transition("interrupt"), (this.state === "interrupt" || this.state === "cancelled" || this.state === "done") && this.transition("disposed"), this.leases.forEach((e) => e.release()), this.leases = [], this.cleanup.disposeAll();
			return;
		}
		(this.state === "prepare" || this.state === "active" || this.state === "release" || this.state === "landing" || this.state === "saving") && this.transition("interrupt"), this.dispose();
	}
}, z = class extends R {
	constructor(e, t, n, r = {}) {
		let i = [...new Set(e)];
		if (i.length === 0) throw Error("GroupDragSession requires at least one object");
		if (!i.includes(t)) throw Error(`Primary object is not part of group: ${t}`);
		super(r.type ?? "move", t, n), this.leasedObjectIds = /* @__PURE__ */ new Set(), this.objectIds = Object.freeze(i), this.primaryObjectId = t, this.offsets = r.offsets ? new Map(r.offsets) : /* @__PURE__ */ new Map();
	}
	hasObject(e) {
		return this.objectIds.includes(e);
	}
	offsetFor(e) {
		return this.offsets.get(e);
	}
	takeObject(e) {
		if (!this.hasObject(e)) throw Error(`Object is not part of group: ${e}`);
		if (this.leasedObjectIds.has(e)) return { release: () => void 0 };
		let t = super.takeObject(e);
		return this.leasedObjectIds.add(e), t;
	}
	takeObjects() {
		return this.objectIds.map((e) => this.takeObject(e));
	}
}, B = class {
	constructor() {
		this.items = /* @__PURE__ */ new Map(), this.events = new I(), this.generations = /* @__PURE__ */ new Map();
	}
	register(e) {
		let t = (this.generations.get(e.id) ?? 0) + 1;
		return this.generations.set(e.id, t), this.items.set(e.id, {
			...e,
			generation: t
		}), this.events.emit({
			type: "object-added",
			id: e.id
		}), t;
	}
	unregister(e, t) {
		let n = this.items.get(e);
		if (t !== void 0 && n?.generation !== t) return !1;
		let r = this.items.delete(e);
		return r && this.events.emit({
			type: "object-removed",
			id: e
		}), r;
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
		return this.items.get(e)?.abilities.includes(t) ?? !1;
	}
	setElement(e, t) {
		let n = this.items.get(e);
		n && n.element !== t && (n.element = t, this.events.emit({
			type: "object-changed",
			id: e
		}));
	}
	setSurface(e, t) {
		this.update(e, { surfaceId: t });
	}
	update(e, t) {
		let n = this.items.get(e);
		return n ? !Object.entries(t).some(([e, t]) => n[e] !== t) || (Object.assign(n, t), this.events.emit({
			type: "object-changed",
			id: e
		}), !0) : !1;
	}
}, V = class {
	constructor() {
		this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new I();
	}
	register(e) {
		let t = (this.generations.get(e.id) ?? 0) + 1;
		return this.generations.set(e.id, t), this.items.set(e.id, {
			...e,
			generation: t
		}), this.events.emit({
			type: "surface-added",
			id: e.id
		}), t;
	}
	unregister(e, t) {
		let n = this.items.get(e);
		if (t !== void 0 && n?.generation !== t) return !1;
		let r = this.items.delete(e);
		return r && this.events.emit({
			type: "surface-removed",
			id: e
		}), r;
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
		let n = this.items.get(e);
		n && n.element !== t && (n.element = t, this.events.emit({
			type: "surface-changed",
			id: e
		}));
	}
	update(e, t) {
		let n = this.items.get(e);
		return n ? !Object.entries(t).some(([e, t]) => n[e] !== t) || (Object.assign(n, t), this.events.emit({
			type: "surface-changed",
			id: e
		}), !0) : !1;
	}
	accepts(e, t) {
		let n = this.items.get(e);
		return n ? n.accepts.length === 0 || n.accepts.includes(t) : !1;
	}
}, H = class {
	constructor() {
		this.items = /* @__PURE__ */ new Map(), this.generations = /* @__PURE__ */ new Map(), this.events = new I();
	}
	register(e) {
		let t = (this.generations.get(e.id) ?? 0) + 1;
		return this.generations.set(e.id, t), this.items.set(e.id, {
			...e,
			generation: t
		}), this.events.emit({
			type: "target-added",
			id: e.id
		}), t;
	}
	unregister(e, t) {
		let n = this.items.get(e);
		if (t !== void 0 && n?.generation !== t) return !1;
		let r = this.items.delete(e);
		return r && this.events.emit({
			type: "target-removed",
			id: e
		}), r;
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
		let n = this.items.get(e);
		n && n.element !== t && (n.element = t, this.events.emit({
			type: "target-changed",
			id: e
		}));
	}
	update(e, t) {
		let n = this.items.get(e);
		return n ? !Object.entries(t).some(([e, t]) => n[e] !== t) || (Object.assign(n, t), this.events.emit({
			type: "target-changed",
			id: e
		}), !0) : !1;
	}
	findForSurface(e, t) {
		return this.snapshot().filter((t) => t.surfaceId === e).filter((e) => !t || e.accepts.length === 0 || e.accepts.includes(t)).filter((e) => e.element?.isConnected).sort((e, t) => (t.priority ?? 0) - (e.priority ?? 0))[0];
	}
	subscribe(e) {
		return this.events.subscribe(e);
	}
}, he = class {
	constructor() {
		this.items = /* @__PURE__ */ new Map();
	}
	register(e) {
		if (this.items.has(e.type)) throw Error(`Behavior already exists: ${e.type}`);
		this.items.set(e.type, e);
	}
	get(e) {
		return this.items.get(e);
	}
	has(e) {
		return this.items.has(e);
	}
}, U = class {
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
};
//#endregion
//#region src/behavior/MoveBehavior.ts
function ge(e) {
	return !!(e && typeof e.then == "function");
}
var W = class {
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
		let t = this.getContext(e.session.id);
		t.layoutSnapshot = this.sessionLifecycles.get(e.session.id)?.layout?.capture?.(e);
	}
	playLayout(e, t = !1) {
		let n = this.getContext(e.session.id), r = this.sessionLifecycles.get(e.session.id);
		n.layoutSnapshot !== void 0 && r?.layout?.play?.(e, n.layoutSnapshot, t);
	}
	playLayoutOnRaf(e) {
		this.playLayout(e, !0);
	}
	cancelLayout(e, t) {
		let n = this.getContext(e.session.id), r = n.layoutSnapshot;
		r !== void 0 && this.sessionLifecycles.get(e.session.id)?.layout?.cancel?.(e, r, t), n.layoutSnapshot = void 0;
	}
	getContext(e) {
		let t = this.contexts.get(e);
		return t || (t = {
			transaction: new U(),
			sourceElement: null,
			dragOffset: {
				x: 0,
				y: 0
			}
		}, this.contexts.set(e, t)), t;
	}
	driverFor(e) {
		return this.sessionDrivers.get(e) ?? this.driver;
	}
	prepare(e, t) {
		let n = this.getContext(e.session.id);
		n.transaction.setPhase("prepare");
		let r = e.visual?.resolveSource?.(t.objectId) ?? null;
		n.sourceElement = r, n.transaction.source = r;
		let i = t.input.event instanceof PointerEvent ? t.input.event : null;
		if (r && i) {
			let e = r.getBoundingClientRect();
			e.width > 0 && e.height > 0 && (n.sourceSize = {
				w: e.width,
				h: e.height
			}), n.dragOffset = {
				x: i.clientX - e.left,
				y: i.clientY - e.top
			};
		}
		let a = this.driverFor(e.session.id).prepare?.(e, t), o = this.sessionLifecycles.get(e.session.id);
		return a && typeof a.then == "function" ? Promise.resolve(a).then(async () => o?.beginDrag?.(e)) : o?.beginDrag?.(e);
	}
	update(e, t) {
		if (e.session.state !== "active") return;
		let n = this.getContext(e.session.id);
		n.transaction.setPhase("active");
		let r = t.event instanceof PointerEvent ? t.event : null;
		this.driverFor(e.session.id).update?.(e, t), r && n.followElement && (n.followElement.style.left = `${r.clientX - n.dragOffset.x}px`, n.followElement.style.top = `${r.clientY - n.dragOffset.y}px`);
	}
	release(e, t) {
		let n = this.getContext(e.session.id);
		n.transaction.setPhase("release");
		let r = this.driverFor(e.session.id).resolveDestination?.(e, t);
		return ge(r) ? r.then((e) => (e && e.accepted && e.destination !== void 0 && (n.destination = e.destination, n.transaction.destination = e.destination), e)) : (r && r.accepted && r.destination !== void 0 && (n.destination = r.destination, n.transaction.destination = r.destination), r);
	}
	commit(e, t) {
		this.getContext(e.session.id).transaction.setPhase("landing");
		let n = this.driverFor(e.session.id);
		if (n.commit) return n.commit(e, t);
	}
	cancel(e, t) {
		let n = this.getContext(e.session.id).transaction;
		n.invalidate(), n.setPhase("cancelled"), this.sessionLifecycles.get(e.session.id)?.cancel?.(e, t), this.driverFor(e.session.id).cancel?.(e, t);
	}
	interrupt(e, t) {
		let n = this.getContext(e.session.id).transaction;
		n.invalidate(), n.setPhase("cancelled"), this.sessionLifecycles.get(e.session.id)?.cancel?.(e, t), this.driverFor(e.session.id).interrupt?.(e, t);
	}
	dispose(e) {
		let t = this.getContext(e.session.id).transaction;
		t.phase !== "cancelled" && t.setPhase("disposed"), this.sessionLifecycles.get(e.session.id)?.dispose?.(e), this.unbindSession(e.session.id);
	}
	landing(e, t) {
		let n = this.getContext(e.session.id);
		if (n.transaction.setPhase("landing"), n.landingStarted) return n.landingPromise ?? { completed: n.landingCompleted === !0 };
		n.landingStarted = !0, n.destination = t;
		let r = this.sessionLifecycles.get(e.session.id)?.landing?.(e, t), i = Promise.resolve(r).then((e) => ((!e || e.completed) && (n.landingCompleted = !0), e));
		return n.landingPromise = i, i;
	}
	reveal(e, t) {
		let n = this.getContext(e.session.id);
		if (!n.revealCommitted && !(n.landingStarted && !n.landingCompleted)) return n.revealCommitted = !0, n.transaction.setPhase("handoff"), this.sessionLifecycles.get(e.session.id)?.reveal?.(e, t);
	}
}, G = class {
	constructor(e) {
		this.runtime = e;
	}
	setRuntime(e) {
		this.runtime = e;
	}
	resolveSource(e) {
		return this.runtime?.objects.get(e)?.element ?? null;
	}
	resolveTarget(e) {
		let t = this.runtime?.objects.get(e)?.element ?? null;
		if (!t?.isConnected || t.dataset.runtimeProxy === "true") return null;
		let n = t.getBoundingClientRect();
		return n.width > 0 && n.height > 0 ? t : null;
	}
	captureVisualState(e, t) {
		let n = getComputedStyle(e);
		return {
			rect: t ?? e.getBoundingClientRect(),
			borderRadius: n.borderRadius,
			boxShadow: n.boxShadow,
			border: n.border,
			backdropFilter: n.backdropFilter,
			background: n.backgroundColor,
			backgroundImage: n.backgroundImage,
			opacity: n.opacity,
			transform: n.transform
		};
	}
	applyState(e, t) {
		e.dataset.runtimePhase = t.phase, e.classList.toggle("is-hovered", t.hovered), e.classList.toggle("is-grabbed", t.grabbed), e.classList.toggle("is-selected", t.selected);
	}
	createProxy(e) {
		if (!e.sourceElement || !e.sourceRect || !e.beforeContent) throw Error("visual proxy requires source snapshot");
		let t = ie(e.beforeContent, e.sourceRect, {
			layout: e.proxyLayout,
			proxyZIndex: e.landingProxyZIndex ?? e.proxyZIndex,
			contentScale: e.contentScale,
			cameraShell: !!(e.camera?.enabled && e.camera.scale),
			affordancesSelector: this.runtime?.getObjectAffordancesConfig(e.objectId)?.selector
		}), n = M(t), r = !!e.proxyLayout?.compact;
		T(e.sourceElement, n);
		let i = e.visualSnapshot;
		return i && (n.style.setProperty("box-shadow", i.boxShadow, "important"), n.style.borderRadius = i.borderRadius, n.style.backgroundColor = i.background, i.backgroundImage && i.backgroundImage !== "none" && (n.style.backgroundImage = i.backgroundImage), n.style.opacity = i.opacity, t.style.transform = `scale(${r ? 1 : 1.03})`), oe() && j(n), n.querySelectorAll("[class]").forEach((e) => {
			let t = getComputedStyle(e);
			t.opacity === "0" && t.pointerEvents === "none" && (e.style.opacity = "1");
		}), { element: t };
	}
	updateProxy(e, t) {
		k(e.element, t.contentScale);
	}
	land(e, t, n) {
		let r = e.element;
		M(r);
		let i = "getBoundingClientRect" in t ? t : void 0, a = i ? void 0 : t;
		if (!n.targetRect && !n.targetSnapshot?.rect && !a && (!i || !i.isConnected)) return Promise.resolve({
			completed: !1,
			reason: "target-disconnected"
		});
		let o = i?.isConnected ? i.getBoundingClientRect() : void 0, s = n.targetRect ?? a ?? o ?? n.targetSnapshot?.rect, c = {
			left: s.left,
			top: s.top,
			width: s.width,
			height: s.height
		}, l = n.landingMode === "free" ? null : n.landingBounds?.() ?? null, u = (e, t = l) => n.landingMode === "free" ? e : t ? E(e, t) : e, d = u(c);
		if (!(d.width > 0 && d.height > 0)) return Promise.resolve({
			completed: !1,
			reason: "target-zero-size"
		});
		i && !n.preserveTarget && F(i, n.sessionId), r.style.transition = "none";
		let f = n.landingMode === "target", p = M(r).dataset.runtimeCompact === "true", m = !!(n.sourceSurfaceId && n.destinationSurfaceId && n.sourceSurfaceId !== n.destinationSurfaceId), h = n.motionState ? { ...n.motionState } : void 0, g = m && n.disableTargetVisualMorph, _ = n.targetSnapshot, y = !!(_ && (_.background && _.background !== "transparent" && _.background !== "rgba(0, 0, 0, 0)" || _.backgroundImage && _.backgroundImage !== "none" || _.boxShadow && _.boxShadow !== "none")), b = !g && (f ? !n.disableTargetVisualMorph && y : !!_), S = !g && !n.disableTargetVisualMorph && y && !p && !!i, C = _?.boxShadow ? _.boxShadow : void 0, w = m && !f ? "1" : _?.opacity, T = n.landingMode === "free" ? n.motion?.freeLanding ?? n.motion?.landing : n.landingMode === "target" ? n.motion?.target?.landing ?? n.motion?.landing : n.motion?.landing, D = n.motionEnabled === !1 || n.releaseMode === "normal";
		!f && D && (r.style.width = `${d.width}px`, r.style.height = `${d.height}px`);
		let O = D ? ee : te, k = n.destination && typeof n.destination == "object" ? n.destination.point : void 0, A = k && typeof k.x == "number" && typeof k.y == "number" ? {
			x: k.x,
			y: k.y
		} : void 0, j = d, { finished: N, retarget: P } = O(r, d, {
			objectId: n.objectId,
			sessionId: n.sessionId,
			pointerRelease: A,
			targetSnapshot: _,
			sourceSurfaceId: n.sourceSurfaceId,
			destinationSurfaceId: n.destinationSurfaceId,
			duration: T?.duration ?? (n.landingMode === "free" ? v.freeLanding.duration : v.landing.duration),
			easing: T?.easing ?? (n.landingMode === "free" ? v.freeLanding.easing : v.landing.easing),
			stiffness: n.landingMode === "free" ? n.motion?.freeLanding?.stiffness : void 0,
			damping: n.landingMode === "free" ? n.motion?.freeLanding?.damping : void 0,
			rotationDecay: n.landingMode === "free" ? n.motion?.freeLanding?.rotationDecay : void 0,
			targetShadow: b || g ? C : void 0,
			targetRadius: b ? _?.borderRadius : void 0,
			targetBorder: b ? _?.border : void 0,
			targetBackdropFilter: b ? _?.backdropFilter : void 0,
			targetBackground: b ? _?.background : void 0,
			targetBackgroundImage: b ? _?.backgroundImage : void 0,
			targetOpacity: b ? w : void 0,
			targetContent: S ? i ?? n.sourceElement : void 0,
			landingMode: n.landingMode,
			targetMotion: f ? n.motion?.target?.motion : void 0,
			dismiss: f ? n.motion?.target?.dismiss : void 0,
			readTarget: i && !n.landingCameraOrigin ? () => j : void 0,
			cameraOrigin: n.landingMode === "free" ? n.landingCameraOrigin ?? n.cameraOrigin : void 0,
			landingCameraScale: n.landingMode === "free" ? n.landingCameraScale : void 0,
			contentScale: n.contentScale,
			cameraShell: !!(n.landingMode === "free" && (n.landingCameraOrigin ?? n.cameraOrigin) || n.camera?.enabled && n.camera.scale),
			landingContentScale: n.landingContentScale,
			affordancesSelector: n.affordances?.selector,
			motionState: n.releaseMode === "normal" ? void 0 : h,
			coast: {
				duration: x.coastSeconds,
				friction: 8,
				maxDistance: x.maxCoast,
				minVelocity: x.minVelocity
			},
			releaseDamping: x.dampingRatio
		});
		if (this.runtime && i && !n.landingCameraOrigin) {
			let e = n.targetSnapshot?.rect;
			this.runtime.trackLandingTarget(n.sessionId, i, (t) => {
				let r = n.landingBounds?.() ?? l, i = t.width > 0 && t.height > 0 ? u(t, r) : e && e.width > 0 && e.height > 0 ? u({
					left: e.x,
					top: e.y,
					width: e.width,
					height: e.height
				}, r) : j;
				j = i, P(i);
			}, { initialRect: o });
		}
		return N.then(() => ({ completed: !0 }));
	}
	reveal(e, t, n) {
		t.style.transition = "", ne(t, n.sessionId);
	}
	dispose(e, t) {
		let n = e.element;
		e.dispose?.(), O(n);
	}
	createMove(e) {
		let t = this.runtime;
		return !t || !t.objects.hasAbility(e.objectId, "move") ? {} : (e.event.preventDefault(), (e.mode === "clone" ? ae : P)({
			runtime: t,
			objectId: e.objectId,
			element: e.element,
			event: e.event,
			fromRect: e.fromRect,
			returnRect: e.returnRect
		}));
	}
}, K = class {
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
};
//#endregion
//#region src/dom/RegisteredHit.ts
function q(e, t) {
	return t.x >= e.left && t.x <= e.right && t.y >= e.top && t.y <= e.bottom;
}
function J(e, t, n, r) {
	let i = e.get(r), a = () => t.snapshot().filter((e) => e.element?.isConnected).filter((e) => i ? t.accepts(e.id, i.type) : !1);
	return {
		findSurface(e) {
			return n.snapshot().filter((e) => e.element?.isConnected).filter((e) => e.accepts.length === 0 || e.accepts.includes(i?.type ?? "")).filter((t) => q(t.element.getBoundingClientRect(), e)).sort((e, t) => (t.priority ?? 0) - (e.priority ?? 0)).map((e) => t.get(e.surfaceId)).find((e) => !!(e && t.accepts(e.id, i?.type ?? ""))) || (a().map((e) => ({
				surface: e,
				rect: e.element.getBoundingClientRect()
			})).filter(({ rect: t }) => q(t, e)).sort((e, t) => e.rect.width * e.rect.height - t.rect.width * t.rect.height)[0]?.surface ?? null);
		},
		findTarget(t, i, a) {
			let o = e.get(r)?.type, s = n.snapshot().filter((e) => e.surfaceId === t.id && e.id !== `object-target:${a}`).filter((e) => e.accepts.length === 0 || e.accepts.includes(o ?? "")).filter((e) => e.element?.isConnected).sort((e, t) => (t.priority ?? 0) - (e.priority ?? 0)).find((e) => q(e.element.getBoundingClientRect(), i));
			return s?.element ? s.element : [...e.values()].filter((e) => e.id !== a && e.surfaceId === t.id).map((e) => e.element).filter((e) => !!e?.isConnected).find((e) => q(e.getBoundingClientRect(), i)) ?? null;
		},
		findIndex(t, n, r) {
			let i = [...e.values()].filter((e) => e.id !== r && e.surfaceId === t.id).map((e) => e.element).filter((e) => !!e?.isConnected).map((e) => ({
				element: e,
				rect: e.getBoundingClientRect()
			})).sort((e, t) => e.rect.top - t.rect.top || e.rect.left - t.rect.left);
			for (let e = 0; e < i.length; e += 1) {
				let { rect: t } = i[e];
				if (n.y < t.top + t.height / 2) return e;
			}
			return i.length;
		}
	};
}
//#endregion
//#region src/runtime/RuntimeRegistry.ts
var Y = class {
	constructor() {
		this.visuals = new K(), this.objectTypes = /* @__PURE__ */ new Map(), this.visualStrategies = /* @__PURE__ */ new Map(), this.motionProfile = null, this.motionController = {};
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
}, X = class {
	constructor() {
		this.sessions = /* @__PURE__ */ new Map(), this.completionGates = /* @__PURE__ */ new Map();
	}
	create(e, t, n) {
		let r = new R(e, t, n);
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
		let n = this.completionGates.get(e) ?? /* @__PURE__ */ new Set();
		n.add(t), this.completionGates.set(e, n);
	}
	trackForObject(e, t) {
		let n = !1;
		for (let r of this.sessions.values()) r.hasObject(e) && (r.trackCleanup(t), n = !0);
		return n;
	}
	removeGate(e, t) {
		this.completionGates.get(e)?.delete(t);
	}
	failGates(e) {
		let t = this.completionGates.get(e);
		if (t) {
			for (let e of [...t]) e.fail();
			this.completionGates.delete(e);
		}
	}
	acquireObject(e, t) {
		let n = this.sessions.get(e);
		return n ? n.takeObject(t) : null;
	}
	track(e, t) {
		this.sessions.get(e)?.trackCleanup(t);
	}
	finalize(e, t) {
		let n = this.sessions.get(e);
		if (n) return t?.(n), n.dispose(), this.failGates(e), this.sessions.delete(e), n;
	}
	cancel(e, t) {
		let n = this.sessions.get(e);
		if (n) return t?.(n), n.cancel(), this.sessions.delete(e), n;
	}
	interrupt(e, t, n) {
		let r = this.sessions.get(e);
		if (r) return n?.(r), r.interrupt(t), this.sessions.delete(e), r;
	}
}, _e = class {
	constructor(e) {
		this.sessions = e;
	}
	finalize(e, t, n, r, i) {
		try {
			this.sessions.finalize(e.id, (e) => r(e.id));
		} finally {
			i(t, n);
		}
	}
	terminate(e, t, n, r, i, a, o, s) {
		try {
			a(t, n, r);
		} catch (e) {
			console.error(`Behavior ${i} failed`, e);
		} finally {
			try {
				o(e), i === "cancel" ? this.sessions.cancel(e.id) : this.sessions.interrupt(e.id, r === "regrab" ? "regrab" : "cancel");
			} finally {
				s(t, n);
			}
		}
	}
};
//#endregion
//#region src/runtime/RuntimeMove.ts
function ve(e) {
	return !!(e && typeof e.then == "function");
}
var ye = class e {
	constructor(e, t, n, r) {
		this.updateCoordinator = e, this.releaseCoordinator = t, this.commitCoordinator = n, this.landingCoordinator = r;
	}
	static fromPorts(t, n, r) {
		return new e(new be(t), new xe(), n, r);
	}
	update(e, t) {
		this.updateCoordinator.update(e, t);
	}
	prepareRelease(e, t) {
		return this.releaseCoordinator.prepare(e, t);
	}
	async commit(e, t, n, r = !0) {
		return this.commitCoordinator.commit(e, t, n, r);
	}
	async land(e, t, n) {
		return this.landingCoordinator.run(e, t, n);
	}
	release(e, t, n) {
		let r = n.getSession(e), i = this.prepareRelease(r, t);
		if (i.kind === "ignore") return Promise.resolve();
		if (i.kind === "cancel") return r && n.cancel(r.id, i.reason), Promise.resolve();
		let a = i.session, o = n.getBehavior(a.type);
		o instanceof W && n.captureLayout(a.id);
		let s;
		try {
			s = o?.release?.(n.createContext(a), t);
		} catch (e) {
			return n.cancel(a.id, e instanceof Error ? e.message : "release-failed"), Promise.resolve();
		}
		return ve(s) ? Promise.resolve(s).then((e) => this.finishRelease(a, o, e, n), (e) => {
			n.cancel(a.id, e instanceof Error ? e.message : "release-failed");
		}) : this.finishRelease(a, o, s, n);
	}
	async finishRelease(e, t, n, r) {
		if (r.getSession(e.id) !== e) return;
		let i = n;
		if (i?.accepted === !1) {
			r.cancel(e.id, "no-valid-drop");
			return;
		}
		if (e.state === "release" && e.transition("landing"), !(t instanceof W)) {
			r.end(e);
			return;
		}
		let a = i?.destination;
		if (a === void 0) {
			r.cancel(e.id, "invalid-release-result");
			return;
		}
		try {
			await this.commit(e, t, a, i?.emitAction !== !1);
		} catch (t) {
			r.cancel(e.id, t instanceof Error ? t.message : "commit-failed");
			return;
		}
		await this.land(e, t, a);
	}
	start(e, t) {
		let n = t.getBehavior(e.type);
		if (!n) throw Error(`Unknown interaction behavior: ${e.type}`);
		let r = t.createSession(e.type, e.objectId), i = t.getVisualStrategy(e.objectId);
		i && t.bindLifecycle(r.id, i);
		let a = t.createContext(r);
		try {
			let i = n.prepare?.(a, e);
			i && typeof i.then == "function" && i.catch((e) => {
				t.isCurrent(r.id) && t.cancel(r.id, e instanceof Error ? e.message : "prepare-failed");
			});
		} catch (e) {
			t.cancel(r.id, e instanceof Error ? e.message : "prepare-failed");
		}
		return t.isCurrent(r.id) && r.state === "prepare" && r.transition("active"), {
			id: r.id,
			get state() {
				return r.state;
			},
			cancel: (e) => t.cancel(r.id, e ?? "cancelled"),
			interrupt: (e) => t.interrupt(r.id, e ?? "interrupted")
		};
	}
}, be = class {
	constructor(e) {
		this.port = e;
	}
	update(e, t) {
		let n = this.port.getSession(e);
		!n || n.state !== "active" || this.port.getBehavior(n.type)?.update?.(this.port.createContext(e), t);
	}
}, xe = class {
	prepare(e, t) {
		return e ? t.kind === "pointercancel" || t.kind === "blur" || t.kind === "lostpointercapture" ? {
			kind: "cancel",
			reason: t.kind
		} : e.state === "prepare" ? {
			kind: "cancel",
			reason: "interaction-not-ready"
		} : (e.state === "active" && e.transition("release"), e.state === "release" ? {
			kind: "continue",
			session: e
		} : { kind: "ignore" }) : { kind: "ignore" };
	}
}, Se = class {
	constructor(e, t) {
		this.port = e, this.actions = t;
	}
	resolveIsAppend(e, t) {
		if (!t) return !1;
		let n = this.port.getObjectIndex?.(e, t.toSurfaceId), r = this.port.getSurfaceObjectCount?.(t.toSurfaceId);
		return this.port.hasLayoutAnchor?.(t.toSurfaceId) ? !1 : n !== void 0 && n >= 0 && r !== void 0 ? n >= r - 1 : t.toIndex !== void 0 && r !== void 0 && t.toIndex >= r - 1;
	}
	async commit(e, t, n, r = !0) {
		let i = this.port.createContext(e);
		if (await t.commit(i, n), !r) {
			let r = this.port.normalize(e.objectId, n);
			r && (t.getContext(e.id).transaction.destination = r), this.resolveIsAppend(e.objectId, r) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
			return;
		}
		let a = this.port.getLifecycle(e.id), o = this.port.normalize(e.objectId, n);
		o && await a?.surface?.leave?.(i, o.fromSurfaceId), await this.actions.emit(e.objectId, t.getContext(e.id).destination, t.getContext(e.id).transaction), o && await a?.surface?.enter?.(i, o.toSurfaceId), this.resolveIsAppend(e.objectId, o) ? this.port.playLayout(e.id, !0) : this.port.playLayout(e.id);
	}
}, Ce = class {
	constructor(e) {
		this.port = e;
	}
	async run(e, t, n) {
		try {
			let r = await t.landing(this.port.createContext(e), n), i = this.port.getSession(e.id);
			if (i !== e || i.state === "disposed" || i.state === "interrupt") return;
			if (r && !r.completed) return this.port.cancel(e.id, r.reason ?? "landing-failed");
			r && r.reveal && await r.reveal(), e.handoff(), t.reveal && await t.reveal(this.port.createContext(e), n), this.port.getSession(e.id) === e && this.port.end(e);
		} catch (t) {
			this.port.getSession(e.id) === e && this.port.cancel(e.id, t instanceof Error ? t.message : "landing-failed");
		}
	}
}, we = class {
	constructor(e) {
		this.port = e;
	}
	normalize(e, t) {
		if (this.isDestination(t)) return t;
		if (!t || typeof t != "object") return null;
		let n = t;
		if (typeof n.columnId != "string") return null;
		let r = this.port.getObjectSurface(e);
		if (!r) return null;
		let i = n.point, a = n.releaseVelocity, o = n.sourceSize;
		return {
			fromSurfaceId: r,
			toSurfaceId: n.columnId,
			...typeof n.index == "number" ? { toIndex: n.index } : {},
			...i && typeof i.x == "number" && typeof i.y == "number" ? { point: {
				x: i.x,
				y: i.y
			} } : {},
			...a && typeof a.x == "number" && typeof a.y == "number" ? { releaseVelocity: {
				x: a.x,
				y: a.y
			} } : {},
			...o && typeof o.w == "number" && o.w > 0 && typeof o.h == "number" && o.h > 0 ? { sourceSize: {
				w: o.w,
				h: o.h
			} } : {}
		};
	}
	async emit(e, t, n) {
		if (n.actionEmitted) return !1;
		let r = this.normalize(e, t);
		if (!r) return !1;
		n.actionEmitted = !0, n.destination = r;
		let i = this.port.getGroup?.(e);
		return i && i.objectIds.length > 1 ? await this.port.emit({
			type: "move-group",
			objectId: i.primaryObjectId,
			primaryObjectId: i.primaryObjectId,
			objectIds: i.objectIds,
			fromSurfaceId: r.fromSurfaceId,
			toSurfaceId: r.toSurfaceId,
			...r.toIndex === void 0 ? {} : { toIndex: r.toIndex },
			...r.point === void 0 ? {} : { point: r.point },
			...r.releaseVelocity === void 0 ? {} : { releaseVelocity: r.releaseVelocity },
			...r.sourceSize === void 0 ? {} : { sourceSize: r.sourceSize },
			timestamp: Date.now()
		}) : await this.port.emit({
			type: "move",
			objectId: e,
			fromSurfaceId: r.fromSurfaceId,
			toSurfaceId: r.toSurfaceId,
			...r.toIndex === void 0 ? {} : { toIndex: r.toIndex },
			...r.point === void 0 ? {} : { point: r.point },
			...r.releaseVelocity === void 0 ? {} : { releaseVelocity: r.releaseVelocity },
			...r.sourceSize === void 0 ? {} : { sourceSize: r.sourceSize },
			timestamp: Date.now()
		}), !0;
	}
	isDestination(e) {
		if (!e || typeof e != "object") return !1;
		let t = e;
		return typeof t.fromSurfaceId == "string" && typeof t.toSurfaceId == "string";
	}
};
//#endregion
//#region src/dom/LandingTargetTracker.ts
function Te(e, t) {
	return Math.abs(e.left - t.left) < .5 && Math.abs(e.top - t.top) < .5 && Math.abs(e.width - t.width) < .5 && Math.abs(e.height - t.height) < .5;
}
function Z(e) {
	return new DOMRect(e.left, e.top, e.width, e.height);
}
function Ee(t) {
	let n = null, r = null, o = !1, s = Math.max(0, t.stableFrameLimit ?? 2), c = Math.max(1, t.idlePollInterval ?? 4), l = 0, u = 0, d = t.initialRect ? Z(t.initialRect) : null, p = null, m = !1, h = !1, g = !1, v = i(t.target)?.sequence ?? 0, y = null, b = () => {
		o || (o = !0, r !== null && cancelAnimationFrame(r), r = null, n?.disconnect(), n = null, y?.(), y = null);
	}, x = (e) => {
		if (d && Te(d, e)) {
			l += 1;
			return;
		}
		l = 0, d = e, t.retarget(e);
	}, S = (e, n = performance.now()) => {
		let r = _(t.target, n);
		p = new DOMRect(e.left - (r?.x ?? 0), e.top - (r?.y ?? 0), e.width, e.height);
	};
	if (d && S(d), y = f(t.target, (e) => {
		o || e.sequence <= v || (v = e.sequence, S(e.rect), g = !0, u = 0);
	}), typeof ResizeObserver > "u") return t.cleanup.track(b), b;
	let C = (e = performance.now()) => {
		if (o || !t.target.isConnected) return;
		let n = t.target.getBoundingClientRect();
		S(n, e), u = 0, h = !1, x(n);
	};
	if (n = new ResizeObserver(() => {
		if (!(o || !t.target.isConnected)) {
			if (e()) {
				h = !0, m = !0;
				return;
			}
			C();
		}
	}), n.observe(t.target), t.observeAncestors !== !1) {
		let e = typeof document < "u" ? document.body : null, r = t.stopAt === void 0 ? e : t.stopAt, i = t.target.parentElement;
		for (; i && i !== r;) n.observe(i), i = i.parentElement;
	}
	let w = (n) => {
		if (o || (r = requestAnimationFrame(w), !t.target.isConnected)) return;
		let i = _(t.target, n), f = e();
		if (a(t.target) && (m = !0, h)) {
			C(n);
			return;
		}
		if (g) {
			g = !1, f && (m = !0), p && (u = 0, x(i ? new DOMRect(p.left + i.x, p.top + i.y, p.width, p.height) : Z(p)));
			return;
		}
		if (i) {
			if (m = !0, !p) {
				let e = t.target.getBoundingClientRect();
				S(e, n);
			}
			p && (u = 0, x(new DOMRect(p.left + i.x, p.top + i.y, p.width, p.height)));
			return;
		}
		if (f) {
			m = !0, p ? (!d || !Te(d, p)) && x(Z(p)) : C(n), u = 0;
			return;
		}
		if (m || h) {
			m = !1, C(n);
			return;
		}
		u += 1, !(l >= s && u % c !== 0) && C(n);
	};
	return r = requestAnimationFrame(w), t.cleanup.track(b), b;
}
//#endregion
//#region src/runtime/RuntimeVisual.ts
var De = class {
	constructor(e) {
		this.port = e;
	}
	resolveTarget(e, t) {
		let n = this.port.getAdapter(e).resolveTarget?.(e, t) ?? new G().resolveTarget(e);
		return n?.isConnected ? n : null;
	}
	apply(e, t, n) {
		(this.port.getAdapter(e).applyState ?? new G().applyState)(t, n);
	}
	capture(e, t, n) {
		return (this.port.getAdapter(e).captureVisualState ?? new G().captureVisualState)(t, n);
	}
	trackTarget(e, t, n, r = {}) {
		return Ee({
			...r,
			cleanup: e,
			target: t,
			retarget: n
		});
	}
}, Oe = class {
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
		let t = this.proxies.get(e);
		return this.proxies.delete(e), t;
	}
}, ke = class {
	constructor(e, t) {
		this.port = e, this.proxies = t;
	}
	getAdapter(e, t) {
		return t?.group ? this.port.getGroupAdapter?.(e.objectId) ?? this.port.getAdapter(e.objectId) : this.port.getAdapter(e.objectId);
	}
	create(e, t) {
		let n = this.port.getSession(e);
		if (!n) return;
		let r = this.getAdapter(n, t).createProxy?.(t);
		if (r) return this.proxies.register(e, r), r;
	}
	async land(e, t, n) {
		let r = this.port.getSession(e), i = this.proxies.get(e);
		if (!r || !i) return {
			completed: !1,
			reason: "visual-proxy-missing"
		};
		let a = n ?? this.port.createContext(e, void 0, t);
		return await this.getAdapter(r, a).land?.(i, t, a) || { completed: !0 };
	}
	update(e, t) {
		let n = this.port.getSession(e), r = this.proxies.get(e);
		if (!n || !r) return;
		let i = t ?? this.port.createContext(e);
		this.getAdapter(n, i).updateProxy?.(r, i);
	}
	async reveal(e, t, n) {
		let r = this.port.getSession(e), i = this.proxies.get(e);
		if (!r || !i) return;
		let a = n ?? this.port.createContext(e, void 0, t);
		await this.getAdapter(r, a).reveal?.(i, t, a);
	}
};
//#endregion
//#region src/input/PointerSessionInput.ts
function Ae(e, t, n = {}) {
	let r = n.target ?? window, i = n.captureTarget, a = !1, o = null, s = null, c = (n) => {
		o = n, s === null && (s = r.requestAnimationFrame(() => {
			s = null;
			let n = o;
			o = null, !(a || !n) && e.update(t.id, {
				kind: "pointermove",
				event: n
			});
		}));
	}, l = (n) => {
		p(), e.release(t.id, {
			kind: "pointerup",
			event: n
		});
	}, u = (n) => {
		p(), e.release(t.id, {
			kind: "pointercancel",
			event: n
		});
	}, d = () => {
		p(), e.release(t.id, { kind: "blur" });
	}, f = (n) => {
		p(), e.release(t.id, {
			kind: "lostpointercapture",
			event: n
		});
	};
	function p() {
		a || (a = !0, o = null, s !== null && (r.cancelAnimationFrame(s), s = null), r.removeEventListener("pointermove", c), r.removeEventListener("pointerup", l), r.removeEventListener("pointercancel", u), r.removeEventListener("blur", d), i?.removeEventListener("lostpointercapture", f));
	}
	return r.addEventListener("pointermove", c), r.addEventListener("pointerup", l), r.addEventListener("pointercancel", u), r.addEventListener("blur", d), i?.addEventListener("lostpointercapture", f), t.cleanup.track(p), p;
}
//#endregion
//#region src/runtime/RuntimeInput.ts
var je = class {
	constructor(e) {
		this.port = e, this.bindings = /* @__PURE__ */ new WeakMap(), this.disposers = /* @__PURE__ */ new Map();
	}
	bind(e, t, n = {}) {
		this.disposers.get(e)?.(), this.bindings.get(t)?.();
		let r = null, i = () => {
			r &&= (window.removeEventListener("pointermove", r.move), window.removeEventListener("pointerup", r.up), window.removeEventListener("pointercancel", r.up), null);
		}, a = (a) => {
			if (!(a instanceof PointerEvent) || a.button !== 0 && a.pointerType === "mouse") return;
			if (!a.pointerType) {
				this.port.startObjectPointer(e, t, a);
				return;
			}
			i();
			let o = a.clientX, s = a.clientY, c = (r) => {
				if (!(r instanceof PointerEvent)) return;
				let c = Math.max(0, n.dragThreshold ?? 5);
				Math.hypot(r.clientX - o, r.clientY - s) < c || (i(), r.preventDefault(), this.port.startObjectPointer(e, t, a));
			}, l = () => i();
			r = {
				down: a,
				move: c,
				up: l
			}, window.addEventListener("pointermove", c), window.addEventListener("pointerup", l), window.addEventListener("pointercancel", l);
		};
		t.addEventListener("pointerdown", a);
		let o = () => {
			t.removeEventListener("pointerdown", a), i();
		};
		return this.bindings.set(t, o), this.disposers.set(e, o), o;
	}
	sync(e) {
		let t = this.port.objects.get(e);
		if (this.disposers.get(e)?.(), this.disposers.delete(e), !t?.element || !this.port.registry.objectTypes.has(t.visual ?? t.type)) return;
		let n = this.port.registry.objectTypes.get(t.visual ?? t.type);
		this.bind(e, t.element, n?.pointerInput);
	}
	remove(e) {
		this.disposers.get(e)?.(), this.disposers.delete(e);
	}
	bindRegrabTarget(e, t, n, r) {
		this.port.registerRegrab(t, r);
		let i = (e) => {
			if (!(e instanceof PointerEvent)) return;
			let r = n.getBoundingClientRect();
			e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && this.port.regrab(t, e);
		};
		document.addEventListener("pointerdown", i, !0), e.cleanup.trackTargetListener(document, "pointerdown", i, { capture: !0 });
	}
	bindSession(e, t = {}) {
		return Ae({
			update: (e, t) => this.port.update(e, t),
			release: (e, t) => this.port.release(e, t)
		}, e, t);
	}
}, Me = class {
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
}, Q = {
	maxModifiers: 2,
	foldDuration: 300,
	modifierFadeDuration: 180,
	spread: [{
		x: 50,
		y: -20,
		rotate: 20,
		scale: 1
	}, {
		x: 90,
		y: -38,
		rotate: 34,
		scale: 1
	}],
	tight: [{
		x: 7,
		y: 6,
		rotate: 4,
		scale: .97
	}, {
		x: 13,
		y: 12,
		rotate: 8,
		scale: .94
	}]
};
function Ne(e) {
	return {
		maxModifiers: Math.max(0, e?.maxModifiers ?? Q.maxModifiers),
		foldDuration: Math.max(0, e?.foldDuration ?? Q.foldDuration),
		modifierFadeDuration: Math.max(0, e?.modifierFadeDuration ?? Q.modifierFadeDuration),
		spread: e?.spread ?? Q.spread,
		tight: e?.tight ?? Q.tight
	};
}
//#endregion
//#region src/dom/GroupVisual.ts
function Pe(e, t) {
	t && (e.dataset.runtimeProxyContent = "true", e.dataset.runtimeCompact = "true", e.style.boxSizing = "border-box", e.style.left = t.left ?? "50%", e.style.width = t.width, t.gridTemplateColumns && (e.style.gridTemplateColumns = t.gridTemplateColumns));
}
function $(e, t = new G(e)) {
	let n = /* @__PURE__ */ new WeakMap();
	function r(t, r) {
		let i = r.group;
		if (!i || i.primaryObjectId !== r.objectId || n.has(t.element)) return;
		let a = M(t.element), o = t.element.querySelector("[data-runtime-proxy-scale-shell=\"true\"]") ?? t.element;
		if (o.style.overflow = "visible", a.style.zIndex = "2", !(r.sourceRect ?? r.sourceElement?.getBoundingClientRect())) return;
		let s = Ne(r.groupDrag), c = r.proxyLayout?.compact, l = [], u = [], d = [], f = i.objectIds.map((t) => e.objects.get(t)?.element).filter((e) => !!e?.isConnected);
		for (let e of f) l.push({
			element: e,
			cssText: e.style.cssText,
			marker: e.dataset.runtimeGroupGhost,
			opacity: getComputedStyle(e).opacity
		}), e.dataset.runtimeGroupGhost = "true", e.style.visibility = "visible", e.style.opacity = "0.35", e.style.pointerEvents = "none", e.style.transition = "none";
		let p = s.spread.map((e, t) => ({
			spread: e,
			tight: s.tight[t]
		})).filter((e) => !!e.tight), m = i.objectIds.filter((e) => e !== i.primaryObjectId).slice(0, Math.min(s.maxModifiers, p.length));
		for (let [t, n] of m.entries()) {
			let r = e.objects.get(n)?.element;
			if (!r || !r.isConnected) continue;
			let i = r.getBoundingClientRect(), s = p[t];
			if (!s) continue;
			let l = r.cloneNode(!0);
			Object.assign(l.style, {
				position: "absolute",
				left: "0px",
				top: "0px",
				width: `${i.width}px`,
				height: `${i.height}px`,
				margin: "0",
				boxSizing: "border-box",
				pointerEvents: "none",
				zIndex: String(1 - t),
				opacity: "1",
				willChange: "transform, opacity",
				backdropFilter: t === 0 ? "blur(6px) saturate(1.15)" : "none",
				WebkitBackdropFilter: t === 0 ? "blur(6px) saturate(1.15)" : "none",
				transform: `${c?.transform ?? (c ? "translateX(-50%)" : "")}${c ? " " : ""}translate3d(${s.spread.x}px, ${s.spread.y}px, 0) rotateZ(${s.spread.rotate}deg) scale(${s.spread.scale})`,
				transformOrigin: "center center"
			}), Pe(l, c), l.dataset.runtimeGroupModifier = "true", delete l.dataset.runtimeGroupGhost, o.insertBefore(l, a), d.push(l), u.push({
				element: l,
				spread: s.spread,
				tight: s.tight
			});
		}
		let h = null, g = performance.now(), _ = (e) => {
			let t = Math.min(1, (e - g) / s.foldDuration), n = 1 - (1 - t) ** 2;
			for (let e of u) {
				let t = e.spread.x + (e.tight.x - e.spread.x) * n, r = e.spread.y + (e.tight.y - e.spread.y) * n, i = e.spread.rotate + (e.tight.rotate - e.spread.rotate) * n, a = e.spread.scale + (e.tight.scale - e.spread.scale) * n, o = c ? c.transform ?? "translateX(-50%)" : "";
				e.element.style.transform = `${o} translate3d(${t.toFixed(2)}px, ${r.toFixed(2)}px, 0) rotateZ(${i.toFixed(2)}deg) scale(${a.toFixed(4)})`;
			}
			h = t < 1 ? requestAnimationFrame(_) : null;
		};
		u.length && (h = requestAnimationFrame(_));
		let v = !1, y = null;
		n.set(t.element, {
			modifiers: d,
			dismissModifiers: () => {
				if (!v) {
					v = !0, h !== null && (cancelAnimationFrame(h), h = null);
					for (let e of d) e.style.transition = `opacity ${s.modifierFadeDuration}ms ease`, e.style.opacity = "0";
					y = window.setTimeout(() => {
						for (let e of d) e.remove();
						y = null;
					}, s.modifierFadeDuration + 20);
				}
			},
			restoreGhosts: (e) => {
				for (let t of l) t.element.isConnected && (t.element.style.transition = `opacity ${e}ms cubic-bezier(.22,1,.36,1)`, t.element.style.opacity = t.opacity);
			},
			cleanup: () => {
				h !== null && cancelAnimationFrame(h), y !== null && window.clearTimeout(y);
				for (let e of d) e.remove();
				for (let e of l) e.element.isConnected && (e.element.style.cssText = e.cssText, e.marker === void 0 ? delete e.element.dataset.runtimeGroupGhost : e.element.dataset.runtimeGroupGhost = e.marker);
			}
		});
	}
	return {
		resolveSource: t.resolveSource?.bind(t),
		resolveTarget: t.resolveTarget?.bind(t),
		captureVisualState: t.captureVisualState?.bind(t),
		applyState: t.applyState?.bind(t),
		createProxy(e) {
			let n = t.createProxy?.(e);
			if (!n) throw Error("group visual requires a base proxy");
			return r(n, e), n;
		},
		updateProxy(e, n) {
			t.updateProxy?.(e, n), r(e, n);
		},
		land: (e, r, i) => {
			let a = n.get(e.element);
			if (!i.group || !a) return t.land?.(e, r, i);
			if (a.dismissModifiers(), i.landingMode !== "target") {
				let n = i.motion?.landing?.duration ?? 420;
				a.restoreGhosts(n);
				let o = !!(i.sourceSurfaceId && i.destinationSurfaceId && i.sourceSurfaceId !== i.destinationSurfaceId), s = i.targetSnapshot ? o ? i.targetSnapshot : {
					...i.targetSnapshot,
					opacity: "0"
				} : void 0;
				return t.land?.(e, r, {
					...i,
					targetSnapshot: s
				});
			}
			return t.land?.(e, r, i);
		},
		reveal: (e, n, r) => t.reveal?.(e, n, r),
		dispose: (e, r) => {
			n.get(e.element)?.cleanup(), n.delete(e.element), t.dispose?.(e, r);
		}
	};
}
//#endregion
//#region src/dom/AutoScroll.ts
function Fe(e, t = {}) {
	let n = t.edgeSize ?? 48, r = t.maxSpeed ?? 16, i = null, a = null, o = null, s = !1, c = null, l = 0, u = null, d = null, f = null, p = () => {
		if (!i || !i.isConnected) {
			c = null;
			return;
		}
		c = i.getBoundingClientRect(), l = 0;
	}, m = (e) => {
		if (u !== e) {
			if (d?.disconnect(), u = e, !e || typeof ResizeObserver > "u") {
				d = null;
				return;
			}
			d = new ResizeObserver(p), d.observe(e);
		}
	}, h = (e, t) => {
		let i = (n - e) / n;
		return Math.ceil(r * i * (t * 60));
	}, g = (e) => {
		if (s) return;
		o = requestAnimationFrame(g);
		let r = Math.min(.05, Math.max(0, (e - (f ?? e)) / 1e3));
		if (f = e, !i || !a || !i.isConnected) return;
		(!c || l++ >= 8) && p();
		let u = c;
		if (!u || a.x < u.left || a.x > u.right) return;
		let d = a.y - u.top, m = u.bottom - a.y;
		if (d < n) {
			let e = i.scrollTop;
			i.scrollTop -= h(d, r), i.scrollTop !== e && t.onScroll?.(a);
		} else if (m < n) {
			let e = i.scrollTop;
			i.scrollTop += h(m, r), i.scrollTop !== e && t.onScroll?.(a);
		}
	}, _ = () => {
		s || (s = !0, o !== null && cancelAnimationFrame(o), o = null, d?.disconnect(), d = null, u = null, c = null);
	};
	return o = requestAnimationFrame(g), e.track(_), {
		update(e, t) {
			s || (i !== e && (c = null, l = 0, m(e)), i = e, a = t, c === null && p());
		},
		stop: _
	};
}
//#endregion
//#region src/dom/LayoutCache.ts
var Ie = class {
	constructor() {
		this.version = 0, this.groups = /* @__PURE__ */ new WeakMap();
	}
	getVersion() {
		return this.version;
	}
	invalidate(e) {
		this.version += 1, e && this.groups.delete(e);
	}
	getGroup(e, t) {
		let n = this.groups.get(e);
		if (!(!n || n.version !== this.version)) return n.states.get(t ? "open" : "closed");
	}
	setGroup(e, t, n, r) {
		let i = this.groups.get(e), a = i && i.version === this.version ? i : {
			version: this.version,
			states: /* @__PURE__ */ new Map()
		};
		a.states.set(t ? "open" : "closed", {
			height: n,
			surfaceTargets: new Map(r)
		}), this.groups.set(e, a);
	}
}, Le = class {
	constructor() {
		this.sequence = 0, this.participantSequence = 0, this.planSequence = 0, this.active = /* @__PURE__ */ new WeakMap(), this.latestTransaction = /* @__PURE__ */ new WeakMap();
	}
	begin(e, t, n = "interaction") {
		let i = this.active.get(e);
		if (i) {
			this.mergeReason(i, t, n), i.participants += 1;
			let r = `participant-${++this.participantSequence}`;
			return i.participantIds.add(r), g(e, i.measurement), this.snapshot(i, r);
		}
		let a = `layout-${++this.sequence}`, o = {
			id: a,
			root: e,
			measurement: r(a),
			reasons: [t],
			priority: n,
			mutations: [],
			participants: 1,
			cancelledParticipants: 0,
			participantIds: /* @__PURE__ */ new Set(),
			plans: []
		}, s = `participant-${++this.participantSequence}`;
		return o.participantIds.add(s), this.active.set(e, o), this.latestTransaction.set(e, o.id), g(e, o.measurement), this.snapshot(o, s);
	}
	request(e, t) {
		let n = this.active.get(e);
		if (!n) throw Error("Cannot request a layout mutation without an open transaction");
		n.mutations.push(t);
		let r = n.participantIds.values().next().value;
		if (!r) throw Error("Cannot request a layout mutation without an active participant");
		return this.snapshot(n, r);
	}
	commit(e, t) {
		let n = this.active.get(e);
		if (!n) return null;
		let r = t ?? n.participantIds.values().next().value;
		return !r || !n.participantIds.delete(r) ? null : (n.participants = Math.max(0, n.participants - 1), this.finalizeIfComplete(e, n), this.snapshot(n, r));
	}
	cancel(e, t) {
		let n = this.active.get(e);
		if (!n) return null;
		let r = t ?? n.participantIds.values().next().value;
		return !r || !n.participantIds.delete(r) ? null : (n.plans.filter((e) => e.participantId === r && e.status === "queued").forEach((e) => {
			e.status = "cancelled";
		}), n.cancelledParticipants += 1, n.participants = Math.max(0, n.participants - 1), this.finalizeIfComplete(e, n), this.snapshot(n, r));
	}
	isActive(e) {
		return this.active.has(e);
	}
	getSnapshot(e) {
		let t = this.active.get(e);
		if (!t) return null;
		let n = t.participantIds.values().next().value;
		return n ? this.snapshot(t, n) : null;
	}
	defer(e, t, n, r = "layout") {
		let i = this.active.get(e);
		if (!i || !i.participantIds.has(t)) return null;
		let a = {
			id: `plan-${++this.planSequence}`,
			transactionId: i.id,
			participantId: t,
			type: r,
			status: "queued",
			run: n,
			isCurrent: () => a.status !== "cancelled" && a.status !== "failed" && this.latestTransaction.get(e) === i.id
		};
		return i.plans.push(a), a;
	}
	mergeReason(e, t, n) {
		e.reasons.includes(t) || e.reasons.push(t), n === "interaction" && (e.priority = n);
	}
	finalizeIfComplete(e, t) {
		if (t.participants !== 0) return;
		this.active.delete(e);
		let n = t.plans.filter((e) => e.status === "queued"), r;
		if (n.forEach((e) => {
			e.status = "running";
			try {
				e.run(e), e.status = "completed";
			} catch (t) {
				e.status = "failed", r ??= t;
			}
		}), r) throw r;
	}
	snapshot(e, t) {
		return {
			id: e.id,
			participantId: t,
			root: e.root,
			reasons: [...e.reasons],
			priority: e.priority,
			mutations: e.mutations.map((e) => ({ ...e })),
			plans: e.plans.map((e) => ({
				id: e.id,
				transactionId: e.transactionId,
				participantId: e.participantId,
				type: e.type,
				status: e.status
			})),
			measurement: e.measurement
		};
	}
}, Re = class {
	get visuals() {
		return this.registry.visuals;
	}
	constructor() {
		this.layout = new Le(), this.layoutCache = new Ie(), this.owner = new de(), this.objects = new B(), this.surfaces = new V(), this.targets = new H(), this.behaviors = new he(), this.registry = new Y(), this.hitResolver = null, this.sessionCoordinator = new X(), this.runtimeSession = new _e(this.sessionCoordinator), this.events = new I(), this.actions = new I(), this.visualProxyCoordinator = new Oe(), this.groupVisualAdapters = /* @__PURE__ */ new Map(), this.surfaceScrollFrames = /* @__PURE__ */ new WeakMap(), this.activeNodeConnection = null, this.nodeConnections = /* @__PURE__ */ new Set(), this.moveVisualFrames = /* @__PURE__ */ new Map(), this.moveVisualPhases = /* @__PURE__ */ new Map(), this.moveContentScales = /* @__PURE__ */ new Map(), this.defaultVisualAdapter = new G(this), this.moveBehavior = new W(), this.inputCoordinator = new je({
			objects: this.objects,
			registry: this.registry,
			startObjectPointer: (e, t, n) => this.startObjectPointer(e, t, n),
			registerRegrab: (e, t) => this.registerRegrab(e, t),
			regrab: (e, t) => this.regrab(e, t),
			update: (e, t) => this.update(e, t),
			release: (e, t) => this.release(e, t)
		}), this.moveActions = new we({
			getObjectSurface: (e) => this.objects.get(e)?.surfaceId,
			getGroup: (e) => {
				let t = this.sessionCoordinator.snapshot().find((t) => t.hasObject(e));
				if (t instanceof z) return {
					primaryObjectId: t.primaryObjectId,
					objectIds: t.objectIds
				};
			},
			emit: (e) => this.actions.emitAsync(e)
		}), this.moveCommit = new Se({
			createContext: (e) => this.createBehaviorContext(e),
			getLifecycle: (e) => this.moveBehavior.getLifecycle(e),
			playLayout: (e, t) => this.playMoveLayout(e, t),
			normalize: (e, t) => this.moveActions.normalize(e, t),
			getSurfaceObjectCount: (e) => [...this.objects.values()].filter((t) => t.surfaceId === e).length,
			hasLayoutAnchor: (e) => this.surfaces.get(e)?.element?.querySelector("[data-flip-target]") !== null,
			getObjectIndex: (e, t) => this.getObjectSurfaceIndex(e, t)
		}, this.moveActions), this.moveLanding = new Ce({
			createContext: (e) => this.createBehaviorContext(e),
			getSession: (e) => this.sessionCoordinator.get(e),
			cancel: (e, t) => this.cancel(e, t),
			end: (e) => this.endSession(e)
		}), this.runtimeMove = ye.fromPorts({
			getSession: (e) => this.sessionCoordinator.get(e),
			getBehavior: (e) => this.behaviors.get(e),
			createContext: (e) => this.createBehaviorContext(this.sessionCoordinator.get(e))
		}, this.moveCommit, this.moveLanding), this.visualState = new De({ getAdapter: (e) => this.getObjectVisualAdapter(e) }), this.visualMotion = new ke({
			getSession: (e) => this.sessionCoordinator.get(e),
			getAdapter: (e) => this.getObjectVisualAdapter(e),
			getGroupAdapter: (e) => this.getObjectGroupVisualAdapter(e),
			createContext: (e, t, n) => this.createVisualLifecycleContext(e, t, n)
		}, this.visualProxyCoordinator), this.dispatcher = new Me({
			start: (e) => this.startInternal(e),
			update: (e, t) => this.updateInternal(e, t),
			release: (e, t) => this.releaseInternal(e, t),
			cancel: (e, t) => this.cancelInternal(e, t),
			interrupt: (e, t) => this.interruptInternal(e, t)
		}), this.behaviors.register(this.moveBehavior), n(this.registry.motionProfile), this.objects.subscribe((e) => {
			if (this.events.emit(e), this.layoutCache.invalidate(), (e.type === "object-added" || e.type === "object-changed") && (this.syncObjectPointerBinding(e.id), this.syncObjectTarget(e.id)), e.type === "object-removed") {
				this.inputCoordinator.remove(e.id), this.targets.unregister(`object-target:${e.id}`);
				let t = `${e.id}:`, n = `->${e.id}:`;
				for (let e of this.nodeConnections) (e.startsWith(t) || e.includes(n)) && this.nodeConnections.delete(e);
			}
		}), this.surfaces.subscribe((e) => {
			this.layoutCache.invalidate(), this.events.emit(e);
		}), this.targets.subscribe((e) => this.events.emit(e)), this.owner.subscribe((e) => this.events.emit({
			type: "ownership-changed",
			id: e
		}));
	}
	invalidateLayoutCache() {
		this.layoutCache.invalidate();
	}
	registerVisualAdapter(e, t) {
		this.registry.registerVisualAdapter(e, t);
	}
	registerVisualStrategy(e, t) {
		this.registry.registerVisualStrategy(e, t);
	}
	isControlled(e) {
		return this.owner.isControlled(e);
	}
	onOwnershipChange(e) {
		return this.owner.subscribe(e);
	}
	registerObjectType(e, t) {
		this.registry.registerObjectType(e, t), this.groupVisualAdapters.delete(e);
		for (let t of this.objects.values()) (t.type === e || t.visual === e) && this.syncObjectPointerBinding(t.id);
	}
	syncObjectTarget(e) {
		let t = this.objects.get(e), n = `object-target:${e}`;
		if (!t?.target) {
			this.targets.unregister(n);
			return;
		}
		let { id: r, element: i, ...a } = t.target, o = i ?? t.element;
		if (this.targets.get(n)) {
			this.targets.update(n, a), this.targets.setElement(n, o ?? null);
			return;
		}
		this.targets.register({
			...a,
			id: n,
			element: o ?? null
		});
	}
	configureMotion(e) {
		let { profile: t, controller: r, ...i } = e, a = t ?? (Object.keys(i).length ? i : void 0);
		a && this.registry.setMotionProfile(a), r && (this.registry.setMotionController(r), r.follow && Object.assign(C.position, r.follow), r.rotation && Object.assign(y, r.rotation), r.release && Object.assign(x, r.release)), n(this.registry.motionProfile);
	}
	configureVisual(e) {
		e.dragGlass !== void 0 && N(e.dragGlass), e.layoutPresence !== void 0 && m(e.layoutPresence);
	}
	getMotionProfile() {
		return this.registry.motionProfile;
	}
	getObjectReleaseMotionProfile(e, t) {
		let n = this.objects.get(e), r = n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0, i = this.getDestinationSurfaceId(t) ?? n?.surfaceId, a = i && this.surfaces.get(i)?.layout === "free" ? r?.motion?.profile?.freeLanding?.release ?? this.registry.motionProfile?.freeLanding?.release : void 0;
		return a ? {
			...x,
			...a
		} : x;
	}
	getSurfaceCameraScale(e) {
		return (e ? this.surfaces.get(e)?.camera : void 0)?.scale;
	}
	getSurfaceCameraPickupScale(e, t) {
		if (t) {
			let e = this.moveContentScales.get(t);
			if (e !== void 0) return e;
		}
		let n = e ? this.surfaces.get(e)?.camera : void 0;
		if (!n) return;
		let r = n.pickupDuration;
		if (!r || r <= 0) return n.scale;
		let i = performance.now(), a = () => {
			let e = typeof n.scale == "function" ? n.scale() : n.scale;
			return typeof e == "number" && Number.isFinite(e) && e > 0 ? e : 1;
		}, o = () => {
			let e = 1 - (1 - Math.min(1, Math.max(0, (performance.now() - i) / r))) ** 3;
			return 1 + (a() - 1) * e;
		};
		return t && this.moveContentScales.set(t, o), o;
	}
	getSessionContentScale(e, t) {
		return this.moveContentScales.get(e) ?? this.getSurfaceCameraScale(t);
	}
	freezeSessionContentScale(e) {
		let t = this.moveContentScales.get(e);
		if (t === void 0) return;
		let n = typeof t == "function" ? t() : t;
		if (!(typeof n != "number" || !Number.isFinite(n) || n <= 0)) return this.moveContentScales.set(e, n), n;
	}
	clearSessionContentScale(e) {
		this.moveContentScales.delete(e);
	}
	getSurfaceCameraOrigin(e) {
		return e ? this.surfaces.get(e)?.camera?.origin : void 0;
	}
	getObjectsInRect(e, t) {
		return [...this.objects.values()].filter((t) => t.surfaceId === e).filter((e) => {
			let n = e.element;
			if (!n?.isConnected || n.dataset.runtimeProxy === "true") return !1;
			let r = n.getBoundingClientRect();
			return r.width <= 0 || r.height <= 0 ? !1 : r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
		}).map((e) => e.id);
	}
	startObjectPointer(e, t, n, r, i) {
		if (this.getRegrab(e)) return this.startObjectPointerInSession(e, t, n, r, i);
		let a = this.objects.get(e);
		if (a?.selected) {
			let o = [...this.objects.values()].filter((e) => e.selected && e.surfaceId === a.surfaceId && e.element?.isConnected && e.abilities.includes("move")).map((e) => e.id);
			if (o.length > 1) return this.startGroupObjectPointer(o, e, t, n, r, i);
		}
		return this.startObjectPointerInSession(e, t, n, r, i);
	}
	startGroupObjectPointer(e, t, n, r, i, a) {
		let o = [...new Set(e)];
		if (o.length < 2 || !o.includes(t)) return !1;
		let s = n.getBoundingClientRect(), c = /* @__PURE__ */ new Map();
		for (let e of o) {
			let t = this.objects.get(e)?.element;
			if (!t) continue;
			let n = t.getBoundingClientRect();
			c.set(e, {
				x: n.left - s.left,
				y: n.top - s.top
			});
		}
		let l = this.startGroupSession(o, t, { offsets: c });
		l.takeObjects();
		let u = this.startObjectPointerInSession(t, n, r, i, a, l.id);
		return u || l.cancel(), u;
	}
	startObjectPointerInSession(e, t, n, r, i, a) {
		let o = this.getRegrab(e);
		if (o) return o(n), !0;
		let s = this.objects.get(e);
		if (!s) return !1;
		let c = this.registry.objectTypes.get(s.visual ?? s.type);
		if (!c) return !1;
		s.element !== t && this.objects.setElement(e, t);
		let l = {
			objectId: e,
			element: t,
			event: n,
			mode: s.visualMode ?? c.defaultVisualMode,
			fromRect: r,
			returnRect: i
		}, u = c.visual?.createMove ?? c.createMove ?? (() => this.defaultVisualAdapter.createMove(l));
		if (u) {
			let t = u(l);
			return !t.driver && !t.lifecycle || this.orchestrateMoveSession(t.request ?? {
				type: "move",
				objectId: e,
				input: {
					kind: "pointerdown",
					event: n
				}
			}, {
				driver: t.driver,
				lifecycle: t.lifecycle,
				pointerInput: t.pointerInput,
				followElement: null,
				sessionId: a,
				prepareExisting: !!a
			}), !0;
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
	getObjectGrabAlign(e) {
		let t = this.objects.get(e);
		return (t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0)?.grabAlign;
	}
	getObjectCameraConfig(e) {
		let t = this.objects.get(e), n = (t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0)?.camera, r = n === !0 || n === !1 || n === void 0 ? {} : n;
		return {
			enabled: n === !0 ? !0 : r.enabled ?? !1,
			pickup: r.pickup ?? !0,
			scale: r.scale ?? !0,
			origin: r.origin ?? !0,
			landing: r.landing ?? !0
		};
	}
	getObjectMotionEnabled(e) {
		let t = this.objects.get(e);
		return (t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0)?.motion?.enabled !== !1;
	}
	getObjectProxyLayout(e, t) {
		let n = this.objects.get(e), r = (n ? this.registry.objectTypes.get(n.visual ?? n.type) : void 0)?.proxyLayout, i = t ?? n?.element ?? void 0;
		if (!r?.compact?.selector || i?.matches(r.compact.selector)) return r;
	}
	getObjectProxyZIndex(e) {
		let t = this.objects.get(e), n = (t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0)?.proxyZIndex;
		return typeof n == "number" && Number.isFinite(n) ? n : void 0;
	}
	getObjectLandingProxyZIndex(e, t, n) {
		let r = this.objects.get(e), i = (r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0)?.landingProxyZIndex, a = typeof i == "function" ? i({
			sourceSurfaceId: t,
			destinationSurfaceId: n
		}) : i;
		return typeof a == "number" && Number.isFinite(a) ? a : this.getObjectProxyZIndex(e);
	}
	setVisualProxyZIndex(e, t) {
		if (typeof t != "number" || !Number.isFinite(t)) return;
		let n = this.visualProxyCoordinator.get(e)?.element;
		n?.isConnected && (n.style.zIndex = String(t));
	}
	getObjectVisualAdapter(e) {
		let t = this.objects.get(e), n = t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0;
		return n?.visual ? n.visual : this.getVisualAdapter(t?.visual ?? t?.type ?? "");
	}
	getObjectAffordancesConfig(e) {
		let t = this.objects.get(e);
		return (t ? this.registry.objectTypes.get(t.visual ?? t.type) : void 0)?.affordances;
	}
	getObjectGroupVisualAdapter(e) {
		let t = this.objects.get(e), n = t?.visual ?? t?.type, r = (n ? this.registry.objectTypes.get(n) : void 0)?.groupVisual;
		if (r === "none") return;
		if (r && r !== "default") return r;
		if (!n) return;
		let i = this.groupVisualAdapters.get(n);
		if (i) return i;
		let a = $(this, this.getObjectVisualAdapter(e));
		return this.groupVisualAdapters.set(n, a), a;
	}
	createVisualLifecycleContext(e, t, n, r) {
		let i = this.sessionCoordinator.get(e), a = i ? this.objects.get(i.objectId) : void 0, o = a?.element ?? void 0, s = i ? this.getObjectVisualAdapter(i.objectId) : this.defaultVisualAdapter, c = new G(), l = a ? this.registry.objectTypes.get(a.visual ?? a.type) : void 0, u = this.getObjectCameraConfig(a?.id ?? ""), d = this.getDestinationSurfaceId(t), f = d ? this.surfaces.get(d) : void 0, p = l?.motion?.profile, m = this.registry.motionProfile, h = p || m ? {
			...m,
			...p,
			flip: {
				...m?.flip,
				...p?.flip
			},
			resize: {
				...m?.resize,
				...p?.resize
			},
			landing: {
				...m?.landing,
				...p?.landing
			},
			freeLanding: {
				...m?.freeLanding,
				...p?.freeLanding,
				release: {
					...m?.freeLanding?.release,
					...p?.freeLanding?.release
				}
			},
			target: {
				...m?.target,
				...p?.target,
				motion: {
					...m?.target?.motion,
					...p?.target?.motion
				},
				landing: {
					...m?.target?.landing,
					...p?.target?.landing
				},
				dismiss: {
					...m?.target?.dismiss,
					...p?.target?.dismiss
				}
			},
			group: {
				...m?.group,
				...p?.group
			}
		} : void 0, g = typeof t == "object" && !!t && t.invalidReturn === !0, _ = n && "getBoundingClientRect" in n ? n : void 0, v = n && !_ ? n : void 0, y = !!(_ && o && _ === o), b = !!(_ && f?.element === _), x = this.getObjectProxyLayout(i?.objectId ?? "", o), S = l?.resolveMoveLandingTarget?.({
			objectId: i?.objectId ?? "",
			destination: t
		}), C = s.resolveTarget?.(i?.objectId ?? "", t), w = d ? this.targets.findForSurface(d, a?.type)?.element : null, T = !g && !y ? _ && !y && !b && (_ === S || _ === C || _ === w) ? "target" : f?.layout === "free" ? "free" : "default" : "default", E = i ? this.moveBehavior.getContext(e).transaction.destination : null, D = typeof E?.fromSurfaceId == "string" ? E.fromSurfaceId : a?.surfaceId;
		return {
			objectId: i?.objectId ?? "",
			sessionId: e,
			sourceSurfaceId: D,
			destinationSurfaceId: d ?? void 0,
			mode: a?.visualMode ?? "detach",
			destination: t,
			sourceElement: o,
			beforeContent: r,
			targetElement: _,
			targetRect: v,
			sourceRect: o?.getBoundingClientRect(),
			visualSnapshot: o ? (s.captureVisualState ?? c.captureVisualState)(o) : void 0,
			targetSnapshot: _ ? (s.captureVisualState ?? c.captureVisualState)(_) : void 0,
			preserveTarget: l?.preserveMoveTarget ?? !1,
			landingMode: T,
			releaseMode: l?.releaseMode ?? "physical",
			contentScale: u.enabled && u.scale ? this.getSessionContentScale(e, a?.surfaceId ?? void 0) : void 0,
			landingContentScale: u.enabled && f?.layout === "grid" ? 1 : void 0,
			cameraOrigin: u.enabled && u.origin && u.landing ? this.getSurfaceCameraOrigin(a?.surfaceId) : void 0,
			landingCameraOrigin: T === "free" ? this.getSurfaceCameraOrigin(d ?? void 0) : void 0,
			landingCameraScale: T === "free" ? this.getSurfaceCameraScale(d ?? void 0) : void 0,
			camera: u,
			disableTargetVisualMorph: l?.disableTargetVisualMorph ?? !1,
			landingBounds: () => {
				let e = this.getDestinationSurfaceId(t), n = e ? this.resolveMoveSurfaceViewport(e) : null;
				return n && _ && !n.contains(_) ? null : n?.getBoundingClientRect() ?? null;
			},
			motion: h,
			motionEnabled: l?.motion?.enabled,
			proxyLayout: x,
			proxyZIndex: this.getObjectProxyZIndex(a?.id ?? ""),
			landingProxyZIndex: this.getObjectLandingProxyZIndex(a?.id ?? "", a?.surfaceId ?? void 0, d ?? void 0),
			affordances: l?.affordances,
			groupDrag: l?.groupDrag,
			group: i instanceof z ? {
				primaryObjectId: i.primaryObjectId,
				objectIds: i.objectIds,
				offsets: new Map(i.objectIds.map((e) => [e, i.offsetFor(e)]).filter((e) => !!e[1]))
			} : void 0
		};
	}
	createVisualProxy(e, t) {
		return this.visualMotion.create(e, t);
	}
	async landVisualProxy(e, t, n) {
		return this.visualMotion.land(e, t, n);
	}
	updateVisualProxy(e, t) {
		this.visualMotion.update(e, t);
	}
	resolveVisualTarget(e, t) {
		let n = this.sessionCoordinator.get(e);
		return n ? this.visualState.resolveTarget(n.objectId, t) : null;
	}
	findObjectIdByElement(e, t) {
		for (let n of this.objects.values()) if (n.id !== t && n.element === e) return n.id;
		return null;
	}
	applyVisualState(e, t, n) {
		this.visualState.apply(e, t, n);
		let r = this.getObjectAffordancesConfig(e);
		r && A(t, n.phase !== "idle" && n.phase !== "pressed", r.selector);
	}
	captureVisualState(e, t, n) {
		return this.visualState.capture(e, t, n);
	}
	async revealVisualProxy(e, t, n) {
		await this.visualMotion.reveal(e, t, n);
	}
	registerVisualProxy(e, t) {
		this.visualProxyCoordinator.get(e) && this.disposeVisualProxy(e), this.visualProxyCoordinator.register(e, t);
	}
	getVisualProxy(e) {
		return this.visualProxyCoordinator.get(e);
	}
	disposeVisualProxy(e) {
		let t = this.visualProxyCoordinator.get(e);
		if (!t) return;
		let n = this.sessionCoordinator.get(e), r = !1;
		if (n) {
			let i = this.createVisualLifecycleContext(e), a = i?.group ? this.getObjectGroupVisualAdapter(n.objectId) ?? this.getObjectVisualAdapter(n.objectId) : this.getObjectVisualAdapter(n.objectId);
			a.dispose && (a.dispose(t, i), r = !0);
		}
		r || t.dispose?.(), this.visualProxyCoordinator.remove(e);
	}
	createCompletionGate(e, t) {
		let n = !1, r, i = {
			promise: new Promise((e) => {
				r = e;
			}),
			complete: (t) => {
				n || (n = !0, r(t), this.sessionCoordinator.removeGate(e, i));
			},
			fail: () => {
				n || (n = !0, r(t), this.sessionCoordinator.removeGate(e, i));
			}
		};
		return this.sessionCoordinator.addGate(e, i), i;
	}
	setHitResolver(e) {
		this.hitResolver = e;
	}
	getHitResolver() {
		return this.hitResolver;
	}
	createRegisteredHitResolver(e) {
		return J(this.objects, this.surfaces, this.targets, e);
	}
	resolveMoveHit(e, t, n) {
		let r = this.objects.get(e), i = (r ? this.registry.objectTypes.get(r.visual ?? r.type) : void 0)?.resolveMoveHit?.({
			objectId: e,
			x: t,
			y: n
		});
		if (i) return i;
		if (this.hitResolver) {
			let r = this.hitResolver.findSurface({
				x: t,
				y: n
			});
			return r?.dataset.column ? {
				columnId: r.dataset.column,
				index: this.hitResolver.findIndex(r, {
					x: t,
					y: n
				}, e)
			} : null;
		}
		let a = this.createRegisteredHitResolver(e), o = a.findSurface({
			x: t,
			y: n
		});
		return o ? {
			columnId: o.id,
			index: a.findIndex(o, {
				x: t,
				y: n
			}, e)
		} : null;
	}
	resolveMoveSurfaceElement(e, t, n) {
		if (this.hitResolver) return this.hitResolver.findSurface({
			x: t,
			y: n
		});
		let r = this.createRegisteredHitResolver(e).findSurface({
			x: t,
			y: n
		});
		return r?.layout === "free" ? null : r?.viewport?.() ?? r?.element ?? null;
	}
	resolveMoveSurfaceViewport(e) {
		let t = this.surfaces.get(e);
		return t?.viewport?.() ?? t?.element ?? null;
	}
	normalizeFreeLandingRect(e, t) {
		if (!e) return t;
		let n = this.resolveMoveSurfaceViewport(e);
		if (!n || n.clientLeft === 0 && n.clientTop === 0) return t;
		let r = n.getBoundingClientRect(), i = n.offsetWidth > 0 ? r.width / n.offsetWidth : 1, a = n.offsetHeight > 0 ? r.height / n.offsetHeight : 1;
		return {
			...t,
			left: t.left + n.clientLeft * (Number.isFinite(i) && i > 0 ? i : 1),
			top: t.top + n.clientTop * (Number.isFinite(a) && a > 0 ? a : 1)
		};
	}
	createAutoScroller(e, t = {}) {
		let n = this.sessionCoordinator.get(e);
		return n ? Fe(n.cleanup, t) : null;
	}
	keepSurfaceTargetVisible(e, t) {
		let n = this.resolveMoveSurfaceViewport(e);
		if (!n || !t.isConnected || !n.contains(t)) return;
		let r = this.surfaceScrollFrames.get(n);
		r !== void 0 && (cancelAnimationFrame(r), this.surfaceScrollFrames.delete(n));
		let i = () => {
			let e = n.getBoundingClientRect(), r = t.getBoundingClientRect(), i = r.top < e.top ? n.scrollTop - (e.top - r.top) : r.bottom > e.bottom ? n.scrollTop + (r.bottom - e.bottom) : n.scrollTop, a = Math.max(0, n.scrollHeight - n.clientHeight);
			return Math.max(0, Math.min(i, a));
		}, a = i();
		if (Math.abs(a - n.scrollTop) < .5) return;
		let o = n.scrollTop, s = Math.max(200, this.registry.motionProfile?.landing?.duration ?? 250);
		if (typeof requestAnimationFrame > "u") {
			n.scrollTop = a;
			return;
		}
		let c = performance.now(), l = (e) => {
			let t = Math.min(1, (e - c) / s), r = 1 - (1 - t) ** 3;
			if (a = i(), n.scrollTop = o + (a - o) * r, t >= 1 && (n.scrollTop = a), t >= 1) {
				this.surfaceScrollFrames.delete(n);
				return;
			}
			let u = requestAnimationFrame(l);
			this.surfaceScrollFrames.set(n, u);
		}, u = requestAnimationFrame(l);
		this.surfaceScrollFrames.set(n, u);
	}
	concealVisualTarget(e, t) {
		t.isConnected && F(t, e);
	}
	getObjectSurfaceIndex(e, t) {
		let n = this.objects.get(e), r = t ?? n?.surfaceId;
		return !n || !r ? -1 : [...this.objects.values()].filter((e) => e.surfaceId === r).map((e) => e.id).sort((e, t) => {
			let n = this.objects.get(e)?.element?.getBoundingClientRect(), r = this.objects.get(t)?.element?.getBoundingClientRect();
			return !n || !r ? 0 : n.top - r.top || n.left - r.left;
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
	getNodePorts(e) {
		let t = this.objects.get(e), n = t?.element, r = t?.node?.ports;
		if (!t || !n?.isConnected || !r) return [];
		let i = n.getBoundingClientRect();
		return r.map((t) => {
			let n = Math.max(0, Math.min(1, t.position ?? .5)), r = t.side === "left" ? i.left : i.right, a = i.top + i.height * n, o = t.hitRadius ?? 10;
			return {
				...t,
				position: n,
				objectId: e,
				point: {
					x: r,
					y: a
				},
				rect: new DOMRect(r - o, a - o, o * 2, o * 2)
			};
		});
	}
	hitNodePort(e, t = {}) {
		let n = (t.objectId ? this.getNodePorts(t.objectId) : [...this.objects.values()].flatMap((e) => this.getNodePorts(e.id))).filter((e) => !t.objectType || !e.accepts || e.accepts.length === 0 || e.accepts.includes(t.objectType));
		if (t.snapToObject) {
			let t = [...new Set(n.map((e) => e.objectId))].flatMap((t) => {
				let r = this.objects.get(t), i = r?.element?.isConnected ? r.element.getBoundingClientRect() : null;
				if (!i || e.x < i.left || e.x > i.right || e.y < i.top || e.y > i.bottom) return [];
				let a = n.filter((e) => e.objectId === t), o = e.x <= i.left + i.width / 2 ? "left" : "right", s = a.find((e) => e.side === o) ?? a[0];
				return s ? [{
					port: s,
					distance: Math.hypot(e.x - s.point.x, e.y - s.point.y)
				}] : [];
			});
			if (t.length > 0) return t.sort((e, t) => e.distance - t.distance)[0].port;
		}
		return n.map((t) => ({
			port: t,
			distance: Math.hypot(e.x - t.point.x, e.y - t.point.y)
		})).filter((e) => e.distance <= (e.port.hitRadius ?? 10)).sort((e, t) => e.distance - t.distance)[0]?.port ?? null;
	}
	beginNodeConnection(e, t) {
		let n = this.getNodePorts(e).find((e) => e.id === t);
		return n ? (this.activeNodeConnection = {
			sourceObjectId: e,
			sourcePortId: t,
			source: n,
			currentPoint: { ...n.point }
		}, this.activeNodeConnection) : null;
	}
	updateNodeConnection(e) {
		return this.activeNodeConnection ? (this.activeNodeConnection = {
			...this.activeNodeConnection,
			currentPoint: { ...e }
		}, this.activeNodeConnection) : null;
	}
	finishNodeConnection(e, t) {
		let n = this.activeNodeConnection;
		this.activeNodeConnection = null;
		let r = this.getNodePorts(e).find((e) => e.id === t), i = n && r ? this.nodeConnectionId(n.sourceObjectId, n.sourcePortId, e, t) : null, a = i !== null && this.nodeConnections.has(i);
		if (!n || !r || n.sourceObjectId === e) return !1;
		let o = this.objects.get(e), s = this.objects.get(n.sourceObjectId);
		return !o || !s || r.accepts?.length && !r.accepts.includes(s.type) || i === null || a ? !1 : (this.nodeConnections.add(i), this.actions.emit({
			type: "connection-create",
			objectId: n.sourceObjectId,
			sourceObjectId: n.sourceObjectId,
			sourcePortId: n.sourcePortId,
			targetObjectId: e,
			targetPortId: t,
			timestamp: Date.now()
		}), !0);
	}
	cancelNodeConnection() {
		let e = this.activeNodeConnection;
		e && (this.activeNodeConnection = null, this.actions.emit({
			type: "connection-cancel",
			objectId: e.sourceObjectId,
			sourceObjectId: e.sourceObjectId,
			sourcePortId: e.sourcePortId,
			timestamp: Date.now()
		}));
	}
	deleteNodeConnection(e) {
		return this.nodeConnections.delete(e) ? (this.actions.emit({
			type: "connection-delete",
			objectId: e,
			connectionId: e,
			timestamp: Date.now()
		}), !0) : !1;
	}
	get activeConnection() {
		return this.activeNodeConnection;
	}
	registerNodeConnection(e) {
		let t = this.nodeConnectionId(e.sourceObjectId, e.sourcePortId, e.targetObjectId, e.targetPortId);
		return this.nodeConnections.add(t), t;
	}
	deleteNodeConnectionsBetween(e, t) {
		let n = `${e}:`, r = `->${t}:`, i = `${t}:`, a = `->${e}:`, o = 0;
		for (let e of this.nodeConnections) (e.startsWith(n) && e.includes(r) || e.startsWith(i) && e.includes(a)) && (this.nodeConnections.delete(e), o += 1);
		return o;
	}
	unregisterNodeConnection(e) {
		let t = typeof e == "string" ? e : this.nodeConnectionId(e.sourceObjectId, e.sourcePortId, e.targetObjectId, e.targetPortId);
		return this.nodeConnections.delete(t);
	}
	hasNodeConnection(e) {
		return this.nodeConnections.has(this.nodeConnectionId(e.sourceObjectId, e.sourcePortId, e.targetObjectId, e.targetPortId));
	}
	nodeConnectionId(e, t, n, r) {
		return `${e}:${t}->${n}:${r}`;
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
	captureMoveLayout(e) {
		let t = this.sessionCoordinator.get(e), n = t ? this.behaviors.get(t.type) : void 0;
		!(n instanceof W) || !t || n.captureLayout(this.createBehaviorContext(t));
	}
	playMoveLayout(e, t = !1) {
		let n = this.sessionCoordinator.get(e), r = n ? this.behaviors.get(n.type) : void 0;
		!(r instanceof W) || !n || r.playLayout(this.createBehaviorContext(n), t);
	}
	captureLayout(e, t = document, n = !0, r) {
		return u(e, t, n, r);
	}
	scheduleLayout(e, n = !1) {
		n ? d(e) : t(e);
	}
	runGroupToggle(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of this.surfaces.snapshot()) {
			if (!n.measureLayout) continue;
			let r = n.layoutElement?.() ?? n.element;
			r?.isConnected && e.root instanceof Node && e.root.contains(r) && t.set(r, n.measureLayout);
		}
		return s({
			...e,
			surfaceMeasures: t,
			layoutCache: this.layoutCache,
			layoutTransaction: this.layout
		});
	}
	cancelLayoutAnimations(e) {
		h(e);
	}
	resolveMoveTarget(e, t, n) {
		let r = this.sessionCoordinator.get(e);
		if (!r) return null;
		let i = this.createBehaviorContext(r), a = this.objects.get(r.objectId), o = (a ? this.registry.objectTypes.get(a.visual ?? a.type) : void 0)?.resolveMoveTarget?.({
			objectId: r.objectId,
			destination: t
		}), s = i.visual?.resolveTarget?.(r.objectId, t), c = n?.(), l = this.objects.get(r.objectId)?.element, u = this.getDestinationSurfaceId(t), d = this.targets.findForSurface(u ?? "", a?.type), f = o ?? s ?? d?.element ?? c ?? l ?? null;
		return !f || !f.isConnected ? null : (this.moveBehavior.getContext(e).transaction.target = f, f);
	}
	resolveMoveLandingTarget(e, t, n) {
		let r = this.sessionCoordinator.get(e);
		if (!r) return null;
		let i = this.objects.get(r.objectId), a = (i ? this.registry.objectTypes.get(i.visual ?? i.type) : void 0)?.resolveMoveLandingTarget?.({
			objectId: r.objectId,
			destination: t
		}), o = this.getDestinationSurfaceId(t), s = [
			a,
			this.targets.findForSurface(o ?? "", i?.type)?.element,
			n?.() ?? null,
			this.resolveMoveTarget(e, t)
		].find((e) => !!e?.isConnected);
		return !s || !s.isConnected ? null : s;
	}
	async resolveLandingTarget(e, t, n = 6) {
		let r = this.resolveMoveLandingResolution(e, t);
		if (r?.kind === "rect") return r;
		if (r?.kind === "element") {
			let e = r.element.getBoundingClientRect();
			if (e.width > 0 && e.height > 0) return r;
		}
		let i = await this.waitForMoveTarget(e, t, n);
		return i ? {
			kind: "element",
			element: i
		} : null;
	}
	resolveMoveLandingResolution(e, t, n) {
		let r = this.sessionCoordinator.get(e);
		if (!r) return null;
		let i = this.objects.get(r.objectId), a = i ? this.registry.objectTypes.get(i.visual ?? i.type) : void 0, o = typeof t == "object" && !!t && t.invalidReturn === !0, s = this.getDestinationSurfaceId(t), c = s ? this.surfaces.get(s)?.layout : void 0, l = a?.resolveMoveLandingTarget?.({
			objectId: r.objectId,
			destination: t
		}), u = s ? this.targets.findForSurface(s, i?.type)?.element ?? null : null, d = l ?? u;
		if (d) return {
			kind: "element",
			element: d
		};
		if (!o && c === "free") {
			let e = a?.resolveFreeLandingRect?.({
				objectId: r.objectId,
				destination: t
			});
			if (e && e.width > 0 && e.height > 0) return {
				kind: "rect",
				rect: this.normalizeFreeLandingRect(s, e)
			};
		}
		let f = this.getObjectVisualAdapter(r.objectId).resolveTarget?.(r.objectId, t) ?? null;
		if (f) return {
			kind: "element",
			element: f
		};
		let p = this.resolveMoveLandingTarget(e, t, n);
		return p ? {
			kind: "element",
			element: p
		} : null;
	}
	async waitForMoveTarget(e, t, n = 6) {
		let r = this.sessionCoordinator.get(e);
		if (!r) return null;
		let i = this.moveBehavior.getContext(e);
		i.sourceElement;
		let a = this.getDestinationSurfaceId(t), o = this.objects.get(r.objectId), s = !!(o ? this.registry.objectTypes.get(o.visual ?? o.type) : void 0)?.resolveMoveLandingTarget, c = i.transaction.destination, l = typeof c?.fromSurfaceId == "string" ? c.fromSurfaceId : null, u = !!a && a !== l;
		for (let i = 0; i < n; i += 1) {
			let n = this.sessionCoordinator.get(e);
			if (n !== r || n.state === "disposed" || n.state === "interrupt") return null;
			let i = this.resolveMoveLandingTarget(e, t), c = i?.getBoundingClientRect(), l = !!(c && c.width > 0 && c.height > 0), d = s || !a || o?.surfaceId === a, f = s || (a && i ? this.surfaces.get(a)?.element?.contains(i) ?? !1 : !1);
			if (i && l && d && (s || !u || f)) return i;
			await new Promise((e) => requestAnimationFrame(() => e()));
		}
		return null;
	}
	getDestinationSurfaceId(e) {
		if (!e || typeof e != "object") return null;
		let t = e;
		return typeof t.toSurfaceId == "string" ? t.toSurfaceId : typeof t.columnId == "string" ? t.columnId : null;
	}
	registerRegrab(e, t) {
		this.moveBehavior.registerRegrab(e, t);
	}
	getRegrab(e) {
		return this.moveBehavior.getRegrab(e);
	}
	regrab(e, t) {
		let n = this.moveBehavior.getRegrab(e);
		return n ? (n(t), !0) : !1;
	}
	clearRegrab(e, t) {
		this.moveBehavior.clearRegrab(e, t);
	}
	bindRegrabTarget(e, t, n, r) {
		let i = this.sessionCoordinator.get(e);
		i && this.inputCoordinator.bindRegrabTarget(i, t, n, r);
	}
	createRegrabContext(e, t, n, r) {
		let i = this.sessionCoordinator.get(e);
		if (!i || i.state !== "landing" || !n.isConnected || !r.isConnected) return null;
		let a = n.getBoundingClientRect(), o = r.getBoundingClientRect();
		if (a.width <= 0 || a.height <= 0 || o.width <= 0 || o.height <= 0) return null;
		let s = o.width || a.width, c = o.height || a.height, l = new DOMRect(a.left + (a.width - s) / 2, a.top + (a.height - c) / 2, s, c);
		return {
			sessionId: e,
			objectId: i.objectId,
			event: t,
			proxyElement: n,
			sourceElement: r,
			proxyRect: a,
			regrabRect: l,
			interrupt: (t) => this.interrupt(e, t ?? "regrab")
		};
	}
	takeoverRegrab(e) {
		let t = this.sessionCoordinator.get(e);
		return !t || t.state !== "landing" ? !1 : (this.interrupt(e, "regrab"), this.disposeVisualProxy(e), !0);
	}
	bindPointerSessionInput(e, t = {}) {
		let n = this.sessionCoordinator.get(e);
		return n ? this.inputCoordinator.bindSession(n, t) : () => void 0;
	}
	trackLandingTarget(e, t, n, r = {}) {
		let i = this.sessionCoordinator.get(e);
		return i ? this.visualState.trackTarget(i.cleanup, t, n, r) : () => void 0;
	}
	start(e) {
		return this.dispatcher.start(e);
	}
	startInternal(e) {
		let t = this.runtimeMove.start(e, {
			getBehavior: (e) => this.behaviors.get(e),
			createSession: (e, t) => this.startSession(e, t),
			getVisualStrategy: (e) => {
				let t = this.objects.get(e);
				return t ? this.registry.visualStrategies.get(t.type) : void 0;
			},
			bindLifecycle: (e, t) => this.moveBehavior.bindLifecycle(e, t),
			createContext: (e) => this.createBehaviorContext(e),
			isCurrent: (e) => !!this.sessionCoordinator.get(e),
			cancel: (e, t) => this.cancel(e, t),
			interrupt: (e, t) => this.interrupt(e, t)
		});
		return this.startMoveVisualTracking(t.id, "active"), t;
	}
	startMoveVisualTracking(e, t) {
		if (typeof requestAnimationFrame != "function" || (this.moveVisualPhases.set(e, t), this.moveVisualFrames.has(e))) return;
		let n = () => {
			let r = this.sessionCoordinator.get(e);
			if (!r) {
				this.moveVisualFrames.delete(e), this.moveVisualPhases.delete(e);
				return;
			}
			let i = this.visualProxyCoordinator.get(e)?.element, a = (i?.isConnected ? i : this.objects.get(r.objectId)?.element)?.getBoundingClientRect();
			a && a.width > 0 && a.height > 0 && this.events.emit({
				type: "move-visual-update",
				sessionId: e,
				objectId: r.objectId,
				phase: this.moveVisualPhases.get(e) ?? t,
				rect: {
					x: a.x,
					y: a.y,
					width: a.width,
					height: a.height
				}
			}), this.moveVisualFrames.set(e, requestAnimationFrame(n));
		};
		this.moveVisualFrames.set(e, requestAnimationFrame(n));
	}
	setMoveVisualPhase(e, t) {
		this.moveVisualPhases.has(e) && this.moveVisualPhases.set(e, t);
	}
	stopMoveVisualTracking(e) {
		let t = this.moveVisualFrames.has(e.id) || this.moveVisualPhases.has(e.id), n = this.moveVisualFrames.get(e.id);
		n !== void 0 && typeof cancelAnimationFrame == "function" && cancelAnimationFrame(n), this.moveVisualFrames.delete(e.id), this.moveVisualPhases.delete(e.id), t && this.events.emit({
			type: "move-visual-end",
			sessionId: e.id,
			objectId: e.objectId
		});
	}
	orchestrateMoveSession(e, t = {}) {
		let n;
		if (t.sessionId) {
			let e = this.sessionCoordinator.get(t.sessionId);
			if (!e) throw Error(`Session not found: ${t.sessionId}`);
			n = e;
		} else {
			t.driver && this.moveBehavior.setDriver(t.driver);
			let r = this.start(e);
			t.driver && this.moveBehavior.setDriver({}), n = this.sessionCoordinator.get(r.id);
		}
		let r = this.getMoveContext(n.id);
		if (t.followElement !== void 0 && (r.followElement = t.followElement), t.driver && this.bindMoveSession(n.id, t.driver), t.lifecycle ? this.bindMoveLifecycle(n.id, t.lifecycle) : t.visualStrategy && this.bindMoveLifecycle(n.id, t.visualStrategy), t.sessionId && t.prepareExisting) {
			let t = this.behaviors.get(n.type);
			if (t instanceof W) try {
				t.prepare(this.createBehaviorContext(n), e), n.state === "prepare" && n.transition("active");
			} catch (e) {
				this.cancel(n.id, e instanceof Error ? e.message : "prepare-failed");
			}
		}
		let i = this.bindPointerSessionInput(n.id, t.pointerInput);
		return {
			id: n.id,
			get state() {
				return n.state;
			},
			get moveContext() {
				return r;
			},
			cancel: (e) => this.cancel(n.id, e ?? "cancelled"),
			interrupt: (e) => this.interrupt(n.id, e ?? "interrupted"),
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
		return this.setMoveVisualPhase(e, "landing"), this.runtimeMove.release(e, t, {
			getSession: (e) => this.sessionCoordinator.get(e),
			getBehavior: (e) => this.behaviors.get(e),
			createContext: (e) => this.createBehaviorContext(e),
			captureLayout: (e) => this.captureMoveLayout(e),
			playLayout: (e, t) => this.playMoveLayout(e, t),
			cancel: (e, t) => this.cancel(e, t),
			end: (e) => this.endSession(e)
		});
	}
	cancel(e, t = "cancelled") {
		this.dispatcher.cancel(e, t);
	}
	cancelInternal(e, t = "cancelled") {
		let n = this.sessionCoordinator.get(e);
		if (!n) return;
		let r = this.behaviors.get(n.type), i = this.createBehaviorContext(n);
		this.stopMoveVisualTracking(n), this.runtimeSession.terminate(n, r, i, t, "cancel", (e, t, n) => {
			e instanceof W && e.cancelLayout(t, n), e?.cancel?.(t, n);
		}, (e) => this.failCompletionGates(e.id), (e, t) => this.disposeBehavior(e, t)), this.clearSessionContentScale(e);
	}
	interrupt(e, t = "cancel") {
		this.dispatcher.interrupt(e, t);
	}
	interruptInternal(e, t = "cancel") {
		let n = this.sessionCoordinator.get(e);
		if (!n) return;
		let r = this.behaviors.get(n.type), i = this.createBehaviorContext(n);
		this.stopMoveVisualTracking(n), this.runtimeSession.terminate(n, r, i, t, "interrupt", (e, t, n) => {
			e instanceof W && e.cancelLayout(t, n), e?.interrupt?.(t, n);
		}, (e) => this.failCompletionGates(e.id), (e, t) => this.disposeBehavior(e, t)), this.clearSessionContentScale(e);
	}
	startSession(e, t = "") {
		return this.sessionCoordinator.create(e, t, this.owner);
	}
	startGroupSession(e, t, n = {}) {
		let r = new z(e, t, this.owner, n);
		return this.sessionCoordinator.set(r), r;
	}
	getSession(e) {
		return this.sessionCoordinator.get(e);
	}
	getGroup(e) {
		let t = this.sessionCoordinator.get(e);
		if (t instanceof z) return {
			primaryObjectId: t.primaryObjectId,
			objectIds: t.objectIds
		};
	}
	takeSurface(e, t) {
		let n = this.sessionCoordinator.get(e);
		return n ? (n.takeSurface(t), this.owner.isOwnedBy(t, e)) : !1;
	}
	acquireObject(e, t) {
		return this.sessionCoordinator.acquireObject(e, t);
	}
	unregisterObjectWhenIdle(e, t) {
		let n = () => this.objects.unregister(e, t);
		this.sessionCoordinator.trackForObject(e, n) || n();
	}
	trackPlaceholder(e, t) {
		this.sessionCoordinator.track(e, t);
	}
	takeSurfaces(e, t) {
		return t.every((t) => this.takeSurface(e, t));
	}
	endSession(e) {
		this.stopMoveVisualTracking(e);
		let t = this.behaviors.get(e.type), n = this.createBehaviorContext(e);
		this.runtimeSession.finalize(e, t, n, (e) => this.disposeVisualProxy(e), (e, t) => this.disposeBehavior(e, t)), this.clearSessionContentScale(e.id);
	}
	failCompletionGates(e) {
		this.sessionCoordinator.failGates(e), this.disposeVisualProxy(e);
	}
	disposeBehavior(e, t) {
		try {
			e instanceof W && e.getLifecycle(t.session.id)?.surface?.dispose?.(t), e?.dispose?.(t);
		} catch (e) {
			console.error("Behavior dispose failed", e);
		}
	}
	createBehaviorContext(e) {
		let t = this.objects.get(e.objectId);
		return {
			session: e,
			emitAction: (e) => this.actions.emit(e),
			visual: t ? this.getVisualAdapter(t.visual ?? t.type) : void 0,
			hit: this.hitResolver
		};
	}
}, ze = new Re();
//#endregion
//#region src/adapters/dom.ts
function Be(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
	return {
		bindObject(n, r) {
			let i = e.objects.get(n);
			if (i) {
				if (r === null) {
					let e = t.get(n);
					if (e && i.element !== e) return;
					t.delete(n);
				} else t.set(n, r);
				e.objects.setElement(n, r);
			}
		},
		bindSurface(t, r) {
			let i = e.surfaces.get(t);
			if (i) {
				if (r === null) {
					let e = n.get(t);
					if (e && i.element !== e) return;
					n.delete(t);
				} else n.set(t, r);
				e.surfaces.setElement(t, r);
			}
		},
		bindTarget(t, n, a) {
			let o = r.get(t) ?? n.id ?? `runtime-target:${t}`;
			if (r.set(t, o), !a) {
				let n = i.get(t), a = e.targets.get(o);
				if (n && a?.element !== n) return;
				i.delete(t), e.targets.unregister(o), r.delete(t);
				return;
			}
			i.set(t, a), e.targets.register({
				...n,
				id: o,
				element: a
			});
		},
		getSurfaceElement(t) {
			return e.surfaces.get(t)?.element ?? null;
		},
		async runLayoutMutation(t) {
			let n = t.elements.length > 0 ? e.captureLayout(t.elements, t.root, !0) : null;
			await t.mutate(), await t.waitForPatch?.(), n && e.scheduleLayout(n);
		},
		dispose() {
			for (let t of r.values()) e.targets.unregister(t);
			t.clear(), n.clear(), r.clear(), i.clear();
		}
	};
}
//#endregion
//#region src/adapters/vue.ts
function Ve(e) {
	return Be(e);
}
//#endregion
//#region src/adapters/react.ts
function He(e) {
	return Be(e);
}
//#endregion
//#region src/dom/Hit.ts
function Ue(e, t) {
	let n = e.getBoundingClientRect();
	return t.x >= n.left && t.x <= n.right && t.y >= n.top && t.y <= n.bottom;
}
function We(e) {
	return {
		findSurface(t) {
			return Array.from(document.querySelectorAll(e.surfaceSelector)).find((e) => Ue(e, t)) ?? null;
		},
		findTarget(t, n, r) {
			return Array.from(t.querySelectorAll(e.targetSelector)).filter((e) => e.dataset.card !== r).find((e) => Ue(e, n)) ?? null;
		},
		findIndex(t, n, r) {
			let i = Array.from(t.querySelectorAll(e.targetSelector)).filter((e) => e.dataset.card !== r);
			for (let e = 0; e < i.length; e += 1) {
				let t = i[e].getBoundingClientRect();
				if (n.y < t.top + t.height / 2) return e;
			}
			return i.length;
		}
	};
}
function Ge(e, t, n, r) {
	let i = e.findSurface({
		x: t,
		y: n
	});
	if (!i) return null;
	let a = i.dataset.column;
	return a ? {
		columnId: a,
		index: e.findIndex(i, {
			x: t,
			y: n
		}, r)
	} : null;
}
//#endregion
export { Q as DEFAULT_GROUP_DRAG_CONFIG, x as DEFAULT_RELEASE_PROFILE, G as DefaultVisualAdapter, C as FOLLOW_PROFILE, y as FOLLOW_ROTATION, z as GroupDragSession, ce as LANDING_PROFILE, Ie as LayoutCache, Le as LayoutTransactionCoordinator, we as MoveActionCoordinator, W as MoveBehavior, Se as MoveCommitCoordinator, Ce as MoveLandingCoordinator, xe as MoveReleaseCoordinator, U as MoveTransaction, be as MoveUpdateCoordinator, B as ObjectStore, Re as Runtime, Me as RuntimeDispatcher, je as RuntimeInputCoordinator, ye as RuntimeMoveCoordinator, Y as RuntimeRegistry, _e as RuntimeSessionCoordinator, R as Session, X as SessionCoordinator, V as SurfaceStore, H as TargetStore, K as VisualAdapters, ke as VisualMotionCoordinator, Oe as VisualProxyCoordinator, De as VisualStateCoordinator, re as acquireSourceVisualLease, Ae as bindPointerSessionInput, h as cancelLayoutAnimations, l as captureCollectionPresence, u as captureLayoutFlip, b as coastOffset, le as createCardMotionController, se as createCubicBezierEasing, P as createDetachMoveFromAdapter, We as createDomHitResolver, ue as createFreeLandingMotion, $ as createGroupVisualAdapter, He as createReactRuntimeAdapter, J as createRegisteredHitResolver, Ve as createVueRuntimeAdapter, Ge as hitWithResolver, w as integrateSpring, o as playCollectionPresence, p as playLayoutFlip, D as resolveFreeLandingEasing, Ne as resolveGroupDragConfig, s as runGroupToggle, ze as runtime, m as setLayoutPresenceEnabled, S as shapeReleaseVelocity, Ee as trackLandingTarget, c as transitionGroupHeight };
