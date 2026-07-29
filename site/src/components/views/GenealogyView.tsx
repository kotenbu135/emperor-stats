import React, { useState } from 'react';
import { DYNASTIES_SUMMARY } from '../../data/emperors';
import { getDynastyColor } from '../../utils/dynastyColors';

export const GenealogyView: React.FC = () => {
  const [dynastyA, setDynastyA] = useState('唐');
  const [dynastyB, setDynastyB] = useState('宋');

  const infoA = DYNASTIES_SUMMARY.find((d) => d.name === dynastyA) || DYNASTIES_SUMMARY[6];
  const infoB = DYNASTIES_SUMMARY.find((d) => d.name === dynastyB) || DYNASTIES_SUMMARY[8];

  const styleA = getDynastyColor(infoA.name);
  const styleB = getDynastyColor(infoB.name);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bento-card rounded-2xl p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3]">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-2xl text-[#8e706d]">account_tree</span>
          <h2 className="font-serif-title font-bold text-2xl text-[#8e706d]">
            系譜・王朝比較分析（中国歴代王朝対比）
          </h2>
        </div>
        <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
          中国の主要な歴史王朝間において、皇帝数、平均在位期間、統治構造、政権の安定性を対比分析できます。
        </p>
      </div>

      {/* Selector Controls */}
      <div className="bento-card rounded-2xl p-6">
        <h3 className="font-serif-title font-bold text-lg text-[#191c1c] mb-4">
          王朝比較インタラクティブエンジン
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-[#8f000d] uppercase tracking-wider mb-2">
              比較王朝 A を選択
            </label>
            <select
              value={dynastyA}
              onChange={(e) => setDynastyA(e.target.value)}
              className="w-full p-3 bg-white border border-[#e2beba] rounded-xl text-sm font-semibold text-[#191c1c] focus:outline-none focus:border-[#8f000d]"
            >
              {DYNASTIES_SUMMARY.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}（{d.era}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#126e0c] uppercase tracking-wider mb-2">
              比較王朝 B を選択
            </label>
            <select
              value={dynastyB}
              onChange={(e) => setDynastyB(e.target.value)}
              className="w-full p-3 bg-white border border-[#e2beba] rounded-xl text-sm font-semibold text-[#126e0c]"
            >
              {DYNASTIES_SUMMARY.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}（{d.era}）
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Side-by-Side Comparison Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A */}
          <div
            className="p-6 rounded-2xl border-2 bg-gradient-to-br from-white to-[#f9f9f8] shadow-md space-y-4"
            style={{ borderColor: styleA.color }}
          >
            <div className="flex items-center justify-between">
              <span
                className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-serif-title font-bold text-xl shadow-sm"
                style={{ backgroundColor: styleA.color }}
              >
                {infoA.kanji}
              </span>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full border"
                style={{
                  backgroundColor: styleA.badgeBg,
                  color: styleA.badgeText,
                  borderColor: styleA.badgeBorder,
                }}
              >
                {infoA.era}
              </span>
            </div>

            <h4
              className="font-serif-title font-bold text-2xl"
              style={{ color: styleA.color }}
            >
              {infoA.name}
            </h4>

            <div className="space-y-3 text-xs pt-2">
              <div className="flex justify-between p-2.5 rounded-lg bg-[#f3f4f3]">
                <span className="text-[#5a403e]">総歴代皇帝数:</span>
                <span className="font-bold text-[#191c1c]">{infoA.count} 人</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-[#f3f4f3]">
                <span className="text-[#5a403e]">平均在位期間:</span>
                <span className="font-bold" style={{ color: styleA.color }}>
                  {infoA.avgReign} 年
                </span>
              </div>
            </div>
          </div>

          {/* Card B */}
          <div
            className="p-6 rounded-2xl border-2 bg-gradient-to-br from-white to-[#f9f9f8] shadow-md space-y-4"
            style={{ borderColor: styleB.color }}
          >
            <div className="flex items-center justify-between">
              <span
                className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-serif-title font-bold text-xl shadow-sm"
                style={{ backgroundColor: styleB.color }}
              >
                {infoB.kanji}
              </span>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full border"
                style={{
                  backgroundColor: styleB.badgeBg,
                  color: styleB.badgeText,
                  borderColor: styleB.badgeBorder,
                }}
              >
                {infoB.era}
              </span>
            </div>

            <h4
              className="font-serif-title font-bold text-2xl"
              style={{ color: styleB.color }}
            >
              {infoB.name}
            </h4>

            <div className="space-y-3 text-xs pt-2">
              <div className="flex justify-between p-2.5 rounded-lg bg-[#f3f4f3]">
                <span className="text-[#5a403e]">総歴代皇帝数:</span>
                <span className="font-bold text-[#191c1c]">{infoB.count} 人</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-[#f3f4f3]">
                <span className="text-[#5a403e]">平均在位期間:</span>
                <span className="font-bold" style={{ color: styleB.color }}>
                  {infoB.avgReign} 年
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dynasty Timeline Bar */}
      <div className="bento-card rounded-2xl p-6">
        <h3 className="font-serif-title font-bold text-lg text-[#191c1c] mb-4">
          年代表録（紀元前221年 – 1912年）
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {DYNASTIES_SUMMARY.map((dyn) => {
            const dynStyle = getDynastyColor(dyn.name);
            return (
              <div
                key={dyn.name}
                className="p-3 bg-white rounded-xl border border-[#e2beba]/60 hover:shadow-sm transition-all"
                style={{ borderTop: `3px solid ${dynStyle.color}` }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-6 h-6 rounded text-white font-serif-title font-bold text-xs flex items-center justify-center shrink-0"
                    style={{ backgroundColor: dynStyle.color }}
                  >
                    {dyn.kanji}
                  </span>
                  <span className="font-semibold text-xs text-[#191c1c] truncate">
                    {dyn.name}
                  </span>
                </div>
                <p className="text-[10px] text-[#5a403e]">{dyn.era}</p>
                <p className="text-[10px] text-[#8e706d] mt-1 font-mono">
                  {dyn.count} 人
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

