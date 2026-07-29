# DESIGN.md — 帝 中国皇帝統計 Design & Architecture Specification

## 1. プロジェクト概要 (Project Overview)

### 1.1 アプリケーション名 & アイデンティティ
- **正式名称**: 帝 中国皇帝統計 (Imperial Chinese Emperor Statistics & Data Science Dashboard)
- **コンセプト**: 秦の始皇帝（紀元前221年）から清の宣統帝溥儀（1912年）に至る2000年以上の歴史に登場する**365名以上の中国歴代皇帝**（正統王朝・並立政権・割拠政権含む）の膨大な歴史データを、多角的に可視化・分析する統合データサイエンス＆デザイン・ダッシュボード。

---

## 2. デザインシステム (Design System & Visual Identity)

### 2.1 カラーパレット (Color Palette)
伝統的な中国宮廷の重厚さと、現代的なデータグラフィックスの透明感・洗練度を両立させた「和紙・宮廷赤・帝王金」の配色を採用。

| 役割 | カラーコード | Tailwind / 用途 |
|---|---|---|
| **プライマリ（帝国赤）** | `#8f000d` | ロゴ、アクセント、アクティブ状態、重要ボタン |
| **セカンダリ（帝王金）** | `#cca72f` | ボーダーハイライト、王冠アイコン、特別バッジ |
| **ベース背景（和紙色）** | `#f9f9f8` | 全体背景、カード背面 |
| **テキスト（墨色）** | `#191c1c` | 主見出し、本文プライマリ |
| **サブテキスト（栗皮・渋木炭）**| `#5a403e` | キャプション、補足説明、メタデータ |
| **カード背景 (Bento Card)** | `rgba(255,255,255,0.95)` | 半透明ガラスモフィズム + 金糸グラデーション |

### 2.2 王朝別カラーコーディング (Dynasty Color System)
40以上の個別王朝・時代区分に対し、`src/utils/dynastyColors.ts` で一元管理された専用のカラー＆グラデーションシステムを提供。
- **秦**: 深紅 (`#8f000d`)
- **前漢・後漢**: 金茶・琥珀 (`#b8860b` / `#d97706`)
- **唐**: 黄金 (`#eab308`)
- **宋（北宋・南宋）**: 翡翠緑 (`#16a34a` / `#15803d`)
- **明**: 朱赤 (`#ef4444`)
- **清**: 琉璃青 (`#0284c7`)

### 2.3 タイポグラフィ (Typography)
- **タイトル・見出し**: `'Noto Serif JP', 'Noto Serif SC', serif`
  - 東洋の古典美と威厳を誇る明朝体フォント。
- **UI・本文・データ数値**: `'Noto Sans JP', 'Noto Sans SC', sans-serif`
  - データ可視化と高密度なリスト閲覧に適した現代的ゴシック体。

### 2.4 マテリアル＆エフェクト (UI Effects & Components)
1. **Bento Card**:
   - `backdrop-blur-md` によるガラスモフィズム
   - 1px の微妙な金糸グラデーション枠線 (`linear-gradient`)
   - ホバー時の緩やかな浮き上がり（`translateY(-2px)`）と影の変化
2. **Particle Background**:
   - キャンバス上に漂う和紙・金箔風の微粒子パーティクルアニメーション

---

## 3. アプリケーション構成 & ビュー設計 (Architecture & View Specifications)

主要ビューは10個の独立したタスク指向モジュールとして構成されています。

```
src/
├── App.tsx                     # ルートコンポーネント・タブ切替・モーダル制御
├── components/
│   ├── Sidebar.tsx             # デスクトップ向けナビゲーション & 即時検索
│   ├── EmperorModal.tsx        # 皇帝詳細ポップアップ（肖像・実績・名言）
│   ├── ParticleBackground.tsx  # 背景パーティクルキャンバス
│   └── views/
│       ├── DashboardView.tsx   # 総合KPI & 王朝比較グラフ
│       ├── EmperorListView.tsx # 365名皇帝全集 & 高度フィルタ
│       ├── TimelineView.tsx    # 2000年タイムライン年表
│       ├── GenealogyTreeView.tsx# 全王朝系統図（パン/ズーム対応ツリー）
│       ├── DeathCausesView.tsx # 死因分析 (病死/暗殺/戦死/自尽など)
│       ├── MilitaryView.tsx    # 皇帝自征・軍事遠征分析
│       ├── AgeView.tsx         # 即位年齢 vs 寿命 散布図＆統計
│       ├── PalaceEventsView.tsx# 宮廷政変・受禅・変法データベース
│       ├── GenealogyView.tsx   # 王朝別系譜テキストリスト
│       └── AboutView.tsx       # サイト趣旨・出典データ説明
```

### 3.1 各ビューの詳細

1. **概要ダッシュボード (`DashboardView`)**
   - 皇帝総数（365名）、平均在位年数、平均寿命、最長在位（康熙帝 61.9年）等のサマリーKPI。
   - 王朝別の平均在位年数・平均寿命比較インタラクティブ棒グラフ。
   - 死因分類円グラフおよび歴代最長/最短在位皇帝ランキング。

