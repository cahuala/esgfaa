import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { abrirFicheiro, api, enviarComProgresso, urlFoto } from '../api'
import { etiquetaProcesso } from '../documentos'
import Foto from '../componentes/Foto'
import { reduzirFoto } from '../fotos'
import { useDados } from '../useDados'
import { useSessao } from '../sessao'
import DocumentosPessoais from '../componentes/DocumentosPessoais'
import Tabela from '../componentes/Tabela'
import Estante from '../componentes/Estante'
import NovaLicenca from '../componentes/NovaLicenca'
import Carregar from '../componentes/Carregar'
import { Campo, Carregando, Condicoes, Erro, Escolha, Estado, Modal } from '../componentes/Ui'
import { anos, dataPt } from '../formatar'

// campo da ficha como no SIGP: rótulo pequeno em maiúsculas e o valor numa caixa
const Dado = ({ r, v, cheio }) => (
  <div className={`pes-campo ${cheio ? 'pes-campo-cheio' : ''}`}>
    <div className="pes-campo-r">{r}</div>
    <div className={`pes-campo-v ${v || v === 0 ? '' : 'pes-campo-vazio'}`}>{v || v === 0 ? v : '—'}</div>
  </div>
)
const Grelha = ({ children }) => <div className="pes-grelha">{children}</div>
const Bloco = ({ titulo, icone, acoes, children, corpo = true }) => (
  <div className="pes-bloco">
    <div className="pes-bloco-t"><span><i className={`fa ${icone} me-2`} />{titulo}</span>{acoes}</div>
    {corpo ? <div className="pes-bloco-c">{children}</div> : children}
  </div>
)
const KZ = (v) => (v || v === 0 ? `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz` : '—')
const iniciais = (n) => { const p = n.trim().split(/\s+/); return `${p[0]?.[0] ?? ''}${p.length > 1 ? p.at(-1)[0] : ''}`.toUpperCase() }
const ABAS = [['identificacao', 'Identificação', 'fa-id-card'], ['militar', 'Militar', 'fa-shield-alt'], ['pessoal', 'Pessoal', 'fa-user'], ['bancario', 'Bancário', 'fa-university'], ['familiares', 'Familiares', 'fa-users'], ['formacao', 'Formação', 'fa-graduation-cap'], ['historico', 'Histórico', 'fa-history'], ['carreira', 'Carreira', 'fa-chevron-up'], ['licencas', 'Licenças', 'fa-plane-departure'], ['processo', 'Processo individual', 'fa-folder-open'], ['propostas', 'Propostas', 'fa-file-signature'], ['emitidos', 'Documentos emitidos', 'fa-file-alt']]

