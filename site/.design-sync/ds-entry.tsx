// Scoped export surface for the claude.ai/design sync.
//
// `site` is a Next.js application, not a published component library: there is
// no `dist/` and no shipped `.d.ts` tree, so the converter has nothing to derive
// an entry from. This file IS the entry — it re-exports the real component
// modules (never a reimplementation) for exactly the scope this sync covers:
//
//   · src/components/ui      — the shadcn/Radix design-system layer
//   · src/components/layout  — the page shells (nav, header, footer, shell)
//
// The data-bound modules (charts/, emperors/, kinship/, tables/, timeline/) are
// deliberately excluded: they are coupled to ../data/emperors.json and Nivo and
// cannot render standalone. See .design-sync/NOTES.md.

// Must stay first: layout/ pulls in next/link + next/image, whose module bodies
// read process.env.__NEXT_* at eval time. See ds-process-shim.ts.
import "./ds-process-shim";

export * from "../src/components/ui/accordion";
export * from "../src/components/ui/badge";
export * from "../src/components/ui/button";
export * from "../src/components/ui/card";
export * from "../src/components/ui/command";
export * from "../src/components/ui/dialog";
export * from "../src/components/ui/hover-card";
export * from "../src/components/ui/input";
export * from "../src/components/ui/input-group";
export * from "../src/components/ui/popover";
export * from "../src/components/ui/select";
export * from "../src/components/ui/separator";
export * from "../src/components/ui/sheet";
export * from "../src/components/ui/table";
export * from "../src/components/ui/textarea";

export * from "../src/components/layout/nav-menu";
export * from "../src/components/layout/page-header";
export * from "../src/components/layout/site-footer";
export * from "../src/components/layout/site-shell";
