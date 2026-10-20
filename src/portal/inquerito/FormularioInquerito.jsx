import { useRef, useState } from 'react'
import { OUTRA, eObrigatoria, escalaDe, paginas, respondida } from './tipos'
import { t as tx } from '../../i18n/linguas'
import './formulario.css'

/*
  Um inquérito com o aspeto de um formulário do Google: o cartão de cabeçalho com a faixa da cor da Escola,
  um cartão por pergunta (resposta curta, parágrafo, escolha múltipla, caixas, lista pendente, escala linear,
  grelha, data e hora), "* obrigatória" e, se houver secções, uma página por secção com "Seguinte" /
  "Anterior" e a barra de progresso. Se faltar uma resposta obrigatória, a pergunta fica a vermelho e a
  página vai até ela. As respostas ficam em respostas[k] (k = índice na lista) e "Outra:" em respostas[`${k}o`].
  estado (opcional): o que mostrar no lugar das perguntas (já respondeu, fechou…).
*/
function FormularioInquerito({ titulo, descricao, anonimo, rodape, perguntas, respostas, definir, limpar, aoEnviar, aEnviar, textoEnviar, estado }) {
  const [faltam, setFaltam] = useState(() => new Set())
  const [pagina, setPagina] = useState(0)
  const cartoes = useRef([])
  const topo = useRef(null)
  const pags = paginas(perguntas)
  const atual = pags[Math.min(pagina, pags.length - 1)] ?? { indices: [] }
  const ultima = pagina >= pags.length - 1
  const nObrigatorias = perguntas.filter(eObrigatoria).length

  function mudar(k, v) {
    definir(k, v)
    if (faltam.has(k)) setFaltam((f) => { const n = new Set(f); n.delete(k); return n })
  }
  const semResposta = (indices) => new Set(indices.filter((k) => eObrigatoria(perguntas[k]) && !respondida(perguntas[k], respostas[k], respostas[`${k}o`])))

  // vai para a outra página só se esta estiver completa (como no Google)
  function avancar(e) {
    e.preventDefault()
    const sem = semResposta(atual.indices)
    setFaltam(sem)
    if (sem.size) {
      const k = Math.min(...sem)
      cartoes.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      cartoes.current[k]?.querySelector('input, textarea, select')?.focus({ preventScroll: true })
      return
    }
    if (!ultima) { setPagina(pagina + 1); topo.current?.scrollIntoView({ behavior: 'smooth' }); return }
    aoEnviar()
  }
  const recuar = () => { setPagina(Math.max(0, pagina - 1)); setFaltam(new Set()); topo.current?.scrollIntoView({ behavior: 'smooth' }) }

  return (
    <form className="gf" onSubmit={avancar} noValidate ref={topo}>
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
          {atual.seccao && (
            <div className="gf-cartao gf-seccao">
              <div className="gf-seccao-n">{tx('Secção {0} de {1}', { 0: pagina + 1, 1: pags.length })}</div>
              <h3 className="gf-seccao-titulo">{atual.seccao.texto}</h3>
              {atual.seccao.descricao && <p className="gf-descricao mb-0">{atual.seccao.descricao}</p>}
            </div>
          )}
          {atual.indices.map((k) => {
            const p = perguntas[k]
            return (
              <div key={k} ref={(el) => { cartoes.current[k] = el }} role="group" aria-labelledby={`gf-p${k}`} className={`gf-cartao gf-pergunta ${faltam.has(k) ? 'gf-falta' : ''}`}>
                <div>
                  <div id={`gf-p${k}`} className="gf-enunciado">
                    {p.texto}
                    {eObrigatoria(p) && <span className="gf-obrigatoria" aria-label={tx('obrigatória')}> *</span>}
                  </div>
                  {p.descricao && <div className="gf-ajuda mt-1">{p.descricao}</div>}
                </div>
                {p.tipo === 'escolha' && p.multipla && <div className="gf-ajuda">{tx('Pode escolher mais do que uma.')}</div>}
                <Resposta p={p} k={k} valor={respostas[k]} outra={respostas[`${k}o`]} mudar={(v) => mudar(k, v)} mudarOutra={(t) => definir(`${k}o`, t)} />
                {faltam.has(k) && <div className="gf-erro" role="alert"><i className="fa fa-exclamation-circle me-2" />{tx('Esta pergunta é obrigatória')}</div>}
              </div>
            )
          })}
          {pags.length > 1 && (
            <div className="gf-progresso" aria-label={tx('Página {0} de {1}', { 0: pagina + 1, 1: pags.length })}>
              <div className="gf-progresso-barra"><i style={{ width: `${((pagina + 1) / pags.length) * 100}%` }} /></div>
              <span>{tx('Página {0} de {1}', { 0: pagina + 1, 1: pags.length })}</span>
            </div>
          )}
          <div className="gf-acoes">
            <div className="d-flex gap-2">
              {pagina > 0 && <button type="button" className="btn btn-white gf-enviar" onClick={recuar}>{tx('Anterior')}</button>}
              <button type="submit" className={`btn ${ultima ? 'btn-theme' : 'btn-white'} gf-enviar`} disabled={aEnviar}>{!ultima ? tx('Seguinte') : aEnviar ? tx('A enviar…') : textoEnviar || tx('Enviar')}</button>
            </div>
            {limpar && <button type="button" className="gf-limpar" onClick={() => { limpar(); setFaltam(new Set()); setPagina(0) }}>{tx('Limpar formulário')}</button>}
          </div>
        </>
      )}
    </form>
  )
}

