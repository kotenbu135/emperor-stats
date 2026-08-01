import json, re, sxtwl
from collections import Counter, defaultdict

KAN = {'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
LUNAR_RX = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
d = json.load(open('data/emperors.json'))
COUNT_KEYS = ['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
              'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']

def event_dates(ev):
    for k in ('date','startDate','endDate'):
        if ev.get(k): yield k, ev[k]
def prec(ev,key):
    p=ev.get('datePrecision')
    return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))

_c={}
def majority(ly,lm):
    if (ly,lm) in _c: return _c[(ly,lm)]
    cnt=Counter()
    for dd in range(1,31):
        try: day=sxtwl.fromLunar(ly,lm,dd)
        except Exception: break
        if day.getLunarMonth()!=lm or day.isLunarLeap(): break
        cnt[(day.getSolarYear(),day.getSolarMonth())]+=1
    r=cnt.most_common(1)[0][0] if cnt else None
    _c[(ly,lm)]=r; return r

pc=Counter(); byprec_lunar=defaultdict(Counter)
day_check=Counter(); day_examples=[]
month_conv=Counter()
for e in d['emperors']:
    for ck in COUNT_KEYS:
        blk=e.get(ck)
        if not isinstance(blk,dict): continue
        for i,ev in enumerate(blk.get('events') or []):
            t=texts(ev); lunars={KAN[m.group(1)] for m in LUNAR_RX.finditer(t)}
            for key,iso in event_dates(ev):
                m=re.match(r'^(-?\d{4})-(\d{2})-(\d{2})$',iso)
                if not m: continue
                p=prec(ev,key); pc[p]+=1
                y,mo,dy=int(m.group(1)),int(m.group(2)),int(m.group(3))
                has = 'lunar_in_text' if lunars else 'no_lunar_in_text'
                byprec_lunar[p][has]+=1
                if not lunars or y<1: continue
                if p=='day':
                    # day精度: ISO日付を旧暦へ逆変換して、note記載の旧暦月と一致するか
                    try:
                        dd=sxtwl.fromSolar(y,mo,dy)
                        lm=dd.getLunarMonth()
                    except Exception:
                        continue
                    day_check['lunar_match' if lm in lunars else 'lunar_mismatch']+=1
                    if lm in lunars and mo in lunars and mo!=lm:
                        day_check['both']+=1
                    if lm not in lunars and len(day_examples)<10:
                        day_examples.append((e['id'],f'{ck}.events[{i}].{key}',iso,lm,sorted(lunars),t[:60]))
                elif p=='month':
                    if mo not in lunars:
                        month_conv['iso_month != lunar_month (換算済み扱い)']+=1
                        # 換算済みなら、多数月方式の結果と一致するか検証
                        cand=[majority(y,lm) for lm in lunars]
                        # 前年紀年の可能性も
                        ok=any(c and (c[0],c[1])==(y,mo) for c in cand)
                        cand2=[majority(y-1,lm) for lm in lunars]
                        ok2=any(c and (c[0],c[1])==(y,mo) for c in cand2)
                        month_conv['  うち多数月方式と一致' if ok else ('  うち前年紀年の多数月と一致' if ok2 else '  うちどちらとも不一致')]+=1
                    else:
                        month_conv['iso_month == lunar_month (未換算)']+=1

print('=== event 日付の precision 分布（ISO実値があるもの）===')
for k,v in pc.most_common(): print(f'  {k}: {v}')
print()
print('=== precision 別 note に旧暦月表記があるか ===')
for p,c in byprec_lunar.items():
    print(f'  {p}: '+', '.join(f'{k}={v}' for k,v in c.most_common()))
print()
print('=== day 精度: ISO日付を旧暦へ逆変換した月が note の旧暦月と一致するか ===')
for k,v in day_check.most_common(): print(f'  {k}: {v}')
for ex in day_examples: print('   ex:',ex)
print()
print('=== month 精度の内訳 ===')
for k,v in month_conv.most_common(): print(f'  {k}: {v}')
