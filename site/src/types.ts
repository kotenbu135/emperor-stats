export type ActiveTab =
  | 'dashboard'
  | 'emperor-list'
  | 'timeline'
  | 'family-tree'
  | 'death-causes'
  | 'military'
  | 'age'
  | 'palace-events'
  | 'genealogy'
  | 'about';

export type DynastyCategory = '正統' | '並立' | '自称';

export type CauseOfDeathCategory =
  | '病死'
  | '暗殺'
  | '処刑'
  | '戦死'
  | '自尽'
  | '事故死'
  | '不詳'
  | '諸説あり';

export type SuccessionCategory =
  | '世襲・嫡子'
  | '擁立・政変'
  | '開国・創業'
  | '受禅'
  | '自立'
  | '簒奪・クーデター'
  | '弑逆・廃位';

export interface Emperor {
  id: string;
  name: string; // 例: "康熙帝"
  templeName: string; // 例: "清聖祖"
  givenName: string; // 例: "愛新覚羅・玄燁"
  dynasty: string; // 例: "清"
  dynastyKanji: string; // 例: "清"
  dynastyCategory?: DynastyCategory; // '正統' | '並立' | '自称'
  eraGroup?: string; // 例: "秦", "漢", "三国", "晋", "南北朝", "隋", "唐", "五代十国", "宋", "遼・金・西夏", "元", "明", "清"
  reignYears: number; // 例: 61.9
  reignPeriod: string; // 例: "1661年–1722年"
  birthYear: number | string; // 例: 1654
  deathYear: number | string; // 例: 1722
  ageAtAscension: number; // 例: 7
  lifespan: number; // 例: 68
  causeOfDeathCategory: CauseOfDeathCategory;
  causeOfDeathDetail: string;
  successionType: SuccessionCategory;
  portraitUrl?: string;
  summary: string;
  keyAchievements: string[];
  historicalAssessment: string;
  famousQuote?: string;
}

export interface DynastyInfo {
  id: string;
  name: string;
  kanji: string;
  period: string;
  emperorCount: number;
  capital: string;
  avgReign: number;
  longestEmperor: string;
  color: string;
  description: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  titleKanji: string;
  year: string;
  dynasty: string;
  category: 'palace' | 'military';
  summary: string;
  impact: string;
  involvedEmperors: string[];
  location?: string;
}
