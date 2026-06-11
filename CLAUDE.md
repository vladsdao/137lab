# 137LAB.XYZ — PROJECT CONTEXT

Главный продукт экосистемы. Live: https://137lab.xyz · Netlify auto-deploy из main.

## Фокус (2026-06-11)

Новая концепция главной — **«улей»**: 137 LAB в центре, вокруг 6 ячеек-продуктов:
МЕТА-ПЕДІЯ · SONORA · DAO DE DO · Симбіотичний 5D світогляд · 5D казка «Алхімія творчості» · House of Stars & Unicorns.
Журей-инициация (`v4/`) — готовый движок, кандидат на «ритуал входа» за центральной ячейкой.

## Перед любой работой

1. Скилл **`137lab-brand`** (`.claude/skills/`) — канон токенов и голоса. Полный гайд голоса: `voice.md`.
2. Память, дизайн-доки, исходники казки — в мозг-репо `~/CLAUDE/Vlad/data` (`docs/plans/`, `vlad/insaint/`).
3. Mobile-first: канвас 9:16 (390×844), десктоп = тот же канвас по центру листа.

## Структура

```
index.html      # прод-главная (v3-манифест; при запуске улья — в _archive/)
v4/             # журей-движок: engine.js + journey.json (контент = данные) + fonts/ (Fixel)
sonora/         # БОЕВАЯ воронка (RU/EN/UA, Telegram-бот) — НЕ ТРОГАТЬ чужими деплоями
retreat/        # страница ретрита Лизы — боевая
resonance/      # статья
voices/         # медиа
netlify/functions/apply.js  # Telegram-relay заявок (env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
```

## Деплой

`git push origin main` → Netlify (~1–2 мин). Правила:
- Драфты — в подпапках (`/v4/` и т.п.); **корень меняем только после явного approve Влада**.
- Всё additive: никаких `--delete`, никаких массовых перезаписей. `/sonora` и `/retreat` неприкосновенны.
- Новые страницы — `noindex` до запуска.

## Верификация

Локально: `python3 -m http.server 8137` из корня. Канвас проверять **замером** (не скриншотом на глаз — рендер обманывает). Тест-матрица: iOS Safari · Chrome Android · Telegram in-app · Instagram in-app.
