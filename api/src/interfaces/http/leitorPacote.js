/*
  Página que a API serve dentro da moldura do portal para correr um pacote SCORM ou H5P.
  SCORM: cria as interfaces que os pacotes procuram nas janelas de cima (window.API para o 1.2 e
  window.API_1484_11 para o 2004), guarda os valores cmi.* e envia o estado e a nota à API.
  H5P: carrega o leitor h5p-standalone e envia a nota quando o estudante termina (eventos xAPI).
*/
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const SCORM = `
(function () {
  var D = window.__PACOTE__
  var cmi = Object.assign({}, (D.progresso && D.progresso.dados) || {})
  var v12 = D.versao !== '2004'
  var erro = '0'
  var inicio = Date.now()
  var terminado = false
  function base () {
    if (v12) {
      cmi['cmi.core.student_id'] = D.conta.numero
      cmi['cmi.core.student_name'] = D.conta.nome
      cmi['cmi.core.lesson_mode'] = 'normal'
      cmi['cmi.core.credit'] = 'credit'
      cmi['cmi.core.entry'] = cmi['cmi.suspend_data'] || cmi['cmi.core.lesson_location'] ? 'resume' : 'ab-initio'
      if (!cmi['cmi.core.lesson_status']) cmi['cmi.core.lesson_status'] = 'not attempted'
    } else {
      cmi['cmi.learner_id'] = D.conta.numero
      cmi['cmi.learner_name'] = D.conta.nome
      cmi['cmi.mode'] = 'normal'
      cmi['cmi.credit'] = 'credit'
      cmi['cmi.entry'] = cmi['cmi.suspend_data'] || cmi['cmi.location'] ? 'resume' : 'ab-initio'
      if (!cmi['cmi.completion_status']) cmi['cmi.completion_status'] = 'unknown'
      if (!cmi['cmi.success_status']) cmi['cmi.success_status'] = 'unknown'
    }
  }
  base()
  function numero (k) { var n = parseFloat(cmi[k]); return isNaN(n) ? null : n }
  // estado e nota (0 a 20) a partir dos valores do pacote
  function resumo () {
    var estado = 'iniciado'
    var nota = null
    if (v12) {
      var s = cmi['cmi.core.lesson_status']
      estado = s === 'passed' ? 'aprovado' : s === 'failed' ? 'reprovado' : s === 'completed' ? 'concluido' : 'iniciado'
      var raw = numero('cmi.core.score.raw'); var max = numero('cmi.core.score.max') || 100; var min = numero('cmi.core.score.min') || 0
      if (raw !== null && max > min) nota = Math.max(0, Math.min(20, ((raw - min) / (max - min)) * 20))
    } else {
      var su = cmi['cmi.success_status']; var co = cmi['cmi.completion_status']
      estado = su === 'passed' ? 'aprovado' : su === 'failed' ? 'reprovado' : co === 'completed' ? 'concluido' : 'iniciado'
      var esc = numero('cmi.score.scaled')
      if (esc !== null) nota = Math.max(0, Math.min(20, esc * 20))
      else { var r2 = numero('cmi.score.raw'); var m2 = numero('cmi.score.max') || 100; var n2 = numero('cmi.score.min') || 0; if (r2 !== null && m2 > n2) nota = Math.max(0, Math.min(20, ((r2 - n2) / (m2 - n2)) * 20)) }
    }
    return { estado: estado, nota: nota }
  }
  var guardados = {}
  function enviar (fim) {
    var r = resumo()
    var corpo = JSON.stringify({ estado: r.estado, nota: r.nota, dados: cmi, tempoSegundos: Math.round((Date.now() - inicio) / 1000) + ((D.progresso && D.progresso.tempoSegundos) || 0) })
    if (corpo === guardados.corpo) return
    guardados.corpo = corpo
    // o portal é avisado depois de a API guardar (para o progresso que vai buscar já contar com isto)
    var avisar = function () { try { window.parent.postMessage({ esgPacote: true, estado: r.estado, nota: r.nota }, '*') } catch (e) {} }
    try {
      if (fim && navigator.sendBeacon) { navigator.sendBeacon('__estado', new Blob([corpo], { type: 'application/json' })); avisar() }
      else fetch('__estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: true }).then(avisar, avisar)
    } catch (e) {}
  }
  setInterval(function () { if (!terminado) enviar(false) }, 30000)
  window.addEventListener('pagehide', function () { enviar(true) })
  function getv (k) { erro = '0'; if (k in cmi) return String(cmi[k]); if (/\\._count$/.test(k)) return '0'; erro = v12 ? '0' : '0'; return '' }
  function setv (k, v) {
    erro = '0'
    if (/^cmi\\.(core\\.)?(student|learner)_(id|name)$/.test(k) || /\\._count$/.test(k)) { erro = v12 ? '403' : '404'; return 'false' }
    cmi[k] = String(v)
    return 'true'
  }
  var s12 = {
    LMSInitialize: function () { erro = '0'; if (cmi['cmi.core.lesson_status'] === 'not attempted') cmi['cmi.core.lesson_status'] = 'incomplete'; return 'true' },
    LMSFinish: function () { erro = '0'; terminado = true; enviar(true); return 'true' },
    LMSGetValue: getv, LMSSetValue: setv,
    LMSCommit: function () { erro = '0'; enviar(false); return 'true' },
    LMSGetLastError: function () { return erro }, LMSGetErrorString: function (c) { return c === '0' ? 'No error' : 'Error ' + c }, LMSGetDiagnostic: function (c) { return String(c || '') },
  }
  var s04 = {
    Initialize: function () { erro = '0'; if (cmi['cmi.completion_status'] === 'unknown') cmi['cmi.completion_status'] = 'incomplete'; return 'true' },
    Terminate: function () { erro = '0'; terminado = true; enviar(true); return 'true' },
    GetValue: getv, SetValue: setv,
    Commit: function () { erro = '0'; enviar(false); return 'true' },
    GetLastError: function () { return erro }, GetErrorString: function (c) { return c === '0' ? 'No error' : 'Error ' + c }, GetDiagnostic: function (c) { return String(c || '') },
  }
  window.API = s12
  window.API_1484_11 = s04
  document.getElementById('sco').src = D.estrutura.inicio
})()`

