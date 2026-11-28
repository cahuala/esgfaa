"""
Lê o arquivo da Repartição de Administração Escolar (docs/ARQUIVO 2023-2024, 2024-2025, 2025-2026):
  - as relações nominais dos discentes (cada folha = um curso de um ano lectivo);
  - as pautas finais (as notas de cada cadeira, a média final e a classificação);
  - as pautas de cada cadeira (o nome completo da cadeira e as notas, quando não há pauta final).
O curso e o ano lectivo vêm do conteúdo (a edição do curso), não do nome da pasta (há pastas trocadas).
Uso: python arquivo.py <pasta docs> <saida.json>
"""
import sys, os, re, json, glob, unicodedata, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ler import linhas as ler_folhas, limpa

DOCS, SAIDA = sys.argv[1:3]
N = lambda s: unicodedata.normalize('NFC', s)


def sem(t):
    return ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').upper()


# sigla → (palavras do nome por extenso, edição e ano de referência, nome do curso)
CURSOS = {
    'CSCD': (r'SUPERIOR\s+DE\s+COMANDO', 31, 2025, 'Curso Superior de Comando e Direcção'),
    'CEAO': (r'ESTRATEGIA\s+E\s+ARTE', 17, 2025, 'Curso de Estratégia e Arte Operativa'),
    'COAMP': (r'APOIO\s+MORAL|ASSEGURAMENTO', 11, 2025, 'Curso de Organização do Asseguramento Moral e Psicológico'),
    'CCEM': (r'COMANDO\s+E\s+ESTADO', 24, 2023, 'Curso de Comando e Estado Maior'),
    'CPOS': (r'OFICIAL\s+SUPERIOR', 20, 2023, 'Curso de Promoção a Oficial Superior'),
    'CEMC': (r'ESTADO[\s-]+MAIOR\s+CONJUNTO', 1, 2025, 'Curso de Estado-Maior Conjunto'),
    'CCEO': (r'CAPACITACAO', 1, 2025, 'Curso de Capacitação de Estratégia, Arte Operativa e Táctica para os Orgãos Operações do Emg, Ramos das FAA e Polícia Nacional'),
}


def ano_letivo(sigla, ed):
    _, e0, a0, _ = CURSOS[sigla]
    a = a0 + (ed - e0)
    return f'{a}/{a + 1}'


def identificar(*textos):
    """(sigla, edição) a partir do título, do nome da folha ou do ficheiro (por esta ordem)."""
    for t in textos:
        u = sem(t)
        for sig, (rx, *_) in CURSOS.items():
            m = re.search(r'(\d+)\s*[ºO°.]*\s*\.?\s*CURSO\s+(?:DE\s+|DO\s+)?[^|]{0,25}?(?:' + rx + ')', u)
            if m: return sig, int(m.group(1))
        for sig in CURSOS:
            m = re.search(r'(\d+)\s*[ºO°]?\s*\.?\s*' + sig + r'\b', u)
            if m:
                ed = int(m.group(1))
                # «1º CCEM» é o 1.º Curso de Estado-Maior Conjunto (os CCEM vão no 24.º)
                if sig == 'CCEM' and ed < 10: return 'CEMC', ed
                return sig, ed
    return None, None


NIP_RE = re.compile(r'^I?\d{5,10}$', re.I)


def nip_de(v):
    v = re.sub(r'[\s.]', '', str(v or '')).upper()
    return v if NIP_RE.match(v) else ''


def nota(v):
    v = str(v or '').strip().replace(',', '.')
    try:
        x = float(v)
    except ValueError:
        return None
    return round(x, 2) if 0 <= x <= 20 else None


