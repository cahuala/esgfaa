import { useCallback, useEffect, useState } from 'react'
import { abrirFicheiro, api, enviarComProgresso } from '../api'
import { Bloqueio, Cartao, Carregando, Erro, Etiqueta } from '../componentes'
import { dataHora, iconeFicheiro, nota } from '../formatar'
import ZonaUpload from '../ZonaUpload'
import { TabelaGrelha } from './Grelha'

const FASES = [
  ['submissao', 'Entrega'],
  ['avaliacao', 'Avaliação dos colegas'],
  ['encerrado', 'Resultados'],
]

// passos do workshop, com o atual em destaque
function Fases({ w }) {
  const atual = FASES.findIndex(([k]) => k === w.fase)
  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {FASES.map(([k, nome], i) => (
        <span key={k} className={`badge fs-12px ${i === atual ? 'bg-theme' : i < atual ? 'bg-success' : 'bg-light text-muted border'}`}>
          {i < atual ? <i className="fa fa-check me-1" /> : `${i + 1}. `}{nome}
          {k === 'submissao' && ` · até ${dataHora(w.fimSubmissao)}`}
          {k === 'avaliacao' && ` · até ${dataHora(w.fimAvaliacao)}`}
        </span>
      ))}
    </div>
  )
}

const baixar = (f) => abrirFicheiro(f.id, { nome: f.nome, ver: /^(application\/pdf|image\/)/.test(f.tipo) }).catch(() => {})
const Ficheiro = ({ f }) => f && <button type="button" className="btn btn-sm btn-white mt-2" onClick={() => baixar(f)}><i className={`fa ${iconeFicheiro(f.tipo)} me-1`} />{f.nome}</button>

/*
  Avaliação por pares: o estudante entrega, avalia os colegas que lhe calharam e, no fim, vê o que recebeu;
  o docente acompanha as entregas, as avaliações e pode dar a nota final.
*/
function Workshop({ c, eDocente, avisar, recarregar, so }) {
  const resumo = (c.workshops || []).find((x) => x.id === so)
  const [w, setW] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api(`/workshops/${so}`).then(setW).catch((e) => setErro(e.message)), [so])
  useEffect(() => { if (!resumo?.bloqueio) carregar() }, [carregar, resumo?.bloqueio])
  if (resumo?.bloqueio) return <Cartao titulo={resumo.titulo}><Bloqueio motivos={resumo.bloqueio} /></Cartao>
  if (erro) return <Erro texto={erro} />
  if (!w) return <Carregando />

  return (
    <div className="p-coluna">
      <Cartao titulo={<><i className="fa fa-people-arrows me-2" />{w.titulo}</>} acoes={w.anonimo && <span className="badge bg-light text-dark"><i className="fa fa-user-secret me-1" />Anónima</span>}>
        <Fases w={w} />
        {w.enunciado && <p className="p-texto-pre">{w.enunciado}</p>}
        <details>
          <summary className="small fw-bold">Grelha de avaliação ({w.grelha.length} critérios)</summary>
          <div className="mt-2"><TabelaGrelha grelha={w.grelha} /></div>
        </details>
      </Cartao>
      {eDocente
        ? <VistaDocente w={w} avisar={avisar} carregar={carregar} />
        : <VistaEstudante w={w} avisar={avisar} carregar={() => { carregar(); recarregar() }} />}
    </div>
  )
}

