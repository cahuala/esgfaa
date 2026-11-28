import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Campo, Cartao, Titulo } from '../componentes'
import { data } from '../formatar'
import { t as tx } from '../../i18n/linguas'

/*
  Presenças rápidas: o estudante lê o QR que o docente mostra na sala (abre esta página com o código) ou escreve o
  código de 6 algarismos — e fica presente nessa aula.
*/
export default function MarcarPresenca() {
  const { codigo: doQr } = useParams()
  const [codigo, setCodigo] = useState(doQr ?? '')
  const [estado, setEstado] = useState(null) // { ok, texto }
  const [aEnviar, setAEnviar] = useState(false)
  const enviado = useRef(false)
  async function marcar(c) {
    setAEnviar(true)
    try {
      const r = await api('/presencas/codigo', { metodo: 'POST', corpo: { codigo: c } })
      setEstado({ ok: true, texto: tx('Presença marcada: {0} ({1}).', { 0: `${r.cadeira.codigo} ${r.cadeira.nome}`, 1: data(r.data) }) })
    } catch (e) {
      setEstado({ ok: false, texto: e.message })
    } finally { setAEnviar(false) }
  }
  // vindo do QR: marca logo (uma vez)
  useEffect(() => {
    if (doQr && !enviado.current) { enviado.current = true; marcar(doQr) }
  }, [doQr])
  return (
    <>
      <Titulo titulo={tx('Marcar presença')} />
      <Cartao>
        {estado && <p className={estado.ok ? 'alert alert-success' : 'p-erro'} role="alert"><i className={`fa ${estado.ok ? 'fa-check-circle' : 'fa-times-circle'} me-1`} />{estado.texto}</p>}
        {!estado?.ok && (
          <form className="p-formulario" onSubmit={(e) => { e.preventDefault(); marcar(codigo) }}>
            <Campo id="pr-codigo" rotulo={tx('Código da aula (está no quadro, por baixo do QR)')}>
              <input id="pr-codigo" inputMode="numeric" autoComplete="off" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 28, letterSpacing: 6, maxWidth: 220 }} autoFocus />
            </Campo>
            <button type="submit" className="btn btn-theme" disabled={codigo.length !== 6 || aEnviar}>{tx('Marcar presença')}</button>
          </form>
        )}
        {estado?.ok && <Link to="/" className="btn btn-white">{tx('Voltar ao início')}</Link>}
      </Cartao>
    </>
  )
}
