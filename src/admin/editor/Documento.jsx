import { useState } from 'react'
import BlocoTexto from './BlocoTexto'
import { Citacao, Destaque, Galeria, Imagem, Referencias, TextoAuto, Video, ZonaFicheiro } from './Elementos'
import { carregar } from './carregar'
import { htmlVazio, novoId } from './normalizar'

const ELEMENTOS = [
  ['texto', 'fa-paragraph', 'Texto'],
  ['imagem', 'fa-image', 'Imagem'],
  ['galeria', 'fa-images', 'Galeria'],
  ['video', 'fa-video', 'Vídeo'],
  ['citacao', 'fa-quote-right', 'Citação'],
  ['destaque', 'fa-square-full', 'Destaque'],
  ['referencias', 'fa-book', 'Referências'],
]

const novoBloco = (tipo) => ({
  _id: novoId(),
  tipo,
  ...{
    texto: { html: '' },
    imagem: { src: '', legenda: '', posicao: 'centro' },
    galeria: { imagens: [], legenda: '' },
    video: { youtube: '', src: '', legenda: '' },
    citacao: { texto: '', autor: '' },
    destaque: { titulo: '', texto: '' },
    referencias: { itens: [] },
  }[tipo],
})

// "+" entre elementos: abre a lista do que se pode inserir
function Inserir({ onEscolher, fixo = false }) {
  const [aberto, setAberto] = useState(fixo)
  if (!aberto) {
    return (
      <div className="doc-inserir">
        <button type="button" className="doc-inserir-mais" onClick={() => setAberto(true)} title="Inserir um elemento aqui"><i className="fa fa-plus" /></button>
      </div>
    )
  }
  return (
    <div className={`doc-inserir doc-inserir-aberto ${fixo ? 'doc-inserir-fixo' : ''}`}>
      {fixo && <span className="doc-inserir-rotulo">Acrescentar ao fim</span>}
      {ELEMENTOS.map(([tipo, icone, rotulo]) => (
        <button key={tipo} type="button" onClick={() => { onEscolher(tipo); if (!fixo) setAberto(false) }}>
          <i className={`fa ${icone}`} />{rotulo}
        </button>
      ))}
      {!fixo && <button type="button" className="doc-inserir-fechar" onClick={() => setAberto(false)} title="Fechar"><i className="fa fa-times" /></button>}
    </div>
  )
}

