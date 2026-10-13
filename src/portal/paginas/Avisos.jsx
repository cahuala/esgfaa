import { useEffect, useState } from 'react'
import { api } from '../api'
import { Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio } from '../componentes'
import { dataHora } from '../formatar'

function Avisos() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/avisos').then(setLista).catch((e) => setErro(e.message)) }, [])
  return (
    <>
      <Titulo rotulo="Secretaria Académica" titulo="Avisos" />
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>Sem avisos.</Vazio> : (
        <div className="p-coluna">
          {lista.map((a) => (
            <Cartao key={a.id} titulo={a.titulo} acoes={<Etiqueta cor={a.turma ? 'azul' : 'cinzento'}>{a.turma || 'Todos os estudantes'}</Etiqueta>}>
              <p className="p-texto-pre">{a.texto}</p>
              <small className="p-texto-fraco">{dataHora(a.criadoEm)}</small>
            </Cartao>
          ))}
        </div>
      ))}
    </>
  )
}

export default Avisos
