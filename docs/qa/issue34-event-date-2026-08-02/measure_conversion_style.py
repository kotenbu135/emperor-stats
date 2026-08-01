import json, re, sxtwl
from collections import Counter, defaultdict
KAN = {'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
LUNAR_RX = re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
d=json.load(open('data/emperors.json'))
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
def event_dates(ev):
    for k in ('date','startDate','endDate'):
        if ev.get(k): yield k,ev[k]
def prec(ev,key):
    p=ev.get('datePrecision'); return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))
_mj={}; _sh={}
def majority(ly,lm):
    if (ly,lm) in _mj: return _mj[(ly,lm)]
    c=Counter()
    for dd in range(1,31):
        try: day=sxtwl.fromLunar(ly,lm,dd)
        except Exception: break
        if day.getLunarMonth()!=lm or day.isLunarLeap(): break
        c[(day.getSolarYear(),day.getSolarMonth())]+=1
    r=c.most_common(1)[0][0] if c else None; _mj[(ly,lm)]=r; return r
def shuo(ly,lm):
    if (ly,lm) in _sh: return _sh[(ly,lm)]
    try:
        day=sxtwl.fromLunar(ly,lm,1); r=(day.getSolarYear(),day.getSolarMonth())
    except Exception: r=None
    _sh[(ly,lm)]=r; return r

cls=Counter(); other=[]
era_by_section=defaultdict(Counter)
for e in d['emperors']:
    for ck in COUNT_KEYS:
        blk=e.get(ck)
        if not isinstance(blk,dict): continue
        for i,ev in enumerate(blk.get('events') or []):
            t=texts(ev); lunars={KAN[m.group(1)] for m in LUNAR_RX.finditer(t)}
            if not lunars: continue
            for key,iso in event_dates(ev):
                m=re.match(r'^(\d{4})-(\d{2})-(\d{2})$',iso)
                if not m: continue
                if prec(ev,key)!='month': continue
                y,mo=int(m.group(1)),int(m.group(2))
                if mo in lunars: continue   # 未換算
                hit=None
                for lm in lunars:
                    for ly,tag in ((y,'同年紀年'),(y-1,'前年紀年')):
                        if majority(ly,lm)==(y,mo): hit=f'多数月方式({tag})'; break
                        if shuo(ly,lm)==(y,mo): hit=f'朔方式({tag})'; break
                    if hit: break
                cls[hit or 'どちらとも不一致']+=1
                if not hit and len(other)<12:
                    other.append((e['id'],f'{ck}.events[{i}].{key}',iso,sorted(lunars),t[:70]))
print('=== month精度・換算済み扱い238件の内訳 ===')
for k,v in cls.most_common(): print(f'  {k}: {v}')
print()
for o in other: print('  不一致例:',o)
