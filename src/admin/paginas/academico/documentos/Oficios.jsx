import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { Carregando, Erro } from '../../../componentes/Ui'
import Brasao from '../../../../assets/emblema-faa.png'
import { useAnoTrabalho } from '../../../anoTrabalho'

/*
  Ofícios do Comando da ESG para os cursos (como os do arquivo), com o número em branco para se escrever à mão:
  — Credencial: uma por discente, para contactar entidades para o seu Trabalho de Investigação Individual (o tema);
  — Comunicação: uma por orientador, a indicá-lo para orientar os discentes (e os temas);
  — Nota de envio: o ofício que acompanha um documento (escreve-se o destinatário e o que se envia).
  Os textos vêm preenchidos com os dados da turma e podem mudar-se antes de imprimir.
*/
const TIPOS = { credencial: 'Credenciais (uma por discente)', comunicacao: 'Comunicação aos orientadores (uma por discente)', nota: 'Nota de envio' }
const pessoa = (e) => [e.posto, e.nome].filter(Boolean).join(' ')
const anoDe = (anoLetivo) => String(anoLetivo ?? '').slice(5) || String(new Date().getFullYear())
const dataLinha = () => `ESCOLA SUPERIOR DE GUERRA, em Luanda, _____ de ${new Date().toLocaleDateString('pt-PT', { month: 'long' })} de ${new Date().getFullYear()}`

function Cabecalho() {
  return (
    <header className="of-cabecalho">
      <img src={Brasao} alt="" />
      {/* como nos ofícios do arquivo: as Forças Armadas, o Estado-Maior General e a Escola (sem «República de Angola») */}
      <div>Forças Armadas Angolanas</div><div>Estado-Maior General</div><div className="of-escola">Escola Superior de Guerra</div>
    </header>
  )
}

// um ofício (uma folha): o destinatário, a referência com o número em branco, o assunto, o texto e a assinatura
function Folha({ destinatario, assunto, titulo, texto, aoMudar, comandante, anoLetivo }) {
  return (
    <article translate="no" className="of-folha of-quebra mb-4">
      <Cabecalho />
      {destinatario !== undefined && (
        <div className="mb-2">
          <div className="of-no-ecra"><input className="form-control form-control-sm mb-1" value={destinatario} onChange={(e) => aoMudar({ destinatario: e.target.value })} aria-label="Destinatário" /></div>
          <div className="of-so-papel fw-bold">À: {destinatario}</div>
          <div className="fw-bold">= LUANDA =</div>
        </div>
      )}
      {assunto !== undefined && <p className="mb-1">N/ OFÍCIO DE REFª Nº ______ GAB.CMDT.ESG/EMGFAA/{anoDe(anoLetivo)}</p>}
      {assunto !== undefined && <p className="fw-bold">ASSUNTO: {assunto}</p>}
      {titulo && <h1 className="of-titulo">{titulo}</h1>}
      <div className="of-no-ecra"><textarea className="form-control mb-2" rows={8} value={texto} onChange={(e) => aoMudar({ texto: e.target.value })} aria-label="Texto do ofício" /></div>
      <div className="of-so-papel" style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', lineHeight: 1.6 }}>{texto}</div>
      <p className="mt-4">{dataLinha()}</p>
      <div className="of-assinaturas"><div className="of-assinatura"><div>O COMANDANTE DA ESG</div><div className="of-linha" />{comandante?.nome && <div className="of-assinante-nome">{comandante.nome.toUpperCase()}</div>}{comandante?.posto && <div className="fw-bold">**{comandante.posto.toUpperCase()}**</div>}</div></div>
    </article>
  )
}

