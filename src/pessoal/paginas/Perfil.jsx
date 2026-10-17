import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { abrirFicheiro, api, enviarComProgresso, urlFoto } from '../api'
import { etiquetaProcesso, sinteseBiografica } from '../documentos'
import Foto from '../componentes/Foto'
import { reduzirFoto } from '../fotos'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import { fichaPdf } from '../fichaPdf'
import Tabela from '../componentes/Tabela'
import Estante from '../componentes/Estante'
import NovaLicenca from '../componentes/NovaLicenca'
import Carregar from '../componentes/Carregar'
import { Cabecalho, Campo, Carregando, Condicoes, Erro, Escolha, Estado, Modal, Painel } from '../componentes/Ui'
import { anos, dataPt } from '../formatar'

const Dado = ({ r, v }) => <div className="col-sm-6 col-lg-4 mb-2"><div className="small text-muted">{r}</div><div className="fw-semibold">{v || v === 0 ? v : '—'}</div></div>
const KZ = (v) => (v || v === 0 ? `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz` : '—')
const ABAS = [['resumo', 'Dados', 'fa-id-card'], ['carreira', 'Carreira', 'fa-chevron-up'], ['historico', 'Histórico', 'fa-history'], ['processo', 'Processo individual', 'fa-folder-open'], ['cursos', 'Cursos', 'fa-graduation-cap'], ['licencas', 'Licenças', 'fa-plane-departure'], ['propostas', 'Propostas', 'fa-file-signature']]

