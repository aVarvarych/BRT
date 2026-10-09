# BE-01 · Пакет `backend` у workspace

**Епік:** 0 · Каркас · **Тип:** технічна · **Оцінка:** S · **Залежить від:** —

## Навіщо
Потрібна порожня, але правильно налаштована основа, на яку далі лягатиме весь код.

## Що зробити
- [x] `backend/package.json`: `@tracker-road/backend`, `private`, `"type": "module"`, `engines.node >= 26`. Пакет додано у `workspaces` кореня.
- [x] TypeScript **6.0** (`~6.0.3`). TS 7 поки не підходить: у нього немає API компілятора, а без нього не працює `typescript-eslint`.
- [x] `tsconfig.json`: `strict` + додаткові перевірки, `module: ESNext`, `moduleResolution: Bundler`, `types: ["node"]`, `noEmit`, аліаси через `paths` (без `baseUrl`).
- [x] vitest: `vitest.config.ts` (unit) і `vitest.integration.config.ts` (integration, файли по черзі). Аліаси через `resolve.tsconfigPaths: true`.
- [x] Prettier у корені (`.prettierrc.json`, `.prettierignore`).
- [x] ESLint: `strictTypeChecked` + `eslint-plugin-boundaries`, щоб контролювати межі шарів і заборонити пакети в `domain` / `application`.
- [x] husky + lint-staged: pre-commit виконує lint-staged, pre-push — `npm run check`.
- [ ] Структура папок `src/domain`, `src/application`, `src/infrastructure`, `src/presentation/http`, `src/main`. Порожні папки git не зберігає, тож створюйте їх разом з першим кодом.
- [ ] `src/index.ts`: поки найпростіший HTTP-сервер або `console.log`. Справжній каркас з'явиться в BE-05.
- [ ] `tests/unit/smoke.test.ts` з імпортом через `@domain/...`. Поки його немає, `check` падає з `No test files found`.
- [ ] Скрипти запуску (рішення Q1–Q4 з обговорення dev/prod):
  ```json
  "dev": "tsx watch --env-file-if-exists=.env src/index.ts",
  "build": "esbuild src/index.ts --bundle --platform=node --format=esm --target=node26 --packages=external --sourcemap --outfile=dist/index.js",
  "start": "node --env-file-if-exists=.env --enable-source-maps dist/index.js"
  ```
  Також додати `esbuild` явною dev-залежністю, бо зараз він є лише як залежність `tsx`.
- [ ] Кореневий скрипт `dev:api`.

## Критерії приймання
- [ ] `npm run dev -w @tracker-road/backend` запускає сервер. Якщо змінити файл у `src/`, процес перезапускається.
- [ ] `npm run build && npm run start` запускає зібраний `dist/index.js` звичайним `node`, без `tsx`.
- [x] Якщо в `domain` написати `import express from 'express'`, лінтер видає помилку.
- [ ] `npm run check` з кореня зелений.
- [ ] Перший коміт зроблено (pre-commit спрацював).

## Чому так запускаємо
- **Dev:** бекенд працює прямо на Mac, у Docker лише база. `tsx watch` перезапускає процес приблизно за секунду. Справжній HMR для сервера не потрібен, перезапуск надійніший.
- **`--env-file-if-exists`:** Node 26 сам читає `.env`, тому бібліотека `dotenv` не потрібна, а `tsx` передає прапорець у Node. Варіант `-if-exists` не падає, якщо файлу немає. Про відсутні змінні зрозуміло повідомить валідація конфігу (BE-03).
- **Prod:** esbuild збирає код в один `dist/index.js` і розгортає аліаси. `--packages=external` лишає бібліотеки звичайними імпортами з `node_modules`. Тому в продакшн-образі немає ні TypeScript, ні `tsx`.
- **`--enable-source-maps`:** стек помилок у лозі показує рядки з `.ts`, а не зі зібраного файлу.
- У `start` той самий прапорець: у Docker змінні задає Compose і файлу `.env` немає, а локально `npm run start` усе одно підхопить `.env`.

## Підказки ментора
- Не тягніть залежності «про запас»: Express, Drizzle та інші додаються в тих задачах, де вони вперше знадобляться.
- `dist/` уже в `.gitignore`.
