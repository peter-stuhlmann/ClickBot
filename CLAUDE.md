# Click-Bot

Web-Tool zum automatisierten Testen von Websites (eigene Seiten und Kundenseiten der Agentur).
Ein Bot öffnet eine Seite in einem echten Browser, führt einen Ablauf aus (klicken, Formulare
ausfüllen, prüfen) und erstellt pro Lauf einen Report auf dem Bildschirm und als PDF.

Status: Grundgerüst, Datenbank-Schicht, Worker mit Zeitplan, die Job-Liste, der Assistent
„Neuer Job“, der Editor, der Lauf-Report, die Läufe-Übersicht, der Kalender, die Vorlagen, die
Projekte, die Anmeldung, das Profil und die Einstellungen der KI-Anbieter stehen.

- **Fertig:**
  - das Design (Figma)
  - `packages/shared`: Ablauf-Schema, Variablen, Zeitplan, Domain-Regeln
  - `packages/db`: Schema, Migrationen, Jobs, Zugangsdaten, Verschlüsselung, Übersicht und
    Kennzahlen, Demo-Daten, KI-Anbieter
  - `packages/ai`: Anbindung an Gemini, OpenAI, Perplexity, Claude und eine OpenAI-kompatible
    API (Custom), mit Verbindungstest
  - `apps/web`:
    - App-Rahmen mit Sidebar: das Layout der Routengruppe `src/app/(app)/` rendert `AppShell`
      um jede Seite der App. Die Sidebar bleibt beim Wechseln stehen; der angeklickte Punkt
      zeigt einen Spinner, bis die Seite da ist (`useLinkStatus` in `NavItem`). Bewusst kein
      `loading.tsx`: Ein Suspense-Fallback macht aus `notFound()` einen Status 200 und bleibt
      ohne JavaScript für immer stehen. Den aktiven Punkt leitet die Sidebar aus der Adresse ab
      (`navKeyFor` in `src/lib/navigation.ts`). Seiten rufen `getShell(db)` nur noch, wenn sie
      das aktuelle Projekt brauchen (React `cache`: einmal je Anfrage). Der Worker-Status in der
      Sidebar ist so frisch wie der letzte volle Seitenaufbau (Reload, Projektwechsel,
      `router.refresh()`), nicht jeder Klick. Unbekannte Adressen zeigen „Nicht gefunden“ auf
      Deutsch: in der App mit Sidebar (`(app)/not-found.tsx`), außerhalb schlicht
      (`app/not-found.tsx`).
    - Screen 01 „Jobs“ (in der Oberfläche „Tests“) mit echten Daten, inklusive Pausieren und
      Fortsetzen; je Zeile „Jetzt ausführen“ (`runJobNowAction`: ein Testlauf, dann sein Report)
    - Screen 05 „Neuer Job“ (`/jobs/neu`): Assistent in drei Schritten (`WIZARD_STEPS`), so
      dass die Website das Erste ist, was man eingibt:
      1. „Website & Test“: Start-URL (der erste Schritt „Seite öffnen“ folgt ihr, solange er
         nicht von Hand geändert wurde) und die Art zu testen (`MethodPicker`): „Fester Ablauf“
         (aufnehmen im Live-Browser, Screen 04, mit „Aus Vorlage übernehmen“ daneben; danach eine Liste,
         in der jeder Schritt korrigierbar ist, ohne „Schritt hinzufügen“) oder „Frei mit KI“
         (nur das Ziel des Tests, `GoalCard`; siehe Worker → KI-Schritt). Jeder Modus behält
         seinen Stand, während der andere gezeigt wird. Ist der Worker offline, sagt die
         Aufnahme-Karte das vorab (`LiveBrowser offline`); fehlt ein KI-Anbieter, die Ziel-Karte
         (`GoalCard aiReady`).
      2. „Wann“: der Zeitplan. „Regelmäßig“ fragt „Wie oft?“ (`Rhythm`: Einmal, Jede Stunde,
         Jeden Tag, Eigener Abstand; nur beim eigenen Abstand gibt es das Minutenfeld, nur außer
         „Einmal“ das Feld „Wie oft insgesamt?“). Gespeichert wird weiter `everyMinutes` und
         `maxRuns`; der Editor leitet den Rhythmus daraus ab (`rhythmOf`). Die anderen Arten
         heißen „Feste Zeiten“ (Termine) und „Zufällig verteilt“ (Zufall).
      3. „Geräte & Freigabe“: Geräte, der Name (beim Ankommen aus Ziel oder Website
         vorgeschlagen, `suggestName`), die Kampagne nur bei mehreren im Projekt (sonst
         „Allgemein“, `defaultCampaignId` von der Seite), „Erweiterte Einstellungen“ (GA4-
         Markierung und Werbung, eingeklappt in einem `AccordionItem` mit Zusammenfassung
         `describeAdvanced` und Badge „Geändert“) und die Freigabe.
         Am Ende wird der Job aktiv angelegt und läuft nach Zeitplan. Die Zusammenfassung rechts
         zeigt Technik-Einstellungen nur, wenn sie vom Standard abweichen.
    - „Vorlagen“ (`/vorlagen`, ohne Figma-Entwurf): Abläufe für jede Website, für alle Projekte.
      Anlegen unter `/vorlagen/neu` (gleicher Baukasten, ohne Passwortschutz) oder im Editor eines
      Jobs mit „Als Vorlage speichern“ (`toTemplateFlow`: ohne das Öffnen der Start-URL am Anfang,
      ohne Passwortschutz, Seiten der eigenen Website als Pfad). „Aus Vorlage“ im Assistenten
      kopiert die Schritte (`stepsFromTemplate`) und stellt „Seite öffnen“ mit der Start-URL
      davor, wenn die Vorlage nicht selbst mit einer Seite beginnt. Ändern oder Löschen einer
      Vorlage ändert keinen Job.
    - Screen 02 „Editor“ (`/jobs/<id>`, über den Job-Namen in der Liste): Name, Start-URL,
      Zeitplan, Geräte und Ablauf eines bestehenden Jobs ändern. Zwei Spalten statt der drei
      aus dem Design, weil die Terminzeilen sonst zu schmal werden. GA4-Markierung und Werbung
      liegen auch hier unter „Erweiterte Einstellungen“; das Akkordeon ist offen, wenn eine davon
      vom Standard abweicht, damit die Warnung zu sehen ist.
    - „Testlauf starten“ im Editor: speichert offene Änderungen, startet einen Bot auf dem
      ersten Gerät und öffnet dessen Report. Der Report lädt sich alle 2 s neu, solange der
      Lauf wartet oder läuft.
    - Projekt → Kampagne → Job: Oben in der Sidebar wählt der Projekt-Umschalter
      (`ProjectSwitcher`, Suche filtert beim Tippen, „Neues Projekt“ fest unten) das aktuelle
      Projekt. Es liegt im Cookie `clickbot_project` (`src/server/shell.ts`, `getShell`, ohne
      gültigen Cookie das erste nach Name). Jobs, Läufe, Kampagnen und der Assistent zeigen nur
      dieses Projekt.
    - „Kampagnen“ (`/kampagnen`, aus Screen 10 „Kunden“): Kennzahlen und eine Zeile je Kampagne
      des Projekts. „Kampagne anlegen“ (`/kampagnen/neu`): Name, optional Zeitraum und Notiz.
      „Projekt anlegen“ (`/projekte/neu`) macht das neue Projekt zum aktuellen. `/projekte` und
      `/kunden` leiten auf `/kampagnen` weiter (`next.config.ts`). Die Spalte „Wochen-PDF“
      fehlt, bis es das PDF gibt.
    - Screen 14 „Läufe“ (`/laeufe`): alle Läufe, neueste zuerst, 50 je Seite, mit Filtern nach
      Kampagne, Ergebnis, Zeitraum und Gerät. Die Filter stehen in der Adresse
      (`src/lib/run-filters.ts`); eine Änderung gilt sofort (`RunFilters`: `router.push` in einer
      Transition, leere Filter bleiben aus der Adresse), ohne JavaScript schickt dasselbe
      GET-Formular den Knopf „Filter anwenden“ aus `<noscript>`. CSV, Sammel-PDF, gespeicherte
      Ansichten und Standort fehlen.
    - Screen 13 „Kalender“ (`/kalender?woche=<Montag>&tag=<Tag>`): die Starts einer Woche des
      Projekts als Wellen je Tag (ein Eintrag je Termin bzw. Start; ab 5 Starts eines Jobs am
      Tag einer für den ganzen Tag), darunter die „Auslastung“ eines Tags. Ohne `tag` der erste
      Tag mit Engpass, sonst heute, sonst Montag. Logik in `src/lib/week-plan.ts`.
      - Ein Lauf belegt einen Browser ab seinem Start so lange, wie die Läufe seines Jobs typisch
        dauern (Median der letzten 30 Tage, `listCalendarJobs`; ohne Läufe 1 Minute). Mehr Läufe
        gleichzeitig als Browser ist ein Engpass („Limit überschritten“). Gezählt werden die Jobs
        aller Projekte, weil sie sich den Worker teilen. Nur aktive und beendete Jobs.
      - Das Limit meldet der Worker mit seinem Lebenszeichen (`getBrowserLimit`), sonst gilt
        `MAX_CONCURRENT_BROWSERS` aus der `.env`, sonst 6.
      - Vorschlag je Engpass: die späteste, kleinste Welle eines Termin-Plans des Projekts, die
        nicht in den nächsten 5 Minuten startet, um so wenige Minuten wie möglich (höchstens 120)
        nach hinten, bis kein Lauf mehr wartet. „Übernehmen“ verschiebt den Termin (`moveSlot`:
        nur ohne Läufe, nur in die Zukunft, nur wenn er sich nicht inzwischen geändert hat).
      - „Report-Versand“ aus dem Design fehlt, bis es PDF und E-Mail gibt.
    - Screen 03 „Lauf-Report“ (`/laeufe/<id>`), erreichbar über „Letzter Lauf“ in der
      Job-Liste: Kennzahlen, Schritte mit Ergebnis, Fehler und Bildschirmfoto
    - „Einstellungen“ mit den Tabs aus Screen 08a, bisher nur „Team“ und „KI & API“
      (`/einstellungen/ki`): API-Schlüssel, Modell und Standard-Anbieter. Nur Admins ändern,
      die anderen sehen den Stand. Die Anbieter sind ein Accordion (`AccordionItem`): anfangs
      alle zu, höchstens einer offen.
    - „Profil“ (`/profil`, über Name und Bild unten in der Sidebar): eigenen Namen und
      Profilbild ändern. E-Mail und Rolle stehen nur da.
  - `apps/worker`:
    - plant fällige Termine ein und führt sie mit Playwright aus
    - speichert Ergebnis, Schritte und Bildschirmfotos
    - meldet seinen Status an die Web-App
    - führt Läufe in Chrome, Firefox und Safari (WebKit) aus und emuliert Geräte
