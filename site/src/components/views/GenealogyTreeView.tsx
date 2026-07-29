import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Emperor } from '../../types';
import { EMPERORS_DATA, EMPEROR_MAP_BY_ID, EMPEROR_MAP_BY_NAME } from '../../data/emperors';
import { getDynastyColor } from '../../utils/dynastyColors';

interface GenealogyTreeViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// Node types in diagram
type NodeType = 'emperor' | 'relative' | 'spouse';

interface DiagramNode {
  id: string;
  type: NodeType;
  name: string;           // e.g. "昭烈帝・劉備", "曹操", "♀甘氏"
  subtitle?: string;       // e.g. "初代・自立", "第2代・世襲", "第14代・擁立"
  dynasty?: string;        // e.g. "蜀漢", "魏", "呉", "西晋", "漢"
  gender?: 'M' | 'F';
  emperorDataId?: string;  // Link to EMPERORS_DATA
  x: number;               // SVG/Canvas grid position X
  y: number;               // SVG/Canvas grid position Y
  width?: number;
  height?: number;
  color?: string;          // Main background color for emperor
  infoText?: string;       // Context for relative modal
}

interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  type: 'line' | 'marriage' | 'abdication' | 'parent-child';
  label?: string;          // e.g. "禅譲・外戚", "禅譲"
  color?: string;
  dashed?: boolean;
}

interface TimelineMarker {
  y: number;
  year: string;
  label: string;
}

interface GenealogyChapter {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  dynasties: string[];
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  dynastyLabels: { text: string; x: number; y: number; color: string }[];
  timelineMarkers: TimelineMarker[];
}

