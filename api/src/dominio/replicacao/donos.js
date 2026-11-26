/*
  Quem manda em cada tabela, quando os sistemas estão separados (cada um com a sua base de dados):
    escolar — Sistema de Gestão Escolar (interno): Administração Escolar, Direcção de Ensino, Comando, Biblioteca;
    site    — Sistema de Gestão do Site (interno): notícias, páginas, cursos, eventos…;
    online  — o servidor na internet: o site público e o Portal dos estudantes e docentes.
  Cada sistema envia o que é seu; quem recebe aplica só o que é de quem envia:
    dono    — o sistema que cria e muda as linhas (o único que as pode apagar);
    campos  — colunas que outro sistema também muda (ex.: a palavra-passe da conta, que se muda no portal);
    ambos   — linhas criadas nos dois lados (avisos e mensagens): cada lado envia as suas e as mudanças;
    ultima  — se as duas partes mudam a mesma linha, vale a mais recente (pela coluna de actualização).
  O que não está aqui fica só no sistema onde está (contas do painel, papéis, actividade, segurança, sessões).
  O servidor online numera as linhas novas a partir de mil milhões: as dos sistemas internos nunca chocam.
*/
export const SISTEMAS = ['escolar', 'site', 'online']

const E = (campos) => ({ dono: 'escolar', ...(campos ? { campos } : {}) })
const O = (campos) => ({ dono: 'online', ...(campos ? { campos } : {}) })
const S = () => ({ dono: 'site' })

export const DONOS = {
  // ---- site (Gestão do Site → site público) e o que os visitantes fazem no site (→ Gestão do Site)
  Item: S(), Pagina: S(), TextoTraduzido: S(), Traducao: S(),
  Gosto: O(), Comentario: O({ site: ['estado', 'revistoPor', 'revistoEm'] }), Visualizacao: O(), Visita: O(), PublicidadeMetrica: O(),
  MensagemContacto: O({ site: ['estado', 'notas', 'tratadoPor', 'atualizadoEm'] }),
  Candidatura: O({ escolar: ['estado', 'notas', 'atualizadaPor', 'atualizadaEm'] }),

  // ---- o que a Gestão Escolar decide (→ portal)
  ContaPortal: E({ online: ['senha', 'ultimoAcesso', 'tokenCalendario', 'tentativasFalhadas', 'bloqueadoAte', 'versaoToken', 'deveMudarSenha', 'privacidadeEm', 'notificarEmail', 'fotoCaminho', 'fotoId'] }),
  AnoLetivo: E(), Turma: E(), Matricula: E(), Docencia: E(), HorarioDia: E(), Horario: E(), AvisoGeral: E(), EventoAcademico: E(),
  UnidadeCurricular: E({ online: ['descricao', 'programa', 'programaFicheiroId', 'publicacaoPedida'] }),
  PlanoCurso: E(), ConselhoCurso: E(), ClassificacaoCurso: E(), PrazoNotas: E(), InscricaoCadeira: E(), TrabalhoFimCurso: E(), CertificadoCurso: E(), Conclusao: E(),
  InqueritoInstitucional: E(), FerramentaLti: E(),
  Obra: E(), Exemplar: E(), Emprestimo: E(), Reserva: O({ escolar: ['estado', 'prontaEm', 'levantarAte', 'fechadaEm', 'aberta'] }),

  // ---- o que os docentes e os estudantes fazem no portal (→ Gestão Escolar)
  Ficheiro: O(), Material: O(), MaterialFicheiro: O(), SecaoCadeira: O(), AvisoCadeira: O(), VideoCurto: O(),
  AvaliacaoUc: O({ escolar: ['publicadaEm', 'publicacaoPedida'] }),
  EnunciadoProva: O({ escolar: ['estado', 'impressoPor', 'impressoEm'] }),
  PedidoAlteracaoNota: O({ escolar: ['estado', 'decididoPor', 'decididoEm', 'fundamento', 'usadoEm'] }),
  Pedido: O({ escolar: ['estado', 'resposta', 'ficheiroId', 'atualizadoEm'] }),
  PedidoDados: O({ escolar: ['estado', 'resposta', 'respondidoPor', 'respondidoEm'] }),
  Trabalho: O(), Entrega: O(), EntregaFicheiro: O(), Prorrogacao: O(), Aula: O(), Presenca: O(), ComposicaoNota: O(),
  ForumTopico: O(), ForumResposta: O(), ForumAnexo: O(), SubscricaoTopico: O(), SubscricaoForum: O(),
  Questionario: O(), Pergunta: O(), PerguntaBanco: O(), Tentativa: O(), ExcecaoQuestionario: O(),
  Certificado: O(), GrupoCadeira: O(), MembroGrupo: O(), Workshop: O(), SubmissaoWorkshop: O(), AvaliacaoPar: O(),
  TermoGlossario: O(), PaginaWiki: O(), VersaoWiki: O(), Inquerito: O(), RespostaInquerito: O(), ParticipacaoInquerito: O(),
  RespostaInstitucional: O(), ParticipacaoInstitucional: O(), ProgressoPacote: O(), ProgressoLicao: O(), RegistoAcesso: O(),
  DocumentoIntegridade: O(), ImpressaoIntegridade: O(), AnaliseIntegridade: O(),

  // ---- as notas: lançam-se no portal (docentes) e na Gestão (Administração Escolar, revisões): vale a mais recente
  NotaAvaliacaoUc: { dono: 'online', ambos: true, ultima: true },
  NotaPauta: { dono: 'online', ambos: true, ultima: true },
  // avisos e mensagens nascem nos dois lados
  Notificacao: { dono: 'online', ambos: true }, Mensagem: { dono: 'online', ambos: true },
}

// o que cada sistema recebe: escolar ⇄ online e site ⇄ online (o online passa o que vem de um ao outro, se lhe servir)
const SO_DO_SITE = new Set(['Gosto', 'Comentario', 'Visualizacao', 'Visita', 'PublicidadeMetrica', 'MensagemContacto'])
export function interessa(modelo, sistema) {
  const d = DONOS[modelo]
  if (!d) return false
  if (sistema === 'online') return true
  if (sistema === 'site') return d.dono === 'site' || SO_DO_SITE.has(modelo)
  // a Gestão Escolar: o que é dela (o que o portal mudou), o do portal, e os cursos e páginas do site (os cursos das turmas)
  if (sistema === 'escolar') return d.dono !== 'site' ? !SO_DO_SITE.has(modelo) : ['Item', 'Pagina'].includes(modelo)
  return false
}

// as colunas que o sistema «de» pode escrever neste modelo (null = todas; [] = nenhuma)
export function camposDe(modelo, de) {
  const d = DONOS[modelo]
  if (!d) return []
  const doOutro = Object.entries(d.campos ?? {}).filter(([s]) => s !== de).flatMap(([, c]) => c)
  if (d.dono === de || d.ambos) return { todas: true, excepto: doOutro }
  return { todas: false, so: d.campos?.[de] ?? [] }
}

// este sistema escreve neste modelo (e por isso põe as mudanças na fila)?
export function escreve(modelo, sistema) {
  const d = DONOS[modelo]
  if (!d) return false
  return d.dono === sistema || d.ambos || Boolean(d.campos?.[sistema]?.length)
}