def tabela(rows):
    """Cabeçalho (1 a 3 linhas) e linhas de dados de uma folha. Devolve (rotulos por coluna [lista de níveis], dados, titulo)."""
    rows = [[limpa(c) for c in r] for r in rows]
    h = next((i for i, r in enumerate(rows) if any(sem(c).strip() == 'NIP' for c in r)), None)
    if h is not None:
        col_nip = next(j for j, c in enumerate(rows[h]) if sem(c).strip() == 'NIP')
        d0 = next((i for i in range(h + 1, len(rows)) if nip_de(rows[i][col_nip] if col_nip < len(rows[i]) else '')), None)
    else:
        # sem NIP: a linha com «NOME» e «POSTO»/«PATENTE»; os dados começam no primeiro n.º de ordem com nome
        h = next((i for i, r in enumerate(rows) if any(sem(c).strip().startswith('NOME') for c in r) and any(sem(c).strip() in ('POSTO', 'PATENTE') for c in r)), None)
        if h is None: return None
        col_nip = next(j for j, c in enumerate(rows[h]) if sem(c).strip() in ('POSTO', 'PATENTE')) - 1
        d0 = next((i for i in range(h + 1, len(rows)) if re.fullmatch(r'\d{1,3}', (rows[i] + [''])[0]) and re.search('[A-Za-z]{3}', ' '.join(rows[i][1:4]))), None)
    if d0 is None: return None
    larg = max(len(r) for r in rows)
    cab = [r + [''] * (larg - len(r)) for r in rows[h:d0]]
    # o nível de cima estende-se para a direita (células unidas no Excel)
    # (cada nível só se estende dentro do grupo do nível de cima: o «MÉDIA» final não herda o «TII» do lado)
    grupo = [0] * larg
    for r in cab[:-1]:
        ult = ''; novo = []
        for j in range(larg):
            if r[j] or (j and grupo[j] != grupo[j - 1]): ult = r[j]
            elif j > col_nip + 2: r[j] = ult
            novo.append((grupo[j], ult))
        ids = {}
        grupo = [ids.setdefault(x, len(ids)) for x in novo]
    rotulos = [[cab[k][j] for k in range(len(cab)) if cab[k][j]] for j in range(larg)]
    dados = []
    for r in rows[d0:]:
        r = r + [''] * (larg - len(r))
        if nip_de(r[col_nip]) or (re.fullmatch(r'\d{1,3}', r[0] or '') and any(re.search('[A-Za-z]{3}', c) for c in r[col_nip + 1:col_nip + 4])):
            dados.append(r)
        elif dados and not any(r[:col_nip + 3]):
            continue
        elif dados and sem(' '.join(r)).strip().startswith(('LEGENDA', 'O CHEFE', 'O DIRECTOR', 'QUADRO', 'MEDIA', 'NOTA MAIS')):
            break
    titulo = ' | '.join(' '.join(c for c in r if c) for r in rows[:h])
    rodape = [' '.join(c for c in r if c) for r in rows[d0 + len(dados):]]
    # as linhas acima do cabeçalho (os nomes dos blocos e os coeficientes: «I. Adm … Coeficiente 3»)
    acima = [r + [''] * (larg - len(r)) for r in rows[:h]]
    return rotulos, dados, titulo, col_nip, rodape, acima


def papel(rot):
    t = sem(' '.join(rot))
    u = sem(rot[-1]).strip() if rot else ''
    if u == 'NIP': return 'nip'
    if u in ('ORDENACAO', 'ORDEM', 'OBS', 'OBSERVACOES', 'OBSERVACAO') or u.startswith('MEDIA PONDERADA') or u.startswith('MEDIA DISP'): return 'outro'
    if u in ('N', 'NO', 'N/O', 'NO.', 'Nº', 'N.º', 'N.O', 'NºORD') or (u.startswith('N') and len(u) <= 3 and not u.isalpha()) or re.match(r'^N\S?\s*ORD', u): return 'n'
    if 'PATENTE' in u or u == 'POSTO' or u.startswith('POSTO'): return 'posto'
    if u.startswith('NOME'): return 'nome'
    if u in ('RAMO', 'RANO') or u.startswith('RAMO'): return 'ramo'
    if 'CLASSIF' in t: return 'mencao'
    if re.search(r'(MEDIA|NOTA)\s+FINAL', t): return 'final'
    if u == 'MEDIA' and len(rot) == 1: return 'media?'
    if u in ('TOT', 'TOTAL', 'TOT.', 'MEDIA', 'M', 'MEDIA DO BLOCO'): return 'bloco'
    if 'TELEF' in t: return 'telefone'
    if 'NASC' in t or 'NACISM' in t: return 'nascimento'
    if 'INCORPORA' in t: return 'incorporacao'
    if 'HABILITA' in t: return 'habilitacao'
    if 'FUNC' in t: return 'funcao'
    if 'PROVEN' in t or 'PROCED' in t or 'UNIDADE' in t: return 'unidade'
    if 'CURSO' == u: return 'curso'
    if u == 'DISCIPLINA': return 'disciplina'
    if u in ('NOTAS', 'NOTA'): return 'nota'
    return 'uc'


