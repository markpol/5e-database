#!/usr/bin/env zsh

# list actions with a condition
cat ./5e-SRD-Monsters-Normalized.json | jq -r '.[].actions[] | select(.condition)'

# list actions with a dc
cat ./5e-SRD-Monsters-Normalized.json | jq -r '.[].actions[] | select(.dc)'

# list actions with no damage and name is not Multiattack
cat ./5e-SRD-Monsters-Normalized.json | jq -r '.[].actions[] | select(.damage == null and .name != "Multiattack")'

# monster action with damage dc
cat ./5e-SRD-Monsters-Normalized.json | jq -r '.[].actions[] | select(.damage) | select(.damage[].dc)'
