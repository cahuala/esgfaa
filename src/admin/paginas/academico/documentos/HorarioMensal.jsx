import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { useSessao } from '../../../sessaoContexto'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { descarregarCsv } from './csv'

const DIAS = { 1: '2ª', 2: '3ª', 3: '4ª', 4: '5ª', 5: '6ª' }
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// o que se escreve numa célula sem cadeira (como nos horários do arquivo)
const TEXTOS = ['Feriado', 'Ponte', 'HNC', 'TAG', 'TAI', 'Prep. TAI', 'Trabalho de campo', 'Visita de estudo', 'Exame', 'Direcção do curso']
const mesDe = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const tempo = (b) => b.replace('-', ' às ').replace(/:/g, 'H')

/*
  Horário do mês da turma: os dias úteis em colunas, os tempos em linhas; em cada célula a sigla da cadeira e a
  sessão (S1, S2… contadas sozinhas) ou um texto (Feriado, Ponte, HNC…). Em baixo, a legenda das cadeiras e dos
  docentes. A Administração Escolar preenche-o aqui (Editar) e imprime-o ou exporta-o para o Excel.
*/
function HorarioMensal() {
  const { id } = useParams()
  const { pode } = useSessao()
  const gerir = pode('academico.gerir')
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') || mesDe()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState(false)
  const carregar = useCallback(() => api(`/academico/turmas/${id}/horario-mensal?mes=${mes}`).then((x) => { setErro(''); setD(x) }).catch((e) => setErro(e.message)), [id, mes])
  useEffect(() => { carregar() }, [carregar])
  if (erro) return <Erro texto={erro} />
  if (!d || d.mes !== mes) return <Carregando />

  const cel = (data, bloco) => d.celulas.find((c) => c.data === data && c.bloco === bloco)
  const cadeira = (cid) => d.cadeiras.find((c) => c.id === cid)
  const textoDe = (c) => (!c ? '' : c.cadeiraId ? `${cadeira(c.cadeiraId)?.codigo ?? '?'}${c.sessao ? ` S${c.sessao}` : ''}` : c.texto)
  const valorDe = (c) => (!c ? '' : c.cadeiraId ? `c:${c.cadeiraId}` : `t:${c.texto}`)
  async function mudar(data, bloco, v) {
    const corpo = v.startsWith('c:') ? { data, bloco, cadeiraId: Number(v.slice(2)) } : v === 'outro' ? { data, bloco, texto: window.prompt('Texto da célula (ex.: Visita ao EMG):') ?? '' } : { data, bloco, texto: v.slice(2) }
    try { setD(await api(`/academico/turmas/${id}/horario-mensal`, { metodo: 'PUT', corpo })) } catch (e) { setErro(e.message) }
  }
  const [ano, m] = mes.split('-').map(Number)
  const nomeMes = MESES[m - 1].toUpperCase()
  const mudarMes = (k) => { const x = new Date(ano, m - 1 + k, 1); setParams({ mes: mesDe(x) }) }
  const usadas = d.cadeiras.filter((c) => d.celulas.some((x) => x.cadeiraId === c.id))
  function exportar() {
    descarregarCsv(`horario-${d.turma.nome}-${mes}`.replace(/\W+/g, '-'), [
      [`${d.turma.nome} — horário do mês de ${MESES[m - 1]} de ${ano}`], [],
      [nomeMes, ...d.dias.map((x) => x.data.slice(8))], ['', ...d.dias.map((x) => DIAS[x.diaSemana])],
      ...d.blocos.map((b) => [tempo(b), ...d.dias.map((x) => textoDe(cel(x.data, b)))]),
      [], ['Legenda'], ...usadas.map((c) => [c.codigo, c.nome, c.docentes.join(', ')]),
    ])
  }

  return (
    <Documento
      anoLetivo={d.turma.anoLetivo} paisagem
      titulo={`HORÁRIO DO MÊS DE ${nomeMes}`} voltar={`/academico/turmas/${id}`}
      subtitulo={`${d.turma.nome} · ano lectivo ${d.turma.anoLetivo}`}
      assinaturas={['O Chefe da Repartição de Administração Escolar']}
      acoes={(
        <>
          <button type="button" className="btn btn-white" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><i className="fa fa-chevron-left" /></button>
          <input type="month" className="form-control" style={{ width: 170 }} value={mes} onChange={(e) => e.target.value && setParams({ mes: e.target.value })} aria-label="Mês" />
          <button type="button" className="btn btn-white" onClick={() => mudarMes(1)} aria-label="Mês seguinte"><i className="fa fa-chevron-right" /></button>
          {gerir && <button type="button" className={`btn ${editar ? 'btn-primary' : 'btn-white'}`} onClick={() => setEditar(!editar)}><i className="fa fa-pen me-1" />{editar ? 'Acabar de editar' : 'Editar'}</button>}
          <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
    >
      <table className="of-horario">
        <thead>
          <tr><th>{nomeMes}</th>{d.dias.map((x) => <th key={x.data} className="of-centro">{Number(x.data.slice(8))}</th>)}</tr>
          <tr><th />{d.dias.map((x) => <th key={x.data} className="of-centro">{DIAS[x.diaSemana]}</th>)}</tr>
        </thead>
        <tbody>
          {d.blocos.map((b) => (
            <tr key={b}>
              <th className="text-nowrap small">{tempo(b)}</th>
              {d.dias.map((x) => {
                const c = cel(x.data, b)
                return (
                  <td key={x.data} className="of-centro small">
                    {editar ? (
                      <select className="form-select form-select-sm p-0" style={{ minWidth: 58, fontSize: 11 }} value={valorDe(c)} onChange={(e) => mudar(x.data, b, e.target.value)} aria-label={`${x.data} ${b}`}>
                        <option value="">—</option>
                        <optgroup label="Cadeiras">{d.cadeiras.map((k) => <option key={k.id} value={`c:${k.id}`}>{k.codigo}</option>)}</optgroup>
                        <optgroup label="Outros">{[...TEXTOS, ...(c?.texto && !TEXTOS.includes(c.texto) ? [c.texto] : [])].map((t) => <option key={t} value={`t:${t}`}>{t}</option>)}<option value="outro">Outro…</option></optgroup>
                      </select>
                    ) : textoDe(c)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {usadas.length > 0 && (
        <div className="mt-2 small">
          <b>Legenda</b>
          <table className="mt-1">
            <tbody>{usadas.map((c) => <tr key={c.id}><td className="fw-bold">{c.codigo}</td><td>{c.nome}</td><td>{c.docentes.join(', ') || '—'}</td><td className="of-centro">{c.sessoes} sessão(ões)</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Documento>
  )
}

export default HorarioMensal
