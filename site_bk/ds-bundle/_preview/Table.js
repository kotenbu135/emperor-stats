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

  // .design-sync/previews/Table.tsx
  var Table_exports = {};
  __export(Table_exports, {
    RestorationTable: () => RestorationTable,
    WithCaption: () => WithCaption
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

  // .design-sync/previews/Table.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  var ROWS = [
    { name: "英宗（朱祁鎮）", dynasty: "明", periods: "1435年–1449年 / 1457年–1464年", count: 2, reason: "土木の変で捕虜となり弟が即位、奪門の変で復位" },
    { name: "高宗（李治）", dynasty: "唐", periods: "649年–683年", count: 1, reason: "—" },
    { name: "中宗（李顕）", dynasty: "唐", periods: "684年 / 705年–710年", count: 2, reason: "武則天に廃され廬陵王に降格、神龍革命で復位" },
    { name: "睿宗（李旦）", dynasty: "唐", periods: "684年–690年 / 710年–712年", count: 2, reason: "武則天の即位で退位、韋后誅殺後に再即位" }
  ];
  function RestorationTable() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "max-h-[420px] overflow-y-auto rounded-md border border-border", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Table, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.TableRow, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { children: "皇帝" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { children: "王朝" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { children: "在位期間" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { className: "text-right", children: "即位回数" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { className: "min-w-[240px]", children: "復位の経緯" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableBody, { children: ROWS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.TableRow, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "align-top", children: r.name }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "align-top text-muted-foreground", children: r.dynasty }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "align-top tabular-nums text-muted-foreground", children: r.periods }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "align-top text-right tabular-nums", children: r.count }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "whitespace-normal align-top text-muted-foreground", children: r.reason })
      ] }, r.name)) })
    ] }) });
  }
  function WithCaption() {
    const rows = [
      { era: "秦漢", n: 41, avg: "10.6年" },
      { era: "魏晋南北朝", n: 122, avg: "7.4年" },
      { era: "隋唐", n: 48, avg: "12.9年" },
      { era: "元明清", n: 45, avg: "18.2年" }
    ];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "max-w-md rounded-md border border-border", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Table, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCaption, { children: "時代区分別の平均在位年数（数え方は「このサイトについて」）" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.TableRow, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { children: "時代" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { className: "text-right", children: "人数" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableHead, { className: "text-right", children: "平均在位" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableBody, { children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.TableRow, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { children: r.era }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "text-right tabular-nums", children: r.n }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.TableCell, { className: "text-right tabular-nums", children: r.avg })
      ] }, r.era)) })
    ] }) });
  }
  return __toCommonJS(Table_exports);
})();
