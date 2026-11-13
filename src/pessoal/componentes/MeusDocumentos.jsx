import { useMemo, useState } from 'react'
import { api, abrirFicheiro, enviarComProgresso } from '../api'
import { useDados } from '../useDados'
import { Campo, Carregando, Erro, Modal, Painel } from './Ui'
import Carregar from './Carregar'
import { dataPt } from '../formatar'

const TAMANHO = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const ICONE = (d) => (d.mime === 'application/pdf' ? 'fa-file-pdf text-danger' : d.mime.startsWith('image/') ? 'fa-file-image text-info' : /sheet/.test(d.mime) ? 'fa-file-excel text-success' : /word/.test(d.mime) ? 'fa-file-word text-primary' : 'fa-file text-muted')
const SEM_PASTA = 'Sem pasta'
const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// guardar um documento novo, ou mudar o título e a pasta de um já guardado
function Formulario({ doc, pastas, aoFechar, aoGravar }) {
  const [ficheiro, setFicheiro] = useState(null)
  const [d, setD] = useState({ titulo: doc?.titulo ?? '', pasta: doc?.pasta ?? '' })
  const [progresso, setProgresso] = useState(null)
  const [erro, setErro] = useState('')
  async function gravar() {
    setErro('')
    try {
      if (doc) await api(`/pastas/${doc.id}`, { metodo: 'PUT', corpo: d })
      else {
        const fd = new FormData()
        fd.append('titulo', d.titulo)
        fd.append('pasta', d.pasta)
        fd.append('ficheiro', ficheiro)
        await enviarComProgresso('/pastas', fd, setProgresso)
      }
      aoGravar(doc ? 'Documento alterado.' : 'Documento guardado.')
    } catch (e) {
      setProgresso(null)
      setErro(e.message)
    }
  }
  return (
    <Modal titulo={doc ? 'Mudar título ou pasta' : 'Guardar documento'} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={gravar} disabled={(!doc && !ficheiro) || progresso !== null}><i className="fa fa-save me-1" />Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        {!doc && <Campo rotulo="Documento" obrigatorio col="col-12"><Carregar aceitar="application/pdf,image/*,.docx,.xlsx" maxMb={25} icone="fa-folder-plus" ficheiros={ficheiro ? [ficheiro] : []} aoMudar={(l) => { setFicheiro(l[0] ?? null); if (l[0] && !d.titulo) setD({ ...d, titulo: l[0].name.replace(/\.[^.]+$/, '') }) }} progresso={progresso} ajuda="PDF, imagem, Word (.docx) ou Excel (.xlsx) · até 25 MB" /></Campo>}
        <Campo rotulo="Título" col="col-md-7"><input className="form-control form-control-sm" maxLength={200} value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} placeholder="Ex.: Ofício n.º 120 do Estado-Maior" /></Campo>
        <Campo rotulo="Pasta" col="col-md-5" ajuda="Escolha uma das suas ou escreva uma nova."><input className="form-control form-control-sm" list="minhas-pastas" maxLength={100} value={d.pasta} onChange={(e) => setD({ ...d, pasta: e.target.value })} placeholder="Ex.: Ofícios 2026" /><datalist id="minhas-pastas">{pastas.map((p) => <option key={p} value={p} />)}</datalist></Campo>
      </div>
    </Modal>
  )
}

