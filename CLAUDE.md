# Click-Bot

Web-Tool zum automatisierten Testen von Websites (eigene Seiten und Kundenseiten der Agentur).
Ein Bot öffnet eine Seite in einem echten Browser, führt einen Ablauf aus (klicken, Formulare
ausfüllen, prüfen) und erstellt pro Lauf einen Report auf dem Bildschirm und als PDF.

Status: Grundgerüst steht. Fertig sind das Design (Figma), `packages/shared` (Ablauf-Schema,
Variablen, Zeitplan) und `apps/web` mit Tailwind-Tokens, Atomic-Design-Lint und dem Atom
`Button`. Noch nicht gebaut sind `apps/worker`, die Datenbank-Schicht, Login und alle Screens.
Was als „geplant“ markiert ist, existiert noch nicht.

## Produktregeln (nicht verhandelbar)

- Nur für eigene oder vom Kunden freigegebene Websites. Das Tool ist ein Testwerkzeug.
- Keine Umgehung von Captchas, Bot-Erkennung, Rate-Limits oder Ländersperren fremder Seiten.
  Kein Fingerprint-Spoofing und kein Captcha-Solving.
- Kein künstlicher Traffic, der Kennzahlen aufbläht (Klick-KPIs, Werbeanzeigen, Analytics).
  Bot-Läufe sind markiert (`debug_mode` bzw. eigener Parameter) und in Analytics filterbar.
- Proxies und Standort-Profile dienen nur Geo-Tests: Ländersperren, standortabhängige Inhalte
  und die GA-Zuordnung.
- Zugangsdaten (Secrets) sind verschlüsselt gespeichert und erscheinen nie in Reports,
  Screenshots, Videos oder Logs.

## Architektur

pnpm-Monorepo, Node 22, TypeScript überall.

```
apps/web         Next.js 16 (App Router): UI, API-Routen, Login, PDF-Erzeugung
apps/worker      (geplant) Node-Prozess mit Playwright/Chromium: führt Läufe aus, Live-Stream via CDP
packages/shared  Zod-Schemas und reine Logik: flow.ts, variables.ts, schedule.ts
```

`packages/shared` liefert TypeScript-Quelltext aus, ohne eigenen Build. Next kompiliert ihn
über `transpilePackages` mit.

Bewusst festgehaltene Versionen:

- **TypeScript 6.0:** typescript-eslint unterstützt TS 7 noch nicht.
- **ESLint 9:** eslint-plugin-react aus `eslint-config-next` unterstützt ESLint 10 noch nicht.

Hochziehen erst, wenn beide Pakete die neue Version offiziell unterstützen.

- **Datenbank und Queue:** Postgres, Jobs über pg-boss (keine separate Redis-Instanz).
- **Ablauf:** wird als JSON-Schrittliste gespeichert, validiert mit Zod aus `packages/shared`.
  - Schritt-Typen: öffnen, klicken, ausfüllen, auswählen, prüfen, auslesen, warten,
    screenshot, analytics, KI-Schritt, Code.
  - Variablen: `{{faker.*}}`, `{{run_nr}}`, `{{bot_nr}}`, `{{secret.name}}`.
- **Vier Wege zum Ablauf:**
  - KI: Beschreibung → Schrittvorschlag + Rückfragen.
  - Aufnehmen: Live-Browser.
  - Editor: Baukasten.
  - Code: Playwright/TypeScript in einer Sandbox.
  - Alle vier erzeugen dieselbe Schrittliste.
- **KI-Fallback pro Schritt:** Findet der Bot ein Element nicht, sucht die KI ein passendes
  und protokolliert das im Report.
- **Zeitplan:** `{ type: "interval" | "times", slots: [{ date, time, bots }], stagger }`.
  Die Bots eines Termins bilden eine Welle.
- **Bots:** jeder Bot ist ein eigener Browser-Context im gemeinsamen Chromium.
  - Pro Context: eigener Proxy, Standort-Profil (GPS, Locale, Zeitzone) und Gerät
    (Viewport, User-Agent, Touch).
  - Vor jedem Lauf prüft der Bot, in welchem Land seine IP tatsächlich landet. Bei falschem
    Land wird der Lauf abgebrochen.
