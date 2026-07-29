export interface DynastyColorConfig {
  name: string;
  color: string;           // Main hex color
  bgGradient: string;      // Tailwind gradient classes (from-... to-...)
  badgeBg: string;         // Inline style background or class (e.g. '#8f000d15')
  badgeBorder: string;     // Border style
  badgeText: string;       // Text color
  description?: string;
}

// Master map of 40 specific dynasties requested by user
export const DYNASTY_COLORS: Record<string, DynastyColorConfig> = {
  '秦': {
    name: '秦',
    color: '#8f000d',
    bgGradient: 'from-[#8f000d] to-[#b31217]',
    badgeBg: '#8f000d18',
    badgeBorder: '#8f000d40',
    badgeText: '#8f000d',
  },
  '前漢': {
    name: '前漢',
    color: '#b8860b',
    bgGradient: 'from-[#e0b833] to-[#b8860b]',
    badgeBg: '#b8860b18',
    badgeBorder: '#b8860b40',
    badgeText: '#926a08',
  },
  '新': {
    name: '新',
    color: '#2563eb',
    bgGradient: 'from-[#3b82f6] to-[#1d4ed8]',
    badgeBg: '#2563eb18',
    badgeBorder: '#2563eb40',
    badgeText: '#1d4ed8',
  },
  '後漢': {
    name: '後漢',
    color: '#d97706',
    bgGradient: 'from-[#facc15] to-[#ca8a04]',
    badgeBg: '#d9770618',
    badgeBorder: '#d9770640',
    badgeText: '#b45309',
  },
  '成家': {
    name: '成家',
    color: '#9333ea',
    bgGradient: 'from-[#a855f7] to-[#7e22ce]',
    badgeBg: '#9333ea18',
    badgeBorder: '#9333ea40',
    badgeText: '#7e22ce',
  },
  '魏': {
    name: '魏',
    color: '#0284c7',
    bgGradient: 'from-[#0284c7] to-[#0369a1]',
    badgeBg: '#0284c718',
    badgeBorder: '#0284c740',
    badgeText: '#0369a1',
  },
  '蜀漢': {
    name: '蜀漢',
    color: '#ca8a04',
    bgGradient: 'from-[#f1c40f] to-[#d4ac0d]',
    badgeBg: '#ca8a0418',
    badgeBorder: '#ca8a0440',
    badgeText: '#a16207',
  },
  '呉（三国）': {
    name: '呉（三国）',
    color: '#16a34a',
    bgGradient: 'from-[#22c55e] to-[#15803d]',
    badgeBg: '#16a34a18',
    badgeBorder: '#16a34a40',
    badgeText: '#15803d',
  },
  '西晋': {
    name: '西晋',
    color: '#6366f1',
    bgGradient: 'from-[#6366f1] to-[#4338ca]',
    badgeBg: '#6366f118',
    badgeBorder: '#6366f140',
    badgeText: '#4338ca',
  },
  '東晋': {
    name: '東晋',
    color: '#8b5cf6',
    bgGradient: 'from-[#a855f7] to-[#7e22ce]',
    badgeBg: '#8b5cf618',
    badgeBorder: '#8b5cf640',
    badgeText: '#6d28d9',
  },
  '成漢': {
    name: '成漢',
    color: '#059669',
    bgGradient: 'from-[#10b981] to-[#047857]',
    badgeBg: '#05966918',
    badgeBorder: '#05966940',
    badgeText: '#047857',
  },
  '前燕': {
    name: '前燕',
    color: '#0d9488',
    bgGradient: 'from-[#14b8a6] to-[#0f766e]',
    badgeBg: '#0d948818',
    badgeBorder: '#0d948840',
    badgeText: '#0f766e',
  },
  '北魏': {
    name: '北魏',
    color: '#3b82f6',
    bgGradient: 'from-[#60a5fa] to-[#1d4ed8]',
    badgeBg: '#3b82f618',
    badgeBorder: '#3b82f640',
    badgeText: '#1d4ed8',
  },
  '東魏': {
    name: '東魏',
    color: '#475569',
    bgGradient: 'from-[#64748b] to-[#334155]',
    badgeBg: '#47556918',
    badgeBorder: '#47556940',
    badgeText: '#334155',
  },
  '西魏': {
    name: '西魏',
    color: '#0284c7',
    bgGradient: 'from-[#38bdf8] to-[#1e3a8a]',
    badgeBg: '#0284c718',
    badgeBorder: '#0284c740',
    badgeText: '#1e3a8a',
  },
  '梁（南北朝）': {
    name: '梁（南北朝）',
    color: '#9f1239',
    bgGradient: 'from-[#f43f5e] to-[#be123c]',
    badgeBg: '#9f123918',
    badgeBorder: '#9f123940',
    badgeText: '#be123c',
  },
  '後梁（南北朝）': {
    name: '後梁（南北朝）',
    color: '#e11d48',
    bgGradient: 'from-[#fb7185] to-[#9f1239]',
    badgeBg: '#e11d4818',
    badgeBorder: '#e11d4840',
    badgeText: '#9f1239',
  },
  '隋': {
    name: '隋',
    color: '#059669',
    bgGradient: 'from-[#10b981] to-[#047857]',
    badgeBg: '#05966918',
    badgeBorder: '#05966940',
    badgeText: '#047857',
  },
  '梁（隋末）': {
    name: '梁（隋末）',
    color: '#881337',
    bgGradient: 'from-[#e11d48] to-[#4c0519]',
    badgeBg: '#88133718',
    badgeBorder: '#88133740',
    badgeText: '#881337',
  },
  '唐': {
    name: '唐',
    color: '#eab308',
    bgGradient: 'from-[#facc15] to-[#ca8a04]',
    badgeBg: '#eab30818',
    badgeBorder: '#eab30840',
    badgeText: '#a16207',
  },
  '周': {
    name: '周',
    color: '#ec4899',
    bgGradient: 'from-[#f472b6] to-[#be185d]',
    badgeBg: '#ec489918',
    badgeBorder: '#ec489940',
    badgeText: '#be185d',
  },
  '武周': {
    name: '武周',
    color: '#ec4899',
    bgGradient: 'from-[#f472b6] to-[#be185d]',
    badgeBg: '#ec489918',
    badgeBorder: '#ec489940',
    badgeText: '#be185d',
  },
  '前蜀': {
    name: '前蜀',
    color: '#854d0e',
    bgGradient: 'from-[#ca8a04] to-[#713f12]',
    badgeBg: '#854d0e18',
    badgeBorder: '#854d0e40',
    badgeText: '#713f12',
  },
  '後蜀': {
    name: '後蜀',
    color: '#b45309',
    bgGradient: 'from-[#f59e0b] to-[#78350f]',
    badgeBg: '#b4530918',
    badgeBorder: '#b4530940',
    badgeText: '#78350f',
  },
  '呉（五代十国）': {
    name: '呉（五代十国）',
    color: '#65a30d',
    bgGradient: 'from-[#84cc16] to-[#3f6212]',
    badgeBg: '#65a30d18',
    badgeBorder: '#65a30d40',
    badgeText: '#3f6212',
  },
  '南唐': {
    name: '南唐',
    color: '#a21caf',
    bgGradient: 'from-[#c084fc] to-[#701a75]',
    badgeBg: '#a21caf18',
    badgeBorder: '#a21caf40',
    badgeText: '#701a75',
  },
  '南漢': {
    name: '南漢',
    color: '#ea580c',
    bgGradient: 'from-[#f97316] to-[#9a3412]',
    badgeBg: '#ea580c18',
    badgeBorder: '#ea580c40',
    badgeText: '#9a3412',
  },
  '北漢': {
    name: '北漢',
    color: '#64748b',
    bgGradient: 'from-[#94a3b8] to-[#334155]',
    badgeBg: '#64748b18',
    badgeBorder: '#64748b40',
    badgeText: '#334155',
  },
  '北宋': {
    name: '北宋',
    color: '#16a34a',
    bgGradient: 'from-[#22c55e] to-[#15803d]',
    badgeBg: '#16a34a18',
    badgeBorder: '#16a34a40',
    badgeText: '#15803d',
  },
  '南宋': {
    name: '南宋',
    color: '#15803d',
    bgGradient: 'from-[#16a34a] to-[#14532d]',
    badgeBg: '#15803d18',
    badgeBorder: '#15803d40',
    badgeText: '#14532d',
  },
  '遼': {
    name: '遼',
    color: '#0891b2',
    bgGradient: 'from-[#06b6d4] to-[#155e75]',
    badgeBg: '#0891b218',
    badgeBorder: '#0891b240',
    badgeText: '#155e75',
  },
  '西遼': {
    name: '西遼',
    color: '#155e75',
    bgGradient: 'from-[#0891b2] to-[#164e63]',
    badgeBg: '#155e7518',
    badgeBorder: '#155e7540',
    badgeText: '#164e63',
  },
  '西夏': {
    name: '西夏',
    color: '#9333ea',
    bgGradient: 'from-[#c084fc] to-[#6b21a8]',
    badgeBg: '#9333ea18',
    badgeBorder: '#9333ea40',
    badgeText: '#6b21a8',
  },
  '金': {
    name: '金',
    color: '#7c3aed',
    bgGradient: 'from-[#a855f7] to-[#5b21b6]',
    badgeBg: '#7c3aed18',
    badgeBorder: '#7c3aed40',
    badgeText: '#5b21b6',
  },
  '斉（宋金代）': {
    name: '斉（宋金代）',
    color: '#d97706',
    bgGradient: 'from-[#fbbf24] to-[#92400e]',
    badgeBg: '#d9770618',
    badgeBorder: '#d9770640',
    badgeText: '#92400e',
  },
  '元': {
    name: '元',
    color: '#2563eb',
    bgGradient: 'from-[#3b82f6] to-[#1d4ed8]',
    badgeBg: '#2563eb18',
    badgeBorder: '#2563eb40',
    badgeText: '#1d4ed8',
  },
  '宋（元）': {
    name: '宋（元）',
    color: '#dc2626',
    bgGradient: 'from-[#ef4444] to-[#991b1b]',
    badgeBg: '#dc262618',
    badgeBorder: '#dc262640',
    badgeText: '#991b1b',
  },
  '天完': {
    name: '天完',
    color: '#be185d',
    bgGradient: 'from-[#f43f5e] to-[#881337]',
    badgeBg: '#be185d18',
    badgeBorder: '#be185d40',
    badgeText: '#881337',
  },
  '北元': {
    name: '北元',
    color: '#1d4ed8',
    bgGradient: 'from-[#3b82f6] to-[#1e3a8a]',
    badgeBg: '#1d4ed818',
    badgeBorder: '#1d4ed840',
    badgeText: '#1e3a8a',
  },
  '明': {
    name: '明',
    color: '#ef4444',
    bgGradient: 'from-[#f87171] to-[#dc2626]',
    badgeBg: '#ef444418',
    badgeBorder: '#ef444440',
    badgeText: '#b91c1c',
  },
  '清': {
    name: '清',
    color: '#0284c7',
    bgGradient: 'from-[#38bdf8] to-[#0369a1]',
    badgeBg: '#0284c718',
    badgeBorder: '#0284c740',
    badgeText: '#0369a1',
  },
};

