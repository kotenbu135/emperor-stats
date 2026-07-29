import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Emperor, DynastyCategory } from '../../types';
import { ALL_365_EMPERORS } from '../../data/allEmperorsData';
import { getDynastyColor } from '../../utils/dynastyColors';

interface EmperorListViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

const ERA_ORDER = [
  '秦',
  '前漢',
  '後漢',
  '三国',
  '西晋',
  '五胡十六国',
  '南北朝',
  '随',
  '唐',
  '五代十国',
  '宋',
  '遼・金・西夏',
  '元',
  '明',
  '清',
];

const ERA_ANCHORS = ERA_ORDER.map((era) => ({
  id: `era-${era}`,
  label: era,
}));

export const EmperorListView: React.FC<EmperorListViewProps> = ({
  onSelectEmperor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DynastyCategory | 'すべて'>('すべて');
  const [selectedDynasty, setSelectedDynasty] = useState<string>('すべての王朝');

  // Extract unique dynasties for the filter dropdown
  const uniqueDynasties = useMemo(() => {
    const set = new Set<string>();
    ALL_365_EMPERORS.forEach((emp) => set.add(emp.dynasty));
    return ['すべての王朝', ...Array.from(set)];
  }, []);

  // Filter logic
  const filteredEmperors = useMemo(() => {
    return ALL_365_EMPERORS.filter((emp) => {
      // Search query matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.name.toLowerCase().includes(q);
        const matchTemple = emp.templeName.toLowerCase().includes(q);
        const matchGiven = emp.givenName.toLowerCase().includes(q);
        const matchDynasty = emp.dynasty.toLowerCase().includes(q);
        const matchEra = (emp.eraGroup || '').toLowerCase().includes(q);
        if (!matchName && !matchTemple && !matchGiven && !matchDynasty && !matchEra) {
          return false;
        }
      }

      // Category matching (正統, 並立, 自称)
      if (selectedCategory !== 'すべて') {
        if (emp.dynastyCategory !== selectedCategory) {
          return false;
        }
      }

      // Dynasty matching
      if (selectedDynasty !== 'すべての王朝') {
        if (emp.dynasty !== selectedDynasty) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedCategory, selectedDynasty]);

  // Group filtered emperors by era group
  const groupedEmperors = useMemo(() => {
    const groups: { [key: string]: Emperor[] } = {};
    filteredEmperors.forEach((emp) => {
      const era = emp.eraGroup || 'その他';
      if (!groups[era]) groups[era] = [];
      groups[era].push(emp);
    });
    return groups;
  }, [filteredEmperors]);

  const sortedEraNames = useMemo(() => {
    const keys = Object.keys(groupedEmperors);
    return keys.sort((a, b) => {
      const idxA = ERA_ORDER.indexOf(a);
      const idxB = ERA_ORDER.indexOf(b);
      const posA = idxA !== -1 ? idxA : 999;
      const posB = idxB !== -1 ? idxB : 999;
      return posA - posB;
    });
  }, [groupedEmperors]);

  const scrollToAnchor = (anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      const offset = 220; // header + sticky bar height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const getCategoryBadgeClass = (category?: DynastyCategory) => {
    switch (category) {
      case '正統':
        return 'bg-gradient-to-r from-[#8f000d]/15 to-[#b22222]/15 text-[#8f000d] border-[#8f000d]/30';
      case '並立':
        return 'bg-gradient-to-r from-[#126e0c]/15 to-[#228b22]/15 text-[#126e0c] border-[#126e0c]/30';
      case '自称':
        return 'bg-gradient-to-r from-[#cca72f]/20 to-[#b8860b]/20 text-[#8a6a00] border-[#cca72f]/40';
      default:
        return 'bg-[#edeeed] text-[#5a403e] border-[#e2beba]/40';
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Title & Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="font-serif-title text-2xl md:text-3xl font-bold text-[#191c1c]">
            皇帝一覧
          </h1>
          <p className="text-xs md:text-sm text-[#5a403e]">
            秦始皇帝から清朝宣統帝まで、正史に記録された実際に皇帝を称した全人物データ
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/80 border border-[#e2beba] px-3 py-1.5 rounded-full shadow-2xs text-xs font-semibold text-[#8f000d]">
          <span className="material-symbols-outlined text-sm">groups</span>
          <span>該当件数: {filteredEmperors.length} / 365名</span>
        </div>
      </div>

      {/* STICKY CONTROL BAR (Fixed on top during scroll) */}
      <div className="sticky top-20 z-30 bg-[#f9f9f8]/95 backdrop-blur-md p-3 md:p-4 rounded-2xl border border-[#e2beba]/70 shadow-md flex flex-col gap-3 transition-all">
        {/* Row 1: Search & Dynasty Filter & Category Filter */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8e706d]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="皇帝名・廟号・姓名・王朝等で検索..."
              className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-white border border-[#e2beba] rounded-xl focus:outline-none focus:border-[#cca72f] focus:ring-2 focus:ring-[#cca72f]/20 shadow-2xs text-[#191c1c] placeholder:text-[#8e706d]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e706d] hover:text-[#191c1c]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Dynasty Select Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedDynasty}
              onChange={(e) => setSelectedDynasty(e.target.value)}
              className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-[#e2beba] rounded-xl focus:outline-none focus:border-[#cca72f] focus:ring-2 focus:ring-[#cca72f]/20 shadow-2xs text-[#191c1c] font-medium"
            >
              {uniqueDynasties.map((dyn) => (
                <option key={dyn} value={dyn}>
                  {dyn}
                </option>
              ))}
            </select>
          </div>

          {/* Category Classification Buttons (正統 / 並立 / 自称) */}
          <div className="md:col-span-4 flex items-center justify-start md:justify-end gap-1 overflow-x-auto pb-1 md:pb-0">
            {(['すべて', '正統', '並立', '自称'] as const).map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-2xs ${
                    isActive
                      ? 'bg-gradient-to-r from-[#8f000d] to-[#b22222] text-white shadow-xs'
                      : 'bg-white border border-[#e2beba] text-[#5a403e] hover:bg-[#edeeed]'
                  }`}
                >
                  {cat === 'すべて' ? '区分: すべて' : cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: ERA JUMP ANCHORS (時代へジャンプ) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#e2beba]/40 scrollbar-none">
          <span className="text-[11px] font-bold text-[#8f000d] whitespace-nowrap shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">near_me</span>
            時代へジャンプ:
          </span>
          {ERA_ANCHORS.map((anchor) => (
            <button
              key={anchor.id}
              onClick={() => scrollToAnchor(anchor.id)}
              className="px-2.5 py-1 rounded-full bg-white border border-[#e2beba]/80 hover:border-[#cca72f] text-[11px] font-bold text-[#5a403e] hover:text-[#8f000d] hover:bg-[#cca72f]/10 transition-all shrink-0 shadow-2xs"
            >
              {anchor.label}
            </button>
          ))}
        </div>
      </div>

      {/* RESULTS LIST BY ERA */}
      {filteredEmperors.length === 0 ? (
        <div className="bg-white/80 border border-[#e2beba] rounded-2xl p-12 text-center my-8 shadow-xs">
          <span className="material-symbols-outlined text-4xl text-[#8e706d] mb-2">
            search_off
          </span>
          <h3 className="font-serif-title text-lg font-bold text-[#191c1c] mb-1">
            該当する皇帝が見つかりません
          </h3>
          <p className="text-xs text-[#5a403e] mb-4">
            検索キーワードや王朝・区分の条件を変更してお試しください。
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('すべて');
              setSelectedDynasty('すべての王朝');
            }}
            className="px-4 py-2 bg-[#8f000d] text-white rounded-full text-xs font-bold hover:bg-[#b22222] transition-colors"
          >
            フィルターをリセット
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sortedEraNames.map((eraName) => {
            const list = groupedEmperors[eraName];
            return (
              <div
                key={eraName}
                id={`era-${eraName}`}
                className="scroll-mt-60 flex flex-col gap-4"
              >
                {/* Era Header */}
                <div className="flex items-center gap-3 border-b-2 border-[#8f000d]/30 pb-2">
                  <div className="w-3 h-6 bg-[#8f000d] rounded-sm" />
                  <h2 className="font-serif-title text-xl font-bold text-[#191c1c]">
                    {eraName} 時代
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#8f000d]/10 text-[#8f000d]">
                    {list.length}名
                  </span>
                </div>

                {/* Grid of Emperor Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {list.map((emp) => {
                    const dynStyle = getDynastyColor(emp.dynasty);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => onSelectEmperor(emp)}
                        className="bento-card rounded-2xl p-4 flex flex-col justify-between cursor-pointer border border-[#e2beba]/50 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-150 group relative overflow-hidden"
                        style={{ borderTop: `3px solid ${dynStyle.color}` }}
                      >
                        {/* Top Row: Dynasty & Category Badge */}
                        <div className="flex justify-between items-center mb-2">
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: dynStyle.badgeBg,
                              color: dynStyle.badgeText,
                              borderColor: dynStyle.badgeBorder,
                            }}
                          >
                            {emp.dynasty}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${getCategoryBadgeClass(
                              emp.dynastyCategory
                            )}`}
                          >
                            {emp.dynastyCategory || '正統'}
                          </span>
                        </div>

                      {/* Main Title & Temple/Given Name */}
                      <div className="mb-3">
                        <h3 className="font-serif-title text-lg font-bold text-[#191c1c] group-hover:text-[#8f000d] transition-colors leading-snug">
                          {emp.name}
                        </h3>
                        <p className="text-xs text-[#8e706d] font-medium mt-0.5">
                          {emp.templeName}（{emp.givenName}）
                        </p>
                      </div>

                      {/* Stats Grid */}
                      <div className="bg-[#f9f9f8] rounded-xl p-2.5 border border-[#e2beba]/30 text-xs flex flex-col gap-1.5 mb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[#5a403e]">在位期間:</span>
                          <span className="font-bold text-[#8f000d] text-[11px]">
                            {emp.reignPeriod} ({emp.reignYears}年)
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#5a403e]">即位/享年:</span>
                          <span className="font-semibold text-[#191c1c]">
                            {emp.ageAtAscension}歳即位 / {emp.lifespan}歳没
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#5a403e]">崩御原因:</span>
                          <span className="font-bold text-[#126e0c] text-[11px]">
                            {emp.causeOfDeathCategory}
                          </span>
                        </div>
                      </div>

                      {/* Summary Quote */}
                      <p className="text-[11px] text-[#5a403e] line-clamp-2 leading-relaxed font-sans">
                        {emp.summary}
                      </p>

                      {/* Bottom action indicator */}
                      <div className="mt-3 pt-2 border-t border-[#e2beba]/30 flex justify-end items-center text-[11px] font-bold text-[#8f000d] group-hover:translate-x-1 transition-transform">
                        詳細記録を見る →
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