- **Noch nicht gebaut:**
  - im Worker: Proxies und Standort-Profile, KI-Suche nach Elementen (`aiFallback`), Live-Stream; Markierung für andere
    Analytics-Werkzeuge als GA4
  - E-Mail-Versand (Einladungslinks werden angezeigt und von Hand weitergegeben), Konten
    sperren oder löschen, Rate-Limit je IP-Adresse beim Login
  - im Assistenten: Standort-Profile (die Karte „Von wo aus testen?“ aus dem Design gibt es
    erst, wenn es Profile gibt); im Editor Aufnehmen; Schritte vom Typ „auslesen“ lassen sich
    noch nicht anlegen
  - im Lauf-Report: PDF, „Erneut ausführen“, KI-Eingriffe des Fallbacks, Konsolenfehler und ausgelesene
    Werte (dafür speichert der Worker noch keine Daten)
  - im Editor: KI-Box, „Erfolg & Daten“ und Variablen-Liste aus dem Design
  - alle übrigen Screens, auch der Welle-Report (03b)

Was als „geplant“ markiert ist, existiert noch nicht.

## Begriffe in der Oberfläche

Die Oberfläche spricht Alltagsdeutsch, Code, Datenbank und diese Datei behalten die
Fachbegriffe. Wer UI-Texte schreibt, nutzt die linke Spalte:

| Oberfläche             | Code / Datenbank / hier            |
| ---------------------- | ---------------------------------- |
| Test, Tests            | Job, `jobs`                        |
| Durchlauf, Durchläufe  | Lauf, Run, `runs`                  |
| „Jetzt ausführen“      | Testlauf (`queueTestRun`)          |
| „manuell gestartet“    | Testlauf im Report, Chip „Manuell“ |
| Testsystem             | Worker                             |
| Adresse der Website    | Start-URL (`start_url`)            |
| Browser 1, Browser 2 … | Bot 1, Bot 2 (`bot_nr`)            |
| Projekt                | Kunde, `customer`                  |

„Bot“ kommt in der Oberfläche nur noch im Produktnamen Click-Bot und in GA4-Begriffen wie
„Bot-Kennung“ vor. Die Umbenennung lief über ein Skript, das nur Strings, Template-Strings,
JSX-Text und reguläre Ausdrücke anfasst, nie Bezeichner oder Pfade (`/jobs`, `/laeufe` bleiben).

## Produktregeln (nicht verhandelbar)

- Nur für eigene oder vom Kunden freigegebene Websites. Das Tool ist ein Testwerkzeug.
  - Wer einen Job anlegt, bestätigt das im letzten Schritt des Assistenten, direkt vor „Job
    anlegen“. `createJobAction` prüft die Bestätigung auf dem Server noch einmal.
- Keine Umgehung von Captchas, Bot-Erkennung, Rate-Limits oder Ländersperren fremder Seiten.
  Kein Fingerprint-Spoofing und kein Captcha-Solving.
- Kein künstlicher Traffic, der Kennzahlen aufbläht (Klick-KPIs, Werbeanzeigen, Analytics).
  Bot-Läufe sind standardmäßig in GA4 markiert (Debug-Modus, interner Traffic, eigene Kennung)
  und damit filterbar.
  - Pro Job lassen sich die Markierungen einzeln oder alle abschalten, z. B. um die Zuordnung in
    den normalen GA4-Berichten zu testen. Die Oberfläche warnt dann deutlich.
  - Jeder Lauf speichert die Markierung, mit der er lief (`runs.analytics_marking`). Sein Report
    vermerkt, wenn sie eingeschränkt oder aus war.
- Bot-Läufe blockieren standardmäßig Werbung (Anzeigen lassen sich nicht als Bot markieren und
  zählen sonst als ungültige Impressionen). Pro Job abschaltbar (`jobs.block_ads`, Karte
  „Werbung“ mit Warnung). Jeder Lauf speichert, ob er blockiert hat und wie viele Anfragen
  (`runs.ads_blocked`, `runs.blocked_ad_requests`); der Report vermerkt beides.
- Proxies und Standort-Profile dienen nur Geo-Tests: Ländersperren, standortabhängige Inhalte
  und die GA-Zuordnung.
- Zugangsdaten (Secrets) sind verschlüsselt gespeichert und erscheinen nie in Reports,
  Screenshots, Videos oder Logs.

## Architektur

pnpm-Monorepo, Node 22, TypeScript überall.

```
apps/web         Next.js 16 (App Router): UI, API-Routen, Login, PDF-Erzeugung
apps/worker      Node-Prozess mit Playwright (Chromium, Firefox, WebKit): führt Läufe aus (Live-Stream geplant)
packages/shared  Zod-Schemas und reine Logik: flow.ts, variables.ts, schedule.ts, domains.ts
packages/db      Drizzle-Schema, SQL-Migrationen, Repository-Funktionen, Verschlüsselung (nur Server)
packages/ai      HTTP-Clients der KI-Anbieter, ohne SDKs (nur Server)
```

Die Pakete unter `packages/` liefern TypeScript-Quelltext aus, ohne eigenen Build.

- Next kompiliert sie über `transpilePackages` in `apps/web/next.config.ts` mit.
- Ein neues Paket wird dort eingetragen, sobald die Web-App es nutzt.
- `packages/shared` muss browsertauglich bleiben: kein `node:`-Import, keine Datenbank.

## Datenbank (`packages/db`)

- **Drizzle ORM** mit `pg`.
  - Das Schema steht in `src/schema.ts`.
  - Migrationen liegen als SQL in `packages/db/drizzle/`. Sie werden mit `pnpm db:generate`
    erzeugt und ins Repo committet.
  - Eine bereits angewendete Migration nie ändern, sondern eine neue erzeugen.
- **Validierung vor jedem Schreiben** in den Repository-Funktionen, z. B. `createJob` und
  `createSecret`.
  - Alle Fehler kommen gesammelt als `ValidationError` mit Feldpfaden wie `flow.steps.1.id`.
    Daraus baut die UI ihre Fehlermeldungen.
  - Zusätzlich sichern CHECK-, UNIQUE- und Fremdschlüssel-Regeln die Daten in der Datenbank
    selbst ab.
  - Die Meldungen der Zod-Schemas in `packages/shared` sind deutsch und kurz, weil die UI sie
    direkt am Feld zeigt (z. B. „Bitte ausfüllen.“).
- **Kunden** (`createCustomer`), in der Oberfläche „Projekte“: Im Code und in der Datenbank
  heißen sie weiter `customer`. „Kunde“ bleibt in der Oberfläche nur, wo der Auftraggeber
  gemeint ist, z. B. bei der Freigabe des Tests. Namen sind eindeutig, ohne Groß- und Kleinschreibung. Das
  Kürzel (`slug`) entsteht aus dem Namen („Müller Shop“ → `mueller-shop`), bei Bedarf mit
  `-2`, `-3`. Umbenennen (`updateCustomer`) lässt das Kürzel, wie es ist.
- **Kampagnen** (`campaigns.ts`, Tabelle `campaigns`): Jedes Projekt hat Kampagnen, jeder Job
  gehört zu genau einer (`jobs.campaign_id`, Pflicht). Ein zusammengesetzter Fremdschlüssel
  (`campaign_id`, `customer_id`) sorgt dafür, dass Job und Kampagne im selben Projekt liegen.
  - Namen sind je Projekt eindeutig, ohne Groß- und Kleinschreibung. Zeitraum als Kalenderdaten,
    Ende nicht vor dem Start.
  - Ein neues Projekt startet mit der Kampagne „Allgemein“ (`createCustomer`). Die Jobs von vor
    den Kampagnen liegen in „Allgemein“ ihres Projekts (Migration 0008).
  - `createJob` bekommt die Kampagne; das Projekt des Jobs ergibt sich daraus. Im Editor kann
    ein Job in eine andere Kampagne desselben Projekts wechseln (`updateJob`, `campaignId`),
    nie in ein anderes Projekt: Läufe, Zugangsdaten und Reports gehören zum Projekt.
  - Bearbeiten: `/projekte/<id>` (Name, Löschen unten mit Rückfrage, `DeleteSection`).
    `/kampagnen/<id>` zeigt die Jobs der Kampagne; Name, Zeitraum, Notiz und Löschen liegen im
    Modal hinter dem Zahnrad neben dem Namen („Kampagne bearbeiten“).
