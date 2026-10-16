import { useRef, useState } from 'react'
import { ESCALA } from '../cadeira/escala'
import { t as tx } from '../../i18n/linguas'
import './formulario.css'

// escolha e escala são obrigatórias (o servidor exige-as); a resposta aberta é opcional
const obrigatoria = (p) => p.tipo !== 'aberta'
const respondida = (p, v) => (p.tipo === 'escolha' ? Array.isArray(v) && v.length > 0 : p.tipo === 'escala' ? Number.isInteger(v) : true)

/*
  Um inquérito com o aspeto de um formulário do Google: um cartão de cabeçalho com a faixa da cor da
  Escola, um cartão por pergunta, "* obrigatória", escala linear de 1 a 5 e "Enviar" / "Limpar formulário".
  Se faltar uma resposta obrigatória, a pergunta fica a vermelho e a página vai até ela.
  estado (opcional): o que mostrar no lugar das perguntas (já respondeu, fechou…).
*/
function FormularioInquerito({ titulo, descricao, anonimo, rodape, perguntas, respostas, definir, limpar, aoEnviar, aEnviar, textoEnviar, estado }) {
  const [faltam, setFaltam] = useState(() => new Set())
  const cartoes = useRef([])
  const nObrigatorias = perguntas.filter(obrigatoria).length

  function mudar(k, v) {
    definir(k, v)
    if (faltam.has(k)) setFaltam((f) => { const n = new Set(f); n.delete(k); return n })
  }

  function enviar(e) {
    e.preventDefault()
    const sem = new Set(perguntas.map((p, k) => (obrigatoria(p) && !respondida(p, respostas[k]) ? k : -1)).filter((k) => k >= 0))
    setFaltam(sem)
    if (sem.size) {
      const k = Math.min(...sem)
      cartoes.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      cartoes.current[k]?.querySelector('input, textarea')?.focus({ preventScroll: true })
      return
    }
    aoEnviar()
  }

  return (
    <form className="gf" onSubmit={enviar} noValidate>
      <div className="gf-cartao gf-topo">
        <h2 className="gf-titulo">{titulo}</h2>
        {descricao && <p className="gf-descricao">{descricao}</p>}
        {(anonimo || (!estado && nObrigatorias > 0)) && (
          <div className="gf-notas">
            {anonimo && <span><i className="fa fa-user-secret me-2" />{tx('Respostas anónimas: não fica registado quem respondeu o quê.')}</span>}
            {!estado && nObrigatorias > 0 && <span className="gf-obrigatoria">* {tx('Indica uma pergunta obrigatória')}</span>}
          </div>
        )}
        {rodape}
      </div>

      {estado ? <div className="gf-cartao">{estado}</div> : (
        <>
          {perguntas.map((p, k) => (
            <div key={k} ref={(el) => { cartoes.current[k] = el }} role="group" aria-labelledby={`gf-p${k}`} className={`gf-cartao gf-pergunta ${faltam.has(k) ? 'gf-falta' : ''}`}>
              <div id={`gf-p${k}`} className="gf-enunciado">
                {p.texto}
                {obrigatoria(p) && <span className="gf-obrigatoria" aria-label={tx('obrigatória')}> *</span>}
              </div>
              {p.tipo === 'escolha' && p.multipla && <div className="gf-ajuda">{tx('Pode escolher mais do que uma.')}</div>}
              <Resposta p={p} k={k} valor={respostas[k]} mudar={(v) => mudar(k, v)} />
              {faltam.has(k) && <div className="gf-erro" role="alert"><i className="fa fa-exclamation-circle me-2" />{tx('Esta pergunta é obrigatória')}</div>}
            </div>
          ))}
          <div className="gf-acoes">
            <button type="submit" className="btn btn-theme gf-enviar" disabled={aEnviar}>{aEnviar ? tx('A enviar…') : textoEnviar || tx('Enviar')}</button>
            {limpar && <button type="button" className="gf-limpar" onClick={() => { limpar(); setFaltam(new Set()) }}>{tx('Limpar formulário')}</button>}
          </div>
        </>
      )}
    </form>
  )
}

function Resposta({ p, k, valor, mudar }) {
  if (p.tipo === 'escolha') {
    const marcadas = valor || []
    return (
      <div className="gf-opcoes">
        {p.opcoes.map((o, j) => (
          <label key={j} className="gf-opcao">
            <input type={p.multipla ? 'checkbox' : 'radio'} name={`p${k}`} checked={marcadas.includes(j)}
              onChange={(e) => mudar(p.multipla ? (e.target.checked ? [...marcadas, j] : marcadas.filter((x) => x !== j)) : [j])} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    )
  }
  if (p.tipo === 'escala') {
    return (
      <div className="gf-escala-bloco">
        <div className="gf-escala" role="radiogroup" aria-label={p.texto}>
          <span className="gf-escala-ponta">{ESCALA[0]}</span>
          {ESCALA.map((rotulo, j) => (
            <label key={j} className="gf-escala-opcao" title={rotulo}>
              <span>{j + 1}</span>
              <input type="radio" name={`p${k}`} checked={valor === j + 1} onChange={() => mudar(j + 1)} aria-label={`${j + 1} — ${rotulo}`} />
            </label>
          ))}
          <span className="gf-escala-ponta">{ESCALA[4]}</span>
        </div>
        <div className="gf-escala-escolha" aria-live="polite">{valor ? `${valor} — ${ESCALA[valor - 1]}` : ''}</div>
      </div>
    )
  }
  return (
    <textarea className="gf-texto" rows={1} maxLength={2000} value={valor || ''} placeholder={tx('A sua resposta')} aria-label={p.texto}
      onChange={(e) => mudar(e.target.value)}
      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }} />
  )
}

export default FormularioInquerito
