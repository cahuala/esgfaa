import { useState } from 'react'
import { api, enviarComProgresso } from '../api'
import { Campo } from '../componentes'
import { localParaIso } from '../formatar'
import ZonaUpload from '../ZonaUpload'
import { EditorGrelha } from './Grelha'

const OPCOES = [
  { id: 'ficheiro', icone: 'fa-file-upload', cor: 'bg-primary', nome: 'Ficheiro', texto: 'PDF, Word, PowerPoint, imagens, vídeo (vários de uma vez)' },
  { id: 'ligacao', icone: 'fa-link', cor: 'bg-info', nome: 'Ligação', texto: 'Endereço de outro site' },
  { id: 'video', icone: 'fa-play', cor: 'bg-danger', nome: 'Vídeo', texto: 'YouTube ou outro endereço' },
  { id: 'trabalho', icone: 'fa-file-signature', cor: 'bg-orange', nome: 'Trabalho', texto: 'Entrega de ficheiros com prazo e correção' },
  { id: 'questionario', icone: 'fa-question', cor: 'bg-purple', nome: 'Questionário', texto: 'Teste com correção automática' },
]

// janela "Adicionar atividade ou recurso" (como no Moodle), no modal do tema
function NovaAtividade({ c, secaoId, fechar, avisar, criada }) {
  const [tipo, setTipo] = useState(null)
  const [f, setF] = useState({ titulo: '', descricao: '', url: '', enunciado: '', prazo: '', aceitaAtraso: false, duracao: 20, tentativas: 1, tipoEntrega: 'ficheiro', maxFicheiros: 1 })
  const [grelha, setGrelha] = useState([])
  const [ficheiros, setFicheiros] = useState([])
  const [erro, setErro] = useState('')
  const [aEnviar, setAEnviar] = useState(false)
  const capitulo = secaoId ? c.secoes.find((s) => s.id === secaoId)?.titulo : 'Geral'
  const opcao = OPCOES.find((o) => o.id === tipo)

  const progresso = (i, p) => setFicheiros((l) => l.map((x, j) => (j === i ? { ...x, progresso: p } : x)))

  async function guardar(e) {
    e.preventDefault()
    setErro('')
    setAEnviar(true)
    try {
      if (tipo === 'ficheiro') {
        if (!ficheiros.length) throw new Error('Escolha pelo menos um ficheiro.')
        // um material por ficheiro; com vários, o título é o nome de cada ficheiro
        for (const [i, x] of ficheiros.entries()) {
          const fd = new FormData()
          fd.append('tipo', 'ficheiro')
          fd.append('titulo', ficheiros.length === 1 && f.titulo ? f.titulo : x.ficheiro.name.replace(/\.[^.]+$/, ''))
          fd.append('descricao', f.descricao)
          if (secaoId) fd.append('secaoId', String(secaoId))
          fd.append('ficheiro', x.ficheiro)
          await enviarComProgresso(`/cadeiras/${c.id}/materiais`, fd, { aoProgresso: (p) => progresso(i, p) })
          progresso(i, 100)
        }
        avisar({ texto: ficheiros.length > 1 ? `${ficheiros.length} ficheiros publicados.` : 'Ficheiro publicado.' })
        return criada()
      }
      if (tipo === 'ligacao' || tipo === 'video') {
        await api(`/cadeiras/${c.id}/materiais`, { metodo: 'POST', corpo: { tipo, titulo: f.titulo, descricao: f.descricao, url: f.url, secaoId } })
        avisar({ texto: 'Recurso publicado.' })
        return criada()
      }
      if (tipo === 'trabalho') {
        const fd = new FormData()
        fd.append('titulo', f.titulo)
        fd.append('enunciado', f.enunciado)
        fd.append('prazo', localParaIso(f.prazo))
        fd.append('aceitaAtraso', String(f.aceitaAtraso))
        fd.append('tipoEntrega', f.tipoEntrega)
        fd.append('maxFicheiros', String(f.maxFicheiros || 1))
        fd.append('grelha', JSON.stringify(grelha.map((c) => ({ ...c, pontos: Number(c.pontos) }))))
        if (secaoId) fd.append('secaoId', String(secaoId))
        if (ficheiros[0]) fd.append('ficheiro', ficheiros[0].ficheiro)
        await enviarComProgresso(`/cadeiras/${c.id}/trabalhos`, fd, { aoProgresso: (p) => progresso(0, p) })
        avisar({ texto: 'Trabalho criado. Os estudantes já o veem.' })
        return criada()
      }
      const q = await api(`/cadeiras/${c.id}/questionarios`, { metodo: 'POST', corpo: { titulo: f.titulo, descricao: f.descricao, duracao: Number(f.duracao || 0), tentativas: Number(f.tentativas || 1), secaoId } })
      avisar({ texto: 'Questionário criado. Junte as perguntas e publique.' })
      return criada({ atividade: `questionario-${q.id}` })
    } catch (falha) {
      setErro(falha.message)
      setFicheiros((l) => l.map((x) => (x.progresso < 100 ? { ...x, progresso: 0 } : x)))
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="nova-atividade" onClick={() => !aEnviar && fechar()}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
          <form className="modal-content" onSubmit={guardar}>
            <div className="modal-header">
              <h4 className="modal-title" id="nova-atividade">
                {opcao ? <><i className={`fa ${opcao.icone} me-2`} />Novo: {opcao.nome.toLowerCase()}</> : 'Adicionar atividade ou recurso'}
                <small className="d-block fs-12px text-muted fw-normal mt-1">Capítulo: {capitulo}</small>
              </h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aEnviar} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              {!tipo ? (
                <div className="row g-3">
                  {OPCOES.map((o) => (
                    <div key={o.id} className="col-sm-6 col-lg-4">
                      <button type="button" className="p-escolha w-100" onClick={() => setTipo(o.id)}>
                        <span className={`p-atividade-icone p-atividade-icone-grande ${o.cor}`}><i className={`fa ${o.icone}`} /></span>
                        <b className="d-block mt-2">{o.nome}</b>
                        <span className="small text-muted">{o.texto}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-formulario">
                  {erro && <div className="alert alert-danger py-2 mb-0" role="alert">{erro}</div>}
                  {tipo === 'ficheiro' && (
                    <>
                      <ZonaUpload id="na-ficheiros" multiplos ficheiros={ficheiros} aoMudar={setFicheiros} desativado={aEnviar} />
                      {ficheiros.length <= 1 && <Campo id="na-titulo" rotulo="Título (opcional: por omissão, o nome do ficheiro)"><input id="na-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} /></Campo>}
                    </>
                  )}
                  {tipo !== 'ficheiro' && <Campo id="na-titulo" rotulo="Título"><input id="na-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>}
                  {(tipo === 'ligacao' || tipo === 'video') && <Campo id="na-url" rotulo="Endereço"><input id="na-url" type="url" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required /></Campo>}
                  {tipo === 'trabalho' && (
                    <>
                      <Campo id="na-enunciado" rotulo="Enunciado"><textarea id="na-enunciado" rows={4} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} /></Campo>
                      <div className="row g-2">
                        <div className="col-sm-6"><Campo id="na-prazo" rotulo="Prazo de entrega"><input id="na-prazo" type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} required /></Campo></div>
                        <div className="col-sm-6 d-flex align-items-end"><label className="p-caixa mb-2"><input type="checkbox" checked={f.aceitaAtraso} onChange={(e) => setF({ ...f, aceitaAtraso: e.target.checked })} /> Aceitar entregas fora de prazo</label></div>
                      </div>
                      <div className="row g-2">
                        <div className="col-sm-6"><Campo id="na-tipoentrega" rotulo="Como se entrega"><select id="na-tipoentrega" value={f.tipoEntrega} onChange={(e) => setF({ ...f, tipoEntrega: e.target.value })}><option value="ficheiro">Ficheiros</option><option value="texto">Texto escrito no portal</option><option value="ambos">Ficheiros e texto</option></select></Campo></div>
                        <div className="col-sm-6"><Campo id="na-max" rotulo="Máximo de ficheiros"><input id="na-max" type="number" min={1} max={10} value={f.maxFicheiros} disabled={f.tipoEntrega === 'texto'} onChange={(e) => setF({ ...f, maxFicheiros: e.target.value })} /></Campo></div>
                      </div>
                      <div><span className="form-label fw-bold d-block mb-1">Grelha de avaliação (opcional)</span><EditorGrelha grelha={grelha} aoMudar={setGrelha} /></div>
                      <span className="form-label fw-bold mb-0">Enunciado em ficheiro (opcional)</span>
                      <ZonaUpload id="na-enunciado-f" ficheiros={ficheiros} aoMudar={setFicheiros} desativado={aEnviar} />
                    </>
                  )}
                  {tipo === 'questionario' && (
                    <div className="row g-2">
                      <div className="col-sm-6"><Campo id="na-duracao" rotulo="Duração (minutos, 0 = livre)"><input id="na-duracao" type="number" min={0} max={600} value={f.duracao} onChange={(e) => setF({ ...f, duracao: e.target.value })} /></Campo></div>
                      <div className="col-sm-6"><Campo id="na-tentativas" rotulo="Tentativas"><input id="na-tentativas" type="number" min={1} max={10} value={f.tentativas} onChange={(e) => setF({ ...f, tentativas: e.target.value })} /></Campo></div>
                    </div>
                  )}
                  {tipo !== 'trabalho' && <Campo id="na-descricao" rotulo={tipo === 'questionario' ? 'Instruções (opcional)' : 'Descrição (opcional)'}><textarea id="na-descricao" rows={2} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} maxLength={2000} /></Campo>}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {tipo && <button type="button" className="btn btn-white me-auto" onClick={() => { setTipo(null); setErro(''); setFicheiros([]) }} disabled={aEnviar}><i className="fa fa-arrow-left me-1" /> Outro tipo</button>}
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aEnviar}>Cancelar</button>
              {tipo && <button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? <><span className="spinner-border spinner-border-sm me-1" />A guardar…</> : tipo === 'questionario' ? 'Criar e juntar perguntas' : 'Guardar e publicar'}</button>}
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default NovaAtividade