- **Jobs** legt `createJob` als Entwurf an. Mit `status: 'active'` (Assistent) plant der
  Worker sie sofort ein.
- **Jobs ändern** (`updateJob`, Editor):
  - Gleiche Prüfungen wie beim Anlegen. Der Status bleibt.
  - Läuft mit derselben Zeilensperre wie der Planer, damit kein Start aus einem halb
    geänderten Zeitplan entsteht.
  - Der Planer erkennt erledigte Starts an ihrer Position (`runs.slot_index`). Deshalb:
    Termine mit Läufen (`listStartedSlots`) lassen sich nicht verschieben oder löschen, nur
    ihre Bot-Zahl ändern. Neue Termine kommen hinten dazu. Hat ein Job Läufe, bleibt die Art
    des Zeitplans (Intervall, Termine oder Zufall). Ein Intervall darf sich frei ändern, es
    zählt einfach weiter.
  - Zufall (`rescheduleRandom`): Bleiben die Einstellungen gleich, bleiben die gelosten Starts.
    Ändern sie sich, behält der Plan jeden Start, der gelaufen ist oder in der Vergangenheit
    liegt, an seiner Position (`kept`) und lost nur den Rest ab jetzt neu (`drawFrom`).
  - Starts in der Vergangenheit sind erlaubt, wenn sie schon gespeichert waren
    (`validateJobEdit`). Eine gespeicherte Intervall-Startzeit bleibt sekundengenau, solange
    Datum und Uhrzeit im Formular unverändert sind.
  - Jobs mit Schritten ohne Formular (Auslesen) zeigt der Editor nur an, damit
    Speichern sie nicht verliert.
- **Zugangsdaten:**
  - Gespeichert wird nur der verschlüsselte Wert (`createCipher`: AES-256-GCM, Schlüssel aus
    `SECRETS_KEY`).
  - `resolveSecretsForRun` liefert pro Lauf nur die Secrets des Kunden und die allgemeinen,
    nicht abgelaufen und erlaubt auf der Domain der URL.
  - Ein Kunden-Secret überschreibt ein allgemeines mit gleichem Namen.
  - `saveSecret` legt an oder ersetzt Wert und Domains des Kunden-Secrets mit gleichem Namen.
  - Passwörter aus Schritten „Passwortschutz (.htaccess)“ speichert `secureStepPasswords` beim
    Anlegen und Ändern eines Jobs als Kunden-Secret `htaccess-<host>` (erlaubt nur auf dem Host
    der Start-URL). Im Ablauf steht danach `{{secret.htaccess-<host>}}`. Der Editor schickt das
    Passwort nie zurück in den Browser: Ein leeres Feld behält das gespeicherte.
- **Anmeldung** (`auth.ts`, `invitations.ts`, `passwords.ts`, `totp.ts`):
  - Nur für das Team: `/registrieren` legt den ersten Admin an, solange es kein Konto gibt.
    Danach nur per Einladungslink („Einstellungen → Team“ oder `pnpm auth:invite`).
  - Ein Link für eine Adresse mit Konto setzt Passwort und 2FA neu und beendet alle
    Sitzungen. Das ist der Weg zurück nach vergessenem Passwort oder verlorenem Handy.
  - 2FA (TOTP, RFC 6238): Nach dem Passwort folgt der Code oder, ohne 2FA, die Einrichtung.
    Sie lässt sich überspringen („Später einrichten“, `skipTotpSetup`), kommt dann aber bei
    jeder Anmeldung wieder und lässt sich unter „Einstellungen → Team“ nachholen. Ein Code
    gilt einmal (`users.totp_last_step`). Der Schlüssel liegt mit `SECRETS_KEY` verschlüsselt.
  - Passwörter: scrypt wie in seo-analyse (`scrypt$salt$hash`), Regeln in
    `packages/shared/src/password.ts`, dazu die Prüfung auf Datenlecks (Have I Been Pwned,
    `apps/web/src/server/pwned.ts`). `PWNED_CHECK=off` schaltet sie in Tests ab.
  - Nach 5 falschen Passwörtern ist ein Konto 15 Minuten gesperrt, nach 5 falschen Codes
    beginnt die Anmeldung neu.
  - Sitzungen: zufälliger Token im Cookie `clickbot_session` (httpOnly, SameSite=Lax),
    in der Datenbank nur sein SHA-256. Nach dem Passwort 15 Minuten unvollständig, mit 2FA
    14 Tage gültig. Der Token wechselt beim Abschluss der 2FA.
- **Profil** (`profile.ts`, Tabelle `user_avatars`):
  - `updateProfile` ändert Name und Bild zusammen oder gar nicht. E-Mail (die Anmeldung) und
    Rolle (aus der Einladung) gehören nicht dazu.
  - Das Bild liegt in der Datenbank, getrennt von `users`, damit die Sitzungsabfrage jeder
    Anfrage klein bleibt. Nur PNG, JPEG und WebP, erkannt an den ersten Bytes (kein SVG, es kann
    Skript enthalten), höchstens 512 KB, auch per CHECK.
  - Der Browser schneidet das Bild quadratisch zu und verkleinert es auf 256 × 256 als WebP
    (`squareImage` in `apps/web/src/lib/avatar.ts`).
  - Ausgeliefert über `/avatar/<id>?v=<Zeit>`, nur für Angemeldete, mit `nosniff`. Die Zeit in
    der Adresse lässt Browser das Bild dauerhaft cachen; ein neues Bild hat eine neue Adresse.
- **Vorlagen** (`templates.ts`, Tabelle `flow_templates`): Name (eindeutig ohne Groß- und
  Kleinschreibung), Beschreibung, Ablauf (`templateFlowSchema` in `packages/shared`: nur Schritte
  der Formulare, auch KI-Schritte, kein Passwortschutz). Gehören keinem Projekt.
- **KI-Anbieter** (`ai-providers.ts`, Tabelle `ai_providers`):
  - Eine Zeile je Anbieter (Gemini, OpenAI, Perplexity, Claude, Custom), Liste und Regeln in
    `packages/shared/src/ai-providers.ts`.
  - Der API-Schlüssel liegt mit `SECRETS_KEY` verschlüsselt, dazu seine letzten vier Zeichen
    zum Wiedererkennen. `listAiProviders` liefert den Schlüssel nie, auch nicht verschlüsselt.
  - Ein leeres Schlüsselfeld behält den gespeicherten. Nur Custom (OpenAI-kompatibel, z. B.
    Ollama) kommt ohne Schlüssel aus und hat als einziger eine eigene Adresse.
  - Genau ein Anbieter ist Standard (Index `ai_providers_one_default`). Der erste gespeicherte
    wird es; wird der Standard entfernt, übernimmt der nächste in der Liste.
  - `getAiConfig` liefert den entschlüsselten Schlüssel für einen Aufruf, nur auf dem Server.
- **Laufnummern** (`{{run_nr}}`) vergibt `allocateRunNumber` atomar per
  `UPDATE … RETURNING`, nie über `max()+1`.
- **Löschregeln:**
  - Ein Projekt lässt sich erst löschen, wenn es keine Jobs mehr hat (`deleteCustomer`). Seine
    leeren Kampagnen und seine Zugangsdaten gehen mit.
  - Eine Kampagne mit Jobs nimmt ihre Jobs samt Läufen mit (`deleteCampaign`), aber nur, wenn
    „<Name> löschen“ eingetippt wurde (`campaignDeletePhrase`, `confirmPhrase` an
    `DeleteSection`). Die Datenbank-Schicht prüft das selbst noch einmal. Die Web-App entfernt
    danach die Bildschirmfotos.
  - Ein Job nimmt seine Läufe und Schritte mit (`deleteJob`, „Job löschen“ im Editor). Die
    Web-App entfernt danach die Bildschirmfotos dieser Läufe (`removeRunArtifacts`).
- **Tests:**
  - Laufen gegen `db-test`. Vor jedem Testlauf wird die Datenbank aus den Migrationen neu
    aufgebaut (`test/global-setup.ts`), vor jedem Test werden alle Tabellen geleert.
  - Die Testdateien laufen nacheinander (`fileParallelism: false`).
  - Wer eine neue Tabelle anlegt, ergänzt sie in `resetDb` (`test/db.ts`).

Bewusst festgehaltene Versionen:

- **TypeScript 6.0:** typescript-eslint unterstützt TS 7 noch nicht.
- **ESLint 9:** eslint-plugin-react aus `eslint-config-next` unterstützt ESLint 10 noch nicht.

Hochziehen erst, wenn beide Pakete die neue Version offiziell unterstützen.

- **Datenbank und Queue:** Postgres. Die Tabelle `runs` ist selbst die Warteschlange, ohne
  pg-boss und ohne Redis. So gibt es nur eine Quelle der Wahrheit (siehe Abschnitt Worker).
- **Ablauf:** wird als JSON-Schrittliste gespeichert, validiert mit Zod aus `packages/shared`.
  - Schritt-Typen: öffnen, klicken, ausfüllen, auswählen, Taste drücken (`press`, Taste oder
    Kombination wie `Control+a`, optional auf einem Element, keine F-Tasten: `KEY_PATTERN`),
    scrollen (`scroll`: von der aktuellen Position aus um eine Strecke nach unten, oben, rechts
    oder links; zu einer Position von oben und optional von links; bis ein Element zu sehen ist,
    auch seitlich; bis zum Rand der Seite in jeder Richtung), prüfen,
    auslesen, warten, screenshot, analytics, Passwortschutz (.htaccess, `basicAuth`), KI-Schritt.
  - Variablen: `{{faker.*}}`, `{{run_nr}}`, `{{bot_nr}}`, `{{secret.name}}`.