// CHAPTER 1: 三国・西晋（The exact diagram requested by user in screenshot）
const CHAPTER_THREE_KINGDOMS: GenealogyChapter = {
  id: 'three-kingdoms',
  title: '三国・西晋 禅譲と帝室系譜',
  subtitle: '漢・蜀漢・魏・呉・西晋の皇位継承、禅譲・外戚関係の完全可視化',
  period: '220年 – 316年',
  dynasties: ['蜀漢', '魏', '呉', '西晋', '漢'],
  dynastyLabels: [
    { text: '蜀漢', x: 120, y: 160, color: '#ca8a04' },
    { text: '魏', x: 480, y: 160, color: '#0284c7' },
    { text: '呉', x: 260, y: 250, color: '#16a34a' },
    { text: '西晋', x: 880, y: 640, color: '#6366f1' },
  ],
  timelineMarkers: [
    { y: 20, year: '200年頃', label: '後漢末・覇権抗争' },
    { y: 100, year: '210年頃', label: '赤壁後・漢献帝' },
    { y: 210, year: '220年', label: '三国開国（魏・蜀即位）' },
    { y: 360, year: '240年頃', label: '正始の変・呉大帝' },
    { y: 470, year: '255年頃', label: '高貴郷公・司馬氏専権' },
    { y: 620, year: '265年', label: '蜀漢滅亡・西晋受禅' },
    { y: 720, year: '280年', label: '呉滅亡・三国一統' },
    { y: 840, year: '316年', label: '永嘉の乱・西晋滅亡' },
  ],
  nodes: [
    // 蜀漢 (Shu Han)
    { id: 'liu-hong', type: 'relative', name: '劉弘', x: 110, y: 110, gender: 'M', infoText: '劉備の父。漢のローカル役人。' },
    { id: 'gan-shi', type: 'relative', name: '♀甘氏', x: 20, y: 220, gender: 'F', infoText: '昭烈皇后（甘夫人）。劉禅の生母。' },
    {
      id: 'zhaolie-shu',
      type: 'emperor',
      name: '昭烈帝・劉備',
      subtitle: '初代・自立',
      dynasty: '蜀漢',
      emperorDataId: 'zhaolie-shu',
      x: 80,
      y: 200,
      color: '#eab308',
    },
    {
      id: 'houzhu-shu',
      type: 'emperor',
      name: '懷帝・劉禅',
      subtitle: '第2代・世襲',
      dynasty: '蜀漢',
      emperorDataId: 'houzhu-shu',
      x: 30,
      y: 360,
      width: 110,
      height: 250,
      color: '#facc15',
    },

    // 漢 (Han)
    {
      id: 'xiandi-han',
      type: 'emperor',
      name: '献帝・劉協',
      subtitle: '第14代・擁立',
      dynasty: '後漢',
      emperorDataId: 'xiandi-han',
      x: 560,
      y: 80,
      color: '#f59e0b',
    },
    { id: 'cao-jie', type: 'relative', name: '♀曹節', x: 670, y: 110, gender: 'F', infoText: '曹操の娘。献帝の皇后（献穆皇后）。文帝曹丕の妹。' },

    // 魏 (Wei Ancestors)
    { id: 'bian-shi', type: 'relative', name: '♀卞氏', x: 420, y: 20, gender: 'F', infoText: '武宣皇后（卞夫人）。曹操の正妻、曹丕・曹彰・曹植の母。' },
    { id: 'cao-cao', type: 'relative', name: '曹操', x: 700, y: 20, gender: 'M', infoText: '魏王。武帝と追号。魏の事実上の創始者。' },

    // 魏 (Wei Emperors)
    {
      id: 'wendi-wei',
      type: 'emperor',
      name: '文帝・曹丕',
      subtitle: '初代・受禅',
      dynasty: '魏',
      emperorDataId: 'wendi-wei',
      x: 430,
      y: 220,
      color: '#3b82f6',
    },
    { id: 'zhen-shi', type: 'relative', name: '♀甄氏（文昭甄皇后）', x: 570, y: 220, gender: 'F', infoText: '曹丕の正妻、明帝曹叡の母。' },
    { id: 'cao-zhang', type: 'relative', name: '曹彰', x: 680, y: 220, gender: 'M', infoText: '曹操の次男。任城王。勇将。' },

    {
      id: 'mingdi-wei',
      type: 'emperor',
      name: '明帝・曹叡',
      subtitle: '第2代・世襲',
      dynasty: '魏',
      emperorDataId: 'mingdi-wei',
      x: 520,
      y: 350,
      color: '#60a5fa',
    },
    { id: 'cao-zhi', type: 'relative', name: '曹植', x: 680, y: 350, gender: 'M', infoText: '曹操の三男。詩人。建安文学の代表。' },

    {
      id: 'caofang-wei',
      type: 'emperor',
      name: '曹芳',
      subtitle: '第3代・世襲',
      dynasty: '魏',
      emperorDataId: 'caofang-wei',
      x: 520,
      y: 470,
      color: '#60a5fa',
    },

    { id: 'cao-lin', type: 'relative', name: '曹霖', x: 440, y: 550, gender: 'M', infoText: '曹丕の息子、東海定王。曹髦の父。' },
    {
      id: 'caomao-wei',
      type: 'emperor',
      name: '曹髦',
      subtitle: '第4代・擁立',
      dynasty: '魏',
      emperorDataId: 'caomao-wei',
      x: 430,
      y: 620,
      color: '#60a5fa',
    },

    { id: 'cao-yu', type: 'relative', name: '曹宇', x: 760, y: 620, gender: 'M', infoText: '曹操の末子、燕王。曹奐の父。' },
    {
      id: 'yuandi-wei',
      type: 'emperor',
      name: '元帝・曹奐',
      subtitle: '第5代・擁立',
      dynasty: '魏',
      emperorDataId: 'yuandi-wei',
      x: 730,
      y: 680,
      color: '#3b82f6',
    },

    // 呉 (Wu)
    { id: 'sun-jian', type: 'relative', name: '孫堅', x: 180, y: 20, gender: 'M', infoText: '呉の基礎を築いた江東の武将。' },
    { id: 'wu-furen', type: 'relative', name: '♀呉夫人', x: 280, y: 20, gender: 'F', infoText: '孫策・孫権の生母（武烈皇后）。' },

    {
      id: 'sunquan-wu',
      type: 'emperor',
      name: '大帝・孫権',
      subtitle: '初代・自立',
      dynasty: '呉',
      emperorDataId: 'sunquan-wu',
      x: 210,
      y: 370,
      width: 110,
      height: 220,
      color: '#22c55e',
    },
    { id: 'pan-shi', type: 'relative', name: '♀潘氏', x: 140, y: 390, gender: 'F', infoText: '孫権の皇后（潘皇后）。孫亮の生母。' },
    { id: 'wang-furen-wu', type: 'relative', name: '♀王夫人', x: 400, y: 390, gender: 'F', infoText: '孫権の側室（大懿皇后）。孫休の生母。' },

    {
      id: 'sunliang-wu',
      type: 'emperor',
      name: '孫亮',
      subtitle: '第2代・世襲',
      dynasty: '呉',
      emperorDataId: 'sunliang-wu',
      x: 140,
      y: 610,
      color: '#4ade80',
    },

    { id: 'sun-he', type: 'relative', name: '孫和', x: 280, y: 620, gender: 'M', infoText: '孫権の三男、皇太子（文皇帝）。孫皓の父。' },
    { id: 'he-ji', type: 'relative', name: '♀何姫', x: 360, y: 620, gender: 'F', infoText: '孫和の妃（昭献皇后）。孫皓の母。' },

    {
      id: 'sunxiu-wu',
      type: 'emperor',
      name: '景帝・孫休',
      subtitle: '第3代・擁立',
      dynasty: '呉',
      emperorDataId: 'sunxiu-wu',
      x: 340,
      y: 690,
      color: '#4ade80',
    },

    {
      id: 'sunhao-wu',
      type: 'emperor',
      name: '末帝・孫皓',
      subtitle: '第4代・擁立',
      dynasty: '呉',
      emperorDataId: 'sunhao-wu',
      x: 240,
      y: 720,
      width: 110,
      height: 160,
      color: '#22c55e',
    },

    // 西晋 (Western Jin)
    { id: 'wang-yuanji', type: 'relative', name: '♀王元姫', x: 800, y: 450, gender: 'F', infoText: '司馬昭の妻（文明皇后）。司馬炎の母。王粛の娘。' },
    {
      id: 'wudi-jin',
      type: 'emperor',
      name: '武帝・司馬炎',
      subtitle: '初代・受禅',
      dynasty: '西晋',
      emperorDataId: 'wudi-jin',
      x: 870,
      y: 740,
      width: 110,
      height: 240,
      color: '#8b5cf6',
    },
    { id: 'wang-yuanji-2', type: 'relative', name: '♀王媛姫', x: 480, y: 930, gender: 'F', infoText: '西晋の皇族関係者。' },
  ],

  connections: [
    // Marriages (double line)
    { id: 'm1', from: 'sun-jian', to: 'wu-furen', type: 'marriage' },
    { id: 'm2', from: 'liu-hong', to: 'gan-shi', type: 'marriage' },
    { id: 'm3', from: 'bian-shi', to: 'cao-cao', type: 'marriage' },
    { id: 'm4', from: 'xiandi-han', to: 'cao-jie', type: 'marriage' },
    { id: 'm5', from: 'wendi-wei', to: 'zhen-shi', type: 'marriage' },
    { id: 'm6', from: 'pan-shi', to: 'sunquan-wu', type: 'marriage' },
    { id: 'm7', from: 'sunquan-wu', to: 'wang-furen-wu', type: 'marriage' },
    { id: 'm8', from: 'sun-he', to: 'he-ji', type: 'marriage' },

    // Parent Child
    { id: 'pc1', from: 'liu-hong', to: 'zhaolie-shu', type: 'parent-child' },
    { id: 'pc2', from: 'zhaolie-shu', to: 'houzhu-shu', type: 'parent-child' },
    { id: 'pc3', from: 'cao-cao', to: 'wendi-wei', type: 'parent-child' },
    { id: 'pc4', from: 'cao-cao', to: 'cao-zhang', type: 'parent-child' },
    { id: 'pc5', from: 'cao-cao', to: 'cao-zhi', type: 'parent-child' },
    { id: 'pc6', from: 'cao-cao', to: 'cao-jie', type: 'parent-child' },
    { id: 'pc7', from: 'cao-cao', to: 'cao-yu', type: 'parent-child' },
    { id: 'pc8', from: 'wendi-wei', to: 'mingdi-wei', type: 'parent-child' },
    { id: 'pc9', from: 'mingdi-wei', to: 'caofang-wei', type: 'parent-child', dashed: true },
    { id: 'pc10', from: 'wendi-wei', to: 'cao-lin', type: 'parent-child' },
    { id: 'pc11', from: 'cao-lin', to: 'caomao-wei', type: 'parent-child' },
    { id: 'pc12', from: 'cao-yu', to: 'yuandi-wei', type: 'parent-child' },

    { id: 'pc13', from: 'sun-jian', to: 'sunquan-wu', type: 'parent-child' },
    { id: 'pc14', from: 'sunquan-wu', to: 'sunliang-wu', type: 'parent-child' },
    { id: 'pc15', from: 'sunquan-wu', to: 'sunxiu-wu', type: 'parent-child' },
    { id: 'pc16', from: 'sunquan-wu', to: 'sun-he', type: 'parent-child' },
    { id: 'pc17', from: 'sun-he', to: 'sunhao-wu', type: 'parent-child' },

    { id: 'pc18', from: 'wang-yuanji', to: 'wudi-jin', type: 'parent-child' },

    // ABDICATIONS / USURPATIONS (Red directional arrows)
    { id: 'abd1', from: 'xiandi-han', to: 'wendi-wei', type: 'abdication', label: '禅譲・外戚' },
    { id: 'abd2', from: 'yuandi-wei', to: 'wudi-jin', type: 'abdication', label: '禅譲' },
  ],
};

