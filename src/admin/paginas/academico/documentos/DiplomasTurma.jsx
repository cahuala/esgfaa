import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../../componentes/Ui'
import { MODELOS_CERTIFICADO, gerarDiplomasDeVarios, modelosDe } from './diplomas'
import EscolherDocumento from './EscolherDocumento'
import { useAnoTrabalho } from '../../../anoTrabalho'
import { t as tx } from '../../../../i18n/linguas'

/*
  Os diplomas e certificados de uma turma de uma só vez (do ano actual ou de anos anteriores, para a 2.ª via):
  1) escolhem-se os estudantes; 2) enviam-se ao Comandante (um só pedido; ele aprova uma vez para todos);
  3) depois de aprovados, imprimem-se todos num só PDF. Os já aprovados reimprimem-se sempre que for preciso (2.ª via).
*/
const SITUACAO = {
  'nao concluido': ['bg-secondary', 'Não concluiu o curso'],
  'por pedir': ['bg-warning text-dark', 'Por enviar ao Comandante'],
  pendente: ['bg-info text-dark', 'À espera do Comandante'],
  recusado: ['bg-danger', 'Recusado pelo Comandante'],
  aprovado: ['bg-success', 'Aprovado — pronto a imprimir'],
}
const PODE_ENVIAR = ['por pedir', 'recusado']
const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function DiplomasTurma() {
  const { turmaId } = useParams()
  const { ano: anoTrabalho } = useAnoTrabalho()
  const [d, setD] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [sel, setSel] = useState(() => new Set())
  const [docs, setDocs] = useState({ certificado: true, diploma: true })
  const [estado, setEstado] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [escolher, setEscolher] = useState(false)
  const quadro = useRef(null)

  const carregar = useCallback(() => Promise.all([api(`/academico/turmas/${turmaId}/certificados`), api('/academico/documentos-academicos')])
    .then(([x, c]) => { setErro(''); setD(x); setCfg(c); setSel(new Set()) }).catch((e) => setErro(e.message)), [turmaId])
  useEffect(() => { carregar() }, [carregar])

  if (erro && !d) return <><Erro texto={erro} /><Link to="/academico/turmas" className="btn btn-white mt-2"><i className="fa fa-arrow-left me-1" />{tx('Voltar às turmas')}</Link></>
  // ao mudar de turma (na escolha do ano lectivo), até chegar a nova
  if (!d || !cfg || String(d.turma.id) !== String(turmaId)) return <Carregando />

  const t = d.turma
  const lista = d.estudantes
  const direto = Boolean(d.direto)
  const daTurma = { edicao: '', inicio: '', fim: '', ...(cfg.turmas?.[turmaId] ?? {}) }
  const curso = lista.find((x) => x.curso)?.curso ?? ''
  const modeloCertificado = daTurma.modeloCertificado || modelosDe(curso).certificado
  const escolhidos = lista.filter((x) => sel.has(x.estudante.id))
  const paraEnviar = escolhidos.filter((x) => PODE_ENVIAR.includes(x.estado))
  const paraImprimir = escolhidos.filter((x) => x.estado === 'aprovado')
  const quais = Object.keys(docs).filter((k) => docs[k])
  const anterior = t.anoLetivo !== anoTrabalho
  const conta = (estadoX) => lista.filter((x) => x.estado === estadoX).length

  const marcar = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const marcarTodos = (filtro) => setSel(new Set(lista.filter(filtro).map((x) => x.estudante.id)))
  const mudarTurma = (campo, v) => setCfg({ ...cfg, turmas: { ...cfg.turmas, [turmaId]: { ...daTurma, [campo]: v } } })
  const guardar = () => api('/academico/documentos-academicos', { metodo: 'PUT', corpo: { turmas: { [turmaId]: { edicao: daTurma.edicao, inicio: daTurma.inicio, fim: daTurma.fim, modeloCertificado } } } })
  const opcoes = { ...daTurma, anoLetivo: t.anoLetivo, directorEnsino: cfg.directorEnsino, comandante: cfg.comandante, modeloCertificado }

  async function enviar() {
    setEstado('enviar')
    try {
      const r = await api(`/academico/turmas/${turmaId}/certificados`, { metodo: 'POST', corpo: { estudanteIds: paraEnviar.map((x) => x.estudante.id) } })
      setD({ turma: r.turma, direto: r.direto, estudantes: r.estudantes })
      setSel(new Set())
      setAviso({ tipo: r.erros.length ? 'erro' : undefined, texto: [direto ? tx('{0} emitido(s).', { 0: r.enviados }) : tx('{0} enviado(s) ao Comandante: ficam disponíveis quando ele aprovar.', { 0: r.enviados }), ...r.erros].join(' ') })
    } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) } finally { setEstado('') }
  }
  async function pdf(imprimir) {
    setEstado(imprimir ? 'imprimir' : 'pdf')
    try {
      await guardar()
      const nome = `diplomas-${t.nome}-${t.anoLetivo}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()
      const url = await gerarDiplomasDeVarios(paraImprimir, opcoes, quais, { nomeFicheiro: nome, abrir: imprimir })
      if (imprimir && quadro.current) {
        quadro.current.onload = () => quadro.current.contentWindow?.print()
        quadro.current.src = url
      }
    } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) } finally { setEstado('') }
  }
  const assinante = (x, cargo) => (x?.nome ? `${[x.posto, x.nome].filter(Boolean).join(' ')} (${x.cargo || cargo})` : null)
  const assinam = [assinante(cfg.directorEnsino, tx('Director de Ensino')), assinante(cfg.comandante, tx('Comandante'))]
  const ocupado = Boolean(estado)

  return (
    <>
      <CabecalhoPagina titulo={tx('Diplomas e certificados')} subtitulo={`${t.nome} · ${tx('ano lectivo {0}', { 0: t.anoLetivo })}${anterior ? ` · ${tx('ano anterior (2.ª via)')}` : ''}`} migalhas={[{ rotulo: tx('Turmas'), para: '/academico/turmas' }, { rotulo: t.nome, para: `/academico/turmas/${t.id}` }, { rotulo: tx('Diplomas e certificados') }]}>
        <button type="button" className="btn btn-white" onClick={() => setEscolher(true)}><i className="fa fa-calendar-alt me-1" />{tx('Outro ano lectivo ou turma…')}</button>
        <Link to={`/academico/turmas/${t.id}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar à turma')}</Link>
      </CabecalhoPagina>

      <div className="alert alert-light border small">
        <b>{tx('Como fazer:')}</b> {direto
          ? tx('1) marque os estudantes; 2) «Emitir»; 3) «Imprimir» ou «Descarregar PDF» — todos de uma vez.')
          : tx('1) marque os estudantes; 2) «Enviar ao Comandante» — ele aprova uma só vez para todos; 3) depois de aprovados, «Imprimir» ou «Descarregar PDF» — todos de uma vez. Os já aprovados reimprimem-se sempre que for preciso (2.ª via).')}
      </div>

      <div className="row">
        <div className="col-xl-8">
          <Painel titulo={tx('Estudantes da turma')} acoes={<span className="small text-muted">{tx('{0} aprovado(s) · {1} à espera · {2} por enviar', { 0: conta('aprovado'), 1: conta('pendente'), 2: conta('por pedir') + conta('recusado') })}</span>} corpo={false}>
            <div className="d-flex flex-wrap gap-2 p-2 border-bottom">
              <button type="button" className="btn btn-sm btn-white" onClick={() => marcarTodos((x) => PODE_ENVIAR.includes(x.estado))}>{tx('Marcar os por enviar')}</button>
              <button type="button" className="btn btn-sm btn-white" onClick={() => marcarTodos((x) => x.estado === 'aprovado')}>{tx('Marcar os aprovados')}</button>
              <button type="button" className="btn btn-sm btn-white" onClick={() => setSel(new Set())}>{tx('Desmarcar')}</button>
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle mb-0">
                <thead><tr><th style={{ width: 32 }} /><th>{tx('Estudante')}</th><th className="text-end">{tx('Média final')}</th><th>{tx('Situação')}</th><th /></tr></thead>
                <tbody>
                  {lista.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{tx('Esta turma não tem estudantes.')}</td></tr>}
                  {lista.map((x) => {
                    const e = x.estudante
                    const [cor, rotulo] = SITUACAO[x.estado] ?? ['bg-light text-dark', x.estado]
                    const pode = x.estado !== 'nao concluido' && x.estado !== 'pendente'
                    return (
                      <tr key={e.id} className={sel.has(e.id) ? 'table-active' : ''}>
                        <td><input type="checkbox" className="form-check-input" checked={sel.has(e.id)} disabled={!pode} onChange={() => marcar(e.id)} aria-label={tx('Marcar {0}', { 0: e.nome })} /></td>
                        <td><b>{[e.dados?.posto, e.nome].filter(Boolean).join(' ')}</b><div className="small text-muted">{[e.dados?.nip && `NIP ${e.dados.nip}`, e.dados?.ramo].filter(Boolean).join(' · ')}</div></td>
                        <td className="text-end">{fmt(x.media)}</td>
                        <td>
                          <span className={`badge ${cor}`}>{tx(x.estado === 'por pedir' && direto ? 'Por emitir' : rotulo)}</span>
                          {x.estado === 'nao concluido' && <div className="small text-muted">{x.motivo}</div>}
                          {x.estado === 'recusado' && <div className="small text-danger">{x.aprovacao?.motivo}</div>}
                        </td>
                        <td className="text-end">{x.estado !== 'nao concluido' && <Link to={`/academico/documentos/turma/${t.id}/certificado/${e.id}`} className="btn btn-xs btn-white" title={tx('Ver só este estudante')}><i className="fa fa-eye" /></Link>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>

        <div className="col-xl-4">
          <Painel titulo={direto ? tx('1. Emitir') : tx('1. Enviar ao Comandante')}>
            <button type="button" className="btn btn-theme w-100" disabled={!paraEnviar.length || ocupado} onClick={enviar}>
              <i className={`fa ${estado === 'enviar' ? 'fa-spinner fa-spin' : 'fa-paper-plane'} me-1`} />{direto ? tx('Emitir ({0})', { 0: paraEnviar.length }) : tx('Enviar ao Comandante ({0})', { 0: paraEnviar.length })}
            </button>
            <div className="small text-muted mt-1">{paraEnviar.length ? tx('Vai um só pedido com todos os marcados.') : tx('Marque os estudantes «por enviar».')}</div>
          </Painel>
          <Painel titulo={tx('2. Imprimir os aprovados')}>
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.certificado} onChange={(e) => setDocs({ ...docs, certificado: e.target.checked })} /> <span className="form-check-label fw-bold">{tx('Certificados')}</span></label>
            <select className="form-select form-select-sm mb-2 ms-4 w-auto" style={{ maxWidth: '92%' }} value={modeloCertificado} disabled={!docs.certificado} onChange={(e) => mudarTurma('modeloCertificado', e.target.value)} aria-label={tx('Modelo do certificado')}>{Object.entries(MODELOS_CERTIFICADO).map(([k, v]) => <option key={k} value={k}>{tx(v)}</option>)}</select>
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={docs.diploma} onChange={(e) => setDocs({ ...docs, diploma: e.target.checked })} /> <span className="form-check-label fw-bold">{tx('Diplomas')}</span></label>
            <div className="small text-muted ms-4 mb-3">{tx('O modelo do diploma vai pelo posto de cada um (oficiais generais ou não).')}</div>
            <div className="row g-2 mb-2">
              <div className="col-4"><label className="form-label small fw-bold mb-1" htmlFor="dt-ed">{tx('Edição')}</label><input id="dt-ed" className="form-control form-control-sm" value={daTurma.edicao} maxLength={20} placeholder="17.º" onChange={(e) => mudarTurma('edicao', e.target.value)} /></div>
              <div className="col-4"><label className="form-label small fw-bold mb-1" htmlFor="dt-in">{tx('Início')}</label><input id="dt-in" type="date" className="form-control form-control-sm" value={daTurma.inicio} onChange={(e) => mudarTurma('inicio', e.target.value)} /></div>
              <div className="col-4"><label className="form-label small fw-bold mb-1" htmlFor="dt-fim">{tx('Fim')}</label><input id="dt-fim" type="date" className="form-control form-control-sm" value={daTurma.fim} onChange={(e) => mudarTurma('fim', e.target.value)} /></div>
            </div>
            <div className="small mb-3">{assinam.every(Boolean)
              ? <span className="text-muted">{tx('Assinam: {0}', { 0: assinam.join(' e ') })}</span>
              : <span className="text-warning"><i className="fa fa-exclamation-triangle me-1" />{tx('Falta quem assina: abra um estudante (o ícone do olho) e escreva-o.')}</span>}</div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-white flex-fill" disabled={!paraImprimir.length || !quais.length || ocupado} onClick={() => pdf(true)}><i className={`fa ${estado === 'imprimir' ? 'fa-spinner fa-spin' : 'fa-print'} me-1`} />{tx('Imprimir ({0})', { 0: paraImprimir.length })}</button>
              <button type="button" className="btn btn-theme flex-fill" disabled={!paraImprimir.length || !quais.length || ocupado} onClick={() => pdf(false)}><i className={`fa ${estado === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />{tx('Descarregar PDF')}</button>
            </div>
            <div className="small text-muted mt-1">{paraImprimir.length ? tx('Primeiro todos os certificados, depois todos os diplomas.') : tx('Marque os estudantes «aprovados».')}</div>
          </Painel>
        </div>
      </div>
      <iframe ref={quadro} title={tx('Impressão')} style={{ position: 'absolute', width: 0, height: 0, border: 0 }} />
      {escolher && <EscolherDocumento documento="diplomas" fechar={() => setEscolher(false)} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default DiplomasTurma
