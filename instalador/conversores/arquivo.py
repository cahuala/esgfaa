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
    return rotulos, dados, titulo, col_nip, rodape


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


def papeis_de(rotulos):
    ps = [papel(r) for r in rotulos]
    # a média final: a coluna «Média» do nível de cima mais à direita (as outras são médias de bloco)
    if 'final' not in ps and 'media?' in ps:
        ult = max(j for j, p in enumerate(ps) if p == 'media?')
        ps[ult] = 'final'
    return ['bloco' if p == 'media?' else p for p in ps]


for rel, f, folha, (rotulos, dados, titulo, col_nip, rodape) in folhas:
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
    cand = {
        'ficheiro': rel, 'folha': folha,
        'ucs': [{'codigo': re.sub(r'^\d+\.\s*', '', rotulos[j][-1].strip()).rstrip('.'), 'bloco': (rotulos[j][-2] if len(rotulos[j]) > 1 else '').strip()} for j in ucs],
        'estudantes': [],
        'legenda': [x for x in rodape if re.match(r'^[A-Z][A-Za-z.]{1,8}\s*[-–—:]\s*\S', x)][:60],
    }
    for r in dados:
        nome = nome_limpo(g(r, 'nome'))
        if not nome: continue
        cand['estudantes'].append({'nip': nip_de(g(r, 'nip')), 'nome': nome, 'posto': g(r, 'posto'), 'ramo': g(r, 'ramo'),
                                   'notas': {u['codigo']: nota(r[j]) for u, j in zip(cand['ucs'], ucs)},
                                   'final': nota(g(r, 'final')), 'mencao': g(r, 'mencao').strip().capitalize()})
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
