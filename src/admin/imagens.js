/*
  Tamanhos recomendados das imagens, conforme o espaço onde aparecem no site,
  e verificação da imagem escolhida (pequena, ao alto num espaço deitado, ou pesada).
*/

export const TAMANHOS = {
  capa: { largura: 1600, altura: 900, forma: 'horizontal (16:9)', onde: 'capa de notícias, eventos e artigos' },
  texto: { largura: 1200, altura: 800, forma: 'horizontal ou ao alto', onde: 'imagens dentro do texto' },
  poster: { largura: 1280, altura: 720, forma: 'horizontal (16:9)', onde: 'capa do vídeo' },
  curso: { largura: 1200, altura: 800, forma: 'horizontal (3:2)', onde: 'imagem do curso' },
  pessoa: { largura: 600, altura: 600, forma: 'quadrada, com o rosto ao centro', onde: 'fotografia de pessoa' },
  fundo: { largura: 1920, altura: 1080, forma: 'horizontal (16:9)', onde: 'imagem de fundo' },
  sede: { largura: 1920, altura: 800, forma: 'larga e baixa', onde: 'fotografia da sede' },
  seccao: { largura: 1200, altura: 900, forma: 'horizontal (4:3)', onde: 'imagem de secção' },
  bannerLargo: { largura: 1600, altura: 300, forma: 'larga e baixa', onde: 'banner' },
}

const LIMITE_MB = 2

export const dicaTamanho = (r) => `Recomendado: ${r.largura} × ${r.altura} px, ${r.forma} · JPG ou WebP até ${LIMITE_MB} MB.`

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
  const medida = `${largura} × ${altura} px`

  if (largura < r.largura * 0.6 || altura < r.altura * 0.6) {
    avisos.push(`A imagem é pequena (${medida}); o recomendado é ${r.largura} × ${r.altura} px. No site pode aparecer desfocada.`)
  }
  const esperada = orientacao(r.largura, r.altura)
  const recebida = orientacao(largura, altura)
  if (esperada === 'horizontal' && recebida === 'vertical') {
    avisos.push(`A imagem está ao alto (${medida}), mas este espaço é horizontal: vai aparecer inteira, com margens desfocadas dos lados. Prefira uma fotografia horizontal.`)
  } else if (esperada === 'quadrada' && recebida !== 'quadrada') {
    avisos.push(`A imagem não é quadrada (${medida}): será recortada. Prefira uma fotografia quadrada, com o rosto ao centro.`)
  }
  if (bytes > LIMITE_MB * 1.5 * 1048576) {
    avisos.push(`O ficheiro tem ${mb(bytes)} MB: o site vai demorar a abrir. Reduza para menos de ${LIMITE_MB} MB (ex.: exportar como JPG com qualidade 80%).`)
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
