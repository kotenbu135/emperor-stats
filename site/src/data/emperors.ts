import { Emperor, DynastyCategory, CauseOfDeathCategory, SuccessionCategory } from '../types';

// Dynamically import all dynasty-based JSON files in /emperors/, /data/emperors/, or /src/data/emperors/
const dynastyModules = ((import.meta as any).glob([
  '/emperors/dyn_*.json',
  '/emperors/*.json',
  '/data/emperors/*.json',
  '/src/data/emperors/*.json',
  './emperors/*.json'
], { eager: true })) as Record<string, any>;

let loadedRawEmperorsList: any[] = [];
const seenIds = new Set<string>();

for (const path in dynastyModules) {
  // Exclude index.json or non-dynasty files if needed
  if (path.includes('index.json')) continue;
  const mod = dynastyModules[path] as any;
  const content = mod?.default || mod;
  let items: any[] = [];
  if (Array.isArray(content)) {
    items = content;
  } else if (content && Array.isArray(content.emperors)) {
    items = content.emperors;
  }
  for (const emp of items) {
    if (emp && emp.id && !seenIds.has(emp.id)) {
      seenIds.add(emp.id);
      loadedRawEmperorsList.push(emp);
    }
  }
}

export const RAW_EMPERORS = { emperors: loadedRawEmperorsList };
export const RAW_KINSHIP = {};

const PORTRAITS_MAP: Record<string, string> = {
  'qin-shi-huang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Qin_Shi_Huang_Shi_Huangdi.jpg/800px-Qin_Shi_Huang_Shi_Huangdi.jpg',
  'gaozu-han': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Gaozu_of_Han.jpg/800px-Gaozu_of_Han.jpg',
  'wudi-han': 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Emperor_Wu_of_Han.jpg',
  'guangwu-han': 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Guangwu_of_Han.jpg',
  'taizong-tang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/TangTaizong.jpg/800px-TangTaizong.jpg',
  'wuzetian': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Wu_Zetian_drawn_in_1690.jpg',
  'song-taizu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Song_Taizu.jpg/800px-Song_Taizu.jpg',
  'yuan-shizu-kubilai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/YuanEmperorAlbumKhubilaiPortrait.jpg/800px-YuanEmperorAlbumKhubilaiPortrait.jpg',
  'ming-taizu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Hongwu_Emperor.jpg/800px-Hongwu_Emperor.jpg',
  'ming-chengzu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Yongle-Emperor.jpg/800px-Yongle-Emperor.jpg',
  'qing-shengzu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/The_Kangxi_Emperor_in_Court_Dress.jpg/800px-The_Kangxi_Emperor_in_Court_Dress.jpg',
  'qing-gaozong': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/The_Qianlong_Emperor_in_Court_Dress.jpg/800px-The_Qianlong_Emperor_in_Court_Dress.jpg',
  'qing-xuantong': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Puyi_as_Puyijian.jpg/800px-Puyi_as_Puyijian.jpg'
};

function formatHistoricalDate(dateStr?: string | null, fallbackYear?: number): string {
  if (!dateStr) {
    if (fallbackYear !== undefined && fallbackYear !== null && !isNaN(fallbackYear)) {
      return fallbackYear < 0 ? `前${Math.abs(fallbackYear)}年` : `${fallbackYear}年`;
    }
    return '不詳';
  }
  const str = String(dateStr).trim();
  if (str.startsWith('-')) {
    const yearNum = Math.abs(parseInt(str.slice(1), 10));
    return `前${yearNum}年`;
  }
  const yearNum = parseInt(str, 10);
  if (!isNaN(yearNum)) {
    return `${yearNum}年`;
  }
  return str;
}

