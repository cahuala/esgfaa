import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../../../componentes/Ui'
import { MODELOS_CERTIFICADO, MODELOS_DIPLOMA, gerarDiplomas, modelosDe, oficialGeneral } from './diplomas'
import { t as tx } from '../../../../i18n/linguas'

/*
  Documentos de conclusão de um estudante (só a Administração Escolar, só para quem concluiu o curso): o
  certificado (pelo modelo do curso) e o diploma (pela categoria: oficiais generais ou não). À esquerda
  escolhe-se o que imprimir, os modelos, a edição e as datas do curso e quem assina; à direita vê-se o PDF
  tal como sai. A edição, as datas e quem assina ficam guardados para os outros estudantes da turma.
*/
function CertificadoCurso() {
  const { turmaId, estudanteId } = useParams()
  const [c, setC] = useState(null)
  const [turma, setTurma] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [docs, setDocs] = useState({ certificado: true, diploma: true })
  const [modelos, setModelos] = useState(null)
  const [previa, setPrevia] = useState('')
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState('')
  const quadro = useRef(null)

  useEffect(() => {
    Promise.all([api(`/academico/turmas/${turmaId}/certificados/${estudanteId}`, { metodo: 'POST' }), api(`/academico/turmas/${turmaId}`), api('/academico/documentos-academicos')])
      .then(([cert, t, d]) => { setC(cert); setTurma(t); setCfg(d); setModelos({ ...modelosDe(cert.curso, cert.estudante.dados?.posto), ...(d.turmas?.[turmaId]?.modeloCertificado ? { certificado: d.turmas[turmaId].modeloCertificado } : {}) }) })
      .catch((e) => setErro(e.message))
  }, [turmaId, estudanteId])

  const daTurma = { edicao: '', inicio: '', fim: '', ...(cfg?.turmas?.[turmaId] ?? {}) }
  const escolhidos = Object.keys(docs).filter((k) => docs[k])
  const opcoes = cfg && turma && modelos ? { ...daTurma, anoLetivo: turma.anoLetivo, directorEnsino: cfg.directorEnsino, comandante: cfg.comandante, modeloCertificado: modelos.certificado, modeloDiploma: modelos.diploma } : null

  // a pré-visualização acompanha o que se escreve (meio segundo depois de parar)
  useEffect(() => {
    if (!c || !opcoes || !escolhidos.length) return undefined
    let url = ''
    const t = setTimeout(() => gerarDiplomas(c, opcoes, escolhidos, { previa: true }).then((u) => { url = u; setPrevia(u) }).catch((e) => setErro(e.message)), 500)
    return () => { clearTimeout(t); if (url) URL.revokeObjectURL(url) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, JSON.stringify(opcoes), escolhidos.join()])

  if (erro) return <><Erro texto={erro} /><Link to={`/academico/turmas/${turmaId}`} className="btn btn-white mt-2"><i className="fa fa-arrow-left me-1" />{tx('Voltar à turma')}</Link></>
  if (!c || !cfg || !turma || !modelos) return <Carregando />

  const mudarTurma = (campo, v) => setCfg({ ...cfg, turmas: { ...cfg.turmas, [turmaId]: { ...daTurma, [campo]: v } } })
  const mudarQuem = (quem, campo, v) => setCfg({ ...cfg, [quem]: { ...cfg[quem], [campo]: v } })
  const guardar = () => api('/academico/documentos-academicos', { metodo: 'PUT', corpo: { directorEnsino: cfg.directorEnsino, comandante: cfg.comandante, turmas: { [turmaId]: { edicao: daTurma.edicao, inicio: daTurma.inicio, fim: daTurma.fim, modeloCertificado: modelos.certificado } } } })
  async function descarregar() {
    setEstado('pdf')
    try { await guardar(); await gerarDiplomas(c, opcoes, escolhidos) } catch (e) { setErro(e.message) } finally { setEstado('') }
  }
  async function imprimir() {
    setEstado('imprimir')
    try { await guardar(); quadro.current?.contentWindow?.print() } catch (e) { setErro(e.message) } finally { setEstado('') }
  }
  const e = c.estudante
  // o nome sem a abreviatura do posto colada («Cap.-Ten. Pedro Neto»)
  const nome = e.dados?.posto ? e.nome.replace(/^(\S+\.\s+)+/, '') : e.nome
  const general = oficialGeneral(e.dados?.posto)
  const campo = (id, rotulo, el) => <div className="mb-2"><label className="form-label small fw-bold mb-1" htmlFor={id}>{rotulo}</label>{el}</div>
  const assinante = (quem, rotulo) => (
    <div className="col-6">
      <div className="small fw-bold text-muted mb-1">{rotulo}</div>
      {[['cargo', tx('Cargo')], ['nome', tx('Nome')], ['posto', tx('Posto')]].map(([k, r]) => <input key={k} className="form-control form-control-sm mb-1" value={cfg[quem]?.[k] ?? ''} placeholder={r} aria-label={`${rotulo}: ${r}`} maxLength={120} onChange={(ev) => mudarQuem(quem, k, ev.target.value)} />)}
    </div>
  )

  return (
    <>
      <CabecalhoPagina titulo={tx('Certificado e diploma')} subtitulo={`${[e.dados?.posto, nome].filter(Boolean).join(' ')} · ${c.curso}`} migalhas={[{ rotulo: tx('Turmas'), para: '/academico/turmas' }, { rotulo: turma.nome, para: `/academico/turmas/${turmaId}` }, { rotulo: tx('Certificado e diploma') }]}>
        <Link to={`/academico/turmas/${turmaId}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar à turma')}</Link>
        <button type="button" className="btn btn-white" disabled={!escolhidos.length || Boolean(estado)} onClick={imprimir}><i className={`fa ${estado === 'imprimir' ? 'fa-spinner fa-spin' : 'fa-print'} me-1`} />{tx('Imprimir')}</button>
        <button type="button" className="btn btn-theme" disabled={!escolhidos.length || Boolean(estado)} onClick={descarregar}><i className={`fa ${estado === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />{tx('Descarregar PDF')}</button>
      </CabecalhoPagina>
      <div className="row">
        <div className="col-xl-4">
          <Painel titulo={tx('O estudante')}>
            <div className="fw-bold">{[e.dados?.posto, nome].filter(Boolean).join(' ')}</div>
            <div className="small text-muted">{[e.dados?.nip && `NIP ${e.dados.nip}`, e.dados?.ramo, e.numero].filter(Boolean).join(' · ')}</div>
            <div className="mt-2"><span className="badge bg-success">{tx('Concluiu o curso')}</span> <span className="small">{tx('Média final')}: <b>{Number(c.media).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</b> ({c.percurso?.conclusao?.classificacaoFinal})</span></div>
            <div className="small text-muted mt-1">{tx('Código de verificação')}: <span className="font-monospace">{c.codigo}</span></div>
          </Painel>
          <Painel titulo={tx('O que imprimir')}>
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.certificado} onChange={(ev) => setDocs({ ...docs, certificado: ev.target.checked })} /> <span className="form-check-label fw-bold">{tx('Certificado')}</span></label>
            <select className="form-select form-select-sm mb-3 ms-4 w-auto" style={{ maxWidth: '92%' }} value={modelos.certificado} disabled={!docs.certificado} onChange={(ev) => setModelos({ ...modelos, certificado: ev.target.value })} aria-label={tx('Modelo do certificado')}>{Object.entries(MODELOS_CERTIFICADO).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.diploma} onChange={(ev) => setDocs({ ...docs, diploma: ev.target.checked })} /> <span className="form-check-label fw-bold">{tx('Diploma')}</span></label>
            <select className="form-select form-select-sm ms-4 w-auto" style={{ maxWidth: '92%' }} value={modelos.diploma} disabled={!docs.diploma} onChange={(ev) => setModelos({ ...modelos, diploma: ev.target.value })} aria-label={tx('Modelo do diploma')}>{Object.entries(MODELOS_DIPLOMA).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
            <div className="small text-muted ms-4 mt-1">{general ? tx('É oficial general: diploma «Atesta-se que…».') : tx('Não é oficial general: diploma «A ESG outorga…».')}</div>
          </Painel>
          <Painel titulo={tx('O curso desta turma')}>
            <div className="row g-2">
              <div className="col-4">{campo('cc-ed', tx('Edição'), <input id="cc-ed" className="form-control form-control-sm" value={daTurma.edicao} maxLength={20} placeholder="17.º" onChange={(ev) => mudarTurma('edicao', ev.target.value)} />)}</div>
              <div className="col-4">{campo('cc-in', tx('Início'), <input id="cc-in" type="date" className="form-control form-control-sm" value={daTurma.inicio} onChange={(ev) => mudarTurma('inicio', ev.target.value)} />)}</div>
              <div className="col-4">{campo('cc-fim', tx('Fim'), <input id="cc-fim" type="date" className="form-control form-control-sm" value={daTurma.fim} onChange={(ev) => mudarTurma('fim', ev.target.value)} />)}</div>
            </div>
            <div className="small text-muted">{tx('O fim do curso é também a data do documento.')}</div>
          </Painel>
          <Painel titulo={tx('Quem assina')}>
            <div className="row g-2">
              {assinante('directorEnsino', tx('À esquerda'))}
              {assinante('comandante', tx('À direita'))}
            </div>
            <div className="small text-muted mt-1">{tx('Fica guardado para os outros estudantes ao imprimir ou descarregar.')}</div>
          </Painel>
        </div>
        <div className="col-xl-8">
          <Painel titulo={tx('Pré-visualização')} corpo={false}>
            {!escolhidos.length
              ? <div className="text-center text-muted py-5">{tx('Escolha o certificado, o diploma ou os dois.')}</div>
              : previa ? <iframe ref={quadro} title={tx('Pré-visualização')} src={previa} style={{ width: '100%', height: '82vh', border: 0, display: 'block' }} /> : <Carregando />}
          </Painel>
        </div>
      </div>
    </>
  )
}

export default CertificadoCurso
