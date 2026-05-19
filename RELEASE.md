Configuración de publicación automática (GitHub Actions + semantic-release)

Requisitos de secretos en el repositorio (Settings → Secrets):
- `NPM_TOKEN`: token de publicación de npm (desde https://www.npmjs.com/settings/<tu-usuario>/tokens)

Notas importantes:
- `GITHUB_TOKEN` es provisto automáticamente por GitHub Actions.
- El workflow se ejecuta en `push` a la rama `main` y corre `semantic-release`.
- `semantic-release` analizará los commits para decidir si corresponde `patch`, `minor` o `major`.

Comandos locales útiles:
- Instalar dependencias: `npm install`
- Instalar `semantic-release` y plugins localmente (recomendado para dry-run):
	`npm install -D semantic-release @semantic-release/changelog @semantic-release/commit-analyzer @semantic-release/release-notes-generator @semantic-release/npm @semantic-release/git`
- Ejecutar release local (no recomendado contra npm público sin tokens): `npx semantic-release --dry-run`
