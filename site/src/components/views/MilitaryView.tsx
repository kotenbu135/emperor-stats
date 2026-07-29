import React from 'react';
import { MILITARY_ACTIONS } from '../../data/events';
import { EMPEROR_MAP_BY_ID } from '../../data/emperors';
import { Emperor } from '../../types';

interface MilitaryViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

export const MilitaryView: React.FC<MilitaryViewProps> = ({ onSelectEmperor }) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bento-card rounded-2xl p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3]">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-2xl text-[#126e0c]">swords</span>
          <h2 className="font-serif-title font-bold text-2xl text-[#126e0c]">
            軍事行動（領土拡張・外征記録）
          </h2>
        </div>
        <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
          絹の道に沿った匈奴討伐から、清朝による新疆・チベット平定まで、武力と外征は中華帝国の国境線と国際秩序を画定してきました。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MILITARY_ACTIONS.map((campaign) => (
          <div
            key={campaign.id}
            className="bento-card rounded-2xl p-6 flex flex-col justify-between hover:border-[#126e0c] transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#e2beba]/50 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-[#126e0c] text-white flex items-center justify-center font-bold text-xs">
                    武
                  </span>
                  <div>
                    <h3 className="font-serif-title font-bold text-base text-[#191c1c]">
                      {campaign.title}
                    </h3>
                    <span className="text-[11px] text-[#5a403e]">{campaign.dynasty}王朝 • {campaign.year}</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#126e0c]/15 text-[#126e0c] font-bold">
                  大遠征
                </span>
              </div>

              <p className="text-xs text-[#191c1c] leading-relaxed mb-3">
                {campaign.summary}
              </p>

              <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/40 text-xs mb-3">
                <span className="font-bold text-[#126e0c] uppercase tracking-wider block mb-1">
                  戦略的成果・歴史的影響
                </span>
                <p className="text-[#5a403e]">{campaign.impact}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#edeeed]">
              <span className="text-xs font-bold text-[#8e706d]">主導皇帝:</span>
              {campaign.involvedEmperors.map((empId) => {
                const emp = EMPEROR_MAP_BY_ID.get(empId);
                return emp ? (
                  <button
                    key={emp.id}
                    onClick={() => onSelectEmperor(emp)}
                    className="px-2.5 py-1 rounded bg-[#126e0c]/10 text-[#126e0c] text-xs font-bold hover:bg-[#126e0c] hover:text-white transition-colors"
                  >
                    {emp.name}
                  </button>
                ) : (
                  <span key={empId} className="text-xs text-[#5a403e]">
                    {empId}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

