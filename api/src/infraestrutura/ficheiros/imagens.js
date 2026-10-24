import fs from 'node:fs'
import sharp from 'sharp'

/*
  Imagens leves para a web: uma fotografia tirada no telemóvel ou guardada em PNG tem 2 a 4 MB e demora
  segundos a aparecer. As imagens carregadas ficam com 2000 px no máximo e em WebP (com a transparência,
  se a tiverem), que tem o mesmo aspecto com uma fracção do peso. Os GIF não se tocam (podem ser animados).
*/
export const LADO_MAXIMO = 2000
// abaixo disto (e dentro do tamanho máximo), a imagem já é leve: fica como está
export const PESO_MINIMO = 300 * 1024
const REDUZIVEIS = new Set(['image/jpeg', 'image/png', 'image/webp'])

// { caminho, tipo, tamanho } -> o mesmo ficheiro, ou um .webp ao lado (o original apaga-se) se ficar mais leve
export async function otimizarImagem(f) {
  if (!REDUZIVEIS.has(f.tipo)) return f
  const info = await sharp(f.caminho, { failOn: 'none' }).metadata().catch(() => null)
  if (!info) return f
  const grande = Math.max(info.width ?? 0, info.height ?? 0) > LADO_MAXIMO
  if (!grande && f.tamanho < PESO_MINIMO) return f
  const destino = f.caminho.replace(/\.[a-z0-9]+$/i, '') + (f.tipo === 'image/webp' ? '.min.webp' : '.webp')
  await sharp(f.caminho, { failOn: 'none' })
    .rotate() // segue a orientação da câmara (EXIF) antes de tirar os metadados
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90, effort: 4 })
    .toFile(destino)
  const tamanho = fs.statSync(destino).size
  // nunca fica mais pesada do que a original
  if (tamanho >= f.tamanho) {
    fs.rmSync(destino, { force: true })
    return f
  }
  fs.rmSync(f.caminho, { force: true })
  return { ...f, caminho: destino, tipo: 'image/webp', tamanho }
}
