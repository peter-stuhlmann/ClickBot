# Click-Bot

Web-Tool zum automatisierten Testen von Websites (eigene Seiten und Kundenseiten der Agentur).
Ein Bot öffnet eine Seite in einem echten Browser, führt einen Ablauf aus (klicken, Formulare
ausfüllen, prüfen) und erstellt pro Lauf einen Report auf dem Bildschirm und als PDF.

Status: Grundgerüst, Datenbank-Schicht, Worker mit Zeitplan, die Job-Liste, der Assistent
„Neuer Job“, der Editor, der Lauf-Report, die Läufe-Übersicht, die Projekte, die Anmeldung und
die Einstellungen der KI-Anbieter stehen.

- **Fertig:**
  - das Design (Figma)
  - `packages/shared`: Ablauf-Schema, Variablen, Zeitplan, Domain-Regeln
  - `packages/db`: Schema, Migrationen, Jobs, Zugangsdaten, Verschlüsselung, Übersicht und
    Kennzahlen, Demo-Daten, KI-Anbieter
  - `packages/ai`: Anbindung an Gemini, OpenAI, Perplexity, Claude und eine OpenAI-kompatible
    API (Custom), mit Verbindungstest
  - `apps/web`:
    - App-Rahmen mit Sidebar
    - Screen 01 „Jobs“ mit echten Daten, inklusive Pausieren und Fortsetzen
    - Screen 05 „Neuer Job“ (`/jobs/neu`): Assistent in vier Schritten (Website, Ablauf,
      Zeitplan, Geräte). Am Ende wird der Job aktiv angelegt und läuft nach Zeitplan. Den
      Ablauf gibt es zusammengeklickt, „Mit KI beschreiben“ (Screen 06, siehe Abschnitt KI) oder
      „Im Browser aufnehmen“ (Screen 04, siehe Worker → Live-Browser).
    - Screen 02 „Editor“ (`/jobs/<id>`, über den Job-Namen in der Liste): Name, Start-URL,
      Zeitplan, Geräte und Ablauf eines bestehenden Jobs ändern. Zwei Spalten statt der drei
      aus dem Design, weil die Terminzeilen sonst zu schmal werden.
    - „Testlauf starten“ im Editor: speichert offene Änderungen, startet einen Bot auf dem
      ersten Gerät und öffnet dessen Report. Der Report lädt sich alle 2 s neu, solange der
      Lauf wartet oder läuft.
    - Screen 10 „Kunden“, in der App „Projekte“ (`/projekte`), mit Kennzahlen und „Projekt
      anlegen“ (`/projekte/neu`). Alte Links auf `/kunden` leiten weiter (`next.config.ts`).
      Die Spalte „Wochen-PDF“ fehlt, bis es das PDF gibt.
    - Screen 14 „Läufe“ (`/laeufe`): alle Läufe, neueste zuerst, 50 je Seite, mit Filtern nach
      Projekt, Ergebnis, Zeitraum und Gerät. Die Filter stehen in der Adresse (GET-Formular,
      `src/lib/run-filters.ts`). CSV, Sammel-PDF, gespeicherte Ansichten und Standort fehlen.
    - Screen 03 „Lauf-Report“ (`/laeufe/<id>`), erreichbar über „Letzter Lauf“ in der
      Job-Liste: Kennzahlen, Schritte mit Ergebnis, Fehler und Bildschirmfoto
    - „Einstellungen“ mit den Tabs aus Screen 08a, bisher nur „Team“ und „KI & API“
      (`/einstellungen/ki`): API-Schlüssel, Modell und Standard-Anbieter. Nur Admins ändern,
      die anderen sehen den Stand.
  - `apps/worker`:
    - plant fällige Termine ein und führt sie mit Playwright aus
    - speichert Ergebnis, Schritte und Bildschirmfotos
    - meldet seinen Status an die Web-App
    - führt Läufe in Chrome, Firefox und Safari (WebKit) aus und emuliert Geräte
- **Noch nicht gebaut:**
  - im Worker: Proxies und Standort-Profile, KI-Schritte, KI-Suche nach Elementen, Live-Stream; Markierung für andere
    Analytics-Werkzeuge als GA4
  - E-Mail-Versand (Einladungslinks werden angezeigt und von Hand weitergegeben), Konten
    sperren oder löschen, Rate-Limit je IP-Adresse beim Login
  - im Assistenten: Standort-Profile je Termin; im Editor KI und Aufnehmen; Schritte vom Typ „auslesen“ lassen sich noch nicht anlegen
  - im Lauf-Report: PDF, „Erneut ausführen“, KI-Eingriffe, Konsolenfehler und ausgelesene
    Werte (dafür speichert der Worker noch keine Daten)
  - im Editor: KI-Box, „Erfolg & Daten“ und Variablen-Liste aus dem Design
  - alle übrigen Screens, auch der Welle-Report (03b)

Was als „geplant“ markiert ist, existiert noch nicht.

## Produktregeln (nicht verhandelbar)

