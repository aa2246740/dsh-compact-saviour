window.__ModuleLoader__.load({
	id: "dsh-compact-saviour",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/context-elements.ts
		/** Keep the compatibility bridge local to its composer. RC2 places the meter
		* in the dock outside the card and portals its popup directly to body. */
		function contextRoot(anchor) {
			return anchor.closest("[data-composer-card]")?.parentElement ?? anchor.closest("[data-slot=\"conversation.input.right\"]")?.parentElement ?? void 0;
		}
		function contextRing(root) {
			const matches = [...root.querySelectorAll("button[aria-haspopup=\"dialog\"]")].filter((button) => button.querySelector("svg[viewBox=\"0 0 14 14\"]")?.querySelectorAll("circle").length === 2);
			return matches.length === 1 ? matches[0] : void 0;
		}
		function isContextPanel(panel) {
			const header = panel.firstElementChild;
			return panel.getAttribute("role") === "dialog" && header?.children.length === 4 && /^\d+%$/.test(header.children[1]?.textContent ?? "") && (header.children[3]?.textContent ?? "").includes("/") && Boolean(header.nextElementSibling);
		}
		function contextPanel(ring) {
			if (!ring || ring.getAttribute("aria-expanded") !== "true") return;
			const controlled = ring.getAttribute("aria-controls");
			const linked = controlled ? ring.ownerDocument.getElementById(controlled) : null;
			if (linked && isContextPanel(linked)) return linked;
			const local = ring.parentElement?.querySelector("[role=\"dialog\"]");
			if (local && isContextPanel(local)) return local;
			const doc = ring.ownerDocument;
			const openRings = [...doc.querySelectorAll("button[aria-haspopup=\"dialog\"][aria-expanded=\"true\"]")].filter((button) => button.querySelector("svg[viewBox=\"0 0 14 14\"]")?.querySelectorAll("circle").length === 2);
			if (openRings.length !== 1 || openRings[0] !== ring) return;
			const panels = [...doc.body.children].filter((element) => element instanceof HTMLElement && isContextPanel(element));
			return panels.length === 1 ? panels[0] : void 0;
		}
		//#endregion
		//#region src/client/meter-bridge.ts
		function tokens(value) {
			const unit = value >= 1e6 ? 1e6 : value >= 1e3 ? 1e3 : 1;
			const scaled = value / unit;
			return `${scaled >= 100 || unit === 1 ? Math.round(scaled) : Math.round(scaled * 10) / 10}${unit === 1e6 ? "M" : unit === 1e3 ? "K" : ""}`;
		}
		/** Narrow compatibility bridge until DSH exposes a context-meter reading slot.
		* Preserve the original React nodes, styles, handlers and any later owner update. */
		var MeterBridge = class {
			edits = /* @__PURE__ */ new Map();
			write(node, key, value, read, write) {
				let fields = this.edits.get(node);
				if (!fields) {
					fields = /* @__PURE__ */ new Map();
					this.edits.set(node, fields);
				}
				let field = fields.get(key);
				if (!field) {
					field = {
						read,
						write,
						before: read(),
						last: null
					};
					fields.set(key, field);
				} else if (read() !== field.last) field.before = read();
				if (read() !== value && !(field.desired === value && read() === field.last)) write(value);
				field.last = read();
				field.desired = value;
			}
			text(element, value) {
				const node = element?.firstChild;
				if (element?.childNodes.length !== 1 || node?.nodeType !== Node.TEXT_NODE) return;
				this.write(node, "text", value, () => node.nodeValue, (v) => {
					node.nodeValue = v;
				});
			}
			attr(element, key, value) {
				this.write(element, key, value, () => element.getAttribute(key), (v) => {
					if (v === null) element.removeAttribute(key);
					else element.setAttribute(key, v);
				});
			}
			restore() {
				for (const fields of this.edits.values()) for (const edit of fields.values()) if (edit.read() === edit.last) edit.write(edit.before);
				this.edits.clear();
			}
			apply(ring, context) {
				if (!ring || !context?.corrected) {
					this.restore();
					return;
				}
				for (const node of this.edits.keys()) if (!node.isConnected) this.edits.delete(node);
				const percent = Math.max(0, Math.min(100, Math.round(context.usedTokens / context.contextWindow * 100)));
				const reading = `${percent}%`, circumference = 2 * Math.PI * 5.5;
				const label = [...ring.children].find((child) => child.tagName === "SPAN" && /^\d+%$/.test(child.textContent ?? ""));
				this.text(label, reading);
				const circles = ring.querySelectorAll("svg[viewBox=\"0 0 14 14\"] circle");
				if (circles.length !== 2) {
					this.restore();
					return;
				}
				this.attr(circles[1], "stroke-dasharray", `${circumference * percent / 100} ${circumference}`);
				const aria = ring.getAttribute("aria-label");
				if (aria && /\d+%/.test(aria)) this.attr(ring, "aria-label", aria.replace(/\d+%/, reading));
				const tooltipId = ring.getAttribute("aria-describedby");
				const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
				if (tooltip?.getAttribute("role") === "tooltip") this.text(tooltip, (tooltip.textContent ?? "").replace(/\d+%/, reading));
				const header = contextPanel(ring)?.firstElementChild, bar = header?.nextElementSibling;
				if (!header || header.children.length !== 4 || !bar || !/^\d+%$/.test(header.children[1]?.textContent ?? "")) return;
				this.text(header.children[1], reading);
				this.text(header.children[3], `~${tokens(context.usedTokens)} / ${tokens(context.contextWindow)}`);
				const parts = context.parts?.filter((value) => value > 0), total = parts?.reduce((a, b) => a + b, 0);
				if (parts && total && parts.length === bar.children.length) [...bar.children].forEach((segment, index) => {
					const el = segment;
					this.write(el, "width", `${percent * parts[index] / total}%`, () => el.style.width, (value) => {
						el.style.width = value ?? "";
					});
				});
			}
		};
		/**
		* OpenBotMotion v1.0.0
		* Pure Code-Driven Zero-Dependency SVG Mascot Animation Engine (#1 ~ #7)
		*
		* @license MIT
		* @author Open Bot Motion Team
		*/
		//#endregion
		//#region src/client/satellite.ts
		var import_open_bot_motion = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
			(function(root, factory) {
				if (typeof define === "function" && define.amd) define([], factory);
				else if (typeof module === "object" && module.exports) module.exports = factory();
				else root.OpenBotMotion = factory();
			})(typeof self !== "undefined" ? self : exports, function() {
				"use strict";
				var CHARCOAL = "#222126";
				var LOOP = 20.783;
				var Easings = {
					linear: function(p) {
						return p;
					},
					easeInOutQuad: function(p) {
						return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
					},
					easeOutCubic: function(p) {
						return 1 - Math.pow(1 - p, 3);
					},
					easeInCubic: function(p) {
						return p * p * p;
					},
					easeInOutCubic: function(p) {
						return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
					},
					springBouncy: function(p) {
						if (p <= 0) return 0;
						if (p >= 1) return 1;
						var c4 = 2 * Math.PI / 3;
						return Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * c4) + 1;
					}
				};
				function clamp(v, a, b) {
					return Math.max(a, Math.min(b, v));
				}
				function lerp(a, b, t) {
					return a + (b - a) * t;
				}
				function PoseTimeline(keyframes, options) {
					this.options = Object.assign({
						shortestArc: true,
						shortestArcAngles: [
							"yaw",
							"pitch",
							"roll"
						]
					}, options || {});
					var self = this;
					this.keyframes = keyframes.map(function(kf) {
						return {
							t: kf.t,
							label: kf.label || "",
							ease: kf.ease || "easeInOutQuad",
							shortestArc: kf.shortestArc !== void 0 ? kf.shortestArc : self.options.shortestArc,
							pose: Object.assign({}, kf.pose)
						};
					}).sort(function(a, b) {
						return a.t - b.t;
					});
					if (this.options.shortestArc) {
						var angleKeys = this.options.shortestArcAngles;
						for (var k = 0; k < angleKeys.length; k++) {
							var key = angleKeys[k];
							var prevVal = null;
							for (var i = 0; i < this.keyframes.length; i++) {
								var kf = this.keyframes[i];
								if (kf.pose && typeof kf.pose[key] === "number") {
									if (prevVal !== null && kf.shortestArc !== false) {
										var diff = kf.pose[key] - prevVal;
										if (Math.abs(Math.abs(diff) - Math.PI) > 1e-4) {
											var shortDiff = ((diff + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
											kf.pose[key] = prevVal + shortDiff;
										}
									}
									prevVal = kf.pose[key];
								}
							}
						}
					}
				}
				PoseTimeline.prototype.evaluate = function(t) {
					var kfs = this.keyframes;
					if (t <= kfs[0].t) return {
						pose: Object.assign({}, kfs[0].pose),
						label: kfs[0].label || ""
					};
					if (t >= kfs[kfs.length - 1].t) {
						var last = kfs[kfs.length - 1];
						return {
							pose: Object.assign({}, last.pose),
							label: last.label || ""
						};
					}
					for (var i = 0; i < kfs.length - 1; i++) {
						var k0 = kfs[i];
						var k1 = kfs[i + 1];
						if (t >= k0.t && t <= k1.t) {
							var dur = k1.t - k0.t;
							var p = dur > 0 ? (t - k0.t) / dur : 1;
							var ep = (Easings[k1.ease || "easeInOutQuad"] || Easings.easeInOutQuad)(clamp(p, 0, 1));
							var res = {};
							var p0 = k0.pose;
							var p1 = k1.pose;
							new Set(Object.keys(p0).concat(Object.keys(p1))).forEach(function(key) {
								var defVal = key.indexOf("scale") !== -1 || key.indexOf("Scale") !== -1 ? 1 : 0;
								var v0 = p0[key] !== void 0 ? p0[key] : p1[key] !== void 0 ? p1[key] : defVal;
								var v1 = p1[key] !== void 0 ? p1[key] : p0[key] !== void 0 ? p0[key] : defVal;
								if (typeof v1 === "number" && typeof v0 === "number") res[key] = lerp(v0, v1, ep);
								else if (key === "visible") res[key] = Boolean(v0 || v1);
								else res[key] = p >= .5 ? v1 : v0;
							});
							return {
								pose: res,
								label: k1.label || k0.label || ""
							};
						}
					}
					return {
						pose: Object.assign({}, kfs[0].pose),
						label: ""
					};
				};
				function BlinkTrack(blinks) {
					this.blinks = blinks || [];
				}
				BlinkTrack.prototype.evaluate = function(t) {
					for (var i = 0; i < this.blinks.length; i++) {
						var b = this.blinks[i];
						if (t >= b.start && t <= b.start + b.duration) {
							var p = (t - b.start) / b.duration;
							return (b.maxSquint || .95) * Math.sin(p * Math.PI);
						}
					}
					return 0;
				};
				function DotGridRig(spacing, baseRadius) {
					this.spacing = spacing !== void 0 ? spacing : 38;
					this.baseRadius = baseRadius !== void 0 ? baseRadius : 10.1;
				}
				DotGridRig.prototype.evaluate = function(t, botScale, botVisible) {
					var dots = [];
					var phase = t * Math.PI * 2 * .9 + .66;
					var cubeHalf = botVisible ? 68 * (botScale || 0) : 0;
					for (var row = -1; row <= 1; row++) for (var col = -1; col <= 1; col++) {
						var diag = col + 1 + (row + 1);
						var wave = Math.cos(phase - diag * .65);
						var r = this.baseRadius + 3.25 * wave;
						var x = col * this.spacing;
						var y = row * this.spacing;
						var distBox = Math.max(Math.abs(x), Math.abs(y));
						var visible = true;
						if (botVisible && botScale > .05) {
							if (distBox < cubeHalf - 4) {
								visible = false;
								r = 0;
							} else if (distBox < cubeHalf + 10) {
								var fade = (distBox - (cubeHalf - 4)) / 14;
								r *= Math.max(0, Math.min(1, fade));
								if (r < .5) visible = false;
							}
						}
						dots.push({
							x,
							y,
							r,
							visible
						});
					}
					return dots;
				};
				function SvgProjector(options) {
					options = options || {};
					this.fov = (options.fov || 28) * Math.PI / 180;
					this.focalLength = 1 / Math.tan(this.fov / 2);
					this.camPos = options.cameraPosition || [
						-.32,
						.4,
						2.7
					];
					this.camTarget = options.cameraTarget || [
						0,
						0,
						0
					];
					this.viewportSize = options.viewportSize || 280;
					var c = this.camPos;
					var tgt = this.camTarget;
					var dist = Math.hypot(tgt[0] - c[0], tgt[1] - c[1], tgt[2] - c[2]);
					this.fwd = [
						(tgt[0] - c[0]) / dist,
						(tgt[1] - c[1]) / dist,
						(tgt[2] - c[2]) / dist
					];
					var up = [
						0,
						1,
						0
					];
					var rx = this.fwd[1] * up[2] - this.fwd[2] * up[1];
					var ry = this.fwd[2] * up[0] - this.fwd[0] * up[2];
					var rz = this.fwd[0] * up[1] - this.fwd[1] * up[0];
					var rlen = Math.hypot(rx, ry, rz);
					this.right = [
						rx / rlen,
						ry / rlen,
						rz / rlen
					];
					var ux = this.right[1] * this.fwd[2] - this.right[2] * this.fwd[1];
					var uy = this.right[2] * this.fwd[0] - this.right[0] * this.fwd[2];
					var uz = this.right[0] * this.fwd[1] - this.right[1] * this.fwd[0];
					this.camUp = [
						ux,
						uy,
						uz
					];
					this.halfSize = this.viewportSize / 2;
				}
				SvgProjector.prototype.projectWorldPoint = function(wx, wy, wz) {
					var dx = wx - this.camPos[0];
					var dy = wy - this.camPos[1];
					var dz = wz - this.camPos[2];
					var xc = dx * this.right[0] + dy * this.right[1] + dz * this.right[2];
					var yc = dx * this.camUp[0] + dy * this.camUp[1] + dz * this.camUp[2];
					var zc = dx * this.fwd[0] + dy * this.fwd[1] + dz * this.fwd[2];
					if (zc <= .001) return null;
					return {
						x: xc / zc * this.focalLength * this.halfSize,
						y: -(yc / zc) * this.focalLength * this.halfSize,
						z: zc
					};
				};
				SvgProjector.getConvexHull = function(pts) {
					if (pts.length <= 1) return pts.slice();
					var sorted = pts.slice().sort(function(a, b) {
						return Math.abs(a.x - b.x) < 1e-5 ? a.y - b.y : a.x - b.x;
					});
					var cross = function(o, a, b) {
						return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
					};
					var lower = [];
					for (var i = 0; i < sorted.length; i++) {
						var p = sorted[i];
						while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-5) lower.pop();
						lower.push(p);
					}
					var upper = [];
					for (var j = sorted.length - 1; j >= 0; j--) {
						var q = sorted[j];
						while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 1e-5) upper.pop();
						upper.push(q);
					}
					lower.pop();
					upper.pop();
					var hull = lower.concat(upper);
					var area = 0;
					for (var k = 0; k < hull.length; k++) {
						var next = (k + 1) % hull.length;
						area += hull[k].x * hull[next].y - hull[next].x * hull[k].y;
					}
					if (area < 0) hull.reverse();
					return hull;
				};
				SvgProjector.prototype.projectRoundedCube = function(pose, cubeW, cubeRadius) {
					cubeW = cubeW !== void 0 ? cubeW : 1;
					cubeRadius = cubeRadius !== void 0 ? cubeRadius : .35;
					if (!pose || pose.visible === false || pose.scale !== void 0 && pose.scale <= .001) return {
						visible: false,
						bodyPath: "",
						eyes: []
					};
					var s = (pose.scale !== void 0 ? pose.scale : 1) * .6;
					var scX = pose.scaleX !== void 0 ? pose.scaleX : 1;
					var scY = pose.scaleY !== void 0 ? pose.scaleY : 1;
					var scZ = pose.scaleZ !== void 0 ? pose.scaleZ : 1;
					var hw = cubeW / 2 * s * scX;
					var hh = cubeW / 2 * s * scY;
					var hd = cubeW / 2 * s * scZ;
					var r = cubeRadius * s * Math.min(scX, scY);
					var ihw = Math.max(.001, hw - r);
					var ihh = Math.max(.001, hh - r);
					var ihd = Math.max(.001, hd - r);
					var pitch = pose.pitch || 0;
					var yaw = pose.yaw || 0;
					var roll = pose.roll || 0;
					var cx = Math.cos(pitch), sx = Math.sin(pitch);
					var cy = Math.cos(yaw), sy = Math.sin(yaw);
					var cz = Math.cos(roll), sz = Math.sin(roll);
					var r00 = cz * cy;
					var r01 = cz * sy * sx - sz * cx;
					var r02 = cz * sy * cx + sz * sx;
					var r10 = sz * cy;
					var r11 = sz * sy * sx + cz * cx;
					var r12 = sz * sy * cx - cz * sx;
					var r20 = -sy;
					var r21 = cy * sx;
					var r22 = cy * cx;
					var bx = pose.x || 0;
					var by = pose.y || 0;
					var bz = pose.z || 0;
					var signs = [
						[
							-1,
							-1,
							-1
						],
						[
							1,
							-1,
							-1
						],
						[
							1,
							1,
							-1
						],
						[
							-1,
							1,
							-1
						],
						[
							-1,
							-1,
							1
						],
						[
							1,
							-1,
							1
						],
						[
							1,
							1,
							1
						],
						[
							-1,
							1,
							1
						]
					];
					var projPts = [];
					var avgZ = 0;
					for (var idx = 0; idx < signs.length; idx++) {
						var sgn = signs[idx];
						var vx = sgn[0] * ihw;
						var vy = sgn[1] * ihh;
						var vz = sgn[2] * ihd;
						var wx = bx + (r00 * vx + r01 * vy + r02 * vz);
						var wy = by + (r10 * vx + r11 * vy + r12 * vz);
						var wz = bz + (r20 * vx + r21 * vy + r22 * vz);
						var p = this.projectWorldPoint(wx, wy, wz);
						if (!p) continue;
						projPts.push(p);
						avgZ += p.z;
					}
					if (projPts.length < 4) return {
						visible: false,
						bodyPath: "",
						eyes: []
					};
					avgZ /= projPts.length;
					var rScreen = r / avgZ * this.focalLength * this.halfSize;
					var hull = SvgProjector.getConvexHull(projPts);
					if (hull.length < 3) return {
						visible: false,
						bodyPath: "",
						eyes: []
					};
					var m = hull.length;
					var segments = [];
					for (var k = 0; k < m; k++) {
						var p0 = hull[k];
						var p1 = hull[(k + 1) % m];
						var dx = p1.x - p0.x;
						var dy = p1.y - p0.y;
						var len = Math.hypot(dx, dy);
						if (len < 1e-5) continue;
						var nx = dy / len;
						var ny = -dx / len;
						var a = {
							x: p0.x + rScreen * nx,
							y: p0.y + rScreen * ny
						};
						var b = {
							x: p1.x + rScreen * nx,
							y: p1.y + rScreen * ny
						};
						segments.push({
							a,
							b,
							corner: p1
						});
					}
					var bodyPath = "";
					if (segments.length >= 3) {
						var d = [];
						for (var si = 0; si < segments.length; si++) {
							var seg = segments[si];
							var nextSeg = segments[(si + 1) % segments.length];
							if (si === 0) d.push("M " + seg.a.x.toFixed(2) + " " + seg.a.y.toFixed(2));
							d.push("L " + seg.b.x.toFixed(2) + " " + seg.b.y.toFixed(2));
							d.push("A " + rScreen.toFixed(2) + " " + rScreen.toFixed(2) + " 0 0 1 " + nextSeg.a.x.toFixed(2) + " " + nextSeg.a.y.toFixed(2));
						}
						d.push("Z");
						bodyPath = d.join(" ");
					}
					var eyes = [];
					var fnx = r02;
					var fny = r12;
					var fnz = r22;
					var viewDot = -(fnx * this.fwd[0] + fny * this.fwd[1] + fnz * this.fwd[2]);
					var viewFade = 1;
					if (viewDot <= 0) viewFade = 0;
					else if (viewDot < .15) {
						var u = viewDot / .15;
						viewFade = u * u * (3 - 2 * u);
					}
					if (pose.showEyes !== false && viewFade > .001) {
						var zFace = (pose.zFace !== void 0 ? pose.zFace : .508) * s * scZ;
						var self = this;
						var computeFeaturePoint = function(fx, fy) {
							var wx = bx + (r00 * fx + r01 * fy + r02 * zFace);
							var wy = by + (r10 * fx + r11 * fy + r12 * zFace);
							var wz = bz + (r20 * fx + r21 * fy + r22 * zFace);
							return self.projectWorldPoint(wx, wy, wz);
						};
						var getAngle = function(baseP, upP, slant) {
							if (!baseP || !upP) return 0;
							var adx = upP.x - baseP.x;
							var ady = upP.y - baseP.y;
							return Math.atan2(adx, -ady) * (180 / Math.PI) - slant * 180 / Math.PI;
						};
						var rawFeatures = null;
						if (Array.isArray(pose.faceFeatures) && pose.faceFeatures.length > 0) rawFeatures = pose.faceFeatures;
						else if (Array.isArray(pose.features) && pose.features.length > 0) rawFeatures = pose.features;
						else {
							var baseGap = (pose.eyeGap !== void 0 ? pose.eyeGap : .27) * s * scX;
							var eyeX = (pose.eyeShiftX || 0) * s * scX;
							var baseEyeY = (.01 - (pose.bulge || 0) * .02 + (pose.eyeShiftY || 0)) * s * scY;
							var eyeYL = baseEyeY + (pose.eyeShiftYL || 0) * s * scY;
							var eyeYR = baseEyeY + (pose.eyeShiftYR || 0) * s * scY;
							var slantL = pose.eyeSlantL !== void 0 ? pose.eyeSlantL : pose.eyeSlant || 0;
							var slantR = pose.eyeSlantR !== void 0 ? pose.eyeSlantR : -(pose.eyeSlant || 0);
							var sxL = pose.eyeScaleXL !== void 0 ? pose.eyeScaleXL : pose.eyeScaleX !== void 0 ? pose.eyeScaleX : 1;
							var sxR = pose.eyeScaleXR !== void 0 ? pose.eyeScaleXR : pose.eyeScaleX !== void 0 ? pose.eyeScaleX : 1;
							var syL = pose.eyeScaleYL !== void 0 ? pose.eyeScaleYL : pose.eyeScaleY !== void 0 ? pose.eyeScaleY : 1;
							var syR = pose.eyeScaleYR !== void 0 ? pose.eyeScaleYR : pose.eyeScaleY !== void 0 ? pose.eyeScaleY : 1;
							var eyeSxL = (1 + (pose.bulge || 0) * .45) * sxL;
							var eyeSxR = (1 + (pose.bulge || 0) * .45) * sxR;
							var eyeSyL = (1 + (pose.bulge || 0) * .65) * syL;
							var eyeSyR = (1 + (pose.bulge || 0) * .65) * syR;
							var squint = pose.squint || 0;
							if (squint > .01) {
								eyeSyL = eyeSyL * (1 - squint) + .02 * squint;
								eyeSxL = eyeSxL * (1 - squint) + .85 * squint;
								eyeSyR = eyeSyR * (1 - squint) + .02 * squint;
								eyeSxR = eyeSxR * (1 - squint) + .85 * squint;
							}
							rawFeatures = [{
								id: "eyeL",
								type: "pill",
								x: -baseGap / 2 + eyeX,
								y: eyeYL,
								slant: slantL,
								scaleX: eyeSxL,
								scaleY: eyeSyL,
								baseW: .125,
								baseH: .21,
								color: pose.eyeColor || "#ffffff"
							}, {
								id: "eyeR",
								type: "pill",
								x: baseGap / 2 + eyeX,
								y: eyeYR,
								slant: slantR,
								scaleX: eyeSxR,
								scaleY: eyeSyR,
								baseW: .125,
								baseH: .21,
								color: pose.eyeColor || "#ffffff"
							}];
						}
						var faceForeshorten = Math.max(.85, Math.hypot(r00, r10));
						var squashFade = .2 + .8 * viewFade;
						for (var fi = 0; fi < rawFeatures.length; fi++) {
							var feat = rawFeatures[fi];
							var fx = feat.x !== void 0 ? feat.x : 0;
							var fy = feat.y !== void 0 ? feat.y : 0;
							var projP = computeFeaturePoint(fx, fy);
							if (!projP) continue;
							var angle = getAngle(projP, computeFeaturePoint(fx, fy + .1 * s * scY), feat.slant || 0);
							var factor = projP.z > .01 ? this.focalLength / projP.z * this.halfSize : this.focalLength / avgZ * this.halfSize;
							var baseW = feat.baseW !== void 0 ? feat.baseW : .125;
							var baseH = feat.baseH !== void 0 ? feat.baseH : .21;
							var scFeatX = feat.scaleX !== void 0 ? feat.scaleX : 1;
							var scFeatY = feat.scaleY !== void 0 ? feat.scaleY : 1;
							var ew = Math.max(.2, baseW * s * scX * scFeatX * faceForeshorten * factor * squashFade);
							var eh = Math.max(.2, baseH * s * scY * scFeatY * factor);
							var erx = feat.rx !== void 0 ? feat.rx : Math.min(ew, eh) / 2;
							var ery = feat.ry !== void 0 ? feat.ry : Math.min(ew, eh) / 2;
							var featOpacity = (feat.opacity !== void 0 ? feat.opacity : 1) * viewFade;
							eyes.push({
								id: feat.id || "feat-" + fi,
								type: feat.type || "pill",
								cx: projP.x,
								cy: projP.y,
								z: projP.z,
								w: ew,
								h: eh,
								rx: erx,
								ry: ery,
								angle,
								opacity: featOpacity,
								color: feat.color || pose.eyeColor || "#ffffff"
							});
						}
					}
					return {
						visible: true,
						bodyPath,
						eyes,
						bodyColor: pose.bodyColor,
						eyeColor: pose.eyeColor
					};
				};
				var pBot1Start = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: .05,
					pitch: -.02,
					roll: .01,
					eyeShiftX: .015,
					eyeShiftY: -.01,
					eyeScaleX: 1,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: 1,
					eyeGap: .26,
					bulge: 0,
					jumpY: 0
				};
				var pBot1Left = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: -.28,
					pitch: -.03,
					roll: .02,
					eyeShiftX: -.08,
					eyeShiftY: .01,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: .94,
					eyeScaleXR: 1,
					eyeGap: .22,
					bulge: 0,
					jumpY: 0
				};
				var pBot1DeepLeft = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: -.42,
					pitch: -.05,
					roll: .04,
					eyeShiftX: -.108,
					eyeShiftY: .03,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: .92,
					eyeScaleXR: 1,
					eyeGap: .2,
					bulge: 0,
					jumpY: 0
				};
				var pBot1Right = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: .36,
					pitch: -.04,
					roll: -.03,
					eyeShiftX: .075,
					eyeShiftY: .02,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: .94,
					eyeGap: .22,
					bulge: 0,
					jumpY: 0
				};
				var pBot1FarRight = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: .44,
					pitch: -.05,
					roll: -.04,
					eyeShiftX: .095,
					eyeShiftY: .025,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: .92,
					eyeGap: .2,
					bulge: 0,
					jumpY: 0
				};
				var pBot1MidFocus = {
					scale: 1,
					scaleX: 1,
					scaleY: 1,
					yaw: 0,
					pitch: -.02,
					roll: 0,
					eyeShiftX: 0,
					eyeShiftY: 0,
					eyeScaleX: 1,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: 1,
					eyeGap: .26,
					bulge: 0,
					jumpY: 0
				};
				var pBot1Stretch = {
					scale: 1,
					scaleX: .97,
					scaleY: 1.04,
					yaw: .38,
					pitch: -.06,
					roll: 0,
					eyeShiftX: .075,
					eyeShiftY: .04,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: .94,
					eyeGap: .22,
					bulge: 0,
					jumpY: .012
				};
				var pBot1Tilt = {
					scale: 1,
					scaleX: .97,
					scaleY: 1.04,
					yaw: .4,
					pitch: -.06,
					roll: .32,
					eyeShiftX: .085,
					eyeShiftY: .035,
					eyeScaleX: .95,
					eyeScaleY: 1,
					eyeScaleXL: 1,
					eyeScaleXR: .94,
					eyeGap: .21,
					bulge: 0,
					jumpY: .012
				};
				var bot1Timeline = new PoseTimeline([
					{
						t: 0,
						label: "sentry-scan-left-1",
						pose: pBot1Start
					},
					{
						t: 1.65,
						label: "sentry-scan-left-1",
						ease: "linear",
						pose: pBot1Start
					},
					{
						t: 2.15,
						label: "sentry-sweep-right-1",
						ease: "easeInOutQuad",
						pose: pBot1Right
					},
					{
						t: 3.6,
						label: "sentry-sweep-right-1",
						ease: "linear",
						pose: pBot1Right
					},
					{
						t: 3.88,
						label: "sentry-scan-left-2",
						ease: "easeInOutQuad",
						pose: pBot1Left
					},
					{
						t: 4.65,
						label: "sentry-scan-left-2",
						ease: "linear",
						pose: pBot1Left
					},
					{
						t: 5.3,
						label: "sentry-sweep-right-2",
						ease: "easeInOutQuad",
						pose: pBot1Right
					},
					{
						t: 6.6,
						label: "sentry-sweep-right-2",
						ease: "linear",
						pose: pBot1Right
					},
					{
						t: 7.1,
						label: "sentry-sweep-far-right",
						ease: "easeInOutQuad",
						pose: pBot1FarRight
					},
					{
						t: 8.4,
						label: "sentry-sweep-far-right",
						ease: "linear",
						pose: pBot1FarRight
					},
					{
						t: 8.75,
						label: "sentry-deep-left-1",
						ease: "easeInOutQuad",
						pose: pBot1DeepLeft
					},
					{
						t: 9.35,
						label: "sentry-deep-left-1",
						ease: "linear",
						pose: pBot1DeepLeft
					},
					{
						t: 9.9,
						label: "sentry-sweep-right-3",
						ease: "easeInOutQuad",
						pose: pBot1Right
					},
					{
						t: 11.2,
						label: "sentry-sweep-right-3",
						ease: "linear",
						pose: pBot1Right
					},
					{
						t: 11.55,
						label: "sentry-center-focus",
						ease: "easeInOutQuad",
						pose: pBot1MidFocus
					},
					{
						t: 14.1,
						label: "sentry-center-focus",
						ease: "linear",
						pose: pBot1MidFocus
					},
					{
						t: 14.45,
						label: "sentry-deep-left-2",
						ease: "easeInOutQuad",
						pose: pBot1DeepLeft
					},
					{
						t: 15.15,
						label: "sentry-deep-left-2",
						ease: "linear",
						pose: pBot1DeepLeft
					},
					{
						t: 15.65,
						label: "sentry-sweep-right-4",
						ease: "easeInOutQuad",
						pose: pBot1Right
					},
					{
						t: 16.8,
						label: "sentry-sweep-right-4",
						ease: "linear",
						pose: pBot1Right
					},
					{
						t: 17.05,
						label: "sentry-stretch",
						ease: "easeInOutQuad",
						pose: pBot1Stretch
					},
					{
						t: 17.35,
						label: "sentry-curious-tilt",
						ease: "easeInOutQuad",
						pose: pBot1Tilt
					},
					{
						t: 18.7,
						label: "sentry-curious-tilt",
						ease: "linear",
						pose: pBot1Tilt
					},
					{
						t: 19.05,
						label: "sentry-right-settle",
						ease: "easeInOutQuad",
						pose: pBot1Right
					},
					{
						t: 19.45,
						label: "sentry-scan-left-3",
						ease: "easeInOutQuad",
						pose: pBot1Left
					},
					{
						t: 20.2,
						label: "sentry-deep-left-3",
						ease: "easeInOutQuad",
						pose: pBot1DeepLeft
					},
					{
						t: 20.783,
						label: "sentry-scan-left-1",
						ease: "easeInOutQuad",
						pose: pBot1Start
					}
				]);
				var bot1Blinks = new BlinkTrack([
					{
						start: 1.85,
						duration: .18,
						maxSquint: .98
					},
					{
						start: 5.65,
						duration: .17,
						maxSquint: .98
					},
					{
						start: 8.8,
						duration: .18,
						maxSquint: .98
					},
					{
						start: 11.4,
						duration: .18,
						maxSquint: .98
					},
					{
						start: 11.68,
						duration: .19,
						maxSquint: .98
					},
					{
						start: 16.1,
						duration: .18,
						maxSquint: .98
					},
					{
						start: 18.96,
						duration: .18,
						maxSquint: .98
					}
				]);
				function getBot1State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot1Timeline.evaluate(t);
					var pose = res.pose;
					var squint = bot1Blinks.evaluate(t);
					var bot = {
						visible: true,
						scale: pose.scale,
						scaleX: pose.scaleX,
						scaleY: pose.scaleY,
						x: 0,
						y: pose.jumpY || 0,
						yaw: pose.yaw,
						pitch: pose.pitch,
						roll: pose.roll,
						eyeShiftX: pose.eyeShiftX,
						eyeShiftY: pose.eyeShiftY,
						eyeScaleX: pose.eyeScaleX,
						eyeScaleY: pose.eyeScaleY,
						eyeScaleXL: pose.eyeScaleXL !== void 0 ? pose.eyeScaleXL : 1,
						eyeScaleXR: pose.eyeScaleXR !== void 0 ? pose.eyeScaleXR : 1,
						eyeGap: pose.eyeGap !== void 0 ? pose.eyeGap : .23,
						bulge: pose.bulge || 0,
						squint,
						bodyColor: 2236710,
						eyeColor: 16777215
					};
					return {
						botId: 1,
						type: "bot1",
						label: res.label,
						bot,
						dots: []
					};
				}
				var bot2Apexes = [
					1.07,
					4.78,
					8.57,
					12.2,
					15.9,
					19.62
				];
				var BOT2_FLIP_HALF = .42;
				function makeBot2RelaxedPose(cycle) {
					return {
						scale: 1,
						scaleX: 1,
						scaleY: 1,
						yaw: .05,
						pitch: .02,
						roll: .17 + cycle * 2 * Math.PI,
						eyeShiftX: .04,
						eyeShiftY: .22,
						eyeShiftYL: 0,
						eyeShiftYR: 0,
						eyeScaleXL: 1,
						eyeScaleYL: 1,
						eyeScaleXR: 1,
						eyeScaleYR: 1,
						eyeSlantL: 0,
						eyeSlantR: .1,
						eyeGap: .22,
						bulge: 0,
						jumpY: 0,
						showEyes: true
					};
				}
				function makeBot2MidPose(cycle) {
					return {
						scale: 1,
						scaleX: 1,
						scaleY: 1,
						yaw: .85,
						pitch: .35,
						roll: .17 + (cycle * 2 + 1) * Math.PI,
						eyeShiftX: .04,
						eyeShiftY: .22,
						eyeShiftYL: 0,
						eyeShiftYR: 0,
						eyeScaleXL: .85,
						eyeScaleYL: .85,
						eyeScaleXR: .85,
						eyeScaleYR: .85,
						eyeSlantL: 0,
						eyeSlantR: 0,
						eyeGap: .22,
						bulge: 0,
						jumpY: .075,
						showEyes: false
					};
				}
				function makeBot2SquintPose(cycle) {
					return {
						scale: 1,
						scaleX: 1,
						scaleY: 1,
						yaw: .05,
						pitch: .02,
						roll: .17 + cycle * 2 * Math.PI,
						eyeShiftX: .04,
						eyeShiftY: .22,
						eyeShiftYL: -.015,
						eyeShiftYR: .02,
						eyeScaleXL: .6,
						eyeScaleXR: .6,
						eyeScaleYL: .85,
						eyeScaleYR: .85,
						eyeSlantL: .56,
						eyeSlantR: -.51,
						eyeGap: .22,
						bulge: 0,
						jumpY: 0,
						showEyes: true
					};
				}
				var bot2Keyframes = [{
					t: 0,
					label: "standby-relaxed-0",
					pose: makeBot2RelaxedPose(0)
				}];
				for (var bi = 0; bi < bot2Apexes.length; bi++) {
					var apex = bot2Apexes[bi];
					var tTakeoff = apex - BOT2_FLIP_HALF;
					var tMid = apex;
					var tLand = apex + BOT2_FLIP_HALF;
					var tSquintSnap = tLand + .08;
					bot2Keyframes.push({
						t: tTakeoff,
						label: "takeoff-" + bi,
						ease: "linear",
						pose: makeBot2RelaxedPose(bi)
					});
					bot2Keyframes.push({
						t: tMid,
						label: "spin-flip-mid-" + (bi + 1),
						ease: "easeInOutQuad",
						pose: makeBot2MidPose(bi)
					});
					bot2Keyframes.push({
						t: tLand,
						label: "spin-flip-land-" + (bi + 1),
						ease: "easeInOutQuad",
						pose: makeBot2SquintPose(bi + 1)
					});
					bot2Keyframes.push({
						t: tSquintSnap,
						label: "attitude-squint-" + (bi + 1),
						ease: "linear",
						pose: makeBot2SquintPose(bi + 1)
					});
					if (bi < bot2Apexes.length - 1) {
						var nextTakeoff = bot2Apexes[bi + 1] - BOT2_FLIP_HALF;
						var tSquintHoldEnd = nextTakeoff - .65;
						var tRelaxEnd = nextTakeoff - .35;
						bot2Keyframes.push({
							t: tSquintHoldEnd,
							label: "attitude-hold-" + (bi + 1),
							ease: "linear",
							pose: makeBot2SquintPose(bi + 1)
						});
						bot2Keyframes.push({
							t: tRelaxEnd,
							label: "attitude-relax-" + (bi + 1),
							ease: "easeInOutQuad",
							pose: makeBot2RelaxedPose(bi + 1)
						});
					} else {
						bot2Keyframes.push({
							t: 20.45,
							label: "attitude-hold-6",
							ease: "linear",
							pose: makeBot2SquintPose(6)
						});
						bot2Keyframes.push({
							t: 20.783,
							label: "attitude-relax-end",
							ease: "easeInOutQuad",
							pose: makeBot2RelaxedPose(6)
						});
					}
				}
				var bot2Timeline = new PoseTimeline(bot2Keyframes);
				var bot2Blinks = new BlinkTrack([]);
				function getBot2State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot2Timeline.evaluate(t);
					var pose = res.pose;
					var squint = bot2Blinks.evaluate(t);
					var squintWeight = Math.max(0, Math.min(1, (pose.eyeSlantL || 0) / .56));
					var omegaShake = 2.2 * Math.PI * 2;
					var headShakeYaw = Math.sin(t * omegaShake) * .038 * squintWeight;
					var headShakeRoll = Math.cos(t * omegaShake) * .024 * squintWeight;
					var headShakeEyeX = Math.sin(t * omegaShake) * .01 * squintWeight;
					var headShakeEyeY = Math.abs(Math.sin(t * omegaShake)) * .005 * squintWeight;
					var bot = {
						visible: true,
						scale: pose.scale,
						scaleX: pose.scaleX,
						scaleY: pose.scaleY,
						x: 0,
						y: pose.jumpY || 0,
						yaw: (pose.yaw || 0) + headShakeYaw,
						pitch: pose.pitch,
						roll: (pose.roll || 0) + headShakeRoll,
						eyeShiftX: (pose.eyeShiftX || 0) + headShakeEyeX,
						eyeShiftY: (pose.eyeShiftY || 0) + headShakeEyeY,
						eyeShiftYL: pose.eyeShiftYL,
						eyeShiftYR: pose.eyeShiftYR,
						eyeScaleX: pose.eyeScaleX,
						eyeScaleY: pose.eyeScaleY,
						eyeScaleXL: pose.eyeScaleXL,
						eyeScaleXR: pose.eyeScaleXR,
						eyeScaleYL: pose.eyeScaleYL,
						eyeScaleYR: pose.eyeScaleYR,
						eyeSlantL: pose.eyeSlantL,
						eyeSlantR: pose.eyeSlantR,
						eyeGap: pose.eyeGap !== void 0 ? pose.eyeGap : .22,
						bulge: pose.bulge || 0,
						squint,
						showEyes: pose.showEyes,
						bodyColor: 2236710,
						eyeColor: 16777215
					};
					return {
						botId: 2,
						type: "bot2",
						label: res.label,
						bot,
						dots: []
					};
				}
				var BOT3_PALETTE_12 = [
					[
						58,
						53,
						206
					],
					[
						60,
						84,
						208
					],
					[
						201,
						34,
						153
					],
					[
						201,
						222,
						65
					],
					[
						68,
						229,
						198
					],
					[
						66,
						162,
						209
					],
					[
						69,
						238,
						80
					],
					[
						200,
						41,
						71
					],
					[
						125,
						38,
						208
					],
					[
						100,
						42,
						209
					],
					[
						154,
						36,
						211
					],
					[
						199,
						35,
						104
					]
				];
				function getBot3ColorHex(t) {
					var cycle = (t % 6 + 6) % 6 / 6;
					var n = BOT3_PALETTE_12.length;
					var p = cycle * n;
					var i0 = Math.floor(p) % n;
					var i1 = (i0 + 1) % n;
					var f = p - Math.floor(p);
					var s = f * f * (3 - 2 * f);
					var r = Math.round(BOT3_PALETTE_12[i0][0] * (1 - s) + BOT3_PALETTE_12[i1][0] * s);
					var g = Math.round(BOT3_PALETTE_12[i0][1] * (1 - s) + BOT3_PALETTE_12[i1][1] * s);
					var b = Math.round(BOT3_PALETTE_12[i0][2] * (1 - s) + BOT3_PALETTE_12[i1][2] * s);
					return r << 16 | g << 8 | b;
				}
				var bot3Timeline = new PoseTimeline([
					{
						t: 0,
						label: "chameleon-normal",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 1.2,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 1.5,
						label: "chameleon-slit-1",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 1.7,
						label: "chameleon-slit-1",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 1.95,
						label: "chameleon-dot-1",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .4,
							eyeScaleY: .4,
							eyeScaleXL: .4,
							eyeScaleXR: .4,
							eyeScaleYL: .4,
							eyeScaleYR: .4,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 2.15,
						label: "chameleon-dot-1",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .4,
							eyeScaleY: .4,
							eyeScaleXL: .4,
							eyeScaleXR: .4,
							eyeScaleYL: .4,
							eyeScaleYR: .4,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 2.45,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 2.75,
						label: "chameleon-slit-2",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 3.15,
						label: "chameleon-slit-2",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 3.5,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 4.8,
						label: "chameleon-slit-3",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 5.3,
						label: "chameleon-slit-3",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 5.7,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 8.6,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 8.9,
						label: "chameleon-corner-glance-1",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 9.2,
						label: "chameleon-corner-glance-1",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 9.5,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 11.2,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 11.5,
						label: "chameleon-asym",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .5,
							eyeScaleY: .62,
							eyeScaleXL: .4,
							eyeScaleXR: .6,
							eyeScaleYL: .4,
							eyeScaleYR: .85,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 11.8,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 14.6,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 14.85,
						label: "chameleon-corner-glance-2",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 15.05,
						label: "chameleon-corner-glance-2",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 15.18,
						label: "chameleon-dazed",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .02,
							pitch: .01,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .75,
							eyeScaleY: .45,
							eyeScaleXL: .75,
							eyeScaleXR: .75,
							eyeScaleYL: .45,
							eyeScaleYR: .45,
							eyeSlantL: .1,
							eyeSlantR: -.1,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 16.14,
						label: "chameleon-dazed",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .02,
							pitch: .01,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .75,
							eyeScaleY: .45,
							eyeScaleXL: .75,
							eyeScaleXR: .75,
							eyeScaleYL: .45,
							eyeScaleYR: .45,
							eyeSlantL: .1,
							eyeSlantR: -.1,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 16.4,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 17,
						label: "chameleon-slit-4",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 17.6,
						label: "chameleon-slit-4",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .52,
							eyeScaleY: .82,
							eyeScaleXL: .52,
							eyeScaleXR: .52,
							eyeScaleYL: .82,
							eyeScaleYR: .82,
							eyeSlantL: .58,
							eyeSlantR: -.58,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 18,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 19.8,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 20,
						label: "chameleon-corner-glance-3",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 20.25,
						label: "chameleon-corner-glance-3",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.15,
							pitch: -.04,
							roll: -.1,
							eyeShiftX: -.16,
							eyeShiftY: .11,
							eyeGap: .36,
							eyeScaleX: .52,
							eyeScaleY: .52,
							eyeScaleXL: .5,
							eyeScaleXR: .55,
							eyeScaleYL: .5,
							eyeScaleYR: .55,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 20.5,
						label: "chameleon-normal",
						ease: "easeInOutQuad",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 20.783,
						label: "chameleon-normal",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .05,
							pitch: .02,
							roll: -.1,
							eyeShiftX: .02,
							eyeShiftY: .09,
							eyeGap: .27,
							eyeScaleX: .9,
							eyeScaleY: 1.05,
							eyeScaleXL: .9,
							eyeScaleXR: .9,
							eyeScaleYL: 1.05,
							eyeScaleYR: 1.05,
							eyeSlantL: 0,
							eyeSlantR: 0,
							bulge: 0,
							jumpY: 0
						}
					}
				]);
				var bot3Blinks = new BlinkTrack([
					{
						start: 1.85,
						duration: .18,
						maxSquint: .95
					},
					{
						start: 5.65,
						duration: .17,
						maxSquint: .95
					},
					{
						start: 8.8,
						duration: .18,
						maxSquint: .95
					},
					{
						start: 11.4,
						duration: .18,
						maxSquint: .95
					},
					{
						start: 11.7,
						duration: .18,
						maxSquint: .95
					},
					{
						start: 16.12,
						duration: .18,
						maxSquint: .95
					},
					{
						start: 18.96,
						duration: .18,
						maxSquint: .95
					}
				]);
				function getBot3State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var colorHex = getBot3ColorHex(t);
					var res = bot3Timeline.evaluate(t);
					var pose = res.pose;
					var squint = bot3Blinks.evaluate(t);
					var omegaSway = 2 * Math.PI * 21 / LOOP;
					var omegaBounce = 4 * omegaSway;
					var bouncePhase = t * omegaBounce % (2 * Math.PI);
					var bounceShape = Math.pow(Math.sin(bouncePhase / 2), 2);
					var bounceY = (bounceShape - .48) * .052;
					var squashNorm = (bounceShape - .48) * 2;
					var danceScaleX = (pose.scaleX || 1) * (1 + squashNorm * .068);
					var danceScaleY = (pose.scaleY || 1) * (1 - squashNorm * .068);
					var swayX = Math.sin(t * omegaSway) * .15;
					var swayRoll = -Math.sin(t * omegaSway) * .2 + Math.cos(t * omegaBounce) * .035;
					var bot = {
						visible: true,
						scale: pose.scale || 1,
						scaleX: danceScaleX,
						scaleY: danceScaleY,
						x: (pose.x || 0) + swayX,
						y: (pose.jumpY || 0) + bounceY,
						jumpY: (pose.jumpY || 0) + bounceY,
						yaw: pose.yaw || 0,
						pitch: pose.pitch || 0,
						roll: (pose.roll || 0) + swayRoll,
						eyeShiftX: pose.eyeShiftX !== void 0 ? pose.eyeShiftX : .02,
						eyeShiftY: pose.eyeShiftY !== void 0 ? pose.eyeShiftY : .09 - bounceY * .25,
						eyeScaleX: pose.eyeScaleX,
						eyeScaleY: pose.eyeScaleY,
						eyeScaleXL: pose.eyeScaleXL !== void 0 ? pose.eyeScaleXL : pose.eyeScaleX !== void 0 ? pose.eyeScaleX : .9,
						eyeScaleXR: pose.eyeScaleXR !== void 0 ? pose.eyeScaleXR : pose.eyeScaleX !== void 0 ? pose.eyeScaleX : .9,
						eyeScaleYL: pose.eyeScaleYL !== void 0 ? pose.eyeScaleYL : pose.eyeScaleY !== void 0 ? pose.eyeScaleY : 1.05,
						eyeScaleYR: pose.eyeScaleYR !== void 0 ? pose.eyeScaleYR : pose.eyeScaleY !== void 0 ? pose.eyeScaleY : 1.05,
						eyeSlantL: pose.eyeSlantL !== void 0 ? pose.eyeSlantL : pose.eyeSlant || 0,
						eyeSlantR: pose.eyeSlantR !== void 0 ? pose.eyeSlantR : -(pose.eyeSlant || 0),
						eyeGap: pose.eyeGap !== void 0 ? pose.eyeGap : .27,
						bulge: pose.bulge || 0,
						squint,
						bodyColor: colorHex,
						eyeColor: 2236710
					};
					return {
						botId: 3,
						type: "bot3",
						label: res.label,
						bot,
						dots: []
					};
				}
				var BOT4_T_ROW = LOOP / 16;
				var pBot4Pose = function(yaw, eyeShiftX) {
					return {
						scale: 1,
						scaleX: 1,
						scaleY: 1,
						yaw,
						pitch: 0,
						roll: 0,
						eyeShiftX,
						eyeShiftY: 0,
						bulge: 0,
						jumpY: 0
					};
				};
				var bot4Keyframes = [{
					t: 0,
					label: "raster-0-right",
					pose: pBot4Pose(.26, .042)
				}];
				for (var k = 0; k < 16; k++) {
					var tBase = k * BOT4_T_ROW;
					var tSnapStart = tBase + .12;
					var tLeftLand = tBase + .24;
					var tLeftEnd = tBase + .52;
					var tCenterLand = tBase + .6;
					var tCenterEnd = tBase + .88;
					var tRightLand = tBase + .96;
					bot4Keyframes.push({
						t: tSnapStart,
						label: "raster-" + k + "-hold-right",
						ease: "linear",
						pose: pBot4Pose(.26, .042)
					});
					bot4Keyframes.push({
						t: tLeftLand,
						label: "raster-" + k + "-snap-left",
						ease: "easeInOutQuad",
						pose: pBot4Pose(-.26, -.042)
					});
					bot4Keyframes.push({
						t: tLeftEnd,
						label: "raster-" + k + "-hold-left",
						ease: "linear",
						pose: pBot4Pose(-.26, -.042)
					});
					bot4Keyframes.push({
						t: tCenterLand,
						label: "raster-" + k + "-step-center",
						ease: "easeInOutQuad",
						pose: pBot4Pose(0, 0)
					});
					bot4Keyframes.push({
						t: tCenterEnd,
						label: "raster-" + k + "-hold-center",
						ease: "linear",
						pose: pBot4Pose(0, 0)
					});
					bot4Keyframes.push({
						t: tRightLand,
						label: "raster-" + k + "-step-right",
						ease: "easeInOutQuad",
						pose: pBot4Pose(.26, .042)
					});
					if (k < 15) bot4Keyframes.push({
						t: (k + 1) * BOT4_T_ROW,
						label: "raster-" + (k + 1) + "-init",
						ease: "linear",
						pose: pBot4Pose(.26, .042)
					});
				}
				bot4Keyframes.push({
					t: LOOP,
					label: "raster-end",
					ease: "linear",
					pose: pBot4Pose(.26, .042)
				});
				var bot4Timeline = new PoseTimeline(bot4Keyframes);
				function getBot4State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot4Timeline.evaluate(t);
					var pose = res.pose;
					var bot = {
						visible: true,
						scale: pose.scale,
						scaleX: pose.scaleX,
						scaleY: pose.scaleY,
						x: 0,
						y: 0,
						yaw: pose.yaw,
						pitch: pose.pitch,
						roll: pose.roll,
						eyeShiftX: pose.eyeShiftX,
						eyeShiftY: pose.eyeShiftY,
						eyeScaleX: .96,
						eyeScaleY: .96,
						eyeGap: .22,
						bulge: 0,
						squint: 0,
						bodyColor: 2236710,
						eyeColor: 16777215
					};
					return {
						botId: 4,
						type: "bot4",
						label: res.label,
						bot,
						dots: []
					};
				}
				var bot5Timeline = new PoseTimeline([
					{
						t: 0,
						label: "tucked",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: false,
							scale: 0,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 2.22,
						label: "tucked",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: false,
							scale: 0,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 2.45,
						label: "bouncy-pop-spin",
						ease: "easeInOutQuad",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1.08,
							yaw: -Math.PI * .55,
							pitch: -.02,
							roll: .04,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: .06
						}
					},
					{
						t: 2.68,
						label: "bouncy-pop-spin",
						ease: "easeInOutQuad",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1.03,
							yaw: -Math.PI * 1.03,
							pitch: -.04,
							roll: .02,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: .02
						}
					},
					{
						t: 2.92,
						label: "spin-reappear",
						ease: "easeInOutQuad",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1,
							yaw: -Math.PI * 1.58,
							pitch: -.05,
							roll: -.03,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 3.06,
						label: "land-settle",
						ease: "easeOutCubic",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 3.28,
						label: "eye-bulge",
						ease: "easeInOutQuad",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 1,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 3.48,
						label: "look-right-settle",
						ease: "easeInOutQuad",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 3.64,
						label: "look-right-settle",
						ease: "linear",
						pose: {
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							visible: true,
							scale: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 3.94,
						label: "turn-to-lookup",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 - .78,
							pitch: -.21,
							roll: 0,
							eyeShiftX: -.1,
							eyeShiftY: .035,
							eyeScaleX: .95,
							eyeScaleY: .88,
							eyeGap: .22,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 4.28,
						label: "lookup-still-blink-2",
						ease: "linear",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 - .78,
							pitch: -.21,
							roll: 0,
							eyeShiftX: -.1,
							eyeShiftY: .035,
							eyeScaleX: .95,
							eyeScaleY: .88,
							eyeGap: .22,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 4.75,
						label: "transition-to-right",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 6.12,
						label: "look-right-curious",
						ease: "linear",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + .31,
							pitch: -.05,
							roll: -.05,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 6.24,
						label: "anticipation-squash",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1.16,
							scaleY: .85,
							yaw: -Math.PI * 2 + .28,
							pitch: -.02,
							roll: -.02,
							eyeShiftX: -.05,
							eyeShiftY: .025,
							eyeScaleX: 1.1,
							eyeScaleY: .88,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: -.035
						}
					},
					{
						t: 6.36,
						label: "anticipation-rebound",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + .35,
							pitch: -.04,
							roll: -.04,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: .02
						}
					},
					{
						t: 6.52,
						label: "exit-spin-right",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: .94,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + 1.45,
							pitch: -.03,
							roll: -.02,
							eyeShiftX: -.05,
							eyeShiftY: .035,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 6.72,
						label: "exit-spin-right",
						ease: "easeInOutQuad",
						pose: {
							visible: true,
							scale: .45,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + 2.55,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 6.88,
						label: "exit-spin-right",
						ease: "easeInOutQuad",
						pose: {
							visible: false,
							scale: 0,
							scaleX: 1,
							scaleY: 1,
							yaw: -Math.PI * 2 + 3.4,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					},
					{
						t: 20.783,
						label: "idle",
						ease: "linear",
						pose: {
							scaleX: 1,
							scaleY: 1,
							visible: false,
							scale: 0,
							yaw: -Math.PI * 2 + 3.4,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							eyeGap: .27,
							bulge: 0,
							squint: 0,
							jumpY: 0
						}
					}
				]);
				var bot5Blinks = new BlinkTrack([{
					start: 3.73,
					duration: .12,
					maxSquint: .95
				}, {
					start: 4.06,
					duration: .12,
					maxSquint: .95
				}]);
				var bot5Dots = new DotGridRig(38, 10.1);
				function getBot5State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot5Timeline.evaluate(t);
					var pose = res.pose;
					pose.squint = bot5Blinks.evaluate(t);
					pose.y = pose.jumpY || 0;
					if (t >= 4.75 && t < 6.12) pose.scale += Math.sin((t - 4.75) * 2.5) * .012;
					var dots = bot5Dots.evaluate(t, pose.scale, pose.visible);
					return {
						botId: 5,
						type: "bot5",
						label: res.label,
						dots,
						bot: {
							visible: pose.visible,
							scale: pose.scale,
							scaleX: pose.scaleX,
							scaleY: pose.scaleY,
							x: pose.x || 0,
							y: pose.y,
							yaw: pose.yaw,
							pitch: pose.pitch,
							roll: pose.roll,
							eyeShiftX: pose.eyeShiftX,
							eyeShiftY: pose.eyeShiftY,
							eyeScaleX: pose.eyeScaleX,
							eyeScaleY: pose.eyeScaleY,
							eyeGap: pose.eyeGap,
							bulge: pose.bulge,
							squint: pose.squint,
							bodyColor: 2236710,
							eyeColor: 16777215
						}
					};
				}
				var bot6Timeline = new PoseTimeline([
					{
						t: 0,
						label: "ghost-blink-1",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: .4,
						label: "giant-bulge-1-start",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .04,
							bulge: .6,
							jumpY: 0
						}
					},
					{
						t: .65,
						label: "giant-bulge-1-peak",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .08,
							bulge: 1.25,
							jumpY: 0
						}
					},
					{
						t: .95,
						label: "single-solid-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 2.4,
						label: "single-solid-1",
						ease: "linear",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 3.1,
						label: "lookup-left-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.42,
							pitch: -.04,
							roll: .02,
							eyeShiftX: -.06,
							eyeShiftY: .02,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 3.35,
						label: "squash-prep-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: .92,
							scaleX: 1.08,
							scaleY: .92,
							yaw: -.4,
							pitch: -.03,
							roll: .01,
							eyeShiftX: -.055,
							eyeShiftY: -.02,
							bulge: 0,
							jumpY: -.01
						}
					},
					{
						t: 3.65,
						label: "purple-solo-split-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 0,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: -.38,
							pitch: -.02,
							roll: -.03,
							eyeShiftX: -.05,
							eyeShiftY: .01,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 3.95,
						label: "look-right-prep",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 0,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: .38,
							pitch: -.02,
							roll: .02,
							eyeShiftX: .05,
							eyeShiftY: .01,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 4.2,
						label: "cyan-solo-split-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: .34,
							pitch: 0,
							roll: 0,
							eyeShiftX: .04,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 4.5,
						label: "triple-dance-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 7.4,
						label: "triple-dance-1",
						ease: "linear",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 7.8,
						label: "ghost-merge-1",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 8.5,
						label: "single-solid-1-end",
						ease: "linear",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 8.5,
						label: "ghost-blink-2",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 8.9,
						label: "giant-bulge-2-start",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .04,
							bulge: .6,
							jumpY: 0
						}
					},
					{
						t: 9.15,
						label: "giant-bulge-2-peak",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .08,
							bulge: 1.25,
							jumpY: 0
						}
					},
					{
						t: 9.45,
						label: "single-solid-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 10.9,
						label: "single-solid-2",
						ease: "linear",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 11.6,
						label: "lookup-left-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.42,
							pitch: -.04,
							roll: .02,
							eyeShiftX: -.06,
							eyeShiftY: .02,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 11.85,
						label: "squash-prep-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: .92,
							scaleX: 1.08,
							scaleY: .92,
							yaw: -.4,
							pitch: -.03,
							roll: .01,
							eyeShiftX: -.055,
							eyeShiftY: -.02,
							bulge: 0,
							jumpY: -.01
						}
					},
					{
						t: 12.15,
						label: "purple-solo-split-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 0,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: -.38,
							pitch: -.02,
							roll: -.03,
							eyeShiftX: -.05,
							eyeShiftY: .01,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 12.45,
						label: "look-right-prep-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 0,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: .38,
							pitch: -.02,
							roll: .02,
							eyeShiftX: .05,
							eyeShiftY: .01,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 12.7,
						label: "cyan-solo-split-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: .34,
							pitch: 0,
							roll: 0,
							eyeShiftX: .04,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 13,
						label: "triple-dance-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 15.9,
						label: "triple-dance-2",
						ease: "linear",
						pose: {
							splitL: 1,
							splitR: 1,
							scale: .46,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 16.3,
						label: "ghost-merge-2",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 17,
						label: "single-solid-2-end",
						ease: "linear",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 17,
						label: "ghost-blink-3",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 17.4,
						label: "giant-bulge-3-start",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .04,
							bulge: .6,
							jumpY: 0
						}
					},
					{
						t: 17.65,
						label: "giant-bulge-3-peak",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.05,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .08,
							bulge: 1.25,
							jumpY: 0
						}
					},
					{
						t: 17.95,
						label: "single-solid-3",
						ease: "easeInOutQuad",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					},
					{
						t: 20.783,
						label: "single-solid-3",
						ease: "linear",
						pose: {
							splitL: 0,
							splitR: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							bulge: 0,
							jumpY: 0
						}
					}
				]);
				var bot6Blinks = new BlinkTrack([
					{
						start: 0,
						duration: .25,
						maxSquint: 1
					},
					{
						start: 1.05,
						duration: .12,
						maxSquint: .95
					},
					{
						start: 2.7,
						duration: .12,
						maxSquint: .95
					},
					{
						start: 3.2,
						duration: .14,
						maxSquint: .95
					},
					{
						start: 8.5,
						duration: .25,
						maxSquint: 1
					},
					{
						start: 9.55,
						duration: .12,
						maxSquint: .95
					},
					{
						start: 11.2,
						duration: .12,
						maxSquint: .95
					},
					{
						start: 11.7,
						duration: .14,
						maxSquint: .95
					},
					{
						start: 17,
						duration: .25,
						maxSquint: 1
					},
					{
						start: 18.05,
						duration: .12,
						maxSquint: .95
					},
					{
						start: 19.5,
						duration: .12,
						maxSquint: .95
					}
				]);
				function getBot6State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot6Timeline.evaluate(t);
					var pose = res.pose;
					var squint = bot6Blinks.evaluate(t);
					var splitL = pose.splitL || 0;
					var splitR = pose.splitR || 0;
					var maxSplit = Math.max(splitL, splitR);
					var omegaV = 3.649 * Math.PI * 2;
					var omegaH = 1.82 * Math.PI * 2;
					var waveY = Math.sin(t * omegaV) * .015 * maxSplit;
					var waveYL = Math.sin((t + .12) * omegaV) * .015 * splitL;
					var waveYR = Math.sin((t - .12) * omegaV) * .015 * splitR;
					var swayXC = Math.sin(t * omegaH) * .022 * maxSplit;
					var swayXL = Math.sin((t + .12) * omegaH) * .022 * splitL;
					var swayXR = Math.sin((t - .12) * omegaH) * .022 * splitR;
					var centerShiftX = splitL > .01 && splitR < .5 ? .018 * splitL : splitR > .01 && splitL < .5 ? -.018 * splitR : 0;
					var sepDist = .258;
					var botCenter = {
						visible: true,
						scale: pose.scale,
						scaleX: pose.scaleX || 1,
						scaleY: pose.scaleY || 1,
						x: swayXC + centerShiftX,
						y: (pose.jumpY || 0) + waveY,
						yaw: pose.yaw || 0,
						pitch: pose.pitch || 0,
						roll: pose.roll || 0,
						eyeShiftX: pose.eyeShiftX || 0,
						eyeShiftY: pose.eyeShiftY || 0,
						eyeScaleX: 1,
						eyeScaleY: 1,
						eyeGap: .27,
						bulge: pose.bulge || 0,
						squint,
						bodyColor: 2236710,
						eyeColor: 16777215,
						splitL,
						splitR
					};
					var spawnXL = -(.11 + (sepDist - .11) * splitL);
					var ghostL = {
						visible: splitL > .01,
						scale: .46 * splitL,
						scaleX: 1,
						scaleY: 1,
						x: spawnXL + swayXL,
						y: waveYL,
						yaw: (pose.yaw || 0) * .5,
						pitch: (pose.pitch || 0) * .5,
						roll: (pose.roll || 0) * .5 - .03 * splitL,
						eyeShiftX: 0,
						eyeShiftY: 0,
						eyeScaleX: .85,
						eyeScaleY: .85,
						eyeGap: .27,
						bulge: 0,
						squint,
						bodyColor: 8530380,
						eyeColor: 15256570
					};
					var spawnXR = +(.11 + (sepDist - .11) * splitR);
					var ghostR = {
						visible: splitR > .01,
						scale: .46 * splitR,
						scaleX: 1,
						scaleY: 1,
						x: spawnXR + swayXR,
						y: waveYR,
						yaw: (pose.yaw || 0) * .5,
						pitch: (pose.pitch || 0) * .5,
						roll: (pose.roll || 0) * .5 + .03 * splitR,
						eyeShiftX: 0,
						eyeShiftY: 0,
						eyeScaleX: .85,
						eyeScaleY: .85,
						eyeGap: .27,
						bulge: 0,
						squint,
						bodyColor: 4711597,
						eyeColor: 11531740
					};
					return {
						botId: 6,
						type: "bot6",
						label: res.label,
						botCenter,
						ghostL,
						ghostR,
						splitL,
						splitR,
						dots: []
					};
				}
				var bot7Timeline = new PoseTimeline([
					{
						t: 0,
						label: "solid-upright",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: .2,
							bulge: 0,
							jumpY: 0,
							squint: .75,
							showEyes: true
						}
					},
					{
						t: .06,
						label: "loop-blink-open",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 1.3,
						label: "solid-idle-1",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 1.45,
						label: "curious-look-left-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.26,
							pitch: 0,
							roll: -.14,
							eyeShiftX: -.045,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 2,
						label: "curious-look-left-1",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.26,
							pitch: 0,
							roll: -.14,
							eyeShiftX: -.045,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 2.12,
						label: "squash-prep-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.05,
							scaleY: .95,
							yaw: 0,
							pitch: .01,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: -.01,
							eyeScaleX: 1.05,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: -.008,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 2.24,
						label: "anticipation-squash-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.22,
							scaleY: .78,
							yaw: 0,
							pitch: .02,
							roll: 0,
							eyeShiftX: -.015,
							eyeShiftY: -.025,
							eyeScaleX: 1.18,
							eyeScaleY: .75,
							bulge: 0,
							jumpY: -.024,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 2.4,
						label: "anticipation-stretch-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .96,
							scaleX: .88,
							scaleY: 1.18,
							yaw: 0,
							pitch: -.04,
							roll: .36,
							eyeShiftX: -.02,
							eyeShiftY: .035,
							eyeScaleX: .92,
							eyeScaleY: 1.12,
							bulge: 0,
							jumpY: .035,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 2.52,
						label: "collapse-shrink-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .65,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: .08,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: .95,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: .015,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 2.56,
						label: "collapse-core-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 2.8,
						label: "satellite-burst-1",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.04,
						label: "satellite-orbit-1",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.3,
						label: "suction-absorb-1",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: .72,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.02,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: -.005,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 7.46,
						label: "expand-shoot-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: .88,
							scaleY: 1.18,
							yaw: 0,
							pitch: -.03,
							roll: -.32,
							eyeShiftX: .02,
							eyeShiftY: .035,
							eyeScaleX: .95,
							eyeScaleY: 1.1,
							bulge: 0,
							jumpY: .035,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.6,
						label: "expand-land-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.12,
							scaleY: .9,
							yaw: 0,
							pitch: 0,
							roll: -.04,
							eyeShiftX: -.02,
							eyeShiftY: -.01,
							eyeScaleX: 1.05,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: -.014,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.72,
						label: "settle-left-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.12,
							pitch: 0,
							roll: 0,
							eyeShiftX: -.035,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.86,
						label: "sleepy-prep-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.02,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 7.98,
						label: "sleepy-slits-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.08,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: .88,
							eyeScaleY: .12,
							bulge: 0,
							jumpY: 0,
							squint: .95,
							showEyes: true
						}
					},
					{
						t: 8.06,
						label: "sleepy-slits-hold-1",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.08,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: .88,
							eyeScaleY: .12,
							bulge: 0,
							jumpY: 0,
							squint: .95,
							showEyes: true
						}
					},
					{
						t: 8.18,
						label: "curious-look-right-1",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 10,
						label: "curious-look-right-1",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 10.12,
						label: "squash-prep-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.06,
							scaleY: .94,
							yaw: .08,
							pitch: .01,
							roll: 0,
							eyeShiftX: .01,
							eyeShiftY: -.01,
							eyeScaleX: 1.05,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: -.008,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 10.23,
						label: "anticipation-squash-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.22,
							scaleY: .78,
							yaw: 0,
							pitch: .02,
							roll: 0,
							eyeShiftX: -.015,
							eyeShiftY: -.025,
							eyeScaleX: 1.18,
							eyeScaleY: .75,
							bulge: 0,
							jumpY: -.024,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 10.4,
						label: "anticipation-stretch-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .96,
							scaleX: .88,
							scaleY: 1.18,
							yaw: 0,
							pitch: -.04,
							roll: .36,
							eyeShiftX: -.02,
							eyeShiftY: .035,
							eyeScaleX: .92,
							eyeScaleY: 1.12,
							bulge: 0,
							jumpY: .035,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 10.52,
						label: "collapse-shrink-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .65,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: .08,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: .95,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: .015,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 10.56,
						label: "collapse-core-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 10.8,
						label: "satellite-burst-2",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.04,
						label: "satellite-orbit-2",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.3,
						label: "suction-absorb-2",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: .72,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.02,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: -.005,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 15.46,
						label: "expand-shoot-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: .88,
							scaleY: 1.18,
							yaw: 0,
							pitch: -.03,
							roll: -.32,
							eyeShiftX: .02,
							eyeShiftY: .035,
							eyeScaleX: .95,
							eyeScaleY: 1.1,
							bulge: 0,
							jumpY: .035,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.62,
						label: "expand-land-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.12,
							scaleY: .9,
							yaw: 0,
							pitch: 0,
							roll: -.04,
							eyeShiftX: -.02,
							eyeShiftY: -.01,
							eyeScaleX: 1.05,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: -.014,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.72,
						label: "settle-left-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: -.12,
							pitch: 0,
							roll: 0,
							eyeShiftX: -.035,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.86,
						label: "sleepy-prep-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.02,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 15.98,
						label: "sleepy-slits-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.08,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: .88,
							eyeScaleY: .12,
							bulge: 0,
							jumpY: 0,
							squint: .95,
							showEyes: true
						}
					},
					{
						t: 16.06,
						label: "sleepy-slits-hold-2",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: -.08,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: .88,
							eyeScaleY: .12,
							bulge: 0,
							jumpY: 0,
							squint: .95,
							showEyes: true
						}
					},
					{
						t: 16.18,
						label: "curious-look-right-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 16.24,
						label: "glance-blink-prep-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 16.32,
						label: "glance-blink-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: .12,
							bulge: 0,
							jumpY: 0,
							squint: .85,
							showEyes: true
						}
					},
					{
						t: 16.4,
						label: "glance-blink-open-2",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 17.8,
						label: "curious-look-right-2",
						ease: "linear",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1,
							scaleY: 1,
							yaw: .32,
							pitch: -.04,
							roll: .02,
							eyeShiftX: .048,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 18.12,
						label: "squash-prep-3",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.06,
							scaleY: .94,
							yaw: .28,
							pitch: .01,
							roll: 0,
							eyeShiftX: .042,
							eyeShiftY: -.01,
							eyeScaleX: 1.05,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: -.008,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 18.22,
						label: "anticipation-squash-3",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: 1,
							scaleX: 1.22,
							scaleY: .78,
							yaw: .22,
							pitch: .02,
							roll: 0,
							eyeShiftX: .04,
							eyeShiftY: -.025,
							eyeScaleX: 1.18,
							eyeScaleY: .75,
							bulge: 0,
							jumpY: -.024,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 18.38,
						label: "anticipation-stretch-3",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .96,
							scaleX: .88,
							scaleY: 1.18,
							yaw: 0,
							pitch: -.04,
							roll: .36,
							eyeShiftX: -.02,
							eyeShiftY: .035,
							eyeScaleX: .92,
							eyeScaleY: 1.12,
							bulge: 0,
							jumpY: .035,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 18.5,
						label: "collapse-shrink-3",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .65,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: .08,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: .95,
							eyeScaleY: .95,
							bulge: 0,
							jumpY: .015,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 18.56,
						label: "collapse-core-3",
						ease: "easeInOutQuad",
						pose: {
							ringExpand: 0,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: 0,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: 0,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: false
						}
					},
					{
						t: 18.8,
						label: "satellite-burst-3",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					},
					{
						t: 20.783,
						label: "satellite-orbit-3",
						ease: "linear",
						pose: {
							ringExpand: 1,
							scale: .52,
							scaleX: 1,
							scaleY: 1,
							yaw: 0,
							pitch: -.02,
							roll: 0,
							eyeShiftX: 0,
							eyeShiftY: .01,
							eyeScaleX: 1,
							eyeScaleY: 1,
							bulge: 0,
							jumpY: 0,
							squint: 0,
							showEyes: true
						}
					}
				]);
				var SATELLITE_RING_OFFSETS = [
					{
						x: 0,
						y: -46
					},
					{
						x: 45.4,
						y: -46
					},
					{
						x: 45.4,
						y: 0
					},
					{
						x: 45.4,
						y: 46
					},
					{
						x: 0,
						y: 46
					},
					{
						x: -45.4,
						y: 46
					},
					{
						x: -45.4,
						y: 0
					},
					{
						x: -45.4,
						y: -46
					}
				];
				var ORBIT_PERIOD = 3.6;
				var CAM_YAW_AMP = .45;
				var CAM_PITCH_AMP = .35;
				var CAM_PITCH_NEUTRAL = -.1;
				var CAM_AZIMUTH_OFFSET = -.118;
				var CAM_ELEVATION_OFFSET = .146;
				function getBot7State(time) {
					var t = (time % LOOP + LOOP) % LOOP;
					var res = bot7Timeline.evaluate(t);
					var pose = res.pose;
					var ringExpand = pose.ringExpand;
					var tOrbitStart = 3.2;
					if (t >= 17) tOrbitStart = 19.2;
					else if (t >= 9) tOrbitStart = 11.2;
					var tOrbit = ((t - tOrbitStart) % ORBIT_PERIOD + ORBIT_PERIOD) % ORBIT_PERIOD;
					var waveAngle = -(tOrbit / ORBIT_PERIOD) * Math.PI * 2 - Math.PI / 2;
					var targetDirX = Math.cos(waveAngle);
					var targetDirY = Math.sin(waveAngle);
					var camYaw = targetDirX * CAM_YAW_AMP * ringExpand;
					var camPitch = (CAM_PITCH_NEUTRAL - targetDirY * CAM_PITCH_AMP) * ringExpand;
					var trackingYaw = camYaw + CAM_AZIMUTH_OFFSET * ringExpand;
					var trackingPitch = camPitch - CAM_ELEVATION_OFFSET * ringExpand;
					var hoverY = Math.sin(tOrbit / ORBIT_PERIOD * 2 * Math.PI) * .006 * ringExpand;
					var hoverYPx = hoverY * 500;
					var dynamicRoll = targetDirX * .04 * ringExpand;
					var dots = [];
					if (ringExpand > .001) {
						var dotDist = (35 + 10.4 * ringExpand) / 45.4;
						for (var i = 0; i < 8; i++) {
							var off = SATELLITE_RING_OFFSETS[i];
							var dotAngle = Math.atan2(-off.y, off.x);
							var diff = Math.cos(waveAngle - dotAngle);
							var r = ringExpand * (7 + Math.pow(Math.max(0, diff), 6) * 4.5);
							dots.push({
								x: off.x * dotDist,
								y: off.y * dotDist - hoverYPx,
								r,
								visible: true
							});
						}
					}
					var bot = {
						visible: true,
						scale: pose.scale,
						scaleX: pose.scaleX,
						scaleY: pose.scaleY,
						x: 0,
						y: (pose.jumpY || 0) + hoverY,
						yaw: (pose.yaw || 0) + trackingYaw,
						pitch: (pose.pitch || 0) + trackingPitch,
						roll: (pose.roll || 0) + dynamicRoll,
						eyeShiftX: pose.eyeShiftX || 0,
						eyeShiftY: pose.eyeShiftY || 0,
						eyeScaleX: pose.eyeScaleX,
						eyeScaleY: pose.eyeScaleY,
						eyeGap: .27,
						bulge: pose.bulge,
						squint: pose.squint || 0,
						showEyes: pose.showEyes !== false,
						bodyColor: 2236710,
						eyeColor: 16777215
					};
					return {
						botId: 7,
						type: "bot7",
						label: res.label,
						bot,
						dots
					};
				}
				var BOTS = [
					{
						id: 1,
						key: "sentry",
						name: "Sentry",
						title: "哨兵",
						desc: "逐行专注扫读、机灵侧倾 (代码审视/终端监控)",
						stateFn: getBot1State
					},
					{
						id: 2,
						key: "attitude",
						name: "Attitude",
						title: "傲娇小怪",
						desc: "3D后空翻、单侧挑眉与犀利聚焦 (AI拟人化助手/成功反馈)",
						stateFn: getBot2State
					},
					{
						id: 3,
						key: "chameleon",
						name: "Chameleon",
						title: "动感变色龙",
						desc: "240bpm 高频街舞摇摆、12色轮转 (音乐播放器/动感加载)",
						stateFn: getBot3State
					},
					{
						id: 4,
						key: "observer",
						name: "Observer",
						title: "屏读观察者",
						desc: "纯水平左-中-右栅格阅读扫读 (屏幕扫描/数据同步)",
						stateFn: getBot4State
					},
					{
						id: 5,
						key: "cube",
						name: "Cube & Grid",
						title: "方块与点阵",
						desc: "3x3呼吸点阵破土自旋跳跃、大眼暴胀 (启动/生成态/弹窗)",
						stateFn: getBot5State
					},
					{
						id: 6,
						key: "ghost",
						name: "Ghost Trail",
						title: "幽灵分身",
						desc: "身后诞生紫青双分身、蛇形浮游共舞 (多线程运算/集群协同)",
						stateFn: getBot6State
					},
					{
						id: 7,
						key: "satellite",
						name: "Satellite",
						title: "环绕卫星",
						desc: "核心塌陷蓄力、8卫星逆时针公转与3D注视 (网络加载/能量缓冲)",
						stateFn: getBot7State
					}
				];
				function resolveBotId(idOrKey) {
					if (typeof idOrKey === "number") return idOrKey;
					if (typeof idOrKey === "string") {
						var lower = idOrKey.toLowerCase().trim();
						var num = parseInt(lower.replace("#", ""), 10);
						if (!isNaN(num) && num >= 1 && num <= 7) return num;
						for (var i = 0; i < BOTS.length; i++) if (BOTS[i].key === lower || BOTS[i].name.toLowerCase() === lower) return BOTS[i].id;
					}
					return 1;
				}
				function getBotState(botId, time) {
					switch (resolveBotId(botId)) {
						case 1: return getBot1State(time);
						case 2: return getBot2State(time);
						case 3: return getBot3State(time);
						case 4: return getBot4State(time);
						case 5: return getBot5State(time);
						case 6: return getBot6State(time);
						case 7: return getBot7State(time);
						default: return getBot1State(time);
					}
				}
				var stageCounter = 0;
				function mount(container, options) {
					if (!container) throw new Error("[OpenBotMotion] mount requires a valid DOM element.");
					options = options || {};
					var activeBotId = resolveBotId(options.bot !== void 0 ? options.bot : 1);
					var size = options.size !== void 0 ? options.size : 280;
					var autoplay = options.autoplay !== void 0 ? options.autoplay : true;
					var loop = options.loop !== void 0 ? options.loop : true;
					var speed = options.speed !== void 0 ? options.speed : 1;
					var onFrame = typeof options.onFrame === "function" ? options.onFrame : null;
					container.innerHTML = "";
					var uid = ++stageCounter;
					var svgNS = "http://www.w3.org/2000/svg";
					var svg = document.createElementNS(svgNS, "svg");
					svg.setAttribute("class", "open-bot-motion-svg");
					svg.setAttribute("viewBox", "-140 -140 280 280");
					svg.setAttribute("width", typeof size === "number" ? size + "px" : size);
					svg.setAttribute("height", typeof size === "number" ? size + "px" : size);
					svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
					container.appendChild(svg);
					var defs = document.createElementNS(svgNS, "defs");
					svg.appendChild(defs);
					var filter = document.createElementNS(svgNS, "filter");
					filter.setAttribute("id", "obm-gooey-" + uid);
					filter.setAttribute("x", "-50%");
					filter.setAttribute("y", "-50%");
					filter.setAttribute("width", "200%");
					filter.setAttribute("height", "200%");
					filter.innerHTML = "<feGaussianBlur in=\"SourceGraphic\" stdDeviation=\"5.5\" result=\"blur\" /><feColorMatrix in=\"blur\" mode=\"matrix\" values=\"1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7\" result=\"goo\" /><feComposite in=\"SourceGraphic\" in2=\"goo\" operator=\"atop\" />";
					defs.appendChild(filter);
					function createClipDef(clipId, pathId) {
						var cp = document.createElementNS(svgNS, "clipPath");
						cp.setAttribute("id", clipId);
						var p = document.createElementNS(svgNS, "path");
						p.setAttribute("id", pathId);
						cp.appendChild(p);
						defs.appendChild(cp);
						return p;
					}
					var clipPathCenter = createClipDef("obm-clip-center-" + uid, "obm-cpp-center-" + uid);
					var clipPathGhostL = createClipDef("obm-clip-ghostL-" + uid, "obm-cpp-ghostL-" + uid);
					var clipPathGhostR = createClipDef("obm-clip-ghostR-" + uid, "obm-cpp-ghostR-" + uid);
					var dotsLayer = document.createElementNS(svgNS, "g");
					dotsLayer.setAttribute("class", "dots-layer");
					svg.appendChild(dotsLayer);
					var botLayer = document.createElementNS(svgNS, "g");
					botLayer.setAttribute("class", "bot-layer");
					svg.appendChild(botLayer);
					var bodiesLayer = document.createElementNS(svgNS, "g");
					bodiesLayer.setAttribute("class", "bodies-layer");
					botLayer.appendChild(bodiesLayer);
					var eyesLayer = document.createElementNS(svgNS, "g");
					eyesLayer.setAttribute("class", "eyes-layer");
					botLayer.appendChild(eyesLayer);
					function createBotNode(clipId, defaultColor) {
						var bodyPath = document.createElementNS(svgNS, "path");
						bodyPath.setAttribute("fill", defaultColor);
						bodiesLayer.appendChild(bodyPath);
						var eyesGroup = document.createElementNS(svgNS, "g");
						eyesGroup.setAttribute("clip-path", "url(#" + clipId + ")");
						var eyeL = document.createElementNS(svgNS, "rect");
						eyeL.setAttribute("fill", "#ffffff");
						var eyeR = document.createElementNS(svgNS, "rect");
						eyeR.setAttribute("fill", "#ffffff");
						eyesGroup.appendChild(eyeL);
						eyesGroup.appendChild(eyeR);
						eyesLayer.appendChild(eyesGroup);
						return {
							bodyPath,
							eyesGroup,
							eyeL,
							eyeR,
							defaultColor
						};
					}
					var ghostLNode = createBotNode("obm-clip-ghostL-" + uid, "#8229cc");
					var ghostRNode = createBotNode("obm-clip-ghostR-" + uid, "#47e4ad");
					var centerNode = createBotNode("obm-clip-center-" + uid, CHARCOAL);
					var projector = new SvgProjector({ viewportSize: 280 });
					function colorToCss(c, def) {
						if (!c) return def;
						if (typeof c === "number") return "#" + c.toString(16).padStart(6, "0");
						return c;
					}
					function applyPose(node, clipPathEl, pose) {
						if (!node || !pose || pose.visible === false || pose.scale !== void 0 && pose.scale <= .001) {
							if (node && node.bodyPath) node.bodyPath.style.display = "none";
							if (node && node.eyesGroup) node.eyesGroup.style.display = "none";
							if (clipPathEl) clipPathEl.setAttribute("d", "");
							return;
						}
						node.bodyPath.style.display = "";
						var res = projector.projectRoundedCube(pose);
						if (!res.visible || !res.bodyPath) {
							node.bodyPath.style.display = "none";
							node.eyesGroup.style.display = "none";
							if (clipPathEl) clipPathEl.setAttribute("d", "");
							return;
						}
						node.bodyPath.setAttribute("d", res.bodyPath);
						if (clipPathEl) clipPathEl.setAttribute("d", res.bodyPath);
						var bodyFill = colorToCss(pose.bodyColor, node.defaultColor);
						var eyeFill = colorToCss(pose.eyeColor, "#ffffff");
						node.bodyPath.setAttribute("fill", bodyFill);
						if (res.eyes && res.eyes.length > 0) {
							node.eyesGroup.style.display = "";
							while (node.eyesGroup.children.length < res.eyes.length) node.eyesGroup.appendChild(document.createElementNS(svgNS, "rect"));
							while (node.eyesGroup.children.length > res.eyes.length) node.eyesGroup.removeChild(node.eyesGroup.lastChild);
							for (var i = 0; i < res.eyes.length; i++) {
								var d = res.eyes[i];
								var rectEl = node.eyesGroup.children[i];
								rectEl.setAttribute("x", (-d.w / 2).toFixed(2));
								rectEl.setAttribute("y", (-d.h / 2).toFixed(2));
								rectEl.setAttribute("width", d.w.toFixed(2));
								rectEl.setAttribute("height", d.h.toFixed(2));
								rectEl.setAttribute("rx", d.rx.toFixed(2));
								rectEl.setAttribute("ry", d.ry.toFixed(2));
								rectEl.setAttribute("transform", "translate(" + d.cx.toFixed(2) + ", " + d.cy.toFixed(2) + ") rotate(" + d.angle.toFixed(2) + ")");
								rectEl.setAttribute("opacity", (d.opacity !== void 0 ? d.opacity : 1).toFixed(2));
								rectEl.setAttribute("fill", colorToCss(d.color, eyeFill));
							}
						} else node.eyesGroup.style.display = "none";
					}
					function renderFrame(time) {
						var st = getBotState(activeBotId, time);
						if (activeBotId === 7 && svg.lastElementChild !== dotsLayer) svg.appendChild(dotsLayer);
						else if (activeBotId !== 7 && svg.firstElementChild !== dotsLayer) svg.insertBefore(dotsLayer, botLayer);
						if (st && st.dots && st.dots.length > 0) {
							dotsLayer.style.display = "";
							while (dotsLayer.children.length < st.dots.length) dotsLayer.appendChild(document.createElementNS(svgNS, "circle"));
							while (dotsLayer.children.length > st.dots.length) dotsLayer.removeChild(dotsLayer.lastElementChild);
							for (var di = 0; di < st.dots.length; di++) {
								var dot = st.dots[di];
								var cEl = dotsLayer.children[di];
								if (!dot || !dot.visible || dot.r <= .1) cEl.style.display = "none";
								else {
									cEl.style.display = "";
									cEl.setAttribute("cx", dot.x.toFixed(2));
									cEl.setAttribute("cy", dot.y.toFixed(2));
									cEl.setAttribute("r", dot.r.toFixed(2));
									cEl.setAttribute("fill", CHARCOAL);
								}
							}
						} else dotsLayer.style.display = "none";
						if (activeBotId === 6) {
							applyPose(ghostLNode, clipPathGhostL, st.ghostL);
							applyPose(ghostRNode, clipPathGhostR, st.ghostR);
							applyPose(centerNode, clipPathCenter, st.botCenter);
							var maxSplit = Math.max(st.splitL !== void 0 ? st.splitL : st.botCenter && st.botCenter.splitL || 0, st.splitR !== void 0 ? st.splitR : st.botCenter && st.botCenter.splitR || 0);
							if (maxSplit > .08 && maxSplit < .92) bodiesLayer.setAttribute("filter", "url(#obm-gooey-" + uid + ")");
							else bodiesLayer.removeAttribute("filter");
						} else {
							ghostLNode.bodyPath.style.display = "none";
							ghostLNode.eyesGroup.style.display = "none";
							ghostRNode.bodyPath.style.display = "none";
							ghostRNode.eyesGroup.style.display = "none";
							bodiesLayer.removeAttribute("filter");
							if (centerNode && st && st.bot) applyPose(centerNode, clipPathCenter, st.bot);
						}
						if (onFrame) onFrame(time, st.label, st);
					}
					var currentTime = 0;
					var isPlaying = autoplay;
					var lastTimestamp = null;
					var rafId = null;
					function tick(timestamp) {
						if (!lastTimestamp) lastTimestamp = timestamp;
						var dt = (timestamp - lastTimestamp) / 1e3;
						lastTimestamp = timestamp;
						if (isPlaying) {
							currentTime += dt * speed;
							if (loop) currentTime = (currentTime % LOOP + LOOP) % LOOP;
							else if (currentTime >= LOOP) {
								currentTime = LOOP;
								isPlaying = false;
							}
						}
						renderFrame(currentTime);
						if (isPlaying || loop) rafId = requestAnimationFrame(tick);
					}
					renderFrame(0);
					if (autoplay) rafId = requestAnimationFrame(tick);
					return {
						play: function() {
							if (!isPlaying) {
								isPlaying = true;
								lastTimestamp = null;
								rafId = requestAnimationFrame(tick);
							}
						},
						pause: function() {
							isPlaying = false;
							if (rafId) cancelAnimationFrame(rafId);
						},
						seek: function(t) {
							currentTime = clamp(t, 0, LOOP);
							renderFrame(currentTime);
						},
						setBot: function(idOrKey) {
							activeBotId = resolveBotId(idOrKey);
							renderFrame(currentTime);
						},
						setSpeed: function(s) {
							speed = Math.max(.01, s);
						},
						setSize: function(newSize) {
							size = newSize;
							svg.setAttribute("width", typeof size === "number" ? size + "px" : size);
							svg.setAttribute("height", typeof size === "number" ? size + "px" : size);
						},
						getBotId: function() {
							return activeBotId;
						},
						getTime: function() {
							return currentTime;
						},
						isPlaying: function() {
							return isPlaying;
						},
						destroy: function() {
							if (rafId) cancelAnimationFrame(rafId);
							container.innerHTML = "";
						}
					};
				}
				return {
					version: "1.0.0",
					LOOP,
					BOTS,
					Easings,
					PoseTimeline,
					BlinkTrack,
					DotGridRig,
					SvgProjector,
					resolveBotId,
					getBotState,
					getBot1State,
					getBot2State,
					getBot3State,
					getBot4State,
					getBot5State,
					getBot6State,
					getBot7State,
					mount
				};
			});
		})))(), 1);
		const NS = "http://www.w3.org/2000/svg";
		let nextClip = 0;
		const clipPrefix = Math.random().toString(36).slice(2);
		const element = (tag) => document.createElementNS(NS, tag);
		const orbitTime = (seconds) => seconds < .8 ? 2 + seconds : 2.8 + (seconds - .8) % 3.6;
		function settleFrame(from, amount) {
			const bot = { ...import_open_bot_motion.default.getBot7State(0).bot };
			const t = 1 - (1 - amount) ** 3;
			for (const key of Object.keys(bot)) if (typeof bot[key] === "number" && typeof from.bot[key] === "number") bot[key] = from.bot[key] * (1 - t) + bot[key] * t;
			return {
				bot,
				dots: from.dots.map((dot) => ({
					...dot,
					x: dot.x * (1 - t),
					y: dot.y * (1 - t),
					r: dot.r * (1 - t)
				}))
			};
		}
		/** Owns one SVG and one clock. Hidden/reduced-motion pages consume no frames. */
		var Satellite = class {
			svg = element("svg");
			projector = new import_open_bot_motion.default.SvgProjector({ viewportSize: 280 });
			body = element("path");
			clipBody = element("path");
			eyes = element("g");
			dots = Array.from({ length: 8 }, () => element("circle"));
			frame;
			elapsed = 0;
			lastTime = 0;
			settling = 0;
			mode = "rest";
			current = import_open_bot_motion.default.getBot7State(0);
			exitFrom = this.current;
			reduced = matchMedia("(prefers-reduced-motion: reduce)");
			disposed = false;
			done;
			constructor(host) {
				this.svg.setAttribute("viewBox", "-76 -76 152 152");
				this.svg.setAttribute("aria-hidden", "true");
				this.svg.classList.add("dsh-cs-robot");
				const defs = element("defs"), clip = element("clipPath");
				const id = `dsh-cs-bot-${clipPrefix}-${nextClip++}`;
				clip.id = id;
				clip.append(this.clipBody);
				defs.append(clip);
				this.eyes.setAttribute("clip-path", `url(#${id})`);
				this.body.classList.add("dsh-cs-body");
				this.eyes.classList.add("dsh-cs-eyes");
				this.dots.forEach((dot) => dot.classList.add("dsh-cs-dot"));
				this.svg.append(defs, this.body, this.eyes, ...this.dots);
				host.append(this.svg);
				this.render(this.current);
				document.addEventListener("visibilitychange", this.wake);
				this.reduced.addEventListener("change", this.wake);
			}
			setRunning(running, done) {
				if (running) {
					if (this.mode === "run") return;
					this.mode = "run";
					this.elapsed = 0;
					this.done = void 0;
				} else if (this.mode === "run") {
					this.exitFrom = this.current;
					this.mode = "settle";
					this.settling = 0;
					this.done = done;
				} else if (this.mode === "settle") {
					this.done = done;
					return;
				} else done?.();
				this.wake();
			}
			wake = () => {
				if (this.frame !== void 0) cancelAnimationFrame(this.frame);
				this.frame = void 0;
				this.lastTime = 0;
				if (this.disposed) return;
				if (this.reduced.matches || document.hidden) {
					if (this.mode === "settle") this.finish();
					else if (this.reduced.matches) this.render(import_open_bot_motion.default.getBot7State(0));
					return;
				}
				if (this.mode !== "rest") this.frame = requestAnimationFrame(this.tick);
			};
			finish() {
				this.mode = "rest";
				this.render(import_open_bot_motion.default.getBot7State(0));
				const done = this.done;
				this.done = void 0;
				done?.();
			}
			tick = (now) => {
				this.frame = void 0;
				if (this.disposed) return;
				if (!this.lastTime) this.lastTime = now;
				const delta = (now - this.lastTime) / 1e3;
				if (delta >= 1 / 30) {
					this.lastTime = now;
					if (this.mode === "run") {
						this.elapsed += delta;
						this.render(import_open_bot_motion.default.getBot7State(orbitTime(this.elapsed)));
					}
					if (this.mode === "settle") {
						this.settling += delta;
						if (this.settling >= .32) this.finish();
						else this.render(settleFrame(this.exitFrom, this.settling / .32));
					}
				}
				if (this.mode !== "rest") this.frame = requestAnimationFrame(this.tick);
			};
			render(state) {
				this.current = state;
				const projected = this.projector.projectRoundedCube(state.bot);
				this.body.setAttribute("d", projected.bodyPath);
				this.clipBody.setAttribute("d", projected.bodyPath);
				const eyes = state.bot.showEyes === false ? [] : projected.eyes;
				while (this.eyes.children.length > eyes.length) this.eyes.lastChild.remove();
				while (this.eyes.children.length < eyes.length) this.eyes.append(element("rect"));
				eyes.forEach((eye, index) => {
					const node = this.eyes.children[index];
					for (const [key, value] of Object.entries({
						x: -eye.w / 2,
						y: -eye.h / 2,
						width: eye.w,
						height: eye.h,
						rx: eye.rx,
						ry: eye.ry,
						opacity: eye.opacity ?? 1
					})) node.setAttribute(key, value.toFixed(2));
					node.setAttribute("transform", `translate(${eye.cx.toFixed(2)} ${eye.cy.toFixed(2)}) rotate(${eye.angle.toFixed(2)})`);
				});
				this.dots.forEach((node, index) => {
					const dot = state.dots[index];
					node.setAttribute("r", dot?.visible ? dot.r.toFixed(2) : "0");
					if (dot) {
						node.setAttribute("cx", dot.x.toFixed(2));
						node.setAttribute("cy", dot.y.toFixed(2));
					}
				});
			}
			destroy() {
				this.disposed = true;
				if (this.frame !== void 0) cancelAnimationFrame(this.frame);
				document.removeEventListener("visibilitychange", this.wake);
				this.reduced.removeEventListener("change", this.wake);
				this.svg.remove();
				this.done = void 0;
			}
		};
		/** Enhance only the existing context button; native short click and keys survive. */
		var RingControl = class {
			button;
			activate;
			host = document.createElement("span");
			bot;
			timer;
			pointer;
			suppressedUntil = 0;
			phase = "idle";
			available = false;
			disposed = false;
			previousTitle;
			lastTitle = "";
			native;
			constructor(button, activate) {
				this.button = button;
				this.activate = activate;
				this.previousTitle = button.getAttribute("title");
				this.host.className = "dsh-cs-ring-art";
				this.host.setAttribute("aria-hidden", "true");
				this.host.innerHTML = "<svg class=\"dsh-cs-hold\" viewBox=\"0 0 32 32\"><circle cx=\"16\" cy=\"16\" r=\"14\" pathLength=\"1\"/></svg>";
				this.bot = new Satellite(this.host);
				button.append(this.host);
				button.classList.add("dsh-cs-ring");
				button.addEventListener("pointerdown", this.down);
				button.addEventListener("pointerleave", this.cancel);
				button.addEventListener("pointercancel", this.cancel);
				button.addEventListener("contextmenu", this.context);
				button.addEventListener("click", this.click, true);
				window.addEventListener("pointerup", this.up, true);
				window.addEventListener("pointermove", this.move, true);
				window.addEventListener("pointerdown", this.anotherPointer, true);
				window.addEventListener("blur", this.cancel);
				document.addEventListener("visibilitychange", this.cancel);
			}
			update(phase, available) {
				this.available = available;
				this.button.classList.add("dsh-cs-ring");
				if (this.host.parentElement !== this.button) this.button.append(this.host);
				if (this.button.dataset.csPhase !== phase) this.button.dataset.csPhase = phase;
				this.showMeter(![
					"sending",
					"queued",
					"running"
				].includes(phase));
				if (this.phase !== phase) {
					this.phase = phase;
					if (phase === "running") {
						this.button.dataset.csMotion = "running";
						this.bot.setRunning(true);
					} else if (phase === "queued" || phase === "sending") {
						this.button.dataset.csMotion = "queued";
						this.bot.setRunning(false);
					} else {
						this.button.dataset.csMotion = "settling";
						this.bot.setRunning(false, () => {
							if (!this.disposed) delete this.button.dataset.csMotion;
						});
					}
				}
				const title = phase === "running" ? "正在压缩上下文 · 点击查看进度" : phase === "queued" || phase === "sending" ? "压缩已排队 · 点击查看进度" : "点击查看上下文 · 长按压缩";
				if (this.button.title !== title) this.button.title = title;
				this.lastTitle = title;
				if (!this.canHold()) this.cancel();
			}
			restoreMeter() {
				if (!this.native) return;
				for (const [key, field] of this.native.fields) {
					if (this.native.element.style.getPropertyValue(key) !== field.last || this.native.element.style.getPropertyPriority(key) !== field.lastPriority) continue;
					if (field.before) this.native.element.style.setProperty(key, field.before, field.priority);
					else this.native.element.style.removeProperty(key);
				}
				this.native = void 0;
			}
			showMeter(visible) {
				const element = this.button.querySelector("svg[viewBox=\"0 0 14 14\"]");
				if (this.native?.element !== element) {
					this.restoreMeter();
					if (element) this.native = {
						element,
						fields: /* @__PURE__ */ new Map()
					};
				}
				if (!this.native) return;
				const iconBox = this.native.element.getBoundingClientRect(), buttonBox = this.button.getBoundingClientRect();
				const position = {
					left: `${iconBox.left - buttonBox.left - 3}px`,
					top: `${iconBox.top - buttonBox.top - 3}px`,
					width: `${iconBox.width + 6}px`,
					height: `${iconBox.height + 6}px`
				};
				for (const [key, value] of Object.entries(position)) if (this.host.style.getPropertyValue(key) !== value) this.host.style.setProperty(key, value);
				for (const [key, value] of [["visibility", "visible"], ["opacity", visible ? "1" : "0"]]) {
					const style = this.native.element.style;
					let field = this.native.fields.get(key);
					if (!field || style.getPropertyValue(key) !== field.last || style.getPropertyPriority(key) !== field.lastPriority) {
						field = {
							before: style.getPropertyValue(key),
							priority: style.getPropertyPriority(key),
							last: value,
							lastPriority: ""
						};
						this.native.fields.set(key, field);
					}
					if (style.getPropertyValue(key) !== value) style.setProperty(key, value);
					field.last = value;
					field.lastPriority = style.getPropertyPriority(key);
				}
			}
			canHold() {
				return this.available && ![
					"sending",
					"queued",
					"running"
				].includes(this.phase);
			}
			down = (event) => {
				this.suppressedUntil = 0;
				if (!event.isPrimary || event.button !== 0 || !this.canHold()) return;
				this.cancel();
				this.pointer = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY
				};
				this.button.dataset.csHolding = "true";
				this.timer = setTimeout(() => {
					if (!this.pointer || !this.canHold() || !this.button.isConnected) {
						this.cancel();
						return;
					}
					this.cancel();
					this.suppressedUntil = Infinity;
					if (this.button.getAttribute("aria-expanded") !== "true") this.button.click();
					this.activate();
				}, 650);
			};
			anotherPointer = (event) => {
				if (this.pointer && this.pointer.id !== event.pointerId) this.cancel();
			};
			move = (event) => {
				if (this.pointer?.id === event.pointerId && Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) > 10) this.cancel();
			};
			up = (event) => {
				if (this.pointer?.id === event.pointerId) this.cancel();
				if (this.suppressedUntil === Infinity) this.suppressedUntil = performance.now() + 700;
			};
			context = (event) => {
				if (this.pointer || performance.now() < this.suppressedUntil) event.preventDefault();
			};
			click = (event) => {
				if (event.detail !== 0 && performance.now() < this.suppressedUntil) {
					event.preventDefault();
					event.stopImmediatePropagation();
				}
			};
			cancel = () => {
				clearTimeout(this.timer);
				this.timer = void 0;
				this.pointer = void 0;
				delete this.button.dataset.csHolding;
			};
			destroy() {
				this.disposed = true;
				this.cancel();
				this.bot.destroy();
				this.host.remove();
				this.button.classList.remove("dsh-cs-ring");
				delete this.button.dataset.csMotion;
				delete this.button.dataset.csPhase;
				this.restoreMeter();
				if (this.button.title === this.lastTitle) {
					if (this.previousTitle === null) this.button.removeAttribute("title");
					else this.button.title = this.previousTitle;
				}
				this.button.removeEventListener("pointerdown", this.down);
				this.button.removeEventListener("pointerleave", this.cancel);
				this.button.removeEventListener("pointercancel", this.cancel);
				this.button.removeEventListener("contextmenu", this.context);
				this.button.removeEventListener("click", this.click, true);
				window.removeEventListener("pointerup", this.up, true);
				window.removeEventListener("pointermove", this.move, true);
				window.removeEventListener("pointerdown", this.anotherPointer, true);
				window.removeEventListener("blur", this.cancel);
				document.removeEventListener("visibilitychange", this.cancel);
			}
		};
		//#endregion
		//#region src/client/waiting-copy.tsx
		const COPY = {
			compress: [
				"正在压缩",
				"给下一轮对话腾点空间",
				"把长对话收拾轻一点",
				"还在压缩，稍等一会儿"
			],
			merge: [
				"正在合并摘要",
				"把几段摘要整理到一起",
				"合并还在继续",
				"给下一轮对话腾点空间"
			]
		};
		/** Waiting copy is decorative, not a claim that a new processing stage finished. */
		function WaitingCopy({ stage }) {
			const [index, setIndex] = (0, react.useState)(0);
			const phrases = COPY[stage];
			(0, react.useEffect)(() => {
				const motion = matchMedia("(prefers-reduced-motion: reduce)");
				let timer;
				const sync = () => {
					clearInterval(timer);
					timer = void 0;
					if (motion.matches) setIndex(0);
					else if (document.visibilityState === "visible") timer = setInterval(() => setIndex((i) => (i + 1) % phrases.length), 6e3);
				};
				sync();
				document.addEventListener("visibilitychange", sync);
				motion.addEventListener("change", sync);
				return () => {
					clearInterval(timer);
					document.removeEventListener("visibilitychange", sync);
					motion.removeEventListener("change", sync);
				};
			}, [phrases]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "dsh-cs-waiting-copy",
				"aria-hidden": "true",
				children: phrases.map((phrase, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					"data-active": index === i ? "true" : "false",
					children: [phrase, "…"]
				}, phrase))
			});
		}
		//#endregion
		//#region \0dshx-css-global:src/client/style.css.mjs
		const css = ".dsh-cs-footer{border-top:1px solid var(--dsw-alias-separator,#e7e7e9);margin-top:10px;padding-top:10px}.dsh-cs-content{flex-direction:column;gap:7px;display:flex}.dsh-cs-button{font:inherit;color:var(--dsw-alias-label-primary,#30343b);background:var(--dsw-alias-interactive-bg-hover,#f3f4f6);cursor:pointer;white-space:normal;overflow-wrap:anywhere;border:0;border-radius:7px;padding:6px 10px;font-size:12px;line-height:1.5}.dsh-cs-button:hover{filter:brightness(.96)}.dsh-cs-button:focus-visible{outline:2px solid var(--dsw-static-blue-450,#4d88f5);outline-offset:2px}.dsh-cs-button:disabled{opacity:.5;cursor:default}.dsh-cs-primary{color:var(--dsw-static-blue-550,#3476e3)}.dsh-cs-compact{isolation:isolate;position:relative;overflow:hidden}.dsh-cs-compact>.dsh-cs-button-status{z-index:1;justify-content:center;align-items:center;max-width:100%;display:inline-flex;position:relative}.dsh-cs-sr-status{clip-path:inset(50%);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.dsh-cs-compact:before{content:\"\";pointer-events:none;background:linear-gradient(105deg, transparent 25%, color-mix(in srgb, currentColor 14%, transparent) 48%, transparent 72%);opacity:0;position:absolute;inset:0;transform:translate(-110%)}.dsh-cs-content:is([data-phase=sending],[data-phase=queued],[data-phase=running]) .dsh-cs-compact{opacity:1}.dsh-cs-content:is([data-phase=sending],[data-phase=queued],[data-phase=running]) .dsh-cs-compact:before{opacity:1;animation:2.6s ease-in-out infinite dsh-cs-shimmer}.dsh-cs-content[data-phase=done] .dsh-cs-compact:before{opacity:1;animation:.9s ease-out both dsh-cs-shimmer}.dsh-cs-progress{font-variant-numeric:tabular-nums;white-space:nowrap;flex-shrink:0;margin-left:6px}.dsh-cs-waiting-copy{min-width:0;display:inline-grid}.dsh-cs-waiting-copy>span{opacity:0;grid-area:1/1;transition:opacity .45s}.dsh-cs-waiting-copy>span[data-active=true]{opacity:1}@keyframes dsh-cs-shimmer{0%{transform:translate(-110%)}70%,to{transform:translate(110%)}}@media (prefers-reduced-motion:no-preference){.dsh-cs-content:is([data-phase=idle],[data-phase=done]) .dsh-cs-compact:not(:disabled):is(:hover,:focus-visible):before{opacity:1;animation:.9s ease-out both dsh-cs-shimmer}}.dsh-cs-status,.dsh-cs-error{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#747982);font-size:11px;line-height:1.5}.dsh-cs-error{color:var(--dsw-static-red-500,#c54848)}.dsh-cs-hint{text-align:center;color:var(--dsw-alias-label-tertiary,#8a9099);font-size:10px;line-height:1.5}.dsh-cs-ring{touch-action:manipulation;-webkit-touch-callout:none;user-select:none;position:relative}.dsh-cs-ring-art{pointer-events:none;color:var(--dsw-static-blue-550,#3476e3);place-items:center;display:grid;position:absolute;inset:auto}.dsh-cs-ring-art svg{width:100%;height:100%;position:absolute;overflow:visible}.dsh-cs-hold{opacity:0;transform:rotate(-90deg)}.dsh-cs-hold circle{fill:none;stroke:currentColor;stroke-width:1.8px;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1px}[data-cs-holding] .dsh-cs-hold{opacity:1}[data-cs-holding] .dsh-cs-hold circle{animation:.65s linear forwards dsh-cs-charge}@keyframes dsh-cs-charge{to{stroke-dashoffset:0}}.dsh-cs-robot{opacity:0;transition:opacity .18s,transform .32s cubic-bezier(.2,.8,.2,1)}.dsh-cs-body{fill:currentColor}.dsh-cs-eyes{fill:#fff}.dsh-cs-dot{fill:currentColor}.dsh-cs-ring>svg[viewBox=\"0 0 14 14\"]{transition:opacity .18s}.dsh-cs-ring[data-cs-phase=running] .dsh-cs-robot{opacity:1;transform:scale(1)}.dsh-cs-ring:is([data-cs-phase=queued],[data-cs-phase=sending]) .dsh-cs-robot{opacity:.55;transform:scale(1)}.dsh-cs-ring[data-cs-motion=settling] .dsh-cs-robot{opacity:0;transform:scale(.42)}@media (prefers-reduced-motion:reduce){[data-cs-holding] .dsh-cs-hold circle{stroke-dashoffset:.25px;animation:none}.dsh-cs-content[data-phase] .dsh-cs-compact:before{opacity:0;animation:none}.dsh-cs-waiting-copy>span,.dsh-cs-ring>svg[viewBox=\"0 0 14 14\"],.dsh-cs-robot{transition:none}}.dsh-cs-actions{flex-direction:column;gap:6px;display:flex}.dsh-cs-settings{max-width:640px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;padding:24px;display:flex}.dsh-cs-settings h2,.dsh-cs-settings p{margin:0}.dsh-cs-settings p{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.7}.dsh-cs-settings label{flex-direction:column;gap:7px;font-size:13px;display:flex}.dsh-cs-settings .dsh-cs-toggle{flex-direction:row;align-items:center}.dsh-cs-settings input:not([type=checkbox]),.dsh-cs-settings select{box-sizing:border-box;width:100%;font:inherit;color:inherit;background:var(--dsw-alias-interactive-bg-hover,#f3f4f6);border:1px solid var(--dsw-alias-separator,#e7e7e9);border-radius:8px;padding:9px 10px}";
		const tagId = "dsh-compact-saviour/style.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-compact-saviour";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-compact-saviour-client";
		const inject = ["slots"];
		const ENDPOINT = "/api/dsh-compact-saviour/v1";
		async function api(params = "", data, signal) {
			const response = await fetch(ENDPOINT + params, {
				credentials: "same-origin",
				signal,
				...data ? {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(data)
				} : {}
			});
			const text = await response.text();
			let value;
			try {
				value = JSON.parse(text);
			} catch {
				throw new Error(`压缩服务暂未就绪（HTTP ${response.status}），请稍后重试。`);
			}
			if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
			return value;
		}
		/** A zero-layout anchor scopes the native ring gesture, status animation and popup. */
		function PopupBridge({ sessionId }) {
			const anchor = (0, react.useRef)(null);
			const [footer, setFooter] = (0, react.useState)(null);
			const [state, setState] = (0, react.useState)();
			const [error, setError] = (0, react.useState)("");
			const [sending, setSending] = (0, react.useState)(false);
			const posting = (0, react.useRef)(false);
			const act = (0, react.useRef)(async () => {});
			const latest = (0, react.useRef)();
			const syncMeter = (0, react.useRef)(() => {});
			(0, react.useEffect)(() => {
				const abort = new AbortController();
				let timer;
				let revision = 0, connectionError = "";
				setState(void 0);
				latest.current = void 0;
				setError("");
				setSending(false);
				posting.current = false;
				const update = (value) => {
					latest.current = value;
					setState(value);
					syncMeter.current();
				};
				act.current = async (action) => {
					if (posting.current || abort.signal.aborted) return;
					posting.current = true;
					revision++;
					setSending(true);
					setError("");
					syncMeter.current();
					try {
						const value = await api("", {
							action,
							sessionId
						}, abort.signal);
						if (!abort.signal.aborted) update({
							...value,
							context: value.context ?? latest.current?.context
						});
					} catch (e) {
						if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
					} finally {
						if (!abort.signal.aborted) {
							posting.current = false;
							revision++;
							setSending(false);
							syncMeter.current();
						}
					}
				};
				const poll = async () => {
					const started = revision;
					try {
						const value = await api(`?sessionId=${encodeURIComponent(sessionId)}`, void 0, abort.signal);
						if (!abort.signal.aborted && started === revision && !posting.current) {
							update(value);
							const previous = connectionError;
							setError((current) => current === previous ? "" : current);
							connectionError = "";
						}
					} catch (e) {
						if (!abort.signal.aborted) {
							connectionError = e instanceof Error ? e.message : String(e);
							setError(connectionError);
						}
					}
					if (!abort.signal.aborted) timer = setTimeout(poll, 1e3);
				};
				poll();
				return () => {
					abort.abort();
					clearTimeout(timer);
					act.current = async () => {};
				};
			}, [sessionId]);
			(0, react.useEffect)(() => {
				const root = anchor.current && contextRoot(anchor.current);
				if (!root) return;
				let owned = null;
				let observedPanel;
				const meter = new MeterBridge();
				let control;
				const sync = () => {
					const ring = contextRing(root);
					const panel = contextPanel(ring);
					if (panel !== observedPanel) {
						panelObserver.disconnect();
						observedPanel = panel;
						if (panel) panelObserver.observe(panel, observeOptions);
					}
					meter.apply(ring, latest.current?.context);
					if (control?.button !== ring) {
						control?.destroy();
						control = ring ? new RingControl(ring, () => {
							act.current("configured");
						}) : void 0;
					}
					control?.update(posting.current ? "sending" : latest.current?.job.phase ?? "idle", Boolean(latest.current?.available));
					if (owned && owned.parentElement === panel) {
						if (panel && panel.lastElementChild !== owned) panel.append(owned);
						return;
					}
					owned?.remove();
					owned = null;
					if (panel && !panel.querySelector("[data-compact-saviour]")) {
						owned = document.createElement("div");
						owned.dataset.compactSaviour = "footer";
						owned.className = "dsh-cs-footer";
						panel.append(owned);
					}
					setFooter(owned);
				};
				const observeOptions = {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: [
						"aria-expanded",
						"aria-label",
						"aria-describedby",
						"stroke-dasharray",
						"style"
					]
				};
				const observer = new MutationObserver(sync);
				const panelObserver = new MutationObserver(sync);
				const portals = new MutationObserver(sync);
				observer.observe(root, observeOptions);
				portals.observe(root.ownerDocument.body, { childList: true });
				syncMeter.current = sync;
				sync();
				return () => {
					syncMeter.current = () => {};
					observer.disconnect();
					portals.disconnect();
					panelObserver.disconnect();
					control?.destroy();
					meter.restore();
					owned?.remove();
				};
			}, [sessionId]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: anchor,
				style: { display: "none" },
				"aria-hidden": "true"
			}), footer && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompactFooter, {
				state,
				sending,
				error,
				act: (action) => act.current(action)
			}), footer)] });
		}
		function CompactFooter({ state, sending, error, act }) {
			const job = state?.job, active = job?.phase === "queued" || job?.phase === "running";
			const current = job?.current;
			const busy = sending || active;
			const running = !sending && job?.phase === "running";
			const stage = job?.message.includes("合并摘要") ? "merge" : "compress";
			const label = sending ? "正在提交" : job?.phase === "queued" ? "等待当前步骤结束" : job?.phase === "running" ? stage === "merge" ? "正在合并摘要" : "正在压缩" : "手动压缩";
			const progress = !sending && job?.phase === "running" && Number.isInteger(job.completed) && Number.isInteger(job.total) && job.total > 1 && job.completed >= 0 && job.completed <= job.total ? `${job.completed}/${job.total}` : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-cs-content",
				"data-phase": sending ? "sending" : job?.phase ?? "idle",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "dsh-cs-button dsh-cs-primary dsh-cs-compact",
						type: "button",
						"aria-label": progress ? `${label} ${progress}` : label,
						disabled: sending || !state?.available || active,
						onClick: () => void act("configured"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsh-cs-button-status",
							"aria-hidden": "true",
							children: [running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WaitingCopy, { stage }, stage) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsh-cs-label",
								children: [label, busy ? "…" : ""]
							}), progress && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsh-cs-progress",
								children: [" ", progress]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsh-cs-sr-status",
							role: "status",
							"aria-live": "polite",
							"aria-atomic": "true",
							children: [label, progress ? ` ${progress}` : ""]
						})]
					}),
					!active && !sending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-hint",
						children: "也可以长按圆环直接压缩"
					}),
					!busy && job?.message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-status dsh-cs-job-status",
						role: "status",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [job.message, job.phase === "done" && job.beforeTokens !== void 0 && job.afterTokens !== void 0 ? ` ${Math.round(job.beforeTokens / 1e3)}K → ${Math.round(job.afterTokens / 1e3)}K` : ""] })
					}),
					state?.context?.corrected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-status",
						children: state.context.reason === "invalid-usage" ? "已排除异常历史用量，当前按消息和工具估算。" : "已按新模型的上下文容量重新估算。"
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-error",
						role: "alert",
						children: error
					}),
					state && !state.config.model && !error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-status",
						children: "先在设置 → Compact Saviour 中选择压缩模型。"
					}),
					state && !state.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-cs-status",
						children: "当前会话的 Compact 后端尚未就绪。"
					}),
					job?.phase === "failed" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-cs-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsh-cs-button",
							disabled: sending,
							onClick: () => void act("configured"),
							children: "重试压缩模型"
						}), current && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: "dsh-cs-button",
							disabled: sending,
							onClick: () => void act("current"),
							children: [
								"本次使用 ",
								current.model,
								" · ",
								current.reasoningEffort || "默认推理"
							]
						})]
					}),
					(active || job?.phase === "failed") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: "dsh-cs-button",
						disabled: sending,
						onClick: () => void act("cancel"),
						children: "取消"
					})
				]
			});
		}
		function SettingsPanel() {
			const [config, setConfig] = (0, react.useState)();
			const [models, setModels] = (0, react.useState)([]);
			const [search, setSearch] = (0, react.useState)("");
			const [efforts, setEfforts] = (0, react.useState)([]);
			const [message, setMessage] = (0, react.useState)("");
			const [saving, setSaving] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const abort = new AbortController();
				Promise.all([api("", void 0, abort.signal), api("?models=1", void 0, abort.signal)]).then(([s, m]) => {
					setConfig(s.config);
					setModels(m.models);
				}).catch((e) => {
					if (!abort.signal.aborted) setMessage(e.message);
				});
				return () => abort.abort();
			}, []);
			(0, react.useEffect)(() => {
				const abort = new AbortController();
				setEfforts([]);
				if (config?.provider && config.model) api(`?provider=${encodeURIComponent(config.provider)}&model=${encodeURIComponent(config.model)}`, void 0, abort.signal).then((v) => setEfforts(v.efforts)).catch((e) => {
					if (!abort.signal.aborted) setMessage(e.message);
				});
				return () => abort.abort();
			}, [config?.provider, config?.model]);
			const save = async () => {
				setSaving(true);
				setMessage("");
				try {
					const s = await api("", {
						action: "settings",
						config
					});
					setConfig(s.config);
					setMessage("已保存。");
				} catch (e) {
					setMessage(e instanceof Error ? e.message : String(e));
				} finally {
					setSaving(false);
				}
			};
			const selected = config?.model ? JSON.stringify([config.provider, config.model]) : "";
			const filtered = models.filter((m) => JSON.stringify([m.provider, m.id]) === selected || `${m.name} ${m.id} ${m.provider}`.toLowerCase().includes(search.toLowerCase()));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh-cs-settings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "Compact Saviour" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "独立模型负责上下文压缩。点击圆环查看用量，长按圆环或点击弹层内的按钮开始压缩。" }),
					config ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsh-cs-toggle",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: config.enabled,
								onChange: (e) => setConfig({
									...config,
									enabled: e.target.checked
								})
							}), " 启用自动压缩辅助"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["自动压缩方式", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: config.mode ?? "rescue",
							disabled: !config.enabled,
							onChange: (e) => setConfig({
								...config,
								mode: e.target.value
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "rescue",
								children: "官方连续失败两次后救援（默认）"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "direct",
								children: "直接使用 Saviour 模型"
							})]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: !config.enabled ? "自动压缩由官方处理。手动压缩仍直接使用下方模型。" : config.mode === "direct" ? "自动和手动压缩都直接使用下方模型。" : "自动压缩先由官方处理，连续失败两次后静默救援。手动压缩直接使用下方模型。" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["Saviour 压缩模型", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							placeholder: "搜索已配置的模型",
							value: search,
							onChange: (e) => setSearch(e.target.value)
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							"aria-label": "压缩模型",
							value: selected,
							onChange: (e) => {
								const [provider, model] = e.target.value ? JSON.parse(e.target.value) : ["", ""];
								setConfig({
									...config,
									provider,
									model,
									reasoningEffort: ""
								});
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "请选择模型"
							}), filtered.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
								value: JSON.stringify([m.provider, m.id]),
								children: [
									m.name,
									" · ",
									m.provider
								]
							}, JSON.stringify([m.provider, m.id])))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["Reasoning level", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: config.reasoningEffort,
							onChange: (e) => setConfig({
								...config,
								reasoningEffort: e.target.value
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "模型默认"
							}), efforts.map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: e.id,
								children: e.name
							}, e.id))]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "超长历史自动分块，保留近期消息和原始记录。失败后由你选择重试、仅本次使用当前对话模型，或取消。" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dsh-cs-button dsh-cs-primary",
							disabled: saving,
							onClick: () => void save(),
							children: saving ? "保存中…" : "保存"
						})
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "正在加载模型配置…" }),
					message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: message
					})
				]
			});
		}
		function apply(ctx) {
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "compact-saviour-popup-anchor",
				order: 100,
				inject: (sessionId) => ({ sessionId })
			}, PopupBridge));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "compact-saviour",
				order: 38,
				label: () => "Compact Saviour"
			}, SettingsPanel));
		}
		//#endregion
		exports.PopupBridge = PopupBridge;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map