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
