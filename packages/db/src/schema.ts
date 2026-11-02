import {
  AI_PROVIDER_KINDS,
  BROWSER_KINDS,
  DEVICE_KINDS,
  type AnalyticsMarking,
  type Criterion,
  type DeviceBrowsers,
  type Flow,
  type Schedule,
} from '@click-bot/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
/** Binary data; pg reads it as a Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum('user_role', ['admin', 'member']);
export const jobStatus = pgEnum('job_status', ['draft', 'active', 'paused', 'finished']);
export const runStatus = pgEnum('run_status', [
  'queued',
  'running',
  'passed',
  'warning',
  'failed',
  'cancelled',
]);
// unclear: an AI step could not check every sub-goal of its test ("Mit Hinweis").
export const stepStatus = pgEnum('step_status', [
  'passed',
  'healed',
  'unclear',
  'failed',
  'skipped',
]);
export const proxyKind = pgEnum('proxy_kind', ['datacenter', 'residential']);
export const device = pgEnum('device', DEVICE_KINDS);
export const browser = pgEnum('browser', BROWSER_KINDS);
export const aiProviderKind = pgEnum('ai_provider_kind', AI_PROVIDER_KINDS);

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Encrypted TOTP secret; null until 2FA is set up. */
    totpSecretEnc: text('totp_secret_enc'),
    /** Time step of the last accepted 2FA code: a code works only once. */
    totpLastStep: integer('totp_last_step'),
    role: userRole('role').notNull().default('member'),
    /** Wrong passwords in a row; resets on success. */
    failedLogins: integer('failed_logins').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`)],
);

/** Profile pictures, apart from `users`, so the session lookup on every request stays small. */
export const userAvatars = pgTable(
  'user_avatars',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(),
    data: bytea('data').notNull(),
    /** In the picture's URL: a new picture gets a new URL, so caches never show the old one. */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    // No SVG: it can carry script.
    check('user_avatars_type', sql`${t.contentType} in ('image/png', 'image/jpeg', 'image/webp')`),
    check('user_avatars_size', sql`octet_length(${t.data}) <= 524288`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie value: the database alone never yields a valid session. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** False after the password, true after the 2FA code (or 2FA setup). */
    complete: boolean('complete').notNull().default(false),
    /** Encrypted TOTP secret while 2FA is being set up. */
    pendingTotpEnc: text('pending_totp_enc'),
    failedCodes: integer('failed_codes').notNull().default(0),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    /** SHA-256 of the token in the link. */
    tokenHash: text('token_hash').notNull(),
    email: text('email').notNull(),
    role: userRole('role').notNull().default('member'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('invitations_token_unique').on(t.tokenHash)],
);

export const customers = pgTable(
  'customers',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
    weeklyReport: boolean('weekly_report').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('customers_slug_unique').on(t.slug),
    check('customers_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

/**
 * A campaign groups the jobs of a project (customer), e.g. "Black Friday" or "Allgemein". Every
 * job belongs to one; its customer is the campaign's (composite foreign key on jobs).
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** Optional period, as calendar dates. */
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    description: text('description'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('campaigns_customer_name_unique').on(t.customerId, sql`lower(${t.name})`),
    // Target of the composite key of jobs: a job's campaign belongs to the job's customer.
    unique('campaigns_id_customer_unique').on(t.id, t.customerId),
    check(
      'campaigns_period',
      sql`${t.endsOn} IS NULL OR ${t.startsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    campaignId: uuid('campaign_id').notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    startUrl: text('start_url').notNull(),
    /** Validated with flowSchema from @click-bot/shared before every write. */
    flow: jsonb('flow').$type<Flow>().notNull(),
    schedule: jsonb('schedule').$type<Schedule>().notNull(),
    devices: device('devices')
      .array()
      .notNull()
      .default(sql`ARRAY['desktop']::device[]`),
    /**
     * The browsers of each device, e.g. { desktop: ['chromium', 'firefox'] }; validated with
     * deviceBrowsersSchema, run as runTargets in @click-bot/shared.
     */
    deviceBrowsers: jsonb('device_browsers')
      .$type<DeviceBrowsers>()
      .notNull()
      .default({ desktop: ['chromium'] }),
    status: jobStatus('status').notNull().default('draft'),
    /** How bot runs mark their GA4 requests; see analyticsMarkingSchema in @click-bot/shared. */
    analyticsMarking: jsonb('analytics_marking')
      .$type<AnalyticsMarking>()
      .notNull()
      .default({ debugMode: true, internalTraffic: true, botFlag: true, runNumber: true }),
    /** Whether bot runs block requests to ad networks (product rule: no fake ad impressions). */
    blockAds: boolean('block_ads').notNull().default(true),
    /** Last handed-out run number; increased atomically, see allocateRunNumber. */
    runCounter: integer('run_counter').notNull().default(0),
    /**
     * A draft of the "Neuer Job" wizard: its form as it was left, so a reload brings it back
     * (saveJobDraft). Without passwords. Null once the job is created or saved in the editor.
     */
    wizardState: jsonb('wizard_state').$type<unknown>(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('jobs_customer_idx').on(t.customerId),
    index('jobs_campaign_idx').on(t.campaignId),
    foreignKey({
      name: 'jobs_campaign_fk',
      columns: [t.campaignId, t.customerId],
      foreignColumns: [campaigns.id, campaigns.customerId],
    }).onDelete('restrict'),
    check('jobs_devices_not_empty', sql`cardinality(${t.devices}) > 0`),
    check('jobs_device_browsers_object', sql`jsonb_typeof(${t.deviceBrowsers}) = 'object'`),
    check('jobs_wizard_state_size', sql`octet_length(${t.wizardState}::text) <= 262144`),
  ],
);