function VistaEstudante({ w, avisar, carregar }) {
  const [texto, setTexto] = useState(w.minha?.texto || '')
  const [ficheiros, setFicheiros] = useState([])
  const [aEnviar, setAEnviar] = useState(false)
  async function entregar(e) {
    e.preventDefault()
    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append('texto', texto)
      if (ficheiros[0]) fd.append('ficheiro', ficheiros[0].ficheiro)
      await enviarComProgresso(`/workshops/${w.id}/submissao`, fd, { aoProgresso: (p) => setFicheiros((l) => l.map((x) => ({ ...x, progresso: p }))) })
      avisar({ texto: 'Trabalho entregue. Depois do prazo, vai avaliar trabalhos de colegas.' })
      setFicheiros([])
      carregar()
    } catch (falha) {
      avisar({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <>
      <Cartao titulo={<><i className="fa fa-upload me-2" />O meu trabalho</>}>
        {w.minha && <div className="mb-2"><Etiqueta cor="verde">Entregue</Etiqueta> <span className="small text-muted">{dataHora(w.minha.entregueEm)}</span></div>}
        {w.fase === 'submissao' ? (
          <form onSubmit={entregar} className="p-formulario">
            <textarea className="form-control" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva aqui o trabalho (ou junte um ficheiro)" aria-label="Texto do trabalho" />
            {w.minha?.ficheiro && !ficheiros.length && <div className="small">Ficheiro entregue: <Ficheiro f={w.minha.ficheiro} /></div>}
            <ZonaUpload id={`ws-${w.id}`} ficheiros={ficheiros} aoMudar={setFicheiros} desativado={aEnviar} nota="Um ficheiro (opcional): PDF, Word, imagens…" />
            <div><button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? 'A enviar…' : w.minha ? 'Substituir a entrega' : 'Entregar'}</button></div>
          </form>
        ) : w.minha ? (
          <>{w.minha.texto && <div className="p-texto-entregue">{w.minha.texto}</div>}<Ficheiro f={w.minha.ficheiro} /></>
        ) : <div className="alert alert-secondary mb-0">Não entregou a tempo, por isso não participa na avaliação.</div>}
      </Cartao>

      {w.fase !== 'submissao' && w.avaliacoes.length > 0 && (
        <Cartao titulo={<><i className="fa fa-clipboard-check me-2" />Trabalhos para avaliar ({w.avaliacoes.filter((a) => a.feitaEm).length} de {w.avaliacoes.length})</>} corpo={false}>
          <div className="list-group list-group-flush">
            {w.avaliacoes.map((a, i) => <AvaliarPar key={a.id} a={a} n={i + 1} w={w} avisar={avisar} carregar={carregar} />)}
          </div>
        </Cartao>
      )}

      {w.fase === 'encerrado' && w.minha && (
        <Cartao titulo={<><i className="fa fa-star me-2" />Resultado</>}>
          <div className="d-flex align-items-center gap-3 mb-3">
            <div className="fs-24px fw-bold">{nota(w.nota)}</div>
            <div className="small text-muted">valores · média das avaliações dos colegas{w.minha.notaFinal !== null ? ' (nota revista pelo docente)' : ''}</div>
          </div>
          {w.minha.comentario && <div className="alert alert-info"><b>Comentário do docente:</b> {w.minha.comentario}</div>}
          {w.recebidas.length === 0 && <div className="text-muted">Nenhum colega avaliou o seu trabalho.</div>}
          {w.recebidas.map((r, i) => (
            <div key={i} className="border rounded p-3 mb-2">
              <div className="d-flex justify-content-between mb-2"><b>Avaliação {i + 1}</b><span className="badge bg-success">{nota(r.nota)} valores</span></div>
              <TabelaGrelha grelha={w.grelha} pontos={r.pontos} />
              {r.comentario && <p className="p-texto-pre mb-0 mt-2">{r.comentario}</p>}
            </div>
          ))}
        </Cartao>
      )}
    </>
  )
}

function AvaliarPar({ a, n, w, avisar, carregar }) {
  const [aberto, setAberto] = useState(!a.feitaEm && w.fase === 'avaliacao')
  const [pontos, setPontos] = useState(a.pontos || {})
  const [comentario, setComentario] = useState(a.comentario || '')
  const [aGuardar, setAGuardar] = useState(false)
  const editavel = w.fase === 'avaliacao'
  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/avaliacoes-pares/${a.id}`, { metodo: 'PUT', corpo: { pontos, comentario } })
      avisar({ texto: 'Avaliação guardada.' })
      setAberto(false)
      carregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <div className="list-group-item">
      <div className="d-flex align-items-center gap-2">
        <b className="flex-grow-1">{a.submissao.estudante ? a.submissao.estudante.nome : `Trabalho ${n}`}</b>
        {a.feitaEm ? <span className="badge bg-success">Avaliado · {nota(a.nota)}</span> : <span className="badge bg-warning text-dark">Por avaliar</span>}
        <button type="button" className="btn btn-xs btn-white" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : editavel ? 'Avaliar' : 'Ver'}</button>
      </div>
      {aberto && (
        <div className="mt-3">
          {a.submissao.texto && <div className="p-texto-entregue mb-2">{a.submissao.texto}</div>}
          <Ficheiro f={a.submissao.ficheiro} />
          <div className="mt-3"><TabelaGrelha grelha={w.grelha} pontos={pontos} editavel={editavel} aoMudar={setPontos} /></div>
          <textarea className="form-control mt-2" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} disabled={!editavel} placeholder="Comentário para o colega (o que está bem, o que melhorar)" aria-label={`Comentário do trabalho ${n}`} />
          {editavel && <button type="button" className="btn btn-theme btn-sm mt-2" onClick={guardar} disabled={aGuardar}>{aGuardar ? 'A guardar…' : 'Guardar avaliação'}</button>}
        </div>
      )}
    </div>
  )
}

function VistaDocente({ w, avisar, carregar }) {
  const [aberta, setAberta] = useState(null)
  const feitas = w.submissoes.reduce((s, x) => s + x.avaliacoes.filter((a) => a.feitaEm).length, 0)
  const total = w.submissoes.reduce((s, x) => s + x.avaliacoes.length, 0)
  return (
    <Cartao
      titulo={<><i className="fa fa-inbox me-2" />Entregas e avaliações</>}
      acoes={<span className="text-white small">{w.submissoes.length} de {w.totalEstudantes} entregaram{total ? ` · ${feitas}/${total} avaliações feitas` : ''}</span>}
      corpo={false}
    >
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>Estudante</th><th>Entrega</th><th className="text-center">Avaliações</th><th className="text-center">Média dos pares</th><th className="text-center">Nota</th><th /></tr></thead>
          <tbody>
            {w.submissoes.map((s) => (
              <LinhaSubmissao key={s.id} s={s} w={w} aberta={aberta === s.id} alternar={() => setAberta(aberta === s.id ? null : s.id)} avisar={avisar} carregar={carregar} />
            ))}
            {w.semEntrega.map((e) => (
              <tr key={`sem-${e.id}`} className="text-muted"><td>{e.nome}<div className="small">{e.numero}</div></td><td colSpan={5}>Não entregou{w.fase !== 'submissao' && ' (fica com 0 na pauta)'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

function LinhaSubmissao({ s, w, aberta, alternar, avisar, carregar }) {
  const [notaFinal, setNotaFinal] = useState(s.notaFinal ?? '')
  const [comentario, setComentario] = useState(s.comentario || '')
  async function guardar() {
    try {
      await api(`/submissoes-workshop/${s.id}`, { metodo: 'PUT', corpo: { nota: notaFinal === '' ? null : notaFinal, comentario } })
      avisar({ texto: 'Nota guardada.' })
      carregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }
  return (
    <>
      <tr>
        <td><b>{s.estudante.nome}</b><div className="small text-muted">{s.estudante.numero}</div></td>
        <td className="small">{dataHora(s.entregueEm)}</td>
        <td className="text-center">{s.avaliacoes.filter((a) => a.feitaEm).length} / {s.avaliacoes.length}</td>
        <td className="text-center">{nota(s.notaPares)}</td>
        <td className="text-center fw-bold">{nota(s.nota)}{s.notaFinal !== null && <i className="fa fa-user-edit text-muted ms-1" title="Nota dada pelo docente" />}</td>
        <td className="text-end"><button type="button" className={`btn btn-sm ${aberta ? 'btn-dark' : 'btn-white'}`} onClick={alternar}>{aberta ? 'Fechar' : 'Ver'}</button></td>
      </tr>
      {aberta && (
        <tr>
          <td colSpan={6} className="bg-light">
            <div className="row g-3 py-2">
              <div className="col-lg-6">
                <h4 className="h6 fw-bold">Trabalho</h4>
                {s.texto && <div className="p-texto-entregue mb-2">{s.texto}</div>}
                <Ficheiro f={s.ficheiro} />
                <h4 className="h6 fw-bold mt-3">Nota do docente</h4>
                <div className="d-flex gap-2 align-items-center">
                  <input className="form-control form-control-sm p-nota" inputMode="decimal" value={notaFinal} onChange={(e) => setNotaFinal(e.target.value)} placeholder={nota(s.notaPares)} aria-label={`Nota final de ${s.estudante.nome}`} />
                  <span className="small text-muted">vazio = média dos pares</span>
                </div>
                <textarea className="form-control mt-2" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentário para o estudante" aria-label={`Comentário para ${s.estudante.nome}`} />
                <button type="button" className="btn btn-theme btn-sm mt-2" onClick={guardar}>Guardar</button>
              </div>
              <div className="col-lg-6">
                <h4 className="h6 fw-bold">Avaliações dos colegas</h4>
                {s.avaliacoes.length === 0 && <div className="small text-muted">{w.fase === 'submissao' ? 'Distribuem-se quando terminar a entrega.' : 'Sem avaliações atribuídas.'}</div>}
                {s.avaliacoes.map((a) => (
                  <div key={a.id} className="border rounded p-2 mb-2 bg-white small">
                    <div className="d-flex justify-content-between"><b>{a.avaliador.nome}</b>{a.feitaEm ? <span className="badge bg-success">{nota(a.nota)}</span> : <span className="badge bg-warning text-dark">Por fazer</span>}</div>
                    {a.comentario && <div className="p-texto-pre mt-1">{a.comentario}</div>}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default Workshop
