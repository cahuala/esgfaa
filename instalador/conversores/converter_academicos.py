"""
Converte as listas de docentes (Excel) e de discentes/finalistas (Word) para a carga do Pessoal.
Uso: python converter_academicos.py <pasta DOCENTES E DISCENTES> <cursos.json> <saida.json> <conferir.xlsx>
Junta a mesma pessoa de várias listas (pelo NIP; pelo nome completo quando o NIP falta ou está trocado).
"""
import sys, re, json, unicodedata, collections, datetime
import openpyxl

PASTA, CURSOS, SAIDA, CONFERIR = sys.argv[1:5]


def sem(t):
    t = ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[.\s]+', ' ', t.lower()).strip()


def chave_posto(t):
    return re.sub(r'[\s.\-/–]+', '', sem(t))


NIP_RE = re.compile(r'^I?\d{4,10}$', re.I)

# posto (como vem escrito, sem separadores) → (id do posto, ramo que o nome indica)
POSTOS = {}
def p(id_, ramo, *nomes):
    for n in nomes: POSTOS[chave_posto(n)] = (id_, ramo)
p('tenente_general', None, 'Ten. General', 'Ten General', 'Tenente-General', 'Tte-General', 'T.General', 'Tte. General', 'Tte.General')
p('tenente_general', 'MGA', 'Vice-Almirante', 'V/Almirante', 'V.Almirante')
p('brigadeiro', None, 'Brigadeiro', 'Brig.', 'Brig')
p('brigadeiro', 'MGA', 'Contra-Almirante', 'C/Almirante', 'C.Almirante', 'Contra Almirante')
p('coronel', None, 'Coronel')
p('coronel', 'MGA', 'CMG-Fz', 'CMG', 'Cap.Mar.Guerra', 'Capitão-de-Mar-e-Guerra')
p('tenente_coronel', None, 'Tenente-Coronel', 'Tte-Coronel', 'T.Coronel', 'Tte.Coronel', 'TCor')
p('tenente_coronel', 'MGA', 'Capitão-de-Fragata', 'Cap.Fragata', 'CFR')
p('major', None, 'Major')
p('major', 'MGA', 'CVV', 'Cap.Corv', 'Capitão-de-Corveta', 'Capitão de Corveta', 'Cap.Corveta', 'Capitão/Corveta', 'CCV')
p('capitao', None, 'Capitão')
p('capitao', 'MGA', 'Tenente-de-Navio', 'Tenente/Navio', 'Tte-Navio', 'Tenente de Navio')
p('tenente', None, 'Tenente')
p('tenente', 'MGA', 'Tenente-de-Fragata', 'Tte-Fragata')
p('primeiro_sargento', None, '1º Sargento')
p('segundo_sargento', None, '2º Sargento')
# postos da Polícia Nacional (não são das FAA: a ficha fica como civil, com o posto nas observações)
POLICIA = {}
for nome, variantes in {
    'Comissário': ['Comissário'], 'Subcomissário': ['Subcom', 'Subcomissário', 'Sub.Comissário', 'Sub-Comissário'],
    'Superintendente-Chefe': ['S/Chefe', 'Superintendente-Chefe', 'Superint-Chefe', 'Sup. Chefe', 'Super. Int.Chefe', 'Sup/Chefe', 'Super-Chefe', 'Super/Chefe'],
    'Superintendente': ['Superintendente', 'Superintende', 'Superint'], 'Intendente': ['Intendente', 'Intend'],
    'Inspector-Chefe': ['Inspector-Chefe', 'Inspector – Chefe', 'Insp.Chefe'],
}.items():
    for v in variantes: POLICIA[chave_posto(v)] = nome
NOME_POSTO = {'tenente_general': 'Tenente-General', 'brigadeiro': 'Brigadeiro', 'coronel': 'Coronel', 'tenente_coronel': 'Tenente-Coronel', 'major': 'Major', 'capitao': 'Capitão', 'tenente': 'Tenente', 'primeiro_sargento': '1.º Sargento', 'segundo_sargento': '2.º Sargento'}

PAISES = {'exercito/fac': ('República do Congo', 'Congolesa'), 'gendarmrie': ('República do Congo', 'Congolesa'), 'gendarmerie': ('República do Congo', 'Congolesa'), 'mocambique': ('Moçambique', 'Moçambicana'), 'zambia': ('Zâmbia', 'Zambiana'), 'sao tome e principe': ('São Tomé e Príncipe', 'São-tomense'), 'congo brazzaville': ('República do Congo', 'Congolesa'), 'cabo verde': ('Cabo Verde', 'Cabo-verdiana')}
RAMO_DA_UNIDADE = {'exercito': 'EXE', 'forca aerea nacional': 'FAN', 'forcas aerea nacional': 'FAN', 'marinha de guerra angolana': 'MGA'}
SIGLAS = {'UDP', 'USP', 'SISM', 'MINDENVP', 'MINDENACVP', 'FAA', 'EMG', 'PR'}
PARTICULAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'à', 'ao', 'para', 'os', 'as', 'o'}


