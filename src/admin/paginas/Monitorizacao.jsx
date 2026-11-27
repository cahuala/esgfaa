import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'

/*
  Centro de cibersegurança e monitorização: todos os sistemas da Escola Superior de Guerra num só ecrã — o domínio de
  cada um, se responde (e em quanto tempo), a saúde do servidor (processador, memória, disco, base de dados), a
  segurança (alerta, eventos das últimas 24 horas, IP bloqueados, nível de protecção) e as trocas entre os sistemas.
  Actualiza-se sozinho de 30 em 30 segundos.
*/
const NIVEL = { critico: 'danger', alto: 'danger', medio: 'warning' }
const bytes = (n) => (n === null || n === undefined ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`)
const tempo = (desde) => {
  if (!desde) return '—'
  const s = Math.max(0, (Date.now() - new Date(desde).getTime()) / 1000)
  return s < 90 ? `há ${Math.round(s)} s` : s < 5400 ? `há ${Math.round(s / 60)} min` : s < 172800 ? `há ${Math.round(s / 3600)} h` : `há ${Math.round(s / 86400)} dias`
}
const ligado = (desde) => {
  if (!desde) return '—'
  const h = (Date.now() - new Date(desde).getTime()) / 3_600_000
  return h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`
}

function Barra({ titulo, valor, texto }) {
  const v = Math.max(0, Math.min(100, Math.round(valor ?? 0)))
  const cor = v >= 90 ? 'bg-danger' : v >= 75 ? 'bg-warning' : 'bg-success'
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small"><span>{titulo}</span><span className="text-muted">{texto}</span></div>
      <div className="progress" style={{ height: 6 }} role="progressbar" aria-label={titulo} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div className={`progress-bar ${cor}`} style={{ width: `${v}%` }} /></div>
    </div>
  )
}

function CartaoSistema({ s }) {
  const e = s.estado
  const m = e?.saude?.memoria
  const d = e?.saude?.disco
  const eventos = e?.dia ? Object.values(e.dia).reduce((a, b) => a + b, 0) : null
  const alerta = e?.alerta?.nivel
  return (
    <div className="col-xl-4 col-md-6 mb-3">
      <div className={`card h-100 border-${s.ok ? (alerta === 'ataque' ? 'danger' : alerta === 'atencao' ? 'warning' : 'success') : 'danger'}`}>
        <div className="card-header d-flex align-items-center gap-2">
          <i className={`fa fa-circle ${s.ok ? 'text-success' : 'text-danger'}`} aria-hidden="true" />
          <div className="flex-grow-1">
            <div className="fw-bold">{s.nome}</div>
            <div className="small"><i className="fa fa-globe me-1 text-muted" />{s.dominio ? <a href={`https://${s.dominio}`} target="_blank" rel="noreferrer">{s.dominio}</a> : '—'}</div>
          </div>
          <span className={`badge bg-${s.ok ? 'success' : 'danger'}`}>{s.ok ? (s.local ? 'este sistema' : `${s.ms} ms`) : 'sem resposta'}</span>
        </div>
        <div className="card-body small">
          {!s.ok && <p className="text-danger mb-2"><i className="fa fa-exclamation-triangle me-1" />{s.erro || 'Não responde.'} <span className="text-muted">({s.endereco})</span></p>}
          {s.ok && !e && <p className="text-muted mb-0">Responde. {s.tipo === 'pessoal' ? 'O Sistema de Pessoal só diz se está ligado.' : 'Sem a chave da troca não se lê o estado completo.'}</p>}
          {e && <>
            <Barra titulo="Processador" valor={e.saude?.processador?.carga} texto={`${e.saude?.processador?.carga ?? 0} % · ${e.saude?.processador?.nucleos ?? '?'} núcleos`} />
            {m && <Barra titulo="Memória do servidor" valor={m.total ? ((m.total - m.livre) / m.total) * 100 : 0} texto={`${bytes(m.total - m.livre)} de ${bytes(m.total)}`} />}
            {d && <Barra titulo="Disco" valor={d.total ? ((d.total - d.livre) / d.total) * 100 : 0} texto={`${bytes(d.livre)} livres de ${bytes(d.total)}`} />}
            <dl className="row mb-0 mt-2">
              <dt className="col-6 fw-normal text-muted">Ligado há</dt><dd className="col-6 mb-1">{ligado(e.saude?.ligadoDesde)}</dd>
              <dt className="col-6 fw-normal text-muted">Base de dados</dt><dd className="col-6 mb-1">{e.baseDados?.ligada ? `${bytes(e.baseDados.tamanho)} · ${e.baseDados.ms} ms · ${e.baseDados.ligacoes ?? '?'} lig.` : <span className="text-danger">desligada</span>}</dd>
              <dt className="col-6 fw-normal text-muted">Segurança</dt><dd className={`col-6 mb-1 ${alerta === 'ataque' ? 'text-danger fw-bold' : alerta === 'atencao' ? 'text-warning fw-bold' : ''}`}>{alerta === 'ataque' ? 'ATAQUE' : alerta === 'atencao' ? 'Atenção' : 'Normal'} · protecção {e.protecao}</dd>
              <dt className="col-6 fw-normal text-muted">Eventos (24 h)</dt><dd className="col-6 mb-1">{eventos ?? '—'} · {e.bloqueios ?? 0} IP bloqueado(s)</dd>
              {e.replicacao && <>
                <dt className="col-6 fw-normal text-muted">Por enviar</dt><dd className="col-6 mb-1">{e.replicacao.porEnviar} linha(s)</dd>
                {e.replicacao.pares.map((p) => (
                  <div className="col-12" key={p.par}>
                    <span className="text-muted">Troca com {p.par}: </span>{tempo(p.ultimaTroca)}
                    {p.ultimoErro && <div className="text-danger text-break">{p.ultimoErro}</div>}
                  </div>
                ))}
              </>}
            </dl>
          </>}
        </div>
      </div>
    </div>
  )
}

