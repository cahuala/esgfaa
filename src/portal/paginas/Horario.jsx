import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Carregando, Erro, Titulo, Vazio } from '../componentes'
import { DIAS } from '../formatar'
import { t as tx } from '../../i18n/linguas'

// horário semanal (segunda a sábado)
function Horario() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/horario').then(setLista).catch((e) => setErro(e.message)) }, [])
  const hoje = new Date().getDay()

  return (
    <>
      <Titulo rotulo={tx('Semana')} titulo={tx('Horário')} />
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>{tx('O horário ainda não foi publicado pela Administração Escolar.')}</Vazio> : (
        <div className="p-horario">
          {[1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || lista.some((h) => h.diaSemana === 6)).map((dia) => (
            <section key={dia} className={`p-dia ${dia === hoje ? 'p-dia-hoje' : ''}`}>
              <h2>{DIAS[dia]}{dia === hoje && <span> {tx('· hoje')}</span>}</h2>
              {lista.filter((h) => h.diaSemana === dia).map((h) => (
                <Link key={h.id} to={`/cadeiras/${h.cadeiraId}`} className="p-aula">
                  <strong>{h.inicio}–{h.fim}</strong>
                  <span>{h.cadeira}</span>
                  {h.sala && <small>{h.sala}</small>}
                </Link>
              ))}
              {!lista.some((h) => h.diaSemana === dia) && <p className="p-texto-fraco">{tx('Sem aulas')}</p>}
            </section>
          ))}
        </div>
      ))}
    </>
  )
}

export default Horario