def titulo(t):
    palavras = re.split(r'(\s+|/|-)', t.strip())
    out, primeira = [], True
    for w in palavras:
        if not w or re.match(r'^(\s+|/|-)$', w): out.append(w); continue
        if w.upper() in SIGLAS: out.append(w.upper())
        elif not primeira and w.lower() in PARTICULAS: out.append(w.lower())
        else: out.append(w[:1].upper() + w[1:].lower())
        primeira = False
    return re.sub(r'(\d+)º', r'\1.º', ''.join(out))


FORCAS = json.load(open(sys.argv[0].replace('converter_academicos.py', 'forcas.json')))
def orgao(u):
    s = sem(u)
    return next((o for o in FORCAS['orgaos'] if s in [sem(n) for n in o['nomes']] or s == sem(o['nome'])), None)


def unidade_origem(u):
    s = sem(u)
    if not s: return ''
    if 'policia nacional' in s: return 'Polícia Nacional'
    o = orgao(u)
    return o['nome'] if o else titulo(u)


def limpar_nome(n):
    n = re.sub(r'\s+', ' ', str(n)).strip()
    guerra = ''
    m = re.search(r'["“”]([^"“”]+)["“”]', n)
    if m:
        guerra = m.group(1).strip()
        n = (n[:m.start()] + n[m.end():]).strip()
    n = re.sub(r'\s*\((Ética|História Militar|Comunicação e Expressão)\)', '', n).strip()
    return n, guerra


def nip_de(v):
    t = re.sub(r'\s', '', str(v or '')).upper()
    return t if NIP_RE.match(t) else ''


# ───────────────────────── pessoas, juntas ─────────────────────────
pessoas = []
por_nip = {}
conferir = []  # (motivo, nome, nip, posto, de onde)


def tokens(n): return set(w for w in sem(n).split() if w not in PARTICULAS)


def quase_igual(a, b):
    ta, tb = sem(a).split(), sem(b).split()
    if len(ta) != len(tb) or len(ta) < 2: return False
    return sum(x != y for x, y in zip(ta, tb)) <= 1 and sum(sum(c1 != c2 for c1, c2 in zip(x, y)) + abs(len(x) - len(y)) for x, y in zip(ta, tb)) <= 2


def parecidos(a, b):
    """a mesma pessoa escrita de outra maneira: 2 nomes iguais (ou quase: uma letra trocada), o nome junto igual
    (um apelido escrito junto ou separado), ou o 1.º nome igual e outro abreviado (só a inicial)."""
    import difflib
    if len(tokens(a) & tokens(b)) >= 2: return True
    ja, jb = re.sub(r'[^a-z]', '', sem(a)), re.sub(r'[^a-z]', '', sem(b))
    if difflib.SequenceMatcher(None, ja, jb).ratio() >= 0.9: return True
    ta = [w.strip('.') for w in sem(a).split() if w.strip('.') not in PARTICULAS]
    tb = [w.strip('.') for w in sem(b).split() if w.strip('.') not in PARTICULAS]
    if not ta or not tb: return False
    perto = lambda x, y: x == y or (len(x) > 3 and len(y) > 3 and difflib.SequenceMatcher(None, x, y).ratio() >= 0.8)
    cheios = sum(1 for x in ta if len(x) > 1 and any(len(y) > 1 and perto(x, y) for y in tb))
    if cheios >= 2: return True
    iniciais = sum(1 for x in ta if len(x) == 1 and any(y[0] == x for y in tb[1:])) + sum(1 for y in tb if len(y) == 1 and any(x[0] == y for x in ta[1:]))
    return perto(ta[0], tb[0]) and cheios >= 1 and iniciais >= 1 and len(ta) + len(tb) >= 5


GRAU = ['segundo_sargento', 'primeiro_sargento', 'tenente', 'capitao', 'major', 'tenente_coronel', 'coronel', 'brigadeiro', 'tenente_general']


def grau(t):
    k = chave_posto(re.sub(r'\(reformad[oa]\)', '', t or '', flags=re.I))
    return GRAU.index(POSTOS[k][0]) if k in POSTOS else None


