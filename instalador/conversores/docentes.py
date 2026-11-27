"""
O arranque do ano lectivo na Gestão Escolar, a partir das listas de docs/DOCENTES E DISCENTES:
  - os departamentos (folha «Nº 1» da relação do corpo docente nos departamentos: os docentes de cada um);
  - as cadeiras e os seus docentes (folhas «Nº2», «Nº3», «Nº 4» e a coluna «Cadeira que lecciona» da relação do
    corpo docente de 2026): o departamento de cada cadeira é o dos seus docentes efectivos (o mais frequente);
  - as turmas do ano lectivo (os discentes de 2026/2027 do academicos.json), com o modelo do plano de curso.
Uso: python docentes.py <pasta DOCENTES E DISCENTES> <academicos.json> <saida.json>
"""
import sys, re, json, collections, unicodedata, difflib
import openpyxl

PASTA, ACADEMICOS, SAIDA = sys.argv[1:4]
ANO = '2026/2027'


def sem(t):
    t = ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', t.lower()).strip()


PART = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no', 'nas', 'nos', 'para', 'ao', 'aos', 'as', 'os'}
# abreviaturas e enganos frequentes nos nomes das cadeiras
ABREV = {'adm': 'administracao', 'invest': 'investigacao', 'metod': 'metodologia', 'met': 'metodologia', 'com': 'comunicacao', 'rel': 'relacoes',
         'publ': 'publicas', 'int': 'internacional', 'inter': 'internacional', 'plan': 'planeamento', 'org': 'organizacao', 'logitica': 'logistica',
         'lg': 'logistica', 'ciencias': 'ciencias', 'cienciais': 'ciencias', 'economia': 'economia', 'tecnicas': 'tecnica', 'tecnologia': 'tecnologia',
         'conflitualidades': 'conflitualidade', 'materias': 'materiais', 'geopolitica': 'geopolitica', 'psicologia': 'psicologia', 'rh': 'recursos humanos', 'camp': 'campanha'}


def chave(nome):
    t = re.sub(r'[^a-z ]', ' ', sem(nome))
    w = [ABREV.get(x, x) for x in t.split() if x and x not in PART]
    return ' '.join(sorted(' '.join(w).split()))


def titulo(t):
    t = re.sub(r'\s+', ' ', str(t)).strip()
    if not t.isupper(): return t
    return ' '.join(w.lower() if w.lower() in PART else w[:1].upper() + w[1:].lower() for w in t.split(' '))


NIP_RE = re.compile(r'^I?\d{4,10}$', re.I)
nip_de = lambda v: re.sub(r'\s', '', str(v or '')).upper() if NIP_RE.match(re.sub(r'\s', '', str(v or ''))) else ''

# ---------- os departamentos e quem lá está (folha «Nº 1») ----------
f2 = openpyxl.load_workbook(f'{PASTA}/RELAÇÃO NOMINAL DO CORPO DOCENTE NOS DEPARTAMENTOS 23.09.2026.xlsx', data_only=True)
departamentos = collections.OrderedDict()
dep_de = {}  # nip ou nome → departamento
docentes = {}  # nip ou nome → {nip, nome, posto}


def pessoa(cel):
    """[nip?, posto, nome] de uma linha; os civis vêm sem NIP («Civil»)."""
    cel = [c for c in cel if c]
    if len(cel) < 2: return None
    nome = re.sub(r'\s*\((Ética|História Mil.*|Comunicação e Exp.*)\)\s*$', '', cel[-1]).strip()
    nip = nip_de(cel[0]) if len(cel) >= 3 else ''
    posto = cel[1] if len(cel) >= 3 else cel[0]
    k = nip or sem(nome)
    docentes.setdefault(k, {'nip': nip, 'nome': nome, 'posto': '' if sem(posto) == 'civil' else posto})
    return k


