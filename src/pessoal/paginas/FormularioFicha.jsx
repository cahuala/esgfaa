import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, urlFoto } from '../api'
import { reduzirFoto } from '../fotos'
import Carregar from '../componentes/Carregar'
import Familiares from '../componentes/Familiares'
import { useSessao } from '../sessao'
import { useArvore } from '../arvore'
import { Cabecalho, Campo, Carregando, Escolha, EscolhaCategoriaDocente, NaoEncontrado } from '../componentes/Ui'
import { EscolhaSituacao } from '../componentes/Situacao'
import { BANCOS } from '../bancos'

const VAZIA = {
  tipo: 'militar', vinculo: 'funcionario', nome: '', nomeGuerra: '', nip: '', numeroAgente: '', bi: '', dataNascimento: '', genero: '', estadoCivil: '', naturalidade: '', provincia: '', nacionalidade: 'Angolana', pai: '', mae: '',
  email: '', telefone: '', morada: '', habilitacao: '', areaFormacao: '', unidadeId: '', cargoId: '', dataCargo: '',
  ramo: 'EXE', posto: '', fps: 'QP', quadroEspecial: '', especialidade: '', situacao: 'activo', efectividade: 'comissao_normal', estado: '', dataIngresso: '', dataIngressoQP: '', dataAntiguidadePosto: '', dataSituacao: '',
  avaliacaoFavoravel: true, aptidaoFisica: true, processoPendente: false,
  carreiraCivil: '', categoriaCivil: '', vinculoCivil: '', dataAdmissao: '', dataCategoria: '', ativo: true, observacoes: '', militarAlocadoId: '',
  municipio: '', bairro: '', rua: '', casa: '', caixaPostal: '', telefoneAlternativo: '', emailPessoal: '', biEmitidoEm: '', biValidade: '', biLocalEmissao: '', grupoSanguineo: '',
  conjuge: '', conjugeLocalServico: '', agregado: [], vencimento: '', inss: '', banco: '', iban: '', numeroConta: '', localIncorporacao: '', voluntario: '', tipoDocente: '', categoriaDocente: '', funcaoActual: '', unidadeOrigem: '', paisNascimento: 'Angola',
  outrosVinculos: [], dataEntradaEscola: '', dataSaidaEscola: '', motivoSaida: '', destinoSaida: '',
}
const CAMPOS = Object.keys(VAZIA)
// os passos do registo (como no SIGP); o segundo chama-se «Profissional» nos civis
const PASSOS = [['identificacao', 'Identificação', 'fa-id-card'], ['servico', 'Militar', 'fa-shield-alt'], ['pessoal', 'Dados pessoais', 'fa-user'], ['familia', 'Família e banco', 'fa-users'], ['escola', 'Na Escola', 'fa-building'], ['revisao', 'Revisão', 'fa-check-circle']]

// campo da revisão
const R = ({ r, v }) => <div className="pes-campo"><div className="pes-campo-r">{r}</div><div className={`pes-campo-v ${v ? '' : 'pes-campo-vazio'}`}>{v || '—'}</div></div>

// secção do formulário (cabeçalho com o ícone num círculo, como no SIGP)
const Seccao = ({ titulo, icone, children }) => (
  <div className="pes-fsec">
    <div className="pes-fsec-t"><span className="pes-fsec-i"><i className={`fa ${icone}`} /></span>{titulo}</div>
    <div className="pes-fsec-c">{children}</div>
  </div>
)

