import type { ConnectionCheck } from './views';

/** What testAiConnection found out, as @click-bot/ai returns it. */
export type ConnectionFindings = { models: string[] | null; modelKnown: boolean | null };

/** The line under "Verbindung testen". */
export function describeConnection(
  label: string,
  model: string,
  { models, modelKnown }: ConnectionFindings,
): ConnectionCheck {
  if (!models) return { tone: 'success', message: 'Verbindung steht.' };
  if (modelKnown === false) {
    return {
      tone: 'warning',
      message: `Verbindung steht, aber ${label} kennt das Modell „${model}“ nicht. Bitte eines aus der Liste wählen.`,
      models,
    };
  }
  if (modelKnown) {
    return {
      tone: 'success',
      message: `Verbindung steht. Das Modell „${model}“ ist verfügbar.`,
      models,
    };
  }
  const count = models.length === 1 ? '1 Modell' : `${models.length} Modelle`;
  return {
    tone: 'success',
    message: `Verbindung steht. ${count} verfügbar, Auswahl im Feld „Modell“.`,
    models,
  };
}
