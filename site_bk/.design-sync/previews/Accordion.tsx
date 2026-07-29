import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "site";

/** /about の「数え方」節。開いた状態を既定にして中身まで見せる。 */
export function Methodology() {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="reign"
      className="max-w-xl"
    >
      <AccordionItem value="reign">
        <AccordionTrigger>在位年数の数え方</AccordionTrigger>
        <AccordionContent>
          即位日から退位日（または崩御日）までを実日数で数え、年数は日数から換算します。
          復位した皇帝は各在位期間を合算します。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="age">
        <AccordionTrigger>年齢の数え方</AccordionTrigger>
        <AccordionContent>
          即位時年齢・没年齢はいずれも数え年で統一しています。生年が不詳の人物は
          「調査済みだが不明」として集計から外します。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="source">
        <AccordionTrigger>出典の扱い</AccordionTrigger>
        <AccordionContent>
          判定はすべて正史の本紀・列伝を第一情報源とし、原文引用を添えています。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** ナビゲーションメニュー（type="multiple"・複数節を同時に開ける）。 */
export function MultipleOpen() {
  return (
    <Accordion
      type="multiple"
      defaultValue={["reign", "court"]}
      className="max-w-xs gap-1"
    >
      <AccordionItem value="reign" className="border-none">
        <AccordionTrigger className="font-heading text-sm font-semibold">
          在位・年齢
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          在位期間 / 即位時年齢 / 没年齢
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="court" className="border-none">
        <AccordionTrigger className="font-heading text-sm font-semibold">
          宮廷イベント
        </AccordionTrigger>
        <AccordionContent className="text-sm text-muted-foreground">
          改元 / 大赦 / 立后 / 皇太子廃立 / 遷都
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
