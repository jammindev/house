#!/bin/bash
# Bloque toute signature Claude dans les commits et PRs (règle projet : no-signature-on-work).
# Hook PreToolUse sur Bash — exit 2 = action bloquée, le message stderr est renvoyé à Claude.

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

case "$cmd" in
  *"git commit"*|*"gh pr create"*|*"gh pr edit"*)
    if printf '%s' "$cmd" | grep -qiE 'co-authored-by:.*(claude|noreply@anthropic)|generated with \[?claude code|🤖'; then
      echo "Signature détectée (Co-Authored-By / Generated with Claude Code) — interdite sur ce projet. Retire-la du message de commit ou du corps de PR, puis relance la commande." >&2
      exit 2
    fi
    ;;
esac
exit 0
