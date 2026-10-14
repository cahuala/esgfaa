import { useCallback, useEffect, useState } from 'react'
import { FaDownload } from 'react-icons/fa'
import { abrirFicheiro, api } from '../api'
import { Aviso, Campo, Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio } from '../componentes'
import { dataHora } from '../formatar'

const TIPOS = ['Declaração de matrícula', 'Declaração de frequência', 'Certificado de notas', 'Certificado de conclusão', 'Segunda via do cartão de estudante', 'Outro']
const ESTADOS = {
  pendente: { texto: 'Pendente', cor: 'cinzento' },
  em_tratamento: { texto: 'Em tratamento', cor: 'dourado' },
  pronto: { texto: 'Pronto', cor: 'verde' },
  recusado: { texto: 'Recusado', cor: 'vermelho' },
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
      setAviso({ texto: 'Pedido enviado à Administração Escolar.' })
      carregar()
    } catch (falha) {
      setErroForm(falha.message)
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <>
      <Titulo rotulo="Administração Escolar" titulo="Pedidos de documentos" />
      <div className="p-grelha-lado">
        <Cartao titulo="Os meus pedidos">
          {erro && <Erro texto={erro} />}
          {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>Ainda não fez pedidos.</Vazio> : (
            <ul className="p-lista">
              {lista.map((p) => (
                <li key={p.id}>
                  <div className="p-linha-entre">
                    <strong>{p.tipo}</strong>
                    <Etiqueta cor={ESTADOS[p.estado]?.cor}>{ESTADOS[p.estado]?.texto || p.estado}</Etiqueta>
                  </div>
                  {p.motivo && <div className="p-texto-suave">{p.motivo}</div>}
                  {p.resposta && <div className="p-resposta">{p.resposta}</div>}
                  <div className="p-linha-meta">
                    Pedido em {dataHora(p.criadoEm)}
                    {p.ficheiroId && (
                      <button type="button" className="p-botao p-botao-pequeno" onClick={() => abrirFicheiro(p.ficheiroId, { nome: `${p.tipo}.pdf` }).catch((x) => setAviso({ tipo: 'erro', texto: x.message }))}>
                        <FaDownload aria-hidden="true" /> Descarregar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
        </Cartao>
        <Cartao titulo="Novo pedido">
          <form onSubmit={pedir} className="p-formulario">
            {erroForm && <p className="p-erro" role="alert">{erroForm}</p>}
            <Campo id="tipo" rotulo="Documento">
              <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo id="motivo" rotulo={f.tipo === 'Outro' ? 'Descreva o pedido' : 'Finalidade (opcional)'}>
              <textarea id="motivo" rows={4} maxLength={1000} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
            </Campo>
            <button type="submit" className="p-botao" disabled={aEnviar}>{aEnviar ? 'A enviar…' : 'Enviar pedido'}</button>
          </form>
        </Cartao>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Pedidos
