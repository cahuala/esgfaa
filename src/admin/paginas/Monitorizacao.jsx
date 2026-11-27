import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'

/*
  Centro de cibersegurança e monitorização: todos os sistemas da Escola Superior de Guerra num só ecrã — o domínio de
  cada um, se responde (e em quanto tempo), a saúde do servidor (processador, memória, disco, base de dados), a
  segurança (alerta, eventos das últimas 24 horas, IP bloqueados, nível de protecção) e as trocas entre os sistemas.
  Separadores: os sistemas (com a disponibilidade das últimas 24 h), a comunicação entre eles (cada troca: quem
  enviou, quanto e o quê), as actualizações (notícias e conteúdos do site, o que mudou no Portal e na Gestão
  Escolar) e o registo de actividades de todos. Actualiza-se sozinho de 30 em 30 segundos.
*/
// o nome das tabelas que se trocam, para se ler bem
const TABELAS = {
  Item: 'Conteúdos do site (notícias, eventos…)', Pagina: 'Páginas do site', Ficheiro: 'Ficheiros', ContaPortal: 'Contas do Portal', Turma: 'Turmas', Matricula: 'Matrículas',
  UnidadeCurricular: 'Cadeiras', Docencia: 'Docentes nas cadeiras', NotaAvaliacaoUc: 'Notas', AvaliacaoUc: 'Avaliações', Nota: 'Notas (pauta)', Notificacao: 'Notificações e avisos',
  AvisoGeral: 'Avisos gerais', Submissao: 'Trabalhos entregues', Material: 'Materiais das cadeiras', Obra: 'Livros (catálogo)', Exemplar: 'Exemplares', Emprestimo: 'Empréstimos', Reserva: 'Reservas',
  CertificadoCurso: 'Diplomas e certificados', Presenca: 'Presenças', Aula: 'Aulas', Mensagem: 'Mensagens', Comentario: 'Comentários do site',
  itens: 'Conteúdos do site (notícias, eventos…)', paginas: 'Páginas do site', contas_portal: 'Contas do Portal', notas_avaliacao_uc: 'Notas', notificacoes: 'Notificações e avisos', submissoes: 'Trabalhos entregues',
}
const nomeTabela = (t) => TABELAS[t] ?? t
const ACCOES = { sistema_sem_resposta: 'Deixou de responder', sistema_voltou: 'Voltou a responder', publicar: 'Publicou', criar: 'Criou', editar: 'Editou', apagar: 'Apagou', entrar: 'Entrou', sair: 'Saiu' }
const hora = (v) => (v ? new Date(v).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'medium' }) : '—')
const resumoModelos = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${nomeTabela(k)} ${n}`).join(' · ')
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

function CartaoSistema({ s, disp }) {
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
          {disp && (
            <div className="mb-2" title={`Desde ${hora(disp.desde)}: ${disp.verificacoes} verificação(ões)`}>
              <div className="d-flex justify-content-between"><span>Disponibilidade (24 h)</span><b className={disp.percentagem >= 99 ? 'text-success' : disp.percentagem >= 95 ? 'text-warning' : 'text-danger'}>{disp.percentagem.toLocaleString('pt-PT')} %{disp.msMedio !== null ? ` · ${disp.msMedio} ms` : ''}</b></div>
              <div className="d-flex gap-px mt-1" style={{ gap: 1 }} aria-hidden="true">{disp.ultimas.map((x, i) => <span key={i} style={{ flex: 1, height: 10, background: x ? '#2e7d32' : '#c62828', borderRadius: 1 }} />)}</div>
            </div>
          )}
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

function Comunicacao({ d }) {
  const [so, setSo] = useState('')
  const lista = d.trocas.filter((t) => !so || (so === 'erros' ? t.erros : t.de === so || t.para === so))
  const sistemas = [...new Set(d.trocas.flatMap((t) => [t.de, t.para]))]
  return (
    <>
      <Painel titulo="Mudanças das últimas 24 horas (o que cada sistema actualizou e recebeu)" corpo={false}>
        <div className="table-responsive"><table className="table table-sm table-striped mb-0">
          <thead><tr><th>Sistema</th><th>O quê</th><th>Origem</th><th className="text-end">Linhas</th></tr></thead>
          <tbody>
            {d.mudancas.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">Sem mudanças nas últimas 24 horas (ou os sistemas ainda não trocam).</td></tr>}
            {[...d.mudancas].sort((a, b) => b.n - a.n).map((m, i) => <tr key={i}><td>{m.sistema}</td><td>{nomeTabela(m.tabela)}</td><td>{m.origem}</td><td className="text-end">{m.n}</td></tr>)}
          </tbody>
        </table></div>
      </Painel>
      <Painel titulo="Trocas entre os sistemas (as mais recentes primeiro)" acoes={
        <select className="form-select form-select-sm w-auto" value={so} onChange={(e) => setSo(e.target.value)} aria-label="Filtrar">
          <option value="">Todas</option><option value="erros">Só com erros</option>
          {sistemas.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      } corpo={false}>
        <div className="table-responsive"><table className="table table-sm table-striped align-middle mb-0">
          <thead><tr><th>Quando</th><th>De → para</th><th className="text-end">Enviadas</th><th className="text-end">Recebidas</th><th>O quê</th><th className="text-end">Tempo</th><th>Estado</th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">Sem trocas registadas desde que os sistemas arrancaram.</td></tr>}
            {lista.map((t, i) => (
              <tr key={i}>
                <td className="text-nowrap small">{hora(t.quando)}</td>
                <td className="text-nowrap"><b>{t.de}</b> → <b>{t.para}</b></td>
                <td className="text-end">{t.enviadas}</td>
                <td className="text-end">{t.recebidas}{t.ficheiros ? <span className="text-muted small"> + {t.ficheiros} fich.</span> : ''}</td>
                <td className="small">{[resumoModelos(t.de === t.par ? t.recebido : t.enviado), resumoModelos(t.de === t.par ? t.enviado : t.recebido)].filter(Boolean).join(' ⇄ ') || <span className="text-muted">nada de novo</span>}</td>
                <td className="text-end small">{t.ms} ms</td>
                <td>{t.erros ? <span className="badge bg-danger" title={t.erro}>{t.erros} erro(s)</span> : <span className="badge bg-success">ok</span>}{t.erro && <div className="small text-danger text-break">{t.erro}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Painel>
    </>
  )
}

function Actualizacoes({ d }) {
  return (
    <Painel titulo="Actualizações do site (notícias, eventos, artigos…)" corpo={false}>
      <div className="table-responsive"><table className="table table-sm table-striped mb-0">
        <thead><tr><th>Quando</th><th>Tipo</th><th>Título</th><th>Estado</th><th>Onde</th></tr></thead>
        <tbody>
          {d.actualizacoes.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">Sem actualizações do site.</td></tr>}
          {d.actualizacoes.map((a, i) => <tr key={i}><td className="text-nowrap small">{hora(a.quando)}</td><td>{a.tipo}</td><td>{a.titulo}</td><td><span className={`badge bg-${a.estado === 'publicado' ? 'success' : 'secondary'}`}>{a.estado}</span></td><td className="small">{a.sistema}</td></tr>)}
        </tbody>
      </table></div>
      <div className="small text-muted p-2">O que muda no Portal dos estudantes e docentes (notas, trabalhos, avisos, contas) vê-se em «Comunicação», nas mudanças das últimas 24 horas.</div>
    </Painel>
  )
}

function Actividade({ d }) {
  const [so, setSo] = useState('')
  const lista = d.actividade.filter((a) => !so || a.sistema === so)
  return (
    <Painel titulo="O que se fez em cada sistema (registo de actividades)" acoes={
      <select className="form-select form-select-sm w-auto" value={so} onChange={(e) => setSo(e.target.value)} aria-label="Sistema">
        <option value="">Todos os sistemas</option>{[...new Set(d.actividade.map((a) => a.sistema))].map((x) => <option key={x}>{x}</option>)}
      </select>
    } corpo={false}>
      <div className="table-responsive"><table className="table table-sm table-striped mb-0">
        <thead><tr><th>Quando</th><th>Sistema</th><th>Quem</th><th>O quê</th><th>Sobre</th></tr></thead>
        <tbody>
          {lista.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">Sem actividade registada.</td></tr>}
          {lista.map((a, i) => <tr key={i} className={a.acao === 'sistema_sem_resposta' ? 'table-danger' : ''}><td className="text-nowrap small">{hora(a.quando)}</td><td className="small">{a.sistema}</td><td>{a.quem}</td><td>{ACCOES[a.acao] ?? a.acao.replace(/_/g, ' ')}</td><td className="small">{a.alvo}</td></tr>)}
        </tbody>
      </table></div>
    </Painel>
  )
}

function EditarLista({ sistemas, aoGuardar, aoFechar }) {
  const [l, setL] = useState(() => sistemas.map(({ id, nome, tipo, dominio, endereco }) => ({ id, nome, tipo, dominio, endereco })))
  const [erro, setErro] = useState('')
  const mudar = (i, k, v) => setL((x) => x.map((s, j) => (j === i ? { ...s, [k]: v } : s)))
  return (
    <Painel titulo="Sistemas a acompanhar">
      <p className="small text-muted">O domínio é o que as pessoas escrevem; o endereço é por onde este sistema os contacta (no mesmo servidor: http://127.0.0.1:porta — Pessoal 3002, Gestão Escolar 3001, Gestão do Site 3003, Biblioteca 3004, Cibersegurança 3005; o servidor online: https://…).</p>
      {erro && <Erro texto={erro} />}
      <div className="table-responsive"><table className="table table-sm align-middle">
        <thead><tr><th>Nome</th><th>Tipo</th><th>Domínio</th><th>Endereço</th><th /></tr></thead>
        <tbody>{l.map((s, i) => (
          <tr key={i}>
            <td><input className="form-control form-control-sm" value={s.nome} onChange={(e) => mudar(i, 'nome', e.target.value)} aria-label="Nome" /></td>
            <td><select className="form-select form-select-sm" value={s.tipo} onChange={(e) => mudar(i, 'tipo', e.target.value)} aria-label="Tipo">{['pessoal', 'escolar', 'site', 'biblioteca', 'online', 'ciberseguranca', 'completo'].map((t) => <option key={t}>{t}</option>)}</select></td>
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
  const [aba, setAba] = useState('sistemas')
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
        <Link to="/seguranca" className="btn btn-white"><i className="fa fa-shield-alt me-1" />Centro de segurança</Link>
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
        <ul className="nav nav-tabs mb-3">
          {[['sistemas', 'fa-server', `Sistemas (${d.sistemas.length})`], ['comunicacao', 'fa-exchange-alt', `Comunicação (${d.trocas.length})`], ['actualizacoes', 'fa-newspaper', 'Actualizações'], ['actividade', 'fa-list', 'Actividade']].map(([k, ic, n]) => (
            <li className="nav-item" key={k}><button type="button" className={`nav-link ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}><i className={`fa ${ic} me-1`} />{n}</button></li>
          ))}
        </ul>
        {aba === 'sistemas' && <>
          {!d.vigilancia && <div className="small text-muted mb-2"><i className="fa fa-info-circle me-1" />A disponibilidade conta-se a cada consulta deste ecrã; no Sistema de Cibersegurança, a vigilância é contínua (de minuto a minuto).</div>}
          <div className="row">{d.sistemas.map((s) => <CartaoSistema key={s.id ?? s.nome} s={s} disp={d.disponibilidade?.[s.id]} />)}</div>
        </>}
        {aba === 'comunicacao' && <Comunicacao d={d} />}
        {aba === 'actualizacoes' && <Actualizacoes d={d} />}
        {aba === 'actividade' && <Actividade d={d} />}
      </>}
    </>
  )
}

export default Monitorizacao
