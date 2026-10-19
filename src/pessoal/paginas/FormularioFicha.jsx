import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, urlFoto } from '../api'
import { reduzirFoto } from '../fotos'
import Carregar from '../componentes/Carregar'
import { useSessao } from '../sessao'
import { useArvore } from '../arvore'
import { Cabecalho, Campo, Carregando, Escolha, Painel } from '../componentes/Ui'
import { EscolhaSituacao } from '../componentes/Situacao'

const VAZIA = {
  tipo: 'militar', vinculo: 'funcionario', nome: '', nomeGuerra: '', nip: '', numeroAgente: '', bi: '', dataNascimento: '', genero: '', estadoCivil: '', naturalidade: '', provincia: '', nacionalidade: 'Angolana', pai: '', mae: '',
  email: '', telefone: '', morada: '', habilitacao: '', areaFormacao: '', unidadeId: '', cargoId: '', dataCargo: '',
  ramo: 'EXE', posto: '', fps: 'QP', quadroEspecial: '', especialidade: '', situacao: 'activo', efectividade: 'comissao_normal', estado: '', dataIngresso: '', dataIngressoQP: '', dataAntiguidadePosto: '', dataSituacao: '',
  avaliacaoFavoravel: true, aptidaoFisica: true, processoPendente: false,
  carreiraCivil: '', categoriaCivil: '', vinculoCivil: '', dataAdmissao: '', dataCategoria: '', ativo: true, observacoes: '', militarAlocadoId: '',
  municipio: '', bairro: '', rua: '', casa: '', caixaPostal: '', telefoneAlternativo: '', biEmitidoEm: '', biValidade: '', biLocalEmissao: '', grupoSanguineo: '',
  conjuge: '', conjugeLocalServico: '', agregado: [], vencimento: '', inss: '', banco: '', iban: '', numeroConta: '', localIncorporacao: '', voluntario: '', tipoDocente: '', categoriaDocente: '',
}
const CAMPOS = Object.keys(VAZIA)

