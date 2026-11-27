import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../../componentes/Ui'
import FotoConta from '../../componentes/FotoConta'
import { useSessao } from '../../sessaoContexto'
import { t as tx } from '../../../i18n/linguas'

/*
  Os docentes de cada cadeira, tirados dos horários mensais do arquivo: o sistema procurou cada nome do horário nas
  fichas dos docentes (vindas do Sistema de Pessoal) e já marcou o que encontrou sem dúvida; a Repartição confere
  (com a fotografia, o posto e o NIP) e confirma. Os de anos anteriores ficam logo nas cadeiras; os do ano em curso
  seguem para o Comandante, como a distribuição do serviço docente.
*/
function DocentesHorarios() {
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [marcados, setMarcados] = useState({}) // `${cadeiraId}:${docenteId}` → true
  const [ano, setAno] = useState('')
  const [aGravar, setAGravar] = useState(false)

  const aplicar = (x) => {
    setD(x)
    // marca as sugestões sem dúvida (um só docente encontrado) que ainda não estão na cadeira
    const m = {}
    for (const c of x.cadeiras) for (const s of c.sugestoes) if (s.sugerido && !s.jaNaCadeira) m[`${c.cadeiraId}:${s.sugerido}`] = true
    setMarcados(m)
  }
  const carregar = useCallback(() => api('/academico/arquivo/docentes-horarios').then((x) => { setErro(''); aplicar(x) }).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} onRepetir={carregar} />
  if (!d) return <Carregando />

  const anos = [...new Set(d.cadeiras.map((c) => c.anoLetivo))]
  const vistas = d.cadeiras.filter((c) => !ano || c.anoLetivo === ano)
  const escolhas = Object.entries(marcados).filter(([, v]) => v).map(([k]) => { const [cadeiraId, docenteId] = k.split(':').map(Number); return { cadeiraId, docenteId } })
  const marcar = (c, id, v) => setMarcados((m) => ({ ...m, [`${c}:${id}`]: v }))
  async function confirmar() {
    setAGravar(true)
    try {
      const r = await api('/academico/arquivo/docentes-horarios', { metodo: 'POST', corpo: { escolhas } })
      aplicar(r)
      setAviso({ texto: tx('{0} docente(s) ficaram nas cadeiras.', { 0: r.feitas }) })
    } catch (e) { setAviso({ tipo: 'erro', texto: e.message }) } finally { setAGravar(false) }
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Docentes dos horários do arquivo')} subtitulo={tx('{0} cadeira(s) com docentes nos horários mensais — confira e confirme', { 0: d.cadeiras.length })} migalhas={[{ rotulo: tx('Administração Escolar') }, { rotulo: tx('Docentes nas cadeiras'), para: '/academico/alocacao' }, { rotulo: tx('Dos horários') }]}>
        {anos.length > 1 && <select className="form-select w-auto" value={ano} onChange={(e) => setAno(e.target.value)} aria-label={tx('Ano lectivo')}><option value="">{tx('Todos os anos')}</option>{anos.map((a) => <option key={a}>{a}</option>)}</select>}
        {gerir && <button type="button" className="btn btn-theme" disabled={!escolhas.length || aGravar} onClick={confirmar}><i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-check'} me-1`} />{tx('Confirmar os marcados ({0})', { 0: escolhas.length })}</button>}
      </CabecalhoPagina>
      {d.linhas === 0 && <Painel titulo={tx('Sem horários')}><p className="mb-0 text-muted">{tx('Os horários do arquivo ainda não foram carregados (vêm no pendrive, em CARREGAR\\docentes-horarios.json, e entram com a actualização da Gestão Escolar).')}</p></Painel>}
      <div className="alert alert-light border small">
        <i className="fa fa-info-circle me-1" />{tx('Já vem marcado o docente que o sistema encontrou sem dúvida nas fichas do Pessoal. Quando há várias pessoas possíveis, escolha a certa pela fotografia, pelo posto e pelo NIP. Quem não aparece ainda não chegou do Sistema de Pessoal.')}
      </div>
      {vistas.map((c) => (
        <Painel key={c.cadeiraId} titulo={<>{c.codigo} — {c.nome} <span className="fw-normal opacity-75">· {c.turma} · {c.anoLetivo}</span></>} acoes={<Link to={`/academico/cadeiras/${c.cadeiraId}?separador=docentes`} className="btn btn-xs btn-white">{tx('Abrir a cadeira')}</Link>}>
          {c.atuais.length > 0 && <div className="small mb-2"><b>{tx('Já na cadeira:')}</b> {c.atuais.map((x) => `${x.nome}${x.estado === 'proposta' ? ` (${tx('à espera do Comandante')})` : ''}`).join(', ')}</div>}
          <div className="small text-muted mb-2">{tx('No horário:')} {c.texto.join(' · ')}</div>
          <div className="row g-2">
            {c.sugestoes.map((s) => (
              <div key={s.texto} className="col-xl-4 col-md-6">
                <div className="border rounded p-2 h-100">
                  <div className="fw-bold small mb-1">«{s.texto}»</div>
                  {s.candidatos.length === 0 && <div className="small text-warning"><i className="fa fa-question-circle me-1" />{tx('Não encontrado nas fichas dos docentes.')}</div>}
                  {s.candidatos.map((p) => {
                    const ja = c.atuais.some((x) => x.id === p.id)
                    const k = `${c.cadeiraId}:${p.id}`
                    return (
                      <label key={p.id} className={`d-flex align-items-center gap-2 py-1 ${ja ? 'opacity-50' : ''}`}>
                        <input type="checkbox" className="form-check-input" disabled={!gerir || ja} checked={ja || Boolean(marcados[k])} onChange={(e) => marcar(c.cadeiraId, p.id, e.target.checked)} />
                        <FotoConta id={p.id} nome={p.nome} temFoto={p.temFoto} tamanho={40} />
                        <span className="small"><b>{[p.posto, p.nome].filter(Boolean).join(' ')}</b>{p.nip && <span className="text-muted"> · NIP {p.nip}</span>}{ja && <span className="badge bg-success ms-1">{tx('já está')}</span>}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Painel>
      ))}
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default DocentesHorarios
