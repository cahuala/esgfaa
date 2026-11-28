"""
O pessoal efectivo da ESG (as relações nominais da Repartição de Pessoal e Quadros, em Excel) para a carga do Sistema de
Pessoal (carregar/relacoes.json, secções «militares», «civis» e «cargos»):
  - RELAÇÃO NOMINAL DE TODOS MILITARES DA ESG.xls (oficiais; sargentos e praças): NIP, posto, ramo, nome, cargo, ASEC,
    FPS, nascimento, incorporação, habilitações;
  - RELAÇÃO NOMINAL DE MILITARES AGREGADOS DA ESG.xls (só a folha dos oficiais: a dos sargentos é a mesma da lista geral);
  - RELAÇÃO NOMINAL DO PESSOAL CIVIL COM CARREIRAS E CATEGORIAS.xls: n.º de agente, nome, carreira, categoria, função,
    nascimento, admissão, vínculo.
O cargo escrito na relação liga-se ao cargo da orgânica (organica.json) pelas palavras (sem «da ESG», com «2.º» = «2º»…):
só quando há um, e um só, cargo com quase todas as palavras iguais; os outros ficam sem cargo e vão para o relatório
(CONFERIR), para a Repartição os pôr à mão. A carga do Pessoal só acrescenta: quem já tem ficha fica como está (e
recebe o cargo só se o cargo estiver vazio e a pessoa não tiver outro — secção «cargos»).
Os dados são reais: este script fica no git, o que ele escreve não (instalador/pendrive está no .gitignore).
Uso: python efectivos.py <pasta com as relações> <organica.json> <relacoes.json a completar> [<relatorio.txt>]
"""
import sys, os, re, json, unicodedata, datetime
import xlrd

PASTA, ORGANICA, RELACOES = sys.argv[1:4]
RELATORIO = sys.argv[4] if len(sys.argv) > 4 else None
sem = lambda t: ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').lower()
relatorio = []

# ---------- os cargos da orgânica ----------
organica = json.load(open(ORGANICA))
VAZIAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'para', 'na', 'no', 'em'}
# as siglas e abreviaturas da relação nominal, por extenso como na orgânica
SIGLAS = {'bcs': 'batalhao comando servico', 'cia': 'companhia', 'ptao': 'pelotao', 'pel': 'pelotao', 'sec': 'seccao', 'secc': 'seccao', 'svc': 'servicos gerais',
          'svg': 'servicos gerais', 'depto': 'departamento', 'dpto': 'departamento', 'dep': 'departamento', 'depart': 'departamento', 'deparatmento': 'departamento',
          'sargto': 'sargento', 'sgto': 'sargento', 'sarg': 'sargento', 'armatec': 'armamento tecnica', 'res': 'regime especial seguranca', 'prof': 'professor',
          'rep': 'reparticao', 'dir': 'direccao', 'cmdt': 'comandante', 'cmdte': 'comandante', 'adm': 'administracao', 'op': 'operacoes', 'ops': 'operacoes',
          'resp': 'resposta', 'sacretaria': 'secretaria', 'telecom': 'telecomunicacoes', 'manut': 'manutencao', 'reabast': 'reabastecimento', 'equip': 'equipamento',
          'inst': 'instalacao', 'dai': 'direccao assuntos academicos', 'cee': 'centro estudos estrategicos', 'ceem': 'centro estudos estrategicos militares',
          'fan': 'forca aerea nacional', 'pjm': 'policia judiciaria militar', 'rap': 'reparticao', 'oficial': 'oficial'}
VAZIAS |= {'esg'}
def raiz(w):
    # a raiz da palavra (plurais e femininos iguais: psicologa = psicologo, combustiveis = combustivel); os números presos à palavra ficam
    if re.match(r'^\d', w): return w
    return w[:6] if len(w) > 6 else w.rstrip('as') or w
