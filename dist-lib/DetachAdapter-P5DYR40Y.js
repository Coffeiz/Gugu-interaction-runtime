const ot = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }
}, Nt = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, nn = 8;
function Bt(t, e = Nt) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const o = t.x * e.velocityScale, a = t.y * e.velocityScale, i = Math.hypot(o, a);
  if (i <= e.maxVelocity || i === 0) return { x: o, y: a };
  const r = e.maxVelocity / i;
  return { x: o * r, y: a * r };
}
function on(t, e = Nt) {
  const n = Bt(t, e), o = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (o <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const a = Math.min(1, e.maxCoast / o);
  return { x: n.x * e.coastSeconds * a, y: n.y * e.coastSeconds * a };
}
function It(t, e, n, o, a, i = 1 / 120) {
  let r = Math.max(0, a);
  for (; r > 1e-4; ) {
    const l = Math.min(r, i);
    r -= l;
    const s = n * (e.x - t.position.x) - o * t.velocity.x, c = n * (e.y - t.position.y) - o * t.velocity.y;
    t.velocity.x += s * l, t.velocity.y += c * l, t.position.x += t.velocity.x * l, t.position.y += t.velocity.y * l;
  }
}
const ht = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, re = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, Dt = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, ae = { position: 0.35, velocity: 5 };
function Vt(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? ae, o = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    scaleX: 1,
    scaleY: 1,
    scaleVX: 0,
    scaleVY: 0,
    rotateX: 0,
    rotateZ: 0
  };
  let a = { x: 0, y: 0 }, i = ht, r = null, l = null, s = !1, c = 0, u = 0, d = "settle", m = 0;
  function F() {
    t.onFrame({
      x: o.x,
      y: o.y,
      scaleX: o.scaleX,
      scaleY: o.scaleY,
      rotateX: o.rotateX,
      rotateZ: o.rotateZ
    });
  }
  function T(g) {
    var D;
    if (!s) return;
    const k = Math.min(0.032, l == null ? 1 / 60 : Math.max(0, (g - l) / 1e3));
    if (l = g, d === "coast") {
      const f = Math.exp(-w.friction * k);
      o.vx *= f, o.vy *= f;
      const E = o.vx * k, h = o.vy * k, A = m + Math.hypot(E, h);
      if (A >= w.maxDistance) {
        const C = Math.max(0, w.maxDistance - m), L = Math.hypot(E, h), W = L > 0 ? C / L : 0;
        o.x += E * W, o.y += h * W, o.vx = 0, o.vy = 0, d = "settle";
      } else
        o.x += E, o.y += h, m = A, ((g - (R ?? g)) / 1e3 >= w.duration || Math.hypot(o.vx, o.vy) <= w.minVelocity) && (d = "settle");
    }
    if (d === "settle") {
      const f = { position: { x: o.x, y: o.y }, velocity: { x: o.vx, y: o.vy } };
      It(f, { x: a.x, y: a.y }, i.position.stiffness, i.position.damping, k), o.x = f.position.x, o.y = f.position.y, o.vx = f.velocity.x, o.vy = f.velocity.y;
    }
    const S = { position: { x: o.scaleX, y: o.scaleY }, velocity: { x: o.scaleVX, y: o.scaleVY } };
    if (It(S, { x: a.scaleX ?? o.scaleX, y: a.scaleY ?? o.scaleY }, i.scale.stiffness, i.scale.damping, k), o.scaleX = S.position.x, o.scaleY = S.position.y, o.scaleVX = S.velocity.x, o.scaleVY = S.velocity.y, e === "follow") {
      const f = t.followRotation, E = -Math.log(1 - (f.smoothing ?? 0.2)) * 60, h = 1 - Math.exp(-E * k);
      c += (o.vx - c) * h, u += (o.vy - u) * h, o.rotateZ = Math.max(-(f.maxSway ?? 5), Math.min(f.maxSway ?? 5, c / 60 * f.sway));
      const A = Math.max(-(f.maxTiltDelta ?? 4), Math.min(f.maxTiltDelta ?? 4, u / 60 * (f.verticalTiltFactor ?? 0.16)));
      o.rotateX = f.tilt + A;
    } else {
      const f = Math.exp(-10 * k);
      o.rotateX *= f, o.rotateZ *= f;
    }
    if (F(), e === "follow") {
      r = requestAnimationFrame(T);
      return;
    }
    if (d === "settle" && Math.abs(a.x - o.x) < n.position && Math.abs(a.y - o.y) < n.position && Math.abs(o.vx) < n.velocity && Math.abs(o.vy) < n.velocity) {
      s = !1, r = null, (D = t.onArrived) == null || D.call(t);
      return;
    }
    r = requestAnimationFrame(T);
  }
  let w = null, R = null;
  return {
    seed(g) {
      Object.assign(o, g);
    },
    setTarget(g) {
      a = { ...g };
    },
    retarget(g) {
      a = { ...g };
    },
    setProfile(g) {
      i = g;
    },
    getState() {
      return o;
    },
    start() {
      s || (s = !0, d = "settle", w = null, R = null, l = null, F(), r = requestAnimationFrame(T));
    },
    startCoastThenSettle(g) {
      if (s) return;
      s = !0, d = "coast", w = g, m = 0, R = null;
      const k = Math.hypot(o.vx, o.vy), S = g.maxDistance / Math.max(g.duration, 1 / 60);
      if (k > S && k > 0) {
        const v = S / k;
        o.vx *= v, o.vy *= v;
      }
      l = null, F(), r = requestAnimationFrame((v) => {
        R = v, T(v);
      });
    },
    interrupt() {
      return s = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    cancel() {
      return s = !1, r !== null && cancelAnimationFrame(r), r = null, { ...o };
    },
    stop() {
      s = !1, r !== null && cancelAnimationFrame(r), r = null;
    }
  };
}
function se(t) {
  const e = getComputedStyle(t);
  return {
    fontFamily: e.fontFamily,
    color: e.color,
    fontSize: e.fontSize,
    fontWeight: e.fontWeight,
    lineHeight: e.lineHeight,
    letterSpacing: e.letterSpacing,
    textAlign: e.textAlign,
    direction: e.direction,
    wordSpacing: e.wordSpacing,
    whiteSpace: e.whiteSpace,
    textIndent: e.textIndent
  };
}
function le(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Tt(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function ce(t, e = t.getBoundingClientRect(), n = {}) {
  const o = document.createElement("div"), a = document.createElement("div"), i = t.cloneNode(!0);
  return a.dataset.runtimeProxyScaleShell = "true", i.dataset.runtimeProxyContent = "true", Object.assign(a.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    transformOrigin: "0 0",
    pointerEvents: "none"
  }), Object.assign(i.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    margin: "0",
    pointerEvents: "none"
  }), a.appendChild(i), o.appendChild(a), o.className = "", o.style.position = "fixed", o.style.left = `${e.left}px`, o.style.top = `${e.top}px`, o.style.boxSizing = "border-box", o.style.width = `${e.width}px`, o.style.height = `${e.height}px`, o.style.margin = "0", o.style.zIndex = "2147483647", o.style.pointerEvents = "none", o.style.visibility = "visible", o.style.willChange = "transform", o.style.display = "", o.dataset.runtimeProxy = "true", o.style.transformOrigin = "50% 50%", o.style.transform = "perspective(760px) rotateX(5deg) scale(1.03)", bt && n.glass !== !1 ? Yt(i) : i.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", i.style.transition = "box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease", o.style.transition = "transform .15s ease", document.documentElement.appendChild(o), vt.add(o), o;
}
function rn(t) {
  return t;
}
function Rt(t) {
  return t.querySelector("[data-runtime-proxy-content]") ?? t;
}
function gt(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function Xt(t) {
  const e = [];
  for (const n of Array.from(t.childNodes)) {
    if (n.nodeType === Node.COMMENT_NODE) {
      n.remove();
      continue;
    }
    if (n.nodeType === Node.TEXT_NODE) {
      if (!(n.textContent ?? "").trim()) {
        n.remove();
        continue;
      }
      const o = document.createElement("span");
      o.textContent = n.textContent, n.replaceWith(o), e.push(o);
      continue;
    }
    n.nodeType === Node.ELEMENT_NODE && e.push(n);
  }
  return e;
}
function qt(t, e) {
  const n = getComputedStyle(e), o = parseFloat(n.paddingTop) || 0, a = parseFloat(n.paddingRight) || 0, i = parseFloat(n.paddingBottom) || 0, l = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${o}px`,
    right: `${a}px`,
    bottom: `${i}px`,
    pointerEvents: "none"
  }, s = document.createElement("div");
  Object.assign(s.style, { ...l });
  const c = getComputedStyle(t);
  for (s.style.display = c.display, s.style.flexDirection = c.flexDirection, s.style.flexWrap = c.flexWrap, s.style.alignItems = c.alignItems, s.style.justifyContent = c.justifyContent, s.style.gap = c.gap; t.firstChild; ) s.appendChild(t.firstChild);
  const u = Xt(s), d = new Set(u.map(gt)), m = document.createElement("div");
  Object.assign(m.style, { ...l, pointerEvents: "" }), m.style.display = n.display, m.style.flexDirection = n.flexDirection, m.style.flexWrap = n.flexWrap, m.style.alignItems = n.alignItems, m.style.justifyContent = n.justifyContent, m.style.gap = n.gap, m.style.overflow = "hidden";
  const F = e.cloneNode(!0);
  for (F.style.visibility = "visible", F.style.display = ""; F.firstChild; ) m.appendChild(F.firstChild);
  const T = se(e);
  le(m, T);
  const w = Xt(m), R = new Set(w.map(gt)), g = w.filter((v) => !d.has(gt(v)));
  for (const v of g) v.style.opacity = "0";
  const k = u.filter((v) => !R.has(gt(v))), S = new Set(k);
  for (const v of u)
    S.has(v) || (v.style.opacity = "0");
  return t.appendChild(m), k.length > 0 && t.appendChild(s), { enteringEls: g, leavingEls: k };
}
function an(t, e) {
  const n = Math.max(e.left, e.right - t.width), o = Math.max(e.top, e.bottom - t.height);
  return {
    left: Math.min(Math.max(t.left, e.left), n),
    top: Math.min(Math.max(t.top, e.top), o),
    width: t.width,
    height: t.height
  };
}
function sn(t, e, n = {}) {
  const o = n.duration ?? ot.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, l = n.targetBackground, s = n.targetOpacity, c = Rt(t), u = n.targetContent ? qt(c, n.targetContent) : null;
  if (u) {
    for (const x of u.enteringEls) x.style.transition = `opacity ${o}ms ${a}`;
    for (const x of u.leavingEls) x.style.transition = `opacity ${o}ms ${a}`;
  }
  const d = parseFloat(t.style.left) || 0, m = parseFloat(t.style.top) || 0;
  let F = !1, T = e;
  const w = performance.now();
  let R = () => {
  }, g = () => {
  };
  const k = new Promise((x) => {
    g = x;
  }), S = () => {
    const x = t.getBoundingClientRect();
    return Math.abs(x.left - T.left) < 2 && Math.abs(x.top - T.top) < 2 && Math.abs(x.width - T.width) < 2 && Math.abs(x.height - T.height) < 2;
  };
  let v = null, D = null, f = 0;
  const E = 60, h = (x) => {
    F || (F = !0, t.removeEventListener("transitionend", R), D !== null && (window.clearTimeout(D), D = null), g());
  }, A = () => {
    if (!F) {
      if (S()) {
        h();
        return;
      }
      if (performance.now() - w >= o + 500) {
        h();
        return;
      }
      window.requestAnimationFrame(A);
    }
  }, C = (x, P = o) => {
    T = x;
    const N = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${N.width.toFixed(2)}px`, t.style.height = `${N.height.toFixed(2)}px`, t.style.transform = `translate3d(${(N.left - d).toFixed(2)}px, ${(N.top - m).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const X = `translate3d(${(x.left - d).toFixed(2)}px, ${(x.top - m).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${P}ms ${a}, width ${P}ms ${a}, height ${P}ms ${a}`, c.style.transition = [
      `box-shadow ${P}ms ease`,
      `border-radius ${P}ms ease`,
      `background-color ${P}ms ease`,
      `background-image ${P}ms ease`,
      `opacity ${P}ms ease`
    ].join(", "), requestAnimationFrame(() => {
      if (t.style.transform = X, t.style.width = `${x.width.toFixed(2)}px`, t.style.height = `${x.height.toFixed(2)}px`, i != null && (c.style.boxShadow = i), r != null && (c.style.borderRadius = r), l != null && (c.style.backgroundColor = l, n.targetBackgroundImage && (c.style.backgroundImage = n.targetBackgroundImage)), s != null && (c.style.opacity = s), u) {
        for (const q of u.enteringEls) q.style.opacity = "1";
        for (const q of u.leavingEls) q.style.opacity = "0";
      }
    });
  };
  R = (x) => {
    x.target !== t || !(x.propertyName === "transform" || x.propertyName === "width" || x.propertyName === "height") || S() && h(`transitionend:${x.propertyName}`);
  }, t.addEventListener("transitionend", R), C(e), window.setTimeout(A, o + 40);
  const L = (x) => {
    var N;
    f = performance.now();
    const P = Math.max(80, o - (f - w));
    C(((N = n.readTarget) == null ? void 0 : N.call(n)) ?? x, P);
  };
  return { finished: k, retarget: (x) => {
    if (F) return;
    const P = Math.abs(x.left - T.left), N = Math.abs(x.top - T.top), X = Math.abs(x.width - T.width), q = Math.abs(x.height - T.height);
    if (P < 0.5 && N < 0.5 && X < 0.5 && q < 0.5) return;
    const tt = performance.now() - f;
    if (tt >= E) {
      L(x);
      return;
    }
    v = x, D === null && (D = window.setTimeout(() => {
      if (D = null, F || !v) return;
      const U = v;
      v = null, L(U);
    }, E - tt));
  } };
}
function ln(t, e, n = {}) {
  var y, p, M, O, V, G, j, I, K, Y, $, z, B;
  const o = n.duration ?? ot.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", i = n.targetShadow, r = n.targetRadius, l = n.targetBackground, s = n.targetOpacity, c = Rt(t), u = t.querySelector("[data-runtime-proxy-scale-shell]"), d = n.targetContent ? qt(c, n.targetContent) : null;
  if (d) {
    for (const b of d.enteringEls) b.style.transition = `opacity ${o}ms ${a}`;
    for (const b of d.leavingEls) b.style.transition = `opacity ${o}ms ${a}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`, t.style.transform = "translate3d(0px, 0px, 0)");
  const m = parseFloat(t.style.left) || t.getBoundingClientRect().left, F = parseFloat(t.style.top) || t.getBoundingClientRect().top, T = t.getBoundingClientRect(), w = T.width || e.width, R = T.height || e.height, g = (b) => ({
    left: b.left - (w - b.width) / 2,
    top: b.top - (R - b.height) / 2,
    width: b.width,
    height: b.height
  });
  let k = e, S = !1;
  const v = n.landingMode === "target" && !!u, D = v ? ((y = n.dismiss) == null ? void 0 : y.duration) ?? o : 0;
  let f = !1, E = !v, h = null, A = null, C = 0, L = () => {
  };
  const W = new Promise((b) => {
    L = b;
  }), x = () => {
    S || (S = !0, X.stop(), h !== null && window.clearTimeout(h), A !== null && window.clearTimeout(A), h = null, A = null, L());
  }, P = () => {
    f && E && x();
  }, N = () => {
    S || (f = !0, P());
  }, X = Vt({
    mode: "settle",
    onFrame: (b) => {
      const H = w * b.scaleX, Z = R * b.scaleY, Ft = b.x + (w - H) / 2, ie = b.y + (R - Z) / 2;
      t.style.transform = `perspective(760px) translate3d(${(Ft - m).toFixed(2)}px, ${(ie - F).toFixed(2)}px, 0) rotateX(${b.rotateX.toFixed(2)}deg) rotateZ(${b.rotateZ.toFixed(2)}deg)`, t.style.width = `${H.toFixed(2)}px`, t.style.height = `${Z.toFixed(2)}px`;
    },
    onArrived: N
  }), q = Math.hypot(((p = n.motionState) == null ? void 0 : p.vx) ?? 0, ((M = n.motionState) == null ? void 0 : M.vy) ?? 0), tt = n.releaseDamping ?? 0.78, U = n.targetMotion ? {
    position: { ...ht.position, ...n.targetMotion.position },
    scale: { ...ht.scale, ...n.targetMotion.scale }
  } : ht;
  X.setProfile(q > 30 ? {
    ...U,
    position: {
      ...U.position,
      damping: U.position.damping * tt
    }
  } : U), X.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((O = n.motionState) == null ? void 0 : O.x) ?? T.left,
    y: ((V = n.motionState) == null ? void 0 : V.y) ?? T.top,
    vx: ((G = n.motionState) == null ? void 0 : G.vx) ?? 0,
    vy: ((j = n.motionState) == null ? void 0 : j.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((I = n.motionState) == null ? void 0 : I.scaleX) ?? 1,
    scaleY: ((K = n.motionState) == null ? void 0 : K.scaleY) ?? 1,
    rotateX: ((Y = n.motionState) == null ? void 0 : Y.rotateX) ?? 0,
    rotateZ: (($ = n.motionState) == null ? void 0 : $.rotateZ) ?? 0
  });
  const et = g(e), ft = n.landingMode === "target" ? { scaleX: 1, scaleY: 1 } : { scaleX: et.width / w, scaleY: et.height / R };
  X.setTarget({
    x: et.left,
    y: et.top,
    scaleX: ft.scaleX,
    scaleY: ft.scaleY
  }), t.style.transition = "", c.style.transition = [
    `box-shadow ${o}ms ${a}`,
    `border-radius ${o}ms ${a}`,
    `background-color ${o}ms ${a}`,
    `background-image ${o}ms ${a}`,
    `opacity ${o}ms ${a}`
  ].join(", "), requestAnimationFrame(() => {
    var b, H;
    if (!S) {
      if (i != null && (c.style.boxShadow = i), r != null && (c.style.borderRadius = r), l != null && (c.style.backgroundColor = l, n.targetBackgroundImage && (c.style.backgroundImage = n.targetBackgroundImage)), s != null && (c.style.opacity = s), v && u) {
        const Z = ((b = n.dismiss) == null ? void 0 : b.easing) ?? a, Ft = ((H = n.dismiss) == null ? void 0 : H.scale) ?? 0.72;
        u.style.transformOrigin = "50% 50%", u.style.transition = `transform ${D}ms ${Z}`, c.style.transition = `opacity ${D}ms ${Z}`, u.style.transform = `scale(${Ft})`, c.style.opacity = "0", A = window.setTimeout(() => {
          A = null, E = !0, P();
        }, D + 40);
      }
      if (d) {
        for (const Z of d.enteringEls) Z.style.opacity = "1";
        for (const Z of d.leavingEls) Z.style.opacity = "0";
      }
    }
  });
  const yt = (b = 0) => {
    h !== null && window.clearTimeout(h), C = performance.now() + Math.max(2e3, o * 8, 5e3) + b, h = window.setTimeout(() => {
      h = null, !S && performance.now() >= C && N();
    }, Math.max(2e3, o * 8, 5e3) + b);
  };
  yt();
  const Q = n.coast;
  return Q && Q.maxDistance > 0 && Math.hypot(((z = n.motionState) == null ? void 0 : z.vx) ?? 0, ((B = n.motionState) == null ? void 0 : B.vy) ?? 0) > Q.minVelocity ? X.startCoastThenSettle(Q) : X.start(), {
    finished: W,
    retarget(b) {
      if (S) return;
      k = b, yt(1e3);
      const H = g(k);
      X.setTarget({
        x: H.left,
        y: H.top,
        scaleX: n.landingMode === "target" ? 1 : H.width / w,
        scaleY: n.landingMode === "target" ? 1 : H.height / R
      });
    }
  };
}
function cn(t) {
  vt.has(t) && (vt.delete(t), t.remove());
}
const xt = /* @__PURE__ */ new WeakMap(), it = /* @__PURE__ */ new WeakMap(), kt = /* @__PURE__ */ new WeakSet();
function ue(t, e) {
  xt.set(t, { style: t.getAttribute("style") ?? "" });
  const n = ce(t, e, { glass: !1 }), o = Rt(n);
  n.style.zIndex = "1000", n.style.transform = "scale(1)", n.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", kt.add(n), it.set(t, n), t.style.visibility = "hidden", requestAnimationFrame(() => {
    n.isConnected && (bt ? Yt(o) : o.style.boxShadow = "0 12px 24px rgba(0,0,0,.18)", n.style.transform = "scale(1.03)");
  });
}
function Ot(t) {
  return it.get(t);
}
function de(t) {
  const e = it.get(t);
  if (e)
    return kt.delete(e), it.delete(t), xt.delete(t), e.style.zIndex = "2147483647", e;
}
function pt(t) {
  const e = it.get(t);
  e && (kt.delete(e), e.remove(), vt.delete(e), it.delete(t));
  const n = xt.get(t);
  t.setAttribute("style", (n == null ? void 0 : n.style) ?? ""), xt.delete(t);
}
const vt = /* @__PURE__ */ new Set();
let bt = !1;
function un(t) {
  bt = t;
}
function dn() {
  return bt;
}
function Yt(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", t.style.boxShadow = "0 22px 50px rgba(30, 35, 60, 0.30)", t.style.opacity = "0.97";
}
const lt = /* @__PURE__ */ new Map();
function fn(t, e) {
  lt.set(t, e), t.style.visibility = "hidden";
}
function yn(t, e) {
  const n = lt.get(t) === e;
  return n && (t.style.visibility = "", lt.delete(t)), n;
}
function fe(t, e) {
  lt.get(t) === e && lt.delete(t);
}
const Mt = /* @__PURE__ */ new WeakMap();
function ye(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  Mt.set(t, n);
  const o = () => Mt.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => o() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => o() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => o() ? (t.style.cssText = n.cssText, Mt.delete(t), !0) : !1,
    isOwner: o
  };
}
const at = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ new WeakMap();
function Wt(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (l) => l * l * (3 - 2 * l);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((l) => !Number.isFinite(l)))
    return (l) => l * l * (3 - 2 * l);
  const [o, a, i, r] = n;
  return (l) => {
    let s = 0, c = 1;
    for (let d = 0; d < 12; d += 1) {
      const m = (s + c) / 2;
      3 * (1 - m) ** 2 * m * o + 3 * (1 - m) * m ** 2 * i + m ** 3 < l ? s = m : c = m;
    }
    const u = (s + c) / 2;
    return 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * r + u ** 3;
  };
}
function At(t) {
  const e = at.get(t);
  e && (cancelAnimationFrame(e.frame), at.delete(t), t.style.transform = "");
}
function ge(t, e, n, o, a, i) {
  At(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Wt(a)
  };
  at.set(t, r);
  const l = (s) => {
    if (at.get(t) !== r) return;
    const c = Math.min(1, (s - r.started) / r.duration), u = r.easing(c);
    if (t.style.transform = `translate(${(r.fromX * (1 - u)).toFixed(3)}px, ${(r.fromY * (1 - u)).toFixed(3)}px)`, c >= 1) {
      at.delete(t), t.style.transform = "", i == null || i();
      return;
    }
    r.frame = requestAnimationFrame(l);
  };
  r.frame = requestAnimationFrame(l);
}
function $t(t) {
  const e = st.get(t);
  e && (cancelAnimationFrame(e.frame), st.delete(t), t.style.height = "");
}
function pe(t, e, n, o, a, i) {
  $t(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, o),
    fromX: e,
    fromY: n,
    easing: Wt(a)
  };
  st.set(t, r);
  const l = (s) => {
    if (st.get(t) !== r) return;
    const c = Math.min(1, (s - r.started) / r.duration), u = r.fromX + (r.fromY - r.fromX) * r.easing(c);
    if (t.style.height = `${u}px`, c >= 1) {
      st.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(l);
  };
  r.frame = requestAnimationFrame(l);
}
const ct = ot.flip.duration, ut = ot.flip.easing;
function me(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((o) => n.set(o, (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect())), n;
}
function Gt(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, At(n), n.style.setProperty("transition", "none", "important");
}
function he(t, e, n = ct, o = ut, a) {
  Gt(t);
  const i = [];
  for (const r of t) {
    if (r.dataset.runtimeProxy === "true" || r.dataset.runtimePlaceholder === "true" || r.dataset.runtimeActive === "true")
      continue;
    const l = e.get(r);
    if (!l)
      continue;
    const s = (a == null ? void 0 : a.rect(r)) ?? r.getBoundingClientRect(), c = l.left - s.left, u = l.top - s.top;
    if (Math.abs(c) < 0.5 && Math.abs(u) < 0.5) {
      r.style.transition = "";
      continue;
    }
    i.push({ element: r, dx: c, dy: u });
  }
  for (const { element: r, dx: l, dy: s } of i) {
    r.style.setProperty("transition", "none", "important"), r.style.transform = `translate(${l}px, ${s}px)`;
    const c = String(Number(r.dataset.runtimeFlipToken ?? "0") + 1);
    r.dataset.runtimeFlip = "true", r.dataset.runtimeFlipToken = c, ge(r, l, s, n, o, () => {
      r.dataset.runtimeFlipToken === c && (r.style.transition = "", delete r.dataset.runtimeFlip);
    });
  }
}
function Ht(t) {
  return t.dataset.layoutKey ?? t.dataset.card ?? "";
}
const mt = /* @__PURE__ */ new WeakMap();
function xe(t) {
  const e = t.closest('[data-layout-open="false"]');
  return e !== null && e.dataset.runtimeGroupAnimating !== "true";
}
function _t(t, e) {
  if (xe(t)) return null;
  const n = t.closest("[data-layout-collection]");
  if (!n) return null;
  const o = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect(), a = (e == null ? void 0 : e.rect(n)) ?? n.getBoundingClientRect();
  return o.width > 0 && o.height > 0 && a.width > 0 && o.width <= a.width * 1.25 && o.left >= a.left - 1 && o.right <= a.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function jt(t, e) {
  return !e || e.length === 0 ? !0 : e.some((n) => n === t || n.contains(t));
}
function Zt(t, e, n) {
  if (!n || n.length === 0)
    return Array.from(t.querySelectorAll(e));
  const o = [], a = /* @__PURE__ */ new Set();
  for (const i of n)
    i.matches(e) && !a.has(i) && (a.add(i), o.push(i)), i.querySelectorAll(e).forEach((r) => {
      a.has(r) || (a.add(r), o.push(r));
    });
  return o;
}
function ve(t, e, n = Ht, o, a, i) {
  const r = /* @__PURE__ */ new Map(), l = Zt(t, e, a).map((s) => {
    if (o != null && o(s) || !jt(s, a)) return null;
    const c = _t(s, i);
    if (!c) return null;
    const u = n(s);
    if (!u) return null;
    const d = (i == null ? void 0 : i.rect(s)) ?? s.getBoundingClientRect();
    return r.set(u, c.collectionId), {
      key: u,
      element: s,
      rect: { left: d.left, top: d.top, width: d.width, height: d.height },
      contentHTML: s.outerHTML
    };
  }).filter((s) => s !== null);
  return { root: t, selector: e, collectionByKey: r, entries: l, ignore: o, scopeSurfaces: a };
}
function Se(t, e = {}, n) {
  const o = e.duration ?? 250, a = e.easing ?? "cubic-bezier(.22,1,.36,1)", i = e.key ?? Ht, r = /* @__PURE__ */ new Map();
  Zt(t.root, t.selector, t.scopeSurfaces).filter((s) => {
    var d;
    if ((d = t.ignore) != null && d.call(t, s) || !jt(s, t.scopeSurfaces)) return !1;
    const c = _t(s, n);
    if (!c) return !1;
    const u = i(s);
    return u ? (r.set(u, c.collectionId), !0) : !1;
  }).filter((s) => {
    const c = i(s);
    if (!c) return !1;
    const u = t.collectionByKey.get(c);
    return u === void 0 || u !== r.get(c);
  }).forEach((s) => {
    var u;
    (u = mt.get(s)) == null || u.cancel();
    const c = s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: o, easing: a, fill: "both" });
    mt.set(s, c), c.finished.then(() => {
      mt.get(s) === c && mt.delete(s);
    }).catch(() => {
    });
  }), t.entries.forEach((s) => {
    if (r.has(s.key)) return;
    const c = document.createElement("template");
    c.innerHTML = s.contentHTML;
    const u = c.content.firstElementChild;
    if (!u) return;
    u.removeAttribute("data-file-id"), u.removeAttribute("data-layout-key"), u.removeAttribute("data-layout-role"), u.dataset.runtimePresenceGhost = "true";
    const d = s.rect;
    u.style.position = "fixed", u.style.left = `${d.left}px`, u.style.top = `${d.top}px`, u.style.width = `${d.width}px`, u.style.height = `${d.height}px`, u.style.margin = "0", u.style.pointerEvents = "none", u.style.zIndex = "2147483646", document.body.appendChild(u), u.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o, easing: a, fill: "both" }).finished.then(() => u.remove()).catch(() => u.remove());
  });
}
function Ut() {
  const t = /* @__PURE__ */ new WeakMap();
  return {
    rect(e) {
      const n = t.get(e);
      if (n) return n;
      const o = e.getBoundingClientRect();
      return t.set(e, o), o;
    }
  };
}
let Kt = null, Jt = !1;
const Ct = /* @__PURE__ */ new WeakMap();
function gn(t) {
  Kt = t;
}
function pn(t) {
  Jt = t;
}
function Qt() {
  const t = Kt;
  return {
    flip: (t == null ? void 0 : t.flip) ?? ot.flip,
    resize: (t == null ? void 0 : t.resize) ?? ot.resize
  };
}
function we(t, e, n) {
  const o = (l) => !n || n.length === 0 ? !0 : n.some((s) => s === l || s.contains(l)), a = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(o), i = [], r = [];
  for (const l of t)
    o(l) && (l.closest("[data-layout-group]") !== null ? i.push(l) : r.push(l));
  return { groups: a, groupLeaves: i, flatCards: r };
}
function Et(t, e = document, n = !0, o, a = {}) {
  const i = (w) => {
    const R = a.scopeSurfaces;
    return !R || R.length === 0 ? !0 : R.some((g) => g === w || g.contains(w));
  }, r = Array.from(e.querySelectorAll("[data-layout-surface]")).filter(i), l = r.map((w) => ({ element: w, rect: dt(w), inlineStyle: ne(w) }));
  ee(l);
  const s = Ut(), { groups: c, groupLeaves: u, flatCards: d } = we(t, e, a.scopeSurfaces), m = Oe(r, s), F = (a.scopeSurfaces ?? [e]).some(
    (w) => w instanceof HTMLElement ? w.matches("[data-layout-collection]") || w.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), T = {
    root: e,
    group: c.length > 0 ? { before: Ee([...c, ...u], s) } : void 0,
    flat: d.length > 0 ? { elements: d, before: me(d, s) } : void 0,
    surfaces: m,
    presence: n && F ? ve(e, '[data-layout-role="card"]', void 0, o, a.scopeSurfaces, s) : void 0
  };
  return Re(e, T);
}
function Pt(t) {
  const e = Ut(), n = Qt(), o = t.group ? Fe(t.group.before) : null;
  t.group && Le(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && he(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), ze(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && Se(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), o && Me(o, n.flip.duration + 50);
}
const rt = /* @__PURE__ */ new WeakMap();
let be = 0;
function Fe(t) {
  const e = t.filter((i) => i.rect.height > 0).map((i) => ({ element: i.element, overflow: i.element.style.overflow })).filter((i) => i.element.isConnected).filter((i) => i.element.dataset.runtimeGroupAnimating !== "true").filter((i) => getComputedStyle(i.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), o = rt.get(n);
  o == null || o.entries.forEach(({ element: i, overflow: r }) => {
    i.style.overflow = r;
  }), e.forEach(({ element: i }) => {
    i.style.overflow = "visible";
  });
  const a = { token: String(++be), entries: e };
  return rt.set(n, a), a;
}
function Me(t, e) {
  var o;
  const n = (o = t.entries[0]) == null ? void 0 : o.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var a;
    ((a = rt.get(n)) == null ? void 0 : a.token) === t.token && (t.entries.forEach(({ element: i, overflow: r }) => {
      i.style.overflow = r;
    }), rt.delete(n));
  }, e));
}
function Ce(t) {
  J.set(t.root, t), queueMicrotask(() => {
    J.get(t.root) === t && (J.delete(t.root), Pt(t));
  });
}
function Te(t) {
  J.set(t.root, t), requestAnimationFrame(() => {
    J.get(t.root) === t && (J.delete(t.root), Pt(t));
  });
}
function Re(t, e) {
  const n = J.get(t);
  if (!n) return e;
  const o = $e(e.surfaces, n.surfaces), a = ke(e.flat, n.flat), i = Ae(e.group, n.group);
  return { ...e, flat: a, group: i, surfaces: o };
}
function ke(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const o of t.elements) {
    const a = e.before.get(o);
    a && n.set(o, a);
  }
  return { ...t, before: n };
}
function Ae(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((o) => [o.element, o.rect]));
  return { before: t.before.map((o) => ({ ...o, rect: n.get(o.element) ?? o.rect })) };
}
function $e(t, e) {
  const n = new Map(e.map((o) => [o.element, o]));
  return t.map((o) => {
    const a = n.get(o.element);
    return a ? { ...o, rect: a.rect, inlineStyle: a.inlineStyle } : o;
  });
}
const J = /* @__PURE__ */ new WeakMap(), St = /* @__PURE__ */ new WeakMap(), wt = /* @__PURE__ */ new WeakMap(), nt = /* @__PURE__ */ new WeakMap();
function dt(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function Ee(t, e) {
  const n = t.filter((a) => {
    const i = (e == null ? void 0 : e.rect(a)) ?? a.getBoundingClientRect();
    return i.width > 0 && i.height > 0;
  }), o = new Set(n);
  return n.map((a) => ({
    element: a,
    parent: Pe(a, o),
    rect: dt(a, e)
  }));
}
function Pe(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function Le(t, e = ct, n = ut, o) {
  Gt(t.map((i) => i.element));
  const a = /* @__PURE__ */ new Map();
  for (const i of t) {
    const r = dt(i.element, o);
    a.set(i.element, {
      x: i.rect.left - r.left,
      y: i.rect.top - r.top
    });
  }
  for (const i of t) {
    const r = a.get(i.element), l = i.parent ? a.get(i.parent) : void 0, s = r.x - ((l == null ? void 0 : l.x) ?? 0), c = r.y - ((l == null ? void 0 : l.y) ?? 0);
    if (i.element.dataset.runtimeProxy === "true" || i.element.dataset.runtimePlaceholder === "true" || i.element.dataset.runtimeActive === "true" || Math.abs(s) < 0.5 && Math.abs(c) < 0.5) {
      i.element.dataset.runtimeGroupAnimating !== "true" && (i.element.style.transition = "");
      continue;
    }
    i.element.style.transform = `translate(${s}px, ${c}px)`, i.element.style.transition = "none";
    const u = String(Number(i.element.dataset.runtimeFlipToken ?? "0") + 1);
    i.element.dataset.runtimeFlip = "true", i.element.dataset.runtimeFlipToken = u;
    const d = nt.get(i.element);
    d !== void 0 && (cancelAnimationFrame(d), nt.delete(i.element));
    const m = requestAnimationFrame(() => {
      nt.delete(i.element), i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = `transform ${e}ms ${n}`, i.element.style.transform = "");
    });
    nt.set(i.element, m);
    const F = window.setTimeout(() => {
      i.element.dataset.runtimeFlipToken === u && (i.element.style.transition = "", i.element.style.transform = "", delete i.element.dataset.runtimeFlip, wt.delete(i.element));
    }, e + 40);
    wt.set(i.element, F);
  }
}
function Ie(t, e, n = ct, o = ut, a) {
  te(t);
  const i = a ?? t.getBoundingClientRect().height, r = String(Number(t.dataset.runtimeGroupToken ?? "0") + 1);
  t.dataset.runtimeGroupToken = r;
  const l = Math.abs(Math.max(0, e) - i), c = Math.min(Math.max(l / 8, 200), 350);
  t.dataset.runtimeGroupAnimating = "true", t.style.overflow = "hidden", t.style.height = `${i}px`, t.style.transition = `height ${c}ms ${o}`, t.offsetHeight;
  const u = { frame: null, timeout: null };
  St.set(t, u), u.frame = requestAnimationFrame(() => {
    u.frame = null, t.style.height = `${Math.max(0, e)}px`;
  }), u.timeout = window.setTimeout(() => {
    t.dataset.runtimeGroupToken === r && (e <= 0 ? (t.style.height = "0px", t.style.overflow = "hidden") : (t.style.height = "", t.style.overflow = ""), t.style.transition = "", delete t.dataset.runtimeGroupAnimating, St.delete(t));
  }, c + 40);
}
function te(t) {
  const e = St.get(t);
  e && (e.frame !== null && cancelAnimationFrame(e.frame), e.timeout !== null && window.clearTimeout(e.timeout), St.delete(t));
}
function mn(t) {
  J.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, o = rt.get(n);
  o && (o.timeout !== void 0 && window.clearTimeout(o.timeout), o.entries.forEach(({ element: i, overflow: r }) => {
    e && !t.contains(i) || (i.style.overflow = r);
  }), rt.delete(n));
  const a = [];
  t instanceof HTMLElement && a.push(t), typeof t.querySelectorAll == "function" && a.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const i of a) {
    const r = wt.get(i), l = nt.get(i), s = r !== void 0 || i.dataset.runtimeFlip === "true" || i.dataset.runtimeGroupAnimating === "true" || i.dataset.runtimeSurfaceResize === "true";
    r !== void 0 && (window.clearTimeout(r), wt.delete(i)), l !== void 0 && (cancelAnimationFrame(l), nt.delete(i)), At(i), $t(i), te(i);
    const c = _.get(i);
    c && (Lt(i, c.baseStyle), _.delete(i)), i.dataset.runtimeGroupAnimating === "true" && (i.style.height = i.dataset.layoutOpen === "false" ? "0px" : "", i.style.overflow = i.dataset.layoutOpen === "false" ? "hidden" : "", i.style.transition = ""), s && (i.style.transform = ""), i.dataset.runtimeFlip === "true" && delete i.dataset.runtimeFlip, delete i.dataset.runtimeSurfaceResize, delete i.dataset.runtimeSurfaceResizeToken, delete i.dataset.runtimeGroupAnimating;
  }
}
async function hn(t) {
  const e = (Ct.get(t.content) ?? 0) + 1;
  Ct.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll(".done-card-item")), o = (n.length > 0 ? n : Array.from(t.root.querySelectorAll("[data-card]"))).filter((l) => {
    const s = l.getBoundingClientRect();
    return s.width > 0 && s.height > 0;
  }), a = Et(o, t.root, !1), i = t.content.getBoundingClientRect().height, r = Jt ? De(t.content, t.opening, t.duration, t.easing) : null;
  t.mutate(), await t.waitForLayout(), Ct.get(t.content) === e && (t.isCurrent && !t.isCurrent() || (Ie(t.content, t.opening ? t.content.scrollHeight : 0, t.duration, t.easing, i), r && Xe(r, t.opening), Pt(a)));
}
function De(t, e, n = ct, o = ut) {
  const a = Array.from(t.querySelectorAll(".done-card-item")), i = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = i, a.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: a, token: i, duration: n };
}
function Xe(t, e) {
  const { content: n, elements: o, token: a, duration: i } = t;
  requestAnimationFrame(() => {
    n.dataset.runtimePresenceToken === a && o.forEach((r) => {
      r.animate(
        [{ opacity: e ? 0 : 1 }, { opacity: e ? 1 : 0 }],
        { duration: i, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }
      );
    });
  }), window.setTimeout(() => {
    n.dataset.runtimePresenceToken === a && o.forEach((r) => {
      r.style.opacity = "";
    });
  }, i + 40);
}
function Oe(t, e) {
  return t.map((n) => {
    var o;
    return {
      element: n,
      rect: dt(n, e),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = _.get(n)) == null ? void 0 : o.baseStyle) ?? ne(n)
    };
  });
}
function ze(t, e = ct, n = ut, o) {
  var i;
  ee(t);
  const a = t.filter((r) => r.element.isConnected).map((r) => {
    const l = dt(r.element, o), s = Qt();
    return {
      item: r,
      next: l,
      profile: s.resize,
      fromHeight: zt(r.element, r.rect.height),
      toHeight: zt(r.element, l.height)
    };
  }).filter(({ item: r, next: l }) => Math.abs(r.rect.height - l.height) >= 0.5);
  for (const { item: r, fromHeight: l } of a) {
    const s = r.element.style, c = {
      baseStyle: ((i = _.get(r.element)) == null ? void 0 : i.baseStyle) ?? r.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++Ne)
    };
    _.set(r.element, c), s.overflow = "hidden", s.transition = "none", s.height = `${l}px`, r.element.dataset.runtimeSurfaceResize = "true", r.element.dataset.runtimeSurfaceResizeToken = c.token;
  }
  requestAnimationFrame(() => {
    for (const { item: r, fromHeight: l, toHeight: s, profile: c } of a) {
      const u = r.element.style, d = _.get(r.element);
      if (!d || r.element.dataset.runtimeSurfaceResizeToken !== d.token) continue;
      const m = d.token;
      u.transition = "none", pe(r.element, l, s, c.duration, c.easing), window.setTimeout(() => {
        if (r.element.dataset.runtimeSurfaceResizeToken !== m) return;
        const F = _.get(r.element);
        !F || F.token !== m || (Lt(r.element, F.baseStyle), _.delete(r.element), delete r.element.dataset.runtimeSurfaceResize);
      }, c.duration + 40);
    }
  });
}
function ee(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0)
    for (const { element: n } of e) {
      const o = _.get(n);
      o && ($t(n), Lt(n, o.baseStyle), _.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken);
    }
}
const _ = /* @__PURE__ */ new WeakMap();
let Ne = 0;
function ne(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function Lt(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function zt(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const o = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - o);
}
function Be(t, e, n) {
  const o = t(e, n);
  return {
    ...o,
    boxShadow: n.style.boxShadow || o.boxShadow,
    transform: n.style.transform || o.transform
  };
}
function Ve(t, e, n, o, a) {
  const i = o ?? e.getBoundingClientRect(), r = (a == null ? void 0 : a.align) ?? "center", l = r === "pointer" ? n.clientX - i.left : i.width / 2, s = r === "pointer" ? n.clientY - i.top : i.height / 2, c = l - ((a == null ? void 0 : a.offsetX) ?? 0), u = s - ((a == null ? void 0 : a.offsetY) ?? 0);
  return o && (t.dragOffset = { x: c, y: u }), { rect: i, offsetX: c, offsetY: u };
}
function oe(t) {
  return (e) => e === t || e.contains(t);
}
function qe(t, e, n) {
  const o = t.cloneNode(!0), a = e().filter((i) => i !== t && i.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: Et(a, document, !0, oe(t), {
      scopeSurfaces: n == null ? void 0 : n()
    })
  };
}
function Ye(t, e, n) {
  let o = t, a = null;
  return {
    update(i, r) {
      const l = e(i);
      return l ? (n(l, a) || (o = r(l), a = l), a) : (a = null, null);
    },
    release() {
      return a;
    },
    get currentSurface() {
      return o;
    }
  };
}
function We(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function Ge(t) {
  t.event.stopPropagation(), Tt(t.proxy, !1), t.clearRegrab(), fe(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden";
}
function He(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function _e(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function je(t, e) {
  const n = e.style.transition;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", e.offsetWidth;
  const o = t(e);
  return e.style.transition = n, delete e.dataset.runtimeLandingCapture, o;
}
function Ze(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function Ue(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function Ke(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function Je(t, e) {
  return t() ?? e();
}
function Qe(t) {
  return {
    landing: () => {
      const e = t.createGate();
      return t.onGate(e), t.clearDragging(), t.scheduleLanding(), e.promise;
    },
    reveal: () => {
      t.clearRegrab(), t.finishReveal();
    }
  };
}
function tn(t, e, n) {
  let o = 0;
  return {
    capture: () => (o += 1, Et(
      e().filter((a) => a !== t && a.dataset.runtimeProxy !== "true"),
      document,
      !0,
      oe(t),
      { scopeSurfaces: n == null ? void 0 : n() }
    )),
    play: (a, i, r = !1) => {
      const l = ++o;
      if (r) {
        requestAnimationFrame(() => {
          l === o && Te(i);
        });
        return;
      }
      Ce(i);
    }
  };
}
function en(t) {
  var Q;
  const { runtime: e, objectId: n, element: o, event: a, fromRect: i, clone: r = !1 } = t, l = e.objects.get(n), s = e.surfaces.snapshot(), c = s.map((y) => y.id), u = (y) => {
    var p;
    return (p = e.objects.get(y)) == null ? void 0 : p.surfaceId;
  }, d = (l == null ? void 0 : l.surfaceId) ?? ((Q = s[0]) == null ? void 0 : Q.id), m = (y) => y.closest('[data-layout-content][data-layout-open="false"]') !== null, F = () => {
    const y = [...e.objects.values()].map((M) => M.element).filter((M) => !!(M != null && M.isConnected)), p = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...y, ...p])).filter((M) => !m(M));
  };
  let T, w, R, g = null, k = null, S = null, v = null, D = !1, f = null, E = null, h = null, A = null, C = null, L, W = { x: 0, y: 0 }, x = null, P = !1;
  const N = () => {
    const y = /* @__PURE__ */ new Set();
    return d && y.add(d), g != null && g.columnId && y.add(g.columnId), e.surfaces.snapshot().filter((p) => y.has(p.id)).map((p) => p.element).filter((p) => !!(p != null && p.isConnected));
  };
  function X() {
    var y;
    return f ? (y = e.getSession(f)) == null ? void 0 : y.state : void 0;
  }
  function q(y, p) {
    if (X() !== "active" || !R) return;
    const M = We({
      active: X() === "active",
      event: { clientX: y, clientY: p },
      state: R,
      getSurface: (O) => O.columnId
    });
    M && (g = M);
  }
  function tt(y) {
    P = !0, C == null || C.setTarget({
      x: y.clientX - W.x,
      y: y.clientY - W.y
    }), q(y.clientX, y.clientY), A == null || A.update(
      e.resolveMoveSurfaceElement(n, y.clientX, y.clientY),
      { x: y.clientX, y: y.clientY }
    );
  }
  function U(y) {
    var G, j;
    if (D) return { accepted: !1 };
    if (D = !0, L = C ? { ...C.getState() } : void 0, L) {
      const I = Bt({ x: L.vx, y: L.vy });
      L.vx = I.x, L.vy = I.y;
    }
    if (C == null || C.stop(), C = null, A == null || A.stop(), !R || !f) return { accepted: !1 };
    y && q(y.clientX, y.clientY), g = R.release(), !g && !P && L && Math.hypot(L.vx, L.vy) < 0.5 && d && (g = {
      columnId: d,
      index: x ?? Math.max(0, e.getObjectSurfaceIndex(n, d))
    });
    const p = !g;
    if (p && d && (g = {
      columnId: d,
      index: x ?? Math.max(0, e.getObjectSurfaceIndex(n, d)),
      invalidReturn: !0
    }), !g) return { accepted: !1 };
    const M = g, O = (v == null ? void 0 : v.getBoundingClientRect()) ?? ((G = e.getVisualProxy(f)) == null ? void 0 : G.element.getBoundingClientRect()) ?? ((j = Ot(o)) == null ? void 0 : j.getBoundingClientRect()) ?? o.getBoundingClientRect();
    delete o.dataset.runtimeActive, p && (h == null || h.restoreLayoutHidden(), E == null || E.release());
    const V = (I, K) => {
      if (X() !== "landing") return;
      const Y = _e({
        resolve: () => K,
        applyState: (B) => e.applyVisualState(n, B, { phase: "revealing", hovered: !1, selected: B.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!Y) {
        S == null || S.complete({ completed: !1, reason: "target-not-registered" }), S = null;
        return;
      }
      e.keepSurfaceTargetVisible(M.columnId, Y);
      const $ = je((B) => e.captureVisualState(n, B), Y), z = Ze({
        createContext: () => e.createVisualLifecycleContext(I, M, Y, T),
        source: o,
        sourceRect: O,
        visualSnapshot: w,
        targetSnapshot: $,
        motionState: L
      });
      v = Ue({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
        createProxy: () => e.getVisualProxy(I) ?? e.createVisualProxy(I, z) ?? null,
        enableProxy: (B) => Tt(B, !0),
        bindRegrab: (B) => e.bindRegrabTarget(I, n, B, et),
        land: () => e.landVisualProxy(I, Y, z),
        onMissing: () => {
          S == null || S.complete({ completed: !1, reason: "visual-proxy-missing" }), S = null;
        },
        onComplete: (B) => {
          Ke({
            active: X() === "landing",
            result: B,
            complete: (b) => S == null ? void 0 : S.complete(b),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(I, Y, z).then(() => {
              v && (e.disposeVisualProxy(I), v = null);
            })
          }), S = null;
        }
      });
    };
    return k = He(() => {
    }, () => {
      const I = f;
      e.resolveLandingTarget(I, M).then((K) => V(I, K));
    }), { accepted: !0, destination: g, ...p ? { emitAction: !1 } : {} };
  }
  function et(y) {
    if (X() !== "landing") return;
    const p = v;
    if (!p || !f) return;
    const M = Je(
      () => e.resolveVisualTarget(f, g),
      () => {
        var G;
        return ((G = e.objects.get(n)) == null ? void 0 : G.element) ?? null;
      }
    );
    if (!M) return;
    const O = e.createRegrabContext(f, y, p, M);
    if (!O) return;
    Ge({
      event: O.event,
      sessionId: f,
      proxy: p,
      source: M,
      interrupt: () => e.takeoverRegrab(f),
      clearRegrab: () => e.clearRegrab(n)
    });
    const V = M.getBoundingClientRect();
    e.startObjectPointer(n, M, y, O.regrabRect, V);
  }
  const ft = {
    prepare(y) {
      var Y;
      if (f = y.session.id, P = !1, A = e.createAutoScroller(f, {
        onScroll: ($) => q($.x, $.y)
      }), y.session.state !== "prepare") return;
      e.objects.setElement(n, o), o.style.visibility = "", o.style.pointerEvents = "", E = e.acquireObject(f, n), e.takeSurfaces(f, c);
      const { beforePickup: p } = qe(o, F, N);
      x = e.getObjectSurfaceIndex(n, d), T = o.cloneNode(!0);
      const M = e.getMoveContext(f), O = Ve(M, o, a, i, e.getObjectGrabAlign(n)), V = O.rect;
      W = { x: O.offsetX, y: O.offsetY }, document.body.classList.add("kb-dragging"), e.applyVisualState(n, o, {
        phase: "dragging",
        hovered: o.matches(":hover"),
        selected: o.classList.contains("is-selected"),
        grabbed: !0
      }), w = Be(($, z) => e.captureVisualState(n, z), n, o), h = ye(o, f), ue(o, V);
      const G = de(o);
      G && e.registerVisualProxy(f, { element: G }), o.style.pointerEvents = "none", r || h.detachFromLayout(), o.style.transition = "none", e.scheduleLayout(p), o.dataset.runtimeActive = "true";
      const j = ((Y = e.getVisualProxy(f)) == null ? void 0 : Y.element) ?? Ot(o);
      if (!j) return;
      const I = V.left, K = V.top;
      C = Vt({
        mode: "follow",
        followRotation: Dt,
        onFrame: ($) => {
          if (!j.isConnected) return;
          const z = $.x - I, B = $.y - K;
          j.style.transform = `translate3d(${z.toFixed(2)}px, ${B.toFixed(2)}px, 0) perspective(760px) rotateX(${$.rotateX.toFixed(2)}deg) rotateZ(${$.rotateZ.toFixed(2)}deg) scale(${$.scaleX.toFixed(4)}, ${$.scaleY.toFixed(4)})`;
        }
      }), C.setProfile(re), C.seed({ x: V.left, y: V.top, scaleX: 1.03, scaleY: 1.03, rotateX: Dt.tilt, rotateZ: 0 }), C.setTarget({ x: a.clientX - W.x, y: a.clientY - W.y }), C.start(), R = Ye(
        u(n),
        ($) => e.resolveMoveHit(n, $.clientX, $.clientY),
        ($, z) => $.columnId === (z == null ? void 0 : z.columnId) && $.index === (z == null ? void 0 : z.index)
      ), q(a.clientX, a.clientY);
    },
    update(y, p) {
      p.event instanceof PointerEvent && tt(p.event);
    },
    resolveDestination(y, p) {
      return U(p.event instanceof PointerEvent ? p.event : void 0);
    },
    commit: (y, p) => {
      e.getVisualProxy(f) || pt(o);
      const M = typeof p == "object" && p !== null && p.invalidReturn === !0, O = typeof p == "object" && p !== null ? p.toSurfaceId ?? p.columnId : void 0;
      M || !M && typeof O == "string" && O === d ? h == null || h.restoreLayoutHidden() : h == null || h.detachFromLayout(), document.body.classList.remove("kb-dragging");
    },
    cancel(y, p) {
      D = !0, C == null || C.stop(), C = null, e.getVisualProxy(f) ? e.disposeVisualProxy(f) : v ? (e.disposeVisualProxy(f), v = null) : pt(o), e.clearRegrab(n), document.body.classList.remove("kb-dragging"), delete o.dataset.runtimeActive, pt(o), h == null || h.restore(), h = null;
    }
  }, yt = {
    layout: tn(o, F, N),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => E == null ? void 0 : E.release()
    },
    ...Qe({
      createGate: () => e.createCompletionGate(f, { completed: !1, reason: "landing-cancelled" }),
      onGate: (y) => {
        S = y;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        k == null || k(), k = null;
      },
      clearRegrab: () => e.clearRegrab(n),
      finishReveal: () => {
        v && Tt(v, !1), pt(o), h == null || h.restore(), h = null;
      }
    })
  };
  return { driver: ft, lifecycle: yt };
}
function xn(t) {
  return en({ ...t, clone: !0 });
}
export {
  on as A,
  Vt as B,
  It as C,
  Nt as D,
  Se as E,
  re as F,
  Pt as G,
  Bt as H,
  Ie as I,
  ht as L,
  rn as a,
  fn as b,
  ce as c,
  ln as d,
  ot as e,
  cn as f,
  Rt as g,
  xn as h,
  en as i,
  dn as j,
  Yt as k,
  sn as l,
  an as m,
  nn as n,
  Dt as o,
  un as p,
  pn as q,
  yn as r,
  gn as s,
  Et as t,
  Te as u,
  Ce as v,
  hn as w,
  mn as x,
  ye as y,
  ve as z
};
