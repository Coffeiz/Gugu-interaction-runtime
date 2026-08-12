const bt = {
  flip: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  resize: { duration: 250, easing: "cubic-bezier(.22,1,.36,1)" },
  landing: { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" },
  freeLanding: {
    duration: 550,
    easing: "cubic-bezier(.22,1,.36,1)"
  }
}, ce = {
  velocityScale: 1,
  minVelocity: 30,
  maxVelocity: 5e3,
  dampingRatio: 0.78,
  // landing 使用目标中心的连续弹簧；不再先做独立直线 coast，避免轨迹中途折向。
  maxCoast: 0,
  coastSeconds: 0.12
}, Wn = 8;
function ue(t, e = ce) {
  if (Math.hypot(t.x, t.y) < e.minVelocity) return { x: 0, y: 0 };
  const i = t.x * e.velocityScale, o = t.y * e.velocityScale, a = Math.hypot(i, o);
  if (a <= e.maxVelocity || a === 0) return { x: i, y: o };
  const r = e.maxVelocity / a;
  return { x: i * r, y: o * r };
}
function qn(t, e = ce) {
  const n = ue(t, e), i = Math.hypot(n.x, n.y) * e.coastSeconds;
  if (i <= 0 || e.maxCoast <= 0) return { x: 0, y: 0 };
  const o = Math.min(1, e.maxCoast / i);
  return { x: n.x * e.coastSeconds * o, y: n.y * e.coastSeconds * o };
}
function ne(t, e, n, i, o, a = 1 / 120) {
  let r = Math.max(0, o);
  for (; r > 1e-4; ) {
    const s = Math.min(r, a);
    r -= s;
    const l = n * (e.x - t.position.x) - i * t.velocity.x, d = n * (e.y - t.position.y) - i * t.velocity.y;
    t.velocity.x += l * s, t.velocity.y += d * s, t.position.x += t.velocity.x * s, t.position.y += t.velocity.y * s;
  }
}
const Yt = {
  position: { stiffness: 420, damping: 41 },
  scale: { stiffness: 420, damping: 41 }
}, Le = {
  position: { stiffness: 360, damping: 2 * 0.85 * Math.sqrt(360) },
  scale: { stiffness: 420, damping: 30 }
}, ie = {
  tilt: 5,
  sway: 0.25,
  smoothing: 0.2
}, Mt = {
  position: 0.35,
  velocity: 5,
  scalePosition: 1e-3,
  scaleVelocity: 0.01
};
function de(t) {
  const e = t.mode ?? "settle";
  if (e === "follow" && !t.followRotation)
    throw new Error('CardMotionController: mode "follow" 需要提供 followRotation 参数');
  const n = t.arriveThreshold ?? Mt, i = {
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
  let o = { x: 0, y: 0 }, a = Yt, r = null, s = null, l = !1, d = 0, c = 0, u = "settle", f = 0;
  function x() {
    t.onFrame({
      x: i.x,
      y: i.y,
      scaleX: i.scaleX,
      scaleY: i.scaleY,
      rotateX: i.rotateX,
      rotateZ: i.rotateZ
    });
  }
  function L(g) {
    var N;
    if (!l) return;
    const C = Math.min(0.032, Math.max(0, (g - (s ?? g)) / 1e3));
    if (s = g, u === "coast") {
      const T = Math.exp(-A.friction * C);
      i.vx *= T, i.vy *= T;
      const p = i.vx * C, R = i.vy * C, k = f + Math.hypot(p, R);
      if (k >= A.maxDistance) {
        const z = Math.max(0, A.maxDistance - f), I = Math.hypot(p, R), E = I > 0 ? z / I : 0;
        i.x += p * E, i.y += R * E, i.vx = 0, i.vy = 0, u = "settle";
      } else
        i.x += p, i.y += R, f = k, ((g - (S ?? g)) / 1e3 >= A.duration || Math.hypot(i.vx, i.vy) <= A.minVelocity) && (u = "settle");
    }
    if (u === "settle") {
      const T = { position: { x: i.x, y: i.y }, velocity: { x: i.vx, y: i.vy } };
      ne(T, { x: o.x, y: o.y }, a.position.stiffness, a.position.damping, C), i.x = T.position.x, i.y = T.position.y, i.vx = T.velocity.x, i.vy = T.velocity.y;
    }
    const M = { position: { x: i.scaleX, y: i.scaleY }, velocity: { x: i.scaleVX, y: i.scaleVY } };
    if (ne(M, { x: o.scaleX ?? i.scaleX, y: o.scaleY ?? i.scaleY }, a.scale.stiffness, a.scale.damping, C), i.scaleX = M.position.x, i.scaleY = M.position.y, i.scaleVX = M.velocity.x, i.scaleVY = M.velocity.y, e === "follow") {
      const T = t.followRotation, p = -Math.log(1 - (T.smoothing ?? 0.2)) * 60, R = 1 - Math.exp(-p * C);
      d += (i.vx - d) * R, c += (i.vy - c) * R, i.rotateZ = Math.max(-(T.maxSway ?? 5), Math.min(T.maxSway ?? 5, d / 60 * T.sway));
      const k = Math.max(-(T.maxTiltDelta ?? 4), Math.min(T.maxTiltDelta ?? 4, c / 60 * (T.verticalTiltFactor ?? 0.16)));
      i.rotateX = T.tilt + k;
    } else {
      const T = Math.exp(-10 * C);
      i.rotateX *= T, i.rotateZ *= T;
    }
    if (x(), e === "follow") {
      r = requestAnimationFrame(L);
      return;
    }
    if (u === "settle" && Math.abs(o.x - i.x) < n.position && Math.abs(o.y - i.y) < n.position && Math.abs(i.vx) < n.velocity && Math.abs(i.vy) < n.velocity && Math.abs((o.scaleX ?? i.scaleX) - i.scaleX) < (n.scalePosition ?? Mt.scalePosition) && Math.abs((o.scaleY ?? i.scaleY) - i.scaleY) < (n.scalePosition ?? Mt.scalePosition) && Math.abs(i.scaleVX) < (n.scaleVelocity ?? Mt.scaleVelocity) && Math.abs(i.scaleVY) < (n.scaleVelocity ?? Mt.scaleVelocity)) {
      l = !1, r = null, (N = t.onArrived) == null || N.call(t);
      return;
    }
    r = requestAnimationFrame(L);
  }
  let A = null, S = null;
  return {
    seed(g) {
      Object.assign(i, g);
    },
    setTarget(g) {
      o = { ...g };
    },
    retarget(g) {
      o = { ...g };
    },
    setProfile(g) {
      a = g;
    },
    getState() {
      return i;
    },
    start() {
      l || (l = !0, u = "settle", A = null, S = null, s = null, x(), r = requestAnimationFrame(L));
    },
    startCoastThenSettle(g) {
      if (l) return;
      l = !0, u = "coast", A = g, f = 0, S = null;
      const C = Math.hypot(i.vx, i.vy), M = g.maxDistance / Math.max(g.duration, 1 / 60);
      if (C > M && C > 0) {
        const h = M / C;
        i.vx *= h, i.vy *= h;
      }
      s = null, x(), r = requestAnimationFrame((h) => {
        S = h, L(h);
      });
    },
    interrupt() {
      return l = !1, r !== null && cancelAnimationFrame(r), r = null, { ...i };
    },
    cancel() {
      return l = !1, r !== null && cancelAnimationFrame(r), r = null, { ...i };
    },
    stop() {
      l = !1, r !== null && cancelAnimationFrame(r), r = null;
    }
  };
}
function $t(t, e, n, i) {
  const o = 3 * t - 3 * n + 1, a = 3 * n - 6 * t, r = 3 * t, s = 3 * e - 3 * i + 1, l = 3 * i - 6 * e, d = 3 * e, c = (x) => ((o * x + a) * x + r) * x, u = (x) => ((s * x + l) * x + d) * x, f = (x) => (3 * o * x + 2 * a) * x + r;
  return (x) => {
    let L = x;
    for (let A = 0; A < 8; A += 1) {
      const S = c(L) - x;
      if (Math.abs(S) < 1e-4) break;
      const g = f(L);
      if (Math.abs(g) < 1e-6) break;
      L -= S / g;
    }
    return u(Math.max(0, Math.min(1, L)));
  };
}
function Ie(t) {
  const e = t.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
  return e ? $t(...e.slice(1).map(Number)) : t === "linear" ? (n) => n : t === "ease-in" ? $t(0.42, 0, 1, 1) : t === "ease-out" ? $t(0, 0, 0.58, 1) : t === "ease-in-out" ? $t(0.42, 0, 0.58, 1) : $t(0.22, 1, 0.36, 1);
}
function Xe(t) {
  const e = {
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
  let n = { x: 0, y: 0 }, i = { ...e }, o = 0, a = null, r = !1;
  const s = Ie(t.easing), l = (c) => {
    const u = s(Math.max(0, Math.min(1, c)));
    e.x = i.x + (n.x - i.x) * u, e.y = i.y + (n.y - i.y) * u, e.scaleX = i.scaleX + ((n.scaleX ?? i.scaleX) - i.scaleX) * u, e.scaleY = i.scaleY + ((n.scaleY ?? i.scaleY) - i.scaleY) * u, e.rotateX = i.rotateX * (1 - u), e.rotateZ = i.rotateZ * (1 - u), t.onFrame({
      x: e.x,
      y: e.y,
      scaleX: e.scaleX,
      scaleY: e.scaleY,
      rotateX: e.rotateX,
      rotateZ: e.rotateZ
    });
  }, d = (c) => {
    var f;
    if (!r) return;
    const u = t.duration <= 0 ? 1 : (c - o) / t.duration;
    if (l(u), u >= 1) {
      r = !1, a = null, (f = t.onArrived) == null || f.call(t);
      return;
    }
    a = requestAnimationFrame(d);
  };
  return {
    seed(c) {
      Object.assign(e, c);
    },
    setTarget(c) {
      n = { ...c };
    },
    retarget(c) {
      if (!r) {
        n = { ...c };
        return;
      }
      i = { ...e }, n = { ...c }, o = performance.now();
    },
    start() {
      r || (r = !0, i = { ...e }, o = performance.now(), l(0), a = requestAnimationFrame(d));
    },
    stop() {
      r = !1, a !== null && cancelAnimationFrame(a), a = null;
    }
  };
}
const fe = [
  "font-family",
  "font-kerning",
  "font-feature-settings",
  "font-variation-settings",
  "font-optical-sizing",
  "font-stretch",
  "letter-spacing",
  "text-rendering",
  "-webkit-font-smoothing",
  "-moz-osx-font-smoothing"
];
function Oe(t) {
  const e = getComputedStyle(t);
  return Object.fromEntries(
    fe.map((n) => [n, e.getPropertyValue(n)])
  );
}
function Be(t, e) {
  for (const n of fe) {
    const i = e[n];
    i && t.style.setProperty(n, i);
  }
}
function Ve(t, e) {
  Be(e, Oe(t));
}
function Ye(t) {
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
function ze(t, e) {
  t.style.fontFamily = e.fontFamily, t.style.color = e.color, t.style.fontSize = e.fontSize, t.style.fontWeight = e.fontWeight, t.style.lineHeight = e.lineHeight, t.style.letterSpacing = e.letterSpacing, t.style.textAlign = e.textAlign, t.style.direction = e.direction, t.style.wordSpacing = e.wordSpacing, t.style.whiteSpace = e.whiteSpace, t.style.textIndent = e.textIndent;
}
function Ut(t, e) {
  t.style.pointerEvents = e ? "auto" : "none";
}
function gt(t, e) {
  t.style.setProperty("box-shadow", e, "important");
}
function Ne(t, e = t.getBoundingClientRect(), n = {}) {
  var d;
  const i = (d = n.layout) == null ? void 0 : d.compact, o = document.createElement("div"), a = document.createElement("div"), r = t.cloneNode(!0);
  a.dataset.runtimeProxyScaleShell = "true", r.dataset.runtimeProxyContent = "true", Object.assign(a.style, {
    position: "absolute",
    left: "0",
    top: "0",
    transformOrigin: "0 0",
    pointerEvents: "none"
  }), Object.assign(r.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    margin: "0",
    pointerEvents: "none"
  }), r.dataset.runtimePhase = "grab-start", a.appendChild(r), o.appendChild(a), o.className = "", o.style.position = "fixed", o.style.left = `${e.left}px`, o.style.top = `${e.top}px`, o.style.boxSizing = "border-box", o.style.width = `${e.width}px`, o.style.height = `${e.height}px`, je(o, n.contentScale), o.style.margin = "0", o.style.zIndex = "2147483647", o.style.pointerEvents = "none", o.style.visibility = "visible", o.style.willChange = "transform", o.style.display = "", o.dataset.runtimeProxy = "true", o.style.transformOrigin = "50% 50%", o.style.transform = "scale(1)", Wt && n.glass !== !1 ? he(r) : gt(r, "0 12px 24px rgba(0,0,0,.18)"), i && (r.dataset.runtimeCompact = "true");
  const s = (i == null ? void 0 : i.duration) ?? 200, l = (i == null ? void 0 : i.easing) ?? "cubic-bezier(.22,1,.36,1)";
  return r.style.transition = `left ${s}ms ${l}, width ${s}ms ${l}, transform ${s}ms ${l}, grid-template-columns ${s}ms ${l}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, o.style.transition = "transform .15s ease", document.documentElement.appendChild(o), requestAnimationFrame(() => {
    o.isConnected && r.dataset.runtimePhase === "grab-start" && (r.dataset.runtimePhase = "grabbing", i && (r.style.left = i.left ?? "50%", r.style.width = i.width, r.style.transform = i.transform ?? "translateX(-50%)", i.gridTemplateColumns && (r.style.gridTemplateColumns = i.gridTemplateColumns)));
  }), jt.add(o), o;
}
function Rt(t) {
  const e = typeof t == "function" ? t() : t;
  return typeof e == "number" && Number.isFinite(e) && e > 0 ? e : 1;
}
function je(t, e) {
  const n = Rt(e), i = parseFloat(t.style.width) || t.getBoundingClientRect().width, o = parseFloat(t.style.height) || t.getBoundingClientRect().height, a = Number(t.dataset.runtimeProxyBaseWidth) || i / n, r = Number(t.dataset.runtimeProxyBaseHeight) || o / n;
  t.dataset.runtimeProxyBaseWidth = String(a), t.dataset.runtimeProxyBaseHeight = String(r);
  const s = t.querySelector("[data-runtime-proxy-scale-shell]");
  if (!s) return;
  s.style.width = `${a}px`, s.style.height = `${r}px`;
  const l = parseFloat(t.style.width) || i, d = parseFloat(t.style.height) || o;
  s.style.left = `${(l - a * n) / 2}px`, s.style.top = `${(d - r * n) / 2}px`, s.style.transform = `scale(${n})`;
}
function De(t, e) {
  const n = Rt(e), i = parseFloat(t.style.width) || t.getBoundingClientRect().width, o = parseFloat(t.style.height) || t.getBoundingClientRect().height, a = t.querySelector("[data-runtime-proxy-scale-shell]");
  a && (a.style.left = "0px", a.style.top = "0px", a.style.width = `${i / n}px`, a.style.height = `${o / n}px`, a.style.transform = `scale(${n})`);
}
function He(t, e) {
  const n = t.querySelector("[data-runtime-proxy-scale-shell]");
  if (!n) return null;
  const i = parseFloat(t.style.width) || t.getBoundingClientRect().width, o = parseFloat(t.style.height) || t.getBoundingClientRect().height, a = e > 0 ? e : 1, r = Number(t.dataset.runtimeProxyBaseWidth) || i / a, s = Number(t.dataset.runtimeProxyBaseHeight) || o / a;
  return n.style.width = `${r}px`, n.style.height = `${s}px`, n.style.left = `${(i - r * a) / 2}px`, n.style.top = `${(o - s * a) / 2}px`, n.style.transform = `scale(${a})`, { shell: n, baseWidth: r, baseHeight: s };
}
function We(t, e, n, i) {
  const o = t.baseWidth * i, a = t.baseHeight * i;
  t.shell.style.left = `${(e - o) / 2}px`, t.shell.style.top = `${(n - a) / 2}px`, t.shell.style.transform = `scale(${i})`;
}
function Gn(t) {
  return t;
}
function St(t) {
  return t.querySelector(
    "[data-runtime-proxy-content]:not([data-runtime-group-modifier])"
  ) ?? t;
}
function oe(t) {
  const e = [];
  let n = 0, i = 0;
  for (let a = 0; a < t.length; a += 1) {
    const r = t[a];
    r === "(" ? i += 1 : r === ")" ? i = Math.max(0, i - 1) : r === "," && i === 0 && (e.push(t.slice(n, a).trim()), n = a + 1);
  }
  const o = t.slice(n).trim();
  return o && e.push(o), e;
}
function qe(t, e) {
  const n = oe(t), i = oe(e);
  if (n.length >= i.length || n.length === 0) return t;
  const o = /* @__PURE__ */ new Map();
  o.set("inset", n.filter((s) => /\binset\b/i.test(s))), o.set("outer", n.filter((s) => !/\binset\b/i.test(s)));
  const a = (s) => /\binset\b/i.test(s) ? "inset 0 0 0 0 rgba(0, 0, 0, 0)" : "0 0 0 0 rgba(0, 0, 0, 0)", r = /* @__PURE__ */ new Map([["inset", 0], ["outer", 0]]);
  return i.map((s) => {
    const l = /\binset\b/i.test(s) ? "inset" : "outer", d = o.get(l) ?? [], c = r.get(l) ?? 0;
    return c < d.length ? (r.set(l, c + 1), d[c]) : a(s);
  }).join(", ");
}
function ye(t, e, n) {
  if (e == null) {
    t.style.transition = n;
    return;
  }
  const i = t.style.boxShadow || getComputedStyle(t).boxShadow;
  t.style.transition = "none", gt(t, qe(i, e)), t.offsetWidth, t.style.transition = n;
}
function Ot(t) {
  return `${t.tagName}:${(t.textContent ?? "").trim()}`;
}
function ae(t) {
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
      const i = document.createElement("span");
      i.textContent = n.textContent, n.replaceWith(i), e.push(i);
      continue;
    }
    n.nodeType === Node.ELEMENT_NODE && e.push(n);
  }
  return e;
}
function ge(t, e) {
  const n = getComputedStyle(e), i = parseFloat(n.paddingTop) || 0, o = parseFloat(n.paddingRight) || 0, a = parseFloat(n.paddingBottom) || 0, s = {
    position: "absolute",
    left: `${parseFloat(n.paddingLeft) || 0}px`,
    top: `${i}px`,
    right: `${o}px`,
    bottom: `${a}px`,
    pointerEvents: "none"
  }, l = document.createElement("div");
  Object.assign(l.style, { ...s });
  const d = getComputedStyle(t);
  for (l.style.display = d.display, l.style.flexDirection = d.flexDirection, l.style.flexWrap = d.flexWrap, l.style.alignItems = d.alignItems, l.style.justifyContent = d.justifyContent, l.style.gap = d.gap; t.firstChild; ) l.appendChild(t.firstChild);
  const c = ae(l), u = new Set(c.map(Ot)), f = document.createElement("div");
  Object.assign(f.style, { ...s, pointerEvents: "" }), f.style.display = n.display, f.style.gridTemplateColumns = n.gridTemplateColumns, f.style.gridTemplateRows = n.gridTemplateRows, f.style.gridAutoColumns = n.gridAutoColumns, f.style.gridAutoRows = n.gridAutoRows, f.style.gridAutoFlow = n.gridAutoFlow, f.style.justifyItems = n.justifyItems, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.alignContent = n.alignContent, f.style.columnGap = n.columnGap, f.style.rowGap = n.rowGap, f.style.flexDirection = n.flexDirection, f.style.flexWrap = n.flexWrap, f.style.alignItems = n.alignItems, f.style.justifyContent = n.justifyContent, f.style.gap = n.gap, f.style.overflow = "hidden";
  const x = e.cloneNode(!0);
  for (x.style.visibility = "visible", x.style.display = ""; x.firstChild; ) f.appendChild(x.firstChild);
  const L = Ye(e);
  ze(f, L);
  const A = ae(f), S = new Set(A.map(Ot)), g = A.filter((h) => !u.has(Ot(h)));
  for (const h of g) h.style.opacity = "0";
  const C = c.filter((h) => !S.has(Ot(h))), M = new Set(C);
  for (const h of c)
    M.has(h) || (h.style.opacity = "0");
  return t.appendChild(f), C.length > 0 && t.appendChild(l), { enteringEls: g, leavingEls: C };
}
function _n(t, e) {
  const n = Math.max(e.left, e.right - t.width), i = Math.max(e.top, e.bottom - t.height);
  return {
    left: Math.min(Math.max(t.left, e.left), n),
    top: Math.min(Math.max(t.top, e.top), i),
    width: t.width,
    height: t.height
  };
}
function Zn(t, e, n = {}) {
  const i = n.duration ?? bt.landing.duration, o = n.easing ?? "cubic-bezier(.22,1,.36,1)", a = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, d = n.targetBackground, c = n.targetOpacity, u = St(t), f = n.targetContent ? ge(u, n.targetContent) : null;
  if (f) {
    for (const F of f.enteringEls) F.style.transition = `opacity ${i}ms ${o}`;
    for (const F of f.leavingEls) F.style.transition = `opacity ${i}ms ${o}`;
  }
  const x = parseFloat(t.style.left) || 0, L = parseFloat(t.style.top) || 0;
  let A = !1, S = e;
  const g = performance.now();
  let C = () => {
  }, M = () => {
  };
  const h = new Promise((F) => {
    M = F;
  }), N = () => {
    const F = t.getBoundingClientRect();
    return Math.abs(F.left - S.left) < 2 && Math.abs(F.top - S.top) < 2 && Math.abs(F.width - S.width) < 2 && Math.abs(F.height - S.height) < 2;
  };
  let T = null, p = null, R = 0;
  const k = 60, z = (F) => {
    A || (A = !0, t.removeEventListener("transitionend", C), p !== null && (window.clearTimeout(p), p = null), M());
  }, I = () => {
    if (!A) {
      if (N()) {
        z();
        return;
      }
      if (performance.now() - g >= i + 500) {
        z();
        return;
      }
      window.requestAnimationFrame(I);
    }
  }, E = (F, O = i) => {
    S = F;
    const X = t.getBoundingClientRect();
    t.style.transition = "none", t.style.width = `${X.width.toFixed(2)}px`, t.style.height = `${X.height.toFixed(2)}px`, t.style.transform = `translate3d(${(X.left - x).toFixed(2)}px, ${(X.top - L).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
    const K = `translate3d(${(F.left - x).toFixed(2)}px, ${(F.top - L).toFixed(2)}px, 0)`;
    t.style.transition = `transform ${O}ms ${o}, width ${O}ms ${o}, height ${O}ms ${o}`;
    const ot = [
      `box-shadow ${O}ms ease`,
      `border-radius ${O}ms ease`,
      `border-color ${O}ms ease`,
      `backdrop-filter ${O}ms ease`,
      `-webkit-backdrop-filter ${O}ms ease`,
      `background-color ${O}ms ease`,
      `background-image ${O}ms ease`,
      `opacity ${O}ms ease`
    ].join(", ");
    ye(u, a, ot), requestAnimationFrame(() => {
      if (t.style.transform = K, t.style.width = `${F.width.toFixed(2)}px`, t.style.height = `${F.height.toFixed(2)}px`, a != null && gt(u, a), r != null && (u.style.borderRadius = r), s != null && (u.style.border = s), l != null && (u.style.backdropFilter = l, u.style.setProperty("-webkit-backdrop-filter", l)), d != null && (u.style.backgroundColor = d, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), c != null && (u.style.opacity = c), f) {
        for (const Z of f.enteringEls) Z.style.opacity = "1";
        for (const Z of f.leavingEls) Z.style.opacity = "0";
      }
    });
  };
  C = (F) => {
    F.target !== t || !(F.propertyName === "transform" || F.propertyName === "width" || F.propertyName === "height") || N() && z(`transitionend:${F.propertyName}`);
  }, t.addEventListener("transitionend", C), E(e), window.setTimeout(I, i + 40);
  const W = (F) => {
    var X;
    R = performance.now();
    const O = Math.max(80, i - (R - g));
    E(((X = n.readTarget) == null ? void 0 : X.call(n)) ?? F, O);
  };
  return { finished: h, retarget: (F) => {
    if (A) return;
    const O = Math.abs(F.left - S.left), X = Math.abs(F.top - S.top), K = Math.abs(F.width - S.width), ot = Math.abs(F.height - S.height);
    if (O < 0.5 && X < 0.5 && K < 0.5 && ot < 0.5) return;
    const Z = performance.now() - R;
    if (Z >= k) {
      W(F);
      return;
    }
    T = F, p === null && (p = window.setTimeout(() => {
      if (p = null, A || !T) return;
      const mt = T;
      T = null, W(mt);
    }, k - Z));
  } };
}
function Un(t, e, n = {}) {
  var B, $, et, rt, Y, J, pt, lt, ct, j, P, D, Q, yt;
  const i = n.duration ?? bt.landing.duration, o = n.easing ?? "cubic-bezier(.22,1,.36,1)", a = n.targetShadow, r = n.targetRadius, s = n.targetBorder, l = n.targetBackdropFilter, d = n.targetBackground, c = n.targetOpacity, u = St(t), f = t.querySelector("[data-runtime-proxy-scale-shell]"), x = n.targetContent ? ge(u, n.targetContent) : null;
  if (x) {
    for (const w of x.enteringEls) w.style.transition = `opacity ${i}ms ${o}`;
    for (const w of x.leavingEls) w.style.transition = `opacity ${i}ms ${o}`;
  }
  n.motionState && (t.style.left = `${n.motionState.x}px`, t.style.top = `${n.motionState.y}px`);
  const L = parseFloat(t.style.left) || t.getBoundingClientRect().left, A = parseFloat(t.style.top) || t.getBoundingClientRect().top, S = t.getBoundingClientRect(), g = parseFloat(t.style.width) || S.width || e.width, C = parseFloat(t.style.height) || S.height || e.height, M = Rt(n.contentScale), h = He(t, M);
  let N = h && n.landingContentScale !== void 0 ? Rt(n.landingContentScale) : 0;
  const T = (B = n.cameraOrigin) == null ? void 0 : B.call(n), p = !!(n.landingMode === "free" && T && Number.isFinite(T.left) && Number.isFinite(T.top));
  let R = null, k = null;
  if (p && T) {
    R = document.createElement("div"), R.dataset.runtimeCameraGlue = "true", Object.assign(R.style, {
      position: "fixed",
      left: "0",
      top: "0",
      right: "0",
      bottom: "0",
      transition: "none",
      transform: "translate3d(0, 0, 0)",
      transformOrigin: `${T.left}px ${T.top}px`,
      pointerEvents: "none",
      zIndex: t.style.zIndex,
      willChange: "transform"
    });
    const w = t.parentElement;
    w == null || w.appendChild(R), R.appendChild(t);
    const G = () => {
      var nt;
      if (!(R != null && R.isConnected)) return;
      const H = (nt = n.cameraOrigin) == null ? void 0 : nt.call(n);
      if (H && Number.isFinite(H.left) && Number.isFinite(H.top)) {
        const Tt = Rt(n.contentScale), Gt = M > 0.01 ? Tt / M : 1;
        R.style.transform = `translate3d(${(H.left - T.left).toFixed(2)}px, ${(H.top - T.top).toFixed(2)}px, 0) scale(${Gt.toFixed(4)})`;
      }
      k = window.requestAnimationFrame(G);
    };
    k = window.requestAnimationFrame(G);
  }
  const z = (w) => ({
    left: w.left - (g - w.width) / 2,
    top: w.top - (C - w.height) / 2,
    width: w.width,
    height: w.height
  });
  let I = e, E = !1;
  const W = n.landingMode === "target" && !!f, st = W ? (($ = n.dismiss) == null ? void 0 : $.duration) ?? i : 0;
  let F = !1, O = !W, X = null, K = null, ot = 0, Z = () => {
  };
  const mt = new Promise((w) => {
    Z = w;
  }), dt = () => {
    E || (E = !0, U.stop(), X !== null && window.clearTimeout(X), K !== null && window.clearTimeout(K), X = null, K = null, k !== null && window.cancelAnimationFrame(k), k = null, R == null || R.remove(), R = null, Z());
  }, ft = () => {
    F && O && dt();
  }, Ct = () => {
    E || (F = !0, ft());
  }, It = (w) => {
    const G = w.x, H = w.y;
    if (t.style.transform = `perspective(760px) translate3d(${(G - L).toFixed(2)}px, ${(H - A).toFixed(2)}px, 0) rotateX(${w.rotateX.toFixed(2)}deg) rotateZ(${w.rotateZ.toFixed(2)}deg)`, n.landingMode === "free" && h)
      We(
        h,
        g,
        C,
        w.scaleX * M
      );
    else {
      const nt = g * w.scaleX, Tt = C * w.scaleY, Gt = w.x + (g - nt) / 2, Ae = w.y + (C - Tt) / 2;
      t.style.width = `${nt.toFixed(2)}px`, t.style.height = `${Tt.toFixed(2)}px`, t.style.transform = `perspective(760px) translate3d(${(Gt - L).toFixed(2)}px, ${(Ae - A).toFixed(2)}px, 0) rotateX(${w.rotateX.toFixed(2)}deg) rotateZ(${w.rotateZ.toFixed(2)}deg)`, n.landingMode === "target" && W || (h && N > 0 ? (h.shell.style.left = `${((nt - h.baseWidth) / 2).toFixed(2)}px`, h.shell.style.top = `${((Tt - h.baseHeight) / 2).toFixed(2)}px`, h.shell.style.transform = `scale(${N})`) : h && De(t, () => w.scaleX * M));
    }
  }, U = n.landingMode === "free" ? Xe({
    duration: i,
    easing: o,
    onFrame: It,
    onArrived: Ct
  }) : de({
    mode: "settle",
    onFrame: It,
    onArrived: Ct
  }), Xt = Math.hypot(((et = n.motionState) == null ? void 0 : et.vx) ?? 0, ((rt = n.motionState) == null ? void 0 : rt.vy) ?? 0), qt = n.releaseDamping ?? 0.78, ht = n.targetMotion ? {
    position: { ...Yt.position, ...n.targetMotion.position },
    scale: { ...Yt.scale, ...n.targetMotion.scale }
  } : Yt;
  n.landingMode !== "free" && U.setProfile(Xt > 30 ? {
    ...ht,
    position: {
      ...ht.position,
      damping: ht.position.damping * qt
    }
  } : ht), U.seed({
    // grabbing 是弹簧跟手，松手指针位置和卡片最后视觉位置可能不同。
    // 有 MotionState 时必须从 controller 的最后一帧开始，sourceRect 只作为旧流程兜底。
    x: ((Y = n.motionState) == null ? void 0 : Y.x) ?? S.left,
    y: ((J = n.motionState) == null ? void 0 : J.y) ?? S.top,
    vx: ((pt = n.motionState) == null ? void 0 : pt.vx) ?? 0,
    vy: ((lt = n.motionState) == null ? void 0 : lt.vy) ?? 0,
    // 即使 pointerdown 后没有产生位移，抓取态仍有 scale(1.03)。
    // 不能在 landing 起点把它重置为 1，否则目标位置相同的回放会被
    // MotionController 判定为已到达，代理瞬间消失。
    scaleX: ((ct = n.motionState) == null ? void 0 : ct.scaleX) ?? 1,
    scaleY: ((j = n.motionState) == null ? void 0 : j.scaleY) ?? 1,
    rotateX: ((P = n.motionState) == null ? void 0 : P.rotateX) ?? 0,
    rotateZ: ((D = n.motionState) == null ? void 0 : D.rotateZ) ?? 0
  });
  const tt = z(e), y = (h == null ? void 0 : h.baseWidth) ?? g, m = (h == null ? void 0 : h.baseHeight) ?? C;
  h && n.landingMode !== "free" && n.landingMode !== "target" && (N > 0 || (N = y > 0 ? tt.width / y : 1), h.shell.style.transformOrigin = "50% 50%", h.shell.style.left = `${((g - y) / 2).toFixed(2)}px`, h.shell.style.top = `${((C - m) / 2).toFixed(2)}px`, h.shell.style.transform = `scale(${M})`, h.shell.style.transition = `transform ${i}ms ${o}`);
  const v = y * M, b = m * M, q = n.landingMode === "target" ? { scaleX: 1, scaleY: 1 } : n.landingMode === "free" ? {
    scaleX: v > 0 ? tt.width / v : 1,
    scaleY: b > 0 ? tt.height / b : 1
  } : {
    // grid/list 的目标矩形已经是屏幕视觉尺寸；相机倍率只用于
    // scaleShell 的内容继承，不能再次进入外框的几何比例。
    scaleX: g > 0 ? tt.width / g : 1,
    scaleY: C > 0 ? tt.height / C : 1
  };
  U.setTarget({
    x: tt.left,
    y: tt.top,
    scaleX: q.scaleX,
    scaleY: q.scaleY
  }), t.style.transition = "";
  const at = [
    ...n.landingMode !== "target" ? [
      `left ${i}ms ${o}`,
      `width ${i}ms ${o}`,
      `transform ${i}ms ${o}`,
      `grid-template-columns ${i}ms ${o}`
    ] : [],
    `box-shadow ${i}ms ${o}`,
    `border-radius ${i}ms ${o}`,
    `border-color ${i}ms ${o}`,
    `backdrop-filter ${i}ms ${o}`,
    `-webkit-backdrop-filter ${i}ms ${o}`,
    `background-color ${i}ms ${o}`,
    `background-image ${i}ms ${o}`,
    `opacity ${i}ms ${o}`
  ].join(", ");
  ye(u, a, at), requestAnimationFrame(() => {
    var w, G;
    if (!E) {
      if (n.landingMode !== "target" && (u.dataset.runtimePhase = "landing", u.dataset.runtimeCompact === "true" && (u.style.left = "0", u.style.width = "100%", u.style.transform = "none", u.style.gridTemplateColumns = "", delete u.dataset.runtimeCompact)), a != null && (u.offsetWidth, gt(u, a)), r != null && (u.style.borderRadius = r), s != null && (u.style.border = s), l != null && (u.style.backdropFilter = l, u.style.setProperty("-webkit-backdrop-filter", l)), d != null && (u.style.backgroundColor = d, n.targetBackgroundImage && (u.style.backgroundImage = n.targetBackgroundImage)), c != null && (u.style.opacity = c), W && f) {
        const H = ((w = n.dismiss) == null ? void 0 : w.easing) ?? o, nt = ((G = n.dismiss) == null ? void 0 : G.scale) ?? 0.72;
        f.style.transformOrigin = "50% 50%", f.style.transition = `transform ${st}ms ${H}`, u.style.transition = `opacity ${st}ms ${H}`, f.style.transform = `scale(${nt})`, u.style.opacity = "0", K = window.setTimeout(() => {
          K = null, O = !0, ft();
        }, st + 40);
      }
      if (x) {
        for (const H of x.enteringEls) H.style.opacity = "1";
        for (const H of x.leavingEls) H.style.opacity = "0";
      }
    }
  });
  const _ = (w = 0) => {
    X !== null && window.clearTimeout(X), ot = performance.now() + Math.max(2e3, i * 8, 5e3) + w, X = window.setTimeout(() => {
      X = null, !E && performance.now() >= ot && Ct();
    }, Math.max(2e3, i * 8, 5e3) + w);
  };
  _();
  const V = n.coast;
  return n.landingMode === "free" ? U.start() : V && V.maxDistance > 0 && Math.hypot(((Q = n.motionState) == null ? void 0 : Q.vx) ?? 0, ((yt = n.motionState) == null ? void 0 : yt.vy) ?? 0) > V.minVelocity ? U.startCoastThenSettle(V) : U.start(), {
    finished: mt,
    retarget(w) {
      if (E) return;
      I = w, _(1e3);
      const G = z(I), H = n.landingMode === "target" ? 1 : n.landingMode === "free" ? G.width / v : G.width / g, nt = n.landingMode === "target" ? 1 : n.landingMode === "free" ? G.height / b : G.height / C;
      h && n.landingMode !== "free" && n.landingMode !== "target" && (N = y > 0 ? G.width / y : N), U.setTarget({
        x: G.left,
        y: G.top,
        scaleX: H,
        scaleY: nt
      });
    }
  };
}
function Kn(t) {
  var n;
  if (!jt.has(t)) return;
  jt.delete(t);
  const e = ((n = t.parentElement) == null ? void 0 : n.dataset.runtimeCameraGlue) === "true" ? t.parentElement : null;
  e == null || e.remove(), e || t.remove();
}
const zt = /* @__PURE__ */ new WeakMap(), re = ["left", "top", "right", "bottom", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "zIndex"];
function Ge(t, e) {
  const n = Object.fromEntries(
    re.map((i) => [i, t.style[i]])
  );
  t.style.cssText = e;
  for (const i of re)
    n[i] !== "" && (t.style[i] = n[i]);
}
const vt = /* @__PURE__ */ new WeakMap(), Nt = /* @__PURE__ */ new WeakSet();
function _e(t, e, n = {}) {
  var s;
  zt.set(t, { style: t.getAttribute("style") ?? "" });
  const i = Ne(t, e, { glass: !1, layout: n.layout, contentScale: n.contentScale }), o = St(i);
  Ve(t, o);
  const a = o.style.transition;
  o.style.transition = "none", gt(o, "none"), o.offsetWidth, o.style.transition = a;
  const r = !!((s = n.layout) != null && s.compact);
  i.style.zIndex = "1000", i.style.transform = "scale(1)", i.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", Nt.add(i), vt.set(t, i), n.keepSourceVisible || (t.style.visibility = "hidden"), requestAnimationFrame(() => {
    !i.isConnected || !Nt.has(i) || me(i, r);
  });
}
function me(t, e = !1, n = !0) {
  if (!t.isConnected) return;
  const i = St(t);
  Wt ? he(i) : gt(i, "0 12px 24px rgba(0,0,0,.18)"), n && (t.style.transform = `scale(${e ? 1 : 1.03})`);
}
function se(t) {
  return vt.get(t);
}
function Ze(t) {
  const e = vt.get(t);
  if (e)
    return requestAnimationFrame(() => {
      !e.isConnected || St(e).dataset.runtimePhase === "landing" || me(e, St(e).dataset.runtimeCompact === "true", !1);
    }), Nt.delete(e), vt.delete(t), zt.delete(t), e.style.zIndex = "2147483647", e;
}
function Bt(t) {
  const e = vt.get(t);
  e && (Nt.delete(e), e.remove(), jt.delete(e), vt.delete(t));
  const n = zt.get(t);
  n && Ge(t, n.style), zt.delete(t);
}
const jt = /* @__PURE__ */ new Set();
let Wt = !1;
function Jn(t) {
  Wt = t;
}
function Qn() {
  return Wt;
}
function he(t) {
  t.style.background = "rgba(255, 255, 255, 0.42)", t.style.backdropFilter = "blur(12px) saturate(1.15)", t.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), t.style.border = "1px solid rgba(255, 255, 255, 0.72)", gt(t, "0 22px 50px rgba(30, 35, 60, 0.30)"), t.style.opacity = "0.97";
}
const wt = /* @__PURE__ */ new Map();
function ti(t, e) {
  wt.set(t, e), t.style.visibility = "hidden";
}
function Ue(t, e) {
  (t.style.visibility === "hidden" || getComputedStyle(t).visibility === "hidden") && wt.set(t, e);
}
function ei(t, e) {
  const n = wt.get(t) === e;
  return n && (t.style.visibility = "", wt.delete(t)), n;
}
function Ke(t, e) {
  wt.get(t) === e && wt.delete(t);
}
const pe = ["left", "top", "right", "bottom", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "zIndex"];
function Je(t) {
  return Object.fromEntries(pe.map((e) => [e, t.style[e]]));
}
function Qe(t, e) {
  const n = Je(t);
  t.style.cssText = e;
  for (const i of pe)
    n[i] !== "" && (t.style[i] = n[i]);
}
const _t = /* @__PURE__ */ new WeakMap();
function tn(t, e) {
  const n = {
    sessionId: e,
    cssText: t.style.cssText
  };
  _t.set(t, n);
  const i = () => _t.get(t) === n;
  return {
    element: t,
    sessionId: e,
    detachFromLayout: () => i() ? (t.style.display = "none", t.style.pointerEvents = "none", !0) : !1,
    restoreLayoutHidden: () => i() ? (t.style.display = "", t.style.visibility = "hidden", t.style.pointerEvents = "none", !0) : !1,
    restore: () => i() ? (Qe(t, n.cssText), _t.delete(t), !0) : !1,
    isOwner: i
  };
}
function en(t) {
  const e = {
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
  return {
    setTarget(n) {
      e.x = n.x, e.y = n.y, t.onFrame({ x: e.x, y: e.y, scaleX: 1, scaleY: 1, rotateX: 0, rotateZ: 0 });
    },
    getState: () => e,
    stop() {
    }
  };
}
const kt = /* @__PURE__ */ new WeakMap(), Pt = /* @__PURE__ */ new WeakMap();
function xe(t) {
  const e = t.match(/cubic-bezier\(([^)]+)\)/);
  if (!e) return (s) => s * s * (3 - 2 * s);
  const n = e[1].split(",").map(Number);
  if (n.length !== 4 || n.some((s) => !Number.isFinite(s)))
    return (s) => s * s * (3 - 2 * s);
  const [i, o, a, r] = n;
  return (s) => {
    let l = 0, d = 1;
    for (let u = 0; u < 12; u += 1) {
      const f = (l + d) / 2;
      3 * (1 - f) ** 2 * f * i + 3 * (1 - f) * f ** 2 * a + f ** 3 < s ? l = f : d = f;
    }
    const c = (l + d) / 2;
    return 3 * (1 - c) ** 2 * c * o + 3 * (1 - c) * c ** 2 * r + c ** 3;
  };
}
function Kt(t) {
  const e = kt.get(t);
  e && (cancelAnimationFrame(e.frame), kt.delete(t), t.style.transform = "");
}
function nn(t, e, n, i, o, a) {
  Kt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, i),
    fromX: e,
    fromY: n,
    easing: xe(o)
  };
  kt.set(t, r);
  const s = (l) => {
    if (kt.get(t) !== r) return;
    const d = Math.min(1, (l - r.started) / r.duration), c = r.easing(d);
    if (t.style.transform = `translate(${(r.fromX * (1 - c)).toFixed(3)}px, ${(r.fromY * (1 - c)).toFixed(3)}px)`, d >= 1) {
      kt.delete(t), t.style.transform = "", a == null || a();
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
function Jt(t) {
  const e = Pt.get(t);
  e && (cancelAnimationFrame(e.frame), Pt.delete(t), t.style.height = "");
}
function on(t, e, n, i, o, a) {
  Jt(t);
  const r = {
    frame: 0,
    started: performance.now(),
    duration: Math.max(1, i),
    fromX: e,
    fromY: n,
    easing: xe(o)
  };
  Pt.set(t, r);
  const s = (l) => {
    if (Pt.get(t) !== r) return;
    const d = Math.min(1, (l - r.started) / r.duration), c = r.fromX + (r.fromY - r.fromX) * r.easing(d);
    if (t.style.height = `${c}px`, d >= 1) {
      Pt.delete(t);
      return;
    }
    r.frame = requestAnimationFrame(s);
  };
  r.frame = requestAnimationFrame(s);
}
const Et = bt.flip.duration, At = bt.flip.easing;
function an(t, e) {
  const n = /* @__PURE__ */ new Map();
  return t.forEach((i) => n.set(i, (e == null ? void 0 : e.rect(i)) ?? i.getBoundingClientRect())), n;
}
function be(t) {
  const e = t.filter((n) => n.dataset.runtimeFlip === "true");
  if (e.length !== 0)
    for (const n of e)
      n.dataset.runtimeFlipToken = String(Number(n.dataset.runtimeFlipToken ?? "0") + 1), delete n.dataset.runtimeFlip, Kt(n), n.style.setProperty("transition", "none", "important");
}
function rn(t, e, n = Et, i = At, o) {
  be(t);
  const a = [];
  for (const r of t) {
    if (r.dataset.runtimeProxy === "true" || r.dataset.runtimePlaceholder === "true" || r.dataset.runtimeActive === "true")
      continue;
    const s = e.get(r);
    if (!s)
      continue;
    const l = (o == null ? void 0 : o.rect(r)) ?? r.getBoundingClientRect(), d = s.left - l.left, c = s.top - l.top;
    if (Math.abs(d) < 0.5 && Math.abs(c) < 0.5) {
      r.style.transition = "";
      continue;
    }
    a.push({ element: r, dx: d, dy: c });
  }
  for (const { element: r, dx: s, dy: l } of a) {
    r.style.setProperty("transition", "none", "important"), r.style.transform = `translate(${s}px, ${l}px)`;
    const d = String(Number(r.dataset.runtimeFlipToken ?? "0") + 1);
    r.dataset.runtimeFlip = "true", r.dataset.runtimeFlipToken = d, nn(r, s, l, n, i, () => {
      r.dataset.runtimeFlipToken === d && (r.style.transition = "", delete r.dataset.runtimeFlip);
    });
  }
}
function Se(t) {
  return t.dataset.layoutKey ?? t.dataset.card ?? "";
}
const Vt = /* @__PURE__ */ new WeakMap();
function sn(t) {
  const e = t.closest('[data-layout-open="false"]');
  return e !== null && e.dataset.runtimeGroupAnimating !== "true";
}
function ve(t, e) {
  if (sn(t)) return null;
  const n = t.closest("[data-layout-collection]");
  if (!n) return null;
  const i = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect(), o = (e == null ? void 0 : e.rect(n)) ?? n.getBoundingClientRect();
  return i.width > 0 && i.height > 0 && o.width > 0 && i.width <= o.width * 1.25 && i.left >= o.left - 1 && i.right <= o.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function we(t, e) {
  return !e || e.length === 0 ? !0 : e.some((n) => n === t || n.contains(t));
}
function Fe(t, e, n) {
  if (!n || n.length === 0)
    return Array.from(t.querySelectorAll(e));
  const i = [], o = /* @__PURE__ */ new Set();
  for (const a of n)
    a.matches(e) && !o.has(a) && (o.add(a), i.push(a)), a.querySelectorAll(e).forEach((r) => {
      o.has(r) || (o.add(r), i.push(r));
    });
  return i;
}
function ln(t, e, n = Se, i, o, a) {
  const r = /* @__PURE__ */ new Map(), s = Fe(t, e, o).map((l) => {
    if (i != null && i(l) || !we(l, o)) return null;
    const d = ve(l, a);
    if (!d) return null;
    const c = n(l);
    if (!c) return null;
    const u = (a == null ? void 0 : a.rect(l)) ?? l.getBoundingClientRect();
    return r.set(c, d.collectionId), {
      key: c,
      element: l,
      rect: { left: u.left, top: u.top, width: u.width, height: u.height },
      contentHTML: l.outerHTML
    };
  }).filter((l) => l !== null);
  return { root: t, selector: e, collectionByKey: r, entries: s, ignore: i, scopeSurfaces: o };
}
function cn(t, e = {}, n) {
  const i = e.duration ?? 250, o = e.easing ?? "cubic-bezier(.22,1,.36,1)", a = e.key ?? Se, r = /* @__PURE__ */ new Map();
  Fe(t.root, t.selector, t.scopeSurfaces).filter((l) => {
    var u;
    if ((u = t.ignore) != null && u.call(t, l) || !we(l, t.scopeSurfaces)) return !1;
    const d = ve(l, n);
    if (!d) return !1;
    const c = a(l);
    return c ? (r.set(c, d.collectionId), !0) : !1;
  }).filter((l) => {
    const d = a(l);
    if (!d) return !1;
    const c = t.collectionByKey.get(d);
    return c === void 0 || c !== r.get(d);
  }).forEach((l) => {
    var c;
    (c = Vt.get(l)) == null || c.cancel();
    const d = l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: i, easing: o, fill: "both" });
    Vt.set(l, d), d.finished.then(() => {
      Vt.get(l) === d && Vt.delete(l);
    }).catch(() => {
    });
  }), t.entries.forEach((l) => {
    if (r.has(l.key)) return;
    const d = document.createElement("template");
    d.innerHTML = l.contentHTML;
    const c = d.content.firstElementChild;
    if (!c) return;
    c.removeAttribute("data-file-id"), c.removeAttribute("data-layout-key"), c.removeAttribute("data-layout-role"), c.dataset.runtimePresenceGhost = "true";
    const u = l.rect;
    c.style.position = "fixed", c.style.left = `${u.left}px`, c.style.top = `${u.top}px`, c.style.width = `${u.width}px`, c.style.height = `${u.height}px`, c.style.margin = "0", c.style.pointerEvents = "none", c.style.zIndex = "2147483646", document.body.appendChild(c), c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: i, easing: o, fill: "both" }).finished.then(() => c.remove()).catch(() => c.remove());
  });
}
function Ce() {
  const t = /* @__PURE__ */ new WeakMap();
  return {
    rect(e) {
      const n = t.get(e);
      if (n) return n;
      const i = e.getBoundingClientRect();
      return t.set(e, i), i;
    }
  };
}
let Te = null, Me = !1;
const Zt = /* @__PURE__ */ new WeakMap();
function ni(t) {
  Te = t;
}
function ii(t) {
  Me = t;
}
function $e() {
  const t = Te;
  return {
    flip: (t == null ? void 0 : t.flip) ?? bt.flip,
    resize: (t == null ? void 0 : t.resize) ?? bt.resize
  };
}
function un(t, e, n) {
  const i = (s) => !n || n.length === 0 ? !0 : n.some((l) => l === s || l.contains(s)), o = Array.from(e.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(i), a = [], r = [];
  for (const s of t)
    i(s) && (s.closest("[data-layout-group]") !== null ? a.push(s) : r.push(s));
  return { groups: o, groupLeaves: a, flatCards: r };
}
function Qt(t, e = document, n = !0, i, o = {}) {
  const a = (S) => {
    const g = o.scopeSurfaces;
    return !g || g.length === 0 ? !0 : g.some((C) => C === S || C.contains(S));
  }, s = [
    ...e instanceof HTMLElement && e.matches("[data-layout-surface]") ? [e] : [],
    ...Array.from(e.querySelectorAll("[data-layout-surface]"))
  ].filter(a), l = s.map((S) => ({ element: S, rect: Lt(S), inlineStyle: Pe(S) }));
  ke(l);
  const d = Ce(), { groups: c, groupLeaves: u, flatCards: f } = un(t, e, o.scopeSurfaces), x = Mn(s, d, o.surfaceMeasures), L = (o.scopeSurfaces ?? [e]).some(
    (S) => S instanceof HTMLElement ? S.matches("[data-layout-collection]") || S.querySelector("[data-layout-collection]") !== null : e.querySelector("[data-layout-collection]") !== null
  ), A = {
    root: e,
    group: c.length > 0 ? { before: Sn([...c, ...u], d) } : void 0,
    flat: f.length > 0 ? { elements: f, before: an(f, d) } : void 0,
    surfaces: x,
    presence: n && L ? ln(e, '[data-layout-role="card"]', void 0, i, o.scopeSurfaces, d) : void 0
  };
  return hn(e, A);
}
function te(t) {
  const e = Ce(), n = $e(), i = t.group ? fn(t.group.before) : null;
  t.group && wn(t.group.before, n.flip.duration, n.flip.easing, e), t.flat && rn(t.flat.elements, t.flat.before, n.flip.duration, n.flip.easing, e), $n(t.surfaces, n.resize.duration, n.resize.easing, e), t.presence && cn(t.presence, {
    duration: n.flip.duration,
    easing: n.flip.easing
  }, e), i && yn(i, n.flip.duration + 50);
}
const Ft = /* @__PURE__ */ new WeakMap();
let dn = 0;
function fn(t) {
  const e = t.filter((a) => a.rect.height > 0).map((a) => ({ element: a.element, overflow: a.element.style.overflow })).filter((a) => a.element.isConnected).filter((a) => a.element.dataset.runtimeGroupAnimating !== "true").filter((a) => getComputedStyle(a.element).overflow !== "visible");
  if (e.length === 0) return null;
  const n = e[0].element.getRootNode(), i = Ft.get(n);
  i == null || i.entries.forEach(({ element: a, overflow: r }) => {
    a.style.overflow = r;
  }), e.forEach(({ element: a }) => {
    a.style.overflow = "visible";
  });
  const o = { token: String(++dn), entries: e };
  return Ft.set(n, o), o;
}
function yn(t, e) {
  var i;
  const n = (i = t.entries[0]) == null ? void 0 : i.element.getRootNode();
  n && (t.timeout = window.setTimeout(() => {
    var o;
    ((o = Ft.get(n)) == null ? void 0 : o.token) === t.token && (t.entries.forEach(({ element: a, overflow: r }) => {
      a.style.overflow = r;
    }), Ft.delete(n));
  }, e));
}
function gn(t) {
  ut.set(t.root, t), queueMicrotask(() => {
    ut.get(t.root) === t && (ut.delete(t.root), te(t));
  });
}
function mn(t) {
  ut.set(t.root, t), requestAnimationFrame(() => {
    ut.get(t.root) === t && (ut.delete(t.root), te(t));
  });
}
function hn(t, e) {
  const n = ut.get(t);
  if (!n) return e;
  const i = bn(e.surfaces, n.surfaces), o = pn(e.flat, n.flat), a = xn(e.group, n.group);
  return { ...e, flat: o, group: a, surfaces: i };
}
function pn(t, e) {
  if (!t || !e) return t;
  const n = new Map(t.before);
  for (const i of t.elements) {
    const o = e.before.get(i);
    o && n.set(i, o);
  }
  return { ...t, before: n };
}
function xn(t, e) {
  if (!t || !e) return t;
  const n = new Map(e.before.map((i) => [i.element, i.rect]));
  return { before: t.before.map((i) => ({ ...i, rect: n.get(i.element) ?? i.rect })) };
}
function bn(t, e) {
  const n = new Map(e.map((i) => [i.element, i]));
  return t.map((i) => {
    const o = n.get(i.element);
    return o ? { ...i, rect: o.rect, inlineStyle: o.inlineStyle } : i;
  });
}
const ut = /* @__PURE__ */ new WeakMap(), Dt = /* @__PURE__ */ new WeakMap(), Ht = /* @__PURE__ */ new WeakMap(), xt = /* @__PURE__ */ new WeakMap();
function Lt(t, e) {
  const n = (e == null ? void 0 : e.rect(t)) ?? t.getBoundingClientRect();
  return { top: n.top, left: n.left, width: n.width, height: n.height };
}
function Sn(t, e) {
  const n = t.filter((o) => {
    const a = (e == null ? void 0 : e.rect(o)) ?? o.getBoundingClientRect();
    return a.width > 0 && a.height > 0;
  }), i = new Set(n);
  return n.map((o) => ({
    element: o,
    parent: vn(o, i),
    rect: Lt(o, e)
  }));
}
function vn(t, e) {
  let n = t.parentElement;
  for (; n; ) {
    if (e.has(n)) return n;
    n = n.parentElement;
  }
  return null;
}
function wn(t, e = Et, n = At, i) {
  be(t.map((a) => a.element));
  const o = /* @__PURE__ */ new Map();
  for (const a of t) {
    const r = Lt(a.element, i);
    o.set(a.element, {
      x: a.rect.left - r.left,
      y: a.rect.top - r.top
    });
  }
  for (const a of t) {
    const r = o.get(a.element), s = a.parent ? o.get(a.parent) : void 0, l = r.x - ((s == null ? void 0 : s.x) ?? 0), d = r.y - ((s == null ? void 0 : s.y) ?? 0);
    if (a.element.dataset.runtimeProxy === "true" || a.element.dataset.runtimePlaceholder === "true" || a.element.dataset.runtimeActive === "true" || Math.abs(l) < 0.5 && Math.abs(d) < 0.5) {
      a.element.dataset.runtimeGroupAnimating !== "true" && (a.element.style.transition = "");
      continue;
    }
    a.element.style.transform = `translate(${l}px, ${d}px)`, a.element.style.transition = "none";
    const c = String(Number(a.element.dataset.runtimeFlipToken ?? "0") + 1);
    a.element.dataset.runtimeFlip = "true", a.element.dataset.runtimeFlipToken = c;
    const u = xt.get(a.element);
    u !== void 0 && (cancelAnimationFrame(u), xt.delete(a.element));
    const f = requestAnimationFrame(() => {
      xt.delete(a.element), a.element.dataset.runtimeFlipToken === c && (a.element.style.transition = `transform ${e}ms ${n}`, a.element.style.transform = "");
    });
    xt.set(a.element, f);
    const x = window.setTimeout(() => {
      a.element.dataset.runtimeFlipToken === c && (a.element.style.transition = "", a.element.style.transform = "", delete a.element.dataset.runtimeFlip, Ht.delete(a.element));
    }, e + 40);
    Ht.set(a.element, x);
  }
}
function Fn(t, e, n = Et, i = At, o, a = !1) {
  Re(t);
  const r = o ?? t.getBoundingClientRect().height, s = String(Number(t.dataset.runtimeGroupToken ?? "0") + 1);
  t.dataset.runtimeGroupToken = s;
  const l = Math.abs(Math.max(0, e) - r), c = Math.min(Math.max(l / 8, 200), 350);
  t.dataset.runtimeGroupAnimating = "true", t.style.overflow = "hidden", t.style.height = `${r}px`, t.style.transition = `height ${c}ms ${i}`, t.offsetHeight;
  const u = { frame: null, timeout: null };
  Dt.set(t, u), u.frame = requestAnimationFrame(() => {
    u.frame = null, t.style.height = `${Math.max(0, e)}px`;
  }), u.timeout = window.setTimeout(() => {
    t.dataset.runtimeGroupToken === s && (e <= 0 ? (t.style.height = "0px", t.style.overflow = "hidden") : a ? (t.style.height = `${e}px`, t.style.overflow = "") : (t.style.height = "", t.style.overflow = ""), t.style.transition = "", delete t.dataset.runtimeGroupAnimating, Dt.delete(t));
  }, c + 40);
}
function Re(t) {
  const e = Dt.get(t);
  e && (e.frame !== null && cancelAnimationFrame(e.frame), e.timeout !== null && window.clearTimeout(e.timeout), Dt.delete(t));
}
function oi(t) {
  ut.delete(t);
  const e = typeof Node < "u" && t instanceof Node, n = e ? t.getRootNode() : t, i = Ft.get(n);
  i && (i.timeout !== void 0 && window.clearTimeout(i.timeout), i.entries.forEach(({ element: a, overflow: r }) => {
    e && !t.contains(a) || (a.style.overflow = r);
  }), Ft.delete(n));
  const o = [];
  t instanceof HTMLElement && o.push(t), typeof t.querySelectorAll == "function" && o.push(...Array.from(t.querySelectorAll(
    "[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-layout-content]"
  )));
  for (const a of o) {
    const r = Ht.get(a), s = xt.get(a), l = r !== void 0 || a.dataset.runtimeFlip === "true" || a.dataset.runtimeGroupAnimating === "true" || a.dataset.runtimeSurfaceResize === "true" || a.dataset.runtimeLayoutTransaction === "true";
    r !== void 0 && (window.clearTimeout(r), Ht.delete(a)), s !== void 0 && (cancelAnimationFrame(s), xt.delete(a)), Kt(a), Jt(a), Re(a);
    const d = it.get(a);
    d && (ee(a, d.baseStyle), it.delete(a)), a.dataset.runtimeGroupAnimating === "true" && (a.style.height = a.dataset.layoutOpen === "false" ? "0px" : "", a.style.overflow = a.dataset.layoutOpen === "false" ? "hidden" : "", a.style.transition = ""), l && (a.style.transform = ""), a.dataset.runtimeFlip === "true" && delete a.dataset.runtimeFlip, delete a.dataset.runtimeSurfaceResize, delete a.dataset.runtimeSurfaceResizeToken, delete a.dataset.runtimeLayoutTransaction, delete a.dataset.runtimeGroupAnimating;
  }
}
async function ai(t) {
  const e = (Zt.get(t.content) ?? 0) + 1;
  Zt.set(t.content, e);
  const n = Array.from(t.root.querySelectorAll('[data-layout-role="card"]')), i = (n.length > 0 ? n : Array.from(t.root.querySelectorAll(".done-card-item, [data-card]"))).filter((l) => {
    const d = l.getBoundingClientRect();
    return d.width > 0 && d.height > 0;
  }), o = Qt(i, t.root, !1), a = t.content.getBoundingClientRect().height, r = Me ? Cn(t.content, t.opening, t.duration, t.easing) : null;
  if (t.mutate(), await t.waitForLayout(), Zt.get(t.content) !== e || t.isCurrent && !t.isCurrent()) return;
  const s = t.opening ? t.content.scrollHeight : 0;
  Fn(t.content, s, t.duration, t.easing, a), r && Tn(r, t.opening), te(o);
}
function Cn(t, e, n = Et, i = At) {
  const o = Array.from(t.querySelectorAll('[data-layout-role="card"], .done-card-item')), a = String(Number(t.dataset.runtimePresenceToken ?? "0") + 1);
  return t.dataset.runtimePresenceToken = a, o.forEach((r) => {
    e && (r.style.opacity = "0");
  }), { content: t, elements: o, token: a, duration: n };
}
function Tn(t, e) {
  const { content: n, elements: i, token: o, duration: a } = t;
  requestAnimationFrame(() => {
    n.dataset.runtimePresenceToken === o && i.forEach((r) => {
      r.animate(
        [{ opacity: e ? 0 : 1 }, { opacity: e ? 1 : 0 }],
        { duration: a, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }
      );
    });
  }), window.setTimeout(() => {
    n.dataset.runtimePresenceToken === o && i.forEach((r) => {
      r.style.opacity = "";
    });
  }, a + 40);
}
function Mn(t, e, n) {
  return t.map((i) => {
    var o;
    return i.dataset.runtimeLayoutTransaction = "true", {
      element: i,
      rect: Lt(i, e),
      measure: n == null ? void 0 : n.get(i),
      // 事务被打断时，当前 inline height 是 Runtime 上一笔动画写入的临时值，
      // 不能把它错当成业务样式保存，否则取消落点后会永久留下旧高度。
      inlineStyle: ((o = it.get(i)) == null ? void 0 : o.baseStyle) ?? Pe(i)
    };
  });
}
function $n(t, e = Et, n = At, i) {
  var r;
  ke(t);
  const o = t.filter((s) => s.element.isConnected).map((s) => {
    var f;
    const l = (f = s.measure) == null ? void 0 : f.call(s), d = Lt(s.element, i), c = l ? { ...d, ...l.width === void 0 ? {} : { width: l.width }, height: l.height } : d, u = $e();
    return {
      item: s,
      next: c,
      profile: u.resize,
      fromHeight: le(s.element, s.rect.height),
      toHeight: le(s.element, c.height)
    };
  }).filter(({ item: s, next: l }) => Math.abs(s.rect.height - l.height) >= 0.5);
  if (o.length === 0) {
    t.forEach(({ element: s }) => {
      delete s.dataset.runtimeLayoutTransaction;
    });
    return;
  }
  const a = new Set(o.map(({ item: s }) => s.element));
  t.forEach(({ element: s }) => {
    a.has(s) || delete s.dataset.runtimeLayoutTransaction;
  });
  for (const { item: s, fromHeight: l } of o) {
    const d = s.element.style, c = {
      baseStyle: ((r = it.get(s.element)) == null ? void 0 : r.baseStyle) ?? s.inlineStyle,
      // 不能从 DOM dataset 递增：打断会清 dataset，旧 rAF 可能与新事务
      // 重新拿到相同 token，进而错误写入新高度。
      token: String(++Rn)
    };
    it.set(s.element, c), d.overflow = "hidden", d.transition = "none", d.height = `${l}px`, s.element.dataset.runtimeSurfaceResize = "true", s.element.dataset.runtimeSurfaceResizeToken = c.token;
  }
  requestAnimationFrame(() => {
    for (const { item: s, fromHeight: l, toHeight: d, profile: c } of o) {
      const u = s.element.style, f = it.get(s.element);
      if (!f || s.element.dataset.runtimeSurfaceResizeToken !== f.token) continue;
      const x = f.token;
      u.transition = "none", on(s.element, l, d, c.duration, c.easing), window.setTimeout(() => {
        if (s.element.dataset.runtimeSurfaceResizeToken !== x) return;
        const L = it.get(s.element);
        !L || L.token !== x || (ee(s.element, L.baseStyle), s.measure && (u.height = `${d}px`), it.delete(s.element), delete s.element.dataset.runtimeSurfaceResize, delete s.element.dataset.runtimeLayoutTransaction);
      }, c.duration + 40);
    }
  });
}
function ke(t) {
  const e = t.filter((n) => n.element.dataset.runtimeSurfaceResize === "true");
  if (e.length !== 0)
    for (const { element: n } of e) {
      const i = it.get(n);
      i && (Jt(n), ee(n, i.baseStyle), it.delete(n), delete n.dataset.runtimeSurfaceResize, delete n.dataset.runtimeSurfaceResizeToken, delete n.dataset.runtimeLayoutTransaction);
    }
}
const it = /* @__PURE__ */ new WeakMap();
let Rn = 0;
function Pe(t) {
  return {
    height: t.style.height,
    overflow: t.style.overflow,
    transition: t.style.transition
  };
}
function ee(t, e) {
  t.style.height = e.height, t.style.overflow = e.overflow, t.style.transition = e.transition;
}
function le(t, e) {
  const n = getComputedStyle(t);
  if (n.boxSizing === "border-box") return e;
  const i = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
  return Math.max(0, e - i);
}
function kn(t, e, n) {
  const i = t(e, n);
  return {
    ...i,
    boxShadow: n.style.boxShadow || i.boxShadow,
    transform: n.style.transform || i.transform
  };
}
function Pn(t, e, n, i, o) {
  const a = i ?? e.getBoundingClientRect(), r = (o == null ? void 0 : o.align) ?? "center", s = r === "pointer" ? n.clientX - a.left : a.width / 2, l = r === "pointer" ? n.clientY - a.top : a.height / 2, d = s - ((o == null ? void 0 : o.offsetX) ?? 0), c = l - ((o == null ? void 0 : o.offsetY) ?? 0);
  return i && (t.dragOffset = { x: d, y: c }), { rect: a, offsetX: d, offsetY: c };
}
function Ee(t) {
  return (e) => e === t || e.contains(t);
}
function En(t, e, n, i) {
  const o = t.cloneNode(!0), a = e().filter((r) => r !== t && r.dataset.runtimeProxy !== "true");
  return {
    beforeContent: o,
    beforePickup: Qt(a, document, !0, Ee(t), {
      scopeSurfaces: n == null ? void 0 : n(),
      surfaceMeasures: i == null ? void 0 : i()
    })
  };
}
function An(t, e, n) {
  let i = t, o = null;
  return {
    update(a, r) {
      const s = e(a);
      return s ? (n(s, o) || (i = r(s), o = s), o) : (o = null, null);
    },
    release() {
      return o;
    },
    get currentSurface() {
      return i;
    }
  };
}
function Ln(t) {
  return t.active ? t.state.update(t.event, t.getSurface) : null;
}
function In(t) {
  t.event.stopPropagation(), Ut(t.proxy, !1), t.clearRegrab(), Ke(t.source, t.sessionId), t.interrupt(), t.source.style.visibility = "hidden";
}
function Xn(t, e) {
  return () => requestAnimationFrame(() => {
    e();
  });
}
function On(t) {
  const e = t.resolve();
  return e ? (t.applyState(e), e) : null;
}
function Bn(t, e, n = {}) {
  const i = e.style.transition, o = e.style.opacity, a = getComputedStyle(e).opacity;
  e.dataset.runtimeLandingCapture = "true", e.style.transition = "none", n.ignoreTemporaryOpacity && (o === "0" || a === "0") && (e.style.opacity = "1");
  try {
    e.offsetWidth;
    const r = t(e);
    return n.ignoreTemporaryOpacity && (o === "0" || a === "0" || r.opacity === "0") ? { ...r, opacity: "1" } : r;
  } finally {
    e.style.opacity = o, e.style.transition = i, delete e.dataset.runtimeLandingCapture;
  }
}
function Vn(t) {
  return {
    ...t.createContext(),
    sourceElement: t.source,
    sourceRect: t.sourceRect,
    visualSnapshot: t.visualSnapshot,
    targetSnapshot: t.targetSnapshot,
    motionState: t.motionState
  };
}
function Yn(t) {
  const e = t.createProxy();
  return e ? (t.enableProxy(e.element), t.bindRegrab(e.element), t.land(e.element).then(t.onComplete), e.element) : (t.onMissing(), null);
}
function zn(t) {
  t.active && t.complete({
    completed: t.result.completed,
    reason: t.result.reason ?? "",
    reveal: t.result.completed ? t.reveal : void 0
  });
}
function Nn(t, e) {
  return t() ?? e();
}
function jn(t) {
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
function Dn(t, e, n, i) {
  let o = 0;
  return {
    capture: () => (o += 1, Qt(
      e().filter((a) => a !== t && a.dataset.runtimeProxy !== "true"),
      document,
      !0,
      Ee(t),
      { scopeSurfaces: n == null ? void 0 : n(), surfaceMeasures: i == null ? void 0 : i() }
    )),
    play: (a, r, s = !1) => {
      const l = ++o;
      if (s) {
        requestAnimationFrame(() => {
          l === o && mn(r);
        });
        return;
      }
      gn(r);
    }
  };
}
function Hn(t) {
  var tt;
  const { runtime: e, objectId: n, element: i, event: o, fromRect: a, clone: r = !1 } = t, s = e.objects.get(n), l = e.surfaces.snapshot(), d = l.map((y) => y.id), c = (y) => {
    var m;
    return (m = e.objects.get(y)) == null ? void 0 : m.surfaceId;
  }, u = (s == null ? void 0 : s.surfaceId) ?? ((tt = l[0]) == null ? void 0 : tt.id), f = (y) => y.closest('[data-layout-content][data-layout-open="false"]') !== null, x = () => {
    const y = [...e.objects.values()].map((v) => v.element).filter((v) => !!(v != null && v.isConnected)), m = Array.from(document.querySelectorAll("[data-flip-target]"));
    return Array.from(/* @__PURE__ */ new Set([...y, ...m])).filter((v) => !f(v));
  };
  let L, A, S, g = null, C = null, M = null, h = null, N = null, T = !1, p = null, R = null, k = null, z = null, I = null, E, W = { x: 0, y: 0 }, st = null, F = !1, O = !1, X = null;
  function K(y, m) {
    if (!m || X || m.scrollHeight >= y) return;
    const v = y - m.scrollHeight;
    if (v <= 0.5) return;
    const b = document.createElement("div");
    b.dataset.runtimeScrollCompensation = "true", b.style.width = "1px", b.style.height = `${v}px`, b.style.flex = "0 0 auto", b.style.pointerEvents = "none", b.style.visibility = "hidden", m.appendChild(b), X = b, m.scrollTop = Math.min(m.scrollTop, m.scrollHeight - m.clientHeight);
  }
  function ot() {
    X == null || X.remove(), X = null;
  }
  const Z = () => {
    const y = /* @__PURE__ */ new Set();
    return u && y.add(u), g != null && g.columnId && y.add(g.columnId), e.surfaces.snapshot().filter((m) => y.has(m.id)).map((m) => {
      var v;
      return ((v = m.layoutElement) == null ? void 0 : v.call(m)) ?? m.element;
    }).filter((m) => !!(m != null && m.isConnected));
  }, mt = () => {
    var v;
    const y = /* @__PURE__ */ new Set();
    u && y.add(u), g != null && g.columnId && y.add(g.columnId);
    const m = /* @__PURE__ */ new Map();
    for (const b of e.surfaces.snapshot()) {
      if (!y.has(b.id) || !b.measureLayout) continue;
      const q = ((v = b.layoutElement) == null ? void 0 : v.call(b)) ?? b.element;
      q != null && q.isConnected && m.set(q, b.measureLayout);
    }
    return m;
  };
  function dt() {
    var y;
    return p ? (y = e.getSession(p)) == null ? void 0 : y.state : void 0;
  }
  function ft(y, m) {
    if (dt() !== "active" || !S) return;
    const v = Ln({
      active: dt() === "active",
      event: { clientX: y, clientY: m },
      state: S,
      getSurface: (b) => b.columnId
    });
    v && (g = { ...v, point: { x: y, y: m } });
  }
  function Ct(y) {
    F = !0, I == null || I.setTarget({
      x: y.clientX - W.x,
      y: y.clientY - W.y
    }), ft(y.clientX, y.clientY), z == null || z.update(
      e.resolveMoveSurfaceElement(n, y.clientX, y.clientY),
      { x: y.clientX, y: y.clientY }
    );
  }
  function It(y) {
    var _, V;
    if (T) return { accepted: !1 };
    if (T = !0, E = I ? { ...I.getState() } : void 0, I == null || I.stop(), I = null, z == null || z.stop(), !S || !p) return { accepted: !1 };
    y && ft(y.clientX, y.clientY);
    const m = S.release();
    g = m ? {
      ...m,
      point: y ? { x: y.clientX, y: y.clientY } : m.point,
      ...E ? { releaseVelocity: { x: E.vx, y: E.vy } } : {}
    } : null, !g && !F && E && Math.hypot(E.vx, E.vy) < 0.5 && u && (g = {
      columnId: u,
      index: st ?? Math.max(0, e.getObjectSurfaceIndex(n, u))
    });
    const v = !g;
    if (v && u && (g = {
      columnId: u,
      index: st ?? Math.max(0, e.getObjectSurfaceIndex(n, u)),
      invalidReturn: !0
    }), !g) return { accepted: !1 };
    if (E) {
      const B = ue(
        { x: E.vx, y: E.vy },
        e.getObjectReleaseMotionProfile(n, g)
      );
      E.vx = B.x, E.vy = B.y, g.releaseVelocity = { x: E.vx, y: E.vy };
    }
    const b = g, q = (h == null ? void 0 : h.getBoundingClientRect()) ?? ((_ = e.getVisualProxy(p)) == null ? void 0 : _.element.getBoundingClientRect()) ?? ((V = se(i)) == null ? void 0 : V.getBoundingClientRect()) ?? i.getBoundingClientRect();
    delete i.dataset.runtimeActive, v && (O || k == null || k.restoreLayoutHidden(), R == null || R.release());
    const at = (B, $) => {
      var ct;
      if (dt() !== "landing") return;
      const et = ($ == null ? void 0 : $.kind) === "element" ? $.element : null, rt = et ?? e.resolveVisualTarget(p, b) ?? ((ct = e.objects.get(n)) == null ? void 0 : ct.element) ?? null, Y = On({
        resolve: () => rt,
        applyState: (j) => e.applyVisualState(n, j, { phase: "revealing", hovered: !1, selected: j.classList.contains("is-selected"), grabbed: !1 })
      });
      if (!Y) {
        M == null || M.complete({ completed: !1, reason: "target-not-registered" }), M = null;
        return;
      }
      N = Y, et && e.keepSurfaceTargetVisible(b.columnId, Y);
      const J = e.findObjectIdByElement(Y, n) ?? n, pt = Bn(
        (j) => e.captureVisualState(J, j),
        Y,
        { ignoreTemporaryOpacity: !0 }
      ), lt = Vn({
        createContext: () => e.createVisualLifecycleContext(
          B,
          b,
          ($ == null ? void 0 : $.kind) === "rect" ? $.rect : ($ == null ? void 0 : $.element) ?? Y,
          L
        ),
        source: i,
        sourceRect: q,
        visualSnapshot: A,
        targetSnapshot: pt,
        motionState: E
      });
      h = Yn({
        // 抓取阶段已登记统一 proxy，landing 直接接管它；getVisualProxy 缺失时
        // 才在这里补建，覆盖异常中断或 regrab 后代理已被清理的情况。
        createProxy: () => e.getVisualProxy(B) ?? e.createVisualProxy(B, lt) ?? null,
        enableProxy: (j) => Ut(j, !0),
        bindRegrab: (j) => {
          var D;
          e.bindRegrabTarget(B, n, j, (Q) => Xt(Q, n));
          const P = e.getGroup(B);
          if (P)
            for (const Q of P.objectIds) {
              const yt = (D = e.objects.get(Q)) == null ? void 0 : D.element;
              yt != null && yt.isConnected && (yt.style.pointerEvents = "auto", Q !== n && e.registerRegrab(Q, (w) => Xt(w, Q)));
            }
        },
        land: () => e.landVisualProxy(B, ($ == null ? void 0 : $.kind) === "rect" ? $.rect : Y, lt),
        onMissing: () => {
          M == null || M.complete({ completed: !1, reason: "visual-proxy-missing" }), M = null;
        },
        onComplete: (j) => {
          zn({
            active: dt() === "landing",
            result: j,
            complete: (P) => M == null ? void 0 : M.complete(P),
            // 本体揭示后立刻在同一个微任务里销毁飞行代理，不要等 MoveLandingCoordinator.run
            // 后续的 session.handoff() → behavior.reveal()（我们自己的 finishReveal，只关
            // pointerEvents）→ port.end()（真正 disposeVisualProxy 的地方）——那条链隔了两次
            // await，代理在本体已可见之后还会多留几帧甚至更久，表现为本体和代理短暂重叠。
            reveal: () => e.revealVisualProxy(B, Y, lt).then(() => {
              h && (e.disposeVisualProxy(B), h = null), N = null;
            })
          }), M = null;
        }
      });
    };
    return C = Xn(() => {
    }, () => {
      const B = p;
      e.resolveLandingTarget(B, b).then(($) => at(B, $));
    }), { accepted: !0, destination: g, ...v ? { emitAction: !1 } : {} };
  }
  function U(y) {
    for (const m of (y == null ? void 0 : y.objectIds) ?? [n]) e.clearRegrab(m);
  }
  function Xt(y, m = n) {
    var rt, Y, J;
    if (dt() !== "landing") return;
    const v = h;
    if (!v || !p) return;
    const b = e.getGroup(p), q = b ? (rt = e.objects.get(b.primaryObjectId)) == null ? void 0 : rt.visual : void 0, at = e.resolveVisualTarget(p, g), _ = ((Y = e.objects.get(n)) == null ? void 0 : Y.element) ?? null, V = b ? ((J = e.objects.get(b.primaryObjectId)) == null ? void 0 : J.element) ?? null : Nn(
      () => N ?? at,
      () => _
    );
    if (!V) return;
    const B = e.findObjectIdByElement(V, n) ?? n, $ = e.createRegrabContext(p, y, v, V);
    if (!$) return;
    In({
      event: $.event,
      sessionId: p,
      proxy: v,
      source: V,
      interrupt: () => e.takeoverRegrab(p),
      clearRegrab: () => U(b)
    });
    const et = V.getBoundingClientRect();
    b ? (q && e.objects.update(b.primaryObjectId, { visual: q }), e.startGroupObjectPointer(
      b.objectIds,
      b.primaryObjectId,
      V,
      y,
      $.regrabRect,
      et
    )) : e.startObjectPointer(B, V, y, $.regrabRect, et);
  }
  const qt = {
    prepare(y) {
      var j;
      p = y.session.id, F = !1;
      const m = i.style.visibility === "hidden" || getComputedStyle(i).visibility === "hidden";
      if (z = e.createAutoScroller(p, {
        onScroll: (P) => ft(P.x, P.y)
      }), y.session.state !== "prepare") return;
      e.objects.setElement(n, i), i.style.visibility = "", i.style.pointerEvents = "", m && (i.style.transition = ""), R = e.acquireObject(p, n), e.takeSurfaces(p, d);
      const v = e.getGroup(p);
      O = !!v;
      const { beforePickup: b } = En(i, x, Z, mt);
      st = e.getObjectSurfaceIndex(n, u), L = i.cloneNode(!0);
      const q = e.getMoveContext(p), at = Pn(q, i, o, a, e.getObjectGrabAlign(n)), _ = at.rect;
      W = { x: at.offsetX, y: at.offsetY }, document.body.classList.add("kb-dragging"), e.applyVisualState(n, i, {
        phase: "dragging",
        hovered: i.matches(":hover"),
        selected: i.classList.contains("is-selected"),
        grabbed: !0
      }), A = kn((P, D) => e.captureVisualState(n, D), n, i), k = tn(i, p);
      const V = e.getObjectProxyLayout(n, i), B = !!(V != null && V.compact), $ = u ? e.resolveMoveSurfaceViewport(u) : null, et = !!($ && $.scrollHeight > $.clientHeight && $.scrollTop >= $.scrollHeight - $.clientHeight - 1), rt = ($ == null ? void 0 : $.scrollHeight) ?? 0;
      _e(i, _, {
        layout: V,
        contentScale: e.getSurfaceCameraPickupScale(u, p),
        // 多选时源卡是布局幽灵，不能像单卡 detach 一样整张隐藏；主代理
        // 负责跟手，源节点保留在原位并由 group visual 降低透明度。
        keepSourceVisible: !!(v && v.objectIds.length > 1)
      }), Ue(i, p);
      const Y = Ze(i);
      Y && e.registerVisualProxy(p, { element: Y }), Y && e.updateVisualProxy(p), i.style.pointerEvents = "none", !r && !v && (k.detachFromLayout(), et && K(rt, $)), i.style.transition = "none", v || e.scheduleLayout(b), i.dataset.runtimeActive = "true";
      const J = ((j = e.getVisualProxy(p)) == null ? void 0 : j.element) ?? se(i);
      if (!J) return;
      const pt = _.left, lt = _.top, ct = (P) => {
        if (!J.isConnected) return;
        e.updateVisualProxy(p);
        const D = P.x - pt, Q = P.y - lt;
        J.style.transform = `translate3d(${D.toFixed(2)}px, ${Q.toFixed(2)}px, 0) perspective(760px) rotateX(${P.rotateX.toFixed(2)}deg) rotateZ(${P.rotateZ.toFixed(2)}deg) scale(${P.scaleX.toFixed(4)}, ${P.scaleY.toFixed(4)})`;
      };
      if (e.getObjectMotionEnabled(n)) {
        const P = de({
          mode: "follow",
          followRotation: ie,
          onFrame: ct
        });
        P.setProfile(Le), P.seed({ x: _.left, y: _.top, scaleX: 1, scaleY: 1, rotateX: ie.tilt, rotateZ: 0 }), P.setTarget({
          x: o.clientX - W.x,
          y: o.clientY - W.y,
          scaleX: B ? 1 : 1.03,
          scaleY: B ? 1 : 1.03
        }), P.start(), I = P;
      } else {
        const P = en({ onFrame: ct });
        P.setTarget({ x: o.clientX - W.x, y: o.clientY - W.y }), I = P;
      }
      S = An(
        c(n),
        (P) => e.resolveMoveHit(n, P.clientX, P.clientY),
        (P, D) => P.columnId === (D == null ? void 0 : D.columnId) && P.index === (D == null ? void 0 : D.index)
      ), ft(o.clientX, o.clientY);
    },
    update(y, m) {
      m.event instanceof PointerEvent && Ct(m.event);
    },
    resolveDestination(y, m) {
      return It(m.event instanceof PointerEvent ? m.event : void 0);
    },
    commit: (y, m) => {
      e.getVisualProxy(p) || Bt(i);
      const v = typeof m == "object" && m !== null && m.invalidReturn === !0, b = typeof m == "object" && m !== null ? m.toSurfaceId ?? m.columnId : void 0;
      O || (r || v || !v && typeof b == "string" && b === u ? k == null || k.restoreLayoutHidden() : k == null || k.detachFromLayout()), document.body.classList.remove("kb-dragging");
    },
    cancel(y, m) {
      T = !0, I == null || I.stop(), I = null, e.getVisualProxy(p) ? e.disposeVisualProxy(p) : h ? (e.disposeVisualProxy(p), h = null) : Bt(i), U(e.getGroup(p)), document.body.classList.remove("kb-dragging"), delete i.dataset.runtimeActive, Bt(i), k == null || k.restore(), k = null, ot();
    }
  }, ht = {
    layout: Dn(i, x, Z, mt),
    surface: {
      // emit() 成功之后触发（见 RuntimeMove.ts MoveCommitCoordinator.commit），
      // 此时业务 store 已经落地在新 Surface，这里释放 ownership，业务
      // <Teleport :disabled="!isDetached(...)"> 传送回来的就是最终正确位置，
      // 不会有"先传送回原列、emit 生效后再传送一次"的中间态闪烁。
      // 无效落点（没有 emit）不会走到这里，在 onUp 里已经立刻释放过了。
      enter: () => R == null ? void 0 : R.release()
    },
    ...jn({
      createGate: () => e.createCompletionGate(p, { completed: !1, reason: "landing-cancelled" }),
      onGate: (y) => {
        M = y;
      },
      clearDragging: () => document.body.classList.remove("kb-dragging"),
      scheduleLanding: () => {
        C == null || C(), C = null;
      },
      clearRegrab: () => U(e.getGroup(p)),
      finishReveal: () => {
        h && Ut(h, !1), Bt(i), k == null || k.restore(), k = null, ot();
      }
    })
  };
  return { driver: qt, lifecycle: ht };
}
function ri(t) {
  return Hn({ ...t, clone: !0 });
}
export {
  tn as A,
  ln as B,
  qn as C,
  ce as D,
  de as E,
  Le as F,
  $t as G,
  Xe as H,
  ne as I,
  cn as J,
  te as K,
  Yt as L,
  Ie as M,
  ue as N,
  Fn as O,
  Gn as a,
  ti as b,
  Ne as c,
  bt as d,
  Kn as e,
  ri as f,
  St as g,
  Hn as h,
  Qn as i,
  he as j,
  _n as k,
  Zn as l,
  Un as m,
  Wn as n,
  ie as o,
  Ve as p,
  Jn as q,
  ei as r,
  ni as s,
  ii as t,
  je as u,
  Qt as v,
  mn as w,
  gn as x,
  ai as y,
  oi as z
};
