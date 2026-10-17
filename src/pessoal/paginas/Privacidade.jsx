import politica from '../../data/privacidade'
import { Cabecalho, Painel } from '../componentes/Ui'

// política de privacidade (o mesmo texto do site; no site, edita-se no painel)
export default function Privacidade() {
  return (
    <>
      <Cabecalho titulo={politica.titulo} subtitulo="Lei n.º 22/11, de 17 de Junho" migalhas={[['Privacidade']]} />
      <Painel>
        <p>{politica.entrada}</p>
        <p className="small text-muted">Responsável pelo tratamento: {politica.responsavel} · Contacto: {politica.contacto}</p>
        {politica.seccoes.map((s) => (
          <section key={s.titulo} className="mb-3">
            <h5>{s.titulo}</h5>
            {s.texto.split('\n').map((p, i) => <p key={i} className="mb-1">{p}</p>)}
          </section>
        ))}
        <p className="small text-muted mb-0">Na sua ficha («A minha ficha»), pode descarregar os seus dados e pedir correcções.</p>
      </Painel>
    </>
  )
}
