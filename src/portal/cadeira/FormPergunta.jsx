import { useState } from 'react'
import { Campo } from '../componentes'
import { TIPOS_PERGUNTA } from './tiposPergunta'
import { t as tx } from '../../i18n/linguas'

const VAZIA = {
  tipo: 'unica', enunciado: '', pontos: 1, categoria: '',
  opcoes: [{ texto: '', correta: true }, { texto: '', correta: false }], correta: 'verdadeiro',
  respostas: [''], valor: '', tolerancia: '0', pares: [{ a: '', b: '' }, { a: '', b: '' }], orientacao: '',
}

// converte o formulário no corpo que a API espera, conforme o tipo
function corpo(f) {
  const base = { tipo: f.tipo, enunciado: f.enunciado, pontos: f.pontos, ...(f.categoria ? { categoria: f.categoria } : {}) }
  if (f.tipo === 'vf') return { ...base, correta: f.correta }
  if (f.tipo === 'unica' || f.tipo === 'multipla') return { ...base, opcoes: f.opcoes }
  if (f.tipo === 'curta') return { ...base, opcoes: { respostas: f.respostas.filter((r) => r.trim()) } }
  if (f.tipo === 'numerica') return { ...base, opcoes: { valor: f.valor, tolerancia: f.tolerancia || '0' } }
  if (f.tipo === 'correspondencia') return { ...base, opcoes: { pares: f.pares } }
  return { ...base, opcoes: { orientacao: f.orientacao } }
}

