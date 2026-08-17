#!/bin/bash
# Régression du hook `check-task-status.py`.
#
# Pourquoi un test pour un hook : un garde-fou ne s'observe pas en marche. S'il
# se met à bloquer une conversation anodine, il se fait désactiver ; s'il cesse
# de bloquer, personne ne le remarque — il devient juste un fichier. Les deux
# dérives sont muettes, donc elles se testent.
#
# ⚠️ La première version de ce harnais était verte et ne prouvait rien : elle
# nourrissait le parseur avec des transcripts COMPLETS, alors que le défaut réel
# était que le hook ne voit jamais le dernier message. Un harnais qui ne peut pas
# reproduire la condition de production teste autre chose que ce qu'il croit.
# D'où la section « le tour en cours », qui simule le message manquant.
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
usr()    { printf '{"type":"user","message":{"content":[{"type":"text","text":"question"}]}}\n'; }
result() { printf '{"type":"user","message":{"content":[{"type":"tool_result","content":"sortie"}]}}\n'; }

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

# ── Le tour en cours n'est jamais jugé ────────────────────────────────────────
# Le défaut qui a fait bloquer un message commençant par « FINI » : au moment où
# un hook Stop lit le transcript, le dernier message de l'assistant n'y est pas
# encore. Ces deux cas simulent exactement ça — un tour ouvert, sans message
# utilisateur pour le refermer.
{ usr; edit; } > "$DIR/inflight.jsonl"
run "tour en cours, conclusion pas encore écrite → passe" "$DIR/inflight.jsonl" 0

{ usr; edit; say "Voilà."; } > "$DIR/inflight2.jsonl"
run "tour en cours, même avec du texte → passe" "$DIR/inflight2.jsonl" 0

# ⚠️ Un résultat d'outil est enregistré sous `type: "user"`, comme un vrai
# message. Sur une vraie session il y en a vingt-cinq fois plus que de messages
# tapés : les confondre plaçait la frontière du tour à trois entrées de la fin,
# donc nulle part, et le hook rejugeait le tour en cours malgré la coupure.
{ usr; edit; result; edit; result; } > "$DIR/inflight3.jsonl"
run "les résultats d'outils ne referment pas un tour → passe" "$DIR/inflight3.jsonl" 0

# ── Un tour clos sans statut se rattrape au tour suivant ──────────────────────
{ usr; edit; say "Voilà, c'est modifié."; usr; } > "$DIR/1.jsonl"
run "tour clos, édition sans statut → bloque" "$DIR/1.jsonl" 2

{ usr; bash_c "git commit -m x"; say "poussé"; usr; } > "$DIR/2.jsonl"
run "tour clos, commit sans statut → bloque" "$DIR/2.jsonl" 2

{ usr; bash_c "git add -A && git commit -q -F -"; say "ok"; usr; } > "$DIR/3.jsonl"
run "commit après && → bloque" "$DIR/3.jsonl" 2

# Le statut ne vaut que pour ce qui le précède : rouvrir le chantier le réclame
# à nouveau, sinon un « FINI » posé tôt vaudrait absolution pour la suite.
{ usr; edit; say "BLOQUÉ sur la migration."; edit; say "j'ai retouché"; usr; } > "$DIR/4.jsonl"
run "ré-édition après un statut → rebloque" "$DIR/4.jsonl" 2

# ── Ce qu'il doit laisser passer — la moitié qui décide s'il survit ───────────
{ usr; edit; say "Tout est en place. FINI."; usr; } > "$DIR/5.jsonl"
run "édition + statut → passe" "$DIR/5.jsonl" 0

{ usr; say "Le fichier fait 90 Ko, j'ai fini de le lire."; usr; } > "$DIR/6.jsonl"
run "conversation seule → passe" "$DIR/6.jsonl" 0

{ usr; bash_c "ls -la"; say "voici la liste"; usr; } > "$DIR/7.jsonl"
run "bash en lecture seule → passe" "$DIR/7.jsonl" 0

# ⚠️ Le hook a compté sa propre sonde de débogage comme une livraison : la regex
# matchait la sous-chaîne partout, y compris dans un grep ou un heredoc.
{ usr; bash_c "grep -n \\\"git commit\\\" fichier.py"; say "voici"; usr; } > "$DIR/8.jsonl"
run "commande qui PARLE de git commit → passe" "$DIR/8.jsonl" 0

# ── Il rappelle une fois, il ne séquestre pas ────────────────────────────────
run "deuxième passage → rend la main" "$DIR/1.jsonl" 0 true

# ── Il échoue ouvert : un hook cassé ne bloque pas une session ───────────────
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
