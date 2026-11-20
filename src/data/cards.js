export const RARITY_LABEL = { common:'COMMUNE', rare:'RARE', epic:'ÉPIQUE' };
export const TYPE_LABEL = { attack:'ATTAQUE', move:'MOUVEMENT', blessing:'BÉNÉDICTION', heal:'SOUTIEN', scout:'EXPLORATION' };
export const CARD_LIBRARY = [
  { id:'broadside', name:'Bordée', icon:'💣', type:'attack', rarity:'rare', cost:4, description:'Tire un boulet sur le navire ennemi.', power:7, range:3, weapon:'ranged' },
  { id:'grapple', name:'Grappin', icon:'🪝', type:'move', rarity:'common', cost:2, description:'Attire ton navire d’une case vers l’ennemi.', distance:1 },
  { id:'sidestep', name:'Manœuvre', icon:'⛵', type:'move', rarity:'common', cost:2, description:'Esquive et avance de deux cases.', distance:2 },
  { id:'cutlass', name:'Coup de coutelas', icon:'⚔️', type:'attack', rarity:'rare', cost:3, description:'Frappe au corps-à-corps.', power:6, range:1, weapon:'melee' },
  { id:'repair', name:'Réparation', icon:'🪵', type:'heal', rarity:'common', cost:2, description:'Restaure 5 points de coque.', power:5 },
  { id:'pistol', name:'Tir rapide', icon:'🔫', type:'attack', rarity:'rare', cost:3, description:'Un tir précis à courte portée.', power:5, range:2, weapon:'ranged' },
  { id:'sea-blessing', name:'Bénédiction des mers', icon:'🌊', type:'blessing', rarity:'epic', cost:5, image:'./cards/sea-blessing.webp', description:'Double la chance pendant 2 tours et dissipe les effets négatifs.' },
  { id:'emergency-planks', name:'Planches de secours', icon:'🪵', type:'heal', rarity:'common', cost:1, image:'./cards/emergency-planks.webp', description:'Répare immédiatement 6 points de coque.', power:6 },
  { id:'compass', name:'Boussole dorée', icon:'🧭', type:'scout', rarity:'rare', cost:2, image:'./cards/compass.webp', description:'Indique la direction du trésor le plus proche. +15 or près d’une île.', effect:'compass' },
  { id:'rum', name:'Rhum de fortune', icon:'🍺', type:'heal', rarity:'common', cost:1, image:'./cards/rum.webp', description:'Soigne la moitié des dégâts subis mais baisse la chance de 10 %.', effect:'rum' },
  { id:'spyglass', name:'Longue-vue', icon:'🔭', type:'scout', rarity:'rare', cost:3, image:'./cards/spyglass.webp', description:'Révèle les cases cachées sous les nuages dans un rayon de 3 hexagones.', effect:'spyglass', radius:3 }
];
export const cardById = id => CARD_LIBRARY.find(card => card.id === id);
export const DEFAULT_DECK = ['broadside','grapple','sidestep','cutlass','repair','pistol','sea-blessing','emergency-planks'];
export const DECK_MIN_SIZE = 4;
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
