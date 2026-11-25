import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { descarregarCsv } from './csv'
import { useAnoTrabalho } from '../../../anoTrabalho'

const ESTADO = {
  pendente: 'À espera da aprovação do Comandante',
  aprovada: 'Aprovada pelo Comandante',
  devolvida: 'Mandada refazer pelo Comandante',
  rejeitada: 'Rejeitada pelo Comandante',
}

/*
  Distribuição de serviço docente de um ano lectivo: uma só lista com todos os docentes (pela ordem hierárquica) e as
  cadeiras de cada um, em todas as turmas. A Repartição de Administração Escolar imprime-a; o Director de Ensino
  assina em baixo e o Comandante da Escola aprova no canto superior esquerdo. No fim, as cadeiras ainda sem docente.
*/
function DistribuicaoDocente() {
  const [params, setParams] = useSearchParams()
  const { ano: anoTrabalho, anos } = useAnoTrabalho()
  const [d, setD] = useState(null)
  const [quem, setQuem] = useState(null)
  const [erro, setErro] = useState('')
  const ano = params.get('ano') ?? anoTrabalho
  useEffect(() => {
    api('/academico/documentos-academicos').then(setQuem).catch(() => setQuem({}))
  }, [])
  useEffect(() => {
    if (!ano) return
    api(`/academico/distribuicao?anoLetivo=${encodeURIComponent(ano)}`).then((r) => { setErro(''); setD(r) }).catch((e) => setErro(e.message))
  }, [ano])
  if (erro) return <Erro texto={erro} />
  if (!d || !quem) return <Carregando />

  const titulo = 'Distribuição de serviço docente'
  const cadeiras = d.docentes.reduce((s, x) => s + x.cadeiras.length, 0)
  const horas = d.docentes.reduce((s, x) => s + x.horas, 0)
  const nomeCompleto = (x) => `${x.posto ? `${x.posto} ` : ''}${x.nome}`
  function exportar() {
    descarregarCsv(`distribuicao-docente-${ano.replace(/\W+/g, '-')}`, [
      [`${titulo} — ano lectivo ${ano}`], [],
      ['N.º', 'Posto', 'Nome', 'Cadeira', 'Turma', 'Função', 'Horas', 'Estado'],
      ...d.docentes.flatMap((x, i) => x.cadeiras.map((c) => [i + 1, x.posto, x.nome, `${c.codigo} ${c.nome}`, c.turma, c.papel, c.horas, c.estado === 'proposta' ? 'Proposto' : 'Aprovado'])),
    ])
  }
  const assinante = (a, cargo) => ({ cargo: a?.cargo || cargo, nome: a?.nome ?? '', posto: a?.posto ?? '' })
  return (
    <Documento
      anoLetivo={ano}
      titulo={titulo} voltar="/academico/alocacao"
      subtitulo={`Ano lectivo ${ano} · ${d.docentes.length} docente(s) · ${cadeiras} cadeira(s) em ${d.turmas} turma(s) · ${horas} horas`}
      aprovado={assinante(quem.comandante, 'O Comandante da Escola')}
      assinaturas={[assinante(quem.directorEnsino, 'O Director de Ensino')]}
      acoes={(
        <>
          {d.distribuicao && <span className="badge bg-info text-dark">{ESTADO[d.distribuicao.estado] ?? d.distribuicao.estado}</span>}
          <select className="form-select" style={{ width: 200 }} value={ano} onChange={(e) => setParams({ ano: e.target.value })} aria-label="Ano lectivo">
            {anos.map((a) => <option key={a.id} value={a.id}>{a.id}{a.atual ? ' (actual)' : ''}</option>)}
          </select>
          <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
        </>
      )}
    >
      {d.docentes.length === 0 ? <p className="text-center">Ainda não há docentes nas cadeiras deste ano lectivo.</p> : (
        <table>
          <thead><tr><th className="of-num">N.º</th><th>Docente / Cadeira</th><th>Turma</th><th>Função</th><th className="of-centro" style={{ width: 70 }}>Horas</th></tr></thead>
          <tbody>
            {d.docentes.map((x, i) => [
              <tr key={x.id} className="of-docente">
                <td className="of-num">{i + 1}</td>
                <td colSpan={3}>{nomeCompleto(x)}</td>
                <td className="of-centro">{x.horas}</td>
              </tr>,
              ...x.cadeiras.map((c, k) => (
                <tr key={`${x.id}-${k}`}>
                  <td />
                  <td>{c.codigo} — {c.nome}{c.estado === 'proposta' && ' *'}</td>
                  <td>{c.turma}</td>
                  <td>{c.papel === 'regente' ? 'Regente' : c.papel === 'assistente' ? 'Assistente' : c.papel}</td>
                  <td className="of-centro">{c.horas}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      )}
      {d.docentes.some((x) => x.cadeiras.some((c) => c.estado === 'proposta')) && <p className="small">* Docente proposto, à espera da aprovação do Comandante.</p>}
      {d.semDocente.length > 0 && (
        <>
          <h2 className="h6 mt-3 text-uppercase">Cadeiras ainda sem docente ({d.semDocente.length})</h2>
          <table>
            <thead><tr><th>Cadeira</th><th>Turma</th></tr></thead>
            <tbody>{d.semDocente.map((c, k) => <tr key={k}><td>{c.codigo} — {c.nome}</td><td>{c.turma}</td></tr>)}</tbody>
          </table>
        </>
      )}
      {d.distribuicao?.recomendacoes && <p className="mt-2"><b>Recomendações do Comandante:</b> {d.distribuicao.recomendacoes}</p>}
    </Documento>
  )
}

export default DistribuicaoDocente