def nome_limpo(n):
    n = re.sub(r'\s+', ' ', str(n or '')).strip()
    return ' '.join(w if w.lower() in ('de', 'da', 'do', 'das', 'dos', 'e') else (w[:1].upper() + w[1:].lower() if w.isupper() and len(w) > 2 else w) for w in n.split(' '))


def ficheiros():
    for f in sorted(glob.glob(os.path.join(DOCS, 'ARQUIVO 20*', '**', '*.xls*'), recursive=True)):
        b = os.path.basename(f)
        if b.startswith('~') or 'HOR' in sem(f) and 'RIO MENSAL' in sem(f): continue
        yield f


relacoes = collections.defaultdict(dict)   # (sigla, ed) → nip/nome → aluno
candidatas = collections.defaultdict(list)  # (sigla, ed) → pautas finais encontradas
por_uc = collections.defaultdict(dict)     # (sigla, ed) → código → {nome, notas{nip:nota}, ficheiros}
avisos = []
vistos = set()
fins = {}  # (sigla, ed) → data do fim do curso (da relação)

# todas as folhas com tabela (as relações primeiro: servem para reconhecer as pautas sem título)
folhas = []
for f in ficheiros():
    rel = N(os.path.relpath(f, DOCS))
    for folha, rows in ler_folhas(f):
        t = tabela(rows)
        if t: folhas.append((rel, f, folha, t))
folhas.sort(key=lambda x: 0 if ('NOMINAL' in sem(x[0]) or 'BASE DADOS' in sem(x[0])) else 1)


def chave_pelos_nips(dados, col_nip):
    nips = {nip_de(r[col_nip]) for r in dados} - {''}
    if not nips: return None
    melhor = max(relacoes, key=lambda k: len(nips & set(relacoes[k])), default=None)
    return melhor if melhor and len(nips & set(relacoes[melhor])) >= len(nips) * 0.6 else None


def numero(v):
    try: return float(str(v).replace(',', '.'))
    except ValueError: return None


def blocos_da_pauta(ucs, papeis, rotulos, acima, codigo_de):
    """Os blocos da pauta final: as cadeiras entre duas colunas «Média»; o TII é um bloco (fica depois do último).
    O nome vem do cabeçalho de cima ou da linha acima («I. Adm», «II. Tac»); o coeficiente da célula a seguir a
    «Coeficiente» dentro do bloco (sem coeficiente: 1)."""
    grupos, atual, ini = [], [], ucs[0]
    for j in range(ucs[0], max(ucs) + 2):
        p = papeis[j] if j < len(papeis) else ''
        # a «Média» do bloco tem o mesmo cabeçalho de cima que as cadeiras (a «MÉDIA» geral, à parte, não é do TII)
        do_bloco = p == 'bloco' and atual and (rotulos[j][:-1] == rotulos[atual[0]][:-1] or (len(rotulos[j]) > 1 and rotulos[j][0] == rotulos[atual[0]][0]))
        if j in ucs: atual.append(j)
        elif atual and (do_bloco or j > max(ucs)):
            grupos.append({'colunas': atual, 'inicio': ini, 'fim': j if do_bloco else min(len(papeis) - 1, j + 1), 'media': j if do_bloco else None})
            atual, ini = [], j + 1
    # um grupo de uma só cadeira sem média do bloco, a seguir ao último bloco, é o TII
    for b in grupos:
        cods = [sem(codigo_de(j)) for j in b['colunas']]
        b['tii'] = all(re.match(r'^(TII|TFC)\b', c) for c in cods)
        # o nível mais próximo das cadeiras («Administração»), não o de cima («TAI - Trabalho de Aplicação Individual»)
        cima = [x for j in b['colunas'] for x in (reversed(rotulos[j][:-1]) if len(rotulos[j]) > 1 else [])]
        nome = next((x.strip() for x in cima if x.strip() and not re.match(r'^(MEDIA|TOT|DISCIP|TAI\b|TAG\b|TRABALHO)', sem(x))), '')
        coef = None
        for r in acima:
            for j in range(b['inicio'], b['fim'] + 1):
                t = str(r[j]).strip() if j < len(r) else ''
                if not t: continue
                if sem(t).startswith('COEF'):
                    coef = coef or next((numero(r[k]) for k in range(j + 1, min(len(r), j + 3)) if numero(r[k])), None)
                elif not nome and numero(t) is None and re.search('[A-Za-z]{2}', t) and j >= b['inicio'] and j <= b['fim']:
                    nome = t
        b['nome'] = nome or ('TII' if b['tii'] else f'Bloco {grupos.index(b) + 1}')
        b['coeficiente'] = coef if coef and coef > 0 else 1
    # só faz sentido falar em blocos se houver mais do que um (uma pauta só de cadeiras é «média»)
    return grupos if len(grupos) > 1 else []


