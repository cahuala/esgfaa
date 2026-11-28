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
                           'notas': {u['codigo']: e['notas'].get(u['rotulo']) for u in ucs}, 'final': e['final'], 'mencao': e['mencao'],
                           'blocos': e.get('blocos') or {}, 'mediaSimples': e.get('mediaSimples'), 'ordem': e.get('ordem')})
    saida.append({'sigla': t['sigla'], 'edicao': t['edicao'], 'anoLetivo': t['anoLetivo'], 'curso': t['curso'], 'nome': t['curso'], 'ficheiro': f"{p['ficheiro']} «{p['folha']}»",
                  'ucs': [{k: v for k, v in u.items() if k != 'rotulo'} for u in ucs], 'estudantes': estudantes,
                  # os blocos da pauta assinada, com os coeficientes (o TII é um bloco), e a fórmula da média final
                  'blocos': p.get('blocos') or [], 'formula': p.get('formula') or ('blocos' if p.get('blocos') else 'media')})
# ---------- as turmas sem pauta: os estudantes de cada ano (relações nominais e listas de finalistas) ----------
# as turmas de 2026/2027 dos quatro cursos com plano vêm do arranque do ano; aqui ficam as outras, como histórico
TODOS = [('CSCD', r'SUPERIOR DE COMANDO'), ('CEAO', r'ESTRATEGIA E ARTE'), ('COAMP', r'ASSEGURAMENTO|APOIO MORAL|PSICO-MORAL|EDUCACAO PATRIOTICA'),
         ('CEMC', r'ESTADO.MAIOR CONJUNTO'), ('CCEO', r'CAPACITACAO DE ESTRATEGIA|ACTUALIZACAO DE ESTRATEGIA'), ('CCEM', r'COMANDO E ESTADO.MAIOR'),
         ('CPOS', r'PROMOCAO A OFICIAL SUPERIOR'), ('CFD', r'FORMACAO DE DOCENTES'), ('CLP', r'LINGUA PORTUGUESA'), ('CLR', r'LINGUA RUSSA'), ('CLI', r'LINGUA INGLESA')]
ARRANQUE = {('CSCD', '2026/2027'), ('CEAO', '2026/2027'), ('CEMC', '2026/2027'), ('COAMP', '2026/2027')}
ANO_ATUAL = '2026/2027'
com_pauta = {(t['sigla'], t['edicao'], t['anoLetivo']) for t in saida}
sem_pauta = {}
for q in acad:
    for a_ in q.get('anos', []):
        if a_['papel'] != 'estudante': continue
        nome_curso = a_.get('curso') or ''
        m = re.match(r'^(?:\d+\.º\s+Turno\s+do\s+)?(\d+)\.º\s+(.*)$', nome_curso)
        sg = next((x for x, rx in TODOS if m and re.search(rx, sem(m.group(2)))), None)
        if not sg or (sg, a_['anoLetivo']) in ARRANQUE: continue
        ed = int(m.group(1))
        if (sg, ed, a_['anoLetivo']) in com_pauta: continue
        k = (sg, ed, a_['anoLetivo'], nome_curso)
        t = sem_pauta.setdefault(k, {'sigla': sg, 'edicao': ed, 'anoLetivo': a_['anoLetivo'], 'curso': nome_curso, 'nome': nome_curso,
                                     'semPauta': True, 'emCurso': a_['anoLetivo'] >= ANO_ATUAL, 'ficheiro': 'relação nominal / lista de finalistas',
                                     'cursoNome': re.sub(r'^(?:\d+\.º\s+Turno\s+do\s+)?\d+\.º\s+', '', nome_curso), 'ucs': [], 'estudantes': []})
        num = q.get('nip') or q.get('numeroAgente') or ''
        if not any(e['nome'] == q['nome'] for e in t['estudantes']):
            t['estudantes'].append({'nip': num, 'nome': q['nome'], 'posto': q.get('posto') or q.get('postoExterno') or '', 'ramo': q.get('ramo') or '', 'notas': {}, 'final': None, 'mencao': ''})
