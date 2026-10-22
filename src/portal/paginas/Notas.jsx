import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaPrint } from 'react-icons/fa'
import { api } from '../api'
import { Cartao, Carregando, Erro, Titulo, Vazio, Widget } from '../componentes'
import { nota } from '../formatar'
import { Nota, Situacao } from '../avaliacao'
import { PERIODOS, REGRA, REGRA_ESG } from '../regraAvaliacao'
import RegrasPlano from '../RegrasPlano'
import { t as tx } from '../../i18n/linguas'
import CabecalhoImpressao from '../../components/CabecalhoImpressao'

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
      <CabecalhoImpressao titulo="Boletim de notas" area="Administração Escolar" />
      <Titulo rotulo={tx('Notas')} titulo={tx('Boletim de notas')} sub={tx('só as notas publicadas pelos docentes')}>
        <button type="button" className="btn btn-white" onClick={() => window.print()}><FaPrint aria-hidden="true" className="me-1" /> {tx('Imprimir')}</button>
      </Titulo>
      {erro && <Erro texto={erro} />}
      {!lista && !erro ? <Carregando /> : lista && (lista.length === 0 ? <Vazio>{tx('Sem disciplinas.')}</Vazio> : (
        <>
          <div className="row p-sem-impressao">
            <div className="col-xl-3 col-md-6"><Widget cor="bg-dark" icone="fa-book" titulo={tx('DISCIPLINAS')} valor={lista.length} nota={tx('este ano letivo')} /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-teal" icone="fa-check-circle" titulo={tx('CONCLUÍDAS')} valor={concluidas.length} nota={tx('aprovadas ou dispensadas')} /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-red" icone="fa-star" titulo={tx('MÉDIA DAS CONCLUÍDAS')} valor={nota(media)} nota={tx('escala de 0 a 20')} /></div>
            <div className="col-xl-3 col-md-6"><Widget cor="bg-orange" icone="fa-hourglass-half" titulo={tx('POR CONCLUIR')} valor={lista.length - concluidas.length} nota={tx('Ver percurso académico')} para="/percurso" /></div>
          </div>

          {lista.some((l) => l.modo === 'esg') && <BoletimEsg lista={lista.filter((l) => l.modo === 'esg')} semestres={semestres} />}
          {lista.some((l) => l.modo !== 'esg') && <Cartao titulo={<><i className="fa fa-table me-2" />{tx('Boletim de notas')}</>} corpo={false}>
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz">
                <thead>
                  <tr>
                    <th scope="col" className="p-matriz-nome">{tx('Disciplina')}</th>
                    <th scope="col">{tx('1.ª Prova')}</th>
                    <th scope="col">{tx('2.ª Prova')}</th>
                    <th scope="col" className="p-matriz-mac">{tx('MAC')}</th>
                    <th scope="col">{tx('Exame')}</th>
                    <th scope="col">{tx('Recurso')}</th>
                    <th scope="col" className="p-matriz-final">{tx('Nota final')}</th>
                    <th scope="col">{tx('Situação')}</th>
                  </tr>
                </thead>
                {semestres.map((s) => (
                  <tbody key={s}>
                    {semestres.length > 1 && <tr className="p-matriz-grupo"><th colSpan={8}>{PERIODOS[s]}</th></tr>}
                    {lista.filter((l) => l.cadeira.periodo === s && l.modo !== 'esg').map((l) => (
                      <tr key={l.cadeira.id}>
                        <th scope="row" className="p-matriz-nome">
                          <Link to={`/cadeiras/${l.cadeira.id}?separador=avaliacoes`}>{l.cadeira.nome}</Link>
                          <small>{l.cadeira.codigo}{l.cadeira.docente && ` · ${l.cadeira.docente}`}</small>
                        </th>
                        <td><Nota valor={l.p1} /></td>
                        <td><Nota valor={l.p2} /></td>
                        <td className="p-matriz-mac"><Nota valor={l.mac} /></td>
                        <td>{l.situacao === 'dispensado' ? <span className="p-nota-vazia">{tx('dispensado')}</span> : <Nota valor={l.exame} />}</td>
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
          </Cartao>}
          {lista.some((l) => l.modo !== 'esg') && <p className="p-legenda">{REGRA} {tx('Escala de 0 a 20. “—” = nota ainda não publicada.')}</p>}
        </>
      ))}
    </>
  )
}

// boletim pelo plano de curso da ESG: as provas (TAI/TAG) publicadas, a nota da UC e a menção
function BoletimEsg({ lista, semestres }) {
  return (
    <>
      <Cartao titulo={<><i className="fa fa-table me-2" />{tx('Boletim de notas — plano de curso da ESG')}</>} corpo={false}>
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle text-center mb-0 p-matriz">
            <thead>
              <tr>
                <th scope="col" className="p-matriz-nome">{tx('Unidade curricular')}</th>
                <th scope="col">{tx('Bloco')}</th>
                <th scope="col">{tx('UCréd')}</th>
                <th scope="col">{tx('Provas (TAI / TAG)')}</th>
                <th scope="col" className="p-matriz-final">{tx('Nota da UC')}</th>
                <th scope="col">{tx('Situação')}</th>
              </tr>
            </thead>
            {semestres.map((s) => (
              <tbody key={s}>
                {semestres.length > 1 && <tr className="p-matriz-grupo"><th colSpan={6}>{PERIODOS[s]}</th></tr>}
                {lista.filter((l) => l.cadeira.periodo === s).map((l) => (
                  <tr key={l.cadeira.id}>
                    <th scope="row" className="p-matriz-nome">
                      <Link to={`/cadeiras/${l.cadeira.id}?separador=avaliacoes`}>{l.cadeira.nome}</Link>
                      <small>{l.cadeira.codigo}{l.cadeira.docente && ` · ${l.cadeira.docente}`}</small>
                    </th>
                    <td>{l.cadeira.bloco || '—'}</td>
                    <td>{l.cadeira.creditos || '—'}</td>
                    <td className="text-start small">
                      {l.tii ? tx('Trabalho de Investigação Individual') : l.provas.length ? l.provas.map((p) => <span key={p.id} className="me-2 text-nowrap"><span className={`badge ${p.tipo === 'TAI' ? 'bg-primary' : 'bg-teal'} me-1`}>{p.tipo}</span>{p.titulo}: <Nota valor={p.recuperacao !== null ? Math.max(p.nota ?? 0, Math.min(p.recuperacao, 10)) : p.nota} /></span>) : <span className="text-muted">{tx('nenhuma publicada')}</span>}
                    </td>
                    <td className="p-matriz-final"><Nota valor={l.final} forte /></td>
                    <td><Situacao situacao={l.situacao} />{l.mencao && l.situacao === 'aprovado' && <small className="p-classificacao">{l.mencao}</small>}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Cartao>
      <p className="p-legenda">{tx('A nota da UC só aparece quando todas as provas estiverem publicadas.')}</p>
      {lista.find((l) => l.plano)?.plano ? <RegrasPlano plano={lista.find((l) => l.plano).plano} aberto /> : <p className="p-legenda">{REGRA_ESG}</p>}
    </>
  )
}

export default Notas
