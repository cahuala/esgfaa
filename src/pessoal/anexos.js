import { api } from './api'

// enviar o documento digitalizado escolhido com <Anexo> (componentes/Anexo.jsx), depois de gravar o registo
const formulario = (campos, ficheiro) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.append(k, v ?? '')
  fd.append('ficheiro', ficheiro)
  return fd
}

// junta o ficheiro ao processo individual (tipo do catálogo do processo: punicao, louvor, saude, outro…)
export function juntarAoProcesso(pessoaId, ficheiro, { tipo = 'outro', titulo = '', data = '' } = {}) {
  if (!ficheiro) return Promise.resolve(null)
  return api(`/pessoas/${pessoaId}/documentos`, { metodo: 'POST', formulario: formulario({ tipo, titulo: titulo.slice(0, 200), data }, ficheiro) })
}

export function juntarAProposta(propostaId, ficheiro, titulo = '') {
  if (!ficheiro) return Promise.resolve(null)
  return api(`/propostas/${propostaId}/anexos`, { metodo: 'POST', formulario: formulario({ titulo: titulo.slice(0, 200) }, ficheiro) })
}
