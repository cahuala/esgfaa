import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import { ESTADOS_PERIODO, PERIODOS, estadoDoPeriodo } from './comum'
import { BLOCOS_DE_TEMPOS } from '../../../portal/regraAvaliacao'
import CopiarTurma from './CopiarTurma'
import AvaliacaoDocentes from './AvaliacaoDocentes'
import PlanoCursoTurma from './PlanoCursoTurma'
import ImportarEstudantes from './ImportarEstudantes'
import Finalistas from './Finalistas'
import PassagemAno from './PassagemAno'
import FotoConta from '../../componentes/FotoConta'
import Exportar from '../../componentes/Exportar'
import { confirmar } from '../../../portal/dialogos'
import { t as tx } from '../../../i18n/linguas'

const DIAS = ['', tx('Segunda'), tx('Terça'), tx('Quarta'), tx('Quinta'), tx('Sexta'), tx('Sábado')]
const ESTADOS = { ativa: ['bg-success', tx('Ativa')], suspensa: ['bg-warning text-dark', tx('Suspensa')], concluida: ['bg-info', tx('Concluída')], anulada: ['bg-secondary', tx('Anulada')] }

const POR_PAGINA = 15

// cartão do resumo da turma (número grande e o que é)
function Resumo({ icone, cor, valor, rotulo, detalhe }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="tm-resumo">
        <span className={`tm-resumo-ic bg-${cor}`}><i className={`fa ${icone}`} /></span>
        <div><div className="tm-resumo-n">{valor}</div><div className="tm-resumo-r">{rotulo}</div>{detalhe && <div className="tm-resumo-d">{detalhe}</div>}</div>
      </div>
    </div>
  )
}

