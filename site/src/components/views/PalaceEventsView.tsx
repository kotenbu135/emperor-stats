import React from 'react';
import { PALACE_EVENTS } from '../../data/events';
import { EMPERORS_DATA, EMPEROR_MAP_BY_ID, EMPEROR_MAP_BY_NAME } from '../../data/emperors';
import { Emperor } from '../../types';

interface PalaceEventsViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

export const PalaceEventsView: React.FC<PalaceEventsViewProps> = ({ onSelectEmperor }) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bento-card rounded-2xl p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3]">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-2xl text-[#8f000d]">castle</span>
          <h2 className="font-serif-title font-bold text-2xl text-[#8f000d]">
            宮廷事件（政変・クーデター記録）
          </h2>
        </div>
        <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
          宮廷陰謀、兄弟間の継承葛藤、宦官の台頭・反乱は、中国歴代王朝の運命を決定づける巨大な転換点となりました。
        </p>
      </div>

      {/* Timeline List */}
      <div className="space-y-4">
        {PALACE_EVENTS.map((evt) => (
          <div
            key={evt.id}
            className="bento-card rounded-2xl p-6 hover:border-[#cca72f] transition-all"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2beba]/50">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#8f000d] text-white flex items-center justify-center font-bold font-serif-title text-sm shadow-md">
                  宮
                </span>
                <div>
                  <h3 className="font-serif-title font-bold text-lg text-[#191c1c]">
                    {evt.title}
                  </h3>
                  <p className="text-xs text-[#5a403e]">
                    王朝: <strong className="text-[#8f000d]">{evt.dynasty}</strong> • 発生年: {evt.year}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#cca72f]/20 text-[#735c00] text-xs font-bold w-fit">
                皇室政変
              </span>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs md:text-sm text-[#191c1c] leading-relaxed">
                {evt.summary}
              </p>

              <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/40 text-xs">
                <span className="font-bold text-[#8f000d] uppercase tracking-wider block mb-1">
                  歴史的影響・意義
                </span>
                <p className="text-[#5a403e]">{evt.impact}</p>
              </div>
            </div>

            {/* Involved Emperors */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-bold text-[#8e706d]">関連皇帝:</span>
              {evt.involvedEmperors.map((empName) => {
                const foundEmp =
                  EMPEROR_MAP_BY_ID.get(empName) ||
                  EMPEROR_MAP_BY_NAME.get(empName) ||
                  EMPERORS_DATA.find(
                    (e) => e.id === empName || e.name.toLowerCase().includes(empName.toLowerCase())
                  );
                return foundEmp ? (
                  <button
                    key={foundEmp.id}
                    onClick={() => onSelectEmperor(foundEmp)}
                    className="px-2.5 py-1 rounded-lg bg-[#8f000d]/10 text-[#8f000d] text-xs font-semibold hover:bg-[#8f000d] hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>{foundEmp.name}</span>
                    <span className="text-[10px]">→</span>
                  </button>
                ) : (
                  <span
                    key={empName}
                    className="px-2.5 py-1 rounded-lg bg-[#edeeed] text-[#5a403e] text-xs font-medium"
                  >
                    {empName}
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

