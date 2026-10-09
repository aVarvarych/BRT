# BE-10 · Поїздки: старт і завершення

**Епік:** 2 · Поїздки · **Тип:** історія · **Оцінка:** M · **Залежить від:** BE-09

## Домен
- Агрегат `Trip` з полями:
  - `id`, `routeId`, `deviceId`;
  - `status: active | finished`;
  - `finishReason: user | auto | null`;
  - `startedAt`, `finishedAt`;
  - `distanceM`, `pointsCount`.
- Методи:
  - `Trip.start(...)`;
  - `finish(finishedAt, reason)`: якщо поїздка вже завершена, нічого не змінює й не кидає помилки. Якщо `finishedAt < startedAt` → `InvalidTripTime`;
  - `addTrackStats(distanceM, points)`: потрібен для BE-11.

## Юзкейси
| Юзкейс | Ендпоінт | Відповідь |
|---|---|---|
| `StartTrip` | `POST /v1/trips` `{ id, routeId, startedAt }` | `201` + TripDTO. Повторний запит з тим самим `id` → `200`. Якщо в пристрою є **інша** активна поїздка, вона автоматично завершується з `reason = auto` |
| `FinishTrip` | `POST /v1/trips/:id/finish` `{ finishedAt, reason }` | `200` + TripDTO. Ідемпотентний. Після завершення запускає побічні дії (див. нижче) |

```ts
TripDTO = { id; routeId; status; finishReason; startedAt; finishedAt; distanceM; pointsCount }
```

## Що зробити
- Таблиця `trips`:
  - `route_id ... on delete cascade`;
  - індекс `(device_id, status)`;
  - частковий унікальний індекс «одна активна поїздка на пристрій»: `unique (device_id) where status = 'active'`.
- `StartTrip`: завершення попередньої поїздки й створення нової відбуваються в **одній транзакції**.
- Побічні дії завершення: порт `ITripFinishedHandler` (може бути кілька обробників). Зараз нічого не робить, а в BE-16 сюди підключиться побудова лінії маршруту.

## Критерії приймання
- [ ] Старт другої поїздки автоматично завершує першу.
- [ ] Повторний `finish` не змінює `finishedAt`.
- [ ] Поїздка на чужому маршруті → 404.
- [ ] Тести: unit для агрегату, integration для HTTP і унікального індексу.

## Підказки ментора
- Порт обробників — це простий in-process «доменний івент» без шини. Юзкейс викликає їх після коміту транзакції.
