import fs from 'node:fs'
import express from 'express'

/*
  Página do certificado (como no SIGP-FAN): aberta sem entrar, também por http://IP:8085/certificado, para cada
  computador da rede instalar o certificado da raiz do HTTPS (o navegador passa a confiar no sistema).
  - /certificado: as instruções e os botões;
  - /certificado/esg-pessoal-raiz.crt: o certificado (instala-se em «Autoridades de certificação de raiz fidedignas»);
  - /certificado/preparar-computador.bat: um clique (como administrador) instala o certificado, aponta o nome
    do sistema para o IP do servidor (enquanto o DNS da Escola não o tiver) e abre o sistema.
  Sem scripts e com CSP própria (sem upgrade-insecure-requests, para os botões funcionarem por http://).
*/
const FICHEIRO = 'esg-pessoal-raiz.crt'
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function lerCertificado(caminho) {
  try {
    const t = caminho ? fs.readFileSync(caminho, 'utf8') : ''
    return /-----BEGIN CERTIFICATE-----/.test(t) ? t : ''
  } catch {
    return ''
  }
}

// o .bat leva o certificado dentro (cada linha do PEM escreve-se com echo; base64 não tem caracteres especiais)
export function batPreparar({ pem, endereco, ip, url }) {
  const linhas = pem.trim().split(/\r?\n/).map((l) => `>>"%CRT%" echo ${l.trim()}`)
  return [
    '@echo off',
    'rem Prepara este computador para abrir o Sistema de Pessoal e Quadros da ESG sem avisos do navegador.',
    'title Preparar este computador - Sistema de Pessoal e Quadros',
    'net session >NUL 2>&1',
    'if %errorlevel% neq 0 (',
    '  powershell -NoProfile -Command "Start-Process -FilePath \'%~f0\' -Verb RunAs"',
    '  exit /b',
    ')',
    'set "CRT=%TEMP%\\esg-pessoal-raiz.crt"',
    'if exist "%CRT%" del "%CRT%"',
    ...linhas,
    'certutil -addstore -f Root "%CRT%" >NUL',
    'if %errorlevel% neq 0 ( echo [ERRO] O certificado nao ficou instalado. & pause & exit /b 1 )',
    'echo [ok] certificado instalado (Chrome e Edge passam a confiar; Firefox: about:config, security.enterprise_roots.enabled = true)',
    ...(ip && endereco
      ? [
          'set "HOSTS=%SystemRoot%\\System32\\drivers\\etc\\hosts"',
          'findstr /v /c:"# esg-pessoal" "%HOSTS%" > "%TEMP%\\hosts-esg.txt"',
          `>>"%TEMP%\\hosts-esg.txt" echo ${ip} ${endereco} # esg-pessoal`,
          'copy /y "%TEMP%\\hosts-esg.txt" "%HOSTS%" >NUL',
          'ipconfig /flushdns >NUL',
          `echo [ok] ${endereco} aponta para ${ip}`,
        ]
      : []),
    ...(url ? [`echo Pronto. A abrir ${url}`, `start "" "${url}"`] : ['echo Pronto.']),
    'pause',
    '',
  ].join('\r\n')
}

function pagina({ temCertificado, url, endereco, ip }) {
  const passos = temCertificado
    ? `<a class="btn" href="/certificado/preparar-computador.bat" download>Preparar este computador (Windows)</a>
       <p class="ajuda">Abra o ficheiro descarregado e aceite «Executar como administrador»: instala o certificado${ip ? `, aponta ${esc(endereco)} para ${esc(ip)}` : ''} e abre o sistema.</p>
       <a class="btn sec" href="/certificado/${FICHEIRO}" download>Descarregar só o certificado</a>
       <h3>Instalar o certificado à mão (Windows)</h3>
       <ol>
         <li>Descarregue o certificado (ficheiro <code>${FICHEIRO}</code>) e clique duas vezes nele.</li>
         <li>Clique em <b>Instalar certificado…</b>, escolha <b>Máquina local</b> (pede permissão de administrador) e avance.</li>
         <li>Escolha <b>Colocar todos os certificados no seguinte arquivo</b> › <b>Autoridades de certificação de raiz fidedignas</b>.</li>
         <li>Concluir. Feche e volte a abrir o navegador.</li>
       </ol>
       <h3>Firefox (passo extra)</h3>
       <p>Abra <code>about:config</code> e ponha <code>security.enterprise_roots.enabled</code> a <code>true</code>.</p>`
    : '<p class="aviso">Este servidor não tem certificado próprio para instalar (o HTTPS já é de confiança).</p>'
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificado — Sistema de Pessoal e Quadros</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f4f1e8; color: #1c2430; }
  .caixa { max-width: 640px; margin: 40px auto; background: #fff; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.08); overflow: hidden; }
  header { background: #2d353c; color: #fff; padding: 22px 28px; border-bottom: 4px solid #c09820; }
  header small { color: #e6c55a; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
  header h1 { margin: 4px 0 0; font-size: 22px; }
  main { padding: 24px 28px; font-size: 15px; line-height: 1.6; }
  .btn { display: block; text-align: center; background: #bf1d15; color: #fff; text-decoration: none; font-weight: 700; padding: 12px; border-radius: 6px; margin: 8px 0; }
  .btn.sec { background: #fff; color: #2d353c; border: 1.5px solid #c09820; }
  .ajuda { color: #5b6472; font-size: 13.5px; margin: 0 0 16px; }
  h3 { font-size: 15px; margin: 22px 0 6px; }
  ol { padding-left: 20px; margin: 0; }
  code { background: #f1efe7; padding: 1px 5px; border-radius: 3px; }
  .aviso { background: #fff8e1; padding: 10px 12px; border-radius: 6px; }
  footer { padding: 14px 28px; background: #faf8f2; font-size: 13px; color: #5b6472; }
  @media (max-width: 680px) { .caixa { margin: 0; border-radius: 0; } }
</style></head>
<body><div class="caixa">
  <header><small>Escola Superior de Guerra · Acesso seguro</small><h1>Instalar o certificado</h1></header>
  <main>
    <p>Necessário <b>uma única vez em cada computador</b> para abrir o Sistema de Gestão de Pessoal e Quadros por HTTPS nesta rede, sem avisos do navegador.</p>
    ${passos}
  </main>
  <footer>${url ? `Depois de instalado, abra <b>${esc(url)}</b>.` : ''}</footer>
</div></body></html>`
}

export function rotasCertificado(config) {
  const r = express.Router()
  const c = config.certificado ?? {}
  r.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })
  r.get('/certificado', (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
    res.type('html').send(pagina({ temCertificado: Boolean(lerCertificado(c.caminho)), ...c }))
  })
  r.get(`/certificado/${FICHEIRO}`, (req, res) => {
    const pem = lerCertificado(c.caminho)
    if (!pem) return res.status(404).type('text').send('Certificado não encontrado neste servidor.')
    res.setHeader('Content-Disposition', `attachment; filename="${FICHEIRO}"`)
    res.type('application/x-x509-ca-cert').send(pem)
  })
  r.get('/certificado/preparar-computador.bat', (req, res) => {
    const pem = lerCertificado(c.caminho)
    if (!pem) return res.status(404).type('text').send('Certificado não encontrado neste servidor.')
    res.setHeader('Content-Disposition', 'attachment; filename="preparar-computador-esg-pessoal.bat"')
    res.type('application/octet-stream').send(batPreparar({ pem, ...c }))
  })
  return r
}
