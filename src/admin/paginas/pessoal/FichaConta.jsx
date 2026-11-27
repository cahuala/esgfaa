import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { Carregando, Erro } from '../../componentes/Ui'
import FotoConta from '../../componentes/FotoConta'
import './ficha.css'

/*
  Ficha do estudante ou do docente para a Administração Escolar, com o aspecto da ficha do Sistema de Gestão de
  Pessoal: o cabeçalho (fotografia, NIP, nome, posto, ramo), os separadores e os dados em caixas. Os dados vêm do
  Pessoal (sem BI, morada, família nem vencimentos, que ficam só lá); aqui só se consultam — as alterações fazem-se
  no Pessoal. Imprime-se tal como se vê.
*/
const ORIGENS = { faa: 'FAA', policia: 'Polícia Nacional', estrangeiro: 'Estrangeiro', civil: 'Civil' }
const GENEROS = { M: 'Masculino', F: 'Feminino' }
const RAMOS = { EXE: 'Exército', FAN: 'Força Aérea Nacional', MGA: 'Marinha de Guerra Angolana' }
const MATRICULAS = { ativa: 'Matriculado', concluida: 'Concluída', anulada: 'Anulada', suspensa: 'Suspensa' }
const data = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-PT') : '')

const Dado = ({ r, v, cheio }) => (
  <div className={cheio ? 'fc-campo-cheio' : ''}>
    <div className="fc-campo-r">{r}</div>
    <div className={`fc-campo-v ${v ? '' : 'fc-campo-vazio'}`}>{v || '—'}</div>
  </div>
)
const Bloco = ({ titulo, icone, children }) => (
  <div className="fc-bloco">
    <div className="fc-bloco-t"><i className={`fa ${icone} me-2`} />{titulo}</div>
    <div className="fc-bloco-c">{children}</div>
  </div>
)

