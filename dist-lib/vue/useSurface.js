import { ref as c, watch as m, onUnmounted as n } from "vue";
import { s as r } from "../Runtime-B_ImftMX.js";
function i(e) {
  const t = c(null);
  return r.registerSurface({
    id: e.id,
    type: e.type,
    element: null,
    accepts: e.accepts,
    viewport: e.viewport,
    motion: e.motion
  }), m(t, (u) => r.surfaces.setElement(e.id, u)), n(() => {
    r.surfaces.unregister(e.id);
  }), { elementRef: t };
}
export {
  i as useSurface
};
