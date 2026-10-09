import { describe, expect, it } from 'vitest';

export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

class InvalidThing extends DomainError {
  readonly code = 'INVALID_THING';
}

describe('DomainError', () => {
  it('є звичайною помилкою JS, яку можна кинути й зловити', () => {
    const error = new InvalidThing('Щось не так');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Щось не так');
  });

  it('має машинний код і назву конкретного класу', () => {
    const error = new InvalidThing('Щось не так');

    expect(error.code).toBe('INVALID_THING');
    expect(error.name).toBe('InvalidThing');
  });

  it('зберігає першопричину', () => {
    const cause = new Error('з бази');
    const error = new InvalidThing('Щось не так', { cause });

    expect(error.cause).toBe(cause);
  });
});