function EditarLista({ sistemas, aoGuardar, aoFechar }) {
  const [l, setL] = useState(() => sistemas.map(({ id, nome, tipo, dominio, endereco }) => ({ id, nome, tipo, dominio, endereco })))
  const [erro, setErro] = useState('')
  const mudar = (i, k, v) => setL((x) => x.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  return (
    <Painel titulo="Sistemas a acompanhar">
      <p className="small text-muted">O domínio é o que as pessoas escrevem; o endereço é por onde este sistema os contacta (no mesmo servidor: http://127.0.0.1:porta — Pessoal 3002, Gestão Escolar 3001, Gestão do Site 3003, Biblioteca 3004; o servidor online: https://…).</p>
      {erro && <Erro texto={erro} />}
      <div className="table-responsive"><table className="table table-sm align-middle">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Domínio</th><th>Endereço</th><th /></tr></thead>
        <tbody>{l.map((s, i) => (
          <tr key={i}>
            <td><input className="form-control form-control-sm" value={s.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} aria-label="Nome" /></td>
            <td><select className="form-select form-select-sm" value={s.tipo} onChange={(e) => mudar(i, 'tipo', e.target.value)} aria-label="Tipo">{['pessoal', 'escolar', 'site', 'biblioteca', 'online', 'completo'].map((t) => <option key={t}>{t}</option>)}</select></td>
            <td><input className="form-control form-control-sm" value={s.dominio} onChange={(e) => mudar(i, 'dominio', e.target.value)} aria-label="Domínio" /></td>
            <td><input className="form-control form-control-sm" value={s.endereco} onChange={(e) => mudar(i, 'endereco', e.target.value)} aria-label="Endereço" /></td>
            <td><button type="button" className="btn btn-sm btn-white" onClick={() => setL((x) => x.filter((_, j) => j !== i))} aria-label="Tirar"><i className="fa fa-trash" /></button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-white" onClick={() => setL((x) => [...x, { nome: '', tipo: 'escolar', dominio: '', endereco: 'http://127.0.0.1:' }])}><i className="fa fa-plus me-1" />Acrescentar</button>
        <button type="button" className="btn btn-white ms-auto" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn btn-theme" onClick={() => aoGuardar(l).catch((e) => setErro(e.message))}><i className="fa fa-save me-1" />Guardar</button>
      </div>
    </Painel>
  )
}

function Monitorizacao() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState(false)
  const carregar = useCallback(() => api('/monitorizacao').then((x) => { setErro(''); setD(x) }).catch((e) => setErro(e.message)), [])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 30_000)
    return () => clearInterval(t)
  }, [carregar])
  const guardar = async (sistemas) => { setD(await api('/monitorizacao/sistemas', { metodo: 'PUT', corpo: { sistemas } })); setEditar(false) }
  const fora = d?.sistemas.filter((s) => !s.ok).length ?? 0
  return (
    <>
      <CabecalhoPagina titulo="Cibersegurança e monitorização" subtitulo="todos os sistemas da Escola Superior de Guerra: domínio, estado, servidor, segurança e trocas" migalhas={[{ rotulo: 'Segurança' }, { rotulo: 'Monitorização' }]}>
        <button type="button" className="btn btn-white" onClick={carregar}><i className="fa fa-sync me-1" />Actualizar</button>
        {d?.podeEditar && <button type="button" className="btn btn-white" onClick={() => setEditar(true)}><i className="fa fa-cog me-1" />Sistemas</button>}
      </CabecalhoPagina>
      {erro && <Erro texto={erro} onRepetir={carregar} />}
      {!d && !erro && <Carregando />}
      {editar && d && <EditarLista sistemas={d.sistemas} aoGuardar={guardar} aoFechar={() => setEditar(false)} />}
      {d && <>
        <div className={`alert alert-${fora || d.alertas.some((a) => a.nivel === 'critico') ? 'danger' : d.alertas.length ? 'warning' : 'success'} d-flex align-items-center gap-2`}>
          <i className={`fa ${d.alertas.length ? 'fa-exclamation-triangle' : 'fa-shield-alt'} fa-lg`} />
          <div>
            <b>{d.sistemas.length - fora} de {d.sistemas.length} sistemas a responder.</b>{' '}
            {d.alertas.length ? `${d.alertas.length} alerta(s).` : 'Sem alertas.'}
            <span className="small text-muted ms-2">Actualizado {new Date(d.geradoEm).toLocaleTimeString('pt-PT')}</span>
          </div>
        </div>
        {d.alertas.length > 0 && (
          <Painel titulo="Alertas">
            <ul className="list-unstyled mb-0">{d.alertas.map((a, i) => <li key={i} className="mb-1"><span className={`badge bg-${NIVEL[a.nivel] ?? 'secondary'} me-2`}>{a.nivel}</span><b>{a.sistema}</b>: {a.texto}</li>)}</ul>
          </Painel>
        )}
        <div className="row">{d.sistemas.map((s) => <CartaoSistema key={s.id ?? s.nome} s={s} />)}</div>
      </>}
    </>
  )
}

export default Monitorizacao
