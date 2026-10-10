import { useId, useRef, useState } from 'react'
import { api } from '../api'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { POSICOES_BANNER, TIPOS_BLOCO } from '../esquemas'
import { escrever, ler } from '../caminhos'

const LARGURAS = { metade: 'col-md-6', terco: 'col-md-4', doisTercos: 'col-md-8' }

// barra do editor de texto rico (Quill, o editor usado pelo Color Admin)
const BARRA_TEXTO = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }, 'blockquote'],
  [{ align: [] }],
  ['link', 'clean'],
]

/*
  Formulário de um objeto.
  horizontal: disposição do Color Admin (rótulo à esquerda col-md-3, campo à direita col-md-9).
  Sem horizontal: grelha compacta com o rótulo por cima (usada dentro de blocos e listas).
*/
export function Formulario({ campos, valor, onChange, contexto, horizontal = false }) {
  if (horizontal) {
    return (
      <div className="form-horizontal">
        {campos.map((c) => (
          <Campo
            key={c.nome}
            campo={c}
            valor={ler(valor, c.nome)}
            onChange={(v) => onChange(escrever(valor, c.nome, v))}
            contexto={contexto}
            horizontal
          />
        ))}
      </div>
    )
  }
  return (
    <div className="row g-3">
      {campos.map((c) => (
        <div key={c.nome} className={LARGURAS[c.largura] || 'col-12'}>
          <Campo
            campo={c}
            valor={ler(valor, c.nome)}
            onChange={(v) => onChange(escrever(valor, c.nome, v))}
            contexto={contexto}
          />
        </div>
      ))}
    </div>
  )
}

// ---------- um campo (rótulo + controlo + ajuda) ----------

export function Campo({ campo, valor, onChange, contexto, horizontal = false }) {
  const id = useId()
  const obrigatorio = campo.obrigatorio && <span className="text-danger"> *</span>
  const ajuda = campo.ajuda && <small className="d-block fs-12px text-gray-500 mt-1">{campo.ajuda}</small>
  const controlo = <Controlo id={id} campo={campo} valor={valor} onChange={onChange} contexto={contexto} />

  if (campo.tipo === 'booleano') {
    const interruptor = (
      <div className="form-check form-switch">
        <input id={id} className="form-check-input" type="checkbox" checked={Boolean(valor)} onChange={(e) => onChange(e.target.checked)} />
        <label htmlFor={id} className="form-check-label">{horizontal ? 'Sim' : campo.rotulo}</label>
      </div>
    )
    if (!horizontal) return <div className="pt-md-4 mt-md-2">{interruptor}{ajuda}</div>
    return (
      <div className="row mb-15px">
        <label htmlFor={id} className="form-label col-form-label col-md-3">{campo.rotulo}</label>
        <div className="col-md-9 pt-2">{interruptor}{ajuda}</div>
      </div>
    )
  }

  if (horizontal) {
    return (
      <div className="row mb-15px">
        <label htmlFor={id} className="form-label col-form-label col-md-3">{campo.rotulo}{obrigatorio}</label>
        <div className="col-md-9">{controlo}{ajuda}</div>
      </div>
    )
  }
  return (
    <>
      <label htmlFor={id} className="form-label fw-bold">{campo.rotulo}{obrigatorio}</label>
      {controlo}
      {ajuda}
    </>
  )
}

