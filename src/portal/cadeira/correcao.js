// campos da correção de um trabalho para a API (a anónima implica as notas ocultas; não há anónima em grupo)
export const camposCorrecao = (f) => ({ anonimo: Boolean(f.correcaoAnonima) && !f.emGrupo, notasOcultas: Boolean(f.correcaoAnonima || f.notasOcultas) })