function FichaConta() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('identificacao')
  useEffect(() => { api(`/academico/contas/${id}/ficha`).then(setC).catch((e) => setErro(e.message)) }, [id])
  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const d = c.dados ?? {}
  const docente = c.tipo === 'docente'
  const abas = [['identificacao', 'Identificação', 'fa-id-card'], ['formacao', 'Formação e função', 'fa-graduation-cap'], docente ? ['cadeiras', `Cadeiras que lecciona (${c.cadeiras?.length ?? 0})`, 'fa-chalkboard-teacher'] : ['academico', `Percurso académico (${c.turmas?.length ?? 0})`, 'fa-school']]
  return (
    <>
      <div className="fc-hdr">
        <span className="fc-avatar"><FotoConta id={c.id} nome={c.nome} temFoto={c.temFoto} tamanho={84} /></span>
        <div className="fc-info">
          <div className="fc-nip">{d.nip ? `NIP ${d.nip}` : `N.º ${c.numero}`} · {docente ? 'Docente' : 'Discente'}</div>
          <div className="fc-nome">{c.nome}</div>
          <div className="fc-badges">
            {d.posto && <span>{d.posto}</span>}
            {d.ramo && <span>{RAMOS[d.ramo] ?? d.ramo}</span>}
            {d.origem && d.origem !== 'faa' && <span>{ORIGENS[d.origem]}{d.pais ? ` — ${d.pais}` : ''}</span>}
            {docente && d.tipoDocente && <span>{d.tipoDocente === 'colaborador' ? 'Colaborador' : 'Efectivo'}</span>}
            <span className={c.ativo ? 'fc-activo' : 'fc-outro'}>{c.ativo ? 'Conta activa' : 'Conta inactiva'}</span>
          </div>
        </div>
        <div className="fc-acoes">
          <button type="button" className="fc-btn" onClick={() => navegar(-1)}><i className="fa fa-arrow-left" />Voltar</button>
          {!docente && <Link to={`/academico/documentos/estudante/${c.id}/historico`} className="fc-btn"><i className="fa fa-scroll" />Histórico académico</Link>}
          <button type="button" className="fc-btn" onClick={() => window.print()}><i className="fa fa-print" />Imprimir</button>
        </div>
      </div>

      <div className="fc-tabs" role="tablist">
        {abas.map(([k, t, ic]) => <button key={k} type="button" role="tab" aria-selected={aba === k} className={`fc-tab ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}><i className={`fa ${ic}`} />{t}</button>)}
      </div>

      {aba === 'identificacao' && (
        <div className="fc-ident">
          <div className="fc-foto"><FotoConta id={c.id} nome={c.nome} temFoto={c.temFoto} tamanho={160} /></div>
          <div>
            <Bloco titulo="Identificação" icone="fa-id-card">
              <div className="fc-grelha">
                <Dado r="Nome completo" v={c.nome} cheio />
                <Dado r="Posto" v={d.posto} /><Dado r="Ramo" v={RAMOS[d.ramo] ?? d.ramo} /><Dado r="NIP" v={d.nip} />
                <Dado r="Origem" v={[ORIGENS[d.origem], d.pais].filter(Boolean).join(' — ')} /><Dado r="Órgão / unidade de origem" v={d.departamento} cheio />
                <Dado r="Género" v={GENEROS[d.genero]} /><Dado r="Data de nascimento" v={data(d.dataNascimento)} />
                <Dado r="Naturalidade" v={[d.naturalidade, d.provincia].filter(Boolean).join(', ')} /><Dado r="Nacionalidade" v={d.nacionalidade} />
              </div>
            </Bloco>
            <Bloco titulo="Contactos e conta" icone="fa-address-book">
              <div className="fc-grelha">
                <Dado r="Telefone" v={d.telefone} /><Dado r="E-mail" v={c.email} /><Dado r="N.º no portal" v={c.numero} />
              </div>
            </Bloco>
          </div>
        </div>
      )}

      {aba === 'formacao' && (
        <Bloco titulo="Formação e função" icone="fa-graduation-cap">
          <div className="fc-grelha">
            <Dado r="Habilitações literárias" v={d.habilitacao} /><Dado r="Área de formação" v={d.areaFormacao} />
            <Dado r="Formação militar / especialidade" v={d.especialidade} /><Dado r="Função que exerce" v={d.funcaoActual} cheio />
            {docente && <><Dado r="Tipo de docente" v={d.tipoDocente === 'colaborador' ? 'Colaborador' : d.tipoDocente === 'efectivo' ? 'Efectivo' : ''} /><Dado r="Categoria do docente" v={d.categoriaDocente} /></>}
          </div>
        </Bloco>
      )}

      {aba === 'academico' && (
        <Bloco titulo="Percurso académico" icone="fa-school">
          {!c.turmas?.length ? <p className="text-muted mb-0">Ainda não está matriculado em nenhuma turma.</p> : (
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>Ano lectivo</th><th>Turma</th><th>Matrícula</th><th /></tr></thead>
              <tbody>{[...c.turmas].sort((a, b) => String(b.anoLetivo).localeCompare(String(a.anoLetivo))).map((t) => (
                <tr key={`${t.id}-${t.anoLetivo}`}><td>{t.anoLetivo}</td><td>{t.nome}</td><td><span className={`badge ${t.estado === 'ativa' ? 'bg-success' : 'bg-secondary'}`}>{MATRICULAS[t.estado] ?? t.estado}</span></td>
                  <td className="text-end"><Link to={`/academico/turmas/${t.id}`} className="btn btn-xs btn-white"><i className="fa fa-users me-1" />Ver a turma</Link></td></tr>
              ))}</tbody>
            </table></div>
          )}
          <div className="mt-2"><Link to={`/academico/documentos/estudante/${c.id}/historico`} className="btn btn-sm btn-theme"><i className="fa fa-scroll me-1" />Histórico académico (notas)</Link></div>
        </Bloco>
      )}

      {aba === 'cadeiras' && (
        <Bloco titulo="Cadeiras que lecciona" icone="fa-chalkboard-teacher">
          {!c.cadeiras?.length ? <p className="text-muted mb-0">Sem cadeiras atribuídas.</p> : (
            <div className="table-responsive"><table className="table table-sm align-middle mb-0">
              <thead><tr><th>Ano lectivo</th><th>Cadeira</th><th>Turma</th><th /></tr></thead>
              <tbody>{[...c.cadeiras].sort((a, b) => String(b.anoLetivo).localeCompare(String(a.anoLetivo))).map((x) => (
                <tr key={x.id}><td>{x.anoLetivo}</td><td><b>{x.codigo}</b> — {x.nome}</td><td>{x.turma}</td>
                  <td className="text-end text-nowrap"><Link to={`/academico/documentos/cadeira/${x.id}/pauta`} className="btn btn-xs btn-white"><i className="fa fa-table me-1" />Pauta</Link></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Bloco>
      )}

      <p className="small text-muted">Os dados vêm do Sistema de Gestão de Pessoal (Repartição de Pessoal e Quadros); as alterações fazem-se lá.</p>
    </>
  )
}

export default FichaConta
