import json,re,sxtwl
from collections import Counter,defaultdict
KAN={'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
LUNAR_RX=re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
d=json.load(open('data/emperors.json'))
sec={s['id']:s.get('label',s['id']) for s in (d['meta'].get('catalogs',{}).get('sections') or [])} if 'catalogs' in d.get('meta',{}) else {}
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
def prec(ev,key):
    p=ev.get('datePrecision'); return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))
_mj={}
def majority(ly,lm):
    if (ly,lm) in _mj: return _mj[(ly,lm)]
    c=Counter()
    for dd in range(1,31):
        try: day=sxtwl.fromLunar(ly,lm,dd)
        except Exception: break
        if day.getLunarMonth()!=lm or day.isLunarLeap(): break
        c[(day.getSolarYear(),day.getSolarMonth())]+=1
    r=c.most_common(1)[0][0] if c else None; _mj[(ly,lm)]=r; return r
keycnt=Counter(); grp=Counter(); persons=set(); evs=set(); era=Counter(); conflict=[]
for e in d['emperors']:
    other=[]
    for r in e.get('reigns') or []:
        for k in ('startDate','endDate'):
            if isinstance(r.get(k),str): other.append((f'reigns.{k}',r[k]))
    a=e.get('ages') or {}
    for k in ('birthDate','deathDate'):
        if isinstance(a.get(k),str): other.append((f'ages.{k}',a[k]))
    for ck in COUNT_KEYS:
        blk=e.get(ck)
        if not isinstance(blk,dict): continue
        for i,ev in enumerate(blk.get('events') or []):
            lun={KAN[m.group(1)] for m in LUNAR_RX.finditer(texts(ev))}
            if not lun: continue
            for key in ('date','startDate','endDate'):
                iso=ev.get(key)
                if not iso or prec(ev,key)!='month': continue
                m=re.match(r'^(\d{4})-(\d{2})-(\d{2})$',iso)
                if not m: continue
                y,mo=int(m.group(1)),int(m.group(2))
                if mo not in lun: continue
                mj=majority(y,mo)
                if not mj or mj[0]==y or mo not in (11,12): continue
                keycnt[key]+=1; grp[ck]+=1; persons.add(e['id']); evs.add((e['id'],ck,i))
                era[e.get('sectionId') or e.get('section') or '?']+=1
                tgt=f'{mj[0]:04d}-{mj[1]:02d}'
                for on,ov in other:
                    if ov.startswith(tgt): conflict.append((e['id'],f'{ck}.events[{i}].{key}',iso,tgt,on,ov))
print('A（年またぎ未反映）の内訳')
print('  フィールド数',sum(keycnt.values()),' イベント',len(evs),' 人数',len(persons))
print('  キー種別:',dict(keycnt))
print('  指標別:',dict(grp.most_common()))
print('  時代区分別:',dict(era.most_common()))
print(f'\n同一人物の reigns/ages に訂正後の年月と同じ日付が既にある（＝レコード内で二重表記）: {len(conflict)} 件')
for c in conflict: print('   ',c)
