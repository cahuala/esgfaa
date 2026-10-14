import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Aviso, CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHora, dataCurta } from '../formatar'
import { ESTADOS } from './candidaturasEstados'

function Linha({ rotulo, children }) {
  return (
    <div className="row py-2 border-bottom">
      <dt className="col-sm-4 text-muted fw-normal">{rotulo}</dt>
      <dd className="col-sm-8 mb-0">{children || '—'}</dd>
    </div>
  )
}

// Uma candidatura: dados do candidato e avaliação pela Administração Escolar
function CandidaturaDetalhe() {
  const { id } = useParams()
  const { pode } = useSessao()
  const [c, setC] = useState(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ estado: 'recebida', notas: '' })
  const [aGuardar, setAGuardar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [curso, setCurso] = useState('')

  useEffect(() => {
    api(`/candidaturas/${id}`)
      .then((r) => {
        setC(r)
        setForm({ estado: r.estado, notas: r.notas || '' })
        return api(`/colecoes/cursos/${encodeURIComponent(r.curso)}`).then((cc) => setCurso(cc.nome)).catch(() => setCurso(r.curso))
      })
      .catch((e) => setErro(e.message))
  }, [id])

  async function guardar(e) {
    e.preventDefault()
    setAGuardar(true)
    try {
      const r = await api(`/candidaturas/${id}`, { metodo: 'PUT', corpo: form })
      setC(r)
      setAviso({ texto: 'Avaliação guardada.' })
    } catch (falha) {
      setAviso({ tipo: 'erro', texto: falha.message })
    } finally {
      setAGuardar(false)
    }
  }

  if (erro) return <Erro texto={erro} />
  if (!c) return <Carregando />
  const d = c.dados || {}

  return (
    <>
      <CabecalhoPagina titulo={c.nome} subtitulo={c.codigo} migalhas={[{ rotulo: 'Candidaturas', para: '/candidaturas' }, { rotulo: c.codigo }]}>
        <Link to="/candidaturas" className="btn btn-white"><i className="fa fa-arrow-left me-1" /> Voltar à lista</Link>
      </CabecalhoPagina>

      <div className="row">
        <div className="col-xl-8">
          <Painel titulo="Curso e contactos">
            <dl className="mb-0">
              <Linha rotulo="Curso">{curso}</Linha>
              <Linha rotulo="Recebida em">{dataHora(c.criadaEm)}</Linha>
              <Linha rotulo="E-mail"><a href={`mailto:${c.email}?subject=${encodeURIComponent(`Candidatura ${c.codigo}`)}`}>{c.email}</a></Linha>
              <Linha rotulo="Telefone"><a href={`tel:${c.telefone.replace(/\s/g, '')}`}>{c.telefone}</a></Linha>
            </dl>
          </Painel>
          <Painel titulo="Dados pessoais">
            <dl className="mb-0">
              <Linha rotulo="Data de nascimento">{d.dataNascimento && dataCurta(d.dataNascimento)}</Linha>
              <Linha rotulo="Bilhete de identidade">{d.bi}</Linha>
              <Linha rotulo="Província">{d.provincia}</Linha>
              <Linha rotulo="Morada">{d.morada}</Linha>
            </dl>
          </Painel>
          <Painel titulo="Situação militar e formação">
            <dl className="mb-0">
              <Linha rotulo="Ramo">{d.ramo}</Linha>
              <Linha rotulo="Posto">{d.posto}</Linha>
              <Linha rotulo="NIP">{d.nip}</Linha>
              <Linha rotulo="Unidade / órgão">{d.unidade}</Linha>
              <Linha rotulo="Anos de serviço">{d.anosServico}</Linha>
              <Linha rotulo="Habilitações">{[d.habilitacoes, d.areaFormacao].filter(Boolean).join(' · ')}</Linha>
            </dl>
            <h6 className="mt-3">Motivação</h6>
            {/* texto do candidato: mostrado como texto, nunca como HTML */}
            <p className="mb-0 texto-comentario" style={{ whiteSpace: 'pre-wrap' }}>{d.motivacao}</p>
          </Painel>
        </div>

        <div className="col-xl-4">
          <Painel titulo="Avaliação">
            <p>Estado atual: <span className={`badge ${ESTADOS[c.estado]?.classe}`}>{ESTADOS[c.estado]?.rotulo}</span></p>
            {pode('candidaturas.editar') ? (
              <form onSubmit={guardar}>
                <label className="form-label fw-bold" htmlFor="estado">Estado</label>
                <select id="estado" className="form-select mb-3" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  {Object.entries(ESTADOS).map(([k, e]) => <option key={k} value={k}>{e.rotulo}</option>)}
                </select>
                <label className="form-label fw-bold" htmlFor="notas">Notas internas</label>
                <textarea id="notas" className="form-control mb-1" rows={6} maxLength={4000} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                <div className="form-text mb-3">Não são vistas pelo candidato.</div>
                <button type="submit" className="btn btn-theme w-100" disabled={aGuardar}>
                  <i className="fa fa-save me-1" /> {aGuardar ? 'A guardar…' : 'Guardar avaliação'}
                </button>
              </form>
            ) : (
              <p className="text-muted mb-0">Só a Administração Escolar pode alterar o estado.</p>
            )}
            <div className="text-muted small mt-3">Última alteração: {dataHora(c.atualizadaEm)}</div>
          </Painel>
        </div>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default CandidaturaDetalhe
