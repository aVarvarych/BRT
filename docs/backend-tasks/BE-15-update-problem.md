# BE-15 · Редагування, «Вже нема», видалення проблеми

**Епік:** 4 · Проблеми · **Тип:** історія · **Оцінка:** M · **Залежить від:** BE-13

## Контракт
| Юзкейс | Ендпоінт |
|---|---|
| `UpdateProblem` | `PATCH /v1/problems/:id` `{ type?, severity?, status?, clientUpdatedAt }` → `200 { applied: boolean, problem: ProblemDTO }` |
| `DeleteMark` | `DELETE /v1/marks/:id` → `204` |

```ts
ProblemDTO = {
  id; routeId; lat; lng; type; severity; status; confirmations;
  firstReportedAt; lastConfirmedAt; resolvedAt; kmFromStart; updatedAt
}
```

## Правила
- **Перемагає останнє редагування:** якщо `clientUpdatedAt ≤ problem.updatedAt`, зміни **не** застосовуються. Відповідь `applied: false` з поточним станом, щоб застосунок підтягнув актуальні дані.
- Зміна `status`:
  - на `resolved` → «Вже нема»;
  - на `active` → «Відновити».
- `DeleteMark` (хибна позначка в перегляді поїздки):
  - позначка була **єдиною** підтверджувальною (`confirmations = 1`) → видалити й проблему;
  - інакше → `removeConfirmation` для проблеми й видалити лише позначку.

> Видаляємо саме позначку, а не проблему: так застосунок і працює в перегляді поїздки (PRODUCT.md §10.5 уже оновлено).

## Критерії приймання
- [ ] Старіший `clientUpdatedAt` → `applied: false`, у базі нічого не змінилося.
- [ ] Видалення єдиної позначки видаляє й проблему. Видалення однієї з двох зменшує `confirmations`.
- [ ] Чужа проблема чи позначка → 404.
- [ ] Unit і integration тести.

## Підказки ментора
- `updatedAt` проблеми встановлюється з `clientUpdatedAt`, а не з серверного часу. Інакше другий пристрій ніколи не «переможе», якщо його годинник відстає.
