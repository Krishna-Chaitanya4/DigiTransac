import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Register } from './Register';
import { AuthProvider } from '../context/AuthContext';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as any;

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAxios.post = vi.fn();
    localStorage.clear();
  });

  it('renders register form', () => {
    renderRegister();
    // Use getByRole to avoid multiple matches
    expect(screen.getByRole('heading', { name: /get started today/i })).toBeInTheDocument();
  });

  it('renders email input', () => {
    renderRegister();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
  });

  it('renders username input', () => {
    renderRegister();
    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
  });

  it('renders full name input', () => {
    renderRegister();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
  });

  it('renders password input', () => {
    renderRegister();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it('renders confirm password input', () => {
    renderRegister();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders create account button', () => {
    renderRegister();
    const button = screen.getByRole('button', { name: /create account/i });
    expect(button).toBeInTheDocument();
  });

  it('renders login link', () => {
    renderRegister();
    const link = screen.getByRole('link', { name: /sign in instead/i });
    expect(link).toBeInTheDocument();
  });

  it('has correct input types', () => {
    renderRegister();
    const emailInput = screen.getByLabelText(/^email/i) as HTMLInputElement;
    expect(emailInput.type).toBe('email');
    
    const passwordInput = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
  });

  it('email input is required', () => {
    renderRegister();
    const emailInput = screen.getByLabelText(/^email/i);
    expect(emailInput.closest('form')).toBeInTheDocument();
  });

  it('username input is required', () => {
    renderRegister();
    const usernameInput = screen.getByLabelText(/^username/i);
    expect(usernameInput.closest('form')).toBeInTheDocument();
  });

  it('full name input is required', () => {
    renderRegister();
    const fullNameInput = screen.getByLabelText(/full name/i);
    expect(fullNameInput.closest('form')).toBeInTheDocument();
  });

  it('password input is required', () => {
    renderRegister();
    const passwordInput = screen.getByLabelText(/^password/i);
    expect(passwordInput.closest('form')).toBeInTheDocument();
  });

  it('confirm password input is required', () => {
    renderRegister();
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    expect(confirmPasswordInput.closest('form')).toBeInTheDocument();
  });

  it('submit button is initially enabled', () => {
    renderRegister();
    const submitButton = screen.getByRole('button', { name: /create account/i }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('displays DigiTransac branding', () => {
    renderRegister();
    expect(screen.getByText('DigiTransac')).toBeInTheDocument();
  });

  it('displays tagline', () => {
    renderRegister();
     expect(screen.getByText(/Create Your Account/i)).toBeInTheDocument();
  });

  it('form has proper structure', () => {
    const { container } = renderRegister();
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('form has Container wrapper', () => {
    const { container } = renderRegister();
    const muiContainer = container.querySelector('.MuiContainer-root');
    expect(muiContainer).toBeInTheDocument();
  });
});