def deduzir_coeficientes(pessoas, calculos, grupos, col):
    import itertools
    linhas_ = [([c['blocos'][b['nome']] for b in grupos], nota(r[col])) for r, c in zip(pessoas, calculos)]
    linhas_ = [(ms, f) for ms, f in linhas_ if f is not None and all(m is not None for m in ms)]
    if len(linhas_) < 3 or len(grupos) > 7: return None
    melhor = None
    for cs in itertools.product(range(1, 7), repeat=len(grupos)):
        if max(cs) > 1 and min(cs) > 1 and all(c % 2 == 0 for c in cs): continue  # 2,4,… é o mesmo que 1,2,…
        ok = sum(1 for ms, f in linhas_ if abs(sum(m * c for m, c in zip(ms, cs)) / sum(cs) - f) <= 0.015)
        if not melhor or ok > melhor[0]: melhor = (ok, cs)
    return list(melhor[1]) if melhor and melhor[0] >= 0.8 * len(linhas_) and len(set(melhor[1])) > 1 else None


def calcular(r, grupos):
    """As contas da pauta (como no Excel): a média de cada bloco sem os zeros; a média simples dos blocos; a ponderada
    pelos coeficientes; e a média de todas as cadeiras."""
    blocos = {}
    todas = []
    for b in grupos:
        vs = [nota(r[j]) for j in b['colunas']]
        vs = [v for v in vs if v not in (None, 0)]
        todas += vs
        do_excel = nota(r[b['media']]) if b['media'] is not None else None
        blocos[b['nome']] = do_excel if do_excel not in (None, 0) else (round(sum(vs) / len(vs), 4) if vs else None)
    ms = [(blocos[b['nome']], b['coeficiente']) for b in grupos]
    ok = grupos and all(m is not None for m, _ in ms)
    return {
        'blocos': blocos,
        'simples': round(sum(m for m, _ in ms) / len(ms), 4) if ok else None,
        'ponderada': round(sum(m * c for m, c in ms) / sum(c for _, c in ms), 4) if ok else None,
        'cadeiras': round(sum(todas) / len(todas), 4) if todas else None,
    }


def papeis_de(rotulos):
    ps = [papel(r) for r in rotulos]
    # a média final: a coluna «Média» do nível de cima mais à direita (as outras são médias de bloco)
    if 'final' not in ps and 'media?' in ps:
        ult = max(j for j, p in enumerate(ps) if p == 'media?')
        ps[ult] = 'final'
    return ['bloco' if p == 'media?' else p for p in ps]


