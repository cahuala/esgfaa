import { useCallback, useEffect, useState } from 'react'
import { TIPOS_PEDIDO } from '../../../api/src/dominio/academico/secretaria/pedidos.js'
import { FaDownload } from 'react-icons/fa'
import { abrirFicheiro, api } from '../api'
import { Aviso, Campo, Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio } from '../componentes'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

// a lista do servidor (fonte única): o valor vai em português, só o rótulo se traduz
const TIPOS = TIPOS_PEDIDO
const ESTADOS = {
  pendente: { texto: tx('Pendente'), cor: 'cinzento' },
  em_tratamento: { texto: tx('Em tratamento'), cor: 'dourado' },
  pronto: { texto: tx('Pronto'), cor: 'verde' },
  recusado: { texto: tx('Recusado'), cor: 'vermelho' },
}

// pedidos de documentos à Administração Escolar
function Pedidos() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [f, setF] = useState({ tipo: TIPOS[0], motivo: '' })
  const [erroForm, setErroForm] = useState('')
  const [aviso, setAviso] = useState(null)
  const [aEnviar, setAEnviar] = useState(false)
  const carregar = useCallback(() => api('/pedidos').then(setLista).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  async function pedir(e) {
    e.preventDefault()
    setErroForm('')
    setAEnviar(true)
    try {
      await api('/pedidos', { metodo: 'POST', corpo: f })
      setF({ tipo: TIPOS[0], motivo: '' })
      setAviso({ texto: tx('Pedido enviado à Administração Escolar.') })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <>
      <Titulo rotulo={tx('Administração Escolar')} titulo={tx('Pedidos de documentos')} />
      <div className="p-grelha-lado">
        <Cartao titulo={tx('Os meus pedidos')}>
          {erro && <Erro texto={erro} />}
          {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>{tx('Ainda não fez pedidos.')}</Vazio> : (
            <ul className="p-lista">
              {lista.map((p) => (
                <li key={p.id}>
                  <div className="p-linha-entre">
                    <strong>{tx(p.tipo)}</strong>
                    <Etiqueta cor={ESTADOS[p.estado]?.cor}>{ESTADOS[p.estado]?.texto || p.estado}</Etiqueta>
                  </div>
                  {p.motivo && <div className="p-texto-suave">{p.motivo}</div>}
                  {p.resposta && <div className="p-resposta">{p.resposta}</div>}
                  <div className="p-linha-meta">
                    {tx('Pedido em')} {dataHora(p.criadoEm)}
                    {p.ficheiroId && (
                      <button type="button" className="btn btn-theme btn-sm" onClick={() => abrirFicheiro(p.ficheiroId, { nome: `${p.tipo}.pdf` }).catch((x) => setAviso({ tipo: 'erro', texto: x.message }))}>
                        <FaDownload aria-hidden="true" /> {tx('Descarregar')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </Cartao>
        <Cartao titulo={tx('Novo pedido')}>
          <form onSubmit={pedir} className="p-formulario">
            {erroForm && <p className="p-erro" role="alert">{erroForm}</p>}
            <Campo id="tipo" rotulo={tx('Documento')}>
              <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t} value={t}>{tx(t)}</option>)}
              </select>
            </Campo>
            <Campo id="motivo" rotulo={f.tipo === 'Outro' ? tx('Descreva o pedido') : tx('Finalidade (opcional)')}>
              <textarea id="motivo" rows={4} maxLength={1000} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
            </Campo>
            <button type="submit" className="btn btn-theme" disabled={aEnviar}>{aEnviar ? tx('A enviar…') : tx('Enviar pedido')}</button>
          </form>
        </Cartao>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Pedidos
