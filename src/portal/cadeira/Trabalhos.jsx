import { useCallback, useEffect, useState } from 'react'
import { abrirFicheiro, api, enviarComProgresso } from '../api'
import ZonaUpload from '../ZonaUpload'
import { Bloqueio, Campo, Cartao, Etiqueta, Vazio } from '../componentes'
import { dataHora, faltam, iconeFicheiro, localParaIso, nota, tamanho, paraLocal } from '../formatar'
import { EditorGrelha, TabelaGrelha } from './Grelha'
import { confirmar } from '../dialogos'

const ESTADO = { aberto: ['verde', 'Aberto'], atrasado: ['dourado', 'Fora de prazo (aceita atrasos)'], fechado: ['cinzento', 'Fechado'] }
const TIPOS_ENTREGA = { ficheiro: 'Ficheiros', texto: 'Texto escrito no portal', ambos: 'Ficheiros e texto' }

// lista de ficheiros (entrega ou correção), cada um com descarregar
function ListaFicheiros({ ficheiros, baixar }) {
  return (
    <div className="list-group mb-2">
      {ficheiros.map((f) => (
        <button key={f.id} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2" onClick={() => baixar(f.id, f.nome)}>
          <i className={`fa ${iconeFicheiro(f.tipo)} fa-lg`} />
          <span className="flex-grow-1 text-truncate">{f.nome}</span>
          <small className="text-muted">{tamanho(f.tamanho)}</small>
          <i className="fa fa-download text-muted" />
        </button>
      ))}
    </div>
  )
}

// um trabalho (aberto a partir da página da cadeira): enunciado, entrega do estudante ou entregas para o docente
function Trabalhos({ c, eDocente, recarregar, avisar, so }) {
  const lista = so ? c.trabalhos.filter((t) => t.id === so) : c.trabalhos
  const baixar = (id, nome) => abrirFicheiro(id, { nome }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))
  const [definicoes, setDefinicoes] = useState(false)

  return (
    <div className="p-coluna">
      {lista.length === 0 && <Vazio>Trabalho não encontrado.</Vazio>}
      {lista.map((t) => (
        <div key={t.id}>
          <Cartao titulo={<><i className="fa fa-file-signature me-2" />{t.titulo}</>} acoes={<Etiqueta cor={ESTADO[t.estado][0]}>{ESTADO[t.estado][1]}</Etiqueta>}>
            <div className="d-flex flex-wrap gap-3 small mb-2">
              <span><i className="far fa-clock me-1" />Prazo: <b>{dataHora(t.prazo)}</b> · {faltam(t.prazo)}</span>
              {t.prorrogado && <span className="badge bg-info">Prazo alargado para si (o geral era {dataHora(t.prazoOriginal)})</span>}
              <span><i className="fa fa-inbox me-1" />{TIPOS_ENTREGA[t.tipoEntrega]}{t.tipoEntrega !== 'texto' && ` · até ${t.maxFicheiros} ficheiro(s)`}</span>
              {t.aceitaAtraso && <span className="text-warning"><i className="fa fa-exclamation-triangle me-1" />Aceita entregas fora de prazo</span>}
              {t.emGrupo && <span className="badge bg-indigo"><i className="fa fa-users me-1" />Trabalho em grupo</span>}
            </div>
            {t.enunciado && <p className="p-texto-pre">{t.enunciado}</p>}
            {t.ficheiroId && <button type="button" className="btn btn-white btn-sm mb-2" onClick={() => baixar(t.ficheiroId, `Enunciado - ${t.titulo}`)}><i className="fa fa-download me-1" />Enunciado</button>}
            {t.grelha?.length > 0 && (
              <details className="mb-2">
                <summary className="small fw-bold">Grelha de avaliação ({t.grelha.length} critérios)</summary>
                <div className="mt-2"><TabelaGrelha grelha={t.grelha} /></div>
              </details>
            )}
            {eDocente ? (
              <div className="p-acoes-linha">
                <button type="button" className="btn btn-white btn-sm" onClick={() => setDefinicoes(!definicoes)}><i className="fa fa-cog me-1" />Definições</button>
                <button type="button" className="btn btn-white btn-sm text-danger" onClick={async () => {
                  if (!(await confirmar(`Apagar "${t.titulo}" e todas as entregas?`, { titulo: 'Apagar trabalho', botao: 'Apagar', perigo: true }))) return
                  await api(`/trabalhos/${t.id}`, { metodo: 'DELETE' }).then(recarregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
                }}><i className="fa fa-trash-alt me-1" />Apagar</button>
              </div>
            ) : t.bloqueio ? <Bloqueio motivos={t.bloqueio} /> : <MinhaEntrega t={t} grupo={c.meuGrupo} recarregar={recarregar} avisar={avisar} baixar={baixar} />}
          </Cartao>
          {eDocente && definicoes && <Definicoes t={t} avisar={avisar} guardado={() => { setDefinicoes(false); recarregar() }} />}
          {eDocente && <Entregas trabalho={t} avisar={avisar} baixar={baixar} />}
        </div>
      ))}
    </div>
  )
}

