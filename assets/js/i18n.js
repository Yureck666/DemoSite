/* Content data for RU / EN. All copy lives here; main.js renders it. */
window.SITE_DATA = {
  ru: {
    meta: {
      title: "Юрий Заботкин — Senior Unity Developer, Playable Ads",
      description: "Senior Unity Developer и Playable Ads специалист. 4.5+ года в мобильных играх и плееблах."
    },
    header: {
      name: "Заботкин Юрий",
      nav: [
        { href: "#experience", label: "Опыт" },
        { href: "#projects", label: "Проекты" },
        { href: "#stack", label: "Стек" },
        { href: "#contact", label: "Контакты" }
      ],
      resume: "Резюме PDF"
    },
    hero: {
      eyebrow: "Unity Developer · Playable Ads",
      titleHtml: "Делаю плееблы и мобильные игры,<br>которые <em>запускают</em>, а не листают",
      lede: [
        "4.5+ года коммерческой разработки на Unity: мобильные игры и playable ads полным циклом — от концепта до адаптации под все рекламные сети.",
        "Плееблы делаю сроком от 1 рабочего дня, включая создание 2D и 3D ассетов.",
        "Опыт технического лидерства, найма и менторинга разработчиков."
      ]
    },
    gameFeel: {
      eyebrow: "Game Feel",
      title: "Как сделать игру сочной",
      desc: "Подключая настройки, вы можете управлять эффектами при нажатии на кнопку. От этого зависит впечатление игрока. Для элемента обычно используют комбинацию из нескольких из них.",
      tapButton: "ТАП",
      counterSrLabel: "Монеты",
      toggles: {
        easing: "Плавность",
        squash: "Сжатие-растяжение",
        particles: "Частицы",
        counter: "Монеты в счётчик",
        shake: "Тряска",
        sound: "Звук"
      },
      turnOffAll: "Выключить всё"
    },
    experience: {
      index: "01",
      title: "Опыт",
      items: [
        {
          dates: "Апрель 2026 — Сентябрь 2026 · 6 мес.",
          role: "Senior Unity Developer / Playable Ads Specialist",
          org: "Be Nice games · Удалённая работа",
          bullets: [
            "Разработка и выпуск 2D и 3D playable ads на Unity и Luna.",
            "Создание переиспользуемых шаблонов плееблов и внутренних инструментов для ускорения производства.",
            "Внедрение аналитики и трекинга событий для оценки взаимодействия и эффективности плееблов.",
            "Адаптация под рекламные сети: AppLovin, ironSource, Meta, Google Ads, Mintegral.",
            "Оптимизация по размеру файла, скорости загрузки и производительности под требования сетей.",
            "Техническая поддержка команды и улучшение процессов разработки."
          ]
        },
        {
          dates: "Март 2023 — Февраль 2026 · 3 г.",
          role: "Team Lead – Unity Developer",
          org: "Global Advertising Network Ltd. · Гибридный формат",
          bullets: [
            "Разработка флагманской мобильной игры в жанре Puzzle: геймплей, платформенные функции, монетизация, инфраструктура.",
            "Параллельно разрабатывал playable ads для продвижения приложений компании.",
            "Интеграция и поддержка рекламных SDK: AppLovin, ironSource.",
            "Интеграция аналитики и атрибуции: Firebase, GameAnalytics, AppMetrica.",
            "Построение внутренних SDK и инструментов для единообразия между проектами.",
            "Remote Config, Cloud Storage, покупки, уведомления, локализация.",
            "Техническое лидерство и менторинг Unity-разработчиков, участие в найме и собеседованиях."
          ]
        },
        {
          dates: "Февраль 2022 — Март 2023 · 1 г. 2 мес.",
          role: "Unity Developer",
          org: "NdGames · Удалённая работа",
          bullets: [
            "Прототипы гипер-казуальных игр с итерациями 2–3 недели.",
            "Интеграция рекламных SDK: AdMob, Unity Ads, ironSource.",
            "Интеграция аналитических SDK: Firebase, GameAnalytics, AppMetrica.",
            "Публикация приложений в Google Play Store, подготовка промо-материалов."
          ]
        }
      ]
    },
    projects: {
      index: "02",
      title: "Проекты",
      playablesTitle: "Плееблы",
      playablesTagline: "Играй прямо здесь!",
      playablesNavTagline: "Попробуй все плееблы!",
      playables: [
        {
          id: "idleminerdemo",
          title: "Idle Miner",
          genre: "Айдл",
          url: "assets/playables/e1bed1/index.html",
          icon: "assets/Playables Icons/miner.jpg",
          preview: "assets/Playables Preview/Miner.mp4",
          size: 4233836,
          featured: true,
          ctaPlay: "Играть"
        },
        {
          id: "legendale",
          title: "Legendale",
          genre: "Симулятор",
          url: "assets/playables/71a4cd/index.html",
          icon: "assets/Playables Icons/Legendale.png",
          preview: "assets/Playables Preview/Legendale.mp4",
          size: 4888539,
          featured: false,
          ctaPlay: "Играть"
        },
        {
          id: "findobjectstest",
          title: "Potion or Poison",
          genre: "Поиск предметов",
          url: "assets/playables/2b9578/index.html",
          icon: "assets/Playables Icons/Potion.png",
          preview: "assets/Playables Preview/Potion.mp4",
          size: 2906908,
          featured: false,
          ctaPlay: "Играть"
        },
        {
          id: "colorantstest",
          title: "Pixel Ants",
          genre: "Аркада",
          url: "assets/playables/225b08/index.html",
          icon: "assets/Playables Icons/ColorAnts.webp",
          preview: "assets/Playables Preview/ColorAnts.mp4",
          size: 2417396,
          featured: false,
          ctaPlay: "Играть"
        },
        {
          id: "hextest",
          title: "Hex Stack",
          genre: "Головоломка",
          url: "assets/playables/1fbf47/index.html",
          icon: "assets/Playables Icons/Hexa_Icon_800x800-1.jpg",
          preview: "assets/Playables Preview/Hex.mp4",
          size: 1144922,
          featured: false,
          ctaPlay: "Играть"
        }
      ],
      gamesTitle: "Мобильные игры",
      games: [
        {
          id: "findsortmatch",
          title: "Find Sort Match",
          genre: "Поиск и сортировка",
          icon: "assets/img/icons/find-sort-match.png",
          tags: ["SHIPPED"],
          url: "https://findsortmatch.com/",
          ctaOpen: "Открыть"
        },
        {
          id: "towermaster",
          title: "Tower Master",
          genre: "Айдл-аркада",
          icon: "assets/img/icons/tower-master.png",
          tags: ["GOOGLE PLAY"],
          url: "https://play.google.com/store/apps/details?id=idler.block.build.towers",
          ctaOpen: "Google Play"
        }
      ]
    },
    stack: {
      index: "03",
      title: "Стек и навыки",
      groups: [
        { title: "Unity & C#", tags: ["Игровые механики", "Оптимизация производительности", "Масштабируемые системы", "Профилирование и отладка"] },
        { title: "Интеграция SDK", tags: ["AdMob", "Unity Ads", "ironSource", "AppLovin", "Firebase", "AppsFlyer", "GameAnalytics", "AppMetrica"] },
        { title: "Мобильная разработка", tags: ["Android & iOS", "In-App Purchases", "Push-уведомления", "Локализация"] },
        { title: "Playable Ads", tags: ["Концепт → прототип → 2D/3D ассеты → адаптация", "Unity & Unity Luna", "AppLovin · ironSource · Meta · Google Ads · Mintegral", "Минимизация размера билда"] },
        { title: "Инструменты", tags: ["Git", "Rider IDE", "Unity Profiler", "Внутренние SDK"] },
        { title: "Soft Skills", tags: ["Техническое лидерство", "Менторинг", "Код-ревью", "Участие в найме"] }
      ],
      languagesTitle: "Языки",
      languages: [
        { name: "Русский", level: "Родной" },
        { name: "Английский", level: "Upper-Intermediate" }
      ]
    },
    contact: {
      index: "04",
      title: "Контакты",
      lede: "Открыт к предложениям по Unity-разработке и playable ads.",
      items: [
        { label: "Telegram", value: "@yureck666", href: "https://t.me/yureck666" },
        { label: "LinkedIn", value: "in/iurii-zabotkin", href: "https://www.linkedin.com/in/iurii-zabotkin-9b9557260/" },
        { label: "Email", value: "juicygames.info@gmail.com", href: "mailto:juicygames.info@gmail.com" },
        { label: "Резюме", value: "Zabotkin_Iurii_Resume_RU.pdf", href: "assets/resume/Zabotkin_Iurii_Resume_RU.pdf" }
      ]
    },
    footer: {
      text: "Заботкин Юрий — Senior Unity Developer"
    },
    modal: {
      restart: "Перезапустить",
      openNewTab: "Открыть в новой вкладке",
      close: "Закрыть"
    }
  },

  en: {
    meta: {
      title: "Iurii Zabotkin — Senior Unity Developer, Playable Ads",
      description: "Senior Unity Developer and Playable Ads specialist. 4.5+ years in mobile games and playables."
    },
    header: {
      name: "Iurii Zabotkin",
      nav: [
        { href: "#experience", label: "Experience" },
        { href: "#projects", label: "Projects" },
        { href: "#stack", label: "Stack" },
        { href: "#contact", label: "Contact" }
      ],
      resume: "Resume PDF"
    },
    hero: {
      eyebrow: "Unity Developer · Playable Ads",
      titleHtml: "I build playables and mobile games<br>people <em>launch</em>, not just scroll past",
      lede: [
        "4.5+ years of commercial Unity development: mobile games and playable ads end to end — from concept to adapting for every ad network.",
        "I build playables starting from 1 business day, including creating 2D and 3D assets.",
        "Experience in technical leadership, hiring, and mentoring developers."
      ]
    },
    gameFeel: {
      eyebrow: "Game Feel",
      title: "How to make a game juicy",
      desc: "Toggle the settings to control the effects on the button tap. This shapes how the player experiences it. A single element usually relies on a combination of a few of them.",
      tapButton: "TAP",
      counterSrLabel: "Coins",
      toggles: {
        easing: "Easing",
        squash: "Squash & stretch",
        particles: "Particles",
        counter: "Coins to the counter",
        shake: "Screen shake",
        sound: "Sound"
      },
      turnOffAll: "Turn off all"
    },
    experience: {
      index: "01",
      title: "Experience",
      items: [
        {
          dates: "Apr 2026 — Sep 2026 · 6 mo",
          role: "Senior Unity Developer / Playable Ads Specialist",
          org: "Be Nice games · Remote",
          bullets: [
            "Developed and shipped 2D and 3D playable ads on Unity and Luna.",
            "Built reusable playable templates and internal tools to speed up production.",
            "Added analytics and event tracking to measure engagement and playable performance.",
            "Adapted playables for ad networks: AppLovin, ironSource, Meta, Google Ads, Mintegral.",
            "Optimized file size, load time, and performance to meet network requirements.",
            "Provided technical support to the team and improved development processes."
          ]
        },
        {
          dates: "Mar 2023 — Feb 2026 · 3 yr",
          role: "Team Lead – Unity Developer",
          org: "Global Advertising Network Ltd. · Hybrid",
          bullets: [
            "Developed the company's flagship Puzzle mobile game: gameplay, platform features, monetization, infrastructure.",
            "Built playable ads in parallel to promote the company's apps.",
            "Integrated and maintained ad SDKs: AppLovin, ironSource.",
            "Integrated analytics and attribution: Firebase, GameAnalytics, AppMetrica.",
            "Built internal SDKs and tools for consistency across projects.",
            "Remote Config, Cloud Storage, purchases, notifications, localization.",
            "Technical leadership and mentoring of Unity developers, involved in hiring and interviews."
          ]
        },
        {
          dates: "Feb 2022 — Mar 2023 · 1 yr 2 mo",
          role: "Unity Developer",
          org: "NdGames · Remote",
          bullets: [
            "Hyper-casual game prototypes on 2–3 week iterations.",
            "Integrated ad SDKs: AdMob, Unity Ads, ironSource.",
            "Integrated analytics SDKs: Firebase, GameAnalytics, AppMetrica.",
            "Published apps to Google Play Store, prepared promo materials."
          ]
        }
      ]
    },
    projects: {
      index: "02",
      title: "Projects",
      playablesTitle: "Playables",
      playablesTagline: "Play right here!",
      playablesNavTagline: "Try every playable!",
      playables: [
        {
          id: "idleminerdemo",
          title: "Idle Miner",
          genre: "Idle",
          url: "assets/playables/e1bed1/index.html",
          icon: "assets/Playables Icons/miner.jpg",
          preview: "assets/Playables Preview/Miner.mp4",
          size: 4233836,
          featured: true,
          ctaPlay: "Play"
        },
        {
          id: "legendale",
          title: "Legendale",
          genre: "Simulation",
          url: "assets/playables/71a4cd/index.html",
          icon: "assets/Playables Icons/Legendale.png",
          preview: "assets/Playables Preview/Legendale.mp4",
          size: 4888539,
          featured: false,
          ctaPlay: "Play"
        },
        {
          id: "findobjectstest",
          title: "Potion or Poison",
          genre: "Hidden Object",
          url: "assets/playables/2b9578/index.html",
          icon: "assets/Playables Icons/Potion.png",
          preview: "assets/Playables Preview/Potion.mp4",
          size: 2906908,
          featured: false,
          ctaPlay: "Play"
        },
        {
          id: "colorantstest",
          title: "Pixel Ants",
          genre: "Arcade",
          url: "assets/playables/225b08/index.html",
          icon: "assets/Playables Icons/ColorAnts.webp",
          preview: "assets/Playables Preview/ColorAnts.mp4",
          size: 2417396,
          featured: false,
          ctaPlay: "Play"
        },
        {
          id: "hextest",
          title: "Hex Stack",
          genre: "Puzzle",
          url: "assets/playables/1fbf47/index.html",
          icon: "assets/Playables Icons/Hexa_Icon_800x800-1.jpg",
          preview: "assets/Playables Preview/Hex.mp4",
          size: 1144922,
          featured: false,
          ctaPlay: "Play"
        }
      ],
      gamesTitle: "Mobile games",
      games: [
        {
          id: "findsortmatch",
          title: "Find Sort Match",
          genre: "Find & sort",
          icon: "assets/img/icons/find-sort-match.png",
          tags: ["SHIPPED"],
          url: "https://findsortmatch.com/",
          ctaOpen: "Open"
        },
        {
          id: "towermaster",
          title: "Tower Master",
          genre: "Idle arcade",
          icon: "assets/img/icons/tower-master.png",
          tags: ["GOOGLE PLAY"],
          url: "https://play.google.com/store/apps/details?id=idler.block.build.towers",
          ctaOpen: "Google Play"
        }
      ]
    },
    stack: {
      index: "03",
      title: "Stack & skills",
      groups: [
        { title: "Unity & C#", tags: ["Gameplay mechanics", "Performance optimization", "Scalable systems", "Profiling and debugging"] },
        { title: "SDK integration", tags: ["AdMob", "Unity Ads", "ironSource", "AppLovin", "Firebase", "AppsFlyer", "GameAnalytics", "AppMetrica"] },
        { title: "Mobile development", tags: ["Android & iOS", "In-App Purchases", "Push notifications", "Localization"] },
        { title: "Playable Ads", tags: ["Concept → prototype → 2D/3D assets → adaptation", "Unity & Unity Luna", "AppLovin · ironSource · Meta · Google Ads · Mintegral", "Build size minimization"] },
        { title: "Tools", tags: ["Git", "Rider IDE", "Unity Profiler", "Internal SDKs"] },
        { title: "Soft skills", tags: ["Technical leadership", "Mentoring", "Code review", "Hiring"] }
      ],
      languagesTitle: "Languages",
      languages: [
        { name: "Russian", level: "Native" },
        { name: "English", level: "Upper-Intermediate" }
      ]
    },
    contact: {
      index: "04",
      title: "Contact",
      lede: "Open to Unity development and playable ads opportunities.",
      items: [
        { label: "Telegram", value: "@yureck666", href: "https://t.me/yureck666" },
        { label: "LinkedIn", value: "in/iurii-zabotkin", href: "https://www.linkedin.com/in/iurii-zabotkin-9b9557260/" },
        { label: "Email", value: "juicygames.info@gmail.com", href: "mailto:juicygames.info@gmail.com" },
        { label: "Resume", value: "Zabotkin_Iurii_Resume_RU.pdf", href: "assets/resume/Zabotkin_Iurii_Resume_RU.pdf" }
      ]
    },
    footer: {
      text: "Iurii Zabotkin — Senior Unity Developer"
    },
    modal: {
      restart: "Restart",
      openNewTab: "Open in new tab",
      close: "Close"
    }
  }
};
