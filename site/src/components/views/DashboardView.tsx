import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  PieChart,
  Pie,
  CartesianGrid,
} from 'recharts';
import { Emperor } from '../../types';
import { EMPERORS_DATA } from '../../data/emperors';

interface DashboardViewProps {
  onSelectEmperor: (emperor: Emperor) => void;
}

const CustomBarTooltip = ({ active, payload, barMetric }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const unit = barMetric === 'count' ? '名' : '年';
    const labelText =
      barMetric === 'count'
        ? '皇帝数'
        : barMetric === 'avgReign'
        ? '平均在位年数'
        : '平均寿命';

    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#cca72f] p-3 rounded-xl shadow-xl text-xs font-sans">
        <div className="font-serif-title font-bold text-sm text-[#8f000d] mb-1">
          {data.label}（{data.period}）
        </div>
        <div className="text-[#191c1c] font-semibold mb-1">
          {labelText}:{' '}
          <span className="text-[#8f000d] font-bold text-sm">
            {data.displayValue}
            {unit}
          </span>
        </div>
        <div className="text-[#5a403e] text-[11px] space-y-0.5 pt-1 border-t border-[#e2beba]/50">
          <div>皇帝総数: {data.count}名</div>
          <div>平均在位: {data.avgReign}年</div>
          <div>平均寿命: {data.avgLifespan}歳</div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-[#cca72f] p-2.5 rounded-xl shadow-xl text-xs font-sans">
        <div className="font-serif-title font-bold text-[#191c1c] mb-0.5">
          {data.name}
        </div>
        <div className="text-[#8f000d] font-bold text-sm">
          {data.value}%{' '}
          <span className="text-[#5a403e] text-xs font-normal">
            （{data.count}名）
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectEmperor,
}) => {
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const [hoveredSuccessionIndex, setHoveredSuccessionIndex] = useState<number | null>(null);
  const [barMetric, setBarMetric] = useState<'count' | 'avgReign' | 'avgLifespan'>('count');

  // Real data computations
  const totalEmperorsCount = EMPERORS_DATA.length;

  const totalDynastiesCount = useMemo(() => {
    return new Set(EMPERORS_DATA.map((e) => e.dynasty)).size;
  }, []);

  const avgReignOverall = useMemo(() => {
    if (!EMPERORS_DATA.length) return '0.0';
    const sum = EMPERORS_DATA.reduce((acc, e) => acc + e.reignYears, 0);
    return (sum / EMPERORS_DATA.length).toFixed(1);
  }, []);

  // Cause of death data calculated from real EMPERORS_DATA
  const causeOfDeathData = useMemo(() => {
    const counts: Record<string, number> = {
      病死: 0,
      暗殺: 0,
      処刑: 0,
      戦死: 0,
      自尽: 0,
      事故死: 0,
      不詳: 0,
      諸説あり: 0,
    };

    EMPERORS_DATA.forEach((e) => {
      const cat = e.causeOfDeathCategory;
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts['不詳']++;
      }
    });

    const total = EMPERORS_DATA.length || 1;

    const metaMap: Record<
      string,
      { name: string; shortName: string; color: string }
    > = {
      病死: { name: '病死', shortName: '病死', color: '#8f000d' },
      暗殺: { name: '暗殺', shortName: '暗殺', color: '#126e0c' },
      処刑: { name: '処刑', shortName: '処刑', color: '#8e706d' },
      戦死: { name: '戦死', shortName: '戦死', color: '#5a403e' },
      自尽: { name: '自尽', shortName: '自尽', color: '#b22222' },
      事故死: { name: '事故死', shortName: '事故死', color: '#2563eb' },
      不詳: { name: '不詳', shortName: '不詳', color: '#735c00' },
      諸説あり: { name: '諸説あり', shortName: '諸説あり', color: '#cca72f' },
    };

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([catKey, count]) => {
        const meta = metaMap[catKey] || {
          name: catKey,
          shortName: catKey,
          color: '#5a403e',
        };
        return {
          name: meta.name,
          shortName: meta.shortName,
          count,
          value: Number(((count / total) * 100).toFixed(1)),
          color: meta.color,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, []);

  const activePieItem =
    hoveredPieIndex !== null && causeOfDeathData[hoveredPieIndex]
      ? causeOfDeathData[hoveredPieIndex]
      : causeOfDeathData[0] || {
          name: '',
          shortName: '',
          count: 0,
          value: 0,
          color: '#8f000d',
        };

  // Period data calculated dynamically from real EMPERORS_DATA
  const periodData = useMemo(() => {
    const periodDefs = [
      { key: '秦', period: '秦', label: '秦朝' },
      { key: '前漢', period: '前漢', label: '前漢' },
      { key: '後漢', period: '後漢', label: '後漢' },
      { key: '三国', period: '三国', label: '三国時代' },
      { key: '西晋', period: '西晋', label: '西晋' },
      { key: '五胡十六国', period: '十六国', label: '五胡十六国' },
      { key: '南北朝', period: '南北朝', label: '南北朝時代' },
      { key: '随', period: '随', label: '随朝' },
      { key: '唐', period: '唐', label: '唐朝・武周' },
      { key: '五代十国', period: '五代', label: '五代十国時代' },
      { key: '宋', period: '宋', label: '北宋・南宋' },
      { key: '遼・金・西夏', period: '遼', label: '遼・金・西夏' },
      { key: '元', period: '元', label: '元朝' },
      { key: '明', period: '明', label: '明朝' },
      { key: '清', period: '清', label: '清朝' },
    ];

    const grouped: Record<string, Emperor[]> = {};
    periodDefs.forEach((p) => {
      grouped[p.key] = [];
    });

    EMPERORS_DATA.forEach((emp) => {
      const g = emp.eraGroup || '';
      if (grouped[g]) {
        grouped[g].push(emp);
      }
    });

    const items = periodDefs.map((p) => {
      const list = grouped[p.key] || [];
      const count = list.length;
      const totalReign = list.reduce((acc, e) => acc + e.reignYears, 0);
      const avgReign = count > 0 ? Number((totalReign / count).toFixed(1)) : 0;
      const validLifespans = list.filter(
        (e) => typeof e.lifespan === 'number' && e.lifespan > 0
      );
      const avgLifespan =
        validLifespans.length > 0
          ? Number(
              (
                validLifespans.reduce((acc, e) => acc + e.lifespan, 0) /
                validLifespans.length
              ).toFixed(1)
            )
          : 0;

      const displayValue =
        barMetric === 'count'
          ? count
          : barMetric === 'avgReign'
          ? avgReign
          : avgLifespan;

      return {
        period: p.period,
        label: p.label,
        count,
        avgReign,
        avgLifespan,
        displayValue,
      };
    });

    const maxVal = Math.max(...items.map((i) => i.displayValue), 1);
    return items.map((i) => ({
      ...i,
      heightPct: Math.round((i.displayValue / maxVal) * 100),
    }));
  }, [barMetric]);

  // Succession path data calculated dynamically from real EMPERORS_DATA
  const successionData = useMemo(() => {
    const counts: Record<string, number> = {};
    EMPERORS_DATA.forEach((e) => {
      const type = e.successionType || 'その他';
      counts[type] = (counts[type] || 0) + 1;
    });

    const total = EMPERORS_DATA.length || 1;

    const labelsMap: Record<
      string,
      { label: string; shortName: string; color: string }
    > = {
      '世襲・嫡子': { label: '皇嗣世襲（正統継承）', shortName: '皇嗣世襲', color: '#8f000d' },
      '擁立・政変': { label: '擁立・宮廷政変', shortName: '擁立・政変', color: '#b22222' },
      '開国・創業': { label: '建国開祖（開国皇帝）', shortName: '建国開祖', color: '#126e0c' },
      '簒奪・クーデター': { label: 'クーデター・奪権', shortName: 'クーデター', color: '#735c00' },
      受禅: { label: '受禅（禅譲）', shortName: '受禅', color: '#8e706d' },
      自立: { label: '地方自立・僭称', shortName: '地方自立', color: '#5a403e' },
    };

    return Object.entries(counts)
      .map(([key, count]) => {
        const meta = labelsMap[key] || {
          label: key,
          shortName: key,
          color: '#5a403e',
        };
        return {
          key,
          name: meta.label,
          label: meta.label,
          shortName: meta.shortName,
          count,
          value: Number(((count / total) * 100).toFixed(1)),
          pct: Number(((count / total) * 100).toFixed(1)),
          color: meta.color,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, []);

  const activeSuccessionItem =
    hoveredSuccessionIndex !== null && successionData[hoveredSuccessionIndex]
      ? successionData[hoveredSuccessionIndex]
      : successionData[0] || {
          name: '',
          label: '',
          shortName: '',
          count: 0,
          value: 0,
          pct: 0,
          color: '#8f000d',
        };

  // Top longest reigns
  const longestReigns = useMemo(() => {
    return [...EMPERORS_DATA].sort((a, b) => b.reignYears - a.reignYears);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4 pb-8"
    >
      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
        {/* KPI 1: Total Emperors */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-3 bento-card rounded-xl p-4 sm:p-4.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-sm text-[#5a403e] uppercase tracking-wider font-semibold">
              総歴代皇帝数
            </h3>
            <span className="material-symbols-outlined text-[#8f000d]">
              person
            </span>
          </div>
          <div>
            <div className="font-display-lg text-[#8f000d] drop-shadow-xs text-3xl font-bold font-serif-title">
              {totalEmperorsCount}
            </div>
            <p className="text-[11px] text-[#5a403e] mt-0.5">
              生前に「皇帝」を名乗った人物のみ
            </p>
          </div>
        </motion.div>

        {/* KPI 2: Recorded Dynasties */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-3 bento-card rounded-xl p-4 sm:p-4.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-sm text-[#5a403e] uppercase tracking-wider font-semibold">
              記録王朝数
            </h3>
            <span className="material-symbols-outlined text-[#126e0c]">
              castle
            </span>
          </div>
          <div>
            <div className="font-display-lg text-[#126e0c] drop-shadow-xs text-3xl font-bold font-serif-title">
              {totalDynastiesCount}
            </div>
            <p className="text-[11px] text-[#5a403e] mt-0.5">
              並立政権・自称政権を含む
            </p>
          </div>
        </motion.div>

        {/* KPI 3: Historical Era */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-3 bento-card rounded-xl p-4 sm:p-4.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-sm text-[#5a403e] uppercase tracking-wider font-semibold">
              収録歴史時代
            </h3>
            <span className="material-symbols-outlined text-[#cca72f]">
              history
            </span>
          </div>
          <div>
            <div className="font-serif-title font-bold text-lg sm:text-xl text-[#191c1c] pt-1">
              紀元前221年 ～<br />
              紀元後1912年
            </div>
            <p className="text-[11px] text-[#5a403e] mt-0.5">
              始皇帝の即位から溥儀の最後の在位まで
            </p>
          </div>
        </motion.div>

        {/* KPI 4: Average Reign */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-3 bento-card rounded-xl p-4 sm:p-4.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-sm text-[#5a403e] uppercase tracking-wider font-semibold">
              平均在位年数
            </h3>
            <span className="material-symbols-outlined text-[#b22222]">
              calendar_month
            </span>
          </div>
          <div>
            <div className="font-display-lg text-[#191c1c] drop-shadow-xs flex items-baseline text-3xl font-bold font-serif-title">
              {avgReignOverall}
              <span className="text-base text-[#5a403e] ml-1 font-sans font-medium">
                年
              </span>
            </div>
            <p className="text-[11px] text-[#5a403e] mt-0.5">
              全{totalEmperorsCount}人実データの平均在位期間
            </p>
          </div>
        </motion.div>

        {/* [A] Longest Reign Top 6 */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-6 lg:col-span-4 lg:row-span-2 bento-card rounded-xl p-4 md:p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-serif-title text-base sm:text-lg font-bold text-[#191c1c]">
                最長在位記録
              </h2>
              <span className="material-symbols-outlined text-[#cca72f] drop-shadow-xs">
                military_tech
              </span>
            </div>

            <div className="space-y-2.5">
              {longestReigns.slice(0, 5).map((emp, index) => {
                const maxReign = longestReigns[0].reignYears || 1;
                const pct = Math.round((emp.reignYears / maxReign) * 100);
                const isTop1 = index === 0;

                return (
                  <motion.div
                    key={emp.id}
                    whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    onClick={() => onSelectEmperor(emp)}
                    className="flex items-center gap-3 group cursor-pointer hover:bg-[#f3f4f3]/70 p-1.5 rounded-lg transition-colors"
                  >
                    <div
                      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-xs font-serif-title ${
                        isTop1
                          ? 'bg-gradient-to-br from-[#8f000d] to-[#b22222] text-white'
                          : 'bg-[#edeeed] border border-[#e2beba] text-[#5a403e]'
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="text-xs font-semibold text-[#191c1c] group-hover:text-[#8f000d] transition-colors truncate">
                        {emp.name}{' '}
                        <span className="text-[10px] text-[#5a403e] font-normal">
                          ({emp.dynasty})
                        </span>
                      </div>
                      <div className="w-full bg-[#e7e8e7]/60 rounded-full h-1.5 mt-0.5 shadow-inner overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: index * 0.1 }}
                          className={`h-1.5 rounded-full ${
                            isTop1
                              ? 'bg-gradient-to-r from-[#8f000d] via-[#b22222] to-[#cca72f]'
                              : index === 1
                              ? 'bg-gradient-to-r from-[#b22222] to-[#cca72f]'
                              : 'bg-gradient-to-r from-[#8e706d] to-[#b8918d]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="font-mono text-xs font-bold text-right text-[#8f000d] shrink-0 w-12">
                      {emp.reignYears}年
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] text-[#8e706d] mt-3 italic text-center">
            行をクリックすると皇帝の史実伝記を表示します
          </p>
        </motion.div>

        {/* [C] Emperors by Period */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-6 lg:col-span-8 bento-card rounded-xl p-4 md:p-5 flex flex-col"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h2 className="font-serif-title text-base sm:text-lg font-bold text-[#191c1c]">
                時代・王朝別統計分布
              </h2>
            </div>
            {/* Metric Switcher Controls */}
            <div className="flex items-center gap-1 bg-[#edeeed] p-1 rounded-lg border border-[#e2beba]/50 shrink-0">
              <button
                onClick={() => setBarMetric('count')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  barMetric === 'count'
                    ? 'bg-[#8f000d] text-white shadow-2xs'
                    : 'text-[#5a403e] hover:text-[#191c1c]'
                }`}
              >
                皇帝数
              </button>
              <button
                onClick={() => setBarMetric('avgReign')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  barMetric === 'avgReign'
                    ? 'bg-[#8f000d] text-white shadow-2xs'
                    : 'text-[#5a403e] hover:text-[#191c1c]'
                }`}
              >
                平均在位
              </button>
              <button
                onClick={() => setBarMetric('avgLifespan')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  barMetric === 'avgLifespan'
                    ? 'bg-[#8f000d] text-white shadow-2xs'
                    : 'text-[#5a403e] hover:text-[#191c1c]'
                }`}
              >
                平均寿命
              </button>
            </div>
          </div>

          {/* Interactive Recharts Bar Chart */}
          <div className="w-full h-56 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={periodData}
                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="barRedGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#e63946" />
                    <stop offset="50%" stopColor="#b22222" />
                    <stop offset="100%" stopColor="#8f000d" />
                  </linearGradient>
                  <linearGradient
                    id="barGoldGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#f3d060" />
                    <stop offset="50%" stopColor="#cca72f" />
                    <stop offset="100%" stopColor="#997a15" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2beba"
                  opacity={0.35}
                />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#5a403e', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#e2beba', strokeWidth: 1.5 }}
                  tickLine={false}
                  interval={0}
                  dy={4}
                />
                <YAxis
                  tick={{ fill: '#8e706d', fontSize: 10, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomBarTooltip barMetric={barMetric} />}
                  cursor={{ fill: 'rgba(204, 167, 47, 0.08)' }}
                />
                <Bar
                  dataKey="displayValue"
                  radius={[6, 6, 0, 0]}
                  animationDuration={800}
                >
                  {periodData.map((entry) => {
                    const isSplitEra =
                      entry.period === '南北朝' ||
                      entry.period === '五代' ||
                      entry.period === '宋';
                    return (
                      <Cell
                        key={entry.period}
                        fill={
                          isSplitEra
                            ? 'url(#barGoldGradient)'
                            : 'url(#barRedGradient)'
                        }
                      />
                    );
                  })}
                  <LabelList
                    dataKey="displayValue"
                    position="top"
                    fill="#8f000d"
                    fontSize={11}
                    fontWeight={800}
                    formatter={(val: number) =>
                      barMetric === 'count' ? `${val}名` : `${val}年`
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* [B] Cause of Death */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-4 bento-card rounded-xl p-4 md:p-5 flex flex-col justify-between"
        >
          <div className="w-full">
            <h2 className="font-serif-title text-base sm:text-lg font-bold w-full text-[#191c1c]">
              死因
            </h2>
            <p className="text-xs text-[#5a403e]">
              正史{totalEmperorsCount}名の崩御分類実数から計算
            </p>
          </div>

          {/* Recharts Pie/Donut Visual */}
          <div className="relative w-full h-48 min-h-[190px] flex items-center justify-center my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={causeOfDeathData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                  onMouseEnter={(_, index) => setHoveredPieIndex(index)}
                  onMouseLeave={() => setHoveredPieIndex(null)}
                >
                  {causeOfDeathData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer hover:opacity-90"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Overlay Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span
                className="text-lg sm:text-xl font-bold leading-none font-serif-title transition-colors duration-200"
                style={{ color: activePieItem.color }}
              >
                {activePieItem.value}%
              </span>
              <span className="text-[10px] text-[#5a403e] font-bold mt-1 truncate max-w-[85px]">
                {activePieItem.shortName}
              </span>
              <span className="text-[9px] text-[#8e706d] font-semibold mt-0.5">
                （{activePieItem.count}名）
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-xs font-semibold text-[#191c1c] pt-1">
            {causeOfDeathData.map((item, idx) => (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredPieIndex(idx)}
                onMouseLeave={() => setHoveredPieIndex(null)}
                className={`flex items-center justify-between gap-1 p-1 rounded-md transition-colors cursor-pointer ${
                  hoveredPieIndex === idx
                    ? 'bg-[#8f000d]/10 font-bold'
                    : 'hover:bg-[#f3f4f3]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-[11px] text-[#191c1c]">
                    {item.shortName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#5a403e] shrink-0 font-semibold ml-1">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* [D] Succession Path */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          className="col-span-1 md:col-span-3 lg:col-span-4 bento-card rounded-xl p-4 md:p-5 flex flex-col justify-between"
        >
          <div className="w-full">
            <h2 className="font-serif-title text-base sm:text-lg font-bold w-full text-[#191c1c]">
              即位経路
            </h2>
            <p className="text-xs text-[#5a403e]">
              全皇帝の即位区分実測比率
            </p>
          </div>

          {/* Recharts Pie/Donut Visual */}
          <div className="relative w-full h-48 min-h-[190px] flex items-center justify-center my-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={successionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={800}
                  onMouseEnter={(_, index) => setHoveredSuccessionIndex(index)}
                  onMouseLeave={() => setHoveredSuccessionIndex(null)}
                >
                  {successionData.map((entry, index) => (
                    <Cell
                      key={`cell-succession-${index}`}
                      fill={entry.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer hover:opacity-90"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Donut Center Overlay Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span
                className="text-lg sm:text-xl font-bold leading-none font-serif-title transition-colors duration-200"
                style={{ color: activeSuccessionItem.color }}
              >
                {activeSuccessionItem.pct}%
              </span>
              <span className="text-[10px] text-[#5a403e] font-bold mt-1 truncate max-w-[85px]">
                {activeSuccessionItem.shortName}
              </span>
              <span className="text-[9px] text-[#8e706d] font-semibold mt-0.5">
                （{activeSuccessionItem.count}名）
              </span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-xs font-semibold text-[#191c1c] pt-1">
            {successionData.map((item, idx) => (
              <div
                key={item.key}
                onMouseEnter={() => setHoveredSuccessionIndex(idx)}
                onMouseLeave={() => setHoveredSuccessionIndex(null)}
                className={`flex items-center justify-between gap-1 p-1 rounded-md transition-colors cursor-pointer ${
                  hoveredSuccessionIndex === idx
                    ? 'bg-[#8f000d]/10 font-bold'
                    : 'hover:bg-[#f3f4f3]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-[11px] text-[#191c1c]">
                    {item.shortName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#5a403e] shrink-0 font-semibold ml-1">
                  {item.pct}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
