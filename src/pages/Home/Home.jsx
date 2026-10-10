import HeroSection from '../../components/HeroSection/HeroSection'
import FormacaoDestaque from '../../components/FormacaoDestaque/FormacaoDestaque'
import NoticiaDestaque from '../../components/NoticiaDestaque/NoticiaDestaque'
import ProximosEventos from '../../components/ProximosEventos/ProximosEventos'
import AvisosComunicados from '../../components/AvisosComunicados/AvisosComunicados'
import CorpoDestaque from '../../components/CorpoDestaque/CorpoDestaque'
import MissaoVisaoValores from '../../components/MissaoVisaoValores/MissaoVisaoValores'
import FAQ from '../../components/FAQ/Faq'
import CtaBanner from '../../components/CTABanner/CtaBanner'
import Publicidade from '../../components/Publicidade/Publicidade'




function Home() {
 
    return(
      <div>
         <HeroSection/>
         <Publicidade posicao="home-topo" />
         <FormacaoDestaque />
         <NoticiaDestaque />
         <ProximosEventos />
         <Publicidade posicao="home-meio" />
         <AvisosComunicados />
         <CorpoDestaque />
         <MissaoVisaoValores />
         <FAQ />
         <CtaBanner />
      </div>
    )
        
    
   
 
}

export default Home