export default function FormularioFicha() {
  const { id } = useParams()
  const { ref, avisar } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  // vindo de «Registar empregada(o) domiciliar» (perfil do oficial ou lista de domiciliares)
  const [d, setD] = useState(id ? null : params.get('domiciliar') ? { ...VAZIA, tipo: 'civil', vinculo: 'domiciliar', militarAlocadoId: params.get('domiciliar') } : VAZIA)
  const [oficiais, setOficiais] = useState([])
  const [aConsultar, setAConsultar] = useState(false)
  const [difBi, setDifBi] = useState(null) // { bi, dados, diferencas: [{ campo, rotulo, ficha, bi }] }
  const [biVisto, setBiVisto] = useState('')
  // fotografia: escolhida aqui e enviada ao guardar (na ficha nova, depois de criada)
  const [foto, setFoto] = useState(null)
  const [fotoAtual, setFotoAtual] = useState(null)
  const previa = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])
  useEffect(() => {
    if (!id) return undefined
    let url = null
    urlFoto(id).then((u) => { url = u; setFotoAtual(u) })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [id])
  const arvore = useArvore()
  const [cargos, setCargos] = useState([])
  const [erro, setErro] = useState(null)
  const [aGuardar, setAGuardar] = useState(false)
  const [passo, setPasso] = useState(0)

  useEffect(() => { if (d?.vinculo === 'domiciliar' && !oficiais.length) api('/domiciliares').then(setOficiais).catch(() => {}) }, [d?.vinculo, oficiais.length])
  useEffect(() => {
    api('/cargos').then(setCargos).catch(() => {})
    if (id) api(`/pessoas/${id}`).then((p) => setD(Object.fromEntries(CAMPOS.map((k) => [k, p[k] ?? (typeof VAZIA[k] === 'boolean' ? VAZIA[k] : '')]))))
      .catch((e) => setErro({ texto: e.message, naoExiste: e.estado === 404 }))
  }, [id])
  if (!d && erro?.naoExiste) return <NaoEncontrado titulo="Ficha não encontrada" texto={`Não há nenhuma ficha com o número ${id} para editar. Pode ter sido apagada, ou o endereço está errado.`} />
  if (!d) return erro ? <div className="alert alert-danger">{erro.texto}</div> : <Carregando />

  const militar = d.tipo === 'militar'
  // estudantes e docentes podem vir de fora da ESG (outra unidade das FAA, ou civis sem unidade)
  const deFora = ['docente', 'estudante'].some((v) => d.vinculo === v || (d.outrosVinculos ?? []).includes(v))
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const txt = (k, extra = {}) => <input className={`form-control form-control-sm ${erro?.campo === k ? 'is-invalid' : ''}`} value={d[k] ?? ''} onChange={set(k)} {...extra} />
  const data = (k) => txt(k, { type: 'date' })
  const postos = ref.postos[d.ramo] ?? []
  const quadros = ref.quadros[d.ramo] ?? []
  const categoriasCivis = ref.carreirasCivis[d.carreiraCivil]?.categorias ?? []

  /*
    Verificação do BI (como no SIGP): ao escrever o BI, consulta logo a base de dados do Estado. O que está
    vazio na ficha preenche-se; o que já está escrito e não bate certo (nome, pai, mãe, nascimento, género)
    mostra-se ao lado, para escolher. Compara sem acentos nem maiúsculas.
  */
  const simples = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  const CAMPOS_BI = [['nome', 'Nome'], ['pai', 'Pai'], ['mae', 'Mãe'], ['dataNascimento', 'Data de nascimento'], ['genero', 'Género']]
  async function consultarBi(automatico = false) {
    const numero = String(d.bi ?? '').trim().toUpperCase().replace(/\s/g, '')
    if (automatico && (!/^[0-9]{9}[A-Z]{2}[0-9]{3}$/.test(numero) || numero === biVisto)) return
    setBiVisto(numero)
    setAConsultar(true)
    setErro(null)
    try {
      const b = await api(`/bi/${encodeURIComponent(numero)}`)
      const naFicha = (k) => (k === 'dataNascimento' ? String(d[k] ?? '').slice(0, 10) : d[k])
      const diferencas = CAMPOS_BI.filter(([k]) => b[k] && naFicha(k) && simples(naFicha(k)) !== simples(b[k])).map(([campo, rotulo]) => ({ campo, rotulo, ficha: naFicha(campo), bi: b[campo] }))
      // só preenche o que está vazio; o que já está escrito fica, e as diferenças mostram-se
      setD((x) => ({ ...x, bi: numero, ...Object.fromEntries(Object.entries(b).filter(([k, v]) => v && !x[k])) }))
      setDifBi(diferencas.length ? { bi: numero, dados: b, diferencas } : null)
      avisar(diferencas.length ? `O BI tem ${diferencas.length} dado(s) diferente(s) da ficha: veja ao lado do BI.` : 'BI verificado na base de dados do Estado: os dados conferem.')
    } catch (x) {
      setDifBi(null)
      setErro({ texto: x.message, campo: 'bi' })
    } finally {
      setAConsultar(false)
    }
  }
  const usarDoBi = (campos) => { setD((x) => ({ ...x, ...Object.fromEntries(campos.map((k) => [k, difBi.dados[k]])) })); setDifBi((v) => { const r = v.diferencas.filter((z) => !campos.includes(z.campo)); return r.length ? { ...v, diferencas: r } : null }) }

  // o que falta em cada passo (o navegador não valida os passos escondidos)
  function emFalta(i) {
    if (i === 0 && d.nome.trim().length < 5) return { texto: 'Escreva o nome completo (pelo menos 5 letras).', campo: 'nome' }
    if (i === 0 && militar && !d.nip.trim()) return { texto: 'O NIP é obrigatório para os militares.', campo: 'nip' }
    if (i === 0 && d.vinculo === 'domiciliar' && !d.militarAlocadoId) return { texto: 'Escolha o oficial a que a(o) domiciliar fica afecta(o).', campo: 'militarAlocadoId' }
    if (i === 1 && militar && !d.posto) return { texto: 'Escolha o posto.', campo: 'posto' }
    return null
  }
  function irPara(i) {
    for (let k = 0; k < Math.min(i, PASSOS.length - 1); k++) {
      const f = emFalta(k)
      if (f) { setErro(f); setPasso(k); return }
    }
    setErro(null)
    setPasso(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardar(e) {
    e.preventDefault()
    if (passo < PASSOS.length - 1) { irPara(passo + 1); return }
    for (let k = 0; k < PASSOS.length - 1; k++) { const f = emFalta(k); if (f) { setErro(f); setPasso(k); return } }
    setErro(null)
    setAGuardar(true)
    const corpo = { ...d, unidadeId: d.unidadeId ? Number(d.unidadeId) : null, cargoId: d.cargoId ? Number(d.cargoId) : null }
    corpo.militarAlocadoId = corpo.vinculo === 'domiciliar' && corpo.militarAlocadoId ? Number(corpo.militarAlocadoId) : null
    for (const k of ['nip', 'numeroAgente', 'bi', 'email', 'genero', 'estadoCivil', 'habilitacao', 'quadroEspecial', 'carreiraCivil', 'categoriaCivil', 'vinculoCivil', 'posto', 'voluntario']) if (corpo[k] === '') corpo[k] = null
    corpo.agregado = (corpo.agregado ?? []).filter((a) => a.nome?.trim()).map((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '')))
    if (!militar) for (const k of ['ramo', 'posto', 'fps', 'quadroEspecial', 'situacao', 'efectividade', 'estado', 'localIncorporacao', 'voluntario', 'dataIngresso', 'dataIngressoQP', 'dataAntiguidadePosto', 'dataSituacao']) delete corpo[k]
    if (id) delete corpo.cargoId // o cargo muda por nomeação/exoneração
    try {
      const r = await api(id ? `/pessoas/${id}` : '/pessoas', { metodo: id ? 'PUT' : 'POST', corpo })
      if (foto) {
        const fd = new FormData()
        fd.append('foto', await reduzirFoto(foto))
        await api(`/pessoas/${r.id}/foto`, { metodo: 'PUT', formulario: fd }).catch((x) => avisar(`Ficha guardada, mas a fotografia não: ${x.message}`, 'erro'))
      }
      avisar(id ? 'Ficha guardada.' : 'Ficha criada.')
      navegar(`/pessoas/${r.id}`)
    } catch (x) {
      setErro({ texto: x.message, campo: x.campo })
      setAGuardar(false)
      const ondeEsta = { nome: 0, nip: 0, numeroAgente: 0, bi: 0, email: 0, posto: 1 }[x.campo]
      if (ondeEsta !== undefined) setPasso(ondeEsta)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const nomes = (o, k) => (o && k ? (typeof o[k] === 'string' ? o[k] : o[k]?.nome ?? k) : '')
  const passos = PASSOS.map(([k, t, ic]) => (k === 'servico' && !militar ? [k, 'Profissional', 'fa-briefcase'] : [k, t, ic]))
  const atual = passos[passo][0]

  return (
    <form onSubmit={guardar} noValidate>
      <Cabecalho titulo={<><i className="fa fa-user-plus me-2 pes-ouro" />{id ? 'Editar ficha' : militar ? 'Registar militar' : 'Registar funcionário civil'}</>} subtitulo={`preencha os dados em ${PASSOS.length} passos · os campos com * são obrigatórios`} migalhas={[['Pessoal', '/pessoas'], [id ? d.nome : 'Nova ficha']]}>
        <button type="button" className="btn btn-white" onClick={() => navegar(-1)}><i className="fa fa-arrow-left me-1" />Cancelar</button>
        {id && <button type="button" className="btn btn-theme" disabled={aGuardar} onClick={() => { setPasso(PASSOS.length - 1); setTimeout(() => document.getElementById('pes-guardar')?.click(), 0) }}><i className="fa fa-save me-1" />Guardar já</button>}
      </Cabecalho>

      <div className="pes-passos" role="tablist">
        {passos.map(([k, t, ic], i) => (
          <div key={k} className="pes-passo-g">
            {i > 0 && <span className={`pes-passo-linha ${i <= passo ? 'feito' : ''}`} />}
            <button type="button" role="tab" aria-selected={i === passo} className={`pes-passo ${i === passo ? 'activo' : i < passo ? 'feito' : ''}`} onClick={() => irPara(i)}>
              <span className="pes-passo-n">{i < passo ? <i className="fa fa-check" /> : i + 1}</span>
              <span className="pes-passo-t"><i className={`fa ${ic} me-1 d-none d-xl-inline`} />{t}</span>
            </button>
          </div>
        ))}
      </div>
      {erro && <div className="alert alert-danger"><i className="fa fa-exclamation-circle me-2" />{erro.texto}</div>}

      {atual === 'identificacao' && (
        <Seccao titulo={militar ? 'Identificação militar' : 'Identificação'} icone="fa-id-card">
          <div className="row">
            <div className="col-lg-2 col-md-3 mb-3 text-center">
              <div className="pes-ficha-foto mb-2">{previa || fotoAtual ? <img src={previa || fotoAtual} alt="Fotografia" /> : <i className="fa fa-user fa-4x text-muted" />}</div>
              <Carregar aceitar="image/jpeg,image/png,image/webp" maxMb={30} compacto icone="fa-camera" titulo={previa || fotoAtual ? 'Mudar fotografia' : 'Fotografia'} ajuda="JPG, PNG ou WEBP · tipo passe" ficheiros={foto ? [foto] : []} aoMudar={(l) => setFoto(l[0] ?? null)} />
            </div>
            <div className="col-lg-10 col-md-9">
              <div className="row">
                <Campo rotulo="Tipo" obrigatorio col="col-md-3">
                  <div className="btn-group w-100" role="group">
                    {Object.entries(ref.tipos).map(([k, v]) => <button key={k} type="button" className={`btn btn-sm ${d.tipo === k ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => set('tipo')(k)} disabled={Boolean(id)}>{v}</button>)}
                  </div>
                </Campo>
                <Campo rotulo="Função principal na Escola" obrigatorio col="col-md-3" ajuda="Docentes e estudantes (também os que o são além da função principal) com e-mail recebem conta no Portal Académico."><Escolha valor={d.vinculo} aoMudar={set('vinculo')} opcoes={Object.fromEntries(Object.entries(ref.vinculos).filter(([k]) => k !== 'domiciliar' || d.tipo === 'civil'))} vazio={null} /></Campo>
                {d.vinculo !== 'domiciliar' && (
                  <Campo rotulo="Também é" col="col-md-6" ajuda="Na Escola pode ter mais de uma função: o funcionário que também é professor, ou também é aluno de um curso.">
                    <div className="d-flex flex-wrap gap-3 pt-1">
                      {[['funcionario', 'Funcionário'], ['docente', 'Docente (professor)'], ['estudante', 'Aluno (discente)']].filter(([k]) => k !== d.vinculo).map(([k, t]) => (
                        <label key={k} className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={(d.outrosVinculos ?? []).includes(k)} onChange={(e) => setD({ ...d, outrosVinculos: e.target.checked ? [...(d.outrosVinculos ?? []), k] : (d.outrosVinculos ?? []).filter((x) => x !== k) })} /> <span className="form-check-label">{t}</span></label>
                      ))}
                    </div>
                  </Campo>
                )}
                {d.vinculo === 'domiciliar' && <Campo rotulo="Afecta(o) ao oficial" obrigatorio col="col-md-6" ajuda="Só oficiais superiores e generais, dentro do limite do posto. Não conta como trabalhador civil."><Escolha valor={String(d.militarAlocadoId ?? '')} aoMudar={set('militarAlocadoId')} opcoes={oficiais.filter((o) => o.livres > 0 || String(o.id) === String(d.militarAlocadoId)).map((o) => [String(o.id), `${o.postoNome} ${o.nome} (${o.alocados}/${o.limite})`])} vazio="Escolha o oficial" /></Campo>}
                <Campo rotulo="Nome completo" obrigatorio col="col-md-6">{txt('nome', { required: true, minLength: 5 })}</Campo>
                {militar && <Campo rotulo="NIP" obrigatorio col="col-md-3">{txt('nip', { required: true })}</Campo>}
                {!militar && <Campo rotulo="N.º de agente" col="col-md-3">{txt('numeroAgente')}</Campo>}
                <Campo rotulo="Bilhete de identidade" col="col-md-3" ajuda="Ao sair do campo, o BI verifica-se na base de dados do Estado.">
                  <div className="input-group input-group-sm">
                    {txt('bi', { placeholder: '001234567LA041', onBlur: () => consultarBi(true) })}
                    <button type="button" className="btn btn-outline-theme" disabled={aConsultar || !d.bi} onClick={() => consultarBi()} title="Verificar o BI"><i className={`fa ${aConsultar ? 'fa-spinner fa-spin' : 'fa-search'}`} /></button>
                  </div>
                </Campo>
                {difBi && (
                  <div className="col-12">
                    <div className="alert alert-warning py-2 small mb-2">
                      <div className="d-flex align-items-center mb-1"><strong className="me-auto"><i className="fa fa-id-card me-1" />O BI {difBi.bi} não bate certo com a ficha</strong><button type="button" className="btn btn-xs btn-warning" onClick={() => usarDoBi(difBi.diferencas.map((x) => x.campo))}>Usar tudo do BI</button></div>
                      {difBi.diferencas.map((x) => (
                        <div key={x.campo} className="d-flex flex-wrap align-items-center gap-2">
                          <span className="fw-semibold" style={{ minWidth: 130 }}>{x.rotulo}</span>
                          <span>ficha: «{x.ficha}»</span><span className="text-muted">·</span><span>BI: «{x.bi}»</span>
                          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => usarDoBi([x.campo])}>usar o do BI</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {militar && <Campo rotulo="Nome de guerra" col="col-md-3">{txt('nomeGuerra')}</Campo>}
                <Campo rotulo="E-mail institucional" col="col-md-3">{txt('email', { type: 'email', placeholder: 'nome@esgfaa.gov.ao' })}</Campo>
              </div>
            </div>
          </div>
        </Seccao>
      )}

      {atual === 'servico' && militar && (
        <Seccao titulo="Dados militares (Lei n.º 13/18)" icone="fa-shield-alt">
          <div className="row">
            <Campo rotulo="Ramo" obrigatorio col="col-md-3"><Escolha valor={d.ramo} aoMudar={(v) => setD({ ...d, ramo: v, quadroEspecial: '' })} opcoes={Object.fromEntries(Object.entries(ref.ramos).map(([k, v]) => [k, v.nome]))} vazio={null} /></Campo>
            <Campo rotulo="Posto" obrigatorio col="col-md-3" ajuda="Nomes do ramo; os postos equivalem-se entre ramos."><Escolha valor={d.posto} aoMudar={set('posto')} opcoes={postos.map((p) => [p.id, `${p.nome} — ${ref.categorias[p.categoria].nome}`])} required /></Campo>
            <Campo rotulo="Forma de prestação de serviço" obrigatorio col="col-md-3"><Escolha valor={d.fps} aoMudar={set('fps')} opcoes={ref.formasServico} vazio={null} /></Campo>
            <Campo rotulo="Quadro especial" col="col-md-3" ajuda="Arma, serviço ou classe (arts. 84.º–95.º)."><Escolha valor={d.quadroEspecial} aoMudar={set('quadroEspecial')} opcoes={quadros.map((q) => [q.sigla, `${q.sigla} — ${q.nome}${q.comum ? ' (comum)' : ''}`])} /></Campo>
            <Campo rotulo="Especialidade" col="col-md-3">{txt('especialidade')}</Campo>
            <Campo rotulo="Situação (Lei n.º 13/18)" col="col-md-6" ajuda="Activo em efectividade ou fora de efectividade de serviço (art. 11.º), reserva ou reforma."><EscolhaSituacao arvore={ref.arvoreSituacoes} situacao={d.situacao} efectividade={d.efectividade} aoMudar={(x) => setD({ ...d, ...x })} aria-label="Situação" /></Campo>
            <Campo rotulo="Estado" col="col-md-3" ajuda="Estado operacional; muda a qualquer momento."><Escolha valor={d.estado} aoMudar={set('estado')} opcoes={ref.estados} vazio="Ao serviço" /></Campo>
            <Campo rotulo="Na situação desde" col="col-md-3">{data('dataSituacao')}</Campo>
            <Campo rotulo="Ingresso nas FAA" col="col-md-3">{data('dataIngresso')}</Campo>
            <Campo rotulo="Ingresso no Quadro Permanente" col="col-md-3">{data('dataIngressoQP')}</Campo>
            <Campo rotulo="Antiguidade no posto" col="col-md-3" ajuda="Data no documento de promoção (art. 29.º).">{data('dataAntiguidadePosto')}</Campo>
            <Campo rotulo="Local de incorporação" col="col-md-3">{txt('localIncorporacao')}</Campo>
            <Campo rotulo="Condição de incorporação" col="col-md-3"><Escolha valor={d.voluntario === true ? 'sim' : d.voluntario === false ? 'nao' : ''} aoMudar={(v) => setD({ ...d, voluntario: v === 'sim' ? true : v === 'nao' ? false : '' })} opcoes={[['sim', 'Voluntário'], ['nao', 'Não voluntário']]} /></Campo>
          </div>
        </Seccao>
      )}

      {atual === 'servico' && !militar && (
        <Seccao titulo="Situação profissional" icone="fa-briefcase">
          <div className="row">
            <Campo rotulo="Categoria" col="col-md-3" ajuda={ref.carreirasCivis[d.carreiraCivil]?.descricao}><Escolha valor={d.carreiraCivil} aoMudar={(v) => setD({ ...d, carreiraCivil: v, categoriaCivil: ref.carreirasCivis[v]?.categorias[0] ?? '' })} opcoes={Object.entries(ref.carreirasCivis).filter(([, v]) => !v.domiciliar || d.vinculo === 'domiciliar').sort(([, a], [, b]) => a.nivel - b.nivel).map(([k, v]) => [k, `${v.nivel}. ${v.nome}`])} /></Campo>
            <Campo rotulo="Classe" col="col-md-3"><Escolha valor={d.categoriaCivil} aoMudar={set('categoriaCivil')} opcoes={categoriasCivis} /></Campo>
            <Campo rotulo="Vínculo" col="col-md-3"><Escolha valor={d.vinculoCivil} aoMudar={set('vinculoCivil')} opcoes={ref.vinculosCivis} /></Campo>
            <Campo rotulo="Admissão" col="col-md-3">{data('dataAdmissao')}</Campo>
            <Campo rotulo="Na classe desde" col="col-md-3">{data('dataCategoria')}</Campo>
            <Campo rotulo="N.º de segurança social (INSS)" col="col-md-3">{txt('inss')}</Campo>
          </div>
        </Seccao>
      )}
      {atual === 'servico' && (d.vinculo === 'docente' || (d.outrosVinculos ?? []).includes('docente')) && (
        <Seccao titulo="Docente" icone="fa-chalkboard-teacher">
          <div className="row">
            <Campo rotulo="Tipo de docente" col="col-md-3"><Escolha valor={d.tipoDocente} aoMudar={set('tipoDocente')} opcoes={ref.tiposDocente} /></Campo>
            <Campo rotulo="Categoria do docente" col="col-md-4"><EscolhaCategoriaDocente valor={d.categoriaDocente} aoMudar={set('categoriaDocente')} referencias={ref} /></Campo>
            <Campo rotulo="Função ou cargo actual" col="col-md-5" ajuda="Onde serve, como na ficha de cadastramento (o colaborador serve fora da Escola): ex.: Chefe do Departamento de Ensino da Força Aérea.">{txt('funcaoActual')}</Campo>
          </div>
        </Seccao>
      )}

      {atual === 'pessoal' && <>
        <Seccao titulo="Dados pessoais" icone="fa-user">
          <div className="row">
            <Campo rotulo="Data de nascimento" col="col-md-3">{data('dataNascimento')}</Campo>
            <Campo rotulo="Género" col="col-md-3"><Escolha valor={d.genero} aoMudar={set('genero')} opcoes={ref.generos} /></Campo>
            <Campo rotulo="Estado civil" col="col-md-3"><Escolha valor={d.estadoCivil} aoMudar={set('estadoCivil')} opcoes={ref.estadosCivis} /></Campo>
            <Campo rotulo="Grupo sanguíneo" col="col-md-3"><Escolha valor={d.grupoSanguineo} aoMudar={set('grupoSanguineo')} opcoes={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} /></Campo>
            <Campo rotulo="Nacionalidade" col="col-md-3">{txt('nacionalidade')}</Campo>
            <Campo rotulo="País de nascimento" col="col-md-3">{txt('paisNascimento')}</Campo>
            <Campo rotulo="Naturalidade (município)" col="col-md-3">{txt('naturalidade')}</Campo>
            <Campo rotulo="Província" col="col-md-3"><Escolha valor={d.provincia} aoMudar={set('provincia')} opcoes={ref.provincias} /></Campo>
            <Campo rotulo="Habilitações literárias" col="col-md-3"><Escolha valor={d.habilitacao} aoMudar={set('habilitacao')} opcoes={ref.habilitacoes} /></Campo>
            <Campo rotulo="Nome do pai" col="col-md-6">{txt('pai')}</Campo>
            <Campo rotulo="Nome da mãe" col="col-md-6">{txt('mae')}</Campo>
            <Campo rotulo="Área de formação" col="col-12">{txt('areaFormacao')}</Campo>
          </div>
        </Seccao>
        <Seccao titulo="Bilhete de identidade" icone="fa-id-badge">
          <div className="row">
            <Campo rotulo="BI emitido em (local)" col="col-md-4">{txt('biLocalEmissao')}</Campo>
            <Campo rotulo="Data de emissão do BI" col="col-md-4">{data('biEmitidoEm')}</Campo>
            <Campo rotulo="Validade do BI" col="col-md-4">{data('biValidade')}</Campo>
          </div>
        </Seccao>
        <Seccao titulo="Contactos e residência" icone="fa-map-marker-alt">
          <div className="row">
            <Campo rotulo="Telefone" col="col-md-3">{txt('telefone')}</Campo>
            <Campo rotulo="Telefone alternativo" col="col-md-3">{txt('telefoneAlternativo')}</Campo>
            <Campo rotulo="E-mail pessoal" col="col-md-6">{txt('emailPessoal', { type: 'email' })}</Campo>
            <Campo rotulo="Morada (localidade)" col="col-md-3">{txt('morada')}</Campo>
            <Campo rotulo="Município" col="col-md-3">{txt('municipio')}</Campo>
            <Campo rotulo="Bairro" col="col-md-3">{txt('bairro')}</Campo>
            <Campo rotulo="Rua" col="col-md-4">{txt('rua')}</Campo>
            <Campo rotulo="Casa n.º" col="col-md-2">{txt('casa')}</Campo>
            <Campo rotulo="Caixa postal" col="col-md-3">{txt('caixaPostal')}</Campo>
          </div>
        </Seccao>
      </>}

      {atual === 'familia' && <>
        <Seccao titulo="Cônjuge" icone="fa-ring">
          <div className="row">
            <Campo rotulo="Nome do cônjuge" col="col-md-6">{txt('conjuge')}</Campo>
            <Campo rotulo="Local de serviço do cônjuge" col="col-md-6">{txt('conjugeLocalServico')}</Campo>
          </div>
        </Seccao>
        <Familiares lista={d.agregado ?? []} aoMudar={(agregado) => setD({ ...d, agregado })} />
        <Seccao titulo="Dados bancários e vencimento" icone="fa-university">
          <div className="row">
            <Campo rotulo="Banco" col="col-md-3">{txt('banco', { list: 'bancos-angola', placeholder: 'BAI, BPC, BFA…' })}<datalist id="bancos-angola">{Object.entries(BANCOS).map(([k, b]) => <option key={k} value={k}>{b.nome}</option>)}</datalist></Campo>
            <Campo rotulo="IBAN" col="col-md-5" ajuda="Fica cifrado.">{txt('iban')}</Campo>
            <Campo rotulo="Número de conta" col="col-md-4" ajuda="Fica cifrado.">{txt('numeroConta')}</Campo>
            <Campo rotulo="Vencimento mensal (Kz)" col="col-md-4" ajuda={militar ? 'Vazio = as declarações usam a tabela salarial do posto. Fica cifrado.' : 'Vazio = as declarações usam a tabela salarial dos civis. Fica cifrado.'}>{txt('vencimento', { type: 'number', step: '0.01', min: 0 })}</Campo>
            {!militar && <Campo rotulo="N.º de segurança social (INSS)" col="col-md-4">{txt('inss')}</Campo>}
          </div>
        </Seccao>
      </>}

      {atual === 'escola' && (
        <Seccao titulo="Na Escola" icone="fa-building">
          <div className="row">
            <Campo rotulo="Unidade (orgânica)" col="col-md-4" ajuda={deFora ? 'Quem não é da ESG fica «Sem unidade».' : undefined}><Escolha valor={d.unidadeId} aoMudar={set('unidadeId')} opcoes={arvore.opcoes} vazio="Sem unidade" /></Campo>
            {deFora && militar && <Campo rotulo="Unidade de origem (fora da ESG)" col="col-md-8" ajuda="O estudante ou o docente colaborador militar que vem de outra unidade das FAA: ex.: Regimento de Infantaria n.º 10, Base Aérea do Lubango. Os civis não têm unidade.">{txt('unidadeOrigem')}</Campo>}
            {!id && <Campo rotulo="Cargo atual" col="col-md-4" ajuda="Só no registo; depois, o cargo muda por proposta de nomeação."><Escolha valor={d.cargoId} aoMudar={set('cargoId')} opcoes={cargos.filter((c) => !d.unidadeId || arvore.descendentes(Number(d.unidadeId)).has(c.unidadeId)).map((c) => [c.id, `${c.nome} — ${c.unidadeCaminho || 'sem unidade'} (${c.ocupados}/${c.vagas})`])} vazio="Sem cargo" /></Campo>}
            {!id && <Campo rotulo="No cargo desde" col="col-md-4">{data('dataCargo')}</Campo>}
            <Campo rotulo="Na Escola desde" col="col-md-4" ajuda="Data de apresentação na ESG (para o histórico dos efectivos).">{data('dataEntradaEscola')}</Campo>
            <div className="col-12 d-flex flex-wrap gap-4 my-2">
              <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.avaliacaoFavoravel} onChange={set('avaliacaoFavoravel')} /> <span className="form-check-label">Avaliação favorável</span></label>
              {militar && <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.aptidaoFisica} onChange={set('aptidaoFisica')} /> <span className="form-check-label">Apto física e psiquicamente</span></label>}
              <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.processoPendente} onChange={set('processoPendente')} /> <span className="form-check-label">Processo disciplinar ou criminal pendente</span></label>
              {id && <label className="form-check"><input type="checkbox" className="form-check-input" checked={!d.ativo} onChange={(e) => set('ativo')(!e.target.checked)} /> <span className="form-check-label text-danger">Já não serve na Escola</span></label>}
            </div>
            {id && !d.ativo && <>
              <Campo rotulo="Saiu da Escola em" col="col-md-3" ajuda="Vazio = hoje.">{data('dataSaidaEscola')}</Campo>
              <Campo rotulo="Motivo da saída" col="col-md-5" ajuda="Conta nos mapas de ausências (transferidos, mortos, condenados).">
                {(() => {
                  const lista = ref.motivosSaida ?? []
                  const outro = d.motivoSaida && !lista.includes(d.motivoSaida)
                  return <>
                    <select className="form-select form-select-sm" value={outro ? '__outro' : d.motivoSaida ?? ''} onChange={(e) => set('motivoSaida')(e.target.value === '__outro' ? ' ' : e.target.value)} aria-label="Motivo da saída">
                      <option value="">—</option>{lista.map((x) => <option key={x}>{x}</option>)}<option value="__outro">Outro (escrever)</option>
                    </select>
                    {outro && <input className="form-control form-control-sm mt-1" placeholder="Qual?" value={d.motivoSaida.trimStart()} onChange={(e) => set('motivoSaida')(e.target.value || ' ')} />}
                  </>
                })()}
              </Campo>
              <Campo rotulo="Destino" col="col-md-4" ajuda="Para onde foi (unidade, órgão…).">{txt('destinoSaida')}</Campo>
            </>}
            <Campo rotulo="Observações" col="col-12"><textarea className="form-control form-control-sm" rows={3} value={d.observacoes} onChange={set('observacoes')} /></Campo>
          </div>
        </Seccao>
      )}

      {atual === 'revisao' && (
        <Seccao titulo="Revisão e confirmação" icone="fa-check-circle">
          <p className="text-muted small">Reveja os dados antes de {id ? 'guardar' : 'registar'}. Para corrigir, clique no passo lá em cima.</p>
          <div className="pes-grelha">
            <R r="Tipo" v={ref.tipos[d.tipo]} /><R r="Funções na Escola" v={[d.vinculo, ...(d.outrosVinculos ?? [])].map((k) => nomes(ref.vinculos, k)).join(' · ')} /><R r="Nome completo" v={d.nome} />
            {militar ? <><R r="NIP" v={d.nip} /><R r="Posto" v={postos.find((x) => x.id === d.posto)?.nome} /><R r="Ramo · FPS" v={`${ref.ramos[d.ramo]?.nome ?? ''} · ${d.fps}`} /></> : <><R r="N.º de agente" v={d.numeroAgente} /><R r="Categoria" v={ref.carreirasCivis[d.carreiraCivil]?.nome} /><R r="Classe" v={d.categoriaCivil} /></>}
            <R r="Bilhete de identidade" v={d.bi} /><R r="Data de nascimento" v={d.dataNascimento && new Date(d.dataNascimento).toLocaleDateString('pt-PT')} /><R r="Telefone" v={d.telefone} />
            <R r="Pai" v={d.pai} /><R r="Mãe" v={d.mae} /><R r="Cônjuge" v={d.conjuge} />
            <R r="Familiares" v={(d.agregado ?? []).filter((a) => a.nome?.trim()).length ? `${d.agregado.filter((a) => a.nome?.trim()).length}` : ''} /><R r="Banco · IBAN" v={[d.banco, d.iban].filter(Boolean).join(' · ')} />
            <R r="Unidade" v={arvore.lista.find((u) => String(u.id) === String(d.unidadeId))?.nome} />
            {d.unidadeOrigem && <R r="Unidade de origem" v={d.unidadeOrigem} />}
            {!id && <R r="Cargo" v={cargos.find((c) => String(c.id) === String(d.cargoId))?.nome} />}
            <R r="Fotografia" v={foto ? foto.name : fotoAtual ? 'A actual' : ''} />
          </div>
        </Seccao>
      )}

      <div className="pes-passos-nav">
        <button type="button" className="btn btn-white" disabled={passo === 0} onClick={() => irPara(passo - 1)}><i className="fa fa-arrow-left me-1" />Anterior</button>
        <span className="small text-muted">Passo {passo + 1} de {PASSOS.length}</span>
        {passo < PASSOS.length - 1
          ? <button type="button" className="btn btn-theme" onClick={() => irPara(passo + 1)}>Próximo<i className="fa fa-arrow-right ms-1" /></button>
          : <button id="pes-guardar" type="submit" className="btn btn-theme" disabled={aGuardar}><i className={`fa ${aGuardar ? 'fa-spinner fa-spin' : 'fa-save'} me-1`} />{id ? 'Guardar a ficha' : militar ? 'Registar o militar' : 'Registar o funcionário'}</button>}
      </div>
    </form>
  )
}