export default function Perfil() {
  const { id } = useParams()
  const { ref, pode, avisar, utilizador } = useSessao()
  const navegar = useNavigate()
  const { dados: p, erro, recarregar: carregar } = useDados(`/pessoas/${id}`)
  const [foto, setFoto] = useState({ chave: null, url: null })
  const [params] = useSearchParams()
  const [aba, setAba] = useState(params.get('aba') ?? 'identificacao')
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
      <div className="pes-ficha-hdr">
        <div className="pes-ficha-avatar">{urlDaFoto ? <img src={urlDaFoto} alt="" /> : iniciais(p.nome)}</div>
        <div className="pes-ficha-info">
          <div className="pes-ficha-nip">{militar ? `NIP ${p.nip || '—'}` : `N.º de agente ${p.numeroAgente || '—'}`}</div>
          <div className="pes-ficha-nome">{p.nome}</div>
          <div className="pes-ficha-badges">
            {militar ? <>
              <span>{p.postoNome}</span><span>{p.fps}</span><span>{p.ramoNome}</span>
              <span className={p.situacao === 'activo' ? 'pes-sit-activo' : 'pes-sit-outro'} title={p.situacaoCaminho}>{p.situacao === 'activo' && p.efectividadeNome ? p.efectividadeNome : p.situacaoNome}</span>
              {p.estadoNome && <span>{p.estadoNome}</span>}
            </> : <><span>{p.carreiraNome || 'Pessoal civil'}</span>{p.categoriaCivil && <span>{p.categoriaCivil}</span>}</>}
            <span>{p.vinculoNome}</span>
            {graduacaoAtiva && <span>Graduado em {graduacaoAtiva.postoNome}</span>}
            {p.elegivelPromocao && <span className="pes-sit-activo"><i className="fa fa-medal me-1" />Em condições de {militar ? `promoção a ${p.proximoPostoNome}` : `progressão a ${p.proximaCategoria}`}</span>}
            {!p.ativo && <span className="pes-sit-outro">Já não está na Escola</span>}
            {p.processoPendente && <span className="pes-sit-outro">Processo pendente</span>}
          </div>
        </div>
        <div className="pes-ficha-acoes">
          <button type="button" className="pes-btn-hdr" onClick={() => navegar(-1)}><i className="fa fa-arrow-left" />Voltar</button>
          {editar && <Link to={`/pessoas/${p.id}/editar`} className="pes-btn-hdr pes-btn-ouro"><i className="fa fa-user-edit" />Editar</Link>}
          {editar && <button type="button" className="pes-btn-hdr" onClick={() => setModal({ documentos: true })}><i className="fa fa-file-signature" />Documentos</button>}
        </div>
      </div>

      <div className="pes-ficha-tabs" role="tablist">
        {ABAS.map(([k, t, ic]) => (k === 'militar' && !militar ? [k, 'Profissional', 'fa-briefcase'] : [k, t, ic])).map(([k, t, ic]) => <button key={k} type="button" role="tab" aria-selected={aba === k} className={`pes-ftab ${aba === k ? 'active' : ''}`} onClick={() => setAba(k)}><i className={`fa ${ic}`} />{t}{k === 'familiares' && (p.agregado?.length ?? 0) > 0 && <span className="pes-ftab-n">{p.agregado.length}</span>}</button>)}
      </div>

      {aba === 'identificacao' && (
        <div className="pes-ident">
          <div className="text-center">
            <div className="pes-ident-foto" onDragOver={(e) => { if (editar) e.preventDefault() }} onDrop={(e) => { if (editar) { e.preventDefault(); enviarFoto(e) } }} onClick={() => editar && ficheiro.current.click()} title={editar ? 'Clique (ou arraste uma fotografia) para alterar' : ''}>
              {urlDaFoto ? <img src={urlDaFoto} alt={`Fotografia de ${p.nome}`} /> : <span className="pes-ident-iniciais">{iniciais(p.nome)}</span>}
              {editar && <div className="pes-ident-mudar"><i className="fa fa-camera" />Alterar foto</div>}
            </div>
            <input ref={ficheiro} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={enviarFoto} />
            <div className="pes-ident-nip">{militar ? `NIP ${p.nip || '—'}` : `N.º ${p.numeroAgente || '—'}`}</div>
          </div>
          <div>
            <div className="pes-ident-cab">
              <div className="pes-ident-nome">{p.nome}</div>
              <div className="d-flex flex-wrap gap-1">
                {militar && <span className="pes-etq">{p.postoNome}</span>}
                {militar && <span className="pes-etq pes-etq-verde">{p.fpsNome}</span>}
                <span className="pes-etq">{p.vinculoNome}</span>
              </div>
            </div>
            <Grelha>
              <Dado r="Nº de agente" v={p.numeroAgente} /><Dado r="Bilhete de identidade" v={p.bi} />
              <Dado r="Data de nascimento" v={p.dataNascimento && <>{dataPt(p.dataNascimento)} <small className="text-muted">({p.idade} anos)</small></>} />
              <Dado r="Nome do pai" v={p.pai} /><Dado r="Nome da mãe" v={p.mae} />
              {militar && <Dado r="Incorporação" v={dataPt(p.dataIngresso)} />}
              <Dado r="Especialidade" v={militar ? p.especialidade : p.areaFormacao} />
              <Dado r="Unidade" cheio v={p.unidade && <Link to={`/pessoas?unidadeId=${p.unidadeId}`}>{p.unidade.nome}</Link>} />
              <Dado r="Cargo" cheio v={p.cargo?.nome && <>{p.cargo.nome}{p.dataCargo && <small className="text-muted ms-2">desde {dataPt(p.dataCargo)}</small>}</>} />
              <Dado r="Na Escola desde" v={dataPt(p.dataEntradaEscola || p.dataCargo || p.dataAdmissao)} />
              {!p.ativo && <Dado r="Saiu da Escola" cheio v={[dataPt(p.dataSaidaEscola), p.motivoSaida, p.destinoSaida && `destino: ${p.destinoSaida}`].filter((x) => x && x !== '—').join(' · ')} />}
              {p.observacoes && <Dado r="Observações" cheio v={p.observacoes} />}
            </Grelha>
            {utilizador.pessoaId === p.id && <div className="mt-3"><OsMeusDados /></div>}
            {p.militarAlocado && <Bloco titulo="Empregada(o) domiciliar de" icone="fa-house-user"><Link to={`/pessoas/${p.militarAlocado.id}`}>{p.militarAlocado.postoNome} {p.militarAlocado.nome}</Link><p className="small text-muted mb-0 mt-1">Não conta como trabalhador civil da Escola.</p></Bloco>}
            {p.sincronizacao && (
              <Bloco titulo="Conta no Portal Académico" icone="fa-exchange-alt">
                <Estado estado={p.sincronizacao.estado} texto={{ pendente: 'Por enviar', enviado: 'Enviada', erro: 'Erro no envio' }[p.sincronizacao.estado]} />
                {p.sincronizacao.erro && <div className="small text-danger mt-1">{p.sincronizacao.erro}</div>}
              </Bloco>
            )}
          </div>
        </div>
      )}

      {aba === 'militar' && (
        <div className="row">
          <div className="col-xl-8">
            {militar ? <>
              <Bloco titulo="Situação actual" icone="fa-star">
                <Grelha>
                  <Dado r="Posto" v={<><span className="pes-etq">{p.postoNome}</span>{graduacaoAtiva && <span className="pes-etq pes-etq-roxo ms-1" title="Graduação (arts. 64.º a 67.º): não conta para a antiguidade">graduado: {graduacaoAtiva.postoNome}</span>}{p.processoPendente && <span className="pes-etq pes-etq-vermelho ms-1">processo em curso</span>}</>} />
                  <Dado r="Situação (Lei n.º 13/18)" cheio v={p.situacaoCaminho ? `${p.situacaoCaminho} (${p.situacaoArtigo})` : p.situacaoNome} />
                  <Dado r="Estado" v={p.estadoNome || 'Ao serviço'} />
                  <Dado r="Cargo" cheio v={p.cargo?.nome} /><Dado r="Unidade" cheio v={p.unidade?.nome} />
                </Grelha>
              </Bloco>
              <Bloco titulo="Classificação militar" icone="fa-shield-alt">
                <Grelha>
                  <Dado r="Ramo" v={p.ramoNome} /><Dado r="Categoria" v={p.categoriaNome} />
                  <Dado r="FPS" v={`${p.fpsNome} (${ref.formasServico[p.fps]?.carreira})`} /><Dado r="Quadro especial" v={p.quadroNome} />
                  <Dado r="Especialidade" v={p.especialidade} /><Dado r="Anos no posto" v={p.tempoNoPosto !== null && p.tempoNoPosto !== undefined ? anos(p.tempoNoPosto) : 'Falta a data de antiguidade no posto'} />
                  <Dado r="Ingresso nas FAA" v={dataPt(p.dataIngresso)} /><Dado r="Ingresso no QP" v={dataPt(p.dataIngressoQP)} />
                  <Dado r="Antiguidade no posto" v={dataPt(p.dataAntiguidadePosto)} /><Dado r="Tempo de serviço" v={anos(p.tempoServico)} />
                  <Dado r="Local de incorporação" v={p.localIncorporacao} /><Dado r="Condição de incorporação" v={p.voluntario === true ? 'Voluntário' : p.voluntario === false ? 'Não voluntário' : ''} />
                  <Dado r="Avaliação" v={p.avaliacaoFavoravel ? 'Favorável' : 'Desfavorável'} /><Dado r="Aptidão física e psíquica" v={p.aptidaoFisica ? 'Apto' : 'Não apto'} />
                  <Dado r="Processo disciplinar/criminal" v={p.processoPendente ? 'Pendente' : 'Nenhum'} />
                </Grelha>
              </Bloco>
            </> : (
              <Bloco titulo="Situação profissional" icone="fa-briefcase">
                <Grelha>
                  <Dado r="Categoria" v={p.carreiraNome && `${p.nivelCategoria ? `${p.nivelCategoria}. ` : ''}${p.carreiraNome}`} /><Dado r="Classe" v={p.categoriaCivil} /><Dado r="Vínculo" v={p.vinculoCivilNome} />
                  <Dado r="Admissão" v={dataPt(p.dataAdmissao)} /><Dado r="Na classe desde" v={dataPt(p.dataCategoria)} /><Dado r="Tempo de serviço" v={anos(p.tempoServico)} />
                  <Dado r="Avaliação de desempenho" v={p.avaliacaoFavoravel ? 'Favorável' : 'Desfavorável'} />
                  <Dado r="Cargo" cheio v={p.cargo?.nome} /><Dado r="Unidade" cheio v={p.unidade?.nome} />
                </Grelha>
              </Bloco>
            )}
            {p.docente && <Bloco titulo="Docente" icone="fa-chalkboard-teacher"><Grelha><Dado r="Tipo de docente" v={p.tipoDocenteNome} /><Dado r="Categoria do docente" v={p.categoriaDocente} /></Grelha></Bloco>}
            {p.limiteDomiciliares > 0 && (
              <Bloco titulo="Trabalhadores domiciliares" icone="fa-house-user" acoes={<span className="pes-ftab-n">{p.domiciliares.length}/{p.limiteDomiciliares}</span>}>
                {p.domiciliares.length ? (
                  <table className="table table-sm mb-2"><thead><tr><th>Nome</th><th>Nº de agente</th><th>Telefone</th></tr></thead>
                    <tbody>{p.domiciliares.map((d) => <tr key={d.id}><td><Link to={`/pessoas/${d.id}`} className="pes-pessoa fw-semibold"><Foto pessoaId={d.id} fotoId={d.fotoId} nome={d.nome} tamanho={26} />{d.nome}</Link></td><td>{d.numeroAgente}</td><td>{d.telefone}</td></tr>)}</tbody></table>
                ) : <p className="small text-muted mb-2">Ainda não tem trabalhador(es) domiciliar(es) — tem direito a {p.limiteDomiciliares}, pelo posto actual.</p>}
                {editar && p.domiciliares.length < p.limiteDomiciliares && <Link to={`/pessoas/nova?domiciliar=${p.id}`} className="btn btn-xs btn-outline-theme"><i className="fa fa-user-plus me-1" />Registar empregada(o) domiciliar</Link>}
              </Bloco>
            )}
          </div>
          <div className="col-xl-4">
            {editar && pode('propor') && (
              <Bloco titulo="Ações" icone="fa-bolt">
                <div className="d-grid gap-2">
                  {(militar ? ['promocao', 'graduacao', 'nomeacao', 'curso', 'exoneracao'] : ['progressao', 'nomeacao', 'curso', 'exoneracao']).filter((t) => t !== 'exoneracao' || p.cargoId).map((t) => (
                    <button key={t} type="button" className="btn btn-outline-theme text-start" onClick={() => navegar(`/propostas/nova?tipo=${t}&pessoa=${p.id}`)}><i className="fa fa-file-signature me-2" />{t === 'curso' ? 'Propor para curso' : `Propor ${ref.tiposProposta[t].nome.toLowerCase()}`}</button>
                  ))}
                  <button type="button" className="btn btn-outline-secondary text-start" onClick={() => setModal({ licenca: true })}><i className="fa fa-plane-departure me-2" />Registar licença</button>
                  <button type="button" className="btn btn-outline-secondary text-start" onClick={() => setModal({ evento: true })}><i className="fa fa-plus me-2" />Lançar no histórico (louvor, punição…)</button>
                </div>
              </Bloco>
            )}
          </div>
        </div>
      )}

      {aba === 'pessoal' && (
        <>
          <Bloco titulo="Filiação" icone="fa-users"><Grelha><Dado r="Nome do pai" v={p.pai} /><Dado r="Nome da mãe" v={p.mae} /></Grelha></Bloco>
          <Bloco titulo="Dados pessoais" icone="fa-user">
            <Grelha>
              <Dado r="Nome completo" v={p.nome} /><Dado r="Nome de guerra" v={p.nomeGuerra} />
              <Dado r="Data de nascimento" v={p.dataNascimento && `${dataPt(p.dataNascimento)} (${p.idade} anos)`} /><Dado r="Género" v={p.generoNome} />
              <Dado r="Estado civil" v={ref.estadosCivis[p.estadoCivil]} /><Dado r="Naturalidade" v={[p.naturalidade, p.provincia].filter(Boolean).join(', ')} />
              <Dado r="Nacionalidade" v={p.nacionalidade} /><Dado r="Grupo sanguíneo" v={p.grupoSanguineo} />
              <Dado r="Habilitações" v={p.habilitacaoNome} /><Dado r="Área de formação" v={p.areaFormacao} />
            </Grelha>
          </Bloco>
          <Bloco titulo="Bilhete de identidade" icone="fa-id-badge">
            <Grelha><Dado r="Número" v={p.bi} /><Dado r="Emitido em" v={[p.biLocalEmissao, dataPt(p.biEmitidoEm)].filter(Boolean).join(', ')} /><Dado r="Válido até" v={dataPt(p.biValidade)} /></Grelha>
          </Bloco>
          <Bloco titulo="Contactos e residência" icone="fa-map-marker-alt">
            <Grelha>
              <Dado r="Telefone" v={p.telefone} /><Dado r="Telefone alternativo" v={p.telefoneAlternativo} /><Dado r="E-mail" v={p.email} />
              <Dado r="Morada" v={p.morada} /><Dado r="Município" v={p.municipio} /><Dado r="Bairro" v={p.bairro} />
              <Dado r="Rua" v={p.rua} /><Dado r="Casa n.º" v={p.casa} /><Dado r="Caixa postal" v={p.caixaPostal} />
            </Grelha>
          </Bloco>
        </>
      )}

      {aba === 'bancario' && (
        <>
          <Bloco titulo="Dados bancários" icone="fa-university">
            <Grelha><Dado r="Banco" v={p.banco} /><Dado r="IBAN" v={p.iban && <span className="font-monospace">{p.iban}</span>} /><Dado r="Número de conta" v={p.numeroConta && <span className="font-monospace">{p.numeroConta}</span>} /></Grelha>
            {!p.banco && !p.iban && !p.numeroConta && <p className="small text-muted mb-0 mt-3"><i className="fa fa-info-circle me-1" />Sem dados bancários registados.</p>}
          </Bloco>
          <Bloco titulo="Vencimento" icone="fa-coins">
            <Grelha>
              <Dado r="Vencimento mensal (folha)" v={p.vencimento ? KZ(p.vencimento) : ''} />
              {militar && p.vencimentoTabela && <><Dado r="Tabela salarial — vencimento base" v={KZ(p.vencimentoTabela.base)} /><Dado r="Tabela salarial — ilíquido" v={KZ(p.vencimentoTabela.iliquido)} /><Dado r="Tabela salarial — líquido" v={KZ(p.vencimentoTabela.liquido)} /></>}
              {!militar && p.remuneracao && <><Dado r="Vencimento base da categoria" v={KZ(p.remuneracao.vencimentoBase)} /><Dado r="Subsídios (alimentação + transporte)" v={KZ(p.remuneracao.subsidioAlimentacao + p.remuneracao.subsidioTransporte)} /><Dado r={`Líquido de referência (SS ${p.remuneracao.percSegSocial}% · IRT ${p.remuneracao.percIrt}%)`} v={KZ(p.remuneracao.liquido)} /></>}
              <Dado r="N.º de segurança social (INSS)" v={p.inss} />
            </Grelha>
            {militar && <p className="small text-muted mb-0 mt-3"><Link to="/tabela-salarial">Ver a tabela salarial por posto</Link></p>}
          </Bloco>
        </>
      )}

      {aba === 'familiares' && (
        <Bloco titulo="Familiares registados" icone="fa-users" acoes={<span className="pes-ftab-n">{(p.agregado?.length ?? 0) + (p.conjuge ? 1 : 0)}</span>} corpo={false}>
          <div className="pes-bloco-c pb-0"><Grelha><Dado r="Cônjuge" v={p.conjuge} /><Dado r="Local de serviço do cônjuge" v={p.conjugeLocalServico} /></Grelha></div>
          {p.agregado?.length > 0 ? (
            <div className="table-responsive mt-3"><table className="table table-hover mb-0"><thead><tr><th>Nome</th><th>Parentesco</th><th>Nascimento</th><th>Nacionalidade</th><th>Profissão</th></tr></thead>
              <tbody>{p.agregado.map((a, i) => <tr key={i}><td className="fw-semibold">{a.nome}</td><td>{a.parentesco}</td><td>{dataPt(a.dataNascimento)}</td><td>{a.nacionalidade}</td><td>{a.profissao}</td></tr>)}</tbody></table></div>
          ) : <div className="pes-vazio"><i className="fa fa-users" /><p>Nenhum familiar registado.{editar && <> <Link to={`/pessoas/${p.id}/editar`}>Acrescentar na ficha</Link>.</>}</p></div>}
        </Bloco>
      )}

      {aba === 'emitidos' && <DocumentosEmitidos pessoaId={p.id} />}

      {modal?.documentos && <DocumentosPessoais p={p} aoFechar={fechar} aoEmitir={(n) => { fechar(); avisar(`${n} documento(s) gerado(s).`); if (aba === 'emitidos') setAba('identificacao') }} />}

      {aba === 'carreira' && (
        <div className="row">
          <div className="col-xl-7">
            {militar ? (
              <Bloco titulo={p.promocao.postoProposto ? `Promoção a ${p.promocao.postoPropostoNome}` : 'Promoção'} icone="fa-medal">
                {p.promocao.postoProposto ? <>
                  <p className="mb-2">Modalidade da lei: <strong>{ref.modalidades[p.promocao.modalidadeLegal]}</strong> · {p.promocao.elegivel ? <span className="text-success fw-bold">reúne as condições</span> : <span className="text-danger fw-bold">não reúne as condições</span>}</p>
                  <Condicoes condicoes={p.promocao.condicoes} />
                </> : <p className="text-muted mb-0">{p.promocao.condicoes?.[0]?.detalhe || 'Não há posto acima a que possa ser promovido na sua forma de prestação de serviço.'}</p>}
              </Bloco>
            ) : (
              <Bloco titulo={p.progressao.categoriaProposta ? `Progressão a ${p.progressao.categoriaProposta}` : 'Progressão'} icone="fa-medal">
                <Condicoes condicoes={p.progressao.condicoes} />
              </Bloco>
            )}
          </div>
          <div className="col-xl-5">
            {militar && p.reservaReforma && (
              <Bloco titulo="Reserva e reforma" icone="fa-hourglass-half">
                <div className="row">
                  <Dado r="Idade" v={`${p.reservaReforma.idade} anos`} /><Dado r="Tempo de serviço" v={`${p.reservaReforma.tempoServico} anos`} />
                  <Dado r={`Reserva por idade${p.reservaReforma.reserva ? ` (${p.reservaReforma.reserva.idadeLimite} anos)` : ''}`} v={p.reservaReforma.reserva ? `${dataPt(p.reservaReforma.reserva.data)} · ${p.reservaReforma.reserva.artigo}` : 'Sem limite fixado para o posto'} />
                  <Dado r={`Reforma (${p.reservaReforma.reforma?.idadeLimite} anos)`} v={p.reservaReforma.reforma && `${dataPt(p.reservaReforma.reforma.data)} · ${p.reservaReforma.reforma.artigo}`} />
                  {p.reservaReforma.reformaPorTempo && <Dado r="Reforma por 35 anos de serviço" v={dataPt(p.reservaReforma.reformaPorTempo.data)} />}
                  {p.reservaReforma.podeRequererReserva && <Dado r="Pode requerer a reserva" v={`Sim (${p.reservaReforma.podeRequererReserva.artigo})`} />}
                </div>
              </Bloco>
            )}
            {militar && (
              <Bloco titulo="Graduações (arts. 64.º a 67.º)" icone="fa-star-half-alt" corpo={false}>
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
              </Bloco>
            )}
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <Bloco titulo="Histórico da carreira" icone="fa-history" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ evento: true })}><i className="fa fa-plus me-1" />Lançar</button>}>
          <Tabela titulo={`Histórico — ${p.nome}`} linhas={p.eventos} colunas={[
            { chave: 'data', titulo: 'Data', valor: (e) => e.data?.slice(0, 10), mostrar: (e) => dataPt(e.data) },
            { chave: 'tipo', titulo: 'Registo', valor: (e) => e.tipoNome, mostrar: (e) => <span className="badge bg-light text-dark border">{e.tipoNome}</span> },
            { chave: 'desc', titulo: 'Descrição', valor: (e) => [e.postoNovoNome && `${e.postoAnteriorNome ? `${e.postoAnteriorNome} → ` : ''}${e.postoNovoNome}`, e.cargoNome, e.descricao].filter(Boolean).join(' · ') },
            { chave: 'doc', titulo: 'Documento', valor: (e) => e.documento },
            { chave: 'proposta', titulo: 'Proposta', valor: (e) => (e.propostaId ? `#${e.propostaId}` : ''), mostrar: (e) => (e.propostaId ? <Link to={`/propostas/${e.propostaId}`} onClick={(x) => x.stopPropagation()}>#{e.propostaId}</Link> : '') },
            ...(editar ? [{ chave: 'apagar', titulo: '', exportar: false, valor: () => '', mostrar: (e) => ref.eventosManuais.includes(e.tipo) && <button type="button" className="btn btn-xs btn-outline-danger" title="Apagar" onClick={() => api(`/pessoas/${p.id}/eventos/${e.id}`, { metodo: 'DELETE' }).then(() => depois('Registo apagado.')).catch((x) => avisar(x.message, 'erro'))}><i className="fa fa-trash" /></button> }] : []),
          ]} />
        </Bloco>
      )}

      {aba === 'formacao' && (
        <Bloco titulo="Cursos militares e outros (art. 48.º)" icone="fa-graduation-cap" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ curso: {} })}><i className="fa fa-plus me-1" />Adicionar curso</button>}>
          <Tabela titulo={`Cursos — ${p.nome}`} linhas={p.cursos} aoClicar={editar ? (c) => setModal({ curso: c }) : undefined} colunas={[
            { chave: 'nome', titulo: 'Curso', valor: (c) => c.nome, mostrar: (c) => <><strong>{c.nome}</strong>{c.chaveNome && <div className="small text-success"><i className="fa fa-medal me-1" />Condição de promoção: {c.chaveNome}</div>}</> },
            { chave: 'tipo', titulo: 'Tipo', valor: (c) => c.tipo },
            { chave: 'local', titulo: 'Local', valor: (c) => c.local },
            { chave: 'inicio', titulo: 'Início', valor: (c) => c.inicio?.slice(0, 10), mostrar: (c) => dataPt(c.inicio) },
            { chave: 'fim', titulo: 'Fim', valor: (c) => c.fim?.slice(0, 10), mostrar: (c) => dataPt(c.fim) },
            { chave: 'res', titulo: 'Resultado', valor: (c) => (c.aproveitamento === false ? 'Sem aproveitamento' : c.classificacao ? `${c.classificacao} valores` : 'Com aproveitamento') },
          ]} />
        </Bloco>
      )}

      {aba === 'licencas' && (
        <Bloco titulo="Licenças" icone="fa-plane-departure" acoes={editar && <button type="button" className="btn btn-xs btn-theme" onClick={() => setModal({ licenca: true })}><i className="fa fa-plus me-1" />Registar licença</button>}>
          <Tabela titulo={`Licenças — ${p.nome}`} linhas={p.licencas} colunas={[
            { chave: 'tipo', titulo: 'Tipo', valor: (l) => ref.tiposLicenca[l.tipo] ?? l.tipo },
            { chave: 'inicio', titulo: 'Início', valor: (l) => l.inicio.slice(0, 10), mostrar: (l) => dataPt(l.inicio) },
            { chave: 'fim', titulo: 'Fim', valor: (l) => l.fim.slice(0, 10), mostrar: (l) => dataPt(l.fim) },
            { chave: 'dias', titulo: 'Dias', valor: (l) => l.dias, alinhar: 'end' },
            { chave: 'despacho', titulo: 'Despacho', valor: (l) => l.despacho },
          ]} />
        </Bloco>
      )}

      {aba === 'processo' && <ProcessoIndividual p={p} editar={editar} aoMudar={carregar} />}

      {aba === 'propostas' && (
        <Bloco titulo="Propostas em que entrou" icone="fa-file-signature">
          <Tabela titulo={`Propostas — ${p.nome}`} linhas={p.itens} aoClicar={(i) => navegar(`/propostas/${i.proposta.id}`)} colunas={[
            { chave: 'n', titulo: 'N.º', valor: (i) => i.proposta.id },
            { chave: 'titulo', titulo: 'Proposta', valor: (i) => i.proposta.titulo },
            { chave: 'tipo', titulo: 'Tipo', valor: (i) => ref.tiposProposta[i.proposta.tipo]?.nome },
            { chave: 'estado', titulo: 'Estado', valor: (i) => ref.estadosProposta[i.proposta.estado], mostrar: (i) => <Estado estado={i.proposta.estado} texto={ref.estadosProposta[i.proposta.estado]} /> },
            { chave: 'doc', titulo: 'Documento', valor: (i) => i.proposta.documento },
            { chave: 'data', titulo: 'Criada', valor: (i) => i.proposta.criadoEm.slice(0, 10), mostrar: (i) => dataPt(i.proposta.criadoEm) },
          ]} />
        </Bloco>
      )}

      {modal?.licenca && <NovaLicenca pessoa={p} aoFechar={fechar} aoGuardar={() => depois('Licença registada.')} />}
      {modal?.evento && <NovoEvento p={p} aoFechar={fechar} aoGuardar={() => depois('Registado no histórico.')} />}
      {modal?.curso && <FormCurso p={p} curso={modal.curso} aoFechar={fechar} aoGuardar={(m) => depois(m)} />}
      {modal?.terminar && <TerminarGraduacao p={p} g={modal.terminar} aoFechar={fechar} aoGuardar={() => depois('Graduação terminada.')} />}
    </>
  )
}