2. **皇帝一覧 (`EmperorListView`)**
   - 365名の全皇帝カードグリッド。
   - フリーワード検索（名前・廟号・本名・王朝）、王朝フィルター、死因フィルター、即位タイプフィルター。

3. **タイムライン (`TimelineView`)**
   - 紀元前221年から1912年までの年代順インタラクティブタイムライン。
   - 各王朝の興亡と主要皇帝の即位時期を垂直タイムラインで視覚化。

4. **系譜・家系図ツリー (`GenealogyTreeView`)**
   - 12の主要時代（漢・三国・晋・唐・宋・明・清等）に分類された家系図ツリー。
   - インタラクティブなズーム＆パン機能、フルスクリーン表示モード。

5. **死因分析 (`DeathCausesView`)**
   - 「病死」「暗殺」「処刑」「戦死」「自尽」「事故死」などのカテゴリ別集計。
   - 暗殺・殺害された皇帝の事件背景・政変リスト。

6. **軍事行動 (`MilitaryView`)**
   - 皇帝自身が指揮を執った主要な自征・遠征（漢の武帝の匈奴討伐、唐の太宗の高句麗遠征、明の永楽帝の北征等）の記録。

7. **年齢統計 (`AgeView`)**
   - 即位年齢と死亡年齢（寿命）の関係を示す散布図（Scatter Plot）。
   - 幼少即位（10歳未満）と長寿皇帝（80歳以上）の相関分析。

8. **宮廷事件 (`PalaceEventsView`)**
   - 玄武門の変、靖難の変、戊戌政変など歴史を揺るがした宮廷事件の年表と関与した皇帝一覧。

9. **詳細モーダル (`EmperorModal`)**
   - 任意の皇帝を選択した際に表示されるモーダルウィンドウ。
   - 肖像画（パブリックドメイン/CC0）、廟号、姓名、王朝、在位期間、即位年齢、寿命、死因の詳細、歴史的評価、名言、主要実績。

---

## 4. 技術スタック & 依存ライブラリ (Tech Stack)

| カテゴリ | ライブラリ / 技術 | 役割 |
|---|---|---|
| **コアフレームワーク** | React 19 + TypeScript + Vite | 高速SPA基盤 |
| **スタイリング** | Tailwind CSS v4 | ユーティリティファーストCSS |
| **アニメーション** | Motion (`motion/react`) | タブ遷移・カード表示アニメーション |
| **データ視覚化** | Recharts | 棒グラフ、円グラフ、散布図のレンダリング |
| **アイコン** | Lucide React + Material Symbols | 直感的なUIアイコン |
| **バックエンド/AI** | Express + `@google/genai` | API拡張・将来的なAI解析用 |

---

## 5. データモデル (Data Schema)

主要データインターフェース (`src/types.ts`):

```typescript
export interface Emperor {
  id: string;
  name: string;                   // 例: "康熙帝"
  templeName: string;             // 例: "清聖祖"
  givenName: string;              // 例: "愛新覚羅・玄燁"
  dynasty: string;                // 例: "清"
  dynastyKanji: string;           // 例: "清"
  dynastyCategory?: DynastyCategory; // '正統' | '並立' | '自称'
  eraGroup?: string;              // 時代グループ
  reignYears: number;             // 在位年数 (例: 61.9)
  reignPeriod: string;            // 在位期間 (例: "1661年–1722年")
  birthYear: number | string;
  deathYear: number | string;
  ageAtAscension: number;         // 即位年齢
  lifespan: number;               // 寿命
  causeOfDeathCategory: CauseOfDeathCategory; // '病死' | '暗殺' | '処刑' | '戦死' | '自尽' 等
  causeOfDeathDetail: string;     // 死因詳細
  successionType: SuccessionCategory; // '世襲・嫡子' | '擁立・政変' | '開国・創業' 等
  portraitUrl?: string;           // 肖像画URL
  summary: string;                // 概要説明
  keyAchievements: string[];      // 主要実績
  historicalAssessment: string;  // 歴史的評価
  famousQuote?: string;           // 名言・語録
}
```

---

## 6. レスポンシブ & ユーザー体験 (Responsive Design & Usability)

1. **デスクトップ (≥ 1024px)**:
   - 左側固定のサイドバーナビゲーション (幅 256px)。
   - リアルタイムインクリメンタル検索バーを常設。
   - 最大幅 1440px のセンタリングレイアウト。

2. **モバイル (＜ 1024px)**:
   - 上部コンパクトブランドヘッダー。
   - 下部固定ボトムナビゲーションバー（主要7アイコン）。
   - タップターゲットを最小44px確保し、片手操作性を向上。

3. **アクセシビリティ**:
   - 高コントラストテキスト（WCAG AA基準クリア）。
   - キーボードナビゲーションおよびスクリーンリーダー対応のセマンティックタグ。
