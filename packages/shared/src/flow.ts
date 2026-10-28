import { z } from 'zod';

// Messages are shown next to the field in the editor, so they are German and short.
const REQUIRED = 'Bitte ausfüllen.';
const TIMEOUT_RANGE = 'Timeout muss zwischen 0,1 und 120 Sekunden liegen.';
const WAIT_RANGE = 'Wartezeit muss zwischen 0,001 und 60 Sekunden liegen.';

const filled = () => z.string().min(1, REQUIRED);

/** How a step finds its element. Mirrors Playwright's locator strategies. */
export const targetSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('role'), role: filled(), name: filled().optional() }),
  z.object({ by: z.literal('label'), label: filled() }),
  z.object({ by: z.literal('text'), text: filled(), exact: z.boolean().default(false) }),
  z.object({ by: z.literal('css'), selector: filled() }),
  z.object({ by: z.literal('testId'), testId: filled() }),
]);

// Absolute http(s) URL, a path relative to the job's start URL, or a URL built from a variable.
const URL_PATTERN = /^(https?:\/\/\S+|\/\S*|\{\{.+\}\}\S*)$/;

const stepBase = {
  id: z.string().min(1),
  timeoutMs: z
    .number({ error: TIMEOUT_RANGE })
    .int(TIMEOUT_RANGE)
    .min(100, TIMEOUT_RANGE)
    .max(120_000, TIMEOUT_RANGE)
    .default(10_000),
  aiFallback: z.boolean().default(true),
  note: z.string().max(500).optional(),
};

const assertionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('textVisible'), text: filled() }),
  z.object({ kind: z.literal('elementVisible'), target: targetSchema }),
  z.object({ kind: z.literal('urlContains'), value: filled() }),
  z.object({ kind: z.literal('titleContains'), value: filled() }),
]);

const waitConditionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('duration'),
    ms: z.number({ error: WAIT_RANGE }).int(WAIT_RANGE).min(1, WAIT_RANGE).max(60_000, WAIT_RANGE),
  }),
  z.object({ kind: z.literal('element'), target: targetSchema }),
  z.object({ kind: z.literal('networkIdle') }),
]);

export const stepSchema = z.discriminatedUnion('type', [
  z.object({
    ...stepBase,
    type: z.literal('open'),
    url: z.string().regex(URL_PATTERN, 'Adresse muss mit http://, https:// oder / beginnen.'),
  }),
  z.object({ ...stepBase, type: z.literal('click'), target: targetSchema }),
  z.object({ ...stepBase, type: z.literal('fill'), target: targetSchema, value: z.string() }),
  z.object({
    ...stepBase,
    type: z.literal('select'),
    target: targetSchema,
    option: filled(),
  }),
  z.object({ ...stepBase, type: z.literal('assert'), assertion: assertionSchema }),
  z.object({
    ...stepBase,
    type: z.literal('extract'),
    target: targetSchema,
    saveAs: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  }),
  z.object({ ...stepBase, type: z.literal('wait'), until: waitConditionSchema }),
  z.object({
    ...stepBase,
    type: z.literal('screenshot'),
    name: z.string().max(80).optional(),
    fullPage: z.boolean().default(false),
  }),
  z.object({
    ...stepBase,
    type: z.literal('analytics'),
    provider: z.literal('ga4'),
    event: filled(),
    params: z.record(z.string(), z.string()).optional(),
  }),
  z.object({ ...stepBase, type: z.literal('ai'), instruction: z.string().min(1).max(2000) }),
  z.object({ ...stepBase, type: z.literal('code'), source: z.string().min(1).max(50_000) }),
]);

export const flowSchema = z
  .object({
    version: z.literal(1),
    steps: z
      .array(stepSchema)
      .min(1, 'Der Ablauf braucht mindestens einen Schritt.')
      .max(200, 'Höchstens 200 Schritte.'),
  })
  .superRefine((flow, ctx) => {
    const ids = new Set<string>();
    const savedVariables = new Set<string>();
    flow.steps.forEach((step, index) => {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'id'],
          message: `Schritt-ID „${step.id}“ ist doppelt.`,
        });
      }
      ids.add(step.id);

      if (step.type === 'extract') {
        if (savedVariables.has(step.saveAs)) {
          ctx.addIssue({
            code: 'custom',
            path: ['steps', index, 'saveAs'],
            message: `Variable „${step.saveAs}“ wird schon von einem anderen Schritt gesetzt.`,
          });
        }
        savedVariables.add(step.saveAs);
      }
    });
  });

export type Target = z.infer<typeof targetSchema>;
export type Step = z.infer<typeof stepSchema>;
export type StepType = Step['type'];
export type Flow = z.infer<typeof flowSchema>;
