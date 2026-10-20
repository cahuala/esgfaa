import { BANCOS, bancoDe } from '../bancos'

/*
  O cartão Multicaixa da pessoa, desenhado a partir dos dados bancários da ficha (só ilustração, não é o
  cartão verdadeiro): a cor do banco, o chip, a marca MULTICAIXA, o número da conta (só os últimos 4
  algarismos à vista), o IBAN e o nome do titular.
*/
const grupos = (s, n = 4) => String(s).replace(/\s+/g, '').replace(new RegExp(`(.{${n}})`, 'g'), '$1 ').trim()

export default function CartaoMulticaixa({ p }) {
  const k = bancoDe(p.banco)
  const b = k ? BANCOS[k] : null
  const [c1, c2] = b?.cor ?? ['#2d353c', '#5b6670']
  const digitos = String(p.numeroConta || p.iban || '').replace(/\D/g, '')
  const ultimos = digitos.slice(-4).padStart(4, '•')
  const titular = String(p.nome ?? '').toLocaleUpperCase('pt').split(/\s+/).filter(Boolean)
  const nome = titular.length > 3 ? [titular[0], titular.at(-1)].join(' ') : titular.join(' ')
  return (
    <div className="pes-mcx" style={{ '--mcx-1': c1, '--mcx-2': c2 }} role="img" aria-label={`Cartão Multicaixa ${b?.sigla ?? k ?? p.banco ?? ''} de ${p.nome}, conta terminada em ${ultimos}`}>
      <div className="pes-mcx-topo">
        <span className="pes-mcx-banco">{b?.sigla ?? k ?? (p.banco || 'Banco')}</span>
        <span className="pes-mcx-marca"><i /><i /><b>MULTICAIXA</b></span>
      </div>
      <div className="pes-mcx-meio">
        <svg className="pes-mcx-chip" viewBox="0 0 48 36" aria-hidden="true">
          <rect x="1" y="1" width="46" height="34" rx="6" fill="#e9c46a" stroke="#b8902f" />
          <path d="M1 12h14M1 24h14M33 12h14M33 24h14M15 1v34M33 1v34M15 18h18" stroke="#b8902f" strokeWidth="1.6" fill="none" />
        </svg>
        <svg className="pes-mcx-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7a7 7 0 0 1 0 10M12 4a11 11 0 0 1 0 16M16 1.5a14.5 14.5 0 0 1 0 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </div>
      <div className="pes-mcx-numero">•••• •••• •••• {ultimos}</div>
      {p.iban && <div className="pes-mcx-iban">IBAN {grupos(p.iban)}</div>}
      <div className="pes-mcx-fundo">
        <span className="pes-mcx-titular">{nome || 'TITULAR'}</span>
        <span className="pes-mcx-tipo">DÉBITO</span>
      </div>
    </div>
  )
}
