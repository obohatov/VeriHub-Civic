import csv, sys
from collections import defaultdict
CLASSES=["CORRECT","INCORRECT","NOT_STATED"]
def load_human(p):
    o={}
    for r in csv.DictReader(open(p,newline='',encoding='utf-8-sig')):
        v=(r.get('human_verdict') or '').strip().upper()
        if v=='':continue
        if v not in CLASSES:continue
        o[r['answer_id']]={'v':v,'notes':(r.get('notes') or '').strip(),'q':(r.get('question_text') or '')[:55]}
    return o
def load_judge(p):
    return {r['answer_id']:(r.get('_judge_correctness') or '').strip().upper() for r in csv.DictReader(open(p,newline='',encoding='utf-8-sig'))}
def kappa(pairs):
    n=len(pairs);po=sum(1 for h,j in pairs if h==j)/n
    hm=defaultdict(int);jm=defaultdict(int)
    for h,j in pairs:hm[h]+=1;jm[j]+=1
    pe=sum((hm[c]/n)*(jm[c]/n) for c in CLASSES)
    return po,(1.0 if pe>=1 else (po-pe)/(1-pe)),pe
def lab(k):
    return "(worse than chance)" if k<0 else "(slight)" if k<.2 else "(fair)" if k<.4 else "(moderate)" if k<.6 else "(substantial)" if k<.8 else "(almost perfect)"
H=load_human(sys.argv[1]);J=load_judge(sys.argv[2])
pairs=[];sk=0;miss=0
for aid,h in H.items():
    j=J.get(aid)
    if j is None:miss+=1;continue
    if j not in CLASSES:sk+=1;continue
    pairs.append((h['v'],j,aid,h))
hj=[(p[0],p[1]) for p in pairs];n=len(hj)
print("="*64);print("JUDGE CALIBRATION - human x judge (recall + kappa)");print("="*64)
print(f"labeled:{len(H)}  comparable pairs:{n}  judge SKIPPED/other:{sk}  no key:{miss}");print()
cm=defaultdict(lambda:defaultdict(int))
for h,j in hj:cm[h][j]+=1
w=12
print("Confusion matrix (rows=HUMAN, cols=JUDGE):")
print(" "*w+"".join(c.rjust(w) for c in CLASSES)+"   total")
for h in CLASSES:
    t=sum(cm[h][c] for c in CLASSES)
    print(f"{h:<{w}}"+"".join(str(cm[h][c]).rjust(w) for c in CLASSES)+f"   {t}")
print(f"{'total':<{w}}"+"".join(str(sum(cm[x][c] for x in CLASSES)).rjust(w) for c in CLASSES));print()
po,k,pe=kappa(hj)
print(f"Raw agreement:     {po:5.1%}  ({sum(1 for h,j in hj if h==j)}/{n})")
print(f"Expected (chance): {pe:5.1%}")
print(f"Cohen's kappa:     {k:.3f}  {lab(k)}");print()
print("Per-class (judge as classifier):")
print(f"  {'class':<12}{'precision':>11}{'recall':>10}{'FN':>6}")
for c in CLASSES:
    tp=cm[c][c];fpv=sum(cm[h][c] for h in CLASSES if h!=c);fn=sum(cm[c][j] for j in CLASSES if j!=c)
    pr=f"{tp/(tp+fpv):6.1%}" if tp+fpv else "   n/a"
    rc=f"{tp/(tp+fn):6.1%}" if tp+fn else "   n/a"
    print(f"  {c:<12}{pr:>11}{rc:>10}{fn:>6}")
print();print("-"*64)
fp=[p for p in pairs if p[1]=="CORRECT" and p[0]!="CORRECT"]
if fp:
    print(f"FALSE NEGATIVES ({len(fp)}) - judge said CORRECT, human disagreed:")
    for h,j,aid,hr in fp:
        print(f"  [{aid[:8]}] human={h}: {hr['q']}")
    print();print("These are the misses precision could never show. The recall signal.")
else:
    print("No false negatives: every answer the judge passed as CORRECT, the")
    print("human also called CORRECT. Recall clean on this sample.")
