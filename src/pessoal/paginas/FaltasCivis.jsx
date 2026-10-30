import { useState } from 'react'
import { api } from '../api'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Painel } from '../componentes/Ui'
import { documentoPdf } from '../exportar'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const esteMes = () => new Date().toISOString().slice(0, 7)

/*
  Mapa de efectividade de controlo do pessoal civil, como o modelo da Escola: cada civil no activo, a categoria,
  os dias do mês (sábados e domingos a sombreado) e o total de faltas. Um clique num dia marca ou tira a falta
  (fica no registo «Faltas e ausências» e no Mapa de ausências temporárias). Imprime-se com o «Visto» do Comandante.
*/
function FaltasCivis() {
  const { pode, avisar } = useSessao()
  const [mes, setMes] = useState(esteMes)
  const { dados: m, recarregar } = useDados('/faltas-civis', { mes })
  const [aGuardar, setAGuardar] = useState(null)
  const edita = pode('editar')
  const nomeMes = MESES[Number(mes.slice(5)) - 1]

  async function alternar(p, d) {
    if (!edita || aGuardar) return
    const falta = !p.faltas.includes(d)
    setAGuardar(`${p.id}-${d}`)
    try {
      await api('/faltas-civis', { metodo: 'PUT', corpo: { pessoaId: p.id, data: `${mes}-${String(d).padStart(2, '0')}`, falta } })
      recarregar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setAGuardar(null)
    }
  }

  function imprimir() {
    const dias = Array.from({ length: m.dias }, (_, i) => i + 1)
    documentoPdf({
      titulo: 'Mapa de efectividade de controlo do pessoal civil da ESG/EMGFAA',
      subtitulo: `Mês de ${nomeMes} de ${mes.slice(0, 4)}`,
      orientacao: 'landscape',
      seccoes: [{
        letra: 6.4,
        colunas: [
          { titulo: 'N/O', valor: (l, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 8 },
          { titulo: 'Nome completo', valor: (l) => l.nome, largura: 62 },
          { titulo: 'Categoria', valor: (l) => l.categoria, largura: 40 },
          ...dias.map((d) => ({ titulo: String(d), valor: (l) => (l.faltas.includes(d) ? 'F' : ''), alinhar: 'center', largura: 4.6, sombra: m.fimDeSemana.includes(d) })),
          { titulo: 'Total de faltas', valor: (l) => l.faltas.length || '', alinhar: 'center', largura: 12 },
        ],
        linhas: m.pessoas,
      }],
      nota: 'F = falta. Sábados e domingos a sombreado.',
    })
  }

  return (
    <>
      <Cabecalho titulo="Controlo de faltas (civis)" subtitulo="mapa de efectividade do pessoal civil" migalhas={[['Pessoal'], ['Controlo de faltas (civis)']]}>
        <input type="month" className="form-control w-auto" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês" />
        <button type="button" className="btn btn-danger" disabled={!m?.pessoas.length} onClick={imprimir}><i className="fa fa-file-pdf me-1" />Imprimir mapa</button>
      </Cabecalho>
      {!m ? <Carregando /> : (
        <Painel>
          <p className="small text-muted mb-2">
            {edita ? 'Clique num dia para marcar ou tirar a falta (F). ' : ''}Sábados e domingos a sombreado. As faltas ficam também em «Faltas e ausências» e no Mapa de ausências temporárias.
          </p>
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle mb-0 pes-faltas" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th rowSpan={2} className="text-center">N/O</th>
                  <th rowSpan={2}>Nome completo</th>
                  <th rowSpan={2}>Categoria</th>
                  <th colSpan={m.dias} className="text-center">Mês de {nomeMes}</th>
                  <th rowSpan={2} className="text-center">Total de faltas</th>
                </tr>
                <tr>
                  {Array.from({ length: m.dias }, (_, i) => i + 1).map((d) => <th key={d} className="text-center p-1" style={{ minWidth: 24, background: m.fimDeSemana.includes(d) ? '#bdbdbd' : undefined }}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {m.pessoas.length === 0 && <tr><td colSpan={m.dias + 4} className="text-center text-muted py-4">Não há pessoal civil no activo.</td></tr>}
                {m.pessoas.map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-center">{String(i + 1).padStart(2, '0')}</td>
                    <td className="text-nowrap">{p.nome}</td>
                    <td className="small text-nowrap">{p.categoria}</td>
                    {Array.from({ length: m.dias }, (_, k) => k + 1).map((d) => {
                      const f = p.faltas.includes(d)
                      return (
                        <td
                          key={d}
                          className={`text-center p-0 ${f ? 'fw-bold text-danger' : ''}`}
                          style={{ background: m.fimDeSemana.includes(d) ? '#d6d6d6' : undefined, cursor: edita ? 'pointer' : 'default', height: 26 }}
                          onClick={() => alternar(p, d)}
                          title={`${p.nome} — ${d} de ${nomeMes}${f ? ': falta' : ''}`}
                          aria-label={`${d} de ${nomeMes}: ${f ? 'falta' : 'presente'}`}
                        >
                          {aGuardar === `${p.id}-${d}` ? '…' : f ? 'F' : ''}
                        </td>
                      )
                    })}
                    <td className="text-center fw-bold">{p.faltas.length || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>
      )}
    </>
  )
}

export default FaltasCivis
