import { provide as j, inject as y, ref as f, watch as a, onUnmounted as s, toValue as u } from "vue";
const b = Symbol("gugu-interaction-runtime");
function w(e) {
  j(b, e);
}
function m() {
  const e = y(b);
  if (!e)
    throw new Error("Vue Runtime provider is missing; call provideRuntime(runtime) in a parent component");
  return e;
}
function o(e) {
  return {
    type: u(e.type),
    surfaceId: u(e.surface),
    abilities: [...u(e.abilities)],
    visual: e.visual === void 0 ? void 0 : u(e.visual),
    visualMode: e.visualMode === void 0 ? void 0 : u(e.visualMode),
    target: e.target === void 0 ? void 0 : u(e.target)
  };
}
function h(e) {
  const t = m(), c = f(null), d = o(e), i = t.objects.register({
    id: e.id,
    ...d,
    element: null
  });
  return a(
    () => o(e),
    (n) => t.objects.update(e.id, n),
    { deep: !0 }
  ), a(c, (n, l) => {
    const r = t.objects.get(e.id);
    (r == null ? void 0 : r.generation) === i && (n === null && r.element && r.element !== l || t.objects.setElement(e.id, n));
  }), s(() => {
    t.unregisterObjectWhenIdle(e.id, i);
  }), { elementRef: c, generation: i };
}
function g(e) {
  return {
    type: u(e.type),
    accepts: [...u(e.accepts)],
    viewport: e.viewport,
    motion: e.motion === void 0 ? void 0 : u(e.motion)
  };
}
function I(e) {
  const t = m(), c = f(null), d = g(e), i = t.surfaces.register({
    id: e.id,
    ...d,
    element: null
  });
  return a(
    () => g(e),
    (n) => t.surfaces.update(e.id, n),
    { deep: !0 }
  ), a(c, (n, l) => {
    const r = t.surfaces.get(e.id);
    (r == null ? void 0 : r.generation) === i && (n === null && r.element && r.element !== l || t.surfaces.setElement(e.id, n));
  }), s(() => {
    t.surfaces.unregister(e.id, i);
  }), { elementRef: c, generation: i };
}
function v(e) {
  return {
    surfaceId: u(e.surfaceId),
    accepts: [...u(e.accepts)],
    priority: e.priority === void 0 ? void 0 : u(e.priority),
    resolve: e.resolve === void 0 ? void 0 : u(e.resolve)
  };
}
function E(e) {
  const t = m(), c = f(null), d = v(e), i = t.targets.register({
    id: e.id,
    ...d,
    element: null
  });
  return a(
    () => v(e),
    (n) => t.targets.update(e.id, n),
    { deep: !0 }
  ), a(c, (n, l) => {
    const r = t.targets.get(e.id);
    (r == null ? void 0 : r.generation) === i && (n === null && r.element && r.element !== l || t.targets.setElement(e.id, n));
  }), s(() => {
    t.targets.unregister(e.id, i);
  }), { elementRef: c, generation: i };
}
function O(e) {
  const t = m().onAction(e);
  s(t);
}
function C(e) {
  const t = m(), c = f(t.isControlled(e)), d = t.onOwnershipChange((i) => {
    i === e && (c.value = t.isControlled(e));
  });
  return s(d), { controlled: c };
}
export {
  w as provideRuntime,
  b as runtimeInjectionKey,
  h as useObject,
  m as useRuntime,
  O as useRuntimeAction,
  C as useRuntimeTransition,
  I as useSurface,
  E as useTarget
};
