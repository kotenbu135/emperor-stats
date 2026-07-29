import { HistoricalEvent } from '../types';

export const PALACE_EVENTS: HistoricalEvent[] = [
  {
    id: 'xuanwu-gate',
    title: '玄武門の変',
    titleKanji: '玄武門の変（626年）',
    year: '626年',
    dynasty: '唐',
    category: 'palace',
    summary: '秦王・李世民（のちの唐太宗）が長安の玄武門にて皇太子・李建成と斉王・李元吉を伏兵で急襲・流血粛清し、父・高祖に迫って皇帝の座を譲位させたクーデター。',
    impact: '李世民が即位し、唐朝最盛期の礎となる「貞観の治」が幕を開けた。',
    involvedEmperors: ['tang-taizong', '唐高祖']
  },
  {
    id: 'an-lushan',
    title: '安史の乱',
    titleKanji: '安史の乱（755年–763年）',
    year: '755年',
    dynasty: '唐',
    category: 'palace',
    summary: '節度使・安禄山と史思明が玄宗皇帝に対して起こした大規模反乱。洛陽と長安が落城し、玄宗は四川へ逃亡。馬嵬駅にて楊貴妃が自害に追い込まれた。',
    impact: '唐の人口と経済が致命的に荒廃し、藩鎮の割拠を招いて唐朝滅亡への転換点となった。',
    involvedEmperors: ['xuanzong-tang']
  },
  {
    id: 'chenqiao-mutiny',
    title: '陳橋の変',
    titleKanji: '陳橋の変（960年）',
    year: '960年',
    dynasty: '宋',
    category: 'palace',
    summary: '後周の禁軍点検・趙匡胤が陳橋駅にて部下たちから黄袍（皇帝の衣）を羽織らせられ、7歳の後周恭帝から無血で禅譲を受けて即位した政変。',
    impact: '宋朝（北宋）が創始され、武臣を抑えて文臣を重用する「文治主義」が確立された。',
    involvedEmperors: ['宋太祖']
  },
  {
    id: 'jingnan-campaign',
    title: '靖難の変',
    titleKanji: '靖難の変（1399年–1402年）',
    year: '1399年',
    dynasty: '明',
    category: 'palace',
    summary: '燕王・朱棣が甥の建文帝による削藩政策に反発し「君側の奸を清める（靖難）」と称して挙兵。南京を攻略して皇宮を焼失させ、永楽帝として即位した。',
    impact: '明朝の首都が南京から北京に移転され、紫禁城の建設や鄭和の西洋下海へ繋がった。',
    involvedEmperors: ['建文帝', '永楽帝', 'hongwu-ming']
  },
  {
    id: 'coup-1898',
    title: '戊戌の政変',
    titleKanji: '戊戌の政変（1898年）',
    year: '1898年',
    dynasty: '清',
    category: 'palace',
    summary: '光緒帝が康有為らと進めた立憲君主制を目指す「戊戌の変法（変法自強運動）」に対し、西太后ら保守派が宮廷クーデターを起こして光緒帝を瀛台に幽閉した。',
    impact: '清朝の近代化改革が頓挫し、義和団の乱および八カ国連合軍の侵略を招く破滅的結果となった。',
    involvedEmperors: ['光緒帝', 'puyi']
  }
];

export const MILITARY_ACTIONS: HistoricalEvent[] = [
  {
    id: 'battle-red-cliffs',
    title: '赤壁の戦い',
    titleKanji: '赤壁の戦い（208年）',
    year: '208年',
    dynasty: '漢 / 三国時代',
    category: 'military',
    summary: '曹操の80万と称する水軍に対し、孫権・劉備の連合軍が長江の赤壁にて火攻めを用いて大破した歴史的合戦。',
    impact: '曹操による天下統一の野望が挫折し、魏・蜀・呉の「三国鼎立」の時代が定まった。',
    involvedEmperors: ['漢献帝', '曹丕']
  },
  {
    id: 'nerchinsk-treaty',
    title: 'アルバジン攻略・ネルチンスク条約',
    titleKanji: 'ネルチンスク条約（1689年）',
    year: '1689年',
    dynasty: '清',
    category: 'military',
    summary: '康熙帝がアムール川沿いのロシア軍要塞アルバジンを包囲攻撃し、ロシア帝国（ピョートル1世）と中国史上初となる対等な国際対外条約を結んだ。',
    impact: '外興安嶺（スタノヴォイ山脈）を境界とし、清朝東北部の国境線を約200年間安定させた。',
    involvedEmperors: ['kangxi']
  },
  {
    id: 'ten-great-campaigns',
    title: '十全武功（乾隆帝の十遠征）',
    titleKanji: '十全武功（1747年–1792年）',
    year: '1750年代',
    dynasty: '清',
    category: 'military',
    summary: '乾隆帝がジュンガル、新疆、チベット、ビルマ、ベトナム、ネパールのグルカ族に対して実施した10回の大規模軍事遠征。',
    impact: '新疆（新たな開拓地）やチベットを完全に清朝の版図に組み入れ、史上最大規模（約1,470万km²）の領土を実現した。',
    involvedEmperors: ['qianlong']
  },
  {
    id: 'imjin-war',
    title: '文禄・慶長の役（救援派遣）',
    titleKanji: '文禄・慶長の役 援朝（1592年–1598年）',
    year: '1592年',
    dynasty: '明',
    category: 'military',
    summary: '豊臣秀吉による朝鮮侵略に対し、万暦帝が20万人を超える明軍を朝鮮半島へ救援派遣し、日明・朝鮮の大規模戦争となった。',
    impact: '朝鮮王朝を滅亡から救った一方、明朝の財政と北方防衛の精鋭軍を著しく消耗させ、女真族（のちの清）の台頭を許した。',
    involvedEmperors: ['wanli']
  }
];

