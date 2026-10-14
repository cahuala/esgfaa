import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Documento from './Documento'
import { dataPt } from './csv'

const PROVAS = { p1: '1.ª Prova', p2: '2.ª Prova', exame: 'Exame', recurso: 'Recurso' }

// lista de estudantes para assinar na prova (presença e entrega da prova)
function ListaProva() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [prova, setProva] = useState(null)
  useEffect(() => {
    api(`/academico/cadeiras/${id}/lista-prova`).then((r) => {
      setD(r)
      const hoje = new Date().toISOString().slice(0, 10)
      const proxima = r.provas.find((p) => p.data >= hoje) || r.provas[r.provas.length - 1]
      setProva(proxima || { tipo: 'p1', titulo: '1.ª Prova', data: '', inicio: '', local: '' })
    }).catch((e) => setErro(e.message))
  }, [id])
  if (erro) return <Erro texto={erro} />
  if (!d || !prova) return <Carregando />

  const escolher = (valorEscolhido) => {
    const [tipo] = valorEscolhido.split('|')
    setProva(d.provas.find((p) => `${p.tipo}|${p.data}` === valorEscolhido) || { tipo, titulo: PROVAS[tipo], data: '', inicio: '', local: '' })
  }
  return (
    <Documento
      titulo={`Lista de presenças — ${prova.titulo || PROVAS[prova.tipo]}`} voltar={`/academico/cadeiras/${d.cadeira.id}`}
      subtitulo={`${d.cadeira.codigo} — ${d.cadeira.nome} · ${d.turma.curso} · ${d.turma.nome}`}
      acoes={(
        <select className="form-select" style={{ width: 280 }} value={`${prova.tipo}|${prova.data}`} aria-label="Prova" onChange={(e) => escolher(e.target.value)}>
          {d.provas.map((p) => <option key={`${p.tipo}|${p.data}`} value={`${p.tipo}|${p.data}`}>{PROVAS[p.tipo]} · {dataPt(p.data)}</option>)}
          {Object.entries(PROVAS).filter(([k]) => !d.provas.some((p) => p.tipo === k)).map(([k, v]) => <option key={k} value={`${k}|`}>{v} (sem data marcada)</option>)}
        </select>
      )}
      assinaturas={['O Vigilante', 'O Docente']}
    >
      <div className="of-campos">
        <div><b>Data:</b> {prova.data ? dataPt(prova.data) : '____/____/________'}</div>
        <div><b>Hora:</b> {prova.inicio || '____:____'}</div>
        <div><b>Sala:</b> {prova.local || '______________'}</div>
        <div><b>Estudantes:</b> {d.estudantes.length}</div>
      </div>
      <table>
        <thead>
          <tr><th className="of-num">N.º</th><th>Nome</th><th>Número</th><th className="of-assinar">Assinatura</th><th style={{ width: 80 }}>Hora de entrega</th><th style={{ width: 70 }}>Folhas</th></tr>
        </thead>
        <tbody>
          {d.estudantes.map((e, i) => (
            <tr key={e.id}><td className="of-num">{i + 1}</td><td>{e.nome}</td><td>{e.numero}</td><td className="of-assinar" /><td /><td /></tr>
          ))}
        </tbody>
      </table>
      <div className="of-campos mt-2"><div><b>Presentes:</b> ______</div><div><b>Ausentes:</b> ______</div><div><b>Provas entregues:</b> ______</div></div>
    </Documento>
  )
}

export default ListaProva
