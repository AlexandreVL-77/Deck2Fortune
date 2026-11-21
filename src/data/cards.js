export const CARD_LIBRARY = [
  { id:'sea-blessing', name:'Bénédiction des mers', icon:'⚓', type:'blessing', rarity:'epic', image:'./assets/cards/Bénédiction dorée des mers.webp?v=4', description:'Double ta statistique de Luck pendant 2 tours et dissipe les effets négatifs.' },
  { id:'emergency-planks', name:'Planches de secours', icon:'🪵', type:'heal', rarity:'common', image:'./assets/cards/Planches de secours en mer.webp?v=4', description:'Répare immédiatement 6 points de coque.', power:6 },
  { id:'golden-compass', name:'Boussole dorée', icon:'🧭', type:'utility', rarity:'rare', image:'./assets/cards/Boussole dorée du trésor geschniegelt.png?v=4', effect:'compass', description:'Indique la direction du trésor le plus proche et rapporte +15 Or si jouée près d’une île.' },
  { id:'rum-of-fortune', name:'Rhum de fortune', icon:'🍹', type:'heal', rarity:'common', image:'./assets/cards/Carte de rhum nautique fantastique.png?v=4', healRatio:.5, luckPenalty:10, description:'Soigne de 50% les dégâts du capitaine mais baisse de 10% ta Luck.' },
  { id:'spyglass', name:'Longue-vue', icon:'🔭', type:'utility', rarity:'rare', image:'./assets/cards/Longue-vue sur l’océan découvert.png?v=4', effect:'reveal', radius:3, description:'Révèle les cases sous les nuages dans un rayon de 3 hexagones.' }
];
export const DEFAULT_DECK = ['sea-blessing','emergency-planks','golden-compass','rum-of-fortune','spyglass'];
export const DECK_MIN_SIZE = 5;
export const DECK_MAX_SIZE = 5;
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
