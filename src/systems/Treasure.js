/** Trésors trouvés en fouillant les îles ; revendus en or dans les comptoirs. */
export const TREASURES = [
  { name: 'Pièces anciennes', icon: '🪙', min: 15, max: 30 },
  { name: 'Perles rares', icon: '📿', min: 30, max: 55 },
  { name: 'Coffre scellé', icon: '🧰', min: 50, max: 90 },
  { name: 'Idole dorée', icon: '🗿', min: 90, max: 150 },
  { name: 'Couronne maudite', icon: '👑', min: 140, max: 220 }
];
/** Probabilité de trouver un trésor en fouillant, et poids de rareté, selon le terrain. */
export const SEARCH = {
  island: { chance: .10, weights: [60, 30, 10, 0, 0] },
  archipelago: { chance: .30, weights: [30, 35, 25, 9, 1] },
  volcano: { chance: .40, weights: [10, 25, 30, 25, 10] }
};
export function rollTreasure(kind, random = Math.random) {
  const rule = SEARCH[kind];
  if (!rule || random() >= rule.chance) return null;
  let roll = random() * rule.weights.reduce((a, b) => a + b, 0), index = 0;
  for (; index < rule.weights.length - 1; index++) { roll -= rule.weights[index]; if (roll < 0) break; }
  const t = TREASURES[index];
  return { name: t.name, icon: t.icon, value: t.min + Math.floor(random() * (t.max - t.min + 1)) };
}
