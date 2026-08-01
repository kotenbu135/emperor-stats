"""day精度ミスマッチ59件のうち、note の「旧暦月＋干支」が sxtwl 上一意に解けて
現 ISO と違う日になるものを訂正候補として抽出する。"""
import json,re,sxtwl
KAN={'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
TG='甲乙丙丁戊己庚辛壬癸'; DZ='子丑寅卯辰巳午未申酉戌亥'
# 「〜月〜干支」の隣接パターンだけを拾う（月の直後〜10文字以内の最初の干支）
PAIR=re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月[^。、，,]{0,6}?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])')
d=json.load(open('data/emperors.json'))
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
def prec(ev,key):
    p=ev.get('datePrecision'); return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))
def solve(ly,lm,gz):
    out=[]
    for dd in range(1,31):
        try: day=sxtwl.fromLunar(ly,lm,dd)
        except Exception: break
        if day.getLunarMonth()!=lm or day.isLunarLeap(): break
        g=day.getDayGZ()
        if TG[g.tg]+DZ[g.dz]==gz:
            out.append(f'{day.getSolarYear():04d}-{day.getSolarMonth():02d}-{day.getSolarDay():02d}')
    return out
cand=[];未解決=0
for e in d['emperors']:
    for ck in COUNT_KEYS:
        blk=e.get(ck)
        if not isinstance(blk,dict): continue
        for i,ev in enumerate(blk.get('events') or []):
            t=texts(ev); pairs=set(PAIR.findall(t))
            if len(pairs)!=1: continue
            lmk,gz=list(pairs)[0]; lm=KAN[lmk]
            for key in ('date','startDate','endDate'):
                iso=ev.get(key)
                if not iso or prec(ev,key)!='day': continue
                m=re.match(r'^(\d{4})-(\d{2})-(\d{2})$',iso)
                if not m: continue
                y,mo,dy=map(int,m.groups())
                try: cur=sxtwl.fromSolar(y,mo,dy)
                except Exception: continue
                if cur.getLunarMonth()==lm: continue   # 現ISOが note の旧暦月に乗っている＝OK
                sols=[]
                for ly in (y-1,y,y+1):
                    sols+= [(ly,s) for s in solve(ly,lm,gz)]
                exact=[s for _,s in sols if s]
                if len(set(exact))==1:
                    cand.append((e['id'],f'{ck}.events[{i}].{key}',iso,exact[0],lmk+'月'+gz,t[:50]))
                else:
                    未解決+=1
print(f'day精度: note が「旧暦月＋干支」一意で、sxtwl 換算が現 ISO と食い違うもの: {len(cand)} 件（解が0/複数で判定保留: {未解決} 件）')
for c in cand: print(f'  {c[0]} / {c[1]}  現={c[2]} → sxtwl={c[3]}  （note: {c[4]}）| {c[5]}')