// CHAPTER 2: 秦・漢 (Qin & Han Dynasty)
const CHAPTER_QIN_HAN: GenealogyChapter = {
  id: 'qin-han',
  title: '秦・前漢・新・後漢 帝室系譜',
  subtitle: '秦始皇帝から漢高祖劉邦、武帝、王莽、光武帝劉秀に至る系譜',
  period: '前221年 – 220年',
  dynasties: ['秦', '前漢', '新', '後漢'],
  dynastyLabels: [
    { text: '秦', x: 80, y: 120, color: '#8f000d' },
    { text: '前漢', x: 380, y: 120, color: '#b8860b' },
    { text: '新', x: 680, y: 320, color: '#2563eb' },
    { text: '後漢', x: 420, y: 480, color: '#d97706' },
  ],
  timelineMarkers: [
    { y: 80, year: '前221年', label: '秦始皇帝 中原統一' },
    { y: 160, year: '前202年', label: '前漢高祖 劉邦即位' },
    { y: 300, year: '前180年', label: '呂太后崩御・文帝即位' },
    { y: 440, year: '前157年', label: '景帝・呉楚七国の乱' },
    { y: 580, year: '前141年', label: '漢武帝・全盛鼎盛期' },
    { y: 360, year: '8年', label: '新・王莽簒奪' },
    { y: 720, year: '25年', label: '光武帝・後漢再興' },
    { y: 840, year: '220年', label: '後漢滅亡' },
  ],
  nodes: [
    { id: 'qin-shihuang', type: 'emperor', name: '始皇帝・嬴政', subtitle: '初代・始祖', dynasty: '秦', emperorDataId: 'qin-shihuang', x: 60, y: 160, color: '#8f000d' },
    { id: 'qin-fusu', type: 'relative', name: '扶蘇', x: 180, y: 160, gender: 'M', infoText: '始皇帝の長男。長城守備で自害させられる。' },
    { id: 'qin-ersei', type: 'emperor', name: '二世皇帝・胡亥', subtitle: '第2代・政変', dynasty: '秦', emperorDataId: 'qin-ersei', x: 60, y: 300, color: '#8f000d' },

    { id: 'lv-zhi', type: 'relative', name: '♀呂雉（呂太后）', x: 280, y: 160, gender: 'F', infoText: '高祖劉邦の正妻。中国三大悪女の一人。' },
    { id: 'gaozu-han', type: 'emperor', name: '高祖・劉邦', subtitle: '初代・開国', dynasty: '前漢', emperorDataId: 'gaozu-han', x: 380, y: 160, color: '#ca8a04' },
    { id: 'bo-ji', type: 'relative', name: '♀薄姫', x: 490, y: 160, gender: 'F', infoText: '劉邦の側室（高樹文皇后）。文帝劉恒の母。' },

    { id: 'huidi-han', type: 'emperor', name: '恵帝・劉盈', subtitle: '第2代・嫡子', dynasty: '前漢', emperorDataId: 'huidi-han', x: 300, y: 300, color: '#facc15' },
    { id: 'wendi-han', type: 'emperor', name: '文帝・劉恒', subtitle: '第5代・諸臣擁立', dynasty: '前漢', emperorDataId: 'wendi-han', x: 440, y: 300, color: '#facc15' },

    { id: 'jingdi-han', type: 'emperor', name: '景帝・劉啓', subtitle: '第6代・世襲', dynasty: '前漢', emperorDataId: 'jingdi-han', x: 440, y: 440, color: '#facc15' },

    { id: 'wudi-han', type: 'emperor', name: '武帝・劉徹', subtitle: '第7代・全盛期', dynasty: '前漢', emperorDataId: 'wudi-han', x: 440, y: 580, color: '#ca8a04' },

    { id: 'wang-mang', type: 'emperor', name: '新・王莽', subtitle: '初代・簒奪', dynasty: '新', emperorDataId: 'wangmang-xin', x: 680, y: 360, color: '#2563eb' },

    { id: 'guangwu-han', type: 'emperor', name: '光武帝・劉秀', subtitle: '初代・漢再興', dynasty: '後漢', emperorDataId: 'guangwu-han', x: 440, y: 720, color: '#d97706' },
  ],
  connections: [
    { id: 'qh1', from: 'qin-shihuang', to: 'qin-fusu', type: 'parent-child' },
    { id: 'qh2', from: 'qin-shihuang', to: 'qin-ersei', type: 'parent-child' },
    { id: 'qh3', from: 'lv-zhi', to: 'gaozu-han', type: 'marriage' },
    { id: 'qh4', from: 'gaozu-han', to: 'bo-ji', type: 'marriage' },
    { id: 'qh5', from: 'gaozu-han', to: 'huidi-han', type: 'parent-child' },
    { id: 'qh6', from: 'gaozu-han', to: 'wendi-han', type: 'parent-child' },
    { id: 'qh7', from: 'wendi-han', to: 'jingdi-han', type: 'parent-child' },
    { id: 'qh8', from: 'jingdi-han', to: 'wudi-han', type: 'parent-child' },
    { id: 'qh9', from: 'wudi-han', to: 'wang-mang', type: 'abdication', label: '外戚簒奪' },
    { id: 'qh10', from: 'wang-mang', to: 'guangwu-han', type: 'abdication', label: '漢王朝再興' },
  ],
};

