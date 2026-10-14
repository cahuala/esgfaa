import { Suspense, lazy, useState } from 'react'
import { api, enviarComProgresso } from '../api'
import { Campo } from '../componentes'
import { localParaIso } from '../formatar'
import ZonaUpload from '../ZonaUpload'
import { EditorGrelha } from './Grelha'

const EditorPagina = lazy(() => import('./EditorPagina'))

const OPCOES = [
  { id: 'ficheiro', icone: 'fa-file-upload', cor: 'bg-primary', nome: 'Ficheiro', texto: 'PDF, Word, PowerPoint, imagens, vídeo (vários de uma vez)' },
  { id: 'ligacao', icone: 'fa-link', cor: 'bg-info', nome: 'Ligação', texto: 'Endereço de outro site' },
  { id: 'video', icone: 'fa-play', cor: 'bg-danger', nome: 'Vídeo', texto: 'YouTube ou outro endereço' },
  { id: 'trabalho', icone: 'fa-file-signature', cor: 'bg-orange', nome: 'Trabalho', texto: 'Entrega de ficheiros com prazo e correção' },
  { id: 'questionario', icone: 'fa-question', cor: 'bg-purple', nome: 'Questionário', texto: 'Teste com correção automática' },
  { id: 'pagina', icone: 'fa-align-left', cor: 'bg-teal', nome: 'Página', texto: 'Texto escrito no portal, com títulos, tabelas e vídeos' },
  { id: 'pasta', icone: 'fa-folder-open', cor: 'bg-warning', nome: 'Pasta', texto: 'Vários ficheiros juntos num só recurso' },
  { id: 'videoconferencia', icone: 'fa-video', cor: 'bg-success', nome: 'Videoconferência', texto: 'Aula à distância: ligação, dia e hora' },
  { id: 'sondagem', icone: 'fa-poll', cor: 'bg-cyan', nome: 'Sondagem', texto: 'Uma pergunta de escolha aos estudantes' },
]
const RESULTADOS = { apos_responder: 'Depois de responderem', apos_fecho: 'Só depois do fecho', nunca: 'Nunca (só o docente)' }