function Controlo({ id, campo, valor, onChange, contexto }) {
  switch (campo.tipo) {
    case 'textarea':
      return <textarea id={id} className="form-control" rows={campo.linhas || 3} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio} />

    case 'textoRico':
      return (
        <div className="editor-texto">
          <ReactQuill id={id} theme="snow" value={valor || ''} onChange={onChange} modules={{ toolbar: BARRA_TEXTO }} placeholder="Escreva aqui o texto…" />
        </div>
      )

    case 'data':
    case 'hora':
    case 'numero':
      return (
        <input
          id={id}
          type={{ data: 'date', hora: 'time', numero: 'number' }[campo.tipo]}
          className="form-control"
          value={valor ?? ''}
          onChange={(e) => onChange(campo.tipo === 'numero' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
          required={campo.obrigatorio}
        />
      )

    case 'selecao': {
      const opcoes = campo.opcoes === 'pessoas'
        ? (contexto?.pessoas || []).map((p) => ({ valor: p.id, rotulo: `${p.nome}${p.cargo ? ` — ${p.cargo}` : ''}` }))
        : campo.opcoes === 'posicoesBanner' ? POSICOES_BANNER : campo.opcoes
      return (
        <select id={id} className="form-select" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio}>
          <option value="">— escolher —</option>
          {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      )
    }

    case 'sugestoes': {
      // texto livre com sugestões tiradas dos valores já usados
      const sugestoes = [...new Set([...(campo.valores || []), ...(contexto?.sugestoes?.[campo.nome] || [])])].filter(Boolean)
      return (
        <>
          <input id={id} className="form-control" list={`${id}-lista`} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio} />
          <datalist id={`${id}-lista`}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
        </>
      )
    }

    case 'imagem':
    case 'video':
    case 'ficheiro':
      return <CampoFicheiro id={id} tipo={campo.tipo} valor={valor} onChange={onChange} />

    case 'youtube':
      return (
        <>
          <input
            id={id}
            className="form-control"
            placeholder="https://www.youtube.com/watch?v=…"
            value={valor ?? ''}
            onChange={(e) => onChange(idYoutube(e.target.value))}
          />
          {valor && <small className="d-block fs-12px text-success mt-1"><i className="fa fa-check me-1" />Vídeo identificado: {valor}</small>}
        </>
      )

    case 'listaTexto':
      return <ListaTexto valor={valor || []} onChange={onChange} multilinha={campo.multilinha} />

    case 'objetos':
      return <ListaObjetos campo={campo} valor={valor || []} onChange={onChange} contexto={contexto} />

    case 'blocos':
      return <EditorBlocos valor={valor || []} onChange={onChange} contexto={contexto} />

    default:
      return <input id={id} className="form-control" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio} />
  }
}

// aceita um endereço completo do YouTube ou só o identificador
function idYoutube(texto) {
  const t = texto.trim()
  const m = t.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m ? m[1] : t
}

// ---------- ficheiros ----------

const ACEITAR = { imagem: 'image/jpeg,image/png,image/webp,image/gif', video: 'video/mp4,video/webm', ficheiro: 'application/pdf' }

