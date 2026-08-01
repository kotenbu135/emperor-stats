"""仮適用後に startDate/endDate も含めて在位ISO年範囲外へ出るものを数える（validate は date のみ検査）。"""
import json,re,pathlib,sys
# 使い方: patch_and_validate.py が emperors_A.json / emperors_AC.json を吐いたディレクトリを渡す
SCRATCH=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp')
COUNT_KEYS=['eraChangeCount','amnestyCount','empressInstallationCount','crownPrinceDepositionCount',
 'personalCampaignCount','rebellionSuppressionCount','rebellionSufferedCount','capitalRelocationCount']
def scan(path):
    d=json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
    out=[]
    for e in d['emperors']:
        years=[]
        for r in e.get('reigns') or []:
            for k in ('startDate','endDate'):
                v=r.get(k)
                if isinstance(v,str):
                    m=re.match(r'^(-?\d{4})',v)
                    if m: years.append(int(m.group(1)))
            for yk in ('startYear','endYear'):
                y=r.get(yk)
                if isinstance(y,int): years.append(y if y>0 else y+1)
        if not years: continue
        lo,hi=min(years)-1,max(years)+1
        for ck in COUNT_KEYS:
            blk=e.get(ck)
            if not isinstance(blk,dict): continue
            for i,ev in enumerate(blk.get('events') or []):
                for key in ('date','startDate','endDate'):
                    v=ev.get(key)
                    if not isinstance(v,str): continue
                    m=re.match(r'^(\d{4})-',v)
                    if not m: continue
                    y=int(m.group(1))
                    if not (lo<=y<=hi): out.append((e['id'],f'{ck}.events[{i}].{key}',v,lo+1,hi-1))
    return out
base=scan('data/emperors.json'); a=scan(SCRATCH/'emperors_A.json'); ac=scan(SCRATCH/'emperors_AC.json')
print('在位ISO年範囲外（±1年許容）: baseline',len(base),' A適用後',len(a),' AC適用後',len(ac))
bs={(x[0],x[1]) for x in base}
for tag,lst in (('A',a),('AC',ac)):
    new=[x for x in lst if (x[0],x[1]) not in bs]
    print(f'  {tag} で新たに範囲外になるもの: {len(new)}')
    for x in new[:15]: print('   ',x)
