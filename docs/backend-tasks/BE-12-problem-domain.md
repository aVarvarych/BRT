# BE-12 · Домен: Problem і Mark

**Епік:** 4 · Проблеми · **Тип:** історія · **Оцінка:** M · **Залежить від:** BE-07

## Навіщо
Позначка (`Mark`) — це один факт натискання кнопки. Проблема (`Problem`) — сама яма, яка переживає багато поїздок. Їх розділення описано в PRODUCT.md §10.1–10.2.

## Що зробити
- Value objects:
  - `ProblemType`: `pothole | broken | bump | roadwork | other`;
  - `Severity`: `moderate | serious | dangerous`;
  - `ProblemStatus`: `active | resolved`;
  - `GeoPoint { lat, lng }` з валідацією діапазонів: lat ±90, lng ±180.
- Агрегат `Problem` з полями:
  - `id`, `routeId`, `position`;
  - `type`, `severity`, `status`;
  - `confirmations`;
  - `firstReportedAt`, `lastConfirmedAt`, `resolvedAt`;
  - `createdByTripId`;
  - `kmFromStart`;
  - `updatedAt`.
- Методи:
  - `Problem.reportNew({ markId, routeId, tripId, position, now })`: `id = markId`, тип `pothole`, серйозність `serious`, `confirmations = 1`;
  - `confirm(now)`: `+1` підтвердження. Якщо проблема була `resolved`, повертає її в `active` і очищає `resolvedAt`;
  - `changeType`, `changeSeverity`;
  - `resolve(now)` і `restore(now)`;
  - `removeConfirmation(now)`: потрібно для видалення хибної позначки в BE-15. Не може опуститися нижче 1;
  - `setKmFromStart(km | null)`.
- Сутність `Mark` з полями:
  - `id`, `tripId`, `deviceId`;
  - `t`;
  - `rawPosition`, `position`;
  - `problemId`.
- Порти:
  - `IProblemRepository`: `findById`, `findByRoute(routeId, { statuses })`, `save`, `delete`;
  - `IMarkRepository`: `findById`, `listByTrip`, `save`, `delete`.

## Критерії приймання
- [ ] Unit-тести на кожен метод і на інваріант «`resolvedAt` не null ⇔ `status = resolved`».
- [ ] `confirm` для усуненої проблеми робить її активною.

## Підказки ментора
- Поки що `Problem` нічого не знає про інші проблеми. Пошук «чи є поруч» — окремий доменний сервіс (BE-13), а не метод агрегату.
