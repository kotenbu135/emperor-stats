import json, subprocess, sys
G = str(__import__("pathlib").Path(__file__).with_name("guard.py"))
def run(payload, env=None):
    import os
    e = dict(os.environ); e["CLAUDE_PROJECT_DIR"] = "/tmp/emperor-stats-guardtest"
    if env: e.update(env)
    raw = payload if isinstance(payload, str) else json.dumps(payload)
    p = subprocess.run([sys.executable, G], input=raw, capture_output=True, text=True, env=e)
    return p.returncode, p.stderr.strip()[:70]
def bash(cmd, sub=False):
    d = {"tool_name":"Bash","tool_input":{"command":cmd},"cwd":"."}
    if sub: d["agent_id"]="a1"; d["agent_type"]="corpus-researcher"
    return d
def dict(d, **kw):  # noqa: A001 — ケース表で agent_type を差し替えるだけの薄い糖衣
    d.update(kw); return d
cases = [
 ("deny  コーパス抽出grep",      bash("grep -o '.{0,40}崩御.{0,40}' daizhigev20/史藏/正史/晋书.txt"), 2),
 ("pass  /usr/bin/grep",        bash("/usr/bin/grep -o '.{0,40}崩御.{0,40}' daizhigev20/史藏/正史/晋书.txt"), 0),
 ("pass  rg",                   bash("rg -n '崩于' daizhigev20/史藏/正史/晋书.txt"), 0),
 ("pass  素のgrepだが抽出なし",  bash("grep -n '崩于' daizhigev20/史藏/正史/晋书.txt"), 0),
 ("deny  サブエージェントでも",  bash("grep -o '.{0,40}崩御.{0,40}' _corpus_cache/x.txt", sub=True), 2),
 ("esc   逃げ道つき",           bash("EMPSTATS_ALLOW=R-CORPUS-GREP:小ファイル grep -o '.{0,9}x.{0,9}' _corpus_cache/a.txt"), 0),
 ("deny  git add -A",           bash("git add -A"), 2),
 ("deny  git add .",            bash("git add ."), 2),
 ("pass  git add パス指定",      bash("git add data/emperors.json docs/x.md"), 0),
 ("deny  裸のgit stash",        bash("git stash"), 2),
 ("deny  git stash pop",        bash("git stash pop"), 2),
 ("pass  git stash push -m",    bash("git stash push -u -m 'tag'"), 0),
 ("pass  git stash apply sha",  bash("git stash apply 0a1b2c3"), 0),
 ("pass  git stash list",       bash("git stash list"), 0),
 ("deny  main が全体Read",      {"tool_name":"Read","tool_input":{"file_path":"/x/data/emperors.json"},"cwd":"."}, 2),
 ("pass  offset付きRead",       {"tool_name":"Read","tool_input":{"file_path":"/x/data/emperors.json","offset":1,"limit":50},"cwd":"."}, 0),
 ("pass  サブエージェントのRead",{"tool_name":"Read","tool_input":{"file_path":"/x/data/emperors.json"},"agent_id":"a1","agent_type":"x","cwd":"."}, 0),
 ("deny  Grepツールの抽出",      {"tool_name":"Grep","tool_input":{"pattern":".{0,40}崩御.{0,40}","path":"daizhigev20"},"cwd":"."}, 2),
 ("pass  Grep通常",             {"tool_name":"Grep","tool_input":{"pattern":"崩于","path":"daizhigev20"},"cwd":"."}, 0),
 ("pass  無関係コマンド",        bash("python3 scripts/validate_emperors.py"), 0),
 ("deny  コーパスcd＋git add -A",  bash("cd daizhigev20 && git add -A"), 2),
 ("deny  grepパイプ＋stash pop",   bash("rg -n '崩于' daizhigev20/a.txt | grep -c 史; git stash pop"), 2),
 ("pass  rg|grep の連結",          bash("rg -n '崩于' daizhigev20/史藏/正史/晋书.txt | grep -c 帝"), 0),
 ("deny  1段目が --notes on",     dict(bash("python3 scripts/extract_profile_material.py x --notes on", sub=True)), 2),
 ("deny  執筆段が --notes=on",     dict(bash("python3 scripts/extract_profile_material.py x --notes=on", sub=True), agent_type="profile-writer"), 2),
 ("pass  検証段は --notes on 可",  dict(bash("python3 scripts/extract_profile_material.py x --notes on", sub=True), agent_type="adversarial-verifier"), 0),
 ("pass  メイン会話は --notes on 可", bash("python3 scripts/extract_profile_material.py x --notes on"), 0),
 ("pass  既定(off)の素材抽出",      bash("python3 scripts/extract_profile_material.py x", sub=True), 0),
 ("pass  壊れた入力",              "NOT-JSON", 0),
 ("pass  tool_input が null",     {"tool_name":"Bash","tool_input":None,"cwd":"."}, 0),
]
bad=0
for name, payload, want in cases:
    rc, err = run(payload)
    ok = (rc==want)
    bad += 0 if ok else 1
    print(f"{'OK ' if ok else 'NG '} {name:28s} rc={rc} want={want} {err if rc==2 else ''}")
print(f"\n{'全件一致' if not bad else str(bad)+'件 不一致'} / {len(cases)}件")
