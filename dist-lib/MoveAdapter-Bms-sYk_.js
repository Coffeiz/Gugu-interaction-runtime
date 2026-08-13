//#region src/dom/MotionProfile.ts
var e = {
	flip: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	resize: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	landing: {
		duration: 300,
		easing: "cubic-bezier(.22,1,.36,1)"
	},
	freeLanding: {
		duration: 550,
		easing: "cubic-bezier(.22,1,.36,1)",
		coastSeconds: .12,
		maxCoast: 260,
		minVelocity: 30
	},
	target: {
		motion: {
			position: {
				stiffness: 420,
				damping: 41
			},
			scale: {
				stiffness: 420,
				damping: 41
			}
		},
		landing: {
			duration: 300,
			easing: "cubic-bezier(.22,1,.36,1)"
		},
		dismiss: {
			duration: 300,
			easing: "cubic-bezier(.22,1,.36,1)",
			scale: .72
		}
	},
	group: {
		duration: 250,
		easing: "cubic-bezier(.22,1,.36,1)"
	}
}, t = {
	velocityScale: 1,
	minVelocity: 30,
	maxVelocity: 5e3,
	dampingRatio: .78,
	maxCoast: 0,
	coastSeconds: .12
};
function n(e, n = t) {
	if (Math.hypot(e.x, e.y) < n.minVelocity) return {
		x: 0,
		y: 0
	};
	let r = e.x * n.velocityScale, i = e.y * n.velocityScale, a = Math.hypot(r, i);
	if (a <= n.maxVelocity || a === 0) return {
		x: r,
		y: i
	};
	let o = n.maxVelocity / a;
	return {
		x: r * o,
		y: i * o
	};
}
function r(e, r = t) {
	let i = n(e, r), a = Math.hypot(i.x, i.y) * r.coastSeconds;
	if (a <= 0 || r.maxCoast <= 0) return {
		x: 0,
		y: 0
	};
	let o = Math.min(1, r.maxCoast / a);
	return {
		x: i.x * r.coastSeconds * o,
		y: i.y * r.coastSeconds * o
	};
}
//#endregion
//#region src/motion/physics.ts
function i(e, t, n, r, i, a = 1 / 120) {
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
var a = {
	position: {
		stiffness: 420,
		damping: 41
	},
	scale: {
		stiffness: 420,
		damping: 41
	}
}, o = {
	position: {
		stiffness: 360,
		damping: 1.7 * Math.sqrt(360)
	},
	scale: {
		stiffness: 420,
		damping: 30
	}
}, s = {
	tilt: 5,
	sway: .25,
	smoothing: .2
}, c = {
	position: .35,
	velocity: 5,
	scalePosition: .001,
	scaleVelocity: .01
};
function l(e) {
	let t = e.mode ?? "settle";
	if (t === "follow" && !e.followRotation) throw Error("CardMotionController: mode \"follow\" 需要提供 followRotation 参数");
	let n = e.arriveThreshold ?? c, r = {
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
	}, o = {
		x: 0,
		y: 0
	}, s = a, l = null, u = null, d = !1, f = 0, p = 0, m = "settle", h = 0;
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
	function _(a) {
		if (!d) return;
		let b = Math.min(.032, Math.max(0, (a - (u ?? a)) / 1e3));
		if (u = a, m === "coast") {
			let e = Math.exp(-v.friction * b);
			r.vx *= e, r.vy *= e;
			let t = r.vx * b, n = r.vy * b, i = h + Math.hypot(t, n);
			if (i >= v.maxDistance) {
				let e = Math.max(0, v.maxDistance - h), i = Math.hypot(t, n), a = i > 0 ? e / i : 0;
				r.x += t * a, r.y += n * a, r.vx = 0, r.vy = 0, m = "settle";
			} else r.x += t, r.y += n, h = i, ((a - (y ?? a)) / 1e3 >= v.duration || Math.hypot(r.vx, r.vy) <= v.minVelocity) && (m = "settle");
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
			i(e, {
				x: o.x,
				y: o.y
			}, s.position.stiffness, s.position.damping, b), r.x = e.position.x, r.y = e.position.y, r.vx = e.velocity.x, r.vy = e.velocity.y;
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
		if (i(x, {
			x: o.scaleX ?? r.scaleX,
			y: o.scaleY ?? r.scaleY
		}, s.scale.stiffness, s.scale.damping, b), r.scaleX = x.position.x, r.scaleY = x.position.y, r.scaleVX = x.velocity.x, r.scaleVY = x.velocity.y, t === "follow") {
			let t = e.followRotation, n = -Math.log(1 - (t.smoothing ?? .2)) * 60, i = 1 - Math.exp(-n * b);
			f += (r.vx - f) * i, p += (r.vy - p) * i, r.rotateZ = Math.max(-(t.maxSway ?? 5), Math.min(t.maxSway ?? 5, f / 60 * t.sway));
			let a = Math.max(-(t.maxTiltDelta ?? 4), Math.min(t.maxTiltDelta ?? 4, p / 60 * (t.verticalTiltFactor ?? .16)));
			r.rotateX = t.tilt + a;
		} else {
			let e = Math.exp(-10 * b);
			r.rotateX *= e, r.rotateZ *= e;
		}
		if (g(), t === "follow") {
			l = requestAnimationFrame(_);
			return;
		}
		if (m === "settle" && Math.abs(o.x - r.x) < n.position && Math.abs(o.y - r.y) < n.position && Math.abs(r.vx) < n.velocity && Math.abs(r.vy) < n.velocity && Math.abs((o.scaleX ?? r.scaleX) - r.scaleX) < (n.scalePosition ?? c.scalePosition) && Math.abs((o.scaleY ?? r.scaleY) - r.scaleY) < (n.scalePosition ?? c.scalePosition) && Math.abs(r.scaleVX) < (n.scaleVelocity ?? c.scaleVelocity) && Math.abs(r.scaleVY) < (n.scaleVelocity ?? c.scaleVelocity)) {
			d = !1, l = null, e.onArrived?.();
			return;
		}
		l = requestAnimationFrame(_);
	}
	let v = null, y = null;
	return {
		seed(e) {
			Object.assign(r, e);
		},
		setTarget(e) {
			o = { ...e };
		},
		retarget(e) {
			o = { ...e };
		},
		setProfile(e) {
			s = e;
		},
		getState() {
			return r;
		},
		start() {
			d || (d = !0, m = "settle", v = null, y = null, u = null, g(), l = requestAnimationFrame(_));
		},
		startCoastThenSettle(e) {
			if (d) return;
			d = !0, m = "coast", v = e, h = 0, y = null;
			let t = Math.hypot(r.vx, r.vy), n = e.maxDistance / Math.max(e.duration, 1 / 60);
			if (t > n && t > 0) {
				let e = n / t;
				r.vx *= e, r.vy *= e;
			}
			u = null, g(), l = requestAnimationFrame((e) => {
				y = e, _(e);
			});
		},
		interrupt() {
			return d = !1, l !== null && cancelAnimationFrame(l), l = null, { ...r };
		},
		cancel() {
			return d = !1, l !== null && cancelAnimationFrame(l), l = null, { ...r };
		},
		stop() {
			d = !1, l !== null && cancelAnimationFrame(l), l = null;
		}
	};
}
//#endregion
//#region src/motion/FreeLandingMotion.ts
function u(e, t, n, r) {
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
function d(e) {
	let t = e.match(/^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);
	return t ? u(...t.slice(1).map(Number)) : e === "linear" ? (e) => e : e === "ease-in" ? u(.42, 0, 1, 1) : e === "ease-out" ? u(0, 0, .58, 1) : e === "ease-in-out" ? u(.42, 0, .58, 1) : u(.22, 1, .36, 1);
}
function f(e) {
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
	}, r = { ...t }, i = 0, a = null, o = !1, s = d(e.easing), c = (i) => {
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
var p = [
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
function m(e) {
	let t = getComputedStyle(e);
	return Object.fromEntries(p.map((e) => [e, t.getPropertyValue(e)]));
}
function h(e, t) {
	for (let n of p) {
		let r = t[n];
		r && e.style.setProperty(n, r);
	}
}
function g(e, t) {
	h(t, m(e));
}
//#endregion
//#region src/dom/Visual.ts
function _(e) {
	let t = getComputedStyle(e);
	return {
		fontFamily: t.fontFamily,
		color: t.color,
		fontSize: t.fontSize,
		fontWeight: t.fontWeight,
		lineHeight: t.lineHeight,
		letterSpacing: t.letterSpacing,
		textAlign: t.textAlign,
		direction: t.direction,
		wordSpacing: t.wordSpacing,
		whiteSpace: t.whiteSpace,
		textIndent: t.textIndent
	};
}
function v(e, t) {
	e.style.fontFamily = t.fontFamily, e.style.color = t.color, e.style.fontSize = t.fontSize, e.style.fontWeight = t.fontWeight, e.style.lineHeight = t.lineHeight, e.style.letterSpacing = t.letterSpacing, e.style.textAlign = t.textAlign, e.style.direction = t.direction, e.style.wordSpacing = t.wordSpacing, e.style.whiteSpace = t.whiteSpace, e.style.textIndent = t.textIndent;
}
function y(e, t) {
	e.style.pointerEvents = t ? "auto" : "none";
}
function b(e, t) {
	e.style.setProperty("box-shadow", t, "important");
}
function x(e, t = e.getBoundingClientRect(), n = {}) {
	let r = n.layout?.compact, i = document.createElement("div"), a = document.createElement("div"), o = e.cloneNode(!0);
	a.dataset.runtimeProxyScaleShell = "true", o.dataset.runtimeProxyContent = "true", Object.assign(a.style, {
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
	}), o.dataset.runtimePhase = "grab-start", a.appendChild(o), i.appendChild(a), i.className = "", i.style.position = "fixed", i.style.left = `${t.left}px`, i.style.top = `${t.top}px`, i.style.boxSizing = "border-box", i.style.width = `${t.width}px`, i.style.height = `${t.height}px`, C(i, n.contentScale), i.style.margin = "0", i.style.zIndex = "2147483647", i.style.pointerEvents = "none", i.style.visibility = "visible", i.style.willChange = "transform", i.style.display = "", i.dataset.runtimeProxy = "true", i.style.transformOrigin = "50% 50%", i.style.transform = "scale(1)", W && n.glass !== !1 ? oe(o) : b(o, "0 12px 24px rgba(0,0,0,.18)"), r && (o.dataset.runtimeCompact = "true");
	let s = r?.duration ?? 200, c = r?.easing ?? "cubic-bezier(.22,1,.36,1)";
	return o.style.transition = `left ${s}ms ${c}, width ${s}ms ${c}, transform ${s}ms ${c}, grid-template-columns ${s}ms ${c}, box-shadow .15s ease, border-radius .15s ease, background-color .15s ease, opacity .15s ease`, i.style.transition = "transform .15s ease", document.documentElement.appendChild(i), requestAnimationFrame(() => {
		i.isConnected && o.dataset.runtimePhase === "grab-start" && (o.dataset.runtimePhase = "grabbing", r && (o.style.left = r.left ?? "50%", o.style.width = r.width, o.style.transform = r.transform ?? "translateX(-50%)", r.gridTemplateColumns && (o.style.gridTemplateColumns = r.gridTemplateColumns)));
	}), ae.add(i), i;
}
function S(e) {
	let t = typeof e == "function" ? e() : e;
	return typeof t == "number" && Number.isFinite(t) && t > 0 ? t : 1;
}
function C(e, t) {
	let n = S(t), r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = Number(e.dataset.runtimeProxyBaseWidth) || r / n, o = Number(e.dataset.runtimeProxyBaseHeight) || i / n;
	e.dataset.runtimeProxyBaseWidth = String(a), e.dataset.runtimeProxyBaseHeight = String(o);
	let s = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!s) return;
	s.style.width = `${a}px`, s.style.height = `${o}px`;
	let c = parseFloat(e.style.width) || r, l = parseFloat(e.style.height) || i;
	s.style.left = `${(c - a * n) / 2}px`, s.style.top = `${(l - o * n) / 2}px`, s.style.transform = `scale(${n})`;
}
function w(e, t) {
	let n = S(t), r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = e.querySelector("[data-runtime-proxy-scale-shell]");
	a && (a.style.left = "0px", a.style.top = "0px", a.style.width = `${r / n}px`, a.style.height = `${i / n}px`, a.style.transform = `scale(${n})`);
}
function T(e, t) {
	let n = e.querySelector("[data-runtime-proxy-scale-shell]");
	if (!n) return null;
	let r = parseFloat(e.style.width) || e.getBoundingClientRect().width, i = parseFloat(e.style.height) || e.getBoundingClientRect().height, a = t > 0 ? t : 1, o = Number(e.dataset.runtimeProxyBaseWidth) || r / a, s = Number(e.dataset.runtimeProxyBaseHeight) || i / a;
	return n.style.width = `${o}px`, n.style.height = `${s}px`, n.style.left = `${(r - o * a) / 2}px`, n.style.top = `${(i - s * a) / 2}px`, n.style.transform = `scale(${a})`, {
		shell: n,
		baseWidth: o,
		baseHeight: s
	};
}
function E(e, t, n, r) {
	let i = e.baseWidth * r, a = e.baseHeight * r;
	e.shell.style.left = `${(t - i) / 2}px`, e.shell.style.top = `${(n - a) / 2}px`, e.shell.style.transform = `scale(${r})`;
}
function D(e) {
	return e;
}
function O(e) {
	return e.querySelector("[data-runtime-proxy-content]:not([data-runtime-group-modifier])") ?? e;
}
function k(e) {
	let t = [], n = 0, r = 0;
	for (let i = 0; i < e.length; i += 1) {
		let a = e[i];
		a === "(" ? r += 1 : a === ")" ? r = Math.max(0, r - 1) : a === "," && r === 0 && (t.push(e.slice(n, i).trim()), n = i + 1);
	}
	let i = e.slice(n).trim();
	return i && t.push(i), t;
}
function A(e, t) {
	let n = k(e), r = k(t);
	if (n.length >= r.length || n.length === 0) return e;
	let i = /* @__PURE__ */ new Map();
	i.set("inset", n.filter((e) => /\binset\b/i.test(e))), i.set("outer", n.filter((e) => !/\binset\b/i.test(e)));
	let a = (e) => /\binset\b/i.test(e) ? "inset 0 0 0 0 rgba(0, 0, 0, 0)" : "0 0 0 0 rgba(0, 0, 0, 0)", o = /* @__PURE__ */ new Map([["inset", 0], ["outer", 0]]);
	return r.map((e) => {
		let t = /\binset\b/i.test(e) ? "inset" : "outer", n = i.get(t) ?? [], r = o.get(t) ?? 0;
		return r < n.length ? (o.set(t, r + 1), n[r]) : a(e);
	}).join(", ");
}
function ee(e, t, n) {
	if (t == null) {
		e.style.transition = n;
		return;
	}
	let r = e.style.boxShadow || getComputedStyle(e).boxShadow;
	e.style.transition = "none", b(e, A(r, t)), e.offsetWidth, e.style.transition = n;
}
function j(e) {
	return `${e.tagName}:${(e.textContent ?? "").trim()}`;
}
function M(e) {
	let t = [];
	for (let n of Array.from(e.childNodes)) {
		if (n.nodeType === Node.COMMENT_NODE) {
			n.remove();
			continue;
		}
		if (n.nodeType === Node.TEXT_NODE) {
			if (!(n.textContent ?? "").trim()) {
				n.remove();
				continue;
			}
			let e = document.createElement("span");
			e.textContent = n.textContent, n.replaceWith(e), t.push(e);
			continue;
		}
		n.nodeType === Node.ELEMENT_NODE && t.push(n);
	}
	return t;
}
function N(e, t) {
	let n = getComputedStyle(t), r = parseFloat(n.paddingTop) || 0, i = parseFloat(n.paddingRight) || 0, a = parseFloat(n.paddingBottom) || 0, o = {
		position: "absolute",
		left: `${parseFloat(n.paddingLeft) || 0}px`,
		top: `${r}px`,
		right: `${i}px`,
		bottom: `${a}px`,
		pointerEvents: "none"
	}, s = document.createElement("div");
	Object.assign(s.style, { ...o });
	let c = getComputedStyle(e);
	for (s.style.display = c.display, s.style.flexDirection = c.flexDirection, s.style.flexWrap = c.flexWrap, s.style.alignItems = c.alignItems, s.style.justifyContent = c.justifyContent, s.style.gap = c.gap; e.firstChild;) s.appendChild(e.firstChild);
	let l = M(s), u = new Set(l.map(j)), d = document.createElement("div");
	Object.assign(d.style, {
		...o,
		pointerEvents: ""
	}), d.style.display = n.display, d.style.gridTemplateColumns = n.gridTemplateColumns, d.style.gridTemplateRows = n.gridTemplateRows, d.style.gridAutoColumns = n.gridAutoColumns, d.style.gridAutoRows = n.gridAutoRows, d.style.gridAutoFlow = n.gridAutoFlow, d.style.justifyItems = n.justifyItems, d.style.alignItems = n.alignItems, d.style.justifyContent = n.justifyContent, d.style.alignContent = n.alignContent, d.style.columnGap = n.columnGap, d.style.rowGap = n.rowGap, d.style.flexDirection = n.flexDirection, d.style.flexWrap = n.flexWrap, d.style.alignItems = n.alignItems, d.style.justifyContent = n.justifyContent, d.style.gap = n.gap, d.style.overflow = "hidden";
	let f = t.cloneNode(!0);
	for (f.style.visibility = "visible", f.style.display = ""; f.firstChild;) d.appendChild(f.firstChild);
	v(d, _(t));
	let p = M(d), m = new Set(p.map(j)), h = p.filter((e) => !u.has(j(e)));
	for (let e of h) e.style.opacity = "0";
	let g = l.filter((e) => !m.has(j(e))), y = new Set(g);
	for (let e of l) y.has(e) || (e.style.opacity = "0");
	return e.appendChild(d), g.length > 0 && e.appendChild(s), {
		enteringEls: h,
		leavingEls: g
	};
}
function te(e, t) {
	let n = Math.max(t.left, t.right - e.width), r = Math.max(t.top, t.bottom - e.height);
	return {
		left: Math.min(Math.max(e.left, t.left), n),
		top: Math.min(Math.max(e.top, t.top), r),
		width: e.width,
		height: e.height
	};
}
function P(t, n, r = {}) {
	let i = r.duration ?? e.landing.duration, a = r.easing ?? "cubic-bezier(.22,1,.36,1)", o = r.targetShadow, s = r.targetRadius, c = r.targetBorder, l = r.targetBackdropFilter, u = r.targetBackground, d = r.targetOpacity, f = O(t), p = r.targetContent ? N(f, r.targetContent) : null;
	if (p) {
		for (let e of p.enteringEls) e.style.transition = `opacity ${i}ms ${a}`;
		for (let e of p.leavingEls) e.style.transition = `opacity ${i}ms ${a}`;
	}
	let m = parseFloat(t.style.left) || 0, h = parseFloat(t.style.top) || 0, g = !1, _ = n, v = performance.now(), y = () => void 0, x = () => void 0, S = new Promise((e) => {
		x = e;
	}), C = () => {
		let e = t.getBoundingClientRect();
		return Math.abs(e.left - _.left) < 2 && Math.abs(e.top - _.top) < 2 && Math.abs(e.width - _.width) < 2 && Math.abs(e.height - _.height) < 2;
	}, w = null, T = null, E = 0, D = (e) => {
		g || (g = !0, t.removeEventListener("transitionend", y), T !== null && (window.clearTimeout(T), T = null), x());
	}, k = () => {
		if (!g) {
			if (C()) {
				D("waitForTarget:isAtTarget");
				return;
			}
			if (performance.now() - v >= i + 500) {
				D("waitForTarget:timeout");
				return;
			}
			window.requestAnimationFrame(k);
		}
	}, A = (e, n = i) => {
		_ = e;
		let g = t.getBoundingClientRect();
		t.style.transition = "none", t.style.width = `${g.width.toFixed(2)}px`, t.style.height = `${g.height.toFixed(2)}px`, t.style.transform = `translate3d(${(g.left - m).toFixed(2)}px, ${(g.top - h).toFixed(2)}px, 0)`, t.style.transform = "none", t.offsetWidth;
		let v = `translate3d(${(e.left - m).toFixed(2)}px, ${(e.top - h).toFixed(2)}px, 0)`;
		t.style.transition = `transform ${n}ms ${a}, width ${n}ms ${a}, height ${n}ms ${a}`;
		let y = [
			`box-shadow ${n}ms ease`,
			`border-radius ${n}ms ease`,
			`border-color ${n}ms ease`,
			`backdrop-filter ${n}ms ease`,
			`-webkit-backdrop-filter ${n}ms ease`,
			`background-color ${n}ms ease`,
			`background-image ${n}ms ease`,
			`opacity ${n}ms ease`
		].join(", ");
		ee(f, o, y), requestAnimationFrame(() => {
			if (t.style.transform = v, t.style.width = `${e.width.toFixed(2)}px`, t.style.height = `${e.height.toFixed(2)}px`, o != null && b(f, o), s != null && (f.style.borderRadius = s), c != null && (f.style.border = c), l != null && (f.style.backdropFilter = l, f.style.setProperty("-webkit-backdrop-filter", l)), u != null && (f.style.backgroundColor = u, r.targetBackgroundImage && (f.style.backgroundImage = r.targetBackgroundImage)), d != null && (f.style.opacity = d), p) {
				for (let e of p.enteringEls) e.style.opacity = "1";
				for (let e of p.leavingEls) e.style.opacity = "0";
			}
		});
	};
	y = (e) => {
		e.target === t && (e.propertyName === "transform" || e.propertyName === "width" || e.propertyName === "height") && C() && D(`transitionend:${e.propertyName}`);
	}, t.addEventListener("transitionend", y), A(n), window.setTimeout(k, i + 40);
	let j = (e) => {
		E = performance.now();
		let t = Math.max(80, i - (E - v));
		A(r.readTarget?.() ?? e, t);
	};
	return {
		finished: S,
		retarget: (e) => {
			if (g) return;
			let t = Math.abs(e.left - _.left), n = Math.abs(e.top - _.top), r = Math.abs(e.width - _.width), i = Math.abs(e.height - _.height);
			if (t < .5 && n < .5 && r < .5 && i < .5) return;
			let a = performance.now() - E;
			if (a >= 60) {
				j(e);
				return;
			}
			w = e, T === null && (T = window.setTimeout(() => {
				if (T = null, g || !w) return;
				let e = w;
				w = null, j(e);
			}, 60 - a));
		}
	};
}
function F(t, n, r = {}) {
	let i = r.duration ?? e.landing.duration, o = r.easing ?? "cubic-bezier(.22,1,.36,1)", s = r.targetShadow, c = r.targetRadius, u = r.targetBorder, d = r.targetBackdropFilter, p = r.targetBackground, m = r.targetOpacity, h = O(t), g = t.querySelector("[data-runtime-proxy-scale-shell]"), _ = r.targetContent ? N(h, r.targetContent) : null;
	if (_) {
		for (let e of _.enteringEls) e.style.transition = `opacity ${i}ms ${o}`;
		for (let e of _.leavingEls) e.style.transition = `opacity ${i}ms ${o}`;
	}
	r.motionState && (t.style.left = `${r.motionState.x}px`, t.style.top = `${r.motionState.y}px`);
	let v = parseFloat(t.style.left) || t.getBoundingClientRect().left, y = parseFloat(t.style.top) || t.getBoundingClientRect().top, x = t.getBoundingClientRect(), C = parseFloat(t.style.width) || x.width || n.width, D = parseFloat(t.style.height) || x.height || n.height, k = S(r.contentScale), A = T(t, k), j = A && r.landingContentScale !== void 0 ? S(r.landingContentScale) : 0, M = r.cameraOrigin?.(), te = !!(r.landingMode === "free" && M && Number.isFinite(M.left) && Number.isFinite(M.top)), P = null, F = null;
	if (te && M) {
		P = document.createElement("div"), P.dataset.runtimeCameraGlue = "true", Object.assign(P.style, {
			position: "fixed",
			left: "0",
			top: "0",
			right: "0",
			bottom: "0",
			transition: "none",
			transform: "translate3d(0, 0, 0)",
			transformOrigin: `${M.left}px ${M.top}px`,
			pointerEvents: "none",
			zIndex: t.style.zIndex,
			willChange: "transform"
		}), t.parentElement?.appendChild(P), P.appendChild(t);
		let e = () => {
			if (!P?.isConnected) return;
			let t = r.cameraOrigin?.();
			if (t && Number.isFinite(t.left) && Number.isFinite(t.top)) {
				let e = S(r.contentScale), n = k > .01 ? e / k : 1;
				P.style.transform = `translate3d(${(t.left - M.left).toFixed(2)}px, ${(t.top - M.top).toFixed(2)}px, 0) scale(${n.toFixed(4)})`;
			}
			F = window.requestAnimationFrame(e);
		};
		F = window.requestAnimationFrame(e);
	}
	let I = (e) => ({
		left: e.left - (C - e.width) / 2,
		top: e.top - (D - e.height) / 2,
		width: e.width,
		height: e.height
	}), L = n, R = !1, z = r.landingMode === "target" && !!g, B = z ? r.dismiss?.duration ?? i : 0, V = !1, ne = !z, H = null, U = null, re = 0, ie = () => void 0, ae = new Promise((e) => {
		ie = e;
	}), W = () => {
		R || (R = !0, q.stop(), H !== null && window.clearTimeout(H), U !== null && window.clearTimeout(U), H = null, U = null, F !== null && window.cancelAnimationFrame(F), F = null, P?.remove(), P = null, ie());
	}, G = () => {
		V && ne && W();
	}, K = () => {
		R || (V = !0, G());
	}, oe = (e) => {
		let n = e.x, i = e.y;
		if (t.style.transform = `perspective(760px) translate3d(${(n - v).toFixed(2)}px, ${(i - y).toFixed(2)}px, 0) rotateX(${e.rotateX.toFixed(2)}deg) rotateZ(${e.rotateZ.toFixed(2)}deg)`, r.landingMode === "free" && A) E(A, C, D, e.scaleX * k);
		else {
			let n = C * e.scaleX, i = D * e.scaleY, a = e.x + (C - n) / 2, o = e.y + (D - i) / 2;
			t.style.width = `${n.toFixed(2)}px`, t.style.height = `${i.toFixed(2)}px`, t.style.transform = `perspective(760px) translate3d(${(a - v).toFixed(2)}px, ${(o - y).toFixed(2)}px, 0) rotateX(${e.rotateX.toFixed(2)}deg) rotateZ(${e.rotateZ.toFixed(2)}deg)`, r.landingMode === "target" && z || (A && j > 0 ? (A.shell.style.left = `${((n - A.baseWidth) / 2).toFixed(2)}px`, A.shell.style.top = `${((i - A.baseHeight) / 2).toFixed(2)}px`, A.shell.style.transform = `scale(${j})`) : A && w(t, () => e.scaleX * k));
		}
	}, q = r.landingMode === "free" ? f({
		duration: i,
		easing: o,
		onFrame: oe,
		onArrived: K
	}) : l({
		mode: "settle",
		onFrame: oe,
		onArrived: K
	}), se = Math.hypot(r.motionState?.vx ?? 0, r.motionState?.vy ?? 0), ce = r.releaseDamping ?? .78, le = r.targetMotion ? {
		position: {
			...a.position,
			...r.targetMotion.position
		},
		scale: {
			...a.scale,
			...r.targetMotion.scale
		}
	} : a;
	r.landingMode !== "free" && q.setProfile(se > 30 ? {
		...le,
		position: {
			...le.position,
			damping: le.position.damping * ce
		}
	} : le), q.seed({
		x: r.motionState?.x ?? x.left,
		y: r.motionState?.y ?? x.top,
		vx: r.motionState?.vx ?? 0,
		vy: r.motionState?.vy ?? 0,
		scaleX: r.motionState?.scaleX ?? 1,
		scaleY: r.motionState?.scaleY ?? 1,
		rotateX: r.motionState?.rotateX ?? 0,
		rotateZ: r.motionState?.rotateZ ?? 0
	});
	let J = I(n), Y = A?.baseWidth ?? C, ue = A?.baseHeight ?? D;
	A && r.landingMode !== "free" && r.landingMode !== "target" && (j > 0 || (j = Y > 0 ? J.width / Y : 1), A.shell.style.transformOrigin = "50% 50%", A.shell.style.left = `${((C - Y) / 2).toFixed(2)}px`, A.shell.style.top = `${((D - ue) / 2).toFixed(2)}px`, A.shell.style.transform = `scale(${k})`, A.shell.style.transition = `transform ${i}ms ${o}`);
	let de = Y * k, X = ue * k, fe = r.landingMode === "target" ? {
		scaleX: 1,
		scaleY: 1
	} : r.landingMode === "free" ? {
		scaleX: de > 0 ? J.width / de : 1,
		scaleY: X > 0 ? J.height / X : 1
	} : {
		scaleX: C > 0 ? J.width / C : 1,
		scaleY: D > 0 ? J.height / D : 1
	};
	q.setTarget({
		x: J.left,
		y: J.top,
		scaleX: fe.scaleX,
		scaleY: fe.scaleY
	}), t.style.transition = "", ee(h, s, [
		...r.landingMode === "target" ? [] : [
			`left ${i}ms ${o}`,
			`width ${i}ms ${o}`,
			`transform ${i}ms ${o}`,
			`grid-template-columns ${i}ms ${o}`
		],
		`box-shadow ${i}ms ${o}`,
		`border-radius ${i}ms ${o}`,
		`border-color ${i}ms ${o}`,
		`backdrop-filter ${i}ms ${o}`,
		`-webkit-backdrop-filter ${i}ms ${o}`,
		`background-color ${i}ms ${o}`,
		`background-image ${i}ms ${o}`,
		`opacity ${i}ms ${o}`
	].join(", ")), requestAnimationFrame(() => {
		if (!R) {
			if (r.landingMode !== "target" && (h.dataset.runtimePhase = "landing", h.dataset.runtimeCompact === "true" && (h.style.left = "0", h.style.width = "100%", h.style.transform = "none", h.style.gridTemplateColumns = "", delete h.dataset.runtimeCompact)), s != null && (h.offsetWidth, b(h, s)), c != null && (h.style.borderRadius = c), u != null && (h.style.border = u), d != null && (h.style.backdropFilter = d, h.style.setProperty("-webkit-backdrop-filter", d)), p != null && (h.style.backgroundColor = p, r.targetBackgroundImage && (h.style.backgroundImage = r.targetBackgroundImage)), m != null && (h.style.opacity = m), z && g) {
				let e = r.dismiss?.easing ?? o, t = r.dismiss?.scale ?? .72;
				g.style.transformOrigin = "50% 50%", g.style.transition = `transform ${B}ms ${e}`, h.style.transition = `opacity ${B}ms ${e}`, g.style.transform = `scale(${t})`, h.style.opacity = "0", U = window.setTimeout(() => {
					U = null, ne = !0, G();
				}, B + 40);
			}
			if (_) {
				for (let e of _.enteringEls) e.style.opacity = "1";
				for (let e of _.leavingEls) e.style.opacity = "0";
			}
		}
	});
	let pe = (e = 0) => {
		H !== null && window.clearTimeout(H), re = performance.now() + Math.max(2e3, i * 8, 5e3) + e, H = window.setTimeout(() => {
			H = null, !R && performance.now() >= re && K();
		}, Math.max(2e3, i * 8, 5e3) + e);
	};
	pe();
	let Z = r.coast;
	return r.landingMode === "free" ? q.start() : Z && Z.maxDistance > 0 && Math.hypot(r.motionState?.vx ?? 0, r.motionState?.vy ?? 0) > Z.minVelocity ? q.startCoastThenSettle(Z) : q.start(), {
		finished: ae,
		retarget(e) {
			if (R) return;
			L = e, pe(1e3);
			let t = I(L), n = r.landingMode === "target" ? 1 : r.landingMode === "free" ? t.width / de : t.width / C, i = r.landingMode === "target" ? 1 : r.landingMode === "free" ? t.height / X : t.height / D;
			A && r.landingMode !== "free" && r.landingMode !== "target" && (j = Y > 0 ? t.width / Y : j), q.setTarget({
				x: t.left,
				y: t.top,
				scaleX: n,
				scaleY: i
			});
		}
	};
}
function I(e) {
	if (!ae.has(e)) return;
	ae.delete(e);
	let t = e.parentElement?.dataset.runtimeCameraGlue === "true" ? e.parentElement : null;
	t?.remove(), t || e.remove();
}
var L = /* @__PURE__ */ new WeakMap(), R = [
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
function z(e, t) {
	let n = Object.fromEntries(R.map((t) => [t, e.style[t]]));
	e.style.cssText = t;
	for (let t of R) n[t] !== "" && (e.style[t] = n[t]);
}
var B = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakSet();
function ne(e, t, n = {}) {
	L.set(e, { style: e.getAttribute("style") ?? "" });
	let r = x(e, t, {
		glass: !1,
		layout: n.layout,
		contentScale: n.contentScale
	}), i = O(r);
	g(e, i);
	let a = i.style.transition;
	i.style.transition = "none", b(i, "none"), i.offsetWidth, i.style.transition = a;
	let o = !!n.layout?.compact;
	r.style.zIndex = "1000", r.style.transform = "scale(1)", r.style.transition = "transform 150ms cubic-bezier(.22,1,.36,1), box-shadow 150ms ease, background 150ms ease, opacity 150ms ease", V.add(r), B.set(e, r), n.keepSourceVisible || (e.style.visibility = "hidden"), requestAnimationFrame(() => {
		!r.isConnected || !V.has(r) || H(r, o);
	});
}
function H(e, t = !1, n = !0) {
	if (!e.isConnected) return;
	let r = O(e);
	W ? oe(r) : b(r, "0 12px 24px rgba(0,0,0,.18)"), n && (e.style.transform = `scale(${t ? 1 : 1.03})`);
}
function U(e) {
	return B.get(e);
}
function re(e) {
	let t = B.get(e);
	if (t) return requestAnimationFrame(() => {
		!t.isConnected || O(t).dataset.runtimePhase === "landing" || H(t, O(t).dataset.runtimeCompact === "true", !1);
	}), V.delete(t), B.delete(e), L.delete(e), t.style.zIndex = "2147483647", t;
}
function ie(e) {
	let t = B.get(e);
	t && (V.delete(t), t.remove(), ae.delete(t), B.delete(e));
	let n = L.get(e);
	n && z(e, n.style), L.delete(e);
}
var ae = /* @__PURE__ */ new Set(), W = !1;
function G(e) {
	W = e;
}
function K() {
	return W;
}
function oe(e) {
	e.style.background = "rgba(255, 255, 255, 0.42)", e.style.backdropFilter = "blur(12px) saturate(1.15)", e.style.setProperty("-webkit-backdrop-filter", "blur(12px) saturate(1.15)"), e.style.border = "1px solid rgba(255, 255, 255, 0.72)", b(e, "0 22px 50px rgba(30, 35, 60, 0.30)"), e.style.opacity = "0.97";
}
var q = /* @__PURE__ */ new Map();
function se(e, t) {
	q.set(e, t), e.style.visibility = "hidden";
}
function ce(e, t) {
	(e.style.visibility === "hidden" || getComputedStyle(e).visibility === "hidden") && q.set(e, t);
}
function le(e, t) {
	let n = q.get(e) === t;
	return n && (e.style.visibility = "", q.delete(e)), n;
}
function J(e, t) {
	q.get(e) === t && q.delete(e);
}
//#endregion
//#region src/dom/SourceVisualLease.ts
var Y = [
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
function ue(e) {
	return Object.fromEntries(Y.map((t) => [t, e.style[t]]));
}
function de(e, t) {
	let n = ue(e);
	e.style.cssText = t;
	for (let t of Y) n[t] !== "" && (e.style[t] = n[t]);
}
var X = /* @__PURE__ */ new WeakMap();
function fe(e, t) {
	let n = {
		sessionId: t,
		cssText: e.style.cssText
	};
	X.set(e, n);
	let r = () => X.get(e) === n;
	return {
		element: e,
		sessionId: t,
		detachFromLayout: () => r() ? (e.style.display = "none", e.style.pointerEvents = "none", !0) : !1,
		restoreLayoutHidden: () => r() ? (e.style.display = "", e.style.visibility = "hidden", e.style.pointerEvents = "none", !0) : !1,
		restore: () => r() ? (de(e, n.cssText), X.delete(e), !0) : !1,
		isOwner: r
	};
}
//#endregion
//#region src/motion/DirectFollowController.ts
function pe(e) {
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
//#region src/dom/RafLayoutAnimator.ts
var Z = /* @__PURE__ */ new WeakMap(), me = /* @__PURE__ */ new WeakMap();
function he(e) {
	let t = e.match(/cubic-bezier\(([^)]+)\)/);
	if (!t) return (e) => e * e * (3 - 2 * e);
	let n = t[1].split(",").map(Number);
	if (n.length !== 4 || n.some((e) => !Number.isFinite(e))) return (e) => e * e * (3 - 2 * e);
	let [r, i, a, o] = n;
	return (e) => {
		let t = 0, n = 1;
		for (let i = 0; i < 12; i += 1) {
			let i = (t + n) / 2;
			3 * (1 - i) ** 2 * i * r + 3 * (1 - i) * i ** 2 * a + i ** 3 < e ? t = i : n = i;
		}
		let s = (t + n) / 2;
		return 3 * (1 - s) ** 2 * s * i + 3 * (1 - s) * s ** 2 * o + s ** 3;
	};
}
function ge(e) {
	let t = Z.get(e);
	t && (cancelAnimationFrame(t.frame), Z.delete(e), e.style.transform = "");
}
function _e(e, t, n, r, i, a) {
	ge(e);
	let o = {
		frame: 0,
		started: performance.now(),
		duration: Math.max(1, r),
		fromX: t,
		fromY: n,
		easing: he(i)
	};
	Z.set(e, o);
	let s = (t) => {
		if (Z.get(e) !== o) return;
		let n = Math.min(1, (t - o.started) / o.duration), r = o.easing(n);
		if (e.style.transform = `translate(${(o.fromX * (1 - r)).toFixed(3)}px, ${(o.fromY * (1 - r)).toFixed(3)}px)`, n >= 1) {
			Z.delete(e), e.style.transform = "", a?.();
			return;
		}
		o.frame = requestAnimationFrame(s);
	};
	o.frame = requestAnimationFrame(s);
}
function ve(e) {
	let t = me.get(e);
	t && (cancelAnimationFrame(t.frame), me.delete(e), e.style.height = "");
}
function ye(e, t, n, r, i, a) {
	ve(e);
	let o = {
		frame: 0,
		started: performance.now(),
		duration: Math.max(1, r),
		fromX: t,
		fromY: n,
		easing: he(i)
	};
	me.set(e, o);
	let s = (t) => {
		if (me.get(e) !== o) return;
		let n = Math.min(1, (t - o.started) / o.duration), r = o.fromX + (o.fromY - o.fromX) * o.easing(n);
		if (e.style.height = `${r}px`, n >= 1) {
			me.delete(e), a?.();
			return;
		}
		o.frame = requestAnimationFrame(s);
	};
	o.frame = requestAnimationFrame(s);
}
//#endregion
//#region src/dom/Flip.ts
var be = e.flip.duration, xe = e.flip.easing;
function Se(e, t) {
	let n = /* @__PURE__ */ new Map();
	return e.forEach((e) => n.set(e, t?.rect(e) ?? e.getBoundingClientRect())), n;
}
function Ce(e) {
	let t = e.filter((e) => e.dataset.runtimeFlip === "true");
	if (t.length !== 0) for (let e of t) e.dataset.runtimeFlipToken = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1), delete e.dataset.runtimeFlip, ge(e), e.style.setProperty("transition", "none", "important");
}
function we(e, t, n = be, r = xe, i) {
	Ce(e);
	let a = [];
	for (let n of e) {
		if (n.dataset.runtimeProxy === "true" || n.dataset.runtimePlaceholder === "true" || n.dataset.runtimeActive === "true") continue;
		let e = t.get(n);
		if (!e) continue;
		let r = i?.rect(n) ?? n.getBoundingClientRect(), o = e.left - r.left, s = e.top - r.top;
		if (Math.abs(o) < .5 && Math.abs(s) < .5) {
			n.style.transition = "";
			continue;
		}
		a.push({
			element: n,
			dx: o,
			dy: s
		});
	}
	for (let { element: e, dx: t, dy: i } of a) {
		e.style.setProperty("transition", "none", "important"), e.style.transform = `translate(${t}px, ${i}px)`;
		let a = String(Number(e.dataset.runtimeFlipToken ?? "0") + 1);
		e.dataset.runtimeFlip = "true", e.dataset.runtimeFlipToken = a, _e(e, t, i, n, r, () => {
			e.dataset.runtimeFlipToken === a && (e.style.transition = "", delete e.dataset.runtimeFlip);
		});
	}
}
//#endregion
//#region src/dom/CollectionPresence.ts
function Te(e) {
	return e.dataset.layoutKey ?? e.dataset.card ?? "";
}
var Ee = /* @__PURE__ */ new WeakMap();
function De(e) {
	let t = e.closest("[data-layout-open=\"false\"]");
	return t !== null && t.dataset.runtimeGroupAnimating !== "true";
}
function Oe(e, t) {
	if (De(e)) return null;
	let n = e.closest("[data-layout-collection]");
	if (!n) return null;
	let r = t?.rect(e) ?? e.getBoundingClientRect(), i = t?.rect(n) ?? n.getBoundingClientRect();
	return r.width > 0 && r.height > 0 && i.width > 0 && r.width <= i.width * 1.25 && r.left >= i.left - 1 && r.right <= i.right + 1 ? { collectionId: n.dataset.layoutCollection ?? "" } : null;
}
function ke(e, t) {
	return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
}
function Ae(e, t, n) {
	if (!n || n.length === 0) return Array.from(e.querySelectorAll(t));
	let r = [], i = /* @__PURE__ */ new Set();
	for (let e of n) e.matches(t) && !i.has(e) && (i.add(e), r.push(e)), e.querySelectorAll(t).forEach((e) => {
		i.has(e) || (i.add(e), r.push(e));
	});
	return r;
}
function je(e, t, n = Te, r, i, a) {
	let o = /* @__PURE__ */ new Map();
	return {
		root: e,
		selector: t,
		collectionByKey: o,
		entries: Ae(e, t, i).map((e) => {
			if (r?.(e) || !ke(e, i)) return null;
			let t = Oe(e, a);
			if (!t) return null;
			let s = n(e);
			if (!s) return null;
			let c = a?.rect(e) ?? e.getBoundingClientRect();
			return o.set(s, t.collectionId), {
				key: s,
				element: e,
				rect: {
					left: c.left,
					top: c.top,
					width: c.width,
					height: c.height
				},
				contentHTML: e.outerHTML
			};
		}).filter((e) => e !== null),
		ignore: r,
		scopeSurfaces: i
	};
}
function Me(e, t = {}, n) {
	let r = t.duration ?? 250, i = t.easing ?? "cubic-bezier(.22,1,.36,1)", a = t.key ?? Te, o = /* @__PURE__ */ new Map();
	Ae(e.root, e.selector, e.scopeSurfaces).filter((t) => {
		if (e.ignore?.(t) || !ke(t, e.scopeSurfaces)) return !1;
		let r = Oe(t, n);
		if (!r) return !1;
		let i = a(t);
		return i ? (o.set(i, r.collectionId), !0) : !1;
	}).filter((t) => {
		let n = a(t);
		if (!n) return !1;
		let r = e.collectionByKey.get(n);
		return r === void 0 || r !== o.get(n);
	}).forEach((e) => {
		Ee.get(e)?.cancel();
		let t = e.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: r,
			easing: i,
			fill: "both"
		});
		Ee.set(e, t), t.finished.then(() => {
			Ee.get(e) === t && Ee.delete(e);
		}).catch(() => void 0);
	}), e.entries.forEach((e) => {
		if (o.has(e.key)) return;
		let t = document.createElement("template");
		t.innerHTML = e.contentHTML;
		let n = t.content.firstElementChild;
		if (!n) return;
		n.removeAttribute("data-file-id"), n.removeAttribute("data-layout-key"), n.removeAttribute("data-layout-role"), n.dataset.runtimePresenceGhost = "true";
		let a = e.rect;
		n.style.position = "fixed", n.style.left = `${a.left}px`, n.style.top = `${a.top}px`, n.style.width = `${a.width}px`, n.style.height = `${a.height}px`, n.style.margin = "0", n.style.pointerEvents = "none", n.style.zIndex = "2147483646", document.body.appendChild(n), n.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: r,
			easing: i,
			fill: "both"
		}).finished.then(() => n.remove()).catch(() => n.remove());
	});
}
//#endregion
//#region src/dom/LayoutMeasurement.ts
function Ne() {
	let e = /* @__PURE__ */ new WeakMap();
	return { rect(t) {
		let n = e.get(t);
		if (n) return n;
		let r = t.getBoundingClientRect();
		return e.set(t, r), r;
	} };
}
//#endregion
//#region src/dom/GroupLayout.ts
var Pe = null, Fe = !1, Ie = /* @__PURE__ */ new WeakMap();
function Le(e) {
	Pe = e;
}
function Re(e) {
	Fe = e;
}
function ze() {
	let t = Pe;
	return {
		flip: t?.flip ?? e.flip,
		resize: t?.resize ?? e.resize
	};
}
function Be(e, t, n) {
	let r = (e) => !n || n.length === 0 || n.some((t) => t === e || t.contains(e)), i = Array.from(t.querySelectorAll("[data-layout-group], [data-layout-content]")).filter(r), a = [], o = [];
	for (let t of e) r(t) && (t.closest("[data-layout-group]") === null ? o.push(t) : a.push(t));
	return {
		groups: i,
		groupLeaves: a,
		flatCards: o
	};
}
function Ve(e, t = document, n = !0, r, i = {}) {
	let a = (e) => {
		let t = i.scopeSurfaces;
		return !t || t.length === 0 || t.some((t) => t === e || t.contains(e));
	}, o = [...t instanceof HTMLElement && t.matches("[data-layout-surface]") ? [t] : [], ...Array.from(t.querySelectorAll("[data-layout-surface]"))].filter(a), s = Ne(), { groups: c, groupLeaves: l, flatCards: u } = Be(e, t, i.scopeSurfaces), d = pt(o, s, i.surfaceMeasures), f = (i.scopeSurfaces ?? [t]).some((e) => e instanceof HTMLElement ? e.matches("[data-layout-collection]") || e.querySelector("[data-layout-collection]") !== null : t.querySelector("[data-layout-collection]") !== null);
	return Ye(t, {
		root: t,
		group: c.length > 0 ? { before: rt([...c, ...l], s) } : void 0,
		flat: u.length > 0 ? {
			elements: u,
			before: Se(u, s)
		} : void 0,
		surfaces: d,
		presence: n && f ? je(t, "[data-layout-role=\"card\"]", void 0, r, i.scopeSurfaces, s) : void 0
	});
}
function He(e) {
	let t = Ne(), n = ze(), r = e.group ? Ge(e.group.before) : null;
	e.group && at(e.group.before, n.flip.duration, n.flip.easing, t), e.flat && we(e.flat.elements, e.flat.before, n.flip.duration, n.flip.easing, t), mt(e.surfaces, n.resize.duration, n.resize.easing, t), e.presence && Me(e.presence, {
		duration: n.flip.duration,
		easing: n.flip.easing
	}, t), r && Ke(r, n.flip.duration + 50);
}
var Ue = /* @__PURE__ */ new WeakMap(), We = 0;
function Ge(e) {
	let t = e.filter((e) => e.rect.height > 0).map((e) => ({
		element: e.element,
		overflow: e.element.style.overflow
	})).filter((e) => e.element.isConnected).filter((e) => e.element.dataset.runtimeGroupAnimating !== "true").filter((e) => getComputedStyle(e.element).overflow !== "visible");
	if (t.length === 0) return null;
	let n = t[0].element.getRootNode();
	Ue.get(n)?.entries.forEach(({ element: e, overflow: t }) => {
		e.style.overflow = t;
	}), t.forEach(({ element: e }) => {
		e.style.overflow = "visible";
	});
	let r = {
		token: String(++We),
		entries: t
	};
	return Ue.set(n, r), r;
}
function Ke(e, t) {
	let n = e.entries[0]?.element.getRootNode();
	n && (e.timeout = window.setTimeout(() => {
		Ue.get(n)?.token === e.token && (e.entries.forEach(({ element: e, overflow: t }) => {
			e.style.overflow = t;
		}), Ue.delete(n));
	}, t));
}
function qe(e) {
	Q.set(e.root, e), queueMicrotask(() => {
		Q.get(e.root) === e && (Q.delete(e.root), He(e));
	});
}
function Je(e) {
	Q.set(e.root, e), requestAnimationFrame(() => {
		Q.get(e.root) === e && (Q.delete(e.root), He(e));
	});
}
function Ye(e, t) {
	let n = Q.get(e);
	if (!n) return t;
	let r = Qe(t.surfaces, n.surfaces), i = Xe(t.flat, n.flat), a = Ze(t.group, n.group);
	return {
		...t,
		flat: i,
		group: a,
		surfaces: r
	};
}
function Xe(e, t) {
	if (!e || !t) return e;
	let n = new Map(e.before);
	for (let r of e.elements) {
		let e = t.before.get(r);
		e && n.set(r, e);
	}
	return {
		...e,
		before: n
	};
}
function Ze(e, t) {
	if (!e || !t) return e;
	let n = new Map(t.before.map((e) => [e.element, e.rect]));
	return { before: e.before.map((e) => ({
		...e,
		rect: n.get(e.element) ?? e.rect
	})) };
}
function Qe(e, t) {
	let n = new Map(t.map((e) => [e.element, e]));
	return e.map((e) => {
		let t = n.get(e.element);
		return t ? {
			...e,
			rect: t.rect,
			inlineStyle: t.inlineStyle
		} : e;
	});
}
var Q = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), et = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ new WeakMap();
function nt(e, t) {
	let n = t?.rect(e) ?? e.getBoundingClientRect();
	return {
		top: n.top,
		left: n.left,
		width: n.width,
		height: n.height
	};
}
function rt(e, t) {
	let n = e.filter((e) => {
		let n = t?.rect(e) ?? e.getBoundingClientRect();
		return n.width > 0 && n.height > 0;
	}), r = new Set(n);
	return n.map((e) => ({
		element: e,
		parent: it(e, r),
		rect: nt(e, t)
	}));
}
function it(e, t) {
	let n = e.parentElement;
	for (; n;) {
		if (t.has(n)) return n;
		n = n.parentElement;
	}
	return null;
}
function at(e, t = be, n = xe, r) {
	Ce(e.map((e) => e.element));
	let i = /* @__PURE__ */ new Map();
	for (let t of e) {
		let e = nt(t.element, r);
		i.set(t.element, {
			x: t.rect.left - e.left,
			y: t.rect.top - e.top
		});
	}
	for (let r of e) {
		let e = i.get(r.element), a = r.parent ? i.get(r.parent) : void 0, o = e.x - (a?.x ?? 0), s = e.y - (a?.y ?? 0);
		if (r.element.dataset.runtimeProxy === "true" || r.element.dataset.runtimePlaceholder === "true" || r.element.dataset.runtimeActive === "true" || Math.abs(o) < .5 && Math.abs(s) < .5) {
			r.element.dataset.runtimeGroupAnimating !== "true" && (r.element.style.transition = "");
			continue;
		}
		r.element.style.transform = `translate(${o}px, ${s}px)`, r.element.style.transition = "none";
		let c = String(Number(r.element.dataset.runtimeFlipToken ?? "0") + 1);
		r.element.dataset.runtimeFlip = "true", r.element.dataset.runtimeFlipToken = c;
		let l = tt.get(r.element);
		l !== void 0 && (cancelAnimationFrame(l), tt.delete(r.element));
		let u = requestAnimationFrame(() => {
			tt.delete(r.element), r.element.dataset.runtimeFlipToken === c && (r.element.style.transition = `transform ${t}ms ${n}`, r.element.style.transform = "");
		});
		tt.set(r.element, u);
		let d = window.setTimeout(() => {
			r.element.dataset.runtimeFlipToken === c && (r.element.style.transition = "", r.element.style.transform = "", delete r.element.dataset.runtimeFlip, et.delete(r.element));
		}, t + 40);
		et.set(r.element, d);
	}
}
function ot(e, t, n = be, r = xe, i, a = !1) {
	if (e.dataset.runtimeLayoutTransaction === "true" || e.dataset.runtimeSurfaceResize === "true") return !1;
	st(e);
	let o = i ?? e.getBoundingClientRect().height, s = String(Number(e.dataset.runtimeGroupToken ?? "0") + 1);
	e.dataset.runtimeGroupToken = s;
	let c = Math.abs(Math.max(0, t) - o), l = Math.min(Math.max(c / 8, 200), 350);
	e.dataset.runtimeGroupAnimating = "true", e.style.overflow = "hidden", e.style.height = `${o}px`, e.style.transition = `height ${l}ms ${r}`, e.offsetHeight;
	let u = {
		frame: null,
		timeout: null
	};
	return $e.set(e, u), u.frame = requestAnimationFrame(() => {
		u.frame = null, e.style.height = `${Math.max(0, t)}px`;
	}), u.timeout = window.setTimeout(() => {
		e.dataset.runtimeGroupToken === s && (t <= 0 ? (e.style.height = "0px", e.style.overflow = "hidden") : a ? (e.style.height = `${t}px`, e.style.overflow = "") : (e.style.height = "", e.style.overflow = ""), e.style.transition = "", delete e.dataset.runtimeGroupAnimating, $e.delete(e));
	}, l + 40), !0;
}
function st(e) {
	let t = $e.get(e);
	t && (t.frame !== null && cancelAnimationFrame(t.frame), t.timeout !== null && window.clearTimeout(t.timeout), $e.delete(e));
}
function ct(e) {
	Q.delete(e);
	let t = typeof Node < "u" && e instanceof Node, n = t ? e.getRootNode() : e, r = Ue.get(n);
	r && (r.timeout !== void 0 && window.clearTimeout(r.timeout), r.entries.forEach(({ element: n, overflow: r }) => {
		t && !e.contains(n) || (n.style.overflow = r);
	}), Ue.delete(n));
	let i = [];
	e instanceof HTMLElement && i.push(e), typeof e.querySelectorAll == "function" && i.push(...Array.from(e.querySelectorAll("[data-runtime-flip], [data-runtime-group-animating], [data-runtime-surface-resize], [data-runtime-layout-transaction], [data-layout-content]")));
	for (let e of i) {
		let t = et.get(e), n = tt.get(e), r = t !== void 0 || e.dataset.runtimeFlip === "true" || e.dataset.runtimeGroupAnimating === "true" || e.dataset.runtimeSurfaceResize === "true" || e.dataset.runtimeLayoutTransaction === "true";
		t !== void 0 && (window.clearTimeout(t), et.delete(e)), n !== void 0 && (cancelAnimationFrame(n), tt.delete(e)), ge(e), ve(e), st(e);
		let i = $.get(e);
		i && (vt(e, i.baseStyle), $.delete(e)), e.dataset.runtimeGroupAnimating === "true" && (e.style.height = e.dataset.layoutOpen === "false" ? "0px" : "", e.style.overflow = e.dataset.layoutOpen === "false" ? "hidden" : "", e.style.transition = ""), r && (e.style.transform = ""), e.dataset.runtimeFlip === "true" && delete e.dataset.runtimeFlip, delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction, delete e.dataset.runtimeGroupAnimating;
	}
}
async function lt(e) {
	let t = (Ie.get(e.content) ?? 0) + 1;
	Ie.set(e.content, t);
	let n = Array.from(e.root.querySelectorAll("[data-layout-role=\"card\"]")), r = Ve((n.length > 0 ? n : Array.from(e.root.querySelectorAll(".done-card-item, [data-card]"))).filter((e) => {
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0;
	}), e.root, !1, void 0, { surfaceMeasures: e.surfaceMeasures }), i = e.content.getBoundingClientRect().height, a = Fe ? dt(e.content, e.opening, e.duration, e.easing) : null;
	if (e.mutate(), await e.waitForLayout(), Ie.get(e.content) !== t || e.isCurrent && !e.isCurrent()) return;
	let o = e.opening ? e.content.scrollHeight : 0;
	if (ot(e.content, o, e.duration, e.easing, i), a && ft(a, e.opening), await new Promise((e) => requestAnimationFrame(() => e())), Ie.get(e.content) !== t || e.isCurrent && !e.isCurrent()) return;
	let s = ut(r.surfaces, e.content, o);
	He(s.size > 0 ? {
		...r,
		surfaces: r.surfaces.map((e) => ({
			...e,
			targetMeasure: s.get(e.element)
		}))
	} : r);
}
function ut(e, t, n) {
	let r = /* @__PURE__ */ new Map(), i = {
		height: t.style.height,
		overflow: t.style.overflow,
		transition: t.style.transition
	};
	t.style.height = `${Math.max(0, n)}px`, t.style.overflow = "hidden", t.style.transition = "none";
	let a = e.map((e) => ({
		item: e,
		height: e.element.style.height,
		overflow: e.element.style.overflow,
		transition: e.element.style.transition
	}));
	return a.forEach(({ item: e }) => {
		e.measure && (e.element.style.height = "auto", e.element.style.overflow = "visible", e.element.style.transition = "none");
	}), t.offsetHeight, a.forEach(({ item: e }) => {
		e.measure && r.set(e.element, e.measure());
	}), a.forEach(({ item: e, height: t, overflow: n, transition: r }) => {
		e.element.style.height = t, e.element.style.overflow = n, e.element.style.transition = r;
	}), t.style.height = i.height, t.style.overflow = i.overflow, t.style.transition = i.transition, r;
}
function dt(e, t, n = be, r = xe) {
	let i = Array.from(e.querySelectorAll("[data-layout-role=\"card\"], .done-card-item")), a = String(Number(e.dataset.runtimePresenceToken ?? "0") + 1);
	return e.dataset.runtimePresenceToken = a, i.forEach((e) => {
		t && (e.style.opacity = "0");
	}), {
		content: e,
		elements: i,
		token: a,
		duration: n
	};
}
function ft(e, t) {
	let { content: n, elements: r, token: i, duration: a } = e;
	requestAnimationFrame(() => {
		n.dataset.runtimePresenceToken === i && r.forEach((e) => {
			e.animate([{ opacity: +!t }, { opacity: +!!t }], {
				duration: a,
				easing: "cubic-bezier(.22,1,.36,1)",
				fill: "both"
			});
		});
	}), window.setTimeout(() => {
		n.dataset.runtimePresenceToken === i && r.forEach((e) => {
			e.style.opacity = "";
		});
	}, a + 40);
}
function pt(e, t, n) {
	return e.map((e) => {
		e.dataset.runtimeLayoutTransaction = "true";
		let r = nt(e, t), i = n?.get(e), a = _t(e);
		return i && !$.has(e) && (e.style.height = `${yt(e, r.height)}px`, e.style.overflow = "hidden"), {
			element: e,
			rect: r,
			measure: i,
			inlineStyle: a
		};
	});
}
function mt(e, t = be, n = xe, r) {
	ht(e);
	let i = e.filter((e) => e.element.isConnected).map((e) => {
		let t = nt(e.element, r), n = e.targetMeasure === void 0 ? e.measure?.() : e.targetMeasure, i = n ? {
			...t,
			...n.width === void 0 ? {} : { width: n.width },
			height: n.height
		} : t;
		return {
			item: e,
			next: i,
			profile: ze().resize,
			fromHeight: yt(e.element, e.rect.height),
			toHeight: yt(e.element, i.height)
		};
	}).filter(({ item: e, next: t }) => Math.abs(e.rect.height - t.height) >= .5);
	if (i.length === 0) {
		e.forEach(({ element: e, inlineStyle: t }) => {
			vt(e, t), delete e.dataset.runtimeLayoutTransaction;
		});
		return;
	}
	let a = new Set(i.map(({ item: e }) => e.element));
	e.forEach(({ element: t }) => {
		if (!a.has(t)) {
			let n = e.find((e) => e.element === t);
			n && vt(t, n.inlineStyle), delete t.dataset.runtimeLayoutTransaction;
		}
	});
	for (let { item: e, fromHeight: t, toHeight: n } of i) {
		let n = e.element.style, r = {
			baseStyle: $.get(e.element)?.baseStyle ?? e.inlineStyle,
			token: String(++gt)
		};
		$.set(e.element, r), n.overflow = "hidden", n.transition = "none", n.height = `${t}px`, e.element.dataset.runtimeSurfaceResize = "true", e.element.dataset.runtimeSurfaceResizeToken = r.token;
	}
	requestAnimationFrame(() => {
		for (let { item: e, fromHeight: t, toHeight: n, profile: r } of i) {
			let i = e.element.style, a = $.get(e.element);
			if (!a || e.element.dataset.runtimeSurfaceResizeToken !== a.token) continue;
			let o = a.token;
			i.transition = "none", ye(e.element, t, n, r.duration, r.easing), window.setTimeout(() => {
				if (e.element.dataset.runtimeSurfaceResizeToken !== o) return;
				let t = $.get(e.element);
				!t || t.token !== o || (vt(e.element, t.baseStyle), e.measure && (i.height = `${n}px`), $.delete(e.element), delete e.element.dataset.runtimeSurfaceResize, delete e.element.dataset.runtimeLayoutTransaction);
			}, r.duration + 40);
		}
	});
}
function ht(e) {
	let t = e.filter((e) => e.element.dataset.runtimeSurfaceResize === "true");
	if (t.length !== 0) for (let { element: e } of t) {
		if (!$.get(e)) continue;
		let t = nt(e).height;
		ve(e), e.style.height = `${yt(e, t)}px`, e.style.overflow = "hidden", e.style.transition = "none", $.delete(e), delete e.dataset.runtimeSurfaceResize, delete e.dataset.runtimeSurfaceResizeToken, delete e.dataset.runtimeLayoutTransaction;
	}
}
var $ = /* @__PURE__ */ new WeakMap(), gt = 0;
function _t(e) {
	return {
		height: e.style.height,
		overflow: e.style.overflow,
		transition: e.style.transition
	};
}
function vt(e, t) {
	e.style.height = t.height, e.style.overflow = t.overflow, e.style.transition = t.transition;
}
function yt(e, t) {
	let n = getComputedStyle(e);
	if (n.boxSizing === "border-box") return t;
	let r = Number.parseFloat(n.paddingTop) + Number.parseFloat(n.paddingBottom) + Number.parseFloat(n.borderTopWidth) + Number.parseFloat(n.borderBottomWidth);
	return Math.max(0, t - r);
}
//#endregion
//#region src/runtime/DetachMoveDriver.ts
function bt(e, t, n) {
	let r = e(t, n);
	return {
		...r,
		boxShadow: n.style.boxShadow || r.boxShadow,
		transform: n.style.transform || r.transform
	};
}
function xt(e, t, n, r, i) {
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
function St(e) {
	return (t) => t === e || t.contains(e);
}
function Ct(e, t, n, r) {
	return {
		beforeContent: e.cloneNode(!0),
		beforePickup: Ve(t().filter((t) => t !== e && t.dataset.runtimeProxy !== "true"), document, !0, St(e), {
			scopeSurfaces: n?.(),
			surfaceMeasures: r?.()
		})
	};
}
function wt(e, t, n) {
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
function Tt(e) {
	return e.active ? e.state.update(e.event, e.getSurface) : null;
}
function Et(e) {
	e.event.stopPropagation(), y(e.proxy, !1), e.clearRegrab(), J(e.source, e.sessionId), e.interrupt(), e.source.style.visibility = "hidden";
}
function Dt(e, t) {
	return () => requestAnimationFrame(() => {
		e(), t();
	});
}
function Ot(e) {
	let t = e.resolve();
	return t ? (e.applyState(t), t) : null;
}
function kt(e, t, n = {}) {
	let r = t.style.transition, i = t.style.opacity, a = getComputedStyle(t).opacity;
	t.dataset.runtimeLandingCapture = "true", t.style.transition = "none", n.ignoreTemporaryOpacity && (i === "0" || a === "0") && (t.style.opacity = "1");
	try {
		t.offsetWidth;
		let r = e(t);
		return n.ignoreTemporaryOpacity && (i === "0" || a === "0" || r.opacity === "0") ? {
			...r,
			opacity: "1"
		} : r;
	} finally {
		t.style.opacity = i, t.style.transition = r, delete t.dataset.runtimeLandingCapture;
	}
}
function At(e) {
	return {
		...e.createContext(),
		sourceElement: e.source,
		sourceRect: e.sourceRect,
		visualSnapshot: e.visualSnapshot,
		targetSnapshot: e.targetSnapshot,
		motionState: e.motionState
	};
}
function jt(e) {
	let t = e.createProxy();
	return t ? (e.enableProxy(t.element), e.bindRegrab(t.element), e.land(t.element).then(e.onComplete), t.element) : (e.onMissing(), null);
}
function Mt(e) {
	e.active && e.complete({
		completed: e.result.completed,
		reason: e.result.reason ?? "",
		reveal: e.result.completed ? e.reveal : void 0
	});
}
function Nt(e, t) {
	return e() ?? t();
}
function Pt(e) {
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
function Ft(e, t, n, r) {
	let i = 0;
	return {
		capture: () => (i += 1, Ve(t().filter((t) => t !== e && t.dataset.runtimeProxy !== "true"), document, !0, St(e), {
			scopeSurfaces: n?.(),
			surfaceMeasures: r?.()
		})),
		play: (e, t, n = !1) => {
			let r = ++i;
			if (n) {
				requestAnimationFrame(() => {
					r === i && Je(t);
				});
				return;
			}
			qe(t);
		}
	};
}
//#endregion
//#region src/runtime/move/MoveAdapter.ts
function It(e) {
	let { runtime: t, objectId: r, element: i, event: a, fromRect: c, clone: u = !1 } = e, d = t.objects.get(r), f = t.surfaces.snapshot(), p = f.map((e) => e.id), m = (e) => t.objects.get(e)?.surfaceId, h = d?.surfaceId ?? f[0]?.id, g = (e) => e.closest("[data-layout-content][data-layout-open=\"false\"]") !== null, _ = () => {
		let e = [...t.objects.values()].map((e) => e.element).filter((e) => !!e?.isConnected), n = Array.from(document.querySelectorAll("[data-flip-target]"));
		return Array.from(/* @__PURE__ */ new Set([...e, ...n])).filter((e) => !g(e));
	}, v, b, x, S = null, C = null, w = null, T = null, E = null, D = !1, O = null, k = null, A = null, ee = null, j = null, M, N = {
		x: 0,
		y: 0
	}, te = null, P = !1, F = !1, I = null;
	function L(e, t) {
		if (!t || I || t.scrollHeight >= e) return;
		let n = e - t.scrollHeight;
		if (n <= .5) return;
		let r = document.createElement("div");
		r.dataset.runtimeScrollCompensation = "true", r.style.width = "1px", r.style.height = `${n}px`, r.style.flex = "0 0 auto", r.style.pointerEvents = "none", r.style.visibility = "hidden", t.appendChild(r), I = r, t.scrollTop = Math.min(t.scrollTop, t.scrollHeight - t.clientHeight);
	}
	function R() {
		I?.remove(), I = null;
	}
	let z = () => {
		let e = /* @__PURE__ */ new Set();
		return h && e.add(h), S?.columnId && e.add(S.columnId), t.surfaces.snapshot().filter((t) => e.has(t.id)).map((e) => e.layoutElement?.() ?? e.element).filter((e) => !!e?.isConnected);
	}, B = () => {
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
	function V() {
		return O ? t.getSession(O)?.state : void 0;
	}
	function H(e, n) {
		if (V() !== "active" || !x) return;
		let i = Tt({
			active: V() === "active",
			event: {
				clientX: e,
				clientY: n
			},
			state: x,
			resolve: (e) => t.resolveMoveHit(r, e.clientX, e.clientY),
			getSurface: (e) => e.columnId
		});
		i && (S = {
			...i,
			point: {
				x: e,
				y: n
			}
		});
	}
	function ae(e) {
		P = !0, j?.setTarget({
			x: e.clientX - N.x,
			y: e.clientY - N.y
		}), H(e.clientX, e.clientY), ee?.update(t.resolveMoveSurfaceElement(r, e.clientX, e.clientY), {
			x: e.clientX,
			y: e.clientY
		});
	}
	function W(e) {
		if (D || (D = !0, M = j ? { ...j.getState() } : void 0, j?.stop(), j = null, ee?.stop(), !x || !O)) return { accepted: !1 };
		e && H(e.clientX, e.clientY);
		let a = x.release();
		S = a ? {
			...a,
			point: e ? {
				x: e.clientX,
				y: e.clientY
			} : a.point,
			...M ? { releaseVelocity: {
				x: M.vx,
				y: M.vy
			} } : {}
		} : null, !S && !P && M && Math.hypot(M.vx, M.vy) < .5 && h && (S = {
			columnId: h,
			index: te ?? Math.max(0, t.getObjectSurfaceIndex(r, h))
		});
		let o = !S;
		if (o && h && (S = {
			columnId: h,
			index: te ?? Math.max(0, t.getObjectSurfaceIndex(r, h)),
			invalidReturn: !0
		}), !S) return { accepted: !1 };
		if (M) {
			let e = n({
				x: M.vx,
				y: M.vy
			}, t.getObjectReleaseMotionProfile(r, S));
			M.vx = e.x, M.vy = e.y, S.releaseVelocity = {
				x: M.vx,
				y: M.vy
			};
		}
		let s = S, c = T?.getBoundingClientRect() ?? t.getVisualProxy(O)?.element.getBoundingClientRect() ?? U(i)?.getBoundingClientRect() ?? i.getBoundingClientRect();
		delete i.dataset.runtimeActive, o && (F || A?.restoreLayoutHidden(), k?.release());
		let l = (e, n) => {
			if (V() !== "landing") return;
			let a = n?.kind === "element" ? n.element : null, o = a ?? t.resolveVisualTarget(O, s) ?? t.objects.get(r)?.element ?? null, l = Ot({
				resolve: () => o,
				applyState: (e) => t.applyVisualState(r, e, {
					phase: "revealing",
					hovered: !1,
					selected: e.classList.contains("is-selected"),
					grabbed: !1
				})
			});
			if (!l) {
				w?.complete({
					completed: !1,
					reason: "target-not-registered"
				}), w = null;
				return;
			}
			E = l, a && t.keepSurfaceTargetVisible(s.columnId, l);
			let u = t.findObjectIdByElement(l, r) ?? r, d = kt((e) => t.captureVisualState(u, e), l, { ignoreTemporaryOpacity: !0 }), f = At({
				createContext: () => t.createVisualLifecycleContext(e, s, n?.kind === "rect" ? n.rect : n?.element ?? l, v),
				source: i,
				sourceRect: c,
				visualSnapshot: b,
				targetSnapshot: d,
				motionState: M
			});
			T = jt({
				createProxy: () => t.getVisualProxy(e) ?? t.createVisualProxy(e, f) ?? null,
				enableProxy: (e) => y(e, !0),
				bindRegrab: (n) => {
					t.bindRegrabTarget(e, r, n, (e) => K(e, r));
					let i = t.getGroup(e);
					if (i) for (let e of i.objectIds) {
						let n = t.objects.get(e)?.element;
						n?.isConnected && (n.style.pointerEvents = "auto", e !== r && t.registerRegrab(e, (t) => K(t, e)));
					}
				},
				land: () => t.landVisualProxy(e, n?.kind === "rect" ? n.rect : l, f),
				onMissing: () => {
					w?.complete({
						completed: !1,
						reason: "visual-proxy-missing"
					}), w = null;
				},
				onComplete: (n) => {
					Mt({
						active: V() === "landing",
						result: n,
						complete: (e) => w?.complete(e),
						reveal: () => t.revealVisualProxy(e, l, f).then(() => {
							T &&= (t.disposeVisualProxy(e), null), E = null;
						})
					}), w = null;
				}
			});
		};
		return C = Dt(() => void 0, () => {
			let e = O;
			t.resolveLandingTarget(e, s).then((t) => l(e, t));
		}), {
			accepted: !0,
			destination: S,
			...o ? { emitAction: !1 } : {}
		};
	}
	function G(e) {
		for (let n of e?.objectIds ?? [r]) t.clearRegrab(n);
	}
	function K(e, n = r) {
		if (V() !== "landing") return;
		let i = T;
		if (!i || !O) return;
		let a = t.getGroup(O), o = a ? t.objects.get(a.primaryObjectId)?.visual : void 0, s = t.resolveVisualTarget(O, S), c = t.objects.get(r)?.element ?? null, l = a ? t.objects.get(a.primaryObjectId)?.element ?? null : Nt(() => E ?? s, () => c);
		if (!l) return;
		let u = t.findObjectIdByElement(l, r) ?? r, d = t.createRegrabContext(O, e, i, l);
		if (!d) return;
		Et({
			event: d.event,
			sessionId: O,
			proxy: i,
			source: l,
			interrupt: () => t.takeoverRegrab(O),
			clearRegrab: () => G(a)
		});
		let f = l.getBoundingClientRect();
		a ? (o && t.objects.update(a.primaryObjectId, { visual: o }), t.startGroupObjectPointer(a.objectIds, a.primaryObjectId, l, e, d.regrabRect, f)) : t.startObjectPointer(u, l, e, d.regrabRect, f);
	}
	return {
		driver: {
			prepare(e) {
				O = e.session.id, P = !1;
				let n = i.style.visibility === "hidden" || getComputedStyle(i).visibility === "hidden";
				if (ee = t.createAutoScroller(O, { onScroll: (e) => H(e.x, e.y) }), e.session.state !== "prepare") return;
				t.objects.setElement(r, i), i.style.visibility = "", i.style.pointerEvents = "", n && (i.style.transition = ""), k = t.acquireObject(O, r), t.takeSurfaces(O, p);
				let d = t.getGroup(O);
				F = !!d;
				let { beforePickup: f } = Ct(i, _, z, B);
				te = t.getObjectSurfaceIndex(r, h), v = i.cloneNode(!0);
				let g = xt(t.getMoveContext(O), i, a, c, t.getObjectGrabAlign(r)), y = g.rect;
				N = {
					x: g.offsetX,
					y: g.offsetY
				}, document.body.classList.add("kb-dragging"), t.applyVisualState(r, i, {
					phase: "dragging",
					hovered: i.matches(":hover"),
					selected: i.classList.contains("is-selected"),
					grabbed: !0
				}), b = bt((e, n) => t.captureVisualState(r, n), r, i), A = fe(i, O);
				let S = t.getObjectProxyLayout(r, i), C = !!S?.compact, w = h ? t.resolveMoveSurfaceViewport(h) : null, T = !!(w && w.scrollHeight > w.clientHeight && w.scrollTop >= w.scrollHeight - w.clientHeight - 1), E = w?.scrollHeight ?? 0;
				ne(i, y, {
					layout: S,
					contentScale: t.getSurfaceCameraPickupScale(h, O),
					keepSourceVisible: !!(d && d.objectIds.length > 1)
				}), ce(i, O);
				let D = re(i);
				D && t.registerVisualProxy(O, { element: D }), D && t.updateVisualProxy(O), i.style.pointerEvents = "none", !u && !d && (A.detachFromLayout(), T && L(E, w)), i.style.transition = "none", d || t.scheduleLayout(f), i.dataset.runtimeActive = "true";
				let M = t.getVisualProxy(O)?.element ?? U(i);
				if (!M) return;
				let I = y.left, R = y.top, V = (e) => {
					if (!M.isConnected) return;
					t.updateVisualProxy(O);
					let n = e.x - I, r = e.y - R;
					M.style.transform = `translate3d(${n.toFixed(2)}px, ${r.toFixed(2)}px, 0) perspective(760px) rotateX(${e.rotateX.toFixed(2)}deg) rotateZ(${e.rotateZ.toFixed(2)}deg) scale(${e.scaleX.toFixed(4)}, ${e.scaleY.toFixed(4)})`;
				};
				if (t.getObjectMotionEnabled(r)) {
					let e = l({
						mode: "follow",
						followRotation: s,
						onFrame: V
					});
					e.setProfile(o), e.seed({
						x: y.left,
						y: y.top,
						scaleX: 1,
						scaleY: 1,
						rotateX: s.tilt,
						rotateZ: 0
					}), e.setTarget({
						x: a.clientX - N.x,
						y: a.clientY - N.y,
						scaleX: C ? 1 : 1.03,
						scaleY: C ? 1 : 1.03
					}), e.start(), j = e;
				} else {
					let e = pe({ onFrame: V });
					e.setTarget({
						x: a.clientX - N.x,
						y: a.clientY - N.y
					}), j = e;
				}
				x = wt(m(r), (e) => t.resolveMoveHit(r, e.clientX, e.clientY), (e, t) => e.columnId === t?.columnId && e.index === t?.index), H(a.clientX, a.clientY);
			},
			update(e, t) {
				t.event instanceof PointerEvent && ae(t.event);
			},
			resolveDestination(e, t) {
				return W(t.event instanceof PointerEvent ? t.event : void 0);
			},
			commit: (e, n) => {
				t.getVisualProxy(O) || ie(i);
				let r = typeof n == "object" && !!n && n.invalidReturn === !0, a = typeof n == "object" && n ? n.toSurfaceId ?? n.columnId : void 0;
				F || (u || r || !r && typeof a == "string" && a === h ? A?.restoreLayoutHidden() : A?.detachFromLayout()), document.body.classList.remove("kb-dragging");
			},
			cancel(e, n) {
				D = !0, j?.stop(), j = null, t.getVisualProxy(O) ? t.disposeVisualProxy(O) : T ? (t.disposeVisualProxy(O), T = null) : ie(i), G(t.getGroup(O)), document.body.classList.remove("kb-dragging"), delete i.dataset.runtimeActive, ie(i), A?.restore(), A = null, R();
			}
		},
		lifecycle: {
			layout: Ft(i, _, z, B),
			surface: { enter: () => k?.release() },
			...Pt({
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
				clearRegrab: () => G(t.getGroup(O)),
				finishReveal: () => {
					T && y(T, !1), ie(i), A?.restore(), A = null, R();
				}
			})
		}
	};
}
function Lt(e) {
	return It({
		...e,
		clone: !0
	});
}
//#endregion
export { f as A, e as B, P as C, C as D, G as E, a as F, i as I, t as L, l as M, o as N, g as O, s as P, r as R, K as S, le as T, se as _, He as a, D as b, Je as c, ot as d, je as f, te as g, oe as h, Ve as i, d as j, u as k, Re as l, fe as m, It as n, lt as o, Me as p, ct as r, qe as s, Lt as t, Le as u, x as v, F as w, O as x, I as y, n as z };
