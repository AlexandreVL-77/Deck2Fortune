export const CARD_LIBRARY = [
  { id:'broadside', name:'Bordée', icon:'💣', type:'attack', rarity:'rare', description:'Tire un boulet sur le navire ennemi.', power:7, range:3, weapon:'ranged' },
  { id:'grapple', name:'Grappin', icon:'🪝', type:'move', rarity:'common', description:'Attire ton navire d’une case vers l’ennemi.', distance:1 },
  { id:'sidestep', name:'Manœuvre', icon:'⛵', type:'move', rarity:'common', description:'Esquive et avance de deux cases.', distance:2 },
  { id:'cutlass', name:'Coup de coutelas', icon:'⚔️', type:'attack', rarity:'rare', description:'Frappe au corps-à-corps.', power:6, range:1, weapon:'melee' },
  { id:'repair', name:'Réparation', icon:'🪵', type:'heal', rarity:'common', description:'Restaure 5 points de coque.', power:5 },
  { id:'pistol', name:'Tir rapide', icon:'🔫', type:'attack', rarity:'rare', description:'Un tir précis à courte portée.', power:5, range:2, weapon:'ranged' },
  { id:'sea-blessing', name:'Bénédiction des mers', icon:'⚓', type:'blessing', rarity:'epic', image:'./assets/cards/Bénédiction dorée des mers .webp?v=4', description:'Double ta statistique de Luck pendant 2 tours et dissipe les effets négatifs.' },
  { id:'emergency-planks', name:'Planches de secours', icon:'🪵', type:'heal', rarity:'common', image:'./assets/cards/Planches de secours en mer .webp?v=4', description:'Répare immédiatement 6 points de coque.', power:6 },
  { id:'golden-compass', name:'Boussole dorée', icon:'🧭', type:'utility', rarity:'rare', image:'./assets/cards/Boussole dorée du trésor geschniegelt .png?v=4', effect:'compass', description:'Indique la direction du trésor le plus proche et rapporte +15 Or si jouée près d’une île.' },
  { id:'rum-of-fortune', name:'Rhum de fortune', icon:'🍹', type:'heal', rarity:'common', image:'./assets/cards/Carte de rhum nautique fantastique .png?v=4', healRatio:.5, luckPenalty:10, description:'Soigne de 50% les dégâts du capitaine mais baisse de 10% ta Luck.' },
  { id:'spyglass', name:'Longue-vue', icon:'🔭', type:'utility', rarity:'rare', image:'./assets/cards/Longue-vue sur l’océan découvert .png?v=4', effect:'reveal', radius:3, description:'Révèle les cases sous les nuages dans un rayon de 3 hexagones.' }
];
export const DEFAULT_DECK = ['broadside','grapple','sidestep','cutlass','repair','pistol','sea-blessing','emergency-planks'];
export const DECK_MIN_SIZE = 8;
export const DECK_MAX_SIZE = 8;
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
