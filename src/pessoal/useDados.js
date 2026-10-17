import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

/*
  Dados de um endereço da API: { dados, erro, recarregar }. dados é null enquanto carrega (ou mudou o pedido);
  ao recarregar mantém o que está no ecrã até chegar a resposta nova. caminho null = não pede nada.
*/
export function useDados(caminho, consulta) {
  const chave = caminho ? `${caminho}?${JSON.stringify(consulta ?? {})}` : null
  const [r, setR] = useState({ chave: null })
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    if (!chave) return undefined
    let vivo = true
    const [c, q] = [chave.slice(0, chave.indexOf('?')), JSON.parse(chave.slice(chave.indexOf('?') + 1))]
    api(c, { consulta: q }).then((dados) => vivo && setR({ chave, dados })).catch((e) => vivo && setR({ chave, erro: e.message }))
    return () => { vivo = false }
  }, [chave, versao])
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const atual = r.chave === chave ? r : null
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? '', recarregar }
}
