#!/usr/bin/env bash
# Duplo clique (ou: bash INSTALAR-LINUX.sh) — instala o Sistema de Gestão de Pessoal e Quadros neste computador.
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# aberto pelo gestor de ficheiros, sem janela de terminal: abre uma
if [[ ! -t 1 && -z "${ESG_NO_TERMINAL:-}" ]]; then
  for t in x-terminal-emulator gnome-terminal konsole xfce4-terminal mate-terminal xterm; do
    if command -v "$t" >/dev/null; then
      case "$t" in
        gnome-terminal) exec gnome-terminal -- env ESG_NO_TERMINAL=1 bash "$AQUI/INSTALAR-LINUX.sh" ;;
        *) exec "$t" -e env ESG_NO_TERMINAL=1 bash "$AQUI/INSTALAR-LINUX.sh" ;;
      esac
    fi
  done
fi
echo "Sistema de Gestão de Pessoal e Quadros — instalação"
echo "É preciso a palavra-passe de administrador deste computador."
if [[ $EUID -eq 0 ]]; then bash "$AQUI/linux/instalar.sh"; else sudo bash "$AQUI/linux/instalar.sh"; fi
R=$?
echo
if [[ $R -eq 0 ]]; then echo "Pronto. Pode fechar esta janela."; else echo "A instalação falhou. Veja o ficheiro ERRO-INSTALACAO-*.txt na pasta «registos» do pendrive."; fi
read -r -p "Carregue em Enter para fechar…" _ || true
exit $R
