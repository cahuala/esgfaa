import { useState } from 'react'
import { FaFileDownload, FaFileUpload } from 'react-icons/fa'
import DOMPurify from 'dompurify'
import { abrirFicheiro, api } from '../api'
import { Cartao, Vazio } from '../componentes'
import { t as tx } from '../../i18n/linguas'
import { capitulosDoPrograma } from '../../../api/src/dominio/academico/atividades/programa.js'

// programa da cadeira, escrito pela Administração Escolar e/ou em documento (o PDF também o envia o docente)
function Programa({ c, avisar, eDocente, recarregar, irPara }) {
  const [abertos, setAbertos] = useState(() => new Set())
  const [aEnviar, setAEnviar] = useState(false)
  async function enviar(formulario, texto) {
    setAEnviar(true)
    try {
      await api(`/cadeiras/${c.id}/programa`, { metodo: 'PUT', formulario })
      avisar({ texto })
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAEnviar(false)
    }
  }
  const escolher = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const dados = new FormData()
    dados.append('ficheiro', f)
    enviar(dados, tx('Programa enviado.'))
  }
  const remover = () => {
    const dados = new FormData()
    dados.append('removerFicheiro', 'true')
    enviar(dados, tx('Documento retirado.'))
  }
  const acoes = (
    <div className="d-flex flex-wrap gap-2">
      {c.programaFicheiroId && (
        <button type="button" className="btn btn-theme btn-sm" onClick={() => abrirFicheiro(c.programaFicheiroId, { nome: `Programa ${c.codigo}`, ver: true }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))}>
          <FaFileDownload aria-hidden="true" /> {tx('Descarregar documento')}
        </button>
      )}
      {eDocente && (
        <label className={`btn btn-white btn-sm mb-0 ${aEnviar ? 'disabled' : ''}`}>
          <FaFileUpload aria-hidden="true" /> {c.programaFicheiroId ? tx('Substituir o PDF') : tx('Enviar o programa (PDF)')}
          <input type="file" accept="application/pdf" className="d-none" onChange={escolher} disabled={aEnviar} />
        </label>
      )}
      {eDocente && c.programaFicheiroId && <button type="button" className="btn btn-white btn-sm" onClick={remover} disabled={aEnviar}>{tx('Retirar')}</button>}
    </div>
  )
  if (!c.programa && !c.programaFicheiroId) return eDocente ? <Cartao titulo={tx('Programa da cadeira')} acoes={acoes}><p className="p-texto-suave mb-0">{tx('Ainda não há programa. Envie o PDF da disciplina.')}</p></Cartao> : <Vazio>{tx('O programa desta cadeira ainda não foi publicado.')}</Vazio>
  // como no Moodle: os objectivos em cima e as sessões (ou os temas) uma a uma, a abrir ao clicar, cada uma com o seu
  // capítulo na sala de aula (onde está a matéria)
  const sessoes = capitulosDoPrograma(c.programa)
  const semSessoes = String(c.programa ?? '').replace(/<h4>\s*Plano das sessões\s*<\/h4>\s*<table[\s\S]*?<\/table>/i, '')
  const capituloDe = (titulo) => (c.secoes ?? []).find((s) => s.titulo === titulo)
  const alternar = (i) => setAbertos((a) => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n })
  return (
    <Cartao titulo={tx('Programa da cadeira')} acoes={acoes}>
      {c.programa
        ? <div className="p-programa" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sessoes.length ? semSessoes : c.programa) }} />
        : <p className="p-texto-suave">{tx('O programa está no documento anexo.')}</p>}
      {sessoes.length > 0 && (
        <>
          <h4 className="mt-3">{tx('Sessões ({0})', { 0: sessoes.length })}</h4>
          <div className="list-group">
            {sessoes.map((s, i) => {
              const aberto = abertos.has(i)
              const cap = capituloDe(s.titulo)
              return (
                <div key={i} className="list-group-item p-0">
                  <button type="button" className="btn btn-link w-100 text-start text-body text-decoration-none d-flex align-items-start gap-2 p-2" aria-expanded={aberto} onClick={() => alternar(i)}>
                    <i className={`fa fa-chevron-${aberto ? 'down' : 'right'} mt-1 text-muted`} />
                    <span className="flex-grow-1">{s.titulo}</span>
                    {cap && <i className="fa fa-book-open text-theme mt-1" title={tx('Tem capítulo na sala de aula')} />}
                  </button>
                  {aberto && (
                    <div className="px-4 pb-3 small">
                      {s.resumo && <div style={{ whiteSpace: 'pre-line' }} className="text-muted mb-2">{s.resumo}</div>}
                      {cap
                        ? <button type="button" className="btn btn-sm btn-theme" onClick={() => irPara?.({ separador: 'curso', capitulo: String(cap.id) })}><i className="fa fa-chalkboard me-1" />{tx('Abrir na sala de aula')}</button>
                        : <span className="text-muted">{eDocente ? tx('Ainda sem capítulo: crie os capítulos do programa na página da cadeira.') : tx('O docente ainda não juntou a matéria desta sessão.')}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Cartao>
  )
}

export default Programa