export function convertRawEmperorToEmperor(rawEmp: any): Emperor {
  const commonName = rawEmp.name?.commonName || rawEmp.name?.personalName || rawEmp.id;
  const templeName = rawEmp.name?.templeName || (rawEmp.name?.aliases && rawEmp.name.aliases[0]) || rawEmp.name?.posthumousName || commonName;
  const givenName = rawEmp.name?.personalName || '';

  const dynastyName = rawEmp.dynasty?.name || '不明';
  const dynastyKanji = dynastyName[0] || '華';
  
  let dynastyCat: DynastyCategory = '正統';
  const rawDynCat = rawEmp.dynasty?.category || '';
  if (rawDynCat.includes('自称') || rawDynCat.includes('反乱')) {
    dynastyCat = '自称';
  } else if (rawDynCat.includes('並立')) {
    dynastyCat = '並立';
  }

  const name = rawEmp.dynasty?.name || '';
  const section = rawEmp.dynasty?.section || '';
  const id = rawEmp.id || '';

  let eraGroup = 'その他';
  if (id === 'qin-shi-huang' || id === 'qin-er-shi' || (name === '秦' && section.includes('秦'))) {
    eraGroup = '秦';
  } else if (['前漢', '新', '玄漢（更始）', '漢（赤眉軍）', '成家', '仲家'].includes(name) || id.startsWith('han-gaozu') || id.startsWith('xihan') || section.includes('前漢') || section.includes('西漢')) {
    eraGroup = '前漢';
  } else if (name === '後漢' || id.startsWith('donghan') || section.includes('後漢') || section.includes('東漢')) {
    eraGroup = '後漢';
  } else if (section === '三国時代' || ['魏', '蜀漢', '呉', '呉（三国）'].includes(name) || id.startsWith('sanguo')) {
    eraGroup = '三国';
  } else if (name === '西晋' || id.startsWith('xijin')) {
    eraGroup = '西晋';
  } else if (['東晋', '楚', '前涼', '前趙', '前燕', '成漢', '後趙', '前秦', '夏', '後燕', '西燕', '南燕', '後秦', '北燕', '後涼', '南涼', '西涼', '冉魏', '代', '段部', '宇文部', '翟魏', '楚（桓楚）', '前趙（漢趙）'].includes(name) || id.startsWith('dongjin') ||
             section.includes('十六国') || section === '晋') {
    eraGroup = '五胡十六国';
  } else if (['南朝', '北朝', '南北朝'].includes(section) || ['斉', '陳', '北魏', '東魏', '西魏', '北斉', '北周', '梁（南北朝）', '後梁（南北朝）', '南朝宋'].includes(name) || (name === '宋' && section === '南朝')) {
    eraGroup = '南北朝';
  } else if (name === '隋' || name === '随' || section === '隋' || section.includes('隋末群雄') || name === '梁（隋末）') {
    eraGroup = '随';
  } else if (['唐', '武周', '周'].includes(name) || section === '唐') {
    eraGroup = '唐';
  } else if (section.includes('五代') || section.includes('十国') || ['後梁', '後唐', '後晋', '後漢', '後周', '前蜀', '後蜀', '呉（五代十国）', '南唐', '呉越', '閩', '荊南', '南漢', '北漢'].includes(name)) {
    eraGroup = '五代十国';
  } else if (['北宋', '南宋'].includes(name) || (name === '宋' && section !== '南朝') || id.startsWith('beisong') || id.startsWith('nansong')) {
    eraGroup = '宋';
  } else if (['遼', '金', '西夏', '西遼', '斉（宋金代）'].includes(name) || ['遼', '金', '西夏'].includes(section) || section === '宋遼西夏金') {
    eraGroup = '遼・金・西夏';
  } else if (['元', '北元', '天完', '宋（元）'].includes(name) || section === '元') {
    eraGroup = '元';
  } else if (name.includes('明') || section.includes('明')) {
    eraGroup = '明';
  } else if (name.includes('清') || section.includes('清')) {
    eraGroup = '清';
  }

  const primaryReign = (rawEmp.reigns && rawEmp.reigns[0]) || {};
  const dur = primaryReign.duration || {};
  let reignYears = 0;
  if (typeof dur.displayYears === 'number') {
    reignYears = dur.displayYears;
  } else if (dur.unit === 'year' && typeof dur.value === 'number') {
    reignYears = dur.value;
  } else if (dur.unit === 'day' && typeof dur.value === 'number') {
    reignYears = Number((dur.value / 365.25).toFixed(2));
  } else if (typeof dur.approxDays === 'number') {
    reignYears = Number((dur.approxDays / 365.25).toFixed(2));
  } else if (primaryReign.startYear !== undefined && primaryReign.endYear !== undefined) {
    reignYears = Math.max(0.1, Math.abs(primaryReign.endYear - primaryReign.startYear));
  }
  
  const reignPeriod = primaryReign.raw || (
    primaryReign.startYear !== undefined
      ? `${primaryReign.startYear < 0 ? `紀元前${Math.abs(primaryReign.startYear)}` : primaryReign.startYear}年–${primaryReign.endYear < 0 ? `前${Math.abs(primaryReign.endYear)}` : primaryReign.endYear}年`
      : '不詳'
  );

  const birthYear = formatHistoricalDate(rawEmp.ages?.birthDate, primaryReign.startYear && rawEmp.ages?.accessionAge ? primaryReign.startYear - rawEmp.ages.accessionAge : undefined);
  const deathYear = formatHistoricalDate(rawEmp.ages?.deathDate, primaryReign.endYear);

  const ageAtAscension = rawEmp.ages?.accessionAge ?? 0;
  const lifespan = rawEmp.ages?.deathAge ?? 0;

  let causeCat: CauseOfDeathCategory = '病死';
  const rawDeathCat = rawEmp.deathCause?.category || '';
  const deathNote = rawEmp.deathCause?.note || '';

  if (
    rawDeathCat === '病死' ||
    rawDeathCat === '暗殺' ||
    rawDeathCat === '処刑' ||
    rawDeathCat === '戦死' ||
    rawDeathCat === '自尽' ||
    rawDeathCat === '事故死' ||
    rawDeathCat === '不詳' ||
    rawDeathCat === '諸説あり'
  ) {
    causeCat = rawDeathCat;
  } else {
    causeCat = '不詳';
  }

  let succType: SuccessionCategory = '世襲・嫡子';
  const rawAccession = rawEmp.accessionRoute?.category || '';
  if (rawAccession.includes('受禅') || rawAccession.includes('内禅')) {
    succType = '受禅';
  } else if (rawAccession.includes('簒奪')) {
    succType = '簒奪・クーデター';
  } else if (rawAccession.includes('擁立') || rawAccession.includes('推戴')) {
    succType = '擁立・政変';
  } else if (rawAccession.includes('自立')) {
    succType = '自立';
  } else if (rawAccession.includes('創業') || rawAccession.includes('開国')) {
    succType = '開国・創業';
  } else if (rawAccession.includes('世襲')) {
    succType = '世襲・嫡子';
  }

  const summaryStr = typeof rawEmp.reignSummary === 'string'
    ? rawEmp.reignSummary
    : `${dynastyName}（${eraGroup}）の皇帝。在位期間:${reignPeriod}。`;

  const keyAchievements: string[] = [];
  if (typeof rawEmp.reignSummary === 'string' && rawEmp.reignSummary) {
    keyAchievements.push(rawEmp.reignSummary);
  }
  if (rawEmp.rebellionSuppressionCount?.count) {
    keyAchievements.push(`反乱平定 ${rawEmp.rebellionSuppressionCount.count} 回`);
  }
  if (rawEmp.personalCampaignCount?.count) {
    keyAchievements.push(`親征 ${rawEmp.personalCampaignCount.count} 回`);
  }
  if (rawEmp.eraChangeCount?.count) {
    keyAchievements.push(`改元 ${rawEmp.eraChangeCount.count} 回`);
  }
  if (keyAchievements.length === 0) {
    keyAchievements.push(`在位期間 ${reignYears} 年`);
  }

  const portraitUrl = PORTRAITS_MAP[rawEmp.id];

  return {
    id: rawEmp.id,
    name: commonName,
    templeName: templeName,
    givenName: givenName,
    dynasty: dynastyName,
    dynastyKanji: dynastyKanji,
    dynastyCategory: dynastyCat,
    eraGroup: eraGroup,
    reignYears: Number(reignYears.toFixed(1)),
    reignPeriod: String(reignPeriod),
    birthYear: String(birthYear),
    deathYear: String(deathYear),
    ageAtAscension: Number(ageAtAscension),
    lifespan: Number(lifespan),
    causeOfDeathCategory: causeCat,
    causeOfDeathDetail: deathNote || '正史の崩御記録',
    successionType: succType,
    portraitUrl: portraitUrl,
    summary: summaryStr,
    keyAchievements: keyAchievements,
    historicalAssessment: deathNote || `${dynastyName}の史実上の皇帝。`
  };
}