- **Live-Browser:** CDP-Screencast über WebSocket direkt vom Worker. Next.js gibt dafür einen
  kurzlebigen Token aus.
- **PDF:** dasselbe HTML wie der Report auf dem Bildschirm, gerendert mit `page.pdf()`,
  Kundenlogo im Kopf.
- **Gleichzeitigkeit:** Limit über `MAX_CONCURRENT_BROWSERS`. Bots über dem Limit warten in
  der Queue.

## Lokale Entwicklung

- **Postgres 17** läuft in Docker, definiert in `docker-compose.yml`.
  - Start: `docker compose up -d --wait`, Stopp: `docker compose down`.
  - Service `db` auf `localhost:5442` speichert seine Daten im Volume `db-data`. Löschen mit
    `docker compose down -v`.
  - Service `db-test` auf `localhost:5443` hält alle Daten im RAM. Er ist nach jedem `down`
    leer und für Integrationstests gedacht.
- **Eigene Ports:** 5442 und 5443 statt 5432, weil auf diesem Rechner andere Projekte Port 5432
  belegen. Andere Projekt-Container nicht anfassen.
- **Umgebung:** `.env.example` nach `.env` kopieren. Darin stehen `DATABASE_URL`,
  `DATABASE_URL_TEST` und `MAX_CONCURRENT_BROWSERS`. `.env` wird nie committet.
- **pg-boss** nutzt dieselbe Datenbank, im eigenen Schema `pgboss`.

## Hosting (geplant)

- Hostinger VPS KVM 2 (2 vCPU, 8 GB RAM) mit Docker Compose: web, worker, postgres, Caddy
  (TLS).
- Shared Hosting geht nicht: kein Chromium, keine dauerhaft laufenden Prozesse, kein WebSocket.
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
- **Datenzugriff nur in Seiten.** Atoms bis Templates sind rein darstellend: nur Props, kein
  fetch, keine Server Actions, kein DB-Import. Interaktivität (`"use client"`) so tief wie
  möglich ansetzen.
- **Eine Komponente pro Ordner:** `Button/Button.tsx`, `Button/index.ts`, `Button.test.tsx`
  daneben. Kein Storybook (bewusst entschieden).
- **Neue Komponente:**
  - Zuerst prüfen, ob es sie auf einer Ebene schon gibt.
  - Bei Unsicherheit über die Ebene: so niedrig wie möglich einordnen.
  - Erst nach oben verschieben, wenn ein Import es erzwingt.
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
- **Kein `style={}`** außer für wirklich dynamische Werte, z. B. die Breite eines
  Fortschrittsbalkens.

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
| Ende-zu-Ende                                                    | Playwright gegen den lokalen Docker-Stack            | Login → Job anlegen → Lauf → Report → PDF, Live-Ansicht                                                              |

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

| Befehl                               | Zweck                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm install`                       | Abhängigkeiten installieren                                                 |
| `pnpm db:up` / `pnpm db:down`        | lokale Datenbanken starten / stoppen (Docker)                               |
| `pnpm dev`                           | Web-App auf http://localhost:3000                                           |
| `pnpm test`                          | alle Tests (Vitest-Projekte `shared` und `web`)                             |
| `pnpm vitest run --project shared`   | nur ein Projekt testen                                                      |
| `pnpm test:coverage`                 | Tests mit Abdeckung; scheitert unter den Grenzwerten aus `vitest.config.ts` |
| `pnpm lint`                          | ESLint in allen Paketen, inklusive Atomic-Design-Regeln                     |
| `pnpm typecheck`                     | TypeScript in allen Paketen                                                 |
| `pnpm format` / `pnpm format:check`  | Prettier schreiben / prüfen                                                 |
| `pnpm check`                         | format:check, lint, typecheck und test in einem Lauf                        |
| `pnpm --filter @click-bot/web build` | Produktions-Build der Web-App                                               |

pnpm führt Build-Skripte von Abhängigkeiten nur aus, wenn sie in `pnpm-workspace.yaml` unter
`onlyBuiltDependencies` freigegeben sind.

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
| 07  | Code                   | 5:1179  |
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
