import { D as f, M as g, a as m, b as R, c as S, d as p, e as C, f as L, O as y, R as A, g as h, h as v, i as M, j as O, k as F, S as I, l as x, m as E, V as P, n as D, o as V, p as T, q as b, r as q, s as _, t as j } from "./Runtime-BmuVRhii.js";
import { D as B, F as G, a as H, L as N, b as W, c as U, d as w, e as z, f as J, g as K, h as Q, i as X, p as Y, j as Z, r as $, s as ee, k as te, t as ae } from "./DetachAdapter-D_Wg8Wh-.js";
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
      return Array.from(e.querySelectorAll(o.targetSelector)).filter((a) => a.dataset.card !== n).find((a) => i(a, t)) ?? null;
    },
    findIndex(e, t, n) {
      const a = Array.from(e.querySelectorAll(o.targetSelector)).filter((r) => r.dataset.card !== n);
      for (let r = 0; r < a.length; r += 1) {
        const s = a[r].getBoundingClientRect();
        if (t.y < s.top + s.height / 2) return r;
      }
      return a.length;
    }
  };
}
function u(o, e, t, n) {
  const a = o.findSurface({ x: e, y: t });
  if (!a) return null;
  const r = a.dataset.column;
  if (!r) return null;
  const s = o.findIndex(a, { x: e, y: t }, n);
  return { columnId: r, index: s };
}
export {
  B as DEFAULT_RELEASE_PROFILE,
  f as DefaultVisualAdapter,
  G as FOLLOW_PROFILE,
  H as FOLLOW_ROTATION,
  N as LANDING_PROFILE,
  g as MoveActionCoordinator,
  m as MoveBehavior,
  R as MoveCommitCoordinator,
  S as MoveLandingCoordinator,
  p as MoveReleaseCoordinator,
  C as MoveTransaction,
  L as MoveUpdateCoordinator,
  y as ObjectStore,
  A as Runtime,
  h as RuntimeDispatcher,
  v as RuntimeInputCoordinator,
  M as RuntimeMoveCoordinator,
  O as RuntimeRegistry,
  F as RuntimeSessionCoordinator,
  I as Session,
  x as SessionCoordinator,
  E as SurfaceStore,
  P as VisualAdapters,
  D as VisualMotionCoordinator,
  V as VisualProxyCoordinator,
  T as VisualStateCoordinator,
  W as acquireSourceVisualLease,
  b as bindPointerSessionInput,
  U as cancelLayoutAnimations,
  w as captureCollectionPresence,
  z as captureLayoutFlip,
  J as coastOffset,
  K as createCardMotionController,
  Q as createDetachMoveFromAdapter,
  l as createDomHitResolver,
  q as createRegisteredHitResolver,
  u as hitWithResolver,
  X as integrateSpring,
  Y as playCollectionPresence,
  Z as playLayoutFlip,
  $ as runGroupToggle,
  _ as runtime,
  ee as setLayoutPresenceEnabled,
  te as shapeReleaseVelocity,
  j as trackLandingTarget,
  ae as transitionGroupHeight
};
