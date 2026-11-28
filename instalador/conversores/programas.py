"""
Os programas das unidades curriculares, tirados dos planos de curso (Word) da Direcção de Ensino: para cada UC o
objectivo geral, os objectivos específicos e o plano das sessões (OE, sessão, objectivo de aprendizagem, tempos
escolares, método de ensino, observações). Lê o .docx directamente (sem bibliotecas).
Uso: python programas.py <pasta dos planos> <saida.json>
  ex.: python programas.py "docs/PLANOS  E AGENDAS DE CURSOS 2026-2027" programas-2026-2027.json
"""
import sys, os, re, json, zipfile, glob, unicodedata

PASTA, SAIDA = sys.argv[1:3]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
sem = lambda t: ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').lower()
# o curso de cada plano (pelo nome da pasta) e o ano lectivo (pelo nome da pasta-mãe)
CURSOS = [('cscd', r'cscd'), ('cemc', r'cemc'), ('ceao', r'ceao'), ('coamp', r'coamp')]


def texto(el):
    partes = []
    for x in el.iter():
        if x.tag == W + 't' and x.text: partes.append(x.text)
        elif x.tag in (W + 'tab',): partes.append(' ')
        elif x.tag in (W + 'br', W + 'cr'): partes.append('\n')
        elif x.tag == W + 'p' and partes: partes.append('\n')
    return re.sub(r'\n\s*\n+', '\n', re.sub(r'[ \t]+', ' ', ''.join(partes))).strip()


def blocos(docx):
    """Os parágrafos e as tabelas do corpo, pela ordem do documento."""
    import xml.etree.ElementTree as ET
    corpo = ET.fromstring(zipfile.ZipFile(docx).read('word/document.xml')).find(W + 'body')
    for el in corpo:
        if el.tag == W + 'p':
            t = texto(el)
            if t: yield ('p', t)
        elif el.tag == W + 'tbl':
            linhas = []
            for tr in el.iter(W + 'tr'):
                linhas.append([texto(tc) for tc in tr.findall(W + 'tc')])
            yield ('t', linhas)


TITULO = re.compile(r'^[a-z]\.\s*(Objectivos Gerais e Espec[ií]ficos|Conte[uú]dos Program[aá]ticos) da Unidade Curricular\s+(.+?)\s*\d*$', re.I)


def nova(ucs, nome):
    return ucs.setdefault(sem(nome), {'nome': nome, 'sigla': '', 'carga': '', 'objectivoGeral': '', 'objectivosEspecificos': [], 'sessoes': []})


def tabela_por_temas(ucs, b, antes):
    # CEAO: «Unidade Curricular | Tema | Aula | Tempo escolar | Método de ensino», a UC e o tema só na 1.ª linha
    u = None
    tema = ''
    for linha in b[1:]:
        c = [x.strip().replace('\n', ' ') for x in linha] + [''] * 6
        if c[0]:
            u = nova(ucs, c[0])
            if antes and not u['objectivoGeral']:
                u['objectivoGeral'] = next((x for x in antes if 'objectivo' in sem(x)), antes[0])
                if any(sem(x).startswith('como resultado') for x in antes):
                    i = next(k for k, x in enumerate(antes) if sem(x).startswith('como resultado'))
                    u['objectivosEspecificos'] = [x for x in antes[i + 1:]]
        if not u: continue
        if c[1]: tema = c[1]
        if c[2]: u['sessoes'].append({'tema': tema, 'sessao': str(len(u['sessoes']) + 1), 'objectivo': c[2], 'tempos': c[3], 'metodo': c[4], 'observacoes': ''})


def tabela_por_materias(ucs, b, u=None):
    # COAMP: «UC | DETALHES DE MATÉRIAS | TE | Ucréd | Professor»; a UC abre com «1.PSICOLOGIA MILITAR» (às vezes noutra
    # coluna, com pontuação no fim) e as tabelas seguintes continuam sem cabeçalho. Devolve a última UC aberta.
    TIT = re.compile(r'^(?:\d+\s*\.\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ,\-–/]{3,}?)[.:;\s]*$')
    # sem número, só é título se vier com o método («Lição/Discussão dirigida») e tiver pelo menos duas palavras
    for linha in b:
        c = [x.strip() for x in linha] + [''] * 6
        if re.search(r'detalhes? de materias|creditos|horas lectivas', sem(' '.join(c))): continue
        if re.match(r'^\d+$', c[1]) and not any(re.search(r'[a-z]', x) for x in c[:4]): continue
        titulo = None
        for k in range(min(3, len(linha))):
            primeira = (c[k].split('\n') or [''])[0].strip()
            m = TIT.match(primeira)
            if m and not re.match(r'^\d', primeira) and (len(m.group(1).split()) < 2 or not re.search(r'li[cç][aã]o|discuss|confer|semin', sem(c[k]))): m = None
            if m and re.search(r'detalhe|creditos|horas lectivas|total', sem(m.group(1))): m = None
            if m: titulo = (k, m.group(1).strip(), [x.strip() for x in c[k].split('\n')[1:] if x.strip()]); break
        if titulo:
            k, nome, resto = titulo
            u = nova(ucs, nome.title())
            numeros = [x for x in c[k + 1:k + 4] if re.match(r'^\d+$', x)]
            u['metodo'] = ' '.join(resto).rstrip(':')
            u['carga'] = ' · '.join(x for x in [f'{numeros[0]} TE' if numeros else '', f'{numeros[1]} UCréd' if len(numeros) > 1 else ''] if x)
            continue
        # a numeração recomeça («1.ª …») numa tabela sem título: é outra UC que não se sabe qual — não se cola à anterior
        if u and re.match(r'^1\s*[ªa]\b|^1\s*[ªa]\s', c[1]) and len(u['sessoes']) >= 3: u = None; continue
        if u and c[1] and not re.match(r'^[IVX]+\s*[.\-]', c[1]):
            u['sessoes'].append({'tema': '', 'sessao': str(len(u['sessoes']) + 1), 'objectivo': c[1].replace('\n', ' '), 'tempos': c[2], 'metodo': u.get('metodo', ''), 'observacoes': ''})
    return u


