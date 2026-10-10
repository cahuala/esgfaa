import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessao } from '../sessaoContexto'
import { NOMES_PERMISSOES, NOMES_RECURSOS } from '../esquemas'
import { Aviso, CabecalhoPagina, Carregando, Confirmar, Erro, Painel } from '../componentes/Ui'

const ACOES = ['ver', 'criar', 'editar', 'apagar', 'publicar', 'gerir']

// Gestão de papéis (RBAC): grelha recursos × ações
function Papeis() {
  const { pode } = useSessao()
  const gerir = pode('papeis.gerir')
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [selecionado, setSelecionado] = useState(null) // cópia em edição
  const [aGuardar, setAGuardar] = useState(false)
  const [confirmar, setConfirmar] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback((escolher) => {
    api('/papeis').then((r) => {
      setErro('')
      setDados(r)
      const alvo = r.papeis.find((p) => p.id === escolher) || r.papeis[0]
      setSelecionado(alvo ? structuredClone(alvo) : null)
    }).catch((e) => setErro(e.message))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const original = dados?.papeis.find((p) => p.id === selecionado?.id)
  const alterado = selecionado && original && JSON.stringify(selecionado) !== JSON.stringify(original)
  const bloqueado = !gerir || selecionado?.sistema

  function alternar(perm) {
    const tem = selecionado.permissoes.includes(perm)
    let lista = tem ? selecionado.permissoes.filter((p) => p !== perm) : [...selecionado.permissoes, perm]
    const [recurso, acao] = perm.split('.')
    // coerência: qualquer ação implica "ver"; tirar "ver" tira as restantes
    if (!tem && acao !== 'ver') lista = [...new Set([...lista, `${recurso}.ver`])]
    if (tem && acao === 'ver') lista = lista.filter((p) => !p.startsWith(`${recurso}.`))
    setSelecionado({ ...selecionado, permissoes: lista })
  }

  function alternarLinha(recurso) {
    const todas = recurso.acoes.map((a) => `${recurso.id}.${a}`)
    const completas = todas.every((p) => selecionado.permissoes.includes(p))
    const lista = completas
      ? selecionado.permissoes.filter((p) => !todas.includes(p))
      : [...new Set([...selecionado.permissoes, ...todas])]
    setSelecionado({ ...selecionado, permissoes: lista })
  }

  async function guardar() {
    setAGuardar(true)
    try {
      await api(`/papeis/${selecionado.id}`, { metodo: 'PUT', corpo: selecionado })
      setAviso({ texto: `Papel “${selecionado.nome}” guardado. As alterações aplicam-se de imediato.` })
      carregar(selecionado.id)
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setAGuardar(false)
    }
  }

  async function novoPapel() {
    try {
      const { id } = await api('/papeis', { metodo: 'POST', corpo: { nome: 'Novo papel', descricao: '', permissoes: [] } })
      setAviso({ texto: 'Papel criado. Dê-lhe um nome e escolha as permissões.' })
      carregar(id)
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  function apagar() {
    setConfirmar({
      titulo: 'Apagar papel',
      texto: <>Apagar o papel <b>{selecionado.nome}</b>? Só é possível se nenhum utilizador o tiver.</>,
      botao: 'Apagar',
      perigo: true,
      confirmar: async () => {
        setConfirmar(null)
        try {
          await api(`/papeis/${selecionado.id}`, { metodo: 'DELETE' })
          setAviso({ texto: 'Papel apagado.' })
          carregar()
        } catch (e) {
          setAviso({ tipo: 'erro', texto: e.message })
        }
      },
    })
  }

  return (
    <>
      <CabecalhoPagina titulo="Papéis e permissões" subtitulo="controlo de acessos (RBAC)" migalhas={[{ rotulo: 'Papéis e permissões' }]}>
        {gerir && <button className="btn btn-theme" onClick={novoPapel}><i className="fa fa-plus me-1" /> Novo papel</button>}
      </CabecalhoPagina>
      {erro && <Erro texto={erro} onRepetir={() => carregar()} />}
      {!dados && !erro && <Carregando />}

      {dados && selecionado && (
        <div className="row">
          <div className="col-xl-3">
            <Painel titulo="Papéis" corpo={false}>
              <div className="list-group list-group-flush rounded-bottom">
                {dados.papeis.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`list-group-item list-group-item-action ${p.id === selecionado.id ? 'active' : ''}`}
                    onClick={() => setSelecionado(structuredClone(p))}
                  >
                    <div className="d-flex align-items-center">
                      <span className="fw-bold flex-grow-1">{p.nome}</span>
                      {p.sistema && <i className="fa fa-lock ms-2" title="Papel de sistema" />}
                    </div>
                    <small className={p.id === selecionado.id ? '' : 'text-muted'}>
                      {p.utilizadores} utilizador(es) · {p.permissoes.length} permissões
                    </small>
                  </button>
                ))}
              </div>
            </Painel>
          </div>

          <div className="col-xl-9">
            <Painel titulo={`Permissões — ${selecionado.nome}`}>
              {selecionado.sistema && (
                <div className="alert alert-info py-2"><i className="fa fa-lock me-2" />O Administrador tem sempre acesso total. Este papel não pode ser alterado nem apagado.</div>
              )}
              {!gerir && !selecionado.sistema && (
                <div className="alert alert-warning py-2"><i className="fa fa-eye me-2" />Só pode consultar. Alterar papéis exige a permissão “Papéis e permissões → Gerir”.</div>
              )}

              <div className="form-horizontal">
                <div className="row mb-15px">
                  <label className="form-label col-form-label col-md-3" htmlFor="papel-nome">Nome do papel</label>
                  <div className="col-md-9">
                    <input id="papel-nome" className="form-control" value={selecionado.nome} disabled={bloqueado} onChange={(e) => setSelecionado({ ...selecionado, nome: e.target.value })} />
                  </div>
                </div>
                <div className="row mb-15px">
                  <label className="form-label col-form-label col-md-3" htmlFor="papel-desc">Descrição</label>
                  <div className="col-md-9">
                    <input id="papel-desc" className="form-control" value={selecionado.descricao || ''} disabled={bloqueado} onChange={(e) => setSelecionado({ ...selecionado, descricao: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle text-center mb-0 tabela-permissoes">
                  <thead>
                    <tr>
                      <th className="text-start">Área</th>
                      {ACOES.map((a) => <th key={a}>{NOMES_PERMISSOES[a]}</th>)}
                      <th>Tudo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.recursos.map((r) => {
                      const completas = r.acoes.every((a) => selecionado.permissoes.includes(`${r.id}.${a}`))
                      return (
                        <tr key={r.id}>
                          <th className="text-start fw-bold">{NOMES_RECURSOS[r.id] || r.id}</th>
                          {ACOES.map((a) => {
                            if (!r.acoes.includes(a)) return <td key={a} className="bg-gray-100" />
                            const perm = `${r.id}.${a}`
                            return (
                              <td key={a}>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selecionado.permissoes.includes(perm)}
                                  disabled={bloqueado}
                                  onChange={() => alternar(perm)}
                                  aria-label={`${NOMES_RECURSOS[r.id]}: ${NOMES_PERMISSOES[a]}`}
                                />
                              </td>
                            )
                          })}
                          <td>
                            <input type="checkbox" className="form-check-input" checked={completas} disabled={bloqueado} onChange={() => alternarLinha(r)} aria-label={`${NOMES_RECURSOS[r.id]}: tudo`} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="small text-muted mt-3">
                <i className="fa fa-info-circle me-1" /><b>Publicar</b>: quem não a tem guarda só rascunhos e não altera conteúdos já publicados.
                Qualquer ação marca automaticamente <b>Ver</b>.
              </div>

              {!bloqueado && (
                <div className="d-flex justify-content-between mt-4">
                  <button className="btn btn-white text-danger" onClick={apagar} disabled={selecionado.utilizadores > 0} title={selecionado.utilizadores > 0 ? 'Há utilizadores com este papel' : ''}>
                    <i className="fa fa-trash-alt me-1" /> Apagar papel
                  </button>
                  <div className="d-flex gap-2">
                    <button className="btn btn-white" disabled={!alterado} onClick={() => setSelecionado(structuredClone(original))}>Anular alterações</button>
                    <button className="btn btn-theme" disabled={!alterado || aGuardar} onClick={guardar}><i className="fa fa-save me-1" /> Guardar papel</button>
                  </div>
                </div>
              )}
            </Painel>
          </div>
        </div>
      )}

      <Confirmar pedido={confirmar} onCancelar={() => setConfirmar(null)} />
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Papeis