/*
  Uma turma, organizada por separadores: os estudantes (procurar, estado da matrícula, histórico, certificado e
  diploma de quem concluiu), os finalistas (trabalho de fim de curso), as cadeiras e o horário, os documentos
  da turma e a avaliação dos docentes. O resumo em cima diz logo quantos são e quantos concluíram.
*/
function Turma() {
  const { id } = useParams()
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [params, setParams] = useSearchParams()
  const [t, setT] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [copiar, setCopiar] = useState(false)
  const [importar, setImportar] = useState(false)
  const [passagem, setPassagem] = useState(false)
  const [matricular, setMatricular] = useState(false)
  const [conclusao, setConclusao] = useState(new Map())

  const carregar = useCallback(() => api(`/academico/turmas/${id}`).then((r) => { setErro(''); setT(r) }).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])
  // as datas do ano letivo da turma: o semestre de cada cadeira está por começar, a decorrer ou terminado
  const [anos, setAnos] = useState([])
  useEffect(() => { api('/academico/anos-letivos').then(setAnos).catch(() => {}) }, [])
  // a conclusão do curso de cada finalista (só esses têm certificado e diploma)
  useEffect(() => {
    if (!t?.anoFinal) return
    api(`/academico/turmas/${id}/finalistas`).then((r) => setConclusao(new Map(r.linhas.map((l) => [l.estudante.id, l.conclusao])))).catch(() => {})
  }, [id, t?.anoFinal])

  const falhou = (e) => setAviso({ tipo: 'erro', texto: e.message })
  const [procura, setProcura] = useState('')
  const [pagina, setPagina] = useState(1)

  if (erro) return <Erro texto={erro} />
  if (!t) return <Carregando />
  const aba = params.get('aba') || 'estudantes'
  const irPara = (k) => setParams(k === 'estudantes' ? {} : { aba: k }, { replace: true })
  // procurar na turma: por todas as formas (nome, NIP, posto, ramo, n.º de estudante, e-mail), sem acentos
  const semAcento = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const termos = semAcento(procura).split(/\s+/).filter(Boolean)
  const encontradas = t.matriculas.filter((m) => { const tudo = semAcento([m.estudante.nome, m.estudante.numero, m.estudante.email, ...Object.values(m.estudante.dados ?? {})].join(' ')); return termos.every((x) => tudo.includes(x)) })
  const paginas = Math.max(1, Math.ceil(encontradas.length / POR_PAGINA))
  const atual = Math.min(pagina, paginas)
  const visiveis = encontradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)
  const ativas = t.matriculas.filter((m) => m.estado === 'ativa').length
  const concluiram = [...conclusao.values()].filter((c) => c.concluido).length
  // os termos do curso: auditores/discentes e TII/TFC (pelo plano de curso da turma)
  const curso = t.termos ?? { pessoas: 'Estudantes', pessoa: 'Estudante', trabalho: { sigla: 'TFC', nome: 'Trabalho de fim de curso' } }
  const ABAS = [
    ['estudantes', tx(curso.pessoas), 'fa-user-graduate', t.matriculas.length],
    ...(t.anoFinal ? [['finalistas', tx('Finalistas e {0}', { 0: curso.trabalho.sigla }), 'fa-award', `${concluiram}/${conclusao.size}`]] : []),
    ['cadeiras', tx('Cadeiras e horário'), 'fa-book', t.cadeiras.length],
    ['plano', tx('Plano de curso'), 'fa-clipboard-list', null],
    ['documentos', tx('Documentos da turma'), 'fa-print', null],
    ...(t.cadeiras.length ? [['avaliacao', tx('Avaliação dos docentes'), 'fa-star-half-alt', null]] : []),
  ]

  return (
    <>
      <CabecalhoPagina titulo={t.nome} subtitulo={tx('{0} · {1}.º ano', { 0: t.anoLetivo, 1: t.anoCurricular })} migalhas={[{ rotulo: tx('Turmas'), para: '/academico/turmas' }, { rotulo: t.nome }]}>
        <Link to="/academico/turmas" className="btn btn-white"><i className="fa fa-arrow-left me-1" /> {tx('Turmas')}</Link>
      </CabecalhoPagina>

      <div className="row g-2 mb-3">
        <Resumo icone="fa-user-graduate" cor="primary" valor={t.matriculas.length} rotulo={tx(curso.pessoas)} detalhe={tx('{0} com matrícula ativa', { 0: ativas })} />
        <Resumo icone="fa-book" cor="info" valor={t.cadeiras.length} rotulo={tx('Cadeiras')} detalhe={tx('{0} docente(s)', { 0: new Set(t.cadeiras.flatMap((c) => (c.docentes ?? []).map((d) => d.id))).size })} />
        {t.anoFinal
          ? <Resumo icone="fa-award" cor="success" valor={`${concluiram}/${conclusao.size}`} rotulo={tx('Concluíram o curso')} detalhe={tx('podem receber certificado e diploma')} />
          : <Resumo icone="fa-level-up-alt" cor="warning" valor={`${t.anoCurricular}.º`} rotulo={tx('Ano do curso')} detalhe={tx('não é a turma de finalistas')} />}
        <Resumo icone="fa-calendar" cor="secondary" valor={t.anoLetivo} rotulo={tx('Ano letivo')} detalhe={t.anoFinal ? tx('turma de finalistas') : ''} />
      </div>

      <ul className="nav nav-tabs tm-abas mb-3" role="tablist">
        {ABAS.map(([k, rot, ic, n]) => (
          <li key={k} className="nav-item"><button type="button" role="tab" aria-selected={aba === k} className={`nav-link ${aba === k ? 'active' : ''}`} onClick={() => irPara(k)}><i className={`fa ${ic} me-1`} />{rot}{n !== null && <span className="badge bg-secondary ms-1">{n}</span>}</button></li>
        ))}
      </ul>

      {aba === 'estudantes' && (
        <Painel titulo={tx('{0} da turma', { 0: tx(curso.pessoas) })} corpo={false} acoes={gerir && <>
          <button type="button" className="btn btn-xs btn-theme" onClick={() => setMatricular(!matricular)}><i className={`fa ${matricular ? 'fa-times' : 'fa-user-plus'} me-1`} />{matricular ? tx('Fechar') : tx('Matricular estudantes')}</button>
          <button type="button" className="btn btn-xs btn-white" onClick={() => setImportar(true)}><i className="fa fa-file-excel me-1 text-success" />{tx('Do Excel/CSV')}</button>
          {!t.anoFinal && <button type="button" className="btn btn-xs btn-white" onClick={() => setPassagem(true)}><i className="fa fa-level-up-alt me-1 text-success" />{tx('Passagem de ano')}</button>}
        </>}>
          {matricular && gerir && <div className="p-3 border-bottom bg-light"><MatricularEstudantes turma={t} carregar={carregar} avisar={setAviso} /></div>}
          <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center">
            <div className="input-group flex-grow-1" style={{ maxWidth: 560 }}>
              <span className="input-group-text"><i className="fa fa-search" /></span>
              <input type="search" className="form-control" value={procura} onChange={(e) => { setProcura(e.target.value); setPagina(1) }} placeholder={tx('Pesquisar militar: nome, NIP, posto, ramo, n.º ou e-mail')} aria-label={tx('Pesquisar militares da turma')} />
            </div>
            <span className="small text-muted ms-auto">{encontradas.length === t.matriculas.length ? tx('{0} estudante(s)', { 0: t.matriculas.length }) : tx('{0} de {1}', { 0: encontradas.length, 1: t.matriculas.length })}</span>
            <Exportar
              titulo={tx('Estudantes da turma {0}', { 0: t.nome })}
              filtro={procura.trim() && tx('pesquisa: «{0}»', { 0: procura.trim() })}
              linhas={encontradas}
              colunas={[
                { titulo: tx('Nome'), valor: (m) => m.estudante.nome },
                { titulo: tx('Posto'), valor: (m) => m.estudante.dados?.posto },
                { titulo: 'NIP', valor: (m) => m.estudante.dados?.nip },
                { titulo: tx('Ramo'), valor: (m) => m.estudante.dados?.ramo },
                { titulo: tx('N.º'), valor: (m) => m.estudante.numero },
                { titulo: tx('E-mail'), valor: (m) => m.estudante.email },
                { titulo: tx('Matrícula'), valor: (m) => ESTADOS[m.estado]?.[1] ?? m.estado },
                ...(t.anoFinal ? [{ titulo: tx('Curso'), valor: (m) => { const c = conclusao.get(m.estudante.id); return !c ? '' : c.concluido ? `${tx('Concluiu')} · ${Number(c.mediaFinal).toLocaleString('pt-PT')}` : tx('Por concluir') } }] : []),
              ]}
            />
          </div>
          <div className="table-responsive">
            <table className="table align-middle mb-0 tm-tabela">
              <thead><tr><th>{tx('Militar')}</th><th>{tx('N.º')}</th><th>{tx('Matrícula')}</th>{t.anoFinal && <th>{tx('Curso')}</th>}<th className="text-end">{tx('Ações')}</th></tr></thead>
              <tbody>
                {t.matriculas.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-5"><i className="fa fa-user-graduate fa-2x d-block mb-2 opacity-25" />{tx('Ainda não há estudantes nesta turma.')}{gerir && <> {tx('Use «Matricular estudantes».')}</>}</td></tr>}
                {t.matriculas.length > 0 && !encontradas.length && <tr><td colSpan={5} className="text-center text-muted py-4">{tx('Ninguém encontrado para «{0}».', { 0: procura })}</td></tr>}
                {visiveis.map((m) => {
                  const c = conclusao.get(m.estudante.id)
                  const d = m.estudante.dados ?? {}
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <FotoConta id={m.estudante.id} nome={m.estudante.nome} temFoto={m.estudante.temFoto} tamanho={38} />
                          <div><div className="fw-bold">{m.estudante.nome}</div><div className="small text-muted">{[d.posto, d.nip && `NIP ${d.nip}`, d.ramo].filter(Boolean).join(' · ') || m.estudante.email}</div></div>
                        </div>
                      </td>
                      <td className="font-monospace small">{m.estudante.numero}</td>
                      <td>
                        {gerir ? (
                          <select className="form-select form-select-sm w-auto" value={m.estado} aria-label={tx('Estado da matrícula de {0}', { 0: m.estudante.nome })} onChange={(e) => api(`/academico/matriculas/${m.id}`, { metodo: 'PUT', corpo: { estado: e.target.value } }).then(carregar).catch(falhou)}>
                            {Object.entries(ESTADOS).map(([k, [, v]]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : <span className={`badge ${ESTADOS[m.estado][0]}`}>{ESTADOS[m.estado][1]}</span>}
                      </td>
                      {t.anoFinal && <td>{!c ? <span className="small text-muted">—</span> : c.concluido ? <span className="badge bg-success"><i className="fa fa-check me-1" />{tx('Concluiu')} · {Number(c.mediaFinal).toLocaleString('pt-PT')}</span> : <span className="badge bg-light text-dark border" title={c.emFalta.join('\n')}>{tx('Falta: {0}', { 0: c.emFalta.length })}</span>}</td>}
                      <td className="text-end text-nowrap">
                        <Link to={`/academico/documentos/estudante/${m.estudante.id}/historico`} className="btn btn-xs btn-white me-1" title={tx('Histórico académico')}><i className="fa fa-scroll me-1" />{tx('Histórico')}</Link>
                        {gerir && (c?.concluido
                          ? <Link to={`/academico/documentos/turma/${t.id}/certificado/${m.estudante.id}`} className="btn btn-xs btn-success"><i className="fa fa-award me-1" />{tx('Certificado e diploma')}</Link>
                          : <button type="button" className="btn btn-xs btn-white" disabled title={t.anoFinal ? tx('Ainda não defendeu / não concluiu o curso') : tx('Só na turma de finalistas, depois de concluir o curso')}><i className="fa fa-award me-1" />{tx('Certificado e diploma')}</button>)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div className="d-flex align-items-center gap-2 p-2 border-top">
              <button type="button" className="btn btn-sm btn-white" disabled={atual <= 1} onClick={() => setPagina(atual - 1)}><i className="fa fa-chevron-left me-1" />{tx('Recuar')}</button>
              <span className="small text-muted mx-auto">{tx('{0}–{1} de {2} · página {3} de {4}', { 0: (atual - 1) * POR_PAGINA + 1, 1: Math.min(atual * POR_PAGINA, encontradas.length), 2: encontradas.length, 3: atual, 4: paginas })}</span>
              <button type="button" className="btn btn-sm btn-white" disabled={atual >= paginas} onClick={() => setPagina(atual + 1)}>{tx('Avançar')}<i className="fa fa-chevron-right ms-1" /></button>
            </div>
          )}
        </Painel>
      )}

      {aba === 'finalistas' && t.anoFinal && <>
        <div className="tm-passos mb-3">
          <div><b>1</b>{tx('Lance o {0} (botão {1}): tema, orientador, júri, defesa e nota.', { 0: tx(curso.trabalho.nome).toLowerCase(), 1: curso.trabalho.sigla })}</div>
          <div><b>2</b>{t.temPlano ? tx('Quando o Conselho de Curso homologa a classificação, aparece «Concluído».') : tx('Quando tem todas as cadeiras e o TFC aprovados, aparece «Concluído».')}</div>
          <div><b>3</b>{tx('Carregue em «Certificado» para ver e imprimir o certificado e o diploma.')}</div>
        </div>
        <Finalistas turma={t} gerir={gerir} avisar={setAviso} termos={curso} />
      </>}

      {aba === 'cadeiras' && (
        <div className="row">
          <div className="col-xl-8">
            {['1', '2', 'anual'].map((per) => {
              const lista = t.cadeiras.filter((c) => String(c.periodo) === per)
              if (!lista.length) return null
              const ano = anos.find((a) => a.id === t.anoLetivo)
              const estado = ESTADOS_PERIODO[estadoDoPeriodo(ano, per)]
              const datas = ano && (per === '1' ? [ano.semestre1Inicio, ano.semestre1Fim] : per === '2' ? [ano.semestre2Inicio, ano.semestre2Fim] : [ano.inicio, ano.fim])
              return (
                <section key={per} className="mb-3" aria-label={PERIODOS[per]}>
                  <h3 className="h5 d-flex flex-wrap align-items-center gap-2 mb-2">
                    {PERIODOS[per]} <span className="badge bg-dark">{tx('{0} cadeira(s)', { 0: lista.length })}</span>
                    {estado && <span className={`badge ${estado.cor}`}>{estado.rotulo}</span>}
                    {datas && <small className="text-muted fw-normal">{datas.map((x) => x.split('-').reverse().join('/')).join(' – ')}</small>}
                  </h3>
                  {lista.map((c) => <CadeiraTurma key={c.id} c={c} gerir={gerir} carregar={carregar} avisar={setAviso} />)}
                </section>
              )
            })}
            {t.cadeiras.length === 0 && <div className="alert alert-info">{tx('Ainda não há cadeiras nesta turma.')}</div>}
          </div>
          <div className="col-xl-4">
            {gerir && <NovaCadeira turma={t} carregar={carregar} avisar={setAviso} />}
            {gerir && <button type="button" className="btn btn-white w-100" onClick={() => setCopiar(true)}><i className="fa fa-copy me-1" />{tx('Copiar cadeiras de outra turma')}</button>}
          </div>
        </div>
      )}

      {aba === 'documentos' && (
        <Painel titulo={tx('Documentos da turma')}>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <Link to={`/academico/documentos/turma/${t.id}/pauta`} className="btn btn-white"><i className="fa fa-table me-1" />{tx('Pauta da turma')}</Link>
            <span className="text-muted small">{tx('Por cadeira (pauta, folha de presenças, lista para a prova): em «Cadeiras e horário».')}</span>
          </div>
          {gerir && (
            <label className="form-check form-switch mb-0">
              <input className="form-check-input" type="checkbox" checked={Boolean(t.anoFinal)} onChange={(e) => api(`/academico/turmas/${t.id}`, { metodo: 'PUT', corpo: { anoFinal: e.target.checked } }).then(carregar).catch(falhou)} />
              <span className="form-check-label fw-bold">{tx('Turma de finalistas (último ano: trabalho de fim de curso)')}</span>
              <div className="small text-muted">{tx('Na turma de finalistas lança-se o trabalho de fim de curso e tiram-se o certificado e o diploma.')}</div>
            </label>
          )}
        </Painel>
      )}

      {aba === 'plano' && <PlanoCursoTurma turma={t} gerir={gerir} avisar={setAviso} aoMudar={carregar} />}
      {aba === 'avaliacao' && t.cadeiras.length > 0 && <AvaliacaoDocentes turma={t} gerir={gerir} avisar={setAviso} />}

      {importar && <ImportarEstudantes turma={t} fechar={() => setImportar(false)} concluido={carregar} />}
      {passagem && <PassagemAno turma={t} fechar={() => setPassagem(false)} concluido={carregar} />}
      {copiar && <CopiarTurma turma={t} fechar={() => setCopiar(false)} concluido={carregar} />}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

// matricular estudantes já registados pelo Pessoal e Quadros: pesquisar e escolher (vários de uma vez)
function MatricularEstudantes({ turma, carregar, avisar }) {
  const [q, setQ] = useState('')
  const [encontrados, setEncontrados] = useState([])
  const [escolhidos, setEscolhidos] = useState([])
  const [aGravar, setAGravar] = useState(false)
  const jaNaTurma = new Set(turma.matriculas.map((m) => m.estudante.id))
  useEffect(() => {
    const t = setTimeout(() => api(`/academico/contas?tipo=estudante${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then((l) => setEncontrados(l.filter((e) => e.ativo && !jaNaTurma.has(e.id)).slice(0, 30))).catch(() => {}), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, turma.matriculas.length])
  const alternar = (e) => setEscolhidos((l) => (l.some((x) => x.id === e.id) ? l.filter((x) => x.id !== e.id) : [...l, e]))
  async function matricular() {
    setAGravar(true)
    try {
      const r = await api(`/academico/turmas/${turma.id}/matricular`, { metodo: 'POST', corpo: { estudanteIds: escolhidos.map((e) => e.id) } })
      avisar({ texto: tx('{0} estudante(s) matriculado(s) em {1}.', { 0: r.matriculados, 1: turma.nome }) })
      setEscolhidos([])
      carregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGravar(false)
    }
  }
  return (
    <Painel titulo={tx('Matricular estudantes registados')}>
      <p className="small text-muted">{tx('O registo dos estudantes é feito pela Repartição de Pessoal e Quadros. Aqui escolhe-se quem entra nesta turma.')}</p>
      <div className="input-group mb-2">
        <span className="input-group-text"><i className="fa fa-search" /></span>
        <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Nome, e-mail ou número de estudante')} aria-label={tx('Pesquisar estudantes registados')} />
      </div>
      <div className="list-group mb-2" style={{ maxHeight: 260, overflowY: 'auto' }}>
        {encontrados.length === 0 && <div className="list-group-item small text-muted">{q.trim() ? tx('Ninguém encontrado (ou já está na turma).') : tx('Todos os estudantes registados já estão nesta turma.')}</div>}
        {encontrados.map((e) => {
          const marcado = escolhidos.some((x) => x.id === e.id)
          return (
            <label key={e.id} className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${marcado ? 'active' : ''}`}>
              <input type="checkbox" className="form-check-input mt-0" checked={marcado} onChange={() => alternar(e)} aria-label={e.nome} />
              <span className="flex-grow-1"><b>{e.nome}</b><span className="d-block small opacity-75">{e.numero}{e.dados?.posto ? ` · ${e.dados.posto}` : ''}</span></span>
            </label>
          )
        })}
      </div>
      {escolhidos.length > 0 && <div className="d-flex flex-wrap gap-1 mb-2">{escolhidos.map((e) => <span key={e.id} className="badge bg-theme">{e.nome} <button type="button" className="btn-close btn-close-white ms-1" style={{ fontSize: 8 }} onClick={() => alternar(e)} aria-label={tx('Retirar {0}', { 0: e.nome })} /></span>)}</div>}
      <button type="button" className="btn btn-theme w-100" onClick={matricular} disabled={!escolhidos.length || aGravar}><i className="fa fa-user-check me-1" />{aGravar ? tx('A matricular…') : tx('Matricular {0} estudante(s)', { 0: escolhidos.length || '' })}</button>
    </Painel>
  )
}

function CadeiraTurma({ c, gerir, carregar, avisar }) {
  const [h, setH] = useState({ diaSemana: '1', inicio: '08:00', fim: '10:00', sala: '' })
  const falhou = (e) => avisar({ tipo: 'erro', texto: e.message })
  return (
    <Painel titulo={`${c.codigo} · ${c.nome}`} acoes={gerir && (
      <button type="button" className="btn btn-xs btn-icon btn-danger" title={tx('Apagar cadeira')} onClick={async () => {
        if (await confirmar(tx('Apagar "{0}" com materiais, notas, trabalhos e presenças?', { 0: c.nome }), { titulo: tx('Apagar cadeira'), botao: tx('Apagar'), perigo: true })) api(`/academico/cadeiras/${c.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)
      }}><i className="fa fa-times" /></button>
    )}>
      <div className="d-flex flex-wrap gap-1 mb-2">
        <Link to={`/academico/documentos/cadeira/${c.id}/pauta`} className="btn btn-xs btn-white"><i className="fa fa-print me-1" />{tx('Pauta')}</Link>
        <Link to={`/academico/documentos/cadeira/${c.id}/presencas`} className="btn btn-xs btn-white"><i className="fa fa-user-check me-1" />{tx('Folha de presenças')}</Link>
        <Link to={`/academico/documentos/cadeira/${c.id}/prova`} className="btn btn-xs btn-white"><i className="fa fa-signature me-1" />{tx('Lista para a prova')}</Link>
      </div>
      <div className="d-flex align-items-start gap-2 mb-2 flex-wrap">
        <div className="d-flex gap-1 flex-wrap">
          {c.docentes.length === 0 && <span className="badge bg-warning text-dark"><i className="fa fa-user-clock me-1" />{tx('Docentes por alocar')}</span>}
          {c.docentes.map((d) => <span key={d.id} className={`badge ${d.papel === 'regente' ? 'bg-dark' : 'bg-gray-500'}`}>{d.papel === 'regente' ? tx('Regente') : tx('Assistente')}: {d.nome}</span>)}
        </div>
        <span className="text-muted ms-auto small text-nowrap">{PERIODOS[c.periodo]} · {c.horas} {tx('h')}</span>
        <Link to={`/academico/cadeiras/${c.id}`} className="btn btn-xs btn-primary"><i className="fa fa-cog me-1" />{tx('Docentes, programa e pauta')}</Link>
      </div>
      <table className="table table-sm mb-2">
        <tbody>
          {c.horarios.length === 0 && <tr><td className="text-muted">{tx('Sem horário.')}</td></tr>}
          {c.horarios.map((x) => (
            <tr key={x.id}>
              <td>{DIAS[x.diaSemana]}</td><td>{x.inicio}–{x.fim}</td><td>{x.sala}</td>
              <td className="text-end">{gerir && <button type="button" className="btn btn-xs btn-white text-danger" aria-label={tx('Retirar do horário')} onClick={() => api(`/academico/horarios/${x.id}`, { metodo: 'DELETE' }).then(carregar).catch(falhou)}><i className="fa fa-times" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gerir && (
        <form className="d-flex gap-1 flex-wrap" onSubmit={(e) => { e.preventDefault(); api(`/academico/cadeiras/${c.id}/horarios`, { metodo: 'POST', corpo: h }).then(carregar).catch(falhou) }}>
          <select className="form-select form-select-sm w-auto" value={h.diaSemana} onChange={(e) => setH({ ...h, diaSemana: e.target.value })} aria-label={tx('Dia')}>{DIAS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
          {/* os tempos escolares da ESG (50 minutos): escolher um ou vários seguidos preenche as horas */}
          <select className="form-select form-select-sm w-auto" value={BLOCOS_DE_TEMPOS.findIndex((t) => t.inicio === h.inicio && t.fim === h.fim)} onChange={(e) => { const t = BLOCOS_DE_TEMPOS[Number(e.target.value)]; if (t) setH({ ...h, inicio: t.inicio, fim: t.fim }) }} aria-label={tx('Tempos escolares')}>
            <option value={-1}>{tx('Tempos escolares…')}</option>
            {BLOCOS_DE_TEMPOS.map((t, i) => <option key={i} value={i}>{t.de === t.ate ? tx('{0}.º tempo', { 0: t.de }) : tx('{0}.º ao {1}.º tempo', { 0: t.de, 1: t.ate })} ({t.inicio}–{t.fim})</option>)}
          </select>
          <input type="time" className="form-control form-control-sm w-auto" value={h.inicio} onChange={(e) => setH({ ...h, inicio: e.target.value })} aria-label={tx('Início')} />
          <input type="time" className="form-control form-control-sm w-auto" value={h.fim} onChange={(e) => setH({ ...h, fim: e.target.value })} aria-label={tx('Fim')} />
          <input className="form-control form-control-sm w-auto" placeholder={tx('Sala')} value={h.sala} onChange={(e) => setH({ ...h, sala: e.target.value })} aria-label={tx('Sala')} />
          <button type="submit" className="btn btn-sm btn-default"><i className="fa fa-plus" /> {tx('Horário')}</button>
        </form>
      )}
    </Painel>
  )
}

// a cadeira cria-se sem docentes: a alocação (regente e assistentes) faz-se na ficha da cadeira
function NovaCadeira({ turma, carregar, avisar }) {
  const vazio = { codigo: '', nome: '', periodo: '1', horas: '' }
  const [f, setF] = useState(vazio)
  const [erro, setErro] = useState('')
  async function criar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/academico/turmas/${turma.id}/cadeiras`, { metodo: 'POST', corpo: { ...f, horas: Number(f.horas || 0) } })
      setF(vazio)
      avisar({ texto: tx('Cadeira criada. Aloque os docentes na ficha da cadeira.') })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Painel titulo={tx('Nova cadeira')}>
      <form onSubmit={criar}>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}
        <div className="row g-2">
          <div className="col-md-4"><label className="form-label fw-bold" htmlFor="c-codigo">{tx('Código')}</label><input id="c-codigo" className="form-control" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder={tx('EST101')} required /></div>
          <div className="col-md-8"><label className="form-label fw-bold" htmlFor="c-nome">{tx('Nome')}</label><input id="c-nome" className="form-control" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="c-periodo">{tx('Semestre')}</label><select id="c-periodo" className="form-select" value={f.periodo} onChange={(e) => setF({ ...f, periodo: e.target.value })}>{Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="c-horas">{tx('Horas')}</label><input id="c-horas" type="number" min={0} className="form-control" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></div>
        </div>
        <button type="submit" className="btn btn-theme w-100 mt-3"><i className="fa fa-plus me-1" /> {tx('Criar cadeira')}</button>
      </form>
    </Painel>
  )
}

export default Turma