def palavras(t):
    t = sem(t)
    t = re.sub(r'\b(da\s+)?escola superior de guerra\b', ' ', t)
    t = re.sub(r'(\d+)\s*\.?\s*[ºª°]?\s*\.?\s*', r'\1', t)       # 2.º / 2º / 3.ª / 2ª. → 2 (preso à palavra seguinte)
    t = re.sub(r'\b(\d+)\s+(?=[a-z])', r'\1', t)
    ws = []
    for w in re.split(r'[^a-z0-9]+', t):
        if not w or w in VAZIAS: continue
        ws.extend(SIGLAS.get(w, w).split())
    return [raiz(w) for w in ws if w not in VAZIAS]
# a função (o que vem antes de «da/do/…»: «Chefe», «Técnico Superior de Estomatologia», «Oficial de Planeamento»)
funcao = lambda t: re.split(r'\s(?:da|do|das|dos|na|no)\s|/', ' ' + re.sub(r'\(.*?\)', ' ', str(t)) + ' ', maxsplit=1)[0]
CARGOS = [(l['unidade'], l['cargo'], set(palavras(l['cargo'])), set(palavras(funcao(l['cargo'])))) for l in organica if l.get('cargo')]
casa = lambda w, x: w == x or (len(w) >= 3 and not w[0].isdigit() and (x.startswith(w) or w.startswith(x)))

def cargo_da_orgânica(texto):
    p = set(palavras(texto))
    pf = set(palavras(funcao(texto)))
    if not p: return None
    notas = []
    for u, c, pc, fc in CARGOS:
        # uma só palavra («Comandante da ESG»): só o cargo que é exactamente essa palavra
        if len(p) == 1 and pc != p: continue
        # a função do cargo tem de estar toda na relação (o cargo não acrescenta «Superior», «Sanitário», «Planeamento»…)
        if not all(any(casa(w, x) for w in pf) for x in fc): continue
        # cada palavra da relação: igual a uma do cargo, ou o começo dela (abreviatura: «estomat» de «estomatologia»)
        casadas = {w for w in p if w in pc or any(x.startswith(w) and len(w) >= 3 and not w[0].isdigit() for x in pc)}
        dentro = len(casadas) / len(p)
        if dentro < (0.85 if len(p) >= 6 else 1): continue
        sobra = len([x for x in pc if not any(x == w or (x.startswith(w) and not w[0].isdigit()) for w in p)])
        notas.append((-dentro, sobra, u, c))
    notas.sort()
    if not notas: return None
    melhores = [n for n in notas if n[:2] == notas[0][:2]]
    # dois cargos diferentes igualmente bons: fica para conferir (os iguais na mesma unidade são o mesmo cargo com vários lugares)
    if len({(u, c) for _, _, u, c in melhores}) > 1: return None
    return {'unidade': notas[0][2], 'cargo': notas[0][3]}

# ---------- leitura ----------
def celula(sh, r, c):
    if c >= sh.ncols: return ''
    x = sh.cell(r, c)
    if x.ctype == xlrd.XL_CELL_DATE:
        try: return xlrd.xldate_as_datetime(x.value, sh.book.datemode).strftime('%d/%m/%Y')
        except Exception: return ''
    v = x.value
    if isinstance(v, float) and v.is_integer(): v = int(v)
    return str(v).strip()

def linhas(f, folha=None):
    b = xlrd.open_workbook(os.path.join(PASTA, f))
    for i, sh in enumerate(b.sheets()):
        if folha is not None and i != folha: continue
        cab = next((r for r in range(min(sh.nrows, 25)) if any(sem(celula(sh, r, c)) in ('nome completo', 'nome') for c in range(sh.ncols))), None)
        if cab is None: continue
        nomes = [sem(celula(sh, cab, c)) for c in range(sh.ncols)]
        for r in range(cab + 1, sh.nrows):
            d = {nomes[c]: celula(sh, r, c) for c in range(sh.ncols) if nomes[c]}
            if any(d.values()): yield sh.name, r + 1, d

