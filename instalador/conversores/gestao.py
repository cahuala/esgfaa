"""
As pautas do arquivo para a Gestão Escolar (Portal › Administração Escolar › Arquivo): uma turma por curso e ano,
com as cadeiras (código e nome), os blocos e, de cada discente, o NIP, as notas, a média final e a classificação.
Uso: python gestao.py <arquivo.json> <academicos.json (para os NIP)> <saida.json>
"""
import sys, re, json, unicodedata

ARQ, ACAD, SAIDA = sys.argv[1:4]
arq = json.load(open(ARQ))
sem = lambda t: ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').upper()
chave = lambda t: re.sub(r'[^A-Z0-9]', '', sem(t))
PART = {'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'A', 'O', 'EM', 'NA', 'NO', 'NAS', 'NOS', 'PARA'}

# o NIP de quem está nas listas (as pautas sem NIP: pelo nome, na mesma turma)
acad = json.load(open(ACAD))['pessoas']


def iniciais(nome, usados):
    w = [x for x in re.split(r'[\s/.-]+', sem(nome)) if x and x not in PART]
    c = ''.join(x[0] for x in w)[:8] if len(w) > 1 else (w[0][:6] if w else 'UC')
    base, n = c, 2
    while c in usados: c, n = f'{base}{n}', n + 1
    usados.add(c)
    return c


# os nomes das cadeiras de todas as edições do mesmo curso (as pautas de um ano dão o nome às de outro)
nomes_curso = {}
for t in arq['turmas']:
    for k, v in t['cadeiras'].items():
        if v.get('nome'): nomes_curso.setdefault((t['sigla'], chave(k)), v['nome'])
SIGLA_CURSO = [('CSCD', r'SUPERIOR DE COMANDO'), ('CEAO', r'ESTRATEGIA E ARTE'), ('COAMP', r'ASSEGURAMENTO|APOIO MORAL|PSICO-MORAL|EDUCACAO PATRIOTICA'), ('CEMC', r'ESTADO.MAIOR CONJUNTO')]
def curso_de(n):
    m = re.match(r'^(\d+)\.º\s+(.*)$', n or '')
    return next(((sg, int(m.group(1))) for sg, rx in SIGLA_CURSO if m and re.search(rx, sem(m.group(2)))), None)
tok = lambda n: {w for w in re.split(r'[\s.]+', sem(n)) if w and w not in PART}
no_curso = {}
for q in acad:
    for a_ in q.get('anos', []):
        k = curso_de(a_['curso'])
        if k and a_['papel'] == 'estudante': no_curso.setdefault(k, []).append(q)

saida = []
for t in arq['turmas']:
    p = t.get('pauta')
    if not p: continue
    nomes_uc = {chave(k): v['nome'] for k, v in t['cadeiras'].items() if v.get('nome')}
    # legenda no fim da pauta: «CRPP - Comunicação, Relações Públicas e Protocolo»
    for l in p.get('legenda', []):
        m = re.match(r'^([A-Za-z.]{2,10})\s*[-–—:]\s*(.+)$', l)
        if m: nomes_uc.setdefault(chave(m.group(1)), m.group(2).strip())
    usados = set()
    ucs = []
    for u in p['ucs']:
        rot = u['codigo'].strip()
        if ' ' in rot or len(rot) > 10:
            codigo, nome = iniciais(rot, usados), rot
        else:
            codigo = re.sub(r'[^A-Z0-9]', '', sem(rot))[:20] or iniciais(rot, usados)
            usados.add(codigo)
            nome = nomes_uc.get(chave(rot)) or nomes_curso.get((t['sigla'], chave(rot))) or rot
        nome = re.sub(r'^(TAI|TAG|TA)\s*[-–]+\s*', '', nome).strip().rstrip('\\').strip()
        nome = nome[:1].upper() + nome[1:].lower() if nome.isupper() and len(nome) > 6 else nome
        ucs.append({'codigo': codigo, 'nome': nome, 'bloco': u['bloco'] if u['bloco'] and not re.match(r'^(M[EÉ]DIA|TOT|DISCIP)', sem(u['bloco'])) else '', 'rotulo': rot})
    estudantes = []
    for e in p['estudantes']:
        if not e['nip']:
            # sem NIP na pauta: pelo nome, entre quem as listas põem neste curso
            m = [q for q in no_curso.get((t['sigla'], t['edicao']), []) if len(tok(q['nome']) & tok(e['nome'])) >= min(3, len(tok(e['nome'])))]
            if len(m) == 1 and (m[0].get('nip') or m[0].get('numeroAgente')): e = dict(e, nip=m[0].get('nip') or m[0].get('numeroAgente'), nomeNaRelacao=m[0]['nome'])
        estudantes.append({'nip': e['nip'], 'nome': e.get('nomeNaRelacao') or e['nome'], 'posto': e['posto'], 'ramo': e['ramo'],
                           'notas': {u['codigo']: e['notas'].get(u['rotulo']) for u in ucs}, 'final': e['final'], 'mencao': e['mencao']})
    saida.append({'sigla': t['sigla'], 'edicao': t['edicao'], 'anoLetivo': t['anoLetivo'], 'curso': t['curso'], 'ficheiro': f"{p['ficheiro']} «{p['folha']}»",
                  'ucs': [{k: v for k, v in u.items() if k != 'rotulo'} for u in ucs], 'estudantes': estudantes})
json.dump({'tipo': 'arquivo-administracao-escolar', 'geradoEm': '2026-11-26', 'turmas': saida}, open(SAIDA, 'w'), ensure_ascii=False)
for t in saida:
    print(f"{t['anoLetivo']} {t['edicao']}.º {t['sigla']}: {len(t['estudantes'])} discentes ({sum(1 for e in t['estudantes'] if e['nip'])} com NIP), {len(t['ucs'])} cadeiras: " + ', '.join(f"{u['codigo']}={u['nome'][:22]}" for u in t['ucs'][:6]) + '…')