- **Zwei Arten zu testen:**
  - Fester Ablauf: aufgenommen (Live-Browser) oder aus einer Vorlage (`flow_templates`), in jedem
    Lauf gleich.
  - Frei: „Seite öffnen“ plus ein KI-Schritt mit dem Ziel des Tests (`stepsForAiTask`). Die KI
    sucht den Weg in jedem Lauf selbst und bewertet jedes Teilziel. Ein Ziel lässt sich nicht in
    feste Schritte übersetzen, deshalb gibt es keinen Vorschlag fester Schritte mehr.
  - Den Baukasten gibt es zum Korrigieren (Assistent, Editor) und für Vorlagen.
  - **Kein eigener Code (bewusst entschieden):** Weder ein Weg „Code schreiben“ noch ein
    Schritt-Typ dafür. Nutzer-Code liefe auf dem Server neben Datenbank, `SECRETS_KEY` und
    Zugangsdaten. Screen 07 aus dem Design wird nicht gebaut.
- **KI-Fallback pro Schritt:** Findet der Bot ein Element nicht, sucht die KI ein passendes
  und protokolliert das im Report.
- **Zeitplan:** `{ type: "interval" | "times" | "random", … }`. Bei Terminen (`slots: [{ date,
time, bots }]`, `stagger`) bilden die Bots eines Termins eine Welle.
  - Zufall (`packages/shared/src/random-schedule.ts`): Zeitraum `from`–`to` (Kalendertage, höchstens
    ein Jahr), `runs` Starts, je Wochentag eine Kurve aus 25 Punkten (0 bis 24 Uhr; 0 nie,
    1 normal, 2 doppelt so häufig; ohne Kurve gleichmäßig). Die Kurve ist ein Catmull-Rom-Spline
    (`curveValue`), so bleibt sie beim Ziehen glatt (`bendCurve` in `apps/web/src/lib/curve.ts`).
  - Gelost wird in 10-Minuten-Zellen, gewichtet mit der Kurve ihres Tages; ein Tag bekommt Starts
    nach der Fläche unter seiner Kurve. Fester Zufall (`seed`, Mulberry32): dieselben
    Einstellungen ergeben immer dieselben Starts, auf ganze Minuten. Die Stunde, die die
    Zeitumstellung auslässt, bekommt keinen Start. Ein Bot je Start.
  - Der Assistent lost ab dem Moment des Speicherns (`drawFrom`). Im Formular wählt man die
    Kurve je Wochentag, den der Zeitraum berührt (`weekdaysIn`), ziehbar mit Maus und Finger,
    per Tastatur links/rechts (Uhrzeit) und hoch/runter (`CurveEditor`).
- **Bots:** jeder Bot ist ein eigener Browser-Context im gemeinsamen Browser seiner Engine.
  - Pro Context: eigener Proxy, Standort-Profil (GPS, Locale, Zeitzone) und Gerät
    (Viewport, User-Agent, Touch).
  - Vor jedem Lauf prüft der Bot, in welchem Land seine IP tatsächlich landet. Bei falschem
    Land wird der Lauf abgebrochen.
- **Browser je Gerät** (`jobs.device_browsers`, z. B. `{ desktop: [chromium, firefox] }`, Regeln
  in `packages/shared/src/browsers.ts`): Chrome (Chromium), Firefox und Safari (WebKit).
  - Jedes gewählte Gerät hat seine eigenen Browser, Mehrfachauswahl. Desktop hat alle drei,
    Android Chrome oder Firefox (`browsersFor`). iPhone und iPad laufen immer in WebKit, denn auf
    iOS ist jeder Browser WebKit; die Oberfläche zeigt Safari dort fest.
  - Jede Kombination aus Gerät und Browser ist ein eigener Lauf (`runTargets`, `runs.browser`).
  - Ein neu gewähltes Gerät startet in Chrome (iOS: Safari, `defaultBrowsers`). Abgewählte Geräte
    behalten im Formular ihre Browser; gespeichert werden nur die gewählten
    (`normalizeDeviceBrowsers`). Fehler stehen am Gerät (`deviceBrowsers.<gerät>`).
  - Läufe und Jobs von vor der Auswahl sind Chrome. Migration 0010 hat die alte gemeinsame
    Browserliste (`jobs.browsers`) je Gerät übernommen, ohne dass sich ein Lauf ändert.
- **Live-Browser:** CDP-Screencast über WebSocket direkt vom Worker, nur in Chromium (siehe
  Worker → Live-Browser). Next.js gibt dafür einen
  kurzlebigen Token aus.
- **PDF:** dasselbe HTML wie der Report auf dem Bildschirm, gerendert mit `page.pdf()`,
  Kundenlogo im Kopf.
- **Gleichzeitigkeit:** Limit über `MAX_CONCURRENT_BROWSERS`. Bots über dem Limit warten in
  der Queue.

## Worker (`apps/worker`)

- **`runFlow(context, flow, options)`** führt einen Ablauf in einer neuen Seite des
  Browser-Contexts aus.
  - Beim ersten fehlgeschlagenen Schritt hört er auf. Die übrigen Schritte gelten als
    `skipped`.
  - Ein fehlgeschlagener Schritt bekommt ein Bildschirmfoto. Das Foto hat ein eigenes kurzes
    Zeitlimit, damit eine hängende Seite den Browser-Platz nicht blockiert.
  - Öffnet ein Schritt einen neuen Tab, machen die folgenden Schritte dort weiter (auch Foto bei
    Fehler). Ein Klick auf einen Link oder ein Formular mit eigenem `target` wartet auf den Tab;
    nach anderen Klicks wartet er 250 ms auf einen per Skript geöffneten Tab (gemessen: bis
    27 ms). Ein neuer Tab ist geladen, bevor der nächste Schritt beginnt.
  - PDFs zeigt der PDF-Viewer von Chromium. Er zeichnet erst kurz nach dem Laden; Fotos warten
    darauf (`waitForPdf`, liest den internen Ladezustand `loadState_` des Viewers, wartet daher
    nur, scheitert nie). Text im PDF finden Schritte nicht, URL und Foto gehen. In Tests lässt
    `guardContext` dafür `chrome:`- und `chrome-extension:`-Adressen durch.
- **Seiten öffnen** (`openPage`, für „Seite öffnen“ und den Live-Browser):
  fertig, sobald der Inhalt da ist (DOMContentLoaded), danach höchstens 5 s Warten auf `load`.
  Werbung oder Tracker, die nie laden, lassen eine Seite mit Inhalt nicht scheitern.
- **Variablen** werden vor der Aktion aufgelöst. Eine unbekannte Variable bricht den Schritt
  ab, ohne dass die Seite angefasst wird.
- **Meldungen:**
  - Sie sind deutsch und für den Report formuliert (`StepError`), z. B.
    „Element nicht gefunden: Rolle „button“ mit Name „Absenden“ (nach 10 s).“
  - Unbekannte Browserfehler werden auf ihre erste Zeile gekürzt.
  - Nennt ein CSS-Selektor ein Element, das es nicht gibt (z. B. `decline` statt `.decline`),
    erklärt `unknownTagHint` (`packages/shared`) das in der Meldung und schon beim Eintippen im
    Schrittformular.
  - Werte von Zugangsdaten werden überall maskiert: in Meldungen und ausgelesenen Werten.
- **Elemente:** Namen und Labels werden exakt gesucht. Passt ein Ziel auf mehrere Elemente,
  schlägt der Schritt fehl („Mehrdeutig …“), statt zu raten.
  - Gesucht wird in der Seite und in allen ihren iframes (`findTarget` in `targets.ts`), weil
    Cookie-Banner oft in einem iframe liegen. Mehrdeutig zählt über alle Frames.
- **Passwortschutz** (`basicAuth`, `basic-auth.ts`): Der Schritt schickt Benutzername und
  Passwort ab da als HTTP-Basic-Auth mit, aber nur an Schema, Host und Port der Start-URL, nie
  an Tracker oder CDNs. Er gehört vor den ersten Schritt „Seite öffnen“. Ein späterer
  Passwortschutz-Schritt ersetzt den früheren. Antwortet eine Seite mit HTTP 401, sagt die
  Meldung, ob der Schritt fehlt oder die Daten falsch sind.
- **Testdaten** für `{{faker.*}}` (`createTestData`):
  - Sie werden je Lauf und Bot fest geseedet. Ein erneuter Lauf erzeugt dieselben Daten.
  - E-Mail-Adressen gehen nur an `example.com`/`.org`/`.net`.
- **GA4:** Der Worker schneidet die Anfragen an `/g/collect` mit. Der Schritt `analytics`
  wartet, bis das Event gesendet wurde.
- **Bot-Läufe sind in GA4 markiert** (`bot-marking.ts`, Produktregel): Jede GA4-Anfrage eines
  Laufs bekommt vor dem Verlassen des Browsers `_dbg=1` (nur DebugView, nie in Berichten),
  `ep.traffic_type=internal` (Datenfilter „Interner Traffic“), `ep.click_bot=1` und
  `epn.click_bot_run=<Laufnummer>`. Eingeschaltete Merkmale überschreiben Werte der Website,
  ausgeschaltete lassen sie unverändert; sind alle aus, bleibt die Anfrage ganz unverändert
  (`jobs.analytics_marking`, Schema `analyticsMarkingSchema` in `packages/shared`). Erkannt werden
  Googles Adressen und server-seitiges Tagging auf eigener Domain (`/g/collect` mit `tid=G-…`).