const H5P = `
(function () {
  var D = window.__PACOTE__
  var inicio = Date.now()
  var melhor = D.progresso && D.progresso.nota !== null && D.progresso.nota !== undefined ? D.progresso.nota : null
  function enviar (estado, nota) {
    var corpo = { estado: estado, tempoSegundos: Math.round((Date.now() - inicio) / 1000) + ((D.progresso && D.progresso.tempoSegundos) || 0) }
    if (nota !== null && nota !== undefined) corpo.nota = nota
    var avisar = function () { try { window.parent.postMessage({ esgPacote: true, estado: estado, nota: nota }, '*') } catch (e) {} }
    fetch('__estado', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), keepalive: true }).then(avisar, avisar)
  }
  new H5PStandalone.H5P(document.getElementById('h5p'), {
    h5pJsonPath: D.base, frameJs: D.raizH5p + '/frame.bundle.js', frameCss: D.raizH5p + '/styles/h5p.css',
    frame: false, copyright: false, export: false, icon: false, fullScreen: true,
  }).then(function () {
    enviar('iniciado', null)
    H5P.externalDispatcher.on('xAPI', function (ev) {
      var st = ev.data && ev.data.statement
      if (!st || !st.result) return
      // só a atividade principal (as perguntas de dentro de um conjunto têm "parent")
      var ctx = st.context && st.context.contextActivities
      if (ctx && ctx.parent && ctx.parent.length) return
      var esc = st.result.score && typeof st.result.score.scaled === 'number' ? st.result.score.scaled : null
      var nota = esc === null ? null : Math.max(0, Math.min(20, esc * 20))
      if (nota !== null && melhor !== null && nota < melhor) nota = melhor
      if (nota !== null) melhor = nota
      var feito = st.result.completion === true || /completed|answered|passed|failed/.test((st.verb && st.verb.id) || '')
      enviar(st.result.success === true ? 'aprovado' : feito ? 'concluido' : 'iniciado', nota)
    })
  })
})()`

// D: dados do leitor; nonce: para o script em linha; base: endereço do pacote (…/api/pacotes/<token>)
export function paginaLeitor(D, { nonce, base, raizH5p }) {
  const dados = { ...D, versao: D.estrutura.versao, base, raizH5p }
  const scorm = D.tipo === 'scorm'
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(D.titulo)}</title>
<style>html,body{margin:0;height:100%;background:#fff;font-family:system-ui,sans-serif}#sco{border:0;width:100%;height:100%;display:block}#h5p{max-width:1100px;margin:0 auto;padding:12px}</style>
${scorm ? '' : `<link rel="stylesheet" href="${raizH5p}/styles/h5p.css"><script src="${raizH5p}/main.bundle.js"></script>`}
</head><body>
${scorm ? '<iframe id="sco" title="Conteúdo" allow="fullscreen; autoplay"></iframe>' : '<div id="h5p"></div>'}
<script nonce="${nonce}">window.__PACOTE__ = ${json(dados)}</script>
<script nonce="${nonce}">${scorm ? SCORM : H5P}</script>
</body></html>`
}
