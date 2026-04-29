#!/bin/sh
# Arguments : $1=index_mapper  $2=nb_reducers  $3=données...
MAPPER_ID=$1
NB_REDUCERS=$2
shift 2
FILE_PATH=$1

echo "[Mapper-$MAPPER_ID] Traitement du fichier : $FILE_PATH"

# Java a déjà mis le texte en minuscules — on extrait juste les mots
cat "$FILE_PATH" \
    | tr -cs 'a-z0-9' '\n' \
    | grep -v '^$' \
    | sort | uniq -c \
    | while read count word; do
    # Déterminer le reducer cible via hash du mot
    hash=$(echo -n "$word" | cksum | cut -d' ' -f1)
    reducer_id=$((hash % NB_REDUCERS))
    dir="/shared/reducer-$reducer_id"
    mkdir -p "$dir"
    echo "$word $count" >> "$dir/mapper-$MAPPER_ID.txt"
    echo "[Mapper-$MAPPER_ID] '$word'($count) -> reducer-$reducer_id"
done

echo "[Mapper-$MAPPER_ID] Terminé."