for rel, f, folha, (rotulos, dados, titulo, col_nip, rodape, acima) in folhas:
    sig, ed = identificar(titulo, folha, os.path.basename(f))
    if not sig and not ('NOMINAL' in sem(rel) or 'BASE DADOS' in sem(rel)):
        k = chave_pelos_nips(dados, col_nip)
        if k:
            sig, ed = k
            avisos.append(f'{rel} «{folha}»: o título não diz o curso; pelos NIP é o {ed}.º {sig} ({ano_letivo(sig, ed)}).')
    if not sig:
        avisos.append(f'{rel} «{folha}»: não se percebeu o curso — ignorado.')
        continue
    papeis = papeis_de(rotulos)
    chave = (sig, ed)
    assinatura = (chave, json.dumps(dados, ensure_ascii=False))
    if assinatura in vistos: continue   # a mesma folha copiada noutra pasta
    vistos.add(assinatura)
    idx = {p: j for j, p in reversed(list(enumerate(papeis))) if p not in ('uc', 'bloco', 'outro')}
    g = lambda r, k: r[idx[k]] if k in idx else ''
    if 'NOMINAL' in sem(rel) or 'BASE DADOS' in sem(rel):
        # o fim do curso, no título («inicio 16 de Outubro de 2023 À 26 DE JULHO DE 2024»), se tiver o dia
        MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
        m = re.findall(r'(\d{1,2})\s+DE\s+(' + '|'.join(MESES) + r')\s+DE\s+(20\d\d)', sem(titulo))
        if len(m) >= 2 and chave not in fins:
            d_, mes, a_ = m[-1]
            fins[chave] = f'{a_}-{MESES.index(mes) + 1:02d}-{int(d_):02d}'
        for r in dados:
            nip = nip_de(g(r, 'nip')); nome = nome_limpo(g(r, 'nome'))
            if not nome: continue
            a = relacoes[chave].setdefault(nip or sem(nome), {'nip': nip, 'nome': nome})
            for k in ('posto', 'ramo', 'unidade', 'funcao', 'nascimento', 'incorporacao', 'habilitacao', 'telefone'):
                if g(r, k) and not a.get(k): a[k] = re.sub(r'\s+', ' ', g(r, k)).strip()
            a.setdefault('fontes', []).append(f'{rel} «{folha}»')
        continue
    # pauta de uma cadeira: «Nº | NIP | POSTO | NOME | RAMO | DISCIPLINA | NOTAS»
    if 'nota' in idx:
        linhas_tit = [x.strip() for x in titulo.split(' | ') if x.strip()]
        nome_uc = next((x for x in linhas_tit if re.match(r'^(TAI|TAG|TA|TRABALHO|TII)\b', sem(x))), '')
        codigo = next((r[idx['disciplina']] for r in dados if 'disciplina' in idx and r[idx['disciplina']]), '') or re.sub(r'^\d+\s*-\s*', '', os.path.splitext(os.path.basename(f))[0])
        codigo = codigo.strip().rstrip('.').upper()
        u = por_uc[chave].setdefault(codigo, {'nome': '', 'notas': {}, 'ficheiros': []})
        if nome_uc and len(nome_uc) > len(u['nome']): u['nome'] = re.sub(r'^(TAI|TAG|TA)\s*[-–]+\s*', '', nome_uc, flags=re.I).strip()
        u['ficheiros'].append(rel)
        for r in dados:
            nip = nip_de(r[idx['nip']]) if 'nip' in idx else ''
            v = nota(r[idx['nota']])
            if nip and v is not None: u['notas'].setdefault(nip, v)
        continue
    # pauta final: as cadeiras (por blocos), a média final e a classificação
    ucs = [j for j, p in enumerate(papeis) if p == 'uc' and sum(1 for r in dados if nota(r[j]) is not None) >= 1]
    if 'final' not in idx or len(ucs) < 3:
        avisos.append(f'{rel} «{folha}»: tabela sem média final ou com poucas cadeiras ({len(ucs)}) — ignorada.')
        continue
    codigo_de = lambda j: re.sub(r'^\d+\.\s*', '', rotulos[j][-1].strip()).rstrip('.').strip()
    grupos = blocos_da_pauta(ucs, papeis, rotulos, acima, codigo_de)
    # as notas: 0 é «não fez» (no CSCD, ECOFIN e DIRMIL a 0 não entram na média do bloco)
    notas_de = lambda r: {codigo_de(j): (None if nota(r[j]) == 0 else nota(r[j])) for j in ucs}
    pessoas = [r for r in dados if nome_limpo(g(r, 'nome'))]
    # sem blocos, as contas fazem-se com todas as cadeiras juntas
    calculos = [calcular(r, grupos or [{'nome': '', 'colunas': ucs, 'media': None, 'coeficiente': 1}]) for r in pessoas]
    if not grupos:
        for c in calculos: c['blocos'] = {}
    # as colunas da direita: qual é a média ponderada (a final), a média simples e a ordenação — confere-se com as contas
    fechos = {b['media'] for b in grupos}
    depois = [j for j in range(max(ucs) + 1, len(papeis)) if j not in fechos and papeis[j] not in ('mencao', 'nome', 'posto', 'nip', 'ramo', 'n', 'uc')
              and any(nota(r[j]) is not None for r in pessoas)]
    # a «MÉDIA» unida por várias colunas no Excel: fica a que tem os números
    if 'final' in idx and all(nota(r[idx['final']]) is None for r in pessoas) and depois: idx['final'] = depois[0]
    def bate(j, k):
        pares = [(nota(r[j]), c[k]) for r, c in zip(pessoas, calculos) if c[k] is not None and nota(r[j]) is not None]
        return len(pares) >= max(1, 0.7 * len(pessoas)) and sum(1 for a, b in pares if abs(a - b) <= 0.015) >= 0.7 * len(pares)
    col_final = next((j for j in depois if bate(j, 'ponderada')), None)
    if col_final is None and grupos and 'final' in idx:
        # os coeficientes não estão escritos na folha: deduzem-se das médias do próprio Excel (inteiros de 1 a 6)
        coef = deduzir_coeficientes(pessoas, calculos, grupos, idx['final'])
        if coef:
            for b, c in zip(grupos, coef): b['coeficiente'] = c
            calculos = [calcular(r, grupos) for r in pessoas]
            col_final = idx['final']
            avisos.append(f'{rel} «{folha}»: os coeficientes dos blocos não estão na folha; pelas médias do Excel são ' + ', '.join(f"{b['nome']} {c}" for b, c in zip(grupos, coef)) + '.')
    formula = 'blocos'
    if col_final is None:
        col_final = next((j for j in depois if bate(j, 'cadeiras')), None)
        if col_final is not None and not bate(col_final, 'ponderada'): formula = 'media'
    if col_final is None:
        col_final = idx['final']
        avisos.append(f'{rel} «{folha}»: a média final da pauta não bate com as contas dos blocos nem das cadeiras — fica a coluna «{" ".join(rotulos[col_final])}».')
    if not grupos: formula = 'media'
    col_simples = next((j for j in depois if j != col_final and bate(j, 'simples')), None)
    col_ordem = next((j for j in depois if re.match(r'^(ORDENACAO|ORDEM|CLASSIFICACAO GERAL)$', sem(rotulos[j][-1] if rotulos[j] else '').strip())), None)
    cand = {
        'ficheiro': rel, 'folha': folha, 'formula': formula,
        'ucs': [{'codigo': codigo_de(j), 'bloco': next((b['nome'] for b in grupos if j in b['colunas']), '')} for j in ucs],
        'blocos': [{k: b[k] for k in ('nome', 'coeficiente', 'tii')} for b in grupos],
        'estudantes': [],
        'legenda': [x for x in rodape if re.match(r'^[A-Z][A-Za-z.]{1,8}\s*[-–—:]\s*\S', x)][:60],
    }
    if all(nota(r[col_final]) is None for r in pessoas):
        avisos.append(f'{rel} «{folha}»: pauta sem a média final (parcial ou com erros no Excel) — as médias ficam por calcular.')
    for r, c in zip(pessoas, calculos):
        o = str(r[col_ordem]).strip() if col_ordem is not None else ''
        cand['estudantes'].append({'nip': nip_de(g(r, 'nip')), 'nome': nome_limpo(g(r, 'nome')), 'posto': g(r, 'posto'), 'ramo': g(r, 'ramo'),
                                   'notas': notas_de(r), 'blocos': c['blocos'],
                                   'final': nota(r[col_final]), 'mediaSimples': nota(r[col_simples]) if col_simples is not None else c['simples'],
                                   'ordem': int(float(o)) if re.fullmatch(r'\d{1,3}(\.0)?', o) else None,
                                   'mencao': g(r, 'mencao').strip().capitalize()})
    candidatas[chave].append(cand)