/*
  Os documentos que cada conta guarda na sua Secretária digital, arrumados por pastas: guardar, procurar,
  abrir (PDF e imagens no navegador; Word e Excel descarregam-se), mudar de pasta e apagar. Só o dono os vê.
*/
export default function MeusDocumentos() {
  const { dados, erro, recarregar } = useDados('/pastas')
  const [procura, setProcura] = useState('')
  const [pasta, setPasta] = useState('')
  const [modal, setModal] = useState(null)
  const [aviso, setAviso] = useState('')
  const pastas = useMemo(() => [...new Set((dados ?? []).map((x) => x.pasta).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')), [dados])
  if (erro) return <Erro texto={erro} aoRepetir={recarregar} />
  if (!dados) return <Carregando />
  const q = sem(procura.trim())
  const visiveis = dados.filter((x) => (!pasta || (x.pasta || SEM_PASTA) === pasta) && (!q || sem(`${x.titulo} ${x.nomeOriginal} ${x.pasta}`).includes(q)))
  const grupos = [...new Set(visiveis.map((x) => x.pasta || SEM_PASTA))]
  const feito = (t) => { setModal(null); setAviso(t); recarregar() }
  const apagar = async (x) => {
    if (!window.confirm(`Apagar «${x.titulo}»? Não se pode desfazer.`)) return
    try { await api(`/pastas/${x.id}`, { metodo: 'DELETE' }); feito('Documento apagado.') } catch (e) { setAviso(e.message) }
  }
  const abrir = (x) => abrirFicheiro(`/pastas/${x.id}/ficheiro`, x.nomeOriginal).catch((e) => setAviso(e.message))
  return (
    <Painel titulo={`Os meus documentos (${dados.length})`} icone="fa-folder-open" corpo={false} acoes={<button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({})}><i className="fa fa-plus me-1" />Guardar documento</button>}>
      <div className="panel-body pb-2">
        <p className="small text-muted mb-2">Guarde aqui os documentos de que precisa no dia a dia, arrumados por pastas. Só a sua conta os vê.</p>
        {aviso && <div className="alert alert-info py-2 small d-flex"><span className="flex-grow-1">{aviso}</span><button type="button" className="btn-close btn-sm" aria-label="Fechar" onClick={() => setAviso('')} /></div>}
        {dados.length > 0 && (
          <div className="d-flex flex-wrap gap-2">
            <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Procurar pelo título…" value={procura} onChange={(e) => setProcura(e.target.value)} />
            <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={pasta} onChange={(e) => setPasta(e.target.value)} aria-label="Pasta">
              <option value="">Todas as pastas</option>
              {pastas.map((p) => <option key={p} value={p}>{p}</option>)}
              {dados.some((x) => !x.pasta) && <option value={SEM_PASTA}>{SEM_PASTA}</option>}
            </select>
          </div>
        )}
      </div>
      <div className="list-group list-group-flush">
        {grupos.map((g) => (
          <div key={g}>
            <div className="list-group-item bg-light small fw-bold"><i className="fa fa-folder text-warning me-2" />{g}</div>
            {visiveis.filter((x) => (x.pasta || SEM_PASTA) === g).map((x) => (
              <div key={x.id} className="list-group-item d-flex flex-wrap gap-2 align-items-center">
                <i className={`fa fa-lg ${ICONE(x)}`} />
                <button type="button" className="btn btn-link p-0 text-start fw-bold flex-grow-1 text-decoration-none" onClick={() => abrir(x)}>{x.titulo}</button>
                <span className="small text-muted">{TAMANHO(x.tamanho)} · {dataPt(x.criadoEm)}</span>
                <div className="d-flex gap-1">
                  <button type="button" className="btn btn-xs btn-outline-primary" onClick={() => abrir(x)}><i className="fa fa-external-link-alt me-1" />Abrir</button>
                  <button type="button" className="btn btn-xs btn-outline-secondary" title="Mudar título ou pasta" onClick={() => setModal({ doc: x })}><i className="fa fa-pen" /></button>
                  <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={() => apagar(x)}><i className="fa fa-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
        {!dados.length && <div className="list-group-item text-muted">Ainda não guardou nenhum documento. Carregue em «Guardar documento».</div>}
        {dados.length > 0 && !visiveis.length && <div className="list-group-item text-muted">Nenhum documento com esta procura.</div>}
      </div>
      {modal && <Formulario doc={modal.doc} pastas={pastas} aoFechar={() => setModal(null)} aoGravar={feito} />}
    </Painel>
  )
}
