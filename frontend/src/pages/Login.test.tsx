import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Login } from './Login';
import { AuthProvider } from '../context/AuthContext';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as any;

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAxios.post = vi.fn();
    localStorage.clear();
  });

  it('renders login form', () => {
    renderLogin();
    // Use getByRole to avoid multiple matches
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('renders email or username input', () => {
    renderLogin();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
  });

  it('renders password input', () => {
    renderLogin();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it('renders login button', () => {
    renderLogin();
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeInTheDocument();
  });

  it('renders register link', () => {
    renderLogin();
    // Text is split across multiple elements, use more specific query
    const link = screen.getByRole('link', { name: /create account/i });
    expect(link).toBeInTheDocument();
  });

  it('email/username input has correct type', () => {
    renderLogin();
    const input = screen.getByLabelText(/email or username/i) as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('password input has correct type', () => {
    renderLogin();
    const input = screen.getByLabelText(/^password/i) as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('email/username input is in form', () => {
    renderLogin();
    const input = screen.getByLabelText(/email or username/i);
    const form = input.closest('form');
    expect(form).toBeInTheDocument();
  });

  it('password input is in form', () => {
    renderLogin();
    const input = screen.getByLabelText(/^password/i);
    const form = input.closest('form');
    expect(form).toBeInTheDocument();
  });

  it('submit button is initially enabled', () => {
    renderLogin();
    const button = screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('displays DigiTransac branding', () => {
    renderLogin();
    expect(screen.getByText('DigiTransac')).toBeInTheDocument();
  });

  it('displays tagline', () => {
    renderLogin();
    expect(screen.getByText(/Smart Personal Finance Management/i)).toBeInTheDocument();
  });

  it('form has proper structure', () => {
    const { container } = renderLogin();
    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('form has Container wrapper', () => {
    const { container } = renderLogin();
    const muiContainer = container.querySelector('.MuiContainer-root');
    expect(muiContainer).toBeInTheDocument();
  });
});
