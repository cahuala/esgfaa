import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useSessao } from './sessaoContexto'

/*
  O ano lectivo com que cada utilizador trabalha no painel (o Comandante, a Direcção de Ensino, a Administração
  Escolar, os departamentos…): por omissão é o ano lectivo actual, que a Administração Escolar configura em «Ano
  lectivo e semestres»; quem quiser ver outro ano (estudantes, docentes, turmas, notas, documentos) escolhe-o nas
  configurações da sua conta (O meu perfil). Fica guardado na conta, no servidor: vale em qualquer computador.
*/
let pedido = null

// os anos lectivos configurados (um só pedido para todas as páginas; volta a pedir depois de mudarem)
export function anosLetivos({ recarregar = false } = {}) {
  if (!pedido || recarregar) pedido = api('/academico/anos-letivos').catch(() => { pedido = null; return [] })
  return pedido
}

// a página dos anos lectivos avisa quando cria, muda ou apaga um ano (o menu e as páginas abertas actualizam-se)
export function avisarAnosMudaram() {
  anosLetivos({ recarregar: true }).then(() => window.dispatchEvent(new CustomEvent('esg-anos-letivos')))
}

// { ano, anos, mudar, escolhido, actual }: o ano da conta (se ainda estiver configurado) ou o actual
export function useAnoTrabalho() {
  const sessao = useSessao()
  const [anos, setAnos] = useState([])
  useEffect(() => {
    let vivo = true
    const carregar = () => anosLetivos().then((l) => { if (vivo) setAnos(l ?? []) })
    carregar()
    window.addEventListener('esg-anos-letivos', carregar)
    return () => { vivo = false; window.removeEventListener('esg-anos-letivos', carregar) }
  }, [])
  const daConta = sessao?.utilizador?.anoTrabalho ?? ''
  const valido = anos.some((a) => a.id === daConta)
  const actual = anos.find((a) => a.atual)?.id ?? anos[0]?.id ?? ''
  const mudar = useCallback(async (novo) => {
    await api('/eu/ano-trabalho', { metodo: 'PUT', corpo: { anoTrabalho: novo === actual ? '' : novo || '' } })
    await sessao?.recarregar?.()
  }, [sessao, actual])
  return { ano: valido ? daConta : actual, anos, mudar, carregado: anos.length > 0, escolhido: valido ? daConta : '', actual }
}