# ---------- postos, habilitações ----------
POSTOS = {'tte-general': 'Tenente-General', 'tenente-general': 'Tenente-General', 'tte general': 'Tenente-General', 'brigadeiro': 'Brigadeiro',
          'coronel': 'Coronel', 'tte-coronel': 'Tenente-Coronel', 'tenente-coronel': 'Tenente-Coronel', 'major': 'Major', 'capitao': 'Capitão',
          'tenente': 'Tenente', 'sub-tenente': 'Subtenente', 'subtenente': 'Subtenente', 'aspirante': 'Aspirante',
          'sargento-mor': 'Sargento-Maior', 'sargento-maior': 'Sargento-Maior', 'sargento-chefe': 'Sargento-Chefe', 'sgto-chefe': 'Sargento-Chefe',
          'sgto-ajudante': 'Sargento-Ajudante', 'sargento-ajudante': 'Sargento-Ajudante', '1o sargento': '1.º Sargento', '2o sargento': '2.º Sargento',
          'sub-sargento': 'Subsargento', 'subsargento': 'Subsargento', '1o cabo': '1.º Cabo', '2o cabo': '2.º Cabo', 'soldado': 'Soldado',
          'general': 'General', 'almirante': 'Almirante', 'vice-almirante': 'Vice-Almirante', 'contra-almirante': 'Contra-Almirante',
          'capitao-de-mar-e-guerra': 'Capitão-de-Mar-e-Guerra', 'capitao-de-fragata': 'Capitão-de-Fragata', 'capitao-tenente': 'Capitão-Tenente',
          'primeiro-tenente': 'Primeiro-Tenente', 'segundo-tenente': 'Segundo-Tenente', 'guarda-marinha': 'Guarda-Marinha'}
def posto(t):
    k = re.sub(r'\s+', ' ', sem(t).replace('º', 'o').replace('°', 'o').replace('.', '')).strip()
    k = re.sub(r'^(\d)\s*o\b', r'\1o', k)
    return POSTOS.get(k) or POSTOS.get(k.replace(' ', '-')) or ''
def habilitacao(t):
    s = sem(t)
    for rx, h in [(r'dout', 'Doutoramento'), (r'mestr', 'Mestrado'), (r'pos.?grad', 'Pós-graduação'), (r'licenc', 'Licenciatura'), (r'bachar', 'Bacharelato'),
                  (r'12|13|medio|tecnico', 'Técnico médio'), (r'\b(9|10|11)\b|base|basic', 'Ensino de base'), (r'\b[6-8]\b|2.?\s*ciclo', '2.º Ciclo'), (r'\b[1-4]\b|primar|1.?\s*ciclo', 'Primária')]:
        if re.search(rx, s): return h
    return ''
nome_proprio = lambda n: ' '.join(w if w in VAZIAS else w[:1].upper() + w[1:] for w in re.sub(r'\s+', ' ', str(n).strip().lower()).split(' '))
ramo = lambda t: {'exe': 'EXE', 'exercito': 'EXE', 'fan': 'FAN', 'faa': 'FAN', 'mga': 'MGA', 'marinha': 'MGA'}.get(sem(t).strip(), '')
fps = lambda t: {'qp': 'QP', 'smc': 'SMC', 'smo': 'SMO', 'smr': 'SMR'}.get(sem(t).strip().replace('.', ''), '')

militares, civis, cargos, conferir = [], [], [], []
vistos = set()

