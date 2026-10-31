import { chromium, type Browser } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { createBrowserManager, type BrowserManager } from './browser-manager';

let manager: BrowserManager | undefined;

afterEach(async () => {
  await manager?.close();
  manager = undefined;
});

/** Counts the browser starts; the browsers are real Chromium. */
function countingLaunch() {
  const launched: Browser[] = [];
  return {
    launched,
    launch: async () => {
      const browser = await chromium.launch();
      launched.push(browser);
      return browser;
    },
  };
}

describe('createBrowserManager', () => {
  it('starts one browser, even when several runs ask for it at once', async () => {
    const { launched, launch } = countingLaunch();
    manager = createBrowserManager(launch);

    const [a, b] = await Promise.all([manager.get(), manager.get()]);

    expect(a).toBe(b);
    expect(launched).toHaveLength(1);
    expect(await manager.get()).toBe(a);
  });

  it('starts a new browser after the old one crashed or was closed, and says so', async () => {
    const { launched, launch } = countingLaunch();
    const messages: string[] = [];
    manager = createBrowserManager(launch, (message) => messages.push(message));
    const first = await manager.get();

    // From the outside, like a crash: the manager only learns of it through the browser.
    await first.close();
    const second = await manager.get();

    expect(second).not.toBe(first);
    expect(second.isConnected()).toBe(true);
    expect(launched).toHaveLength(2);
    expect(messages).toEqual([
      'Browser beendet oder abgestürzt. Der nächste Durchlauf startet einen neuen.',
    ]);
  });

  it('tries again after a failed start instead of keeping the error', async () => {
    let attempts = 0;
    manager = createBrowserManager(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Executable doesn’t exist');
      return chromium.launch();
    });

    await expect(manager.get()).rejects.toThrow('Executable doesn’t exist');
    await expect(manager.get()).resolves.toBeDefined();
    expect(attempts).toBe(2);
  });

  it('closes the browser on shutdown and starts no new one afterwards', async () => {
    const { launch } = countingLaunch();
    const messages: string[] = [];
    manager = createBrowserManager(launch, (message) => messages.push(message));
    const browser = await manager.get();

    await manager.close();

    expect(browser.isConnected()).toBe(false);
    await expect(manager.get()).rejects.toThrow('Der Browser wurde beendet.');
    // Closing on purpose is no crash.
    expect(messages).toEqual([]);
  });

  it('can be closed before it ever started a browser', async () => {
    manager = createBrowserManager(() => chromium.launch());
    await expect(manager.close()).resolves.toBeUndefined();
  });
});