def compativeis(alvo, r):
    """o mesmo nome com outro NIP: é a mesma pessoa (NIP mal escrito) se o posto bate com a data (pode ter sido promovido)"""
    if not alvo['postos'] or not r.get('posto'): return True
    d0, p0 = sorted(alvo['postos'], key=lambda x: x[0] or '0')[-1]
    g0, g1 = grau(p0), grau(r['posto'])
    if g0 is None or g1 is None: return sem(p0) == sem(r['posto'])
    d1 = r.get('data', '')
    if (d1 or '0') >= (d0 or '0'): return 0 <= g1 - g0 <= 1
    return 0 <= g0 - g1 <= 1


def ano_de(a, anoLetivo, papel, curso='', tipoDocente=None, concluido=None):
    for x in a['anos']:
        if (x['anoLetivo'], x['papel'], x['curso']) == (anoLetivo, papel, curso):
            if concluido: x['concluido'] = True
            return
    a['anos'].append({'anoLetivo': anoLetivo, 'papel': papel, 'curso': curso, 'tipoDocente': tipoDocente, 'concluido': concluido})


def juntar(r):
    """r: dict com nome, nip, posto (texto), ramo?, unidade, origem (texto da lista)."""
    nome, guerra = limpar_nome(r['nome'])
    nip = r.get('nip', '')
    alvo = por_nip.get(nip) if nip else None
    if alvo and not parecidos(alvo['nome'], nome):
        conferir.append(('O mesmo NIP com nomes diferentes: não se juntou', nome, nip, r.get('posto', ''), r['origem'] + f" (já estava: {alvo['nome']})"))
        return None
    if not alvo:
        # o mesmo nome completo (3+ palavras) sem NIP, ou com o NIP trocado: é a mesma pessoa
        mesmos = [x for x in pessoas if sem(x['nome']) == sem(nome) and len(tokens(nome)) >= 3]
        if len(mesmos) == 1 and nip and mesmos[0]['nips'] and not compativeis(mesmos[0], r):
            mesmos[0]['avisos'].append(f'Há outra pessoa com o mesmo nome e outro NIP ({nip}, {r.get("posto", "")}, {r["origem"]}): ficaram fichas separadas')
            mesmos = []
        if len(mesmos) == 1:
            alvo = mesmos[0]
            if nip and nip not in alvo['nips']:
                alvo['avisos'].append(f'NIP diferente noutra lista: {nip} ({r["origem"]})')
    if not alvo:
        alvo = {'nome': nome, 'nomeGuerra': guerra, 'nips': [], 'postos': [], 'ramos': [], 'unidades': [], 'docente': None, 'estudante': None, 'cursos': [], 'avisos': [], 'origens': [], 'formacao': '', 'departamento': '', 'habilitacao': '', 'areaFormacao': '', 'cadeira': '', 'reformado': False, 'anos': []}
        pessoas.append(alvo)
    if nip and nip not in alvo['nips']: alvo['nips'].append(nip)
    if nip: alvo.setdefault('vezes', collections.Counter())[nip] += 1
    for n in alvo['nips']: por_nip.setdefault(n, alvo)
    if guerra and not alvo['nomeGuerra']: alvo['nomeGuerra'] = guerra
    if r.get('posto'): alvo['postos'].append((r.get('data', ''), r['posto']))
    if r.get('ramo'): alvo['ramos'].append(r['ramo'])
    if r.get('unidade'): alvo['unidades'].append((r.get('data', ''), r['unidade']))
    alvo['origens'].append(r['origem'])
    return alvo


# ───────────────────────── docentes (Excel) ─────────────────────────
HAB = {'doutor': 'doutoramento', 'doutora': 'doutoramento', 'mestre': 'mestrado', 'licenciado': 'licenciatura', 'licenciada': 'licenciatura', 'freq ens superior': 'medio', '12ª classe': 'medio'}
SECCOES = [('CORPO DOCENTE NOS DEPARTAMENTOS', 'efectivo', ''), ('NÃO COLOCADOS', 'efectivo', ''), ('CIVIS ORGÂNICOS', 'efectivo', 'civil'),
           ('COLABORADORES (MILITARES)', 'colaborador', ''), ('CIVIS (COLABORADORES)', 'colaborador', 'civil'), ('(REFORMADOS)', 'colaborador', 'reformado'),
           ('ORIENTADORES E ARGUENTES', 'colaborador', 'orientador')]
