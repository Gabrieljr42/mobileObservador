# Observador de Concursos - Mobile

App Expo (React Native + TypeScript) **offline-first**: as telas leem o SQLite local e sincronizam com o backend via `GET /sync/checkpoint`.

Documentação completa: [../README.md](../README.md) (quick start), [../docs/MOBILE.md](../docs/MOBILE.md), [../docs/ONBOARDING.md](../docs/ONBOARDING.md).

> Nota: este README substituí um template genérico em 2026-09-05. O fluxo oficial é o descrito aqui.

## Pré-requisitos

- Node.js LTS
- App Expo Go no celular (ou emulador Android / navegador para web)

## Rodar

```powershell
cd mobile
copy .env.example .env   # ajuste EXPO_PUBLIC_API_BASE_URL (ver tabela abaixo)
npm install
npx expo start --tunnel
```

| Onde roda | `EXPO_PUBLIC_API_BASE_URL` |
|---|---|
| Navegador (`npx expo start --web`) | `http://localhost:8000` |
| Celular físico (mesma rede do backend) | `http://SEU_IP_LOCAL:8000` (ex.: `http://192.168.0.105:8000`) |
| Emulador Android | `http://10.0.2.2:8000` |

Outros comandos: `npm run dev` (web em `:3000`), `npm run build` (`expo export -p web`), `npx tsc --noEmit` (hoje com 1 erro pré-existente em `components/ExternalLink.tsx` — ver `../docs/DEPLOYMENT_TROUBLESHOOTING.md`).

## Como funciona (resumo)

- Rotas em `app/` (expo-router): `onboarding`, `login`, `cadastro`, `(tabs)/inicio|busca|atualizacoes|alertas|salvos|perfil`, `concurso/[id]`, `notificacoes`.
- `src/api/*.ts` lê o banco local (`src/db/repositories.ts`); rede só no login/cadastro (`src/api/auth.ts`) e no ciclo de sync (`src/sync/syncService.ts`).
- Escritas offline vão para a tabela `outbox` e são drenadas no próximo sync; `applyCheckpoint()` substitui o conteúdo local.
- Builds nativos via EAS (`eas.json`: `preview` APK interno, `production` AAB, ambos apontando para `https://api.observador.tech`).
