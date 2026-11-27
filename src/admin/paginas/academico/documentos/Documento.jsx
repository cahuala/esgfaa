import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Brasao from '../../../../assets/emblema-faa.png'
import { api } from '../../../api'
import { t as tx } from '../../../../i18n/linguas'
import { useAnoTrabalho } from '../../../anoTrabalho'

/*
  Moldura dos documentos oficiais da Administração Escolar (pautas, listas, histórico, certificado):
  cabeçalho institucional, título, conteúdo, assinaturas e data. A barra de ações não sai na impressão.
  paisagem: imprime na horizontal (tabelas largas).
  anoLetivo: o ano do documento — se está fechado, consulta-se mas não se imprime (só depois de o Comandante o reabrir).
  aprovado: { cargo, nome, posto } — «APROVADO» no canto superior esquerdo, para o Comandante assinar (como nos mapas
  do Pessoal). assinaturas: textos ou { cargo, nome, posto } (o nome e o posto vão por baixo da linha).
*/
/*
  Quem assina, como no Pessoal: quem ocupa hoje o cargo (vem do Sistema de Pessoal — o Comandante, o Director de
  Ensino, o Chefe da Repartição de Administração Escolar). Uma assinatura escrita só com o cargo («O Director de
  Ensino») fica com o nome e o posto de quem o ocupa; sem isso, só o cargo e a linha.
*/
let pedidoAssinantes = null
const assinantesDaEscola = () => (pedidoAssinantes ??= api('/academico/documentos-academicos').catch(() => { pedidoAssinantes = null; return {} }))
const CARGOS = [[/comandante/i, 'comandante'], [/director\s+de\s+ensino/i, 'directorEnsino'], [/administra[çc][ãa]o\s+escolar/i, 'chefeRae']]
function completar(a, quem) {
  if (typeof a !== 'string') return a
  const k = CARGOS.find(([re]) => re.test(a))?.[1]
  const p = k && quem?.[k]
  return p?.nome ? { cargo: a, nome: p.nome, posto: p.posto } : { cargo: a }
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const dataPorExtenso = (d = new Date()) => `Luanda, aos ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
const Assinante = ({ a }) => (
  <>
    <div className="of-assinante-cargo">{a.cargo}</div>
    <div className="of-linha" />
    {a.nome && <div className="of-assinante-nome">{a.nome}</div>}
    {a.posto && <div className="of-assinante-posto">{a.posto}</div>}
  </>
)

function Documento({ titulo, subtitulo, voltar, acoes, paisagem = false, aprovado = null, assinaturas = [], children, rodape = true, anoLetivo = '' }) {
  const { anos } = useAnoTrabalho()
  const [quem, setQuem] = useState(null)
  useEffect(() => { let vivo = true; assinantesDaEscola().then((q) => { if (vivo) setQuem(q) }); return () => { vivo = false } }, [])
  // «APROVADO» do Comandante: aprovado = true (ou o cargo) fica com quem o ocupa hoje
  const visto = aprovado === true ? completar('O COMANDANTE DA ESG', quem) : typeof aprovado === 'string' ? completar(aprovado, quem) : aprovado
  const quemAssina = assinaturas.map((a) => completar(a, quem))
  const fechado = Boolean(anoLetivo) && Boolean(anos.find((a) => a.id === anoLetivo)?.fechado)
  // folha na horizontal só enquanto este documento está aberto
  useEffect(() => {
    if (!paisagem) return undefined
    const estilo = document.createElement('style')
    estilo.textContent = '@media print { @page { size: A4 landscape; margin: 10mm; } }'
    document.head.appendChild(estilo)
    return () => estilo.remove()
  }, [paisagem])
  return (
    <div className="of-pagina">
      <div className="of-acoes d-flex flex-wrap gap-2 mb-3">
        {voltar && <Link to={voltar} className="btn btn-white"><i className="fa fa-arrow-left me-1" />{tx('Voltar')}</Link>}
        <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">
          {acoes}
          {fechado
            ? <span className="badge bg-dark p-2"><i className="fa fa-lock me-1" />{tx('Ano lectivo fechado')}</span>
            : <button type="button" className="btn btn-theme" onClick={() => window.print()}><i className="fa fa-print me-1" />{tx('Imprimir / guardar em PDF')}</button>}
        </div>
      </div>
      {fechado && (
        <div className="alert alert-dark of-acoes">
          <i className="fa fa-lock me-2" />{tx('O ano lectivo {0} está fechado: pode consultar, mas para emitir este documento o Comandante tem de reabrir o ano.', { 0: anoLetivo })} <Link to="/academico/anos-letivos">{tx('Pedir a reabertura')}</Link>
        </div>
      )}
      {fechado && <div className="of-nao-autorizado">{tx('Ano lectivo {0} fechado — documento não autorizado.', { 0: anoLetivo })}</div>}
      {/* documento oficial: fica sempre em português */}
      <article translate="no" className={`of-folha ${paisagem ? 'of-folha-larga' : ''} ${fechado ? 'of-folha-fechada' : ''}`}>
        {visto && (
          <div className="of-aprovado">
            <div className="of-aprovado-titulo">Aprovado</div>
            <Assinante a={visto} />
          </div>
        )}
        {/* o cabeçalho como no Pessoal: o emblema ao centro e a cadeia hierárquica */}
        <header className="of-cabecalho">
          <img src={Brasao} alt="" />
          <div>República de Angola</div>
          <div>Forças Armadas Angolanas</div>
          <div className="of-escola">Escola Superior de Guerra</div>
          <div className="of-repar">Direcção de Ensino — Repartição de Administração Escolar</div>
        </header>
        <h1 className="of-titulo">{titulo}</h1>
        {subtitulo && <div className="of-subtitulo">{subtitulo}</div>}
        {children}
        {rodape && <div className="of-rodape">{dataPorExtenso()}</div>}
        {quemAssina.length > 0 && (
          <div className="of-assinaturas">
            {quemAssina.map((a) => <div key={a.cargo} className="of-assinatura"><Assinante a={a} /></div>)}
          </div>
        )}
      </article>
    </div>
  )
}

export default Documento