def programas(docx):
    ucs = {}
    atual = None
    parte = None
    antes = []  # os parágrafos desde a última tabela (a descrição da UC no CEAO)
    materias = None  # a última UC das tabelas «detalhes de matérias» (as tabelas seguintes continuam-na)
    for tipo, b in blocos(docx):
        if tipo == 't' and b:
            cab = sem(' '.join(b[0]))
            if 'unidade curricular' in cab and 'tema' in cab and 'aula' in cab:
                tabela_por_temas(ucs, b, antes); antes = []; continue
            if 'detalhes de materias' in cab or materias is not None:
                materias = tabela_por_materias(ucs, b, materias); materias = materias if materias is not None else False; antes = []; continue
        if tipo == 'p': antes.append(b)
        else: antes = []
        if tipo == 'p':
            m = TITULO.match(b)
            if m:
                nome = m.group(2).strip()
                atual = nova(ucs, nome)
                parte = 'obj' if sem(m.group(1)).startswith('objectivos') else 'cont'
                continue
            if re.match(r'^\d+\.\s*Bloco\b|^SEC[ÇC][ÃA]O\b|^\d+\.\s*Trabalho de Investiga', b, re.I) and not TITULO.match(b):
                # um bloco ou secção novos fecham a UC (os títulos seguintes abrem outra)
                if re.match(r'^SEC[ÇC][ÃA]O\s+V\b', b, re.I): atual = None
            if not atual: continue
            s = re.match(r'^\d+\.\s*(.+?)\s*\(([A-Z0-9]{2,8})\)\s*$', b)
            if s and not atual['sigla']: atual['sigla'] = s.group(2); continue
            if b.startswith('Contacto:') and not atual['carga']: atual['carga'] = re.sub(r'\s*·\s*', ' · ', b); continue
            if parte == 'obj': juntar_objectivo(atual, b)
        else:
            if not atual: continue
            if parte == 'obj':
                for linha in b:
                    for celula in linha:
                        for t in celula.split('\n'): juntar_objectivo(atual, t.strip())
            else:
                for linha in b:
                    c = [x.strip() for x in linha]
                    if len(c) >= 4 and re.match(r'^[A-Z]{2,8}\s*\d{1,3}', c[1] or '') and not re.match(r'^sess', sem(c[1])):
                        atual['sessoes'].append({'tema': c[0], 'sessao': c[1], 'objectivo': c[2], 'tempos': c[3], 'metodo': c[4] if len(c) > 4 else '', 'observacoes': c[5] if len(c) > 5 else ''})
    return [{k: v for k, v in u.items() if k != 'metodo'} for u in ucs.values() if u['objectivoGeral'] or u['objectivosEspecificos'] or u['sessoes']]


def juntar_objectivo(u, t):
    if not t or re.match(r'^objectivo(s)? (geral|especificos)$', sem(t)) or t.startswith('Contacto:'): return
    if re.match(r'^\d+\s*\.\s*\d+', t): u['objectivosEspecificos'].append(t)
    elif not u['objectivosEspecificos'] and not re.match(r'^\d+\.\s', t): u['objectivoGeral'] = (u['objectivoGeral'] + ' ' + t).strip()


resultado = []
for docx in sorted(glob.glob(os.path.join(PASTA, '**', '*.docx'), recursive=True)):
    base = sem(os.path.basename(docx))
    if 'agenda' in base or os.path.basename(docx).startswith('~$'): continue
    pasta = sem(os.path.dirname(docx))
    curso = next((c for c, rx in CURSOS if re.search(rx, pasta) or re.search(rx, base)), None)
    if not curso: continue
    ano = re.search(r'(20\d\d)\s*[-/]\s*(20\d\d)', PASTA)
    ucs = programas(docx)
    resultado.append({'curso': curso, 'anoLetivo': f'{ano.group(1)}/{ano.group(2)}' if ano else '', 'ficheiro': os.path.relpath(docx, PASTA), 'ucs': ucs})
    print(f'{curso}: {len(ucs)} UC; {sum(len(u["sessoes"]) for u in ucs)} sessões; sem sessões: {[u["nome"] for u in ucs if not u["sessoes"]][:6]}')
json.dump({'tipo': 'programas', 'cursos': resultado}, open(SAIDA, 'w'), ensure_ascii=False, indent=1)
