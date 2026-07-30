import { ref as i, onUnmounted as u, computed as s } from "vue";
import { runtime as r } from "../index.js";
function p(o) {
  const n = i(0), t = r.owner.subscribe((e) => {
    e === o && (n.value += 1);
  });
  return u(t), { controlled: s(() => (n.value, r.owner.isControlled(o))) };
}
export {
  p as useRuntimeTransition
};