f1 = openpyxl.load_workbook(f'{PASTA}/RELAÇÃO NOMINAL DO CORPO DOCENTE E COLABORADORES, MILITARES E CIVIS.xlsx', data_only=True)
DATA_DOCENTES = '2026-10-02'
sec = None
for row in f1.worksheets[0].iter_rows(values_only=True):
    v = [None if c is None or str(c).strip() == '' else str(c).strip() for c in row]
    if v[0] and not v[1] and not v[3]:
        t = v[0].upper()
        for k, tipo, extra in SECCOES:
            if k in t: sec = (tipo, extra, v[0])
        continue
    if not sec or not v[0] or not re.match(r'^\d{1,3}$', v[0]) or not v[3]: continue
    tipo, extra, nome_sec = sec
    civil = extra == 'civil'
    posto = (v[2] or '').strip()
    if posto.upper() == 'CIVIL': posto = ''
    a = juntar({'nome': v[3], 'nip': '' if civil else nip_de(v[1]), 'posto': '' if civil else posto, 'origem': f'Docentes ({nome_sec.title()})', 'data': DATA_DOCENTES, 'civil': civil})
    if not a: continue
    if civil: a['civil'] = True
    a['docente'] = {'tipo': tipo, 'orientador': extra == 'orientador'}
    if extra == 'reformado': a['reformado'] = True
    a['habilitacao'] = a['habilitacao'] or HAB.get(sem(v[4]).replace('.', ' ').strip(), '') if v[4] else a['habilitacao']
    if v[5] and not a['areaFormacao']: a['areaFormacao'] = v[5]
    if v[7]: a['cadeira'] = v[7]
    if extra == 'orientador' and v[7]: a['cadeira'] = v[7]
    curso = f'Orientador e arguente — {v[7]}' if extra == 'orientador' and v[7] else 'Orientador e arguente' if extra == 'orientador' else (v[7] or '')
    ano_de(a, '2026/2027', 'docente', curso, tipo)
# docentes em formação académica (no país e no exterior)
for row in f1.worksheets[1].iter_rows(values_only=True):
    v = [None if c is None or str(c).strip() == '' else str(c).strip() for c in row]
    if v[0] and re.match(r'^\d{1,3}$', v[0]) and v[3]:
        a = por_nip.get(nip_de(v[1]))
        if a: a['formacao'] = ' — '.join(x for x in [v[4], v[6]] if x)
# a 2.ª folha (departamentos e cadeiras): o departamento e os NIP que faltam na 1.ª
f2 = openpyxl.load_workbook(f'{PASTA}/RELAÇÃO NOMINAL DO CORPO DOCENTE NOS DEPARTAMENTOS 23.09.2026.xlsx', data_only=True)
so_na_segunda = []
for ws in f2.worksheets:
    grupo = ''
    folha = ws.title.strip()
    antigo = folha in ('Nº2', 'Nº3', 'Nº 4')
    tipo_seccao = {'Nº2': 'efectivo', 'Nº3': 'colaborador', 'Nº 4': 'efectivo'}.get(folha)
    for row in ws.iter_rows(values_only=True):
        v = [None if c is None or str(c).strip() == '' else str(c).strip() for c in row]
        if not any(v): continue
        if v[0] and not re.match(r'^\d{1,3}$', v[0]) and not any(v[1:]):
            u0 = v[0].upper()
            if 'COLABORADORES' in u0 or 'ORIENTADORES' in u0: tipo_seccao = 'colaborador'
            elif 'ORGÂNICOS' in u0: tipo_seccao = 'efectivo'
            if not re.search(r'RELAÇÃO|ESTADO MAIOR|ESCOLA SUPERIOR|REPARTIÇÃO DE PESSOAL|FORÇAS ARMADAS|CADEIRAS COM|^DOCENTES|^O CHEFE|^\*|LUANDA', u0): grupo = v[0]
            continue
        if not (v[0] and re.match(r'^\d{1,3}$', v[0])): continue
        cel = [x for x in v[1:] if x]
        if len(cel) < 2: continue
        nome = cel[-1]
        nip = nip_de(cel[0]) if len(cel) >= 3 else ''
        nome_l, _ = limpar_nome(nome)
        a = por_nip.get(nip) if nip else None
        if not a:
            m = [x for x in pessoas if x['docente'] and (sem(x['nome']) == sem(nome_l) or quase_igual(x['nome'], nome_l))]
            a = m[0] if len(m) == 1 else None
        posto2 = cel[1] if len(cel) >= 3 else cel[0]
        civil2 = sem(posto2) == 'civil'
        if not a and antigo and 'ADMINISTRAÇÃO ESCOLAR' not in grupo.upper():
            # docente de 2025/2026 que já não está na relação de Outubro de 2026
            a = juntar({'nome': nome_l, 'nip': '' if civil2 else nip, 'posto': '' if civil2 else re.sub(r'\s*\(reformad[oa]\)', '', posto2, flags=re.I), 'origem': f'Docentes 2025/2026 ({folha} · {grupo})', 'data': '2025-12-09'})
            if a:
                if civil2: a['civil'] = True
                if '(reformad' in posto2.lower(): a['reformado'] = True
                a['docente'] = {'tipo': tipo_seccao or 'efectivo', 'orientador': 'LINHA DE PESQUISA' in grupo.upper(), 'antigo': True}
        if a and antigo and a.get('docente'):
            g = titulo(grupo) if grupo else ''
            ano_de(a, '2025/2026', 'docente', f'Orientador e arguente — {g}' if 'LINHA DE PESQUISA' in grupo.upper() else g, tipo_seccao or a['docente']['tipo'])
        if a:
            if nip and nip not in a['nips']:
                if a['nips']: a['avisos'].append(f'Na lista dos departamentos o NIP é {nip}')
                else: a['nips'].append(nip); por_nip[nip] = a
            if ws.title.strip() == 'Nº 1' and grupo.upper().startswith(('DEPARTAMENTO', 'DIRECÇÃO', 'REPARTIÇÃO PSICO')) and not a['departamento']: a['departamento'] = titulo(grupo)
        elif 'ADMINISTRAÇÃO ESCOLAR' not in grupo.upper() and not antigo and folha != 'Nº 1':
            so_na_segunda.append((nome_l, nip, posto2, f'{folha} · {grupo}'))
