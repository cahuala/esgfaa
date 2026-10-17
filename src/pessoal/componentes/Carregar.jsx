import { useEffect, useId, useMemo, useRef, useState } from 'react'

const TAMANHO = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const ICONE = (f) => (f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'fa-file-pdf text-danger' : f.type.startsWith('image/') ? 'fa-file-image text-info' : /\.(xlsx|csv)$/i.test(f.name) ? 'fa-file-excel text-success' : /\.docx$/i.test(f.name) ? 'fa-file-word text-primary' : 'fa-file text-muted')

// aceita: ".pdf,image/*" — confere a extensão e o tipo do ficheiro
function aceite(f, aceitar) {
  if (!aceitar) return true
  return aceitar.split(',').map((x) => x.trim().toLowerCase()).some((a) => (a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a))
}

function Miniatura({ f }) {
  const url = useMemo(() => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null), [f])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url ? <img src={url} alt="" className="pes-carregar-mini" /> : <i className={`fa fa-2x ${ICONE(f)}`} />
}

/*
  Carregar ficheiros (em todo o sistema): arrastar e largar ou clicar, por teclado também; verifica o tipo
  e o tamanho antes de enviar e diz porquê se recusar; mostra os escolhidos (miniatura, tamanho, retirar)
  e a barra de progresso do envio.
  Dois modos: com ficheiros/aoMudar fica com a lista (o formulário envia depois); só com aoEscolher, entrega
  logo os ficheiros (envio imediato).
*/
export default function Carregar({ aceitar, multiplo = false, maxMb = 25, pasta = false, ficheiros, aoMudar, aoEscolher, titulo, ajuda, icone = 'fa-cloud-upload-alt', progresso = null, desativado = false, compacto = false }) {
  const id = useId()
  const entrada = useRef(null)
  const entradaPasta = useRef(null)
  const [sobre, setSobre] = useState(false)
  const [recusados, setRecusados] = useState([])
  const lista = ficheiros ?? []

  function receber(novos) {
    const bons = []
    const maus = []
    for (const f of novos) {
      if (!aceite(f, aceitar)) maus.push(`${f.name}: tipo não aceite.`)
      else if (f.size > maxMb * 1048576) maus.push(`${f.name}: tem ${TAMANHO(f.size)} (máximo ${maxMb} MB).`)
      else if (!f.size) maus.push(`${f.name}: ficheiro vazio.`)
      else bons.push(f)
    }
    setRecusados(maus)
    if (!bons.length) return
    const escolhidos = multiplo ? bons : bons.slice(0, 1)
    if (aoMudar) aoMudar(multiplo ? [...lista, ...escolhidos.filter((f) => !lista.some((x) => x.name === f.name && x.size === f.size))] : escolhidos)
    else aoEscolher?.(multiplo ? escolhidos : escolhidos[0])
  }
  const aEnviar = progresso !== null && progresso !== undefined
  const bloqueado = desativado || aEnviar
  const abrir = () => !bloqueado && entrada.current?.click()

  return (
    <div className="pes-carregar">
      <div
        role="button" tabIndex={bloqueado ? -1 : 0} aria-disabled={bloqueado} aria-describedby={`${id}-ajuda`}
        className={`pes-carregar-zona ${sobre ? 'sobre' : ''} ${compacto ? 'compacto' : ''} ${bloqueado ? 'bloqueado' : ''}`}
        onClick={abrir} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() } }}
        onDragOver={(e) => { e.preventDefault(); if (!bloqueado) setSobre(true) }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); if (!bloqueado) receber([...e.dataTransfer.files]) }}
      >
        <i className={`fa ${aEnviar ? 'fa-spinner fa-spin' : icone} ${compacto ? '' : 'fa-2x'} text-theme`} />
        <div className="pes-carregar-texto">
          <strong>{aEnviar ? `A enviar… ${Math.round(progresso)}%` : titulo ?? (multiplo ? 'Arraste os ficheiros para aqui' : 'Arraste o ficheiro para aqui')}</strong>
          {!aEnviar && <span> ou <u>clique para escolher</u>{pasta && <> · <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={(e) => { e.stopPropagation(); entradaPasta.current?.click() }}>escolher uma pasta</button></>}</span>}
          <small id={`${id}-ajuda`} className="d-block text-muted">{ajuda ?? `${aceitar ? aceitar.replace(/image\/\*/g, 'imagens').replace(/application\/pdf/g, 'PDF').toUpperCase().replace(/\./g, '') : 'Qualquer tipo'} · até ${maxMb} MB${multiplo ? ' cada' : ''}`}</small>
        </div>
        {aEnviar && <div className="progress pes-carregar-progresso"><div className="progress-bar bg-success" style={{ width: `${progresso}%` }} /></div>}
      </div>
      <input ref={entrada} type="file" hidden accept={aceitar} multiple={multiplo} onChange={(e) => { receber([...e.target.files]); e.target.value = '' }} />
      {pasta && <input ref={entradaPasta} type="file" hidden multiple webkitdirectory="" directory="" onChange={(e) => { receber([...e.target.files]); e.target.value = '' }} />}
      {recusados.length > 0 && <div className="small text-danger mt-1" role="alert">{recusados.slice(0, 6).map((r) => <div key={r}><i className="fa fa-times-circle me-1" />{r}</div>)}{recusados.length > 6 && <div>… e mais {recusados.length - 6}.</div>}</div>}
      {lista.length > 0 && (
        <ul className="pes-carregar-lista">
          {lista.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`}>
              <Miniatura f={f} />
              <span className="flex-grow-1 text-truncate"><span className="d-block text-truncate">{f.name}</span><small className="text-muted">{TAMANHO(f.size)}</small></span>
              {aoMudar && !aEnviar && <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => aoMudar(lista.filter((_, j) => j !== i))} aria-label={`Retirar ${f.name}`}><i className="fa fa-times" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
