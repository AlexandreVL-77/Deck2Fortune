# Ajouter une carte
1. Image 5:7 dans `assets/cards/` (optionnelle : une carte générée est utilisée sinon, avec `icon`).
2. Ajouter une entrée dans `CARD_LIBRARY` (`src/data/cards.js`) :
   `{ id, name, type:'attack|move|heal|utility', rarity:'common|rare|epic|legendary', description, image, icon, power, range, ... }`
3. Les points sont calculés automatiquement (force + rareté) ; `points: N` pour forcer. Deck max : 50 points, 4 à 6 cartes.
4. Nouvel effet : `registerEffect('mon-effet', ({state, card, ...}) => ({ ok:true, message }))` dans `src/systems/cardEffects.js`, puis `effect:'mon-effet'` sur la carte.
5. Vérifier : `node tests/cards.test.mjs`.