- **Werbung** (`ad-blocking.ts`): `blockAds` bricht Anfragen an Werbenetzwerke ab
  (`AD_DOMAINS`, z. B. doubleclick.net, googlesyndication.com, amazon-adsystem.com, Criteo,
  Taboola), wie ein Werbeblocker, und zählt sie. Nie blockiert: GA4-Anfragen (`isGa4CollectUrl`,
  die werden markiert), der Tag Manager und Googles Einwilligungs-Banner
  (fundingchoicesmessages.google.com), damit Tests die Seite wie Besucher sehen. Der
  Live-Browser blockiert immer; es gibt dort noch keinen Job.
- **KI-Schritt** (`ai-step.ts`, Typ `ai`, `instruction` ist das Ziel des Tests): ein freier Test.
  `runFlow` führt ihn aus, nicht `executeStep`.
  - Je Runde: Seitenaufbau (`readStructure` in `page-structure.ts`, Aria-Snapshot der Seite und
    ihrer iframes) und Bildschirmfoto (JPEG) an die KI, sie antwortet mit genau einer Aktion
    (`nextAgentAction` in `packages/ai`) oder ihrer Bewertung. Eine Aktion läuft wie ein Schritt
    (`executeStep`, höchstens 10 s), das Ergebnis oder die Fehlermeldung geht in die nächste Runde.
    Nach `MAX_AI_ACTIONS` (25) Aktionen muss sie bewerten (`final`); tut sie es nicht, scheitert
    der Schritt.
  - Bewertung (`Criterion[]` in `packages/shared/src/ai-verdict.ts`): das Ziel in Teilziele
    zerlegt, je „met“, „failed“ oder „unknown“ mit dem, was sie gesehen hat. `verdictOutcome`:
    alle erfüllt → bestanden; eines nicht erfüllt → fehlgeschlagen, der Lauf bricht ab; eines nicht
    prüfbar → Schrittstatus `unclear`, der Lauf läuft weiter und endet „Mit Hinweis“ (`warning`).
  - Erlaubte Aktionen: klicken, ausfüllen, auswählen, Taste, scrollen, Seite öffnen, warten.
    „Seite öffnen“ nur auf der Website der Start-URL (`www.` egal). Erfundene echte E-Mail-Adressen
    werden `{{faker.email}}` (`safeMail`).
  - Zugangsdaten sieht die KI nur als Namen (`{{secret.name}}`). Adresse, Titel, Seitenaufbau und
    Bewertung gehen maskiert raus, auch Formularwerte in der Adresse. Steht ein Wert aus den
    Zugangsdaten auf der Seite (Adresse, Text, Feld, auch in iframes), gibt es in dieser Runde kein
    Bildschirmfoto (`showsSecret`).
  - Der Standard-Anbieter wird je Lauf gelesen (`getAiConfig`), nur wenn der Ablauf einen
    KI-Schritt hat. Ohne Anbieter scheitert der Schritt mit Hinweis auf „Einstellungen → KI & API“.
    Der Anbieter braucht ein Modell, das Bilder versteht.
  - Gespeichert: jede Aktion (`run_steps.ai_actions`), die Bewertung (`run_steps.ai_verdict`) und
    das Bildschirmfoto der Seite, wie sie bewertet wurde. Der Report zeigt alles unter dem Schritt.
- **Warteschlange** (`packages/db/src/queue.ts`), pro Takt (1 s) in `createWorker`:
  1. `planDueRuns` legt für aktive Jobs die fälligen Starts als `queued`-Läufe an.
     - Ein Start ist Termin × Bot × Gerät × Browser (`runTargets`).
     - Vorlauf 60 s. Verpasste Starts älter als 5 Min. werden übersprungen, nicht nachgeholt.
     - Doppelte Planung ist ausgeschlossen: Zeilensperre auf dem Job plus eindeutiger Index
       `runs_scheduled_start_unique`.
     - Ist der letzte Start vorbei und nichts mehr offen, wird der Job `finished`.
  2. `claimNextRun` holt mit `FOR UPDATE SKIP LOCKED` den frühesten fälligen Lauf eines aktiven
     Jobs. Jeder Lauf geht so an genau einen Worker.
  3. Höchstens `MAX_CONCURRENT_BROWSERS` Läufe laufen gleichzeitig. Jeder Lauf bekommt einen
     eigenen Browser-Context.
  4. `completeRun` speichert Ergebnis und Schritte in einer Transaktion.
     - Bildschirmfotos liegen unter `ARTIFACTS_DIR` (Standard `data/artifacts/`), der Pfad
       steht in `run_steps.screenshot_path`.
     - Die Web-App liefert sie über `/artifacts/<pfad>` aus (`src/app/artifacts`). Nur PNGs
       unterhalb des Ordners, `resolveArtifact` weist alles andere ab. `next.config.ts` setzt
       denselben Standard-Ordner wie der Worker. Ein eigener `ARTIFACTS_DIR` muss ein
       absoluter Pfad sein, weil Worker und Web-App in verschiedenen Ordnern starten.
     - Fehler außerhalb des Ablaufs, z. B. bei Zugangsdaten oder Browser, beenden den Lauf als
       „Lauf konnte nicht ausgeführt werden: …“.
- **Testläufe** (`queueTestRun`) sind Läufe ohne Termin (`slot_index` NULL):
  - `claimNextRun` nimmt sie auch bei pausierten, beendeten oder Entwurfs-Jobs an. Geplante
    Läufe nur bei aktiven Jobs.
  - Wartet oder läuft schon ein Testlauf des Jobs, gibt `queueTestRun` diesen zurück statt
    einen weiteren anzulegen.
  - Sie zählen nicht zum Fortschritt des Zeitplans (`runsDone`), aber zur Erfolgsquote.
- **Ein Worker:** Beim Start markiert er alle noch `running`-Läufe als abgebrochen
  (`recoverStaleRuns`).
  - Danach alle 15 Min. nur noch Läufe, die länger als 15 Min. laufen.
  - Mehrere Worker parallel bräuchten vorher eine Absprache über diesen Schritt.
- **Browser:** Je Engine teilen alle Läufe einen Browser (`createBrowserManager`). Chromium
  startet mit dem Worker, Firefox und WebKit beim ersten Lauf, der sie braucht. Stürzt einer ab,
  scheitern nur die Läufe darin, mit der Meldung des Browsers. Der nächste Lauf startet einen
  neuen. Ein gescheiterter Start wird beim nächsten Lauf erneut versucht.
  - Gestartet über `launchEngine` (`engines.ts`), auch in den Tests. Chromium läuft als ganzer
    Browser im neuen Headless-Modus (`channel: 'chromium'`), nicht als Headless-Shell: nur so
    zeigt er PDFs, z. B. einen Lebenslauf im neuen Tab. Er meldet HTTP 401 als Fehler
    `ERR_INVALID_AUTH_CREDENTIALS` statt als Antwort (`refusedCredentials`).
- **Live-Browser** („Im Browser aufnehmen“, `live-server.ts`, `live-session.ts`, `recorder.ts`):
  - `startRecordingAction` legt eine Sitzung mit einmaligem Token an (`recording_sessions`, nur
    SHA-256, 2 Min. gültig, eine je Nutzer). Der Browser verbindet sich damit zu
    `LIVE_URL/live?token=…` (Worker-Port `LIVE_PORT`, Standard 4200).
  - Der Worker prüft Herkunft (`originPolicy`: `APP_URL`, außerhalb von Produktion jeder
    localhost-Port) und Token, höchstens `LIVE_MAX_SESSIONS` (2) gleichzeitig, je 15 Min.
  - Ein Kontext im gemeinsamen Chromium, 1280 × 800, GA4 markiert wie bei Läufen (Laufnummer 0).
    Bild als JPEG über CDP-Screencast. Eingehende Nachrichten prüft `parseClientMessage` streng:
    nur Klick, Mausbewegung, Scrollen, Tasten und Kombinationen (`KEY_PATTERN`), Text,
    Webadresse, Zurück/Vor/Neu laden, Bildschirmfoto, Prüfung. Eingaben laufen der Reihe nach, auch wenn sie vor dem Seitenaufbau kommen.
  - Der Rekorder (Skript in jeder Seite und jedem iframe) schlägt je Aktion Ziele vor (Rolle mit
    Name, Label, Test-ID, Text, ID, CSS-Pfad). Der Worker nimmt das erste, das über alle Frames
    genau ein Element trifft. Ist das Element schon weg (Banner, die sich beim Klick entfernen),
    das beste nicht mehrdeutige. Enter im Formular wird ein Klick auf den Absende-Button.
  - Passwortfelder werden nie mitgeschnitten, der Schritt bekommt `{{secret.passwort}}`.
  - Aufgezeichnet wird immer, von Anfang bis Ende (kein „Nur bedienen“). Neben der Adresse fügt
    die Kamera ein Bildschirmfoto ein, der Haken macht den nächsten Klick zu einer Prüfung
    „Element sichtbar“ (die Seite reagiert nicht darauf). Die Uhr (`WaitMenu`) fügt Warten ein:
    Sekunden (höchstens 60), bis die Seite nichts mehr lädt, bis ein Text erscheint, oder bis ein
    Element erscheint (Modus `wait`: der nächste Klick wählt es, wie beim Haken). Solche Schritte reihen sich nach allen
    Aktionen davor ein (`recorder.insert`, ein Durchlauf durch alle Frames vorher). Eine neue
    Adresse in der Adressleiste wird ein Schritt „Seite öffnen“, Zurück und Vor auch (mit der
    Adresse, auf der man landet).
  - Tasten: Text wird Taste für Taste getippt, damit die Seite ihre Tasten sieht. Ein Schritt
    „Taste drücken“ entsteht für Tab, Escape, Kombinationen, Tasten auf einem Element mit Fokus
    und Enter in einem Feld ohne Formular. Kein eigener Schritt: Tippen im Feld (Ausfüllen),
    Enter im Formular und Enter/Leertaste auf Button oder Link (Klick), Tasten, die nur die Seite
    scrollen. Kopieren und Einfügen bleiben im eigenen Browser.
  - Scrollen: Scrollt der Nutzer selbst (Mausrad, Scroll-Tasten), wird die Position, an der die
    Seite zur Ruhe kommt, ein Schritt „Scrollen“; weiteres Scrollen ändert diesen Schritt. Die
    Position von links kommt nur dazu, wenn die Seite breiter als das Fenster ist. Scrollt
    die Seite von selbst (Anker nach einem Klick), entsteht kein Schritt.
  - Neue Tabs öffnen sich im selben Tab, PDFs mit dem Viewer von Chromium. Der aufgenommene
    Klick öffnet im Lauf den neuen Tab, in dem der Bot weitermacht.
