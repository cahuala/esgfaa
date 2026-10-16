import { t as tx } from '../i18n/linguas'
/*
  Tamanhos recomendados das imagens, conforme o espaço onde aparecem no site,
  e verificação da imagem escolhida (pequena, ao alto num espaço deitado, ou pesada).
*/

export const TAMANHOS = {
  capa: { largura: 1600, altura: 900, forma: tx('horizontal (16:9)'), onde: tx('capa de notícias, eventos e artigos') },
  texto: { largura: 1200, altura: 800, forma: tx('horizontal ou ao alto'), onde: tx('imagens dentro do texto') },
  poster: { largura: 1280, altura: 720, forma: tx('horizontal (16:9)'), onde: tx('capa do vídeo') },
  curso: { largura: 1200, altura: 800, forma: tx('horizontal (3:2)'), onde: tx('imagem do curso') },
  pessoa: { largura: 600, altura: 600, forma: tx('quadrada, com o rosto ao centro'), onde: tx('fotografia de pessoa') },
  fundo: { largura: 1920, altura: 1080, forma: tx('horizontal (16:9)'), onde: tx('imagem de fundo') },
  sede: { largura: 1920, altura: 800, forma: tx('larga e baixa'), onde: tx('fotografia da sede') },
  seccao: { largura: 1200, altura: 900, forma: tx('horizontal (4:3)'), onde: tx('imagem de secção') },
  livro: { largura: 600, altura: 900, forma: tx('vertical (2:3)'), onde: tx('capa de livro') },
  bannerLargo: { largura: 1600, altura: 300, forma: tx('larga e baixa'), onde: 'banner' },
}

const LIMITE_MB = 2

export const dicaTamanho = (r) => tx('Recomendado: {0} × {1} px, {2} · JPG ou WebP até {3} MB.', { 0: r.largura, 1: r.altura, 2: r.forma, 3: LIMITE_MB })

const orientacao = (l, a) => (l > a * 1.15 ? 'horizontal' : a > l * 1.15 ? 'vertical' : 'quadrada')
const mb = (bytes) => (bytes / 1048576).toFixed(1).replace('.', ',')

/*
  Devolve uma lista de avisos (vazia se a imagem estiver bem).
  info: { largura, altura, bytes }; r: um dos TAMANHOS.
*/
export function avaliarImagem(info, r) {
  const avisos = []
  if (!info || !r) return avisos
  const { largura, altura, bytes } = info
  const medida = tx('{0} × {1} px', { 0: largura, 1: altura })

  if (largura < r.largura * 0.6 || altura < r.altura * 0.6) {
    avisos.push(`A imagem é pequena (${medida}); o recomendado é ${r.largura} × ${r.altura} px. No site pode aparecer desfocada.`)
  }
  const esperada = orientacao(r.largura, r.altura)
  const recebida = orientacao(largura, altura)
  if (esperada === 'horizontal' && recebida === 'vertical') {
    avisos.push(tx('A imagem está ao alto ({0}), mas este espaço é horizontal: vai aparecer inteira, com margens desfocadas dos lados. Prefira uma fotografia horizontal.', { 0: medida }))
  } else if (esperada === 'quadrada' && recebida !== 'quadrada') {
    avisos.push(tx('A imagem não é quadrada ({0}): será recortada. Prefira uma fotografia quadrada, com o rosto ao centro.', { 0: medida }))
  }
  if (bytes > LIMITE_MB * 1.5 * 1048576) {
    avisos.push(tx('O ficheiro tem {0} MB: o site vai demorar a abrir. Reduza para menos de {1} MB (ex.: exportar como JPG com qualidade 80%).', { 0: mb(bytes), 1: LIMITE_MB }))
  }
  return avisos
}

// largura e altura reais de uma imagem escolhida no computador (null se não for imagem)
export async function medirImagem(ficheiro) {
  if (!ficheiro?.type?.startsWith('image/')) return null
  const url = URL.createObjectURL(ficheiro)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { largura: img.naturalWidth, altura: img.naturalHeight, bytes: ficheiro.size }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
