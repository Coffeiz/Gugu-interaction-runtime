import { ref as c, watchEffect as a, watch as l, onUnmounted as i } from "vue";
import { s as t } from "../Runtime-CpYebZ_v.js";
function d(e) {
  const r = c(null);
  return t.objects.register({
    id: e.id,
    type: e.type,
    surfaceId: e.surface(),
    element: null,
    abilities: e.abilities,
    visual: e.visual,
    visualMode: e.visualMode ?? "detach"
  }), a(() => {
    t.objects.setSurface(e.id, e.surface());
  }), l(r, (u) => {
    t.objects.setElement(e.id, u);
  }), i(() => {
    t.objects.unregister(e.id);
  }), { elementRef: r };
}
export {
  d as useObject
};
