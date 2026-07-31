import { D as f, M as m, a as R, b as g, c as S, d as C, e as A, f as L, O as v, R as O, g as h, h as y, i as M, j as p, k as I, S as x, l as V, m as D, V as E, n as F, o as P, p as T, q as b, r as q, s as _, t as B } from "./Runtime-CpYebZ_v.js";
import { D as W, F as j, a as k, L as H, b as U, c as G, d as w, e as z, i as J, m as K, s as Q } from "./DetachAdapter-CsjtZIYW.js";
function i(o, e) {
  const t = o.getBoundingClientRect();
  return e.x >= t.left && e.x <= t.right && e.y >= t.top && e.y <= t.bottom;
}
function l(o) {
  return {
    findSurface(e) {
      return Array.from(document.querySelectorAll(o.surfaceSelector)).find((t) => i(t, e)) ?? null;
    },
    findTarget(e, t, n) {
      return Array.from(e.querySelectorAll(o.targetSelector)).filter((r) => r.dataset.card !== n).find((r) => i(r, t)) ?? null;
    },
    findIndex(e, t, n) {
      const r = Array.from(e.querySelectorAll(o.targetSelector)).filter((a) => a.dataset.card !== n);
      for (let a = 0; a < r.length; a += 1) {
        const s = r[a].getBoundingClientRect();
        if (t.y < s.top + s.height / 2) return a;
      }
      return r.length;
    }
  };
}
function u(o, e, t, n) {
  const r = o.findSurface({ x: e, y: t });
  if (!r) return null;
  const a = r.dataset.column;
  if (!a) return null;
  const s = o.findIndex(r, { x: e, y: t }, n);
  return { columnId: a, index: s };
}
export {
  W as DEFAULT_RELEASE_PROFILE,
  f as DefaultVisualAdapter,
  j as FOLLOW_PROFILE,
  k as FOLLOW_ROTATION,
  H as LANDING_PROFILE,
  m as MoveActionCoordinator,
  R as MoveBehavior,
  g as MoveCommitCoordinator,
  S as MoveLandingCoordinator,
  C as MoveReleaseCoordinator,
  A as MoveTransaction,
  L as MoveUpdateCoordinator,
  v as ObjectStore,
  O as Runtime,
  h as RuntimeDispatcher,
  y as RuntimeInputCoordinator,
  M as RuntimeMoveCoordinator,
  p as RuntimeRegistry,
  I as RuntimeSessionCoordinator,
  x as Session,
  V as SessionCoordinator,
  D as SurfaceStore,
  E as VisualAdapters,
  F as VisualMotionCoordinator,
  P as VisualProxyCoordinator,
  T as VisualStateCoordinator,
  U as acquireSourceVisualLease,
  b as bindPointerSessionInput,
  G as coastOffset,
  w as createCardMotionController,
  z as createDetachMoveFromAdapter,
  l as createDomHitResolver,
  q as createRegisteredHitResolver,
  u as hitWithResolver,
  J as integrateSpring,
  K as mountVisualOverlay,
  _ as runtime,
  Q as shapeReleaseVelocity,
  B as trackLandingTarget
};
