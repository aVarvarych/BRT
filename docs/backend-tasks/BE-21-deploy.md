# BE-21 · Docker-образ, Caddy, деплой на VPS, бекапи

**Епік:** 6 · Деплой · **Тип:** технічна · **Оцінка:** L · **Залежить від:** BE-19

## Навіщо
Телефон на трасі має бачити сервер з інтернету через HTTPS, а PWA і API мають жити на одному домені (PRODUCT.md §6.5).

## Що зробити
- `backend/Dockerfile`:
  - multi-stage збирання: етап `build` виконує `npm ci` + `npm run build` (esbuild → `dist/index.js`), а фінальний етап містить лише `dist/` і prod-залежності;
  - prod-залежності: `npm ci --omit=dev --ignore-scripts`. Без `--ignore-scripts` скрипт `prepare: husky` упаде, бо husky у prod не встановлений;
  - команда запуску: `node --enable-source-maps dist/index.js`. Без `tsx` і TypeScript;
  - запуск від non-root користувача;
  - `HEALTHCHECK` на `/health`.
- `docker-compose.prod.yml` з трьома сервісами:
  - `db`: PostGIS, volume, пароль з `.env`, **порт назовні не відкривати**;
  - `api`: **перед стартом окремим кроком** виконуються міграції (окремий одноразовий сервіс `migrate` з `depends_on: condition: service_completed_successfully`, або команда в entrypoint). Змінні середовища задає Compose (`env_file`), файлу `.env` в образі немає;
  - `caddy`;
  - у всіх сервісів `restart: unless-stopped`. PM2 не потрібен, перезапуск після падіння бере на себе Docker.
- `infra/Caddyfile`:
  - `ваш-домен` → `/v1/*` і `/health` проксіюються на `api:3000`;
  - решта роздається як статика `app/dist` з fallback на `index.html`;
  - HTTPS налаштовується автоматично;
  - `sw.js` і `index.html` віддаються з `Cache-Control: no-cache`, щоб оновлення доходили до телефона.
- `.env.prod.example`.
- `DEPLOYMENT.md`:
  - як оновити сервер;
  - як переглянути логи;
  - як відкотитися.
- CI: `npm run check` + `npm audit --omit=dev` для кожного push.
- **Бекапи:** щоденний `pg_dump` (cron на хості або окремий контейнер) з ротацією 7 днів. Перевірити відновлення з бекапу хоча б один раз.

## Критерії приймання
- [ ] `https://ваш-домен/health` → 200 з телефона.
- [ ] PWA встановлюється з `https://ваш-домен` і ходить в API без CORS.
- [ ] Бекап створюється, а відновлення на чистій базі перевірено вручну.
- [ ] Порт 5432 закритий ззовні (перевірка `nc` з іншої машини).

## Підказки ментора
- Ваш `store_medbuy` уже деплоїться через Docker на `anigo.in.ua` (див. `DEPLOYMENT.md` там). Подивіться, що з того можна перевикористати.
- `API_KEY` для продакшну згенеруйте командою `openssl rand -base64 48` і нікуди не комітьте.