for ws in f2.worksheets:
    folha = ws.title.strip()
    grupo = ''
    secao = ''
    for row in ws.iter_rows(values_only=True):
        v = [str(c).strip() if c is not None else '' for c in row]
        if not any(v): continue
        if v[0] and not re.match(r'^\d{1,3}$', v[0]) and not any(v[1:]):
            u = v[0].upper()
            if re.search(r'^DOCENTES (COLABORADORES|CIVIS)', u): secao = 'colaborador' if 'COLABORADORES' in u else 'efectivo'
            if not re.search(r'RELAÇÃO|ESTADO MAIOR|ESCOLA SUPERIOR|REPARTIÇÃO DE PESSOAL|FORÇAS ARMADAS|CADEIRAS COM|^DOCENTES|^O CHEFE|^\*|LUANDA|^ESG,|MATAMBA|^"', u): grupo = v[0]
            continue
        if not (v[0] and re.match(r'^\d{1,3}$', v[0])) or not grupo: continue
        k = pessoa(v[1:])
        if not k: continue
        if folha == 'Nº 1':
            departamentos.setdefault(titulo(grupo), []).append(k)
            if grupo.upper().startswith('DEPARTAMENTO'): dep_de.setdefault(k, titulo(grupo))
        else:
            # folhas «Nº2», «Nº3», «Nº 4»: o grupo é a cadeira (as linhas de pesquisa são de orientadores)
            if re.match(r'^linha de pesquisa', sem(grupo)): continue
            docentes[k].setdefault('cadeiras', []).append((titulo(grupo), 'colaborador' if folha == 'Nº3' or secao == 'colaborador' else 'efectivo', f'relação dos departamentos (Dez. 2025, folha {folha})'))

# ---------- a relação do corpo docente de 2026 (a cadeira que cada um lecciona) ----------
f1 = openpyxl.load_workbook(f'{PASTA}/RELAÇÃO NOMINAL DO CORPO DOCENTE E COLABORADORES, MILITARES E CIVIS.xlsx', data_only=True)
tipo = 'efectivo'
for row in f1.worksheets[0].iter_rows(values_only=True):
    v = [str(c).strip() if c is not None else '' for c in row]
    if v and v[0] and not v[1] and not v[3]:
        u = v[0].upper()
        if 'COLABORADORES' in u or 'REFORMADOS' in u or 'ORIENTADORES' in u: tipo = 'colaborador'
        elif 'CORPO DOCENTE' in u or 'ORGÂNICOS' in u or 'NÃO COLOCADOS' in u: tipo = 'efectivo'
        continue
    if len(v) < 8 or not re.match(r'^\d{1,3}$', v[0]) or not v[3] or not v[7]: continue
    if re.match(r'^linha de pesquisa', sem(v[7])): continue  # orientadores e arguentes, não é uma cadeira
    k = pessoa([v[1], v[2] or 'Civil', v[3]])
    if k: docentes[k].setdefault('cadeiras', []).append((titulo(v[7]), tipo, 'relação do corpo docente (Out. 2026)'))

# ---------- as cadeiras: juntar as grafias da mesma cadeira ----------
grupos = []  # [{chave, nomes:Counter, docentes:{k: tipo}, fontes:set}]


def contida(a, b):
    """uma grafia dentro da outra (palavra a palavra, abreviaturas incluídas): «Resposta/Crise» ⊂ «Operações e Respostas a Crise»."""
    x, y = a.split(), b.split()
    if len(x) > len(y): x, y = y, x
    if len(x) < 2: return False
    perto = lambda p, q: p[:5] == q[:5] if len(p) >= 5 and len(q) >= 5 else (q.startswith(p) or p.startswith(q))
    return all(any(perto(p, q) for q in y) for p in x)

for k, d in docentes.items():
    for nome, tp, fonte in d.get('cadeiras', []):
        ch = chave(nome)
        g = next((x for x in grupos if x['chave'] == ch or difflib.SequenceMatcher(None, x['chave'], ch).ratio() >= 0.88 or ((re.search(r'[./]', nome) or any(re.search(r'[./]', n) for n in x['nomes'])) and contida(x['chave'], ch))), None)
        if not g:
            g = {'chave': ch, 'nomes': collections.Counter(), 'docentes': {}, 'fontes': set()}
            grupos.append(g)
        g['nomes'][nome] += 1
        if 'folha' in fonte: g.setdefault('porExtenso', collections.Counter())[nome] += 1
        if tp == 'efectivo' or k not in g['docentes']: g['docentes'][k] = tp
        g['fontes'].add(fonte)

