import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ActiveTab, Emperor } from '../types';
import { EMPERORS_DATA } from '../data/emperors';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onSelectEmperor: (emperor: Emperor) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onSelectEmperor,
}) => {
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

  const navItems: { id: ActiveTab; label: string; icon: string; count?: string }[] = [
    { id: 'dashboard', label: '概要ダッシュボード', icon: 'dashboard' },
    { id: 'emperor-list', label: '皇帝一覧', icon: 'group', count: '365名' },
    { id: 'timeline', label: 'タイムライン', icon: 'view_timeline', count: '年表' },
    { id: 'family-tree', label: '系譜・家系図', icon: 'account_tree', count: '全12章' },
    { id: 'death-causes', label: '死因分析', icon: 'skull', count: '5分類' },
    { id: 'military', label: '軍事行動', icon: 'swords', count: '4遠征' },
    { id: 'age', label: '年齢統計', icon: 'cake', count: '分析' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 sidebar-gradient p-4 overflow-y-auto z-40 backdrop-blur-sm border-r border-[#e2beba]/30 shrink-0 sticky top-0 self-start h-screen">
      {/* Top Title & Logo */}
      <div className="flex items-center gap-3 px-1 py-2 mb-2 border-b border-[#e2beba]/40">
        <div className="w-9 h-9 bg-[#8f000d] text-white rounded-lg font-serif-title font-bold text-xl flex items-center justify-center shadow-xs shrink-0 select-none border border-[#8f000d]/20">
          帝
        </div>
        <h1 className="font-serif-title font-bold text-lg md:text-xl text-[#191c1c] tracking-tight whitespace-nowrap">
          中国皇帝統計
        </h1>
      </div>

      {/* Search Input in Sidebar */}
      <div className="relative mb-3 px-1" ref={searchRef}>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a403e] text-base pointer-events-none">
            search
          </span>
          <input
            type="text"
            className="w-full pl-8 pr-6 py-1.5 bg-white/80 border border-[#e2beba] rounded-lg text-xs focus:outline-none focus:border-[#cca72f] focus:ring-1 focus:ring-[#cca72f] transition-all shadow-inner text-[#191c1c] placeholder:text-[#8e706d]"
            placeholder="皇帝・王朝名等で検索..."
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8e706d] hover:text-[#8f000d] text-xs font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isSearchOpen && filteredEmperors.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white/95 backdrop-blur-md rounded-xl border border-[#e2beba] shadow-xl max-h-72 overflow-y-auto z-50 py-1">
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
                className="w-full text-left px-3 py-2 hover:bg-[#f3f4f3] transition-colors flex items-center justify-between border-b border-[#f3f4f3] last:border-none group cursor-pointer"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="w-6 h-6 rounded-full bg-[#8f000d]/10 text-[#8f000d] font-bold text-xs flex items-center justify-center font-serif-title shrink-0">
                    {emp.dynastyKanji}
                  </span>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-[#191c1c] group-hover:text-[#8f000d] transition-colors truncate">
                      {emp.name}
                    </div>
                    <div className="text-[10px] text-[#5a403e] truncate">
                      {emp.dynasty} ({emp.reignPeriod})
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {isSearchOpen && searchQuery && filteredEmperors.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#e2beba] shadow-xl p-3 text-center text-xs text-[#5a403e] z-50">
            一致する皇帝が見つかりません
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex flex-col gap-1.5 flex-grow">
        {navItems.map((item, index) => {
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ x: 4, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors duration-200 cursor-pointer ${
                isActive
                  ? 'text-[#8f000d] font-bold shadow-xs'
                  : 'text-[#5a403e] hover:bg-[#e1e3e2]/50 hover:text-[#191c1c]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActivePill"
                  className="absolute inset-0 bg-gradient-to-r from-[#8f000d]/15 via-[#cca72f]/15 to-[#8f000d]/10 border border-[#8f000d]/30 rounded-xl shadow-2xs"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3">
                <span
                  className={`material-symbols-outlined text-xl transition-colors ${
                    isActive ? 'text-[#8f000d]' : 'text-[#8e706d]'
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.count && (
                <span
                  className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-[#8f000d]/15 text-[#8f000d] font-bold'
                      : 'bg-[#edeeed] text-[#8e706d]'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );
};