// janela "Adicionar atividade ou recurso" (como no Moodle), no modal do tema
function NovaAtividade({ c, secaoId, fechar, avisar, criada }) {
  const [tipo, setTipo] = useState(null)
  const [f, setF] = useState({
    titulo: '', descricao: '', url: '', enunciado: '', prazo: '', aceitaAtraso: false, duracao: 20, tentativas: 1, tipoEntrega: 'ficheiro', maxFicheiros: 1,
    emGrupo: false, conteudo: '', inicio: '', duracaoSessao: 90, pergunta: '', opcoes: ['', ''], multipla: false, anonimo: false, mostrarResultados: 'apos_responder', fecha: '',
  })
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
      if (tipo === 'pagina' || tipo === 'videoconferencia') {
        const corpo = tipo === 'pagina' ? { conteudo: f.conteudo } : { url: f.url, inicio: localParaIso(f.inicio), duracao: Number(f.duracaoSessao) }
        await api(`/cadeiras/${c.id}/materiais`, { metodo: 'POST', corpo: { tipo, titulo: f.titulo, descricao: f.descricao, secaoId, ...corpo } })
        avisar({ texto: tipo === 'pagina' ? 'Página publicada.' : 'Videoconferência marcada. Os estudantes foram avisados.' })
        return criada()
      }
      if (tipo === 'pasta') {
        if (!ficheiros.length) throw new Error('Junte pelo menos um ficheiro à pasta.')
        const fd = new FormData()
        fd.append('tipo', 'pasta')
        fd.append('titulo', f.titulo)
        fd.append('descricao', f.descricao)
        if (secaoId) fd.append('secaoId', String(secaoId))
        for (const x of ficheiros) fd.append('ficheiros', x.ficheiro)
        await enviarComProgresso(`/cadeiras/${c.id}/materiais`, fd, { aoProgresso: (p) => setFicheiros((l) => l.map((x) => ({ ...x, progresso: p }))) })
        avisar({ texto: 'Pasta publicada.' })
        return criada()
      }
      if (tipo === 'sondagem') {
        await api(`/cadeiras/${c.id}/sondagens`, {
          metodo: 'POST',
          corpo: { titulo: f.titulo, descricao: f.descricao, pergunta: f.pergunta, opcoes: f.opcoes.filter((o) => o.trim()), multipla: f.multipla, anonimo: f.anonimo, mostrarResultados: f.mostrarResultados, fecha: f.fecha ? localParaIso(f.fecha) : null, secaoId },
        })
        avisar({ texto: 'Sondagem publicada.' })
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
        fd.append('emGrupo', String(f.emGrupo))
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
                  {tipo === 'pagina' && (
                    <div>
                      <span className="form-label fw-bold d-block mb-1">Conteúdo da página</span>
                      <Suspense fallback={<div className="text-muted small">A abrir o editor…</div>}>
                        <EditorPagina html={f.conteudo} onChange={(h) => setF((x) => ({ ...x, conteudo: h }))} aoErro={setErro} placeholder="Escreva aqui a matéria, orientações ou leituras…" />
                      </Suspense>
                    </div>
                  )}
                  {tipo === 'pasta' && <ZonaUpload id="na-pasta" multiplos ficheiros={ficheiros} aoMudar={(l) => setFicheiros(l.slice(0, 20))} desativado={aEnviar} nota="Até 20 ficheiros de cada vez; pode juntar mais depois." />}
                  {tipo === 'videoconferencia' && (
                    <>
                      <Campo id="na-url" rotulo="Ligação da sessão" ajuda="Zoom, Microsoft Teams, Google Meet, Jitsi…"><input id="na-url" type="url" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} required /></Campo>
                      <div className="row g-2">
                        <div className="col-sm-7"><Campo id="na-inicio" rotulo="Dia e hora"><input id="na-inicio" type="datetime-local" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} required /></Campo></div>
                        <div className="col-sm-5"><Campo id="na-dursessao" rotulo="Duração (minutos)"><input id="na-dursessao" type="number" min={5} max={600} value={f.duracaoSessao} onChange={(e) => setF({ ...f, duracaoSessao: e.target.value })} /></Campo></div>
                      </div>
                    </>
                  )}
                  {tipo === 'sondagem' && (
                    <>
                      <Campo id="na-pergunta" rotulo="Pergunta"><input id="na-pergunta" value={f.pergunta} onChange={(e) => setF({ ...f, pergunta: e.target.value })} maxLength={500} required /></Campo>
                      <div>
                        <span className="form-label fw-bold d-block mb-1">Opções</span>
                        {f.opcoes.map((o, i) => (
                          <div key={i} className="d-flex gap-2 mb-1">
                            <input className="form-control form-control-sm" value={o} onChange={(e) => setF({ ...f, opcoes: f.opcoes.map((x, j) => (i === j ? e.target.value : x)) })} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} required={i < 2} maxLength={200} />
                            {f.opcoes.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, opcoes: f.opcoes.filter((_, j) => j !== i) })} aria-label="Retirar opção"><i className="fa fa-times" /></button>}
                          </div>
                        ))}
                        {f.opcoes.length < 10 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, opcoes: [...f.opcoes, ''] })}><i className="fa fa-plus me-1" />Opção</button>}
                      </div>
                      <div className="row g-2">
                        <div className="col-sm-6"><Campo id="na-resultados" rotulo="Os estudantes veem os resultados"><select id="na-resultados" value={f.mostrarResultados} onChange={(e) => setF({ ...f, mostrarResultados: e.target.value })}>{Object.entries(RESULTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo></div>
                        <div className="col-sm-6"><Campo id="na-fecha" rotulo="Fecha (opcional)"><input id="na-fecha" type="datetime-local" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo></div>
                      </div>
                      <label className="p-caixa"><input type="checkbox" checked={f.multipla} onChange={(e) => setF({ ...f, multipla: e.target.checked })} /> Permitir escolher várias opções</label>
                      <label className="p-caixa"><input type="checkbox" checked={f.anonimo} onChange={(e) => setF({ ...f, anonimo: e.target.checked })} /> Anónima (ninguém vê quem escolheu o quê; não se pode mudar a resposta)</label>
                    </>
                  )}
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
                      <label className="p-caixa"><input type="checkbox" checked={f.emGrupo} onChange={(e) => setF({ ...f, emGrupo: e.target.checked })} /> Trabalho em grupo (uma entrega por grupo; a nota vale para todos os membros)</label>
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
