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
const ESTADOS = { 'por criar': 'text-primary', completar: 'text-primary', criada: 'text-success', completada: 'text-success', 'por carregar': 'text-primary', carregada: 'text-success', 'já existe': 'text-muted', 'sem curso': 'text-danger', 'ano fechado': 'text-warning' }

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
      if (!Array.isArray(j?.turmas)) throw new Error('Este ficheiro não é o das pautas do arquivo nem o do arranque do ano (falta a lista de turmas).')
      // o arranque do ano lectivo (turmas do ano, cadeiras, departamentos e docentes) ou as pautas do arquivo
      const arranque = j.tipo === 'arranque-ano-lectivo'
      const dados = arranque ? { anoLetivo: j.anoLetivo, cadeiras: j.cadeiras ?? [], turmas: j.turmas } : { turmas: j.turmas }
      setFicheiro({ nome: f.name, arranque, dados, avisos: j.avisos ?? [] })
      setR(await api(arranque ? '/academico/arquivo/arrancar' : '/academico/arquivo/importar', { metodo: 'POST', corpo: { ...dados, simular: true } }))
    } catch (e) { setErro(e.message) }
  }

  async function carregar() {
    setAGravar(true); setErro('')
    try {
      const x = await api(ficheiro.arranque ? '/academico/arquivo/arrancar' : '/academico/arquivo/importar', { metodo: 'POST', corpo: { ...ficheiro.dados, simular: false } })
      setR(x)
      if (ficheiro.arranque) setAviso({ texto: `Ano lectivo ${x.anoLetivo}: ${x.turmas.length} turma(s) com as cadeiras, as matrículas, os departamentos e os docentes propostos (a distribuição segue para o Comandante em Alocação de docentes).` })
      else setAviso({ texto: `${x.turmas.filter((t) => t.estado === 'carregada').length} turma(s) do arquivo carregada(s): pautas finais, notas e históricos já disponíveis.` })
    } catch (e) { setErro(e.message) }
    setAGravar(false)
  }

  const porCarregar = r?.turmas.filter((t) => ['por carregar', 'por criar', 'completar'].includes(t.estado)).length ?? 0
  return (
    <>
      <CabecalhoPagina titulo="Carregar o arquivo e as turmas do ano" subtitulo="as pautas assinadas dos anos anteriores; as turmas, cadeiras, departamentos e docentes do ano lectivo" migalhas={[{ rotulo: 'Administração Escolar' }, { rotulo: 'Carregar o arquivo' }]} />
      <div className="alert alert-info small">
        <i className="fa fa-info-circle me-1" /><b>Para que serve:</b> a instalação já carregou sozinha os dados que vieram no pendrive (as pautas do arquivo de 2021/2022 a 2025/2026 e as turmas de 2026/2027). Esta página só é precisa para carregar outra vez (por exemplo, quando o Pessoal enviar discentes que ainda não tinham conta) ou para um ano lectivo novo. Repetir não duplica nada. Para <b>ver outro ano lectivo</b>, escolha-o no menu, em «Ano lectivo».
      </div>
      {aviso && <Aviso {...aviso} />}
      <Painel titulo="Ficheiro das pautas do arquivo">
        <p className="small text-muted">O ficheiro (.json) vem do conversor das pautas do arquivo (docs/ARQUIVO 2023-2024, 2024-2025, 2025-2026). Os discentes entram pela conta do portal que o Sistema de Pessoal criou; quem ainda não tem conta fica para depois — volte a carregar o mesmo ficheiro quando o Pessoal os tiver enviado (não se repete nada).</p>
        <input type="file" accept=".json,application/json" className="form-control" disabled={!pode('academico.gerir')} onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} aria-label="Ficheiro das pautas do arquivo" />
      </Painel>
      {erro && <Erro texto={erro} />}
      {ficheiro?.avisos?.length > 0 && <Painel titulo={`Para conferir (${ficheiro.avisos.length})`}><ul className="small mb-0">{ficheiro.avisos.map((a) => <li key={a}>{a}</li>)}</ul></Painel>}
      {r && (
        <Painel titulo={r.simulado ? `O que vai entrar (${ficheiro?.nome ?? ''})` : 'Resultado'}>
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead><tr><th>Turma</th><th className="text-end">Cadeiras</th><th className="text-end">Discentes</th><th className="text-end">Com conta</th><th>Estado</th></tr></thead>
              <tbody>
                {r.turmas.map((t) => (
                  <tr key={t.turma}>
                    <td>{t.turma}</td><td className="text-end">{Array.isArray(t.cadeiras) ? t.cadeiras.length : t.cadeiras}</td><td className="text-end">{t.discentes}</td><td className="text-end">{t.comConta}</td>
                    <td>
                      <span className={`fw-bold ${ESTADOS[t.estado] ?? ''}`}>{t.estado}</span>
                      {Array.isArray(t.cadeiras) && t.cadeiras.length > 0 && <details className="small"><summary>{t.cadeiras.length} cadeiras: departamento e docentes</summary>
                        <table className="table table-sm mb-0"><thead><tr><th>Cadeira</th><th>Departamento</th><th>Docentes propostos</th></tr></thead>
                          <tbody>{t.cadeiras.map((c) => <tr key={c.codigo}><td>{c.codigo} — {c.nome}{c.catalogo && c.catalogo !== c.nome && <div className="text-muted">nas listas: {c.catalogo}</div>}</td><td>{c.departamento || <span className="text-warning">por atribuir</span>}</td><td>{c.docentes.join(', ') || '—'}{c.docentesSemConta.length > 0 && <div className="text-muted">sem conta: {c.docentesSemConta.join(', ')}</div>}</td></tr>)}</tbody></table>
                      </details>}
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
              <i className={`fa ${aGravar ? 'fa-spinner fa-spin' : 'fa-box-archive'} me-1`} />{ficheiro?.arranque ? `Arrancar o ano ${ficheiro.dados.anoLetivo} (${porCarregar} turma(s))` : `Carregar ${porCarregar} turma(s)`}
            </button>
          )}
          {!r.simulado && <p className="mb-0"><Link to="/academico/turmas">Ver as turmas</Link> (escolha o ano lectivo no menu): cada turma do arquivo tem a pauta final, como a assinada.</p>}
        </Painel>
      )}
    </>
  )
}

export default Arquivo