export default function Perfil() {
  const { id } = useParams()
  const { ref, pode, avisar } = useSessao()
  const navegar = useNavigate()
  const { dados: p, erro, recarregar: carregar } = useDados(`/pessoas/${id}`)
  const [foto, setFoto] = useState({ chave: null, url: null })
  const [params] = useSearchParams()
  const [aba, setAba] = useState(params.get('aba') ?? 'resumo')
  const [modal, setModal] = useState(null)
  const ficheiro = useRef(null)
  const chaveFoto = p?.fotoId ? `${p.id}/${p.fotoId}` : null
  useEffect(() => {
    if (!chaveFoto) return undefined
    let url = null
    let vivo = true
    urlFoto(chaveFoto.split('/')[0]).then((u) => { url = u; if (vivo) setFoto({ chave: chaveFoto, url: u }) })
    return () => { vivo = false; if (url) URL.revokeObjectURL(url) }
  }, [chaveFoto])
  const urlDaFoto = foto.chave === chaveFoto ? foto.url : null

  async function enviarFoto(e) {
    const f = e.target?.files?.[0] ?? e.dataTransfer?.files?.[0]
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { avisar('A fotografia tem de ser JPG, PNG ou WEBP.', 'erro'); return }
    if (f.size > 30 * 1048576) { avisar('Fotografia demasiado grande (máximo 30 MB antes de reduzir).', 'erro'); return }
    const fd = new FormData()
    try {
      fd.append('foto', await reduzirFoto(f))
      await api(`/pessoas/${id}/foto`, { metodo: 'PUT', formulario: fd })
      avisar('Fotografia atualizada.')
      carregar()
    } catch (x) {
      avisar(x.message, 'erro')
    }
    if (e.target?.value) e.target.value = ''
  }

  if (erro) return <Erro texto={erro} aoRepetir={carregar} />
  if (!p) return <Carregando />
  const militar = p.tipo === 'militar'
  const editar = pode('editar')
  const fechar = () => setModal(null)
  const depois = (msg) => { fechar(); avisar(msg); carregar() }
  const graduacaoAtiva = p.graduacoes.find((g) => g.ativa)

  return (
    <>
      <Cabecalho titulo={militar ? 'Perfil do militar' : 'Perfil do funcionário civil'} migalhas={[['Pessoal', '/pessoas'], [p.nome]]}>
        {pode('ver') && <button type="button" className="btn btn-danger" onClick={() => sinteseBiografica(p)}><i className="fa fa-file-pdf me-1" />Síntese biográfica</button>}
        {pode('ver') && <button type="button" className="btn btn-outline-danger" onClick={() => fichaPdf(p, urlDaFoto)}><i className="fa fa-file-pdf me-1" />Ficha individual</button>}
        {editar && <Link to={`/pessoas/${p.id}/editar`} className="btn btn-theme"><i className="fa fa-pen me-1" />Editar ficha</Link>}
      </Cabecalho>

      <div className="profile pes-perfil mb-3">
        <div className="profile-header">
          <div className="profile-header-cover" />
          <div className="profile-header-content">
            <div className="profile-header-img pes-foto" onDragOver={(e) => { if (editar) e.preventDefault() }} onDrop={(e) => { if (editar) { e.preventDefault(); enviarFoto(e) } }} title={editar ? 'Arraste uma fotografia para aqui ou clique na câmara' : ''}>
              {urlDaFoto ? <img src={urlDaFoto} alt={`Fotografia de ${p.nome}`} /> : <i className="fa fa-user fa-4x text-muted" />}
              {editar && <button type="button" className="pes-foto-mudar" onClick={() => ficheiro.current.click()} title="Mudar fotografia"><i className="fa fa-camera" /></button>}
              <input ref={ficheiro} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={enviarFoto} />
            </div>
            <div className="profile-header-info">
              <h4 className="mt-0 mb-1">{militar && <span className="me-2">{p.postoNome}</span>}{p.nome}</h4>
              <p className="mb-2">
                {militar ? <>{p.ramoNome} · NIP {p.nip} · {p.categoriaNome}</> : <>{p.carreiraNome || 'Pessoal civil'} · {p.categoriaCivil || '—'} · N.º {p.numeroAgente || '—'}</>}
              </p>
              <div className="d-flex flex-wrap gap-1">
                <span className="badge bg-light text-dark">{p.vinculoNome}</span>
                {militar && <span className={`badge pes-ramo-${p.ramo}`}>{p.fpsNome}</span>}
                {militar && <span className={`badge ${p.situacao === 'activo' ? 'bg-success' : 'bg-warning text-dark'}`}>{p.situacaoNome}</span>}
                {graduacaoAtiva && <span className="badge bg-warning text-dark">Graduado em {graduacaoAtiva.postoNome}</span>}
                {p.elegivelPromocao && <span className="badge bg-success"><i className="fa fa-medal me-1" />Em condições de {militar ? `promoção a ${p.proximoPostoNome}` : `progressão a ${p.proximaCategoria}`}</span>}
                {!p.ativo && <span className="badge bg-danger">Já não está na Escola</span>}
                {p.processoPendente && <span className="badge bg-danger">Processo pendente</span>}
              </div>
            </div>
          </div>
          <ul className="profile-header-tab nav nav-tabs">
            {ABAS.map(([k, t, ic]) => <li key={k} className="nav-item"><button type="button" className={`nav-link ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}><i className={`fa ${ic} me-1`} />{t}</button></li>)}
          </ul>
        </div>
      </div>

      {aba === 'resumo' && (
        <div className="row">
          <div className="col-xl-8">
            <Painel titulo="Dados pessoais" icone="fa-user">
              <div className="row">
                <Dado r="Nome completo" v={p.nome} /><Dado r="Nome de guerra" v={p.nomeGuerra} /><Dado r="Bilhete de identidade" v={p.bi} />
                <Dado r="Data de nascimento" v={p.dataNascimento && `${dataPt(p.dataNascimento)} (${p.idade} anos)`} /><Dado r="Género" v={p.generoNome} /><Dado r="Estado civil" v={ref.estadosCivis[p.estadoCivil]} />
                <Dado r="Naturalidade" v={[p.naturalidade, p.provincia].filter(Boolean).join(', ')} /><Dado r="Nacionalidade" v={p.nacionalidade} /><Dado r="Filiação" v={[p.pai, p.mae].filter(Boolean).join(' e ')} />
                <Dado r="Telefone" v={p.telefone} /><Dado r="E-mail" v={p.email} /><Dado r="Morada" v={p.morada} />
                <Dado r="Habilitações" v={p.habilitacaoNome} /><Dado r="Área de formação" v={p.areaFormacao} />
              </div>
            </Painel>
            <Painel titulo={militar ? 'Situação militar' : 'Situação profissional'} icone={militar ? 'fa-shield-alt' : 'fa-briefcase'}>
              <div className="row">
                {militar ? <>
                  <Dado r="Ramo" v={p.ramoNome} /><Dado r="Posto" v={p.postoNome} /><Dado r="Categoria" v={p.categoriaNome} />
                  <Dado r="Forma de prestação de serviço" v={`${p.fpsNome} (${ref.formasServico[p.fps]?.carreira})`} /><Dado r="Quadro especial" v={p.quadroNome} /><Dado r="Especialidade" v={p.especialidade} />
                  <Dado r="Situação" v={p.situacaoNome} /><Dado r="Efectividade (art. 11.º)" v={p.efectividadeNome} /><Dado r="Ingresso nas FAA" v={dataPt(p.dataIngresso)} />
                  <Dado r="Ingresso no QP" v={dataPt(p.dataIngressoQP)} /><Dado r="Antiguidade no posto" v={dataPt(p.dataAntiguidadePosto)} /><Dado r="Tempo de serviço" v={anos(p.tempoServico)} />
                  <Dado r="Avaliação" v={p.avaliacaoFavoravel ? 'Favorável' : 'Desfavorável'} /><Dado r="Aptidão física e psíquica" v={p.aptidaoFisica ? 'Apto' : 'Não apto'} /><Dado r="Processo disciplinar/criminal" v={p.processoPendente ? 'Pendente' : 'Nenhum'} />
                </> : <>
                  <Dado r="Categoria (SIGP)" v={p.carreiraNome && `${p.nivelCategoria ? `${p.nivelCategoria}. ` : ''}${p.carreiraNome}`} /><Dado r="Classe" v={p.categoriaCivil} /><Dado r="Vínculo" v={p.vinculoCivilNome} />
                  <Dado r="Admissão" v={dataPt(p.dataAdmissao)} /><Dado r="Na classe desde" v={dataPt(p.dataCategoria)} /><Dado r="Tempo de serviço" v={anos(p.tempoServico)} />
                  {p.remuneracao && <><Dado r="Vencimento base da categoria" v={KZ(p.remuneracao.vencimentoBase)} /><Dado r="Subsídios (alimentação + transporte)" v={KZ(p.remuneracao.subsidioAlimentacao + p.remuneracao.subsidioTransporte)} /><Dado r={`Líquido de referência (SS ${p.remuneracao.percSegSocial}% · IRT ${p.remuneracao.percIrt}%)`} v={KZ(p.remuneracao.liquido)} /></>}
                  <Dado r="Avaliação de desempenho" v={p.avaliacaoFavoravel ? 'Favorável' : 'Desfavorável'} />
                </>}
              </div>
            </Painel>
          </div>
          <div className="col-xl-4">
            <Painel titulo="Na Escola" icone="fa-building">
              <div className="row">
                <Dado r="Unidade" v={p.unidade && <Link to={`/pessoas?unidadeId=${p.unidadeId}`}>{p.unidade.nome}</Link>} />
                <Dado r="Cargo" v={p.cargo?.nome} />
                <Dado r="No cargo desde" v={dataPt(p.dataCargo)} />
              </div>
              {p.observacoes && <p className="small mb-0 mt-2 text-muted">{p.observacoes}</p>}
            </Painel>
            {editar && pode('propor') && (
              <Painel titulo="Ações" icone="fa-bolt">
                <div className="d-grid gap-2">
                  {(militar ? ['promocao', 'graduacao', 'nomeacao', 'exoneracao'] : ['progressao', 'nomeacao', 'exoneracao']).filter((t) => t !== 'exoneracao' || p.cargoId).map((t) => (
                    <button key={t} type="button" className="btn btn-outline-theme text-start" onClick={() => navegar(`/propostas/nova?tipo=${t}&pessoa=${p.id}`)}><i className="fa fa-file-signature me-2" />Propor {ref.tiposProposta[t].nome.toLowerCase()}</button>
                  ))}
                  <button type="button" className="btn btn-outline-secondary text-start" onClick={() => setModal({ licenca: true })}><i className="fa fa-plane-departure me-2" />Registar licença</button>
                  <button type="button" className="btn btn-outline-secondary text-start" onClick={() => setModal({ evento: true })}><i className="fa fa-plus me-2" />Lançar no histórico (louvor, punição…)</button>
                </div>
              </Painel>
            )}
            {p.limiteDomiciliares > 0 && (
              <Painel titulo={`Empregados domiciliares (${p.domiciliares.length} de ${p.limiteDomiciliares})`} icone="fa-house-user">
                {p.domiciliares.map((d) => <Link key={d.id} to={`/pessoas/${d.id}`} className="pes-pessoa text-decoration-none mb-1"><Foto pessoaId={d.id} fotoId={d.fotoId} nome={d.nome} tamanho={30} /><span className="small">{d.nome}{d.telefone && <span className="text-muted"> · {d.telefone}</span>}</span></Link>)}
                {!p.domiciliares.length && <p className="small text-muted mb-1">Nenhum(a).</p>}
                {editar && p.domiciliares.length < p.limiteDomiciliares && <Link to={`/pessoas/nova?domiciliar=${p.id}`} className="btn btn-xs btn-outline-theme mt-1"><i className="fa fa-plus me-1" />Registar empregada(o) domiciliar</Link>}
              </Painel>
            )}
            {p.militarAlocado && (
              <Painel titulo="Empregada(o) domiciliar de" icone="fa-house-user">
                <Link to={`/pessoas/${p.militarAlocado.id}`}>{p.militarAlocado.postoNome} {p.militarAlocado.nome}</Link>
                <p className="small text-muted mb-0 mt-1">Não conta como trabalhador civil da Escola.</p>
              </Painel>
            )}
            {p.sincronizacao && (
              <Painel titulo="Conta no Portal Académico" icone="fa-exchange-alt">
                <Estado estado={p.sincronizacao.estado} texto={{ pendente: 'Por enviar', enviado: 'Enviada', erro: 'Erro no envio' }[p.sincronizacao.estado]} />
                {p.sincronizacao.erro && <div className="small text-danger mt-1">{p.sincronizacao.erro}</div>}
              </Painel>
            )}
          </div>
        </div>
      )}

      {aba === 'carreira' && (
        <div className="row">
          <div className="col-xl-7">
            {militar ? (
              <Painel titulo={p.promocao.postoProposto ? `Promoção a ${p.promocao.postoPropostoNome}` : 'Promoção'} icone="fa-medal">
                {p.promocao.postoProposto ? <>
                  <p className="mb-2">Modalidade da lei: <strong>{ref.modalidades[p.promocao.modalidadeLegal]}</strong> · {p.promocao.elegivel ? <span className="text-success fw-bold">reúne as condições</span> : <span className="text-danger fw-bold">não reúne as condições</span>}</p>
                  <Condicoes condicoes={p.promocao.condicoes} />
                </> : <p className="text-muted mb-0">{p.promocao.condicoes?.[0]?.detalhe || 'Não há posto acima a que possa ser promovido na sua forma de prestação de serviço.'}</p>}
              </Painel>
            ) : (
              <Painel titulo={p.progressao.categoriaProposta ? `Progressão a ${p.progressao.categoriaProposta}` : 'Progressão'} icone="fa-medal">
                <Condicoes condicoes={p.progressao.condicoes} />
              </Painel>
            )}
          </div>
          <div className="col-xl-5">
            {militar && p.reservaReforma && (
              <Painel titulo="Reserva e reforma" icone="fa-hourglass-half">
                <div className="row">
                  <Dado r="Idade" v={`${p.reservaReforma.idade} anos`} /><Dado r="Tempo de serviço" v={`${p.reservaReforma.tempoServico} anos`} />
                  <Dado r={`Reserva por idade${p.reservaReforma.reserva ? ` (${p.reservaReforma.reserva.idadeLimite} anos)` : ''}`} v={p.reservaReforma.reserva ? `${dataPt(p.reservaReforma.reserva.data)} · ${p.reservaReforma.reserva.artigo}` : 'Sem limite fixado para o posto'} />
                  <Dado r={`Reforma (${p.reservaReforma.reforma?.idadeLimite} anos)`} v={p.reservaReforma.reforma && `${dataPt(p.reservaReforma.reforma.data)} · ${p.reservaReforma.reforma.artigo}`} />
                  {p.reservaReforma.reformaPorTempo && <Dado r="Reforma por 35 anos de serviço" v={dataPt(p.reservaReforma.reformaPorTempo.data)} />}
                  {p.reservaReforma.podeRequererReserva && <Dado r="Pode requerer a reserva" v={`Sim (${p.reservaReforma.podeRequererReserva.artigo})`} />}
                </div>
              </Painel>
            )}
            {militar && (
              <Painel titulo="Graduações (arts. 64.º a 67.º)" icone="fa-star-half-alt" corpo={false}>
                <table className="table mb-0">
                  <tbody>
                    {p.graduacoes.map((g) => (
                      <tr key={g.id}>
                        <td><strong>{g.postoNome}</strong><div className="small text-muted">{g.motivo}</div></td>
                        <td>{dataPt(g.inicio)} – {g.fim ? dataPt(g.fim) : '…'}</td>
                        <td className="text-end">{g.ativa ? <>{editar && <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => setModal({ terminar: g })}>Terminar</button>}</> : <span className="badge bg-secondary">Terminada</span>}</td>
                      </tr>
                    ))}
                    {!p.graduacoes.length && <tr><td className="text-muted">Nunca foi graduado.</td></tr>}
                  </tbody>
                </table>
              </Painel>
            )}
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <Painel titulo="Histórico da carreira" icone="fa-history" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ evento: true })}><i className="fa fa-plus me-1" />Lançar</button>}>
          <Tabela titulo={`Histórico — ${p.nome}`} linhas={p.eventos} colunas={[
            { chave: 'data', titulo: 'Data', valor: (e) => e.data?.slice(0, 10), mostrar: (e) => dataPt(e.data) },
            { chave: 'tipo', titulo: 'Registo', valor: (e) => e.tipoNome, mostrar: (e) => <span className="badge bg-light text-dark border">{e.tipoNome}</span> },
            { chave: 'desc', titulo: 'Descrição', valor: (e) => [e.postoNovoNome && `${e.postoAnteriorNome ? `${e.postoAnteriorNome} → ` : ''}${e.postoNovoNome}`, e.cargoNome, e.descricao].filter(Boolean).join(' · ') },
            { chave: 'doc', titulo: 'Documento', valor: (e) => e.documento },
            { chave: 'proposta', titulo: 'Proposta', valor: (e) => (e.propostaId ? `#${e.propostaId}` : ''), mostrar: (e) => (e.propostaId ? <Link to={`/propostas/${e.propostaId}`} onClick={(x) => x.stopPropagation()}>#{e.propostaId}</Link> : '') },
            ...(editar ? [{ chave: 'apagar', titulo: '', exportar: false, valor: () => '', mostrar: (e) => ref.eventosManuais.includes(e.tipo) && <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={() => api(`/pessoas/${p.id}/eventos/${e.id}`, { metodo: 'DELETE' }).then(() => depois('Registo apagado.')).catch((x) => avisar(x.message, 'erro'))}><i className="fa fa-trash" /></button> }] : []),
          ]} />
        </Painel>
      )}

      {aba === 'cursos' && (
        <Painel titulo="Cursos (art. 48.º)" icone="fa-graduation-cap" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ curso: {} })}><i className="fa fa-plus me-1" />Adicionar curso</button>}>
          <Tabela titulo={`Cursos — ${p.nome}`} linhas={p.cursos} aoClicar={editar ? (c) => setModal({ curso: c }) : undefined} colunas={[
            { chave: 'nome', titulo: 'Curso', valor: (c) => c.nome, mostrar: (c) => <><strong>{c.nome}</strong>{c.chaveNome && <div className="small text-success"><i className="fa fa-medal me-1" />Condição de promoção: {c.chaveNome}</div>}</> },
            { chave: 'tipo', titulo: 'Tipo', valor: (c) => c.tipo },
            { chave: 'local', titulo: 'Local', valor: (c) => c.local },
            { chave: 'inicio', titulo: 'Início', valor: (c) => c.inicio?.slice(0, 10), mostrar: (c) => dataPt(c.inicio) },
            { chave: 'fim', titulo: 'Fim', valor: (c) => c.fim?.slice(0, 10), mostrar: (c) => dataPt(c.fim) },
            { chave: 'res', titulo: 'Resultado', valor: (c) => (c.aproveitamento === false ? 'Sem aproveitamento' : c.classificacao ? `${c.classificacao} valores` : 'Com aproveitamento') },
          ]} />
        </Painel>
      )}

      {aba === 'licencas' && (
        <Painel titulo="Licenças" icone="fa-plane-departure" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ licenca: true })}><i className="fa fa-plus me-1" />Registar licença</button>}>
          <Tabela titulo={`Licenças — ${p.nome}`} linhas={p.licencas} colunas={[
            { chave: 'tipo', titulo: 'Tipo', valor: (l) => ref.tiposLicenca[l.tipo] ?? l.tipo },
            { chave: 'inicio', titulo: 'Início', valor: (l) => l.inicio.slice(0, 10), mostrar: (l) => dataPt(l.inicio) },
            { chave: 'fim', titulo: 'Fim', valor: (l) => l.fim.slice(0, 10), mostrar: (l) => dataPt(l.fim) },
            { chave: 'dias', titulo: 'Dias', valor: (l) => l.dias, alinhar: 'end' },
            { chave: 'despacho', titulo: 'Despacho', valor: (l) => l.despacho },
          ]} />
        </Painel>
      )}

      {aba === 'processo' && <ProcessoIndividual p={p} editar={editar} aoMudar={carregar} />}

      {aba === 'propostas' && (
        <Painel titulo="Propostas em que entrou" icone="fa-file-signature">
          <Tabela titulo={`Propostas — ${p.nome}`} linhas={p.itens} aoClicar={(i) => navegar(`/propostas/${i.proposta.id}`)} colunas={[
            { chave: 'n', titulo: 'N.º', valor: (i) => i.proposta.id },
            { chave: 'titulo', titulo: 'Proposta', valor: (i) => i.proposta.titulo },
            { chave: 'tipo', titulo: 'Tipo', valor: (i) => ref.tiposProposta[i.proposta.tipo]?.nome },
            { chave: 'estado', titulo: 'Estado', valor: (i) => ref.estadosProposta[i.proposta.estado], mostrar: (i) => <Estado estado={i.proposta.estado} texto={ref.estadosProposta[i.proposta.estado]} /> },
            { chave: 'doc', titulo: 'Documento', valor: (i) => i.proposta.documento },
            { chave: 'data', titulo: 'Criada', valor: (i) => i.proposta.criadoEm.slice(0, 10), mostrar: (i) => dataPt(i.proposta.criadoEm) },
          ]} />
        </Painel>
      )}

      {modal?.licenca && <NovaLicenca pessoa={p} aoFechar={fechar} aoGuardar={() => depois('Licença registada.')} />}
      {modal?.evento && <NovoEvento p={p} aoFechar={fechar} aoGuardar={() => depois('Registado no histórico.')} />}
      {modal?.curso && <FormCurso p={p} curso={modal.curso} aoFechar={fechar} aoGuardar={(m) => depois(m)} />}
      {modal?.terminar && <TerminarGraduacao p={p} g={modal.terminar} aoFechar={fechar} aoGuardar={() => depois('Graduação terminada.')} />}
    </>
  )
}

