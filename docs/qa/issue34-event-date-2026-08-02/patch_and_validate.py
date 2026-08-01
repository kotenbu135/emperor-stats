"""Issue #34 blast radius 試算: A(105)/A+C を多数月方式で仮適用し validate_emperors.py を走らせる。
data/emperors.json は書き換えない（一時ファイルへ出して DATA_PATH を差し替える）。"""
import json, re, sys, calendar, pathlib, importlib.util
from collections import Counter
import sxtwl

# 使い方: python3 docs/qa/issue34-event-date-2026-08-02/patch_and_validate.py <baseline|A|AC> [出力先ディレクトリ]
MODE = sys.argv[1]  # baseline | A | AC
SCRATCH = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp')
KAN={'正':1,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}
LUNAR_RX=re.compile(r'(?<![閏])(正|十二|十一|十|一|二|三|四|五|六|七|八|九)月')
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
data=json.loads(pathlib.Path('data/emperors.json').read_text(encoding='utf-8'))
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
def prec(ev,key):
    p=ev.get('datePrecision'); return p.get('start' if key=='startDate' else 'end') if isinstance(p,dict) else p
def texts(ev):
    return ' '.join(str(v) for k,v in ev.items() if isinstance(v,str) and k not in ('date','startDate','endDate','datePrecision'))

changed=[]
if MODE!='baseline':
    for e in data['emperors']:
        for ck in COUNT_KEYS:
            blk=e.get(ck)
            if not isinstance(blk,dict): continue
            for i,ev in enumerate(blk.get('events') or []):
                lun={KAN[m.group(1)] for m in LUNAR_RX.finditer(texts(ev))}
                if not lun: continue
                for key in ('date','startDate','endDate'):
                    iso=ev.get(key)
                    if not iso: continue
                    m=re.match(r'^(\d{4})-(\d{2})-(\d{2})$',iso)
                    if not m: continue
                    if prec(ev,key)!='month': continue
                    y,mo,dy=int(m.group(1)),int(m.group(2)),int(m.group(3))
                    if mo not in lun: continue
                    mj=majority(y,mo)
                    if not mj or mj==(y,mo): continue
                    sy,sm=mj
                    is_A = (sy!=y and mo in (11,12))
                    if MODE=='A' and not is_A: continue
                    # 日は月内位置（先頭/末尾）を保つ
                    last=calendar.monthrange(sy,sm)[1]
                    nd = last if dy>=25 else 1
                    new=f'{sy:04d}-{sm:02d}-{nd:02d}'
                    ev[key]=new
                    changed.append((e['id'],f'{ck}.events[{i}].{key}',iso,new,'A' if is_A else 'C'))

tmp=SCRATCH/f'emperors_{MODE}.json'
tmp.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
print(f'[{MODE}] 変更 {len(changed)} フィールド  A={sum(1 for c in changed if c[4]=="A")} C={sum(1 for c in changed if c[4]=="C")}', file=sys.stderr)

spec=importlib.util.spec_from_file_location('ve','scripts/validate_emperors.py')
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
mod.DATA_PATH=tmp
rc=mod.main()
print(f'[{MODE}] exit={rc}', file=sys.stderr)
