import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { useConteudo } from '../../conteudo/contexto'
import useSeccaoAtiva from '../../hooks/useSeccaoAtiva'
import ed from '../../styles/editorial.module.css'
import { t } from '../../i18n/linguas'

// política de privacidade (Lei n.º 22/11): o texto edita-se no painel, em Páginas do site → Política de privacidade
export default function Privacidade() {
  const p = useConteudo().paginas.privacidade
  const seccoes = (p?.seccoes ?? []).map((s, i) => ({ ...s, id: `s${i + 1}` }))
  const ativa = useSeccaoAtiva(seccoes.map((s) => s.id))
  const data = p?.actualizada ? new Date(`${p.actualizada}T12:00:00Z`).toLocaleDateString() : ''
  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial migalhas={[{ label: t('Política de privacidade') }]} sobretitulo={t('Protecção de dados pessoais')} titulo={p?.titulo || t('Política de privacidade')} entrada={p?.entrada} />
      <dl className={ed.factos}>
        <div><dt>{t('Responsável pelo tratamento')}</dt><dd>{p?.responsavel}</dd></div>
        <div><dt>{t('Contacto para os seus direitos')}</dt><dd>{p?.contacto && <a href={`mailto:${p.contacto}`}>{p.contacto}</a>}</dd></div>
        <div><dt>{t('Lei aplicável')}</dt><dd>{t('Lei n.º 22/11, de 17 de Junho')}</dd></div>
        {data && <div><dt>{t('Última actualização')}</dt><dd>{data}</dd></div>}
      </dl>
      <div className={ed.grelha}>
        <aside className={ed.indice}>
          <nav aria-label={t('Nesta página')}>
            <ol>{seccoes.map((s) => <li key={s.id}><a href={`#${s.id}`} className={ativa === s.id ? ed.indiceAtivo : ''}>{s.titulo}</a></li>)}</ol>
          </nav>
        </aside>
        <div className={ed.conteudo}>
          {seccoes.map((s) => (
            <section key={s.id} id={s.id} className={ed.seccao}>
              <div className={ed.tituloSeccao}><h2>{s.titulo}</h2></div>
              {String(s.texto ?? '').split('\n').filter(Boolean).map((par, i) => <p key={i}>{par}</p>)}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
