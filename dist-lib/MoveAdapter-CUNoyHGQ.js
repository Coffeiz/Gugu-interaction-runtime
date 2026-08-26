import { a as e, n as t, o as n, y as r } from "./GroupLayout-DZr40zZY.js";
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
var p = {
	stiffness: 240,
	damping: 30,
	rotationDecay: 5
}, m = p.stiffness, h = p.damping, g = 1, _ = p.rotationDecay;
function v(e, t, n, r) {
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
function y(e) {
	let t = e.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
	return t ? v(...t.slice(1).map(Number)) : e === "linear" ? (e) => e : e === "ease-in" ? v(.42, 0, 1, 1) : e === "ease-out" ? v(0, 0, .58, 1) : e === "ease-in-out" ? v(.42, 0, .58, 1) : v(.22, 1, .36, 1);
}
function b(e) {
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
	}, r = null, i = null, a = !1, o, c = () => {
		e.onFrame({
			x: t.x,
			y: t.y,
			scaleX: t.scaleX,
			scaleY: t.scaleY,
			rotateX: t.rotateX,
			rotateZ: t.rotateZ
		});
	}, l = (u) => {
		if (!a) return;
		let d = Math.min(.032, Math.max(0, (u - (r ?? u)) / 1e3));
		r = u;
		let f = {
			x: t.x,
			y: t.y
		}, p = {
			position: {
				x: t.x,
				y: t.y
			},
			velocity: {
				x: t.vx,
				y: t.vy
			}
		};
		if (s(p, {
			x: n.x,
			y: n.y
		}, e.stiffness ?? m, e.damping ?? h, d), o !== void 0 && d > 0) {
			let e = p.position.x - f.x, t = p.position.y - f.y, n = Math.hypot(e, t), r = o * g * d;
			if (n > r && n > 0) {
				let i = r / n;
				p.position.x = f.x + e * i, p.position.y = f.y + t * i, p.velocity.x = (p.position.x - f.x) / d, p.velocity.y = (p.position.y - f.y) / d;
			}
		}
		t.x = p.position.x, t.y = p.position.y, t.vx = p.velocity.x, t.vy = p.velocity.y;
		let v = {
			position: {
				x: t.scaleX,
				y: t.scaleY
			},
			velocity: {
				x: t.scaleVX,
				y: t.scaleVY
			}
		};
		s(v, {
			x: n.scaleX ?? t.scaleX,
			y: n.scaleY ?? t.scaleY
		}, e.stiffness ?? m, e.damping ?? h, d), t.scaleX = v.position.x, t.scaleY = v.position.y, t.scaleVX = v.velocity.x, t.scaleVY = v.velocity.y;
		let y = Math.exp(-(e.rotationDecay ?? _) * d);
		if (t.rotateX *= y, t.rotateZ *= y, c(), Math.abs(n.x - t.x) < .35 && Math.abs(n.y - t.y) < .35 && Math.abs(t.vx) < 5 && Math.abs(t.vy) < 5 && Math.abs((n.scaleX ?? t.scaleX) - t.scaleX) < .001 && Math.abs((n.scaleY ?? t.scaleY) - t.scaleY) < .001 && Math.abs(t.scaleVX) < .01 && Math.abs(t.scaleVY) < .01) {
			t.x = n.x, t.y = n.y, n.scaleX !== void 0 && (t.scaleX = n.scaleX), n.scaleY !== void 0 && (t.scaleY = n.scaleY), t.vx = 0, t.vy = 0, t.scaleVX = 0, t.scaleVY = 0, c(), a = !1, i = null, e.onArrived?.();
			return;
		}
		i = requestAnimationFrame(l);
	};
	return {
		seed(e) {
			if (Object.assign(t, e), e.vx !== void 0 || e.vy !== void 0) {
				let n = Math.hypot(e.vx ?? t.vx, e.vy ?? t.vy);
				o = n > 30 ? n : void 0;
			}
		},
		setTarget(e) {
			n = { ...e };
		},
		retarget(e) {
			if (!a) {
				n = { ...e };
				return;
			}
			n = { ...e };
		},
		start() {
			a || (a = !0, r = performance.now(), i = requestAnimationFrame(l));
		},
		stop() {
			a = !1, i !== null && cancelAnimationFrame(i), i = null;
		}
	};
}
//#endregion
//#region src/dom/ProxyVisualContext.ts
var x = [
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
function S(e) {
	let t = getComputedStyle(e);
	return Object.fromEntries(x.map((e) => [e, t.getPropertyValue(e)]));
}
function C(e, t) {
	for (let n of x) {
		let r = t[n];
		r && e.style.setProperty(n, r);
	}
}
function w(e, t) {
	C(t, S(e));
}
//#endregion
//#region src/dom/Visual.ts
function T(e, t) {
	e.style.pointerEvents = "none";
	for (let t of [e, ...e.querySelectorAll("*")]) t.classList.remove("is-hovered");
}
function E(e, t, n) {
	let r = (n ? Array.isArray(n) ? n : [n] : [".runtime-affordances-hidden"]).filter(Boolean).join(",");
	r && [...e.matches(r) ? [e] : [], ...e.querySelectorAll(r)].flatMap((e) => [e, ...e.querySelectorAll("*")]).forEach((e) => e.classList.toggle("runtime-affordances-hidden", t));
}
function D(e, t) {
	e.style.setProperty("box-shadow", t, "important");
}
function O(e, t) {
	let n = getComputedStyle(e);
	t.style.border = n.border, t.style.borderRadius = n.borderRadius, t.style.setProperty("box-shadow", n.boxShadow, "important"), t.style.backgroundColor = n.backgroundColor, t.style.backgroundImage = n.backgroundImage, t.style.backdropFilter = n.backdropFilter, t.style.setProperty("-webkit-backdrop-filter", n.backdropFilter);
}
function k(e) {
	e.classList.remove("is-grabbed", "is-hovered"), E(e, !1), delete e.dataset.runtimeProxy, delete e.dataset.runtimeProxyContent, delete e.dataset.runtimePhase, delete e.dataset.runtimeCompact;
}
function A(e, t, n) {
	e.fromLayer.style.opacity = "1", e.toLayer.style.opacity = "0", e.contentRoot.offsetWidth, requestAnimationFrame(() => {
		e.fromLayer.style.transition = `opacity ${t}ms ${n}`, e.toLayer.style.transition || (e.toLayer.style.transition = `opacity ${t}ms ${n}`), requestAnimationFrame(() => {
			e.fromLayer.style.opacity = "0", e.toLayer.style.opacity = "1";
		});
	});
}
function j(e, t = e.getBoundingClientRect(), n = {}) {
	let r = n.layout?.compact, i = document.createElement("div"), a = document.createElement("div"), o = document.createElement("div"), s = e.cloneNode(!0);
	n.affordancesSelector && E(s, !0, n.affordancesSelector), o.dataset.runtimeProxyScaleShell = "true", n.cameraShell && (o.dataset.runtimeCameraShell = "true"), a.dataset.runtimeProxyAttitude = "true", s.dataset.runtimeProxyContent = "true", Object.assign(o.style, {
		position: "absolute",
		left: "0",
		top: "0",
		transformOrigin: "0 0",
		pointerEvents: "none"
	}), Object.assign(a.style, {
		position: "absolute",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		transformOrigin: "50% 50%",
		transform: "none",
		pointerEvents: "none"
	}), Object.assign(s.style, {
		position: "absolute",
		left: "0",
		top: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		margin: "0",
		pointerEvents: "none"
	}), s.dataset.runtimePhase = "grab-start", o.appendChild(s), a.appendChild(o), i.appendChild(a), i.className = "", i.style.position = "fixed", i.style.left = `${t.left}px`, i.style.top = `${t.top}px`, i.style.boxSizing = "border-box", i.style.transformOrigin = "50% 50%", i.style.width = `${t.width}px`, i.style.height = `${t.height}px`, N(i, n.contentScale), i.style.margin = "0", i.style.zIndex = String(n.proxyZIndex ?? 2147483647), i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = "scale(1)", le && n.glass !== !1 ? J(s) : D(s, "0 12px 24px rgba(0,0,0,.18)"), r && (s.dataset.runtimeCompact = "true");
	let c = r?.duration ?? 200, l = r?.easing ?? "cubic-bezier(.22,1,.36,1)";
	return s.style.transition = `left ${c}ms ${l}, width ${c}ms ${l}, transform ${c}ms ${l}, grid-template-columns ${c}ms ${l}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, i.style.transition = "transform .15s ease", document.documentElement.appendChild(i), requestAnimationFrame(() => {
		i.isConnected && s.dataset.runtimePhase === "grab-start" && (s.dataset.runtimePhase = "grabbing", r && (s.style.left = r.left ?? "50%", s.style.width = r.width, s.style.transform = r.transform ?? "translateX(-50%)", r.gridTemplateColumns && (s.style.gridTemplateColumns = r.gridTemplateColumns)));
	}), ce.add(i), i;
}
function M(e) {
	let t = typeof e == "function" ? e() : e;
	return typeof t == "number" && Number.isFinite(t) && t > 0 ? t : 1;
}
function N(e, t) {
	let n = M(t), r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = Number(e.dataset.runtimeProxyBaseWidth) || r / n, o = Number(e.dataset.runtimeProxyBaseHeight) || i / n;
	e.dataset.runtimeProxyBaseWidth = String(a), e.dataset.runtimeProxyBaseHeight = String(o);
	let s = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!s) return;
	s.style.width = `${a}px`, s.style.height = `${o}px`;
	let c = parseFloat(e.style.width) || r, l = parseFloat(e.style.height) || i;
	s.style.left = `${(c - a * n) / 2}px`, s.style.top = `${(l - o * n) / 2}px`, s.style.transform = `scale(${n})`;
}
function ee(e, t) {
	let n = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!n) return null;
	let r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = t > 0 ? t : 1, o = Number(e.dataset.runtimeProxyBaseWidth) || r / a, s = Number(e.dataset.runtimeProxyBaseHeight) || i / a;
	return n.style.width = `${o}px`, n.style.height = `${s}px`, n.style.left = `${(r - o * a) / 2}px`, n.style.top = `${(i - s * a) / 2}px`, n.style.transform = `scale(${a})`, {
		shell: n,
		baseWidth: o,
		baseHeight: s
	};
}
function P(e, t, n, r) {
	let i = e.baseWidth * r, a = e.baseHeight * r;
	e.shell.style.left = `${((t - i) / 2).toFixed(2)}px`, e.shell.style.top = `${((n - a) / 2).toFixed(2)}px`, e.shell.style.transform = `scale(${r})`;
}
function te(e) {
	return e.querySelector("[data-runtime-proxy-attitude]") ?? e;
}
function F(e) {
	return e.querySelector("[data-runtime-proxy-content]:not([data-runtime-group-modifier])") ?? e;
}
function I(e) {
	let t = [], n = 0, r = 0;
	for (let i = 0; i < e.length; i += 1) {
		let a = e[i];
		a === "(" ? r += 1 : a === ")" ? r = Math.max(0, r - 1) : a === "," && r === 0 && (t.push(e.slice(n, i).trim()), n = i + 1);
	}
	let i = e.slice(n).trim();
	return i && t.push(i), t;
}
function L(e, t) {
	let n = I(e), r = I(t);
	if (n.length >= r.length || n.length === 0) return e;
	let i = /* @__PURE__ */ new Map();
	i.set("inset", n.filter((e) => /\binset\b/i.test(e))), i.set("outer", n.filter((e) => !/\binset\b/i.test(e)));
	let a = (e) => /\binset\b/i.test(e) ? "inset 0 0 0 0 rgba(0, 0, 0, 0)" : "0 0 0 0 rgba(0, 0, 0, 0)", o = /* @__PURE__ */ new Map([["inset", 0], ["outer", 0]]);
	return r.map((e) => {
		let t = /\binset\b/i.test(e) ? "inset" : "outer", n = i.get(t) ?? [], r = o.get(t) ?? 0;
		return r < n.length ? (o.set(t, r + 1), n[r]) : a(e);
	}).join(", ");
}
function ne(e, t, n) {
	if (t == null) {
		e.style.transition = n;
		return;
	}
	let r = e.style.boxShadow || getComputedStyle(e).boxShadow;
	e.style.transition = "none", D(e, L(r, t)), e.offsetWidth, e.style.transition = n;
}
function re(e, t, n) {
	let r = e.cloneNode(!0), i = document.createElement("div");
	i.dataset.runtimeProxyContent = "true", e.dataset.runtimePhase && (i.dataset.runtimePhase = e.dataset.runtimePhase), e.dataset.runtimeCompact === "true" && (i.dataset.runtimeCompact = "true"), Object.assign(i.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		margin: "0",
		pointerEvents: "none"
	}), delete r.dataset.runtimeProxyContent, delete r.dataset.runtimePhase, delete r.dataset.runtimeCompact, Object.assign(r.style, {
		position: "absolute",
		inset: "0",
		width: "100%",
		height: "100%",
		boxSizing: "border-box",
		opacity: "1",
		pointerEvents: "none"
	});
	let a = t.cloneNode(!0);
	w(t, a), k(a), n && E(a, !0, n), O(e, a), delete a.dataset.runtimePhase, delete a.dataset.runtimeCompact, Object.assign(a.style, {
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
	let o = document.createElement("div");
	return o.dataset.runtimeProxyTargetContentScaleShell = "true", Object.assign(o.style, {
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
	}), o.append(a), i.append(r, o), e.replaceWith(i), i.style.border = "0", i.style.borderRadius = "0", i.style.setProperty("box-shadow", "none", "important"), i.style.background = "transparent", i.style.backdropFilter = "none", i.style.setProperty("-webkit-backdrop-filter", "none"), {
		contentRoot: i,
		fromLayer: r,
		toLayer: a,
		targetScaleShell: o
	};
}
function R(e, t) {
	let n = Math.max(t.left, t.right - e.width), r = Math.max(t.top, t.bottom - e.height);
	return {
		left: Math.min(Math.max(e.left, t.left), n),
		top: Math.min(Math.max(e.top, t.top), r),
		width: e.width,
		height: e.height
	};
}
function z(e, t, n = {}) {
	let i = n.duration ?? r.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", o = n.targetShadow, s = n.targetRadius, c = n.targetBorder, l = n.targetBackdropFilter, u = n.targetBackground, d = n.targetOpacity, f = F(e), p = te(e), m = n.targetContent ? re(f, n.targetContent, n.affordancesSelector) : null;
	m && (f = m.contentRoot);
	let h = m?.fromLayer ?? f, g = m?.toLayer ?? f;
	m && (m.fromLayer.style.transition = "none", m.toLayer.style.transition = "none"), M(n.contentScale);
	let _ = parseFloat(e.style.left) || 0, v = parseFloat(e.style.top) || 0, y = !1, b = t, x = performance.now(), S = () => void 0, C = () => void 0, w = new Promise((e) => {
		C = e;
	}), T = () => {
		let t = e.getBoundingClientRect();
		return Math.abs(t.left - b.left) < 2 && Math.abs(t.top - b.top) < 2 && Math.abs(t.width - b.width) < 2 && Math.abs(t.height - b.height) < 2;
	}, E = null, O = null, k = 0, j = (t) => {
		y || (y = !0, e.removeEventListener("transitionend", S), O !== null && (window.clearTimeout(O), O = null), C());
	}, N = () => {
		if (!y) {
			if (T()) {
				j("waitForTarget:isAtTarget");
				return;
			}
			if (performance.now() - x >= i + 500) {
				j("waitForTarget:timeout");
				return;
			}
			window.requestAnimationFrame(N);
		}
	}, ee = (t, r = i) => {
		b = t;
		let f = e.getBoundingClientRect();
		e.style.transition = "none";
		let y = getComputedStyle(p).transform;
		p.style.transition = "none", p.style.transform = y, e.style.width = `${f.width.toFixed(2)}px`, e.style.height = `${f.height.toFixed(2)}px`, e.style.transform = `translate3d(${(f.left - _).toFixed(2)}px, ${(f.top - v).toFixed(2)}px, 0)`, e.offsetWidth;
		let x = `translate3d(${(t.left - _).toFixed(2)}px, ${(t.top - v).toFixed(2)}px, 0)`;
		e.style.transition = `transform ${r}ms ${a}, width ${r}ms ${a}, height ${r}ms ${a}`, p.style.transition = `transform ${r}ms ${a}`;
		let S = [
			`box-shadow ${r}ms ease`,
			`border-radius ${r}ms ease`,
			`border-color ${r}ms ease`,
			`backdrop-filter ${r}ms ease`,
			`-webkit-backdrop-filter ${r}ms ease`,
			`background-color ${r}ms ease`,
			`background-image ${r}ms ease`,
			`opacity ${r}ms ease`
		].join(", ");
		m && (m.toLayer.style.transition = S), m || ne(h, o, S), requestAnimationFrame(() => {
			e.style.transform = x, p.style.transform = "none", e.style.width = `${t.width.toFixed(2)}px`, e.style.height = `${t.height.toFixed(2)}px`, o != null && D(g, o), s != null && (g.style.borderRadius = s), c != null && (g.style.border = c), l != null && (g.style.backdropFilter = l, g.style.setProperty("-webkit-backdrop-filter", l)), u != null && (g.style.backgroundColor = u, n.targetBackgroundImage && (g.style.backgroundImage = n.targetBackgroundImage)), d != null && (g.style.opacity = d), m && A(m, r, a);
		});
	};
	S = (t) => {
		t.target === e && (t.propertyName === "transform" || t.propertyName === "width" || t.propertyName === "height") && T() && j(`transitionend:${t.propertyName}`);
	}, e.addEventListener("transitionend", S), ee(t), window.setTimeout(N, i + 40);
	let P = (e) => {
		k = performance.now();
		let t = Math.max(80, i - (k - x));
		ee(n.readTarget?.() ?? e, t);
	};
	return {
		finished: w,
		retarget: (e) => {
			if (y) return;
			let t = Math.abs(e.left - b.left), n = Math.abs(e.top - b.top), r = Math.abs(e.width - b.width), i = Math.abs(e.height - b.height);
			if (t < .5 && n < .5 && r < .5 && i < .5) return;
			let a = performance.now() - k;
			if (a >= 60) {
				P(e);
				return;
			}
			E = e, O === null && (O = window.setTimeout(() => {
				if (O = null, y || !E) return;
				let e = E;
				E = null, P(e);
			}, 60 - a));
		}
	};
}
function B(e, t, n = {}) {
	let i = n.duration ?? r.landing.duration, a = n.easing ?? "cubic-bezier(.22,1,.36,1)", o = n.targetShadow, s = n.targetRadius, l = n.targetBorder, u = n.targetBackdropFilter, d = n.targetBackground, p = n.targetOpacity, m = F(e), h = e.querySelector("[data-runtime-proxy-scale-shell]"), g = n.targetContent ? re(m, n.targetContent, n.affordancesSelector) : null;
	g && (m = g.contentRoot);
	let _ = g?.fromLayer ?? m, v = g?.toLayer ?? m;
	g && (g.fromLayer.style.transition = "none", g.toLayer.style.transition = "none"), g && (g.targetScaleShell.style.transformOrigin = "50% 50%", g.targetScaleShell.style.transition = "none", g.targetScaleShell.style.transform = "scale(1)");
	let y = M(n.contentScale), x = parseFloat(e.style.left) || e.getBoundingClientRect().left, S = parseFloat(e.style.top) || e.getBoundingClientRect().top, C = e.getBoundingClientRect(), w = parseFloat(e.style.width) || C.width || t.width, T = parseFloat(e.style.height) || C.height || t.height, E = ee(e, y), O = E && n.landingContentScale !== void 0 ? M(n.landingContentScale) : y, k = n.cameraOrigin?.(), j = M(n.landingCameraScale ?? n.contentScale), N = !!(n.cameraShell && n.landingMode === "free" && k && Number.isFinite(k.left) && Number.isFinite(k.top)), I = null, L = null;
	if (N && k) {
		I = document.createElement("div"), I.dataset.runtimeCameraGlue = "true", Object.assign(I.style, {
			position: "fixed",
			left: "0",
			top: "0",
			right: "0",
			bottom: "0",
			transition: "none",
			transform: "translate3d(0, 0, 0)",
			transformOrigin: `${k.left}px ${k.top}px`,
			pointerEvents: "none",
			zIndex: e.style.zIndex,
			willChange: "transform"
		}), e.parentElement?.appendChild(I), I.appendChild(e);
		let t = () => {
			if (!I?.isConnected) return;
			let e = n.cameraOrigin?.();
			if (e && Number.isFinite(e.left) && Number.isFinite(e.top)) {
				let t = M(n.landingCameraScale ?? n.contentScale), r = j > .01 ? t / j : 1;
				I.style.transform = `translate3d(${(e.left - k.left).toFixed(2)}px, ${(e.top - k.top).toFixed(2)}px, 0) scale(${r.toFixed(4)})`;
			}
			L = window.requestAnimationFrame(t);
		};
		L = window.requestAnimationFrame(t);
	}
	let R = (e) => ({
		left: e.left - (w - e.width) / 2,
		top: e.top - (T - e.height) / 2,
		width: e.width,
		height: e.height
	}), z = t, B = performance.now(), V = !1, H = n.landingMode === "target" && !!h, U = H ? n.dismiss?.duration ?? i : 0, ie = !1, W = null, G = !H, K = null, q = null, ae = 0, oe = () => void 0, se = new Promise((e) => {
		oe = e;
	}), ce = () => {
		V || (V = !0, J.stop(), K !== null && window.clearTimeout(K), q !== null && window.clearTimeout(q), K = null, q = null, L !== null && window.cancelAnimationFrame(L), L = null, W !== null && window.cancelAnimationFrame(W), W = null, I?.remove(), I = null, oe());
	}, le = () => {
		ie && G && ce();
	}, ue = () => {
		V || W === null && (W = window.requestAnimationFrame(() => {
			if (W = null, V) return;
			let e = n.readTarget?.();
			if (e && e.width > 0 && e.height > 0 && (Math.abs(e.left - z.left) >= .5 || Math.abs(e.top - z.top) >= .5 || Math.abs(e.width - z.width) >= .5 || Math.abs(e.height - z.height) >= .5)) {
				z = e;
				let t = R(e), r = n.landingMode === "target" ? 1 : t.width / (n.landingMode === "free" ? he : w), i = n.landingMode === "target" ? 1 : t.height / (n.landingMode === "free" ? $ : T);
				J.retarget({
					x: t.left,
					y: t.top,
					scaleX: r,
					scaleY: i
				}), J.start();
				return;
			}
			ie = !0, le();
		}));
	}, de = (t) => {
		let r = t.x, a = t.y;
		if (e.style.transform = `translate3d(${(r - x).toFixed(2)}px, ${(a - S).toFixed(2)}px, 0) scale(${t.scaleX.toFixed(4)}, ${t.scaleY.toFixed(4)})`, te(e).style.transform = `perspective(760px) rotateX(${t.rotateX.toFixed(2)}deg) rotateZ(${t.rotateZ.toFixed(2)}deg)`, n.landingMode === "free" && E && n.cameraShell) P(E, w, T, y);
		else {
			let r = w * t.scaleX, a = T * t.scaleY, o = t.x + (w - r) / 2, s = t.y + (T - a) / 2;
			if (e.style.width = `${r.toFixed(2)}px`, e.style.height = `${a.toFixed(2)}px`, e.style.transform = `translate3d(${(o - x).toFixed(2)}px, ${(s - S).toFixed(2)}px, 0)`, te(e).style.transform = `perspective(760px) rotateX(${t.rotateX.toFixed(2)}deg) rotateZ(${t.rotateZ.toFixed(2)}deg)`, !(n.landingMode === "target" && H) && E) {
				let e = Math.max(0, performance.now() - B), o = 1 - (1 - Math.min(1, e / Math.max(1, i))) ** 3, s = y + (O - y) * o;
				n.cameraShell ? P(E, r, a, n.landingContentScale === void 0 ? t.scaleX * s : s) : (E.shell.style.left = "0px", E.shell.style.top = "0px", E.shell.style.width = `${r}px`, E.shell.style.height = `${a}px`, E.shell.style.transform = "scale(1)");
			}
		}
	}, J = n.landingMode === "free" ? b({
		duration: i,
		easing: a,
		stiffness: n.stiffness,
		damping: n.damping,
		rotationDecay: n.rotationDecay,
		onFrame: de,
		onArrived: ue
	}) : f({
		mode: "settle",
		onFrame: de,
		onArrived: ue
	}), Y = Math.hypot(n.motionState?.vx ?? 0, n.motionState?.vy ?? 0), fe = n.releaseDamping ?? .78, pe = n.targetMotion ? {
		position: {
			...c.position,
			...n.targetMotion.position
		},
		scale: {
			...c.scale,
			...n.targetMotion.scale
		}
	} : c;
	n.landingMode !== "free" && J.setProfile(Y > 30 ? {
		...pe,
		position: {
			...pe.position,
			damping: pe.position.damping * fe
		}
	} : pe);
	let X = {
		x: n.motionState?.x ?? C.left,
		y: n.motionState?.y ?? C.top,
		vx: n.motionState?.vx ?? 0,
		vy: n.motionState?.vy ?? 0,
		scaleX: n.motionState?.scaleX ?? 1,
		scaleY: n.motionState?.scaleY ?? 1,
		rotateX: n.motionState?.rotateX ?? 0,
		rotateZ: n.motionState?.rotateZ ?? 0
	};
	J.seed({
		x: X.x,
		y: X.y,
		vx: X.vx,
		vy: X.vy,
		scaleX: X.scaleX,
		scaleY: X.scaleY,
		rotateX: X.rotateX,
		rotateZ: X.rotateZ
	}), de(X);
	let Z = R(t), Q = E?.baseWidth ?? w, me = E?.baseHeight ?? T;
	E && n.landingMode !== "free" && n.landingMode !== "target" && (O > 0 || (O = Q > 0 ? Z.width / Q : 1), E.shell.style.transformOrigin = "0 0", n.cameraShell ? (E.shell.style.left = `${((w - Q * y) / 2).toFixed(2)}px`, E.shell.style.top = `${((T - me * y) / 2).toFixed(2)}px`, E.shell.style.transform = y === 1 ? "scale(1)" : `scale(${y}, ${y})`) : (E.shell.style.left = "0px", E.shell.style.top = "0px", E.shell.style.width = `${w}px`, E.shell.style.height = `${T}px`, E.shell.style.transform = "scale(1)"), E.shell.style.transition = "none");
	let he = Q * y, $ = me * y, ge = n.landingMode === "target" ? {
		scaleX: 1,
		scaleY: 1
	} : n.landingMode === "free" ? {
		scaleX: he > 0 ? Z.width / he : 1,
		scaleY: $ > 0 ? Z.height / $ : 1
	} : {
		scaleX: w > 0 ? Z.width / w : 1,
		scaleY: T > 0 ? Z.height / T : 1
	};
	J.setTarget({
		x: Z.left,
		y: Z.top,
		scaleX: ge.scaleX,
		scaleY: ge.scaleY
	}), e.style.transition = "";
	let _e = [
		...n.landingMode === "target" ? [] : [
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
	g && (g.toLayer.style.transition = _e), g || ne(_, o, _e), requestAnimationFrame(() => {
		if (!V) {
			if (n.landingMode !== "target" && (m.dataset.runtimePhase = "landing", m.dataset.runtimeCompact === "true" && (m.style.left = "0", m.style.width = "100%", m.style.transform = "none", m.style.gridTemplateColumns = "", g || (m.style.gridTemplateColumns = "", delete m.dataset.runtimeCompact))), o != null && (m.offsetWidth, D(v, o)), s != null && (v.style.borderRadius = s), l != null && (v.style.border = l), u != null && (v.style.backdropFilter = u, v.style.setProperty("-webkit-backdrop-filter", u)), d != null && (v.style.backgroundColor = d, n.targetBackgroundImage && (v.style.backgroundImage = n.targetBackgroundImage)), p != null && (v.style.opacity = p), H && h) {
				let e = n.dismiss?.easing ?? a, t = n.dismiss?.scale ?? .72;
				h.style.transformOrigin = "50% 50%", h.style.transition = `transform ${U}ms ${e}`, v.style.transition = `opacity ${U}ms ${e}`, h.style.transform = `scale(${t})`, v.style.opacity = "0", q = window.setTimeout(() => {
					q = null, G = !0, le();
				}, U + 40);
			}
			g && A(g, i, a);
		}
	});
	let ve = (e = 0) => {
		K !== null && window.clearTimeout(K), ae = performance.now() + Math.max(2e3, i * 8, 5e3) + e, K = window.setTimeout(() => {
			K = null, !V && performance.now() >= ae && ue();
		}, Math.max(2e3, i * 8, 5e3) + e);
	};
	ve();
	let ye = n.coast;
	return n.landingMode === "free" ? J.start() : ye && ye.maxDistance > 0 && Math.hypot(n.motionState?.vx ?? 0, n.motionState?.vy ?? 0) > ye.minVelocity ? J.startCoastThenSettle(ye) : J.start(), {
		finished: se,
		retarget(e) {
			if (V) return;
			z = e, ve(1e3);
			let t = R(z), r = n.landingMode === "target" ? 1 : n.landingMode === "free" ? t.width / he : t.width / w, i = n.landingMode === "target" ? 1 : n.landingMode === "free" ? t.height / $ : t.height / T;
			E && n.landingMode !== "free" && n.landingMode !== "target" && n.landingContentScale === void 0 && (O = Q > 0 ? t.width / Q : O), J.setTarget({
				x: t.left,
				y: t.top,
				scaleX: r,
				scaleY: i
			});
		}
	};
}
function V(e) {
	if (!ce.has(e)) return;
	ce.delete(e);
	let t = e.parentElement?.dataset.runtimeCameraGlue === "true" ? e.parentElement : null;
	t?.remove(), t || e.remove();
}
var H = /* @__PURE__ */ new WeakMap(), U = [
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
function ie(e, t) {
	let n = Object.fromEntries(U.map((t) => [t, e.style[t]]));
	e.style.cssText = t;
	for (let t of U) n[t] !== "" && (e.style[t] = n[t]);
}
var W = /* @__PURE__ */ new WeakMap(), G = /* @__PURE__ */ new WeakSet();
function K(e, t, n = {}) {
	H.set(e, { style: e.getAttribute("style") ?? "" });
	let r = j(e, t, {
		glass: !1,
		layout: n.layout,
		contentScale: n.contentScale,
		cameraShell: n.cameraShell,
		affordancesSelector: n.affordancesSelector,
		proxyZIndex: n.proxyZIndex
	}), i = F(r);
	w(e, i);
	let a = i.style.transition;
	i.style.transition = "none", D(i, "none"), i.offsetWidth, i.style.transition = a;
	let o = !!n.layout?.compact;
	r.style.zIndex = String(n.proxyZIndex ?? 1e3), r.style.transform = "scale(1)", r.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", G.add(r), W.set(e, r), n.keepSourceVisible || (e.style.visibility = "hidden"), requestAnimationFrame(() => {
		!r.isConnected || !G.has(r) || q(r, o);
	});
}
function q(e, t = !1, n = !0) {
	if (!e.isConnected) return;
	let r = F(e);
	le ? J(r) : D(r, "0 12px 24px rgba(0,0,0,.18)"), n && (e.style.transform = `scale(${t ? 1 : 1.03})`);
}
function ae(e) {
	return W.get(e);
}
function oe(e) {
	let t = W.get(e);
	if (t) return requestAnimationFrame(() => {
		!t.isConnected || F(t).dataset.runtimePhase === "landing" || q(t, F(t).dataset.runtimeCompact === "true", !1);
	}), G.delete(t), W.delete(e), H.delete(e), t;
}
function se(e) {
	let t = W.get(e);
	t && (G.delete(t), t.remove(), ce.delete(t), W.delete(e));
	let n = H.get(e);
	n && ie(e, n.style), H.delete(e);
}
var ce = /* @__PURE__ */ new Set(), le = !1;
function ue(e) {
	le = e;
}
function de() {
	return le;
}
function J(e) {
	e.style.background = "rgba(255, 255, 255, 0.42)", e.style.backdropFilter = "blur(12px) saturate(1.15)", e.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), e.style.border = "1px solid rgba(255, 255, 255, 0.72)", D(e, "0 22px 50px rgba(30, 35, 60, 0.30)"), e.style.opacity = "0.97";
}
var Y = /* @__PURE__ */ new Map();
function fe(e, t) {
	Y.set(e, t), e.style.visibility = "hidden";
}
function pe(e, t) {
	(e.style.visibility === "hidden" || getComputedStyle(e).visibility === "hidden") && Y.set(e, t);
}
function X(e, t) {
	let n = Y.get(e) === t;
	return n && (e.style.visibility = "", Y.delete(e)), n;
}
function Z(e, t) {
	Y.get(e) === t && Y.delete(e);
}
//#endregion
//#region src/dom/SourceVisualLease.ts
var Q = [
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
function me(e) {
	return Object.fromEntries(Q.map((t) => [t, e.style[t]]));
}
function he(e, t) {
	let n = me(e);
	e.style.cssText = t;
	for (let t of Q) n[t] !== "" && (e.style[t] = n[t]);
}
var $ = /* @__PURE__ */ new WeakMap();
function ge(e, t) {
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
		restore: () => r() ? (he(e, n.cssText), $.delete(e), !0) : !1,
		isOwner: r
	};
}
//#endregion
//#region src/motion/DirectFollowController.ts
function _e(e) {
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
function ve(e, t, n) {
	let r = e(t, n);
	return {
		...r,
		boxShadow: n.style.boxShadow || r.boxShadow,
		transform: n.style.transform || r.transform
	};
}
function ye(e, t, n, r, i) {
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
function be(e) {
	let t = e.dataset.layoutKey;
	return (n) => n === e || n.contains(e) || !!(t && n.dataset.layoutKey === t);
}
function xe(e) {
	if (!e || e.length === 0) return;
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = n.matches("[data-scroll-viewport]") ? n : n.querySelector("[data-scroll-viewport]");
		e?.isConnected && t.set(n, e);
	}
	return t.size > 0 ? t : void 0;
}
function Se(e, n, r, i) {
	let a = n().filter((t) => t !== e && t.dataset.runtimeProxy !== "true"), o = r?.();
	return { beforePickup: t(a, document, !0, be(e), {
		scopeSurfaces: o,
		viewportBySurface: xe(o),
		surfaceMeasures: i?.(),
		focus: {
			sourceElement: e,
			layoutKey: e.dataset.layoutKey,
			mode: "removal"
		}
	}) };
}
function Ce(e, t) {
	let n = null;
	return {
		update(r) {
			let i = e(r);
			return i ? (t(i, n) || (n = i), n) : (n = null, null);
		},
		release() {
			return n;
		}
	};
}
function we(e) {
	return e.active ? e.state.update(e.event) : null;
}
function Te(e) {
	e.event.stopPropagation(), T(e.proxy, !1), e.clearRegrab(), Z(e.source, e.sessionId), e.interrupt(), e.source.style.visibility = "hidden";
}
function Ee(e, t) {
	return () => requestAnimationFrame(() => {
		e(), t();
	});
}
function De(e) {
	let t = e.resolve();
	return t ? (e.applyState(t), t) : null;
}
function Oe(e, t, n = {}) {
	let r = n.rect ? new DOMRect(n.rect.left, n.rect.top, n.rect.width, n.rect.height) : t.getBoundingClientRect(), i = t.style.opacity, a = getComputedStyle(t).opacity, o = t.cloneNode(!0);
	o.dataset.runtimeLandingSnapshot = "true", o.style.position = "fixed", o.style.left = "-100000px", o.style.top = "-100000px", o.style.width = `${r.width}px`, o.style.height = `${r.height}px`, o.style.visibility = "visible", o.style.pointerEvents = "none", o.style.transition = "none", n.ignoreTemporaryOpacity && (i === "0" || a === "0") && (o.style.opacity = "1"), (t.parentElement ?? t.ownerDocument.body).appendChild(o);
	try {
		let t = e(o, r);
		return n.ignoreTemporaryOpacity && (i === "0" || a === "0" || t.opacity === "0") ? {
			...t,
			rect: r,
			opacity: "1"
		} : {
			...t,
			rect: r
		};
	} finally {
		o.remove();
	}
}
function ke(e) {
	return {
		...e.createContext(),
		sourceElement: e.source,
		sourceRect: e.sourceRect,
		visualSnapshot: e.visualSnapshot,
		targetSnapshot: e.targetSnapshot,
		motionState: e.motionState
	};
}
function Ae(e) {
	let t = e.createProxy();
	return t ? (e.enableProxy(t.element), e.bindRegrab(t.element), e.land(t.element).then(e.onComplete).catch(() => e.onComplete({
		completed: !1,
		reason: "landing-error"
	})), t.element) : (e.onMissing(), null);
}
function je(e) {
	e.active && e.complete({
		completed: e.result.completed,
		reason: e.result.reason ?? "",
		reveal: e.result.completed ? e.reveal : void 0
	});
}
function Me(e, t) {
	let n = (e) => {
		if (!e?.isConnected) return null;
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0 ? e : null;
	};
	return n(e()) ?? n(t());
}
function Ne(e) {
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
function Pe(r, i, a, o, s, c) {
	let l = 0, u = null, d;
	return {
		capture: () => {
			l += 1, u = r.ownerDocument;
			let e = s?.begin(u, "move");
			d = e?.participantId, e && s?.request(u, {
				type: "move-layout",
				source: r
			});
			let n = a?.();
			return t(i().filter((e) => e !== r && e.dataset.runtimeProxy !== "true"), document, !0, be(r), {
				scopeSurfaces: n,
				viewportBySurface: xe(n),
				surfaceMeasures: o?.(),
				focus: {
					sourceElement: r,
					layoutKey: r.dataset.layoutKey,
					mode: "move"
				},
				presenceCards: c?.() ?? i()
			});
		},
		play: (t, r, i = !1) => {
			let a = ++l;
			if (i) {
				requestAnimationFrame(() => {
					if (a !== l) return;
					let e = (e) => {
						e && !e.isCurrent() || n(r);
					};
					u && d && s?.defer(u, d, (t) => e(t), "move-flip") || e(), u && s?.commit(u, d), d = void 0;
				});
				return;
			}
			let o = (t) => {
				t && !t.isCurrent() || e(r);
			};
			u && d && s?.defer(u, d, (e) => o(e), "move-flip") || o(), u && s?.commit(u, d), d = void 0;
		},
		cancel: () => {
			u && s?.cancel(u, d), u = null, d = void 0;
		}
	};
}
//#endregion
//#region src/runtime/move/MoveAdapter.ts
function Fe(e) {
	let { runtime: t, objectId: n, element: r, event: i, fromRect: o, clone: s = !1 } = e, c = t.objects.get(n), d = t.surfaces.snapshot(), p = d.map((e) => e.id), m = c?.surfaceId ?? d[0]?.id, h = (e) => e.closest("[data-layout-content][data-layout-open=\"false\"]") !== null, g = () => {
		let e = [...t.objects.values()].map((e) => e.element).filter((e) => !!e?.isConnected), n = Array.from(document.querySelectorAll("[data-flip-target]"));
		return Array.from(/* @__PURE__ */ new Set([...e, ...n]));
	}, _ = () => g().filter((e) => !h(e)), v, y, b, x = null, S = null, C = null, w = null, E = null, D = null, O = null, k = null, A = !1, j = null, M = null, N = null, ee = null, P = null, F, I = {
		x: 0,
		y: 0
	}, L = null, ne = !1, re = !1, R = () => {
		let e = /* @__PURE__ */ new Set();
		return m && e.add(m), x?.columnId && e.add(x.columnId), t.surfaces.snapshot().filter((t) => e.has(t.id)).map((e) => e.layoutElement?.() ?? e.element).filter((e) => !!e?.isConnected);
	}, z = () => {
		let e = /* @__PURE__ */ new Set();
		m && e.add(m), x?.columnId && e.add(x.columnId);
		let n = /* @__PURE__ */ new Map();
		for (let r of t.surfaces.snapshot()) {
			if (!e.has(r.id) || !r.measureLayout) continue;
			let t = r.layoutElement?.() ?? r.element;
			t?.isConnected && n.set(t, r.measureLayout);
		}
		return n;
	};
	function B() {
		return j ? t.getSession(j)?.state : void 0;
	}
	function V(e, r) {
		if (!e) return !1;
		if (e.kind === "rect") return e.rect.width > 0 && e.rect.height > 0;
		let i = e.element;
		return i.isConnected ? i !== (t.objects.get(n)?.element ?? null) || !m || r.columnId === m ? !0 : t.surfaces.get(r.columnId)?.element?.contains(i) ?? !1 : !1;
	}
	async function H() {
		let e = j, n = x;
		if (!e || !n || B() !== "landing" || (await Promise.resolve(), j !== e || B() !== "landing")) return;
		let r = t.resolveMoveLandingResolution(e, n);
		if (V(r, n)) {
			if (r?.kind === "element") {
				let e = r.element.getBoundingClientRect();
				if (e.width <= 0 || e.height <= 0) return;
				k = new DOMRect(e.left, e.top, e.width, e.height);
			} else k = null;
			O = r;
		}
	}
	function U(e, t) {
		if (B() !== "active" || !b) return;
		let n = we({
			active: B() === "active",
			event: {
				clientX: e,
				clientY: t
			},
			state: b
		});
		n && (x = {
			...n,
			point: {
				x: e,
				y: t
			}
		});
	}
	function ie(e) {
		ne = !0, P?.setTarget({
			x: e.clientX - I.x,
			y: e.clientY - I.y
		}), U(e.clientX, e.clientY), ee?.update(t.resolveMoveSurfaceElement(n, e.clientX, e.clientY), {
			x: e.clientX,
			y: e.clientY
		});
	}
	function W(e) {
		if (A || (A = !0, O = null, k = null, F = P ? { ...P.getState() } : void 0, P?.stop(), P = null, ee?.stop(), !b || !j)) return { accepted: !1 };
		e && U(e.clientX, e.clientY);
		let i = b.release();
		x = i ? {
			...i,
			point: e ? {
				x: e.clientX,
				y: e.clientY
			} : i.point,
			...F ? { releaseVelocity: {
				x: F.vx,
				y: F.vy
			} } : {}
		} : null, !x && !ne && F && Math.hypot(F.vx, F.vy) < .5 && m && (x = {
			columnId: m,
			index: L ?? Math.max(0, t.getObjectSurfaceIndex(n, m))
		});
		let o = !x;
		if (o && m && (x = {
			columnId: m,
			index: L ?? Math.max(0, t.getObjectSurfaceIndex(n, m)),
			invalidReturn: !0
		}), !x) return { accepted: !1 };
		if (t.updateVisualProxy(j), t.freezeSessionContentScale(j), F) {
			let e = a({
				x: F.vx,
				y: F.vy
			}, t.getObjectReleaseMotionProfile(n, x));
			F.vx = e.x, F.vy = e.y, x.releaseVelocity = {
				x: F.vx,
				y: F.vy
			};
		}
		let s = t.getMoveContext(j)?.sourceSize;
		s && (x.sourceSize = { ...s });
		let c = x, l = w?.getBoundingClientRect() ?? t.getVisualProxy(j)?.element.getBoundingClientRect() ?? ae(r)?.getBoundingClientRect() ?? r.getBoundingClientRect();
		delete r.dataset.runtimeActive, o && (re || N?.restoreLayoutHidden(), M?.release());
		let u = (e, i, a) => {
			if (B() !== "landing") return;
			let o = i?.kind === "element" ? i.element : null, s = o ?? t.resolveVisualTarget(j, c) ?? t.objects.get(n)?.element ?? null, u = De({
				resolve: () => s,
				applyState: (e) => t.applyVisualState(n, e, {
					phase: "revealing",
					hovered: !1,
					selected: e.classList.contains("is-selected"),
					grabbed: !1
				})
			});
			if (!u) {
				C?.complete({
					completed: !1,
					reason: "target-not-registered"
				}), C = null;
				return;
			}
			E = u, D = u, o && (t.concealVisualTarget(e, u), t.keepSurfaceTargetVisible(c.columnId, u)), !o && i?.kind === "rect" && t.concealVisualTarget(e, u);
			let d = t.findObjectIdByElement(u, n) ?? n, f = i?.kind === "rect" ? (() => {
				let e = u.getBoundingClientRect();
				return e.width > 0 && e.height > 0 ? {
					left: e.left,
					top: e.top,
					width: e.width,
					height: e.height
				} : i.rect;
			})() : i?.kind === "element" ? i.element : u, p = Oe((e, n) => t.captureVisualState(d, e, n), u, {
				ignoreTemporaryOpacity: !0,
				rect: a ?? (i?.kind === "rect" ? f : void 0) ?? void 0
			}), m = ke({
				createContext: () => t.createVisualLifecycleContext(e, c, f, v),
				source: r,
				sourceRect: l,
				visualSnapshot: y,
				targetSnapshot: p,
				motionState: F
			});
			t.setVisualProxyZIndex(e, m.landingProxyZIndex), w = Ae({
				createProxy: () => t.getVisualProxy(e) ?? t.createVisualProxy(e, m) ?? null,
				enableProxy: (e) => T(e, !0),
				bindRegrab: (r) => {
					t.bindRegrabTarget(e, n, r, (e) => q(e, n));
					let i = t.getGroup(e);
					if (i) for (let e of i.objectIds) {
						let r = t.objects.get(e)?.element;
						r?.isConnected && (r.style.pointerEvents = "auto", e !== n && t.registerRegrab(e, (t) => q(t, e)));
					}
				},
				land: () => t.landVisualProxy(e, i?.kind === "rect" ? i.rect : u, m),
				onMissing: () => {
					C?.complete({
						completed: !1,
						reason: "visual-proxy-missing"
					}), C = null;
				},
				onComplete: (n) => {
					je({
						active: B() === "landing",
						result: n,
						complete: (e) => C?.complete(e),
						reveal: () => t.revealVisualProxy(e, u, m).then(() => {
							w &&= (t.disposeVisualProxy(e), null), E = null;
						})
					}), C = null;
				}
			});
		};
		return S = Ee(() => void 0, () => {
			let e = j, n = O, r = k;
			if (O = null, k = null, n && V(n, c)) {
				u(e, n, r);
				return;
			}
			t.resolveLandingTarget(e, c).then((t) => u(e, t));
		}), {
			accepted: !0,
			destination: x,
			...o ? { emitAction: !1 } : {}
		};
	}
	function G(e) {
		for (let r of e?.objectIds ?? [n]) t.clearRegrab(r);
	}
	function q(e, r = n) {
		if (B() !== "landing") return;
		let i = w;
		if (!i || !j) return;
		let a = t.getGroup(j), o = a ? t.objects.get(a.primaryObjectId)?.visual : void 0, s = t.resolveVisualTarget(j, x), c = t.objects.get(n)?.element ?? null, l = a ? t.objects.get(a.primaryObjectId)?.element ?? null : Me(() => E ?? s, () => c);
		if (!l) return;
		let u = t.findObjectIdByElement(l, n) ?? n, d = t.createRegrabContext(j, e, i, l);
		if (!d) return;
		Te({
			event: d.event,
			sessionId: j,
			proxy: i,
			source: l,
			interrupt: () => t.takeoverRegrab(j),
			clearRegrab: () => G(a)
		});
		let f = l.getBoundingClientRect();
		a ? (o && t.objects.update(a.primaryObjectId, { visual: o }), t.startGroupObjectPointer(a.objectIds, a.primaryObjectId, l, e, d.regrabRect, f)) : t.startObjectPointer(u, l, e, d.regrabRect, f);
	}
	return {
		driver: {
			prepare(e) {
				j = e.session.id, ne = !1;
				let a = r.style.visibility === "hidden" || getComputedStyle(r).visibility === "hidden";
				if (ee = t.createAutoScroller(j, { onScroll: (e) => U(e.x, e.y) }), e.session.state !== "prepare") return;
				t.objects.setElement(n, r), r.style.visibility = "", r.style.pointerEvents = "", a && (r.style.transition = ""), M = t.acquireObject(j, n), t.takeSurfaces(j, p);
				let c = t.getGroup(j);
				re = !!c;
				let { beforePickup: d } = Se(r, _, R, z);
				L = t.getObjectSurfaceIndex(n, m), v = r.cloneNode(!0);
				let h = ye(t.getMoveContext(j), r, i, o, t.getObjectGrabAlign(n)), g = h.rect;
				I = {
					x: h.offsetX,
					y: h.offsetY
				}, document.body.classList.add("kb-dragging"), t.applyVisualState(n, r, {
					phase: "dragging",
					hovered: r.matches(":hover"),
					selected: r.classList.contains("is-selected"),
					grabbed: !0
				}), y = ve((e, r) => t.captureVisualState(n, r), n, r), N = ge(r, j);
				let x = t.getObjectProxyLayout(n, r), S = !!x?.compact, C = m ? t.resolveMoveSurfaceViewport(m) : null, w = !!(C && C.scrollHeight > C.clientHeight && C.scrollTop >= C.scrollHeight - C.clientHeight - 1), T = t.getObjectCameraConfig(n);
				K(r, g, {
					layout: x,
					contentScale: T.enabled && T.pickup && T.scale ? t.getSurfaceCameraPickupScale(m, j) : void 0,
					cameraShell: T.enabled && T.scale,
					affordancesSelector: t.getObjectAffordancesConfig(n)?.selector,
					keepSourceVisible: !!(c && c.objectIds.length > 1),
					proxyZIndex: t.getObjectProxyZIndex(n)
				}), pe(r, j);
				let E = oe(r);
				E && t.registerVisualProxy(j, { element: E }), E && t.updateVisualProxy(j), r.style.pointerEvents = "none", !s && !c && (N.detachFromLayout(), w && C && (C.scrollTop = Math.max(0, C.scrollHeight - C.clientHeight))), r.style.transition = "none", c || t.scheduleLayout(d), r.dataset.runtimeActive = "true";
				let D = t.getVisualProxy(j)?.element ?? ae(r);
				if (!D) return;
				D.style.transition = "none";
				let O = g.left, k = g.top, A = (e) => {
					if (!D.isConnected) return;
					t.updateVisualProxy(j);
					let n = e.x - O, r = e.y - k;
					D.style.transform = `translate3d(${n.toFixed(2)}px, ${r.toFixed(2)}px, 0) scale(${e.scaleX.toFixed(4)}, ${e.scaleY.toFixed(4)})`, te(D).style.transform = `perspective(760px) rotateX(${e.rotateX.toFixed(2)}deg) rotateZ(${e.rotateZ.toFixed(2)}deg)`;
				};
				if (t.getObjectMotionEnabled(n)) {
					let e = f({
						mode: "follow",
						followRotation: u,
						onFrame: A
					});
					e.setProfile(l), e.seed({
						x: g.left,
						y: g.top,
						scaleX: 1,
						scaleY: 1,
						rotateX: u.tilt,
						rotateZ: 0
					}), e.setTarget({
						x: i.clientX - I.x,
						y: i.clientY - I.y,
						scaleX: S ? 1 : 1.03,
						scaleY: S ? 1 : 1.03
					}), e.start(), P = e;
				} else {
					let e = _e({ onFrame: A });
					e.setTarget({
						x: i.clientX - I.x,
						y: i.clientY - I.y
					}), P = e;
				}
				b = Ce((e) => t.resolveMoveHit(n, e.clientX, e.clientY), (e, t) => e.columnId === t?.columnId && e.index === t?.index), U(i.clientX, i.clientY);
			},
			update(e, t) {
				t.event instanceof PointerEvent && ie(t.event);
			},
			resolveDestination(e, t) {
				return W(t.event instanceof PointerEvent ? t.event : void 0);
			},
			commit: (e, n) => {
				t.getVisualProxy(j) || se(r);
				let i = typeof n == "object" && !!n && n.invalidReturn === !0, a = typeof n == "object" && n ? n.toSurfaceId ?? n.columnId : void 0;
				re || (s || i || !i && typeof a == "string" && a === m ? N?.restoreLayoutHidden() : N?.detachFromLayout()), document.body.classList.remove("kb-dragging");
			},
			cancel(e, n) {
				A = !0, O = null, k = null, P?.stop(), P = null, t.getVisualProxy(j) ? t.disposeVisualProxy(j) : w ? (t.disposeVisualProxy(j), w = null) : se(r), G(t.getGroup(j)), document.body.classList.remove("kb-dragging"), delete r.dataset.runtimeActive, se(r), N?.restore(), N = null;
			}
		},
		lifecycle: {
			layout: Pe(r, _, R, z, t.layout, g),
			surface: { enter: async () => {
				M?.release(), await H();
			} },
			...Ne({
				createGate: () => t.createCompletionGate(j, {
					completed: !1,
					reason: "landing-cancelled"
				}),
				onGate: (e) => {
					C = e;
				},
				clearDragging: () => document.body.classList.remove("kb-dragging"),
				scheduleLanding: () => {
					S?.(), S = null;
				},
				clearRegrab: () => G(t.getGroup(j)),
				finishReveal: () => {
					w && T(w, !1);
					let e = D?.isConnected ? D : r.isConnected ? r : null;
					e && t.applyVisualState(n, e, {
						phase: "idle",
						hovered: e.matches(":hover"),
						selected: e.classList.contains("is-selected"),
						grabbed: !1
					}), D = null, O = null, k = null, se(r), N?.restore(), N = null;
				}
			})
		}
	};
}
function Ie(e) {
	return Fe({
		...e,
		clone: !0
	});
}
//#endregion
export { u as C, o as D, i as E, a as O, l as S, s as T, w as _, R as a, y as b, V as c, z as d, B as f, N as g, E as h, J as i, F as l, ue as m, Fe as n, fe as o, X as p, ge as r, j as s, Ie as t, de as u, v, c as w, f as x, b as y };
