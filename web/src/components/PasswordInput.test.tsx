import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  const defaultProps = {
    id: 'password',
    name: 'password',
    value: '',
    onChange: vi.fn(),
    label: 'Password',
  };

  it('should render with label', () => {
    render(<PasswordInput {...defaultProps} />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should render password field hidden by default', () => {
    render(<PasswordInput {...defaultProps} value="secret123" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should toggle password visibility when clicking show/hide button', async () => {
    const user = userEvent.setup();
    render(<PasswordInput {...defaultProps} value="secret123" />);
    
    const input = screen.getByLabelText('Password');
    const toggleButton = screen.getByRole('button');

    // Initially hidden
    expect(input).toHaveAttribute('type', 'password');

    // Click to show
    await user.click(toggleButton);
    expect(input).toHaveAttribute('type', 'text');

    // Click to hide again
    await user.click(toggleButton);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should call onChange when typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordInput {...defaultProps} onChange={onChange} />);
    
    const input = screen.getByLabelText('Password');
    await user.type(input, 'test');

    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith('t');
  });

  it('should display placeholder when provided', () => {
    render(<PasswordInput {...defaultProps} placeholder="Enter password" />);
    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toBeInTheDocument();
  });

  it('should display hint when provided', () => {
    render(<PasswordInput {...defaultProps} hint="Must be at least 8 characters" />);
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('should be required when specified', () => {
    render(<PasswordInput {...defaultProps} required />);
    const input = screen.getByLabelText('Password');
    expect(input).toBeRequired();
  });

  it('should have correct autocomplete attribute', () => {
    render(<PasswordInput {...defaultProps} autoComplete="new-password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });
});
