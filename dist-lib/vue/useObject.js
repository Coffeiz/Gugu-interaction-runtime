import { ref as l, watchEffect as s, watch as f, onUnmounted as d } from "vue";
import { s as r } from "../Runtime-BmuVRhii.js";
function b(e) {
  const i = l(null), u = r.objects.register({
    id: e.id,
    type: e.type,
    surfaceId: e.surface(),
    element: null,
    abilities: e.abilities,
    visual: e.visual,
    visualMode: e.visualMode ?? "detach"
  });
  return s(() => {
    r.objects.setSurface(e.id, e.surface());
  }), f(i, (t, a) => {
    if (t === null) {
      const c = r.objects.get(e.id);
      if (c != null && c.element && c.element !== a) return;
    }
    r.objects.setElement(e.id, t);
  }), d(() => {
    const t = r.objects.get(e.id);
    (t == null ? void 0 : t.generation) === u && r.objects.unregister(e.id);
  }), { elementRef: i };
}
export {
  b as useObject
};
