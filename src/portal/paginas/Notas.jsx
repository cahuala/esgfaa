import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaPrint } from 'react-icons/fa'
import { api } from '../api'
import { Cartao, Carregando, Erro, Titulo, Vazio, Widget } from '../componentes'
import { nota } from '../formatar'
import { Nota, Situacao } from '../avaliacao'
import { PERIODOS, REGRA } from '../regraAvaliacao'

/*
  Boletim em matriz: uma linha por disciplina e uma coluna por momento de avaliação
  (1.ª prova, 2.ª prova, MAC, exame, recurso), com a nota final e a situação.
  Só aparecem as notas que o docente já publicou.
*/
function Notas() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api('/notas').then(setLista).catch((e) => setErro(e.message)) }, [])

  const semestres = lista ? [...new Set(lista.map((l) => l.cadeira.periodo))].sort() : []
  const concluidas = lista?.filter((l) => l.situacao === 'aprovado' || l.situacao === 'dispensado') || []
  const media = concluidas.length ? Math.round((concluidas.reduce((s, l) => s + l.final, 0) / concluidas.length) * 10) / 10 : null

  return (
    <>
      <Titulo rotulo="Notas" titulo="Boletim de notas" sub="só as notas publicadas pelos docentes">
        <button type="button" className="btn btn-white" onClick={() => window.print()}><FaPrint aria-hidden="true" className="me-1" /> Imprimir</button>
      </Titulo>
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>Sem disciplinas.</Vazio> : (
        <>
          <div className="row p-sem-impressao">
            <div className="col-xl-3 col-md-6"><Widget cor="bg-dark" icone="fa-book" titulo="DISCIPLINAS" valor={lista.length} nota="este ano letivo" /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-teal" icone="fa-check-circle" titulo="CONCLUÍDAS" valor={concluidas.length} nota="aprovadas ou dispensadas" /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-red" icone="fa-star" titulo="MÉDIA DAS CONCLUÍDAS" valor={nota(media)} nota="escala de 0 a 20" /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-orange" icone="fa-hourglass-half" titulo="POR CONCLUIR" valor={lista.length - concluidas.length} nota="Ver percurso académico" para="/percurso" /></div>
          </div>

          <Cartao titulo={<><i className="fa fa-table me-2" />Boletim de notas</>} corpo={false}>
            <div className="p-tabela-rolavel">
              <table className="p-matriz">
                <thead>
                  <tr>
                    <th scope="col" className="p-matriz-nome">Disciplina</th>
                    <th scope="col">1.ª Prova</th>
                    <th scope="col">2.ª Prova</th>
                    <th scope="col" className="p-matriz-mac">MAC</th>
                    <th scope="col">Exame</th>
                    <th scope="col">Recurso</th>
                    <th scope="col" className="p-matriz-final">Nota final</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                {semestres.map((s) => (
                  <tbody key={s}>
                    {semestres.length > 1 && <tr className="p-matriz-grupo"><th colSpan={8}>{PERIODOS[s]}</th></tr>}
                    {lista.filter((l) => l.cadeira.periodo === s).map((l) => (
                      <tr key={l.cadeira.id}>
                        <th scope="row" className="p-matriz-nome">
                          <Link to={`/cadeiras/${l.cadeira.id}?separador=avaliacoes`}>{l.cadeira.nome}</Link>
                          <small>{l.cadeira.codigo}{l.cadeira.docente && ` · ${l.cadeira.docente}`}</small>
                        </th>
                        <td><Nota valor={l.p1} /></td>
                        <td><Nota valor={l.p2} /></td>
                        <td className="p-matriz-mac"><Nota valor={l.mac} /></td>
                        <td>{l.situacao === 'dispensado' ? <span className="p-nota-vazia">dispensado</span> : <Nota valor={l.exame} />}</td>
                        <td><Nota valor={l.recurso} /></td>
                        <td className="p-matriz-final"><Nota valor={l.situacao === 'recurso' ? null : l.final} forte /></td>
                        <td>
                          <Situacao situacao={l.situacao} />
                          {l.classificacao && l.situacao !== 'reprovado' && <small className="p-classificacao">{l.classificacao}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </Cartao>
          <p className="p-legenda">{REGRA} Escala de 0 a 20. “—” = nota ainda não publicada.</p>
        </>
      ))}
    </>
  )
}

export default Notas