export const locationProfiles = pgTable(
  'location_profiles',
  {
    id: id(),
    name: text('name').notNull(),
    country: char('country', { length: 2 }).notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    locale: text('locale').notNull(),
    timezone: text('timezone').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('location_profiles_name_unique').on(t.name),
    check('location_profiles_country_upper', sql`${t.country} ~ '^[A-Z]{2}$'`),
    check('location_profiles_latitude', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('location_profiles_longitude', sql`${t.longitude} BETWEEN -180 AND 180`),
  ],
);

export const proxies = pgTable(
  'proxies',
  {
    id: id(),
    name: text('name').notNull(),
    country: char('country', { length: 2 }).notNull(),
    city: text('city'),
    kind: proxyKind('kind').notNull(),
    /** Encrypted proxy URL including credentials. */
    urlEnc: text('url_enc').notNull(),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastCheckIp: text('last_check_ip'),
    lastCheckCountry: char('last_check_country', { length: 2 }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('proxies_name_unique').on(t.name),
    check('proxies_country_upper', sql`${t.country} ~ '^[A-Z]{2}$'`),
  ],
);

export const secrets = pgTable(
  'secrets',
  {
    id: id(),
    /** Null means the secret is available for all customers. */
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    valueEnc: text('value_enc').notNull(),
    /** Hosts the secret may be used on, see isHostAllowed in @click-bot/shared. */
    allowedDomains: text('allowed_domains').array().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // One name per customer, and one per name among the shared secrets (customer_id NULL).
    unique('secrets_customer_name_unique').on(t.customerId, t.name).nullsNotDistinct(),
    check('secrets_name_format', sql`${t.name} ~ '^[a-z0-9]+([-_][a-z0-9]+)*$'`),
    check('secrets_domains_not_empty', sql`cardinality(${t.allowedDomains}) > 0`),
  ],
);

export const runs = pgTable(
  'runs',
  {
    id: id(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    runNr: integer('run_nr').notNull(),
    /** Slot (wave) the run belongs to; null for manual test runs. */
    slotIndex: integer('slot_index'),
    botNr: integer('bot_nr').notNull().default(1),
    device: device('device').notNull(),
    browser: browser('browser').notNull().default('chromium'),
    locationProfileId: uuid('location_profile_id').references(() => locationProfiles.id, {
      onDelete: 'set null',
    }),
    proxyId: uuid('proxy_id').references(() => proxies.id, { onDelete: 'set null' }),
    status: runStatus('status').notNull().default('queued'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
    /** The GA4 marking the run ran with (copied from the job when it starts). */
    analyticsMarking: jsonb('analytics_marking').$type<AnalyticsMarking>(),
    /** Whether the run blocked ads (copied from the job when it starts); null before that. */
    adsBlocked: boolean('ads_blocked'),
    /** How many requests to ad networks the run blocked. */
    blockedAdRequests: integer('blocked_ad_requests'),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'runs_blocked_ad_requests_not_negative',
      sql`${t.blockedAdRequests} is null or ${t.blockedAdRequests} >= 0`,
    ),
    uniqueIndex('runs_job_run_nr_unique').on(t.jobId, t.runNr),
    // A scheduled start (slot × bot × device × browser) becomes exactly one run, even if two
    // schedulers plan at the same time. Manual test runs have no slot and are not affected.
    uniqueIndex('runs_scheduled_start_unique')
      .on(t.jobId, t.slotIndex, t.botNr, t.device, t.browser)
      .where(sql`${t.slotIndex} IS NOT NULL`),
    index('runs_status_scheduled_idx').on(t.status, t.scheduledAt),
    // The run list: newest first, with "since" filters, over all jobs.
    index('runs_scheduled_at_idx').on(t.scheduledAt.desc(), t.runNr.desc()),
    check('runs_bot_nr_positive', sql`${t.botNr} > 0`),
    check(
      'runs_finished_after_start',
      sql`${t.finishedAt} IS NULL OR ${t.startedAt} IS NULL OR ${t.finishedAt} >= ${t.startedAt}`,
    ),
  ],
);

export const runSteps = pgTable(
  'run_steps',
  {
    id: id(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    stepId: text('step_id').notNull(),
    status: stepStatus('status').notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** Already masked: must never contain secret values. */
    message: text('message'),
    screenshotPath: text('screenshot_path'),
    /** AI step: what the AI did, one German line per action. Already masked. */
    aiActions: jsonb('ai_actions').$type<string[]>(),
    /** AI step: every sub-goal of the test with the verdict of the AI. Already masked. */
    aiVerdict: jsonb('ai_verdict').$type<Criterion[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('run_steps_run_step_unique').on(t.runId, t.stepIndex),
    check('run_steps_duration_positive', sql`${t.durationMs} >= 0`),
  ],
);

/**
 * "Im Browser aufnehmen": the web app hands out a one-time token, the worker opens the live
 * browser for it. Only the token's SHA-256 is stored, as with sessions.
 */
export const recordingSessions = pgTable(
  'recording_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startUrl: text('start_url').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    /** The token must be used before this. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('recording_sessions_token_unique').on(t.tokenHash),
    index('recording_sessions_user_idx').on(t.userId),
  ],
);

export const workerHeartbeats = pgTable(
  'worker_heartbeats',
  {
    workerId: text('worker_id').primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    /** How many browsers the worker runs at once (MAX_CONCURRENT_BROWSERS); for the calendar. */
    maxBrowsers: integer('max_browsers'),
  },
  (t) => [
    check(
      'worker_heartbeats_max_browsers_positive',
      sql`${t.maxBrowsers} IS NULL OR ${t.maxBrowsers} > 0`,
    ),
  ],
);

/** "Einstellungen → KI & API": one row per provider; the default one serves AI steps. */
export const aiProviders = pgTable(
  'ai_providers',
  {
    kind: aiProviderKind('kind').primaryKey(),
    model: text('model').notNull(),
    /** Only for "custom" (OpenAI-compatible API); the others have a fixed address. */
    baseUrl: text('base_url'),
    /** Encrypted with SECRETS_KEY; null only for a custom endpoint without a key. */
    apiKeyEnc: text('api_key_enc'),
    /** Last four characters ("…1234"), so the UI can show which key is stored. */
    apiKeyHint: text('api_key_hint'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_providers_one_default')
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
    check('ai_providers_base_url', sql`(${t.kind} = 'custom') = (${t.baseUrl} IS NOT NULL)`),
    check(
      'ai_providers_key',
      sql`${t.kind} = 'custom' OR (${t.apiKeyEnc} IS NOT NULL AND ${t.apiKeyHint} IS NOT NULL)`,
    ),
  ],
);

/**
 * "Vorlagen": flows for any website, for all projects. A job made from one copies its steps, so
 * changing or deleting a template changes no job.
 */
export const flowTemplates = pgTable(
  'flow_templates',
  {
    id: id(),
    name: text('name').notNull(),
    description: text('description'),
    /** Validated with templateFlowSchema from @click-bot/shared. */
    flow: jsonb('flow').$type<Flow>().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('flow_templates_name_unique').on(sql`lower(${t.name})`)],
);
