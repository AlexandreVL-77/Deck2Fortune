export const CARD_LIBRARY = [
  { id:'broadside', name:'Bordée', icon:'💣', type:'attack', description:'Tire un boulet sur le navire ennemi.', power:7, range:3, weapon:'ranged' },
  { id:'grapple', name:'Grappin', icon:'🪝', type:'move', description:'Attire ton navire d’une case vers l’ennemi.', distance:1 },
  { id:'sidestep', name:'Manœuvre', icon:'⛵', type:'move', description:'Esquive et avance de deux cases.', distance:2 },
  { id:'cutlass', name:'Coup de coutelas', icon:'⚔️', type:'attack', description:'Frappe au corps-à-corps.', power:6, range:1, weapon:'melee' },
  { id:'repair', name:'Réparation', icon:'🪵', type:'heal', description:'Restaure 5 points de coque.', power:5 },
  { id:'pistol', name:'Tir rapide', icon:'🔫', type:'attack', description:'Un tir précis à courte portée.', power:5, range:2, weapon:'ranged' }
];
export const createHand = () => ['broadside','grapple','sidestep','cutlass'].map(id => ({...CARD_LIBRARY.find(c=>c.id===id)}));
