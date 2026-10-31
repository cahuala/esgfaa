import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/*
  Dados de um endereço da API: { dados, erro, recarregar }. dados é null enquanto carrega (ou mudou o pedido);
  ao recarregar mantém o que está no ecrã até chegar a resposta nova. caminho null = não pede nada.
  { tempoReal: true }: volta a pedir logo que alguém grava alguma coisa (listas, não formulários em edição).
*/
export function useDados(caminho, consulta, { tempoReal = false } = {}) {
  const chave = caminho ? `${caminho}?${JSON.stringify(consulta ?? {})}` : null
  const [r, setR] = useState({ chave: null })
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    if (!chave) return undefined
    let vivo = true
    const [c, q] = [chave.slice(0, chave.indexOf('?')), JSON.parse(chave.slice(chave.indexOf('?') + 1))]
    api(c, { consulta: q }).then((dados) => vivo && setR({ chave, dados })).catch((e) => vivo && setR({ chave, erro: e.message, estado: e.estado }))
    return () => { vivo = false }
  }, [chave, versao])
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  useEffect(() => {
    if (!tempoReal) return undefined
    window.addEventListener('pes-tempo-real', recarregar)
    return () => window.removeEventListener('pes-tempo-real', recarregar)
  }, [tempoReal, recarregar])
  const atual = r.chave === chave ? r : null
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? '', naoExiste: atual?.estado === 404, recarregar }
}
