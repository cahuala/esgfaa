// O que vai dentro do pendrive para instalar sem internet (versões fixas; o resumo SHA-256 confere-se ao descarregar).
// soma: o resumo publicado pelo projecto (ficheiro ao lado) ou, se não houver, null (confere-se só o tamanho).
const NODE = '24.21.0'
const PG = '17.7.0'
const CADDY = '2.8.4'

export const COMPONENTES = [
  { id: 'node-windows', sistema: 'windows', nome: `Node.js ${NODE} (Windows x64)`, url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-win-x64.zip`, somas: `https://nodejs.org/dist/v${NODE}/SHASUMS256.txt` },
  { id: 'node-linux', sistema: 'linux', nome: `Node.js ${NODE} (Linux x64)`, url: `https://nodejs.org/dist/v${NODE}/node-v${NODE}-linux-x64.tar.gz`, somas: `https://nodejs.org/dist/v${NODE}/SHASUMS256.txt` },
  { id: 'postgresql-windows', sistema: 'windows', nome: `PostgreSQL ${PG} (Windows x64)`, url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG}/postgresql-${PG}-x86_64-pc-windows-msvc.zip`, somas: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG}/postgresql-${PG}-x86_64-pc-windows-msvc.zip.sha256` },
  { id: 'postgresql-linux', sistema: 'linux', nome: `PostgreSQL ${PG} (Linux x64)`, url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG}/postgresql-${PG}-x86_64-unknown-linux-gnu.tar.gz`, somas: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${PG}/postgresql-${PG}-x86_64-unknown-linux-gnu.tar.gz.sha256` },
  { id: 'caddy-windows', sistema: 'windows', nome: `Caddy ${CADDY} (Windows x64, HTTPS)`, url: `https://github.com/caddyserver/caddy/releases/download/v${CADDY}/caddy_${CADDY}_windows_amd64.zip`, somas: `https://github.com/caddyserver/caddy/releases/download/v${CADDY}/caddy_${CADDY}_checksums.txt`, algoritmo: 'sha512' },
  { id: 'caddy-linux', sistema: 'linux', nome: `Caddy ${CADDY} (Linux x64, HTTPS)`, url: `https://github.com/caddyserver/caddy/releases/download/v${CADDY}/caddy_${CADDY}_linux_amd64.tar.gz`, somas: `https://github.com/caddyserver/caddy/releases/download/v${CADDY}/caddy_${CADDY}_checksums.txt`, algoritmo: 'sha512' },
  { id: 'vcredist-windows', sistema: 'windows', nome: 'Visual C++ Redistributable 2015-2022 x64 (preciso ao PostgreSQL)', url: 'https://aka.ms/vs/17/release/vc_redist.x64.exe', somas: null, nomeFicheiro: 'vc_redist.x64.exe' },
  { id: 'winsw', sistema: 'windows', nome: 'WinSW 2.12.0 (serviços do Windows)', url: 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe', somas: null },
]