// processo individual: n.º, onde está a pasta, documentos digitalizados e o que falta actualizar
function ProcessoIndividual({ p, editar, aoMudar }) {
  const { ref, avisar } = useSessao()
  const [loc, setLoc] = useState({ estante: p.processo?.estante ?? '', prateleira: p.processo?.prateleira ?? '', posicao: p.processo?.posicao ?? '', estado: p.processo?.estado ?? 'activo', observacoes: p.processo?.observacoes ?? '' })
  const [novo, setNovo] = useState({ tipo: 'bi', titulo: '', data: '' })
  const [aEnviar, setAEnviar] = useState(null)
  const falta = []
  const tem = (v, t) => { if (!v) falta.push(t) }
  tem(p.bi, 'N.º do BI'); tem(p.dataNascimento, 'Data de nascimento'); tem(p.fotoId, 'Fotografia'); tem(p.telefone, 'Telefone'); tem(p.habilitacao, 'Habilitações'); tem(p.unidadeId, 'Unidade')
  if (p.tipo === 'militar') { tem(p.dataIngresso, 'Data de ingresso'); tem(p.dataAntiguidadePosto, 'Antiguidade no posto'); tem(p.documentos.some((d) => d.tipo === 'extracto_promocao'), 'Extracto de promoção ao posto actual') }
  tem(p.documentos.some((d) => d.tipo === 'bi'), 'Cópia do BI digitalizada')
  const guardar = () => api(`/processos/${p.id}`, { metodo: 'PUT', corpo: loc }).then(() => { avisar(p.processo ? 'Processo actualizado.' : 'Processo aberto e numerado.'); aoMudar() }).catch((e) => avisar(e.message, 'erro'))
  async function anexar(f) {
    if (!f) return
    setAEnviar(0)
    const fd = new FormData()
    fd.append('tipo', novo.tipo)
    fd.append('titulo', novo.titulo)
    fd.append('data', novo.data)
    fd.append('ficheiro', f)
    try {
      await enviarComProgresso(`/pessoas/${p.id}/documentos`, fd, setAEnviar)
      avisar('Documento junto ao processo.')
      setNovo({ ...novo, titulo: '' })
      aoMudar()
    } catch (e) { avisar(e.message, 'erro') }
    setAEnviar(null)
  }
  return (
    <div className="row">
      <div className="col-xl-4">
        <Painel titulo={p.processo ? `Processo ${p.processo.numero}` : 'Processo por abrir'} icone="fa-folder" acoes={<button type="button" className="btn btn-xs btn-secondary" onClick={() => etiquetaProcesso(p)}><i className="fa fa-tag me-1" />Etiqueta da lombada</button>}>
          <div className="row">
            <Campo rotulo="Estante" col="col-4"><input className="form-control form-control-sm" value={loc.estante} disabled={!editar} onChange={(e) => setLoc({ ...loc, estante: e.target.value })} /></Campo>
            <Campo rotulo="Prateleira" col="col-4"><input className="form-control form-control-sm" value={loc.prateleira} disabled={!editar} onChange={(e) => setLoc({ ...loc, prateleira: e.target.value })} /></Campo>
            <Campo rotulo="Posição" col="col-4"><input className="form-control form-control-sm" value={loc.posicao} disabled={!editar} onChange={(e) => setLoc({ ...loc, posicao: e.target.value })} /></Campo>
            <Campo rotulo="Estado da pasta" col="col-12"><Escolha valor={loc.estado} aoMudar={(v) => setLoc({ ...loc, estado: v })} opcoes={ref.estadosProcesso} vazio={null} disabled={!editar} /></Campo>
            <Campo rotulo="Observações" col="col-12"><input className="form-control form-control-sm" value={loc.observacoes} disabled={!editar} onChange={(e) => setLoc({ ...loc, observacoes: e.target.value })} /></Campo>
          </div>
          {editar && <button type="button" className="btn btn-sm btn-theme" onClick={guardar}>{p.processo ? 'Guardar' : 'Abrir processo (n.º automático)'}</button>}
        </Painel>
        {p.processo?.estante && <OndeEsta p={p} />}
        <Painel titulo={falta.length ? `Por actualizar (${falta.length})` : 'Processo actualizado'} icone={falta.length ? 'fa-exclamation-triangle' : 'fa-check-circle'}>
          {falta.length ? <ul className="small mb-0 text-danger">{falta.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="small text-success mb-0">Tem todos os dados e documentos essenciais.</p>}
        </Painel>
      </div>
      <div className="col-xl-8">
        <Painel titulo={`Documentos digitalizados (${p.documentos.length})`} icone="fa-file-alt">
          {editar && (
            <div className="row align-items-end border-bottom pb-2 mb-2">
              <Campo rotulo="Tipo" col="col-md-4"><Escolha valor={novo.tipo} aoMudar={(v) => setNovo({ ...novo, tipo: v })} opcoes={ref.tiposDocumento} vazio={null} /></Campo>
              <Campo rotulo="Título (opcional)" col="col-md-4"><input className="form-control form-control-sm" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></Campo>
              <Campo rotulo="Data do documento" col="col-md-4"><input type="date" className="form-control form-control-sm" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} /></Campo>
              <div className="col-12 mb-2"><Carregar aceitar="application/pdf,image/*,.docx" maxMb={25} compacto titulo={`Juntar ${ref.tiposDocumento[novo.tipo]?.toLowerCase() ?? 'documento'}: arraste para aqui`} progresso={aEnviar} aoEscolher={anexar} ajuda="PDF, imagem digitalizada ou Word · até 25 MB" /></div>
            </div>
          )}
          <Tabela titulo={`Processo individual — ${p.nome}`} linhas={p.documentos.map((d) => ({ ...d, tipoNome: ref.tiposDocumento[d.tipo] ?? d.tipo }))} aoClicar={(d) => abrirFicheiro(`/documentos/${d.id}/ficheiro`, d.nomeOriginal).catch((e) => avisar(e.message, 'erro'))} vazio="Sem documentos digitalizados." colunas={[
            { chave: 'data', titulo: 'Data', valor: (d) => d.data?.slice(0, 10) ?? '', mostrar: (d) => dataPt(d.data) },
            { chave: 'tipo', titulo: 'Tipo', valor: (d) => d.tipoNome },
            { chave: 'titulo', titulo: 'Documento', valor: (d) => d.titulo, mostrar: (d) => <><i className={`fa ${d.mime === 'application/pdf' ? 'fa-file-pdf text-danger' : 'fa-file-image text-info'} me-1`} />{d.titulo}{d.extractoId && <Link to={`/extractos/${d.extractoId}`} className="small ms-2" onClick={(e) => e.stopPropagation()}>ver extracto</Link>}</> },
            { chave: 'por', titulo: 'Junto por', valor: (d) => d.criadoPor },
            ...(editar ? [{ chave: 'x', titulo: '', exportar: false, valor: () => '', mostrar: (d) => <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={(e) => { e.stopPropagation(); if (window.confirm('Apagar este documento do processo?')) api(`/documentos/${d.id}`, { metodo: 'DELETE' }).then(aoMudar).catch((x) => avisar(x.message, 'erro')) }}><i className="fa fa-trash" /></button> }] : []),
          ]} />
        </Painel>
      </div>
    </div>
  )
}

