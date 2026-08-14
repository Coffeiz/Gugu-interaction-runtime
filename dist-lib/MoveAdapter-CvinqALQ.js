import { a as e, f as t, n, o as r } from "./GroupLayout-Dl0w6ktt.js";
//#region src/motion/ReleaseMotion.ts
var i = {
	velocityScale: 1,
	minVelocity: 30,
	maxVelocity: 5e3,
	dampingRatio: .78,
	maxCoast: 0,
	coastSeconds: .12
};
function a(e, t = i) {
	if (Math.hypot(e.x, e.y) < t.minVelocity) return {
		x: 0,
		y: 0
	};
	let n = e.x * t.velocityScale, r = e.y * t.velocityScale, a = Math.hypot(n, r);
	if (a <= t.maxVelocity || a === 0) return {
		x: n,
		y: r
	};
	let o = t.maxVelocity / a;
	return {
		x: n * o,
		y: r * o
	};
}
function o(e, t = i) {
	let n = a(e, t), r = Math.hypot(n.x, n.y) * t.coastSeconds;
	if (r <= 0 || t.maxCoast <= 0) return {
		x: 0,
		y: 0
	};
	let o = Math.min(1, t.maxCoast / r);
	return {
		x: n.x * t.coastSeconds * o,
		y: n.y * t.coastSeconds * o
	};
}
//#endregion
//#region src/motion/physics.ts
function s(e, t, n, r, i, a = 1 / 120) {
	let o = Math.max(0, i);
	for (; o > 1e-4;) {
		let i = Math.min(o, a);
		o -= i;
		let s = n * (t.x - e.position.x) - r * e.velocity.x, c = n * (t.y - e.position.y) - r * e.velocity.y;
		e.velocity.x += s * i, e.velocity.y += c * i, e.position.x += e.velocity.x * i, e.position.y += e.velocity.y * i;
	}
}
//#endregion
//#region src/motion/MotionProfile.ts
var c = {
	position: {
		stiffness: 420,
		damping: 41
	},
	scale: {
		stiffness: 420,
		damping: 41
	}
}, l = {
	position: {
		stiffness: 360,
		damping: 1.7 * Math.sqrt(360)
	},
	scale: {
		stiffness: 420,
		damping: 30
	}
}, u = {
	tilt: 5,
	sway: .25,
	smoothing: .2
}, d = {
	position: .35,
	velocity: 5,
	scalePosition: .001,
	scaleVelocity: .01
};
function f(e) {
	let t = e.mode ?? "settle";
	if (t === "follow" && !e.followRotation) throw Error("CardMotionController: mode \"follow\" 需要提供 followRotation 参数");
	let n = e.arriveThreshold ?? d, r = {
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
	}, i = {
		x: 0,
		y: 0
	}, a = c, o = null, l = null, u = !1, f = 0, p = 0, m = "settle", h = 0;
	function g() {
		e.onFrame({
			x: r.x,
			y: r.y,
			scaleX: r.scaleX,
			scaleY: r.scaleY,
			rotateX: r.rotateX,
			rotateZ: r.rotateZ
		});
	}
	function _(c) {
		if (!u) return;
		let b = Math.min(.032, Math.max(0, (c - (l ?? c)) / 1e3));
		if (l = c, m === "coast") {
			let e = Math.exp(-v.friction * b);
			r.vx *= e, r.vy *= e;
			let t = r.vx * b, n = r.vy * b, i = h + Math.hypot(t, n);
			if (i >= v.maxDistance) {
				let e = Math.max(0, v.maxDistance - h), i = Math.hypot(t, n), a = i > 0 ? e / i : 0;
				r.x += t * a, r.y += n * a, r.vx = 0, r.vy = 0, m = "settle";
			} else r.x += t, r.y += n, h = i, ((c - (y ?? c)) / 1e3 >= v.duration || Math.hypot(r.vx, r.vy) <= v.minVelocity) && (m = "settle");
		}
		if (m === "settle") {
			let e = {
				position: {
					x: r.x,
					y: r.y
				},
				velocity: {
					x: r.vx,
					y: r.vy
				}
			};
			s(e, {
				x: i.x,
				y: i.y
			}, a.position.stiffness, a.position.damping, b), r.x = e.position.x, r.y = e.position.y, r.vx = e.velocity.x, r.vy = e.velocity.y;
		}
		let x = {
			position: {
				x: r.scaleX,
				y: r.scaleY
			},
			velocity: {
				x: r.scaleVX,
				y: r.scaleVY
			}
		};
		if (s(x, {
			x: i.scaleX ?? r.scaleX,
			y: i.scaleY ?? r.scaleY
		}, a.scale.stiffness, a.scale.damping, b), r.scaleX = x.position.x, r.scaleY = x.position.y, r.scaleVX = x.velocity.x, r.scaleVY = x.velocity.y, t === "follow") {
			let t = e.followRotation, n = -Math.log(1 - (t.smoothing ?? .2)) * 60, i = 1 - Math.exp(-n * b);
			f += (r.vx - f) * i, p += (r.vy - p) * i, r.rotateZ = Math.max(-(t.maxSway ?? 5), Math.min(t.maxSway ?? 5, f / 60 * t.sway));
			let a = Math.max(-(t.maxTiltDelta ?? 4), Math.min(t.maxTiltDelta ?? 4, p / 60 * (t.verticalTiltFactor ?? .16)));
			r.rotateX = t.tilt + a;
		} else {
			let e = Math.exp(-10 * b);
			r.rotateX *= e, r.rotateZ *= e;
		}
		if (g(), t === "follow") {
			o = requestAnimationFrame(_);
			return;
		}
		if (m === "settle" && Math.abs(i.x - r.x) < n.position && Math.abs(i.y - r.y) < n.position && Math.abs(r.vx) < n.velocity && Math.abs(r.vy) < n.velocity && Math.abs((i.scaleX ?? r.scaleX) - r.scaleX) < (n.scalePosition ?? d.scalePosition) && Math.abs((i.scaleY ?? r.scaleY) - r.scaleY) < (n.scalePosition ?? d.scalePosition) && Math.abs(r.scaleVX) < (n.scaleVelocity ?? d.scaleVelocity) && Math.abs(r.scaleVY) < (n.scaleVelocity ?? d.scaleVelocity)) {
			u = !1, o = null, e.onArrived?.();
			return;
		}
		o = requestAnimationFrame(_);
	}
	let v = null, y = null;
	return {
		seed(e) {
			Object.assign(r, e);
		},
		setTarget(e) {
			i = { ...e };
		},
		retarget(e) {
			i = { ...e };
		},
		setProfile(e) {
			a = e;
		},
		getState() {
			return r;
		},
		start() {
			u || (u = !0, m = "settle", v = null, y = null, l = null, g(), o = requestAnimationFrame(_));
		},
		startCoastThenSettle(e) {
			if (u) return;
			u = !0, m = "coast", v = e, h = 0, y = null;
			let t = Math.hypot(r.vx, r.vy), n = e.maxDistance / Math.max(e.duration, 1 / 60);
			if (t > n && t > 0) {
				let e = n / t;
				r.vx *= e, r.vy *= e;
			}
			l = null, g(), o = requestAnimationFrame((e) => {
				y = e, _(e);
			});
		},
		interrupt() {
			return u = !1, o !== null && cancelAnimationFrame(o), o = null, { ...r };
		},
		cancel() {
			return u = !1, o !== null && cancelAnimationFrame(o), o = null, { ...r };
		},
		stop() {
			u = !1, o !== null && cancelAnimationFrame(o), o = null;
		}
	};
}
//#endregion
//#region src/motion/FreeLandingMotion.ts
function p(e, t, n, r) {
	let i = 3 * e - 3 * n + 1, a = 3 * n - 6 * e, o = 3 * e, s = 3 * t - 3 * r + 1, c = 3 * r - 6 * t, l = 3 * t, u = (e) => ((i * e + a) * e + o) * e, d = (e) => ((s * e + c) * e + l) * e, f = (e) => (3 * i * e + 2 * a) * e + o;
	return (e) => {
		let t = e;
		for (let n = 0; n < 8; n += 1) {
			let n = u(t) - e;
			if (Math.abs(n) < 1e-4) break;
			let r = f(t);
			if (Math.abs(r) < 1e-6) break;
			t -= n / r;
		}
		return d(Math.max(0, Math.min(1, t)));
	};
}
function m(e) {
	let t = e.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
	return t ? p(...t.slice(1).map(Number)) : e === "linear" ? (e) => e : e === "ease-in" ? p(.42, 0, 1, 1) : e === "ease-out" ? p(0, 0, .58, 1) : e === "ease-in-out" ? p(.42, 0, .58, 1) : p(.22, 1, .36, 1);
}
function h(e) {
	let t = {
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
	}, n = {
		x: 0,
		y: 0
	}, r = { ...t }, i = 0, a = null, o = !1, s = m(e.easing), c = (i) => {
		let a = s(Math.max(0, Math.min(1, i)));
		t.x = r.x + (n.x - r.x) * a, t.y = r.y + (n.y - r.y) * a, t.scaleX = r.scaleX + ((n.scaleX ?? r.scaleX) - r.scaleX) * a, t.scaleY = r.scaleY + ((n.scaleY ?? r.scaleY) - r.scaleY) * a, t.rotateX = r.rotateX * (1 - a), t.rotateZ = r.rotateZ * (1 - a), e.onFrame({
			x: t.x,
			y: t.y,
			scaleX: t.scaleX,
			scaleY: t.scaleY,
			rotateX: t.rotateX,
			rotateZ: t.rotateZ
		});
	}, l = (t) => {
		if (!o) return;
		let n = e.duration <= 0 ? 1 : (t - i) / e.duration;
		if (c(n), n >= 1) {
			o = !1, a = null, e.onArrived?.();
			return;
		}
		a = requestAnimationFrame(l);
	};
	return {
		seed(e) {
			Object.assign(t, e);
		},
		setTarget(e) {
			n = { ...e };
		},
		retarget(e) {
			if (!o) {
				n = { ...e };
				return;
			}
			r = { ...t }, n = { ...e }, i = performance.now();
		},
		start() {
			o || (o = !0, r = { ...t }, i = performance.now(), c(0), a = requestAnimationFrame(l));
		},
		stop() {
			o = !1, a !== null && cancelAnimationFrame(a), a = null;
		}
	};
}
//#endregion
//#region src/dom/ProxyVisualContext.ts
var g = [
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
function _(e) {
	let t = getComputedStyle(e);
	return Object.fromEntries(g.map((e) => [e, t.getPropertyValue(e)]));
}
function v(e, t) {
	for (let n of g) {
		let r = t[n];
		r && e.style.setProperty(n, r);
	}
}
function y(e, t) {
	v(t, _(e));
}
//#endregion
//#region src/dom/Visual.ts
function b(e, t) {
	e.style.pointerEvents = t ? "auto" : "none";
}
function x(e, t) {
	e.style.setProperty("box-shadow", t, "important");
}
function S(e, t) {
	let n = getComputedStyle(e);
	t.style.border = n.border, t.style.borderRadius = n.borderRadius, t.style.setProperty("box-shadow", n.boxShadow, "important"), t.style.backgroundColor = n.backgroundColor, t.style.backgroundImage = n.backgroundImage, t.style.backdropFilter = n.backdropFilter, t.style.setProperty("-webkit-backdrop-filter", n.backdropFilter);
}
function C(e) {
	e.classList.remove("is-grabbed", "is-hovered"), delete e.dataset.runtimeProxy, delete e.dataset.runtimeProxyContent, delete e.dataset.runtimePhase, delete e.dataset.runtimeCompact;
}
function w(e, t, n) {
	e.fromLayer.style.opacity = "1", e.toLayer.style.opacity = "0", e.contentRoot.offsetWidth, requestAnimationFrame(() => {
		e.fromLayer.style.transition = `opacity ${t}ms ${n}`, e.toLayer.style.transition = `opacity ${t}ms ${n}`, requestAnimationFrame(() => {
			e.fromLayer.style.opacity = "0", e.toLayer.style.opacity = "1";
		});
	});
}
function T(e, t = e.getBoundingClientRect(), n = {}) {
	let r = n.layout?.compact, i = document.createElement("div"), a = document.createElement("div"), o = e.cloneNode(!0);
	a.dataset.runtimeProxyScaleShell = "true", n.cameraShell && (a.dataset.runtimeCameraShell = "true"), o.dataset.runtimeProxyContent = "true", Object.assign(a.style, {
		position: "absolute",
		left: "0",
		top: "0",
		transformOrigin: "0 0",
		pointerEvents: "none"
	}), Object.assign(o.style, {
		position: "absolute",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		margin: "0",
		pointerEvents: "none"
	}), o.dataset.runtimePhase = "grab-start", a.appendChild(o), i.appendChild(a), i.className = "", i.style.position = "fixed", i.style.left = `${t.left}px`, i.style.top = `${t.top}px`, i.style.boxSizing = "border-box", i.style.width = `${t.width}px`, i.style.height = `${t.height}px`, D(i, n.contentScale), i.style.margin = "0", i.style.zIndex = "2147483647", i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = "scale(1)", J && n.glass !== !1 ? ae(o) : x(o, "0 12px 24px rgba(0,0,0,.18)"), r && (o.dataset.runtimeCompact = "true");
	let s = r?.duration ?? 200, c = r?.easing ?? "cubic-bezier(.22,1,.36,1)";
	return o.style.transition = `left ${s}ms ${c}, width ${s}ms ${c}, transform ${s}ms ${c}, grid-template-columns ${s}ms ${c}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, i.style.transition = "transform .15s ease", document.documentElement.appendChild(i), requestAnimationFrame(() => {
		i.isConnected && o.dataset.runtimePhase === "grab-start" && (o.dataset.runtimePhase = "grabbing", r && (o.style.left = r.left ?? "50%", o.style.width = r.width, o.style.transform = r.transform ?? "translateX(-50%)", r.gridTemplateColumns && (o.style.gridTemplateColumns = r.gridTemplateColumns)));
	}), q.add(i), i;
}
function E(e) {
	let t = typeof e == "function" ? e() : e;
	return typeof t == "number" && Number.isFinite(t) && t > 0 ? t : 1;
}
function D(e, t) {
	let n = E(t), r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = Number(e.dataset.runtimeProxyBaseWidth) || r / n, o = Number(e.dataset.runtimeProxyBaseHeight) || i / n;
	e.dataset.runtimeProxyBaseWidth = String(a), e.dataset.runtimeProxyBaseHeight = String(o);
	let s = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!s) return;
	s.style.width = `${a}px`, s.style.height = `${o}px`;
	let c = parseFloat(e.style.width) || r, l = parseFloat(e.style.height) || i;
	s.style.left = `${(c - a * n) / 2}px`, s.style.top = `${(l - o * n) / 2}px`, s.style.transform = `scale(${n})`;
}
function O(e, t) {
	let n = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!n) return null;
	let r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = t > 0 ? t : 1, o = Number(e.dataset.runtimeProxyBaseWidth) || r / a, s = Number(e.dataset.runtimeProxyBaseHeight) || i / a;
	return n.style.width = `${o}px`, n.style.height = `${s}px`, n.style.left = `${(r - o * a) / 2}px`, n.style.top = `${(i - s * a) / 2}px`, n.style.transform = `scale(${a})`, {
		shell: n,
		baseWidth: o,
		baseHeight: s
	};
}
function k(e, t, n, r) {
	let i = e.baseWidth * r, a = e.baseHeight * r;
	e.shell.style.left = `${((t - i) / 2).toFixed(2)}px`, e.shell.style.top = `${((n - a) / 2).toFixed(2)}px`, e.shell.style.transform = `scale(${r})`;
}
function A(e) {
	return e;
}
function j(e) {
	return e.querySelector("[data-runtime-proxy-content]:not([data-runtime-group-modifier])") ?? e;
}
function M(e) {
	let t = [], n = 0, r = 0;
	for (let i = 0; i < e.length; i += 1) {
		let a = e[i];
		a === "(" ? r += 1 : a === ")" ? r = Math.max(0, r - 1) : a === "," && r === 0 && (t.push(e.slice(n, i).trim()), n = i + 1);
	}
	let i = e.slice(n).trim();
	return i && t.push(i), t;
}
function N(e, t) {
	let n = M(e), r = M(t);
	if (n.length >= r.length || n.length === 0) return e;
	let i = /* @__PURE__ */ new Map();
	i.set("inset", n.filter((e) => /\binset\b/i.test(e))), i.set("outer", n.filter((e) => !/\binset\b/i.test(e)));
	let a = (e) => /\binset\b/i.test(e) ? "inset 0 0 0 0 rgba(0, 0, 0, 0)" : "0 0 0 0 rgba(0, 0, 0, 0)", o = /* @__PURE__ */ new Map([["inset", 0], ["outer", 0]]);
	return r.map((e) => {
		let t = /\binset\b/i.test(e) ? "inset" : "outer", n = i.get(t) ?? [], r = o.get(t) ?? 0;
		return r < n.length ? (o.set(t, r + 1), n[r]) : a(e);
	}).join(", ");
}
function P(e, t, n) {
	if (t == null) {
		e.style.transition = n;
		return;
	}
	let r = e.style.boxShadow || getComputedStyle(e).boxShadow;
	e.style.transition = "none", x(e, N(r, t)), e.offsetWidth, e.style.transition = n;
}
function F(e, t) {
	let n = e.cloneNode(!0), r = document.createElement("div");
	r.dataset.runtimeProxyContent = "true", e.dataset.runtimePhase && (r.dataset.runtimePhase = e.dataset.runtimePhase), e.dataset.runtimeCompact === "true" && (r.dataset.runtimeCompact = "true"), Object.assign(r.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		margin: "0",
		pointerEvents: "none"
	}), delete n.dataset.runtimeProxyContent, delete n.dataset.runtimePhase, delete n.dataset.runtimeCompact, Object.assign(n.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		opacity: "1",
		pointerEvents: "none"
	});
	let i = t.cloneNode(!0);
	y(t, i), C(i), S(t, i), delete i.dataset.runtimePhase, delete i.dataset.runtimeCompact, Object.assign(i.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		opacity: "0",
		margin: "0",
		pointerEvents: "none",
		visibility: "visible"
	});
	let a = document.createElement("div");
	return a.dataset.runtimeProxyTargetContentScaleShell = "true", Object.assign(a.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		margin: "0",
		pointerEvents: "none",
		transformOrigin: "50% 50%",
		transform: "scale(1)",
		overflow: "visible"
	}), a.append(i), r.append(n, a), e.replaceWith(r), r.style.border = "0", r.style.borderRadius = "0", r.style.setProperty("box-shadow", "none", "important"), r.style.background = "transparent", r.style.backdropFilter = "none", r.style.setProperty("-webkit-backdrop-filter", "none"), {
		contentRoot: r,
		fromLayer: n,
		toLayer: i,
		targetScaleShell: a
	};
}
function I(e, t) {
	let n = Math.max(t.left, t.right - e.width), r = Math.max(t.top, t.bottom - e.height);
	return {
		left: Math.min(Math.max(e.left, t.left), n),
		top: Math.min(Math.max(e.top, t.top), r),
		width: e.width,
		height: e.height
	};
}
function L(e, n, r = {}) {
	let i = r.duration ?? t.landing.duration, a = r.easing ?? "cubic-bezier(.22,1,.36,1)", o = r.targetShadow, s = r.targetRadius, c = r.targetBorder, l = r.targetBackdropFilter, u = r.targetBackground, d = r.targetOpacity, f = j(e), p = r.targetContent ? F(f, r.targetContent) : null;
	p && (f = p.contentRoot);
	let m = p?.fromLayer ?? f, h = p?.toLayer ?? f;
	p && (p.fromLayer.style.transition = "none", p.toLayer.style.transition = "none"), E(r.contentScale);
	let g = parseFloat(e.style.left) || 0, _ = parseFloat(e.style.top) || 0, v = !1, y = n, b = performance.now(), S = () => void 0, C = () => void 0, T = new Promise((e) => {
		C = e;
	}), D = () => {
		let t = e.getBoundingClientRect();
		return Math.abs(t.left - y.left) < 2 && Math.abs(t.top - y.top) < 2 && Math.abs(t.width - y.width) < 2 && Math.abs(t.height - y.height) < 2;
	}, O = null, k = null, A = 0, M = (t) => {
		v || (v = !0, e.removeEventListener("transitionend", S), k !== null && (window.clearTimeout(k), k = null), C());
	}, N = () => {
		if (!v) {
			if (D()) {
				M("waitForTarget:isAtTarget");
				return;
			}
			if (performance.now() - b >= i + 500) {
				M("waitForTarget:timeout");
				return;
			}
			window.requestAnimationFrame(N);
		}
	}, I = (t, n = i) => {
		y = t;
		let v = e.getBoundingClientRect();
		e.style.transition = "none", e.style.width = `${v.width.toFixed(2)}px`, e.style.height = `${v.height.toFixed(2)}px`, e.style.transform = `translate3d(${(v.left - g).toFixed(2)}px, ${(v.top - _).toFixed(2)}px, 0)`, e.style.transform = "none", e.offsetWidth;
		let b = `translate3d(${(t.left - g).toFixed(2)}px, ${(t.top - _).toFixed(2)}px, 0)`;
		e.style.transition = `transform ${n}ms ${a}, width ${n}ms ${a}, height ${n}ms ${a}`;
		let S = [
			`box-shadow ${n}ms ease`,
			`border-radius ${n}ms ease`,
			`border-color ${n}ms ease`,
			`backdrop-filter ${n}ms ease`,
			`-webkit-backdrop-filter ${n}ms ease`,
			`background-color ${n}ms ease`,
			`background-image ${n}ms ease`,
			`opacity ${n}ms ease`
		].join(", ");
		P(m, o, S), p && P(h, o, S), requestAnimationFrame(() => {
			e.style.transform = b, e.style.width = `${t.width.toFixed(2)}px`, e.style.height = `${t.height.toFixed(2)}px`, o != null && x(f, o), s != null && (h.style.borderRadius = s), c != null && (h.style.border = c), l != null && (h.style.backdropFilter = l, h.style.setProperty("-webkit-backdrop-filter", l)), u != null && (h.style.backgroundColor = u, r.targetBackgroundImage && (h.style.backgroundImage = r.targetBackgroundImage)), d != null && (h.style.opacity = d), p && w(p, n, a);
		});
	};
	S = (t) => {
		t.target === e && (t.propertyName === "transform" || t.propertyName === "width" || t.propertyName === "height") && D() && M(`transitionend:${t.propertyName}`);
	}, e.addEventListener("transitionend", S), I(n), window.setTimeout(N, i + 40);
	let L = (e) => {
		A = performance.now();
		let t = Math.max(80, i - (A - b));
		I(r.readTarget?.() ?? e, t);
	};
	return {
		finished: T,
		retarget: (e) => {
			if (v) return;
			let t = Math.abs(e.left - y.left), n = Math.abs(e.top - y.top), r = Math.abs(e.width - y.width), i = Math.abs(e.height - y.height);
			if (t < .5 && n < .5 && r < .5 && i < .5) return;
			let a = performance.now() - A;
			if (a >= 60) {
				L(e);
				return;
			}
			O = e, k === null && (k = window.setTimeout(() => {
				if (k = null, v || !O) return;
				let e = O;
				O = null, L(e);
			}, 60 - a));
		}
	};
}
function R(e, n, r = {}) {
	let i = r.duration ?? t.landing.duration, a = r.easing ?? "cubic-bezier(.22,1,.36,1)", o = r.targetShadow, s = r.targetRadius, l = r.targetBorder, u = r.targetBackdropFilter, d = r.targetBackground, p = r.targetOpacity, m = j(e), g = e.querySelector("[data-runtime-proxy-scale-shell]"), _ = r.targetContent ? F(m, r.targetContent) : null;
	_ && (m = _.contentRoot);
	let v = _?.fromLayer ?? m, y = _?.toLayer ?? m;
	_ && (_.fromLayer.style.transition = "none", _.toLayer.style.transition = "none"), _ && (_.targetScaleShell.style.transformOrigin = "50% 50%", _.targetScaleShell.style.transition = "none", _.targetScaleShell.style.transform = "scale(1)");
	let b = E(r.contentScale), S = parseFloat(e.style.left) || e.getBoundingClientRect().left, C = parseFloat(e.style.top) || e.getBoundingClientRect().top, T = e.getBoundingClientRect(), D = parseFloat(e.style.width) || T.width || n.width, A = parseFloat(e.style.height) || T.height || n.height, M = O(e, b), N = M && r.landingContentScale !== void 0 ? E(r.landingContentScale) : b, I = r.cameraOrigin?.(), L = !!(r.cameraShell && r.landingMode === "free" && I && Number.isFinite(I.left) && Number.isFinite(I.top)), R = null, z = null;
	if (L && I) {
		R = document.createElement("div"), R.dataset.runtimeCameraGlue = "true", Object.assign(R.style, {
			position: "fixed",
			left: "0",
			top: "0",
			right: "0",
			bottom: "0",
			transition: "none",
			transform: "translate3d(0, 0, 0)",
			transformOrigin: `${I.left}px ${I.top}px`,
			pointerEvents: "none",
			zIndex: e.style.zIndex,
			willChange: "transform"
		}), e.parentElement?.appendChild(R), R.appendChild(e);
		let t = () => {
			if (!R?.isConnected) return;
			let e = r.cameraOrigin?.();
			if (e && Number.isFinite(e.left) && Number.isFinite(e.top)) {
				let t = E(r.contentScale), n = b > .01 ? t / b : 1;
				R.style.transform = `translate3d(${(e.left - I.left).toFixed(2)}px, ${(e.top - I.top).toFixed(2)}px, 0) scale(${n.toFixed(4)})`;
			}
			z = window.requestAnimationFrame(t);
		};
		z = window.requestAnimationFrame(t);
	}
	let B = (e) => ({
		left: e.left - (D - e.width) / 2,
		top: e.top - (A - e.height) / 2,
		width: e.width,
		height: e.height
	}), V = n, ee = performance.now(), H = !1, U = r.landingMode === "target" && !!g, te = U ? r.dismiss?.duration ?? i : 0, W = !1, G = null, ne = !U, K = null, q = null, J = 0, re = () => void 0, ie = new Promise((e) => {
		re = e;
	}), ae = () => {
		H || (H = !0, X.stop(), K !== null && window.clearTimeout(K), q !== null && window.clearTimeout(q), K = null, q = null, z !== null && window.cancelAnimationFrame(z), z = null, G !== null && window.cancelAnimationFrame(G), G = null, R?.remove(), R = null, re());
	}, Y = () => {
		W && ne && ae();
	}, oe = () => {
		H || G === null && (G = window.requestAnimationFrame(() => {
			if (G = null, H) return;
			let e = r.readTarget?.();
			if (e && e.width > 0 && e.height > 0 && (Math.abs(e.left - V.left) >= .5 || Math.abs(e.top - V.top) >= .5 || Math.abs(e.width - V.width) >= .5 || Math.abs(e.height - V.height) >= .5)) {
				V = e;
				let t = B(e), n = r.landingMode === "target" ? 1 : t.width / (r.landingMode === "free" ? de : D), i = r.landingMode === "target" ? 1 : t.height / (r.landingMode === "free" ? fe : A);
				X.retarget({
					x: t.left,
					y: t.top,
					scaleX: n,
					scaleY: i
				}), X.start();
				return;
			}
			W = !0, Y();
		}));
	}, se = (t) => {
		let n = t.x, a = t.y;
		if (e.style.transform = `perspective(760px) translate3d(${(n - S).toFixed(2)}px, ${(a - C).toFixed(2)}px, 0) rotateX(${t.rotateX.toFixed(2)}deg) rotateZ(${t.rotateZ.toFixed(2)}deg)`, r.landingMode === "free" && M) k(M, D, A, t.scaleX * b);
		else {
			let n = D * t.scaleX, a = A * t.scaleY, o = t.x + (D - n) / 2, s = t.y + (A - a) / 2;
			if (e.style.width = `${n.toFixed(2)}px`, e.style.height = `${a.toFixed(2)}px`, e.style.transform = `perspective(760px) translate3d(${(o - S).toFixed(2)}px, ${(s - C).toFixed(2)}px, 0) rotateX(${t.rotateX.toFixed(2)}deg) rotateZ(${t.rotateZ.toFixed(2)}deg)`, !(r.landingMode === "target" && U) && M) {
				let e = Math.max(0, performance.now() - ee), o = 1 - (1 - Math.min(1, e / Math.max(1, i))) ** 3, s = b + (N - b) * o;
				r.cameraShell ? k(M, n, a, r.landingContentScale === void 0 ? t.scaleX * s : s) : (M.shell.style.left = "0px", M.shell.style.top = "0px", M.shell.style.width = `${n}px`, M.shell.style.height = `${a}px`, M.shell.style.transform = "scale(1)");
			}
		}
	}, X = r.landingMode === "free" ? h({
		duration: i,
		easing: a,
		onFrame: se,
		onArrived: oe
	}) : f({
		mode: "settle",
		onFrame: se,
		onArrived: oe
	}), ce = Math.hypot(r.motionState?.vx ?? 0, r.motionState?.vy ?? 0), le = r.releaseDamping ?? .78, Z = r.targetMotion ? {
		position: {
			...c.position,
			...r.targetMotion.position
		},
		scale: {
			...c.scale,
			...r.targetMotion.scale
		}
	} : c;
	r.landingMode !== "free" && X.setProfile(ce > 30 ? {
		...Z,
		position: {
			...Z.position,
			damping: Z.position.damping * le
		}
	} : Z), X.seed({
		x: r.motionState?.x ?? T.left,
		y: r.motionState?.y ?? T.top,
		vx: r.motionState?.vx ?? 0,
		vy: r.motionState?.vy ?? 0,
		scaleX: r.motionState?.scaleX ?? 1,
		scaleY: r.motionState?.scaleY ?? 1,
		rotateX: r.motionState?.rotateX ?? 0,
		rotateZ: r.motionState?.rotateZ ?? 0
	});
	let Q = B(n), $ = M?.baseWidth ?? D, ue = M?.baseHeight ?? A;
	M && r.landingMode !== "free" && r.landingMode !== "target" && (N > 0 || (N = $ > 0 ? Q.width / $ : 1), M.shell.style.transformOrigin = "0 0", r.cameraShell ? (M.shell.style.left = `${((D - $ * b) / 2).toFixed(2)}px`, M.shell.style.top = `${((A - ue * b) / 2).toFixed(2)}px`, M.shell.style.transform = b === 1 ? "scale(1)" : `scale(${b}, ${b})`) : (M.shell.style.left = "0px", M.shell.style.top = "0px", M.shell.style.width = `${D}px`, M.shell.style.height = `${A}px`, M.shell.style.transform = "scale(1)"), M.shell.style.transition = "none");
	let de = $ * b, fe = ue * b, pe = r.landingMode === "target" ? {
		scaleX: 1,
		scaleY: 1
	} : r.landingMode === "free" ? {
		scaleX: de > 0 ? Q.width / de : 1,
		scaleY: fe > 0 ? Q.height / fe : 1
	} : {
		scaleX: D > 0 ? Q.width / D : 1,
		scaleY: A > 0 ? Q.height / A : 1
	};
	X.setTarget({
		x: Q.left,
		y: Q.top,
		scaleX: pe.scaleX,
		scaleY: pe.scaleY
	}), e.style.transition = "";
	let me = [
		...r.landingMode === "target" ? [] : [
			`left ${i}ms ${a}`,
			`width ${i}ms ${a}`,
			`transform ${i}ms ${a}`,
			`grid-template-columns ${i}ms ${a}`
		],
		`box-shadow ${i}ms ${a}`,
		`border-radius ${i}ms ${a}`,
		`border-color ${i}ms ${a}`,
		`backdrop-filter ${i}ms ${a}`,
		`-webkit-backdrop-filter ${i}ms ${a}`,
		`background-color ${i}ms ${a}`,
		`background-image ${i}ms ${a}`,
		`opacity ${i}ms ${a}`
	].join(", ");
	P(v, o, me), _ && P(y, o, me), requestAnimationFrame(() => {
		if (!H) {
			if (r.landingMode !== "target" && (m.dataset.runtimePhase = "landing", m.dataset.runtimeCompact === "true" && (m.style.left = "0", m.style.width = "100%", m.style.transform = "none", m.style.gridTemplateColumns = "", _ || (m.style.gridTemplateColumns = "", delete m.dataset.runtimeCompact))), o != null && (m.offsetWidth, x(m, o)), s != null && (y.style.borderRadius = s), l != null && (y.style.border = l), u != null && (y.style.backdropFilter = u, y.style.setProperty("-webkit-backdrop-filter", u)), d != null && (y.style.backgroundColor = d, r.targetBackgroundImage && (y.style.backgroundImage = r.targetBackgroundImage)), p != null && (y.style.opacity = p), U && g) {
				let e = r.dismiss?.easing ?? a, t = r.dismiss?.scale ?? .72;
				g.style.transformOrigin = "50% 50%", g.style.transition = `transform ${te}ms ${e}`, y.style.transition = `opacity ${te}ms ${e}`, g.style.transform = `scale(${t})`, y.style.opacity = "0", q = window.setTimeout(() => {
					q = null, ne = !0, Y();
				}, te + 40);
			}
			_ && w(_, i, a);
		}
	});
	let he = (e = 0) => {
		K !== null && window.clearTimeout(K), J = performance.now() + Math.max(2e3, i * 8, 5e3) + e, K = window.setTimeout(() => {
			K = null, !H && performance.now() >= J && oe();
		}, Math.max(2e3, i * 8, 5e3) + e);
	};
	he();
	let ge = r.coast;
	return r.landingMode === "free" ? X.start() : ge && ge.maxDistance > 0 && Math.hypot(r.motionState?.vx ?? 0, r.motionState?.vy ?? 0) > ge.minVelocity ? X.startCoastThenSettle(ge) : X.start(), {
		finished: ie,
		retarget(e) {
			if (H) return;
			V = e, he(1e3);
			let t = B(V), n = r.landingMode === "target" ? 1 : r.landingMode === "free" ? t.width / de : t.width / D, i = r.landingMode === "target" ? 1 : r.landingMode === "free" ? t.height / fe : t.height / A;
			M && r.landingMode !== "free" && r.landingMode !== "target" && r.landingContentScale === void 0 && (N = $ > 0 ? t.width / $ : N), X.setTarget({
				x: t.left,
				y: t.top,
				scaleX: n,
				scaleY: i
			});
		}
	};
}
function z(e) {
	if (!q.has(e)) return;
	q.delete(e);
	let t = e.parentElement?.dataset.runtimeCameraGlue === "true" ? e.parentElement : null;
	t?.remove(), t || e.remove();
}
var B = /* @__PURE__ */ new WeakMap(), V = [
	"left",
	"top",
	"right",
	"bottom",
	"width",
	"height",
	"minWidth",
	"minHeight",
	"maxWidth",
	"maxHeight",
	"zIndex"
];
function ee(e, t) {
	let n = Object.fromEntries(V.map((t) => [t, e.style[t]]));
	e.style.cssText = t;
	for (let t of V) n[t] !== "" && (e.style[t] = n[t]);
}
var H = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakSet();
function te(e, t, n = {}) {
	B.set(e, { style: e.getAttribute("style") ?? "" });
	let r = T(e, t, {
		glass: !1,
		layout: n.layout,
		contentScale: n.contentScale,
		cameraShell: n.cameraShell
	}), i = j(r);
	y(e, i);
	let a = i.style.transition;
	i.style.transition = "none", x(i, "none"), i.offsetWidth, i.style.transition = a;
	let o = !!n.layout?.compact;
	r.style.zIndex = "1000", r.style.transform = "scale(1)", r.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", U.add(r), H.set(e, r), n.keepSourceVisible || (e.style.visibility = "hidden"), requestAnimationFrame(() => {
		!r.isConnected || !U.has(r) || W(r, o);
	});
}
function W(e, t = !1, n = !0) {
	if (!e.isConnected) return;
	let r = j(e);
	J ? ae(r) : x(r, "0 12px 24px rgba(0,0,0,.18)"), n && (e.style.transform = `scale(${t ? 1 : 1.03})`);
}
function G(e) {
	return H.get(e);
}
function ne(e) {
	let t = H.get(e);
	if (t) return requestAnimationFrame(() => {
		!t.isConnected || j(t).dataset.runtimePhase === "landing" || W(t, j(t).dataset.runtimeCompact === "true", !1);
	}), U.delete(t), H.delete(e), B.delete(e), t.style.zIndex = "2147483647", t;
}
function K(e) {
	let t = H.get(e);
	t && (U.delete(t), t.remove(), q.delete(t), H.delete(e));
	let n = B.get(e);
	n && ee(e, n.style), B.delete(e);
}
var q = /* @__PURE__ */ new Set(), J = !1;
function re(e) {
	J = e;
}
function ie() {
	return J;
}
function ae(e) {
	e.style.background = "rgba(255, 255, 255, 0.42)", e.style.backdropFilter = "blur(12px) saturate(1.15)", e.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), e.style.border = "1px solid rgba(255, 255, 255, 0.72)", x(e, "0 22px 50px rgba(30, 35, 60, 0.30)"), e.style.opacity = "0.97";
}
var Y = /* @__PURE__ */ new Map();
function oe(e, t) {
	Y.set(e, t), e.style.visibility = "hidden";
}
function se(e, t) {
	(e.style.visibility === "hidden" || getComputedStyle(e).visibility === "hidden") && Y.set(e, t);
}
function X(e, t) {
	let n = Y.get(e) === t;
	return n && (e.style.visibility = "", Y.delete(e)), n;
}
function ce(e, t) {
	Y.get(e) === t && Y.delete(e);
}
//#endregion
//#region src/dom/SourceVisualLease.ts
var le = [
	"left",
	"top",
	"right",
	"bottom",
	"width",
	"height",
	"minWidth",
	"minHeight",
	"maxWidth",
	"maxHeight",
	"zIndex"
];
function Z(e) {
	return Object.fromEntries(le.map((t) => [t, e.style[t]]));
}
function Q(e, t) {
	let n = Z(e);
	e.style.cssText = t;
	for (let t of le) n[t] !== "" && (e.style[t] = n[t]);
}
var $ = /* @__PURE__ */ new WeakMap();
function ue(e, t) {
	let n = {
		sessionId: t,
		cssText: e.style.cssText
	};
	$.set(e, n);
	let r = () => $.get(e) === n;
	return {
		element: e,
		sessionId: t,
		detachFromLayout: () => r() ? (e.style.display = "none", e.style.pointerEvents = "none", !0) : !1,
		restoreLayoutHidden: () => r() ? (e.style.display = "", e.style.visibility = "hidden", e.style.pointerEvents = "none", !0) : !1,
		restore: () => r() ? (Q(e, n.cssText), $.delete(e), !0) : !1,
		isOwner: r
	};
}
//#endregion
//#region src/motion/DirectFollowController.ts
function de(e) {
	let t = {
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
			t.x = n.x, t.y = n.y, e.onFrame({
				x: t.x,
				y: t.y,
				scaleX: 1,
				scaleY: 1,
				rotateX: 0,
				rotateZ: 0
			});
		},
		getState: () => t,
		stop() {}
	};
}
//#endregion
//#region src/runtime/DetachMoveDriver.ts
function fe(e, t, n) {
	let r = e(t, n);
	return {
		...r,
		boxShadow: n.style.boxShadow || r.boxShadow,
		transform: n.style.transform || r.transform
	};
}
function pe(e, t, n, r, i) {
	let a = r ?? t.getBoundingClientRect(), o = i?.align ?? "center", s = o === "pointer" ? n.clientX - a.left : a.width / 2, c = o === "pointer" ? n.clientY - a.top : a.height / 2, l = s - (i?.offsetX ?? 0), u = c - (i?.offsetY ?? 0);
	return r && (e.dragOffset = {
		x: l,
		y: u
	}), {
		rect: a,
		offsetX: l,
		offsetY: u
	};
}
function me(e) {
	return (t) => t === e || t.contains(e);
}
function he(e, t, r, i) {
	let a = e.cloneNode(!0), o = t().filter((t) => t !== e && t.dataset.runtimeProxy !== "true");
	return {
		beforeContent: a,
		beforePickup: n(o, document, !0, me(e), {
			scopeSurfaces: r?.(),
			surfaceMeasures: i?.()
		})
	};
}
function ge(e, t, n) {
	let r = e, i = null;
	return {
		update(e, a) {
			let o = t(e);
			return o ? n(o, i) ? i : (r = a(o), i = o, i) : (i = null, null);
		},
		release() {
			return i;
		},
		get currentSurface() {
			return r;
		}
	};
}
function _e(e) {
	return e.active ? e.state.update(e.event, e.getSurface) : null;
}
function ve(e) {
	e.event.stopPropagation(), b(e.proxy, !1), e.clearRegrab(), ce(e.source, e.sessionId), e.interrupt(), e.source.style.visibility = "hidden";
}
function ye(e, t) {
	return () => requestAnimationFrame(() => {
		e(), t();
	});
}
function be(e) {
	let t = e.resolve();
	return t ? (e.applyState(t), t) : null;
}
function xe(e, t, n = {}) {
	let r = t.style.transition, i = t.style.opacity, a = t.style.pointerEvents, o = getComputedStyle(t).opacity;
	t.dataset.runtimeLandingCapture = "true", t.style.transition = "none", t.style.pointerEvents = "none", n.ignoreTemporaryOpacity && (i === "0" || o === "0") && (t.style.opacity = "1");
	try {
		t.offsetWidth;
		let r = e(t);
		return n.ignoreTemporaryOpacity && (i === "0" || o === "0" || r.opacity === "0") ? {
			...r,
			opacity: "1"
		} : r;
	} finally {
		t.style.opacity = i, t.style.pointerEvents = a, t.style.transition = r, delete t.dataset.runtimeLandingCapture;
	}
}
function Se(e) {
	return {
		...e.createContext(),
		sourceElement: e.source,
		sourceRect: e.sourceRect,
		visualSnapshot: e.visualSnapshot,
		targetSnapshot: e.targetSnapshot,
		motionState: e.motionState
	};
}
function Ce(e) {
	let t = e.createProxy();
	return t ? (e.enableProxy(t.element), e.bindRegrab(t.element), e.land(t.element).then(e.onComplete).catch(() => e.onComplete({
		completed: !1,
		reason: "landing-error"
	})), t.element) : (e.onMissing(), null);
}
function we(e) {
	e.active && e.complete({
		completed: e.result.completed,
		reason: e.result.reason ?? "",
		reveal: e.result.completed ? e.reveal : void 0
	});
}
function Te(e, t) {
	let n = (e) => {
		if (!e?.isConnected) return null;
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0 ? e : null;
	};
	return n(e()) ?? n(t());
}
function Ee(e) {
	return {
		landing: () => {
			let t = e.createGate();
			return e.onGate(t), e.clearDragging(), e.scheduleLanding(), t.promise;
		},
		reveal: () => {
			e.clearRegrab(), e.finishReveal();
		}
	};
}
function De(t, i, a, o, s) {
	let c = 0, l = null, u;
	return {
		capture: () => {
			c += 1, l = t.ownerDocument;
			let e = s?.begin(l, "move");
			return u = e?.participantId, e && s?.request(l, {
				type: "move-layout",
				source: t
			}), n(i().filter((e) => e !== t && e.dataset.runtimeProxy !== "true"), document, !0, me(t), {
				scopeSurfaces: a?.(),
				surfaceMeasures: o?.()
			});
		},
		play: (t, n, i = !1) => {
			let a = ++c;
			if (i) {
				requestAnimationFrame(() => {
					if (a !== c) return;
					let e = (e) => {
						e && !e.isCurrent() || r(n);
					};
					l && u && s?.defer(l, u, (t) => e(t), "move-flip") || e(), l && s?.commit(l, u), u = void 0;
				});
				return;
			}
			let o = (t) => {
				t && !t.isCurrent() || e(n);
			};
			l && u && s?.defer(l, u, (e) => o(e), "move-flip") || o(), l && s?.commit(l, u), u = void 0;
		},
		cancel: () => {
			l && s?.cancel(l, u), l = null, u = void 0;
		}
	};
}
//#endregion
//#region src/runtime/move/MoveAdapter.ts
function Oe(e) {
	let { runtime: t, objectId: n, element: r, event: i, fromRect: o, clone: s = !1 } = e, c = t.objects.get(n), d = t.surfaces.snapshot(), p = d.map((e) => e.id), m = (e) => t.objects.get(e)?.surfaceId, h = c?.surfaceId ?? d[0]?.id, g = (e) => e.closest("[data-layout-content][data-layout-open=\"false\"]") !== null, _ = () => {
		let e = R(), n = (t) => e.length === 0 || e.some((e) => e === t || e.contains(t)), r = [...t.objects.values()].map((e) => e.element).filter((e) => !!e?.isConnected).filter(n), i = e.length > 0 ? e.flatMap((e) => [...e.matches("[data-flip-target]") ? [e] : [], ...Array.from(e.querySelectorAll("[data-flip-target]"))]) : Array.from(document.querySelectorAll("[data-flip-target]"));
		return Array.from(/* @__PURE__ */ new Set([...r, ...i])).filter((e) => !g(e));
	}, v, y, x, S = null, C = null, w = null, T = null, E = null, D = !1, O = null, k = null, A = null, j = null, M = null, N, P = {
		x: 0,
		y: 0
	}, F = null, I = !1, L = !1, R = () => {
		let e = /* @__PURE__ */ new Set();
		return h && e.add(h), S?.columnId && e.add(S.columnId), t.surfaces.snapshot().filter((t) => e.has(t.id)).map((e) => e.layoutElement?.() ?? e.element).filter((e) => !!e?.isConnected);
	}, z = () => {
		let e = /* @__PURE__ */ new Set();
		h && e.add(h), S?.columnId && e.add(S.columnId);
		let n = /* @__PURE__ */ new Map();
		for (let r of t.surfaces.snapshot()) {
			if (!e.has(r.id) || !r.measureLayout) continue;
			let t = r.layoutElement?.() ?? r.element;
			t?.isConnected && n.set(t, r.measureLayout);
		}
		return n;
	};
	function B() {
		return O ? t.getSession(O)?.state : void 0;
	}
	function V(e, r) {
		if (B() !== "active" || !x) return;
		let i = _e({
			active: B() === "active",
			event: {
				clientX: e,
				clientY: r
			},
			state: x,
			resolve: (e) => t.resolveMoveHit(n, e.clientX, e.clientY),
			getSurface: (e) => e.columnId
		});
		i && (S = {
			...i,
			point: {
				x: e,
				y: r
			}
		});
	}
	function ee(e) {
		I = !0, M?.setTarget({
			x: e.clientX - P.x,
			y: e.clientY - P.y
		}), V(e.clientX, e.clientY), j?.update(t.resolveMoveSurfaceElement(n, e.clientX, e.clientY), {
			x: e.clientX,
			y: e.clientY
		});
	}
	function H(e) {
		if (D || (D = !0, N = M ? { ...M.getState() } : void 0, M?.stop(), M = null, j?.stop(), !x || !O)) return { accepted: !1 };
		e && V(e.clientX, e.clientY);
		let i = x.release();
		S = i ? {
			...i,
			point: e ? {
				x: e.clientX,
				y: e.clientY
			} : i.point,
			...N ? { releaseVelocity: {
				x: N.vx,
				y: N.vy
			} } : {}
		} : null, !S && !I && N && Math.hypot(N.vx, N.vy) < .5 && h && (S = {
			columnId: h,
			index: F ?? Math.max(0, t.getObjectSurfaceIndex(n, h))
		});
		let o = !S;
		if (o && h && (S = {
			columnId: h,
			index: F ?? Math.max(0, t.getObjectSurfaceIndex(n, h)),
			invalidReturn: !0
		}), !S) return { accepted: !1 };
		if (N) {
			let e = a({
				x: N.vx,
				y: N.vy
			}, t.getObjectReleaseMotionProfile(n, S));
			N.vx = e.x, N.vy = e.y, S.releaseVelocity = {
				x: N.vx,
				y: N.vy
			};
		}
		let s = t.getMoveContext(O)?.sourceSize;
		s && (S.sourceSize = { ...s });
		let c = S, l = T?.getBoundingClientRect() ?? t.getVisualProxy(O)?.element.getBoundingClientRect() ?? G(r)?.getBoundingClientRect() ?? r.getBoundingClientRect();
		delete r.dataset.runtimeActive, o && (L || A?.restoreLayoutHidden(), k?.release());
		let u = (e, i) => {
			if (B() !== "landing") return;
			let a = i?.kind === "element" ? i.element : null, o = a ?? t.resolveVisualTarget(O, c) ?? t.objects.get(n)?.element ?? null, s = be({
				resolve: () => o,
				applyState: (e) => t.applyVisualState(n, e, {
					phase: "revealing",
					hovered: !1,
					selected: e.classList.contains("is-selected"),
					grabbed: !1
				})
			});
			if (!s) {
				w?.complete({
					completed: !1,
					reason: "target-not-registered"
				}), w = null;
				return;
			}
			E = s, a && t.keepSurfaceTargetVisible(c.columnId, s);
			let u = t.findObjectIdByElement(s, n) ?? n, d = xe((e) => t.captureVisualState(u, e), s, { ignoreTemporaryOpacity: !0 }), f = Se({
				createContext: () => t.createVisualLifecycleContext(e, c, i?.kind === "rect" ? i.rect : i?.element ?? s, v),
				source: r,
				sourceRect: l,
				visualSnapshot: y,
				targetSnapshot: d,
				motionState: N
			});
			T = Ce({
				createProxy: () => t.getVisualProxy(e) ?? t.createVisualProxy(e, f) ?? null,
				enableProxy: (e) => b(e, !0),
				bindRegrab: (r) => {
					t.bindRegrabTarget(e, n, r, (e) => W(e, n));
					let i = t.getGroup(e);
					if (i) for (let e of i.objectIds) {
						let r = t.objects.get(e)?.element;
						r?.isConnected && (r.style.pointerEvents = "auto", e !== n && t.registerRegrab(e, (t) => W(t, e)));
					}
				},
				land: () => t.landVisualProxy(e, i?.kind === "rect" ? i.rect : s, f),
				onMissing: () => {
					w?.complete({
						completed: !1,
						reason: "visual-proxy-missing"
					}), w = null;
				},
				onComplete: (n) => {
					we({
						active: B() === "landing",
						result: n,
						complete: (e) => w?.complete(e),
						reveal: () => t.revealVisualProxy(e, s, f).then(() => {
							T &&= (t.disposeVisualProxy(e), null), E = null;
						})
					}), w = null;
				}
			});
		};
		return C = ye(() => void 0, () => {
			let e = O;
			t.resolveLandingTarget(e, c).then((t) => u(e, t));
		}), {
			accepted: !0,
			destination: S,
			...o ? { emitAction: !1 } : {}
		};
	}
	function U(e) {
		for (let r of e?.objectIds ?? [n]) t.clearRegrab(r);
	}
	function W(e, r = n) {
		if (B() !== "landing") return;
		let i = T;
		if (!i || !O) return;
		let a = t.getGroup(O), o = a ? t.objects.get(a.primaryObjectId)?.visual : void 0, s = t.resolveVisualTarget(O, S), c = t.objects.get(n)?.element ?? null, l = a ? t.objects.get(a.primaryObjectId)?.element ?? null : Te(() => E ?? s, () => c);
		if (!l) return;
		let u = t.findObjectIdByElement(l, n) ?? n, d = t.createRegrabContext(O, e, i, l);
		if (!d) return;
		ve({
			event: d.event,
			sessionId: O,
			proxy: i,
			source: l,
			interrupt: () => t.takeoverRegrab(O),
			clearRegrab: () => U(a)
		});
		let f = l.getBoundingClientRect();
		a ? (o && t.objects.update(a.primaryObjectId, { visual: o }), t.startGroupObjectPointer(a.objectIds, a.primaryObjectId, l, e, d.regrabRect, f)) : t.startObjectPointer(u, l, e, d.regrabRect, f);
	}
	return {
		driver: {
			prepare(e) {
				O = e.session.id, I = !1;
				let a = r.style.visibility === "hidden" || getComputedStyle(r).visibility === "hidden";
				if (j = t.createAutoScroller(O, { onScroll: (e) => V(e.x, e.y) }), e.session.state !== "prepare") return;
				t.objects.setElement(n, r), r.style.visibility = "", r.style.pointerEvents = "", a && (r.style.transition = ""), k = t.acquireObject(O, n), t.takeSurfaces(O, p);
				let c = t.getGroup(O);
				L = !!c;
				let { beforePickup: d } = he(r, _, R, z);
				F = t.getObjectSurfaceIndex(n, h), v = r.cloneNode(!0);
				let g = pe(t.getMoveContext(O), r, i, o, t.getObjectGrabAlign(n)), b = g.rect;
				P = {
					x: g.offsetX,
					y: g.offsetY
				}, document.body.classList.add("kb-dragging"), t.applyVisualState(n, r, {
					phase: "dragging",
					hovered: r.matches(":hover"),
					selected: r.classList.contains("is-selected"),
					grabbed: !0
				}), y = fe((e, r) => t.captureVisualState(n, r), n, r), A = ue(r, O);
				let S = t.getObjectProxyLayout(n, r), C = !!S?.compact, w = h ? t.resolveMoveSurfaceViewport(h) : null, T = !!(w && w.scrollHeight > w.clientHeight && w.scrollTop >= w.scrollHeight - w.clientHeight - 1), E = t.getObjectCameraConfig(n);
				te(r, b, {
					layout: S,
					contentScale: E.enabled && E.pickup && E.scale ? t.getSurfaceCameraPickupScale(h, O) : void 0,
					cameraShell: E.enabled && E.scale,
					keepSourceVisible: !!(c && c.objectIds.length > 1)
				}), se(r, O);
				let D = ne(r);
				D && t.registerVisualProxy(O, { element: D }), D && t.updateVisualProxy(O), r.style.pointerEvents = "none", !s && !c && (A.detachFromLayout(), T && w && (w.scrollTop = Math.max(0, w.scrollHeight - w.clientHeight))), r.style.transition = "none", c || t.scheduleLayout(d), r.dataset.runtimeActive = "true";
				let N = t.getVisualProxy(O)?.element ?? G(r);
				if (!N) return;
				let B = b.left, ee = b.top, H = (e) => {
					if (!N.isConnected) return;
					t.updateVisualProxy(O);
					let n = e.x - B, r = e.y - ee;
					N.style.transform = `translate3d(${n.toFixed(2)}px, ${r.toFixed(2)}px, 0) perspective(760px) rotateX(${e.rotateX.toFixed(2)}deg) rotateZ(${e.rotateZ.toFixed(2)}deg) scale(${e.scaleX.toFixed(4)}, ${e.scaleY.toFixed(4)})`;
				};
				if (t.getObjectMotionEnabled(n)) {
					let e = f({
						mode: "follow",
						followRotation: u,
						onFrame: H
					});
					e.setProfile(l), e.seed({
						x: b.left,
						y: b.top,
						scaleX: 1,
						scaleY: 1,
						rotateX: u.tilt,
						rotateZ: 0
					}), e.setTarget({
						x: i.clientX - P.x,
						y: i.clientY - P.y,
						scaleX: C ? 1 : 1.03,
						scaleY: C ? 1 : 1.03
					}), e.start(), M = e;
				} else {
					let e = de({ onFrame: H });
					e.setTarget({
						x: i.clientX - P.x,
						y: i.clientY - P.y
					}), M = e;
				}
				x = ge(m(n), (e) => t.resolveMoveHit(n, e.clientX, e.clientY), (e, t) => e.columnId === t?.columnId && e.index === t?.index), V(i.clientX, i.clientY);
			},
			update(e, t) {
				t.event instanceof PointerEvent && ee(t.event);
			},
			resolveDestination(e, t) {
				return H(t.event instanceof PointerEvent ? t.event : void 0);
			},
			commit: (e, n) => {
				t.getVisualProxy(O) || K(r);
				let i = typeof n == "object" && !!n && n.invalidReturn === !0, a = typeof n == "object" && n ? n.toSurfaceId ?? n.columnId : void 0;
				L || (s || i || !i && typeof a == "string" && a === h ? A?.restoreLayoutHidden() : A?.detachFromLayout()), document.body.classList.remove("kb-dragging");
			},
			cancel(e, n) {
				D = !0, M?.stop(), M = null, t.getVisualProxy(O) ? t.disposeVisualProxy(O) : T ? (t.disposeVisualProxy(O), T = null) : K(r), U(t.getGroup(O)), document.body.classList.remove("kb-dragging"), delete r.dataset.runtimeActive, K(r), A?.restore(), A = null;
			}
		},
		lifecycle: {
			layout: De(r, _, R, z, t.layout),
			surface: { enter: () => k?.release() },
			...Ee({
				createGate: () => t.createCompletionGate(O, {
					completed: !1,
					reason: "landing-cancelled"
				}),
				onGate: (e) => {
					w = e;
				},
				clearDragging: () => document.body.classList.remove("kb-dragging"),
				scheduleLanding: () => {
					C?.(), C = null;
				},
				clearRegrab: () => U(t.getGroup(O)),
				finishReveal: () => {
					T && b(T, !1), K(r), A?.restore(), A = null;
				}
			})
		}
	};
}
function ke(e) {
	return Oe({
		...e,
		clone: !0
	});
}
//#endregion
export { u as C, o as D, i as E, a as O, l as S, s as T, y as _, I as a, m as b, z as c, ie as d, L as f, D as g, re as h, ae as i, A as l, X as m, Oe as n, oe as o, R as p, ue as r, T as s, ke as t, j as u, p as v, c as w, f as x, h as y };
