import React, { useState, useRef, useEffect } from 'react';
import { Emperor } from '../types';
import { EMPERORS_DATA } from '../data/emperors';

interface HeaderProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSelectEmperor }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredEmperors = searchQuery.trim()
    ? EMPERORS_DATA.filter(
        (e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.dynasty.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.dynastyKanji.includes(searchQuery) ||
          e.givenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.templeName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-10 h-20 bg-gradient-to-r from-[#f9f9f8]/90 via-[#fffaf9]/95 to-[#f9f9f8]/90 backdrop-blur-md border-b border-[#e2beba]/50 transition-all shadow-xs">
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#8f000d] text-white rounded-lg font-serif-title font-bold text-lg sm:text-xl flex items-center justify-center shadow-xs shrink-0 select-none border border-[#8f000d]/20">
            帝
          </div>
          <h1 className="font-serif-title font-bold text-base sm:text-lg md:text-xl text-[#191c1c] tracking-tight whitespace-nowrap">
            中国皇帝統計
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Search Bar */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5a403e] text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              className="pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 bg-white/80 border border-[#e2beba] rounded-full text-xs md:text-sm focus:outline-none focus:border-[#cca72f] focus:ring-1 focus:ring-[#cca72f] w-36 sm:w-60 md:w-80 transition-all shadow-inner text-[#191c1c] placeholder:text-[#8e706d]"
              placeholder="皇帝名・王朝名等で検索..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e706d] hover:text-[#8f000d] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && filteredEmperors.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur-md rounded-xl border border-[#e2beba] shadow-xl max-h-80 overflow-y-auto z-50 py-2">
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-[#8e706d] tracking-wider border-b border-[#edeeed]">
                検索結果 ({filteredEmperors.length}件)
              </div>
              {filteredEmperors.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    onSelectEmperor(emp);
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#f3f4f3] transition-colors flex items-center justify-between border-b border-[#f3f4f3] last:border-none group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#8f000d]/10 text-[#8f000d] font-bold text-xs flex items-center justify-center font-serif-title">
                      {emp.dynastyKanji}
                    </span>
                    <div>
                      <div className="text-xs md:text-sm font-semibold text-[#191c1c] group-hover:text-[#8f000d] transition-colors">
                        {emp.name}
                      </div>
                      <div className="text-[11px] text-[#5a403e]">
                        {emp.dynasty} • 在位 {emp.reignYears}年 ({emp.reignPeriod})
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#cca72f]/15 text-[#735c00] font-semibold">
                    {emp.causeOfDeathCategory}
                  </span>
                </button>
              ))}
            </div>
          )}

          {isSearchOpen && searchQuery && filteredEmperors.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-[#e2beba] shadow-xl p-4 text-center text-xs text-[#5a403e] z-50">
              「{searchQuery}」に一致する皇帝記録は見つかりませんでした。
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

