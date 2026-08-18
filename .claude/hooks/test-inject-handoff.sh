#!/bin/bash
# Régression du hook `inject-handoff.sh`.
#
# Pourquoi tester un hook de démarrage : ses deux dérives sont muettes. S'il
# cesse d'injecter, personne ne s'en aperçoit — on croit juste que la passation
# n'avait rien d'intéressant. S'il se met à injecter à contretemps (après une
# compaction, ou une note de trois semaines présentée comme fraîche), il fait
# travailler la session sur un état périmé. Aucune des deux ne se voit à l'œil.
#
#   bash .claude/hooks/test-inject-handoff.sh

set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/inject-handoff.sh"
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT
mkdir -p "$DIR/.claude"
FILE="$DIR/.claude/HANDOFF.md"
fails=0

run() { # source → imprime la sortie du hook
  printf '{"source":"%s","session_id":"x"}' "$1" \
    | CLAUDE_PROJECT_DIR="$DIR" bash "$HOOK" 2>/dev/null
}

check() { # libellé, sortie, motif attendu ou vide, [absent]
  local label=$1 out=$2 want=${3:-} forbid=${4:-}
  local ok=1
  [ -n "$want" ] && ! printf '%s' "$out" | grep -q "$want" && ok=0
  [ -n "$forbid" ] && printf '%s' "$out" | grep -q "$forbid" && ok=0
  if [ "$ok" = 1 ]; then echo "  ok   $label"; else
    echo "  FAIL $label"; fails=$((fails + 1)); fi
}

echo "Hook de réinjection de passation :"

# ── Rien à dire : il se tait ─────────────────────────────────────────────────
check "aucune passation → silence" "$(run startup)" "" "."

: > "$FILE"
check "passation vide → silence" "$(run startup)" "" "."

# ── Le cas nominal ───────────────────────────────────────────────────────────
printf '# Passation — test\n\n## Prochaine action\nRelancer les tests banking.\n' > "$FILE"
check "démarrage à froid → injecte"  "$(run startup)" "Relancer les tests banking"
check "après un /clear → injecte"    "$(run clear)"   "Relancer les tests banking"
check "reprise de session → injecte" "$(run resume)"  "Relancer les tests banking"

# ⚠️ Après une compaction le contexte n'a pas été vidé : le chantier est encore
# en mémoire, dans une version PLUS RÉCENTE que le fichier. Injecter ferait deux
# récits du même état, et le plus vieux passerait pour la référence.
check "après une compaction → se tait" "$(run compact)" "" "Relancer les tests"

# ── L'âge fait partie de l'information ───────────────────────────────────────
check "passation fraîche → pas d'avertissement" "$(run startup)" "aujourd'hui" "⚠️"

touch -t 202601010000 "$FILE"
old=$(run startup)
check "passation ancienne → le dit"            "$old" "⚠️"
check "passation ancienne → injecte quand même" "$old" "Relancer les tests banking"

# ── Il rappelle qu'elle est jetable ──────────────────────────────────────────
touch "$FILE"
check "rappelle comment la supprimer" "$(run startup)" "rm .claude/HANDOFF.md"

# ── Il échoue ouvert : un hook cassé n'empêche pas d'ouvrir une session ───────
out=$(printf 'pas du json' | CLAUDE_PROJECT_DIR="$DIR" bash "$HOOK" 2>/dev/null; echo "rc=$?")
check "entrée illisible → sort proprement" "$out" "rc=0"

out=$(printf '{"source":"startup"}' | CLAUDE_PROJECT_DIR="/inexistant" bash "$HOOK" 2>/dev/null; echo "rc=$?")
check "projet introuvable → sort proprement" "$out" "rc=0"

echo
if [ "$fails" = 0 ]; then echo "Tous verts."; else echo "$fails échec(s)."; fi
exit "$fails"
