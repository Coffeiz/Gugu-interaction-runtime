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
}, t = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
function r(e) {
	let t = e.match(/cubic-bezier\(([^)]+)\)/);
	if (!t) return (e) => e * e * (3 - 2 * e);
	let n = t[1].split(",").map(Number);
	if (n.length !== 4 || n.some((e) => !Number.isFinite(e))) return (e) => e * e * (3 - 2 * e);
	let [r, i, a, o] = n;
	return (e) => {
		let t = 0, n = 1;
		for (let i = 0; i < 12; i += 1) {
			let i = (t + n) / 2;
			3 * (1 - i) ** 2 * i * r + 3 * (1 - i) * i ** 2 * a + i ** 3 < e ? t = i : n = i;
		}
		let s = (t + n) / 2;
		return 3 * (1 - s) ** 2 * s * i + 3 * (1 - s) * s ** 2 * o + s ** 3;
	};
}
function i(e) {
	let n = t.get(e);
	n && (cancelAnimationFrame(n.frame), t.delete(e), e.style.transform = "");
}
function a(e, n, a, o, s, c) {
	i(e);
	let l = {
		frame: 0,
		started: performance.now(),
		duration: Math.max(1, o),
		fromX: n,
		fromY: a,
		easing: r(s)
	};
	t.set(e, l);
	let u = (n) => {
		if (t.get(e) !== l) return;
		let r = Math.min(1, (n - l.started) / l.duration), i = l.easing(r);
		if (e.style.transform = `translate(${(l.fromX * (1 - i)).toFixed(3)}px, ${(l.fromY * (1 - i)).toFixed(3)}px)`, r >= 1) {
			t.delete(e), e.style.transform = "", c?.();
			return;
		}
		l.frame = requestAnimationFrame(u);
	};
	l.frame = requestAnimationFrame(u);
}
function o(e) {
	let t = n.get(e);
	t && (cancelAnimationFrame(t.frame), n.delete(e), e.style.height = "");
}
function s(e, t, i, a, s, c) {
	o(e);
	let l = {
		frame: 0,
		started: performance.now(),
		duration: Math.max(1, a),
		fromX: t,
		fromY: i,
		easing: r(s)
	};
	n.set(e, l);
	let u = (t) => {
		if (n.get(e) !== l) return;
		let r = Math.min(1, (t - l.started) / l.duration), i = l.fromX + (l.fromY - l.fromX) * l.easing(r);
		if (e.style.height = `${i}px`, r >= 1) {
			n.delete(e), c?.();
			return;
		}
		l.frame = requestAnimationFrame(u);
	};
	l.frame = requestAnimationFrame(u);
}
//#endregion
//#region src/dom/Flip.ts
var c = e.flip.duration, l = e.flip.easing;
function u(e, t) {
	let n = /* @__PURE__ */ new Map();
	return e.forEach((e) => n.set(e, t?.rect(e) ?? e.getBoundingClientRect())), n;
}
function d(e) {
	let t = e.filter((e) => e.dataset.runtimeFlip === "true");
	if (t.length !== 0) for (let e of t) e.dataset.runtimeFlipToken = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1), delete e.dataset.runtimeFlip, i(e), e.style.setProperty("transition", "none", "important");
}
function f(e, t, n = c, r = l, i) {
	d(e);
	let o = [];
	for (let n of e) {
		if (n.dataset.runtimeProxy === "true" || n.dataset.runtimePlaceholder === "true" || n.dataset.runtimeActive === "true") continue;
		let e = t.get(n);
		if (!e) continue;
		let r = i?.rect(n) ?? n.getBoundingClientRect(), a = e.left - r.left, s = e.top - r.top;
		if (Math.abs(a) < .5 && Math.abs(s) < .5) {
			n.style.transition = "";
			continue;
		}
		o.push({
			element: n,
			dx: a,
			dy: s
		});
	}
	for (let { element: e, dx: t, dy: i } of o) {
		e.style.setProperty("transition", "none", "important"), e.style.transform = `translate(${t}px, ${i}px)`;
		let o = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1);
		e.dataset.runtimeFlip = "true", e.dataset.runtimeFlipToken = o, a(e, t, i, n, r, () => {
			e.dataset.runtimeFlipToken === o && (e.style.transition = "", delete e.dataset.runtimeFlip);
		});
	}
}
//#endregion
//#region src/dom/CollectionPresence.ts
function p(e) {
	return e.dataset.layoutKey ?? e.dataset.card ?? "";
}
var m = /* @__PURE__ */ new WeakMap();
function h(e) {
	let t = e.closest("[data-layout-open=\"false\"]");
	return t !== null && t.dataset.runtimeGroupAnimating !== "true";
}
function g(e, t) {
	if (h(e)) return null;
	let n = e.closest("[data-layout-collection]");
	if (!n) return null;
	let r = t?.rect(e) ?? e.getBoundingClientRect(), i = t?.rect(n) ?? n.getBoundingClientRect();
	return r.width > 0 && r.height > 0 && i.width > 0 && r.width <= i.width * 1.25 && r.left >= i.left - 1 && r.right <= i.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function _(e, t) {
	return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
}
function v(e, t, n) {
	if (!n || n.length === 0) return Array.from(e.querySelectorAll(t));
	let r = [], i = /* @__PURE__ */ new Set();
	for (let e of n) e.matches(t) && !i.has(e) && (i.add(e), r.push(e)), e.querySelectorAll(t).forEach((e) => {
		i.has(e) || (i.add(e), r.push(e));
	});
	return r;
}
function y(e, t, n = p, r, i, a) {
	let o = /* @__PURE__ */ new Map();
	return {
		root: e,
		selector: t,
		collectionByKey: o,
		entries: v(e, t, i).map((e) => {
			if (r?.(e) || !_(e, i)) return null;
			let t = g(e, a);
			if (!t) return null;
			let s = n(e);
			if (!s) return null;
			let c = a?.rect(e) ?? e.getBoundingClientRect();
			return o.set(s, t.collectionId), {
				key: s,
				rect: {
					left: c.left,
					top: c.top,
					width: c.width,
					height: c.height
				},
				element: e
			};
		}).filter((e) => e !== null),
		ignore: r,
		scopeSurfaces: i
	};
}
function b(e, t = {}, n) {
	let r = t.duration ?? 250, i = t.easing ?? "cubic-bezier(.22,1,.36,1)", a = t.key ?? p, o = /* @__PURE__ */ new Map();
	v(e.root, e.selector, e.scopeSurfaces).filter((t) => {
		if (e.ignore?.(t) || !_(t, e.scopeSurfaces)) return !1;
		let r = g(t, n);
		if (!r) return !1;
		let i = a(t);
		return i ? (o.set(i, r.collectionId), !0) : !1;
	}).filter((t) => {
		let n = a(t);
		if (!n) return !1;
		let r = e.collectionByKey.get(n);
		return r === void 0 || r !== o.get(n);
	}).forEach((e) => {
		m.get(e)?.cancel();
		let t = e.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: r,
			easing: i,
			fill: "both"
		});
		m.set(e, t), t.finished.then(() => {
			m.get(e) === t && m.delete(e);
		}).catch(() => void 0);
	}), e.entries.forEach((e) => {
		if (o.has(e.key)) return;
		let t = document.createElement("template");
		t.innerHTML = e.element.outerHTML;
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
function x() {
	let e = /* @__PURE__ */ new WeakMap();
	return { rect(t) {
		let n = e.get(t);
		if (n) return n;
		let r = t.getBoundingClientRect();
		return e.set(t, r), r;
	} };
}
//#endregion
//#region src/dom/GroupLayout.ts
var S = null, C = !1, w = /* @__PURE__ */ new WeakMap();
function T(e) {
	S = e;
}
function E(e) {
	C = e;
}
function D() {
	let t = S;
	return {
		flip: t?.flip ?? e.flip,
		resize: t?.resize ?? e.resize
	};
}
function O(e, t, n) {
	let r = (e) => !n || n.length === 0 || n.some((t) => t === e || t.contains(e)), i = Array.from(t.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(r), a = [], o = [];
	for (let t of e) r(t) && (t.closest("[data-layout-group]") === null ? o.push(t) : a.push(t));
	return {
		groups: i,
		groupLeaves: a,
		flatCards: o
	};
}
function k(e, t = document, n = !0, r, i = {}) {
	let a = (e) => {
		let t = i.scopeSurfaces;
		return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
	}, o = i.scopeSurfaces && i.scopeSurfaces.length > 0 ? i.scopeSurfaces : null, s = o ? Array.from(new Set(o.flatMap((e) => [...e.matches("[data-layout-surface]") ? [e] : [], ...Array.from(e.querySelectorAll("[data-layout-surface]"))]))).filter(a) : [...t instanceof HTMLElement && t.matches("[data-layout-surface]") ? [t] : [], ...Array.from(t.querySelectorAll("[data-layout-surface]"))].filter(a), c = x(), { groups: l, groupLeaves: d, flatCards: f } = O(e, t, i.scopeSurfaces), p = oe(s, c, i.surfaceMeasures), m = (i.scopeSurfaces ?? [t]).some((e) => e instanceof HTMLElement ? e.matches("[data-layout-collection]") || e.querySelector("[data-layout-collection]") !== null : t.querySelector("[data-layout-collection]") !== null);
	return ne(t, {
		root: t,
		group: l.length > 0 ? { before: H([...l, ...d], c) } : void 0,
		flat: f.length > 0 ? {
			elements: f,
			before: u(f, c)
		} : void 0,
		surfaces: p,
		presence: n && m ? y(t, "[data-layout-role=\"card\"]", void 0, r, i.scopeSurfaces, c) : void 0
	});
}
function A(e) {
	let t = x(), n = D();
	se(e.surfaces, n.resize.duration, n.resize.easing, t);
	let r = e.group ? N(e.group.before) : null;
	e.group && W(e.group.before, n.flip.duration, n.flip.easing, t), e.flat && f(e.flat.elements, e.flat.before, n.flip.duration, n.flip.easing, t), e.presence && b(e.presence, {
		duration: n.flip.duration,
		easing: n.flip.easing
	}, t), r && P(r, n.flip.duration + 50);
}
var j = /* @__PURE__ */ new WeakMap(), M = 0;
function N(e) {
	let t = e.filter((e) => e.rect.height > 0).map((e) => ({
		element: e.element,
		overflow: e.element.style.overflow
	})).filter((e) => e.element.isConnected).filter((e) => e.element.dataset.runtimeGroupAnimating !== "true").filter((e) => getComputedStyle(e.element).overflow !== "visible");
	if (t.length === 0) return null;
	let n = t[0].element.getRootNode();
	j.get(n)?.entries.forEach(({ element: e, overflow: t }) => {
		e.style.overflow = t;
	}), t.forEach(({ element: e }) => {
		e.style.overflow = "visible";
	});
	let r = {
		token: String(++M),
		entries: t
	};
	return j.set(n, r), r;
}
function P(e, t) {
	let n = e.entries[0]?.element.getRootNode();
	n && (e.timeout = window.setTimeout(() => {
		j.get(n)?.token === e.token && (e.entries.forEach(({ element: e, overflow: t }) => {
			e.style.overflow = t;
		}), j.delete(n));
	}, t));
}
function ee(e) {
	L.set(e.root, e), queueMicrotask(() => {
		L.get(e.root) === e && (L.delete(e.root), A(e));
	});
}
function te(e) {
	L.set(e.root, e), requestAnimationFrame(() => {
		L.get(e.root) === e && (L.delete(e.root), A(e));
	});
}
function ne(e, t) {
	let n = L.get(e);
	if (!n) return t;
	let r = I(t.surfaces, n.surfaces), i = re(t.flat, n.flat), a = F(t.group, n.group);
	return {
		...t,
		flat: i,
		group: a,
		surfaces: r
	};
}
function re(e, t) {
	if (!e || !t) return e;
	let n = new Map(e.before);
	for (let r of e.elements) {
		let e = t.before.get(r);
		e && n.set(r, e);
	}
	return {
		...e,
		before: n
	};
}
function F(e, t) {
	if (!e || !t) return e;
	let n = new Map(t.before.map((e) => [e.element, e.rect]));
	return { before: e.before.map((e) => ({
		...e,
		rect: n.get(e.element) ?? e.rect
	})) };
}
function I(e, t) {
	let n = new Map(t.map((e) => [e.element, e]));
	return e.map((e) => {
		let t = n.get(e.element);
		return t ? {
			...e,
			rect: t.rect,
			inlineStyle: t.inlineStyle
		} : e;
	});
}
var L = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap();
function V(e, t) {
	let n = t?.rect(e) ?? e.getBoundingClientRect();
	return {
		top: n.top,
		left: n.left,
		width: n.width,
		height: n.height
	};
}
function H(e, t) {
	let n = e.filter((e) => {
		let n = t?.rect(e) ?? e.getBoundingClientRect();
		return n.width > 0 && n.height > 0;
	}), r = new Set(n);
	return n.map((e) => ({
		element: e,
		parent: U(e, r),
		rect: V(e, t)
	}));
}
function U(e, t) {
	let n = e.parentElement;
	for (; n;) {
		if (t.has(n)) return n;
		n = n.parentElement;
	}
	return null;
}
function W(e, t = c, n = l, r) {
	let i = /* @__PURE__ */ new Map();
	for (let t of e) {
		let e = V(t.element, r);
		i.set(t.element, {
			x: t.rect.left - e.left,
			y: t.rect.top - e.top
		});
	}
	let a = [];
	for (let t of e) {
		let e = i.get(t.element), n = t.parent ? i.get(t.parent) : void 0, r = e.x - (n?.x ?? 0), o = e.y - (n?.y ?? 0);
		if (t.element.dataset.runtimeProxy === "true" || t.element.dataset.runtimePlaceholder === "true" || t.element.dataset.runtimeActive === "true" || Math.abs(r) < .5 && Math.abs(o) < .5) {
			t.element.dataset.runtimeGroupAnimating !== "true" && t.element.dataset.runtimeFlip !== "true" && (t.element.style.transition = "");
			continue;
		}
		let s = B.get(t.element);
		s !== void 0 && (cancelAnimationFrame(s), B.delete(t.element));
		let c = z.get(t.element);
		c !== void 0 && (clearTimeout(c), z.delete(t.element)), t.element.style.transform = `translate(${r}px, ${o}px)`, t.element.style.transition = "none";
		let l = String(Number(t.element.dataset.runtimeFlipToken ?? "0") + 1);
		t.element.dataset.runtimeFlip = "true", t.element.dataset.runtimeFlipToken = l, a.push({
			element: t.element,
			dx: r,
			dy: o,
			token: l
		});
	}
	if (a.length === 0) return;
	let o = requestAnimationFrame(() => {
		for (let { element: e, token: r } of a) e.dataset.runtimeFlipToken === r && (e.style.transition = `transform ${t}ms ${n}`, e.style.transform = "");
	}), s = window.setTimeout(() => {
		for (let { element: e, token: t } of a) e.dataset.runtimeFlipToken === t && (e.style.transition = "", e.style.transform = "", delete e.dataset.runtimeFlip, z.delete(e));
	}, t + 40);
	for (let { element: e } of a) B.set(e, o), z.set(e, s);
}
function G(e, t, n = c, r = l, i, a = !1, o = !1) {
	if (e.dataset.runtimeLayoutTransaction === "true" || e.dataset.runtimeSurfaceResize === "true") return !1;
	K(e);
	let s = i ?? e.getBoundingClientRect().height, u = String(Number(e.dataset.runtimeGroupToken ?? "0") + 1);
	e.dataset.runtimeGroupToken = u;
	let d = Math.abs(Math.max(0, t) - s), f = o ? Math.max(0, n) : Math.min(Math.max(d / 8, 200), 350);
	e.dataset.runtimeGroupAnimating = "true", e.style.overflow = "hidden", e.style.height = `${s}px`, e.style.transition = `height ${f}ms ${r}`, e.offsetHeight;
	let p = {
		frame: null,
		timeout: null
	};
	return R.set(e, p), p.frame = requestAnimationFrame(() => {
		p.frame = null, e.style.height = `${Math.max(0, t)}px`;
	}), p.timeout = window.setTimeout(() => {
		e.dataset.runtimeGroupToken === u && (t <= 0 ? (e.style.height = "0px", e.style.overflow = "hidden") : a ? (e.style.height = `${t}px`, e.style.overflow = "") : (e.style.height = "", e.style.overflow = ""), e.style.transition = "", delete e.dataset.runtimeGroupAnimating, R.delete(e));
	}, f + 40), !0;
}
function K(e) {
	let t = R.get(e);
	t && (t.frame !== null && cancelAnimationFrame(t.frame), t.timeout !== null && window.clearTimeout(t.timeout), R.delete(e));
}
function q(e) {
	L.delete(e);
	let t = typeof Node < "u" && e instanceof Node, n = t ? e.getRootNode() : e, r = j.get(n);
	r && (r.timeout !== void 0 && window.clearTimeout(r.timeout), r.entries.forEach(({ element: n, overflow: r }) => {
		t && !e.contains(n) || (n.style.overflow = r);
	}), j.delete(n));
	let a = [];
	e instanceof HTMLElement && a.push(e), typeof e.querySelectorAll == "function" && a.push(...Array.from(e.querySelectorAll("[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-runtime-layout-transaction], [data-layout-content]")));
	for (let e of a) {
		let t = z.get(e), n = B.get(e), r = t !== void 0 || e.dataset.runtimeFlip === "true" || e.dataset.runtimeGroupAnimating === "true" || e.dataset.runtimeSurfaceResize === "true" || e.dataset.runtimeLayoutTransaction === "true";
		t !== void 0 && (window.clearTimeout(t), z.delete(e)), n !== void 0 && (cancelAnimationFrame(n), B.delete(e)), i(e), o(e), K(e);
		let a = X.get(e);
		a && (Q(e, a.baseStyle), X.delete(e)), e.dataset.runtimeGroupAnimating === "true" && (e.style.height = e.dataset.layoutOpen === "false" ? "0px" : "", e.style.overflow = e.dataset.layoutOpen === "false" ? "hidden" : "", e.style.transition = ""), r && (e.style.transform = ""), e.dataset.runtimeFlip === "true" && delete e.dataset.runtimeFlip, delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction, delete e.dataset.runtimeGroupAnimating;
	}
}
async function J(e) {
	let t = e.root instanceof HTMLElement ? e.root.ownerDocument : e.root, n = e.layoutTransaction?.begin(t, "group-toggle");
	n && e.layoutTransaction?.request(t, {
		type: "group-toggle",
		opening: e.opening
	});
	let r = (w.get(e.content) ?? 0) + 1;
	w.set(e.content, r);
	let i = Array.from(e.root.querySelectorAll("[data-layout-role=\"card\"]")), a = k((i.length > 0 ? i : Array.from(e.root.querySelectorAll(".done-card-item, [data-card]"))).filter((e) => {
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0;
	}), e.root, !1, void 0, { surfaceMeasures: e.surfaceMeasures }), o = e.content.getBoundingClientRect().height, s = C ? ie(e.content, e.opening, e.duration, e.easing) : null;
	if (e.mutate(), await e.waitForLayout(), w.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let c = e.layoutCache?.getGroup(e.content, e.opening), l = c?.height ?? (e.opening ? e.content.scrollHeight : 0);
	if (G(e.content, l, e.duration, e.easing, o), s && ae(s, e.opening), await new Promise((e) => requestAnimationFrame(() => e())), w.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let u = c ? new Map(c.surfaceTargets) : Y(a.surfaces, e.content, l);
	e.layoutCache?.setGroup(e.content, e.opening, l, u);
	let d = u.size > 0 ? {
		...a,
		surfaces: a.surfaces.map((e) => ({
			...e,
			targetMeasure: u.get(e.element)
		}))
	} : a, f = (e) => {
		e && !e.isCurrent() || A(d);
	};
	n && e.layoutTransaction?.defer(t, n.participantId, (e) => f(e), "group-flip") || f(), e.layoutTransaction?.commit(t, n?.participantId);
}
function Y(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = {
		height: t.style.height,
		overflow: t.style.overflow,
		transition: t.style.transition
	};
	t.style.height = `${Math.max(0, n)}px`, t.style.overflow = "hidden", t.style.transition = "none";
	let a = e.map((e) => ({
		item: e,
		height: e.element.style.height,
		overflow: e.element.style.overflow,
		transition: e.element.style.transition
	}));
	return a.forEach(({ item: e }) => {
		e.measure && (e.element.style.height = "auto", e.element.style.overflow = "visible", e.element.style.transition = "none");
	}), t.offsetHeight, a.forEach(({ item: e }) => {
		e.measure && r.set(e.element, e.measure());
	}), a.forEach(({ item: e, height: t, overflow: n, transition: r }) => {
		e.element.style.height = t, e.element.style.overflow = n, e.element.style.transition = r;
	}), t.style.height = i.height, t.style.overflow = i.overflow, t.style.transition = i.transition, r;
}
function ie(e, t, n = c, r = l) {
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
function ae(e, t) {
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
function oe(e, t, n) {
	return e.map((e) => {
		e.dataset.runtimeLayoutTransaction = "true";
		let r = V(e, t), i = n?.get(e), a = le(e);
		return i && !X.has(e) && (e.style.height = `${$(e, r.height)}px`, e.style.overflow = "hidden"), {
			element: e,
			rect: r,
			measure: i,
			inlineStyle: a
		};
	});
}
function se(e, t = c, n = l, r) {
	ce(e);
	let i = e.filter((e) => e.element.isConnected).map((e) => {
		let t = V(e.element, r), n = e.targetMeasure === void 0 ? e.measure?.() : e.targetMeasure, i = n ? {
			...t,
			...n.width === void 0 ? {} : { width: n.width },
			height: n.height
		} : t;
		return {
			item: e,
			next: i,
			profile: D().resize,
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
	for (let { item: e, fromHeight: t, toHeight: n } of i) {
		let n = e.element.style, r = {
			baseStyle: X.get(e.element)?.baseStyle ?? e.inlineStyle,
			token: String(++Z)
		};
		X.set(e.element, r), o.set(e.element, r.token), n.overflow = "hidden", n.transition = "none", n.height = `${t}px`, e.element.dataset.runtimeSurfaceResize = "true", e.element.dataset.runtimeSurfaceResizeToken = r.token;
	}
	requestAnimationFrame(() => {
		for (let { item: e, fromHeight: t, toHeight: n, profile: r } of i) {
			let i = e.element.style, a = X.get(e.element), c = o.get(e.element);
			if (!a || !c || a.token !== c || e.element.dataset.runtimeSurfaceResizeToken !== c) continue;
			let l = a.token;
			i.transition = "none", s(e.element, t, n, r.duration, r.easing), window.setTimeout(() => {
				if (e.element.dataset.runtimeSurfaceResizeToken !== l) return;
				let t = X.get(e.element);
				!t || t.token !== l || (Q(e.element, t.baseStyle), e.measure && (i.height = `${n}px`), X.delete(e.element), delete e.element.dataset.runtimeSurfaceResize, delete e.element.dataset.runtimeLayoutTransaction);
			}, r.duration + 40);
		}
	});
}
function ce(e) {
	let t = e.filter((e) => e.element.dataset.runtimeSurfaceResize === "true");
	if (t.length !== 0) for (let { element: e } of t) {
		if (!X.get(e)) continue;
		let t = V(e).height;
		o(e), e.style.height = `${$(e, t)}px`, e.style.overflow = "hidden", e.style.transition = "none", X.delete(e), delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction;
	}
}
var X = /* @__PURE__ */ new WeakMap(), Z = 0;
function le(e) {
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
//#endregion
export { ee as a, T as c, b as d, e as f, J as i, G as l, k as n, te as o, A as r, E as s, q as t, y as u };