saida += sorted(sem_pauta.values(), key=lambda t: (t['anoLetivo'], t['sigla'], t['edicao']))
# nas turmas com pauta, quem está na lista do curso mas não na pauta: fica matriculado, sem notas (não entra na pauta)
for t in saida:
    if t.get('semPauta'): continue
    ja = {e['nip'] for e in t['estudantes'] if e['nip']} | {tok(e['nome']).__repr__() for e in t['estudantes']}
    outros = []
    for q in acad:
        for a_ in q.get('anos', []):
            if a_['papel'] != 'estudante' or a_['anoLetivo'] != t['anoLetivo']: continue
            m = re.match(r'^(\d+)\.º\s+(.*)$', a_.get('curso') or '')
            sg = next((x for x, rx in TODOS if m and re.search(rx, sem(m.group(2)))), None)
            if sg != t['sigla'] or int(m.group(1)) != t['edicao']: continue
            num = q.get('nip') or q.get('numeroAgente') or ''
            if (num and num in ja) or tok(q['nome']).__repr__() in ja or any(len(tok(q['nome']) & tok(e['nome'])) >= 3 or __import__('difflib').SequenceMatcher(None, sem(q['nome']), sem(e['nome'])).ratio() >= 0.88 for e in t['estudantes']): continue
            if not any(o['nome'] == q['nome'] for o in outros): outros.append({'nip': num, 'nome': q['nome'], 'posto': q.get('posto') or '', 'ramo': q.get('ramo') or ''})
    if outros:
        t['outrosEstudantes'] = outros
        avisos.append(f"{t['edicao']}.º {t['sigla']} ({t['anoLetivo']}): {len(outros)} discente(s) da lista do curso não estão na pauta — ficam matriculados, sem notas.")

# ---------- os docentes de cada ano (as listas do corpo docente): a disciplina de cada um ----------
docentes_ano = {}
for q in acad:
    for a_ in q.get('anos', []):
        if a_['papel'] != 'docente' or not a_.get('curso') or a_['anoLetivo'] in (ANO_ATUAL,): continue
        cad = docentes_ano.setdefault(a_['anoLetivo'], {}).setdefault(a_['curso'], {'nome': a_['curso'], 'docentes': []})
        if not any(d['nome'] == q['nome'] for d in cad['docentes']):
            cad['docentes'].append({'nip': q.get('nip') or '', 'nome': q['nome'], 'posto': q.get('posto') or '', 'tipo': a_.get('tipoDocente') or 'efectivo'})
SAIDA_DOC = re.sub(r'(\.json)?$', '', SAIDA).replace('gestao-pautas', 'gestao-docentes') + '.json'
if 'gestao-docentes' not in SAIDA_DOC: SAIDA_DOC = SAIDA_DOC[:-5] + '-docentes.json'
json.dump({'tipo': 'docentes-dos-anos', 'anos': [{'anoLetivo': k, 'cadeiras': list(v.values())} for k, v in sorted(docentes_ano.items())]}, open(SAIDA_DOC, 'w'), ensure_ascii=False)
print('docentes por ano:', {k: sum(len(c['docentes']) for c in v.values()) for k, v in docentes_ano.items()}, '→', SAIDA_DOC)
json.dump({'tipo': 'arquivo-administracao-escolar', 'geradoEm': '2026-11-27', 'turmas': saida, 'avisos': sorted(set(avisos))}, open(SAIDA, 'w'), ensure_ascii=False)
for t in saida:
    if t.get('semPauta'): print(f"{t['anoLetivo']} {t['curso'][:70]}: {len(t['estudantes'])} discentes (sem pauta)"); continue
    print(f"{t['anoLetivo']} {t['edicao']}.º {t['sigla']}: {len(t['estudantes'])} discentes ({sum(1 for e in t['estudantes'] if e['nip'])} com NIP), {len(t['ucs'])} cadeiras: " + ', '.join(f"{u['codigo']}={u['nome'][:22]}" for u in t['ucs'][:6]) + '…')
