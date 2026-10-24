import { useEffect, useState } from 'react'
import { abrirCaminho, api, enviarComProgresso } from '../api'
import ZonaUpload from '../ZonaUpload'
import { PERIODOS } from '../regraAvaliacao'
import { t as tx } from '../../i18n/linguas'
import { Carregando } from '../componentes'

const NOMES_IGNORADOS = { quiz: tx('questionários'), forum: tx('fóruns'), h5pactivity: 'H5P', scorm: 'SCORM', lesson: tx('lições'), book: tx('livros'), glossary: tx('glossários'), wiki: 'wiki', workshop: tx('avaliações por pares'), choice: tx('sondagens'), feedback: tx('inquéritos'), ficheiros: tx('ficheiros de tipo não aceite'), ligacoes: tx('ligações inválidas') }

/*
  Importar conteúdos (como o "Importar" e o "Restaurar" do Moodle), em três separadores:
  de outra cadeira do docente, de um ficheiro (cópia do ESGFAA ou curso do Moodle .mbz) e
  descarregar a cópia de segurança desta cadeira.
*/
function Importar({ c, fechar, avisar, concluido }) {
  const [modo, setModo] = useState('cadeira')
  const [ficheiro, setFicheiro] = useState([])
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [aDescarregar, setADescarregar] = useState(false)
  const [lista, setLista] = useState(null)
  const [origem, setOrigem] = useState('')
  const [aImportar, setAImportar] = useState(false)
  useEffect(() => {
    api('/cadeiras').then((l) => {
      const outras = l.filter((x) => x.id !== c.id)
      setLista(outras)
      setOrigem(String(outras.find((x) => x.codigo === c.codigo)?.id || ''))
    }).catch(() => setLista([]))
  }, [c.id, c.codigo])

  async function importar() {
    setAImportar(true)
    try {
      const r = await api(`/cadeiras/${c.id}/importar`, { metodo: 'POST', corpo: { origemId: Number(origem) } })
      avisar({ texto: tx('Importados: {0} capítulos, {1} materiais, {2} trabalhos, {3} questionários.', { 0: r.capitulos, 1: r.materiais, 2: r.trabalhos, 3: r.questionarios }) })
      concluido()
      fechar()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
      setAImportar(false)
    }
  }

  async function restaurar() {
    setAImportar(true)
    try {
      const fd = new FormData()
      fd.append('ficheiro', ficheiro[0].ficheiro)
      const r = await enviarComProgresso(`/cadeiras/${c.id}/restaurar`, fd, { aoProgresso: setProgresso })
      setResultado(r)
      concluido()
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setAImportar(false)
    }
  }

  async function descarregar() {
    setADescarregar(true)
    try {
      await abrirCaminho(`/cadeiras/${c.id}/copia-seguranca`, { nome: `${tx('Cópia')} ${c.codigo} ${c.nome}.zip` })
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message })
    } finally {
      setADescarregar(false)
    }
  }

  const ignorados = resultado ? Object.entries(resultado.ignorados || {}).filter(([, n]) => n > 0) : []
  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="importar-titulo" onClick={() => !aImportar && fechar()}>
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title" id="importar-titulo"><i className="fa fa-file-import me-2" />{tx('Importar e cópias de segurança')}</h4>
              <button type="button" className="btn-close" onClick={fechar} disabled={aImportar} aria-label={tx('Fechar')} />
            </div>
            <div className="modal-body">
              <ul className="nav nav-pills nav-fill mb-3 small" role="tablist">
                {[['cadeira', 'fa-copy', tx('De outra cadeira')], ['ficheiro', 'fa-file-upload', tx('De um ficheiro')], ['copia', 'fa-download', tx('Cópia de segurança')]].map(([k, i, n]) => (
                  <li key={k} className="nav-item"><button type="button" role="tab" aria-selected={modo === k} className={`nav-link ${modo === k ? 'active' : ''}`} onClick={() => { setModo(k); setResultado(null) }} disabled={aImportar}><i className={`fa ${i} me-1`} />{n}</button></li>
                ))}
              </ul>
              {modo === 'cadeira' && (<>
              <p className="small text-muted">{tx('Copia para esta cadeira os capítulos, materiais e ficheiros, trabalhos, questionários, datas, programa e composição das notas de outra cadeira sua (por exemplo, a do ano passado). As datas avançam os anos que separam os anos letivos. Não se copiam entregas, notas nem fórum.')}</p>
              {!lista ? <Carregando compacta /> : lista.length === 0 ? <div className="alert alert-info mb-0">{tx('Não tem outras cadeiras de onde importar.')}</div> : (
                <div className="list-group">
                  {lista.map((x) => (
                    <label key={x.id} className={`list-group-item list-group-item-action d-flex gap-2 align-items-center ${origem === String(x.id) ? 'active' : ''}`}>
                      <input type="radio" name="origem" className="form-check-input mt-0" checked={origem === String(x.id)} onChange={() => setOrigem(String(x.id))} />
                      <span><b>{x.codigo}</b> · {x.nome}<span className="d-block small opacity-75">{x.turma?.nome} · {PERIODOS[x.periodo]}</span></span>
                    </label>
                  ))}
                </div>
              )}
              </>)}

              {modo === 'ficheiro' && (resultado ? (
                <div className="alert alert-success mb-0">
                  <b className="d-block mb-1"><i className="fa fa-check-circle me-1" />{resultado.formato === 'moodle' ? tx('Curso do Moodle importado') : tx('Cópia restaurada')}{resultado.origem ? `: ${resultado.origem}` : ''}</b>
                  {tx('Importados: {0} capítulos, {1} materiais, {2} trabalhos, {3} questionários.', { 0: resultado.capitulos, 1: resultado.materiais, 2: resultado.trabalhos, 3: resultado.questionarios })}
                  {ignorados.length > 0 && <div className="small mt-2">{tx('Não importado (refaça no portal):')} {ignorados.map(([k, n]) => `${n} ${NOMES_IGNORADOS[k] || k}`).join(', ')}.</div>}
                  <div className="small mt-2 text-muted">{tx('Os questionários ficam por publicar e os prazos mantêm-se: reveja-os antes de abrir aos estudantes.')}</div>
                </div>
              ) : (
                <>
                  <p className="small text-muted">{tx('Junte à cadeira o conteúdo de uma cópia de segurança do ESGFAA (.zip) ou de um curso do Moodle (.mbz). Do Moodle entram os tópicos, páginas, rótulos, ligações, ficheiros, pastas e trabalhos; o que não tiver equivalente é indicado no fim. O que a cadeira já tem fica como está.')}</p>
                  <ZonaUpload id="importar-ficheiro" ficheiros={ficheiro} aoMudar={(l) => setFicheiro(l.slice(-1))} desativado={aImportar} aceitar=".zip,.mbz" nota={tx('Ficheiro .zip (ESGFAA) ou .mbz (Moodle)')} />
                  {aImportar && <div className="progress mt-2" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${progresso}%` }} /></div>}
                </>
              ))}

              {modo === 'copia' && (
                <div className="text-center py-2">
                  <p className="small text-muted text-start">{tx('Descarrega num só ficheiro (.zip) tudo o que esta cadeira tem: capítulos, materiais com os ficheiros, trabalhos, questionários com as perguntas, sondagens, avaliação por pares, datas, programa e composição das notas. Não leva entregas, notas nem dados dos estudantes. Guarde-a num lugar seguro; para a usar, escolha «De um ficheiro» nesta ou noutra cadeira.')}</p>
                  <button type="button" className="btn btn-theme" onClick={descarregar} disabled={aDescarregar}><i className="fa fa-download me-1" />{aDescarregar ? tx('A preparar…') : tx('Descarregar a cópia de segurança')}</button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-white" onClick={fechar} disabled={aImportar}>{resultado || modo === 'copia' ? tx('Fechar') : tx('Cancelar')}</button>
              {modo === 'cadeira' && <button type="button" className="btn btn-theme" onClick={importar} disabled={!origem || aImportar}>{aImportar ? tx('A importar…') : tx('Importar')}</button>}
              {modo === 'ficheiro' && !resultado && <button type="button" className="btn btn-theme" onClick={restaurar} disabled={!ficheiro.length || aImportar}>{aImportar ? tx('A importar…') : tx('Importar o ficheiro')}</button>}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}

export default Importar
