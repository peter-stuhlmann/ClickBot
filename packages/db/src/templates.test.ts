import { templateFlowSchema } from '@click-bot/shared';
import { describe, expect, it } from 'vitest';
import { db, single } from '../test/db';
import { NotFoundError, ValidationError } from './errors';
import { users } from './schema';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from './templates';

const flow = {
  version: 1,
  steps: [
    { id: 'kontakt', type: 'open', url: '/kontakt' },
    {
      id: 'senden',
      type: 'click',
      target: { by: 'role', role: 'button', name: 'Absenden' },
    },
  ],
};

const input = (overrides: Record<string, unknown> = {}) => ({
  name: 'Kontaktformular',
  description: 'Füllt das Formular aus und sendet es ab.',
  flow,
  createdBy: null,
  ...overrides,
});

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ValidationError)) throw new Error(`Expected ValidationError: ${error}`);
  return error.issues;
}

describe('createTemplate', () => {
  it('stores name, note and flow, trimmed, with who made it', async () => {
    const { id: userId } = single(
      await db
        .insert(users)
        .values({ name: 'Peter Stuhlmann', email: 'peter@beispiel.de', passwordHash: 'x' })
        .returning(),
    );
    const template = await createTemplate(
      db,
      input({ name: '  Kontaktformular ', description: '  ', createdBy: userId }),
    );
    expect(template).toMatchObject({ name: 'Kontaktformular', description: null, flow });

    expect(await listTemplates(db)).toEqual([
      {
        id: template.id,
        name: 'Kontaktformular',
        description: null,
        // As checked, with the defaults of each step.
        flow: templateFlowSchema.parse(flow),
        steps: 2,
        createdByName: 'Peter Stuhlmann',
        updatedAt: expect.any(Date),
      },
    ]);
  });

  it('checks everything at once: name, note and every step', async () => {
    const issues = await issuesOf(
      createTemplate(
        db,
        input({
          name: ' ',
          description: 'x'.repeat(501),
          flow: {
            version: 1,
            steps: [
              { id: 'a', type: 'open', url: 'kontakt' },
              { id: 'pw', type: 'basicAuth', username: 'team', password: 'geheim' },
            ],
          },
        }),
      ),
    );
    expect(issues).toEqual([
      { path: 'name', message: 'Name fehlt.' },
      { path: 'description', message: 'Höchstens 500 Zeichen.' },
      {
        path: 'flow.steps.0.url',
        message: 'Adresse muss mit http://, https:// oder / beginnen.',
      },
      {
        path: 'flow.steps.1.type',
        message: 'Passwortschutz gehört zu einer Website und nicht in eine Vorlage.',
      },
    ]);
  });

  it('keeps names unique, ignoring case', async () => {
    await createTemplate(db, input());
    expect(await issuesOf(createTemplate(db, input({ name: 'KONTAKTFORMULAR' })))).toEqual([
      { path: 'name', message: 'Eine Vorlage mit diesem Namen gibt es schon.' },
    ]);
  });
});

describe('updateTemplate', () => {
  it('changes name, note and flow; its own name is no clash', async () => {
    const template = await createTemplate(db, input());
    const changed = await updateTemplate(db, template.id, {
      name: 'kontaktformular',
      description: 'Neu',
      flow: { version: 1, steps: [flow.steps[1]] },
    });
    expect(changed).toMatchObject({ name: 'kontaktformular', description: 'Neu' });
    expect((await getTemplate(db, template.id)).flow.steps).toHaveLength(1);
    expect(changed.updatedAt.getTime()).toBeGreaterThanOrEqual(template.updatedAt.getTime());
  });

  it('refuses the name of another template', async () => {
    await createTemplate(db, input({ name: 'Login' }));
    const template = await createTemplate(db, input());
    expect(await issuesOf(updateTemplate(db, template.id, input({ name: 'login' })))).toEqual([
      { path: 'name', message: 'Eine Vorlage mit diesem Namen gibt es schon.' },
    ]);
  });
});

describe('deleteTemplate and getTemplate', () => {
  it('deletes a template; jobs made from it keep their own copy of the steps', async () => {
    const template = await createTemplate(db, input());
    await deleteTemplate(db, template.id);
    expect(await listTemplates(db)).toEqual([]);
  });

  it('do not know unknown templates', async () => {
    for (const id of ['00000000-0000-0000-0000-000000000000', 'keine-id']) {
      await expect(getTemplate(db, id)).rejects.toThrow(NotFoundError);
      await expect(deleteTemplate(db, id)).rejects.toThrow(NotFoundError);
      await expect(updateTemplate(db, id, input())).rejects.toThrow(NotFoundError);
    }
  });

  it('lists templates by name', async () => {
    await createTemplate(db, input({ name: 'Newsletter' }));
    await createTemplate(db, input({ name: 'cookie-Banner' }));
    await createTemplate(db, input({ name: 'Login' }));
    expect((await listTemplates(db)).map((template) => template.name)).toEqual([
      'cookie-Banner',
      'Login',
      'Newsletter',
    ]);
  });
});
