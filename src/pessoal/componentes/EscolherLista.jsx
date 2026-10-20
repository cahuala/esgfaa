import { useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessao'
import { useArvore } from '../arvore'
import { documentoExcel, documentoPdf } from '../exportar'
import { DOCUMENTOS, GRUPOS_DOCUMENTOS } from '../relatorios'
import { Escolha, Modal } from './Ui'

/*
  «Documentos» na lista do pessoal: escolhe-se o tipo de lista (efectividade, por posto, por ramo, lista
  geral do pessoal civil…) e sai com as pessoas que estão na lista (com os filtros escolhidos), no modelo
  da Escola. pessoas = as linhas da tabela.
*/
export default function EscolherLista({ pessoas, descricao, aoFechar }) {
  const { ref, avisar } = useSessao()
  const arvore = useArvore()
  const lista = DOCUMENTOS.filter((d) => d.grupo !== 'propostas')
  const [id, setId] = useState(lista[0]?.id)
  const d = lista.find((x) => x.id === id)
  const [o, setO] = useState({})
  const [a, setA] = useState('')
  const opcoes = (doc) => Object.fromEntries((doc?.opcoes ?? []).map((x) => [x.campo, x.inicial ?? x.opcoes[0][0]]))

  async function fazer(formato) {
    setA(formato)
    try {
      const ctx = { pessoas, ref, arvore, base: null }
      if (d.precisa === 'licencas') ctx.licencas = (await api('/licencas', { consulta: { estado: 'em_curso' } })).filter((l) => pessoas.some((p) => p.id === l.pessoaId))
      if (d.precisa === 'domiciliares') ctx.domiciliares = (await api('/pessoas', { consulta: { vinculo: 'domiciliar' } })).filter((p) => pessoas.some((x) => x.id === p.militarAlocadoId))
      const doc = d.fazer(ctx, { ...opcoes(d), ...o })
      if (descricao) doc.subtitulo = [doc.subtitulo, descricao].filter(Boolean).join(' · ')
      if (formato === 'pdf') await documentoPdf(doc)
      else await documentoExcel(doc)
      aoFechar()
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setA('')
    }
  }

  return (
    <Modal titulo={`Documentos — ${pessoas.length} pessoa(s) da lista`} aoFechar={aoFechar} largo
      rodape={<>
        <span className="me-auto small text-muted">No modelo da Escola: visto do Comandante, título, tabela e a assinatura do Chefe da Repartição.</span>
        <button type="button" className="btn btn-white" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn btn-outline-success" disabled={Boolean(a) || !d} onClick={() => fazer('excel')}><i className={`fa ${a === 'excel' ? 'fa-spinner fa-spin' : 'fa-file-excel'} me-1`} />Excel</button>
        <button type="button" className="btn btn-theme" disabled={Boolean(a) || !d} onClick={() => fazer('pdf')}><i className={`fa ${a === 'pdf' ? 'fa-spinner fa-spin' : 'fa-print'} me-1`} />Imprimir</button>
      </>}>
      <div className="row">
        {Object.entries(GRUPOS_DOCUMENTOS).filter(([g]) => g !== 'propostas').map(([g, x]) => (
          <div key={g} className="col-lg-6 mb-3">
            <h6 className="fw-bold mb-2"><i className={`fa ${x.icone} me-2 pes-ouro`} />{x.titulo}</h6>
            {lista.filter((doc) => doc.grupo === g).map((doc) => (
              <label key={doc.id} className={`d-flex gap-2 border rounded p-2 mb-2 ${id === doc.id ? 'border-theme bg-light' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="radio" className="form-check-input mt-1" name="tipo-lista" checked={id === doc.id} onChange={() => { setId(doc.id); setO({}) }} />
                <span><span className="fw-semibold">{doc.titulo}</span><br /><small className="text-muted">{doc.descricao}</small>
                  {id === doc.id && doc.opcoes?.map((op) => (
                    <span key={op.campo} className="d-flex align-items-center gap-2 mt-1 small">
                      <span className="text-muted text-nowrap">{op.rotulo}</span>
                      <Escolha valor={o[op.campo] ?? opcoes(doc)[op.campo]} aoMudar={(v) => setO({ ...o, [op.campo]: v })} opcoes={op.opcoes} vazio={null} aria-label={`${doc.titulo}: ${op.rotulo}`} />
                    </span>
                  ))}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
