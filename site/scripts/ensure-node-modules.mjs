// worktree で site を動かす前に node_modules を用意する（predev / prebuild から呼ばれる）。
//
// symlink で張ると Turbopack が
//   Symlink [project]/node_modules is invalid, it points out of the filesystem root
// で拒否するため、primary から `cp -al`（ハードリンク複製・約0.5秒・実ディスクはほぼ0）で用意する。
// primary 上ではこのスクリプトは何もしない。
//
// 依存ゼロ（Node 組み込みのみ）— node_modules が無い状態で最初に走るため。
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worktreeRoot = path.dirname(siteDir);
const nodeModules = path.join(siteDir, "node_modules");

const setup = path.join(worktreeRoot, "scripts", "setup_worktree.sh");
if (!existsSync(setup)) process.exit(0);

let commonDir;
try {
  commonDir = execFileSync(
    "git",
    ["-C", worktreeRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" },
  ).trim();
} catch {
  process.exit(0); // git が無い / リポジトリ外 — 判断材料が無いので触らない
}

const primary = path.dirname(commonDir);
if (primary === worktreeRoot) process.exit(0); // primary 上では何もしない

// 実体ディレクトリが既にあれば何もしない。無い / symlink（Turbopack が拒否する形）なら用意する。
if (existsSync(nodeModules) && !lstatSync(nodeModules).isSymbolicLink()) process.exit(0);

console.log("[worktree] site/node_modules を primary から用意します（ハードリンク複製）…");
execFileSync("bash", [setup, "--site", worktreeRoot], { stdio: "inherit" });
