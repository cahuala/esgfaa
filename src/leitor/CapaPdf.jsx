import { useEffect, useRef, useState } from 'react'

/*
  Capa de um PDF: a imagem indicada ou, sem ela, a primeira página desenhada pelo pdf.js
  (assim um número carregado só com o PDF já aparece com capa).
*/
function CapaPdf({ capa, pdf, alt = '', className }) {
  const tela = useRef(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (capa || !pdf || !tela.current) return undefined
    let tarefa = null
    let ativo = true
    Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(async ([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      tarefa = lib.getDocument({ url: pdf })
      const doc = await tarefa.promise
      const p = await doc.getPage(1)
      const base = p.getViewport({ scale: 1 })
      const vp = p.getViewport({ scale: 600 / base.width })
      const c = tela.current
      if (!ativo || !c) return
      c.width = vp.width
      c.height = vp.height
      await p.render({ canvas: c, viewport: vp }).promise
    }).catch(() => { if (ativo) setFalhou(true) })
    return () => { ativo = false; tarefa?.destroy() }
  }, [capa, pdf])

  if (capa) return <img src={capa} alt={alt} className={className} loading="lazy" />
  if (falhou || !pdf) return <div className={className} role="img" aria-label={alt} />
  return <canvas ref={tela} className={className} role="img" aria-label={alt} />
}

export default CapaPdf