- Nur für eigene oder vom Kunden freigegebene Websites. Das Tool ist ein Testwerkzeug.
  - Wer einen Job anlegt, bestätigt das im Assistenten. `createJobAction` prüft die
    Bestätigung auf dem Server noch einmal.
- Keine Umgehung von Captchas, Bot-Erkennung, Rate-Limits oder Ländersperren fremder Seiten.
  Kein Fingerprint-Spoofing und kein Captcha-Solving.
- Kein künstlicher Traffic, der Kennzahlen aufbläht (Klick-KPIs, Werbeanzeigen, Analytics).
  Bot-Läufe sind standardmäßig in GA4 markiert (Debug-Modus, interner Traffic, eigene Kennung)
  und damit filterbar.
  - Pro Job lassen sich die Markierungen einzeln oder alle abschalten, z. B. um die Zuordnung in
    den normalen GA4-Berichten zu testen. Die Oberfläche warnt dann deutlich.
  - Jeder Lauf speichert die Markierung, mit der er lief (`runs.analytics_marking`). Sein Report
    vermerkt, wenn sie eingeschränkt oder aus war.
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
  `-2`, `-3`. Bearbeiten und Löschen gibt es noch nicht.
- **Jobs** legt `createJob` als Entwurf an. Mit `status: 'active'` (Assistent) plant der
  Worker sie sofort ein.
- **Jobs ändern** (`updateJob`, Editor):
  - Gleiche Prüfungen wie beim Anlegen. Der Status bleibt.
  - Läuft mit derselben Zeilensperre wie der Planer, damit kein Start aus einem halb
    geänderten Zeitplan entsteht.
  - Der Planer erkennt erledigte Starts an ihrer Position (`runs.slot_index`). Deshalb:
    Termine mit Läufen (`listStartedSlots`) lassen sich nicht verschieben oder löschen, nur
    ihre Bot-Zahl ändern. Neue Termine kommen hinten dazu. Hat ein Job Läufe, bleibt die Art
    des Zeitplans (Intervall oder Termine). Ein Intervall darf sich frei ändern, es zählt
    einfach weiter.
  - Starts in der Vergangenheit sind erlaubt, wenn sie schon gespeichert waren
    (`validateJobEdit`). Eine gespeicherte Intervall-Startzeit bleibt sekundengenau, solange
    Datum und Uhrzeit im Formular unverändert sind.
  - Jobs mit Schritten ohne Formular (Auslesen, KI) zeigt der Editor nur an, damit
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
  - Ein Kunde mit Jobs lässt sich nicht löschen.
  - Ein Job nimmt seine Läufe und Schritte mit.
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
  - Schritt-Typen: öffnen, klicken, ausfüllen, auswählen, prüfen, auslesen, warten,
    screenshot, analytics, Passwortschutz (.htaccess, `basicAuth`), KI-Schritt.
  - Variablen: `{{faker.*}}`, `{{run_nr}}`, `{{bot_nr}}`, `{{secret.name}}`.
- **Drei Wege zum Ablauf:**
  - KI: Beschreibung → Schrittvorschlag + Rückfragen.
  - Aufnehmen: Live-Browser.
  - Editor: Baukasten.
  - Alle drei erzeugen dieselbe Schrittliste.
  - **Kein eigener Code (bewusst entschieden):** Weder ein Weg „Code schreiben“ noch ein
    Schritt-Typ dafür. Nutzer-Code liefe auf dem Server neben Datenbank, `SECRETS_KEY` und
    Zugangsdaten. Screen 07 aus dem Design wird nicht gebaut.
- **KI-Fallback pro Schritt:** Findet der Bot ein Element nicht, sucht die KI ein passendes
  und protokolliert das im Report.
- **Zeitplan:** `{ type: "interval" | "times", slots: [{ date, time, bots }], stagger }`.
  Die Bots eines Termins bilden eine Welle.
- **Bots:** jeder Bot ist ein eigener Browser-Context im gemeinsamen Browser seiner Engine.
  - Pro Context: eigener Proxy, Standort-Profil (GPS, Locale, Zeitzone) und Gerät
    (Viewport, User-Agent, Touch).
  - Vor jedem Lauf prüft der Bot, in welchem Land seine IP tatsächlich landet. Bei falschem
    Land wird der Lauf abgebrochen.
