#!/bin/sh
# Arguments : $1=index_reducer
REDUCER_ID=$1
DIR="/shared/reducer-$REDUCER_ID"

echo "[Reducer-$REDUCER_ID] Lecture de $DIR"

if [ ! -d "$DIR" ]; then
    echo "[Reducer-$REDUCER_ID] Aucune donnée."
    exit 0
fi

# Lire tous les fichiers, agréger les comptes par mot
cat "$DIR"/mapper-*.txt 2>/dev/null \
    | awk '{counts[$1] += $2} END {for (w in counts) print w, counts[w]}' \
    | sort -k2 -rn \
    > "/shared/result-$REDUCER_ID.txt"

echo "[Reducer-$REDUCER_ID] Résultat :"
cat "/shared/result-$REDUCER_ID.txt"
echo "[Reducer-$REDUCER_ID] Terminé."