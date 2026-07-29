import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Emperor } from '../types';
import { getDynastyColor } from '../utils/dynastyColors';

interface EmperorModalProps {
  emperor: Emperor | null;
  onClose: () => void;
}

export const EmperorModal: React.FC<EmperorModalProps> = ({ emperor, onClose }) => {
  const [imgError, setImgError] = useState(false);
  const dynStyle = emperor ? getDynastyColor(emperor.dynasty) : null;

  return (
    <AnimatePresence>
      {emperor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl border border-[#e2beba] shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#f9f9f8]/95 backdrop-blur-md border-b border-[#e2beba]">
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-serif-title font-bold text-sm shadow-2xs"
                  style={{ backgroundColor: dynStyle?.color || '#8f000d' }}
                >
                  {emperor.dynastyKanji}
                </span>
                <div>
                  <h2
                    className="font-serif-title font-bold text-lg md:text-xl"
                    style={{ color: dynStyle?.color || '#8f000d' }}
                  >
                    {emperor.name}
                  </h2>
                  <p className="text-xs text-[#5a403e]">
                    <span
                      className="inline-block px-1.5 py-0.2 rounded font-bold mr-1"
                      style={{
                        backgroundColor: dynStyle?.badgeBg,
                        color: dynStyle?.badgeText,
                      }}
                    >
                      {emperor.dynasty}王朝
                    </span>{' '}
                    • 廟号: {emperor.templeName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#f3f4f3] hover:bg-[#8f000d] hover:text-white transition-colors text-[#5a403e] font-bold flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Top Hero Section: Portrait & Quick Specs */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Portrait Image */}
                <div className="md:col-span-4 flex flex-col items-center">
                  <div className="relative w-44 h-56 rounded-xl overflow-hidden border-2 border-[#cca72f] shadow-lg bg-[#f3f4f3] flex items-center justify-center">
                    {emperor.portraitUrl && !imgError ? (
                      <img
                        src={emperor.portraitUrl}
                        alt={emperor.name}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <span className="material-symbols-outlined text-5xl text-[#8f000d] mb-2">
                          shield_person
                        </span>
                        <span className="font-serif-title font-bold text-base text-[#8f000d]">
                          {emperor.templeName}
                        </span>
                        <span className="text-[10px] text-[#8e706d] mt-1">正史肖像</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center">
                      <span className="text-[10px] text-amber-300 font-semibold tracking-wider uppercase">
                        在位 {emperor.reignYears}年
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Specs Grid */}
                <div className="md:col-span-8 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50">
                      <span className="text-[10px] font-bold uppercase text-[#8e706d] block">
                        在位期間
                      </span>
                      <span className="font-semibold text-xs md:text-sm text-[#191c1c]">
                        {emperor.reignPeriod}
                      </span>
                    </div>
                    <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50">
                      <span className="text-[10px] font-bold uppercase text-[#8e706d] block">
                        即位年齢
                      </span>
                      <span className="font-semibold text-xs md:text-sm text-[#8f000d]">
                        {emperor.ageAtAscension} 歳
                      </span>
                    </div>
                    <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50">
                      <span className="text-[10px] font-bold uppercase text-[#8e706d] block">
                        生涯寿命
                      </span>
                      <span className="font-semibold text-xs md:text-sm text-[#126e0c]">
                        {emperor.lifespan} 歳
                      </span>
                    </div>
                    <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50">
                      <span className="text-[10px] font-bold uppercase text-[#8e706d] block">
                        継承ルート
                      </span>
                      <span className="font-semibold text-xs text-[#735c00]">
                        {emperor.successionType}
                      </span>
                    </div>
                    <div className="p-3 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50 sm:col-span-2">
                      <span className="text-[10px] font-bold uppercase text-[#8e706d] block">
                        死因・崩御詳細
                      </span>
                      <span className="font-semibold text-xs text-[#8f000d]">
                        {emperor.causeOfDeathCategory}（{emperor.causeOfDeathDetail}）
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-xs md:text-sm text-[#191c1c] leading-relaxed bg-[#f3f4f3]/60 p-3.5 rounded-xl border border-[#e2beba]/30">
                    {emperor.summary}
                  </p>
                </div>
              </div>

              {/* Key Achievements */}
              <div>
                <h3 className="font-serif-title font-bold text-sm md:text-base text-[#8f000d] mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-[#cca72f]">verified</span>
                  主な歴史的偉業・出来事
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {emperor.keyAchievements.map((ach, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[#5a403e] bg-white p-3 rounded-lg border border-[#e2beba]/60 flex items-start gap-2 shadow-2xs"
                    >
                      <span className="text-[#8f000d] font-bold font-serif-title">•</span>
                      <span>{ach}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Famous Quote */}
              {emperor.famousQuote && (
                <div className="p-4 bg-gradient-to-r from-[#8f000d]/10 via-[#cca72f]/10 to-transparent border-l-4 border-[#8f000d] rounded-r-xl">
                  <span className="text-[10px] uppercase font-bold text-[#8f000d] tracking-wider block mb-1">
                    皇帝の言葉・勅令
                  </span>
                  <p className="font-serif-title text-sm italic text-[#191c1c]">
                    「{emperor.famousQuote}」
                  </p>
                </div>
              )}

              {/* Historical Assessment */}
              <div className="p-4 bg-[#f9f9f8] rounded-xl border border-[#e2beba]/50">
                <h4 className="font-serif-title font-bold text-xs text-[#8f000d] uppercase tracking-wider mb-1">
                  歴史的評価
                </h4>
                <p className="text-xs text-[#5a403e] leading-relaxed">
                  {emperor.historicalAssessment}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#f3f4f3] border-t border-[#e2beba] flex justify-between items-center text-xs text-[#8e706d]">
              <span>正史（各二十四史原典）検証済み</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#8f000d] text-white rounded-lg hover:bg-[#b22222] font-semibold transition-colors"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


