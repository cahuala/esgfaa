import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, enviarComProgresso } from '../api'
import { Aviso, Cartao, Carregando, Erro, Titulo, Vazio } from '../componentes'
import { dataHora } from '../formatar'
import ZonaUpload from '../ZonaUpload'
import Relatorio, { ChipOriginalidade } from '../integridade/Relatorio'

const MIGALHA = { rotulo: 'Originalidade', para: '/integridade' }

// verificação de originalidade (docentes): verificar um documento e ver os relatórios
function Originalidade() {
  const { id } = useParams()
  return id ? <VerRelatorio key={id} id={Number(id)} /> : <Lista />
}

function Lista() {
  const [l, setL] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState(null)
  const [f, setF] = useState({ titulo: '', guardar: false })
  const [ficheiros, setFicheiros] = useState([])
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = useCallback(() => api('/integridade').then(setL).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])
  // enquanto houver verificações a correr, atualiza
  useEffect(() => {
    if (!l?.some((a) => a.estado === 'pendente')) return undefined
    const t = setTimeout(carregar, 3000)
    return () => clearTimeout(t)
  }, [l, carregar])
  if (erro) return <Erro texto={erro} />
  if (!l) return <Carregando />

  async function verificar(e) {
    e.preventDefault()
    if (!ficheiros[0]) return setAviso({ tipo: 'erro', texto: 'Escolha o documento (PDF ou Word).' })
    setAEnviar(true)
    try {
      const fd = new FormData()
      fd.append('ficheiro', ficheiros[0].ficheiro)
      fd.append('titulo', f.titulo)
      fd.append('guardar', String(f.guardar))
      await enviarComProgresso('/integridade', fd, { aoProgresso: (p) => setFicheiros((x) => x.map((y) => ({ ...y, progresso: p }))) })
      setFicheiros([])
      setF({ titulo: '', guardar: false })
      setAviso({ texto: 'Documento enviado. A comparação demora poucos segundos.' })
      carregar()
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <>
      <Titulo rotulo="Originalidade" titulo="Verificar originalidade" sub="compare um texto com os trabalhos, a biblioteca e o repositório da Escola" />
      <div className="row">
        <div className="col-xl-5">
          <Cartao titulo={<><i className="fa fa-fingerprint me-2" />Verificar um documento</>}>
            <form className="p-formulario" onSubmit={verificar}>
              <ZonaUpload id="orig-doc" aceitar="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" ficheiros={ficheiros} aoMudar={(x) => setFicheiros(x.slice(0, 1))} desativado={aEnviar} nota="PDF ou Word (.docx) com texto: uma proposta de TFC, um artigo, um trabalho recebido por e-mail…" />
              <label className="form-label mt-2" htmlFor="orig-titulo">Título (opcional)</label>
              <input id="orig-titulo" className="form-control" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Proposta de TFC — Maj. Silva" />
              <label className="p-caixa mt-2"><input type="checkbox" checked={f.guardar} onChange={(e) => setF({ ...f, guardar: e.target.checked })} /> Guardar no repositório (os próximos trabalhos também são comparados com este)</label>
              <div><button type="submit" className="btn btn-theme mt-2" disabled={aEnviar}><i className="fa fa-search me-1" />{aEnviar ? 'A enviar…' : 'Verificar'}</button></div>
            </form>
            <p className="small text-muted mb-0 mt-3"><i className="fa fa-lock me-1" />O ficheiro não fica guardado: só o texto, para a comparação. Os trabalhos entregues no portal são verificados automaticamente: veja a coluna "Originalidade" nas entregas.</p>
          </Cartao>
        </div>
        <div className="col-xl-7">
          <Cartao titulo={<><i className="fa fa-history me-2" />As minhas verificações</>} corpo={false}>
            {l.length === 0 ? <div className="panel-body"><Vazio>Ainda não verificou nenhum documento.</Vazio></div> : (
              <div className="list-group list-group-flush">
                {l.map((a) => (
                  <Link key={a.id} to={`/integridade/${a.id}`} className="list-group-item list-group-item-action d-flex align-items-center gap-3">
                    <i className="fa fa-file-alt fa-lg text-muted" />
                    <span className="flex-grow-1 min-w-0">
                      <b className="d-block text-truncate">{a.documento.titulo}</b>
                      <span className="small text-muted">{dataHora(a.criadaEm)}{a.fontes?.[0] ? ` · maior fonte: ${a.fontes[0].titulo}` : ''}</span>
                    </span>
                    <ChipOriginalidade a={a} />
                  </Link>
                ))}
              </div>
            )}
          </Cartao>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

function VerRelatorio({ id }) {
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api(`/integridade/${id}`).then(setR).catch((e) => setErro(e.message)), [id])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    if (r?.estado !== 'pendente') return undefined
    const t = setTimeout(carregar, 2500)
    return () => clearTimeout(t)
  }, [r, carregar])
  if (erro) return <Erro texto={erro} />
  if (!r) return <Carregando />
  const migalhas = r.trabalho
    ? [{ rotulo: 'Trabalho', para: `/cadeiras/${r.trabalho.cadeiraId}?atividade=trabalho-${r.trabalho.id}` }, { rotulo: 'Relatório de originalidade' }]
    : [MIGALHA, { rotulo: 'Relatório' }]
  return (
    <>
      <Titulo rotulo="Originalidade" titulo="Relatório de originalidade" migalhas={migalhas}>
        <Link to={r.trabalho ? `/cadeiras/${r.trabalho.cadeiraId}?atividade=trabalho-${r.trabalho.id}` : '/integridade'} className="btn btn-white"><i className="fa fa-arrow-left me-1" />Voltar</Link>
      </Titulo>
      <Relatorio r={r} />
    </>
  )
}

export default Originalidade