def militar(origem, d, agregado=False):
    nip = re.sub(r'\D', '', d.get('nip', ''))
    nome = d.get('nome completo', '')
    if not nip or not nome: return
    if nip in vistos: return
    vistos.add(nip)
    p = posto(d.get('posto', ''))
    linha = {'nip': nip, 'nome': nome_proprio(nome), 'tipo': 'militar', 'vinculo': 'Efectivo'}
    if p: linha['posto'] = p
    else: conferir.append(f'{origem}: {nome} — posto «{d.get("posto", "")}» sem correspondência (entra sem posto: corrigir na ficha)')
    if ramo(d.get('ramo', '')): linha['ramo'] = ramo(d['ramo'])
    if fps(d.get('fps', '')): linha['fps'] = fps(d['fps'])
    for k, campo in [('d/nasc', 'dataNascimento'), ('d/incorp', 'dataIngresso')]:
        if re.match(r'^\d{2}/\d{2}/\d{4}$', d.get(k, '')): linha[campo] = d[k]
    h = habilitacao(d.get('hab lit', '') or d.get('hab.lit.', ''))
    if h: linha['habilitacao'] = h
    if d.get('asec'): linha['especialidade'] = d['asec']
    texto = d.get('cargo', '')
    if agregado:
        linha['observacoes'] = f'Militar agregado da ESG{": " + d["situacao"] if d.get("situacao") else ""}'
    if texto and not agregado:
        linha['funcaoActual'] = texto[:120]
        c = cargo_da_orgânica(texto)
        if c:
            linha.update(c)
            cargos.append({'nip': nip, 'nome': linha['nome'], 'cargo': c['cargo'], 'unidade': c['unidade'], 'fonte': 'Relação nominal de todos os militares da ESG (2026)'})
        else: conferir.append(f'{origem}: {linha["nome"]} ({nip}) — cargo «{texto}» sem correspondência única na orgânica (fica a função; o cargo põe-se à mão)')
    militares.append(linha)

for folha, r, d in linhas('RELAÇÃO NOMINAL DE TODOS MILITARES DA ESG.xls'):
    d = {k.replace('.', '').strip(): v for k, v in d.items()}
    d['hab lit'] = d.get('hablit', d.get('hab lit', ''))
    militar(f'Militares, {folha}, linha {r}', d)
n_lista = len(militares)
for folha, r, d in linhas('RELAÇÃO NOMINAL DE  MILITARES AGREGADOS DA ESG.xls', folha=0):
    d = {k.replace('.', '').strip(): v for k, v in d.items()}
    militar(f'Agregados, linha {r}', d, agregado=True)

# as carreiras e as classes do Sistema de Pessoal (do próprio código: api-pessoal/src/dominio/pessoal/civis.js)
import subprocess
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CIVIS = json.loads(subprocess.run(['node', '-e', "import('./src/dominio/pessoal/civis.js').then((c) => console.log(JSON.stringify(Object.fromEntries(Object.entries(c.CARREIRAS_CIVIS).map(([k, v]) => [k, { nome: v.nome, categorias: v.categorias }])))))"],
                                  cwd=os.path.join(RAIZ, 'api-pessoal'), capture_output=True, text=True, check=True).stdout)
chave = lambda t: re.sub(r'[.\s]+', ' ', sem(t)).strip()
MASC = [(r'\bt[eé]cnica\b', 'Técnico'), (r'\bm[eé]dia\b', 'Médio'), (r'\bmedio\b', 'Médio'), (r'\boper[aá]ria\b', 'Operário'), (r'\badministrativa\b', 'Administrativo'),
        (r'\bencarregada\b', 'Encarregado'), (r'\bqualificada\b', 'Qualificado'), (r'\bassistente estagiaria\b', 'Assistente Estagiário'), (r'\bprimeira\b', 'Primeiro'), (r'\bsegunda\b', 'Segundo'), (r'\bterceira\b', 'Terceiro')]
def masculino(t):
    t = str(t).replace('´', '').replace('`', '').strip()
    for rx, v in MASC: t = re.sub(rx, v, t, flags=re.I)
    t = re.sub(r'(\d)\s*[ºª°]\.?', r'\1.ª', t)          # 3ª. / 3ª → 3.ª (o espaço a seguir fica)
    t = re.sub(r'\bN\s*/\s*Qualificad\w*', 'Não Qualificado', t, flags=re.I)
    t = re.sub(r'\s*/\s*Enfermagem', ' de Enfermagem', t, flags=re.I)
    return re.sub(r'\s+', ' ', t).strip()
