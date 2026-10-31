import { templateFlowSchema, type Flow } from '@click-bot/shared';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from './client';
import { NotFoundError, ValidationError, issuesFromZod, type ValidationIssue } from './errors';
import { isUuid } from './ids';
import { flowTemplates, users } from './schema';

export type FlowTemplate = typeof flowTemplates.$inferSelect;

export type TemplateInput = {
  name: string;
  description?: string | null;
  /** Untrusted input, validated with templateFlowSchema. */
  flow: unknown;
};

export type TemplateRow = Pick<
  FlowTemplate,
  'id' | 'name' | 'description' | 'flow' | 'updatedAt'
> & {
  /** Number of steps. */
  steps: number;
  /** Who made it; null once the account is gone. */
  createdByName: string | null;
};

const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

/** Checks a template and returns what to store; `except` is the template itself when changed. */
async function checkedFields(db: Database, input: TemplateInput, except?: string) {
  const issues: ValidationIssue[] = [];
  const name = input.name.trim();
  const description = input.description?.trim() || null;

  if (!name) issues.push({ path: 'name', message: 'Name fehlt.' });
  else if (name.length > MAX_NAME) {
    issues.push({ path: 'name', message: `Name ist zu lang (höchstens ${MAX_NAME} Zeichen).` });
  } else {
    const [twin] = await db
      .select({ id: flowTemplates.id })
      .from(flowTemplates)
      .where(
        and(
          sql`lower(${flowTemplates.name}) = lower(${name})`,
          except ? ne(flowTemplates.id, except) : undefined,
        ),
      )
      .limit(1);
    if (twin)
      issues.push({ path: 'name', message: 'Eine Vorlage mit diesem Namen gibt es schon.' });
  }
  if (description && description.length > MAX_DESCRIPTION) {
    issues.push({ path: 'description', message: `Höchstens ${MAX_DESCRIPTION} Zeichen.` });
  }
  const flow = templateFlowSchema.safeParse(input.flow);
  if (!flow.success) issues.push(...issuesFromZod('flow', flow.error));

  if (issues.length > 0 || !flow.success) throw new ValidationError(issues);
  return { name, description, flow: flow.data as Flow };
}

/** Creates a template; names are unique, ignoring case. */
export async function createTemplate(
  db: Database,
  input: TemplateInput & { createdBy: string | null },
): Promise<FlowTemplate> {
  const fields = await checkedFields(db, input);
  const [template] = await db
    .insert(flowTemplates)
    .values({ ...fields, createdBy: input.createdBy })
    .returning();
  return template as FlowTemplate;
}

export async function getTemplate(db: Database, id: string): Promise<FlowTemplate> {
  const template =
    isUuid(id) && (await db.query.flowTemplates.findFirst({ where: eq(flowTemplates.id, id) }));
  if (!template) throw new NotFoundError('Vorlage', id);
  return template;
}

/** Changes name, note and steps. Jobs made from the template keep their steps. */
export async function updateTemplate(
  db: Database,
  id: string,
  input: TemplateInput,
): Promise<FlowTemplate> {
  await getTemplate(db, id);
  const fields = await checkedFields(db, input, id);
  const [template] = await db
    .update(flowTemplates)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(flowTemplates.id, id))
    .returning();
  return template as FlowTemplate;
}

export async function deleteTemplate(db: Database, id: string): Promise<void> {
  await getTemplate(db, id);
  await db.delete(flowTemplates).where(eq(flowTemplates.id, id));
}

/** All templates by name, for the templates page and the wizard. */
export async function listTemplates(db: Database): Promise<TemplateRow[]> {
  const rows = await db
    .select({
      id: flowTemplates.id,
      name: flowTemplates.name,
      description: flowTemplates.description,
      flow: flowTemplates.flow,
      updatedAt: flowTemplates.updatedAt,
      createdByName: users.name,
    })
    .from(flowTemplates)
    .leftJoin(users, eq(users.id, flowTemplates.createdBy))
    .orderBy(asc(sql`lower(${flowTemplates.name})`), asc(flowTemplates.id));
  return rows.map((row) => ({ ...row, steps: row.flow.steps.length }));
}
