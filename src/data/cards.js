export const CARD_LIBRARY = [
  { id:'sea-blessing', name:'Bénédiction des mers', icon:'⚓', type:'blessing', rarity:'epic', image:'./assets/cards/Bénédiction dorée des mers.webp?v=4', description:'Double ta statistique de Luck pendant 2 tours et dissipe les effets négatifs.' },
  { id:'emergency-planks', name:'Planches de secours', icon:'🪵', type:'heal', rarity:'common', image:'./assets/cards/Planches de secours en mer.webp?v=4', description:'Répare immédiatement 6 points de coque.', power:6 },
  { id:'golden-compass', name:'Boussole dorée', icon:'🧭', type:'utility', rarity:'rare', image:'./assets/cards/Boussole dorée du trésor geschniegelt.png?v=4', effect:'compass', description:'Indique la direction du trésor le plus proche et rapporte +15 Or si jouée près d’une île.' },
  { id:'rum-of-fortune', name:'Rhum de fortune', icon:'🍹', type:'heal', rarity:'common', image:'./assets/cards/Carte de rhum nautique fantastique.png?v=4', healRatio:.5, luckPenalty:10, description:'Soigne de 50% les dégâts du capitaine mais baisse de 10% ta Luck.' },
  { id:'spyglass', name:'Longue-vue', icon:'🔭', type:'utility', rarity:'rare', image:'./assets/cards/Longue-vue sur l’océan découvert.png?v=4', effect:'reveal', radius:3, description:'Révèle les cases sous les nuages dans un rayon de 3 hexagones.' },
  { id:'fog-veil', name:'Brume de dissimulation', icon:'🌫️', type:'utility', use:'combat', effect:'fog', turns:1, rarity:'rare', image:'./assets/cards/brume-de-dissimulation.webp?v=1', description:'Rend le navire intouchable aux attaques à distance ennemies pendant 1 tour, mais empêche de tirer.' },
  { id:'deck-gatling', name:'Mitraille de pont', icon:'💥', type:'attack', effect:'volley', power:5, range:1, rarity:'rare', image:'./assets/cards/mitraille-de-pont.webp?v=1', description:'Inflige 5 dégâts à tous les ennemis situés sur les cases adjacentes directes.' },
  { id:'heavy-shot', name:'Boulet Lourd', icon:'⚫', type:'attack', effect:'heavy-shot', power:9, range:4, rarity:'epic', image:'./assets/cards/boulet-lourd.webp?v=1', description:'Un tir lourd qui inflige 9 dégâts et repousse le navire ennemi touché d’une case en arrière.' }
];
export const DEFAULT_DECK = ['sea-blessing','emergency-planks','golden-compass','rum-of-fortune','spyglass'];
export const DECK_MIN_SIZE = 5;
export const DECK_MAX_SIZE = 6;

/** Raretés : points de base d'une carte, poids de tirage en booster, libellé. */
export const RARITIES = {
  common: { label: 'Commune', base: 4, weight: 70 },
  rare: { label: 'Rare', base: 7, weight: 25 },
  epic: { label: 'Épique', base: 12, weight: 5 },
  legendary: { label: 'Légendaire', base: 18, weight: 1 }
};
export const TYPE_LABELS = { attack: 'ATTAQUE', move: 'MOUVEMENT', blessing: 'BÉNÉDICTION', heal: 'SOUTIEN', utility: 'EXPLORATION' };

/** Budget de points du deck : chaque carte coûte selon sa rareté et sa force, le deck est plafonné. */
export const DECK_POINT_LIMIT = 50;

/** Effet joué par une carte : `effect` explicite, sinon déduit du type. Les effets sont définis dans systems/cardEffects.js. */
export const cardEffectId = card => card.effect || ({ attack: 'attack', move: 'move', blessing: 'bless', heal: 'heal' }[card.type]) || 'none';
/** Contexte d'usage : 'combat' (attaque, mouvement) ou 'anywhere' (soins, bénédiction, exploration). */
export const cardUse = card => card.use || (card.type === 'attack' || card.type === 'move' ? 'combat' : 'anywhere');

/** Points d'une carte = base de rareté + force de l'effet. `card.points` force une valeur précise. */
export function cardPoints(card) {
  if (!card) return 0;
  // Mode debug demandé : chaque carte coûte exactement 1 point.
  return 1;
  /* Calcul normal conservé ci-dessous pour pouvoir le réactiver après le debug.
  if (Number.isFinite(card.points)) return Math.max(1, Math.round(card.points));
  const strength = {
    attack: () => (card.power || 0) * 1.5 + Math.max(0, (card.range || 1) - 1) * 2,
    move: () => (card.distance || 1) * 3,
    heal: () => (card.healRatio ? card.healRatio * 16 : card.power || 0) - (card.luckPenalty || 0) * .3,
    bless: () => (card.turns || 2) * 3,
    compass: () => 5,
    reveal: () => (card.radius || 3) * 2
  }[cardEffectId(card)];
  return Math.max(1, Math.round((RARITIES[card.rarity]?.base ?? 4) + (strength ? strength() : 3)));
  */
}
export const getCard = id => CARD_LIBRARY.find(card => card.id === id);
export const deckPoints = ids => ids.reduce((sum, id) => sum + cardPoints(getCard(id)), 0);

/** Vérifie la bibliothèque (à lancer après l'ajout de cartes) ; renvoie la liste des problèmes. */
export function validateLibrary(library = CARD_LIBRARY) {
  const problems = [], seen = new Set();
  for (const card of library) {
    if (!card.id || seen.has(card.id)) problems.push(`id manquant ou en double : ${card.id}`);
    seen.add(card.id);
    for (const key of ['name', 'type', 'rarity', 'description']) if (!card[key]) problems.push(`${card.id} : champ « ${key} » manquant`);
    if (!RARITIES[card.rarity]) problems.push(`${card.id} : rareté inconnue « ${card.rarity} »`);
    if (!TYPE_LABELS[card.type]) problems.push(`${card.id} : type inconnu « ${card.type} »`);
    if (cardPoints(card) > DECK_POINT_LIMIT) problems.push(`${card.id} : coûte plus que le budget du deck`);
  }
  for (const id of DEFAULT_DECK) if (!seen.has(id)) problems.push(`deck par défaut : carte inconnue « ${id} »`);
  if (deckPoints(DEFAULT_DECK) > DECK_POINT_LIMIT) problems.push('le deck par défaut dépasse le budget de points');
  return problems;
}
export const shuffle = items => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export const createHand = (deckIds = DEFAULT_DECK) => shuffle(deckIds).slice(0, 4)
  .map(id => CARD_LIBRARY.find(card => card.id === id)).filter(Boolean).map(card => ({...card}));
