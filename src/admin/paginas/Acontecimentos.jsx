import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { NOMES_ACOES } from '../esquemas'
import { CabecalhoPagina, Carregando, Erro, Painel } from '../componentes/Ui'
import { dataHora } from '../formatar'
import { t as tx } from '../../i18n/linguas'

const PERIODOS = [[1, tx('Últimas 24 horas')], [7, tx('Últimos 7 dias')], [30, tx('Últimos 30 dias')]]
const TITULOS = {
  decisoes: tx('Decisões do Comandante'),
  contas: tx('Contas, papéis e acessos'),
  notas: tx('Notas e documentos académicos'),
  publicacoes: tx('Site e portal'),
  seguranca: tx('Segurança'),
}

/*
  Acontecimentos importantes (para o Comandante): do registo de atividades, só o que conta — as decisões,
  as contas e os papéis, as notas e os documentos académicos, o que se publica e a segurança — por grupo,
  com quantos houve no período e os mais recentes. O resto fica no Registo de atividades.
*/
function Acontecimentos() {
  const [dias, setDias] = useState(7)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => { api(`/acontecimentos?dias=${dias}`).then((r) => { setErro(''); setD(r) }).catch((e) => setErro(e.message)) }, [dias])

  return (
    <>
      <CabecalhoPagina titulo={tx('Acontecimentos importantes')} subtitulo={tx('o que de importante se passou no sistema')} migalhas={[{ rotulo: tx('Acontecimentos importantes') }]}>
        <div className="btn-group" role="group" aria-label={tx('Período')}>
          {PERIODOS.map(([n, rotulo]) => <button key={n} type="button" className={`btn ${dias === n ? 'btn-theme' : 'btn-white'}`} onClick={() => setDias(n)} aria-pressed={dias === n}>{rotulo}</button>)}
        </div>
      </CabecalhoPagina>
      {erro && <Erro texto={erro} />}
      {!d && !erro && <Carregando />}
      {d && (
        <div className="row">
          {d.grupos.map((g) => (
            <div key={g.id} className="col-xl-6">
              <Painel titulo={<><i className={`fa ${g.icone} me-2`} />{TITULOS[g.id] ?? g.titulo} <span className="badge bg-gray-300 text-gray-800 ms-1">{g.total}</span></>} corpo={false}>
                {g.linhas.length === 0 && <div className="panel-body text-muted">{tx('Nada neste período.')}</div>}
                <div className="list-group list-group-flush">
                  {g.linhas.map((l) => (
                    <div key={l.id} className="list-group-item">
                      <div className="d-flex flex-wrap gap-2">
                        <span className="fw-bold flex-grow-1">{NOMES_ACOES[l.acao] ?? l.acao}{l.alvo_titulo ? `: ${l.alvo_titulo}` : ''}</span>
                        <span className="small text-muted text-nowrap">{dataHora(l.data)}</span>
                      </div>
                      <div className="small text-muted">{l.utilizador_nome || tx('Sistema ou visitante')}{l.ip ? ` · ${l.ip}` : ''}</div>
                    </div>
                  ))}
                </div>
                {g.total > g.linhas.length && <div className="panel-body py-2 small"><Link to="/atividades">{tx('Ver tudo no Registo de atividades ({0})', { 0: g.total })}</Link></div>}
              </Painel>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default Acontecimentos
