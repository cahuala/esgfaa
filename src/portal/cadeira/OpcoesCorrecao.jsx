import { t as tx } from '../../i18n/linguas'

/*
  Como se corrige um trabalho: correção anónima (o docente vê "Participante 1, 2…" em vez dos nomes)
  e notas ocultas (os estudantes só as veem quando o docente as liberta, todas ao mesmo tempo).
  f.correcaoAnonima e f.notasOcultas; a anónima implica as notas ocultas.
*/
function OpcoesCorrecao({ f, setF }) {
  const anonima = Boolean(f.correcaoAnonima) && !f.emGrupo
  return (
    <fieldset className="p-opcoes-correcao">
      <legend className="form-label fw-bold mb-1">{tx('Correção')}</legend>
      <label className="p-caixa">
        <input type="checkbox" checked={anonima} disabled={f.emGrupo} onChange={(e) => setF({ ...f, correcaoAnonima: e.target.checked, notasOcultas: e.target.checked || f.notasOcultas })} />
        <span>{tx('Correção anónima: corrige sem ver os nomes (aparecem quando publicar as notas)')}{f.emGrupo && <small className="d-block text-muted">{tx('Não disponível em trabalhos de grupo.')}</small>}</span>
      </label>
      <label className="p-caixa">
        <input type="checkbox" checked={anonima || Boolean(f.notasOcultas)} disabled={anonima} onChange={(e) => setF({ ...f, notasOcultas: e.target.checked })} />
        <span>{tx('Publicar as notas todas de uma vez: os estudantes só as veem quando carregar em «Publicar as notas»')}</span>
      </label>
    </fieldset>
  )
}

export default OpcoesCorrecao
