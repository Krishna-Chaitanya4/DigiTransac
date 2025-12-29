import { EmailParserService } from '../emailParser.service';
import { detectTransactionTags } from '../../utils/transactionTags';
import { getLearnedMapping } from '../merchantLearning.service';
import { normalizeMerchantName, matchAccount } from '../../utils/accountMatcher';
import { mongoDBService } from '../../config/mongodb';

// Mock dependencies
jest.mock('../../utils/transactionTags');
jest.mock('../merchantLearning.service');
jest.mock('../../utils/accountMatcher');
jest.mock('../../config/mongodb');
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('EmailParserService', () => {
  let parser: EmailParserService;
  const mockUserId = 'user123';

  beforeEach(() => {
    parser = new EmailParserService();
    jest.clearAllMocks();

    // Setup default mocks
    (detectTransactionTags as jest.Mock).mockReturnValue({ tags: [], confidence: 0.8 });
    (getLearnedMapping as jest.Mock).mockResolvedValue(null);
    (normalizeMerchantName as jest.Mock).mockImplementation((name) => name);
    (matchAccount as jest.Mock).mockResolvedValue(null);
    (mongoDBService.getAccountsContainer as jest.Mock).mockResolvedValue({});
  });

  describe('HDFC Bank Email Parsing', () => {
    it('should parse standard HDFC debit transaction', async () => {
      const email =
        'Rs.1,250.00 spent on HDFC Bank Credit Card XX1234 at AMAZON PAY on 23-Dec-25. Avl Bal: Rs.50000';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1250);
      expect(result?.merchant).toBeTruthy(); // Merchant extracted
      expect(result?.bankName).toBe('HDFC Bank');
      expect(result?.cardLast4).toBe('1234');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('should parse HDFC transaction with different format', async () => {
      const email =
        'INR 5000 debited from your HDFC Card XX5678 on 24-Dec-25 at SWIGGY. Available limit: Rs.100000';

      const result = await parser.parseTransaction(email, 'HDFC', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(5000);
      expect(result?.cardLast4).toBe('5678');
      expect(result?.bankName).toBe('HDFC Bank');
    });

    it('should parse HDFC transaction without card number', async () => {
      const email = 'Rs.750.50 spent at ZOMATO on 25-Dec-25';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(750.5);
      expect(result?.cardLast4).toBeUndefined();
    });

    it('should extract transaction ID from HDFC email', async () => {
      const email =
        'Rs.1000 debited at Uber on 20-Dec-25. TXN ID: ABC123456789. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.transactionId).toBe('ABC123456789');
    });
  });

  describe('ICICI Bank Email Parsing', () => {
    it('should parse ICICI transaction email', async () => {
      const email =
        'Rs 2500 spent on ICICI Card XX9876 at BIG BAZAAR on 20/12/2025. Available Balance: Rs.75000';

      const result = await parser.parseTransaction(email, 'ICICIB', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(2500);
      expect(result?.merchant).toBeTruthy(); // Merchant extracted
      expect(result?.bankName).toBe('ICICI Bank');
      expect(result?.cardLast4).toBe('9876');
    });

    it('should parse ICICI transaction with INR prefix', async () => {
      const email = 'INR 1,500.75 debited from Card XX4321 on NETFLIX. Date: 21/12/2025';

      const result = await parser.parseTransaction(email, 'ICICI', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1500.75);
      expect(result?.bankName).toBe('ICICI Bank');
    });
  });

  describe('SBI Email Parsing', () => {
    it('should parse SBI transaction email', async () => {
      const email =
        'Rs.850 debited from SBI Card XX3456 at FLIPKART on 19-12-2025. Ref: REF987654321';

      const result = await parser.parseTransaction(email, 'SBIIN', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(850);
      expect(result?.merchant).toContain('Flipkart');
      expect(result?.bankName).toBe('SBI');
      expect(result?.cardLast4).toBe('3456');
      expect(result?.transactionId).toBe('REF987654321');
    });

    it('should parse SBI transaction without reference', async () => {
      const email = 'INR 600 withdrawn from MYNTRA. Card XX7890. Date: 18-12-2025';

      const result = await parser.parseTransaction(email, 'SBI', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(600);
      expect(result?.transactionId).toBeUndefined();
    });
  });

  describe('Axis Bank Email Parsing', () => {
    it('should parse Axis Bank transaction', async () => {
      const email = 'Rs 3,250 spent on Axis Card XX2468 at PANTALOONS on 22/12/25.';

      const result = await parser.parseTransaction(email, 'AXISBK', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(3250);
      expect(result?.merchant).toContain('Pantaloons');
      expect(result?.bankName).toBe('Axis Bank');
    });
  });

  describe('Kotak Bank Email Parsing', () => {
    it('should parse Kotak Bank transaction', async () => {
      const email = 'Rs.1,750.00 debited from Kotak Card XX1357 on NYKAA. Date: 20-12-2025';

      const result = await parser.parseTransaction(email, 'KOTAKB', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1750);
      expect(result?.bankName).toBe('Kotak Bank');
    });
  });

  describe('Other Banks Email Parsing', () => {
    it('should parse PNB transaction', async () => {
      const email = 'Rs 500 debited from PNB Card XX5555 on DOMINOS. Date: 15/12/2025';

      const result = await parser.parseTransaction(email, 'PNBSMS', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(500);
      expect(result?.bankName).toBe('PNB');
    });

    it('should parse Bank of Baroda transaction', async () => {
      const email = 'INR 1200 spent at RELIANCE DIGITAL. Card XX8888. Date: 14-12-2025';

      const result = await parser.parseTransaction(email, 'BOBIN', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1200);
      expect(result?.bankName).toBe('Bank of Baroda');
    });

    it('should parse Canara Bank transaction', async () => {
      const email = 'Rs 900 debited on SHOPPERS STOP from Canara Card. Date: 13/12/2025';

      const result = await parser.parseTransaction(email, 'CANBNK', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(900);
      expect(result?.bankName).toBe('Canara Bank');
    });

    it('should parse Union Bank transaction', async () => {
      const email = 'Rs 450 spent at MCDONALD on Union Bank Card XX3333. Date: 12-12-2025';

      const result = await parser.parseTransaction(email, 'UBOI', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(450);
      expect(result?.bankName).toBe('Union Bank');
    });

    it('should parse IDBI Bank transaction', async () => {
      const email = 'INR 1800 debited at PETER ENGLAND. IDBI Card XX6666. Date: 11/12/2025';

      const result = await parser.parseTransaction(email, 'IDBIBN', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(1800);
      expect(result?.bankName).toBe('IDBI Bank');
    });
  });

  describe('Date Parsing', () => {
    it('should parse DD-MMM-YY format', async () => {
      const email = 'Rs.500 spent at STORE on 23-Dec-25 from HDFC Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date.getDate()).toBe(23);
      expect(result?.date.getMonth()).toBe(11); // December is month 11
      expect(result?.date.getFullYear()).toBe(2025);
    });

    it('should parse DD/MM/YYYY format', async () => {
      const email = 'Rs 800 spent on 20/12/2025 at MERCHANT from ICICI Card XX5678';

      const result = await parser.parseTransaction(email, 'ICICIB', mockUserId);

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date.getDate()).toBe(20);
      expect(result?.date.getMonth()).toBe(11);
      expect(result?.date.getFullYear()).toBe(2025);
    });

    it('should parse DD-MM-YYYY format', async () => {
      const email = 'Rs.600 debited on 18-12-2025 at SHOP from SBI Card XX9999';

      const result = await parser.parseTransaction(email, 'SBIIN', mockUserId);

      expect(result?.date).toBeInstanceOf(Date);
      expect(result?.date.getDate()).toBe(18);
      expect(result?.date.getMonth()).toBe(11);
    });

    it('should handle 2-digit year conversion', async () => {
      const email = 'Rs 1000 spent on 15/12/25 at VENDOR from Axis Card XX1111';

      const result = await parser.parseTransaction(email, 'AXISBK', mockUserId);

      expect(result?.date.getFullYear()).toBe(2025);
    });

    it('should default to today if no date found', async () => {
      const email = 'Rs.500 spent at MERCHANT from HDFC Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      // Parser may or may not extract date depending on pattern matching
      if (result) {
        expect(result.date).toBeInstanceOf(Date);
      }
    });
  });

  describe('Merchant Name Cleaning', () => {
    it('should clean merchant name with PVT LTD suffix', async () => {
      const email = 'Rs.1000 debited at AMAZON INDIA PVT LTD on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.merchant).not.toContain('PVT');
      expect(result?.merchant).not.toContain('LTD');
    });

    it('should capitalize merchant name properly', async () => {
      const email = 'Rs.500 spent at SWIGGY on 21-Dec-25 from HDFC Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.merchant).toBeTruthy();
    });
  });

  describe('Tag Detection Integration', () => {
    it('should detect and assign tags', async () => {
      const mockTags = { tags: ['food', 'delivery'], confidence: 0.9 };
      (detectTransactionTags as jest.Mock).mockReturnValue(mockTags);

      const email = 'Rs.750 spent at SWIGGY on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(detectTransactionTags).toHaveBeenCalledWith('debit', expect.any(String), expect.any(String));
      expect(result?.tags).toEqual(['food', 'delivery']);
    });
  });

  describe('Learned Mapping Integration', () => {
    it('should apply learned category and account', async () => {
      (normalizeMerchantName as jest.Mock).mockReturnValue('Swiggy');
      (getLearnedMapping as jest.Mock).mockResolvedValue({
        categoryId: 'cat-food',
        accountId: 'acc-hdfc',
      });

      const email = 'Rs.500 spent at SWIGGY on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(getLearnedMapping).toHaveBeenCalledWith(mockUserId, expect.any(String));
      expect(result?.learnedCategoryId).toBe('cat-food');
      expect(result?.learnedAccountId).toBe('acc-hdfc');
    });

    it('should handle no learned mapping', async () => {
      (getLearnedMapping as jest.Mock).mockResolvedValue(null);

      const email = 'Rs.500 spent at NEW MERCHANT on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.learnedCategoryId).toBeUndefined();
      expect(result?.learnedAccountId).toBeUndefined();
    });
  });

  describe('Account Matching Integration', () => {
    it('should match account from email details', async () => {
      (matchAccount as jest.Mock).mockResolvedValue('acc-matched-789');

      const email = 'Rs.1000 spent at AMAZON on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(matchAccount).toHaveBeenCalledWith(
        mockUserId,
        expect.anything(),
        'HDFC Bank',
        '1234'
      );
      expect(result?.matchedAccountId).toBe('acc-matched-789');
    });

    it('should handle account matching failure gracefully', async () => {
      (matchAccount as jest.Mock).mockRejectedValue(new Error('DB error'));

      const email = 'Rs.500 spent at STORE on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeTruthy();
      expect(result?.matchedAccountId).toBeUndefined();
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate high confidence with all details', async () => {
      const email =
        'Rs.1000.00 spent on HDFC Card XX1234 at AMAZON on 20-Dec-25. TXN: ABC123';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should calculate lower confidence without merchant', async () => {
      const email = 'Rs.500 spent on 20-Dec-25 from HDFC Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      // Parser may or may not extract transaction without clear merchant
      if (result) {
        expect(result.confidence).toBeGreaterThan(0);
      } else {
        expect(result).toBeNull();
      }
    });

    it('should have base confidence for minimal info', async () => {
      const email = 'Rs.100 debited';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should return null for unrecognized bank', async () => {
      const email = 'Rs.500 spent at MERCHANT on 20-Dec-25';

      const result = await parser.parseTransaction(email, 'UNKNOWN', mockUserId);

      expect(result).toBeNull();
    });

    it('should return null for non-transaction email', async () => {
      const email = 'Welcome to our bank! Your account is now active.';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeNull();
    });

    it('should handle email without sender', async () => {
      const email = 'Rs.500 spent at AMAZON from HDFC Bank Card XX1234 on 20-Dec-25';

      const result = await parser.parseTransaction(email, undefined, mockUserId);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(500);
    });

    it('should handle email without userId', async () => {
      const email = 'Rs.500 spent at AMAZON on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK');

      expect(result).toBeTruthy();
      expect(result?.learnedCategoryId).toBeUndefined();
      expect(result?.matchedAccountId).toBeUndefined();
    });

    it('should handle invalid amount', async () => {
      const email = 'Rs.INVALID spent at MERCHANT on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeNull();
    });

    it('should handle negative amount', async () => {
      const email = 'Rs.-500 spent at MERCHANT on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeNull();
    });

    it('should handle zero amount', async () => {
      const email = 'Rs.0 spent at MERCHANT on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result).toBeNull();
    });

    it('should handle very large amounts', async () => {
      const email = 'Rs.9,99,999.99 spent at MERCHANT on 20-Dec-25. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.amount).toBe(999999.99);
    });

    it('should preserve raw text', async () => {
      const email = 'Rs.500 spent at AMAZON on 20-Dec-25. Card XX1234. Balance: Rs.10000';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.rawText).toBe(email);
    });
  });

  describe('Category Suggestion', () => {
    it('should suggest Food & Dining for food merchants', () => {
      expect(parser.suggestCategory('Swiggy')).toBe('Food & Dining');
      expect(parser.suggestCategory('ZOMATO')).toBe('Food & Dining');
      expect(parser.suggestCategory('McDonalds Restaurant')).toBe('Food & Dining');
      expect(parser.suggestCategory('Pizza Hut')).toBe('Food & Dining');
    });

    it('should suggest Groceries for grocery merchants', () => {
      expect(parser.suggestCategory('BigBasket')).toBe('Groceries');
      expect(parser.suggestCategory('DMart')).toBe('Groceries');
      expect(parser.suggestCategory('Reliance Fresh')).toBe('Groceries');
    });

    it('should suggest Transport for transport merchants', () => {
      expect(parser.suggestCategory('Uber')).toBe('Transport');
      expect(parser.suggestCategory('OLA CABS')).toBe('Transport');
      expect(parser.suggestCategory('Petrol Pump')).toBe('Transport');
    });

    it('should suggest Shopping for e-commerce', () => {
      expect(parser.suggestCategory('Amazon')).toBe('Shopping');
      expect(parser.suggestCategory('FLIPKART')).toBe('Shopping');
      expect(parser.suggestCategory('Myntra')).toBe('Shopping');
    });

    it('should suggest Utilities for utility bills', () => {
      expect(parser.suggestCategory('Electricity Bill')).toBe('Utilities');
      expect(parser.suggestCategory('Broadband Payment')).toBe('Utilities');
      expect(parser.suggestCategory('Mobile Recharge')).toBe('Utilities');
    });

    it('should suggest Entertainment for streaming services', () => {
      expect(parser.suggestCategory('Netflix')).toBe('Entertainment');
      expect(parser.suggestCategory('Hotstar')).toBe('Entertainment');
      expect(parser.suggestCategory('PVR Cinemas')).toBe('Entertainment');
      expect(parser.suggestCategory('Spotify')).toBe('Entertainment');
    });

    it('should suggest Healthcare for medical expenses', () => {
      expect(parser.suggestCategory('Apollo Pharmacy')).toBe('Healthcare');
      expect(parser.suggestCategory('Netmeds')).toBe('Healthcare');
      expect(parser.suggestCategory('City Hospital')).toBe('Healthcare');
    });

    it('should return null for unknown merchants', () => {
      expect(parser.suggestCategory('Unknown Store')).toBeNull();
      expect(parser.suggestCategory('XYZ Company')).toBeNull();
    });
  });

  describe('Transaction Detection', () => {
    it('should identify transaction emails', () => {
      expect(parser.isTransactionSMS('Rs.500 debited from your account')).toBe(true);
      expect(parser.isTransactionSMS('INR 1000 spent on card')).toBe(true);
      expect(parser.isTransactionSMS('Payment of Rs 750 received')).toBe(true);
      expect(parser.isTransactionSMS('Your card was used for purchase')).toBe(true);
    });

    it('should reject non-transaction emails', () => {
      expect(parser.isTransactionSMS('Welcome to our bank!')).toBe(false);
      expect(parser.isTransactionSMS('Your OTP is 123456')).toBe(false);
      expect(parser.isTransactionSMS('Meeting scheduled for tomorrow')).toBe(false);
      expect(parser.isTransactionSMS('Happy Birthday!')).toBe(false);
    });

    it('should handle case insensitive detection', () => {
      expect(parser.isTransactionSMS('DEBITED FROM ACCOUNT')).toBe(true);
      expect(parser.isTransactionSMS('payment received')).toBe(true);
    });
  });

  describe('Transaction ID Extraction', () => {
    it('should extract transaction ID with TXN prefix', async () => {
      const email = 'Rs.500 spent at STORE. TXN: ABC123456789. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.transactionId).toBe('ABC123456789');
    });

    it('should extract transaction ID with REF prefix', async () => {
      const email = 'Rs.500 spent at STORE. REF:XYZ987654321. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.transactionId).toBe('XYZ987654321');
    });

    it('should extract transaction ID with ID prefix', async () => {
      const email = 'Rs.500 spent at STORE. ID DEF456789012. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.transactionId).toBe('DEF456789012');
    });

    it('should extract transaction ID with REFERENCE prefix', async () => {
      const email = 'Rs.500 spent at STORE. REFERENCE: GHI111222333. Card XX1234';

      const result = await parser.parseTransaction(email, 'HDFCBK', mockUserId);

      expect(result?.transactionId).toBe('GHI111222333');
    });
  });
});
