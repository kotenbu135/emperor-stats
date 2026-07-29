import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Emperor } from '../../types';
import { EMPERORS_DATA } from '../../data/emperors';
import { getDynastyColor } from '../../utils/dynastyColors';

interface TimelineViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

interface DynastySpan {
  id: string;
  name: string;
  kanji: string;
  startYear: number;
  endYear: number;
  periodText: string;
  capital: string;
  emperorCount: number;
  color: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  category: 'unified' | 'divided' | 'regional';
  eraGroup: string;
  description: string;
  row: number; // For vertical placement in multi-track timeline
}

const DYNASTY_TIMELINE_DATA: DynastySpan[] = [
  {
    id: 'qin',
    name: '秦',
    kanji: '秦',
    startYear: -221,
    endYear: -206,
    periodText: '前221–前206年',
    capital: '咸陽',
    emperorCount: 3,
    color: '#8f000d',
    bgGradient: 'from-[#8f000d] to-[#b31217]',
    borderColor: '#8f000d',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '秦',
    description: '始皇帝による史上初の中国統一。皇帝号の創始、度量衡・文字の統一を実施。',
    row: 1,
  },
  {
    id: 'western-han',
    name: '前漢',
    kanji: '漢',
    startYear: -202,
    endYear: 9,
    periodText: '前202–9年',
    capital: '長安',
    emperorCount: 14,
    color: '#cca72f',
    bgGradient: 'from-[#e0b833] to-[#b8860b]',
    borderColor: '#b8860b',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '前漢',
    description: '劉邦が創業。武帝期に匈奴撃退やシルクロード開拓、儒教の国教化を達成。',
    row: 1,
  },
  {
    id: 'xin',
    name: '新',
    kanji: '新',
    startYear: 9,
    endYear: 23,
    periodText: '9–23年',
    capital: '長安',
    emperorCount: 1,
    color: '#3b82f6',
    bgGradient: 'from-[#3b82f6] to-[#1d4ed8]',
    borderColor: '#1d4ed8',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '前漢',
    description: '王莽が前漢を簒奪し建国。急進的な古制復古改革を行うも赤眉・緑林の乱で崩壊。',
    row: 1,
  },
  {
    id: 'eastern-han',
    name: '後漢',
    kanji: '漢',
    startYear: 25,
    endYear: 220,
    periodText: '25–220年',
    capital: '洛陽',
    emperorCount: 14,
    color: '#eab308',
    bgGradient: 'from-[#facc15] to-[#ca8a04]',
    borderColor: '#ca8a04',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '後漢',
    description: '光武帝（劉秀）が漢王朝を再興（光武中興）。紙の発明や班超の西域平定で栄えた。',
    row: 1,
  },
  // 三国時代
  {
    id: 'wei',
    name: '魏',
    kanji: '魏',
    startYear: 220,
    endYear: 265,
    periodText: '220–265年',
    capital: '洛陽',
    emperorCount: 5,
    color: '#0284c7',
    bgGradient: 'from-[#0284c7] to-[#0369a1]',
    borderColor: '#0284c7',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '三国',
    description: '曹丕が禅譲を受け建国。中原を支配し九品官人法を制定。司馬氏に奪権される。',
    row: 1,
  },
  {
    id: 'shu',
    name: '蜀漢',
    kanji: '蜀',
    startYear: 221,
    endYear: 263,
    periodText: '221–263年',
    capital: '成都',
    emperorCount: 2,
    color: '#ca8a04',
    bgGradient: 'from-[#f1c40f] to-[#d4ac0d]',
    borderColor: '#ca8a04',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '三国',
    description: '劉備が漢朝の正統を掲げ四川で即位。諸葛孔明の北伐で知られる。',
    row: 2,
  },
  {
    id: 'wu',
    name: '呉',
    kanji: '呉',
    startYear: 222,
    endYear: 280,
    periodText: '222–280年',
    capital: '建業',
    emperorCount: 4,
    color: '#16a34a',
    bgGradient: 'from-[#22c55e] to-[#15803d]',
    borderColor: '#16a34a',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '三国',
    description: '孫権が江南に拠り独立。赤壁の戦いを経て江南の開発を大きく進めた。',
    row: 3,
  },
  // 晋・五胡十六国
  {
    id: 'western-jin',
    name: '西晋',
    kanji: '晋',
    startYear: 265,
    endYear: 316,
    periodText: '265–316年',
    capital: '洛陽',
    emperorCount: 4,
    color: '#6366f1',
    bgGradient: 'from-[#6366f1] to-[#4338ca]',
    borderColor: '#4338ca',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '西晋',
    description: '司馬炎が三国を統一。八王の乱・永嘉の乱により急速に衰退し五胡が華北侵入。',
    row: 1,
  },
  {
    id: 'eastern-jin',
    name: '東晋',
    kanji: '晋',
    startYear: 317,
    endYear: 420,
    periodText: '317–420年',
    capital: '建康',
    emperorCount: 11,
    color: '#8b5cf6',
    bgGradient: 'from-[#a855f7] to-[#7e22ce]',
    borderColor: '#7e22ce',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '五胡十六国',
    description: '司馬睿が江南に東晋を建国。淝水の戦いで前秦を撃退し江南貴族文化が花開く。',
    row: 2,
  },
  {
    id: 'sixteen-kingdoms',
    name: '五胡十六国',
    kanji: '胡',
    startYear: 304,
    endYear: 439,
    periodText: '304–439年',
    capital: '各地',
    emperorCount: 20,
    color: '#94a3b8',
    bgGradient: 'from-[#cbd5e1] to-[#64748b]',
    borderColor: '#64748b',
    textColor: '#1e293b',
    category: 'divided',
    eraGroup: '五胡十六国',
    description: '匈奴・鮮卑・羯・氐・羌の5民族が華北で16以上の政権を乱立させた大動乱期。',
    row: 1,
  },
  // 南北朝
  {
    id: 'northern-wei',
    name: '北魏',
    kanji: '魏',
    startYear: 386,
    endYear: 535,
    periodText: '386–535年',
    capital: '平城→洛陽',
    emperorCount: 18,
    color: '#3b82f6',
    bgGradient: 'from-[#60a5fa] to-[#1d4ed8]',
    borderColor: '#1d4ed8',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '南北朝',
    description: '鮮卑拓跋氏が華北を統一。孝文帝による漢化政策・均田制が後の隋唐の礎。',
    row: 1,
  },
  {
    id: 'northern-qi',
    name: '北斉・北周',
    kanji: '斉周',
    startYear: 535,
    endYear: 581,
    periodText: '535–581年',
    capital: '鄴・長安',
    emperorCount: 10,
    color: '#0ea5e9',
    bgGradient: 'from-[#38bdf8] to-[#0369a1]',
    borderColor: '#0369a1',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '南北朝',
    description: '東魏・西魏から派生。北周が北斉を滅ぼし華北を再統一、隋の基盤に。',
    row: 1,
  },
  {
    id: 'southern-dynasties',
    name: '南朝 (宋・斉・梁・陳)',
    kanji: '南朝',
    startYear: 420,
    endYear: 589,
    periodText: '420–589年',
    capital: '建康',
    emperorCount: 26,
    color: '#10b981',
    bgGradient: 'from-[#34d399] to-[#047857]',
    borderColor: '#047857',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '南北朝',
    description: '宋・斉・梁・陳の4王朝が建康（南京）に都し江南文化と仏教文化を継承発展。',
    row: 2,
  },
  // 隋・唐
  {
    id: 'sui',
    name: '隋',
    kanji: '隋',
    startYear: 581,
    endYear: 618,
    periodText: '581–618年',
    capital: '大興城(長安)',
    emperorCount: 3,
    color: '#059669',
    bgGradient: 'from-[#10b981] to-[#047857]',
    borderColor: '#047857',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '随',
    description: '楊堅が約300年ぶりに中国を再統一。科挙制度創始、大運河建設を達成。',
    row: 1,
  },
  {
    id: 'tang',
    name: '唐',
    kanji: '唐',
    startYear: 618,
    endYear: 907,
    periodText: '618–907年',
    capital: '長安・洛陽',
    emperorCount: 24,
    color: '#eab308',
    bgGradient: 'from-[#facc15] to-[#ca8a04]',
    borderColor: '#ca8a04',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '唐',
    description: '李淵・太宗（貞観の治）・玄宗（開元の治）らの治世で東アジア国際帝国の頂点へ。',
    row: 1,
  },
  {
    id: 'wuzhou',
    name: '武周 (武則天)',
    kanji: '周',
    startYear: 690,
    endYear: 705,
    periodText: '690–705年',
    capital: '神都(洛陽)',
    emperorCount: 1,
    color: '#ec4899',
    bgGradient: 'from-[#f472b6] to-[#be185d]',
    borderColor: '#be185d',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '唐',
    description: '中国史上唯一の女性皇帝・武則天が国号を周に改称。科挙出身官僚を重用。',
    row: 2,
  },
  // 五代十国
  {
    id: 'five-dynasties',
    name: '五代',
    kanji: '五代',
    startYear: 907,
    endYear: 960,
    periodText: '907–960年',
    capital: '開封等',
    emperorCount: 14,
    color: '#f97316',
    bgGradient: 'from-[#fb923c] to-[#c2410c]',
    borderColor: '#c2410c',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '五代十国',
    description: '後梁・後唐・後晋・後漢・後周の5興亡。武臣政治から文治政治への転換期。',
    row: 1,
  },
  {
    id: 'ten-kingdoms',
    name: '十国',
    kanji: '十国',
    startYear: 902,
    endYear: 979,
    periodText: '902–979年',
    capital: '各地',
    emperorCount: 20,
    color: '#a8a29e',
    bgGradient: 'from-[#d6d3d1] to-[#78716c]',
    borderColor: '#78716c',
    textColor: '#1c1917',
    category: 'divided',
    eraGroup: '五代十国',
    description: '主に南方で自立した10個の独立政権。南唐や呉越などが経済・文化を発展。',
    row: 2,
  },
  // 宋・北方王朝
  {
    id: 'northern-song',
    name: '北宋',
    kanji: '宋',
    startYear: 960,
    endYear: 1127,
    periodText: '960–1127年',
    capital: '開封',
    emperorCount: 9,
    color: '#16a34a',
    bgGradient: 'from-[#22c55e] to-[#15803d]',
    borderColor: '#15803d',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '宋',
    description: '趙匡胤が建国。文治主義、三大発明（羅針盤・火薬・印刷術）、商業経済の発展。',
    row: 1,
  },
  {
    id: 'southern-song',
    name: '南宋',
    kanji: '宋',
    startYear: 1127,
    endYear: 1279,
    periodText: '1127–1279年',
    capital: '臨安(杭州)',
    emperorCount: 9,
    color: '#15803d',
    bgGradient: 'from-[#16a34a] to-[#14532d]',
    borderColor: '#14532d',
    textColor: '#ffffff',
    category: 'divided',
    eraGroup: '宋',
    description: '靖康の変ののち高宗が江南で再興。海外貿易と朱子学が隆盛。1279年崖山で滅亡。',
    row: 2,
  },
  {
    id: 'liao',
    name: '遼',
    kanji: '遼',
    startYear: 916,
    endYear: 1125,
    periodText: '916–1125年',
    capital: '上京臨潢府',
    emperorCount: 9,
    color: '#38bdf8',
    bgGradient: 'from-[#38bdf8] to-[#0284c7]',
    borderColor: '#0284c7',
    textColor: '#ffffff',
    category: 'regional',
    eraGroup: '遼・金・西夏',
    description: '契丹族の耶律阿保機が建国。燕雲十六州を占領し二重統治体制を敷いた。',
    row: 1,
  },
  {
    id: 'western-xia',
    name: '西夏',
    kanji: '夏',
    startYear: 1038,
    endYear: 1227,
    periodText: '1038–1227年',
    capital: '興慶府',
    emperorCount: 10,
    color: '#a855f7',
    bgGradient: 'from-[#c084fc] to-[#7e22ce]',
    borderColor: '#7e22ce',
    textColor: '#ffffff',
    category: 'regional',
    eraGroup: '遼・金・西夏',
    description: 'タングート族の李元昊が河西回廊に建国。西夏文字を創造し独自の仏教文化を発展。',
    row: 3,
  },
  {
    id: 'jin-dynasty',
    name: '金',
    kanji: '金',
    startYear: 1115,
    endYear: 1234,
    periodText: '1115–1234年',
    capital: '会寧府→中都(北京)',
    emperorCount: 10,
    color: '#8b5cf6',
    bgGradient: 'from-[#a855f7] to-[#6b21a8]',
    borderColor: '#6b21a8',
    textColor: '#ffffff',
    category: 'regional',
    eraGroup: '遼・金・西夏',
    description: '女真族の完顔阿骨打が遼と北宋を滅ぼし華北を支配。モンゴル帝国に滅ぼされる。',
    row: 1,
  },
  // 元
  {
    id: 'yuan',
    name: '元',
    kanji: '元',
    startYear: 1271,
    endYear: 1368,
    periodText: '1271–1368年',
    capital: '大都(北京)',
    emperorCount: 11,
    color: '#2563eb',
    bgGradient: 'from-[#3b82f6] to-[#1d4ed8]',
    borderColor: '#1d4ed8',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '元',
    description: 'クビライが国号を元とし、1279年全中国を統一。ユーラシア規模の東西交流。',
    row: 1,
  },
  // 明
  {
    id: 'ming',
    name: '明',
    kanji: '明',
    startYear: 1368,
    endYear: 1644,
    periodText: '1368–1644年',
    capital: '応天府(南京)→順天府(北京)',
    emperorCount: 16,
    color: '#ef4444',
    bgGradient: 'from-[#f87171] to-[#dc2626]',
    borderColor: '#dc2626',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '明',
    description: '朱元璋（洪武帝）が元を北へ追いやり漢民族王朝を回復。鄭和の大遠征や紫禁城建設。',
    row: 1,
  },
  // 清
  {
    id: 'qing',
    name: '清',
    kanji: '清',
    startYear: 1636,
    endYear: 1912,
    periodText: '1636–1912年',
    capital: '盛京(瀋陽)→北京',
    emperorCount: 12,
    color: '#0284c7',
    bgGradient: 'from-[#38bdf8] to-[#0369a1]',
    borderColor: '#0369a1',
    textColor: '#ffffff',
    category: 'unified',
    eraGroup: '清',
    description: '満洲族の愛新覚羅氏が建国。康熙・雍正・乾隆の全盛期を経て巨大な領域を統治。1912年辛亥革命で退位。',
    row: 1,
  },
];

