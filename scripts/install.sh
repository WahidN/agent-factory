#!/usr/bin/env bash
set -euo pipefail

# Installs a launchd agent that runs this Mac as a reporter: it relays this
# machine's Claude Code sessions to a central and serves nothing itself.
# Rerunning this script is safe. It always writes the same plist under the
# same label, so it ends up with exactly one agent, never a second one.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO_DIR/deploy/agent-factory.plist"
LABEL="com.agentfactory.reporter"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/agent-factory"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Kan de template niet vinden: $TEMPLATE" >&2
  exit 1
fi

NODE_PATH="$(command -v node || true)"
if [[ -z "$NODE_PATH" ]]; then
  echo "Geen node gevonden op het pad. Installeer Node.js eerst." >&2
  exit 1
fi

# The agent runs `node --import tsx server/index.ts` straight from this
# checkout. Without node_modules that fails with ERR_MODULE_NOT_FOUND, and
# KeepAlive turns it into a crash-loop in a log file nobody opens.
if [[ ! -d "$REPO_DIR/node_modules/tsx" ]]; then
  echo "De dependencies staan er nog niet. Draai eerst: pnpm install" >&2
  exit 1
fi

RUN_USER="${USER:-$(id -un)}"

read -rp "Machinenaam (leeg = hostname): " MACHINE
MACHINE="${MACHINE:-$(hostname -s)}"

read -rp "Centrale, bijvoorbeeld ws://agentfactory.local:4317: " HUB
if [[ -z "$HUB" ]]; then
  echo "Een centrale is verplicht." >&2
  exit 1
fi
# The server rejects anything else and exits 1, and with KeepAlive on that is a
# silent crash-loop in a log file nobody opens. Catch the typo here instead.
if [[ ! "$HUB" =~ ^wss?:// ]]; then
  echo "De centrale moet met ws:// of wss:// beginnen, niet \"$HUB\"." >&2
  exit 1
fi

read -rsp "Token (leeg als de centrale er geen vraagt): " FACTORY_TOKEN
echo

mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$PLIST_PATH")"

# The plist is XML, so & < > in a value have to be escaped or launchd reads a
# broken file. Everything here comes from what someone types at the prompt, a
# token especially.
xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

# Filled in with bash's own substitution instead of sed: sed reads & and \ in a
# replacement as references to the match, so a token holding an & used to end
# up in the plist as the placeholder name, and a # broke the s-command outright.
fill() {
  local text="$1" key="$2" value
  value="$(xml_escape "$3")"
  printf '%s' "${text//"$key"/$value}"
}

PLIST="$(cat "$TEMPLATE")"
PLIST="$(fill "$PLIST" __LABEL__ "$LABEL")"
PLIST="$(fill "$PLIST" __NODE__ "$NODE_PATH")"
PLIST="$(fill "$PLIST" __WORKDIR__ "$REPO_DIR")"
PLIST="$(fill "$PLIST" __HUB__ "$HUB")"
PLIST="$(fill "$PLIST" __USER__ "$RUN_USER")"
PLIST="$(fill "$PLIST" __MACHINE__ "$MACHINE")"
PLIST="$(fill "$PLIST" __FACTORY_TOKEN__ "$FACTORY_TOKEN")"
PLIST="$(fill "$PLIST" __LOG_OUT__ "$LOG_DIR/reporter.out.log")"
PLIST="$(fill "$PLIST" __LOG_ERR__ "$LOG_DIR/reporter.err.log")"

# The plist carries the token, so it must not be readable by other accounts on
# this Mac. Create it private, and fix the mode of one left behind by an older
# run of this script.
( umask 077 && printf '%s\n' "$PLIST" > "$PLIST_PATH" )
chmod 600 "$PLIST_PATH"

# Refuse to hand launchd a file it cannot parse, rather than let the agent
# crash-loop in the background over a typo nobody sees.
if ! plutil -lint "$PLIST_PATH" >/dev/null; then
  echo "De plist is ongeldig geworden, controleer je invoer: $PLIST_PATH" >&2
  exit 1
fi

echo "Plist geschreven naar $PLIST_PATH"

read -rp "Nu laden en starten? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
  echo "Niet geladen. Start later met: launchctl load -w \"$PLIST_PATH\""
  exit 0
fi

# Unload any instance from a previous run first, so a rerun replaces it
# instead of ending up with two agents under the same label.
launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load -w "$PLIST_PATH"

echo "Gestart. Stoppen met: launchctl unload -w \"$PLIST_PATH\""
