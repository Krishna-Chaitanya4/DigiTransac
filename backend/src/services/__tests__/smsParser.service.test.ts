import { SMSParserService } from '../smsParser.service';
import { detectTransactionTags } from '../../utils/transactionTags';
import { getLearnedMapping } from '../merchantLearning.service';
import { normalizeMerchantName, matchAccount } from '../../utils/accountMatcher';
import { mongoDBService } from '../../config/mongodb';

// Mock dependencies
jest.mock('../../utils/transactionTags');
jest.mock('../merchantLearning.service');
jest.mock('../../utils/accountMatcher');
jest.mock('../../config/mongodb');

describe('SMSParserService', () => {
  let parser: SMSParserService;
  const mockUserId = 'user123';

  beforeEach(() => {
    parser = new SMSParserService();
    jest.clearAllMocks();

    // Default mock implementations
    (detectTransactionTags as jest.Mock).mockReturnValue({ tags: [], confidence: 1.0 });
    (getLearnedMapping as jest.Mock).mockResolvedValue(null);
    (normalizeMerchantName as jest.Mock).mockImplementation((name) => name);
    (matchAccount as jest.Mock).mockResolvedValue(null);
    (mongoDBService.getAccountsContainer as jest.Mock).mockResolvedValue({});
  });

  describe('HDFC Bank SMS Parsing', () => {
    it('should parse standard HDFC debit SMS with merchant', async () => {
      const sms = 'Rs.500.00 debited from A/c **1234 on 23-Dec-25 at Swiggy. Avl Bal: Rs.10000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(500);
      expect(result?.type).toBe('debit');
      expect(result?.accountNumber).toBe('1234');
      expect(result?.merchant).toContain('Swiggy');
      expect(result?.bankName).toBe('HDFC');
      expect(result?.confidence).toBe('high');
    });

    it('should parse HDFC SMS with INR prefix', async () => {
      const sms = 'INR 1250 debited from A/c XX5678 on 24-Dec-25 at Amazon Pay. Ref:TXN123456';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1250);
      expect(result?.accountNumber).toBe('5678');
      expect(result?.merchant).toContain('Amazon Pay');
      expect(result?.bankName).toBe('HDFC');
    });

    it('should parse HDFC credit SMS', async () => {
      const sms = 'Rs.5000.00 credited to A/c **1234 on 25-Dec-25';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(5000);
      expect(result?.type).toBe('credit');
      expect(result?.accountNumber).toBe('1234');
      expect(result?.bankName).toBe('HDFC');
    });

    it('should parse HDFC credit SMS with source merchant', async () => {
      const sms = 'Rs 10000 credited from SALARY on 01-Jan-26 to **1234. Avl Bal: 50000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(10000);
      expect(result?.type).toBe('credit');
      expect(result?.merchant).toContain('SALARY');
      expect(result?.accountNumber).toBe('1234');
    });

    it('should handle amount with commas', async () => {
      const sms = 'Rs.12,500.50 debited from A/c **9999 on 20-Dec-25 at Big Bazaar';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(12500.5);
    });
  });

  describe('ICICI Bank SMS Parsing', () => {
    it('should parse ICICI debit SMS', async () => {
      const sms = 'INR 850 debited from A/c XX4567 on 23-12-25 at Zomato. Bal: Rs.8000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(850);
      expect(result?.type).toBe('debit');
      expect(result?.accountNumber).toBe('4567');
      expect(result?.merchant).toContain('Zomato');
      expect(result?.bankName).toBe('ICICI');
    });

    it('should parse ICICI credit SMS', async () => {
      const sms = 'Rs 3000 credited to A/c **2345 on 22/12/25. Avl Bal: Rs.25000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(3000);
      expect(result?.type).toBe('credit');
      expect(result?.accountNumber).toBe('2345');
      expect(result?.bankName).toBe('ICICI');
    });
  });

  describe('SBI SMS Parsing', () => {
    it('should parse SBI debit SMS with merchant', async () => {
      const sms = 'Rs.600 debited from A/c ....7890 on 20/12/25 at Uber India. Bal: 15000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(600);
      expect(result?.type).toBe('debit');
      expect(result?.accountNumber).toBe('7890');
      expect(result?.merchant).toContain('Uber');
      expect(result?.bankName).toBe('SBI');
    });

    it('should parse SBI credit SMS', async () => {
      const sms = 'Rs 2000 credited to A/c ....1234 on 19/12/25';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(2000);
      expect(result?.type).toBe('credit');
      expect(result?.bankName).toBe('SBI');
    });
  });

  describe('Axis Bank SMS Parsing', () => {
    it('should parse Axis debit SMS with merchant', async () => {
      const sms = 'INR 750.00 debited from **3456 on 23Dec for PAYTM. Avl Bal: 12000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(750);
      expect(result?.type).toBe('debit');
      expect(result?.merchant).toContain('PAYTM');
      expect(result?.bankName).toBe('Axis');
    });

    it('should parse Axis debit SMS without merchant', async () => {
      const sms = 'Rs 500 debited from **3456 on 23-Dec-25';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(500);
      expect(result?.type).toBe('debit');
      expect(result?.confidence).toBe('medium'); // Lower confidence without merchant
    });

    it('should parse Axis credit SMS', async () => {
      const sms = 'INR 5000 credited to **3456 on 23-Dec-25. Balance: 20000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(5000);
      expect(result?.type).toBe('credit');
      expect(result?.bankName).toBe('Axis');
    });
  });

  describe('Kotak Bank SMS Parsing', () => {
    it('should parse Kotak debit SMS', async () => {
      const sms = 'Rs.300.00 debited from A/c **7890 on 23-12-25 at Uber. Avl: 9000';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(300);
      expect(result?.type).toBe('debit');
      expect(result?.merchant).toContain('Uber');
      expect(result?.bankName).toBe('Kotak');
    });

    it('should parse Kotak credit SMS', async () => {
      const sms = 'Rs 1000 credited to **7890 on 22-12-25';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(1000);
      expect(result?.type).toBe('credit');
      expect(result?.bankName).toBe('Kotak');
    });
  });

  describe('Date Parsing', () => {
    it('should parse DD-MMM-YY format', async () => {
      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Store';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date?.getDate()).toBe(23);
      expect(result?.date?.getMonth()).toBe(11); // December (0-indexed)
      expect(result?.date?.getFullYear()).toBe(2025);
    });

    it('should parse DD/MM/YYYY format', async () => {
      const sms = 'Rs 300 debited from ....1234 on 15/01/2025 at Shop';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date?.getDate()).toBe(15);
      expect(result?.date?.getMonth()).toBe(0); // January
      expect(result?.date?.getFullYear()).toBe(2025);
    });

    it('should handle 2-digit year conversion', async () => {
      const sms = 'Rs.100 debited from **1234 on 01-Jan-25 at Store';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.date?.getFullYear()).toBe(2025);
    });

    it('should default to current date if parsing fails', async () => {
      const sms = 'Rs.500 debited from **1234 at Store'; // No date

      const result = await parser.parseSMS(sms, mockUserId);

      const today = new Date();
      expect(result?.date?.getDate()).toBe(today.getDate());
    });
  });

  describe('Merchant Name Normalization', () => {
    it('should normalize merchant names', async () => {
      (normalizeMerchantName as jest.Mock).mockReturnValue('Swiggy');

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at SWIGGY*BANGALORE PVT LTD';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(normalizeMerchantName).toHaveBeenCalled();
      expect(result?.merchant).toBe('Swiggy');
    });
  });

  describe('Tag Detection', () => {
    it('should detect tags for transactions', async () => {
      const mockTags = { tags: ['food', 'delivery'], confidence: 0.9 };
      (detectTransactionTags as jest.Mock).mockReturnValue(mockTags);

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(detectTransactionTags).toHaveBeenCalledWith(
        'debit',
        expect.any(String),
        expect.any(String)
      );
      expect(result?.tags).toEqual(['food', 'delivery']);
    });
  });

  describe('Learned Category/Account Mapping', () => {
    it('should apply learned category for known merchant', async () => {
      (getLearnedMapping as jest.Mock).mockResolvedValue({
        categoryId: 'cat-food',
        accountId: 'acc-hdfc',
      });

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(getLearnedMapping).toHaveBeenCalledWith(mockUserId, expect.any(String));
      expect(result?.learnedCategoryId).toBe('cat-food');
      expect(result?.learnedAccountId).toBe('acc-hdfc');
    });

    it('should handle no learned mapping', async () => {
      (getLearnedMapping as jest.Mock).mockResolvedValue(null);

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at New Store';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.learnedCategoryId).toBeUndefined();
      expect(result?.learnedAccountId).toBeUndefined();
    });
  });

  describe('Account Matching', () => {
    it('should match account from SMS details', async () => {
      (matchAccount as jest.Mock).mockResolvedValue('acc-matched-123');

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(matchAccount).toHaveBeenCalledWith(
        mockUserId,
        expect.anything(),
        'HDFC',
        expect.stringContaining('1234')
      );
      expect(result?.matchedAccountId).toBe('acc-matched-123');
    });

    it('should handle account matching failure gracefully', async () => {
      (matchAccount as jest.Mock).mockRejectedValue(new Error('DB error'));

      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result).toBeTruthy(); // Should still return parsed transaction
      expect(result?.matchedAccountId).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should return null for non-transaction SMS', async () => {
      const sms = 'Your OTP is 123456. Do not share with anyone.';

      const result = await parser.parseSMS(sms);

      expect(result).toBeNull();
    });

    it('should return null for promotional SMS', async () => {
      const sms = 'Get 50% off on all items! Visit our store today.';

      const result = await parser.parseSMS(sms);

      expect(result).toBeNull();
    });

    it('should handle SMS without userId', async () => {
      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms);

      expect(result).toBeTruthy();
      expect(getLearnedMapping).not.toHaveBeenCalled();
      expect(matchAccount).not.toHaveBeenCalled();
    });

    it('should preserve original text', async () => {
      const originalSMS = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(originalSMS, mockUserId);

      expect(result?.originalText).toBe(originalSMS);
    });

    it('should handle very large amounts', async () => {
      const sms = 'Rs.1,25,000.00 debited from **1234 on 23-Dec-25 at Jewellery Store';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(125000);
    });

    it('should handle amounts without decimals', async () => {
      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Store';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.amount).toBe(500);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign high confidence with merchant and account', async () => {
      const sms = 'Rs.500 debited from **1234 on 23-Dec-25 at Swiggy';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.confidence).toBe('high');
    });

    it('should assign medium confidence without merchant', async () => {
      const sms = 'Rs.500 debited from **1234 on 23-Dec-25';

      const result = await parser.parseSMS(sms, mockUserId);

      expect(result?.confidence).toBe('medium');
    });
  });

  describe('Real-world SMS Examples', () => {
    const realSMSExamples = [
      {
        sms: 'Rs.567.89 debited from A/c XX1234 on 28-Dec-25 at SWIGGY BANGALORE. Avl Bal: Rs.12,345.67',
        expected: { amount: 567.89, type: 'debit', bank: 'HDFC', merchant: true },
      },
      {
        sms: 'INR 1250 spent on Card XX9876 at AMAZON PAY INDIA on 27-Dec-25. Reward Points: 125',
        expected: { amount: 1250, type: 'debit', merchant: true },
      },
      {
        sms: 'Rs 5000.00 credited to A/c ....5678 on 26/12/2025 from SALARY CREDIT',
        expected: { amount: 5000, type: 'credit', bank: 'SBI', merchant: true },
      },
      {
        sms: 'A/c **3456 debited INR 899 on 25-Dec for NETFLIX SUBSCRIPTION. Bal: 8765.43',
        expected: { amount: 899, type: 'debit', merchant: true },
      },
    ];

    realSMSExamples.forEach((example, index) => {
      it(`should parse real SMS example ${index + 1}`, async () => {
        const result = await parser.parseSMS(example.sms, mockUserId);

        expect(result).toBeTruthy();
        expect(result?.amount).toBe(example.expected.amount);
        expect(result?.type).toBe(example.expected.type);
        if (example.expected.merchant) {
          expect(result?.merchant).toBeTruthy();
        }
      });
    });
  });
});