CARREIRA_DO_TEXTO = {'tecnico superior': 'tecnico_superior', 'tecnico medio': 'tecnico_medio', 'administrativo': 'administrativo', 'tecnico': 'tecnico',
                     'operario qualificado': 'operario_qualificado', 'operario nao qualificado': 'operario_nao_qualificado', 'docente universitario': 'docente',
                     'docente universitaria': 'docente', 'auxiliar': 'auxiliar_servicos_gerais', 'enfermagem': 'enfermagem', 'medico': 'medico'}
def carreira_e_classe(carreira, categoria):
    k = CARREIRA_DO_TEXTO.get(chave(masculino(carreira)))
    cat = masculino(categoria)
    if not cat: return k, None
    # a classe na carreira indicada ou, se não estiver lá, na carreira que a tem (a Enfermagem, o Diagnóstico…)
    for kk in ([k] if k else []) + list(CIVIS):
        achada = next((c for c in CIVIS[kk]['categorias'] if chave(c) == chave(cat)), None)
        if achada: return kk, achada
    return k, None

for folha, r, d in linhas('RELAÇÃO NOMINAL DO PESSOAL CIVIL COM CARREIRAS E CATEGORIAS.xls'):
    ag = re.sub(r'[^0-9A-Za-z]', '', d.get('no agente', '') or d.get('nº agente', ''))
    nome = d.get('nome completo', '')
    if not nome or len(nome) < 5 or chave(nome) == 'nome completo': continue
    linha = {'nome': nome_proprio(nome), 'tipo': 'civil', 'vinculo': 'Efectivo'}
    if ag: linha['numeroAgente'] = ag
    else:
        conferir.append(f'Civis, linha {r}: {linha["nome"]} — sem n.º de agente (não entra: o Importar precisa dele)'); continue
    if ag in vistos: continue
    vistos.add(ag)
    k, classe = carreira_e_classe(d.get('carreira', ''), d.get('categoria', ''))
    if k: linha['carreiraCivil'] = CIVIS[k]['nome']
    if classe: linha['categoriaCivil'] = classe
    elif d.get('categoria'):
        linha['observacoes'] = f'Classe na relação nominal: {d["categoria"]}'
        conferir.append(f'Civis, linha {r}: {linha["nome"]} — classe «{d["categoria"]}» ({d.get("carreira", "")}) sem correspondência: entra com a 1.ª classe da carreira; corrigir na ficha')
    v = sem(d.get('tipo de vinculo', ''))
    if 'defin' in v: linha['vinculoCivil'] = 'Nomeação definitiva'
    elif 'provis' in v: linha['vinculoCivil'] = 'Nomeação provisória'
    elif 'contrat' in v: linha['vinculoCivil'] = 'Contrato'
    if d.get('funcao'):
        linha['funcaoActual'] = d['funcao'][:120]
        c = cargo_da_orgânica(d['funcao'])
        if c: linha.update(c)
    civis.append(linha)

rel = json.load(open(RELACOES))
rel['militares'] = militares
# o ramo de cada militar da lista: corrige as fichas que ficaram com o ramo por confirmar (Exército por omissão)
rel['ramos'] = [{'nip': m['nip'], 'ramo': m['ramo']} for m in militares if m.get('ramo')]
rel['civis'] = civis
# quem assina (já lá estavam) primeiro, depois os cargos da relação nominal
antes = rel.get('cargos', [])
rel['cargos'] = antes + [c for c in cargos if c['nip'] not in {x['nip'] for x in antes}]
json.dump(rel, open(RELACOES, 'w'), ensure_ascii=False)
com_cargo = sum(1 for m in militares if m.get('cargo'))
resumo = [f'Militares: {len(militares)} ({n_lista} da lista de efectividade e {len(militares) - n_lista} agregados); {com_cargo} com o cargo da orgânica.',
          f'Civis: {len(civis)}; {sum(1 for c in civis if c.get("cargo"))} com o cargo da orgânica.',
          f'Para conferir: {len(conferir)} linha(s).']
print('\n'.join(resumo))
if RELATORIO: open(RELATORIO, 'w').write('\n'.join(resumo + ['', 'PARA CONFERIR'] + conferir) + '\n')
