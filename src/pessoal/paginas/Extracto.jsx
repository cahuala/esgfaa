import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { abrirFicheiro, api } from '../api'
import { useSessao } from '../sessao'
import { useDados } from '../useDados'
import EscolherPessoa from '../componentes/EscolherPessoa'
import Foto from '../componentes/Foto'
import { Cabecalho, Carregando, Erro, Escolha, Painel } from '../componentes/Ui'
import { dataHoraPt, dataPt } from '../formatar'

const POR = { nip: ['NIP no texto', 'bg-success'], agente: ['N.º de agente no texto', 'bg-success'], nome: ['Nome no texto', 'bg-info'], proposta: ['Da proposta', 'bg-primary'], manual: ['Junto à mão', 'bg-secondary'] }

export default function Extracto() {
  const { id } = useParams()
  const { ref, pode, avisar } = useSessao()
  const { dados: carregado, erro } = useDados(`/extractos/${id}`)
  const [alterado, setE] = useState(null)
  const e = alterado?.id === Number(id) ? alterado : carregado
  const { dados: cargos } = useDados(e?.tipo === 'nomeacao' ? '/cargos' : null)
  const [aAplicar, setAAplicar] = useState(false)
  const acao = async (caminho, metodo, corpo, msg) => {
    try { setE(await api(`/extractos/${id}${caminho}`, { metodo, corpo })); if (msg) avisar(msg) } catch (x) { avisar(x.message, 'erro') }
  }
  if (erro) return <Erro texto={erro} />
  if (!e) return <Carregando />
  const pendente = e.estado === 'pendente' && pode('editar')
  const comPosto = ['promocao', 'graduacao'].includes(e.tipo)
  async function aplicar() {
    if (!window.confirm(`Aplicar o extracto n.º ${e.numero} às fichas de ${e.itens.length} pessoa(s)? As fichas e os processos individuais são actualizados.`)) return
    setAAplicar(true)
    await acao('/aplicar', 'POST', undefined, 'Extracto aplicado: fichas actualizadas e anexado aos processos individuais.')
    setAAplicar(false)
  }
  return (
    <>
      <Cabecalho titulo={`Extracto n.º ${e.numero}`} subtitulo={e.tipoNome} migalhas={[['Extractos', '/extractos'], [`N.º ${e.numero}`]]}>
        {e.ficheiro && <button type="button" className="btn btn-outline-secondary" onClick={() => abrirFicheiro(`/extractos/${e.id}/ficheiro`, e.nomeOriginal).catch((x) => avisar(x.message, 'erro'))}><i className="fa fa-file-pdf me-1" />Ver o extracto</button>}
        {pendente && <button type="button" className="btn btn-success" disabled={aAplicar || !e.itens.length} onClick={aplicar}><i className="fa fa-check-double me-1" />Aplicar às fichas</button>}
        {pendente && <button type="button" className="btn btn-link text-danger" onClick={() => window.confirm('Apagar este extracto?') && api(`/extractos/${id}`, { metodo: 'DELETE' }).then(() => { window.location.hash = '#/extractos' })}>Apagar</button>}
      </Cabecalho>
      <div className="row">
        <div className="col-xl-4">
          <Painel titulo="Extracto" icone="fa-file-contract">
            <dl className="small mb-0">
              <dt>Tipo</dt><dd>{e.tipoNome}</dd>
              <dt>N.º e data</dt><dd>{e.numero} de {dataPt(e.data)}</dd>
              {e.entidade && <><dt>Entidade</dt><dd>{e.entidade}</dd></>}
              {e.propostaId && <><dt>Resposta à proposta</dt><dd><Link to={`/propostas/${e.propostaId}`}>N.º {e.propostaId}</Link></dd></>}
              <dt>Registado por</dt><dd>{e.criadoPor} · {dataHoraPt(e.criadoEm)}</dd>
              <dt>Estado</dt><dd>{e.estado === 'aplicado' ? <span className="badge bg-success">Aplicado às fichas em {dataHoraPt(e.aplicadoEm)}</span> : <span className="badge bg-warning text-dark">Por aplicar</span>}</dd>
              {!e.temTexto && e.ficheiro && <dd className="text-muted">Digitalização sem texto: o sistema não pôde ler os nomes.</dd>}
            </dl>
          </Painel>
        </div>
        <div className="col-xl-8">
          <Painel titulo={`Quem o extracto abrange (${e.itens.length})`} icone="fa-users" corpo={false}>
            {pendente && <div className="p-2 border-bottom"><EscolherPessoa excluir={e.itens.map((i) => i.pessoaId)} aoEscolher={(p) => acao('/itens', 'POST', { pessoaId: p.id }, `${p.nome} junto ao extracto.`)} placeholder="Juntar mais alguém: nome ou NIP…" /></div>}
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Militar</th><th>Encontrado por</th><th>{comPosto ? 'Posto actual → novo' : e.tipo === 'nomeacao' ? 'Cargo' : 'Situação'}</th><th /></tr></thead>
                <tbody>
                  {e.itens.map((i) => (
                    <tr key={i.id}>
                      <td><Link to={`/pessoas/${i.pessoaId}`} className="pes-pessoa text-decoration-none"><Foto pessoaId={i.pessoaId} fotoId={i.fotoId} nome={i.nome} /><span><strong>{i.nome}</strong><div className="small text-muted">{i.nip || i.numeroAgente} · {i.ramo || 'Civil'} · {i.unidadeNome}</div></span></Link></td>
                      <td><span className={`badge ${POR[i.encontradoPor]?.[1] ?? 'bg-secondary'}`}>{POR[i.encontradoPor]?.[0] ?? i.encontradoPor}</span></td>
                      <td>
                        {comPosto && (pendente
                          ? <div className="d-flex align-items-center gap-1"><span className="small text-nowrap">{i.postoAtualNome} →</span><Escolha valor={i.postoNovo} aoMudar={(v) => acao(`/itens/${i.id}`, 'PUT', { postoNovo: v })} opcoes={(ref.postos[i.ramo] ?? ref.postos.EXE).filter((p) => p.grau > ((ref.postos[i.ramo] ?? ref.postos.EXE).find((x) => x.id === i.postoAtual)?.grau ?? 0)).map((p) => [p.id, p.nome])} vazio="—" /></div>
                          : <span>{i.postoAtualNome} → <strong>{i.postoNovoNome}</strong></span>)}
                        {e.tipo === 'nomeacao' && (pendente ? <Escolha valor={i.cargoId} aoMudar={(v) => acao(`/itens/${i.id}`, 'PUT', { cargoId: v ? Number(v) : null })} opcoes={(cargos ?? []).map((c) => [c.id, `${c.nome}${c.unidadeNome ? ` — ${c.unidadeNome}` : ''}`])} vazio="Escolha o cargo" /> : <strong>{i.cargoNome}</strong>)}
                        {['reserva', 'reforma'].includes(e.tipo) && <span>Passa à {e.tipo}</span>}
                        {['exoneracao'].includes(e.tipo) && <span>Deixa o cargo: {i.cargoAtual || '—'}</span>}
                        {e.tipo === 'progressao' && <span>{i.categoriaAtual} → categoria seguinte</span>}
                      </td>
                      <td className="text-end">{pendente ? <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => acao(`/itens/${i.id}`, 'DELETE')} title="Retirar"><i className="fa fa-times" /></button> : i.aplicado && <i className="fa fa-check-circle text-success" title="Aplicado" />}</td>
                    </tr>
                  ))}
                  {!e.itens.length && <tr><td colSpan={4} className="text-muted">O sistema não encontrou ninguém no texto. Junte as pessoas acima.</td></tr>}
                </tbody>
              </table>
            </div>
          </Painel>
        </div>
      </div>
    </>
  )
}
