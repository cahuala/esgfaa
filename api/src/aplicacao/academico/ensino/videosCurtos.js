import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { quem } from '../partilhado/autor.js'

// vídeos curtos: até 60 MB e 3 minutos (o telemóvel grava em MP4; o WebM vem de alguns navegadores)
export const VIDEO_CURTO = { tipos: ['video/mp4', 'video/webm'], maximoBytes: 60 * 1024 * 1024, maximoSegundos: 180 }
const CAPAS = ['image/jpeg', 'image/png', 'image/webp']
// no Portal (página inicial) ficam os das últimas semanas; na cadeira, todos os recentes
const DIAS_NO_INICIO = 30
const DIAS_NA_CADEIRA = 365

/*
  Vídeos curtos da cadeira, como os estados do WhatsApp: o docente grava a aula, o exercício ou a visita
  no telemóvel e publica-o com uma legenda; os estudantes da cadeira veem-nos em ecrã inteiro, um a seguir
  ao outro. O vídeo e a capa (a primeira imagem, tirada no navegador) são ficheiros privados: só os abre
  quem tem acesso à cadeira.
*/
export class ServicoVideosCurtos {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  #vista(v, conta) {
    return {
      id: v.id, cadeira: v.cadeira, legenda: v.legenda, duracao: v.duracao, autor: v.autor, criadoEm: v.criadoEm,
      ficheiroId: v.ficheiroId, capaId: v.capaId, podeApagar: conta.tipo === 'docente' && v.autorId === conta.id,
    }
  }

  #desde(dias) {
    return new Date(this.relogio.agora().getTime() - dias * 24 * 3600 * 1000)
  }

  async daCadeira(ctx, cadeiraId) {
    const c = await this.apoio.cadeiraAcessivel(ctx.conta, cadeiraId)
    const docente = ctx.conta.tipo === 'docente' && (await this.apoio.cadeiraDoDocente(ctx.conta, c.id).then(() => true, () => false))
    return (await this.academico.videosCurtos([c.id], this.#desde(DIAS_NA_CADEIRA), 100)).map((v) => ({ ...this.#vista(v, ctx.conta), podeApagar: docente }))
  }

  // Portal (página inicial): os das minhas cadeiras, das últimas semanas, agrupados por cadeira
  async meus(ctx) {
    const cadeiras = await this.apoio.minhasCadeiras(ctx.conta)
    if (!cadeiras.length) return []
    const l = await this.academico.videosCurtos(cadeiras.map((c) => c.id), this.#desde(DIAS_NO_INICIO))
    const grupos = new Map()
    for (const v of l) {
      if (!grupos.has(v.cadeiraId)) grupos.set(v.cadeiraId, { cadeira: v.cadeira, videos: [] })
      grupos.get(v.cadeiraId).videos.push(this.#vista(v, ctx.conta))
    }
    // em cada cadeira, pela ordem em que foram gravados (como no WhatsApp); as cadeiras, da mais recente
    return [...grupos.values()].map((g) => ({ ...g, videos: g.videos.reverse() }))
  }

  async publicar(ctx, cadeiraId, dados, recebidos = []) {
    const [video, capa] = recebidos
    const largar = () => { for (const f of recebidos) if (f) this.privados.apagar(f.caminho) }
    try {
      const c = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
      if (!video || !VIDEO_CURTO.tipos.includes(video.tipo)) throw new ErroValidacao('Escolha um vídeo MP4 ou WebM.', { campo: 'ficheiro' })
      if (video.tamanho > VIDEO_CURTO.maximoBytes) throw new ErroValidacao('O vídeo tem mais de 60 MB. Grave um vídeo mais curto (até 3 minutos).', { campo: 'ficheiro' })
      if (capa && !CAPAS.includes(capa.tipo)) throw new ErroValidacao('A capa tem de ser uma imagem.', { campo: 'ficheiros' })
      const duracao = dados.duracao === undefined || dados.duracao === '' ? null : Math.round(Number(dados.duracao))
      if (duracao !== null && (!Number.isFinite(duracao) || duracao < 0 || duracao > VIDEO_CURTO.maximoSegundos)) throw new ErroValidacao('O vídeo tem de ter até 3 minutos.', { campo: 'ficheiro' })
      const ficheiroId = await this.apoio.registarFicheiro(video, ctx.conta.id)
      const capaId = capa ? await this.apoio.registarFicheiro(capa, ctx.conta.id) : null
      const v = await this.academico.criarVideoCurto({
        cadeiraId: c.id, autorId: ctx.conta.id, ficheiroId, capaId, duracao, criadoEm: this.relogio.agora(),
        legenda: texto(dados.legenda, 'legenda', 'Legenda', { max: 300, obrigatorio: false }),
      })
      await this.auditoria?.registar(ctx, { acao: 'publicar_video_curto', colecao: 'videos_curtos', alvoId: String(v.id), alvoTitulo: `${c.codigo} · ${v.legenda || 'vídeo curto'}`, utilizador: quem(ctx.conta) })
      return v
    } catch (e) {
      largar()
      throw e
    }
  }

  async apagar(ctx, id) {
    const v = await this.academico.videoCurto(id)
    if (!v) throw new NaoEncontrado('Vídeo não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, v.cadeiraId)
    await this.academico.apagarVideoCurto(v.id)
    for (const fid of [v.ficheiroId, v.capaId].filter(Boolean)) {
      const f = await this.academico.ficheiro(fid)
      if (f) this.privados.apagar(this.privados.absoluto(f.caminho))
    }
  }
}
