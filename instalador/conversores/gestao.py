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

AQUI = __import__('os').path.dirname(__import__('os').path.abspath(__file__))
PLANOS = json.load(open(f'{AQUI}/planos_2026.json'))       # os nomes oficiais dos planos de curso (por sigla do curso)
SIGLAS = json.load(open(f'{AQUI}/siglas_cadeiras.json'))  # as siglas do arquivo que não têm nome noutro lado
PART2 = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no', 'nas', 'nos', 'para', 'ao', 'aos', 'às', 'à'}
def extenso(t):
    """«DIREITO INTERNACIONAL PÚBLICO» → «Direito Internacional Público» (as siglas como FAA ficam)."""
    t = re.sub(r'\s+', ' ', str(t)).strip().strip('\\').strip()
    if t != t.upper(): return t[:1].upper() + t[1:]
    cap = lambda w: '-'.join(x[:1] + x[1:].lower() for x in w.split('-'))
    return ' '.join(w if w in ('FAA', 'EMG', 'ONU', 'TII', 'TFC') else (w.lower() if i and w.lower() in PART2 else cap(w)) for i, w in enumerate(t.split(' ')))
avisos = []

saida = []
for t in arq['turmas']:
    p = t.get('pauta')
    if not p: continue
    nomes_uc = {chave(k): v['nome'] for k, v in t['cadeiras'].items() if v.get('nome')}
    # legenda no fim da pauta: «CRPP - Comunicação, Relações Públicas e Protocolo»
    for l in p.get('legenda', []):
        for m in re.finditer(r'([A-Za-z.]{2,10})\s*[-–—:]\s*(.+?)(?=\s+[A-Za-z.]{2,10}\s*[-–—:]\s|$)', l):
            nomes_uc.setdefault(chave(m.group(1)), m.group(2).strip().rstrip(';,'))
    # os códigos do plano ficam para as cadeiras com esse nome (as outras não os apanham pelas iniciais)
    usados = {c for c, n in PLANOS.get(t['sigla'], {}).items() if any(sem(n) == sem(u['codigo']) for u in p['ucs'])}
    ucs = []
    for u in p['ucs']:
        rot = u['codigo'].strip()
        if len(rot) <= 6 and ' ' in rot: rot = rot.replace(' ', '')  # «T OCC» é a sigla TOCC
        if ' ' in rot or len(rot) > 10:
            do_plano = next((c for c, n in PLANOS.get(t['sigla'], {}).items() if sem(n) == sem(rot) and c not in [x['codigo'] for x in ucs]), None)
            codigo, nome = (do_plano, PLANOS[t['sigla']][do_plano]) if do_plano else (iniciais(rot, usados), rot)
            usados.add(codigo)
        else:
            codigo = re.sub(r'[^A-Z0-9]', '', sem(rot))[:20] or iniciais(rot, usados)
            usados.add(codigo)
            # o nome por extenso: o do plano de curso (a mesma sigla), o da pauta da cadeira, o da tabela das siglas
            # (o da tabela das siglas foi revisto; depois o da pauta dessa cadeira nesse ano; o do plano de 2026/2027 só se não houver outro)
            nome = SIGLAS.get(t['sigla'], {}).get(codigo) or nomes_uc.get(chave(rot)) or PLANOS.get(t['sigla'], {}).get(codigo) or nomes_curso.get((t['sigla'], chave(rot))) or rot
            if nome.endswith('?'):
                nome = nome[:-1]
                avisos.append(f"{t['edicao']}.º {t['sigla']} ({t['anoLetivo']}): «{rot}» ficou «{nome}» (deduzido da sigla) — confirme o nome da cadeira.")
            elif nome == rot and len(rot) <= 10:
                avisos.append(f"{t['edicao']}.º {t['sigla']} ({t['anoLetivo']}): a cadeira «{rot}» não tem o nome por extenso em nenhum documento — corrija em Turma › Cadeiras.")
        nome = extenso(re.sub(r'^(TAI|TAG|TA)\s*[-–]+\s*', '', nome).strip())
        if re.search(r'm[ée]dia do curso', nome, re.I): nome = re.split(r'\s+m[ée]dia do curso', nome, flags=re.I)[0]
        ucs.append({'codigo': codigo, 'nome': nome, 'bloco': u['bloco'] if u['bloco'] and not re.match(r'^(M[EÉ]DIA|TOT|DISCIP)', sem(u['bloco'])) else '', 'rotulo': rot})
    estudantes = []
    for e in p['estudantes']:
        if not e['nip']:
            # sem NIP na pauta: pelo nome, entre quem as listas põem neste curso
            m = [q for q in no_curso.get((t['sigla'], t['edicao']), []) if len(tok(q['nome']) & tok(e['nome'])) >= min(3, len(tok(e['nome'])))]
            if len(m) == 1 and (m[0].get('nip') or m[0].get('numeroAgente')): e = dict(e, nip=m[0].get('nip') or m[0].get('numeroAgente'), nomeNaRelacao=m[0]['nome'])
        estudantes.append({'nip': e['nip'], 'nome': e.get('nomeNaRelacao') or e['nome'], 'posto': e['posto'], 'ramo': e['ramo'],
                           'notas': {u['codigo']: e['notas'].get(u['rotulo']) for u in ucs}, 'final': e['final'], 'mencao': e['mencao']})
    saida.append({'sigla': t['sigla'], 'edicao': t['edicao'], 'anoLetivo': t['anoLetivo'], 'curso': t['curso'], 'nome': t['curso'], 'ficheiro': f"{p['ficheiro']} «{p['folha']}»",
                  'ucs': [{k: v for k, v in u.items() if k != 'rotulo'} for u in ucs], 'estudantes': estudantes})
json.dump({'tipo': 'arquivo-administracao-escolar', 'geradoEm': '2026-11-27', 'turmas': saida, 'avisos': sorted(set(avisos))}, open(SAIDA, 'w'), ensure_ascii=False)
for t in saida:
    print(f"{t['anoLetivo']} {t['edicao']}.º {t['sigla']}: {len(t['estudantes'])} discentes ({sum(1 for e in t['estudantes'] if e['nip'])} com NIP), {len(t['ucs'])} cadeiras: " + ', '.join(f"{u['codigo']}={u['nome'][:22]}" for u in t['ucs'][:6]) + '…')