// ---------- estudante ----------

function MinhaEntrega({ t, grupo, recarregar, avisar, baixar }) {
  const e = t.entrega
  const [ficheiros, setFicheiros] = useState([])
  const [escrito, setEscrito] = useState(e?.texto || '')
  const [comentario, setComentario] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState(!e)
  const podeEntregar = t.estado !== 'fechado' && !(e && e.nota !== null) && (!t.emGrupo || Boolean(grupo))
  const querFicheiros = t.tipoEntrega !== 'texto'
  const querTexto = t.tipoEntrega !== 'ficheiro'

  async function entregar(ev) {
    ev.preventDefault()
    setErro('')
    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append('comentario', comentario)
      if (querTexto) fd.append('texto', escrito)
      for (const x of ficheiros) fd.append('ficheiros', x.ficheiro)
      await enviarComProgresso(`/trabalhos/${t.id}/entrega`, fd, { aoProgresso: (p) => setFicheiros((l) => l.map((x) => ({ ...x, progresso: p }))) })
      avisar({ texto: 'Trabalho entregue.' })
      setEditar(false)
      setFicheiros([])
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <div className="p-entrega">
      <h3 className="h6 fw-bold mb-2">{t.emGrupo ? `Entrega do grupo${grupo ? ` ${grupo.nome}` : ''}` : 'A minha entrega'}</h3>
      {t.emGrupo && (grupo
        ? <p className="small text-muted mb-2"><i className="fa fa-users me-1" />{grupo.membros.map((m) => m.nome).join(', ')}. Qualquer membro entrega pelo grupo; a nota vale para todos.{e?.estudante ? ` Última entrega: ${e.estudante.nome}.` : ''}</p>
        : <div className="alert alert-warning py-2 small">Este trabalho é em grupo e ainda não está em nenhum grupo. Fale com o docente.</div>)}
      {e ? (
        <div className="mb-2">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <Etiqueta cor={e.atrasada ? 'dourado' : 'verde'}>{e.atrasada ? 'Entregue com atraso' : 'Entregue'}</Etiqueta>
            <span className="small text-muted">{dataHora(e.entregueEm)}</span>
          </div>
          {e.ficheiros.length > 0 && <ListaFicheiros ficheiros={e.ficheiros} baixar={baixar} />}
          {e.texto && <div className="p-texto-entregue mb-2">{e.texto}</div>}
          {e.nota !== null || e.correcao || e.correcaoFicheiroId ? (
            <div className="p-correcao">
              <div className="d-flex align-items-center gap-2 mb-1"><i className="fa fa-check-double text-success" /><b>Correção</b>{e.nota !== null && <span className="badge bg-success fs-12px">{nota(e.nota)} valores</span>}</div>
              {t.grelha?.length > 0 && Object.keys(e.grelha || {}).length > 0 && <div className="my-2"><TabelaGrelha grelha={t.grelha} pontos={e.grelha} /></div>}
              {e.correcao && <p className="p-texto-pre mb-1">{e.correcao}</p>}
              {e.correcaoFicheiroId && <button type="button" className="btn btn-sm btn-white" onClick={() => baixar(e.correcaoFicheiroId, `Correção - ${t.titulo}`)}><i className="fa fa-download me-1" />Ficheiro corrigido pelo docente</button>}
            </div>
          ) : null}
        </div>
      ) : <Etiqueta cor={t.estado === 'fechado' ? 'vermelho' : 'cinzento'}>{t.estado === 'fechado' ? 'Não entregue' : 'Por entregar'}</Etiqueta>}

      {podeEntregar && !editar && <button type="button" className="btn btn-white btn-sm" onClick={() => setEditar(true)}><i className="fa fa-redo me-1" />Substituir a entrega</button>}
      {podeEntregar && editar && (
        <form onSubmit={entregar} className="p-formulario p-entrega-form">
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          {querFicheiros && (
            <ZonaUpload id={`f-${t.id}`} multiplos={t.maxFicheiros > 1} ficheiros={ficheiros} aoMudar={(l) => setFicheiros(l.slice(0, t.maxFicheiros))} desativado={aEnviar}
              nota={`PDF, Word, PowerPoint, Excel, imagens ou ZIP — até ${t.maxFicheiros} ficheiro(s).`} />
          )}
          {querTexto && (
            <Campo id={`txt-${t.id}`} rotulo="Texto do trabalho" ajuda={`${escrito.trim() ? escrito.trim().split(/\s+/).length : 0} palavras`}>
              <textarea id={`txt-${t.id}`} rows={10} value={escrito} onChange={(x) => setEscrito(x.target.value)} maxLength={50000} />
            </Campo>
          )}
          <Campo id={`c-${t.id}`} rotulo="Comentário para o docente (opcional)">
            <textarea id={`c-${t.id}`} rows={2} maxLength={2000} value={comentario} onChange={(x) => setComentario(x.target.value)} />
          </Campo>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme" disabled={aEnviar || (t.tipoEntrega === 'ficheiro' && !ficheiros.length) || (t.tipoEntrega === 'texto' && !escrito.trim())}>
              <i className="fa fa-paper-plane me-1" />{aEnviar ? 'A enviar…' : 'Entregar'}
            </button>
            {e && <button type="button" className="btn btn-white" onClick={() => setEditar(false)} disabled={aEnviar}>Cancelar</button>}
          </div>
        </form>
      )}
    </div>
  )
}

