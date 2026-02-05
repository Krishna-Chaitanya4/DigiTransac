import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker, DateRangePicker } from './DatePicker';

describe('DatePicker', () => {
  beforeEach(() => {
    // Mock current date to January 21, 2026
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 21));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render with placeholder when no value', () => {
      render(<DatePicker placeholder="Select a date" />);
      expect(screen.getByText('Select a date')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<DatePicker label="Date" />);
      expect(screen.getByText('Date')).toBeInTheDocument();
    });

    it('should render formatted date when value is provided', () => {
      render(<DatePicker value="2026-01-15" />);
      expect(screen.getByText('15 Jan 2026')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<DatePicker disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Calendar Opening/Closing', () => {
    it('should open calendar on click', () => {
      render(<DatePicker />);
      const trigger = screen.getByRole('button');
      
      fireEvent.click(trigger);
      
      expect(screen.getByText('January')).toBeInTheDocument();
      expect(screen.getByText('2026')).toBeInTheDocument();
    });

    it('should close calendar when clicking outside', () => {
      render(
        <div>
          <DatePicker />
          <button data-testid="outside">Outside</button>
        </div>
      );
      
      const buttons = screen.getAllByRole('button');
      const trigger = buttons[0]; // First button is the DatePicker trigger
      fireEvent.click(trigger);
      
      expect(screen.getByText('January')).toBeInTheDocument();
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      
      expect(screen.queryByText('Su')).not.toBeInTheDocument();
    });

    it('should close calendar on Escape key', () => {
      render(<DatePicker />);
      const trigger = screen.getByRole('button');
      
      fireEvent.click(trigger);
      expect(screen.getByText('January')).toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.queryByText('Su')).not.toBeInTheDocument();
    });
  });

  describe('Date Selection', () => {
    it('should call onChange when a date is selected', () => {
      const onChange = vi.fn();
      render(<DatePicker onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day15 = screen.getByRole('button', { name: '15' });
      fireEvent.click(day15);
      
      expect(onChange).toHaveBeenCalledWith('2026-01-15');
    });

    it('should close calendar after selecting a date', () => {
      const onChange = vi.fn();
      render(<DatePicker onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day10 = screen.getByRole('button', { name: '10' });
      fireEvent.click(day10);
      
      // Calendar should close after selecting a date
      expect(screen.queryByText('Su')).not.toBeInTheDocument();
    });

    it('should show selected date highlighted', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day15 = screen.getByRole('button', { name: '15' });
      expect(day15).toHaveClass('bg-blue-500');
    });

    it('should highlight today with ring', () => {
      render(<DatePicker />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const today = screen.getByRole('button', { name: '21' });
      expect(today).toHaveClass('ring-1');
    });
  });

  describe('Month Navigation', () => {
    it('should navigate to previous month', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const prevButton = screen.getByLabelText('Previous month');
      fireEvent.click(prevButton);
      
      expect(screen.getByText('December')).toBeInTheDocument();
    });

    it('should navigate to next month', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const nextButton = screen.getByLabelText('Next month');
      fireEvent.click(nextButton);
      
      expect(screen.getByText('February')).toBeInTheDocument();
    });

    it('should change month via dropdown', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const monthSelect = screen.getByRole('combobox');
      fireEvent.change(monthSelect, { target: { value: '5' } }); // June
      
      expect(screen.getByDisplayValue('June')).toBeInTheDocument();
    });
  });

  describe('Year Navigation', () => {
    it('should open year picker on year click', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const yearButton = screen.getByText('2026');
      fireEvent.click(yearButton);
      
      // Year picker should show multiple years
      expect(screen.getByRole('button', { name: '2025' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2024' })).toBeInTheDocument();
    });

    it('should change year when selected from picker', () => {
      render(<DatePicker value="2026-01-15" />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const yearButton = screen.getByText('2026');
      fireEvent.click(yearButton);
      
      const year2025 = screen.getByRole('button', { name: '2025' });
      fireEvent.click(year2025);
      
      // Year picker should close and view should update to 2025
      // The month dropdown should now show January 2025
      expect(screen.queryByRole('button', { name: '2024' })).not.toBeInTheDocument();
    });
  });

  describe('Date Constraints', () => {
    it('should disable dates before minDate', () => {
      render(<DatePicker minDate={new Date(2026, 0, 15)} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day10 = screen.getByRole('button', { name: '10' });
      expect(day10).toBeDisabled();
      expect(day10).toHaveClass('cursor-not-allowed');
    });

    it('should disable dates after maxDate', () => {
      render(<DatePicker maxDate={new Date(2026, 0, 15)} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day20 = screen.getByRole('button', { name: '20' });
      expect(day20).toBeDisabled();
      expect(day20).toHaveClass('cursor-not-allowed');
    });

    it('should not call onChange when clicking disabled date', () => {
      const onChange = vi.fn();
      render(<DatePicker onChange={onChange} maxDate={new Date(2026, 0, 15)} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const day20 = screen.getByRole('button', { name: '20' });
      fireEvent.click(day20);
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Today and Clear Buttons', () => {
    it('should select today when clicking Today button', () => {
      const onChange = vi.fn();
      render(<DatePicker onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const todayButton = screen.getByRole('button', { name: 'Today' });
      fireEvent.click(todayButton);
      
      expect(onChange).toHaveBeenCalledWith('2026-01-21');
    });

    it('should clear value when clicking Clear button', () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-01-15" onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const clearButton = screen.getByRole('button', { name: 'Clear' });
      fireEvent.click(clearButton);
      
      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should disable Today button when today is outside range', () => {
      render(<DatePicker maxDate={new Date(2026, 0, 15)} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      const todayButton = screen.getByRole('button', { name: 'Today' });
      expect(todayButton).toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow keys', () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-01-15" onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      // Navigate right (next day)
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalledWith('2026-01-16');
    });

    it('should close calendar on Enter key', () => {
      const onChange = vi.fn();
      render(<DatePicker value="2026-01-15" onChange={onChange} />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      expect(screen.getByText('January')).toBeInTheDocument();
      
      fireEvent.keyDown(document, { key: 'Enter' });
      
      // Calendar should close
      expect(screen.queryByText('Su')).not.toBeInTheDocument();
    });
  });
});

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 21));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render two date pickers', () => {
    render(<DateRangePicker />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('should show start and end dates', () => {
    render(
      <DateRangePicker 
        startDate="2026-01-01" 
        endDate="2026-01-15" 
      />
    );
    
    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('15 Jan 2026')).toBeInTheDocument();
  });

  it('should call onStartDateChange when start date is selected', () => {
    const onStartDateChange = vi.fn();
    render(
      <DateRangePicker 
        onStartDateChange={onStartDateChange}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // Open start date picker
    
    const day10 = screen.getByRole('button', { name: '10' });
    fireEvent.click(day10);
    
    expect(onStartDateChange).toHaveBeenCalledWith('2026-01-10');
  });

  it('should call onEndDateChange when end date is selected', () => {
    const onEndDateChange = vi.fn();
    render(
      <DateRangePicker 
        startDate="2026-01-01"
        onEndDateChange={onEndDateChange}
      />
    );
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Open end date picker
    
    const day15 = screen.getByRole('button', { name: '15' });
    fireEvent.click(day15);
    
    expect(onEndDateChange).toHaveBeenCalledWith('2026-01-15');
  });

  it('should enforce minDate on end picker based on start date', () => {
    render(
      <DateRangePicker 
        startDate="2026-01-10"
      />
    );
    
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Open end date picker
    
    // Days before start date should be disabled
    const day5 = screen.getByRole('button', { name: '5' });
    expect(day5).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<DateRangePicker disabled />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});
