import { useCallback, useEffect, useState } from 'react'
import { abrirFicheiro, api } from '../api'
import { useSessao } from '../sessao'
import { Cabecalho, Carregando, Painel } from '../componentes/Ui'
import { dataHoraPt } from '../formatar'

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`

/*
  Cópias de segurança: o sistema faz uma por dia sozinho; aqui faz-se uma à mão quando se quiser (antes de uma
  grande alteração, ou para levar num disco externo) e descarrega-se o ficheiro cifrado para guardar fora do servidor.
*/
export default function Copias() {
  const { pode, avisar } = useSessao()
  const [d, setD] = useState(null)
  const [aCopiar, setACopiar] = useState(false)
  const carregar = useCallback(() => api('/copias').then(setD).catch((x) => avisar(x.message, 'erro')), [avisar])
  useEffect(() => { carregar() }, [carregar])
  async function copiar() {
    setACopiar(true)
    try {
      setD(await api('/copias', { metodo: 'POST' }))
      avisar('Cópia de segurança feita.')
    } catch (x) {
      avisar(x.message, 'erro')
    } finally {
      setACopiar(false)
    }
  }
  if (!d) return <Carregando />
  const ult = d.ultimaAutomatica
  return (
    <>
      <Cabecalho titulo="Cópias de segurança" subtitulo="a base de dados e os ficheiros (fotografias, documentos digitalizados), cifrados" migalhas={[['Administração'], ['Cópias de segurança']]}>
        {pode('administrar') && (
          <button type="button" className="btn btn-theme" disabled={aCopiar || !d.disponivel || d.aCopiar} onClick={copiar}>
            <i className={`fa ${aCopiar || d.aCopiar ? 'fa-spinner fa-spin' : 'fa-shield-alt'} me-1`} />{aCopiar || d.aCopiar ? 'A fazer a cópia… (pode demorar uns minutos)' : 'Fazer uma cópia agora'}
          </button>
        )}
      </Cabecalho>
      {!d.disponivel && <div className="alert alert-warning">As cópias manuais não estão disponíveis neste servidor (falta o programa das cópias ou a COPIAS_CHAVE na configuração).</div>}
      <div className="row">
        <div className="col-xl-4">
          <Painel titulo="Como funciona" icone="fa-info-circle">
            <p>O sistema faz <strong>uma cópia por dia</strong> sozinho (às 2h) e guarda as últimas 30. Aqui pode fazer uma <strong>quando quiser</strong>: antes de uma grande alteração, ou para a levar num disco externo.</p>
            <p>Cada cópia leva a <strong>base de dados</strong> e os <strong>ficheiros</strong> (fotografias e documentos digitalizados), num só ficheiro <code>.esgc</code> <strong>cifrado</strong>.</p>
            <p className="mb-2"><i className="fa fa-key me-1 text-warning" />A cópia só abre com a <strong>COPIAS_CHAVE</strong> (está no ficheiro de configuração do servidor, <code>C:\ESG-Pessoal\config\pessoal.env</code>): guarde essa chave num cofre, fora do servidor.</p>
            <p className="mb-0 small text-muted">Pasta das cópias no servidor: <code>{d.pasta}</code></p>
          </Painel>
          <Painel titulo="Última cópia automática" icone="fa-clock">
            {!ult ? <p className="text-muted mb-0">Ainda não há registo da cópia automática.</p> : (
              <p className="mb-0">{dataHoraPt(ult.quando)} — {ult.ok === false || ult.erro ? <span className="text-danger"><i className="fa fa-times-circle me-1" />falhou: {ult.erro}</span> : <span className="text-success"><i className="fa fa-check-circle me-1" />feita</span>}</p>
            )}
          </Painel>
        </div>
        <div className="col-xl-8">
          <Painel titulo={`Cópias guardadas (${d.copias.length})`} icone="fa-database" corpo={false}>
            {!d.copias.length ? <p className="text-muted p-3 mb-0">Ainda não há cópias.</p> : (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead><tr><th>Quando</th><th>Ficheiro</th><th className="text-end">Tamanho</th><th /></tr></thead>
                  <tbody>
                    {d.copias.map((c) => (
                      <tr key={c.nome}>
                        <td>{dataHoraPt(c.quando)}</td>
                        <td className="small"><code>{c.nome}</code></td>
                        <td className="text-end">{mb(c.tamanho)}</td>
                        <td className="text-end">{pode('administrar') && <button type="button" className="btn btn-xs btn-white" onClick={() => abrirFicheiro(`/copias/${encodeURIComponent(c.nome)}`, c.nome).catch((x) => avisar(x.message, 'erro'))}><i className="fa fa-download me-1" />Descarregar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </div>
      </div>
    </>
  )
}
