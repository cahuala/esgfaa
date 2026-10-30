/*
  Acontecimentos importantes (painel do Comandante): as atividades do registo que contam, por grupo.
  O resto (edições correntes, entradas bem-sucedidas…) fica só no registo de atividades.
*/
export const GRUPOS_ACONTECIMENTOS = [
  {
    id: 'decisoes', titulo: 'Decisões do Comandante', icone: 'fa-stamp',
    acoes: ['aprovar_publicacao', 'recusar_publicacao', 'aprovar_conta', 'recusar_conta', 'aprovar_mudanca_papel', 'recusar_mudanca_papel', 'autorizar_alteracao_nota', 'recusar_alteracao_nota', 'homologar_classificacoes', 'verificar_docentes'],
  },
  {
    id: 'contas', titulo: 'Contas, papéis e acessos', icone: 'fa-users-cog',
    acoes: ['criar_utilizador', 'editar_utilizador', 'pedir_aprovacao_conta', 'pedir_mudanca_papel', 'criar_papel', 'editar_papel', 'apagar_papel', 'criar_conta_portal', 'importar_pessoas', 'sincronizar_pessoal', 'repor_senha_portal', 'bloquear_conta'],
  },
  {
    id: 'notas', titulo: 'Notas e documentos académicos', icone: 'fa-graduation-cap',
    acoes: ['pedir_alteracao_nota', 'publicar_notas', 'libertar_notas', 'propor_classificacoes', 'reabrir_classificacoes', 'confirmar_conselho_curso', 'juizo_ampliativo', 'ajuste_media', 'lancar_tfc', 'passagem_de_ano', 'emitir_certificado', 'emitir_certificado_curso'],
  },
  {
    id: 'publicacoes', titulo: 'Site e portal', icone: 'fa-bullhorn',
    acoes: ['pedir_aprovacao', 'retirar_publicacao', 'pedir_aprovacao_aviso', 'aviso_geral', 'pedir_aprovacao_inquerito', 'lancar_inquerito_institucional', 'apagar'],
  },
  {
    id: 'seguranca', titulo: 'Segurança', icone: 'fa-shield-alt',
    acoes: ['falha_entrada', 'falha_entrada_portal', 'bloquear_ip', 'desbloquear_ip', 'protecao_automatica', 'mudar_protecao', 'exportar_tabela', 'exportar_meus_dados', 'pedido_dados'],
  },
]