for n, nip, posto, onde in so_na_segunda:
    conferir.append(('Docente só na lista de Dezembro de 2025 (não está na de Outubro de 2026): não se carregou', n, nip, posto, onde))

# ───────────────────────── discentes e finalistas (Word) ─────────────────────────
cursos = json.load(open(CURSOS))
for c in cursos:
    actual = 'DISCENTES' in c['ficheiro'].upper()
    t = re.sub(r'^RELAÇÃO NOMINAL DOS FINALISTAS DO\s*', '', c['titulo'].strip(), flags=re.I)
    m = re.search(r'/?\s*((?:DE\s+)?(20\d\d)(?:/(20\d\d))?)\s*$', t)
    if actual: anos, nome_curso = '2026/2027', t
    else:
        anos = m.group(2) + (f'/{m.group(3)}' if m.group(3) else '')
        nome_curso = t[:m.start()].strip().rstrip('/').strip()
    nome_curso = titulo(nome_curso)
    data = c['data'] if re.match(r'^\d{4}-\d\d-\d\d$', str(c['data'])) else ''
    for x in c['alunos']:
        f = x['campos']
        nip = nip_de(f[0]) if len(f) == 3 else ''
        posto_txt, nome = (f[1], f[2]) if len(f) == 3 else (f[0], f[1])
        m2 = re.match(r'^(.*?)\s*\((EXE|FAN|MGA)\)\s*$', posto_txt)
        ramo = m2.group(2) if m2 else None
        posto_txt = (m2.group(1) if m2 else posto_txt).strip()
        un = x['unidadeOrigem']
        a = juntar({'nome': nome, 'nip': nip, 'posto': posto_txt, 'ramo': ramo or RAMO_DA_UNIDADE.get(sem(un)), 'unidade': un, 'origem': f'{nome_curso} ({anos})', 'data': data or ('2026-11-23' if actual else '')})
        if not a: continue
        curso = {'nome': f'{nome_curso} ({anos})', 'fim': None if actual else (data or None), 'aproveitamento': None if actual else True}
        if not any(sem(k['nome']) == sem(curso['nome']) for k in a['cursos']): a['cursos'].append(curso)
        if actual: a['estudante'] = {'curso': nome_curso, 'anoLetivo': anos}
        ano_letivo = anos if '/' in anos else f'{int(anos) - 1}/{anos}'
        ano_de(a, ano_letivo, 'estudante', nome_curso, None, None if actual else True)

# ───────────────────────── arquivo da Administração Escolar (relações nominais e pautas) ─────────────────────────
ARQ = sys.argv[5] if len(sys.argv) > 5 else ''
SIGLA_CURSO = [('CSCD', r'superior de comando'), ('CEAO', r'estrategia e arte'), ('COAMP', r'asseguramento|apoio moral|psico-moral|educacao patriotica'),
               ('CCEM', r'comando e estado'), ('CPOS', r'oficial superior'), ('CEMC', r'estado-maior conjunto|estado maior conjunto'), ('CCEO', r'capacitacao')]
def curso_de(nome):
    m = re.match(r'^(\d+)\.º\s+(.*)$', nome or '')
    if not m or re.search(r'turno', sem(nome)): return None
    return next(((sig, int(m.group(1))) for sig, rx in SIGLA_CURSO if re.search(rx, sem(m.group(2)))), None)
