import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Emperor, CauseOfDeathCategory } from '../../types';
import { EMPERORS_DATA } from '../../data/emperors';

interface DeathCausesViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

export const DeathCausesView: React.FC<DeathCausesViewProps> = ({ onSelectEmperor }) => {
  const [selectedCategory, setSelectedCategory] = useState<CauseOfDeathCategory | 'すべて'>('すべて');

  // Pre-calculate cause counts once using map
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      病死: 0,
      暗殺: 0,
      処刑: 0,
      戦死: 0,
      自尽: 0,
      事故死: 0,
      不詳: 0,
      諸説あり: 0,
    };
    for (let i = 0; i < EMPERORS_DATA.length; i++) {
      const cat = EMPERORS_DATA[i].causeOfDeathCategory;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    }
    return counts;
  }, []);

  const categories = React.useMemo(() => [
    { label: 'すべて' as const, icon: 'apps', count: EMPERORS_DATA.length, description: '全記録皇帝' },
    { label: '病死' as const, icon: 'medical_services', count: categoryCounts['病死'] || 0, description: '自然死・疾病による死（老衰含む）' },
    { label: '暗殺' as const, icon: 'skull', count: categoryCounts['暗殺'] || 0, description: '同一政権内の臣下・近親・宦官等による謀殺・毒殺' },
    { label: '処刑' as const, icon: 'gavel', count: categoryCounts['処刑'] || 0, description: '敵対勢力・後継政権による裁判・公的処断' },
    { label: '戦死' as const, icon: 'swords', count: categoryCounts['戦死'] || 0, description: '親征・防衛戦・鎮圧戦等の戦闘中の死' },
    { label: '自尽' as const, icon: 'sentiment_very_dissatisfied', count: categoryCounts['自尽'] || 0, description: '自殺・自害（廃位や敗戦に追い詰めての自裁）' },
    { label: '事故死' as const, icon: 'warning', count: categoryCounts['事故死'] || 0, description: '落馬・溺死・火災等の事故性の死' },
    { label: '不詳' as const, icon: 'help_outline', count: categoryCounts['不詳'] || 0, description: '死因の記録・手がかりが原典に見当たらない' },
    { label: '諸説あり' as const, icon: 'device_unknown', count: categoryCounts['諸説あり'] || 0, description: '複数の原典/通説が対立し一つに絞れない場合' },
  ], [categoryCounts]);

  const filteredEmperors = React.useMemo(() => {
    return selectedCategory === 'すべて'
      ? EMPERORS_DATA
      : EMPERORS_DATA.filter((e) => e.causeOfDeathCategory === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card rounded-2xl p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3]"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-2xl text-[#8f000d]">skull</span>
          <h2 className="font-serif-title font-bold text-2xl text-[#8f000d]">
            死因分析（歴代皇帝の崩御統計）
          </h2>
        </div>
        <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
          中国2,000年の歴史において、皇帝の死因は宮廷内の権力闘争、道教の不老長生薬（水銀・鉛）中毒、戦乱の激動など、時代背景を色濃く反映しています。
        </p>
      </motion.div>

      {/* Category Selection Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        {categories.map((cat, idx) => {
          const isSelected = selectedCategory === cat.label;
          return (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedCategory(cat.label)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-white via-[#fffaf9] to-[#fcf5f4] border-[#8f000d] shadow-md ring-2 ring-[#8f000d]/20'
                  : 'bg-white/80 border-[#e2beba]/60 hover:bg-white hover:border-[#8e706d]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-[#8f000d]' : 'text-[#8e706d]'}`}>
                  {cat.icon}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-gradient-to-r from-[#8f000d] to-[#b22222] text-white shadow-2xs' : 'bg-[#f3f4f3] text-[#5a403e]'}`}>
                  {cat.count}人
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-[#191c1c] truncate">{cat.label}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Filtered Emperor Records Table / Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif-title font-bold text-lg text-[#191c1c]">
            皇帝記録一覧 — 該当分類: <span className="text-[#8f000d]">{selectedCategory}</span>
          </h3>
          <span className="text-xs text-[#8e706d] font-semibold">
            {filteredEmperors.length} 名表示中
          </span>
        </div>

        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredEmperors.map((emp) => (
              <motion.div
                layout
                key={emp.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                onClick={() => onSelectEmperor(emp)}
                className="p-4 rounded-xl border border-[#e2beba]/60 bg-white hover:border-[#cca72f] hover:shadow-md transition-colors cursor-pointer group flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-[#8f000d]/10 text-[#8f000d] font-serif-title font-bold text-sm flex items-center justify-center shrink-0">
                      {emp.dynastyKanji}
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm text-[#191c1c] group-hover:text-[#8f000d] transition-colors">
                        {emp.name}
                      </h4>
                      <p className="text-[11px] text-[#5a403e]">{emp.dynasty}王朝 • {emp.reignPeriod}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#cca72f]/15 text-[#735c00] font-semibold shrink-0">
                    {emp.causeOfDeathCategory}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-[#f9f9f8] border border-[#e2beba]/40 text-xs">
                  <p className="text-[#8f000d] font-semibold mb-0.5">崩御詳細:</p>
                  <p className="text-[#5a403e] line-clamp-2">{emp.causeOfDeathDetail}</p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8e706d] pt-1 border-t border-[#edeeed]">
                  <span>寿命: <strong className="text-[#191c1c]">{emp.lifespan}歳</strong></span>
                  <span>即位: <strong className="text-[#191c1c]">{emp.ageAtAscension}歳</strong></span>
                  <span className="text-[#8f000d] font-bold group-hover:underline">詳細表示 →</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};


