import Carregar from './Carregar'

/*
  O documento digitalizado (despacho, ordem, extracto, guia, ofício…) nos formulários que pedem o número de
  um documento: escolhe-se aqui e envia-se depois de gravar o registo. Nas fichas vai para o processo
  individual da pessoa; nas propostas, para os documentos da proposta.
*/
export default function Anexo({ ficheiro, aoMudar, ajuda = 'PDF ou imagem (também Word) · até 25 MB · fica no processo individual' }) {
  return <Carregar aceitar="application/pdf,image/*,.docx" maxMb={25} compacto icone="fa-file-upload" ficheiros={ficheiro ? [ficheiro] : []} aoMudar={(l) => aoMudar(l[0] ?? null)} ajuda={ajuda} />
}
