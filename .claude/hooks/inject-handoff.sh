#!/bin/bash
# Réinjecte la passation (.claude/HANDOFF.md) au démarrage d'une session.
# Pendant du skill `/handoff` : le skill fait le JUGEMENT (ce qui mérite d'être
# transmis), ce hook fait le TRANSPORT (le remettre sous les yeux). Un shell sait
# faire le second et n'a aucun moyen de faire le premier — c'est toute la raison
# pour laquelle la passation ne s'écrit pas ici.
#
# Hook `SessionStart` : la sortie standard est ajoutée au contexte de départ.
#
# Trois décisions, chacune contre un mode d'échec précis :
#
# 1. **Il ne se déclenche pas après une compaction.** `source` vaut alors
#    `compact`, et le contexte n'a PAS été vidé : le chantier est encore là.
#    Réinjecter la passation le dirait une deuxième fois, avec une version plus
#    ancienne que ce que la session sait déjà — deux définitions du même état,
#    et celle qu'on lit n'est jamais celle qu'on corrige.
# 2. **Il annonce l'ÂGE, jamais seulement le contenu.** Une passation périmée est
#    pire que pas de passation : elle a l'air d'une information. Au-delà de
#    SEUIL_JOURS il le dit franchement et demande qu'on tranche.
# 3. **Toute anomalie sort en 0, sans un mot.** Fichier absent, JSON illisible,
#    python cassé : un hook de démarrage qui échoue fermé rendrait les sessions
#    impossibles à ouvrir. Il échoue ouvert, toujours.

SEUIL_JOURS=7

input=$(cat)

source_kind=$(printf '%s' "$input" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('source',''))" 2>/dev/null)
[ "$source_kind" = "compact" ] && exit 0

FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/HANDOFF.md"
[ -r "$FILE" ] && [ -s "$FILE" ] || exit 0

jours=$(python3 -c "import os,sys,time; print(int((time.time()-os.path.getmtime(sys.argv[1]))//86400))" "$FILE" 2>/dev/null)
case "$jours" in
  ''|*[!0-9]*) exit 0 ;;   # âge incalculable → on se tait (échec ouvert)
  0) age="aujourd'hui" ;;
  1) age="hier" ;;
  *) age="il y a $jours jours" ;;
esac

echo "=== Passation de la session précédente — .claude/HANDOFF.md, écrite $age ==="
echo
cat "$FILE"
echo
echo "=== fin de la passation ==="

if [ "$jours" -ge "$SEUIL_JOURS" ]; then
  echo "⚠️  Elle a plus de $SEUIL_JOURS jours. Vérifie qu'elle décrit encore le chantier en cours"
  echo "    avant de t'appuyer dessus — sinon dis-le et supprime-la."
fi

echo "Ce fichier est ÉPHÉMÈRE. Dès que son chantier repart ou qu'il est livré :"
echo "    rm .claude/HANDOFF.md"
echo "Ne le laisse pas traîner — une passation périmée a l'air d'une information."
exit 0