- **Browser je Job** (`jobs.browsers`, `runTargets` in `packages/shared/src/browsers.ts`): Chrome
  (Chromium), Firefox und Safari (WebKit), Mehrfachauswahl wie die Geräte.
  - Jede Kombination aus Gerät und Browser ist ein eigener Lauf (`runs.browser`).
  - iPhone und iPad laufen immer einmal in WebKit, egal welche Browser gewählt sind: Auf iOS ist
    jeder Browser WebKit. Android gibt es nur mit Chrome oder Firefox (`browserProblem`).
  - Läufe und Jobs von vor der Auswahl sind Chrome.
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
- **Noch nicht verfügbar:** KI-Schritte schlagen mit klarer Meldung fehl, bis sie gebaut sind.
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
- **Live-Browser** („Im Browser aufnehmen“, `live-server.ts`, `live-session.ts`, `recorder.ts`):
  - `startRecordingAction` legt eine Sitzung mit einmaligem Token an (`recording_sessions`, nur
    SHA-256, 2 Min. gültig, eine je Nutzer). Der Browser verbindet sich damit zu
    `LIVE_URL/live?token=…` (Worker-Port `LIVE_PORT`, Standard 4200).
  - Der Worker prüft Herkunft (`originPolicy`: `APP_URL`, außerhalb von Produktion jeder
    localhost-Port) und Token, höchstens `LIVE_MAX_SESSIONS` (2) gleichzeitig, je 15 Min.
  - Ein Kontext im gemeinsamen Chromium, 1280 × 800, GA4 markiert wie bei Läufen (Laufnummer 0).
    Bild als JPEG über CDP-Screencast. Eingehende Nachrichten prüft `parseClientMessage` streng:
    nur Klick, Mausbewegung, Scrollen, einfache Tasten, Text, Webadresse, Zurück/Vor/Neu laden,
    Modus. Eingaben laufen der Reihe nach, auch wenn sie vor dem Seitenaufbau kommen.
  - Der Rekorder (Skript in jeder Seite und jedem iframe) schlägt je Aktion Ziele vor (Rolle mit
    Name, Label, Test-ID, Text, ID, CSS-Pfad). Der Worker nimmt das erste, das über alle Frames
    genau ein Element trifft. Ist das Element schon weg (Banner, die sich beim Klick entfernen),
    das beste nicht mehrdeutige. Enter im Formular wird ein Klick auf den Absende-Button.
  - Passwortfelder werden nie mitgeschnitten, der Schritt bekommt `{{secret.passwort}}`.
  - Modi: Aufnehmen, Nur bedienen, „Prüfung hinzufügen“ (der nächste Klick wird eine Prüfung
    „Element sichtbar“, die Seite reagiert nicht darauf). Eine neue Adresse in der Adressleiste
    wird ein Schritt „Seite öffnen“, Zurück und Vor auch (mit der Adresse, auf der man landet).
  - Neue Tabs öffnen sich im selben Tab.
- **Lebenszeichen:** Alle 10 s schreibt der Worker in `worker_heartbeats`. Die Web-App zeigt
  „online“, wenn der letzte Eintrag höchstens 30 s alt ist.
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
- **„Mit KI beschreiben“** (`suggestFlowAction` in `src/app/ai-actions.ts`, `suggestFlow`):
  1. Ist der Worker online, öffnet er die Start-URL einmal (`page_analyses`, `analysePage` im
     Worker): Accessibility-Baum der Seite und ihrer iframes (Aria-Snapshot), Formulare,
     Cookie-Tool, GA4-IDs. GA4-Anfragen sind dabei markiert wie bei Läufen (Laufnummer 0). Die
     Web-App wartet höchstens 45 s, Analysen gehen vor geplanten Läufen.
  2. Der Standard-Anbieter bekommt Beschreibung, Antworten auf frühere Rückfragen und den
     Seitenaufbau. Der Prompt erklärt die Schritt-Typen an einem Beispiel, das ein Test gegen
     `flowSchema` prüft, und behandelt den Seitenaufbau als Daten, nie als Anweisung.
  3. `parseFlowSuggestion` prüft jeden Schritt mit `stepSchema`. Erlaubt sind nur Typen, die das
     Formular kann (kein KI-, Auslese- oder Passwortschritt). Eine erfundene echte
     E-Mail-Adresse wird zu `{{faker.email}}`. Fehlt „Seite öffnen“ am Anfang, kommt es dazu.
     Eine ungültige Antwort bekommt eine zweite Chance mit der Fehlermeldung.
  4. Nichts wird gespeichert oder ausgeführt, bis die Schritte übernommen werden. Ohne Worker
     oder ohne lesbare Seite sagt der Vorschlag das („Seite nicht gelesen“).
- Tests ersetzen nur `fetch` bzw. den Client und prüfen Anfrage und Auswertung. Die E2E-Tests
  sprechen nie mit einem echten Anbieter: `new-job-ai.spec.ts` startet eine eigene
  OpenAI-kompatible Attrappe und richtet sie als „Custom“ ein.

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
  offizielle Playwright-Image). Jede Engine ist ein eigener Prozess und kostet RAM.
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
  - Jede Seite prüft die Anmeldung zuerst (`getCurrentUser()` bzw. `requireUser()` aus
    `src/server/auth.ts`), vor jedem Datenzugriff. Jede Server Action ruft selbst
    `requireUser()` oder `requireAdmin()` auf.
  - Server Actions bekommen Komponenten als Prop, z. B. `toggleAction`. Sie liegen in
    `src/app/actions.ts`, die der Anmeldung in `src/app/auth-actions.ts`, die der KI-Anbieter
    in `src/app/ai-actions.ts`. Sie prüfen Eingaben
    selbst noch einmal, denn jeder kann sie aufrufen.
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
Schritt-Typ „Ausfüllen“, `text-secondary` #344054 für die Schrittnummer.

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
