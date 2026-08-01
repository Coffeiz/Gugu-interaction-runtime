import { ref as i, onUnmounted as s, computed as u } from "vue";
import { s as r } from "../Runtime-B_ImftMX.js";
function p(o) {
  const n = i(0), t = r.owner.subscribe((e) => {
    e === o && (n.value += 1);
  });
  return s(t), { controlled: u(() => (n.value, r.owner.isControlled(o))) };
}
export {
  p as useRuntimeTransition
};
