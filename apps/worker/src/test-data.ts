import { Faker, base, de, en } from '@faker-js/faker';

export const TEST_DATA_KEYS = [
  'firstName',
  'lastName',
  'name',
  'email',
  'phone',
  'company',
  'street',
  'zip',
  'city',
  'sentence',
] as const;

export type TestDataKey = (typeof TEST_DATA_KEYS)[number];

/**
 * Fake person data for `{{faker.*}}`. All values are generated up front in a fixed order, so
 * they do not depend on which variables a flow uses or in which order. Seeded by run and bot:
 * a rerun reproduces the same data, the bots of one wave get different data.
 */
export function createTestData(runNr: number, botNr: number): (key: string) => string | undefined {
  const faker = new Faker({ locale: [de, en, base] });
  faker.seed(runNr * 10_000 + botNr);

  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const values: Record<TestDataKey, string> = {
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    // exampleEmail only uses example.com/.org/.net, which can never reach a real inbox.
    email: faker.internet.exampleEmail({ firstName, lastName }).toLowerCase(),
    phone: faker.phone.number(),
    company: faker.company.name(),
    street: faker.location.streetAddress(),
    zip: faker.location.zipCode(),
    city: faker.location.city(),
    sentence: faker.lorem.sentence(),
  };

  return (key) => (Object.hasOwn(values, key) ? values[key as TestDataKey] : undefined);
}
