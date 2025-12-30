/**
 * Test suite based on REAL bank messages
 * These are actual messages from SBI and ICICI banks
 */

import { SMSParserService } from '../smsParser.service';

describe('Real Bank Messages', () => {
  let smsParser: SMSParserService;

  beforeEach(() => {
    smsParser = new SMSParserService();
  });

  describe('SBI Account Credit (NEFT)', () => {
    it('should parse SBI NEFT salary credit correctly', async () => {
      const message = `Dear Customer, INR 93,316.00 credited to your A/c No XX0265 on 26/12/2025 through NEFT with UTR CITIN25674965960 by MIRPL-1190-SALARY PAYMENT, INFO: BATCHID:0004 SALARY PAYMENT FOR DEC 2025-SBI`;
      const sender = 'SBIIN';

      const result = await smsParser.parseSMS(message, sender);

      expect(result).toBeDefined();
      expect(result?.type).toBe('credit');
      expect(result?.amount).toBe(93316.0);
      expect(result?.merchant).toContain('Mirpl'); // Title case after normalization
      expect(result?.bankName).toBe('SBI');
      expect(result?.accountNumber).toContain('0265');
      expect(result?.date).toBeDefined();
    });
  });

  describe('SBI Credit Card Purchase', () => {
    it('should parse SBI Card purchase at BookMyShow', async () => {
      const message = `Rs.829.86 spent on your SBI Credit Card ending 3619 at BOOKMYSHOW on 13/12/25. Trxn. not done by you? Report at https://sbicard.com/Dispute`;
      const sender = 'SBICARD';

      const result = await smsParser.parseSMS(message, sender);

      expect(result).toBeDefined();
      expect(result?.type).toBe('debit');
      expect(result?.amount).toBe(829.86);
      expect(result?.merchant).toContain('Bookmyshow'); // Title case after normalization
      expect(result?.bankName).toBe('SBI');
      expect(result?.cardLast4).toBe('3619');
      expect(result?.date).toBeDefined();
    });
  });

  describe('ICICI Credit Card UPI', () => {
    it('should parse ICICI Card UPI transaction at Swiggy', async () => {
      const message = `ICICI Bank Credit Card XX5005 debited for INR 1,234.00 on 28-Dec-25 for UPI-215018029879-SWIGGY. To dispute call 18001080/SMS BLOCK 5005 to 9215676766`;
      const sender = 'ICICIB';

      const result = await smsParser.parseSMS(message, sender);

      expect(result).toBeDefined();
      expect(result?.type).toBe('debit');
      expect(result?.amount).toBe(1234.0);
      expect(result?.merchant).toContain('Swiggy'); // Title case after normalization
      expect(result?.bankName).toBe('ICICI Bank');
      expect(result?.cardLast4).toContain('5005');
      expect(result?.date).toBeDefined();
    });
  });
});
