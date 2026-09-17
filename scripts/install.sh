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

RUN_USER="${USER:-$(id -un)}"

read -rp "Machinenaam (leeg = hostname): " MACHINE
MACHINE="${MACHINE:-$(hostname -s)}"

read -rp "Centrale, bijvoorbeeld ws://agentfactory.local:4317: " HUB
if [[ -z "$HUB" ]]; then
  echo "Een centrale is verplicht." >&2
  exit 1
fi

read -rsp "Token (leeg als de centrale er geen vraagt): " FACTORY_TOKEN
echo

mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$PLIST_PATH")"

sed \
  -e "s#__LABEL__#$LABEL#g" \
  -e "s#__NODE__#$NODE_PATH#g" \
  -e "s#__WORKDIR__#$REPO_DIR#g" \
  -e "s#__HUB__#$HUB#g" \
  -e "s#__USER__#$RUN_USER#g" \
  -e "s#__MACHINE__#$MACHINE#g" \
  -e "s#__FACTORY_TOKEN__#$FACTORY_TOKEN#g" \
  -e "s#__LOG_OUT__#$LOG_DIR/reporter.out.log#g" \
  -e "s#__LOG_ERR__#$LOG_DIR/reporter.err.log#g" \
  "$TEMPLATE" > "$PLIST_PATH"

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