// a estante onde está a pasta, com ela destacada
function OndeEsta({ p }) {
  const navegar = useNavigate()
  const { dados } = useDados(p.processo?.estante ? '/processos' : null)
  const daEstante = (dados ?? []).filter((x) => x.estante === p.processo.estante)
  return (
    <Painel titulo={`Onde está a pasta: estante ${p.processo.estante}`} icone="fa-archive">
      {!dados ? <Carregando /> : <Estante processos={daEstante} pesquisa={p.processo.numero} aoAbrir={(x) => navegar(`/pessoas/${x.id}?aba=processo`)} minimoPosicoes={Number(p.processo.posicao) || 10} />}
    </Painel>
  )
}

function NovoEvento({ p, aoFechar, aoGuardar }) {
  const { ref } = useSessao()
  const [d, setD] = useState({ tipo: 'louvor', data: new Date().toISOString().slice(0, 10), descricao: '', documento: '', entidade: '' })
  const [erro, setErro] = useState('')
  const guardar = () => api(`/pessoas/${p.id}/eventos`, { metodo: 'POST', corpo: d }).then(aoGuardar).catch((e) => setErro(e.message))
  return (
    <Modal titulo="Lançar no histórico" aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <p className="small text-muted">Promoções, graduações, nomeações e exonerações entram no histórico pelas propostas aprovadas.</p>
      <div className="row">
        <Campo rotulo="Tipo"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={ref.eventosManuais.map((k) => [k, ref.tiposEvento[k]])} vazio={null} /></Campo>
        <Campo rotulo="Data"><input type="date" className="form-control form-control-sm" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} /></Campo>
        <Campo rotulo="Descrição" col="col-12"><textarea className="form-control form-control-sm" rows={2} value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} /></Campo>
        <Campo rotulo="Documento (ordem, despacho…)"><input className="form-control form-control-sm" value={d.documento} onChange={(e) => setD({ ...d, documento: e.target.value })} /></Campo>
        <Campo rotulo="Entidade"><input className="form-control form-control-sm" value={d.entidade} onChange={(e) => setD({ ...d, entidade: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}

function FormCurso({ p, curso, aoFechar, aoGuardar }) {
  const { ref, avisar } = useSessao()
  const [d, setD] = useState({ chave: curso.chave ?? '', nome: curso.nome ?? '', tipo: curso.tipo ?? 'formacao', local: curso.local ?? '', inicio: curso.inicio?.slice(0, 10) ?? '', fim: curso.fim?.slice(0, 10) ?? '', aproveitamento: curso.aproveitamento ?? true, classificacao: curso.classificacao ?? '' })
  const [erro, setErro] = useState('')
  const corpo = { ...d, chave: d.chave || null, classificacao: d.classificacao === '' ? null : Number(d.classificacao) }
  const guardar = () => api(`/pessoas/${p.id}/cursos${curso.id ? `/${curso.id}` : ''}`, { metodo: curso.id ? 'PUT' : 'POST', corpo }).then(() => aoGuardar(curso.id ? 'Curso atualizado.' : 'Curso adicionado.')).catch((e) => setErro(e.message))
  const apagar = () => api(`/pessoas/${p.id}/cursos/${curso.id}`, { metodo: 'DELETE' }).then(() => aoGuardar('Curso apagado.')).catch((e) => avisar(e.message, 'erro'))
  return (
    <Modal titulo={curso.id ? 'Editar curso' : 'Adicionar curso'} aoFechar={aoFechar} rodape={<>{curso.id && <button type="button" className="btn btn-outline-danger me-auto" onClick={apagar}>Apagar</button>}<button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-theme" onClick={guardar}>Guardar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <div className="row">
        <Campo rotulo="Nome do curso" obrigatorio col="col-12"><input className="form-control form-control-sm" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="É condição de promoção (art. 52.º)?" col="col-12" ajuda="Escolha o curso da lei a que corresponde, para contar na verificação da promoção."><Escolha valor={d.chave} aoMudar={(v) => setD({ ...d, chave: v, tipo: v ? 'promocao' : d.tipo })} opcoes={ref.cursosPromocao} vazio="Não" /></Campo>
        <Campo rotulo="Tipo"><Escolha valor={d.tipo} aoMudar={(v) => setD({ ...d, tipo: v })} opcoes={{ formacao: 'Formação', promocao: 'Promoção', qualificacao: 'Qualificação', actualizacao: 'Actualização', academico: 'Académico' }} vazio={null} /></Campo>
        <Campo rotulo="Local"><input className="form-control form-control-sm" value={d.local} onChange={(e) => setD({ ...d, local: e.target.value })} /></Campo>
        <Campo rotulo="Início" col="col-md-3"><input type="date" className="form-control form-control-sm" value={d.inicio} onChange={(e) => setD({ ...d, inicio: e.target.value })} /></Campo>
        <Campo rotulo="Fim" col="col-md-3"><input type="date" className="form-control form-control-sm" value={d.fim} onChange={(e) => setD({ ...d, fim: e.target.value })} /></Campo>
        <Campo rotulo="Aproveitamento" col="col-md-3"><Escolha valor={String(d.aproveitamento)} aoMudar={(v) => setD({ ...d, aproveitamento: v === 'true' })} opcoes={[['true', 'Com aproveitamento'], ['false', 'Sem aproveitamento']]} vazio={null} /></Campo>
        <Campo rotulo="Classificação (0–20)" col="col-md-3"><input type="number" min="0" max="20" step="0.01" className="form-control form-control-sm" value={d.classificacao} onChange={(e) => setD({ ...d, classificacao: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}

function TerminarGraduacao({ p, g, aoFechar, aoGuardar }) {
  const [d, setD] = useState({ fim: new Date().toISOString().slice(0, 10), motivo: '' })
  const [erro, setErro] = useState('')
  const guardar = () => api(`/pessoas/${p.id}/graduacoes/${g.id}/terminar`, { metodo: 'POST', corpo: d }).then(aoGuardar).catch((e) => setErro(e.message))
  return (
    <Modal titulo={`Terminar a graduação em ${g.postoNome}`} aoFechar={aoFechar} rodape={<><button type="button" className="btn btn-outline-secondary" onClick={aoFechar}>Cancelar</button><button type="button" className="btn btn-danger" onClick={guardar}>Terminar</button></>}>
      {erro && <div className="alert alert-danger">{erro}</div>}
      <p className="small text-muted">A graduação cessa com o fim do cargo que a justificou, a promoção ou por despacho (art. 67.º).</p>
      <div className="row">
        <Campo rotulo="Data de fim"><input type="date" className="form-control form-control-sm" value={d.fim} onChange={(e) => setD({ ...d, fim: e.target.value })} /></Campo>
        <Campo rotulo="Motivo"><input className="form-control form-control-sm" value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Campo>
      </div>
    </Modal>
  )
}
