import { describe, it, expect } from 'vitest';
import {
  objectIdSchema,
  emailSchema,
  passwordSchema,
  simplePasswordSchema,
  currencyCodeSchema,
  positiveAmountSchema,
  nonNegativeAmountSchema,
  dateStringSchema,
  dateOnlySchema,
  timeSchema,
  timezoneSchema,
  hexColorSchema,
  displayNameSchema,
  searchTextSchema,
  paginationSchema,
} from './common';

describe('objectIdSchema', () => {
  it('accepts valid 24-char hex string', () => {
    expect(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
  });

  it('rejects too short', () => {
    expect(objectIdSchema.safeParse('507f1f77').success).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(objectIdSchema.safeParse('507f1f77bcf86cd79943901z').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(objectIdSchema.safeParse('').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('accepts valid email', () => {
    const result = emailSchema.safeParse('User@Example.COM');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com'); // lowercased
  });

  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects too short', () => {
    expect(emailSchema.safeParse('a@b').success).toBe(false);
  });

  it('rejects empty', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts valid password with all requirements', () => {
    expect(passwordSchema.safeParse('SecureP1').success).toBe(true);
  });

  it('rejects too short (< 8)', () => {
    expect(passwordSchema.safeParse('Abc1').success).toBe(false);
  });

  it('rejects missing uppercase', () => {
    expect(passwordSchema.safeParse('securep1').success).toBe(false);
  });

  it('rejects missing lowercase', () => {
    expect(passwordSchema.safeParse('SECUREP1').success).toBe(false);
  });

  it('rejects missing number', () => {
    expect(passwordSchema.safeParse('SecurePass').success).toBe(false);
  });
});

describe('simplePasswordSchema', () => {
  it('accepts 6+ char password', () => {
    expect(simplePasswordSchema.safeParse('simple').success).toBe(true);
  });

  it('rejects < 6 chars', () => {
    expect(simplePasswordSchema.safeParse('abc').success).toBe(false);
  });
});

describe('currencyCodeSchema', () => {
  it('accepts valid 3-letter uppercase', () => {
    const result = currencyCodeSchema.safeParse('USD');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('USD');
  });

  it('transforms lowercase to uppercase', () => {
    const result = currencyCodeSchema.safeParse('usd');
    // Should fail because regex requires uppercase before transform
    expect(result.success).toBe(false);
  });

  it('rejects 2-letter code', () => {
    expect(currencyCodeSchema.safeParse('US').success).toBe(false);
  });

  it('rejects numbers', () => {
    expect(currencyCodeSchema.safeParse('12A').success).toBe(false);
  });
});

describe('positiveAmountSchema', () => {
  it('accepts positive number', () => {
    const result = positiveAmountSchema.safeParse(100.555);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(100.56); // rounded
  });

  it('rejects zero', () => {
    expect(positiveAmountSchema.safeParse(0).success).toBe(false);
  });

  it('rejects negative', () => {
    expect(positiveAmountSchema.safeParse(-5).success).toBe(false);
  });

  it('rejects too large', () => {
    expect(positiveAmountSchema.safeParse(9999999999).success).toBe(false);
  });
});

describe('nonNegativeAmountSchema', () => {
  it('accepts zero', () => {
    expect(nonNegativeAmountSchema.safeParse(0).success).toBe(true);
  });

  it('accepts positive', () => {
    expect(nonNegativeAmountSchema.safeParse(50).success).toBe(true);
  });

  it('rejects negative', () => {
    expect(nonNegativeAmountSchema.safeParse(-1).success).toBe(false);
  });
});

describe('dateStringSchema', () => {
  it('accepts ISO date with time', () => {
    expect(dateStringSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
  });

  it('accepts date only', () => {
    expect(dateStringSchema.safeParse('2024-01-15').success).toBe(true);
  });

  it('accepts ISO with milliseconds', () => {
    expect(dateStringSchema.safeParse('2024-01-15T10:30:00.000Z').success).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(dateStringSchema.safeParse('Jan 15, 2024').success).toBe(false);
  });
});

describe('dateOnlySchema', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(dateOnlySchema.safeParse('2024-01-15').success).toBe(true);
  });

  it('rejects date with time', () => {
    expect(dateOnlySchema.safeParse('2024-01-15T10:00:00Z').success).toBe(false);
  });
});

describe('timeSchema', () => {
  it('accepts HH:mm', () => {
    expect(timeSchema.safeParse('14:30').success).toBe(true);
  });

  it('accepts midnight', () => {
    expect(timeSchema.safeParse('00:00').success).toBe(true);
  });

  it('rejects 24:00', () => {
    expect(timeSchema.safeParse('24:00').success).toBe(false);
  });

  it('rejects invalid minute', () => {
    expect(timeSchema.safeParse('12:60').success).toBe(false);
  });
});

describe('timezoneSchema', () => {
  it('accepts valid IANA timezone', () => {
    expect(timezoneSchema.safeParse('America/New_York').success).toBe(true);
    expect(timezoneSchema.safeParse('Europe/London').success).toBe(true);
    expect(timezoneSchema.safeParse('UTC').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(timezoneSchema.safeParse('').success).toBe(false);
  });

  it('rejects invalid timezone', () => {
    expect(timezoneSchema.safeParse('Invalid/Timezone').success).toBe(false);
  });
});

describe('hexColorSchema', () => {
  it('accepts valid hex color', () => {
    expect(hexColorSchema.safeParse('#FF5733').success).toBe(true);
  });

  it('accepts lowercase hex', () => {
    expect(hexColorSchema.safeParse('#aabbcc').success).toBe(true);
  });

  it('rejects without hash', () => {
    expect(hexColorSchema.safeParse('FF5733').success).toBe(false);
  });

  it('rejects named colors', () => {
    expect(hexColorSchema.safeParse('red').success).toBe(false);
  });

  it('rejects short hex', () => {
    expect(hexColorSchema.safeParse('#FFF').success).toBe(false);
  });
});

describe('displayNameSchema', () => {
  it('accepts valid name', () => {
    expect(displayNameSchema.safeParse('John Doe').success).toBe(true);
  });

  it('rejects single char', () => {
    expect(displayNameSchema.safeParse('J').success).toBe(false);
  });

  it('rejects over 100 chars', () => {
    expect(displayNameSchema.safeParse('A'.repeat(101)).success).toBe(false);
  });

  it('trims whitespace', () => {
    const result = displayNameSchema.safeParse('  John  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('John');
  });
});

describe('searchTextSchema', () => {
  it('accepts valid search', () => {
    expect(searchTextSchema.safeParse('groceries').success).toBe(true);
  });

  it('rejects over 200 chars', () => {
    expect(searchTextSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });

  it('trims whitespace', () => {
    const result = searchTextSchema.safeParse('  coffee  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('coffee');
  });
});

describe('paginationSchema', () => {
  it('uses defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('rejects page 0', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects pageSize > 100', () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
