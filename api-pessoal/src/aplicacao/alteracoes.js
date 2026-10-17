import { POSTOS } from '../dominio/pessoal/hierarquia.js'

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

/*
  O que muda na ficha (e fica no histórico) quando chega o extracto: promoção, graduação, nomeação,
  exoneração, passagem à reserva ou à reforma. p traz cargo e graduações; doc = { documento, entidade, criadoPor, propostaId? }.
*/
export async function aplicarAlteracao(tx, tipo, p, x, data, doc) {
  const base = { ...doc, pessoaId: p.id }
  if (tipo === 'promocao') {
    await tx.pessoa.update({ where: { id: p.id }, data: { posto: x.postoNovo, dataAntiguidadePosto: data } })
    // a promoção ao posto da graduação (ou acima) faz cessar a graduação (art. 67.º)
    for (const g of (p.graduacoes ?? []).filter((g) => g.ativa && POSTOS[g.posto].grau <= POSTOS[x.postoNovo].grau)) await tx.graduacao.update({ where: { id: g.id }, data: { ativa: false, fim: data } })
    await tx.evento.create({ data: { ...base, tipo: 'promocao', data, postoAnterior: p.posto, postoNovo: x.postoNovo, descricao: x.descricao ?? '' } })
  } else if (tipo === 'graduacao') {
    await tx.graduacao.create({ data: { pessoaId: p.id, posto: x.postoNovo, inicio: x.inicio ?? data, fim: x.fim ?? null, motivo: x.descricao ?? '', propostaId: doc.propostaId ?? null } })
    await tx.evento.create({ data: { ...base, tipo: 'graduacao', data: x.inicio ?? data, postoAnterior: p.posto, postoNovo: x.postoNovo, descricao: x.descricao ?? '' } })
  } else if (tipo === 'nomeacao') {
    const cargo = await tx.cargo.findUnique({ where: { id: x.cargoId } })
    await tx.pessoa.update({ where: { id: p.id }, data: { cargoId: cargo.id, dataCargo: x.inicio ?? data, ...(cargo.unidadeId ? { unidadeId: cargo.unidadeId } : {}) } })
    if (cargo.unidadeId) await tx.utilizador.updateMany({ where: { pessoaId: p.id }, data: { unidadeId: cargo.unidadeId } })
    if (p.cargo && p.cargo.id !== cargo.id) await tx.evento.create({ data: { ...base, tipo: 'exoneracao', data: x.inicio ?? data, cargoNome: p.cargo.nome, descricao: 'Por nomeação para outro cargo.' } })
    await tx.evento.create({ data: { ...base, tipo: 'nomeacao', data: x.inicio ?? data, cargoNome: cargo.nome, descricao: x.fim ? `Até ${dia(x.fim)}` : '' } })
  } else if (tipo === 'exoneracao') {
    await tx.pessoa.update({ where: { id: p.id }, data: { cargoId: null, dataCargo: null } })
    await tx.evento.create({ data: { ...base, tipo: 'exoneracao', data, cargoNome: p.cargo?.nome ?? '', descricao: x.descricao ?? '' } })
  } else if (tipo === 'reserva' || tipo === 'reforma') {
    // na reforma deixa o cargo (art. 9.º, n.º 3); na reserva pode continuar a servir
    await tx.pessoa.update({ where: { id: p.id }, data: { situacao: tipo, dataSituacao: data, ...(tipo === 'reforma' ? { cargoId: null, dataCargo: null } : {}) } })
    await tx.evento.create({ data: { ...base, tipo: 'situacao', data, descricao: tipo === 'reserva' ? 'Passagem à reserva' : 'Passagem à reforma' } })
  } else if (tipo === 'progressao') {
    await tx.pessoa.update({ where: { id: p.id }, data: { categoriaCivil: x.categoriaNova, dataCategoria: data } })
    await tx.evento.create({ data: { ...base, tipo: 'progressao', data, descricao: `${p.categoriaCivil ?? ''} → ${x.categoriaNova}` } })
  } else {
    await tx.evento.create({ data: { ...base, tipo: 'outro', data, descricao: x.descricao ?? '' } })
  }
}