const MAJOR_EVENTS = [
  { year: -221, label: '前221 秦が天下統一', era: '秦' },
  { year: -202, label: '前202 劉邦が前漢建国', era: '前漢' },
  { year: 25, label: '25 光武帝が後漢建国', era: '後漢' },
  { year: 220, label: '220 後漢滅亡・三国へ', era: '三国' },
  { year: 280, label: '280 西晋が再統一', era: '西晋' },
  { year: 317, label: '317 五胡十六国・東晋', era: '五胡十六国' },
  { year: 439, label: '439 北魏が華北を統一', era: '南北朝' },
  { year: 589, label: '589 随が南北を再統一', era: '随' },
  { year: 690, label: '690 武則天・唯一の女帝', era: '唐' },
  { year: 755, label: '755 安史の乱', era: '唐' },
  { year: 907, label: '907 唐滅亡・五代十国', era: '五代十国' },
  { year: 960, label: '960 北宋建国', era: '宋' },
  { year: 1127, label: '1127 靖康の変・宋が南遷', era: '宋' },
  { year: 1279, label: '1279 元が南宋を滅ぼし統一', era: '元' },
  { year: 1368, label: '1368 明建国・元は北走', era: '明' },
  { year: 1644, label: '1644 明滅亡・清が入関', era: '清' },
  { year: 1912, label: '1912 宣統帝退位・帝制終焉', era: '清' },
];

