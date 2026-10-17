import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDados } from '../useDados'
import Foto from '../componentes/Foto'
import Tabela from '../componentes/Tabela'
import Estante from '../componentes/Estante'
import { Cabecalho, Carregando, Erro, Painel } from '../componentes/Ui'

// catálogo dos processos individuais: n.º PI, onde está a pasta, estado, documentos e o que falta actualizar
export default function Processos() {
  const navegar = useNavigate()
  const [so, setSo] = useState(false)
  const [modo, setModo] = useState('estante')
  const [pesquisa, setPesquisa] = useState('')
  const { dados, erro } = useDados('/processos')
  const linhas = useMemo(() => (dados ?? []).filter((p) => !so || !p.completo), [dados, so])
  const colunas = useMemo(() => [
    { chave: 'numero', titulo: 'Processo', valor: (p) => p.numero, mostrar: (p) => (p.numero ? <strong>{p.numero}</strong> : <span className="text-muted small">por abrir</span>) },
    { chave: 'nome', titulo: 'Nome', valor: (p) => p.nome, mostrar: (p) => <span className="pes-pessoa"><Foto pessoaId={p.id} fotoId={p.fotoId} nome={p.nome} /><span><strong>{p.nome}</strong><div className="small text-muted">{p.nip || p.numeroAgente}</div></span></span> },
    { chave: 'posto', titulo: 'Posto / categoria', valor: (p) => p.postoNome },
    { chave: 'unidade', titulo: 'Unidade', valor: (p) => p.unidadeNome },
    { chave: 'local', titulo: 'Localização', valor: (p) => p.localizacao },
    { chave: 'estado', titulo: 'Estado', valor: (p) => p.estadoNome },
    { chave: 'docs', titulo: 'Documentos', valor: (p) => p.documentos, alinhar: 'end' },
    { chave: 'falta', titulo: 'Actualização', valor: (p) => (p.completo ? 'Actualizado' : `Falta: ${p.emFalta.join(', ')}`), mostrar: (p) => (p.completo ? <span className="badge bg-success">Actualizado</span> : <span className="small text-danger" title={p.emFalta.join(', ')}>Falta {p.emFalta.length}: {p.emFalta.slice(0, 3).join(', ')}{p.emFalta.length > 3 ? '…' : ''}</span>) },
  ], [])
  if (erro) return <Erro texto={erro} />
  if (!dados) return <Carregando />
  const incompletos = dados.filter((p) => !p.completo).length
  return (
    <>
      <Cabecalho titulo="Processos individuais" subtitulo={`${dados.filter((p) => p.numero).length} abertos · ${incompletos} por actualizar`} migalhas={[['Processos individuais']]} />
      <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
        <div className="btn-group">
          <button type="button" className={`btn btn-sm ${modo === 'estante' ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => setModo('estante')}><i className="fa fa-archive me-1" />Estante</button>
          <button type="button" className={`btn btn-sm ${modo === 'lista' ? 'btn-theme' : 'btn-outline-secondary'}`} onClick={() => setModo('lista')}><i className="fa fa-list me-1" />Lista</button>
        </div>
        {modo === 'estante' && <input type="search" className="form-control form-control-sm" style={{ maxWidth: 320 }} placeholder="Procurar pasta: n.º, nome ou NIP…" value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} />}
        {modo === 'estante' && <span className="small text-muted"><span className="d-inline-block align-middle me-1" style={{ width: 12, height: 18, background: '#111', borderRadius: 2 }} />com processo <span className="d-inline-block align-middle ms-2 me-1" style={{ width: 12, height: 18, border: '1px dashed #c4b48f', borderRadius: 2 }} />livre</span>}
      </div>
      {modo === 'estante' && (
        <Painel titulo="Arquivo dos processos individuais" icone="fa-archive">
          <Estante processos={dados} pesquisa={pesquisa} aoAbrir={(p) => navegar(`/pessoas/${p.id}?aba=processo`)} />
          {dados.some((p) => !p.estante || !p.prateleira || !p.posicao) && <p className="small text-muted mt-3 mb-0"><i className="fa fa-info-circle me-1" />{dados.filter((p) => !p.estante || !p.prateleira || !p.posicao).length} processo(s) sem lugar na estante (veja na lista).</p>}
        </Painel>
      )}
      {modo === 'lista' && <Painel>
        <label className="form-check mb-2"><input type="checkbox" className="form-check-input" checked={so} onChange={(e) => setSo(e.target.checked)} /> <span className="form-check-label">Só os processos desactualizados ({incompletos})</span></label>
        <Tabela titulo={so ? 'Processos individuais desactualizados' : 'Catálogo de processos individuais'} colunas={colunas} linhas={linhas} aoClicar={(p) => navegar(`/pessoas/${p.id}?aba=processo`)} />
      </Painel>}
    </>
  )
}