/*
  Notícia/artigo/evento editado como um documento:
  secção, título, entrada e capa no topo; depois o corpo com texto e elementos.
  doc: { etiqueta, titulo, entrada, capa, corpo, placeholderTitulo }
*/
function Documento({ item, setItem, doc, aoErro }) {
  const blocos = item[doc.corpo] || []
  const [abrirEm, setAbrirEm] = useState(null) // _id do elemento acabado de inserir (abre o seletor de ficheiros)
  const [capaACarregar, setCapaACarregar] = useState(false)

  const definir = (campo, valor) => setItem((i) => ({ ...i, [campo]: valor }))
  const setBlocos = (fn) => setItem((i) => ({ ...i, [doc.corpo]: fn(i[doc.corpo] || []) }))

  function inserirEm(posicao, tipo) {
    const bloco = novoBloco(tipo)
    setBlocos((lista) => {
      const nova = [...lista]
      nova.splice(posicao, 0, bloco)
      // depois de um elemento, deixa sempre um texto onde continuar a escrever
      if (tipo !== 'texto' && nova[posicao + 1]?.tipo !== 'texto') nova.splice(posicao + 1, 0, novoBloco('texto'))
      return nova
    })
    setAbrirEm(bloco._id)
  }

  // divide o texto no cursor: [texto antes] [elemento] [texto depois]
  function dividir(indice, tipo, antes, depois) {
    const bloco = novoBloco(tipo)
    setBlocos((lista) => {
      const nova = [...lista]
      const partes = [
        ...(htmlVazio(antes) ? [] : [{ ...lista[indice], html: antes }]),
        bloco,
        { _id: novoId(), tipo: 'texto', html: htmlVazio(depois) ? '' : depois },
      ]
      nova.splice(indice, 1, ...partes)
      return nova
    })
    setAbrirEm(bloco._id)
  }

  function mover(i, delta) {
    setBlocos((lista) => {
      const j = i + delta
      if (j < 0 || j >= lista.length) return lista
      const nova = [...lista]
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      return nova
    })
  }

  function remover(i) {
    setBlocos((lista) => {
      const nova = lista.filter((_, j) => j !== i)
      // junta os dois textos que ficaram seguidos
      if (nova[i - 1]?.tipo === 'texto' && nova[i]?.tipo === 'texto') {
        nova.splice(i - 1, 2, { ...nova[i - 1], html: `${nova[i - 1].html}${nova[i].html}` })
      }
      return nova.length ? nova : [novoBloco('texto')]
    })
  }

  const alterarBloco = (i) => (novo) => setBlocos((lista) => lista.map((b, j) => (j === i ? novo : b)))

  async function trocarCapa(ficheiros) {
    setCapaACarregar(true)
    try {
      const [url] = await carregar(ficheiros)
      if (url) definir(doc.capa, url)
    } catch (e) {
      aoErro(e.message)
    } finally {
      setCapaACarregar(false)
    }
  }

  return (
    <div className="doc-folha">
      {doc.etiqueta && <span className="doc-etiqueta">{item[doc.etiqueta] || 'Sem secção'}</span>}

      <TextoAuto className="doc-titulo" placeholder={doc.placeholderTitulo || 'Título'} valor={item[doc.titulo]} onChange={(v) => definir(doc.titulo, v)} maxLength={180} />

      {doc.entrada && (
        <TextoAuto
          className="doc-entrada"
          placeholder="Entrada: uma ou duas frases que resumem o essencial (aparece nas listagens e no topo)."
          valor={item[doc.entrada]}
          onChange={(v) => definir(doc.entrada, v)}
          maxLength={320}
        />
      )}

      {doc.capa && (
        item[doc.capa] ? (
          <figure className="doc-capa">
            <img src={item[doc.capa]} alt="" />
            <div className="doc-ferramentas">
              <ZonaFicheiro aceitar="image/*" className="doc-botao-zona" onFicheiros={trocarCapa}>
                <span title="Substituir a imagem de capa"><i className={`fa ${capaACarregar ? 'fa-spinner fa-spin' : 'fa-sync-alt'} me-1`} />Substituir capa</span>
              </ZonaFicheiro>
              <button type="button" title="Retirar a imagem de capa" onClick={() => definir(doc.capa, '')}><i className="fa fa-trash-alt" /></button>
            </div>
          </figure>
        ) : (
          <ZonaFicheiro aceitar="image/*" className="doc-capa-vazia" onFicheiros={trocarCapa}>
            <i className="fa fa-camera fa-2x mb-2" />
            <strong>{capaACarregar ? 'A carregar…' : 'Adicionar imagem de capa'}</strong>
            <span>a fotografia principal — clique ou arraste para aqui</span>
          </ZonaFicheiro>
        )
      )}

      <div className="doc-corpo">
        {blocos.map((b, i) => {
          const ferramentas = b.tipo !== 'texto' && (
            <div className="doc-bloco-acoes" role="toolbar" aria-label="Ações do elemento">
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir"><i className="fa fa-arrow-up" /></button>
              <button type="button" disabled={i === blocos.length - 1} onClick={() => mover(i, 1)} title="Descer"><i className="fa fa-arrow-down" /></button>
              <button type="button" className="perigo" onClick={() => remover(i)} title="Retirar este elemento"><i className="fa fa-trash-alt" /></button>
            </div>
          )
          const comum = { bloco: b, onChange: alterarBloco(i), abrirJa: abrirEm === b._id, aoErro }
          return (
            <div key={b._id} className={`doc-bloco doc-bloco-${b.tipo}${b.tipo === 'imagem' ? ` doc-bloco-pos-${b.posicao || 'centro'}` : ''}`}>
              {i > 0 && blocos[i - 1].tipo !== 'texto' && b.tipo !== 'texto' && <Inserir onEscolher={(t) => inserirEm(i, t)} />}
              {ferramentas}
              {b.tipo === 'texto' && (
                <BlocoTexto
                  html={b.html}
                  onChange={(html) => alterarBloco(i)({ ...b, html })}
                  onInserir={(tipo, antes, depois) => dividir(i, tipo, antes, depois)}
                  placeholder={i === 0 ? 'Comece a escrever o texto…' : 'Continue a escrever…'}
                />
              )}
              {b.tipo === 'imagem' && <Imagem {...comum} />}
              {b.tipo === 'galeria' && <Galeria {...comum} />}
              {b.tipo === 'video' && <Video {...comum} />}
              {b.tipo === 'citacao' && <Citacao {...comum} />}
              {b.tipo === 'destaque' && <Destaque {...comum} />}
              {b.tipo === 'referencias' && <Referencias {...comum} />}
            </div>
          )
        })}
      </div>

      <Inserir fixo onEscolher={(t) => inserirEm(blocos.length, t)} />
    </div>
  )
}

export default Documento
