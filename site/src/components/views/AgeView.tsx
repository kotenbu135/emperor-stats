import React, { useState, useMemo } from 'react';
import { ALL_365_EMPERORS } from '../../data/allEmperorsData';
import { Emperor } from '../../types';

interface AgeViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

type SortKey = 'name' | 'dynasty' | 'ageAtAscension' | 'lifespan' | 'reignYears' | 'ratio';
type SortOrder = 'asc' | 'desc';

const DYNASTY_OPTIONS = [
  { label: '全王朝', value: 'ALL' },
  { label: '秦', value: '秦' },
  { label: '前漢', value: '前漢' },
  { label: '後漢', value: '後漢' },
  { label: '三国', value: '三国' },
  { label: '西晋', value: '西晋' },
  { label: '五胡十六国', value: '五胡十六国' },
  { label: '南北朝', value: '南北朝' },
  { label: '随', value: '随' },
  { label: '唐', value: '唐' },
  { label: '五代十国', value: '五代十国' },
  { label: '宋', value: '宋' },
  { label: '遼・金・西夏', value: '遼・金・西夏' },
  { label: '元', value: '元' },
  { label: '明', value: '明' },
  { label: '清', value: '清' },
];

export const AgeView: React.FC<AgeViewProps> = ({ onSelectEmperor }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDynasty, setSelectedDynasty] = useState('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('ageAtAscension');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showAll, setShowAll] = useState(false);

  // Top Extremes from 365 emperors
  const extremes = useMemo(() => {
    const validAscension = [...ALL_365_EMPERORS].filter((e) => typeof e.ageAtAscension === 'number');
    const validLifespan = [...ALL_365_EMPERORS].filter((e) => typeof e.lifespan === 'number');

    validAscension.sort((a, b) => a.ageAtAscension - b.ageAtAscension);
    validLifespan.sort((a, b) => b.lifespan - a.lifespan);

    return {
      youngestAscension: validAscension[0] || ALL_365_EMPERORS[0],
      oldestAscension: validAscension[validAscension.length - 1] || ALL_365_EMPERORS[0],
      longestLifespan: validLifespan[0] || ALL_365_EMPERORS[0],
    };
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      if (key === 'name' || key === 'dynasty' || key === 'ageAtAscension') {
        setSortOrder('asc');
      } else {
        setSortOrder('desc');
      }
    }
  };

  const filteredAndSortedEmperors = useMemo(() => {
    let result = [...ALL_365_EMPERORS];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          emp.dynasty.toLowerCase().includes(q) ||
          (emp.templeName && emp.templeName.toLowerCase().includes(q)) ||
          (emp.givenName && emp.givenName.toLowerCase().includes(q))
      );
    }

    if (selectedDynasty !== 'ALL') {
      result = result.filter(
        (emp) =>
          emp.eraGroup === selectedDynasty ||
          emp.dynasty.includes(selectedDynasty) ||
          (selectedDynasty === '遼・金・西夏' && (emp.dynasty.includes('遼') || emp.dynasty.includes('金') || emp.dynasty.includes('西夏') || emp.eraGroup === '遼・金・西夏'))
      );
    }

    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortKey === 'ratio') {
        valA = a.lifespan > 0 ? a.reignYears / a.lifespan : 0;
        valB = b.lifespan > 0 ? b.reignYears / b.lifespan : 0;
      } else if (sortKey === 'name' || sortKey === 'dynasty') {
        valA = a[sortKey] || '';
        valB = b[sortKey] || '';
      } else {
        valA = a[sortKey] ?? 0;
        valB = b[sortKey] ?? 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB, 'ja')
          : valB.localeCompare(valA, 'ja');
      }

      return sortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });

    return result;
  }, [searchTerm, selectedDynasty, sortKey, sortOrder]);

  const displayedEmperors = showAll
    ? filteredAndSortedEmperors
    : filteredAndSortedEmperors.slice(0, 50);

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <span className="material-symbols-outlined text-xs text-[#a08582]/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0 w-4 inline-block text-center">
          unfold_more
        </span>
      );
    }
    return (
      <span className="material-symbols-outlined text-xs text-[#8f000d] ml-1 font-bold shrink-0 w-4 inline-block text-center">
        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bento-card rounded-2xl p-5 md:p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3] border border-[#e2beba]/60 shadow-2xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#cca72f]/20 text-[#856404] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">cake</span>
          </div>
          <div>
            <h2 className="font-serif-title font-bold text-xl md:text-2xl text-[#191c1c]">
              年齢・寿命統計（即位年齢と生涯寿命）
            </h2>
            <p className="text-xs text-[#8e706d] font-medium">
              全365名の即位年齢・寿命・在位期間データ構造解析
            </p>
          </div>
        </div>
        <p className="text-xs md:text-sm text-[#5a403e] max-w-4xl leading-relaxed mt-2">
          皇太后や強力な臣下によって幼くして玉座に就けられた幼帝は短命に終わることが多かった一方、乾隆帝や武則天のような名君・女帝は80歳を超える天寿を全うしました。
        </p>
      </div>

      {/* Top Extremes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Youngest Ascension */}
        <div
          onClick={() => onSelectEmperor(extremes.youngestAscension)}
          className="bento-card rounded-2xl p-5 border border-[#e2beba]/50 bg-white cursor-pointer hover:border-[#8f000d] hover:shadow-xs transition-all group"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase text-[#8e706d] tracking-wider">
              最年少即位記録
            </span>
            <span className="material-symbols-outlined text-[#8f000d]">child_care</span>
          </div>
          <div className="font-serif-title font-bold text-lg text-[#191c1c] group-hover:text-[#8f000d] transition-colors">
            {extremes.youngestAscension.name}
          </div>
          <div className="font-serif-title text-[#8f000d] text-3xl md:text-4xl my-1 font-bold">
            {extremes.youngestAscension.ageAtAscension} <span className="text-sm font-sans text-[#5a403e] font-normal">歳即位</span>
          </div>
          <p className="text-xs text-[#5a403e]">
            {extremes.youngestAscension.dynasty} • 在位 {extremes.youngestAscension.reignYears}年
          </p>
        </div>

        {/* Oldest Ascension */}
        <div
          onClick={() => onSelectEmperor(extremes.oldestAscension)}
          className="bento-card rounded-2xl p-5 border border-[#e2beba]/50 bg-white cursor-pointer hover:border-[#126e0c] hover:shadow-xs transition-all group"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase text-[#8e706d] tracking-wider">
              最高齢即位記録
            </span>
            <span className="material-symbols-outlined text-[#126e0c]">elderly</span>
          </div>
          <div className="font-serif-title font-bold text-lg text-[#191c1c] group-hover:text-[#126e0c] transition-colors">
            {extremes.oldestAscension.name}
          </div>
          <div className="font-serif-title text-[#126e0c] text-3xl md:text-4xl my-1 font-bold">
            {extremes.oldestAscension.ageAtAscension} <span className="text-sm font-sans text-[#5a403e] font-normal">歳即位</span>
          </div>
          <p className="text-xs text-[#5a403e]">
            {extremes.oldestAscension.dynasty} • 寿命 {extremes.oldestAscension.lifespan}歳
          </p>
        </div>

        {/* Longest Lifespan */}
        <div
          onClick={() => onSelectEmperor(extremes.longestLifespan)}
          className="bento-card rounded-2xl p-5 border border-[#e2beba]/50 bg-white cursor-pointer hover:border-[#cca72f] hover:shadow-xs transition-all group"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase text-[#8e706d] tracking-wider">
              最高寿（最長寿命）
            </span>
            <span className="material-symbols-outlined text-[#cca72f]">auto_awesome</span>
          </div>
          <div className="font-serif-title font-bold text-lg text-[#191c1c] group-hover:text-[#cca72f] transition-colors">
            {extremes.longestLifespan.name}
          </div>
          <div className="font-serif-title text-[#735c00] text-3xl md:text-4xl my-1 font-bold">
            {extremes.longestLifespan.lifespan} <span className="text-sm font-sans text-[#5a403e] font-normal">歳崩御</span>
          </div>
          <p className="text-xs text-[#5a403e]">
            {extremes.longestLifespan.dynasty} • 在位 {extremes.longestLifespan.reignYears}年
          </p>
        </div>
      </div>

      {/* Age Comparative Table */}
      <div className="bento-card rounded-2xl p-5 md:p-6 bg-white border border-[#e2beba]/60 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-[#e2beba]/40">
          <div>
            <h3 className="font-serif-title font-bold text-lg text-[#191c1c]">
              皇帝別 年齢・在位期間比較マトリクス
            </h3>
            <p className="text-xs text-[#8e706d] mt-0.5">
              全{ALL_365_EMPERORS.length}名中 該当 {filteredAndSortedEmperors.length}名
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setSortKey('ageAtAscension');
                setSortOrder('asc');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                sortKey === 'ageAtAscension' && sortOrder === 'asc'
                  ? 'bg-[#8f000d] text-white border-[#8f000d]'
                  : 'bg-[#fdfbf7] text-[#5a403e] border-[#e2beba]/50 hover:bg-[#8f000d]/10'
              }`}
            >
              幼帝順 (昇順)
            </button>
            <button
              onClick={() => {
                setSortKey('ageAtAscension');
                setSortOrder('desc');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                sortKey === 'ageAtAscension' && sortOrder === 'desc'
                  ? 'bg-[#8f000d] text-white border-[#8f000d]'
                  : 'bg-[#fdfbf7] text-[#5a403e] border-[#e2beba]/50 hover:bg-[#8f000d]/10'
              }`}
            >
              高齢即位 (降順)
            </button>
            <button
              onClick={() => {
                setSortKey('lifespan');
                setSortOrder('desc');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                sortKey === 'lifespan' && sortOrder === 'desc'
                  ? 'bg-[#126e0c] text-white border-[#126e0c]'
                  : 'bg-[#fdfbf7] text-[#5a403e] border-[#e2beba]/50 hover:bg-[#126e0c]/10'
              }`}
            >
              長寿順 (降順)
            </button>
            <button
              onClick={() => {
                setSortKey('reignYears');
                setSortOrder('desc');
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                sortKey === 'reignYears' && sortOrder === 'desc'
                  ? 'bg-[#cca72f] text-white border-[#cca72f]'
                  : 'bg-[#fdfbf7] text-[#5a403e] border-[#e2beba]/50 hover:bg-[#cca72f]/10'
              }`}
            >
              在位年数 (降順)
            </button>
          </div>
        </div>

        {/* Filters and Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 bg-[#fdfbf7] p-3 rounded-xl border border-[#e2beba]/40">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-base text-[#8e706d]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="皇帝名・廟号・王朝名で検索..."
              className="w-full pl-8 pr-3 py-1.5 bg-white rounded-lg border border-[#e2beba]/60 text-xs text-[#191c1c] placeholder-[#a08582] focus:outline-none focus:border-[#8f000d]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-xs text-[#8e706d] hover:text-[#191c1c]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dynasty Select */}
          <div className="flex items-center gap-2">
            <select
              value={selectedDynasty}
              onChange={(e) => setSelectedDynasty(e.target.value)}
              className="px-3 py-1.5 bg-white rounded-lg border border-[#e2beba]/60 text-xs text-[#191c1c] focus:outline-none focus:border-[#8f000d] cursor-pointer"
            >
              {DYNASTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>

            {/* Sort Key Select */}
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-3 py-1.5 bg-white rounded-lg border border-[#e2beba]/60 text-xs text-[#191c1c] focus:outline-none focus:border-[#8f000d] cursor-pointer font-medium"
            >
              <option value="ageAtAscension">並び替え: 即位年齢</option>
              <option value="lifespan">並び替え: 生涯寿命</option>
              <option value="reignYears">並び替え: 在位年数</option>
              <option value="ratio">並び替え: 在位比率</option>
              <option value="name">並び替え: 皇帝名</option>
              <option value="dynasty">並び替え: 王朝</option>
            </select>

            {/* Asc / Desc Toggle Button */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#e2beba]/60 hover:bg-[#8f000d]/10 text-[#8f000d] rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              title={sortOrder === 'asc' ? '昇順（低→高）' : '降順（高→低）'}
            >
              <span className="material-symbols-outlined text-base">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
              <span>{sortOrder === 'asc' ? '昇順' : '降順'}</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b-2 border-[#e2beba] text-[#5a403e] font-bold uppercase tracking-wider bg-[#f9f8f5]">
                <th
                  onClick={() => handleSort('name')}
                  className="w-[22%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors rounded-tl-lg group"
                >
                  <div className="flex items-center">
                    <span className="truncate">皇帝名</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dynasty')}
                  className="w-[14%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors group"
                >
                  <div className="flex items-center">
                    <span className="truncate">王朝</span>
                    {getSortIcon('dynasty')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ageAtAscension')}
                  className="w-[15%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors text-right sm:text-left group"
                >
                  <div className="flex items-center justify-end sm:justify-start">
                    <span className="truncate">即位年齢</span>
                    {getSortIcon('ageAtAscension')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lifespan')}
                  className="w-[15%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors text-right sm:text-left group"
                >
                  <div className="flex items-center justify-end sm:justify-start">
                    <span className="truncate">生涯寿命</span>
                    {getSortIcon('lifespan')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('reignYears')}
                  className="w-[15%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors text-right sm:text-left group"
                >
                  <div className="flex items-center justify-end sm:justify-start">
                    <span className="truncate">在位年数</span>
                    {getSortIcon('reignYears')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('ratio')}
                  className="w-[19%] py-2.5 px-3 cursor-pointer hover:bg-[#e2beba]/20 transition-colors rounded-tr-lg group"
                >
                  <div className="flex items-center">
                    <span className="truncate">人生における在位比率</span>
                    {getSortIcon('ratio')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edeeed]">
              {displayedEmperors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#8e706d]">
                    該当する皇帝が見つかりませんでした。
                  </td>
                </tr>
              ) : (
                displayedEmperors.map((emp) => {
                  const ratio = emp.lifespan > 0 ? Math.round((emp.reignYears / emp.lifespan) * 100) : 0;
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => onSelectEmperor(emp)}
                      className="hover:bg-[#fdfbf7] cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-semibold text-[#191c1c] group-hover:text-[#8f000d] truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{emp.name}</span>
                          {emp.templeName && (
                            <span className="text-[10px] font-normal text-[#8e706d] hidden sm:inline shrink-0">
                              ({emp.templeName})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#5a403e] truncate">
                        <span className="px-2 py-0.5 rounded bg-[#f4ebe1] text-[#5a403e] text-[11px] font-medium inline-block truncate max-w-full">
                          {emp.dynasty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#8f000d] text-right sm:text-left whitespace-nowrap">
                        {emp.ageAtAscension} 歳
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#126e0c] text-right sm:text-left">
                        {emp.lifespan} 歳
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right sm:text-left">
                        {emp.reignYears} 年
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-[#e7e8e7] rounded-full h-2 overflow-hidden shrink-0">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                ratio >= 50
                                  ? 'bg-[#8f000d]'
                                  : ratio >= 25
                                  ? 'bg-[#cca72f]'
                                  : 'bg-[#2b5c8f]'
                              }`}
                              style={{ width: `${Math.min(ratio, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-[#5a403e] font-semibold">
                            {ratio}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Show More / Show All Pagination Button */}
        {filteredAndSortedEmperors.length > 50 && (
          <div className="mt-4 pt-3 border-t border-[#e2beba]/30 flex items-center justify-between text-xs text-[#8e706d]">
            <div>
              表示中: {displayedEmperors.length} / {filteredAndSortedEmperors.length} 名
            </div>
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8f000d]/10 hover:bg-[#8f000d] text-[#8f000d] hover:text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">
                {showAll ? 'unfold_less' : 'unfold_more'}
              </span>
              <span>
                {showAll ? '50名表示にたたむ' : `全${filteredAndSortedEmperors.length}名を一覧表示`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