- **Lebenszeichen:** Alle 10 s schreibt der Worker in `worker_heartbeats`, mit seinem Limit
  (`max_browsers`, für den Kalender). Die Web-App zeigt „online“, wenn der letzte Eintrag
  höchstens 30 s alt ist.
- **Geräte** (`contextOptionsFor`):
  - Desktop 1440 × 900, iPhone 15, Pixel 8, iPad (gen 11), alle mit Deutsch und Europe/Berlin.
  - Desktop behält den User-Agent seines Browsers. iPhone und iPad laufen in echtem WebKit.
  - Android in Firefox meldet sich als Firefox für Android. `isMobile` fehlt dort, weil Playwright
    es in Firefox nicht kann (Klicks warten sonst ewig). Die Seite bekommt deshalb die
    Fensterbreite statt ihres Meta-Viewports; Tippen und `pointer: coarse` gehen, `maxTouchPoints`
    bleibt 0.
- **Demo-Website** (`apps/worker/demo-site/`, `pnpm demo-site`, Port 4100):
  - Die Demo-Jobs aus `pnpm db:seed` zeigen nur auf `127.0.0.1:4100`, nie auf echte fremde
    Domains. Ein Test in `seed.test.ts` sichert das ab.
  - Neue Demo-Jobs immer auf diese Website legen.
  - Die Demo-Läufe haben Schritt-Ergebnisse, aber keine Bildschirmfotos. Ein fehlgeschlagener
    Demo-Lauf scheitert an seinem letzten Schritt.
- **Tests:**
  - Echtes Chromium gegen die lokalen Testseiten in `test/fixtures/site/`. `engines.test.ts`
    spielt die wichtigsten Abläufe zusätzlich in Firefox und WebKit durch. Spezialpfade:
    `/fehler` liefert HTTP 500, `/haengt` antwortet nie.
  - `useBrowser()` (`test/browser.ts`) lässt nur die Testseite durch, beantwortet GA4 lokal
    und blockiert alles andere.
  - Die Worker-Tests mit Datenbank nutzen eine eigene Datenbank `clickbot_worker_test` im
    `db-test`-Container. Sie wird in `test/global-setup.ts` angelegt und laufen deshalb parallel
    zu den Tests von `packages/db`.
  - Browser installieren: `pnpm --filter @click-bot/worker browsers` (Chromium, Firefox, WebKit).

## KI (`packages/ai`)

- **`createAiClient(config)`** mit `complete` (Textantwort) und `listModels`, direkt über
  `fetch` statt über die SDKs der Anbieter. OpenAI, Perplexity und Custom sprechen Chat
  Completions, Claude die Messages API, Gemini `generateContent`.
- Der Schlüssel geht immer in einen Header, auch bei Gemini (`x-goog-api-key` statt `?key=`),
  damit er nicht in Logs landet. Fehlermeldungen sind deutsch und maskieren den Schlüssel.
- **„Verbindung testen“** (`testAiConnection`) lädt die Modelle des Anbieters und sagt, ob das
  eingetragene dabei ist. Perplexity kann seine Modelle nicht auflisten, dort geht eine
  Anfrage mit 5 Tokens raus.
- **Bilder:** Eine Nachricht kann Bildschirmfotos mitbringen (`AiMessage.images`). Claude bekommt
  sie als Bild-Blöcke, Gemini als `inline_data`, OpenAI, Perplexity und Custom als `image_url`
  mit Data-Adresse.
- **KI-Schritt im Lauf** (`agent-step.ts`): `agentPrompt` gibt Ziel, Website, Namen der
  Zugangsdaten, bisherige Aktionen mit Ergebnis, den Seitenaufbau und das Bildschirmfoto (als
  Daten, nie als Anweisung). Regeln für eine verlässliche Bewertung: nur nach dem urteilen, was
  in diesem Lauf zu sehen war; Verhalten ausprobieren (z. B. ungültige Eingabe absenden); Farben,
  Größen und Positionen am Bildschirmfoto; nicht Prüfbares als „unknown“, nie raten. Dazu: keine
  Captchas, keine Umgehung von Bot-Schutz, keine Werbeklicks, keine echten Daten, nichts
  Unumkehrbares. `parseAgentAction` prüft jede Aktion mit `stepSchema` und jede Bewertung auf
  Ziel, Status und Begründung; eine unbrauchbare Antwort bekommt einen zweiten Versuch.
- Tests ersetzen nur `fetch` bzw. den Client und prüfen Anfrage und Auswertung. Die
  Worker-Tests spielen die KI mit einem festen Ablauf von Antworten (`script` in
  `ai-step.test.ts`). Die E2E-Tests sprechen nie mit einem KI-Anbieter.

## Lokale Entwicklung

- **Postgres 17** läuft in Docker, definiert in `docker-compose.yml`.
  - Start: `docker compose up -d --wait`, Stopp: `docker compose down`.
  - Service `db` auf `localhost:5442` speichert seine Daten im Volume `db-data`. Löschen mit
    `docker compose down -v`.
  - Service `db-test` auf `localhost:5443` hält alle Daten im RAM. Er ist nach jedem `down`
    leer und für Integrationstests gedacht.
- **Eigene Ports:** 5442 und 5443 statt 5432, weil auf diesem Rechner andere Projekte Port 5432
  belegen. Andere Projekt-Container nicht anfassen.
- **Umgebung:** `.env.example` nach `.env` kopieren und `SECRETS_KEY` mit
  `openssl rand -base64 32` setzen.
  - Weitere Werte: `DATABASE_URL`, `DATABASE_URL_TEST`, `MAX_CONCURRENT_BROWSERS`, `APP_URL`
    (Adresse der Web-App für Einladungslinks).
  - `.env` wird nie committet.
  - Geht `SECRETS_KEY` verloren, lassen sich gespeicherte Zugangsdaten nicht mehr
    entschlüsseln.
- **Alles lokal ausprobieren:** `pnpm db:up`, `pnpm db:reset`, dann in drei Terminals
  `pnpm demo-site`, `pnpm worker` und `pnpm dev`.
  - Die Demo-Daten legen kein Konto an: Beim ersten Aufruf führt `/anmelden` zu
    `/registrieren`, dort entsteht der erste Admin. Danach 2FA mit einer Authenticator-App.
- **E2E-Anmeldung:** `e2e/global-setup.ts` legt einen Admin mit 2FA an und speichert seine
  Sitzung (`e2e/.auth/`, nicht im Repo). Alle Specs nutzen sie, `auth.spec.ts` startet ohne.

## Hosting (geplant)

- Hostinger VPS KVM 2 (2 vCPU, 8 GB RAM) mit Docker Compose: web, worker, postgres, Caddy
  (TLS).
- Shared Hosting geht nicht: kein Chromium, keine dauerhaft laufenden Prozesse, kein WebSocket.
- Caddy leitet `wss://<domain>/live` an den Worker-Port `LIVE_PORT` weiter. `LIVE_URL` und
  `APP_URL` zeigen auf die öffentliche Adresse.
- Das Worker-Image braucht Chromium, Firefox und WebKit samt Systembibliotheken (z. B. das
  offizielle Playwright-Image), Chromium als ganzen Browser, nicht nur die Headless-Shell. Jede
  Engine ist ein eigener Prozess und kostet RAM.
- `MAX_CONCURRENT_BROWSERS=6` auf KVM 2. Der echte Wert kommt aus einem Lasttest, nicht aus
  einer Schätzung.

## Konventionen

- UI-Texte auf Deutsch, Code (Bezeichner, Commits, Kommentare) auf Englisch.
- **Formatierung macht ausschließlich Prettier**, mit einer Konfiguration im Repo-Root.
  - `prettier-plugin-tailwindcss` sortiert die Tailwind-Klassen.
  - ESLint prüft nur Code-Qualität, keine Formatierung (`eslint-config-prettier`).
  - Nicht von Hand formatieren und nicht über Formatierung diskutieren: `pnpm format`
    ausführen.
  - `pnpm format:check` ist Teil des Checks vor jedem Commit.
- Ein Schritt-Typ wird an genau einer Stelle definiert, als Zod-Schema in `packages/shared`.
  UI, Worker und KI leiten daraus ab.

