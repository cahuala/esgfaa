// banner visível num dia: ativo e dentro das datas (se definidas)
export function bannerEmVigor(banner, hojeIso) {
  return banner.ativo !== false && (!banner.inicio || banner.inicio <= hojeIso) && (!banner.fim || banner.fim >= hojeIso)
}
