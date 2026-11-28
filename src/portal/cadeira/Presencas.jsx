import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Campo, Cartao, Etiqueta, Vazio, Carregando } from '../componentes'
import { data } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const ESTADOS = { presente: ['verde', tx('Presente')], falta: ['vermelho', tx('Falta')], justificada: ['dourado', tx('Justificada')] }

function Presencas(props) {
  return props.eDocente ? <Aulas {...props} /> : <MinhasPresencas {...props} />
}

function MinhasPresencas({ c }) {
  if (!c.presencas.length) return <Vazio>{tx('Ainda não há aulas registadas.')}</Vazio>
  return (
    <Cartao titulo={tx('As minhas presenças')} acoes={<><Link to="/presenca" className="btn btn-sm btn-theme me-2"><i className="fa fa-qrcode me-1" />{tx('Marcar presença')}</Link><Etiqueta cor={c.assiduidade >= 75 ? 'verde' : 'vermelho'}>{tx('Assiduidade:')} {c.assiduidade} %</Etiqueta></>}>
      <ul className="p-lista">
        {c.presencas.map((p) => (
          <li key={p.data} className="p-linha-entre">
            <span><strong>{data(p.data)}</strong>{p.sumario && <span className="p-texto-suave"> · {p.sumario}</span>}</span>
            <Etiqueta cor={ESTADOS[p.estado][0]}>{ESTADOS[p.estado][1]}</Etiqueta>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}

// docente: registar a aula (data, sumário) e as presenças da turma
function Aulas({ c, avisar }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [d, setD] = useState(null)
  const [f, setF] = useState({ data: hoje, sumario: '' })
  const [estados, setEstados] = useState({})
  const [erro, setErro] = useState('')
  const [qr, setQr] = useState(null) // { aulaId, codigo, ate, imagem }

  const carregar = useCallback(() => api(`/cadeiras/${c.id}/aulas`).then((r) => {
    setD(r)
    setEstados(Object.fromEntries(r.estudantes.map((e) => [e.id, 'presente'])))
  }).catch((e) => avisar({ tipo: 'erro', texto: e.message })), [c.id, avisar])
  useEffect(() => { carregar() }, [carregar])

  if (!d) return <Carregando />

  // presenças rápidas: o código da aula, mostrado como QR no quadro; os estudantes lêem-no no telemóvel
  async function abrirQr(aulaId) {
    try {
      const r = await api(`/aulas/${aulaId}/codigo`, { metodo: 'POST' })
      const { default: QRCode } = await import('qrcode')
      const ligacao = `${window.location.origin}${window.location.pathname}#/presenca/${r.codigo}`
      setQr({ aulaId, ...r, imagem: await QRCode.toDataURL(ligacao, { margin: 1, width: 320 }) })
    } catch (falha) { avisar({ tipo: 'erro', texto: falha.message }) }
  }
  // a aula de hoje com todos em falta: cada um fica presente ao ler o QR
  async function aulaComQr() {
    try {
      const a = await api(`/cadeiras/${c.id}/aulas`, { metodo: 'POST', corpo: { ...f, presencas: d.estudantes.map((e) => ({ estudanteId: e.id, estado: 'falta' })) } })
      setF({ data: hoje, sumario: '' })
      await carregar()
      await abrirQr(a.id)
    } catch (falha) { setErro(falha.message) }
  }
  const aulaQr = qr && d.aulas.find((a) => a.id === qr.aulaId)

  async function registar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/cadeiras/${c.id}/aulas`, { metodo: 'POST', corpo: { ...f, presencas: Object.entries(estados).map(([estudanteId, estado]) => ({ estudanteId: Number(estudanteId), estado })) } })
      setF({ data: hoje, sumario: '' })
      avisar({ texto: tx('Aula e presenças registadas.') })
      carregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  return (
    <div className="p-grelha-lado">
      <Cartao titulo={tx('Aulas registadas')}>
        {d.aulas.length === 0 ? <Vazio>{tx('Ainda não registou aulas.')}</Vazio> : (
          <ul className="p-lista">
            {d.aulas.map((a) => {
              const v = Object.values(a.presencas)
              return (
                <li key={a.id}>
                  <strong>{data(a.data)}</strong>{a.sumario && <span className="p-texto-suave"> · {a.sumario}</span>}
                  <button type="button" className="btn btn-xs btn-white float-end" onClick={() => abrirQr(a.id)} title={tx('Presença por QR')}><i className="fa fa-qrcode" /></button>
                  <div className="p-linha-meta">{v.filter((x) => x === 'presente').length} {tx('presentes ·')} {v.filter((x) => x === 'falta').length} {tx('faltas ·')} {v.filter((x) => x === 'justificada').length} {tx('justificadas')}</div>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
      <Cartao titulo={tx('Registar aula')}>
        <form onSubmit={registar} className="p-formulario">
          {erro && <p className="p-erro" role="alert">{erro}</p>}
          <Campo id="au-data" rotulo={tx('Data')}><input id="au-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></Campo>
          <Campo id="au-sumario" rotulo={tx('Sumário')}><textarea id="au-sumario" rows={3} value={f.sumario} onChange={(e) => setF({ ...f, sumario: e.target.value })} maxLength={2000} /></Campo>
          {d.estudantes.length === 0 ? <Vazio>{tx('A turma não tem estudantes.')}</Vazio> : (
            <ul className="p-lista p-presencas">
              {d.estudantes.map((e) => (
                <li key={e.id} className="p-linha-entre">
                  <span>{e.nome}</span>
                  <select className="form-select form-select-sm" aria-label={tx('Presença de {0}', { 0: e.nome })} value={estados[e.id]} onChange={(x) => setEstados({ ...estados, [e.id]: x.target.value })}>
                    {Object.entries(ESTADOS).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-theme">{tx('Registar')}</button>
            {d.estudantes.length > 0 && <button type="button" className="btn btn-white" onClick={aulaComQr} title={tx('Regista a aula com todos em falta; cada estudante fica presente ao ler o QR')}><i className="fa fa-qrcode me-1" />{tx('Registar com presença por QR')}</button>}
          </div>
        </form>
      </Cartao>
      {qr && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" onClick={() => setQr(null)}>
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content text-center">
                <div className="modal-header"><h4 className="modal-title">{tx('Presença por QR')}{aulaQr && ` · ${data(aulaQr.data)}`}</h4><button type="button" className="btn-close" onClick={() => setQr(null)} aria-label={tx('Fechar')} /></div>
                <div className="modal-body">
                  <img src={qr.imagem} alt={tx('Código QR da aula')} style={{ width: 300, maxWidth: '100%' }} />
                  <div className="display-5 fw-bold my-2" style={{ letterSpacing: 6 }}>{qr.codigo}</div>
                  <div className="small text-muted">{tx('Os estudantes lêem o QR com o telemóvel ou escrevem o código em «Marcar presença». Vale até às {0}.', { 0: new Date(qr.ate).toLocaleTimeString().slice(0, 5) })}</div>
                  {aulaQr && <div className="mt-2 fw-bold">{Object.values(aulaQr.presencas).filter((x) => x === 'presente').length} / {d.estudantes.length} {tx('presentes')}</div>}
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-white" onClick={carregar}><i className="fa fa-sync me-1" />{tx('Actualizar')}</button><button type="button" className="btn btn-theme" onClick={() => setQr(null)}>{tx('Fechar')}</button></div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  )
}

export default Presencas
