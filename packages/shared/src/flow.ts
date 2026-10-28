import { z } from 'zod';

/** How a step finds its element. Mirrors Playwright's locator strategies. */
export const targetSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('role'), role: z.string().min(1), name: z.string().min(1).optional() }),
  z.object({ by: z.literal('label'), label: z.string().min(1) }),
  z.object({ by: z.literal('text'), text: z.string().min(1), exact: z.boolean().default(false) }),
  z.object({ by: z.literal('css'), selector: z.string().min(1) }),
  z.object({ by: z.literal('testId'), testId: z.string().min(1) }),
]);

// Absolute http(s) URL, a path relative to the job's start URL, or a URL built from a variable.
const URL_PATTERN = /^(https?:\/\/\S+|\/\S*|\{\{.+\}\}\S*)$/;

const stepBase = {
  id: z.string().min(1),
  timeoutMs: z.number().int().min(100).max(120_000).default(10_000),
  aiFallback: z.boolean().default(true),
  note: z.string().max(500).optional(),
};

const assertionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('textVisible'), text: z.string().min(1) }),
  z.object({ kind: z.literal('elementVisible'), target: targetSchema }),
  z.object({ kind: z.literal('urlContains'), value: z.string().min(1) }),
  z.object({ kind: z.literal('titleContains'), value: z.string().min(1) }),
]);

const waitConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('duration'), ms: z.number().int().min(1).max(60_000) }),
  z.object({ kind: z.literal('element'), target: targetSchema }),
  z.object({ kind: z.literal('networkIdle') }),
]);

export const stepSchema = z.discriminatedUnion('type', [
  z.object({ ...stepBase, type: z.literal('open'), url: z.string().regex(URL_PATTERN) }),
  z.object({ ...stepBase, type: z.literal('click'), target: targetSchema }),
  z.object({ ...stepBase, type: z.literal('fill'), target: targetSchema, value: z.string() }),
  z.object({
    ...stepBase,
    type: z.literal('select'),
    target: targetSchema,
    option: z.string().min(1),
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
    event: z.string().min(1),
    params: z.record(z.string(), z.string()).optional(),
  }),
  z.object({ ...stepBase, type: z.literal('ai'), instruction: z.string().min(1).max(2000) }),
  z.object({ ...stepBase, type: z.literal('code'), source: z.string().min(1).max(50_000) }),
]);

export const flowSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(stepSchema).min(1).max(200),
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
