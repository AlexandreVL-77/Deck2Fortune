# Pirate Hex

Prototype de jeu d'aventure tactique pirate, pensé pour une interface mobile en portrait.

## Stack
- JavaScript (ES modules)
- Phaser 3
- Vite

## Installation
Installe Node.js, puis dans le dossier du projet :

```bash
npm install
npm run dev
```

Vite affiche une adresse locale (généralement http://localhost:5173).

## Build
```bash
npm run build
npm run preview
```

## Structure
- `src/main.js` : démarrage Phaser et liaison de l'interface
- `src/scenes/GameScene.js` : scène principale et exploration
- `src/systems/` : état, grille hexagonale, combat et boutique
- `src/data/` : cartes, armes et cosmétiques
- `src/ui/` : interface HTML

## Contrôles du prototype
- Clique sur une case de la carte pour explorer.
- En combat, sélectionne une carte puis clique une seconde fois pour la jouer.
- Termine le tour avec le bouton dédié.
- La boutique permet d'acheter des boosters avec les pièces d'or.

Le projet est un prototype : sauvegarde persistante, animations finales, génération avancée et équilibrage restent à développer.