const TIPOS_PEDIDO = { rectificacao: 'Rectificação (corrigir dados)', acesso: 'Acesso aos meus dados', oposicao: 'Oposição a um tratamento', eliminacao: 'Eliminação de dados', outro: 'Outro assunto sobre dados pessoais' }
const ESTADOS_PEDIDO = { pendente: 'Por responder', respondido: 'Respondido', recusado: 'Recusado' }

// direitos do titular (Lei n.º 22/11): descarregar a própria ficha e pedir correcções
function OsMeusDados() {
  const { avisar } = useSessao()
  const { dados: pedidos, recarregar } = useDados('/eu/pedidos-dados')
  const [f, setF] = useState({ tipo: 'rectificacao', texto: '' })
  async function descarregar() {
    try {
      const d = await api('/eu/dados')
      const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'os-meus-dados.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (e) { avisar(e.message, 'erro') }
  }
  const pedir = () => api('/eu/pedidos-dados', { metodo: 'POST', corpo: f }).then(() => { setF({ ...f, texto: '' }); avisar('Pedido enviado à Repartição de Pessoal e Quadros.'); recarregar() }).catch((e) => avisar(e.message, 'erro'))
  return (
    <Bloco titulo="Os meus dados" icone="fa-user-shield">
      <p className="small">Os seus dados são tratados segundo a Lei n.º 22/11. <Link to="/privacidade">Política de privacidade</Link></p>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={descarregar}><i className="fa fa-download me-1" />Descarregar os meus dados</button>
      <Escolha valor={f.tipo} aoMudar={(v) => setF({ ...f, tipo: v })} opcoes={TIPOS_PEDIDO} vazio={null} aria-label="Tipo de pedido" />
      <textarea className="form-control form-control-sm my-2" rows={3} value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} placeholder="Diga o que pretende (ex.: a minha data de ingresso está errada)" aria-label="Descrição do pedido" />
      <button type="button" className="btn btn-sm btn-theme" disabled={f.texto.trim().length < 5} onClick={pedir}><i className="fa fa-paper-plane me-1" />Enviar pedido</button>
      {pedidos?.length > 0 && <ul className="list-unstyled small mt-3 mb-0">{pedidos.map((x) => <li key={x.id} className="border-top pt-2 mt-2"><span className={`badge ${x.estado === 'pendente' ? 'bg-warning text-dark' : x.estado === 'respondido' ? 'bg-success' : 'bg-secondary'} me-1`}>{ESTADOS_PEDIDO[x.estado]}</span><strong>{TIPOS_PEDIDO[x.tipo]}</strong><div className="text-muted">{x.texto}</div>{x.resposta && <div><i className="fa fa-reply me-1" />{x.resposta}</div>}</li>)}</ul>}
    </Bloco>
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
        <Bloco titulo={p.processo ? `Processo ${p.processo.numero}` : 'Processo por abrir'} icone="fa-folder" acoes={<button type="button" className="btn btn-xs btn-secondary" onClick={() => etiquetaProcesso(p)}><i className="fa fa-tag me-1" />Etiqueta da lombada</button>}>
          <div className="row">
            <Campo rotulo="Estante" col="col-4"><input className="form-control form-control-sm" value={loc.estante} disabled={!editar} onChange={(e) => setLoc({ ...loc, estante: e.target.value })} /></Campo>
            <Campo rotulo="Prateleira" col="col-4"><input className="form-control form-control-sm" value={loc.prateleira} disabled={!editar} onChange={(e) => setLoc({ ...loc, prateleira: e.target.value })} /></Campo>
            <Campo rotulo="Posição" col="col-4"><input className="form-control form-control-sm" value={loc.posicao} disabled={!editar} onChange={(e) => setLoc({ ...loc, posicao: e.target.value })} /></Campo>
            <Campo rotulo="Estado da pasta" col="col-12"><Escolha valor={loc.estado} aoMudar={(v) => setLoc({ ...loc, estado: v })} opcoes={ref.estadosProcesso} vazio={null} disabled={!editar} /></Campo>
            <Campo rotulo="Observações" col="col-12"><input className="form-control form-control-sm" value={loc.observacoes} disabled={!editar} onChange={(e) => setLoc({ ...loc, observacoes: e.target.value })} /></Campo>
          </div>
          {editar && <button type="button" className="btn btn-sm btn-theme" onClick={guardar}>{p.processo ? 'Guardar' : 'Abrir processo (n.º automático)'}</button>}
        </Bloco>
        {p.processo?.estante && <OndeEsta p={p} />}
        <Bloco titulo={falta.length ? `Por actualizar (${falta.length})` : 'Processo actualizado'} icone={falta.length ? 'fa-exclamation-triangle' : 'fa-check-circle'}>
          {falta.length ? <ul className="small mb-0 text-danger">{falta.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="small text-success mb-0">Tem todos os dados e documentos essenciais.</p>}
        </Bloco>
      </div>
      <div className="col-xl-8">
        <Bloco titulo={`Documentos digitalizados (${p.documentos.length})`} icone="fa-file-alt">
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
        </Bloco>
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
    <Bloco titulo={`Onde está a pasta: estante ${p.processo.estante}`} icone="fa-archive">
      {!dados ? <Carregando /> : <Estante processos={daEstante} pesquisa={p.processo.numero} aoAbrir={(x) => navegar(`/pessoas/${x.id}?aba=processo`)} minimoPosicoes={Number(p.processo.posicao) || 10} />}
    </Bloco>
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

// documentos já emitidos desta pessoa (declarações numeradas, guias, fichas): quem e quando
function DocumentosEmitidos({ pessoaId }) {
  const { dados } = useDados(`/pessoas/${pessoaId}/documentos-emitidos`)
  if (!dados) return <Carregando />
  return (
    <Bloco titulo="Documentos emitidos" icone="fa-file-alt">
      {dados.length === 0 ? <p className="text-muted mb-0">Ainda não foi emitido nenhum documento. Use o botão «Documentos», em cima.</p> : (
        <table className="table table-sm mb-0">
          <thead><tr><th>Documento</th><th>N.º</th><th>Opções</th><th>Emitido por</th><th>Data</th></tr></thead>
          <tbody>{dados.map((d) => (
            <tr key={d.id}>
              <td>{d.nome}</td>
              <td>{d.numero ? `${String(d.numero).padStart(3, '0')}/${String(d.ano).slice(-2)}` : '—'}</td>
              <td className="small text-muted">{Object.entries(d.dados ?? {}).filter(([, v]) => v !== '' && v !== null).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td>
              <td className="small">{d.emitidoPor}</td>
              <td className="small">{new Date(d.criadoEm).toLocaleString('pt-PT')}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Bloco>
  )
}
