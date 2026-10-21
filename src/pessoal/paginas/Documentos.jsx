import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useArvore } from '../arvore'
import { useDados } from '../useDados'
import { documentoExcel, documentoPdf } from '../exportar'
import { DOCUMENTOS, GRUPOS_DOCUMENTOS } from '../relatorios'
import { ArvoreSituacoes } from '../componentes/Situacao'
import { Cabecalho, Carregando, Erro, Escolha, Painel } from '../componentes/Ui'

// o que cada documento precisa além das fichas (carrega-se só quando se pede)
const EXTRA = {
  propostos: (o) => api('/propostas/itens', { consulta: o.estado ? { estado: o.estado } : {} }),
  // as licenças do ano do período (e do anterior, que podem entrar por ele dentro); sem período, as em curso
  licencas: async (o) => {
    if (!o.mes) return api('/licencas', { consulta: { estado: 'em_curso' } })
    const ano = Number(o.mes.slice(0, 4))
    return (await Promise.all([ano - 1, ano].map((a) => api('/licencas', { consulta: { ano: a } })))).flat()
  },
  // quem saiu da Escola (transferidos, mortos, condenados)
  saidas: () => api('/pessoas', { consulta: { ativo: 'nao' } }),
  domiciliares: () => api('/pessoas', { consulta: { vinculo: 'domiciliar' } }),
}

