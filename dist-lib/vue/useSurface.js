import { ref as c, watch as m, onUnmounted as n } from "vue";
import { runtime as r } from "../index.js";
function i(e) {
  const t = c(null);
  return r.registerSurface({
    id: e.id,
    type: e.type,
    element: null,
    accepts: e.accepts,
    motion: e.motion
  }), m(t, (u) => r.surfaces.setElement(e.id, u)), n(() => {
    r.surfaces.unregister(e.id);
  }), { elementRef: t };
}
export {
  i as useSurface
};
