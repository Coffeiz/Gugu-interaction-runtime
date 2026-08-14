import { l as e } from "./GroupLayout-Dl0w6ktt.js";
import { inject as t, nextTick as n, onUnmounted as r, provide as i, ref as a, toValue as o, watch as s } from "vue";
//#region src/vue/context.ts
var c = Symbol("gugu-interaction-runtime");
function l(e) {
	i(c, e);
}
function u() {
	let e = t(c);
	if (!e) throw Error("Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component");
	return e;
}
//#endregion
//#region src/vue/useObject.ts
function d(e) {
	return {
		type: o(e.type),
		surfaceId: o(e.surface),
		abilities: [...o(e.abilities)],
		selected: e.selected !== void 0 && o(e.selected),
		visual: e.visual === void 0 ? void 0 : o(e.visual),
		visualMode: e.visualMode === void 0 ? void 0 : o(e.visualMode),
		target: e.target === void 0 ? void 0 : o(e.target),
		node: e.node === void 0 ? void 0 : o(e.node)
	};
}
function f(e) {
	let t = u(), n = a(null), i = d(e), o = t.objects.register({
		id: e.id,
		...i,
		element: null
	});
	return s(() => d(e), (n) => t.objects.update(e.id, n), { deep: !0 }), s(n, (n, r) => {
		let i = t.objects.get(e.id);
		i?.generation === o && (n === null && i.element && i.element !== r || t.objects.setElement(e.id, n));
	}), r(() => {
		t.unregisterObjectWhenIdle(e.id, o);
	}), {
		elementRef: n,
		generation: o
	};
}
//#endregion
//#region src/vue/floatingSurface.ts
function p(e, t) {
	let n = e?.matches("[data-layout-role=\"viewport\"]") ? e : e?.querySelector("[data-layout-role=\"viewport\"]") ?? null, r = (typeof t.scrollKey == "function" ? t.scrollKey() : t.scrollKey)?.replace(/"/g, "\\\"");
	return {
		layoutElement: n,
		viewport: e ? (r ? e.querySelector(`[data-drawer-scroll="${r}"]`) : null) ?? e.querySelector("[data-drawer-scroll], [data-scroll-viewport]") ?? null : null
	};
}
function m(e) {
	let t = e.maxHeight;
	return typeof t == "function" ? t() : t ?? null;
}
function h(e, t) {
	return !Number.isFinite(e) || e <= 0 ? 0 : t === null ? e : Math.min(e, Math.max(0, t));
}
function g(e) {
	let t = Array.from(e.querySelectorAll("[data-runtime-scroll-compensation=\"true\"]")).reduce((e, t) => e + t.getBoundingClientRect().height, 0);
	return Math.max(0, e.scrollHeight - t);
}
function _(e, t, n) {
	let r = t?.style, i = r ? {
		height: r.height,
		overflow: r.overflow,
		transition: r.transition
	} : null, a = [];
	if (t && n && t.contains(n)) {
		let e = n;
		for (; e && (a.push({
			element: e,
			height: e.style.height,
			maxHeight: e.style.maxHeight,
			minHeight: e.style.minHeight,
			overflow: e.style.overflow,
			flex: e.style.flex
		}), e !== t);) e = e.parentElement;
		a.forEach(({ element: e }) => {
			e.style.height = "auto", e.style.maxHeight = "none", e.style.minHeight = "0", e.style.overflow = "visible", e.style.flex = "0 0 auto";
		});
	}
	r && (r.height = "auto", r.overflow = "visible", r.transition = "none", t?.offsetHeight);
	let o = Array.from(e.querySelectorAll("[data-layout-collection], [data-layout-content]")).map((e) => {
		let t = e.getBoundingClientRect(), n = getComputedStyle(e);
		return {
			element: e,
			scrollHeight: g(e),
			rectHeight: t.height,
			display: n.display,
			visibility: n.visibility,
			opacity: n.opacity,
			layoutOpen: e.dataset.layoutOpen ?? null,
			role: e.dataset.layoutRole ?? null,
			collection: e.dataset.layoutCollection ?? null
		};
	}).filter((e) => e.display === "none" || e.visibility === "hidden" || e.layoutOpen === "false" ? !1 : e.rectHeight > 0 || e.collection !== null), s = n ? g(n) : 0, c = t ? [g(t), ...o.filter((e) => e.collection === null || e.scrollHeight !== s).map((e) => e.scrollHeight)] : [s, ...o.map((e) => e.scrollHeight)], l = Math.max(...c, 0);
	return a.forEach(({ element: e, height: t, maxHeight: n, minHeight: r, overflow: i, flex: a }) => {
		e.style.height = t, e.style.maxHeight = n, e.style.minHeight = r, e.style.overflow = i, e.style.flex = a;
	}), r && i && (r.height = i.height, r.overflow = i.overflow, r.transition = i.transition), l;
}
function v(e, t = {}) {
	let { layoutElement: n, viewport: r } = p(e, t);
	return {
		layoutElement: n,
		viewport: r,
		measureLayout: () => {
			let n = e?.isConnected ? e : null;
			if (!n) return null;
			let r = p(n, t);
			return { height: h(_(n, r.layoutElement, r.viewport) || g(n), m(t)) };
		}
	};
}
//#endregion
//#region src/vue/useSurface.ts
function y(e, t, n) {
	let r = e.floating !== void 0 && o(e.floating), i = e.layoutElement ?? n?.layoutElement, a = e.viewport ?? n?.viewport, s = e.measureLayout ?? n?.measureLayout;
	return {
		type: o(e.type),
		accepts: [...o(e.accepts)],
		layout: o(e.layout),
		camera: e.camera === void 0 ? void 0 : o(e.camera),
		viewport: r ? a : e.viewport,
		layoutElement: r ? i : e.layoutElement,
		measureLayout: r ? s : e.measureLayout,
		motion: e.motion === void 0 ? void 0 : o(e.motion)
	};
}
function b(t) {
	let i = u(), c = a(null), l = () => c.value, d = () => {
		let e = t.floating !== void 0 && o(t.floating);
		return e === !0 ? {} : e || {};
	}, f = () => v(l(), d()), p = {
		viewport: () => f().viewport,
		layoutElement: () => f().layoutElement,
		measureLayout: () => f().measureLayout()
	}, m = y(t, l, p), h = i.surfaces.register({
		id: t.id,
		...m,
		element: null
	}), g = a(!1), _ = null, b = null, x = null, S = null, C = () => d(), w = () => !!(t.floating !== void 0 && o(t.floating)), T = () => {
		let e = C().open;
		return typeof e == "function" ? e() : e !== !1;
	}, E = () => {
		let e = C().scrollKey;
		return typeof e == "function" ? e() : e ?? null;
	}, D = () => (t.motion === void 0 ? void 0 : o(t.motion))?.resize, O = () => {
		if (x) {
			for (let { element: e, values: t } of x) for (let [n, r] of Object.entries(t)) e.style.setProperty(n, r);
			x = null;
		}
	}, k = (e, t) => {
		if (!t || !e.contains(t)) return;
		let n = [], r = t;
		for (; r && (n.push(r), r !== e);) r = r.parentElement;
		if (n[n.length - 1] === e) {
			x ||= n.map((e) => ({
				element: e,
				values: {
					display: e.style.display,
					flexDirection: e.style.flexDirection,
					flex: e.style.flex,
					minHeight: e.style.minHeight,
					overflow: e.style.overflow,
					overflowX: e.style.overflowX,
					overflowY: e.style.overflowY
				}
			})), e.style.display = "flex", e.style.flexDirection = "column", e.style.minHeight = "0";
			for (let t of n) t.style.minHeight = "0", t !== e && (t.style.flex = "1 1 auto");
			t.style.overflowX = "hidden", t.style.overflowY = "auto", t.style.minHeight = "0", t.style.flex = "1 1 auto";
		}
	}, A = () => {
		_ !== null && window.clearTimeout(_), _ = null, g.value = !1, S = null;
	}, j = () => {
		let t = c.value;
		if (!w() || !t?.isConnected) return;
		let n = v(t, C()), r = n.layoutElement;
		if (!r) return;
		T() && k(r, n.viewport);
		let i = r.getBoundingClientRect().height, a = g.value && S !== null ? S : null, o = a === null && T() ? n.measureLayout() : null, s = a ?? o?.height ?? 0;
		if (g.value && S !== null && Math.abs(S - s) < .5) return;
		if (Math.abs(i - s) < .5) {
			A(), s === 0 && (r.style.height = "0px");
			return;
		}
		let l = E(), u = l ? t.querySelector(`[data-drawer-scroll="${l.replace(/"/g, "\\\"")}"]`) : n.viewport, d = u?.scrollTop ?? 0;
		A(), g.value = !0, S = s;
		let f = D();
		if (!e(r, s, f?.duration, f?.easing, void 0, !0, !0)) {
			A();
			return;
		}
		let p = f?.duration ?? 250;
		_ = window.setTimeout(() => {
			_ = null, g.value = !1, u && (u.scrollTop = d), T() || O();
		}, p + 80);
	}, M = () => {
		if (!w()) return;
		let e = c.value?.ownerDocument ?? document, n = i.layout.begin(e, "surface-observer", "observer");
		if (i.layout.request(e, {
			type: "surface-natural-size",
			surfaceId: t.id
		}), n.reasons.some((e) => e === "move" || e === "group-toggle")) {
			i.layout.commit(e, n.participantId);
			return;
		}
		let r = (e) => {
			e && !e.isCurrent() || j();
		};
		i.layout.defer(e, n.participantId, (e) => r(e), "surface-resize") || r(), i.layout.commit(e, n.participantId);
	}, N = () => {
		b !== null && cancelAnimationFrame(b), b = requestAnimationFrame(() => {
			b = null, M();
		});
	}, P = null, F = null, I = () => {
		P?.disconnect(), F?.disconnect(), P = null, F = null;
	}, L = (e) => {
		I();
		let n = t.floating !== void 0 && o(t.floating);
		if (!n || !e || typeof ResizeObserver > "u") return;
		let r = () => {
			i.surfaces.get(t.id)?.generation === h && (i.surfaces.update(t.id, y(t, l, p)), N());
		};
		P = new ResizeObserver(r), P.observe(e);
		let a = v(e, n === !0 ? {} : n).layoutElement, s = v(e, n === !0 ? {} : n).viewport;
		a && a !== e && P.observe(a), s && s !== e && s !== a && P.observe(s), typeof MutationObserver < "u" && (F = new MutationObserver(r), F.observe(e, {
			childList: !0,
			subtree: !0,
			attributes: !0,
			attributeFilter: [
				"data-layout-role",
				"data-drawer-scroll",
				"data-scroll-viewport"
			]
		})), r(), N();
	};
	return s(() => y(t, l, p), (e) => i.surfaces.update(t.id, e), { deep: !0 }), s(c, (e, n) => {
		let r = i.surfaces.get(t.id);
		r?.generation === h && (e === null && r.element && r.element !== n || (i.surfaces.setElement(t.id, e), L(e)));
	}), s(() => t.floating !== void 0 && o(t.floating), () => {
		L(c.value);
	}, { deep: !0 }), s(() => {
		let e = C();
		return [T(), typeof e.scrollKey == "function" ? e.scrollKey() : e.scrollKey ?? null];
	}, () => {
		n(() => j());
	}, {
		flush: "post",
		immediate: !0
	}), r(() => {
		A(), O(), b !== null && cancelAnimationFrame(b), I(), i.surfaces.unregister(t.id, h);
	}), {
		elementRef: c,
		generation: h,
		isAnimating: g
	};
}
//#endregion
//#region src/vue/useTarget.ts
function x(e) {
	return {
		surfaceId: o(e.surfaceId),
		accepts: [...o(e.accepts)],
		priority: e.priority === void 0 ? void 0 : o(e.priority),
		resolve: e.resolve === void 0 ? void 0 : o(e.resolve)
	};
}
function S(e) {
	let t = u(), n = a(null), i = x(e), o = t.targets.register({
		id: e.id,
		...i,
		element: null
	});
	return s(() => x(e), (n) => t.targets.update(e.id, n), { deep: !0 }), s(n, (n, r) => {
		let i = t.targets.get(e.id);
		i?.generation === o && (n === null && i.element && i.element !== r || t.targets.setElement(e.id, n));
	}), r(() => {
		t.targets.unregister(e.id, o);
	}), {
		elementRef: n,
		generation: o
	};
}
//#endregion
//#region src/vue/useRuntimeAction.ts
function C(e) {
	let t = u().onAction(e);
	r(t);
}
//#endregion
//#region src/vue/useRuntimeTransition.ts
function w(e) {
	let t = u(), n = a(t.isControlled(e)), i = t.onOwnershipChange((r) => {
		r === e && (n.value = t.isControlled(e));
	});
	return r(i), { controlled: n };
}
//#endregion
export { l as provideRuntime, v as resolveFloatingSurfaceDom, c as runtimeInjectionKey, f as useObject, u as useRuntime, C as useRuntimeAction, w as useRuntimeTransition, b as useSurface, S as useTarget };
