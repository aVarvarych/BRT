# BE-07 · Домен: агрегат Route

**Епік:** 1 · Маршрути · **Тип:** історія · **Оцінка:** S · **Залежить від:** BE-01

## Навіщо
Перший агрегат на чистому TypeScript. Він задає стиль усього домену, тож варто зробити його ретельно.

## Що зробити
- Value objects:
  - `RouteId` (UUID);
  - `DeviceId`;
  - `RouteName`: обрізає пробіли, довжина 1–100, інакше `InvalidRouteName`.
- Агрегат `Route` з полями:
  - `id`;
  - `deviceId`;
  - `name`;
  - `line: LineString | null`;
  - `lineSourceTripId: string | null`;
  - `createdAt`, `updatedAt`.
- Фабрики:
  - `Route.create({ id, deviceId, name, now })`;
  - `Route.restore(props)` (для репозиторію, без валідації бізнес-правил повторно).
- Методи:
  - `rename(name, now)`;
  - `assignLine(line, tripId, now)`: можна викликати **лише один раз**, повторний виклик → `RouteLineAlreadyAssigned`;
  - `isOwnedBy(deviceId)`.
- Порт `IRouteRepository`:
  - `findById`;
  - `listByDevice`;
  - `save`;
  - `delete`.
- Тип `LineString` (масив `{ lat, lng }`) оголошується в `domain`, бо ним користуються інші модулі.

## Критерії приймання
- [ ] Unit-тести:
  - створення;
  - невалідна назва (порожня, з одних пробілів, 101 символ);
  - перейменування оновлює `updatedAt`;
  - повторний `assignLine` кидає помилку.
- [ ] У `domain/route` немає жодного імпорту ззовні `domain`.

## Підказки ментора
- Сеттерів немає: стан змінюється лише через методи з назвою дії.
- `now` передається параметром, домен годинника не знає.
