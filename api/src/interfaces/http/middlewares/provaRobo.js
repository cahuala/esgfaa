import { DIFICULDADE, ProvasUsadas, criarDesafio, verificarProva } from '../../../dominio/seguranca/robo.js'

/*
  «Não sou um robô» nas entradas: GET /desafio dá um desafio (mais difícil para o endereço que já errou a
  palavra-passe várias vezes) e o POST /entrar só passa com a prova resolvida (campo "prova" do corpo).
*/
export function provaRobo({ config, servicos }) {
  const usadas = new ProvasUsadas()
  const suspeito = (ip) => (servicos.seguranca?.monitor?.contagens(5, ip).login_falhado || 0) >= 3
  return {
    desafio: (req, res) => res.set('Cache-Control', 'no-store').json({ ativo: config.verificarRobo, ...(config.verificarRobo ? criarDesafio(config.segredoJwt, { maximo: suspeito(req.ip) ? DIFICULDADE.suspeito : DIFICULDADE.normal }) : {}) }),
    exigir: (req, res, next) => {
      if (!config.verificarRobo || verificarProva(config.segredoJwt, req.body?.prova, usadas)) return next()
      res.status(400).json({ erro: 'Confirme que não é um robô e tente outra vez.', codigo: 'prova_robo' })
    },
  }
}
