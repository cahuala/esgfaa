import { ESCALA } from './cadeira/escala'

/*
  Perguntas de opinião (escolha, escala de 1 a 5, resposta aberta) para responder:
  inquéritos das cadeiras e inquéritos institucionais. respostas: { índice: valor }.
*/
function FormularioOpiniao({ perguntas, respostas, definir, numerar = false }) {
  return perguntas.map((p, k) => (
    <fieldset key={k} className="mb-3">
      <legend className="fs-14px fw-bold mb-2">{numerar && p.tipo === 'escala' ? `${k + 1}. ` : ''}{p.texto}</legend>
      {p.tipo === 'escolha' && p.opcoes.map((o, j) => {
        const marcadas = respostas[k] || []
        return (
          <label key={j} className="p-caixa d-flex">
            <input type={p.multipla ? 'checkbox' : 'radio'} name={`p${k}`} checked={marcadas.includes(j)}
              onChange={(e) => definir(k, p.multipla ? (e.target.checked ? [...marcadas, j] : marcadas.filter((x) => x !== j)) : [j])} /> {o}
          </label>
        )
      })}
      {p.tipo === 'escala' && (
        <div className="p-escala" role="radiogroup" aria-label={p.texto}>
          {ESCALA.map((t, j) => (
            <label key={j} className={`p-escala-opcao ${respostas[k] === j + 1 ? 'ativa' : ''}`}>
              <input type="radio" name={`p${k}`} checked={respostas[k] === j + 1} onChange={() => definir(k, j + 1)} />
              <b>{j + 1}</b><span>{t}</span>
            </label>
          ))}
        </div>
      )}
      {p.tipo === 'aberta' && <textarea className="form-control" rows={3} maxLength={2000} value={respostas[k] || ''} onChange={(e) => definir(k, e.target.value)} aria-label={p.texto} placeholder="Opcional" />}
    </fieldset>
  ))
}

export default FormularioOpiniao
