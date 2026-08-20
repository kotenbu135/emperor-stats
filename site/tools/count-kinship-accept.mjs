// 検収値（href / edge-path）と「政権名 第N代」の出力を数える一時確認スクリプト。
import { readFileSync } from "node:fs";

const pages = [
  "kinship",
  "kinship/three-kingdoms-jin",
  "kinship/eastern-jin-sixteen",
  "kinship/northern-southern",
  "kinship/sui-tang",
  "kinship/five-dynasties",
  "kinship/song-liao-jin-xia",
  "kinship/yuan",
  "kinship/ming",
  "kinship/qing",
];
for (const p of pages) {
  const html = readFileSync(`out/${p}.html`, "utf8");
  const href = (html.match(/href="\/emperors\//g) ?? []).length;
  const edge = (html.match(/react-flow__edge-path/g) ?? []).length;
  const nth = (html.match(/[^>]{0,6} 第[0-9・]+代/g) ?? []).length;
  console.log(`${p}: href=${href} edge=${edge} 政権名つき第N代=${nth}`);
}
const ejs = readFileSync("out/kinship/eastern-jin-sixteen.html", "utf8");
console.log("前涼:", (ejs.match(/前涼 第[0-9]代/g) ?? []).join(" / "));
const qing = readFileSync("out/kinship/qing.html", "utf8");
console.log("清の第1代:", (qing.match(/清 第1代/g) ?? []).length, "件");
