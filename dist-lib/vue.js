import { provide as b, inject as j, ref as f, watch as d, onUnmounted as s, toValue as n } from "vue";
const y = Symbol("gugu-interaction-runtime");
function w(e) {
  b(y, e);
}
function m() {
  const e = j(y);
  if (!e)
    throw new Error("Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component");
  return e;
}
function v(e) {
  return {
    type: n(e.type),
    surfaceId: n(e.surface),
    abilities: [...n(e.abilities)],
    selected: e.selected === void 0 ? !1 : n(e.selected),
    visual: e.visual === void 0 ? void 0 : n(e.visual),
    visualMode: e.visualMode === void 0 ? void 0 : n(e.visualMode),
    target: e.target === void 0 ? void 0 : n(e.target),
    node: e.node === void 0 ? void 0 : n(e.node)
  };
}
function E(e) {
  const t = m(), c = f(null), a = v(e), i = t.objects.register({
    id: e.id,
    ...a,
    element: null
  });
  return d(
    () => v(e),
    (u) => t.objects.update(e.id, u),
    { deep: !0 }
  ), d(c, (u, l) => {
    const r = t.objects.get(e.id);
    (r == null ? void 0 : r.generation) === i && (u === null && r.element && r.element !== l || t.objects.setElement(e.id, u));
  }), s(() => {
    t.unregisterObjectWhenIdle(e.id, i);
  }), { elementRef: c, generation: i };
}
function g(e) {
  return {
    type: n(e.type),
    accepts: [...n(e.accepts)],
    layout: n(e.layout),
    camera: e.camera === void 0 ? void 0 : n(e.camera),
    viewport: e.viewport,
    layoutElement: e.layoutElement,
    measureLayout: e.measureLayout,
    motion: e.motion === void 0 ? void 0 : n(e.motion)
  };
}
function h(e) {
  const t = m(), c = f(null), a = g(e), i = t.surfaces.register({
    id: e.id,
    ...a,
    element: null
  });
  return d(
    () => g(e),
    (u) => t.surfaces.update(e.id, u),
    { deep: !0 }
  ), d(c, (u, l) => {
    const r = t.surfaces.get(e.id);
    (r == null ? void 0 : r.generation) === i && (u === null && r.element && r.element !== l || t.surfaces.setElement(e.id, u));
  }), s(() => {
    t.surfaces.unregister(e.id, i);
  }), { elementRef: c, generation: i };
}
function o(e) {
  return {
    surfaceId: n(e.surfaceId),
    accepts: [...n(e.accepts)],
    priority: e.priority === void 0 ? void 0 : n(e.priority),
    resolve: e.resolve === void 0 ? void 0 : n(e.resolve)
  };
}
function I(e) {
  const t = m(), c = f(null), a = o(e), i = t.targets.register({
    id: e.id,
    ...a,
    element: null
  });
  return d(
    () => o(e),
    (u) => t.targets.update(e.id, u),
    { deep: !0 }
  ), d(c, (u, l) => {
    const r = t.targets.get(e.id);
    (r == null ? void 0 : r.generation) === i && (u === null && r.element && r.element !== l || t.targets.setElement(e.id, u));
  }), s(() => {
    t.targets.unregister(e.id, i);
  }), { elementRef: c, generation: i };
}
function O(e) {
  const t = m().onAction(e);
  s(t);
}
function C(e) {
  const t = m(), c = f(t.isControlled(e)), a = t.onOwnershipChange((i) => {
    i === e && (c.value = t.isControlled(e));
  });
  return s(a), { controlled: c };
}
export {
  w as provideRuntime,
  y as runtimeInjectionKey,
  E as useObject,
  m as useRuntime,
  O as useRuntimeAction,
  C as useRuntimeTransition,
  h as useSurface,
  I as useTarget
};
