import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Painel } from '../componentes/Ui'
import { documentoExcel, documentoPdf } from '../exportar'
import { dataPt } from '../formatar'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/*
  Férias: cada pessoa vê o seu plano de férias (os meses planeados e as guias emitidas); o chefe de cada área
  (direcções, departamentos do Ensino, repartições…) marca aqui o mês de férias de quem trabalha na sua área, e tudo
  fica no plano de férias do Pessoal.
*/
export default function Ferias() {
  const { avisar } = useSessao()
  const [ano, setAno] = useState(new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0))
  const [meu, setMeu] = useState(null)
  const [area, setArea] = useState(null) // null: a carregar; false: não é chefe de área
  const carregarArea = useCallback(() => api('/plano-ferias/area', { consulta: { ano } }).then(setArea).catch((e) => setArea(e.estado === 403 ? false : (avisar(e.message, 'erro'), false))), [ano, avisar])
  useEffect(() => { api('/eu/plano-ferias').then(setMeu).catch(() => setMeu({ pessoa: null, plano: [], guias: [] })) }, [])
  useEffect(() => { carregarArea() }, [carregarArea])
  async function marcar(l, mes) {
    try {
      await api('/plano-ferias/area', { metodo: 'PUT', corpo: { ano, pessoaId: l.id, mes: mes ? Number(mes) : null } })
      carregarArea()
    } catch (e) { avisar(e.message, 'erro') }
  }
  function documento(formato) {
    const d = {
      titulo: `PLANO DE FÉRIAS — ${area.unidade.toLocaleUpperCase('pt')}`, subtitulo: `Ano de ${ano}`, orientacao: 'landscape',
      seccoes: [{ colunas: [{ titulo: 'Nº', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 10 }, { titulo: 'Posto/Categoria', valor: (l) => l.postoNome }, { titulo: 'Nome', valor: (l) => l.nome }, { titulo: 'Unidade', valor: (l) => l.unidadeNome }, ...CURTOS.map((m, i) => ({ titulo: m, valor: (l) => (l.mes === i + 1 ? 'X' : ''), alinhar: 'center', largura: 9 }))], linhas: area.linhas }],
      assinatura: { cargo: area.chefe?.cargo || 'O Chefe', nome: area.chefe?.nome ?? '', posto: area.chefe?.posto ?? '' },
    }
    return (formato === 'excel' ? documentoExcel(d) : documentoPdf(d)).catch((e) => avisar(e.message, 'erro'))
  }

  return (
    <>
      <Cabecalho titulo={<><i className="fa fa-umbrella-beach me-2" style={{ color: '#e65100' }} />Férias</>} subtitulo="o meu plano de férias e, para o chefe de cada área, o plano da sua área" migalhas={[['Férias']]} />
      <div className="row">
        <div className="col-xl-4">
          <Painel titulo="O meu plano de férias" icone="fa-user">
            {!meu ? <Carregando /> : !meu.pessoa ? <p className="text-muted mb-0">A sua conta não está ligada a uma ficha do pessoal.</p> : (
              <>
                <p className="small text-muted">Tem direito a {meu.pessoa.dias} dias por ano{meu.pessoa.adicionais ? ` (mais ${meu.pessoa.adicionais} adicionais, por ter mais de 20 anos de serviço)` : ''}.</p>
                {!meu.plano.length ? <p className="mb-2">Ainda não está no plano de férias.</p> : (
                  <ul className="list-unstyled mb-2">{meu.plano.map((x) => <li key={x.ano}><b>{x.ano}</b>: {MESES[x.mes - 1]}{x.marcadoPor && <span className="small text-muted"> — marcado por {x.marcadoPor}</span>}</li>)}</ul>
                )}
                {meu.guias.length > 0 && <>
                  <div className="fw-bold small mt-2">Guias de férias</div>
                  <ul className="list-unstyled small mb-0">{meu.guias.map((g) => <li key={g.id}>{dataPt(g.inicio)} a {dataPt(g.fim)} ({g.dias} dias){g.levantadaEm ? ` · levantada em ${dataPt(g.levantadaEm)}` : ' · por levantar'}</li>)}</ul>
                </>}
              </>
            )}
          </Painel>
        </div>
        {area && (
          <div className="col-xl-8">
            <Painel titulo={`Plano de férias da área: ${area.unidade} (${area.planeados} de ${area.linhas.length})`} icone="fa-sitemap" corpo={false}
              acoes={<span className="d-flex gap-1"><input type="number" className="form-control form-control-sm" style={{ width: 90 }} value={ano} min={2000} max={2100} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano" /><button type="button" className="btn btn-xs btn-white" onClick={() => documento('pdf')}><i className="fa fa-print me-1" />Imprimir</button><button type="button" className="btn btn-xs btn-white" onClick={() => documento('excel')}><i className="fa fa-file-excel me-1" />Excel</button></span>}>
              <p className="small text-muted px-3 pt-2 mb-2">Escolha o mês de cada um: fica no plano de férias do Pessoal (que prepara as guias). Quem já tem a guia deste ano emitida só se muda no Pessoal.</p>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead><tr><th>Nº</th><th>Posto/Categoria</th><th>Nome</th><th>Unidade</th><th>Mês de férias</th></tr></thead>
                  <tbody>
                    {area.linhas.map((l, i) => (
                      <tr key={l.id}>
                        <td>{String(i + 1).padStart(2, '0')}</td><td className="small">{l.postoNome}</td><td>{l.nome}{l.cargoNome && <div className="small text-muted">{l.cargoNome}</div>}</td><td className="small">{l.unidadeNome}</td>
                        <td>
                          <select className="form-select form-select-sm" value={l.mes ?? ''} disabled={l.comGuia} onChange={(e) => marcar(l, e.target.value)} aria-label={`Mês de férias de ${l.nome}`} title={l.comGuia ? 'A guia já foi emitida: só o Pessoal muda' : l.marcadoPor ? `Marcado por ${l.marcadoPor}` : ''}>
                            <option value="">—</option>
                            {MESES.map((m, k) => <option key={m} value={k + 1}>{m}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>
          </div>
        )}
      </div>
    </>
  )
}
