"""
Os certificados assinados do arquivo (PDF, uma página por discente): o NIP, a média final e cada disciplina com a
nota. Servem para dar a cada coluna da pauta final o nome oficial da cadeira (cruzando as notas de todos os
discentes: a coluna «EST» do 30.º CSCD é «Operações T. Operações de Estabilização») e para conferir as médias e as
notas com a pauta. Precisa do pdftotext (Poppler).
Uso: python certificados.py <pasta docs> <arquivo.json> <saida.json>
"""
import sys, os, re, json, glob, subprocess, unicodedata, collections

DOCS, ARQ, SAIDA = sys.argv[1:4]
arq = json.load(open(ARQ))
sem = lambda t: ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').upper()


def paginas(pdf):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    for i in range(1, n + 1):
        yield subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout


def ler(texto):
    corrido = re.sub(r'\s+', ' ', texto)
    nip = re.search(r'NIP\s*[-–(]?\s*(I?\d{5,10})', corrido, re.I)
    media = re.search(r'M[ée]dia Final de\s*(\d{1,2}[.,]\d{1,2})', corrido, re.I)
    curso = re.search(r'(\d+)\s*[.º°]*\s*Curso\s+(.+?)\s*,?\s*no per[ií]odo', corrido, re.I)
    MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
    datas = re.findall(r'(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(20\d\d)', re.split(r'Quartel', corrido)[0])
    iso = [f'{a}-{MESES.index(sem(m)) + 1:02d}-{int(d):02d}' for d, m, a in datas if sem(m) in MESES]
    notas = []
    em_tabela = False
    for linha in texto.split('\n'):
        if re.match(r'\s*Disciplina\s+valores', linha, re.I): em_tabela = True; continue
        if not em_tabela: continue
        if re.search(r'Quartel em', linha, re.I): break
        for nome, v in re.findall(r'([A-Za-zÀ-ú][^\d]{2,}?)\s{2,}(\d{1,2}[.,]\d{1,2})', linha):
            notas.append((re.sub(r'\s+', ' ', nome).strip(' .'), float(v.replace(',', '.'))))
    return {'nip': nip.group(1) if nip else '', 'media': float(media.group(1).replace(',', '.')) if media else None,
            'edicao': int(curso.group(1)) if curso else None, 'periodo': iso[:2] if len(iso) >= 2 else None, 'curso': curso.group(2) if curso else '', 'notas': notas}


SIGLAS = [('CSCD', r'SUPERIOR DE COMANDO'), ('CEAO', r'ESTRATEGIA E ARTE'), ('COAMP', r'ASSEGURAMENTO'), ('CEMC', r'ESTADO.MAIOR CONJUNTO')]
resultado = {}
for pdf in sorted(glob.glob(os.path.join(DOCS, 'ARQUIVO 20*', '**', '*.pdf'), recursive=True)):
    if 'CERTIFICADO' not in sem(os.path.basename(pdf)): continue
    certs = [c for c in (ler(p) for p in paginas(pdf)) if c['nip'] and c['notas']]
    if not certs: continue
    sig = next((s for s, rx in SIGLAS if re.search(rx, sem(certs[0]['curso']))), None)
    ed = certs[0]['edicao']
    t = next((x for x in arq['turmas'] if x['sigla'] == sig and x['edicao'] == ed and x.get('pauta')), None)
    if not t: continue
    p = t['pauta']
    # os NIP da Polícia vêm com zeros à esquerda nuns ficheiros e sem eles noutros
    z = lambda n: str(n or '').lstrip('0')
    por_nip = {z(e['nip']): e for e in p['estudantes'] if e['nip']}
    # cada nome do certificado: a coluna da pauta em que as notas de todos os discentes coincidem
    # cada coluna da pauta: o nome que a maioria dos certificados lhe dá (a nota do certificado igual à da coluna)
    votos = collections.defaultdict(collections.Counter)   # nome → coluna → discentes
    casados = [c for c in certs if z(c['nip']) in por_nip]
    for c in casados:
        e = por_nip[z(c['nip'])]
        for nome, v in c['notas']:
            for col, n in e['notas'].items():
                if n is not None and abs(n - v) < 0.005: votos[nome][col] += 1
    # o nome de cada coluna: o que mais vezes cai nela (e cai nela em pelo menos 60 % dos certificados casados)
    por_coluna = collections.defaultdict(collections.Counter)
    for nome, cont in votos.items():
        col, n = cont.most_common(1)[0]
        por_coluna[col][nome] = n
    nomes = {col: cont.most_common(1)[0][0] for col, cont in por_coluna.items() if cont.most_common(1)[0][1] >= 0.6 * len(casados)}
    medias_dif = [(c['nip'], c['media'], por_nip[z(c['nip'])]['final']) for c in casados if c['media'] is not None and por_nip[z(c['nip'])]['final'] is not None and abs(c['media'] - por_nip[z(c['nip'])]['final']) > 0.005]
    sem_pauta = [c['nip'] for c in certs if z(c['nip']) not in por_nip]
    periodos = collections.Counter(tuple(c['periodo']) for c in certs if c.get('periodo'))
    resultado[f'{ed}.º {sig}'] = {'ficheiro': os.path.relpath(pdf, DOCS), 'certificados': len(certs), 'nomes': nomes, 'anoLetivo': t['anoLetivo'], 'periodo': list(periodos.most_common(1)[0][0]) if periodos else None,
                                  'mediasDiferentes': medias_dif, 'nipsForaDaPauta': sem_pauta,
                                  'nomesSemColuna': [n for n in votos if n not in nomes.values()] + [n for c in certs[:1] for n, _ in c['notas'] if n not in votos]}
    print(f'{ed}.º {sig}: {len(certs)} certificados; {len(nomes)} cadeiras com o nome oficial; médias diferentes da pauta: {len(medias_dif)} {medias_dif[:3]}; NIP fora da pauta: {sem_pauta[:5]}')
json.dump(resultado, open(SAIDA, 'w'), ensure_ascii=False, indent=1)