// CHAPTER 3: 隋・唐・武周 (Sui, Tang & Wu Zhou)
const CHAPTER_SUI_TANG: GenealogyChapter = {
  id: 'sui-tang',
  title: '隋・唐・武周 帝室系譜と武后',
  subtitle: '楊堅の開国から李淵・太宗李世民、武則天（周）の即位・中宗復辟の皇位移転',
  period: '581年 – 705年',
  dynasties: ['隋', '唐', '武周'],
  dynastyLabels: [
    { text: '隋', x: 100, y: 120, color: '#dc2626' },
    { text: '唐', x: 420, y: 120, color: '#ca8a04' },
    { text: '武周', x: 740, y: 380, color: '#7c3aed' },
  ],
  timelineMarkers: [
    { y: 80, year: '581年', label: '隋開国（文帝楊堅）' },
    { y: 160, year: '618年', label: '唐開国（高祖李淵）' },
    { y: 300, year: '626年', label: '玄武門の変・太宗即位' },
    { y: 440, year: '649年', label: '高宗即位・武后後宮' },
    { y: 580, year: '690年', label: '武則天即位・聖神皇帝' },
    { y: 680, year: '705年', label: '神龍の変・唐復辟' },
    { y: 760, year: '712年', label: '玄宗即位・開元の治' },
  ],
  nodes: [
    // 隋 (Sui)
    { id: 'wen-sui', type: 'emperor', name: '文帝・楊堅', subtitle: '初代・建国', dynasty: '隋', emperorDataId: 'wendi-sui', x: 60, y: 160, color: '#dc2626' },
    { id: 'dugu-jiaren', type: 'relative', name: '♀独孤伽羅', x: 180, y: 160, gender: 'F', infoText: '文献皇后独孤氏。楊堅の皇后で政治にも深く関与。' },
    { id: 'yang-guang', type: 'emperor', name: '煬帝・楊広', subtitle: '第2代・世襲', dynasty: '隋', emperorDataId: 'yangdi-sui', x: 60, y: 300, color: '#ef4444' },

    // 唐 (Tang)
    { id: 'dugu-sister', type: 'relative', name: '♀独孤氏', x: 300, y: 160, gender: 'F', infoText: '元貞皇后。李淵の生母。独孤伽羅の姉妹（北周の重臣・独孤信の娘）。' },
    { id: 'li-hu', type: 'relative', name: '李昞', x: 420, y: 80, gender: 'M', infoText: '唐国公。李淵の父。' },
    { id: 'gaozu-tang', type: 'emperor', name: '高祖・李淵', subtitle: '初代・受禅', dynasty: '唐', emperorDataId: 'gaozu-tang', x: 420, y: 160, color: '#eab308' },

    { id: 'taizong-tang', type: 'emperor', name: '太宗・李世民', subtitle: '第2代・玄武門', dynasty: '唐', emperorDataId: 'taizong-tang', x: 420, y: 300, color: '#ca8a04' },
    { id: 'zhangsun-huanghou', type: 'relative', name: '♀長孫皇后', x: 550, y: 300, gender: 'F', infoText: '文徳皇后長孫氏。太宗の正妻、高宗の母。' },

    { id: 'gaozong-tang', type: 'emperor', name: '高宗・李治', subtitle: '第3代・世襲', dynasty: '唐', emperorDataId: 'gaozong-tang', x: 420, y: 440, color: '#facc15' },

    // 武周 (Wu Zhou)
    { id: 'wu-zetian', type: 'emperor', name: '武則天・武曌', subtitle: '女帝・易姓革命', dynasty: '武周', emperorDataId: 'wuzetian', x: 700, y: 440, color: '#8b5cf6', width: 120, height: 140 },

    { id: 'zhongzong-tang', type: 'emperor', name: '中宗・李顕', subtitle: '第4・6代・復辟', dynasty: '唐', emperorDataId: 'zhongzong-tang', x: 420, y: 620, color: '#ca8a04' },
    { id: 'ruizong-tang', type: 'emperor', name: '睿宗・李旦', subtitle: '第5・7代・復辟', dynasty: '唐', emperorDataId: 'ruizong-tang', x: 580, y: 620, color: '#facc15' },

    { id: 'xuanzong-tang', type: 'emperor', name: '玄武帝・玄宗', subtitle: '第9代・全盛期', dynasty: '唐', emperorDataId: 'xuanzong-tang', x: 580, y: 760, color: '#ca8a04' },
  ],
  connections: [
    { id: 'st1', from: 'wen-sui', to: 'dugu-jiaren', type: 'marriage' },
    { id: 'st2', from: 'wen-sui', to: 'yang-guang', type: 'parent-child' },
    { id: 'st3', from: 'li-hu', to: 'dugu-sister', type: 'marriage' },
    { id: 'st4', from: 'li-hu', to: 'gaozu-tang', type: 'parent-child' },
    { id: 'st5', from: 'yang-guang', to: 'gaozu-tang', type: 'abdication', label: '禅譲' },
    { id: 'st6', from: 'gaozu-tang', to: 'taizong-tang', type: 'parent-child' },
    { id: 'st7', from: 'taizong-tang', to: 'zhangsun-huanghou', type: 'marriage' },
    { id: 'st8', from: 'taizong-tang', to: 'gaozong-tang', type: 'parent-child' },
    { id: 'st9', from: 'gaozong-tang', to: 'wu-zetian', type: 'marriage' },
    { id: 'st10', from: 'gaozong-tang', to: 'wu-zetian', type: 'abdication', label: '武周即位' },
    { id: 'st11', from: 'wu-zetian', to: 'zhongzong-tang', type: 'parent-child' },
    { id: 'st12', from: 'wu-zetian', to: 'ruizong-tang', type: 'parent-child' },
    { id: 'st13', from: 'wu-zetian', to: 'zhongzong-tang', type: 'abdication', label: '唐復辟' },
    { id: 'st14', from: 'ruizong-tang', to: 'xuanzong-tang', type: 'parent-child' },
  ],
};

