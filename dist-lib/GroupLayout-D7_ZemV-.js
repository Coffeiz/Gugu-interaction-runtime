//#region src/dom/MotionProfile.ts
var e = {
	flip: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	resize: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	landing: {
		duration: 300,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	freeLanding: {
		duration: 550,
		easing: "cubic-bezier(.22,1,.36,1)",
		coastSeconds: .12,
		maxCoast: 260,
		minVelocity: 30
	},
	target: {
		motion: {
			position: {
				stiffness: 420,
				damping: 41
			},
			scale: {
				stiffness: 420,
				damping: 41
			}
		},
		landing: {
			duration: 300,
			easing: "cubic-bezier(.22,1,.36,1)"
		},
		dismiss: {
			duration: 300,
			easing: "cubic-bezier(.22,1,.36,1)",
			scale: .72
		}
	},
	group: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	}
}, t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map(), i = null, a = null;
function o(e) {
	let t = e.match(/cubic-bezier\(([^)]+)\)/);
	if (!t) return (e) => e * e * (3 - 2 * e);
	let n = t[1].split(",").map(Number);
	if (n.length !== 4 || n.some((e) => !Number.isFinite(e))) return (e) => e * e * (3 - 2 * e);
	let [r, i, a, o] = n;
	return (e) => {
		if (e <= 0) return 0;
		if (e >= 1) return 1;
		let t = 0, n = 1;
		for (let i = 0; i < 12; i += 1) {
			let i = (t + n) / 2;
			3 * (1 - i) ** 2 * i * r + 3 * (1 - i) * i ** 2 * a + i ** 3 < e ? t = i : n = i;
		}
		let s = (t + n) / 2;
		return 3 * (1 - s) ** 2 * s * i + 3 * (1 - s) * s ** 2 * o + s ** 3;
	};
}
function s(e, t, n) {
	return e === null ? 0 : Math.min(1, Math.max(0, (n - e) / t));
}
function c(e, t) {
	let n = e.easing(s(e.started, e.duration, t));
	return {
		x: e.fromX * (1 - n),
		y: e.fromY * (1 - n)
	};
}
function l() {
	a !== null && (window.clearTimeout(a), a = null);
}
function u() {
	l();
	let e = Infinity;
	for (let n of t.values()) n.started !== null && (e = Math.min(e, n.started + n.duration));
	if (!Number.isFinite(e)) return;
	let n = Math.max(0, e - performance.now()) + 1;
	a = window.setTimeout(d, n);
}
function d() {
	a = null;
	let e = performance.now();
	for (let [r, i] of [...t]) i.started === null || e + .5 < i.started + i.duration || t.get(r) === i && (t.delete(r), n.delete(r), r.style.transition = "", r.style.transform = "", i.onComplete?.());
	u();
}
function f() {
	i === null || n.size > 0 || r.size > 0 || (cancelAnimationFrame(i), i = null);
}
function p() {
	i !== null || n.size === 0 && r.size === 0 || (i = requestAnimationFrame(m));
}
function m(e) {
	if (i = null, n.size > 0) {
		let r = [...n];
		n.clear();
		for (let n of r) {
			let r = t.get(n);
			!r || r.started !== null || (r.started = e, n.style.setProperty("transition", `transform ${r.duration}ms ${r.easingText}`, "important"), n.style.transform = "translate(0px, 0px)");
		}
		u();
	}
	for (let [t, n] of [...r]) {
		if (r.get(t) !== n) continue;
		let i = s(n.started, n.duration, e), a = n.from + (n.to - n.from) * n.easing(i);
		t.style.height = `${a}px`, !(i < 1) && (r.delete(t), n.onComplete?.());
	}
	p();
}
function h() {
	return t.size > 0 || r.size > 0;
}
function g(e, n = performance.now()) {
	let r = t.get(e);
	return r ? c(r, n) : null;
}
function _(e, t = performance.now()) {
	let n = e, r = 0, i = 0, a = !1;
	for (; n;) {
		let e = g(n, t);
		e && (r += e.x, i += e.y, a = !0), n = n.parentElement;
	}
	return a ? {
		x: r,
		y: i
	} : null;
}
function v(e, r = !0) {
	t.delete(e) && (n.delete(e), r && (t.size === 0 ? l() : u()), f());
}
function y(e) {
	t.has(e) && (v(e), e.style.transform = "");
}
function b(e, r, i, a, s, c) {
	v(e, !1), t.set(e, {
		started: null,
		duration: Math.max(1, a),
		fromX: r,
		fromY: i,
		easingText: s,
		easing: o(s),
		onComplete: c
	}), n.add(e), p();
}
function x(e) {
	r.delete(e) && f();
}
function S(e) {
	r.has(e) && (x(e), e.style.height = "");
}
function ee(e, t, n, i, a, s) {
	x(e), r.set(e, {
		started: performance.now(),
		duration: Math.max(1, i),
		from: t,
		to: n,
		easing: o(a),
		onComplete: s
	}), p();
}
//#endregion
//#region src/dom/Flip.ts
var C = e.flip.duration, w = e.flip.easing;
function te(e, t) {
	let n = /* @__PURE__ */ new Map();
	return e.forEach((e) => n.set(e, t?.rect(e) ?? e.getBoundingClientRect())), n;
}
function T(e) {
	let t = e.filter((e) => e.dataset.runtimeFlip === "true");
	if (t.length !== 0) for (let e of t) e.dataset.runtimeFlipToken = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1), delete e.dataset.runtimeFlip, y(e), e.style.setProperty("transition", "none", "important");
}
function ne(e, t, n = C, r = w, i, a) {
	let o = new Set(e.filter((e) => e.dataset.runtimeFlip === "true"));
	T(e);
	let s = [], c = 0, l = 0, u = 0, d = 0;
	for (let n of e) {
		if (a && !a(n)) {
			l += 1, o.has(n) && (n.style.transition = "");
			continue;
		}
		if (n.dataset.runtimeProxy === "true" || n.dataset.runtimePlaceholder === "true" || n.dataset.runtimeActive === "true") {
			d += 1, o.has(n) && (n.style.transition = "");
			continue;
		}
		let e = t.get(n);
		if (!e) {
			l += 1, o.has(n) && (n.style.transition = "");
			continue;
		}
		let r = i?.rect(n) ?? n.getBoundingClientRect();
		c += 1;
		let f = e.left - r.left, p = e.top - r.top;
		if (Math.abs(f) < .5 && Math.abs(p) < .5) {
			u += 1, n.style.transition = "";
			continue;
		}
		s.push({
			element: n,
			dx: f,
			dy: p
		});
	}
	for (let { element: e, dx: t, dy: i } of s) {
		e.style.setProperty("transition", "none", "important"), e.style.transform = `translate(${t}px, ${i}px)`;
		let a = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1);
		e.dataset.runtimeFlip = "true", e.dataset.runtimeFlipToken = a, b(e, t, i, n, r, () => {
			e.dataset.runtimeFlipToken === a && (e.style.transition = "", delete e.dataset.runtimeFlip);
		});
	}
	return {
		measured: c,
		animated: s.length,
		filteredSkipped: l,
		tinySkipped: u,
		runtimeSkipped: d
	};
}
//#endregion
//#region src/dom/CollectionPresence.ts
function E(e) {
	return e.dataset.layoutKey ?? e.dataset.card ?? "";
}
var D = /* @__PURE__ */ new WeakMap();
function re(e) {
	let t = e.closest("[data-layout-open=\"false\"]");
	return t !== null && t.dataset.runtimeGroupAnimating !== "true";
}
function O(e, t) {
	if (re(e)) return null;
	let n = e.closest("[data-layout-collection]");
	if (!n) return null;
	let r = t?.rect(e) ?? e.getBoundingClientRect(), i = t?.rect(n) ?? n.getBoundingClientRect();
	return r.width > 0 && r.height > 0 && i.width > 0 && r.width <= i.width * 1.25 && r.left >= i.left - 1 && r.right <= i.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function k(e, t) {
	return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
}
function ie(e, t, n) {
	if (!n || n.length === 0) return Array.from(e.querySelectorAll(t));
	let r = [], i = /* @__PURE__ */ new Set();
	for (let e of n) e.matches(t) && !i.has(e) && (i.add(e), r.push(e)), e.querySelectorAll(t).forEach((e) => {
		i.has(e) || (i.add(e), r.push(e));
	});
	return r;
}
function ae(e, t, n = E, r, i, a, o) {
	let s = /* @__PURE__ */ new Map(), c = o ? /* @__PURE__ */ new Set() : void 0;
	return {
		root: e,
		selector: t,
		collectionByKey: s,
		entries: ie(e, t, i).map((e) => {
			if (r?.(e) || !k(e, i)) return null;
			let t = O(e, a);
			if (!t) return null;
			let l = n(e);
			if (!l || o && !o(e)) return null;
			c?.add(l);
			let u = a?.rect(e) ?? e.getBoundingClientRect();
			return s.set(l, t.collectionId), {
				key: l,
				element: e,
				rect: {
					left: u.left,
					top: u.top,
					width: u.width,
					height: u.height
				},
				contentHTML: e.outerHTML
			};
		}).filter((e) => e !== null),
		ignore: r,
		include: o,
		includeKeys: c,
		scopeSurfaces: i
	};
}
function oe(e, t = {}, n) {
	let r = t.duration ?? 250, i = t.easing ?? "cubic-bezier(.22,1,.36,1)", a = t.key ?? E, o = /* @__PURE__ */ new Map();
	ie(e.root, e.selector, e.scopeSurfaces).filter((t) => {
		if (e.ignore?.(t) || !k(t, e.scopeSurfaces)) return !1;
		let r = O(t, n);
		if (!r) return !1;
		let i = a(t);
		return !i || (e.includeKeys ? !e.includeKeys.has(i) : e.include && !e.include(t)) ? !1 : (o.set(i, r.collectionId), !0);
	}).filter((t) => {
		let n = a(t);
		if (!n) return !1;
		let r = e.collectionByKey.get(n);
		return r === void 0 || r !== o.get(n);
	}).forEach((e) => {
		D.get(e)?.cancel();
		let t = e.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: r,
			easing: i,
			fill: "both"
		});
		D.set(e, t), t.finished.then(() => {
			D.get(e) === t && D.delete(e);
		}).catch(() => void 0);
	}), e.entries.forEach((e) => {
		if (o.has(e.key)) return;
		let t = document.createElement("template");
		t.innerHTML = e.contentHTML;
		let n = t.content.firstElementChild;
		if (!n) return;
		n.removeAttribute("data-file-id"), n.removeAttribute("data-layout-key"), n.removeAttribute("data-layout-role"), n.dataset.runtimePresenceGhost = "true";
		let a = e.rect;
		n.style.position = "fixed", n.style.left = `${a.left}px`, n.style.top = `${a.top}px`, n.style.width = `${a.width}px`, n.style.height = `${a.height}px`, n.style.margin = "0", n.style.pointerEvents = "none", n.style.zIndex = "2147483646", document.body.appendChild(n), n.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: r,
			easing: i,
			fill: "both"
		}).finished.then(() => n.remove()).catch(() => n.remove());
	});
}
//#endregion
//#region src/dom/LayoutMeasurement.ts
var se = 0, ce = 0, le = /* @__PURE__ */ new WeakMap(), A = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap();
function ue(e) {
	return new DOMRect(e.left, e.top, e.width, e.height);
}
function de(e) {
	let t = e.getRootNode();
	return t instanceof Document || t instanceof ShadowRoot ? t : e.ownerDocument;
}
var fe = class {
	constructor(e = `layout-measurement-${++se}`) {
		this.latest = /* @__PURE__ */ new WeakMap(), this.id = e;
	}
	publish(e, t) {
		let n = {
			contextId: this.id,
			sequence: ++ce,
			element: e,
			rect: ue(t)
		};
		this.latest.set(e, n), A.set(e, n);
		let r = j.get(e);
		if (r) for (let e of [...r]) e(n);
		return n;
	}
	latestFor(e) {
		return this.latest.get(e);
	}
};
function M(e) {
	return new fe(e);
}
function pe(e, t) {
	le.set(e, t);
}
function me(e) {
	return A.get(e);
}
function he(e, t) {
	let n = j.get(e);
	return n || (n = /* @__PURE__ */ new Set(), j.set(e, n)), n.add(t), () => {
		let n = j.get(e);
		n && (n.delete(t), n.size === 0 && j.delete(e));
	};
}
function N(e) {
	let t = /* @__PURE__ */ new WeakMap(), n = e, r = 0, i = 0;
	return {
		get context() {
			return n ??= M();
		},
		get stats() {
			return {
				reads: r,
				cacheHits: i
			};
		},
		rect(e) {
			let a = t.get(e);
			if (a) return i += 1, a;
			let o = e.getBoundingClientRect();
			return r += 1, t.set(e, o), n ??= le.get(de(e)) ?? M(), n.publish(e, o), o;
		}
	};
}
//#endregion
//#region src/dom/LayoutParticipantPolicy.ts
function ge(e) {
	let t = globalThis.CSS;
	return t?.escape ? t.escape(e) : e.replace(/([\\\"'\[\]#.>:~+*^$|=(), ])/g, "\\$1");
}
function P(e, t) {
	return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
}
function F(e, t) {
	if (!t || t.length === 0) return null;
	let n = null, r = Infinity;
	for (let i of t) {
		if (i !== e && !i.contains(e)) continue;
		let t = 0, a = e;
		for (; a && a !== i;) t += 1, a = a.parentElement;
		a === i && t < r && (n = i, r = t);
	}
	return n;
}
function I(e) {
	return e.closest("[data-layout-collection]");
}
function L(e) {
	return e.closest("[data-layout-content]");
}
function R(e, t) {
	return !!(e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
}
function z(e) {
	return e.closest("[data-layout-role=\"card\"]") ?? e;
}
function _e(e, t) {
	let n = z(t), r = n.parentElement;
	if (!r) return /* @__PURE__ */ new Set();
	let i = /* @__PURE__ */ new Set();
	for (let t of e) {
		let e = z(t);
		e !== n && e.parentElement === r && R(n, e) && i.add(t);
	}
	return i;
}
function ve(e, t, n) {
	if (!t) return null;
	if (t.mode === "removal") return t.sourceElement.isConnected && P(t.sourceElement, n) ? t.sourceElement : null;
	let r = t.layoutKey;
	if (r && typeof e.querySelectorAll == "function") {
		let i = `[data-layout-key="${ge(r)}"]`, a = Array.from(e.querySelectorAll(i)).filter((e) => e.isConnected && P(e, n)).filter((e) => e.dataset.runtimeProxy !== "true" && e.dataset.runtimePlaceholder !== "true"), o = a.find((e) => e !== t.sourceElement);
		if (o) return o;
		if (a.includes(t.sourceElement)) return t.sourceElement;
	}
	return t.sourceElement.isConnected && P(t.sourceElement, n) ? t.sourceElement : null;
}
function ye(e) {
	let t = e.sourceAffected ?? /* @__PURE__ */ new Set(), n = e.viewportEligible, r = ve(e.root, e.focus, e.scopeSurfaces), i = /* @__PURE__ */ new Set(), a = 0, o = 0, s = 0, c = r ? F(r, e.scopeSurfaces) : null, l = e.focus ? F(e.focus.sourceElement, e.scopeSurfaces) : null, u = r ? L(r) : null, d = r ? I(r) : null, f = e.focus?.sourceContainer ?? null;
	if (!f) for (let e of t) {
		f = e.parentElement;
		break;
	}
	let p = !!(r && f && r.parentElement === f);
	for (let f of e.cards) {
		let m = !0, h = !1;
		if (e.focus?.mode === "removal") m = t.has(f);
		else if (r) {
			let n = F(f, e.scopeSurfaces);
			if (p && f.parentElement === r.parentElement) m = R(r, f);
			else if (t.has(f)) m = !0;
			else if (c && n && n !== c) m = !(l && n === l);
			else if (!c || !n || n === c) {
				let e = L(f), t = I(f);
				u && e && e !== u && d && t === d ? (m = !1, h = !0) : (f.parentElement === r.parentElement || u && e === u) && (m = R(r, f));
			}
		}
		if (!m) {
			h ? o += 1 : a += 1;
			continue;
		}
		if (n && !n.has(f)) {
			s += 1;
			continue;
		}
		i.add(f);
	}
	return {
		eligible: i,
		focusTarget: r,
		rangeSkipped: a,
		inheritedSkipped: o,
		offscreenSkipped: s
	};
}
function be(e, t, n = Math.max(240, t.height)) {
	let r = e.left + e.width, i = e.top + e.height, a = t.left + t.width, o = t.top + t.height;
	return r >= t.left - n && e.left <= a + n && i >= t.top - n && e.top <= o + n;
}
//#endregion
//#region src/dom/GroupLayout.ts
var B = null, V = !1, H = /* @__PURE__ */ new WeakMap();
function xe(e) {
	B = e;
}
function Se(e) {
	V = e;
}
function U() {
	let t = B;
	return {
		flip: t?.flip ?? e.flip,
		resize: t?.resize ?? e.resize
	};
}
function Ce(e) {
	if (!(typeof performance > "u" || typeof performance.mark != "function")) try {
		performance.clearMarks?.("gugu:layout-flip"), performance.mark("gugu:layout-flip", { detail: e });
	} catch {
		try {
			performance.clearMarks?.("gugu:layout-flip"), performance.mark("gugu:layout-flip");
		} catch {}
	}
}
function we(e, t, n) {
	let r = (e) => !n || n.length === 0 || n.some((t) => t === e || t.contains(e)), i = Array.from(t.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(r), a = [], o = [];
	for (let t of e) r(t) && (t.closest("[data-layout-group]") === null ? o.push(t) : a.push(t));
	return {
		groups: i,
		groupLeaves: a,
		flatCards: o
	};
}
function Te(e, t) {
	let n = /* @__PURE__ */ new Map();
	if (!e) return n;
	for (let [r, i] of e) {
		if (!r.isConnected || !i.isConnected) continue;
		let e = t.rect(i);
		n.set(r, {
			top: e.top,
			left: e.left,
			width: e.width,
			height: e.height
		});
	}
	return n;
}
function Ee(e, t, n, r, i) {
	if (r.size === 0) return new Set(e);
	let a = new Set(e), o = /* @__PURE__ */ new Map();
	for (let e of t) a.has(e.element) && o.set(e.element, e.rect);
	for (let [e, t] of n) o.set(e, {
		top: t.top,
		left: t.left,
		width: t.width,
		height: t.height
	});
	let s = /* @__PURE__ */ new Set();
	for (let t of e) {
		let e = o.get(t), n = F(t, i), a = n ? r.get(n) : void 0;
		(!e || !a || be(e, a)) && s.add(t);
	}
	return s;
}
function W(e, t = document, n = !0, r, i = {}) {
	let a = (e) => {
		let t = i.scopeSurfaces;
		return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
	}, o = [...t instanceof HTMLElement && t.matches("[data-layout-surface]") ? [t] : [], ...Array.from(t.querySelectorAll("[data-layout-surface]"))].filter(a), s = N(), c = e.filter(a), l = i.focus ? _e(c, i.focus.sourceElement) : /* @__PURE__ */ new Set(), u = i.focus?.mode === "removal" ? c.filter((e) => l.has(e)) : c, { groups: d, groupLeaves: f, flatCards: p } = we(u, t, i.scopeSurfaces), m = qe(o, s, i.surfaceMeasures), h = Te(i.viewportBySurface, s), g = d.length > 0 ? Le([...d, ...f], s) : [], _ = p.length > 0 ? te(p, s) : /* @__PURE__ */ new Map(), v = Ee(u, g, _, h, i.scopeSurfaces), y = new Set(u), b = (i.scopeSurfaces ?? [t]).some((e) => e instanceof HTMLElement ? e.matches("[data-layout-collection]") || e.querySelector("[data-layout-collection]") !== null : t.querySelector("[data-layout-collection]") !== null), x = i.focus || i.viewportBySurface ? (e) => y.has(e) && v.has(e) : void 0;
	return Me(t, {
		root: t,
		group: g.length > 0 ? { before: g } : void 0,
		flat: p.length > 0 ? {
			elements: p,
			before: _
		} : void 0,
		surfaces: m,
		presence: n && b ? ae(t, "[data-layout-role=\"card\"]", void 0, r, i.scopeSurfaces, s, x) : void 0,
		participants: {
			cards: u,
			scopeSurfaces: i.scopeSurfaces ? [...i.scopeSurfaces] : void 0,
			focus: i.focus,
			sourceAffected: l,
			viewportEligible: v,
			candidateCards: c.length,
			capturedCards: u.length,
			captureReads: s.stats.reads,
			captureCacheHits: s.stats.cacheHits
		}
	});
}
function G(e) {
	let t = N(), n = U(), r = e.participants ? ye({
		cards: e.participants.cards,
		root: e.root,
		focus: e.participants.focus,
		scopeSurfaces: e.participants.scopeSurfaces,
		sourceAffected: e.participants.sourceAffected,
		viewportEligible: e.participants.viewportEligible
	}) : null, i = r?.eligible, a = e.participants ? new Set(e.participants.cards) : void 0;
	Je(e.surfaces, n.resize.duration, n.resize.easing, t);
	let o = e.group ? Oe(e.group.before) : null, s = e.group ? ze(e.group.before, n.flip.duration, n.flip.easing, t, a, i) : null, c = e.flat ? ne(e.flat.elements, e.flat.before, n.flip.duration, n.flip.easing, t, i ? (e) => i.has(e) : void 0) : null;
	e.presence && oe(e.presence, {
		duration: n.flip.duration,
		easing: n.flip.easing
	}, t), o && ke(o, n.flip.duration + 50);
	let l = e.participants, u = l ? Math.max(0, l.candidateCards - l.capturedCards) : 0;
	Ce({
		candidateCards: l?.candidateCards ?? 0,
		capturedCards: l?.capturedCards ?? 0,
		eligibleCards: i?.size ?? l?.capturedCards ?? 0,
		captureReads: l?.captureReads ?? 0,
		captureCacheHits: l?.captureCacheHits ?? 0,
		playReads: t.stats.reads,
		playCacheHits: t.stats.cacheHits,
		rangeSkipped: u + (r?.rangeSkipped ?? 0),
		offscreenSkipped: r?.offscreenSkipped ?? 0,
		parentOwnedSkipped: (r?.inheritedSkipped ?? 0) + (s?.parentInherited ?? 0),
		measuredCards: (s?.measuredCards ?? 0) + (c?.measured ?? 0),
		animatedCards: (s?.animatedCards ?? 0) + (c?.animated ?? 0),
		animatedGroups: s?.animatedGroups ?? 0,
		tinyDeltaSkipped: (s?.tinySkipped ?? 0) + (c?.tinySkipped ?? 0)
	});
}
var K = /* @__PURE__ */ new WeakMap(), De = 0;
function Oe(e) {
	let t = e.filter((e) => e.element.matches("[data-layout-group], [data-layout-content]")).filter((e) => e.rect.height > 0).map((e) => ({
		element: e.element,
		overflow: e.element.style.overflow
	})).filter((e) => e.element.isConnected).filter((e) => e.element.dataset.runtimeGroupAnimating !== "true").filter((e) => getComputedStyle(e.element).overflow !== "visible");
	if (t.length === 0) return null;
	let n = t[0].element.getRootNode();
	K.get(n)?.entries.forEach(({ element: e, overflow: t }) => {
		e.style.overflow = t;
	}), t.forEach(({ element: e }) => {
		e.style.overflow = "visible";
	});
	let r = {
		token: String(++De),
		entries: t
	};
	return K.set(n, r), r;
}
function ke(e, t) {
	let n = e.entries[0]?.element.getRootNode();
	n && (e.timeout = window.setTimeout(() => {
		K.get(n)?.token === e.token && (e.entries.forEach(({ element: e, overflow: t }) => {
			e.style.overflow = t;
		}), K.delete(n));
	}, t));
}
function Ae(e) {
	q.set(e.root, e), queueMicrotask(() => {
		q.get(e.root) === e && (q.delete(e.root), G(e));
	});
}
function je(e) {
	q.set(e.root, e), requestAnimationFrame(() => {
		q.get(e.root) === e && (q.delete(e.root), G(e));
	});
}
function Me(e, t) {
	let n = q.get(e);
	if (!n) return t;
	let r = Ie(t.surfaces, n.surfaces), i = Pe(t.flat, n.flat), a = Fe(t.group, n.group);
	return {
		...t,
		flat: i,
		group: a,
		surfaces: r,
		participants: Ne(t.participants, n.participants)
	};
}
function Ne(e, t) {
	if (!e || !t) return e;
	let n = [.../* @__PURE__ */ new Set([...t.cards, ...e.cards])], r = /* @__PURE__ */ new Set([...t.sourceAffected, ...e.sourceAffected]);
	return {
		...e,
		cards: n,
		focus: void 0,
		sourceAffected: r,
		viewportEligible: new Set(n),
		candidateCards: Math.max(e.candidateCards, t.candidateCards),
		capturedCards: n.length,
		captureReads: e.captureReads + t.captureReads,
		captureCacheHits: e.captureCacheHits + t.captureCacheHits
	};
}
function Pe(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = [.../* @__PURE__ */ new Set([...t.elements, ...e.elements])], r = new Map(t.before);
	for (let [t, n] of e.before) r.has(t) || r.set(t, n);
	return {
		...e,
		elements: n,
		before: r
	};
}
function Fe(e, t) {
	if (!e) return t;
	if (!t) return e;
	let n = new Map(e.before.map((e) => [e.element, e])), r = new Map(t.before.map((e) => [e.element, e.rect]));
	return { before: [.../* @__PURE__ */ new Set([...t.before.map((e) => e.element), ...e.before.map((e) => e.element)])].map((e) => {
		let i = n.get(e), a = t.before.find((t) => t.element === e), o = i ?? a;
		return {
			...o,
			rect: r.get(e) ?? o.rect
		};
	}) };
}
function Ie(e, t) {
	let n = new Map(e.map((e) => [e.element, e])), r = new Map(t.map((e) => [e.element, e]));
	return [.../* @__PURE__ */ new Set([...t.map((e) => e.element), ...e.map((e) => e.element)])].map((e) => {
		let t = n.get(e), i = r.get(e);
		return t ? i ? {
			...t,
			rect: i.rect,
			inlineStyle: i.inlineStyle
		} : t : i;
	});
}
var q = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap();
function Y(e, t) {
	let n = t?.rect(e) ?? e.getBoundingClientRect();
	return {
		top: n.top,
		left: n.left,
		width: n.width,
		height: n.height
	};
}
function Le(e, t) {
	let n = e.filter((e) => {
		let n = t?.rect(e) ?? e.getBoundingClientRect();
		return n.width > 0 && n.height > 0;
	}), r = new Set(n);
	return n.map((e) => ({
		element: e,
		parent: Re(e, r),
		rect: Y(e, t)
	}));
}
function Re(e, t) {
	let n = e.parentElement;
	for (; n;) {
		if (t.has(n)) return n;
		n = n.parentElement;
	}
	return null;
}
function ze(e, t = C, n = w, r, i, a) {
	let o = e.map((e) => e.element), s = new Set(o.filter((e) => e.dataset.runtimeFlip === "true"));
	T(o);
	let c = /* @__PURE__ */ new Map(), l = 0, u = 0, d = 0, f = 0;
	for (let t of e) {
		let e = i?.has(t.element) ?? !1;
		if (e && a && !a.has(t.element)) {
			d += 1, s.has(t.element) && (t.element.style.transition = "");
			continue;
		}
		if (t.element.dataset.runtimeProxy === "true" || t.element.dataset.runtimePlaceholder === "true" || t.element.dataset.runtimeActive === "true") {
			f += 1, s.has(t.element) && (t.element.style.transition = "");
			continue;
		}
		let n = Y(t.element, r);
		e ? l += 1 : u += 1, c.set(t.element, {
			x: t.rect.left - n.left,
			y: t.rect.top - n.top
		});
	}
	let p = [], m = 0, h = 0;
	for (let t of e) {
		let e = c.get(t.element);
		if (!e) continue;
		let n = t.parent ? c.get(t.parent) : void 0, r = e.x - (n?.x ?? 0), a = e.y - (n?.y ?? 0), o = i?.has(t.element) ?? !1;
		if (Math.abs(r) < .5 && Math.abs(a) < .5) {
			m += 1, o && n && (Math.abs(e.x) >= .5 || Math.abs(e.y) >= .5) && (h += 1), t.element.dataset.runtimeGroupAnimating !== "true" && t.element.dataset.runtimeFlip !== "true" && (t.element.style.transition = "");
			continue;
		}
		let s = String(Number(t.element.dataset.runtimeFlipToken ?? "0") + 1);
		p.push({
			element: t.element,
			dx: r,
			dy: a,
			token: s,
			isCard: o
		});
	}
	for (let { element: e, dx: t, dy: n, token: r } of p) e.style.transform = `translate(${t}px, ${n}px)`, e.style.transition = "none", e.dataset.runtimeFlip = "true", e.dataset.runtimeFlipToken = r;
	for (let { element: e, dx: r, dy: i, token: a } of p) b(e, r, i, t, n, () => {
		e.dataset.runtimeFlipToken === a && (e.style.transition = "", e.style.transform = "", delete e.dataset.runtimeFlip);
	});
	return {
		measuredCards: l,
		measuredGroups: u,
		animatedCards: p.filter((e) => e.isCard).length,
		animatedGroups: p.filter((e) => !e.isCard).length,
		filteredSkipped: d,
		tinySkipped: m,
		runtimeSkipped: f,
		parentInherited: h
	};
}
function Be(e, t, n = C, r = w, i, a = !1, o = !1) {
	if (e.dataset.runtimeLayoutTransaction === "true" || e.dataset.runtimeSurfaceResize === "true") return !1;
	X(e);
	let s = i ?? e.getBoundingClientRect().height, c = String(Number(e.dataset.runtimeGroupToken ?? "0") + 1);
	e.dataset.runtimeGroupToken = c;
	let l = Math.abs(Math.max(0, t) - s), u = o ? Math.max(0, n) : Math.min(Math.max(l / 8, 200), 350);
	e.dataset.runtimeGroupAnimating = "true", e.style.overflow = "hidden", e.style.height = `${s}px`, e.style.transition = `height ${u}ms ${r}`, e.offsetHeight;
	let d = {
		frame: null,
		timeout: null
	};
	return J.set(e, d), d.frame = requestAnimationFrame(() => {
		d.frame = null, e.style.height = `${Math.max(0, t)}px`;
	}), d.timeout = window.setTimeout(() => {
		e.dataset.runtimeGroupToken === c && (t <= 0 ? (e.style.height = "0px", e.style.overflow = "hidden") : a ? (e.style.height = `${t}px`, e.style.overflow = "") : (e.style.height = "", e.style.overflow = ""), e.style.transition = "", delete e.dataset.runtimeGroupAnimating, J.delete(e));
	}, u + 40), !0;
}
function X(e) {
	let t = J.get(e);
	t && (t.frame !== null && cancelAnimationFrame(t.frame), t.timeout !== null && window.clearTimeout(t.timeout), J.delete(e));
}
function Ve(e) {
	q.delete(e);
	let t = typeof Node < "u" && e instanceof Node, n = t ? e.getRootNode() : e, r = K.get(n);
	r && (r.timeout !== void 0 && window.clearTimeout(r.timeout), r.entries.forEach(({ element: n, overflow: r }) => {
		t && !e.contains(n) || (n.style.overflow = r);
	}), K.delete(n));
	let i = [];
	e instanceof HTMLElement && i.push(e), typeof e.querySelectorAll == "function" && i.push(...Array.from(e.querySelectorAll("[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-runtime-layout-transaction], [data-layout-content]")));
	for (let e of i) {
		let t = e.dataset.runtimeFlip === "true" || e.dataset.runtimeGroupAnimating === "true" || e.dataset.runtimeSurfaceResize === "true" || e.dataset.runtimeLayoutTransaction === "true";
		y(e), S(e), X(e);
		let n = Z.get(e);
		n && (Q(e, n.baseStyle), Z.delete(e)), e.dataset.runtimeGroupAnimating === "true" && (e.style.height = e.dataset.layoutOpen === "false" ? "0px" : "", e.style.overflow = e.dataset.layoutOpen === "false" ? "hidden" : "", e.style.transition = ""), t && (e.style.transform = ""), e.dataset.runtimeFlip === "true" && delete e.dataset.runtimeFlip, delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction, delete e.dataset.runtimeGroupAnimating;
	}
}
async function He(e) {
	let t = e.root instanceof HTMLElement ? e.root.ownerDocument : e.root, n = e.layoutTransaction?.begin(t, "group-toggle");
	n && e.layoutTransaction?.request(t, {
		type: "group-toggle",
		opening: e.opening
	});
	let r = (H.get(e.content) ?? 0) + 1;
	H.set(e.content, r);
	let i = Array.from(e.root.querySelectorAll("[data-layout-role=\"card\"]")), a = (i.length > 0 ? i : Array.from(e.root.querySelectorAll(".done-card-item, [data-card]"))).filter((e) => {
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0;
	}), o = e.content.getBoundingClientRect().height, s = W(a, e.root, !1, void 0, { surfaceMeasures: e.surfaceMeasures });
	!e.opening && o > 0 && (X(e.content), e.content.dataset.runtimeGroupAnimating = "true", e.content.style.height = `${o}px`, e.content.style.overflow = "hidden", e.content.style.transition = "");
	let c = V ? Ge(e.content, e.opening, e.duration, e.easing) : null;
	if (e.mutate(), await e.waitForLayout(), H.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let l = e.layoutCache?.getGroup(e.content, e.opening), u = e.content.scrollHeight, d = e.opening ? u : 0, f = e.opening && l && l.height === d ? l : void 0;
	if (Be(e.content, d, e.duration, e.easing, o), c && Ke(c, e.opening), await new Promise((e) => requestAnimationFrame(() => e())), H.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let p = f ? new Map(f.surfaceTargets) : Ue(s.surfaces, e.content, d);
	e.layoutCache?.setGroup(e.content, e.opening, d, p);
	let m = p.size > 0 ? {
		...s,
		surfaces: s.surfaces.map((e) => ({
			...e,
			targetMeasure: p.get(e.element)
		}))
	} : s, h = (e) => {
		e && !e.isCurrent() || G(m);
	};
	n && e.layoutTransaction?.defer(t, n.participantId, (e) => h(e), "group-flip") || h(), e.layoutTransaction?.commit(t, n?.participantId);
}
function Ue(e, t, n) {
	let r = /* @__PURE__ */ new Map();
	if (e.length === 0) return r;
	let i = We(t), a = i ? Qe(i) : null, o = {
		height: t.style.height,
		overflow: t.style.overflow,
		transition: t.style.transition
	};
	t.style.height = `${Math.max(0, n)}px`, t.style.overflow = "hidden", t.style.transition = "none";
	let s = e.map((e) => ({
		item: e,
		height: e.element.style.height,
		overflow: e.element.style.overflow,
		transition: e.element.style.transition
	}));
	return s.forEach(({ item: e }) => {
		e.measure && (e.element.style.height = "auto", e.element.style.overflow = "visible", e.element.style.transition = "none");
	}), t.offsetHeight, s.forEach(({ item: e }) => {
		e.measure && r.set(e.element, e.measure());
	}), s.forEach(({ item: e, height: t, overflow: n, transition: r }) => {
		e.element.style.height = t, e.element.style.overflow = n, e.element.style.transition = r;
	}), t.style.height = o.height, t.style.overflow = o.overflow, t.style.transition = o.transition, a && i && $e(i, a), r;
}
function We(e) {
	let t = e.parentElement;
	for (; t;) {
		let e = getComputedStyle(t);
		if (/(auto|scroll|overlay)/.test(`${e.overflowY} ${e.overflow}`)) return t;
		t = t.parentElement;
	}
	return null;
}
function Ge(e, t, n = C, r = w) {
	let i = Array.from(e.querySelectorAll("[data-layout-role=\"card\"], .done-card-item")), a = String(Number(e.dataset.runtimePresenceToken ?? "0") + 1);
	return e.dataset.runtimePresenceToken = a, i.forEach((e) => {
		t && (e.style.opacity = "0");
	}), {
		content: e,
		elements: i,
		token: a,
		duration: n
	};
}
function Ke(e, t) {
	let { content: n, elements: r, token: i, duration: a } = e;
	requestAnimationFrame(() => {
		n.dataset.runtimePresenceToken === i && r.forEach((e) => {
			e.animate([{ opacity: +!t }, { opacity: +!!t }], {
				duration: a,
				easing: "cubic-bezier(.22,1,.36,1)",
				fill: "both"
			});
		});
	}), window.setTimeout(() => {
		n.dataset.runtimePresenceToken === i && r.forEach((e) => {
			e.style.opacity = "";
		});
	}, a + 40);
}
function qe(e, t, n) {
	return e.map((e) => {
		e.dataset.runtimeLayoutTransaction = "true";
		let r = Y(e, t), i = n?.get(e), a = Ze(e);
		return i && !Z.has(e) && (e.style.height = `${$(e, r.height)}px`, e.style.overflow = "hidden"), {
			element: e,
			rect: r,
			measure: i,
			inlineStyle: a
		};
	});
}
function Je(e, t = C, n = w, r) {
	Ye(e);
	let i = e.filter((e) => e.element.isConnected).map((e) => {
		let t = Y(e.element, r), n = e.targetMeasure === void 0 ? e.measure?.() : e.targetMeasure, i = n ? {
			...t,
			...n.width === void 0 ? {} : { width: n.width },
			height: n.height
		} : t;
		return {
			item: e,
			next: i,
			profile: U().resize,
			fromHeight: $(e.element, e.rect.height),
			toHeight: $(e.element, i.height)
		};
	}).filter(({ item: e, next: t }) => Math.abs(e.rect.height - t.height) >= .5);
	if (i.length === 0) {
		e.forEach(({ element: e, inlineStyle: t }) => {
			Q(e, t), delete e.dataset.runtimeLayoutTransaction;
		});
		return;
	}
	let a = new Set(i.map(({ item: e }) => e.element));
	e.forEach(({ element: t }) => {
		if (!a.has(t)) {
			let n = e.find((e) => e.element === t);
			n && Q(t, n.inlineStyle), delete t.dataset.runtimeLayoutTransaction;
		}
	});
	let o = /* @__PURE__ */ new Map();
	for (let { item: e, fromHeight: t } of i) {
		let n = e.element.style, r = {
			baseStyle: Z.get(e.element)?.baseStyle ?? e.inlineStyle,
			token: String(++Xe)
		};
		Z.set(e.element, r), o.set(e.element, r.token), n.overflow = "hidden", n.transition = "none", n.height = `${t}px`, e.element.dataset.runtimeSurfaceResize = "true", e.element.dataset.runtimeSurfaceResizeToken = r.token;
	}
	requestAnimationFrame(() => {
		for (let { item: e, fromHeight: t, toHeight: n, profile: r } of i) {
			let i = e.element.style, a = Z.get(e.element), s = o.get(e.element);
			if (!a || !s || a.token !== s || e.element.dataset.runtimeSurfaceResizeToken !== s) continue;
			let c = a.token;
			i.transition = "none", ee(e.element, t, n, r.duration, r.easing), window.setTimeout(() => {
				if (e.element.dataset.runtimeSurfaceResizeToken !== c) return;
				let t = Z.get(e.element);
				!t || t.token !== c || (Q(e.element, t.baseStyle), e.measure && (i.height = `${n}px`), Z.delete(e.element), delete e.element.dataset.runtimeSurfaceResize, delete e.element.dataset.runtimeLayoutTransaction);
			}, r.duration + 40);
		}
	});
}
function Ye(e) {
	let t = e.filter((e) => e.element.dataset.runtimeSurfaceResize === "true");
	if (t.length !== 0) for (let { element: e } of t) {
		if (!Z.get(e)) continue;
		let t = Y(e).height;
		S(e), e.style.height = `${$(e, t)}px`, e.style.overflow = "hidden", e.style.transition = "none", Z.delete(e), delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction;
	}
}
var Z = /* @__PURE__ */ new WeakMap(), Xe = 0;
function Ze(e) {
	return {
		height: e.style.height,
		overflow: e.style.overflow,
		transition: e.style.transition
	};
}
function Q(e, t) {
	e.style.height = t.height, e.style.overflow = t.overflow, e.style.transition = t.transition;
}
function $(e, t) {
	let n = getComputedStyle(e);
	if (n.boxSizing === "border-box") return t;
	let r = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
	return Math.max(0, t - r);
}
function Qe(e) {
	let t = Math.max(0, e.scrollHeight - e.clientHeight), n = e.scrollTop <= 1 ? "top" : t - e.scrollTop <= 1 ? "bottom" : "middle";
	return {
		top: e.scrollTop,
		height: e.scrollHeight,
		clientHeight: e.clientHeight,
		anchor: n
	};
}
function $e(e, t) {
	let n = Math.max(0, e.scrollHeight - e.clientHeight);
	e.scrollTop = t.anchor === "top" ? 0 : t.anchor === "bottom" ? n : Math.min(t.top, n);
}
//#endregion
export { _, Ae as a, xe as c, M as d, me as f, h as g, oe as h, He as i, Be as l, ae as m, W as n, je as o, he as p, G as r, Se as s, Ve as t, pe as u, e as v };