// ---------- docente ----------

function Definicoes({ t, avisar, guardado }) {
  const [f, setF] = useState({ titulo: t.titulo, enunciado: t.enunciado, prazo: paraLocal(t.prazo), aceitaAtraso: t.aceitaAtraso, tipoEntrega: t.tipoEntrega, maxFicheiros: t.maxFicheiros, emGrupo: t.emGrupo })
  const [grelha, setGrelha] = useState(t.grelha || [])
  const [erro, setErro] = useState('')
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/trabalhos/${t.id}`, { metodo: 'PUT', corpo: { ...f, prazo: localParaIso(f.prazo), maxFicheiros: Number(f.maxFicheiros), grelha: grelha.map((c) => ({ ...c, pontos: Number(c.pontos) })) } })
      avisar({ texto: 'Definições do trabalho guardadas.' })
      guardado()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-cog me-2" />Definições do trabalho</>}>
      <form onSubmit={guardar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="dt-titulo" rotulo="Título"><input id="dt-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required /></Campo>
        <Campo id="dt-enunciado" rotulo="Enunciado"><textarea id="dt-enunciado" rows={4} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} /></Campo>
        <div className="row g-2">
          <div className="col-md-4"><Campo id="dt-prazo" rotulo="Prazo"><input id="dt-prazo" type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} required /></Campo></div>
          <div className="col-md-4"><Campo id="dt-tipo" rotulo="Forma de entrega"><select id="dt-tipo" value={f.tipoEntrega} onChange={(e) => setF({ ...f, tipoEntrega: e.target.value })}>{Object.entries(TIPOS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo></div>
          <div className="col-md-4"><Campo id="dt-max" rotulo="Máximo de ficheiros"><input id="dt-max" type="number" min={1} max={10} value={f.maxFicheiros} disabled={f.tipoEntrega === 'texto'} onChange={(e) => setF({ ...f, maxFicheiros: e.target.value })} /></Campo></div>
        </div>
        <label className="p-caixa"><input type="checkbox" checked={f.aceitaAtraso} onChange={(e) => setF({ ...f, aceitaAtraso: e.target.checked })} /> Aceitar entregas depois do prazo (ficam marcadas como atrasadas)</label>
        <label className="p-caixa"><input type="checkbox" checked={f.emGrupo} onChange={(e) => setF({ ...f, emGrupo: e.target.checked })} /> Trabalho em grupo (uma entrega por grupo; a nota vale para todos os membros)</label>
        <div><span className="form-label fw-bold d-block mb-1">Grelha de avaliação</span><EditorGrelha grelha={grelha} aoMudar={setGrelha} /></div>
        <div><button type="submit" className="btn btn-theme">Guardar definições</button></div>
      </form>
    </Cartao>
  )
}

// docente: estudantes, entregas, correção (nota ou grelha, comentário, ficheiro) e prorrogações
function Entregas({ trabalho, avisar, baixar }) {
  const [d, setD] = useState(null)
  const [aberta, setAberta] = useState(null) // estudante cuja entrega está aberta
  const carregar = useCallback(() => api(`/trabalhos/${trabalho.id}/entregas`).then(setD).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [trabalho.id, avisar])
  useEffect(() => { carregar() }, [carregar])
  if (!d) return <Cartao titulo="Entregas"><p className="p-texto-suave mb-0">A carregar entregas…</p></Cartao>

  const entregues = d.linhas.filter((l) => l.entrega).length
  const corrigidas = d.linhas.filter((l) => l.entrega?.nota !== null && l.entrega?.nota !== undefined).length
  return (
    <Cartao
      titulo={<><i className="fa fa-inbox me-2" />Entregas</>}
      acoes={<span className="text-white small">{entregues} de {d.linhas.length} entregaram · {corrigidas} corrigida(s)</span>}
      corpo={false}
    >
      <div className="progress rounded-0" style={{ height: 4 }}><div className="progress-bar bg-success" style={{ width: `${d.linhas.length ? (entregues / d.linhas.length) * 100 : 0}%` }} /></div>
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Estudante</th><th>Entrega</th><th className="text-center">Nota</th><th /></tr></thead>
          <tbody>
            {(trabalho.emGrupo ? [...d.linhas].sort((a, b) => (a.grupo?.nome ?? '\uffff').localeCompare(b.grupo?.nome ?? '\uffff', 'pt', { numeric: true })) : d.linhas).map(({ estudante, entrega, prorrogacao, grupo }) => (
              <LinhaEntrega key={estudante.id} t={trabalho} estudante={estudante} entrega={entrega} prorrogacao={prorrogacao} grupo={grupo}
                aberta={aberta === estudante.id} alternar={() => setAberta(aberta === estudante.id ? null : estudante.id)} baixar={baixar} avisar={avisar} recarregar={carregar} />
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

function LinhaEntrega({ t, estudante, entrega, prorrogacao, grupo, aberta, alternar, baixar, avisar, recarregar }) {
  const [notaManual, setNotaManual] = useState(entrega?.nota ?? '')
  const [pontos, setPontos] = useState(entrega?.grelha || {})
  const [correcao, setCorrecao] = useState(entrega?.correcao || '')
  const [ficheiroCorrecao, setFicheiroCorrecao] = useState([])
  const [prazo, setPrazo] = useState(paraLocal(prorrogacao?.prazo))
  const [motivo, setMotivo] = useState(prorrogacao?.motivo || '')
  const [aGuardar, setAGuardar] = useState(false)
  const comGrelha = t.grelha?.length > 0

  async function corrigir() {
    setAGuardar(true)
    try {
      const fd = new FormData()
      fd.append('correcao', correcao)
      if (comGrelha) fd.append('grelha', JSON.stringify(pontos))
      else fd.append('nota', String(notaManual))
      if (ficheiroCorrecao[0]) fd.append('ficheiro', ficheiroCorrecao[0].ficheiro)
      await enviarComProgresso(`/entregas/${entrega.id}`, fd, { metodo: 'PUT' })
      avisar({ texto: `Correção de ${estudante.nome} guardada. O estudante foi avisado.` })
      setFicheiroCorrecao([])
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }

  async function prorrogar(retirar) {
    try {
      await api(`/trabalhos/${t.id}/prorrogacao`, { metodo: 'PUT', corpo: { estudanteId: estudante.id, prazo: retirar ? null : localParaIso(prazo), motivo } })
      avisar({ texto: retirar ? 'Prorrogação retirada.' : `Prazo alargado para ${estudante.nome}.` })
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }

  return (
    <>
      <tr className={aberta ? 'table-active' : ''}>
        <td>
          <b>{estudante.nome}</b><div className="small text-muted">{estudante.numero}</div>
          {t.emGrupo && (grupo ? <span className="badge bg-indigo me-1"><i className="fa fa-users me-1" />{grupo.nome}</span> : <span className="badge bg-warning text-dark me-1">Sem grupo</span>)}
          {prorrogacao && <span className="badge bg-info">Prazo até {dataHora(prorrogacao.prazo)}</span>}
        </td>
        <td className="small">
          {entrega ? <><Etiqueta cor={entrega.atrasada ? 'dourado' : 'verde'}>{entrega.atrasada ? 'Atrasada' : 'Entregue'}</Etiqueta> <span className="text-muted">{dataHora(entrega.entregueEm)}</span>
            <div className="text-muted">{entrega.ficheiros.length} ficheiro(s){entrega.texto && ' · texto'}{entrega.grupo && entrega.estudante && entrega.estudanteId !== estudante.id ? ` · entregue por ${entrega.estudante.nome}` : ''}</div></> : <span className="text-muted">Não entregou</span>}
        </td>
        <td className="text-center fw-bold">{entrega?.nota !== null && entrega?.nota !== undefined ? nota(entrega.nota) : '—'}</td>
        <td className="text-end"><button type="button" className={`btn btn-sm ${aberta ? 'btn-dark' : 'btn-white'}`} onClick={alternar}>{entrega ? (aberta ? 'Fechar' : 'Ver e corrigir') : (aberta ? 'Fechar' : 'Prazo')}</button></td>
      </tr>
      {aberta && (
        <tr>
          <td colSpan={4} className="bg-light">
            <div className="row g-3 py-2">
              {entrega && (
                <div className="col-lg-6">
                  <h4 className="h6 fw-bold">Entrega</h4>
                  {entrega.ficheiros.length > 0 && <ListaFicheiros ficheiros={entrega.ficheiros} baixar={baixar} />}
                  {entrega.texto && <div className="p-texto-entregue mb-2">{entrega.texto}</div>}
                  {entrega.comentario && <div className="small"><b>Comentário do estudante:</b> “{entrega.comentario}”</div>}
                </div>
              )}
              <div className={entrega ? 'col-lg-6' : 'col-12'}>
                {entrega && (
                  <>
                    <h4 className="h6 fw-bold">Correção</h4>
                    {comGrelha
                      ? <TabelaGrelha grelha={t.grelha} pontos={pontos} editavel aoMudar={setPontos} />
                      : <div className="d-flex align-items-center gap-2 mb-2"><label htmlFor={`n-${estudante.id}`} className="fw-bold small">Nota (0 a 20)</label><input id={`n-${estudante.id}`} className="form-control form-control-sm p-nota" inputMode="decimal" value={notaManual} onChange={(e) => setNotaManual(e.target.value)} aria-label={`Nota de ${estudante.nome}`} /></div>}
                    <textarea className="form-control my-2" rows={3} placeholder="Comentário para o estudante" value={correcao} onChange={(e) => setCorrecao(e.target.value)} aria-label={`Comentário para ${estudante.nome}`} />
                    <ZonaUpload id={`fc-${entrega.id}`} ficheiros={ficheiroCorrecao} aoMudar={setFicheiroCorrecao} nota="Ficheiro corrigido para o estudante (opcional)." desativado={aGuardar} />
                    {entrega.correcaoFicheiroId && !ficheiroCorrecao.length && <button type="button" className="btn btn-link btn-sm px-0" onClick={() => baixar(entrega.correcaoFicheiroId, 'Correção')}><i className="fa fa-paperclip me-1" />Ficheiro de correção já enviado</button>}
                    <div className="mt-2"><button type="button" className="btn btn-theme btn-sm" onClick={corrigir} disabled={aGuardar}><i className="fa fa-save me-1" />{aGuardar ? 'A guardar…' : 'Guardar correção'}</button></div>
                  </>
                )}
                <h4 className="h6 fw-bold mt-3">Prorrogação do prazo só para este estudante</h4>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <input type="datetime-local" className="form-control form-control-sm w-auto" value={prazo} onChange={(e) => setPrazo(e.target.value)} aria-label={`Novo prazo para ${estudante.nome}`} />
                  <input className="form-control form-control-sm w-auto flex-grow-1" placeholder="Motivo (ex.: missão de serviço)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo da prorrogação" />
                  <button type="button" className="btn btn-white btn-sm" disabled={!prazo} onClick={() => prorrogar(false)}><i className="fa fa-calendar-plus me-1" />Alargar</button>
                  {prorrogacao && <button type="button" className="btn btn-white btn-sm text-danger" onClick={() => prorrogar(true)}>Retirar</button>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default Trabalhos