HAB_TXT = [('doutor', 'doutoramento'), ('mestr', 'mestrado'), ('licenc', 'licenciatura'), ('bachar', 'bacharelato'), ('frequ', 'medio'), ('ano', 'medio'), ('12', 'medio'), ('medio', 'medio')]
def habilitacao_de(t):
    s0 = sem(t)
    g = next((v for k, v in HAB_TXT if s0.startswith(k) or f' {k}' in f' {s0}'[:12]), '')
    m = re.search(r'\bem\s+(.+)$', str(t or ''), re.I)
    return g, (m.group(1).strip().rstrip('.') if m and g in ('licenciatura', 'mestrado', 'doutoramento', 'bacharelato') else '')
def data_de(t):
    t = str(t or '').strip()
    m = re.match(r'^(\d{4})-(\d\d)-(\d\d)$', t)
    if m: return t
    m = re.match(r'^(\d{1,2})[./,-](\d{1,2})[./,-](\d{2,4})$', t)
    if not m: return ''
    d_, mm, a_ = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if a_ < 100: a_ += 1900 if a_ > 30 else 2000
    try: return datetime.date(a_, mm, d_).isoformat()
    except ValueError: return ''
def telefone_de(t):
    t = re.sub(r'[^\d/ ]', '', str(t or '')).strip()
    return t if len(re.sub(r'\D', '', t)) >= 9 else ''
arquivo_cmp = []  # para a conferência: (turma, origem, pessoa)
if ARQ:
    arq = json.load(open(ARQ))
    # o nome de cada curso como já está nas listas (para não criar o mesmo curso com outro nome)
    nomes = {}
    for a in pessoas:
        for x in a['anos']:
            k = curso_de(x['curso'])
            if k and x['papel'] == 'estudante': nomes.setdefault(k, x['curso'])
    no_curso = collections.defaultdict(list)
    for a in pessoas:
        for x in a['anos']:
            k = curso_de(x['curso'])
            if k and x['papel'] == 'estudante' and a not in no_curso[k]: no_curso[k].append(a)
    fins_ano = collections.Counter((t['anoLetivo'], t['fim']) for t in arq['turmas'] if t.get('fim'))
    for t in arq['turmas']:
        k = (t['sigla'], t['edicao'])
        nome_curso = nomes.get(k) or titulo(t['curso'])
        ano = t['anoLetivo']
        fim = t.get('fim') or next((f for (al, f), _ in fins_ano.most_common() if al == ano), None)
        pauta = t.get('pauta') or {}
        mencao = {e['nip']: e for e in pauta.get('estudantes', []) if e.get('nip')}
        por_nome_pauta = {sem(e['nome']): e for e in pauta.get('estudantes', []) if not e.get('nip')}
        linhas = [dict(x, de='relação') for x in t['relacao']]
        # quem está na pauta e não na relação
        nips_rel = {x['nip'] for x in t['relacao'] if x.get('nip')}
        nomes_rel = {sem(x['nome']) for x in t['relacao']}
        linhas += [dict(nip=e['nip'], nome=e['nome'], posto=e['posto'], ramo=e['ramo'], de='pauta') for e in pauta.get('estudantes', []) if (e['nip'] and e['nip'] not in nips_rel) or (not e['nip'] and sem(e['nome']) not in nomes_rel)]
        for x in linhas:
            ramo_txt = str(x.get('ramo') or '').upper()
            ramo = next((r for r in ('EXE', 'FAN', 'MGA') if r in ramo_txt), None)
            un = x.get('unidade') or ''
            if ramo_txt and not ramo and not un: un = x.get('ramo')  # «PNA», «Congo»…: a força de origem
            nx = nip_de(x.get('nip'))
            # quem já está nas listas neste mesmo curso (pelo nome): fica o NIP das listas (o do arquivo pode vir
            # estragado — o Excel tira os zeros e corta números); a diferença vai para a conferência
            ja = [q for q in no_curso.get(k, []) if parecidos(q['nome'], x['nome'])]
            if len(ja) == 1:
                nx = ja[0]['nips'][0] if ja[0]['nips'] else ''
                if not nx: x = dict(x, nome=ja[0]['nome'])
            elif nx and nx not in por_nip:
                igual = [n for n in por_nip if n.lstrip('I').lstrip('0') == nx.lstrip('I').lstrip('0') and parecidos(por_nip[n]['nome'], x['nome'])]
                if len(igual) == 1: nx = igual[0]
            # o mesmo nome de alguém das listas com outro NIP: não se sabe qual está certo — não se cria outra ficha
            if len(ja) != 1 and nx and nx not in por_nip:
                homonimos = [q for q in pessoas if sem(q['nome']) == sem(x['nome']) and q['nips']]
                if homonimos:
                    conferir.append(('Arquivo: o mesmo nome das listas com outro NIP — não se carregou (confirme o NIP)', x['nome'], nx, x.get('posto', ''), f"Arquivo {nome_curso} ({ano}); nas listas: {', '.join(h['nips'][0] for h in homonimos)}"))
                    arquivo_cmp.append((t, x, None))
                    continue
            a = juntar({'nome': x['nome'], 'nip': nx, 'posto': x.get('posto') or '', 'ramo': ramo, 'unidade': un, 'origem': f'Arquivo {nome_curso} ({ano})', 'data': fim or f'{ano[5:]}-07-31'})
            arquivo_cmp.append((t, x, a))
            if not a: continue
            e = mencao.get(nip_de(x.get('nip'))) or mencao.get(nx) or por_nome_pauta.get(sem(x['nome']))
            aprov = None if not pauta else (False if e and sem(e.get('mencao')).startswith('reprov') else (True if e else None))
            curso = {'nome': f'{nome_curso} ({ano[5:]})', 'fim': fim, 'aproveitamento': aprov}
            if not any(curso_de(re.sub(r'\s*\(\d{4}(/\d{4})?\)$', '', k2['nome'])) == k for k2 in a['cursos']): a['cursos'].append(curso)
            ano_de(a, ano, 'estudante', nome_curso, None, aprov)
            # os dados da relação nominal (só completam a ficha: o que já lá está não muda)
            g, area = habilitacao_de(x.get('habilitacao'))
            if g and not a['habilitacao']: a['habilitacao'] = g
            if area and not a['areaFormacao']: a['areaFormacao'] = area
            for campo, v in (('dataNascimento', data_de(x.get('nascimento'))), ('telefone', telefone_de(x.get('telefone'))), ('funcaoActual', re.sub(r'\s+', ' ', x.get('funcao') or '').strip()[:200])):
                if v and not a.get(campo): a[campo] = v

