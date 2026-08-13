import { inject as e, onUnmounted as t, provide as n, ref as r, toValue as i, watch as a } from "vue";
//#region src/vue/context.ts
var o = Symbol("gugu-interaction-runtime");
function s(e) {
	n(o, e);
}
function c() {
	let t = e(o);
	if (!t) throw Error("Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component");
	return t;
}
//#endregion
//#region src/vue/useObject.ts
function l(e) {
	return {
		type: i(e.type),
		surfaceId: i(e.surface),
		abilities: [...i(e.abilities)],
		selected: e.selected !== void 0 && i(e.selected),
		visual: e.visual === void 0 ? void 0 : i(e.visual),
		visualMode: e.visualMode === void 0 ? void 0 : i(e.visualMode),
		target: e.target === void 0 ? void 0 : i(e.target),
		node: e.node === void 0 ? void 0 : i(e.node)
	};
}
function u(e) {
	let n = c(), i = r(null), o = l(e), s = n.objects.register({
		id: e.id,
		...o,
		element: null
	});
	return a(() => l(e), (t) => n.objects.update(e.id, t), { deep: !0 }), a(i, (t, r) => {
		let i = n.objects.get(e.id);
		i?.generation === s && (t === null && i.element && i.element !== r || n.objects.setElement(e.id, t));
	}), t(() => {
		n.unregisterObjectWhenIdle(e.id, s);
	}), {
		elementRef: i,
		generation: s
	};
}
//#endregion
//#region src/vue/useSurface.ts
function d(e) {
	return {
		type: i(e.type),
		accepts: [...i(e.accepts)],
		layout: i(e.layout),
		camera: e.camera === void 0 ? void 0 : i(e.camera),
		viewport: e.viewport,
		layoutElement: e.layoutElement,
		measureLayout: e.measureLayout,
		motion: e.motion === void 0 ? void 0 : i(e.motion)
	};
}
function f(e) {
	let n = c(), i = r(null), o = d(e), s = n.surfaces.register({
		id: e.id,
		...o,
		element: null
	});
	return a(() => d(e), (t) => n.surfaces.update(e.id, t), { deep: !0 }), a(i, (t, r) => {
		let i = n.surfaces.get(e.id);
		i?.generation === s && (t === null && i.element && i.element !== r || n.surfaces.setElement(e.id, t));
	}), t(() => {
		n.surfaces.unregister(e.id, s);
	}), {
		elementRef: i,
		generation: s
	};
}
//#endregion
//#region src/vue/useTarget.ts
function p(e) {
	return {
		surfaceId: i(e.surfaceId),
		accepts: [...i(e.accepts)],
		priority: e.priority === void 0 ? void 0 : i(e.priority),
		resolve: e.resolve === void 0 ? void 0 : i(e.resolve)
	};
}
function m(e) {
	let n = c(), i = r(null), o = p(e), s = n.targets.register({
		id: e.id,
		...o,
		element: null
	});
	return a(() => p(e), (t) => n.targets.update(e.id, t), { deep: !0 }), a(i, (t, r) => {
		let i = n.targets.get(e.id);
		i?.generation === s && (t === null && i.element && i.element !== r || n.targets.setElement(e.id, t));
	}), t(() => {
		n.targets.unregister(e.id, s);
	}), {
		elementRef: i,
		generation: s
	};
}
//#endregion
//#region src/vue/useRuntimeAction.ts
function h(e) {
	let n = c().onAction(e);
	t(n);
}
//#endregion
//#region src/vue/useRuntimeTransition.ts
function g(e) {
	let n = c(), i = r(n.isControlled(e)), a = n.onOwnershipChange((t) => {
		t === e && (i.value = n.isControlled(e));
	});
	return t(a), { controlled: i };
}
//#endregion
export { s as provideRuntime, o as runtimeInjectionKey, u as useObject, c as useRuntime, h as useRuntimeAction, g as useRuntimeTransition, f as useSurface, m as useTarget };