function Documento({ d, contexto, aoFazer }) {
  const [o, setO] = useState(() => Object.fromEntries((d.opcoes ?? []).map((x) => [x.campo, x.inicial ?? x.opcoes[0][0]])))
  const [a, setA] = useState('')
  async function fazer(formato) {
    setA(formato)
    try {
      await aoFazer(d, o, formato)
    } finally {
      setA('')
    }
  }
  return (
    <div className="col-xl-4 col-md-6 mb-3">
      <div className="card h-100 pes-documento">
        <div className="card-body d-flex flex-column">
          <div className="d-flex gap-3 align-items-start mb-2">
            <span className="pes-documento-icone"><i className={`fa ${d.icone}`} /></span>
            <div>
              <h6 className="mb-1">{d.titulo}</h6>
              <p className="small text-muted mb-0">{d.descricao}</p>
            </div>
          </div>
          {d.opcoes?.map((x) => (
            <label key={x.campo} className="small d-flex align-items-center gap-2 mb-1">
              <span className="text-muted text-nowrap" style={{ minWidth: 70 }}>{x.rotulo}</span>
              <Escolha valor={o[x.campo]} aoMudar={(v) => setO({ ...o, [x.campo]: v })} opcoes={x.opcoes} vazio={null} aria-label={`${d.titulo}: ${x.rotulo}`} />
            </label>
          ))}
          <div className="mt-auto pt-2 d-flex gap-2">
            <button type="button" className="btn btn-sm btn-theme flex-grow-1" disabled={Boolean(a) || !contexto} onClick={() => fazer('pdf')}><i className={`fa ${a === 'pdf' ? 'fa-spinner fa-spin' : 'fa-file-pdf'} me-1`} />Imprimir (PDF)</button>
            <button type="button" className="btn btn-sm btn-outline-success" disabled={Boolean(a) || !contexto} onClick={() => fazer('excel')} title="Exportar para Excel"><i className={`fa ${a === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'} me-1`} />Excel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/*
  Documentos da Repartição: efectividade, propostas e listas. Todos se tiram para a Escola inteira ou para
  uma unidade (com as suas subunidades) e saem com o brasão; cada exportação fica na auditoria.
*/
export default function Documentos() {
  const { grupo = 'efectividade' } = useParams()
  const { ref, avisar } = useSessao()
  const arvore = useArvore()
  const [base, setBase] = useState('')
  const { dados: todas, erro, recarregar } = useDados('/pessoas')
  const g = GRUPOS_DOCUMENTOS[grupo] ?? GRUPOS_DOCUMENTOS.efectividade
  const ids = base ? arvore.descendentes(Number(base)) : null
  const pessoas = todas && arvore.pronta ? todas.filter((p) => !ids || ids.has(p.unidadeId)) : null
  const contexto = pessoas ? { pessoas, ref, arvore, base: base ? Number(base) : null } : null

  async function fazer(d, o, formato) {
    try {
      const ctx = { ...contexto }
      if (d.precisa === 'propostos') ctx.propostos = (await EXTRA.propostos(o)).filter((i) => !ids || pessoas.some((p) => p.id === i.pessoaId))
      if ([].concat(d.precisa).includes('licencas')) ctx.licencas = await EXTRA.licencas(o)
      if (d.id === 'ausencias') ctx.saidas = (await EXTRA.saidas()).filter((p) => !ids || ids.has(p.unidadeId))
      if (d.precisa === 'domiciliares') ctx.domiciliares = (await EXTRA.domiciliares()).filter((p) => !ids || ids.has(p.unidadeId) || pessoas.some((x) => x.id === p.militarAlocadoId))
      const doc = d.fazer(ctx, o)
      if (formato === 'pdf') await documentoPdf(doc)
      else await documentoExcel(doc)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const lista = DOCUMENTOS.filter((d) => d.grupo === grupo)
  const militares = pessoas?.filter((p) => p.tipo === 'militar') ?? []
  return (
    <>
      <Cabecalho titulo="Documentos" subtitulo={g.titulo} migalhas={[['Documentos'], [g.titulo]]} />
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="btn-group" role="group" aria-label="Grupo de documentos">
          {Object.entries(GRUPOS_DOCUMENTOS).map(([k, x]) => <NavLink key={k} to={`/documentos/${k}`} className={({ isActive }) => `btn btn-sm ${isActive || (k === 'efectividade' && !GRUPOS_DOCUMENTOS[grupo]) ? 'btn-theme' : 'btn-outline-secondary'}`}><i className={`fa ${x.icone} me-1`} />{x.titulo}</NavLink>)}
        </div>
        <label className="d-flex align-items-center gap-2 ms-md-auto small">
          <span className="text-muted text-nowrap"><i className="fa fa-sitemap me-1" />Unidade</span>
          <Escolha valor={base} aoMudar={setBase} opcoes={arvore.opcoes.map(([k, v]) => [String(k), v])} vazio="Toda a Escola" aria-label="Unidade dos documentos" style={{ minWidth: 260 }} />
        </label>
      </div>
      <p className="text-muted small">{g.texto} {base ? 'Só a unidade escolhida e as suas subunidades.' : 'Toda a Escola.'} Os documentos saem com o brasão, a data e a assinatura do Chefe da Repartição; cada um fica registado na auditoria.</p>
      {erro && <Erro texto={erro} aoRepetir={recarregar} />}
      {!pessoas && !erro && <Carregando />}
      {pessoas && (
        <div className="row">
          {grupo === 'efectividade' && (
            <div className="col-12 mb-3">
              <Painel titulo={`Situação dos militares (Lei n.º 13/18) — ${militares.length} militar(es)`} icone="fa-sitemap">
                <div className="row">
                  <div className="col-lg-7"><ArvoreSituacoes arvore={ref.arvoreSituacoes} militares={militares} /></div>
                  <div className="col-lg-5">
                    <h6 className="small fw-bold text-muted text-uppercase mt-3 mt-lg-0">Estado</h6>
                    <ul className="list-unstyled small mb-0">
                      {[['', 'Ao serviço'], ...Object.entries(ref.estados)].map(([k, v]) => {
                        const n = militares.filter((p) => (p.estado || '') === k).length
                        return <li key={k || 'ao'} className="d-flex justify-content-between border-bottom py-1"><span>{v}</span><span className={`badge ${n ? 'bg-dark' : 'bg-light text-muted border'}`}>{n}</span></li>
                      })}
                    </ul>
                  </div>
                </div>
              </Painel>
            </div>
          )}
          {lista.map((d) => <Documento key={d.id} d={d} contexto={contexto} aoFazer={fazer} />)}
        </div>
      )}
    </>
  )
}
