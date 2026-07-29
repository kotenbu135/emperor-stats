import React from 'react';
import { motion } from 'motion/react';

export const AboutView: React.FC = () => {
  const stats = [
    { label: '収録皇帝数', value: '365名', sub: '秦始皇帝〜溥儀', icon: 'groups', color: 'bg-[#8f000d]/10 text-[#8f000d]' },
    { label: '対象期間', value: '2,166年間', sub: '紀元前221年〜紀元後1945年', icon: 'history', color: 'bg-[#cca72f]/15 text-[#856404]' },
    { label: '主要王朝', value: '12大王朝', sub: '正統・並立・自称含む', icon: 'account_balance', color: 'bg-[#2b5c8f]/10 text-[#2b5c8f]' },
    { label: '集計死因', value: '5大分類', sub: '病死・暗殺・処刑等', icon: 'pie_chart', color: 'bg-[#5c3c21]/10 text-[#5c3c21]' },
  ];

  const features = [
    {
      title: '皇帝一覧',
      icon: 'group',
      desc: '始皇帝から溥儀まで全365名を完全収録。廟号・姓名・生没年検索や王朝別フィルタを網羅。',
      badge: '全365名',
      tagColor: 'bg-[#8f000d]/10 text-[#8f000d]',
    },
    {
      title: '死因分析',
      icon: 'skull',
      desc: '病死・暗殺・処刑・丹薬中毒など、正史に記された臨終の真相と死因比率をビジュアル解析。',
      badge: '5大分類',
      tagColor: 'bg-[#cca72f]/20 text-[#735800]',
    },
    {
      title: '宮廷事件 & 軍事',
      icon: 'castle',
      desc: '沙丘の陰謀、玄武門の変、靖難の変などの宮廷政変と、対匈奴・高句麗・遠征など歴史的軍事録。',
      badge: '政変・遠征',
      tagColor: 'bg-[#2b5c8f]/10 text-[#2b5c8f]',
    },
    {
      title: '年齢 & 系譜比較',
      icon: 'analytics',
      desc: '即位年齢・在位年数・寿命の相関分布。正統・並立・自称王朝ごとの寿命と存続期間の統計比較。',
      badge: '統計・相関',
      tagColor: 'bg-[#4b6b4e]/10 text-[#315234]',
    },
  ];

  const sources = [
    { name: '『史記』', author: '司馬遷', era: '前漢' },
    { name: '『漢書』', author: '班固', era: '後漢' },
    { name: '『後漢書』', author: '范曄', era: '南朝宋' },
    { name: '『三国志』', author: '陳寿', era: '西晋' },
    { name: '『晋書』', author: '房玄齢等', era: '唐' },
    { name: '『宋書』', author: '沈約', era: '梁' },
    { name: '『魏書』', author: '魏収', era: '北斉' },
    { name: '『旧唐書』', author: '劉昫', era: '後晋' },
    { name: '『新唐書』', author: '欧陽脩等', era: '北宋' },
    { name: '『宋史』', author: '脱脱', era: '元' },
    { name: '『明史』', author: '張廷玉等', era: '清' },
    { name: '『清史稿』', author: '趙爾巽等', era: '中華民国' },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto py-1">
      {/* Top Banner Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bento-card rounded-2xl p-5 md:p-7 border border-[#e2beba]/60 relative overflow-hidden bg-gradient-to-br from-[#fdfbf7] via-white to-[#f5ebd9] shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2beba]/40 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#8f000d] text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">auto_stories</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif-title text-xl md:text-2xl font-bold text-[#191c1c]">
                  このサイトについて
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8f000d]/10 text-[#8f000d] font-bold">
                  正史DB
                </span>
              </div>
              <p className="text-xs text-[#8e706d] font-medium">
                中国歴代皇帝365名の正史構造化データベース & ビジュアル分析
              </p>
            </div>
          </div>
        </div>

        {/* User Text Block with Compact Decorative Styling */}
        <div className="bg-white/90 rounded-xl p-4 md:p-5 border border-[#e2beba]/50 shadow-2xs space-y-3">
          <p className="font-serif-title font-bold text-sm md:text-base text-[#191c1c] leading-snug">
            始皇帝（紀元前221年）から清朝最後の皇帝・溥儀まで、中国史上に登場した実際に「皇帝」を名乗った人物365名の在位期間・死因・即位経緯等を構造化・可視化したプロジェクトです。
          </p>
          <div className="text-xs text-[#5a403e] leading-relaxed bg-[#f9f8f5] p-3.5 rounded-lg border border-[#e2beba]/30 space-y-1.5">
            <p className="flex items-start gap-1.5">
              <span className="material-symbols-outlined text-xs text-[#8f000d] mt-0.5 shrink-0">verified</span>
              <span>集計にあたっては、可能な限り『史記』『漢書』『旧唐書』『宋史』などの正史原典に立ち返り客観データを抽出しています。</span>
            </p>
            <p className="flex items-start gap-1.5">
              <span className="material-symbols-outlined text-xs text-[#cca72f] mt-0.5 shrink-0">help_outline</span>
              <span>史料の食い違いや原典不詳の箇所は無理に結論づけず「諸説あり」「不詳」として厳密に分類表記しています。</span>
            </p>
            <p className="text-[11px] text-[#8e706d] pt-1.5 border-t border-[#e2beba]/25">
              ※即位の経緯については、2026年の分類見直しにより「受禅」と「開国・創業」の基準を整理・修正しました。
            </p>
          </div>
        </div>
      </motion.div>

      {/* Key Metric Ribbon */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {stats.map((st, i) => (
          <div
            key={i}
            className="bento-card rounded-xl p-3.5 border border-[#e2beba]/50 bg-white flex items-center justify-between shadow-2xs hover:border-[#cca72f]/60 transition-all"
          >
            <div>
              <div className="text-[11px] text-[#8e706d] font-medium">{st.label}</div>
              <div className="font-serif-title font-bold text-lg text-[#191c1c] my-0.5">{st.value}</div>
              <div className="text-[10px] text-[#a08582]">{st.sub}</div>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${st.color}`}>
              <span className="material-symbols-outlined text-xl">{st.icon}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Features 2x2 Bento Grid - Compact & Rich */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {features.map((ft, idx) => (
          <div
            key={idx}
            className="bento-card rounded-xl p-4 border border-[#e2beba]/50 bg-white hover:border-[#cca72f] hover:shadow-xs transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#8f000d]/10 text-[#8f000d] flex items-center justify-center group-hover:bg-[#8f000d] group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-lg">{ft.icon}</span>
                  </div>
                  <h3 className="font-serif-title font-bold text-sm text-[#191c1c]">
                    {ft.title}
                  </h3>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${ft.tagColor}`}>
                  {ft.badge}
                </span>
              </div>
              <p className="text-xs text-[#5a403e] leading-relaxed">
                {ft.desc}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Historical Primary Sources Cited */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bento-card rounded-xl p-4 md:p-5 border border-[#e2beba]/50 bg-white shadow-2xs"
      >
        <div className="flex items-center justify-between mb-3 border-b border-[#e2beba]/30 pb-2">
          <h3 className="font-serif-title font-bold text-sm text-[#191c1c] flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#8f000d]">menu_book</span>
            参照した主な正史原典（二十四史・史書）
          </h3>
          <span className="text-[11px] text-[#8e706d] font-medium">全12史書</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
          {sources.map((src, i) => (
            <div
              key={i}
              className="p-2 bg-[#fdfbf7] rounded-lg border border-[#e2beba]/35 hover:border-[#8f000d]/40 transition-colors flex flex-col justify-between"
            >
              <span className="font-serif-title font-bold text-[#191c1c] text-xs">
                {src.name}
              </span>
              <div className="flex items-center justify-between text-[10px] text-[#8e706d] mt-1 pt-1 border-t border-[#e2beba]/20">
                <span>{src.author}</span>
                <span className="text-[9px] px-1 py-0.2 bg-[#8f000d]/5 text-[#8f000d] rounded">
                  {src.era}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

