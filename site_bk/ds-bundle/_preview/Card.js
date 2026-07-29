"use strict";
var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.EmperorStatsDS;
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx2(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs2(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsxs2;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs2 : jsx2)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/Card.tsx
  var Card_exports = {};
  __export(Card_exports, {
    NavigationCard: () => NavigationCard,
    StatTiles: () => StatTiles,
    WithActionAndFooter: () => WithActionAndFooter
  });
  init_define_import_meta_env();

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.EmperorStatsDS;
  var ds_default = "default" in g ? g.default : g;

  // .design-sync/previews/Card.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  function StatTiles() {
    const tiles = [
      { label: "収録皇帝数", value: "365人", note: "始皇帝〜宣統帝" },
      { label: "最長在位", value: "61.9年", note: "清・聖祖（康熙帝）" },
      { label: "平均在位年数", value: "9.9年", note: "365人の平均" }
    ];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "grid gap-4 sm:grid-cols-3", children: tiles.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Card, { className: "border-t-2 border-t-seal/70", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.CardContent, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "text-xs text-muted-foreground", children: t.label }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mt-1 font-heading text-2xl font-semibold text-seal", children: t.value }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "mt-1 text-xs text-muted-foreground", children: t.note })
    ] }) }, t.label)) });
  }
  function NavigationCard() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Card, { className: "max-w-sm transition-colors hover:border-seal/60", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.CardHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardTitle, { className: "font-heading text-lg", children: "在位期間" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardDescription, { children: "在位年数・在位日数のランキングと王朝別の平均。" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Button, { variant: "outline", children: "見る" }) })
    ] });
  }
  function WithActionAndFooter() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Card, { className: "max-w-md", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.CardHeader, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardTitle, { className: "font-heading", children: "聖祖（康熙帝）" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardDescription, { children: "清 / 1661年–1722年 / 在位61.9年" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardAction, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Button, { variant: "ghost", size: "sm", children: "個別ページ" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardContent, { className: "text-sm text-muted-foreground", children: "在位61.9年は収録365人中の最長。次点は同じ清の高宗（乾隆帝）の60.4年で、 3位の西夏・仁宗（54.3年）とは6年以上の開きがある。" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.CardFooter, { className: "text-xs text-muted-foreground", children: "出典: 清史稿 巻六〜巻八 聖祖本紀" })
    ] });
  }
  return __toCommonJS(Card_exports);
})();
