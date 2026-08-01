"""day精度70件のミスマッチをノイズ除去（noteの旧暦月が単一のものだけ）して列挙。"""
import json,re,sxtwl
KAN={'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
LUNAR_RX=re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
GZ_RX=re.compile(r'[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]')
d=json.load(open('data/emperors.json'))
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
def prec(ev,key):
    p=ev.get('datePrecision'); return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))
TG='甲乙丙丁戊己庚辛壬癸'; DZ='子丑寅卯辰巳午未申酉戌亥'
single=[]; multi=0
for e in d['emperors']:
    for ck in COUNT_KEYS:
        blk=e.get(ck)
        if not isinstance(blk,dict): continue
        for i,ev in enumerate(blk.get('events') or []):
            t=texts(ev); lun={KAN[m.group(1)] for m in LUNAR_RX.finditer(t)}
            if not lun: continue
            for key in ('date','startDate','endDate'):
                iso=ev.get(key)
                if not iso or prec(ev,key)!='day': continue
                m=re.match(r'^(\d{4})-(\d{2})-(\d{2})$',iso)
                if not m: continue
                y,mo,dy=map(int,m.groups())
                try: day=sxtwl.fromSolar(y,mo,dy)
                except Exception: continue
                lm=day.getLunarMonth()
                if lm in lun: continue
                if len(lun)>1: multi+=1; continue
                gz=day.getDayGZ(); gzs=TG[gz.tg]+DZ[gz.dz]
                notegz=set(GZ_RX.findall(t))
                single.append((e['id'],f'{ck}.events[{i}].{key}',iso,lm,sorted(lun)[0],gzs,gzs in notegz,t[:60]))
print(f'day精度ミスマッチのうち note の旧暦月が単一のもの: {len(single)} 件（複数月ノイズ: {multi} 件）')
print(f'  うち ISO日の干支が note の干支と一致: {sum(1 for s in single if s[6])} 件 / 不一致: {sum(1 for s in single if not s[6])} 件')
for s in single: print(f'  {s[0]} / {s[1]}  ISO={s[2]}(旧暦{s[3]}月・干支{s[5]}{"○" if s[6] else "×"}) note旧暦{s[4]}月 | {s[7]}')
