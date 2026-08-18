// 系譜図のカード下帯（政権色）の値を計算する。
//
// **目視で選ばない**（globals.css の --bar 系と同じ作法）。条件は
//   ・白文字とのコントラストが 4.5:1 以上（帯の中に政権名と在位年が乗る）
//   ・元の --series-N と同じ色相・彩度（凡例のチップは --series-N のままなので、
//     色相がずれると凡例と図が別の色に見える）
// を満たす最も明るい明度を二分探索で出す。暗くしすぎると8色が全部「黒っぽい何か」に
// 潰れて政権の区別が付かなくなるため、**下げ幅は最小**にする。
const SERIES = {
  1: "#2a78d6",
  2: "#eb6834",
  3: "#1baf7a",
  4: "#eda100",
  5: "#e87ba4",
  6: "#008300",
  7: "#4a3aa7",
  8: "#e34948",
};

const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function rgbToOklab([r, g, b]) {
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const relLum = ([r, g, b]) =>
  0.2126 * srgbToLin(Math.min(1, Math.max(0, r))) +
  0.7152 * srgbToLin(Math.min(1, Math.max(0, g))) +
  0.0722 * srgbToLin(Math.min(1, Math.max(0, b)));
const contrastWithWhite = (rgb) => 1.05 / (relLum(rgb) + 0.05);
const inGamut = ([r, g, b]) => [r, g, b].every((c) => c >= -0.002 && c <= 1.002);
const toHex = ([r, g, b]) =>
  "#" +
  [r, g, b]
    .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0"))
    .join("");

const TARGET = Number(process.env.KINSHIP_BAND_TARGET ?? 4.5);

/** L を固定し、色相を保ったまま sRGB に収まる最大の彩度を返す（oklch の gamut clip）。 */
function fitChroma(L, C, H) {
  const rad = (H * Math.PI) / 180;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    const rgb = oklabToRgb([L, mid * Math.cos(rad), mid * Math.sin(rad)]);
    if (inGamut(rgb)) lo = mid;
    else hi = mid;
  }
  return lo;
}

for (const [slot, hex] of Object.entries(SERIES)) {
  const [L0, a0, b0] = rgbToOklab(hexToRgb(hex));
  const C0 = Math.hypot(a0, b0);
  const H = ((Math.atan2(b0, a0) * 180) / Math.PI + 360) % 360;
  const base = contrastWithWhite(hexToRgb(hex));

  // 白文字 4.5:1 を満たす**最も明るい** L を探す（暗くしすぎると8色が黒に潰れる）。
  let lo = 0.2;
  let hi = Math.max(L0, 0.9);
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const C = fitChroma(mid, C0, H);
    const rad = (H * Math.PI) / 180;
    const rgb = oklabToRgb([mid, C * Math.cos(rad), C * Math.sin(rad)]);
    if (contrastWithWhite(rgb) >= TARGET) lo = mid;
    else hi = mid;
  }
  // **元より明るくはしない** — 目的は帯を濃くすることなので、もともと 4.5 を
  // 満たしている色（緑・紫）はそのまま据え置く。
  const L = Math.min(lo, L0);
  const C = fitChroma(L, C0, H);
  const rad = (H * Math.PI) / 180;
  const rgb = oklabToRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
  console.log(
    `  --kinship-band-${slot}: oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)}); /* ${hex} L${L0.toFixed(2)}→${L.toFixed(2)} C${C0.toFixed(3)}→${C.toFixed(3)} 白文字 ${base.toFixed(2)}→${contrastWithWhite(rgb).toFixed(2)} ＝ ${toHex(rgb)} */`,
  );
}