export default function FormularioFicha() {
  const { id } = useParams()
  const { ref, avisar } = useSessao()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  // vindo de «Registar empregada(o) domiciliar» (perfil do oficial ou lista de domiciliares)
  const [d, setD] = useState(id ? null : params.get('domiciliar') ? { ...VAZIA, tipo: 'civil', vinculo: 'domiciliar', militarAlocadoId: params.get('domiciliar') } : VAZIA)
  const [oficiais, setOficiais] = useState([])
  const [aConsultar, setAConsultar] = useState(false)
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

  useEffect(() => { if (d?.vinculo === 'domiciliar' && !oficiais.length) api('/domiciliares').then(setOficiais).catch(() => {}) }, [d?.vinculo, oficiais.length])
  useEffect(() => {
    api('/cargos').then(setCargos).catch(() => {})
    if (id) api(`/pessoas/${id}`).then((p) => setD(Object.fromEntries(CAMPOS.map((k) => [k, p[k] ?? (typeof VAZIA[k] === 'boolean' ? VAZIA[k] : '')])))).catch((e) => setErro({ texto: e.message }))
  }, [id])
  if (!d) return erro ? <div className="alert alert-danger">{erro.texto}</div> : <Carregando />

  const militar = d.tipo === 'militar'
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const txt = (k, extra = {}) => <input className={`form-control form-control-sm ${erro?.campo === k ? 'is-invalid' : ''}`} value={d[k] ?? ''} onChange={set(k)} {...extra} />
  const data = (k) => txt(k, { type: 'date' })
  const postos = ref.postos[d.ramo] ?? []
  const quadros = ref.quadros[d.ramo] ?? []
  const categoriasCivis = ref.carreirasCivis[d.carreiraCivil]?.categorias ?? []

  async function consultarBi() {
    setAConsultar(true)
    setErro(null)
    try {
      const b = await api(`/bi/${encodeURIComponent(d.bi.trim())}`)
      // só preenche o que veio; o que já está escrito à mão fica se o BI não o trouxer
      setD((x) => ({ ...x, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v)) }))
      avisar('Dados do BI preenchidos. Confira antes de guardar.')
    } catch (x) {
      setErro({ texto: x.message, campo: 'bi' })
    } finally {
      setAConsultar(false)
    }
  }

  async function guardar(e) {
    e.preventDefault()
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
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <form onSubmit={guardar}>
      <Cabecalho titulo={id ? 'Editar ficha' : 'Nova ficha'} migalhas={[['Pessoal', '/pessoas'], [id ? d.nome : 'Nova ficha']]}>
        <button type="button" className="btn btn-outline-secondary" onClick={() => navegar(-1)}>Cancelar</button>
        <button type="submit" className="btn btn-theme" disabled={aGuardar}><i className="fa fa-save me-1" />Guardar</button>
      </Cabecalho>
      {erro && <div className="alert alert-danger"><i className="fa fa-exclamation-circle me-2" />{erro.texto}</div>}

      <Painel titulo="Identificação" icone="fa-id-card">
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
          <Campo rotulo="Vínculo à Escola" obrigatorio col="col-md-3" ajuda="Docentes e estudantes com e-mail recebem conta no Portal Académico."><Escolha valor={d.vinculo} aoMudar={set('vinculo')} opcoes={Object.fromEntries(Object.entries(ref.vinculos).filter(([k]) => k !== 'domiciliar' || d.tipo === 'civil'))} vazio={null} /></Campo>
          {d.vinculo === 'domiciliar' && <Campo rotulo="Afecta(o) ao oficial" obrigatorio col="col-md-6" ajuda="Só oficiais superiores e generais, dentro do limite do posto. Não conta como trabalhador civil."><Escolha valor={String(d.militarAlocadoId ?? '')} aoMudar={set('militarAlocadoId')} opcoes={oficiais.filter((o) => o.livres > 0 || String(o.id) === String(d.militarAlocadoId)).map((o) => [String(o.id), `${o.postoNome} ${o.nome} (${o.alocados}/${o.limite})`])} vazio="Escolha o oficial" /></Campo>}
          <Campo rotulo="Nome completo" obrigatorio col="col-md-6">{txt('nome', { required: true, minLength: 5 })}</Campo>
          {militar && <Campo rotulo="NIP" obrigatorio col="col-md-3">{txt('nip', { required: true })}</Campo>}
          {!militar && <Campo rotulo="N.º de agente" col="col-md-3">{txt('numeroAgente')}</Campo>}
          <Campo rotulo="Bilhete de identidade" col="col-md-3" ajuda="«Consultar» preenche os dados a partir da base de dados do Estado.">
            <div className="input-group input-group-sm">
              {txt('bi', { placeholder: '001234567LA041' })}
              <button type="button" className="btn btn-outline-theme" disabled={aConsultar || !d.bi} onClick={consultarBi} title="Consultar o BI"><i className={`fa ${aConsultar ? 'fa-spinner fa-spin' : 'fa-search'}`} /></button>
            </div>
          </Campo>
          {militar && <Campo rotulo="Nome de guerra" col="col-md-3">{txt('nomeGuerra')}</Campo>}
          <Campo rotulo="E-mail institucional" col="col-md-3">{txt('email', { type: 'email', placeholder: 'nome@esgfaa.gov.ao' })}</Campo>
        </div>
          </div>
        </div>
      </Painel>

      {militar && (
        <Painel titulo="Situação militar (Lei n.º 13/18)" icone="fa-shield-alt">
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
        </Painel>
      )}

      {!militar && (
        <Painel titulo="Situação profissional" icone="fa-briefcase">
          <div className="row">
            <Campo rotulo="Categoria" col="col-md-3" ajuda={ref.carreirasCivis[d.carreiraCivil]?.descricao}><Escolha valor={d.carreiraCivil} aoMudar={(v) => setD({ ...d, carreiraCivil: v, categoriaCivil: ref.carreirasCivis[v]?.categorias[0] ?? '' })} opcoes={Object.entries(ref.carreirasCivis).filter(([, v]) => !v.domiciliar || d.vinculo === 'domiciliar').sort(([, a], [, b]) => a.nivel - b.nivel).map(([k, v]) => [k, `${v.nivel}. ${v.nome}`])} /></Campo>
            <Campo rotulo="Classe" col="col-md-3"><Escolha valor={d.categoriaCivil} aoMudar={set('categoriaCivil')} opcoes={categoriasCivis} /></Campo>
            {ref.carreirasCivis[d.carreiraCivil]?.vencimentoBase && <div className="col-12 small text-muted mb-2"><i className="fa fa-coins me-1" />Vencimento base da categoria: <strong>{Number(ref.carreirasCivis[d.carreiraCivil].vencimentoBase).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz</strong> · subsídio de alimentação {Number(ref.carreirasCivis[d.carreiraCivil].subsidioAlimentacao).toLocaleString('pt-PT')} Kz · transporte {Number(ref.carreirasCivis[d.carreiraCivil].subsidioTransporte).toLocaleString('pt-PT')} Kz</div>}
            <Campo rotulo="Vínculo" col="col-md-3"><Escolha valor={d.vinculoCivil} aoMudar={set('vinculoCivil')} opcoes={ref.vinculosCivis} /></Campo>
            <Campo rotulo="Admissão" col="col-md-3">{data('dataAdmissao')}</Campo>
            <Campo rotulo="Na classe desde" col="col-md-3">{data('dataCategoria')}</Campo>
            <Campo rotulo="N.º de segurança social (INSS)" col="col-md-3">{txt('inss')}</Campo>
          </div>
        </Painel>
      )}

      <Painel titulo="Dados pessoais" icone="fa-user">
        <div className="row">
          <Campo rotulo="Data de nascimento" col="col-md-3">{data('dataNascimento')}</Campo>
          <Campo rotulo="Género" col="col-md-3"><Escolha valor={d.genero} aoMudar={set('genero')} opcoes={ref.generos} /></Campo>
          <Campo rotulo="Estado civil" col="col-md-3"><Escolha valor={d.estadoCivil} aoMudar={set('estadoCivil')} opcoes={ref.estadosCivis} /></Campo>
          <Campo rotulo="Nacionalidade" col="col-md-3">{txt('nacionalidade')}</Campo>
          <Campo rotulo="Naturalidade (município)" col="col-md-3">{txt('naturalidade')}</Campo>
          <Campo rotulo="Província" col="col-md-3"><Escolha valor={d.provincia} aoMudar={set('provincia')} opcoes={ref.provincias} /></Campo>
          <Campo rotulo="Nome do pai" col="col-md-3">{txt('pai')}</Campo>
          <Campo rotulo="Nome da mãe" col="col-md-3">{txt('mae')}</Campo>
          <Campo rotulo="Telefone" col="col-md-3">{txt('telefone')}</Campo>
          <Campo rotulo="Telefone alternativo" col="col-md-3">{txt('telefoneAlternativo')}</Campo>
          <Campo rotulo="Grupo sanguíneo" col="col-md-3"><Escolha valor={d.grupoSanguineo} aoMudar={set('grupoSanguineo')} opcoes={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} /></Campo>
          <Campo rotulo="Vencimento mensal (Kz)" col="col-md-3" ajuda="Para as declarações; fica cifrado.">{txt('vencimento', { type: 'number', step: '0.01', min: 0 })}</Campo>
          <Campo rotulo="Banco" col="col-md-3">{txt('banco')}</Campo>
          <Campo rotulo="IBAN" col="col-md-5" ajuda="Fica cifrado.">{txt('iban')}</Campo>
          <Campo rotulo="Número de conta" col="col-md-4">{txt('numeroConta')}</Campo>
          <Campo rotulo="BI emitido em (local)" col="col-md-3">{txt('biLocalEmissao')}</Campo>
          <Campo rotulo="Data de emissão do BI" col="col-md-3">{data('biEmitidoEm')}</Campo>
          <Campo rotulo="Validade do BI" col="col-md-3">{data('biValidade')}</Campo>
          <Campo rotulo="Morada (localidade)" col="col-md-3">{txt('morada')}</Campo>
          <Campo rotulo="Município" col="col-md-3">{txt('municipio')}</Campo>
          <Campo rotulo="Bairro" col="col-md-3">{txt('bairro')}</Campo>
          <Campo rotulo="Rua" col="col-md-3">{txt('rua')}</Campo>
          <Campo rotulo="Casa n.º" col="col-md-1">{txt('casa')}</Campo>
          <Campo rotulo="Caixa postal" col="col-md-2">{txt('caixaPostal')}</Campo>
          <Campo rotulo="Habilitações literárias" col="col-md-3"><Escolha valor={d.habilitacao} aoMudar={set('habilitacao')} opcoes={ref.habilitacoes} /></Campo>
          <Campo rotulo="Área de formação" col="col-md-9">{txt('areaFormacao')}</Campo>
        </div>
      </Painel>

      {d.vinculo === 'docente' && (
        <Painel titulo="Docente" icone="fa-chalkboard-teacher">
          <div className="row">
            <Campo rotulo="Tipo de docente" col="col-md-3"><Escolha valor={d.tipoDocente} aoMudar={set('tipoDocente')} opcoes={ref.tiposDocente} /></Campo>
            <Campo rotulo="Categoria do docente" col="col-md-4"><input className="form-control form-control-sm" list="categorias-docente" value={d.categoriaDocente ?? ''} onChange={set('categoriaDocente')} /><datalist id="categorias-docente">{ref.categoriasDocente.map((c) => <option key={c} value={c} />)}</datalist></Campo>
          </div>
        </Painel>
      )}

      <Painel titulo="Agregado familiar" icone="fa-users">
        <div className="row">
          <Campo rotulo="Nome do cônjuge" col="col-md-6">{txt('conjuge')}</Campo>
          <Campo rotulo="Local de serviço do cônjuge" col="col-md-6">{txt('conjugeLocalServico')}</Campo>
        </div>
        <table className="table table-sm align-middle mb-2">
          <thead><tr><th>Nome</th><th>Parentesco</th><th>Data de nascimento</th><th>Nacionalidade</th><th>Profissão</th><th /></tr></thead>
          <tbody>
            {(d.agregado ?? []).map((a, i) => {
              const mudarA = (k) => (e) => setD({ ...d, agregado: d.agregado.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })
              return (
                <tr key={i}>
                  <td><input className="form-control form-control-sm" value={a.nome ?? ''} onChange={mudarA('nome')} aria-label="Nome" /></td>
                  <td><input className="form-control form-control-sm" value={a.parentesco ?? ''} onChange={mudarA('parentesco')} list="parentescos" aria-label="Parentesco" /></td>
                  <td><input type="date" className="form-control form-control-sm" value={a.dataNascimento ?? ''} onChange={mudarA('dataNascimento')} aria-label="Data de nascimento" /></td>
                  <td><input className="form-control form-control-sm" value={a.nacionalidade ?? ''} onChange={mudarA('nacionalidade')} aria-label="Nacionalidade" /></td>
                  <td><input className="form-control form-control-sm" value={a.profissao ?? ''} onChange={mudarA('profissao')} aria-label="Profissão" /></td>
                  <td><button type="button" className="btn btn-xs btn-outline-danger" onClick={() => setD({ ...d, agregado: d.agregado.filter((_, j) => j !== i) })} aria-label="Retirar"><i className="fa fa-times" /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <datalist id="parentescos">{['Filho', 'Filha', 'Pai', 'Mãe', 'Irmão', 'Irmã', 'Sobrinho(a)', 'Neto(a)', 'Outro'].map((x) => <option key={x} value={x} />)}</datalist>
        <button type="button" className="btn btn-xs btn-outline-theme" onClick={() => setD({ ...d, agregado: [...(d.agregado ?? []), { nome: '', parentesco: 'Filho', dataNascimento: '', nacionalidade: 'Angolana', profissao: '' }] })}><i className="fa fa-plus me-1" />Juntar familiar</button>
      </Painel>

      <Painel titulo="Na Escola" icone="fa-building">
        <div className="row">
          <Campo rotulo="Unidade (orgânica)" col="col-md-4"><Escolha valor={d.unidadeId} aoMudar={set('unidadeId')} opcoes={arvore.opcoes} vazio="Sem unidade" /></Campo>
          {!id && <Campo rotulo="Cargo atual" col="col-md-4" ajuda="Só no registo; depois, o cargo muda por proposta de nomeação."><Escolha valor={d.cargoId} aoMudar={set('cargoId')} opcoes={cargos.filter((c) => !d.unidadeId || arvore.descendentes(Number(d.unidadeId)).has(c.unidadeId)).map((c) => [c.id, `${c.nome} — ${c.unidadeCaminho || 'sem unidade'} (${c.ocupados}/${c.vagas})`])} vazio="Sem cargo" /></Campo>}
          {!id && <Campo rotulo="No cargo desde" col="col-md-4">{data('dataCargo')}</Campo>}
          <div className="col-12 d-flex flex-wrap gap-4 my-2">
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.avaliacaoFavoravel} onChange={set('avaliacaoFavoravel')} /> <span className="form-check-label">Avaliação favorável</span></label>
            {militar && <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.aptidaoFisica} onChange={set('aptidaoFisica')} /> <span className="form-check-label">Apto física e psiquicamente</span></label>}
            <label className="form-check"><input type="checkbox" className="form-check-input" checked={d.processoPendente} onChange={set('processoPendente')} /> <span className="form-check-label">Processo disciplinar ou criminal pendente</span></label>
            {id && <label className="form-check"><input type="checkbox" className="form-check-input" checked={!d.ativo} onChange={(e) => set('ativo')(!e.target.checked)} /> <span className="form-check-label text-danger">Já não serve na Escola</span></label>}
          </div>
          <Campo rotulo="Observações" col="col-12"><textarea className="form-control form-control-sm" rows={3} value={d.observacoes} onChange={set('observacoes')} /></Campo>
        </div>
      </Painel>
    </form>
  )
}
