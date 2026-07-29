import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ActiveTab, Emperor } from './types';
import { ParticleBackground } from './components/ParticleBackground';
import { Sidebar } from './components/Sidebar';
import { EmperorModal } from './components/EmperorModal';

import { DashboardView } from './components/views/DashboardView';
import { EmperorListView } from './components/views/EmperorListView';
import { DeathCausesView } from './components/views/DeathCausesView';
import { PalaceEventsView } from './components/views/PalaceEventsView';
import { MilitaryView } from './components/views/MilitaryView';
import { AgeView } from './components/views/AgeView';
import { GenealogyView } from './components/views/GenealogyView';
import { TimelineView } from './components/views/TimelineView';
import { GenealogyTreeView } from './components/views/GenealogyTreeView';
import { AboutView } from './components/views/AboutView';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedEmperor, setSelectedEmperor] = useState<Emperor | null>(null);
  const [isTreeFullscreen, setIsTreeFullscreen] = useState<boolean>(false);

  const handleSelectEmperor = React.useCallback((emp: Emperor) => {
    setSelectedEmperor(emp);
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'family-tree') {
      setIsTreeFullscreen(false);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen flex flex-col relative text-[#191c1c] selection:bg-[#8f000d] selection:text-white">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Mobile Top Header (Minimal Title Bar) */}
      {!isTreeFullscreen && (
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#f9f9f8]/95 backdrop-blur-md border-b border-[#e2beba]/50 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#8f000d] text-white rounded-lg font-serif-title font-bold text-lg flex items-center justify-center shrink-0 border border-[#8f000d]/20 select-none">
              帝
            </div>
            <h1 className="font-serif-title font-bold text-base text-[#191c1c] tracking-tight whitespace-nowrap">
              中国皇帝統計
            </h1>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-1 min-h-screen">
        {/* Sidebar (Desktop) */}
        {!isTreeFullscreen && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onSelectEmperor={handleSelectEmperor}
          />
        )}

        {/* Content Area */}
        <div className={`flex-1 flex flex-col justify-between z-10 ${isTreeFullscreen ? 'p-0 overflow-hidden' : 'pb-16 lg:pb-0 overflow-y-auto'}`}>
          <main className={isTreeFullscreen ? 'w-full h-full p-0 max-w-none' : 'py-4 md:py-8 px-3 sm:px-6 md:px-10 max-w-[1440px] mx-auto w-full'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={isTreeFullscreen ? 'h-full w-full' : ''}
              >
                {activeTab === 'dashboard' && (
                  <DashboardView
                    onSelectEmperor={handleSelectEmperor}
                  />
                )}
                {activeTab === 'emperor-list' && (
                  <EmperorListView
                    onSelectEmperor={handleSelectEmperor}
                  />
                )}
                {activeTab === 'timeline' && (
                  <TimelineView onSelectEmperor={handleSelectEmperor} />
                )}
                {activeTab === 'family-tree' && (
                  <GenealogyTreeView
                    onSelectEmperor={handleSelectEmperor}
                    onFullscreenChange={(fs) => setIsTreeFullscreen(fs)}
                  />
                )}
                {activeTab === 'death-causes' && (
                  <DeathCausesView onSelectEmperor={handleSelectEmperor} />
                )}
                {activeTab === 'palace-events' && (
                  <PalaceEventsView onSelectEmperor={handleSelectEmperor} />
                )}
                {activeTab === 'military' && (
                  <MilitaryView onSelectEmperor={handleSelectEmperor} />
                )}
                {activeTab === 'age' && (
                  <AgeView onSelectEmperor={handleSelectEmperor} />
                )}
                {activeTab === 'genealogy' && <GenealogyView />}
                {activeTab === 'about' && <AboutView />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Footer */}
          {!isTreeFullscreen && (
            <footer className="w-full py-4 px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#f9f9f8]/90 backdrop-blur-md border-t border-[#e2beba]/50 text-xs text-[#5a403e] mt-auto relative z-10">
              <p className="font-medium text-[#5a403e]">
                © 2024 中国歴代皇帝統計 画像 パブリックドメイン／CC0
              </p>
              <button
                onClick={() => setActiveTab('about')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'about'
                    ? 'bg-[#8f000d]/10 text-[#8f000d] font-bold'
                    : 'text-[#8f000d] hover:bg-[#8f000d]/5 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-base">info</span>
                このサイトについて
              </button>
            </footer>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {!isTreeFullscreen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2beba]/60 flex items-center justify-around py-1.5 px-1 shadow-lg overflow-x-auto">
          {[
            { id: 'dashboard', label: '概要', icon: 'dashboard' },
            { id: 'emperor-list', label: '皇帝一覧', icon: 'group' },
            { id: 'timeline', label: '年表', icon: 'view_timeline' },
            { id: 'family-tree', label: '系譜図', icon: 'account_tree' },
            { id: 'death-causes', label: '死因', icon: 'skull' },
            { id: 'military', label: '軍事', icon: 'swords' },
            { id: 'age', label: '年齢', icon: 'cake' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`relative flex flex-col items-center justify-center min-w-[48px] py-1 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#8f000d] font-bold'
                    : 'text-[#8e706d] hover:text-[#191c1c]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    className="absolute inset-0 bg-gradient-to-r from-[#8f000d]/15 via-[#cca72f]/15 to-[#8f000d]/10 rounded-xl border border-[#8f000d]/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className={`material-symbols-outlined text-xl z-10 ${isActive ? 'text-[#8f000d]' : 'text-[#8e706d]'}`}>
                  {item.icon}
                </span>
                <span className="text-[10px] leading-tight z-10 whitespace-nowrap mt-0.5">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Emperor Details Modal */}
      <EmperorModal
        emperor={selectedEmperor}
        onClose={() => setSelectedEmperor(null)}
      />
    </div>
  );
}


