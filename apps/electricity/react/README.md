# Electricity React mini-app

Ce dossier contient le mini-app React dédié à l'app Django `electricity`.

## Convention

- `ElectricityBoardNode.tsx` : composant principal du mini-app
- `mount-electricity.tsx` : composant d'entrée (entrypoint mount)

Le frontend global garde seulement un pont léger dans `ui/src/electricity/` pour le bundling Vite.
La source métier React reste ici, au plus proche de l'app Django.
