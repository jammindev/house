#!/bin/bash
# Régression du hook `check-task-status.py`.
#
# Pourquoi un test pour un hook : un garde-fou ne s'observe pas en marche. S'il
# se met à bloquer une conversation anodine, il se fait désactiver ; s'il cesse
# de bloquer, personne ne le remarque — il devient juste un fichier. Les deux
# dérives sont muettes, donc elles se testent.
#
#   bash .claude/hooks/test-check-task-status.sh

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/check-task-status.py"
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
fails=0

edit()   { printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{}}]}}\n'; }
bash_c() { printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"%s"}}]}}\n' "$1"; }
say()    { printf '{"type":"assistant","message":{"content":[{"type":"text","text":"%s"}]}}\n' "$1"; }
usr()    { printf '{"type":"user","message":{"content":"question"}}\n'; }

run() { # libellé, transcript, exit attendu, [stop_hook_active]
  printf '{"transcript_path":"%s","stop_hook_active":%s}' "$2" "${4:-false}" \
    | python3 "$HOOK" >/dev/null 2>&1
  local got=$?
  if [ "$got" = "$3" ]; then
    echo "  ok   $1"
  else
    echo "  FAIL $1 — attendu $3, obtenu $got"
    fails=$((fails + 1))
  fi
}

echo "Hook de statut de fin de tâche :"

# Ce qu'il doit attraper.
{ usr; edit; say "Voilà, c'est modifié."; } > "$DIR/1.jsonl"
run "édition sans statut → bloque" "$DIR/1.jsonl" 2

{ usr; bash_c "git commit -m x"; say "poussé"; } > "$DIR/2.jsonl"
run "commit sans statut → bloque" "$DIR/2.jsonl" 2

# Le statut ne vaut que pour ce qui le précède : rouvrir le chantier le réclame
# à nouveau, sinon un « FINI » posé tôt vaudrait absolution pour la suite.
{ usr; edit; say "BLOQUÉ sur la migration."; edit; say "j'ai retouché"; } > "$DIR/3.jsonl"
run "ré-édition après un statut → rebloque" "$DIR/3.jsonl" 2

# Ce qu'il doit laisser passer — la moitié qui décide s'il survit.
{ usr; edit; say "Tout est en place. FINI."; } > "$DIR/4.jsonl"
run "édition + statut → passe" "$DIR/4.jsonl" 0

{ usr; say "Le fichier fait 90 Ko, j'ai fini de le lire."; } > "$DIR/5.jsonl"
run "conversation seule → passe" "$DIR/5.jsonl" 0

{ usr; bash_c "ls -la"; say "voici la liste"; } > "$DIR/6.jsonl"
run "bash en lecture seule → passe" "$DIR/6.jsonl" 0

# Il rappelle une fois, il ne séquestre pas.
run "deuxième passage → rend la main" "$DIR/1.jsonl" 0 true

# Il échoue ouvert : un hook cassé ne rend pas les sessions incloturables.
run "transcript absent → passe" "$DIR/absent.jsonl" 0

if echo 'pas du json' | python3 "$HOOK" >/dev/null 2>&1; then
  echo "  ok   entrée illisible → passe"
else
  echo "  FAIL entrée illisible → aurait dû passer"
  fails=$((fails + 1))
fi

echo
if [ "$fails" = 0 ]; then
  echo "Tous verts."
else
  echo "$fails échec(s)."
fi
exit "$fails"
