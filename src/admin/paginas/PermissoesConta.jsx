import { useEffect, useState } from 'react'
import { api } from '../api'
import { NOMES_PERMISSOES, NOMES_RECURSOS } from '../esquemas'
import { Carregando, Painel } from '../componentes/Ui'
import { t as tx } from '../../i18n/linguas'

/*
  O Comandante escolhe o que uma conta do painel pode fazer, permissão a permissão (recurso × ação), a partir
  das do papel. Vale logo (as permissões leem-se em cada pedido) e fica no registo de atividades.
*/
export default function PermissoesConta({ u, eu, aoFechar, aoGuardar }) {
  const [catalogo, setCatalogo] = useState(null)
  const [lista, setLista] = useState(() => [...(u.permissoesEfectivas ?? [])])
  const [erro, setErro] = useState('')
  const [aGuardar, setAGuardar] = useState(false)
  useEffect(() => { api('/papeis').then(setCatalogo).catch((e) => setErro(e.message)) }, [])
  if (!catalogo) return <Painel titulo={tx('O que {0} pode fazer', { 0: u.nome })}>{erro ? <div className="alert alert-danger">{erro}</div> : <Carregando />}</Painel>

  const doPapel = catalogo.papeis.find((p) => p.id === u.papel)?.permissoes ?? []
  const acoes = [...new Set(catalogo.recursos.flatMap((r) => r.acoes))]
  const nomeAcao = (a) => NOMES_PERMISSOES[a] ?? a
  const igualPapel = lista.length === doPapel.length && lista.every((p) => doPapel.includes(p))
  function alternar(perm) {
    const tem = lista.includes(perm)
    const [recurso, acao] = perm.split('.')
    let n = tem ? lista.filter((p) => p !== perm) : [...lista, perm]
    // qualquer ação implica «ver»; tirar «ver» tira as restantes
    if (!tem && acao !== 'ver' && catalogo.recursos.find((r) => r.id === recurso)?.acoes.includes('ver')) n = [...new Set([...n, `${recurso}.ver`])]
    if (tem && acao === 'ver') n = n.filter((p) => !p.startsWith(`${recurso}.`))
    setLista(n)
  }
  async function guardar(permissoes) {
    setAGuardar(true)
    setErro('')
    try {
      await api(`/utilizadores/${u.id}/permissoes`, { metodo: 'PUT', corpo: { permissoes } })
      aoGuardar(permissoes === null ? tx('{0} volta às permissões do papel.', { 0: u.nome }) : tx('O que {0} pode fazer ficou definido (já vale).', { 0: u.nome }))
    } catch (e) {
      setErro(e.message)
    } finally {
      setAGuardar(false)
    }
  }
  return (
    <Painel titulo={tx('O que {0} pode fazer', { 0: u.nome })} acoes={<button type="button" className="btn btn-xs btn-white" onClick={aoFechar}><i className="fa fa-times" /></button>}>
      {erro && <div className="alert alert-danger py-2">{erro}</div>}
      <p className="small text-muted">{tx('Papel')}: <b>{u.papel}</b> · {u.permissoes ? tx('com permissões próprias') : tx('com as permissões do papel')}. {tx('Marque o que a conta pode fazer em cada área; o que difere do papel fica a amarelo. A sua escolha vale logo e fica no registo de atividades.')}</p>
      {u.id === eu.id && <div className="alert alert-info py-2 small">{tx('É a sua conta: não pode tirar a si próprio a aprovação das contas.')}</div>}
      <div className="table-responsive">
        <table className="table table-bordered align-middle text-center mb-0 tabela-permissoes">
          <thead><tr><th className="text-start">{tx('Área')}</th>{acoes.map((a) => <th key={a}>{nomeAcao(a)}</th>)}</tr></thead>
          <tbody>
            {catalogo.recursos.map((r) => (
              <tr key={r.id}>
                <th className="text-start fw-bold">{NOMES_RECURSOS[r.id] || r.id}</th>
                {acoes.map((a) => {
                  if (!r.acoes.includes(a)) return <td key={a} className="bg-gray-100" />
                  const perm = `${r.id}.${a}`
                  const tem = lista.includes(perm)
                  return (
                    <td key={a} className={tem !== doPapel.includes(perm) ? 'table-warning' : ''}>
                      <input type="checkbox" className="form-check-input" checked={tem} onChange={() => alternar(perm)} aria-label={`${NOMES_RECURSOS[r.id] || r.id}: ${nomeAcao(a)}`} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex gap-2 justify-content-end mt-3 flex-wrap">
        {u.permissoes && <button type="button" className="btn btn-white me-auto" disabled={aGuardar} onClick={() => guardar(null)}><i className="fa fa-undo me-1" />{tx('Voltar às do papel')}</button>}
        <button type="button" className="btn btn-white" onClick={aoFechar}>{tx('Cancelar')}</button>
        <button type="button" className="btn btn-theme" disabled={aGuardar} onClick={() => guardar(igualPapel ? null : lista)}><i className="fa fa-stamp me-1" />{tx('Decidir (vale já)')}</button>
      </div>
    </Painel>
  )
}
