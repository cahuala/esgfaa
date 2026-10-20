import { Suspense, lazy, useId, useRef, useState } from 'react'
import { api } from '../api'
import { avaliarImagem, dicaTamanho, medirImagem } from '../imagens'
import { POSICOES_BANNER, TIPOS_BLOCO } from '../esquemas'
import { escrever, ler } from '../caminhos'
import { t as tx } from '../../i18n/linguas'

const LARGURAS = { metade: 'col-md-6', terco: 'col-md-4', doisTercos: 'col-md-8', sexto: 'col-md-2' }

// texto formatado: o mesmo editor das páginas (carregado só quando é preciso)
const EditorTexto = lazy(() => import('../editor/EditorTexto'))

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
        <label htmlFor={id} className="form-check-label">{horizontal ? tx('Sim') : campo.rotulo}</label>
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
        <div className="editor-texto" id={id}>
          <Suspense fallback={<div className="text-muted small p-2">{tx('A carregar o editor…')}</div>}>
            <EditorTexto html={valor || ''} onChange={onChange} placeholder={tx('Escreva aqui o texto…')} semImagens />
          </Suspense>
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
        : campo.opcoes === 'posicoesBanner' ? POSICOES_BANNER
          // os outros itens da mesma lista (o organograma: de que órgão depende este)
          : campo.opcoes === 'irmaos' ? (contexto?.irmaos || []).map((n) => ({ valor: n, rotulo: n }))
            : campo.opcoes
      return (
        <select id={id} className="form-select" value={valor ?? ''} onChange={(e) => onChange(e.target.value)} required={campo.obrigatorio}>
          <option value="">{tx('— escolher —')}</option>
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
      return <CampoFicheiro id={id} tipo={campo.tipo} valor={valor} onChange={onChange} recomendado={campo.recomendado} />

    case 'youtube':
      return (
        <>
          <input
            id={id}
            className="form-control"
            placeholder={tx('https://www.youtube.com/watch?v=…')}
            value={valor ?? ''}
            onChange={(e) => onChange(idYoutube(e.target.value))}
          />
          {valor && <small className="d-block fs-12px text-success mt-1"><i className="fa fa-check me-1" />{tx('Vídeo identificado:')} {valor}</small>}
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

export function CampoFicheiro({ id, tipo, valor, onChange, recomendado }) {
  const entrada = useRef(null)
  const [estado, setEstado] = useState('')
  const [avisos, setAvisos] = useState([])

  async function carregar(escolhidos) {
    // copia já a lista: o campo de ficheiro esvazia-a logo a seguir (e há esperas pelo meio)
    const ficheiros = [...(escolhidos || [])]
    if (!ficheiros.length) return
    setEstado(tx('A carregar…'))
    // mede a imagem antes de enviar, para avisar se não servir bem o espaço
    const info = tipo === 'imagem' ? await medirImagem(ficheiros[0]) : null
    try {
      const [f] = await api('/ficheiros', { metodo: 'POST', ficheiros: [ficheiros[0]] })
      onChange(f.url)
      setEstado(info ? tx('{0} × {1} px', { 0: info.largura, 1: info.altura }) : '')
      setAvisos(avaliarImagem(info, recomendado))
    } catch (erro) {
      setEstado(erro.message)
      setAvisos([])
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
      {valor && tipo === 'ficheiro' && <a href={valor} target="_blank" rel="noreferrer" className="campo-ficheiro-ligacao"><i className="fa fa-file-pdf me-2" />{tx('Abrir ficheiro')}</a>}

      <div className="campo-ficheiro-acoes">
        <button type="button" className="btn btn-sm btn-default" onClick={() => entrada.current.click()}>
          <i className="fa fa-upload me-1" /> {valor ? tx('Substituir') : tx('Carregar')}
        </button>
        {valor && (
          <button type="button" className="btn btn-sm btn-white text-danger" onClick={() => { onChange(''); setAvisos([]); setEstado('') }}>
            <i className="fa fa-times me-1" /> {tx('Remover')}
          </button>
        )}
        <span className="text-muted small">{estado || (valor ? '' : tx('ou arraste o ficheiro para aqui'))}</span>
      </div>
      {tipo === 'imagem' && recomendado && <small className="d-block fs-12px text-gray-500 mt-1"><i className="fa fa-ruler-combined me-1" />{dicaTamanho(recomendado)}</small>}
      {avisos.map((a) => (
        <div key={a} className="alert alert-warning py-2 px-3 mt-2 mb-0 fs-12px" role="status"><i className="fa fa-exclamation-triangle me-1" />{a}</div>
      ))}
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
      <button type="button" className="btn btn-white" disabled={i === 0} onClick={() => onMover(i, -1)} title={tx('Subir')}><i className="fa fa-arrow-up" /></button>
      <button type="button" className="btn btn-white" disabled={i === total - 1} onClick={() => onMover(i, 1)} title={tx('Descer')}><i className="fa fa-arrow-down" /></button>
      <button type="button" className="btn btn-white text-danger" onClick={() => onRemover(i)} title={tx('Remover')}><i className="fa fa-trash-alt" /></button>
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
        <i className="fa fa-plus me-1" /> {tx('Acrescentar')}
      </button>
    </div>
  )
}

// muda um item; se lhe mudou o nome, os outros que apontavam para ele (opções «irmaos») passam a apontar para o nome novo
function mudarItem(campo, valor, i, v) {
  const antes = valor[i]?.nome
  const refs = campo.campos.filter((c) => c.opcoes === 'irmaos').map((c) => c.nome)
  return valor.map((x, j) => {
    if (j === i) return v
    if (!antes || antes === v.nome || !refs.length) return x
    return refs.reduce((y, k) => (y[k] === antes ? { ...y, [k]: v.nome } : y), x)
  })
}

function ListaObjetos({ campo, valor, onChange, contexto }) {
  const vazio = () => Object.fromEntries(campo.campos.map((c) => [c.nome, c.tipo === 'objetos' || c.tipo === 'listaTexto' ? [] : c.tipo === 'booleano' ? false : '']))
  return (
    <div className="lista-objetos">
      {valor.map((item, i) => (
        <div key={i} className="lista-objetos-item">
          <div className="lista-objetos-topo">
            <span className="badge bg-gray-600">{campo.rotuloItem || tx('Item')} {i + 1}</span>
            <BotoesItem i={i} total={valor.length} onMover={(a, d) => onChange(mover(valor, a, d))} onRemover={(a) => onChange(valor.filter((_, j) => j !== a))} />
          </div>
          <Formulario campos={campo.campos} valor={item} onChange={(v) => onChange(mudarItem(campo, valor, i, v))} contexto={{ ...contexto, irmaos: valor.filter((x, j) => j !== i && x?.nome).map((x) => x.nome) }} />
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-default" onClick={() => onChange([...valor, vazio()])}>
        <i className="fa fa-plus me-1" /> {tx('Acrescentar')} {(campo.rotuloItem || 'item').toLowerCase()}
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
          <button type="button" className="btn btn-sm btn-link" onClick={onFechar}>{tx('Cancelar')}</button>
        </div>
      ) : (
        <button type="button" className="blocos-mais" onClick={() => onAbrir(posicao)} title={tx('Inserir bloco aqui')}>
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