## UI: strenges Atomic Design + Tailwind

Komponenten liegen in `apps/web/src/components/`, eine Ebene pro Ordner:

| Ebene                      | Darf importieren            | Beispiele aus dem Design                                                                                 |
| -------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `atoms/`                   | keine anderen Komponenten   | Button, Badge, Input, Chip, Toggle, Icon, Spinner, Skeleton, Text, Heading, Divider                      |
| `molecules/`               | atoms                       | Field, StatCard, StepItem, TimelineItem, RecStep, SlotRow, NavItem, KeyValueRow, Tabs                    |
| `organisms/`               | molecules, atoms            | Sidebar, PageHeader, JobsTable, StepList, AiSuggestion, ProxyTable, WeekCalendar, Stepper, ConfirmDialog |
| `templates/`               | organisms, molecules, atoms | AppShell (Sidebar + Header + Haupt-/Seitenspalte), AuthLayout, PdfReportLayout                           |
| Seiten = `app/**/page.tsx` | templates + alles darunter  | befüllen Templates mit Daten                                                                             |

Regeln:

- **Imports nur nach unten**, nie seitlich oder nach oben. Ein Atom importiert kein Atom, ein
  Molekül kein Molekül.
  - Durchgesetzt mit `eslint-plugin-boundaries` v7 in `apps/web/eslint.config.mjs`, Regel
    `boundaries/dependencies`. Ein Verstoß bricht den Lint.
  - Komponenten werden nur über ihre `index.ts` importiert.
  - `src/lib` (reine Helfer wie `cn`) darf von überall genutzt werden, importiert aber selbst
    keine Komponenten.
  - Dateien außerhalb der bekannten Ordner sind verboten (`boundaries/no-unknown-files`).
  - `apps/web/test/architecture.test.ts` beweist, dass die Regeln greifen. Wer die
    ESLint-Konfiguration ändert, ergänzt dort einen Fall.
  - Die Element-Muster in v7 sind Ordner, keine Dateien. `boundaries/root-path` muss gesetzt
    bleiben, sonst rechnet das Plugin vom Prozess-Verzeichnis aus und meldet nichts mehr.
- **Datenzugriff nur in Seiten.**
  - Atoms bis Templates sind rein darstellend: nur Props, kein fetch, kein DB-Import.
    Interaktivität (`"use client"`) so tief wie möglich ansetzen.
  - Jede Seite prüft die Anmeldung zuerst (`getShell()` bzw. `requireUser()` aus
    `src/server/auth.ts`), vor jedem Datenzugriff, auch wenn das Layout das schon tut: Next
    rendert Layout und Seite parallel. Jede Server Action ruft selbst `requireUser()` oder
    `requireAdmin()` auf.
  - Server Actions bekommen Komponenten als Prop, z. B. `toggleAction`. Sie liegen in
    `src/app/actions.ts`, die der Anmeldung in `src/app/auth-actions.ts`, die der KI-Anbieter
    in `src/app/ai-actions.ts`; Seiten importieren sie über `@/app/actions`. Sie prüfen Eingaben
    selbst noch einmal, denn jeder kann sie aufrufen.
  - Jede Aktion antwortet sofort sichtbar: Knöpfe und Schalter in einem `<form action>` sind
    `SubmitButton` bzw. `SubmitToggle` (Moleküle mit `useFormStatus`, Spinner und `aria-busy`,
    solange die Action läuft); Aktionen aus Client-Komponenten laufen in `useTransition` und
    zeigen den Wartezustand (z. B. der Projekt-Umschalter, `busy`).
  - Formulare über mehrere Schritte: Der Zustand liegt in einer Client-Komponente neben der
    Seite (z. B. `src/app/jobs/neu/new-job-wizard.tsx`), die nur Organisms zusammensteckt.
    Umwandeln und Prüfen stehen als reine Funktionen mit Tests in `src/lib`
    (`job-draft.ts`), weil `src/app` nicht in die Abdeckung zählt.
  - `src/server/` enthält den DB-Zugriff (`getDb`) und die Umwandlung von Datenbank-Zeilen in
    Anzeigedaten (`*-view.ts`). Die Datei beginnt mit `import 'server-only'`. Nur `src/app` darf
    sie importieren.
  - Anzeigedaten-Typen für Komponenten stehen in `src/lib/views.ts`. Komponenten kennen die
    Datenbank-Form nicht.
  - Komponenten und `src/lib` dürfen `@click-bot/db`, `@click-bot/ai`, `pg` und `drizzle-orm`
    nicht importieren.
    Das prüft `no-restricted-imports`, weil eslint-plugin-boundaries Workspace-Pakete außerhalb
    von `src/` übersieht.
- **Eine Komponente pro Ordner:** `Button/Button.tsx`, `Button/index.ts`, `Button.test.tsx`
  daneben. Kein Storybook (bewusst entschieden).
- **Neue Komponente:**
  - Zuerst prüfen, ob es sie auf einer Ebene schon gibt.
  - Bei Unsicherheit über die Ebene: so niedrig wie möglich einordnen.
  - Erst nach oben verschieben, wenn ein Import es erzwingt.
- **Auswahlfelder** nur über `Select` (Molekül), nie `<select>`: eigene Liste mit Haken am
  gewählten Eintrag, Tastatur wie die „Select-Only Combobox“ aus WAI-ARIA (Pfeile, Pos1/Ende,
  Enter, Escape, Anfangsbuchstaben). Fokus bleibt auf dem Feld; `name` legt ein verstecktes Feld
  für schlichte Formulare an. In Tests wählt `chooseOption` (`test/select.ts`, `e2e/select.ts`).
- **Modale** nur über `Dialog` (Molekül): Icon-Knopf und natives `<dialog>` (Fokus bleibt drin,
  Escape und Klick auf den Hintergrund schließen). Der Inhalt entsteht erst beim Öffnen, der
  Fokus geht auf sein erstes Feld. `useDialog()` gibt Inhalten `close`, z. B. für „Abbrechen“.
  jsdom kann `showModal` nicht; `test/setup.ts` ergänzt es, das echte Verhalten prüft Playwright.
- **Datumsfelder** nur über `DatePicker` (Molekül), nie `type="date"`: Eingabe als „20.11.2026“
  oder im Kalender (Tastatur wie im WAI-ARIA-Muster), weitergegeben als „2026-11-20“, ein
  Tippfehler unverändert, damit die Prüfung ihn meldet. In schlichten Formularen trägt ein
  verstecktes Feld (`name`) den Wert. Datumsrechnung in `src/lib/calendar.ts`.
  - Zeitraum (Start und Ende, z. B. `CampaignForm`): Ein im Kalender gewählter Start öffnet den
    Kalender des Endes (`onPick`, `DatePickerHandle.open`). Das Ende bekommt `min` = Start
    (`earliestEnd`): frühere Tage sind gesperrt, getippt blockieren sie das Absenden. Ein Ende vor
    einem neu gewählten Start wird geleert (`endAfterNewStart`).
- **Varianten** über `cva` (class-variance-authority), Klassen zusammenführen mit
  `tailwind-merge`. Keine Varianten über String-Bastelei mit Template-Strings.

Tailwind (v4, CSS-first):

- **Tokens** stehen in `apps/web/src/styles/globals.css` unter `@theme`, abgeleitet aus der
  Figma-Tabelle unten: `--color-surface`, `--color-text-muted`, Radien, Schriften.
- **Nur Token-Klassen verwenden,** z. B. `bg-surface`, `text-text-muted`, `border-border`,
  `rounded-card`.
  - Nicht erlaubt: Standardpalette (`bg-indigo-600`), Hex-Werte und willkürliche Werte
    (`p-[13px]`, `text-[#333]`).
  - Fehlt ein Wert, wird er als Token ergänzt, nicht inline gesetzt.
- **Kontrast mindestens 4,5:1** (WCAG AA) für jeden Text, auch für Platzhalter, Badges und Text
  auf getönten Karten. Deshalb ist `success` #067647 und `danger` #B42318 (dunkler als in Figma),
  gibt es kein `text-subtle` mehr (Platzhalter sind `text-text-muted`), und Beschreibungen auf
  einer gewählten Karte (`bg-primary-soft`) sind `text-text-secondary`. Die hellen Grautöne
  `*-dot` sind nur für Punkte und Flächen, nie für Text. Geprüft mit axe über alle Seiten.
- **Kein `style={}`** außer für wirklich dynamische Werte, z. B. die Breite eines
  Fortschrittsbalkens.

Responsive (Handy zuerst prüfen, `e2e/mobile.spec.ts`):

- Unter `lg` ist die Sidebar eine Kopfzeile mit Menü (Schublade), ab `lg` eine Spalte, die beim
  Scrollen stehen bleibt.
- Unter `xl` stehen die Spalten der Templates untereinander. Tabellen werden darunter zu einer
  Karte je Zeile (Läufe erst unter `md`), mit ausdrücklichen ARIA-Rollen, weil Safari einer als
  Block angezeigten Tabelle die Semantik nimmt.
- Knöpfe von Formularseiten (Assistent, Editor) stehen in `ActionBar`: ab `xl` neben dem Titel,
  darunter als Leiste am unteren Fensterrand.
- `e2e/mobile.spec.ts` prüft bei 360, 768 und 1280 px, dass nichts seitlich übersteht. Neue Seiten
  dort eintragen.

## Tests (Pflicht, kein Nachgedanke)

Der Code testet Websites, also muss er selbst verlässlich sein. Eine Änderung ohne passende
Tests ist nicht fertig.

**Vorgehen**

