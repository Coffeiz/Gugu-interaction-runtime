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
				element: e,
				rect: {
					left: c.left,
					top: c.top,
					width: c.width,
					height: c.height
				},
				contentHTML: e.outerHTML
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
	}, o = [...t instanceof HTMLElement && t.matches("[data-layout-surface]") ? [t] : [], ...Array.from(t.querySelectorAll("[data-layout-surface]"))].filter(a), s = x(), { groups: c, groupLeaves: l, flatCards: d } = O(e, t, i.scopeSurfaces), f = oe(o, s, i.surfaceMeasures), p = (i.scopeSurfaces ?? [t]).some((e) => e instanceof HTMLElement ? e.matches("[data-layout-collection]") || e.querySelector("[data-layout-collection]") !== null : t.querySelector("[data-layout-collection]") !== null);
	return te(t, {
		root: t,
		group: c.length > 0 ? { before: U([...c, ...l], s) } : void 0,
		flat: d.length > 0 ? {
			elements: d,
			before: u(d, s)
		} : void 0,
		surfaces: f,
		presence: n && p ? y(t, "[data-layout-role=\"card\"]", void 0, r, i.scopeSurfaces, s) : void 0
	});
}
function A(e) {
	let t = x(), n = D();
	se(e.surfaces, n.resize.duration, n.resize.easing, t);
	let r = e.group ? N(e.group.before) : null;
	e.group && G(e.group.before, n.flip.duration, n.flip.easing, t), e.flat && f(e.flat.elements, e.flat.before, n.flip.duration, n.flip.easing, t), e.presence && b(e.presence, {
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
function F(e) {
	R.set(e.root, e), queueMicrotask(() => {
		R.get(e.root) === e && (R.delete(e.root), A(e));
	});
}
function ee(e) {
	R.set(e.root, e), requestAnimationFrame(() => {
		R.get(e.root) === e && (R.delete(e.root), A(e));
	});
}
function te(e, t) {
	let n = R.get(e);
	if (!n) return t;
	let r = L(t.surfaces, n.surfaces), i = ne(t.flat, n.flat), a = I(t.group, n.group);
	return {
		...t,
		flat: i,
		group: a,
		surfaces: r
	};
}
function ne(e, t) {
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
function I(e, t) {
	if (!e || !t) return e;
	let n = new Map(t.before.map((e) => [e.element, e.rect]));
	return { before: e.before.map((e) => ({
		...e,
		rect: n.get(e.element) ?? e.rect
	})) };
}
function L(e, t) {
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
var R = /* @__PURE__ */ new WeakMap(), z = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap();
function H(e, t) {
	let n = t?.rect(e) ?? e.getBoundingClientRect();
	return {
		top: n.top,
		left: n.left,
		width: n.width,
		height: n.height
	};
}
function U(e, t) {
	let n = e.filter((e) => {
		let n = t?.rect(e) ?? e.getBoundingClientRect();
		return n.width > 0 && n.height > 0;
	}), r = new Set(n);
	return n.map((e) => ({
		element: e,
		parent: W(e, r),
		rect: H(e, t)
	}));
}
function W(e, t) {
	let n = e.parentElement;
	for (; n;) {
		if (t.has(n)) return n;
		n = n.parentElement;
	}
	return null;
}
function G(e, t = c, n = l, r) {
	let i = /* @__PURE__ */ new Map();
	for (let t of e) {
		let e = H(t.element, r);
		i.set(t.element, {
			x: t.rect.left - e.left,
			y: t.rect.top - e.top
		});
	}
	for (let r of e) {
		let e = i.get(r.element), a = r.parent ? i.get(r.parent) : void 0, o = e.x - (a?.x ?? 0), s = e.y - (a?.y ?? 0);
		if (r.element.dataset.runtimeProxy === "true" || r.element.dataset.runtimePlaceholder === "true" || r.element.dataset.runtimeActive === "true" || Math.abs(o) < .5 && Math.abs(s) < .5) {
			r.element.dataset.runtimeGroupAnimating !== "true" && r.element.dataset.runtimeFlip !== "true" && (r.element.style.transition = "");
			continue;
		}
		r.element.style.transform = `translate(${o}px, ${s}px)`, r.element.style.transition = "none";
		let c = String(Number(r.element.dataset.runtimeFlipToken ?? "0") + 1);
		r.element.dataset.runtimeFlip = "true", r.element.dataset.runtimeFlipToken = c;
		let l = V.get(r.element);
		l !== void 0 && (cancelAnimationFrame(l), V.delete(r.element));
		let u = requestAnimationFrame(() => {
			V.delete(r.element), r.element.dataset.runtimeFlipToken === c && (r.element.style.transition = `transform ${t}ms ${n}`, r.element.style.transform = "");
		});
		V.set(r.element, u);
		let d = window.setTimeout(() => {
			r.element.dataset.runtimeFlipToken === c && (r.element.style.transition = "", r.element.style.transform = "", delete r.element.dataset.runtimeFlip, B.delete(r.element));
		}, t + 40);
		B.set(r.element, d);
	}
}
function K(e, t, n = c, r = l, i, a = !1, o = !1) {
	if (e.dataset.runtimeLayoutTransaction === "true" || e.dataset.runtimeSurfaceResize === "true") return !1;
	q(e);
	let s = i ?? e.getBoundingClientRect().height, u = String(Number(e.dataset.runtimeGroupToken ?? "0") + 1);
	e.dataset.runtimeGroupToken = u;
	let d = Math.abs(Math.max(0, t) - s), f = o ? Math.max(0, n) : Math.min(Math.max(d / 8, 200), 350);
	e.dataset.runtimeGroupAnimating = "true", e.style.overflow = "hidden", e.style.height = `${s}px`, e.style.transition = `height ${f}ms ${r}`, e.offsetHeight;
	let p = {
		frame: null,
		timeout: null
	};
	return z.set(e, p), p.frame = requestAnimationFrame(() => {
		p.frame = null, e.style.height = `${Math.max(0, t)}px`;
	}), p.timeout = window.setTimeout(() => {
		e.dataset.runtimeGroupToken === u && (t <= 0 ? (e.style.height = "0px", e.style.overflow = "hidden") : a ? (e.style.height = `${t}px`, e.style.overflow = "") : (e.style.height = "", e.style.overflow = ""), e.style.transition = "", delete e.dataset.runtimeGroupAnimating, z.delete(e));
	}, f + 40), !0;
}
function q(e) {
	let t = z.get(e);
	t && (t.frame !== null && cancelAnimationFrame(t.frame), t.timeout !== null && window.clearTimeout(t.timeout), z.delete(e));
}
function J(e) {
	R.delete(e);
	let t = typeof Node < "u" && e instanceof Node, n = t ? e.getRootNode() : e, r = j.get(n);
	r && (r.timeout !== void 0 && window.clearTimeout(r.timeout), r.entries.forEach(({ element: n, overflow: r }) => {
		t && !e.contains(n) || (n.style.overflow = r);
	}), j.delete(n));
	let a = [];
	e instanceof HTMLElement && a.push(e), typeof e.querySelectorAll == "function" && a.push(...Array.from(e.querySelectorAll("[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-runtime-layout-transaction], [data-layout-content]")));
	for (let e of a) {
		let t = B.get(e), n = V.get(e), r = t !== void 0 || e.dataset.runtimeFlip === "true" || e.dataset.runtimeGroupAnimating === "true" || e.dataset.runtimeSurfaceResize === "true" || e.dataset.runtimeLayoutTransaction === "true";
		t !== void 0 && (window.clearTimeout(t), B.delete(e)), n !== void 0 && (cancelAnimationFrame(n), V.delete(e)), i(e), o(e), q(e);
		let a = Z.get(e);
		a && (Q(e, a.baseStyle), Z.delete(e)), e.dataset.runtimeGroupAnimating === "true" && (e.style.height = e.dataset.layoutOpen === "false" ? "0px" : "", e.style.overflow = e.dataset.layoutOpen === "false" ? "hidden" : "", e.style.transition = ""), r && (e.style.transform = ""), e.dataset.runtimeFlip === "true" && delete e.dataset.runtimeFlip, delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction, delete e.dataset.runtimeGroupAnimating;
	}
}
async function Y(e) {
	let t = e.root instanceof HTMLElement ? e.root.ownerDocument : e.root, n = e.layoutTransaction?.begin(t, "group-toggle");
	n && e.layoutTransaction?.request(t, {
		type: "group-toggle",
		opening: e.opening
	});
	let r = (w.get(e.content) ?? 0) + 1;
	w.set(e.content, r);
	let i = Array.from(e.root.querySelectorAll("[data-layout-role=\"card\"]")), a = (i.length > 0 ? i : Array.from(e.root.querySelectorAll(".done-card-item, [data-card]"))).filter((e) => {
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0;
	}), o = e.content.getBoundingClientRect().height, s = k(a, e.root, !1, void 0, { surfaceMeasures: e.surfaceMeasures });
	!e.opening && o > 0 && (q(e.content), e.content.dataset.runtimeGroupAnimating = "true", e.content.style.height = `${o}px`, e.content.style.overflow = "hidden", e.content.style.transition = "");
	let c = C ? ie(e.content, e.opening, e.duration, e.easing) : null;
	if (e.mutate(), await e.waitForLayout(), w.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let l = e.layoutCache?.getGroup(e.content, e.opening), u = e.content.scrollHeight, d = e.opening ? u : 0, f = e.opening && l && l.height === d ? l : void 0;
	if (K(e.content, d, e.duration, e.easing, o), c && ae(c, e.opening), await new Promise((e) => requestAnimationFrame(() => e())), w.get(e.content) !== r) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	if (e.isCurrent && !e.isCurrent()) {
		e.layoutTransaction?.cancel(t, n?.participantId);
		return;
	}
	let p = f ? new Map(f.surfaceTargets) : X(s.surfaces, e.content, d);
	e.layoutCache?.setGroup(e.content, e.opening, d, p);
	let m = p.size > 0 ? {
		...s,
		surfaces: s.surfaces.map((e) => ({
			...e,
			targetMeasure: p.get(e.element)
		}))
	} : s, h = (e) => {
		e && !e.isCurrent() || A(m);
	};
	n && e.layoutTransaction?.defer(t, n.participantId, (e) => h(e), "group-flip") || h(), e.layoutTransaction?.commit(t, n?.participantId);
}
function X(e, t, n) {
	let r = /* @__PURE__ */ new Map();
	if (e.length === 0) return r;
	let i = re(t), a = i ? de(i) : null, o = {
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
	}), t.style.height = o.height, t.style.overflow = o.overflow, t.style.transition = o.transition, a && i && fe(i, a), r;
}
function re(e) {
	let t = e.parentElement;
	for (; t;) {
		let e = getComputedStyle(t);
		if (/(auto|scroll|overlay)/.test(`${e.overflowY} ${e.overflow}`)) return t;
		t = t.parentElement;
	}
	return null;
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
		let r = H(e, t), i = n?.get(e), a = ue(e);
		return i && !Z.has(e) && (e.style.height = `${$(e, r.height)}px`, e.style.overflow = "hidden"), {
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
		let t = H(e.element, r), n = e.targetMeasure === void 0 ? e.measure?.() : e.targetMeasure, i = n ? {
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
			baseStyle: Z.get(e.element)?.baseStyle ?? e.inlineStyle,
			token: String(++le)
		};
		Z.set(e.element, r), o.set(e.element, r.token), n.overflow = "hidden", n.transition = "none", n.height = `${t}px`, e.element.dataset.runtimeSurfaceResize = "true", e.element.dataset.runtimeSurfaceResizeToken = r.token;
	}
	requestAnimationFrame(() => {
		for (let { item: e, fromHeight: t, toHeight: n, profile: r } of i) {
			let i = e.element.style, a = Z.get(e.element), c = o.get(e.element);
			if (!a || !c || a.token !== c || e.element.dataset.runtimeSurfaceResizeToken !== c) continue;
			let l = a.token;
			i.transition = "none", s(e.element, t, n, r.duration, r.easing), window.setTimeout(() => {
				if (e.element.dataset.runtimeSurfaceResizeToken !== l) return;
				let t = Z.get(e.element);
				!t || t.token !== l || (Q(e.element, t.baseStyle), e.measure && (i.height = `${n}px`), Z.delete(e.element), delete e.element.dataset.runtimeSurfaceResize, delete e.element.dataset.runtimeLayoutTransaction);
			}, r.duration + 40);
		}
	});
}
function ce(e) {
	let t = e.filter((e) => e.element.dataset.runtimeSurfaceResize === "true");
	if (t.length !== 0) for (let { element: e } of t) {
		if (!Z.get(e)) continue;
		let t = H(e).height;
		o(e), e.style.height = `${$(e, t)}px`, e.style.overflow = "hidden", e.style.transition = "none", Z.delete(e), delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction;
	}
}
var Z = /* @__PURE__ */ new WeakMap(), le = 0;
function ue(e) {
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
function de(e) {
	let t = Math.max(0, e.scrollHeight - e.clientHeight), n = e.scrollTop <= 1 ? "top" : t - e.scrollTop <= 1 ? "bottom" : "middle";
	return {
		top: e.scrollTop,
		height: e.scrollHeight,
		clientHeight: e.clientHeight,
		anchor: n
	};
}
function fe(e, t) {
	let n = Math.max(0, e.scrollHeight - e.clientHeight);
	e.scrollTop = t.anchor === "top" ? 0 : t.anchor === "bottom" ? n : Math.min(t.top, n);
}
//#endregion
export { F as a, T as c, b as d, e as f, Y as i, K as l, k as n, ee as o, A as r, E as s, J as t, y as u };
