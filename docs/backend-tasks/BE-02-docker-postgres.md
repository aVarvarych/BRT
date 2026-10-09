# BE-02 · Docker Compose: PostgreSQL + PostGIS

**Епік:** 0 · Каркас · **Тип:** технічна · **Оцінка:** S · **Залежить від:** BE-01

## Навіщо
Для розробки й integration-тестів потрібна локальна база з PostGIS.

## Що зробити
- Створити `docker-compose.dev.yml` у корені репозиторію з сервісом `db`:
  - образ `postgis/postgis:16-3.4` (або новіший 16.x);
  - порт `5432` (або інший, якщо 5432 зайнятий);
  - volume для даних;
  - `healthcheck` через `pg_isready`.
- Дві бази: `tracker` для розробки й `tracker_test` для integration-тестів. Створювати через init-скрипт у `infra/db/init/`.
- `backend/.env.example` з `DATABASE_URL` і `DATABASE_URL_TEST`.
- Коротко описати в `backend/README.md`, як підняти базу.
- **Одна команда для всього dev-оточення** (рішення Q5): кореневий скрипт `dev` піднімає базу і паралельно запускає API та застосунок через пакет `concurrently`:
  ```json
  "db:up": "docker compose -f docker-compose.dev.yml up -d --wait",
  "dev:api": "npm run dev -w @tracker-road/backend",
  "dev": "npm run db:up && concurrently -n api,app -c blue,magenta \"npm:dev:api\" \"npm:dev:app\""
  ```
  `--wait` чекає, поки healthcheck бази стане `healthy`, і лише потім запускає API. `concurrently` встановити в корені як dev-залежність.

## Критерії приймання
- [ ] `docker compose -f docker-compose.dev.yml up -d` піднімає базу, healthcheck стає `healthy`.
- [ ] У базі `tracker` працює `SELECT postgis_version();`.
- [ ] База `tracker_test` теж створена.
- [ ] `npm run dev` з кореня піднімає базу, API і застосунок. У виводі видно префікси `[api]` і `[app]`, а `Ctrl+C` зупиняє обидва процеси (база лишається працювати).

## Підказки ментора
- Init-скрипти з `/docker-entrypoint-initdb.d` виконуються **лише на порожньому volume**. Якщо скрипт змінився, треба виконати `docker compose down -v`.
- Розширення `postgis` у базі вмикатиме перша міграція (BE-04), а не init-скрипт. Тоді воно з'явиться і в продакшн-базі.
