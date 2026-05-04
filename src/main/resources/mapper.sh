#!/bin/sh
MAPPER_ID=$1
NB_REDUCERS=$2
FILE_PATH=$3

echo "[Mapper-$MAPPER_ID] Traitement du fichier : $FILE_PATH"

# Step 1: word count into a temp file
TMP=$(mktemp)
cat "$FILE_PATH" \
    | tr -cs 'a-z0-9' '\n' \
    | grep -v '^$' \
    | sort \
    | uniq -c \
    | awk '{print $2, $1}' > "$TMP"   # normalize to "word count"

# Step 2: route each word to its reducer in a single awk pass (no subshells)
awk -v mapper_id="$MAPPER_ID" -v nb_reducers="$NB_REDUCERS" '
{
    word  = $1
    count = $2
    hash = 5381
    n    = split(word, chars, "")
    for (i = 1; i <= n; i++)
        hash = (hash * 33 + ord(chars[i])) % 2147483647

    reducer_id = hash % nb_reducers
    print word, count >> ("/shared/reducer-" reducer_id "/mapper-" mapper_id ".txt")
}

function ord(c) {
    return index("abcdefghijklmnopqrstuvwxyz0123456789", c)
}
' "$TMP"

rm -f "$TMP"
echo "[Mapper-$MAPPER_ID] Terminé."