function Resposta({ p, k, valor, outra, mudar, mudarOutra }) {
  if (p.tipo === 'escolha' && p.lista) {
    return (
      <select className="form-select gf-lista" value={valor?.[0] ?? ''} onChange={(e) => mudar(e.target.value === '' ? [] : [Number(e.target.value)])} aria-label={p.texto}>
        <option value="">{tx('Escolher')}</option>
        {p.opcoes.map((o, j) => <option key={j} value={j}>{o}</option>)}
      </select>
    )
  }
  if (p.tipo === 'escolha') {
    const marcadas = valor || []
    const marcar = (j, sim) => mudar(p.multipla ? (sim ? [...marcadas.filter((x) => x !== j), j] : marcadas.filter((x) => x !== j)) : [j])
    return (
      <div className="gf-opcoes">
        {p.opcoes.map((o, j) => (
          <label key={j} className="gf-opcao">
            <input type={p.multipla ? 'checkbox' : 'radio'} name={`p${k}`} checked={marcadas.includes(j)} onChange={(e) => marcar(j, e.target.checked)} />
            <span>{o}</span>
          </label>
        ))}
        {p.outra && (
          <label className="gf-opcao">
            <input type={p.multipla ? 'checkbox' : 'radio'} name={`p${k}`} checked={marcadas.includes(OUTRA)} onChange={(e) => marcar(OUTRA, e.target.checked)} />
            <span className="text-nowrap">{tx('Outra:')}</span>
            <input className="gf-texto gf-outra" value={outra || ''} maxLength={300} aria-label={tx('Outra resposta')}
              onChange={(e) => { mudarOutra(e.target.value); if (e.target.value && !marcadas.includes(OUTRA)) marcar(OUTRA, true) }} />
          </label>
        )}
      </div>
    )
  }
  if (p.tipo === 'escala') {
    const e = escalaDe(p)
    return (
      <div className="gf-escala-bloco">
        <div className="gf-escala" role="radiogroup" aria-label={p.texto} style={{ '--gf-n': e.valores.length }}>
          <span className="gf-escala-ponta">{e.rotuloMin}</span>
          {e.valores.map((n) => (
            <label key={n} className="gf-escala-opcao" title={e.nome(n)}>
              <span>{n}</span>
              <input type="radio" name={`p${k}`} checked={valor === n} onChange={() => mudar(n)} aria-label={e.nome(n) === String(n) ? String(n) : `${n} — ${e.nome(n)}`} />
            </label>
          ))}
          <span className="gf-escala-ponta">{e.rotuloMax}</span>
        </div>
        <div className="gf-escala-escolha" aria-live="polite">{Number.isInteger(valor) && e.nome(valor) !== String(valor) ? `${valor} — ${e.nome(valor)}` : ''}</div>
      </div>
    )
  }
  if (p.tipo === 'grelha') {
    const v = valor || {}
    const marcar = (l, c, sim) => {
      const atual = Array.isArray(v[l]) ? v[l] : []
      mudar({ ...v, [l]: p.multipla ? (sim ? [...atual.filter((x) => x !== c), c] : atual.filter((x) => x !== c)) : [c] })
    }
    return (
      <div className="gf-grelha-caixa">
        <table className="gf-grelha">
          <thead><tr><th />{p.colunas.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {p.linhas.map((l, i) => (
              <tr key={i}>
                <th scope="row">{l}</th>
                {p.colunas.map((c, j) => (
                  <td key={j}><input type={p.multipla ? 'checkbox' : 'radio'} name={`p${k}l${i}`} checked={(v[i] || []).includes(j)} onChange={(e) => marcar(i, j, e.target.checked)} aria-label={`${l}: ${c}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (p.tipo === 'data' || p.tipo === 'hora') {
    return <input type={p.tipo === 'data' ? 'date' : 'time'} className="gf-texto gf-data" value={valor || ''} onChange={(e) => mudar(e.target.value)} aria-label={p.texto} />
  }
  if (p.tipo === 'curta') {
    return <input className="gf-texto gf-curta" maxLength={300} value={valor || ''} placeholder={tx('A sua resposta')} aria-label={p.texto} onChange={(e) => mudar(e.target.value)} />
  }
  return (
    <textarea className="gf-texto" rows={1} maxLength={2000} value={valor || ''} placeholder={tx('A sua resposta')} aria-label={p.texto}
      onChange={(e) => mudar(e.target.value)}
      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }} />
  )
}

export default FormularioInquerito
