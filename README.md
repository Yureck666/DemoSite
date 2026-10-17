# Сайт-визитка — Заботкин Юрий

Статический сайт (чистый HTML/CSS/JS, без сборки). Дизайн и контент-гайды — в [`DESIGN.md`](./DESIGN.md).

## Структура

```
index.html                  — разметка страницы
assets/css/styles.css       — стили (токены DESIGN.md)
assets/js/i18n.js           — весь текстовый контент, RU и EN
assets/js/main.js           — рендер контента, модалка плеебла, переключатель языка
assets/resume/              — PDF резюме для скачивания
assets/favicon.svg          — фавикон
```

## Локальный просмотр

Открыть `index.html` через любой локальный сервер (просто открыть файл в браузере тоже работает,
но часть браузеров ограничивает `fetch`/модули для `file://`, поэтому лучше через сервер):

```bash
python -m http.server 8080
```

и открыть `http://localhost:8080`.

## Деплой на GitHub Pages

1. Создать новый репозиторий на GitHub (например, `zabotkin-dev` или `username.github.io` для сайта на корневом домене).
2. В этой папке:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/<username>/<repo>.git
   git push -u origin main
   ```
3. В настройках репозитория: **Settings → Pages → Source → Deploy from branch → `main` / `root`**.
4. Через пару минут сайт будет доступен по `https://<username>.github.io/<repo>/`
   (или `https://<username>.github.io/`, если репозиторий назван `<username>.github.io`).

## Что ещё нужно сделать перед публикацией

- [ ] Добавить реальные скриншоты/видео для **Find Sort Match** и **Tower Master** —
      сейчас на их карточках честная заглушка «Скриншот скоро» (см. `placeholderNote` в `assets/js/i18n.js`).
      Проще всего заменить в `buildPhone()` (`assets/js/main.js`) ветку `else` на `<img>`/`<video>`.
- [ ] Проверить, что три живых плеебла (FindObjectsTest, HexTest, ColorAntsTest) не стартуют со звуком сами.
- [ ] По желанию — сделать английскую версию PDF резюме и добавить её в `assets/resume/`.
