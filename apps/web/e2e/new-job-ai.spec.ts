import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';

// Never a real AI provider: a local server answers like an OpenAI-compatible API ("Custom").
const SUGGESTION = {
  steps: [
    { type: 'open', url: 'http://127.0.0.1:4100/kontakt.html' },
    { type: 'fill', target: { by: 'label', label: 'E-Mail' }, value: 'max@gmail.com' },
    { type: 'click', target: { by: 'role', role: 'button', name: 'Absenden' } },
  ],
  questions: [{ question: 'Welches Event soll geprüft werden?', options: ['generate_lead'] }],
};

let server: Server;
let requests: { messages: { content: string }[] }[] = [];

test.beforeAll(async () => {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push(JSON.parse(body));
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(SUGGESTION) } }] }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.describe('Neuer Job – Mit KI beschreiben', () => {
  test('suggests steps for a description and takes them over', async ({ page }) => {
    const { port } = server.address() as AddressInfo;
    requests = [];
    await page.goto('/einstellungen/ki');
    const custom = page.getByRole('region', { name: 'Custom', exact: true });
    await custom
      .getByRole('textbox', { name: 'Adresse der API' })
      .fill(`http://127.0.0.1:${port}/v1`);
    await custom.getByRole('combobox', { name: 'Modell' }).fill('fake-llm');
    await custom.getByRole('button', { name: 'Speichern' }).click();
    await expect(custom.getByRole('status')).toHaveText('Gespeichert.');
    await custom.getByRole('button', { name: 'Als Standard verwenden' }).click();
    await expect(custom.getByText('Standard', { exact: true })).toBeVisible();

    await page.goto('/jobs/neu');
    await page.getByRole('combobox', { name: 'Projekt' }).selectOption({ label: 'Beispiel GmbH' });
    await page.getByRole('textbox', { name: 'Job-Name' }).fill('KI-Kontakt');
    await page.getByRole('button', { name: 'Weiter' }).click();
    // The start address is asked for with the flow.
    await page
      .getByRole('textbox', { name: 'Website (Start-URL)' })
      .fill('http://127.0.0.1:4100/kontakt.html');

    await page.getByRole('button', { name: /Mit KI beschreiben/ }).click();
    await page
      .getByRole('textbox', { name: 'Was soll der Bot tun?' })
      .fill('Trage eine E-Mail ein und sende das Formular ab.');
    await page.getByRole('button', { name: 'Vorschlag erzeugen' }).click();

    const suggestion = page.getByRole('region', { name: 'Vorschlag der KI' });
    await expect(suggestion.getByRole('listitem')).toHaveCount(3);
    // The made-up address never reaches the form; test data only goes to example.com.
    await expect(suggestion).toContainText('{{faker.email}}');
    await expect(page.getByRole('region', { name: 'Rückfragen der KI' })).toContainText(
      'Welches Event soll geprüft werden?',
    );
    // No worker in the e2e setup: the suggestion says the page was not read.
    await expect(page.getByRole('region', { name: 'Seite nicht gelesen' })).toContainText(
      'Der Worker ist offline',
    );
    expect(requests[0]?.messages.at(-1)?.content).toContain(
      'Trage eine E-Mail ein und sende das Formular ab.',
    );

    await page.getByRole('button', { name: '3 Schritte übernehmen' }).click();
    await expect(
      page.getByRole('button', { name: /^Schritt 3: Klicke auf „Absenden“/ }),
    ).toBeVisible();
  });
});