function Oficios() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tipo = TIPOS[params.get('tipo')] ? params.get('tipo') : 'credencial'
  const { ano } = useAnoTrabalho()
  const [d, setD] = useState(null)
  const [quem, setQuem] = useState({})
  const [erro, setErro] = useState('')
  const [textos, setTextos] = useState({})
  const [cursosAno, setCursosAno] = useState({})
  useEffect(() => {
    api(`/academico/turmas/${id}/finalistas`).then(setD).catch((e) => setErro(e.message))
    api('/academico/documentos-academicos').then(setQuem).catch(() => {})
    // os cursos que decorrem em simultâneo no ano (as credenciais e as comunicações do arquivo citam-nos todos)
    Promise.all([api('/academico/turmas'), api('/colecoes/cursos').catch(() => [])]).then(([ts, cs]) => setCursosAno({ ts, cs })).catch(() => {})
  }, [id])
  if (erro) return <Erro texto={erro} />
  if (!d) return <Carregando />

  const t = d.turma
  const cursoTxt = t.curso
  const lAno = t.anoLetivo || ano
  // «o Curso de Estratégia e Arte Operativa (CEAO), o Curso Superior de Comando e Direcção (CSCD) e o Curso de …»
  const doAno = [...new Map((cursosAno.ts ?? []).filter((x) => x.anoLetivo === lAno).map((x) => {
    const c = (cursosAno.cs ?? []).find((y) => y.id === x.curso)
    const nome = (c?.titulo || c?.nome || x.nome.replace(/^(\d+\.º\s+Turno\s+do\s+)?\d+\.?\s*º\s+/, '')).trim()
    const sigla = c?.dados?.sigla || c?.sigla || ''
    return [nome, `o ${nome}${sigla ? ` (${sigla})` : ''}`]
  })).values()]
  const varios = doAno.length > 1
  const listaCursos = varios ? `${doAno.slice(0, -1).join(', ')} e ${doAno[doAno.length - 1]}` : (doAno[0] ?? `o ${cursoTxt}`)
  // as folhas de cada tipo, com o texto que vem dos dados (e o que se mudou à mão por cima)
  let folhas
  if (tipo === 'credencial') {
    folhas = d.linhas.map((l) => ({
      chave: `c-${l.estudante.id}`, titulo: 'CREDENCIAL',
      texto: `Decorrendo na Escola Superior de Guerra${varios ? ' em simultâneo,' : ''} ${listaCursos}, em conformidade com ${varios ? 'os planos dos Cursos' : 'o plano do Curso'}, consta a elaboração de Trabalhos de Investigação Individual (TII), com o objectivo de criar hábitos de reflexão, tanto individual como colectiva, liberdade de expressão de ideias e praticar actividades de investigação.\n\nAssim sendo, o Comando da Escola Superior de Guerra vem por este intermédio declarar que o Discente ${pessoa(l.estudante)} está autorizado a contactar entidades e organismos públicos ou privados, no sentido de enriquecer o seu Trabalho de Investigação Individual, subordinado ao tema: «${l.tfc?.tema || '________________________________'}».\n\nAceite, Excelência, os nossos respeitosos cumprimentos.`,
    }))
  } else if (tipo === 'comunicacao') {
    // como no arquivo: uma comunicação por discente, ao orientador do seu Trabalho de Investigação Individual
    const progr = varios ? `Do Programa dos Cursos ${listaCursos.replace(/\bo Curso/g, 'Curso')}, ministrados` : `Do Programa do ${cursoTxt}, ministrado`
    folhas = d.linhas.filter((x) => x.tfc?.orientador).map((l) => ({
      chave: `o-${l.estudante.id}`, destinatario: `SUA EXCELÊNCIA ${l.tfc.orientador.toUpperCase()}`, assunto: 'COMUNICAÇÃO',
      texto: `${progr} neste Estabelecimento de Ensino Superior Militar do Ano Académico ${lAno}, consta a elaboração de Trabalho de Investigação Individual (TII), com o objectivo de criar hábitos de reflexão, tanto individual como colectiva, estimular a iniciativa, a criatividade, a liberdade de expressão de ideias e praticar actividades de investigação.\n\nAssim sendo, o Comando da ESG vem por intermédio desta comunicar a Vossa Excelência que, atendendo à experiência e saber militar, está indicado para orientar a elaboração do Trabalho de Investigação Individual (TII) do Discente ${pessoa(l.estudante)}, subordinado ao tema: «${l.tfc.tema || '________________________________'}».\n\nAceite, Senhor, os nossos respeitosos cumprimentos.`,
    }))
  } else {
    folhas = [{
      chave: 'nota', destinatario: 'GABINETE DE SUA EXCELÊNCIA ________________', assunto: 'NOTA DE ENVIO',
      texto: `Os Nossos Melhores Cumprimentos.\n\nO Comando da Escola Superior de Guerra (ESG), vem através desta proceder ao envio do Mapa do Grau de Aproveitamento de Oficiais Discentes do ${cursoTxt}, referente ao Ano Académico ${lAno}.\n\nSem mais assunto de momento.`,
    }]
  }
  folhas = folhas.map((f) => ({ ...f, ...(textos[`${tipo}:${f.chave}`] ?? {}) }))
  const mudar = (f) => (x) => setTextos((s) => ({ ...s, [`${tipo}:${f.chave}`]: { ...(s[`${tipo}:${f.chave}`] ?? {}), ...x } }))

  return (
    <div className="of-pagina">
      <div className="of-acoes d-flex flex-wrap gap-2 mb-3 align-items-center">
        <a href={`#/academico/turmas/${id}`} className="btn btn-white"><i className="fa fa-arrow-left me-1" />Voltar</a>
        <select className="form-select w-auto ms-auto" value={tipo} onChange={(e) => setParams({ tipo: e.target.value })} aria-label="Ofício">
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="small text-muted">{folhas.length} folha(s) · {t.nome}</span>
        <button type="button" className="btn btn-theme" disabled={!folhas.length} onClick={() => window.print()}><i className="fa fa-print me-1" />Imprimir / guardar em PDF</button>
      </div>
      {!folhas.length && <p className="text-center text-muted">{tipo === 'comunicacao' ? 'Ainda não há orientadores nos trabalhos de fim de curso desta turma (Finalistas).' : 'Ainda não há discentes nesta turma.'}</p>}
      {folhas.map((f) => <Folha key={f.chave} {...f} anoLetivo={lAno} comandante={quem.comandante} aoMudar={mudar(f)} />)}
    </div>
  )
}

export default Oficios
