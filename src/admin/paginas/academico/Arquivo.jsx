import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useSessao } from '../../sessaoContexto'
import { Aviso, CabecalhoPagina, Erro, Painel } from '../../componentes/Ui'

/*
  Arquivo da Repartição de Administração Escolar: as pautas assinadas dos anos anteriores (o ficheiro que o
  conversor do arquivo prepara a partir das pautas em Excel). Primeiro mostra o que vai entrar — as turmas, as
  cadeiras, os discentes com conta no portal e os que ainda não a têm —, depois carrega. O que já está no
  sistema não muda; os anos fechados ficam de fora (reabrem-se por ordem do Comandante).
*/
const ESTADOS = { 'por carregar': 'text-primary', carregada: 'text-success', 'já existe': 'text-muted', 'sem curso': 'text-danger', 'ano fechado': 'text-warning' }

function Arquivo() {
  const { pode } = useSessao()
  const [ficheiro, setFicheiro] = useState(null)
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function ler(f) {
    setErro(''); setR(null); setAviso(null)
    try {
      const j = JSON.parse(await f.text())
      if (!Array.isArray(j?.turmas)) throw new Error('Este ficheiro não é o das pautas do arquivo (falta a lista de turmas).')
      setFicheiro({ nome: f.name, turmas: j.turmas })
      setR(await api('/academico/arquivo/importar', { metodo: 'POST', corpo: { turmas: j.turmas, simular: true } }))
    } catch (e) { setErro(e.message) }
  }

  async function carregar() {
    setAGravar(true); setErro('')
    try {
      const x = await api('/academico/arquivo/importar', { metodo: 'POST', corpo: { turmas: ficheiro.turmas, simular: false } })
      setR(x)
      const n = x.turmas.filter((t) => t.estado === 'carregada').length
      setAviso({ texto: `${n} turma(s) do arquivo carregada(s): pautas finais, notas e históricos já disponíveis.` })
    } catch (e) { setErro(e.message) }
    setAGravar(false)
  }

  const porCarregar = r?.turmas.filter((t) => t.estado === 'por carregar').length ?? 0
  return (
    <>
      <CabecalhoPagina titulo="Arquivo (pautas dos anos anteriores)" subtitulo="as pautas assinadas entram como estão: notas, média final e classificação" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Arquivo' }]} />
      {aviso && <Aviso {...aviso} />}
      <Painel titulo="Ficheiro das pautas do arquivo">
        <p className="small text-muted">O ficheiro (.json) vem do conversor das pautas do arquivo (docs/ARQUIVO 2023-2024, 2024-2025, 2025-2026). Os discentes entram pela conta do portal que o Sistema de Pessoal criou; quem ainda não tem conta fica para depois — volte a carregar o mesmo ficheiro quando o Pessoal os tiver enviado (não se repete nada).</p>
        <input type="file" accept=".json,application/json" className="form-control" disabled={!pode('academico.gerir')} onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} aria-label="Ficheiro das pautas do arquivo" />
      </Painel>
      {erro && <Erro texto={erro} />}
      {r && (
        <Painel titulo={r.simulado ? `O que vai entrar (${ficheiro?.nome ?? ''})` : 'Resultado'}>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Turma</th><th className="text-end">Cadeiras</th><th className="text-end">Discentes</th><th className="text-end">Com conta</th><th>Estado</th></tr></thead>
              <tbody>
                {r.turmas.map((t) => (
                  <tr key={t.turma}>
                    <td>{t.turma}</td><td className="text-end">{t.cadeiras}</td><td className="text-end">{t.discentes}</td><td className="text-end">{t.comConta}</td>
                    <td>
                      <span className={`fw-bold ${ESTADOS[t.estado] ?? ''}`}>{t.estado}</span>
                      {t.motivo && <div className="small text-muted">{t.motivo}</div>}
                      {t.semConta.length > 0 && <details className="small"><summary>{t.semConta.length} sem conta no portal</summary>{t.semConta.join('; ')}</details>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.simulado && pode('academico.gerir') && (
            <button type="button" className="btn btn-theme" disabled={!porCarregar || aGravar} onClick={carregar}>
              <i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-box-archive'} me-1`} />Carregar {porCarregar} turma(s)
            </button>
          )}
          {!r.simulado && <p className="mb-0"><Link to="/academico/turmas">Ver as turmas</Link> (escolha o ano lectivo no menu): cada turma do arquivo tem a pauta final, como a assinada.</p>}
        </Painel>
      )}
    </>
  )
}

export default Arquivo
