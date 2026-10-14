import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBook, FaClock, FaMapMarkerAlt } from 'react-icons/fa'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { Cartao, Carregando, Erro, Etiqueta, Titulo, Vazio } from '../componentes'
import { dataHora, faltam, maiusculaInicial, primeiroNome } from '../formatar'

const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}

function Inicio() {
  const { conta, eDocente } = useSessao()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(() => api('/inicio').then(setD).catch((e) => setErro(e.message)), [])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <Titulo
        rotulo={maiusculaInicial(new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }))}
        titulo={`${saudacao()}, ${primeiroNome(conta.nome)}`}
        sub={[...(conta.matriculas || []).filter((m) => m.estado === 'ativa').map((m) => m.turma.nome), `${eDocente ? 'Docente' : 'Estudante'} n.º ${conta.numero}`].join(' · ')}
      />
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}
      {!d && !erro ? <Carregando /> : d && (
        <>
        <dl className="p-resumo">
          <div><dt>{eDocente ? 'Cadeiras que lecciona' : 'Cadeiras'}</dt><dd>{d.cadeiras.length}</dd></div>
          <div><dt>Aulas hoje</dt><dd>{d.aulasHoje.length}</dd></div>
          <div><dt>{eDocente ? 'Prazos a decorrer' : 'Trabalhos por entregar'}</dt><dd>{eDocente ? d.prazos.length : d.prazos.filter((p) => !p.entregue).length}</dd></div>
          <div><dt>Avisos recentes</dt><dd>{d.avisos.length + (d.avisosGerais?.length || 0)}</dd></div>
        </dl>
        <div className="p-grelha-inicio">
          <div className="p-coluna">
            <Cartao titulo="Aulas de hoje">
              {d.aulasHoje.length === 0 ? <Vazio>Sem aulas hoje.</Vazio> : (
                <ul className="p-lista">
                  {d.aulasHoje.map((a) => (
                    <li key={a.id}>
                      <strong>{a.inicio}–{a.fim}</strong> <Link to={`/cadeiras/${a.cadeiraId}`}>{a.cadeira}</Link>
                      {a.sala && <span className="p-texto-suave"> · <FaMapMarkerAlt aria-hidden="true" /> {a.sala}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao titulo={eDocente ? 'Próximos prazos dos trabalhos' : 'Próximos prazos'}>
              {d.prazos.length === 0 ? <Vazio>Sem trabalhos com prazo próximo.</Vazio> : (
                <ul className="p-lista">
                  {d.prazos.map((p) => (
                    <li key={p.id}>
                      <Link to={`/cadeiras/${p.cadeiraId}?separador=trabalhos`}>{p.titulo}</Link>
                      <span className="p-texto-suave"> · {p.cadeira}</span>
                      <div className="p-linha-meta">
                        <FaClock aria-hidden="true" /> {dataHora(p.prazo)} · {faltam(p.prazo)}
                        {!eDocente && (p.entregue ? <Etiqueta cor="verde">Entregue</Etiqueta> : <Etiqueta cor="dourado">Por entregar</Etiqueta>)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
          <div className="p-coluna">
            {!eDocente && d.avisosGerais?.length > 0 && (
              <Cartao titulo="Avisos da Secretaria" acoes={<Link to="/avisos" className="p-ligacao-simples">Ver todos</Link>}>
                <ul className="p-lista">
                  {d.avisosGerais.map((a) => <li key={a.id}><strong>{a.titulo}</strong><div className="p-texto-suave">{a.texto}</div><small className="p-texto-fraco">{dataHora(a.criadoEm)}</small></li>)}
                </ul>
              </Cartao>
            )}
            <Cartao titulo="Avisos das cadeiras">
              {d.avisos.length === 0 ? <Vazio>Sem avisos.</Vazio> : (
                <ul className="p-lista">
                  {d.avisos.map((a) => (
                    <li key={a.id}>
                      <strong>{a.titulo}</strong> <Link to={`/cadeiras/${a.cadeiraId}?separador=avisos`} className="p-texto-suave">· {a.cadeira}</Link>
                      <div className="p-texto-suave p-recorte">{a.texto}</div>
                      <small className="p-texto-fraco">{dataHora(a.criadoEm)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
          <Cartao titulo={eDocente ? 'As minhas cadeiras' : 'As minhas cadeiras'} className="p-largo">
            <ListaCadeiras cadeiras={d.cadeiras} />
          </Cartao>
        </div>
        </>
      )}
    </>
  )
}

export function ListaCadeiras({ cadeiras }) {
  if (!cadeiras.length) return <Vazio>Ainda não tem cadeiras atribuídas. Contacte a Secretaria Académica.</Vazio>
  return (
    <div className="p-grelha-cadeiras">
      {cadeiras.map((c) => (
        <Link key={c.id} to={`/cadeiras/${c.id}`} className="p-cadeira">
          <span className="p-cadeira-topo">
            <span className="p-cadeira-icone"><FaBook aria-hidden="true" /></span>
            <span className="p-cadeira-codigo">{c.codigo} · {c.semestre}.º semestre</span>
          </span>
          <strong>{c.nome}</strong>
          <span className="p-texto-suave">{c.docente ? c.docente.nome : 'Docente por atribuir'}</span>
          {c.turma && <small className="p-texto-fraco">{c.turma.nome}</small>}
        </Link>
      ))}
    </div>
  )
}

export default Inicio
