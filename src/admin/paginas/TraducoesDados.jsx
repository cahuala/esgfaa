import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const LINGUAS = { en: 'English', fr: 'Français', es: 'Español' }

/*
  Traduções dos dados dos painéis (nomes das cadeiras, avisos, notificações…), feitas pelo tradutor
  automático do servidor. Aqui vê-se o que ele traduziu e corrige-se: a correção fica «revista» e serve a
  todos; apagar faz com que o texto volte a ser traduzido da próxima vez que aparecer.
*/
function TraducoesDados() {
  const [lingua, setLingua] = useState('en')
  const [filtro, setFiltro] = useState('')
  const [pesquisa, setPesquisa] = useState('')
  const [q, setQ] = useState('')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [edicao, setEdicao] = useState(null) // { chave, texto }
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    const p = new URLSearchParams({ lingua, ...(q ? { q } : {}), ...(filtro ? { revisto: filtro } : {}) })
    api(`/traducoes/dados?${p}`).then((r) => { setErro(''); setDados(r) }).catch((e) => setErro(e.message))
  }, [lingua, q, filtro])
  useEffect(carregar, [carregar])

  async function guardar() {
    try {
      const r = await api(`/traducoes/dados/${lingua}/${edicao.chave}`, { metodo: 'PUT', corpo: { texto: edicao.texto } })
      setDados((d) => ({ ...d, itens: d.itens.map((x) => (x.chave === r.chave ? { ...x, ...r } : x)) }))
      setEdicao(null)
      setAviso({ texto: tx('Tradução corrigida: passa a aparecer assim para todos.') })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  function pedirApagar(x) {
    setConfirmar({
      titulo: tx('Traduzir outra vez'),
      texto: tx('A tradução é apagada e o tradutor automático traduz o texto de novo da próxima vez que aparecer.'),
      botao: tx('Apagar'),
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/traducoes/dados/${lingua}/${x.chave}`, { metodo: 'DELETE' })
          setDados((d) => ({ ...d, total: d.total - 1, itens: d.itens.filter((y) => y.chave !== x.chave) }))
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo={tx('Traduções dos dados')} subtitulo={tx('o que o tradutor automático traduziu no portal e no painel')} migalhas={[{ rotulo: tx('Traduções dos dados') }]} />
      <div className="alert alert-info py-2">
        <i className="fa fa-info-circle me-2" />{tx('Os nomes das cadeiras, os avisos, as notificações e outros dados aparecem em inglês, francês e espanhol pelo tradutor automático. Se uma tradução estiver errada, corrija-a aqui: a correção serve a todos e não volta a ser mudada.')}
      </div>
      {erro && <Erro texto={erro} onRepetir={() => { setErro(''); carregar() }} />}

      <Painel titulo={tx('Traduções{0}', { 0: dados ? ` (${dados.total})` : '' })} corpo={false}>
        <form className="panel-body d-flex gap-2 flex-wrap pb-0" onSubmit={(e) => { e.preventDefault(); setQ(pesquisa.trim()) }}>
          <select className="form-select w-auto" value={lingua} onChange={(e) => { setLingua(e.target.value); setEdicao(null) }} aria-label={tx('Língua')}>
            {Object.entries(LINGUAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="form-select w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label={tx('Estado')}>
            <option value="">{tx('Todas')}</option>
            <option value="nao">{tx('Automáticas (por rever)')}</option>
            <option value="sim">{tx('Revistas à mão')}</option>
          </select>
          <div className="input-group lista-pesquisa">
            <span className="input-group-text"><i className="fa fa-search" /></span>
            <input className="form-control" placeholder={tx('Pesquisar no original ou na tradução…')} value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />
            <button type="submit" className="btn btn-outline-secondary">{tx('Pesquisar')}</button>
          </div>
        </form>
        {!dados && !erro ? <Carregando /> : (
          <div className="table-responsive mt-3">
            <table className="table table-striped align-middle mb-0">
              <thead>
                <tr><th style={{ width: '40%' }}>{tx('Original (português)')}</th><th>{tx('Tradução')}</th><th className="text-end">{tx('Ações')}</th></tr>
              </thead>
              <tbody>
                {dados?.itens.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-4">{tx('Sem traduções.')}</td></tr>}
                {dados?.itens.map((x) => (
                  <tr key={x.chave}>
                    <td translate="no">{x.original}</td>
                    <td translate="no">
                      {edicao?.chave === x.chave
                        ? <textarea className="form-control" rows={Math.min(6, Math.ceil(x.original.length / 60) + 1)} value={edicao.texto} onChange={(e) => setEdicao({ ...edicao, texto: e.target.value })} autoFocus />
                        : <>{x.texto}<div className="small text-muted">{x.revisto ? <span className="badge bg-success">{tx('revista por {0}', { 0: x.revistoPor || '—' })}</span> : <>{tx('automática')} · {dataHora(x.criadoEm)}</>}</div></>}
                    </td>
                    <td className="text-end text-nowrap">
                      {edicao?.chave === x.chave ? (
                        <>
                          <button type="button" className="btn btn-sm btn-success me-1" onClick={guardar}><i className="fa fa-check me-1" />{tx('Guardar')}</button>
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEdicao(null)}>{tx('Cancelar')}</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => setEdicao({ chave: x.chave, texto: x.texto })} title={tx('Corrigir')}><i className="fa fa-pen" /></button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => pedirApagar(x)} title={tx('Traduzir outra vez')}><i className="fa fa-redo" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dados && dados.total > dados.itens.length && <div className="small text-muted p-2">{tx('A mostrar {0} de {1}: use a pesquisa para encontrar as outras.', { 0: dados.itens.length, 1: dados.total })}</div>}
          </div>
        )}
      </Painel>

      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default TraducoesDados
