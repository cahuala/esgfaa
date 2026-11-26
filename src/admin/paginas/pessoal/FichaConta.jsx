import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { Carregando, Erro } from '../../componentes/Ui'
import Documento from '../academico/documentos/Documento'
import FotoConta from '../../componentes/FotoConta'

/*
  Ficha do estudante ou do docente para a Administração Escolar: os dados que vêm do Sistema de Gestão de Pessoal
  (posto, ramo, NIP, origem, nascimento, nacionalidade, habilitações, formação, função…), as turmas (estudante) ou
  as cadeiras (docente). Sem os dados pessoais que ficam só no Pessoal (BI, morada, família, vencimentos).
*/
const ORIGENS = { faa: 'FAA', policia: 'Polícia Nacional', estrangeiro: 'Estrangeiro', civil: 'Civil' }
const GENEROS = { M: 'Masculino', F: 'Feminino' }
const data = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-PT') : '')

function FichaConta() {
  const { id } = useParams()
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/academico/contas/${id}/ficha`).then(setC).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const d = c.dados ?? {}
  const linhas = [
    ['Nome completo', c.nome], ['Posto', d.posto], ['Ramo', d.ramo], ['NIP / n.º', d.nip],
    ['Origem', [ORIGENS[d.origem], d.pais].filter(Boolean).join(' — ')], ['Órgão / unidade de origem', d.departamento],
    ['Género', GENEROS[d.genero]], ['Data de nascimento', data(d.dataNascimento)], ['Naturalidade', [d.naturalidade, d.provincia].filter(Boolean).join(', ')], ['Nacionalidade', d.nacionalidade],
    ['Habilitações literárias', d.habilitacao], ['Área de formação', d.areaFormacao], ['Especialidade', d.especialidade], ['Função que exerce', d.funcaoActual],
    ...(c.tipo === 'docente' ? [['Tipo de docente', d.tipoDocente === 'colaborador' ? 'Colaborador' : d.tipoDocente === 'efectivo' ? 'Efectivo' : ''], ['Categoria do docente', d.categoriaDocente]] : []),
    ['Telefone', d.telefone], ['E-mail', c.email], ['N.º no portal', c.numero],
  ].filter(([, v]) => v)
  return (
    <Documento titulo={c.tipo === 'docente' ? 'FICHA DO DOCENTE' : 'FICHA DO DISCENTE'} voltar="/pessoal/registo" subtitulo={c.nome}>
      <div className="d-flex gap-3 align-items-start">
        <FotoConta id={c.id} nome={c.nome} temFoto={c.temFoto} tamanho={110} />
        <table>
          <tbody>{linhas.map(([k, v]) => <tr key={k}><th style={{ width: 220 }}>{k}</th><td>{v}</td></tr>)}</tbody>
        </table>
      </div>
      {c.turmas?.length > 0 && <>
        <h2 className="h6 mt-3 text-uppercase">Turmas</h2>
        <table><thead><tr><th>Turma</th><th>Ano lectivo</th><th>Matrícula</th></tr></thead>
          <tbody>{c.turmas.map((t) => <tr key={`${t.id}-${t.anoLetivo}`}><td>{t.nome}</td><td>{t.anoLetivo}</td><td>{t.estado}</td></tr>)}</tbody></table>
        <p className="small mt-1 of-acoes"><Link to={`/academico/documentos/estudante/${c.id}/historico`}>Ver o histórico académico (notas)</Link></p>
      </>}
      {c.cadeiras?.length > 0 && <>
        <h2 className="h6 mt-3 text-uppercase">Cadeiras que lecciona</h2>
        <table><thead><tr><th>Cadeira</th><th>Turma</th><th>Ano lectivo</th></tr></thead>
          <tbody>{c.cadeiras.map((x) => <tr key={x.id}><td>{x.codigo} — {x.nome}</td><td>{x.turma}</td><td>{x.anoLetivo}</td></tr>)}</tbody></table>
      </>}
      <p className="small text-muted mt-3">Os dados vêm do Sistema de Gestão de Pessoal (Repartição de Pessoal e Quadros); as alterações fazem-se lá.</p>
    </Documento>
  )
}

export default FichaConta