const ERA_GROUPS = [
  { name: '秦', period: '前221年–前206年', range: [-221, -206] },
  { name: '前漢', period: '前202年–8年', range: [-202, 8] },
  { name: '後漢', period: '25年–220年', range: [25, 220] },
  { name: '三国', period: '220年–280年', range: [220, 280] },
  { name: '西晋', period: '265年–316年', range: [265, 316] },
  { name: '五胡十六国', period: '304年–439年', range: [304, 439] },
  { name: '南北朝', period: '386年–589年', range: [386, 589] },
  { name: '随', period: '581年–618年', range: [581, 618] },
  { name: '唐', period: '618年–907年', range: [618, 907] },
  { name: '五代十国', period: '907年–960年', range: [907, 960] },
  { name: '宋', period: '960年–1279年', range: [960, 1279] },
  { name: '遼・金・西夏', period: '916年–1234年', range: [916, 1234] },
  { name: '元', period: '1271年–1368年', range: [1271, 1368] },
  { name: '明', period: '1368年–1644年', range: [1368, 1644] },
  { name: '清', period: '1636年–1912年', range: [1636, 1912] },
];

export const TimelineView: React.FC<TimelineViewProps> = ({ onSelectEmperor }) => {
  const [selectedDynasty, setSelectedDynasty] = useState<DynastySpan | null>(null);
  const [selectedEraFilter, setSelectedEraFilter] = useState<string | null>(null);
  const [viewZoom, setViewZoom] = useState<'all' | 'expanded' | 'detail'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Time conversion formula: Total span from -221 to 1912 is 2133 years
  const minYear = -230;
  const maxYear = 1920;
  const totalYears = maxYear - minYear;

  // Scale multiplier based on zoom level
  const pixelsPerYear = viewZoom === 'all' ? 1.6 : viewZoom === 'expanded' ? 3.0 : 5.5;
  const canvasWidth = Math.max(1200, Math.round(totalYears * pixelsPerYear));

  const getLeftPx = (year: number) => {
    return Math.round(((year - minYear) / totalYears) * canvasWidth);
  };

  const getWidthPx = (startYear: number, endYear: number) => {
    const duration = Math.max(8, endYear - startYear);
    return Math.max(28, Math.round((duration / totalYears) * canvasWidth));
  };

  const scrollToEra = (eraName: string) => {
    setSelectedEraFilter(selectedEraFilter === eraName ? null : eraName);
    const era = ERA_GROUPS.find((e) => e.name === eraName);
    if (era && scrollContainerRef.current) {
      const left = getLeftPx(era.range[0]) - 80;
      scrollContainerRef.current.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  };

  // Pre-grouped timeline data by row to avoid repeated filter calls in JSX
  const rowGroups = React.useMemo(() => {
    const r1: DynastySpan[] = [];
    const r2: DynastySpan[] = [];
    const r3: DynastySpan[] = [];
    const r4: DynastySpan[] = [];
    for (let i = 0; i < DYNASTY_TIMELINE_DATA.length; i++) {
      const d = DYNASTY_TIMELINE_DATA[i];
      if (d.row === 1) r1.push(d);
      else if (d.row === 2) r2.push(d);
      else if (d.row === 3) r3.push(d);
      else if (d.row === 4) r4.push(d);
    }
    return { r1, r2, r3, r4 };
  }, []);

  // Find emperors for selected dynasty
  const dynastyEmperors = React.useMemo(() => {
    if (!selectedDynasty) return [];
    return EMPERORS_DATA.filter(
      (e) =>
        e.dynasty === selectedDynasty.name ||
        e.dynastyKanji === selectedDynasty.kanji ||
        (selectedDynasty.name.includes('漢') && e.dynasty.includes('漢')) ||
        (selectedDynasty.name.includes('宋') && e.dynasty.includes('宋')) ||
        (selectedDynasty.name.includes('晋') && e.dynasty.includes('晋'))
    );
  }, [selectedDynasty]);

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="bento-card rounded-2xl p-6 bg-gradient-to-r from-white via-[#f9f9f8] to-[#f3f4f3] border border-[#e2beba]/50 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-2xl text-[#8f000d]">view_timeline</span>
              <h2 className="font-serif-title font-bold text-2xl text-[#191c1c]">
                中国歴代王朝・皇帝クロノロジー（紀元前221年 – 1912年）
              </h2>
            </div>
            <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
              秦の始皇帝統一から清朝滅亡（宣統帝退位）まで2,100年以上にわたる中華王朝の盛衰、興亡、および統一と分裂のリズムを一枚の年表クロノロジーで俯瞰できます。
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0 bg-white/80 p-1.5 rounded-xl border border-[#e2beba]/60">
            <span className="text-xs font-bold text-[#8e706d] px-2">表示範囲:</span>
            <button
              onClick={() => setViewZoom('all')}
              className={`px-3 py-1 text-xs rounded-lg transition-all font-semibold ${
                viewZoom === 'all'
                  ? 'bg-[#8f000d] text-white shadow-xs'
                  : 'text-[#5a403e] hover:bg-[#f3f4f3]'
              }`}
            >
              全体
            </button>
            <button
              onClick={() => setViewZoom('expanded')}
              className={`px-3 py-1 text-xs rounded-lg transition-all font-semibold ${
                viewZoom === 'expanded'
                  ? 'bg-[#8f000d] text-white shadow-xs'
                  : 'text-[#5a403e] hover:bg-[#f3f4f3]'
              }`}
            >
              拡大
            </button>
            <button
              onClick={() => setViewZoom('detail')}
              className={`px-3 py-1 text-xs rounded-lg transition-all font-semibold ${
                viewZoom === 'detail'
                  ? 'bg-[#8f000d] text-white shadow-xs'
                  : 'text-[#5a403e] hover:bg-[#f3f4f3]'
              }`}
            >
              詳細
            </button>
          </div>
        </div>

        {/* Era Jump Buttons */}
        <div className="mt-5 pt-4 border-t border-[#e2beba]/40 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-bold text-[#8f000d] whitespace-nowrap shrink-0">
            時代へ移動:
          </span>
          {ERA_GROUPS.map((era) => {
            const isSelected = selectedEraFilter === era.name;
            return (
              <button
                key={era.name}
                onClick={() => scrollToEra(era.name)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-[#8f000d] text-white border-[#8f000d] shadow-2xs font-bold'
                    : 'bg-white text-[#5a403e] border-[#e2beba]/70 hover:border-[#8f000d]/50 hover:text-[#8f000d]'
                }`}
              >
                {era.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Timeline Card */}
      <div className="bento-card rounded-2xl p-4 sm:p-6 bg-white relative overflow-hidden border border-[#e2beba]/60 shadow-sm">
        <div className="flex items-center justify-between mb-3 text-xs text-[#8e706d]">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#8f000d]" />
            <span>ブロックをクリックで王朝・皇帝詳細表示</span>
          </div>
          <span className="font-semibold text-[#8f000d] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">swipe</span> 横スクロールで続き →
          </span>
        </div>

        {/* Timeline Horizontal Scrollable Stage */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-6 pt-2 scrollbar-thin rounded-xl border border-[#e7e8e7] bg-[#FAF8F5] relative select-none"
        >
          <div style={{ width: `${canvasWidth}px` }} className="relative min-h-[380px] p-4">
            {/* Year Grid Line Markers */}
            {[-200, 0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 1900].map((year) => {
              const leftPx = getLeftPx(year);
              return (
                <div
                  key={year}
                  className="absolute top-0 bottom-0 border-l border-dashed border-[#e2beba]/50 pointer-events-none"
                  style={{ left: `${leftPx}px` }}
                >
                  <span className="absolute top-2 left-1 text-[10px] font-mono font-bold text-[#8e706d] bg-[#FAF8F5]/90 px-1 rounded">
                    {year < 0 ? `前${Math.abs(year)}` : `${year}年`}
                  </span>
                </div>
              );
            })}

            {/* Top Era Range Labels */}
            <div className="h-10 relative border-b border-[#e2beba]/60 mb-6">
              {ERA_GROUPS.map((era) => {
                const leftPx = getLeftPx(era.range[0]);
                const widthPx = getWidthPx(era.range[0], era.range[1]);
                return (
                  <div
                    key={era.name}
                    style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                    className="absolute top-1 text-center font-serif-title font-bold text-xs text-[#5a403e] border-l border-r border-[#cca72f]/40 px-1 truncate"
                  >
                    {era.name}
                  </div>
                );
              })}
            </div>

            {/* Major Events Callout Flags along timeline */}
            <div className="relative h-12 mb-4 pointer-events-none">
              {MAJOR_EVENTS.map((evt, idx) => {
                const leftPx = getLeftPx(evt.year);
                return (
                  <div
                    key={idx}
                    style={{ left: `${leftPx}px` }}
                    className="absolute top-0 -translate-x-1/2 flex flex-col items-center group cursor-pointer pointer-events-auto z-20"
                  >
                    <span className="text-[9px] font-bold text-[#8f000d] bg-white/95 border border-[#8f000d]/40 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap group-hover:scale-105 transition-transform">
                      {evt.label}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8f000d] mt-0.5" />
                  </div>
                );
              })}
            </div>

            {/* Dynasty Span Blocks Tracks */}
            <div className="space-y-3 relative z-10 pt-2">
              {/* Row 1 track */}
              <div className="relative h-12 border-b border-[#edeeed]/60">
                {rowGroups.r1.map((dyn) => {
                  const left = getLeftPx(dyn.startYear);
                  const width = getWidthPx(dyn.startYear, dyn.endYear);
                  const isSelected = selectedDynasty?.id === dyn.id;
                  const dynStyle = getDynastyColor(dyn.name);

                  return (
                    <button
                      key={dyn.id}
                      onClick={() => setSelectedDynasty(dyn)}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        backgroundColor: dynStyle.color,
                      }}
                      className={`absolute top-0 h-10 rounded-xl px-2.5 flex items-center justify-between text-left transition-all shadow-xs overflow-hidden cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-[#8f000d] ring-offset-2 scale-105 z-30 shadow-md'
                          : 'opacity-90 hover:opacity-100 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-serif-title font-bold text-xs shrink-0 text-white drop-shadow-2xs">
                          {dyn.kanji}
                        </span>
                        <span className="text-[11px] font-bold text-white truncate drop-shadow-2xs">
                          {dyn.name}
                        </span>
                      </div>
                      {width > 60 && (
                        <span className="text-[9px] font-mono text-white/90 bg-black/20 px-1 rounded shrink-0">
                          {dyn.emperorCount}帝
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row 2 track */}
              <div className="relative h-12 border-b border-[#edeeed]/60">
                {rowGroups.r2.map((dyn) => {
                  const left = getLeftPx(dyn.startYear);
                  const width = getWidthPx(dyn.startYear, dyn.endYear);
                  const isSelected = selectedDynasty?.id === dyn.id;
                  const dynStyle = getDynastyColor(dyn.name);

                  return (
                    <button
                      key={dyn.id}
                      onClick={() => setSelectedDynasty(dyn)}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        backgroundColor: dynStyle.color,
                      }}
                      className={`absolute top-0 h-10 rounded-xl px-2.5 flex items-center justify-between text-left transition-all shadow-xs overflow-hidden cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-[#8f000d] ring-offset-2 scale-105 z-30 shadow-md'
                          : 'opacity-90 hover:opacity-100 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-serif-title font-bold text-xs shrink-0 text-white drop-shadow-2xs">
                          {dyn.kanji}
                        </span>
                        <span className="text-[11px] font-bold text-white truncate drop-shadow-2xs">
                          {dyn.name}
                        </span>
                      </div>
                      {width > 50 && (
                        <span className="text-[9px] font-mono text-white/90 bg-black/20 px-1 rounded shrink-0">
                          {dyn.emperorCount}帝
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Row 3 track */}
              <div className="relative h-12">
                {rowGroups.r3.map((dyn) => {
                  const left = getLeftPx(dyn.startYear);
                  const width = getWidthPx(dyn.startYear, dyn.endYear);
                  const isSelected = selectedDynasty?.id === dyn.id;
                  const dynStyle = getDynastyColor(dyn.name);

                  return (
                    <button
                      key={dyn.id}
                      onClick={() => setSelectedDynasty(dyn)}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                        backgroundColor: dynStyle.color,
                      }}
                      className={`absolute top-0 h-10 rounded-xl px-2.5 flex items-center justify-between text-left transition-all shadow-xs overflow-hidden cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-[#8f000d] ring-offset-2 scale-105 z-30 shadow-md'
                          : 'opacity-90 hover:opacity-100 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-serif-title font-bold text-xs shrink-0 text-white drop-shadow-2xs">
                          {dyn.kanji}
                        </span>
                        <span className="text-[11px] font-bold text-white truncate drop-shadow-2xs">
                          {dyn.name}
                        </span>
                      </div>
                      {width > 50 && (
                        <span className="text-[9px] font-mono text-white/90 bg-black/20 px-1 rounded shrink-0">
                          {dyn.emperorCount}帝
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rhythm of Unification and Division Indicator Bar */}
            <div className="mt-8 pt-4 border-t border-[#e2beba]/60">
              <div className="text-[11px] font-bold text-[#191c1c] mb-2 flex items-center justify-between">
                <span>統一と分裂のリズム（大一統 vs 群雄割拠・南北対立）</span>
                <span className="text-[10px] text-[#8e706d]">
                  黄＝統一帝国 / 灰＝分裂・割拠期
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#e2e8f0] overflow-hidden flex relative shadow-inner">
                {DYNASTY_TIMELINE_DATA.map((d) => {
                  const width = getWidthPx(d.startYear, d.endYear);
                  return (
                    <div
                      key={d.id}
                      title={`${d.name} (${d.periodText})`}
                      style={{ width: `${width}px` }}
                      className={`h-full border-r border-white/40 ${
                        d.category === 'unified' ? 'bg-[#cca72f]' : 'bg-[#94a3b8]'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Dynasty Detail Drawer / Card */}
      <AnimatePresence>
        {selectedDynasty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="bento-card rounded-2xl p-6 bg-gradient-to-br from-white via-[#fcfbfa] to-[#f5f3f0] border-2 border-[#8f000d]/30 shadow-lg relative"
          >
            <button
              onClick={() => setSelectedDynasty(null)}
              className="absolute top-4 right-4 text-[#8e706d] hover:text-[#8f000d] p-1.5 rounded-full hover:bg-[#8f000d]/10 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2beba]/50 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-[#8f000d] text-white flex items-center justify-center font-serif-title font-bold text-2xl shadow-sm">
                  {selectedDynasty.kanji}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif-title font-bold text-2xl text-[#8f000d]">
                      {selectedDynasty.name}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#8f000d]/10 text-[#8f000d]">
                      {selectedDynasty.periodText}
                    </span>
                  </div>
                  <p className="text-xs text-[#5a403e] mt-0.5">
                    都: <strong className="text-[#191c1c]">{selectedDynasty.capital}</strong> •
                    皇帝数: <strong className="text-[#8f000d]">{selectedDynasty.emperorCount}代</strong>
                  </p>
                </div>
              </div>

              <div className="text-xs text-[#5a403e] max-w-lg leading-relaxed bg-white/80 p-3 rounded-xl border border-[#e2beba]/50">
                {selectedDynasty.description}
              </div>
            </div>

            {/* Emperors in this Dynasty */}
            <div>
              <h4 className="font-serif-title font-bold text-sm text-[#191c1c] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#8f000d]">group</span>
                収録されている主な皇帝（クリックで詳細閲覧）
              </h4>

              {dynastyEmperors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dynastyEmperors.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => onSelectEmperor(emp)}
                      className="p-3 bg-white rounded-xl border border-[#e2beba]/60 hover:border-[#8f000d] hover:bg-[#8f000d]/5 text-left transition-all flex items-center gap-3 group shadow-2xs"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#cca72f]/15 text-[#735c00] font-bold font-serif-title text-sm flex items-center justify-center shrink-0">
                        {emp.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#191c1c] group-hover:text-[#8f000d] transition-colors truncate">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-[#8e706d]">
                          在位 {emp.reignYears}年 ({emp.reignPeriod})
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-sm text-[#8e706d] group-hover:text-[#8f000d] group-hover:translate-x-0.5 transition-all">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8e706d] bg-white p-4 rounded-xl border border-[#e2beba]/40 text-center">
                  この王朝の代表的な皇帝データがデータベースに登録されています。
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
