# BE-08 · Таблиця та репозиторій маршрутів

**Епік:** 1 · Маршрути · **Тип:** історія · **Оцінка:** M · **Залежить від:** BE-04, BE-07

## Що зробити
- Drizzle-схема `routes`:
  - `id uuid pk`;
  - `device_id uuid not null references devices`;
  - `name text not null`;
  - `line geometry(LineString, 4326) null`;
  - `line_source_trip_id uuid null`;
  - `created_at`, `updated_at timestamptz`.
  - Індекс `(device_id, updated_at desc)`.
- Міграція через `db:generate`.
- `DrizzleRouteRepository implements IRouteRepository`. Мапер «рядок ↔ агрегат» лежить окремим файлом, щоб репозиторій лишався тонким.
- Конвертація `LineString` ↔ PostGIS: читати через `ST_AsGeoJSON(line)`, писати через `ST_GeomFromGeoJSON(...)`. Можна й WKT, на ваш вибір.

## Критерії приймання
- [ ] Integration-тести:
  - `save` → `findById` повертає рівний агрегат;
  - `listByDevice` не повертає маршрути іншого пристрою;
  - `delete` видаляє запис.
- [ ] Лінія зберігається й читається без втрати точності, до 1e-7°.

## Підказки ментора
- PostGIS очікує порядок **lng, lat** (x, y). Це найчастіша помилка. Напишіть на неї окремий тест.
- Репозиторій бере транзакцію з `AsyncLocalStorage` (BE-04), а не з параметра методу.
