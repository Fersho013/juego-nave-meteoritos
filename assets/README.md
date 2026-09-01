# Assets — Atlas futuro

Esta carpeta está reservada para los recursos del juego.

- `atlas.json` — manifiesto del atlas (sprites, texturas y audio). Añade aquí tus spritesheets y define frames.
- Coloca imágenes en `assets/sprites/`, fondos en `assets/backgrounds/`, audio en `assets/audio/`.

Ejemplo de entrada futura en atlas.json:
```json
{
  "textures": [{ "id": "player", "src": "sprites/player.png" }],
  "sprites": [{ "id": "enemy_common", "frame": { "x": 0, "y": 0, "w": 24, "h": 24 } }]
}
```