cadeiras = []
avisos = []
for g in grupos:
    # o nome: o mais completo (as folhas por cadeira escrevem-no por extenso)
    escolha = g.get('porExtenso') or g['nomes']
    nome = max(escolha, key=lambda n: ('.' not in n and '/' not in n, escolha[n], len(n)))
    deps = collections.Counter(dep_de[k] for k, tp in g['docentes'].items() if tp == 'efectivo' and k in dep_de)
    if not deps: deps = collections.Counter(dep_de[k] for k in g['docentes'] if k in dep_de)
    dep = deps.most_common(1)[0][0] if deps else ''
    if len(deps) > 1 and deps.most_common(2)[0][1] == deps.most_common(2)[1][1]:
        avisos.append(f'{nome}: os docentes são de departamentos diferentes ({", ".join(f"{d} {n}" for d, n in deps.items())}) — ficou {dep}; confirme.')
    if not dep: avisos.append(f'{nome}: nenhum docente efectivo está num departamento da folha «Nº 1» — sem departamento; atribua-o em Estrutura do ensino.')
    cadeiras.append({
        'nome': nome, 'grafias': sorted(g['nomes']), 'departamento': dep, 'votos': dict(deps),
        'docentes': [{'nip': docentes[k]['nip'], 'nome': docentes[k]['nome'], 'posto': docentes[k]['posto'], 'tipo': tp} for k, tp in g['docentes'].items()],
        'fontes': sorted(g['fontes']),
    })
cadeiras.sort(key=lambda c: (c['departamento'] or 'zzz', c['nome']))

# ---------- as turmas de 2026/2027 (os discentes das listas) ----------
MODELOS = {('CSCD', 32): 'cscd-2026', ('CEMC', 2): 'cemc-2026', ('CEAO', 18): 'ceao-2026', ('COAMP', 12): 'coamp-2026'}
SIGLA = [('CSCD', r'superior de comando'), ('CEAO', r'estrategia e arte'), ('COAMP', r'asseguramento|apoio moral'), ('CEMC', r'estado-maior conjunto|estado maior conjunto')]
turmas = collections.OrderedDict()
for p in json.load(open(ACADEMICOS))['pessoas']:
    for a in p.get('anos', []):
        if a['anoLetivo'] != ANO or a['papel'] != 'estudante': continue
        m = re.match(r'^(\d+)\.º\s+(.*)$', a['curso'] or '')
        if not m: continue
        sig = next((s for s, rx in SIGLA if re.search(rx, sem(m.group(2)))), None)
        if not sig: continue
        ed = int(m.group(1))
        if sig == 'COAMP' and ed == 18:
            ed = 12  # na lista vem «18.º»: pela sequência (11.º em 2025/2026) e pelo plano, é o 12.º
            avisos.append('COAMP 2026/2027: a lista dos discentes diz «18.º Curso…»; pela sequência e pelo plano de curso é o 12.º — confirme.')
        t = turmas.setdefault((sig, ed), {'sigla': sig, 'edicao': ed, 'anoLetivo': ANO, 'curso': a['curso'], 'modelo': MODELOS.get((sig, ed), ''), 'estudantes': []})
        num = p.get('nip') or p.get('numeroAgente') or ''
        if not any(e['nome'] == p['nome'] for e in t['estudantes']): t['estudantes'].append({'nip': num, 'nome': p['nome']})
for t in turmas.values():
    if not t['modelo']: avisos.append(f"{t['curso']} ({ANO}): não há modelo do plano de curso no sistema — a turma entra sem cadeiras (carregue o plano em Turma › Plano de curso).")

json.dump({'tipo': 'arranque-ano-lectivo', 'anoLetivo': ANO, 'geradoEm': '2026-11-26',
           'departamentos': [{'nome': n, 'docentes': [docentes[k] | {'cadeiras': None} for k in ks]} for n, ks in departamentos.items()],
           'cadeiras': cadeiras, 'turmas': list(turmas.values()), 'avisos': sorted(set(avisos))},
          open(SAIDA, 'w'), ensure_ascii=False, indent=1, default=str)
print(len(departamentos), 'grupos na folha Nº 1;', len(cadeiras), 'cadeiras;', sum(1 for c in cadeiras if c['departamento']), 'com departamento;', len(turmas), 'turmas de', ANO)
for c in cadeiras: print(f"  {c['departamento'] or '—':<45} {c['nome'][:45]:<45} {len(c['docentes'])} doc.  {c['votos']}")
for t in turmas.values(): print(f"  turma {t['edicao']}.º {t['sigla']}: {len(t['estudantes'])} discentes, modelo {t['modelo'] or '—'}")
print(len(set(avisos)), 'avisos')
