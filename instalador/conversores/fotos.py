"""
As fotografias do pessoal (pastas da Repartição: «FOTOS COM NIP», «Fotos Vertice/…») para a carga do Sistema de Pessoal:
cada ficheiro com o NIP no nome («100943360.jpg», «NIP-100943360-COR-ELIAS ….JPG») sai reduzido (600 px, JPEG) como
<saida>/<NIP>.jpg. Sem NIP no nome («1SARGTO -DOMINGOS MUNGOLE.JPG»), reconhece-se pelo nome: só quando uma, e uma só,
pessoa da carga (relacoes.json) tem todas as palavras do nome (pelo menos duas). As pastas «_Originais» só se usam se não
houver outra fotografia da mesma pessoa; «_Substituidos» fica de fora; as que não se reconhecem («IMG_1185», «DSC06964»)
vão para a lista. A carga só põe a fotografia em quem ainda não tem.
Reduz com o «sips» do macOS. As fotografias são dados pessoais: ficam fora do git.
Uso: python fotos.py <pasta das fotografias> <pasta de saída> [<relacoes.json> [<lista das que ficaram de fora>]]
"""
import sys, os, re, json, subprocess, unicodedata

ORIGEM, SAIDA = sys.argv[1:3]
RELACOES = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(SAIDA, exist_ok=True)
IMAGEM = re.compile(r'\.(jpe?g|png|webp)$', re.I)

sem = lambda t: ''.join(c for c in unicodedata.normalize('NFD', str(t or '')) if unicodedata.category(c) != 'Mn').lower()
# as pessoas da carga (para reconhecer as fotografias que só têm o posto e o nome)
pessoas = []
if RELACOES:
    d = json.load(open(RELACOES))
    for x in d.get('militares', []) + d.get('academicos', {}).get('pessoas', []):
        if x.get('nip'): pessoas.append((str(x['nip']).lstrip('0'), set(re.findall(r'[a-z]+', sem(x['nome']))) - {'de', 'da', 'do', 'das', 'dos', 'e'}))
POSTOS = r'^(cap\.?\s*(de\s*)?(mar e guerra|corveta|fragata)|cmg|cap|capitao|ten|tenente|tte|subten|sub-tenente|cor|coronel|tcor|t\.?cor|maj|major|brig|gen|1\s*o?\s*sarg\w*|2\s*o?\s*sarg\w*|sarg\w*|sgt\w*|sub-?sarg\w*|1\s*o?\s*cabo|2\s*o?\s*cabo|cabo|sold\w*|asp\w*)\b[\s.;:_-]*'
def pelo_nome(base):
    t = sem(base).replace('º', 'o')
    t = re.sub(r'\d{3,}', ' ', t)
    t = re.sub(POSTOS, ' ', t.strip())
    ws = set(re.findall(r'[a-z]{2,}', t)) - {'de', 'da', 'do', 'das', 'dos', 'e', 'copia', 'img', 'dsc'}
    if len(ws) < 2: return None
    achados = {nip for nip, nome in pessoas if ws <= nome}
    return achados.pop() if len(achados) == 1 else None

escolhidas, sem_nip = {}, []
for raiz, _, ficheiros in os.walk(ORIGEM):
    if 'System Volume Information' in raiz or '$RECYCLE' in raiz or '_Substituidos' in raiz: continue
    for f in sorted(ficheiros):
        if not IMAGEM.search(f) or f.startswith('._'): continue
        base = os.path.splitext(f)[0]
        m = re.search(r'NIP\s*-?\s*(\d{6,10})', base, re.I) or re.fullmatch(r'\s*(\d{6,10})\s*(\(\d+\))?\s*', base)
        nip = m.group(1).lstrip('0') if m else pelo_nome(base)
        if not nip:
            sem_nip.append(os.path.join(raiz, f)); continue
        caminho = os.path.join(raiz, f)
        original = '_Originais' in raiz
        # a que não está em «_Originais» ganha; entre iguais, a mais recente
        atual = escolhidas.get(nip)
        if atual is None or (atual[1] and not original) or (atual[1] == original and os.path.getmtime(caminho) > os.path.getmtime(atual[0])):
            escolhidas[nip] = (caminho, original)

feitas = 0
for nip, (caminho, _) in sorted(escolhidas.items()):
    destino = os.path.join(SAIDA, f'{nip}.jpg')
    if os.path.exists(destino): feitas += 1; continue
    r = subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', '600', caminho, '--out', destino], capture_output=True, text=True)
    if r.returncode == 0: feitas += 1
    else: print(f'  não se reduziu: {caminho}')

print(f'{feitas} fotografia(s) (de {len(escolhidas)} pessoas, pelo NIP ou pelo nome); {len(sem_nip)} sem NIP nem nome reconhecível (ficam de fora).')
if len(sys.argv) > 4: open(sys.argv[4], 'w').write('\n'.join(sem_nip) + '\n')
if RELACOES:
    nips = {n for n, _ in pessoas}
    com = [n for n in escolhidas if n in nips]
    print(f'Destas, {len(com)} são de pessoas da carga do Pessoal (efectivos, docentes e discentes).')