// Default fallback color config for any unknown dynasty
const DEFAULT_DYNASTY_COLOR: DynastyColorConfig = {
  name: 'その他',
  color: '#8e706d',
  bgGradient: 'from-[#a8a29e] to-[#57534e]',
  badgeBg: '#8e706d18',
  badgeBorder: '#8e706d40',
  badgeText: '#57534e',
};

/**
 * Returns the exact or fuzzy matched DynastyColorConfig for a given dynasty name string.
 */
export function getDynastyColor(dynastyName: string): DynastyColorConfig {
  if (!dynastyName) return DEFAULT_DYNASTY_COLOR;
  
  const trimmed = dynastyName.trim();
  
  // 1. Direct match
  if (DYNASTY_COLORS[trimmed]) {
    return DYNASTY_COLORS[trimmed];
  }

  // 2. Exact sub-string or alias handling
  if (trimmed.includes('梁（南北朝）') || trimmed === '南朝梁' || trimmed === '梁') {
    return DYNASTY_COLORS['梁（南北朝）'];
  }
  if (trimmed.includes('後梁（南北朝）') || trimmed === '西梁') {
    return DYNASTY_COLORS['後梁（南北朝）'];
  }
  if (trimmed.includes('梁（隋末）')) {
    return DYNASTY_COLORS['梁（隋末）'];
  }
  if (trimmed.includes('呉（三国）')) {
    return DYNASTY_COLORS['呉（三国）'];
  }
  if (trimmed.includes('呉（五代十国）') || trimmed === '南呉') {
    return DYNASTY_COLORS['呉（五代十国）'];
  }
  if (trimmed.includes('呉')) {
    return DYNASTY_COLORS['呉（三国）'];
  }
  if (trimmed.includes('斉（宋金代）') || trimmed === '劉斉') {
    return DYNASTY_COLORS['斉（宋金代）'];
  }
  if (trimmed.includes('宋（元）') || trimmed === '韓宋') {
    return DYNASTY_COLORS['宋（元）'];
  }
  if (trimmed.includes('北宋') || trimmed === '宋') {
    return DYNASTY_COLORS['北宋'];
  }
  if (trimmed.includes('南宋')) {
    return DYNASTY_COLORS['南宋'];
  }
  if (trimmed.includes('前漢')) {
    return DYNASTY_COLORS['前漢'];
  }
  if (trimmed.includes('後漢')) {
    return DYNASTY_COLORS['後漢'];
  }
  if (trimmed.includes('蜀漢')) {
    return DYNASTY_COLORS['蜀漢'];
  }
  if (trimmed.includes('北漢')) {
    return DYNASTY_COLORS['北漢'];
  }
  if (trimmed.includes('南漢')) {
    return DYNASTY_COLORS['南漢'];
  }
  if (trimmed.includes('漢')) {
    return DYNASTY_COLORS['前漢'];
  }
  if (trimmed.includes('秦')) {
    return DYNASTY_COLORS['秦'];
  }
  if (trimmed.includes('北魏')) {
    return DYNASTY_COLORS['北魏'];
  }
  if (trimmed.includes('東魏')) {
    return DYNASTY_COLORS['東魏'];
  }
  if (trimmed.includes('西魏')) {
    return DYNASTY_COLORS['西魏'];
  }
  if (trimmed.includes('魏')) {
    return DYNASTY_COLORS['魏'];
  }
  if (trimmed.includes('西晋')) {
    return DYNASTY_COLORS['西晋'];
  }
  if (trimmed.includes('東晋')) {
    return DYNASTY_COLORS['東晋'];
  }
  if (trimmed.includes('晋')) {
    return DYNASTY_COLORS['西晋'];
  }
  if (trimmed.includes('前蜀')) {
    return DYNASTY_COLORS['前蜀'];
  }
  if (trimmed.includes('後蜀')) {
    return DYNASTY_COLORS['後蜀'];
  }
  if (trimmed.includes('南唐')) {
    return DYNASTY_COLORS['南唐'];
  }
  if (trimmed.includes('唐')) {
    return DYNASTY_COLORS['唐'];
  }
  if (trimmed.includes('隋')) {
    return DYNASTY_COLORS['隋'];
  }
  if (trimmed.includes('新')) {
    return DYNASTY_COLORS['新'];
  }
  if (trimmed.includes('武周') || trimmed === '周') {
    return DYNASTY_COLORS['武周'];
  }
  if (trimmed.includes('成漢')) {
    return DYNASTY_COLORS['成漢'];
  }
  if (trimmed.includes('成家')) {
    return DYNASTY_COLORS['成家'];
  }
  if (trimmed.includes('前燕')) {
    return DYNASTY_COLORS['前燕'];
  }
  if (trimmed.includes('西遼')) {
    return DYNASTY_COLORS['西遼'];
  }
  if (trimmed.includes('遼')) {
    return DYNASTY_COLORS['遼'];
  }
  if (trimmed.includes('西夏')) {
    return DYNASTY_COLORS['西夏'];
  }
  if (trimmed.includes('金')) {
    return DYNASTY_COLORS['金'];
  }
  if (trimmed.includes('北元')) {
    return DYNASTY_COLORS['北元'];
  }
  if (trimmed.includes('元')) {
    return DYNASTY_COLORS['元'];
  }
  if (trimmed.includes('明')) {
    return DYNASTY_COLORS['明'];
  }
  if (trimmed.includes('清')) {
    return DYNASTY_COLORS['清'];
  }

  return DEFAULT_DYNASTY_COLOR;
}
