import CapaN1 from '../assets/revista-esg-n1-capa.jpg'
import CapaN2 from '../assets/revista-esg-n2-capa.jpg'
import PdfN1 from '../assets/revista-esg-n1.pdf'
import PdfN2 from '../assets/revista-esg-n2.pdf'

/*
  Números da Revista da Escola Superior de Guerra: um PDF de leitura livre no site.
  Editam-se no painel (Revista). Os dois números abaixo são edições de demonstração.
  sumario: [{ titulo, autor, pagina }] — a página leva o leitor diretamente ao artigo.
*/
const revistas = [
  {
    slug: 'n-2-outubro-2026',
    numero: 'N.º 2',
    titulo: 'Segurança marítima e cooperação regional',
    data: '2026-10-01',
    resumo: 'Um dossiê sobre o Golfo da Guiné e a passagem da vigilância costeira à cooperação entre Estados, e uma leitura da arquitetura de paz e segurança da SADC.',
    capa: CapaN2,
    pdf: PdfN2,
    destaque: true,
    sumario: [
      { titulo: 'Editorial: Pensar o mar, pensar a região', autor: 'Direção da Revista', pagina: 3 },
      { titulo: 'Golfo da Guiné: da vigilância costeira à cooperação entre Estados', autor: 'Cor. Ana Baptista', pagina: 4 },
      { titulo: 'A SADC e a arquitetura de paz e segurança: instituições à prova', autor: 'Cor. Miguel Santos', pagina: 6 },
      { titulo: 'Publicar na Revista: normas para autores', autor: 'Departamento de Investigação', pagina: 8 },
    ],
  },
  {
    slug: 'n-1-marco-2026',
    numero: 'N.º 1',
    titulo: 'Liderança e comando',
    data: '2026-03-01',
    resumo: 'O primeiro número da revista: o que muda e o que permanece no comando militar do século XXI, e uma leitura prática do processo de planeamento de operações.',
    capa: CapaN1,
    pdf: PdfN1,
    destaque: false,
    sumario: [
      { titulo: 'Editorial: Uma revista para a Escola', autor: 'Direção da Revista', pagina: 3 },
      { titulo: 'Liderar no século XXI: o que muda e o que permanece no comando militar', autor: 'Cor. Ana Baptista', pagina: 4 },
      { titulo: 'O processo de planeamento de operações: uma leitura prática', autor: 'Cor. Miguel Santos', pagina: 6 },
      { titulo: 'Publicar na Revista: normas para autores', autor: 'Departamento de Investigação', pagina: 8 },
    ],
  },
]

export default revistas