def chave_nome(n): return ' '.join(sorted(w for w in sem(n).split() if w not in ('DE', 'DA', 'DO', 'DAS', 'DOS', 'E')))


def completar_nips(est, rel):
    """As pautas sem NIP: o NIP vem da relação nominal, pelo nome (todas as palavras iguais, ou 3 em comum)."""
    por_nome = {chave_nome(a['nome']): a for a in rel}
    falta = 0
    for e in est:
        if e['nip']: continue
        a = por_nome.get(chave_nome(e['nome']))
        if not a:
            w = set(chave_nome(e['nome']).split())
            parecidos = [x for x in rel if len(w & set(chave_nome(x['nome']).split())) >= min(3, len(w))]
            a = parecidos[0] if len(parecidos) == 1 else None
        if a and a.get('nip'): e['nip'] = a['nip']; e['nomeNaRelacao'] = a['nome']
        else: falta += 1
    return falta


turmas = []
for chave in sorted(set(relacoes) | set(candidatas) | set(por_uc), key=lambda k: (ano_letivo(*k), k[0])):
    sig, ed = chave
    rel = list(relacoes.get(chave, {}).values())
    nips_rel = {a['nip'] for a in rel} - {''}
    # entre as pautas finais: a que mais coincide com a relação; depois a mais completa
    for c in candidatas.get(chave, []):
        completar_nips(c['estudantes'], rel)
        nips = {e['nip'] for e in c['estudantes']} - {''}
        completos = sum(1 for e in c['estudantes'] if all(v is not None for v in e['notas'].values()))
        c['pontuacao'] = (len(nips & nips_rel) - len(nips - nips_rel), 'FINAL' in sem(c['folha']), completos, len(c['ucs']))
    cs = sorted(candidatas.get(chave, []), key=lambda c: c['pontuacao'], reverse=True)
    pauta = cs[0] if cs else None
    for c in cs[1:]: avisos.append(f'{ed}.º {sig}: outra pauta final posta de lado: {c["ficheiro"]} «{c["folha"]}» (fica {pauta["ficheiro"]} «{pauta["folha"]}»).')
    if pauta:
        sem_nip = [e['nome'] for e in pauta['estudantes'] if not e['nip']]
        if sem_nip: avisos.append(f'{ed}.º {sig}: {len(sem_nip)} discente(s) da pauta sem NIP nem correspondência na relação: {", ".join(sem_nip)}.')
    turmas.append({
        'sigla': sig, 'edicao': ed, 'anoLetivo': ano_letivo(sig, ed), 'curso': f'{ed}.º {CURSOS[sig][3]}',
        'relacao': rel, 'fim': fins.get(chave), 'pauta': pauta, 'cadeiras': por_uc.get(chave, {}),
    })
json.dump({'turmas': turmas, 'avisos': avisos}, open(SAIDA, 'w'), ensure_ascii=False, indent=1)
for t in turmas:
    p = t['pauta']
    comp = sum(1 for e in p['estudantes'] if all(v is not None for v in e['notas'].values())) if p else 0
    print(f"{t['anoLetivo']} {t['edicao']:>2}.º {t['sigla']:<5} relação {len(t['relacao']):>3} | pauta final {(str(len(p['estudantes'])) + ' disc. (' + str(comp) + ' completos), ' + str(len(p['ucs'])) + ' UC') if p else '—':<32} | pautas por cadeira {len(t['cadeiras'])}")
print(len(avisos), 'avisos')
