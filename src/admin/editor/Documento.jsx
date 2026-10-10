import { useState } from 'react'
import EditorTexto from './EditorTexto'
import { TextoAuto, ZonaFicheiro } from './Elementos'
import { carregar } from './carregar'

/*
  Notícia/artigo/evento editado como um documento:
  secção, título, entrada e capa no topo; depois o texto completo, com imagens,
  galerias, vídeos e tabelas colocados em qualquer ponto.
  doc: { etiqueta, titulo, entrada, capa, corpo, placeholderTitulo }
*/
function Documento({ item, setItem, doc, aoErro, editavel = true }) {
  const [capaACarregar, setCapaACarregar] = useState(false)
  const definir = (campo, valor) => setItem((i) => ({ ...i, [campo]: valor }))

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

  const cabeca = (
    <>
      <div className="doc-cabeca">
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
      </div>

      {doc.capa && (
        item[doc.capa] ? (
          <figure className="doc-capa">
            <img src={item[doc.capa]} alt="" />
            {editavel && (
              <div className="doc-ferramentas">
                <ZonaFicheiro aceitar="image/*" className="doc-botao-zona" onFicheiros={trocarCapa}>
                  <span title="Substituir a imagem de capa"><i className={`fa ${capaACarregar ? 'fa-spinner fa-spin' : 'fa-sync-alt'} me-1`} />Substituir capa</span>
                </ZonaFicheiro>
                <button type="button" title="Retirar a imagem de capa" onClick={() => definir(doc.capa, '')}><i className="fa fa-trash-alt" /></button>
              </div>
            )}
          </figure>
        ) : (
          <ZonaFicheiro aceitar="image/*" className="doc-capa-vazia" onFicheiros={trocarCapa}>
            <i className="fa fa-camera fa-2x mb-2" />
            <strong>{capaACarregar ? 'A carregar…' : 'Adicionar imagem de capa'}</strong>
            <span>a fotografia principal — clique ou arraste para aqui</span>
          </ZonaFicheiro>
        )
      )}
    </>
  )

  return (
    <div className="doc-folha">
      <EditorTexto
        html={item[doc.corpo]?.[0]?.html || ''}
        onChange={(html) => definir(doc.corpo, [{ tipo: 'texto', html }])}
        aoErro={aoErro}
        editavel={editavel}
        antes={cabeca}
      />
    </div>
  )
}

export default Documento
