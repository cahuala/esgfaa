import { useEffect, useState } from 'react'
import { abrirFicheiro, abrirNoAparelho, carregarFicheiro } from './api'
import { iconeFicheiro, tamanho, tipoVisivel } from './formatar'
import LeitorPdf from '../leitor/LeitorPdf'
import { t as tx } from '../i18n/linguas'

/*
  Um ficheiro enviado pelo docente, aberto dentro do portal: PDF no leitor, vídeo e áudio no
  leitor do navegador, imagens na página. Word, PowerPoint, Excel e outros descarregam-se.
*/
function VerFicheiro({ ficheiro, titulo, falhou }) {
  // sem o tipo (ex.: o ficheiro de correção), carrega-se e o tipo vem com o ficheiro
  const [tipoReal, setTipoReal] = useState('')
  const carregar = ficheiro.tipo ? Boolean(tipoVisivel(ficheiro.tipo)) : true
  const tipo = ficheiro.tipo || tipoReal
  const especie = tipoVisivel(tipo)
  const [url, setUrl] = useState(null)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState(null)
  const descarregar = () => abrirFicheiro(ficheiro.id, { nome: ficheiro.nome }).catch(falhou)

  useEffect(() => {
    if (!carregar) return undefined
    let ativo = true
    let criado = null
    carregarFicheiro(ficheiro.id, (p) => { if (ativo) setProgresso(p) })
      .then((f) => { criado = f.url; if (ativo) { setUrl(f.url); setTipoReal(f.tipo) } else URL.revokeObjectURL(f.url) })
      .catch((e) => { if (ativo) setErro(e.message) })
    return () => { ativo = false; if (criado) URL.revokeObjectURL(criado) }
  }, [ficheiro.id, carregar])

  const cabecalho = (
    <div className="d-flex align-items-center gap-2 mb-2 small text-muted">
      <i className={`fa ${iconeFicheiro(tipo)}`} />
      <span className="text-truncate">{ficheiro.nome}</span>
      {ficheiro.tamanho > 0 && <span className="text-nowrap">· {tamanho(ficheiro.tamanho)}</span>}
      {especie !== 'pdf' && <button type="button" className="btn btn-xs btn-white ms-auto" onClick={descarregar}><i className="fa fa-download me-1" />{tx('Descarregar')}</button>}
    </div>
  )

  if (!especie && (!carregar || url || erro)) {
    return (
      <div className="p-ficheiro-outro">
        <i className={`fa ${iconeFicheiro(tipo)} fa-3x mb-3`} />
        <div className="fw-bold">{ficheiro.nome}</div>
        <div className="small text-muted mb-3">{ficheiro.tamanho > 0 && `${tamanho(ficheiro.tamanho)} · `}{tx('Este tipo de ficheiro abre-se no computador (Word, PowerPoint, Excel…).')}</div>
        <button type="button" className="btn btn-theme" onClick={descarregar}><i className="fa fa-download me-1" />{tx('Descarregar')}</button>
      </div>
    )
  }
  if (erro) return <div className="alert alert-danger mb-0">{erro} <button type="button" className="btn btn-link p-0 align-baseline" onClick={descarregar}>{tx('Descarregar')}</button></div>
  if (!url) {
    return (
      <div className="p-ficheiro-carregar" role="status">
        <div className="progress" style={{ height: 6 }}><div className="progress-bar bg-theme" style={{ width: `${Math.round(progresso * 100)}%` }} /></div>
        <div className="small text-muted mt-2">{progresso ? tx('A carregar… {0}%', { 0: Math.round(progresso * 100) }) : tx('A carregar…')}</div>
      </div>
    )
  }
  if (especie === 'pdf') {
    return (
      <>
        {/* no telemóvel: guardar o PDF no aparelho ou abri-lo no leitor do telemóvel (lê-se também aqui, no leitor do portal) */}
        <div className="p-pdf-telemovel">
          <button type="button" className="btn btn-theme" onClick={descarregar}><i className="fa fa-download me-2" />{tx('Descarregar o PDF')}</button>
          <button type="button" className="btn btn-white" onClick={() => abrirNoAparelho(ficheiro.id).catch(falhou)}><i className="fa fa-mobile-alt me-2" />{tx('Abrir no leitor do telemóvel')}</button>
        </div>
        <LeitorPdf key={url} fonte={url} titulo={titulo || ficheiro.nome} descarregar={descarregar} />
      </>
    )
  }
  return (
    <>
      {cabecalho}
      {especie === 'video' && <video src={url} controls playsInline preload="metadata" className="p-ficheiro-video">{tx('O seu navegador não consegue mostrar este vídeo.')}</video>}
      {especie === 'audio' && <audio src={url} controls className="w-100" />}
      {especie === 'imagem' && <img src={url} alt={titulo || ficheiro.nome} className="p-ficheiro-imagem" />}
    </>
  )
}

export default VerFicheiro