const CHAPTERS: GenealogyChapter[] = [CHAPTER_THREE_KINGDOMS, CHAPTER_QIN_HAN, CHAPTER_SUI_TANG];

export const GenealogyTreeView: React.FC<GenealogyTreeViewProps> = ({ onSelectEmperor, onFullscreenChange }) => {
  const [activeChapterId, setActiveChapterId] = useState<string>('three-kingdoms');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [selectedRelative, setSelectedRelative] = useState<DiagramNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeChapter = CHAPTERS.find((c) => c.id === activeChapterId) || CHAPTERS[0];

  // Map of nodes for O(1) connection lookup instead of Array.find
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, DiagramNode>();
    for (let i = 0; i < activeChapter.nodes.length; i++) {
      const node = activeChapter.nodes[i];
      map.set(node.id, node);
    }
    return map;
  }, [activeChapter]);

  const handleToggleFullscreen = (fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    if (onFullscreenChange) {
      onFullscreenChange(fullscreen);
    }
  };

  React.useEffect(() => {
    return () => {
      if (onFullscreenChange) {
        onFullscreenChange(false);
      }
    };
  }, [onFullscreenChange]);

  // Esc key listener for fullscreen exit
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleToggleFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleEmperorClick = React.useCallback(
    (node: DiagramNode) => {
      if (node.type !== 'emperor') return;
      
      const found =
        (node.emperorDataId ? EMPEROR_MAP_BY_ID.get(node.emperorDataId) : null) ||
        EMPEROR_MAP_BY_NAME.get(node.name) ||
        EMPERORS_DATA.find(
          (e) =>
            e.id === node.emperorDataId ||
            e.name === node.name ||
            node.name.includes(e.name) ||
            (e.givenName && node.name.includes(e.givenName))
        );

      if (found) {
        onSelectEmperor(found);
      } else {
        // Fallback details
        onSelectEmperor({
          id: node.id,
          name: node.name,
          templeName: node.name.split('・')[0] || node.name,
          givenName: node.name.split('・')[1] || '',
          dynasty: node.dynasty || '中国',
          dynastyKanji: (node.dynasty || '華')[0],
          reignYears: 15,
          reignPeriod: '歴史記録に基づく系譜',
          birthYear: '―',
          deathYear: '―',
          ageAtAscension: 20,
          lifespan: 55,
          causeOfDeathCategory: '病死',
          causeOfDeathDetail: '帝室家系図記録',
          successionType: node.subtitle || '世襲',
          summary: `${node.dynasty}の君主・${node.name}。継承特徴: ${node.subtitle}`,
          keyAchievements: [`${node.dynasty}統治`, '帝室・王朝系譜の保持'],
          historicalAssessment: `${node.dynasty}の重要人物として家系図に記録されている。`,
        });
      }
    },
    [onSelectEmperor]
  );

  // Render refined emperor node card
  const renderEmperorNode = (node: DiagramNode) => {
    const nodeWidth = node.width || 116;
    const nodeHeight = node.height || 135;
    const dynColor = node.color || getDynastyColor(node.dynasty || '').color;

    const isLightBg =
      dynColor === '#facc15' ||
      dynColor === '#eab308' ||
      dynColor === '#f59e0b';

    const isFemaleRegent = node.id === 'wu-zetian';

    const isSearchMatched =
      searchQuery.trim() !== '' &&
      node.name.toLowerCase().includes(searchQuery.trim().toLowerCase());

    const nameParts = node.name.split('・');
    const mainTitle = nameParts[0] || node.name;
    const subName = nameParts.length > 1 ? nameParts[1] : '';

    return (
      <motion.div
        key={node.id}
        onClick={() => handleEmperorClick(node)}
        whileHover={{ scale: 1.05, y: -3 }}
        whileTap={{ scale: 0.97 }}
        style={{
          left: `${node.x}px`,
          top: `${node.y}px`,
          width: `${nodeWidth}px`,
          height: `${nodeHeight}px`,
        }}
        className={`absolute z-20 rounded-2xl p-2.5 shadow-md border-2 cursor-pointer flex flex-col justify-between group transition-all duration-200 select-none overflow-hidden ${
          isSearchMatched
            ? 'ring-4 ring-[#cca72f] ring-offset-2 border-[#cca72f] shadow-2xl scale-105 z-30'
            : 'border-[#b8860b]/40 hover:border-[#ca8a04] hover:shadow-xl'
        }`}
      >
        {/* Background with royal gradient */}
        <div
          className="absolute inset-0 rounded-2xl -z-10 transition-opacity"
          style={{
            backgroundColor: dynColor,
            backgroundImage:
              'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.2) 100%)',
          }}
        />

        {/* Traditional Inner Gold Frame border */}
        <div className="absolute inset-1 rounded-xl border border-white/30 pointer-events-none" />

        {/* Watermark character in bottom-right */}
        <span className="absolute bottom-1 right-2 text-3xl font-serif-title font-black opacity-15 pointer-events-none select-none text-white">
          {node.dynasty ? node.dynasty[0] : '帝'}
        </span>

        {/* Top Badge Row */}
        <div className="flex items-center justify-between gap-1 relative z-10">
          <span
            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border shadow-2xs ${
              isLightBg
                ? 'bg-black/15 text-[#291002] border-black/20'
                : 'bg-white/20 text-white border-white/30'
            }`}
          >
            {node.dynasty || '帝室'}
          </span>

          {isFemaleRegent && (
            <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5 bg-purple-900/80 px-1 py-0.5 rounded border border-amber-300/50">
              👑 女帝
            </span>
          )}
        </div>

        {/* Title & Name */}
        <div className="relative z-10 my-auto text-center py-0.5">
          <div
            className={`font-serif-title font-black leading-tight tracking-tight text-xs sm:text-sm drop-shadow-2xs ${
              isLightBg ? 'text-[#3b1a03]' : 'text-white'
            }`}
          >
            {mainTitle}
          </div>
          {subName && (
            <div
              className={`font-serif-title text-[11px] font-bold mt-0.5 opacity-90 ${
                isLightBg ? 'text-[#522506]' : 'text-amber-100'
              }`}
            >
              {subName}
            </div>
          )}
        </div>

        {/* Subtitle / Succession Badge */}
        {node.subtitle && (
          <div
            className={`relative z-10 text-[9.5px] font-sans font-bold px-1.5 py-0.5 rounded-md text-center border shadow-2xs truncate ${
              isLightBg
                ? 'bg-amber-950/15 text-[#301402] border-amber-900/20'
                : 'bg-black/35 text-amber-200 border-white/20 backdrop-blur-2xs'
            }`}
          >
            {node.subtitle}
          </div>
        )}
      </motion.div>
    );
  };

  // Canvas Core Renderer (Reused in normal view and full-screen view)
  const renderDiagramCanvas = (isFull: boolean = false) => (
    <div
      className={`overflow-auto rounded-xl border border-[#e2beba]/80 bg-[#F6F1E9] p-4 sm:p-6 shadow-inner scrollbar-thin relative ${
        isFull ? 'flex-1 h-full w-full max-h-none' : 'max-h-[800px]'
      }`}
    >
      <div
        style={{
          width: `${1120 * zoomScale}px`,
          height: `${950 * zoomScale}px`,
        }}
        className="relative transition-all duration-200 select-none pb-12"
      >
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top left',
            width: '1120px',
            height: '950px',
          }}
          className="relative transition-transform duration-200 select-none pb-12"
        >
        {/* Background Grid Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'radial-gradient(#8f000d 0.75px, transparent 0.75px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Left Fixed Timeline Axis */}
        <div className="absolute top-0 bottom-0 left-2 w-28 pointer-events-none z-10 border-r border-dashed border-[#8f000d]/30 pr-2">
          {activeChapter.timelineMarkers.map((marker, idx) => (
            <div
              key={idx}
              style={{ top: `${marker.y + 10}px` }}
              className="absolute left-0 flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-[#8f000d] ring-2 ring-white shadow-2xs shrink-0" />
              <div>
                <span className="text-[10px] font-mono font-black text-[#8f000d] bg-white/90 px-1.5 py-0.5 rounded border border-[#e2beba] shadow-2xs block">
                  {marker.year}
                </span>
                <span className="text-[9px] font-sans text-[#5a403e] font-semibold block truncate max-w-[85px] leading-none mt-0.5">
                  {marker.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Horizontal Guide Lines connecting Left and Right Timeline Markers */}
        {activeChapter.timelineMarkers.map((marker, idx) => (
          <div
            key={`guide-${idx}`}
            style={{ top: `${marker.y + 20}px` }}
            className="absolute left-28 right-28 border-b border-dashed border-[#8f000d]/15 pointer-events-none z-0"
          />
        ))}

        {/* Right Fixed Timeline Axis */}
        <div className="absolute top-0 bottom-0 right-2 w-28 pointer-events-none z-10 border-l border-dashed border-[#8f000d]/30 pl-2">
          {activeChapter.timelineMarkers.map((marker, idx) => (
            <div
              key={idx}
              style={{ top: `${marker.y + 10}px` }}
              className="absolute right-0 flex items-center justify-end gap-1.5 text-right"
            >
              <div>
                <span className="text-[10px] font-mono font-black text-[#8f000d] bg-white/90 px-1.5 py-0.5 rounded border border-[#e2beba] shadow-2xs block">
                  {marker.year}
                </span>
                <span className="text-[9px] font-sans text-[#5a403e] font-semibold block truncate max-w-[85px] leading-none mt-0.5">
                  {marker.label}
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#8f000d] ring-2 ring-white shadow-2xs shrink-0" />
            </div>
          ))}
        </div>

        {/* Dynasty Big Header Titles */}
        {activeChapter.dynastyLabels.map((lbl, idx) => (
          <div
            key={idx}
            style={{ left: `${lbl.x}px`, top: `${lbl.y}px`, color: lbl.color }}
            className="absolute font-serif-title font-black text-2xl tracking-widest opacity-80 z-10 pointer-events-none"
          >
            {lbl.text}
          </div>
        ))}

        {/* Connecting Lines SVG Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            <marker
              id="arrowhead-abdication"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#dc2626" />
            </marker>
          </defs>

          {activeChapter.connections.map((conn) => {
            const sourceNode = nodeMap.get(conn.from);
            const targetNode = nodeMap.get(conn.to);
            if (!sourceNode || !targetNode) return null;

            const sw = sourceNode.width || (sourceNode.type === 'emperor' ? 116 : 80);
            const sh = sourceNode.height || (sourceNode.type === 'emperor' ? 135 : 36);

            const tw = targetNode.width || (targetNode.type === 'emperor' ? 116 : 80);
            const th = targetNode.height || (targetNode.type === 'emperor' ? 135 : 36);

            const sourceCenterX = sourceNode.x + sw / 2;
            const sourceCenterY = sourceNode.y + sh / 2;
            const targetCenterX = targetNode.x + tw / 2;
            const targetCenterY = targetNode.y + th / 2;

            if (conn.type === 'marriage') {
              const y = sourceCenterY;
              const x1 = sourceNode.x < targetNode.x ? sourceNode.x + sw : sourceNode.x;
              const x2 = sourceNode.x < targetNode.x ? targetNode.x : targetNode.x + tw;

              return (
                <g key={conn.id}>
                  <line x1={x1} y1={y - 2} x2={x2} y2={y - 2} stroke="#8e706d" strokeWidth="1.5" />
                  <line x1={x1} y1={y + 2} x2={x2} y2={y + 2} stroke="#8e706d" strokeWidth="1.5" />
                </g>
              );
            }

            if (conn.type === 'abdication') {
              const startX = sourceNode.x + sw / 2;
              const startY = sourceNode.y + sh;
              const endX = targetNode.x + tw / 2;
              const endY = targetNode.y;

              const midY = (startY + endY) / 2;
              const pathD = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY - 6}`;

              return (
                <g key={conn.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2.5"
                    strokeDasharray={conn.dashed ? '4,4' : undefined}
                    markerEnd="url(#arrowhead-abdication)"
                  />
                  {conn.label && (
                    <g transform={`translate(${(startX + endX) / 2}, ${midY - 10})`}>
                      <rect
                        x="-38"
                        y="-10"
                        width="76"
                        height="20"
                        rx="5"
                        fill="#fee2e2"
                        stroke="#dc2626"
                        strokeWidth="1.2"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fill="#dc2626"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="serif"
                      >
                        {conn.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            }

            const startX = sourceCenterX;
            const startY = sourceNode.y + sh;
            const endX = targetCenterX;
            const endY = targetNode.y;

            const midY = (startY + endY) / 2;
            const pathD = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;

            return (
              <path
                key={conn.id}
                d={pathD}
                fill="none"
                stroke="#8e706d"
                strokeWidth="1.5"
                strokeDasharray={conn.dashed ? '3,3' : undefined}
              />
            );
          })}
        </svg>

        {/* Render Nodes */}
        {activeChapter.nodes.map((node) => {
          if (node.type === 'emperor') {
            return renderEmperorNode(node);
          }

          // Relative / Spouse Pill Node
          const pillWidth = node.width || 80;
          const pillHeight = node.height || 36;

          return (
            <motion.div
              key={node.id}
              onClick={() => setSelectedRelative(node)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${pillWidth}px`,
                height: `${pillHeight}px`,
              }}
              className="absolute z-20 rounded-full bg-white/95 border border-dashed border-[#8e706d] hover:border-[#8f000d] px-2 flex items-center justify-center text-xs font-semibold text-[#191c1c] shadow-2xs hover:shadow-md cursor-pointer transition-all"
            >
              <span className="truncate text-[11px] font-serif-title text-[#291d1b]">
                {node.name}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  </div>
);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bento-card rounded-2xl p-6 bg-gradient-to-r from-[#FAF6EF] via-white to-[#F6F1E9] border border-[#e2beba]/60 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-2xl text-[#8f000d]">account_tree</span>
              <h2 className="font-serif-title font-bold text-2xl text-[#191c1c]">
                中国歴代帝室・皇位継承家系図 (Genealogy Tree)
              </h2>
            </div>
            <p className="text-xs md:text-sm text-[#5a403e] max-w-3xl leading-relaxed">
              皇帝・皇后・外戚・諸王の婚姻関係、父子世襲、政変および「禅譲（王朝交代）」の流れる血脈と権力移転を精密に再現した系譜ダイアグラムです。
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input Box */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-2.5 text-base text-[#8e706d]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="皇帝・人物名検索..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[#e2beba] text-[#191c1c] focus:outline-none focus:border-[#8f000d] w-36 sm:w-44 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-xs text-[#8e706d] hover:text-[#8f000d]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white border border-[#e2beba] rounded-xl p-1 shadow-2xs">
              <button
                onClick={() => setZoomScale((prev) => Math.max(0.6, prev - 0.15))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a403e] hover:bg-[#8f000d]/10 hover:text-[#8f000d] font-bold text-sm"
                title="縮小"
              >
                －
              </button>
              <span className="text-xs font-mono font-bold text-[#191c1c] px-2 min-w-[42px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((prev) => Math.min(1.4, prev + 0.15))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a403e] hover:bg-[#8f000d]/10 hover:text-[#8f000d] font-bold text-sm"
                title="拡大"
              >
                ＋
              </button>
              <button
                onClick={() => setZoomScale(1.0)}
                className="px-2 py-1 text-[10px] font-bold text-[#8f000d] bg-[#8f000d]/10 rounded-md hover:bg-[#8f000d]/20 transition-colors"
              >
                100%
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={() => handleToggleFullscreen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#8f000d] text-white rounded-xl text-xs font-bold hover:bg-[#a80010] shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">fullscreen</span>
              <span>フルスクリーン</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-[#e2beba]/40 flex flex-wrap items-center gap-4 text-xs text-[#5a403e]">
          <div className="flex items-center gap-1.5 font-bold text-[#191c1c]">
            <span className="material-symbols-outlined text-sm text-[#8f000d]">info</span> 凡例:
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-7 rounded-md bg-[#ca8a04] border border-[#a16207] inline-block shadow-2xs" />
            <span>皇帝ノード (色: 各王朝)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-[#f3f4f3] border border-dashed border-[#8e706d] text-[10px] text-[#5a403e] inline-block">
              ♀皇后・親族
            </span>
            <span>非皇帝・外戚・后妃</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[#8e706d] font-bold">═</span>
            <span>婚姻関係</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#8e706d] inline-block" />
            <span>直系・血縁</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#dc2626] inline-block" />
            <span className="text-[#dc2626] font-bold">➔ 禅譲・外戚（王朝交代）</span>
          </div>
        </div>

        {/* Chapter Switcher Tabs */}
        <div className="mt-4 pt-3 border-t border-[#e2beba]/40 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-bold text-[#8f000d] whitespace-nowrap shrink-0">章選択:</span>
          {CHAPTERS.map((chap) => {
            const isActive = activeChapterId === chap.id;
            return (
              <button
                key={chap.id}
                onClick={() => setActiveChapterId(chap.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[#8f000d] text-white border-[#8f000d] shadow-2xs'
                    : 'bg-white text-[#5a403e] border-[#e2beba]/70 hover:border-[#8f000d] hover:text-[#8f000d]'
                }`}
              >
                {chap.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas Diagram Box */}
      <div className="bento-card rounded-2xl p-6 bg-[#FAF6EF] border border-[#e2beba]/70 shadow-sm relative overflow-hidden">
        {/* Header inside canvas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[#e2beba]/50 pb-3">
          <div>
            <h3 className="font-serif-title font-bold text-xl text-[#8f000d] flex items-center gap-2">
              <span>{activeChapter.title}</span>
              <span className="text-xs font-sans font-normal text-[#8e706d] bg-white px-2.5 py-0.5 rounded-full border border-[#e2beba]">
                {activeChapter.period}
              </span>
            </h3>
            <p className="text-xs text-[#5a403e] mt-1">{activeChapter.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {activeChapter.dynasties.map((dyn) => {
              const dynStyle = getDynastyColor(dyn);
              return (
                <span
                  key={dyn}
                  style={{
                    backgroundColor: dynStyle.badgeBg,
                    color: dynStyle.badgeText,
                    borderColor: dynStyle.badgeBorder,
                  }}
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                >
                  {dyn}
                </span>
              );
            })}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="text-[11px] text-[#8e706d] mb-3 flex items-center justify-between">
          <span>※ 左右に固定の年代軸が表示されます。皇帝カードクリックで詳細が開きます。</span>
          <span className="font-semibold text-[#8f000d] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">swipe</span> 横・縦スクロール可
          </span>
        </div>

        {/* Embedded Canvas */}
        {renderDiagramCanvas(false)}
      </div>

      {/* Fullscreen Overlay Portal */}
      <AnimatePresence>
        {isFullscreen &&
          createPortal(
            <motion.div
              key="tree-fullscreen-modal"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] bg-[#FAF6EF] text-[#191c1c] flex flex-col p-3 sm:p-5 overflow-hidden select-none"
            >
              {/* Top Fullscreen Header */}
              <div className="bg-white/95 backdrop-blur-md border border-[#e2beba] p-3 sm:p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0 mb-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-[#8f000d]">account_tree</span>
                  <div>
                    <h2 className="font-serif-title font-bold text-base sm:text-lg text-[#191c1c] flex items-center gap-2">
                      <span>{activeChapter.title}</span>
                      <span className="text-[11px] font-sans font-bold text-[#8f000d] bg-[#8f000d]/10 border border-[#8f000d]/20 px-2.5 py-0.5 rounded-full">
                        {activeChapter.period}
                      </span>
                    </h2>
                    <p className="text-xs text-[#5a403e] hidden md:block">{activeChapter.subtitle}</p>
                  </div>
                </div>

                {/* Chapter Tabs & Controls */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Chapter Selector */}
                  <div className="flex items-center gap-1 bg-[#f3f4f3] p-1 rounded-xl border border-[#e2beba]">
                    {CHAPTERS.map((chap) => {
                      const isActive = activeChapterId === chap.id;
                      return (
                        <button
                          key={chap.id}
                          onClick={() => setActiveChapterId(chap.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-[#8f000d] text-white shadow-2xs'
                              : 'text-[#5a403e] hover:text-[#191c1c] hover:bg-white/60'
                          }`}
                        >
                          {chap.title.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Search */}
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-2.5 text-base text-[#8e706d]">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="人物検索..."
                      className="pl-8 pr-3 py-1 text-xs rounded-xl bg-white border border-[#e2beba] text-[#191c1c] placeholder-[#8e706d] focus:outline-none focus:border-[#8f000d] w-28 sm:w-36 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-xs text-[#8e706d] hover:text-[#8f000d]"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-white border border-[#e2beba] rounded-xl p-1 shadow-2xs">
                    <button
                      onClick={() => setZoomScale((prev) => Math.max(0.6, prev - 0.15))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a403e] hover:bg-[#8f000d]/10 hover:text-[#8f000d] font-bold text-sm"
                      title="縮小"
                    >
                      －
                    </button>
                    <span className="text-xs font-mono font-bold text-[#191c1c] px-1.5 min-w-[38px] text-center">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomScale((prev) => Math.min(1.5, prev + 0.15))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a403e] hover:bg-[#8f000d]/10 hover:text-[#8f000d] font-bold text-sm"
                      title="拡大"
                    >
                      ＋
                    </button>
                    <button
                      onClick={() => setZoomScale(1.0)}
                      className="px-2 py-1 text-[10px] font-bold text-[#8f000d] bg-[#8f000d]/10 rounded-md hover:bg-[#8f000d]/20 transition-colors"
                    >
                      100%
                    </button>
                  </div>

                  {/* Exit / Close Button (バツボタン) */}
                  <button
                    onClick={() => handleToggleFullscreen(false)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#8f000d] hover:bg-[#a80010] text-white rounded-xl text-xs font-bold transition-all shadow-sm border border-[#8f000d]/30 cursor-pointer shrink-0"
                    title="フルスクリーン表示を終了 (Esc)"
                    aria-label="閉じる"
                  >
                    <span className="text-base font-black leading-none">✕</span>
                    <span>閉じる (Esc)</span>
                  </button>
                </div>
              </div>

              {/* Fullscreen Canvas Wrapper */}
              <div className="flex-1 w-full h-full relative overflow-hidden rounded-2xl border border-[#e2beba] shadow-sm bg-[#F6F1E9] flex flex-col">
                {renderDiagramCanvas(true)}
              </div>
            </motion.div>,
            document.body
          )}
      </AnimatePresence>

      {/* Relative Info Modal */}
      <AnimatePresence>
        {selectedRelative && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedRelative(null)}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#e2beba] shadow-xl relative text-[#191c1c]"
            >
              <button
                onClick={() => setSelectedRelative(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f3f4f3] flex items-center justify-center text-[#5a403e] hover:bg-[#8f000d]/10 hover:text-[#8f000d]"
              >
                ✕
              </button>

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#8e706d]/15 text-[#8e706d] font-bold text-xs">
                  {selectedRelative.gender === 'F' ? '♀ 后妃・皇族女性' : '皇族・外戚'}
                </span>
              </div>

              <h3 className="font-serif-title font-bold text-xl text-[#191c1c] mb-2">
                {selectedRelative.name}
              </h3>

              <p className="text-xs text-[#5a403e] leading-relaxed bg-[#FAF6EF] p-3 rounded-xl border border-[#e2beba]/50">
                {selectedRelative.infoText || '歴史記録における皇室関係者。'}
              </p>

              <button
                onClick={() => setSelectedRelative(null)}
                className="mt-4 w-full py-2 rounded-xl bg-[#8f000d] text-white font-bold text-xs hover:bg-[#a80010] transition-colors"
              >
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