/*
  Formulário de uma pergunta (todos os tipos). guardar(corpo) devolve uma promessa.
  comCategoria: mostra o campo da categoria (banco de perguntas).
*/
function FormPergunta({ guardar, botao = tx('Juntar pergunta'), comCategoria = false }) {
  const [f, setF] = useState(VAZIA)
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  const lista = (k, i, v) => setF({ ...f, [k]: f[k].map((x, j) => (i === j ? v : x)) })
  const opcao = (i, campo, v) => setF({
    ...f,
    opcoes: f.opcoes.map((o, j) => {
      if (campo === 'correta' && f.tipo === 'unica') return { ...o, correta: i === j }
      return i === j ? { ...o, [campo]: v } : o
    }),
  })

  async function submeter(e) {
    e.preventDefault()
    setErro('')
    setAGuardar(true)
    try {
      await guardar(corpo(f))
      setF({ ...VAZIA, tipo: f.tipo, categoria: f.categoria })
    } catch (falha) {
      setErro(falha.message)
    } finally {
      setAGuardar(false)
    }
  }

  return (
    <form onSubmit={submeter} className="p-formulario">
      {erro && <p className="p-erro" role="alert">{erro}</p>}
      <div className="row g-2">
        <div className={comCategoria ? 'col-sm-5' : 'col-sm-8'}>
          <Campo id="fp-tipo" rotulo={tx('Tipo')}>
            <select id="fp-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(TIPOS_PERGUNTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Campo>
        </div>
        {comCategoria && <div className="col-sm-4"><Campo id="fp-cat" rotulo={tx('Categoria')}><input id="fp-cat" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} placeholder={tx('Geral')} /></Campo></div>}
        <div className={comCategoria ? 'col-sm-3' : 'col-sm-4'}><Campo id="fp-pontos" rotulo={tx('Pontos')}><input id="fp-pontos" inputMode="decimal" value={f.pontos} onChange={(e) => setF({ ...f, pontos: e.target.value })} /></Campo></div>
      </div>
      <Campo id="fp-enunciado" rotulo={tx('Enunciado')}><textarea id="fp-enunciado" rows={2} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} required /></Campo>

      {f.tipo === 'vf' && (
        <Campo id="fp-vf" rotulo={tx('Resposta certa')}>
          <select id="fp-vf" value={f.correta} onChange={(e) => setF({ ...f, correta: e.target.value })}><option value="verdadeiro">{tx('Verdadeiro')}</option><option value="falso">{tx('Falso')}</option></select>
        </Campo>
      )}
      {(f.tipo === 'unica' || f.tipo === 'multipla') && (
        <div>
          <span className="form-label fw-bold d-block mb-1">{tx('Opções')} <small className="text-muted fw-normal">{tx('(marque')} {f.tipo === 'unica' ? tx('a certa') : tx('as certas')})</small></span>
          {f.opcoes.map((o, i) => (
            <div key={i} className="d-flex gap-2 align-items-center mb-1">
              <input type={f.tipo === 'unica' ? 'radio' : 'checkbox'} name="fp-certa" className="form-check-input mt-0" checked={o.correta} onChange={(e) => opcao(i, 'correta', e.target.checked)} aria-label={tx('Opção {0} certa', { 0: i + 1 })} />
              <input className="form-control form-control-sm" value={o.texto} onChange={(e) => opcao(i, 'texto', e.target.value)} placeholder={tx('Opção {0}', { 0: i + 1 })} aria-label={tx('Opção {0}', { 0: i + 1 })} required />
              {f.opcoes.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, opcoes: f.opcoes.filter((_, j) => j !== i) })} aria-label={tx('Retirar opção')}><i className="fa fa-times" /></button>}
            </div>
          ))}
          {f.opcoes.length < 8 && <button type="button" className="btn btn-xs btn-white mt-1" onClick={() => setF({ ...f, opcoes: [...f.opcoes, { texto: '', correta: false }] })}><i className="fa fa-plus me-1" />{tx('Opção')}</button>}
        </div>
      )}
      {f.tipo === 'curta' && (
        <div>
          <span className="form-label fw-bold d-block mb-1">{tx('Respostas aceites')} <small className="text-muted fw-normal">{tx('(sem contar maiúsculas nem acentos)')}</small></span>
          {f.respostas.map((r, i) => (
            <div key={i} className="d-flex gap-2 mb-1">
              <input className="form-control form-control-sm" value={r} onChange={(e) => lista('respostas', i, e.target.value)} placeholder={tx('Ex.: Clausewitz')} aria-label={tx('Resposta aceite {0}', { 0: i + 1 })} required={i === 0} />
              {f.respostas.length > 1 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, respostas: f.respostas.filter((_, j) => j !== i) })} aria-label={tx('Retirar resposta')}><i className="fa fa-times" /></button>}
            </div>
          ))}
          {f.respostas.length < 10 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, respostas: [...f.respostas, ''] })}><i className="fa fa-plus me-1" />{tx('Outra resposta aceite')}</button>}
        </div>
      )}
      {f.tipo === 'numerica' && (
        <div className="row g-2">
          <div className="col-6"><Campo id="fp-valor" rotulo={tx('Valor certo')}><input id="fp-valor" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required /></Campo></div>
          <div className="col-6"><Campo id="fp-tol" rotulo={tx('Tolerância (±)')}><input id="fp-tol" inputMode="decimal" value={f.tolerancia} onChange={(e) => setF({ ...f, tolerancia: e.target.value })} /></Campo></div>
        </div>
      )}
      {f.tipo === 'correspondencia' && (
        <div>
          <span className="form-label fw-bold d-block mb-1">{tx('Pares')} <small className="text-muted fw-normal">{tx('(a coluna da direita aparece baralhada ao estudante; cada par certo vale uma parte dos pontos)')}</small></span>
          {f.pares.map((x, i) => (
            <div key={i} className="d-flex gap-2 align-items-center mb-1">
              <input className="form-control form-control-sm" value={x.a} onChange={(e) => lista('pares', i, { ...x, a: e.target.value })} placeholder={tx('Ex.: Sun Tzu')} aria-label={tx('Item {0}', { 0: i + 1 })} required />
              <i className="fa fa-arrows-alt-h text-muted" />
              <input className="form-control form-control-sm" value={x.b} onChange={(e) => lista('pares', i, { ...x, b: e.target.value })} placeholder={tx('Ex.: A Arte da Guerra')} aria-label={tx('Correspondência {0}', { 0: i + 1 })} required />
              {f.pares.length > 2 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, pares: f.pares.filter((_, j) => j !== i) })} aria-label={tx('Retirar par')}><i className="fa fa-times" /></button>}
            </div>
          ))}
          {f.pares.length < 8 && <button type="button" className="btn btn-xs btn-white" onClick={() => setF({ ...f, pares: [...f.pares, { a: '', b: '' }] })}><i className="fa fa-plus me-1" />{tx('Par')}</button>}
        </div>
      )}
      {f.tipo === 'dissertacao' && (
        <Campo id="fp-orient" rotulo={tx('Orientações para o estudante (opcional)')} ajuda={tx('A resposta é corrigida por si; a nota sai quando a corrigir.')}>
          <textarea id="fp-orient" rows={2} value={f.orientacao} onChange={(e) => setF({ ...f, orientacao: e.target.value })} />
        </Campo>
      )}
      <div><button type="submit" className="btn btn-theme" disabled={aGuardar}>{aGuardar ? tx('A guardar…') : botao}</button></div>
    </form>
  )
}

// resumo da solução de uma pergunta (lista do editor e do banco)
export function SolucaoPergunta({ p }) {
  if (p.tipo === 'curta') return <div className="small text-success"><i className="fa fa-check-circle me-1" />{tx('Aceites:')} {p.opcoes.respostas.join(' · ')}</div>
  if (p.tipo === 'numerica') return <div className="small text-success"><i className="fa fa-check-circle me-1" />{p.opcoes.valor}{p.opcoes.tolerancia ? ` (± ${p.opcoes.tolerancia})` : ''}</div>
  if (p.tipo === 'correspondencia') return <ul className="list-unstyled small mb-0">{p.opcoes.pares.map((x, i) => <li key={i} className="text-success"><i className="fa fa-arrows-alt-h me-1" />{x.a} → {x.b}</li>)}</ul>
  if (p.tipo === 'dissertacao') return <div className="small text-muted"><i className="fa fa-pen me-1" />{tx('Correção manual')}{p.opcoes.orientacao ? ` · ${p.opcoes.orientacao}` : ''}</div>
  return (
    <ul className="list-unstyled small mb-0 mt-1">
      {p.opcoes.map((o, i) => <li key={i} className={o.correta ? 'text-success fw-bold' : 'text-muted'}><i className={`fa ${o.correta ? 'fa-check-circle' : 'fa-circle'} me-1`} />{o.texto}</li>)}
    </ul>
  )
}

export default FormPergunta
