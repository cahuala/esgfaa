/*
  Erros do domínio. Cada um tem um código estável; a camada HTTP traduz o código
  para o estado HTTP (o domínio não conhece HTTP).
*/
export class ErroDominio extends Error {
  constructor(mensagem, codigo = 'erro_dominio', detalhes = undefined) {
    super(mensagem)
    this.name = new.target.name
    this.codigo = codigo
    this.detalhes = detalhes
  }
}

export class ErroValidacao extends ErroDominio {
  constructor(mensagem, detalhes) { super(mensagem, 'validacao', detalhes) }
}

export class NaoAutenticado extends ErroDominio {
  constructor(mensagem = 'Sessão em falta. Entre novamente.') { super(mensagem, 'nao_autenticado') }
}

export class SemPermissao extends ErroDominio {
  constructor(mensagem = 'Não tem permissão para esta ação.') { super(mensagem, 'sem_permissao') }
}

export class NaoEncontrado extends ErroDominio {
  constructor(mensagem = 'Não encontrado.') { super(mensagem, 'nao_encontrado') }
}

export class Conflito extends ErroDominio {
  constructor(mensagem) { super(mensagem, 'conflito') }
}

export class ContaBloqueada extends ErroDominio {
  constructor(mensagem, ate) { super(mensagem, 'conta_bloqueada', { ate }) }
}

// verificação em dois passos: falta o código da aplicação (ou está errado)
export class CodigoEmFalta extends ErroDominio {
  constructor(mensagem = 'Introduza o código de 6 algarismos da aplicação de autenticação.') { super(mensagem, 'codigo_2fa') }
}

// o papel exige verificação em dois passos e a conta ainda não a ligou
export class DoisFatoresPorAtivar extends ErroDominio {
  constructor(mensagem = 'Ligue a verificação em dois passos antes de continuar (Perfil).') { super(mensagem, 'ativar_2fa') }
}

// conta com a palavra-passe inicial: tem de a mudar antes de usar o portal
export class SenhaPorMudar extends ErroDominio {
  constructor(mensagem = 'Mude a palavra-passe inicial antes de continuar.') {
    super(mensagem, 'mudar_senha')
  }
}
