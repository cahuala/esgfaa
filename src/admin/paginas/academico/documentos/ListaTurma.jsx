import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { descarregarCsv } from './csv'

/*
  As listas da turma, como as do arquivo da Repartição de Administração Escolar: a relação nominal (pela ordem
  hierárquica: posto, do mais alto para o mais baixo, e, no mesmo posto, por ordem alfabética; a ordem vem do servidor),
  a lista telefónica e de e-mail, a constituição da turma (lista final de dados para os diplomas), a formação
  académica, a formação militar actual, as funções que exercem, as unidades de proveniência e datas de nascimento, a
  lista de actualização dos dados (para preencher à mão) e os dados de um só ramo. Os dados vêm do Sistema de Pessoal.
  Também as turmas do arquivo (matrículas concluídas).
*/
const dataPt = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-PT') : '')
const d = (e, k) => e.dados?.[k] ?? ''
const formacao = (e) => [d(e, 'habilitacao'), d(e, 'areaFormacao')].filter(Boolean).join(' — ')
const LISTAS_TURMA = {
  relacao: { titulo: 'Relação nominal dos {p}', colunas: [['Posto', (e) => d(e, 'posto')], ['Nome completo', (e) => e.nome], ['N.º de estudante', (e) => e.numero], ['Ramo', (e) => d(e, 'ramo')], ['Unidade de origem', (e) => d(e, 'departamento')]] },
  contactos: { titulo: 'Lista telefónica e e-mail', colunas: [['NIP', (e) => d(e, 'nip')], ['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Ramo', (e) => d(e, 'ramo')], ['Contactos', (e) => d(e, 'telefone')], ['Correio electrónico', (e) => e.email ?? '']] },
  constituicao: { titulo: 'Constituição da turma — lista final de dados para constar nos diplomas', colunas: [['NIP', (e) => d(e, 'nip')], ['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Ramo', (e) => d(e, 'ramo')], ['Obs.', () => '']] },
  formacao: { titulo: 'Formação académica actual', colunas: [['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Formação académica', formacao]] },
  militar: { titulo: 'Formação militar actual', colunas: [['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Curso militar / especialidade', (e) => d(e, 'especialidade')]] },
  funcoes: { titulo: 'Funções que exercem', colunas: [['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Função', (e) => d(e, 'funcaoActual')]] },
  proveniencia: { titulo: 'Unidades de proveniência, ramos e datas de nascimento dos {p}', colunas: [['NIP', (e) => d(e, 'nip')], ['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['Ramo', (e) => d(e, 'ramo')], ['Data de nascimento', (e) => dataPt(d(e, 'dataNascimento'))], ['Unidade de proveniência', (e) => d(e, 'departamento')]] },
  actualizacao: { titulo: 'Lista de actualização dos dados', colunas: [['NIP', (e) => d(e, 'nip')], ['Posto', (e) => d(e, 'posto')], ['Nome', (e) => e.nome], ['NIP (correcto)', () => ''], ['Posto (correcto)', () => ''], ['Nome (correcto)', () => '']] },
}
const RAMOS = { EXE: 'Exército', FAN: 'Força Aérea Nacional', MGA: 'Marinha de Guerra Angolana', PNA: 'Polícia Nacional' }

function ListaTurma() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tipo = LISTAS_TURMA[params.get('tipo')] ? params.get('tipo') : 'relacao'
  const ramo = params.get('ramo') || ''
  const [t, setT] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/turmas/${id}`).then(setT).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!t) return <Carregando />
  const pessoas = t.termos?.pessoas ?? 'Estudantes'
  const ramoDe = (e) => (d(e, 'origem') === 'policia' ? 'PNA' : d(e, 'ramo'))
  const linhas = t.matriculas.filter((m) => m.estado !== 'anulada').map((m) => m.estudante).filter((e) => !ramo || ramoDe(e) === ramo)
  const def = LISTAS_TURMA[tipo]
  const titulo = def.titulo.replace('{p}', pessoas.toLowerCase()) + (ramo ? ` — ${RAMOS[ramo] ?? ramo}` : '')
  const mudar = (k, v) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p) }
  function exportar() {
    descarregarCsv(`${tipo}-${t.nome}${ramo ? `-${ramo}` : ''}`, [
      [`${titulo} — ${t.nome} — ano lectivo ${t.anoLetivo}`], [],
      ['N.º', ...def.colunas.map(([c]) => c)],
      ...linhas.map((e, i) => [i + 1, ...def.colunas.map(([, f]) => f(e))]),
    ])
  }
  return (
    <Documento
      anoLetivo={t.anoLetivo}
      titulo={titulo} voltar={`/academico/turmas/${t.id}`}
      subtitulo={`${t.nome} · ano lectivo ${t.anoLetivo} · ${linhas.length} ${pessoas.toLowerCase()}`}
      acoes={<>
        <select className="form-select w-auto" value={tipo} onChange={(e) => mudar('tipo', e.target.value)} aria-label="Lista">
          {Object.entries(LISTAS_TURMA).map(([k, x]) => <option key={k} value={k}>{x.titulo.replace('{p}', pessoas.toLowerCase())}</option>)}
        </select>
        <select className="form-select w-auto" value={ramo} onChange={(e) => mudar('ramo', e.target.value)} aria-label="Ramo">
          <option value="">Todos os ramos</option>
          {Object.entries(RAMOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <button type="button" className="btn btn-white" onClick={exportar}><i className="fa fa-file-excel me-1 text-success" />Exportar Excel</button>
      </>}
      assinaturas={['O Chefe da Repartição de Administração Escolar']}
    >
      <table>
        <thead><tr><th className="of-num">N.º</th>{def.colunas.map(([c]) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {linhas.length === 0 && <tr><td colSpan={def.colunas.length + 1} className="of-centro">Sem {pessoas.toLowerCase()} nesta lista.</td></tr>}
          {linhas.map((e, i) => (
            <tr key={e.id}>
              <td className="of-num">{String(i + 1).padStart(2, '0')}</td>
              {def.colunas.map(([c, f]) => <td key={c} style={tipo === 'actualizacao' && !f(e) ? { minWidth: 110 } : undefined}>{f(e)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {tipo === 'relacao' && <div className="small mt-2">Ordem hierárquica: por posto (do mais alto para o mais baixo) e, dentro do mesmo posto, por ordem alfabética.</div>}
    </Documento>
  )
}

export default ListaTurma
