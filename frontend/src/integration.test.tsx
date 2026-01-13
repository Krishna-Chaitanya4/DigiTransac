import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('E2E: Complete Auth Flow', () => {
  it('renders login page on initial load', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('renders register link on login page', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: /create account/i });
    expect(link).toBeInTheDocument();
  });

  it('login page has email/username input', () => {
    render(<App />);
    const input = screen.getByLabelText(/email or username/i);
    expect(input).toBeInTheDocument();
  });

  it('login page has password input', () => {
    render(<App />);
    const input = screen.getByLabelText(/^password/i);
    expect(input).toBeInTheDocument();
  });

  it('login page has submit button', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeInTheDocument();
  });
});