export const EMPERORS_DATA: Emperor[] = loadedRawEmperorsList.map(convertRawEmperorToEmperor);

export const EMPEROR_MAP_BY_ID: Map<string, Emperor> = new Map(
  EMPERORS_DATA.map((emp) => [emp.id, emp])
);

export const EMPEROR_MAP_BY_NAME: Map<string, Emperor> = new Map(
  EMPERORS_DATA.map((emp) => [emp.name, emp])
);

const RAW_DYNASTY_CONFIGS = [
  { name: '秦', kanji: '秦', era: '紀元前221年–前206年', eraGroup: '秦', color: '#8f000d' },
  { name: '前漢', kanji: '前漢', era: '紀元前202年–8年', eraGroup: '前漢', color: '#b22222' },
  { name: '後漢', kanji: '後漢', era: '25年–220年', eraGroup: '後漢', color: '#d97706' },
  { name: '三国時代', kanji: '三国', era: '220年–280年', eraGroup: '三国', color: '#126e0c' },
  { name: '西晋', kanji: '西晋', era: '265年–316年', eraGroup: '西晋', color: '#6366f1' },
  { name: '五胡十六国', kanji: '十六国', era: '304年–439年', eraGroup: '五胡十六国', color: '#8e706d' },
  { name: '南北朝時代', kanji: '南北朝', era: '420年–589年', eraGroup: '南北朝', color: '#cca72f' },
  { name: '随', kanji: '随', era: '581年–618年', eraGroup: '随', color: '#059669' },
  { name: '唐', kanji: '唐', era: '618年–907年', eraGroup: '唐', color: '#eab308' },
  { name: '五代十国', kanji: '五代', era: '907年–960年', eraGroup: '五代十国', color: '#f97316' },
  { name: '宋（北宋・南宋）', kanji: '宋', era: '960年–1279年', eraGroup: '宋', color: '#16a34a' },
  { name: '遼・金・西夏', kanji: '遼', era: '916年–1234年', eraGroup: '遼・金・西夏', color: '#0891b2' },
  { name: '元', kanji: '元', era: '1271年–1368年', eraGroup: '元', color: '#2563eb' },
  { name: '明', kanji: '明', era: '1368年–1644年', eraGroup: '明', color: '#ef4444' },
  { name: '清', kanji: '清', era: '1636年–1912年', eraGroup: '清', color: '#0284c7' }
];

export const DYNASTIES_SUMMARY = RAW_DYNASTY_CONFIGS.map((cfg) => {
  const emps = EMPERORS_DATA.filter((e) => e.eraGroup === cfg.eraGroup);
  const count = emps.length;
  const totalReign = emps.reduce((acc, e) => acc + e.reignYears, 0);
  const avgReign = count > 0 ? Number((totalReign / count).toFixed(1)) : 0;
  return {
    name: cfg.name,
    kanji: cfg.kanji,
    era: cfg.era,
    count,
    color: cfg.color,
    avgReign,
  };
});
