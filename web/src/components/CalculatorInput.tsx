import { useState, useEffect, useRef } from 'react';

interface CalculatorInputProps {
  value: number;
  onChange: (value: number) => void;
  /** Currency symbol to display (e.g., '$', '₹', '€') */
  currency: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Accessible label for the input */
  ariaLabel?: string;
  /** ID for label association */
  id?: string;
  /** Expression text to set in the input (controlled externally) */
  expressionInput?: string;
  /** Called when expression input is consumed */
  onExpressionInputConsumed?: () => void;
}

// Safe recursive-descent math expression parser (supports +, -, *, /, parentheses)
// No eval(), no new Function() — immune to code injection
function evaluateExpression(expression: string): number | null {
  const cleaned = expression.replace(/\s/g, '');
  
  // Only allow digits, operators, decimal points, and parentheses
  if (!/^[\d+\-*/().]+$/.test(cleaned) || !cleaned) {
    return null;
  }
  
  let pos = 0;

  function peek(): string { return cleaned[pos] ?? ''; }
  function consume(): string { return cleaned[pos++]; }

  // Grammar: expr = term (('+' | '-') term)*
  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  // factor = '(' expr ')' | number | unary- factor
  function parseFactor(): number {
    if (peek() === '(') {
      consume(); // '('
      const val = parseExpr();
      if (peek() === ')') consume(); // ')'
      return val;
    }
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseNumber(): number {
    const start = pos;
    while (pos < cleaned.length && (cleaned[pos] >= '0' && cleaned[pos] <= '9' || cleaned[pos] === '.')) {
      pos++;
    }
    if (pos === start) return NaN;
    return parseFloat(cleaned.slice(start, pos));
  }

  try {
    const result = parseExpr();
    // Ensure entire input was consumed (no trailing garbage)
    if (pos !== cleaned.length) return null;
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export function CalculatorInput({
  value,
  onChange,
  currency,
  placeholder = '0.00',
  className = '',
  disabled = false,
  autoFocus = false,
  ariaLabel,
  id,
  expressionInput,
  onExpressionInputConsumed,
}: CalculatorInputProps) {
  const [inputValue, setInputValue] = useState(value > 0 ? value.toString() : '');
  const [isExpression, setIsExpression] = useState(false);
  const [evaluatedValue, setEvaluatedValue] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track the last consumed expression to prevent race condition with value reset effect
  const lastExpressionRef = useRef<string | null>(null);

  // Handle external expression input (from quick buttons)
  useEffect(() => {
    if (expressionInput) {
      // Store the expression so we don't clear it in the value effect
      lastExpressionRef.current = expressionInput;
      setInputValue(expressionInput);
      setIsExpression(true);
      const result = evaluateExpression(expressionInput);
      setEvaluatedValue(result);
      inputRef.current?.focus();
      // Notify parent that we consumed the expression
      if (onExpressionInputConsumed) {
        onExpressionInputConsumed();
      }
    }
  }, [expressionInput, onExpressionInputConsumed]);

  // Update input when external value changes
  useEffect(() => {
    if (value > 0 && !isExpression) {
      setInputValue(value.toString());
      lastExpressionRef.current = null; // Clear after successful value set
    } else if (value === 0 && !isExpression && !lastExpressionRef.current) {
      // Only clear input if we didn't just receive an expression
      setInputValue('');
      setEvaluatedValue(null);
    }
  }, [value, isExpression]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Check if this is a math expression
    const hasOperator = /[+\-*/]/.test(newValue);
    setIsExpression(hasOperator);
    
    if (hasOperator) {
      // Evaluate the expression for preview
      const result = evaluateExpression(newValue);
      setEvaluatedValue(result);
    } else {
      setEvaluatedValue(null);
      // Parse as plain number
      const numValue = parseFloat(newValue);
      if (!isNaN(numValue) && numValue >= 0) {
        onChange(numValue);
      } else if (newValue === '' || newValue === '0') {
        onChange(0);
      }
    }
  };

  const handleBlur = () => {
    if (isExpression && evaluatedValue !== null) {
      // Apply the calculated result
      setInputValue(evaluatedValue.toString());
      setIsExpression(false);
      setEvaluatedValue(null);
      onChange(evaluatedValue);
    } else if (!inputValue) {
      onChange(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isExpression && evaluatedValue !== null) {
      e.preventDefault();
      setInputValue(evaluatedValue.toString());
      setIsExpression(false);
      setEvaluatedValue(null);
      onChange(evaluatedValue);
    }
    
    // Allow: backspace, delete, tab, escape, enter, decimal point
    if ([8, 46, 9, 27, 13, 110, 190].includes(e.keyCode)) return;
    
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && [65, 67, 86, 88].includes(e.keyCode)) return;
    
    // Allow: home, end, left, right
    if ([35, 36, 37, 39].includes(e.keyCode)) return;
    
    // Allow: numbers, operators, parentheses
    if (!/[\d+\-*/().]/i.test(e.key)) {
      e.preventDefault();
    }
  };

  const inputId = id || 'calculator-input';
  const errorId = `${inputId}-error`;
  const previewId = `${inputId}-preview`;
  const hasError = isExpression && evaluatedValue === null && inputValue.length > 1;

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
        <span className="text-gray-500 dark:text-gray-400">{currency}</span>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        inputMode="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || 'Amount'}
        aria-invalid={hasError}
        aria-describedby={isExpression ? (hasError ? errorId : previewId) : undefined}
        className={`block w-full pl-8 pr-4 py-2 border rounded-lg 
          ${isExpression ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'}
          bg-white dark:bg-gray-700 
          text-gray-900 dark:text-gray-100
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
          text-lg font-mono`}
      />
      
      {/* Expression result preview */}
      {isExpression && evaluatedValue !== null && (
        <div 
          id={previewId}
          className="absolute right-2 top-1/2 -translate-y-1/2 
          bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 
          px-2 py-0.5 rounded text-sm font-medium"
          aria-live="polite"
        >
          = {currency}{evaluatedValue.toFixed(2)}
        </div>
      )}
      
      {/* Expression error indicator */}
      {hasError && (
        <div 
          id={errorId}
          className="absolute right-2 top-1/2 -translate-y-1/2 
          text-red-500 dark:text-red-400 text-sm"
          role="alert"
        >
          Invalid expression
        </div>
      )}
    </div>
  );
}

// Quick amount buttons component
interface QuickAmountButtonsProps {
  amounts: number[];
  onSelect: (amount: number) => void;
  /** Called when an expression button is clicked (e.g., "45/3") */
  onExpressionClick?: (expression: string) => void;
  currency: string;
  /** Show calculator expression example button */
  showCalcExample?: boolean;
}

export function QuickAmountButtons({
  amounts,
  onSelect,
  onExpressionClick,
  currency,
  showCalcExample = true,
}: QuickAmountButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className="px-3 py-1 text-sm rounded-full
            bg-gray-100 dark:bg-gray-700
            text-gray-700 dark:text-gray-300
            hover:bg-gray-200 dark:hover:bg-gray-600
            transition-colors"
        >
          {currency}{amount}
        </button>
      ))}
      
      {/* Calculator expression example - same styling as other buttons */}
      {showCalcExample && onExpressionClick && (
        <button
          type="button"
          onClick={() => onExpressionClick('45/3')}
          className="px-3 py-1 text-sm rounded-full
            bg-gray-100 dark:bg-gray-700
            text-gray-700 dark:text-gray-300
            hover:bg-gray-200 dark:hover:bg-gray-600
            transition-colors"
        >
          {currency}45/3
        </button>
      )}
    </div>
  );
}
