import { useState } from 'react'
import { useSessao } from '../sessaoContexto'
import { Aviso, Cartao, Titulo } from '../componentes'
import { dataHora } from '../formatar'
import MudarSenha from './MudarSenha'

function Perfil() {
  const { conta, eDocente } = useSessao()
  const [aviso, setAviso] = useState(null)
  const d = conta.dados || {}
  return (
    <>
      <Titulo rotulo={eDocente ? 'Docente' : 'Estudante'} titulo="O meu perfil" />
      <div className="p-grelha-lado">
        <Cartao titulo="Dados">
          <dl className="p-ficha">
            <div><dt>Nome</dt><dd>{conta.nome}</dd></div>
            <div><dt>Número</dt><dd>{conta.numero}</dd></div>
            <div><dt>E-mail</dt><dd>{conta.email}</dd></div>
            {d.posto && <div><dt>Posto</dt><dd>{d.posto}</dd></div>}
            {d.ramo && <div><dt>Ramo</dt><dd>{d.ramo}</dd></div>}
            {d.departamento && <div><dt>Departamento</dt><dd>{d.departamento}</dd></div>}
            {conta.matriculas?.map((m) => <div key={m.id}><dt>Matrícula</dt><dd>{m.turma.nome} ({m.estado})</dd></div>)}
            <div><dt>Último acesso</dt><dd>{dataHora(conta.ultimoAcesso)}</dd></div>
          </dl>
          <p className="p-texto-fraco">Para corrigir os seus dados, contacte a Secretaria Académica.</p>
        </Cartao>
        <Cartao titulo="Mudar a palavra-passe">
          <MudarSenha aoTerminar={() => setAviso({ texto: 'Palavra-passe alterada. As outras sessões foram terminadas.' })} />
        </Cartao>
      </div>
      <Aviso aviso={aviso} onFechar={() => setAviso(null)} />
    </>
  )
}

export default Perfil