- Logik (Schemas, Zeitplan, Variablen, Schritt-Ausführung, Rechte) wird testgetrieben gebaut:
  erst ein fehlschlagender Test, dann der Code.
- Jeder Bugfix beginnt mit einem Test, der den Fehler zeigt.
- Tests prüfen Verhalten, nicht Implementierung.
  - Keine Snapshot-Tests für Logik.
  - Keine Tests, die nur Mocks aufrufen.
- Jeder Test benennt den Fall, den er absichert. Zum Beispiel: „Welle mit 6 Bots und Limit 4
  startet 4 sofort und 2 nach Freiwerden“.

**Ebenen**

| Was                                                             | Werkzeug                                             | Worauf es ankommt                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` (Zod-Schemas, Variablen, Zeitplan-Berechnung) | Vitest                                               | Grenzfälle: Zeitzonen und Sommerzeit, Termine in der Vergangenheit, `bots = 0`, ungültige Schritte, fehlende Secrets |
| UI-Komponenten (atoms bis templates)                            | Vitest + Testing Library                             | Abfragen über Rolle und Label (`getByRole`), Tastaturbedienung, Zustände (leer, laden, Fehler), Varianten            |
| Worker (Schritte, KI-Fallback, Proxy-Landprüfung, Abbrüche)     | Vitest + echtes Chromium gegen lokale Fixture-Seiten | Timeout, Element fehlt, langsame Seite, Weiterleitung, Ländersperre, Analytics-Request ja oder nein                  |
| API und Datenbank                                               | Vitest gegen echtes Postgres (`db-test`, Port 5443)  | Rechte, Queue-Verhalten, Limit `MAX_CONCURRENT_BROWSERS`                                                             |
| Ende-zu-Ende (`apps/web/e2e`)                                   | Playwright gegen echten Next-Server und `db-test`    | Login → Job anlegen → Lauf → Report → PDF, Live-Ansicht                                                              |

**Regeln**

- Tests rufen nie echte fremde Websites auf.
  - Der Worker testet gegen Fixture-Seiten in `apps/worker/test/fixtures/`: Kontaktformular,
    Cookie-Banner, langsame Seite, Sperrseite, simuliertes GA-Collect.
  - Netzwerkzugriff nach außen ist in Tests blockiert.
- Die Datenbank wird nicht gemockt. Gemockt werden nur externe Dienste: KI-API, E-Mail,
  Slack, Proxy-Anbieter.
- Tests sind deterministisch:
  - Faker mit festem Seed, Uhrzeit über Fake-Timer.
  - Kein `sleep`. Gewartet wird auf Bedingungen, nicht auf Zeit.
  - Wackelnde Tests werden repariert, nicht mit Retries überdeckt.
- Abdeckung als Untergrenze, nicht als Ziel:
  - `packages/shared` mindestens 95 % Zweige.
  - Worker- und Web-Logik mindestens 90 %.
  - Reine Darstellungskomponenten über Verhaltenstests, ohne Prozentvorgabe.
- Vor jedem Commit laufen `pnpm format:check`, `pnpm lint`, `pnpm typecheck` und `pnpm test`
  ohne Fehler.

## Befehle

Alle Befehle im Repo-Root ausführen.

| Befehl                                     | Zweck                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm install`                             | Abhängigkeiten installieren                                                                     |
| `pnpm db:up` / `pnpm db:down`              | lokale Datenbanken starten / stoppen (Docker)                                                   |
| `pnpm db:migrate`                          | Migrationen auf die Entwicklungs-Datenbank anwenden (liest `.env`)                              |
| `pnpm db:generate`                         | nach Schema-Änderung neue SQL-Migration erzeugen                                                |
| `pnpm db:seed`                             | Demo-Daten (4 Jobs aus dem Design) in eine leere Entwicklungs-DB schreiben                      |
| `pnpm db:reset`                            | Entwicklungs-DB löschen, neu migrieren und Demo-Daten anlegen                                   |
| `pnpm auth:invite <email> [--admin]`       | Einladungslink ausgeben (neues Konto oder Zugang zurücksetzen)                                  |
| `pnpm demo-site`                           | lokale Demo-Website für die Demo-Jobs auf http://127.0.0.1:4100                                 |
| `pnpm worker`                              | Worker starten: plant und führt Läufe aus (liest `.env`)                                        |
| `pnpm test:e2e`                            | Playwright-Tests gegen echten Next-Server und Test-DB (nicht in `test`)                         |
| `pnpm --filter @click-bot/worker browsers` | Chromium, Firefox und WebKit für Playwright installieren (einmalig, nötig für die Worker-Tests) |
| `pnpm dev`                                 | Web-App auf http://localhost:3000                                                               |
| `pnpm test`                                | alle Tests (Vitest-Projekte `shared` und `web`)                                                 |
| `pnpm vitest run --project shared`         | nur ein Projekt testen                                                                          |
| `pnpm test:coverage`                       | Tests mit Abdeckung; scheitert unter den Grenzwerten aus `vitest.config.ts`                     |
| `pnpm lint`                                | ESLint in allen Paketen, inklusive Atomic-Design-Regeln                                         |
| `pnpm typecheck`                           | TypeScript in allen Paketen                                                                     |
| `pnpm format` / `pnpm format:check`        | Prettier schreiben / prüfen                                                                     |
| `pnpm check`                               | format:check, lint, typecheck und test in einem Lauf                                            |
| `pnpm --filter @click-bot/web build`       | Produktions-Build der Web-App                                                                   |
| `pnpm --filter @click-bot/web icons`       | Favicon (`.ico`, SVG), Apple- und Manifest-Icons aus dem Logo-Zeichen neu erzeugen              |

- **Build-Skripte:** pnpm führt Build-Skripte von Abhängigkeiten nur aus, wenn sie in
  `pnpm-workspace.yaml` unter `onlyBuiltDependencies` freigegeben sind.
- **`.env` der Web-App:** Sie liest die `.env` im Repo-Root über `process.loadEnvFile` in
  `next.config.ts`. Bereits gesetzte Variablen haben Vorrang. Die Node-Option
  `--env-file` funktioniert mit Next nicht, weil Next sie über `NODE_OPTIONS` weitergibt.
- **Migrationen:** `runMigrations` gibt es nur über `@click-bot/db/migrate`. Turbopack kann
  den Migrations-Ordner nicht bündeln, deshalb darf er nie über den Haupt-Import in die
  Web-App gelangen.
- **E2E-Tests:**
  - Sie starten einen eigenen Next-Server auf Port 3200 mit Build-Ordner `.next-e2e`, damit
    `pnpm dev` daneben laufen kann.
  - Vorher wird die Test-DB mit den Demo-Daten neu aufgebaut. Nicht gleichzeitig mit
    `pnpm test` laufen lassen, beide nutzen `db-test`.

## Design (Figma, via figwright-Plugin)

Seite „Click-Bot – Screens“. Die Variable-Collection „Tokens“ ist die Quelle für die
Design-Tokens:

| Token      | Wert    | Token                  | Wert              |
| ---------- | ------- | ---------------------- | ----------------- |
| bg         | #F6F7F9 | primary                | #4F46E5           |
| surface    | #FFFFFF | primary-soft           | #EEF2FF           |
| border     | #E4E7EC | success / -soft        | #079455 / #ECFDF3 |
| text       | #101828 | danger / -soft         | #D92D20 / #FEF3F2 |
| text-muted | #667085 | warning / -soft        | #B54708 / #FFFAEB |
| sidebar    | #0F172A | sidebar-text / -active | #CBD5E1 / #1E293B |

Im Code ergänzt (nicht in der Collection): `info` / `info-soft` #026AA2 / #E0F2FE für den
Schritt-Typ „Ausfüllen“, `text-secondary` #344054 für die Schrittnummer, `neutral-dot` #98A2B3
für den grauen Punkt. Abweichend von der Collection wegen des Kontrasts (siehe Tailwind):
`success` #067647, `danger` #B42318, `danger-hover` #912018.

Schrift: Inter, für Code und Technisches Roboto Mono. Radien: Karten 12, Inputs 8, Chips 6.

Screens (Node-IDs):

| Nr. | Screen                 | Node-ID |
| --- | ---------------------- | ------- |
| 01  | Jobs                   | 1:27    |
| 02  | Editor                 | 1:28    |
| 02b | Zeitplan nach Terminen | 1:1004  |
| 03  | Lauf-Report            | 1:29    |
| 03b | Welle-Report           | 1:1356  |
| 04  | Live-Browser           | 1:833   |
| 05  | Neuer Job              | 5:1140  |
| 05b | Standort & Gerät       | 5:1520  |
| 06  | Ablauf mit KI          | 5:1166  |
| 07  | Code (entfällt)        | 5:1179  |
| 08a | Zugangsdaten           | 5:2059  |
| 08b | Proxies & Standorte    | 5:1898  |
| 08c | Benachrichtigungen     | 5:2141  |
| 09  | Login                  | 5:2379  |
| 10  | Kunden                 | 5:2401  |
| 11  | PDF-Report (A4)        | 5:3245  |
| 12  | Vergleich              | 5:2971  |
| 13  | Kalender               | 5:3115  |
| 14  | Läufe                  | 5:2595  |
| 15  | Systemstatus           | 5:2777  |
| 16  | Zustände               | 5:3293  |

Komponenten: Sidebar 1:83, Button/Primary 1:246, Button/Secondary 1:247, Badges 1:248–1:251,
StatCard 1:252, Field 1:253, Step 1:395, TimelineItem 1:396, RecStep 1:834, SlotRow 1:1297.
