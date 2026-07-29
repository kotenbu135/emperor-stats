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

  // .design-sync/previews/Accordion.tsx
  var Accordion_exports = {};
  __export(Accordion_exports, {
    Methodology: () => Methodology,
    MultipleOpen: () => MultipleOpen
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

  // .design-sync/previews/Accordion.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  function Methodology() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      ds_exports.Accordion,
      {
        type: "single",
        collapsible: true,
        defaultValue: "reign",
        className: "max-w-xl",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.AccordionItem, { value: "reign", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionTrigger, { children: "在位年数の数え方" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionContent, { children: "即位日から退位日（または崩御日）までを実日数で数え、年数は日数から換算します。 復位した皇帝は各在位期間を合算します。" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.AccordionItem, { value: "age", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionTrigger, { children: "年齢の数え方" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionContent, { children: "即位時年齢・没年齢はいずれも数え年で統一しています。生年が不詳の人物は 「調査済みだが不明」として集計から外します。" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.AccordionItem, { value: "source", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionTrigger, { children: "出典の扱い" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionContent, { children: "判定はすべて正史の本紀・列伝を第一情報源とし、原文引用を添えています。" })
          ] })
        ]
      }
    );
  }
  function MultipleOpen() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      ds_exports.Accordion,
      {
        type: "multiple",
        defaultValue: ["reign", "court"],
        className: "max-w-xs gap-1",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.AccordionItem, { value: "reign", className: "border-none", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionTrigger, { className: "font-heading text-sm font-semibold", children: "在位・年齢" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionContent, { className: "text-sm text-muted-foreground", children: "在位期間 / 即位時年齢 / 没年齢" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.AccordionItem, { value: "court", className: "border-none", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionTrigger, { className: "font-heading text-sm font-semibold", children: "宮廷イベント" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.AccordionContent, { className: "text-sm text-muted-foreground", children: "改元 / 大赦 / 立后 / 皇太子廃立 / 遷都" })
          ] })
        ]
      }
    );
  }
  return __toCommonJS(Accordion_exports);
})();