export function CampoFicheiro({ id, tipo, valor, onChange }) {
  const entrada = useRef(null)
  const [estado, setEstado] = useState('')

  async function carregar(ficheiros) {
    if (!ficheiros?.length) return
    setEstado('A carregar…')
    try {
      const [f] = await api('/ficheiros', { metodo: 'POST', ficheiros: [ficheiros[0]] })
      onChange(f.url)
      setEstado('')
    } catch (erro) {
      setEstado(erro.message)
    }
  }

  return (
    <div
      className={`campo-ficheiro ${valor ? 'tem-ficheiro' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); carregar(e.dataTransfer.files) }}
    >
      {valor && tipo === 'imagem' && <img src={valor} alt="" className="campo-ficheiro-previa" />}
      {valor && tipo === 'video' && <video src={valor} className="campo-ficheiro-previa" muted />}
      {valor && tipo === 'ficheiro' && <a href={valor} target="_blank" rel="noreferrer" className="campo-ficheiro-ligacao"><i className="fa fa-file-pdf me-2" />Abrir ficheiro</a>}

      <div className="campo-ficheiro-acoes">
        <button type="button" className="btn btn-sm btn-default" onClick={() => entrada.current.click()}>
          <i className="fa fa-upload me-1" /> {valor ? 'Substituir' : 'Carregar'}
        </button>
        {valor && (
          <button type="button" className="btn btn-sm btn-white text-danger" onClick={() => onChange('')}>
            <i className="fa fa-times me-1" /> Remover
          </button>
        )}
        <span className="text-muted small">{estado || (valor ? '' : 'ou arraste o ficheiro para aqui')}</span>
      </div>
      <input id={id} ref={entrada} type="file" accept={ACEITAR[tipo]} hidden onChange={(e) => { carregar(e.target.files); e.target.value = '' }} />
    </div>
  )
}

// ---------- listas ----------

function mover(lista, i, delta) {
  const j = i + delta
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

function BotoesItem({ i, total, onMover, onRemover }) {
  return (
    <div className="btn-group btn-group-sm">
      <button type="button" className="btn btn-white" disabled={i === 0} onClick={() => onMover(i, -1)} title="Subir"><i className="fa fa-arrow-up" /></button>
      <button type="button" className="btn btn-white" disabled={i === total - 1} onClick={() => onMover(i, 1)} title="Descer"><i className="fa fa-arrow-down" /></button>
      <button type="button" className="btn btn-white text-danger" onClick={() => onRemover(i)} title="Remover"><i className="fa fa-trash-alt" /></button>
    </div>
  )
}

function ListaTexto({ valor, onChange, multilinha }) {
  const alterar = (i, v) => onChange(valor.map((x, j) => (j === i ? v : x)))
  return (
    <div className="lista-texto">
      {valor.map((v, i) => (
        <div key={i} className="d-flex gap-2 mb-2 align-items-start">
          {multilinha
            ? <textarea className="form-control" rows={3} value={v} onChange={(e) => alterar(i, e.target.value)} />
            : <input className="form-control" value={v} onChange={(e) => alterar(i, e.target.value)} />}
          <BotoesItem i={i} total={valor.length} onMover={(a, d) => onChange(mover(valor, a, d))} onRemover={(a) => onChange(valor.filter((_, j) => j !== a))} />
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-default" onClick={() => onChange([...valor, ''])}>
        <i className="fa fa-plus me-1" /> Acrescentar
      </button>
    </div>
  )
}

function ListaObjetos({ campo, valor, onChange, contexto }) {
  const vazio = () => Object.fromEntries(campo.campos.map((c) => [c.nome, c.tipo === 'objetos' || c.tipo === 'listaTexto' ? [] : c.tipo === 'booleano' ? false : '']))
  return (
    <div className="lista-objetos">
      {valor.map((item, i) => (
        <div key={i} className="lista-objetos-item">
          <div className="lista-objetos-topo">
            <span className="badge bg-gray-600">{campo.rotuloItem || 'Item'} {i + 1}</span>
            <BotoesItem i={i} total={valor.length} onMover={(a, d) => onChange(mover(valor, a, d))} onRemover={(a) => onChange(valor.filter((_, j) => j !== a))} />
          </div>
          <Formulario campos={campo.campos} valor={item} onChange={(v) => onChange(valor.map((x, j) => (j === i ? v : x)))} contexto={contexto} />
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-default" onClick={() => onChange([...valor, vazio()])}>
        <i className="fa fa-plus me-1" /> Acrescentar {(campo.rotuloItem || 'item').toLowerCase()}
      </button>
    </div>
  )
}

// ---------- editor de blocos (corpo das notícias, artigos e eventos) ----------

// botão "+" entre blocos, que abre a escolha do tipo de bloco a inserir
function Inserir({ posicao, aberto, onAbrir, onFechar, onInserir }) {
  return (
    <div className="blocos-inserir">
      {aberto ? (
        <div className="blocos-menu">
          {Object.entries(TIPOS_BLOCO).map(([tipo, def]) => (
            <button key={tipo} type="button" className="btn btn-sm btn-white" onClick={() => onInserir(tipo, posicao)}>
              <i className={`fa ${def.icone} me-1`} /> {def.rotulo}
            </button>
          ))}
          <button type="button" className="btn btn-sm btn-link" onClick={onFechar}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="blocos-mais" onClick={() => onAbrir(posicao)} title="Inserir bloco aqui">
          <i className="fa fa-plus" />
        </button>
      )}
    </div>
  )
}

function EditorBlocos({ valor, onChange, contexto }) {
  const [menuEm, setMenuEm] = useState(null) // posição onde se vai inserir

  function inserir(tipo, posicao) {
    const novo = { tipo, ...Object.fromEntries(TIPOS_BLOCO[tipo].campos.map((c) => [c.nome, c.tipo === 'objetos' || c.tipo === 'listaTexto' ? [] : c.tipo === 'booleano' ? false : ''])) }
    if (tipo === 'imagem') novo.posicao = 'centro'
    const lista = [...valor]
    lista.splice(posicao, 0, novo)
    onChange(lista)
    setMenuEm(null)
  }

  return (
    <div className="editor-blocos">
      <Inserir posicao={0} aberto={menuEm === 0} onAbrir={setMenuEm} onFechar={() => setMenuEm(null)} onInserir={inserir} />
      {valor.map((bloco, i) => {
        const def = TIPOS_BLOCO[bloco.tipo]
        if (!def) return null
        return (
          <div key={i}>
            <div className={`bloco bloco-${bloco.tipo}`}>
              <div className="bloco-topo">
                <span className="bloco-tipo"><i className={`fa ${def.icone} me-2`} />{def.rotulo}</span>
                <BotoesItem
                  i={i}
                  total={valor.length}
                  onMover={(a, d) => onChange(mover(valor, a, d))}
                  onRemover={(a) => onChange(valor.filter((_, j) => j !== a))}
                />
              </div>
              <Formulario campos={def.campos} valor={bloco} onChange={(v) => onChange(valor.map((x, j) => (j === i ? v : x)))} contexto={contexto} />
            </div>
            <Inserir posicao={i + 1} aberto={menuEm === i + 1} onAbrir={setMenuEm} onFechar={() => setMenuEm(null)} onInserir={inserir} />
          </div>
        )
      })}
    </div>
  )
}
