import { useRef, useState } from 'react'
import { iconeFicheiro, tamanho } from './formatar'


/*
  Zona de envio no estilo do Color Admin (dropzone + tabela de ficheiros do "multiple upload"):
  arrastar ou clicar, pré-visualização, tamanho, progresso do envio e retirar.
  ficheiros: [{ ficheiro: File, progresso, erro }]
*/
function ZonaUpload({ id, ficheiros, aoMudar, multiplos = false, aceitar, nota = 'PDF, Word, PowerPoint, Excel, imagens ou vídeo — até 50 MB por ficheiro.', desativado }) {
  const entrada = useRef(null)
  const [sobre, setSobre] = useState(false)

  const juntar = (lista) => {
    const novos = [...lista].map((f) => ({ ficheiro: f, progresso: 0, erro: '' }))
    aoMudar(multiplos ? [...ficheiros, ...novos] : novos.slice(0, 1))
  }

  return (
    <div>
      <div
        className={`dropzone needsclick rounded p-ondrop ${sobre ? 'p-dz-sobre' : ''} ${desativado ? 'opacity-50' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !desativado && entrada.current?.click()}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !desativado) { e.preventDefault(); entrada.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); if (!desativado) juntar(e.dataTransfer.files) }}
      >
        <div className="dz-message needsclick my-4">
          <div className="text-center mb-2"><i className="fa fa-cloud-upload-alt fa-3x text-gray-400" /></div>
          <span className="fs-16px">Arraste {multiplos ? 'os ficheiros' : 'o ficheiro'} para aqui ou <b className="text-theme">clique para escolher</b></span>
          <span className="dz-note needsclick fs-12px">{nota}</span>
        </div>
        <input
          ref={entrada}
          id={id}
          type="file"
          className="d-none"
          multiple={multiplos}
          accept={aceitar}
          onChange={(e) => { const lista = [...e.target.files]; e.target.value = ''; juntar(lista) }}
        />
      </div>
      {ficheiros.length > 0 && (
        <div className="table-responsive mt-2">
          <table className="table table-panel align-middle mb-0">
            <thead><tr><th style={{ width: 48 }} /><th>Ficheiro</th><th style={{ width: '35%' }}>Envio</th><th style={{ width: 1 }} /></tr></thead>
            <tbody>
              {ficheiros.map((f, i) => (
                <tr key={`${f.ficheiro.name}-${i}`}>
                  <td className="text-center">
                    {f.ficheiro.type.startsWith('image/')
                      ? <img src={URL.createObjectURL(f.ficheiro)} alt="" className="rounded" style={{ width: 40, height: 40, objectFit: 'cover' }} />
                      : <i className={`fa ${iconeFicheiro(f.ficheiro.type)} fa-2x`} />}
                  </td>
                  <td className="text-break"><div className="fw-bold">{f.ficheiro.name}</div><div className="small text-muted">{tamanho(f.ficheiro.size)}</div></td>
                  <td>
                    {f.erro ? <span className="text-danger small">{f.erro}</span> : (
                      <div className="progress h-10px">
                        <div className={`progress-bar ${f.progresso === 100 ? 'bg-success' : 'progress-bar-striped progress-bar-animated'}`} style={{ width: `${f.progresso}%` }} />
                      </div>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn btn-xs btn-white" disabled={desativado} onClick={() => aoMudar(ficheiros.filter((_, j) => j !== i))} aria-label={`Retirar ${f.ficheiro.name}`}><i className="fa fa-times" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ZonaUpload
