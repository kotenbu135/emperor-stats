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

  // .design-sync/previews/Select.tsx
  var Select_exports = {};
  __export(Select_exports, {
    Disabled: () => Disabled,
    FilterRow: () => FilterRow,
    OpenWithGroups: () => OpenWithGroups
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

  // .design-sync/previews/Select.tsx
  var import_jsx_runtime = __toESM(require_react_shim());
  function FilterRow() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-wrap items-end gap-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-muted-foreground", children: "集計単位" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Select, { defaultValue: "dynasty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectTrigger, { className: "w-[130px]", "aria-label": "集計単位", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectValue, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectContent, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "dynasty", children: "王朝別" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "era", children: "時代別" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-muted-foreground", children: "王朝の区分" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Select, { defaultValue: "all", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectTrigger, { className: "w-[170px]", "aria-label": "王朝の区分で絞り込み", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectValue, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectContent, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "all", children: "すべて" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "unified", children: "統一王朝" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "parallel", children: "並立政権" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "text-xs text-muted-foreground", children: "並び順" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Select, { defaultValue: "desc", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectTrigger, { className: "w-[180px]", "aria-label": "並び順", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectValue, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectContent, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "desc", children: "在位年数が長い順" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "asc", children: "在位年数が短い順" })
          ] })
        ] })
      ] })
    ] });
  }
  function OpenWithGroups() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "flex h-[300px] items-center", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Select, { defaultValue: "houhan", open: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectTrigger, { className: "w-[200px]", "aria-label": "王朝を選ぶ", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectValue, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectContent, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectGroup, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectLabel, { children: "秦漢" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "qin", children: "秦" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "qianhan", children: "前漢" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "houhan", children: "後漢" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SelectGroup, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectLabel, { children: "隋唐" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "sui", children: "隋" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "tang", children: "唐" })
        ] })
      ] })
    ] }) });
  }
  function Disabled() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Select, { defaultValue: "none", disabled: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectTrigger, { className: "w-[170px]", "aria-label": "王朝を選ぶ", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectValue, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectContent, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SelectItem, { value: "none", children: "該当なし" }) })
    ] });
  }
  return __toCommonJS(Select_exports);
})();
