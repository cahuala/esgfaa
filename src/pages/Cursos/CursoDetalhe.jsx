import { Link, useParams } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import { totalHoras } from '../../data/cursos'
import { useConteudo } from '../../conteudo/contexto'
import { iniciais } from '../../utils/texto'
import useSeccaoAtiva from '../../hooks/useSeccaoAtiva'
import ed from '../../styles/editorial.module.css'
import { Cartao, TituloSeccao } from '../../components/Corporativo/Corporativo'
import detalhe from './CursoDetalhe.module.css'

const seccoes = [
  { id: 'apresentacao', label: 'Apresentação' },
  { id: 'objetivos', label: 'Objetivos' },
  { id: 'plano', label: 'Plano curricular' },
  { id: 'admissao', label: 'Admissão' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'saidas', label: 'Saídas profissionais' },
  { id: 'coordenacao', label: 'Coordenação' },
]
const ids = seccoes.map((s) => s.id)

function CursoDetalhe() {
  const { cursos, paginas, cursoPorId, pessoaPorId } = useConteudo()
  const pagina = paginas.cursos
  const calendarioAdmissao = pagina.calendario || []
  const processoAdmissao = pagina.processo || []
  const prazo = pagina.prazo || calendarioAdmissao[1]?.periodo
  const { id } = useParams()
  const curso = cursoPorId(id)
  const ativa = useSeccaoAtiva(ids)

  if (!curso) {
    return <NaoEncontrado titulo="Curso não encontrado" voltarPara="/Cursos" voltarTexto="Ver todos os cursos" />
  }

  const coordenador = pessoaPorId(curso.coordenador)
  const outros = cursos.filter((c) => c.id !== curso.id)
  const numero = (sid) => String(ids.indexOf(sid) + 1).padStart(2, '0')

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: 'Cursos', to: '/Cursos' }, { label: curso.sigla }]}
        sobretitulo={`${curso.sigla} · ${curso.duracao}`}
        titulo={curso.nome}
        entrada={curso.resumo}
      />

      <figure className={`contentor ${detalhe.imagem}`}>
        <img src={curso.imagem} alt="" />
      </figure>

      <dl className={ed.factos}>
        <div><dt>Duração</dt><dd>{curso.duracao}</dd></div>
        <div><dt>Regime</dt><dd>{curso.regime}</dd></div>
        <div><dt>Vagas</dt><dd>{curso.vagas}</dd></div>
        <div><dt>Carga horária</dt><dd>{totalHoras(curso)} horas</dd></div>
      </dl>

      <div className={`${ed.grelha} ${detalhe.grelha}`}>
        <aside className={ed.indice}>
          <h2 className={detalhe.indiceTitulo}>Neste curso</h2>
          <nav aria-label="Secções do curso">
            <ol>
              {seccoes.map((s) => (
                <li key={s.id}>
                  <Link
                    to={{ hash: `#${s.id}` }}
                    className={ativa === s.id ? ed.indiceAtivo : ''}
                    aria-current={ativa === s.id ? 'true' : undefined}
                  >
                    <span className={ed.indiceNumero}>{numero(s.id)}</span>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className={ed.caixaLateral}>
            <h3 className={detalhe.caixaTitulo}>Candidaturas</h3>
            <p>{pagina.candidaturasAbertas && prazo ? `Abertas até ${prazo}.` : 'Consulte o calendário de admissão.'}</p>
            <Link to={`/Candidatura?curso=${curso.id}`} className={ed.botao}>Candidatar-me a este curso</Link>
          </div>
        </aside>

        <div className={ed.conteudo}>
          <Seccao id="apresentacao" numero={numero('apresentacao')} rotulo="Apresentação" titulo="Sobre o curso">
            <div className={ed.texto}>
              {curso.apresentacao.map((p) => <p key={p}>{p}</p>)}
            </div>
            <dl className={detalhe.destinatarios}>
              <dt>Destinatários</dt>
              <dd>{curso.destinatarios}</dd>
            </dl>
          </Seccao>

          <Seccao id="objetivos" numero={numero('objetivos')} rotulo="Objetivos" titulo="No final do curso, o oficial é capaz de:">
            <ol className={ed.listaNumerada}>
              {curso.objetivos.map((o) => <li key={o}>{o}</li>)}
            </ol>
          </Seccao>

          <Seccao id="plano" numero={numero('plano')} rotulo="Plano curricular" titulo="Unidades curriculares por semestre">
            <div className={detalhe.semestres}>
              {curso.plano.map((p) => {
                const horas = p.unidades.reduce((s, u) => s + u.horas, 0)
                return (
                  <table key={p.periodo} className={ed.tabela}>
                    <caption>{p.periodo}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Unidade curricular</th>
                        <th scope="col" className={ed.numero}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.unidades.map((u) => (
                        <tr key={u.nome}>
                          <th scope="row">{u.nome}</th>
                          <td className={ed.numero}>{u.horas}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><th scope="row">Total do semestre</th><td className={ed.numero}>{horas}</td></tr>
                    </tfoot>
                  </table>
                )
              })}
            </div>
            <p className={detalhe.total}>
              Carga horária total do curso: <strong>{totalHoras(curso)} horas</strong>
            </p>
          </Seccao>

          <Seccao id="admissao" numero={numero('admissao')} rotulo="Admissão" titulo="Requisitos e processo de candidatura">
            <h3 className={detalhe.subtitulo}>Requisitos</h3>
            <ol className={ed.listaNumerada}>
              {curso.requisitos.map((r) => <li key={r}>{r}</li>)}
            </ol>
            <h3 className={detalhe.subtitulo}>Processo</h3>
            <ol className={ed.passos} style={{ '--colunas': processoAdmissao.length }}>
              {processoAdmissao.map((p, i) => (
                <li key={p.titulo}>
                  <span className={ed.passoNumero}>{i + 1}</span>
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </li>
              ))}
            </ol>
          </Seccao>

          <Seccao id="calendario" numero={numero('calendario')} rotulo="Calendário" titulo={`Datas da admissão ${pagina.anoAcademico}`}>
            <table className={ed.tabela}>
              <thead>
                <tr><th scope="col">Fase</th><th scope="col">Data</th></tr>
              </thead>
              <tbody>
                {calendarioAdmissao.map((f) => (
                  <tr key={f.fase}><th scope="row">{f.fase}</th><td>{f.periodo}</td></tr>
                ))}
              </tbody>
            </table>
          </Seccao>

          <Seccao id="saidas" numero={numero('saidas')} rotulo="Saídas profissionais" titulo="Funções para que o curso prepara">
            <ol className={ed.listaNumerada}>
              {curso.saidas.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </Seccao>

          <Seccao id="coordenacao" numero={numero('coordenacao')} rotulo="Coordenação" titulo="Quem coordena o curso">
            {coordenador && (
              <div className={detalhe.coordenacao}>
                <div className={ed.pessoa}>
                  <span className={ed.avatar}>
                    {coordenador.foto ? <img src={coordenador.foto} alt="" /> : iniciais(coordenador.nome)}
                  </span>
                  <div>
                    <strong>{coordenador.nome}</strong>
                    <span>Coordenação do {curso.sigla}</span>
                  </div>
                </div>
                <p>{coordenador.destaque}.</p>
                <Link to="/Contactos#formulario" className={ed.ligacao}>Contactar a coordenação</Link>
              </div>
            )}
          </Seccao>
        </div>
      </div>

      {/* Outros cursos */}
      {outros.length > 0 && (
        <section className="seccao seccao-cinza">
          <div className="contentor">
            <TituloSeccao rotulo="Formação" titulo="Outros cursos" />
            <div className={detalhe.outros}>
              {outros.map((c) => (
                <Cartao key={c.id} para={`/Cursos/${c.id}`} imagem={c.imagem} etiqueta={c.duracao} titulo={c.nome} resumo={c.resumo} elevado />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function Seccao({ id, numero, rotulo, titulo, children }) {
  return (
    <section id={id} className={ed.seccao}>
      <div className={ed.tituloSeccao}>
        <span className={ed.numeroSeccao} aria-hidden="true">{numero}</span>
        <span className={ed.rotulo}>{rotulo}</span>
        <h2>{titulo}</h2>
      </div>
      {children}
    </section>
  )
}

export default CursoDetalhe
