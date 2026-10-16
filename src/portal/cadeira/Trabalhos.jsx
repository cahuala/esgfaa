import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { abrirFicheiro, api, carregarFicheiro, enviarComProgresso } from '../api'
import ZonaUpload from '../ZonaUpload'
import VerFicheiro from '../VerFicheiro'
import AnotarPdf from '../corrigir/AnotarPdf'
import { gerarPdfCorrigido } from '../corrigir/gerarPdf'
import { Bloqueio, Campo, Cartao, Etiqueta, Vazio } from '../componentes'
import { dataHora, faltam, iconeFicheiro, localParaIso, nota, tamanho, paraLocal } from '../formatar'
import { EditorGrelha, TabelaGrelha } from './Grelha'
import { confirmar } from '../dialogos'
import { ChipIA, ChipOriginalidade } from '../integridade/Relatorio'
import { t as tx, localAtual } from '../../i18n/linguas'
import OpcoesCorrecao from './OpcoesCorrecao'
import { camposCorrecao } from './correcao'

const ESTADO = { aberto: ['verde', tx('Aberto')], atrasado: ['dourado', tx('Fora de prazo (aceita atrasos)')], fechado: ['cinzento', tx('Fechado')] }
const TIPOS_ENTREGA = { ficheiro: tx('Ficheiros'), texto: tx('Texto escrito no portal'), ambos: tx('Ficheiros e texto') }

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
      {lista.length === 0 && <Vazio>{tx('Trabalho não encontrado.')}</Vazio>}
      {lista.map((t) => (
        <div key={t.id}>
          <Cartao titulo={<><i className="fa fa-file-signature me-2" />{t.titulo}</>} acoes={<Etiqueta cor={ESTADO[t.estado][0]}>{ESTADO[t.estado][1]}</Etiqueta>}>
            <div className="d-flex flex-wrap gap-3 small mb-2">
              <span><i className="far fa-clock me-1" />{tx('Prazo:')} <b>{dataHora(t.prazo)}</b> · {faltam(t.prazo)}</span>
              {t.prorrogado && <span className="badge bg-info">{tx('Prazo alargado para si (o geral era')} {dataHora(t.prazoOriginal)})</span>}
              <span><i className="fa fa-inbox me-1" />{TIPOS_ENTREGA[t.tipoEntrega]}{t.tipoEntrega !== 'texto' && tx(' · até {0} ficheiro(s)', { 0: t.maxFicheiros })}</span>
              {t.aceitaAtraso && <span className="text-warning"><i className="fa fa-exclamation-triangle me-1" />{tx('Aceita entregas fora de prazo')}</span>}
              {t.emGrupo && <span className="badge bg-indigo"><i className="fa fa-users me-1" />{tx('Trabalho em grupo')}</span>}
              {t.anonimo ? <span className="badge bg-dark"><i className="fa fa-user-secret me-1" />{tx('Correção anónima')}</span>
                : t.notasOcultas && <span className="badge bg-secondary"><i className="fa fa-eye-slash me-1" />{tx('Notas publicadas todas de uma vez')}</span>}
            </div>
            {t.enunciado && <p className="p-texto-pre">{t.enunciado}</p>}
            {t.ficheiroId && <button type="button" className="btn btn-white btn-sm mb-2" onClick={() => baixar(t.ficheiroId, `Enunciado - ${t.titulo}`)}><i className="fa fa-download me-1" />{tx('Enunciado')}</button>}
            {t.grelha?.length > 0 && (
              <details className="mb-2">
                <summary className="small fw-bold">{tx('Grelha de avaliação (')}{t.grelha.length} {tx('critérios)')}</summary>
                <div className="mt-2"><TabelaGrelha grelha={t.grelha} /></div>
              </details>
            )}
            {eDocente ? (
              <div className="p-acoes-linha">
                <button type="button" className="btn btn-white btn-sm" onClick={() => setDefinicoes(!definicoes)}><i className="fa fa-cog me-1" />{tx('Definições')}</button>
                <button type="button" className="btn btn-white btn-sm text-danger" onClick={async () => {
                  if (!(await confirmar(tx('Apagar "{0}" e todas as entregas?', { 0: t.titulo }), { titulo: tx('Apagar trabalho'), botao: tx('Apagar'), perigo: true }))) return
                  await api(`/trabalhos/${t.id}`, { metodo: 'DELETE' }).then(recarregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
                }}><i className="fa fa-trash-alt me-1" />{tx('Apagar')}</button>
              </div>
            ) : t.bloqueio ? <Bloqueio motivos={t.bloqueio} /> : <MinhaEntrega t={t} grupo={c.meuGrupo} recarregar={recarregar} avisar={avisar} baixar={baixar} />}
          </Cartao>
          {eDocente && definicoes && <Definicoes t={t} avisar={avisar} guardado={() => { setDefinicoes(false); recarregar() }} />}
          {eDocente && <Entregas trabalho={t} avisar={avisar} baixar={baixar} recarregar={recarregar} />}
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
  const podeEntregar = t.estado !== 'fechado' && !(e && (e.nota !== null || e.corrigida)) && (!t.emGrupo || Boolean(grupo))
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
      avisar({ texto: tx('Trabalho entregue.') })
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
      <h3 className="h6 fw-bold mb-2">{t.emGrupo ? tx('Entrega do grupo{0}', { 0: grupo ? ` ${grupo.nome}` : '' }) : tx('A minha entrega')}</h3>
      {t.emGrupo && (grupo
        ? <p className="small text-muted mb-2"><i className="fa fa-users me-1" />{grupo.membros.map((m) => m.nome).join(', ')}{tx('. Qualquer membro entrega pelo grupo; a nota vale para todos.')}{e?.estudante ? tx(' Última entrega: {0}.', { 0: e.estudante.nome }) : ''}</p>
        : <div className="alert alert-warning py-2 small">{tx('Este trabalho é em grupo e ainda não está em nenhum grupo. Fale com o docente.')}</div>)}
      {e ? (
        <div className="mb-2">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
            <Etiqueta cor={e.atrasada ? 'dourado' : 'verde'}>{e.atrasada ? tx('Entregue com atraso') : tx('Entregue')}</Etiqueta>
            <span className="small text-muted">{dataHora(e.entregueEm)}</span>
          </div>
          {e.ficheiros.length > 0 && <ListaFicheiros ficheiros={e.ficheiros} baixar={baixar} />}
          {e.texto && <div className="p-texto-entregue mb-2">{e.texto}</div>}
          {e.nota !== null || e.correcao || e.correcaoFicheiroId ? (
            <div className="p-correcao">
              <div className="d-flex align-items-center gap-2 mb-1"><i className="fa fa-check-double text-success" /><b>{tx('Correção')}</b>{e.nota !== null && <span className="badge bg-success fs-12px">{nota(e.nota)} {tx('valores')}</span>}</div>
              {t.grelha?.length > 0 && Object.keys(e.grelha || {}).length > 0 && <div className="my-2"><TabelaGrelha grelha={t.grelha} pontos={e.grelha} /></div>}
              {e.correcao && <p className="p-texto-pre mb-1">{e.correcao}</p>}
              {e.correcaoFicheiroId && <CorrecaoDoDocente id={e.correcaoFicheiroId} nome={tx('Correção - {0}', { 0: t.titulo })} baixar={baixar} />}
            </div>
          ) : t.aguardaNotas && e.corrigida ? (
            <div className="alert alert-info py-2 small mb-0"><i className="fa fa-hourglass-half me-1" />{tx('A sua entrega já foi corrigida. A nota aparece quando o docente publicar as notas de todos.')}</div>
          ) : null}
        </div>
      ) : <Etiqueta cor={t.estado === 'fechado' ? 'vermelho' : 'cinzento'}>{t.estado === 'fechado' ? tx('Não entregue') : tx('Por entregar')}</Etiqueta>}

      {podeEntregar && !editar && <button type="button" className="btn btn-white btn-sm" onClick={() => setEditar(true)}><i className="fa fa-redo me-1" />{tx('Substituir a entrega')}</button>}
      {podeEntregar && editar && (
        <form onSubmit={entregar} className="p-formulario p-entrega-form">
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          {querFicheiros && (
            <ZonaUpload id={`f-${t.id}`} multiplos={t.maxFicheiros > 1} ficheiros={ficheiros} aoMudar={(l) => setFicheiros(l.slice(0, t.maxFicheiros))} desativado={aEnviar}
              nota={tx('PDF, Word, PowerPoint, Excel, imagens ou ZIP — até {0} ficheiro(s).', { 0: t.maxFicheiros })} />
          )}
          {querTexto && (
            <Campo id={`txt-${t.id}`} rotulo={tx('Texto do trabalho')} ajuda={tx('{0} palavras', { 0: escrito.trim() ? escrito.trim().split(/\s+/).length : 0 })}>
              <textarea id={`txt-${t.id}`} rows={10} value={escrito} onChange={(x) => setEscrito(x.target.value)} maxLength={50000} />
            </Campo>
          )}
          <Campo id={`c-${t.id}`} rotulo={tx('Comentário para o docente (opcional)')}>
            <textarea id={`c-${t.id}`} rows={2} maxLength={2000} value={comentario} onChange={(x) => setComentario(x.target.value)} />
          </Campo>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme" disabled={aEnviar || (t.tipoEntrega === 'ficheiro' && !ficheiros.length) || (t.tipoEntrega === 'texto' && !escrito.trim())}>
              <i className="fa fa-paper-plane me-1" />{aEnviar ? tx('A enviar…') : tx('Entregar')}
            </button>
            {e && <button type="button" className="btn btn-white" onClick={() => setEditar(false)} disabled={aEnviar}>{tx('Cancelar')}</button>}
          </div>
        </form>
      )}
    </div>
  )
}

// ---------- docente ----------

function Definicoes({ t, avisar, guardado }) {
  const [f, setF] = useState({ titulo: t.titulo, enunciado: t.enunciado, prazo: paraLocal(t.prazo), aceitaAtraso: t.aceitaAtraso, tipoEntrega: t.tipoEntrega, maxFicheiros: t.maxFicheiros, emGrupo: t.emGrupo, correcaoAnonima: t.anonimo, notasOcultas: t.notasOcultas })
  const [grelha, setGrelha] = useState(t.grelha || [])
  const [erro, setErro] = useState('')
  async function guardar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/trabalhos/${t.id}`, { metodo: 'PUT', corpo: { ...f, ...camposCorrecao(f), prazo: localParaIso(f.prazo), maxFicheiros: Number(f.maxFicheiros), grelha: grelha.map((c) => ({ ...c, pontos: Number(c.pontos) })) } })
      avisar({ texto: tx('Definições do trabalho guardadas.') })
      guardado()
    } catch (falha) {
      setErro(falha.message)
    }
  }
  return (
    <Cartao titulo={<><i className="fa fa-cog me-2" />{tx('Definições do trabalho')}</>}>
      <form onSubmit={guardar} className="p-formulario">
        {erro && <p className="p-erro" role="alert">{erro}</p>}
        <Campo id="dt-titulo" rotulo={tx('Título')}><input id="dt-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required /></Campo>
        <Campo id="dt-enunciado" rotulo={tx('Enunciado')}><textarea id="dt-enunciado" rows={4} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} /></Campo>
        <div className="row g-2">
          <div className="col-md-4"><Campo id="dt-prazo" rotulo={tx('Prazo')}><input id="dt-prazo" type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} required /></Campo></div>
          <div className="col-md-4"><Campo id="dt-tipo" rotulo={tx('Forma de entrega')}><select id="dt-tipo" value={f.tipoEntrega} onChange={(e) => setF({ ...f, tipoEntrega: e.target.value })}>{Object.entries(TIPOS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo></div>
          <div className="col-md-4"><Campo id="dt-max" rotulo={tx('Máximo de ficheiros')}><input id="dt-max" type="number" min={1} max={10} value={f.maxFicheiros} disabled={f.tipoEntrega === 'texto'} onChange={(e) => setF({ ...f, maxFicheiros: e.target.value })} /></Campo></div>
        </div>
        <label className="p-caixa"><input type="checkbox" checked={f.aceitaAtraso} onChange={(e) => setF({ ...f, aceitaAtraso: e.target.checked })} /> {tx('Aceitar entregas depois do prazo (ficam marcadas como atrasadas)')}</label>
        <label className="p-caixa"><input type="checkbox" checked={f.emGrupo} onChange={(e) => setF({ ...f, emGrupo: e.target.checked })} /> {tx('Trabalho em grupo (uma entrega por grupo; a nota vale para todos os membros)')}</label>
        <OpcoesCorrecao f={f} setF={setF} />
        <div><span className="form-label fw-bold d-block mb-1">{tx('Grelha de avaliação')}</span><EditorGrelha grelha={grelha} aoMudar={setGrelha} /></div>
        <div><button type="submit" className="btn btn-theme">{tx('Guardar definições')}</button></div>
      </form>
    </Cartao>
  )
}

// docente: estudantes, entregas, correção (nota ou grelha, comentário, ficheiro) e prorrogações
function Entregas({ trabalho, avisar, baixar, recarregar }) {
  const [d, setD] = useState(null)
  const [aberta, setAberta] = useState(null) // estudante cuja entrega está aberta
  const [originalidade, setOriginalidade] = useState({})
  const verOriginalidade = useCallback(() => api(`/trabalhos/${trabalho.id}/integridade`).then(setOriginalidade).catch(() => {}), [trabalho.id])
  const carregar = useCallback(() => {
    verOriginalidade()
    return api(`/trabalhos/${trabalho.id}/entregas`).then(setD).catch((e) => avisar({ tipo: 'erro', texto: e.message }))
  }, [trabalho.id, avisar, verOriginalidade])
  useEffect(() => { carregar() }, [carregar])
  // verificações a correr: atualiza dentro de pouco
  useEffect(() => {
    if (!Object.values(originalidade).some((a) => a?.estado === 'pendente')) return undefined
    const t = setTimeout(verOriginalidade, 3000)
    return () => clearTimeout(t)
  }, [originalidade, verOriginalidade])
  if (!d) return <Cartao titulo={tx('Entregas')}><p className="p-texto-suave mb-0">{tx('A carregar entregas…')}</p></Cartao>

  const entregues = d.linhas.filter((l) => l.entrega).length
  const corrigidas = d.linhas.filter((l) => l.entrega?.nota !== null && l.entrega?.nota !== undefined).length
  async function publicar() {
    const falta = entregues - corrigidas
    const texto = falta > 0
      ? tx('Ainda há {0} entrega(s) por corrigir. Publicar já as notas? Os estudantes passam a ver a nota, o comentário e a correção{1}.', { 0: falta, 1: d.anonimo ? tx(', e a correção deixa de ser anónima') : '' })
      : tx('Os estudantes passam a ver a nota, o comentário e a correção{0}. Cada um recebe um aviso.', { 0: d.anonimo ? tx(', e a correção deixa de ser anónima') : '' })
    if (!(await confirmar(texto, { titulo: tx('Publicar as notas'), botao: tx('Publicar') }))) return
    try {
      await api(`/trabalhos/${trabalho.id}/libertar-notas`, { metodo: 'POST' })
      avisar({ texto: tx('Notas publicadas: os estudantes já as veem.') })
      carregar()
      recarregar?.()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    }
  }
  return (
    <Cartao
      titulo={<><i className="fa fa-inbox me-2" />{tx('Entregas')}</>}
      acoes={<span className="text-white small">{entregues} {tx('de')} {d.linhas.length} {tx('entregaram ·')} {corrigidas} {tx('corrigida(s)')}</span>}
      corpo={false}
    >
      <div className="progress rounded-0" style={{ height: 4 }}><div className="progress-bar bg-success" style={{ width: `${d.linhas.length ? (entregues / d.linhas.length) * 100 : 0}%` }} /></div>
      {!d.trabalho.notasVisiveis && (
        <div className="p-por-publicar">
          <i className={`fa ${d.anonimo ? 'fa-user-secret' : 'fa-eye-slash'} fa-lg`} />
          <div className="flex-grow-1 small">
            <b className="d-block">{d.anonimo ? tx('Correção anónima') : tx('Notas por publicar')}</b>
            {d.anonimo ? tx('Os nomes aparecem como «Participante 1, 2…». ') : ''}{tx('Os estudantes ainda não veem as notas: corrija todas as entregas e publique-as de uma vez.')}
          </div>
          <button type="button" className="btn btn-sm btn-theme" onClick={publicar} disabled={!corrigidas}><i className="fa fa-bullhorn me-1" />{tx('Publicar as notas ({0})', { 0: corrigidas })}</button>
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr><th>{tx('Estudante')}</th><th>{tx('Entrega')}</th><th className="text-center" title={tx('Texto coincidente com outros trabalhos, a biblioteca e o repositório')}>{tx('Originalidade')}</th><th className="text-center">{tx('Nota')}</th><th /></tr></thead>
          <tbody>
            {(trabalho.emGrupo ? [...d.linhas].sort((a, b) => (a.grupo?.nome ?? '\uffff').localeCompare(b.grupo?.nome ?? '\uffff', localAtual(), { numeric: true })) : d.linhas).map(({ estudante, entrega, prorrogacao, grupo }) => (
              <LinhaEntrega key={estudante.id} t={trabalho} estudante={estudante} entrega={entrega} prorrogacao={prorrogacao} grupo={grupo} analise={entrega ? originalidade[entrega.id] : null} reverificar={verOriginalidade}
                aberta={aberta === estudante.id} alternar={() => setAberta(aberta === estudante.id ? null : estudante.id)} baixar={baixar} avisar={avisar} recarregar={carregar} />
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

// estudante: o ficheiro corrigido pelo docente, visto no portal (o PDF anotado abre no leitor)
function CorrecaoDoDocente({ id, nome, baixar }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="mt-2">
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className={`btn btn-sm ${ver ? 'btn-dark' : 'btn-theme'}`} onClick={() => setVer(!ver)} aria-expanded={ver}><i className={`fa ${ver ? 'fa-eye-slash' : 'fa-eye'} me-1`} />{ver ? tx('Esconder a correção') : tx('Ver o trabalho corrigido')}</button>
        <button type="button" className="btn btn-sm btn-white" onClick={() => baixar(id, nome)}><i className="fa fa-download me-1" />{tx('Descarregar')}</button>
      </div>
      {ver && <div className="mt-2"><VerFicheiro ficheiro={{ id, nome }} titulo={nome} falhou={() => {}} /></div>}
    </div>
  )
}

function LinhaEntrega({ t, estudante, entrega, prorrogacao, grupo, analise, reverificar, aberta, alternar, baixar, avisar, recarregar }) {
  const [notaManual, setNotaManual] = useState(entrega?.nota ?? '')
  const [pontos, setPontos] = useState(entrega?.grelha || {})
  const [correcao, setCorrecao] = useState(entrega?.correcao || '')
  const [ficheiroCorrecao, setFicheiroCorrecao] = useState([])
  // correção no navegador: anotações por ficheiro PDF e o ficheiro aberto no editor
  const [anotacoes, setAnotacoes] = useState(entrega?.anotacoes || {})
  const [aAnotar, setAAnotar] = useState(null)
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
      fd.append('anotacoes', JSON.stringify(anotacoes))
      await enviarComProgresso(`/entregas/${entrega.id}`, fd, { metodo: 'PUT' })
      avisar({ texto: tx('Correção de {0} guardada. O estudante foi avisado.', { 0: estudante.nome }) })
      setFicheiroCorrecao([])
      recarregar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }

  // gera o PDF corrigido com as anotações de todos os PDF da entrega e junta-o à correção
  async function concluirAnotacoes(ficheiro, lista) {
    const todas = { ...anotacoes, [ficheiro.id]: lista }
    const pdfs = entrega.ficheiros.filter((f) => f.tipo === 'application/pdf' && todas[f.id]?.length)
    const partes = []
    for (const f of pdfs) partes.push({ bytes: await (await carregarFicheiro(f.id)).bytes(), anotacoes: todas[f.id] })
    setAnotacoes(todas)
    if (partes.length) {
      const pdf = await gerarPdfCorrigido(partes)
      const nome = pdfs.length === 1 ? `Correção - ${pdfs[0].nome.replace(/\.pdf$/i, '')}.pdf` : `Correção - ${estudante.nome}.pdf`
      setFicheiroCorrecao([{ ficheiro: new File([pdf], nome, { type: 'application/pdf' }), progresso: 0, erro: '' }])
      avisar({ texto: tx('PDF corrigido pronto. Guarde a correção para o enviar a {0}.', { 0: estudante.nome }) })
    } else {
      setFicheiroCorrecao([])
    }
    setAAnotar(null)
  }

  async function prorrogar(retirar) {
    try {
      await api(`/trabalhos/${t.id}/prorrogacao`, { metodo: 'PUT', corpo: { estudanteId: estudante.id, prazo: retirar ? null : localParaIso(prazo), motivo } })
      avisar({ texto: retirar ? tx('Prorrogação retirada.') : tx('Prazo alargado para {0}.', { 0: estudante.nome }) })
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
          {t.emGrupo && (grupo ? <span className="badge bg-indigo me-1"><i className="fa fa-users me-1" />{grupo.nome}</span> : <span className="badge bg-warning text-dark me-1">{tx('Sem grupo')}</span>)}
          {prorrogacao && <span className="badge bg-info">{tx('Prazo até')} {dataHora(prorrogacao.prazo)}</span>}
        </td>
        <td className="small">
          {entrega ? <><Etiqueta cor={entrega.atrasada ? 'dourado' : 'verde'}>{entrega.atrasada ? tx('Atrasada') : tx('Entregue')}</Etiqueta> <span className="text-muted">{dataHora(entrega.entregueEm)}</span>
            <div className="text-muted">{entrega.ficheiros.length} {tx('ficheiro(s)')}{entrega.texto && tx(' · texto')}{entrega.grupo && entrega.estudante && entrega.estudanteId !== estudante.id ? tx(' · entregue por {0}', { 0: entrega.estudante.nome }) : ''}</div></> : <span className="text-muted">{tx('Não entregou')}</span>}
        </td>
        <td className="text-center">{entrega && (analise?.estado === 'concluida' ? <Link to={`/integridade/${analise.id}`} title={tx('Ver o relatório de originalidade')} className="d-inline-flex gap-1"><ChipOriginalidade a={analise} /><ChipIA a={analise} /></Link> : <ChipOriginalidade a={analise} />)}</td>
        <td className="text-center fw-bold">{entrega?.nota !== null && entrega?.nota !== undefined ? nota(entrega.nota) : '—'}</td>
        <td className="text-end"><button type="button" className={`btn btn-sm ${aberta ? 'btn-dark' : 'btn-white'}`} onClick={alternar}>{entrega ? (aberta ? tx('Fechar') : tx('Ver e corrigir')) : (aberta ? tx('Fechar') : tx('Prazo'))}</button></td>
      </tr>
      {aAnotar && <tr className="d-none"><td><AnotarPdf ficheiro={aAnotar} iniciais={anotacoes[aAnotar.id] || []} guardar={(lista) => concluirAnotacoes(aAnotar, lista)} fechar={() => setAAnotar(null)} /></td></tr>}
      {aberta && (
        <tr>
          <td colSpan={5} className="bg-light">
            <div className="row g-3 py-2">
              {entrega && (
                <div className="col-lg-6">
                  <h4 className="h6 fw-bold">{tx('Entrega')}</h4>
                  {entrega.ficheiros.length > 0 && <ListaFicheiros ficheiros={entrega.ficheiros} baixar={baixar} />}
                  {entrega.ficheiros.filter((f) => f.tipo === 'application/pdf').map((f) => (
                    <button key={f.id} type="button" className="btn btn-sm btn-theme me-2 mb-2" onClick={() => setAAnotar(f)}>
                      <i className="fa fa-pen-fancy me-1" />{tx('Corrigir no PDF')}{entrega.ficheiros.length > 1 && `: ${f.nome}`}
                      {anotacoes[f.id]?.length > 0 && <span className="badge bg-white text-dark ms-2">{anotacoes[f.id].length}</span>}
                    </button>
                  ))}
                  {entrega.texto && <div className="p-texto-entregue mb-2">{entrega.texto}</div>}
                  {entrega.comentario && <div className="small"><b>{tx('Comentário do estudante:')}</b> “{entrega.comentario}”</div>}
                  <div className="d-flex align-items-center gap-2 mt-2 small">
                    <span className="text-muted">{tx('Originalidade:')}</span><ChipOriginalidade a={analise} />
                    {analise?.estado === 'concluida' && <Link to={`/integridade/${analise.id}`}>{tx('Ver relatório')}</Link>}
                    {analise?.estado !== 'pendente' && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => api(`/entregas/${entrega.id}/integridade`, { metodo: 'POST' }).then(() => { avisar({ texto: tx('A verificar de novo, com o repositório atual.') }); reverificar() }).catch((e) => avisar({ tipo: 'erro', texto: e.message }))}>{analise ? tx('Verificar de novo') : tx('Verificar')}</button>}
                  </div>
                </div>
              )}
              <div className={entrega ? 'col-lg-6' : 'col-12'}>
                {entrega && (
                  <>
                    <h4 className="h6 fw-bold">{tx('Correção')}</h4>
                    {comGrelha
                      ? <TabelaGrelha grelha={t.grelha} pontos={pontos} editavel aoMudar={setPontos} />
                      : <div className="d-flex align-items-center gap-2 mb-2"><label htmlFor={`n-${estudante.id}`} className="fw-bold small">{tx('Nota (0 a 20)')}</label><input id={`n-${estudante.id}`} className="form-control form-control-sm p-nota" inputMode="decimal" value={notaManual} onChange={(e) => setNotaManual(e.target.value)} aria-label={tx('Nota de {0}', { 0: estudante.nome })} /></div>}
                    <textarea className="form-control my-2" rows={3} placeholder={tx('Comentário para o estudante')} value={correcao} onChange={(e) => setCorrecao(e.target.value)} aria-label={tx('Comentário para {0}', { 0: estudante.nome })} />
                    <ZonaUpload id={`fc-${entrega.id}`} ficheiros={ficheiroCorrecao} aoMudar={setFicheiroCorrecao} nota={tx('Ficheiro corrigido para o estudante (opcional).')} desativado={aGuardar} />
                    {entrega.correcaoFicheiroId && !ficheiroCorrecao.length && <button type="button" className="btn btn-link btn-sm px-0" onClick={() => baixar(entrega.correcaoFicheiroId, 'Correção')}><i className="fa fa-paperclip me-1" />{tx('Ficheiro de correção já enviado')}</button>}
                    <div className="mt-2"><button type="button" className="btn btn-theme btn-sm" onClick={corrigir} disabled={aGuardar}><i className="fa fa-save me-1" />{aGuardar ? tx('A guardar…') : tx('Guardar correção')}</button></div>
                  </>
                )}
                <h4 className="h6 fw-bold mt-3">{tx('Prorrogação do prazo só para este estudante')}</h4>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <input type="datetime-local" className="form-control form-control-sm w-auto" value={prazo} onChange={(e) => setPrazo(e.target.value)} aria-label={tx('Novo prazo para {0}', { 0: estudante.nome })} />
                  <input className="form-control form-control-sm w-auto flex-grow-1" placeholder={tx('Motivo (ex.: missão de serviço)')} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label={tx('Motivo da prorrogação')} />
                  <button type="button" className="btn btn-white btn-sm" disabled={!prazo} onClick={() => prorrogar(false)}><i className="fa fa-calendar-plus me-1" />{tx('Alargar')}</button>
                  {prorrogacao && <button type="button" className="btn btn-white btn-sm text-danger" onClick={() => prorrogar(true)}>{tx('Retirar')}</button>}
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