# ───────────────────────── fichas a carregar ─────────────────────────
saida, contagem = [], collections.Counter()
for a in pessoas:
    postos = sorted(a['postos'], key=lambda x: x[0] or '0')
    posto_txt = postos[-1][1] if postos else ''
    kp = chave_posto(posto_txt)
    unidades = sorted(a['unidades'], key=lambda x: x[0] or '0')
    un = unidades[-1][1] if unidades else ''
    pais = PAISES.get(sem(un))
    reformado = a['reformado'] or '(reformado)' in sem(posto_txt)
    kp = chave_posto(re.sub(r'\(reformad[oa]\)', '', posto_txt, flags=re.I))
    d = {'nome': a['nome'], 'origens': sorted(set(a['origens']))}
    if a['nomeGuerra']: d['nomeGuerra'] = a['nomeGuerra']
    obs = []
    if pais:
        # a força do país (a Marinha, se o posto é naval) e o posto como se escreve lá
        nome_pais = pais[0]
        forcas = FORCAS['paises'].get(nome_pais, {}).get('forcas', [])
        naval = kp in POSTOS and POSTOS[kp][1] == 'MGA'
        armadas = [f for f in forcas if not f.get('policia')]
        forca = next((f for f in armadas if bool(f.get('naval')) == naval), armadas[0] if armadas else None)
        d.update(tipo='civil', nacionalidade=pais[1], paisNascimento=pais[0], unidadeOrigem=forca['nome'] if forca else f'Forças Armadas — {pais[0]}')
        if a['nips']: d['numeroAgente'] = a['nips'][-1]
        NAVAL = {'tenente_general': 'Vice-Almirante', 'brigadeiro': 'Contra-Almirante', 'coronel': 'Capitão-de-Mar-e-Guerra', 'tenente_coronel': 'Capitão-de-Fragata', 'major': 'Capitão-de-Corveta', 'capitao': 'Tenente-de-Navio', 'tenente': 'Tenente-de-Fragata'}
        lp = (forca or {}).get('postos') or []
        do_pais = next((x['nome'] for x in lp if kp in POSTOS and x['equivale'] == POSTOS[kp][0]), None)
        d['postoExterno'] = do_pais or ((NAVAL if POSTOS[kp][1] == 'MGA' else NOME_POSTO).get(POSTOS[kp][0]) if kp in POSTOS else None) or posto_txt
        contagem['estrangeiros'] += 1
    elif kp in POLICIA:
        d.update(tipo='civil', unidadeOrigem='Polícia Nacional')
        if a['nips']: d['numeroAgente'] = a['nips'][-1]
        d['postoExterno'] = POLICIA[kp]
        contagem['policia'] += 1
    elif a.get('civil') or not posto_txt:
        d['tipo'] = 'civil'
        if un: d['unidadeOrigem'] = unidade_origem(un)
    elif kp in POSTOS:
        pid, ramo_posto = POSTOS[kp]
        ramos = [r for r in a['ramos'] if r]
        o = orgao(un) if un else None
        ramo = ramo_posto or (ramos[-1] if ramos else None) or (o or {}).get('ramo')
        if not ramo:
            ramo = 'EXE'
            d['ramoPorConfirmar'] = True
            contagem['ramo por confirmar'] += 1
        d.update(tipo='militar', posto=pid, ramo=ramo, fps='QP')
        if reformado: d['situacao'] = 'reforma'
        if un: d['unidadeOrigem'] = unidade_origem(un)
        if not a['nips']:
            conferir.append(('Militar sem NIP: não se pode criar a ficha (complete o NIP e importe)', a['nome'], '', posto_txt, '; '.join(sorted(set(a['origens'])))))
            continue
        vezes = a.get('vezes', collections.Counter())
        d['nip'] = sorted(a['nips'], key=lambda n: (vezes[n], a['nips'].index(n) == 0))[-1]
        if len(a['nips']) > 1: d['outrosNips'] = [n for n in a['nips'] if n != d['nip']]
    else:
        conferir.append((f'Posto desconhecido «{posto_txt}»: não se carregou', a['nome'], ','.join(a['nips']), posto_txt, '; '.join(sorted(set(a['origens'])))))
        continue
    if d['tipo'] == 'civil' and a['nips'] and 'numeroAgente' not in d: d['numeroAgente'] = a['nips'][-1]
    for campo in ('dataNascimento', 'telefone', 'funcaoActual'):
        if a.get(campo): d[campo] = a[campo]
    if a['habilitacao']: d['habilitacao'] = a['habilitacao']
    if a['areaFormacao']: d['areaFormacao'] = a['areaFormacao']
    if a['docente']:
        d['docente'] = {'tipo': a['docente']['tipo']}
        if a['docente'].get('antigo'): d['docente'].update(antigo=True, motivoSaida='Não consta da relação do corpo docente de 2026/2027')
        if a['docente']['orientador']: obs.append(f'Orientador e arguente ({a["cadeira"]})' if a['cadeira'] else 'Orientador e arguente')
        elif a['cadeira']: obs.append(f'Cadeira que lecciona (Out. 2026): {a["cadeira"]}')
        if a['departamento']: obs.append(a['departamento'])
        if a['formacao']: obs.append(f'Em formação académica: {a["formacao"]}')
        contagem['docentes ' + a['docente']['tipo']] += 1
    if a['estudante']:
        d['estudante'] = a['estudante']
        contagem['estudantes 2026/2027'] += 1
    if not a['docente'] and not a['estudante']: contagem['ex-estudantes (finalistas)'] += 1
    if a['cursos']: d['cursos'] = a['cursos']
    if a['anos']: d['anos'] = a['anos']
    fins = [c['fim'] for c in a['cursos'] if c['fim']]
    if fins: d['ultimoFim'] = max(fins)
    obs += a['avisos']
    if obs: d['observacoes'] = '. '.join(obs)
    saida.append(d)

versao = 'docentes-discentes-' + datetime.date.today().isoformat() + ('-com-arquivo-2021-2026' if ARQ else '-forcas')
json.dump({'versao': versao, 'pessoas': saida}, open(SAIDA, 'w'), ensure_ascii=False, indent=1)

wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Conferir'
ws.append(['Motivo', 'Nome', 'NIP', 'Posto', 'Lista'])
for r in conferir: ws.append(list(r))
for col, w in zip('ABCDE', (70, 42, 14, 22, 70)): ws.column_dimensions[col].width = w
ws2 = wb.create_sheet('Avisos')
ws2.append(['Nome', 'NIP', 'Aviso'])
for d in saida:
    for o in (d.get('observacoes') or '').split('. '):
        if o.startswith(('NIP diferente', 'Na lista dos departamentos')): ws2.append([d['nome'], d.get('nip') or d.get('numeroAgente') or '', o])
ws2.column_dimensions['A'].width = 42; ws2.column_dimensions['C'].width = 90
wb.save(CONFERIR)
print('fichas:', len(saida), dict(contagem)); print('a conferir:', len(conferir))
for r in collections.Counter(x[0] for x in conferir).most_common(): print('  ', r)
