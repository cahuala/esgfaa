import { useState } from 'react'
import { FaTrashAlt } from 'react-icons/fa'
import { api } from '../api'
import { Campo, Cartao, Vazio } from '../componentes'
import { dataHora } from '../formatar'
import { confirmar } from '../dialogos'
import { t as tx } from '../../i18n/linguas'

function AvisosCadeira({ c, eDocente, recarregar, avisar }) {
  const [f, setF] = useState({ titulo: '', texto: '' })
  const [erro, setErro] = useState('')

  async function publicar(e) {
    e.preventDefault()
    setErro('')
    try {
      await api(`/cadeiras/${c.id}/avisos`, { metodo: 'POST', corpo: f })
      setF({ titulo: '', texto: '' })
      avisar({ texto: tx('Aviso publicado.') })
      recarregar()
    } catch (falha) {
      setErro(falha.message)
    }
  }

  async function apagar(a) {
    if (!(await confirmar(tx('Apagar o aviso "{0}"?', { 0: a.titulo }), { titulo: tx('Apagar aviso'), botao: tx('Apagar'), perigo: true }))) return
    await api(`/avisos/${a.id}`, { metodo: 'DELETE' }).then(recarregar).catch((x) => avisar({ tipo: 'erro', texto: x.message }))
  }

  return (
    <div className={eDocente ? 'p-grelha-lado' : ''}>
      <div className="p-coluna">
        {c.avisos.length === 0 && <Vazio>{tx('Sem avisos.')}</Vazio>}
        {c.avisos.map((a) => (
          <Cartao key={a.id} titulo={a.titulo} acoes={eDocente && <button type="button" className="btn btn-white btn-icon btn-sm" onClick={() => apagar(a)} aria-label={tx('Apagar aviso')}><FaTrashAlt /></button>}>
            <p className="p-texto-pre">{a.texto}</p>
            <small className="p-texto-fraco">{dataHora(a.criadoEm)}</small>
          </Cartao>
        ))}
      </div>
      {eDocente && (
        <Cartao titulo={tx('Novo aviso')}>
          <form onSubmit={publicar} className="p-formulario">
            {erro && <p className="p-erro" role="alert">{erro}</p>}
            <Campo id="a-titulo" rotulo={tx('Título')}><input id="a-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} required /></Campo>
            <Campo id="a-texto" rotulo={tx('Texto')}><textarea id="a-texto" rows={5} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} maxLength={5000} required /></Campo>
            <button type="submit" className="btn btn-theme">{tx('Publicar aviso')}</button>
          </form>
        </Cartao>
      )}
    </div>
  )
}

export default AvisosCadeira
