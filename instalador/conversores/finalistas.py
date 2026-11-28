"""
Lê as relações de discentes e finalistas (Word .docx de docs/DOCENTES E DISCENTES) para o conversor das listas.
Uso: python finalistas.py <cursos.json> <ficheiros .docx…>
"""
import sys, re, json, docx
from docx.table import Table
from docx.text.paragraph import Paragraph
ORD = re.compile(r'^\d{1,3}$')
NIP = re.compile(r'^I?\d{4,10}$', re.I)
DATA = re.compile(r'Luanda', re.I)
MESES = {m:i+1 for i,m in enumerate(['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])}
LETRA = {'FORÇAS ARMADAS ANGOLANAS','ESCOLA SUPERIOR DE GUERRA','MINISTÉRIO DA DEFESA NACIONAL'}
def linhas(f):
    d = docx.Document(f)
    out = []
    for el in d.element.body.iterchildren():
        t = el.tag.split('}')[1]
        if t == 'p':
            x = Paragraph(el, d).text.strip()
            if x: out.append(x)
        elif t == 'tbl':
            for r in Table(el, d).rows:
                cs = []
                for c in r.cells:
                    x = c.text.strip()
                    if x and (not cs or cs[-1] != x): cs.append(x)
                out.extend(cs)
    return out
# erros de edição nas listas, conferidos com os planos de curso (decisão da Repartição de Administração Escolar):
# a lista dos discentes de 2026/2027 diz «18º» no COAMP, mas o plano e a agenda são do 12.º COAMP
CORRECOES = {('2026.2027', '18º CURSO DE ORGANIZAÇÃO DO ASSEGURAMENTO'): '12º CURSO DE ORGANIZAÇÃO DO ASSEGURAMENTO'}
cursos = []
for f in sys.argv[2:]:
    L = linhas(f); i = 0; cur = None; unidade = ''; reg = None; cab = None
    def fecha():
        global reg
        if reg and cur is not None: cur['alunos'].append(reg)
        reg = None
    for x in L:
        up = x.upper()
        if up.startswith('RELAÇÃO NOMINAL DOS FINALISTAS') or (up.endswith('CURSO DE ESTRATÉGIA E ARTE OPERATIVA') and 'DISCENTES' in f.upper()) or re.match(r'^\d+º (TURNO|CURSO)', up) and 'DISCENTES' in f.upper():
            x = next((n for (fic, t), n in CORRECOES.items() if fic in f and up.startswith(t)), x)
            fecha(); cur = {'ficheiro': f.split('/')[-1], 'titulo': x, 'alunos': [], 'data': None}; cursos.append(cur); cab = True; unidade = ''; continue
        if cab and not re.search(r'20\d\d', cur['titulo']) and not ORD.match(x) and cur['ficheiro'].upper().find('DISCENTES')<0: cur['titulo'] += ' ' + x; continue
        if cur is None: continue
        if DATA.search(x):
            fecha(); m = re.search(r'(\d{1,2}) de (\w+) de (\d{4})', x, re.I)
            if m: cur['data'] = f"{m.group(3)}-{MESES[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
            else: cur['data'] = re.search(r'(\w+) de (\d{4})', x).group(0)
            cur = None; continue
        if ORD.match(x):
            fecha(); reg = {'unidadeOrigem': unidade, 'campos': []}; cab = False; continue
        if reg is not None and len(reg['campos']) < 3 and not (x.isupper() and len(reg['campos']) >= 2 and not NIP.match(x)):
            reg['campos'].append(x); continue
        fecha()
        if cab and not re.search(r'20\d\d', cur['titulo']): cur['titulo'] += ' ' + x
        else: unidade = x
    fecha()
json.dump(cursos, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
for c in cursos: print(len(c['alunos']), c['data'], '|', c['titulo'][:110])
