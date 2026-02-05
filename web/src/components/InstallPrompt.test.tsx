import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallPrompt, { usePWAInstall } from './InstallPrompt';
import { renderHook, act } from '@testing-library/react';

describe('usePWAInstall', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    
    // Mock matchMedia to not be in standalone mode
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('should initialize with isInstallable false', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstallable).toBe(false);
  });

  it('should initialize with isInstalled false when not in standalone mode', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalled).toBe(false);
  });

  it('should detect when app is already installed (standalone mode)', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => usePWAInstall());
    expect(result.current.isInstalled).toBe(true);
  });

  it('should listen for beforeinstallprompt event', () => {
    renderHook(() => usePWAInstall());
    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
  });

  it('should listen for appinstalled event', () => {
    renderHook(() => usePWAInstall());
    expect(addEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('should cleanup event listeners on unmount', () => {
    const { unmount } = renderHook(() => usePWAInstall());
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function));
  });

  it('should become installable when beforeinstallprompt fires', async () => {
    const { result } = renderHook(() => usePWAInstall());

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn() });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(result.current.isInstallable).toBe(true);
    });
  });

  it('should provide install function', () => {
    const { result } = renderHook(() => usePWAInstall());
    expect(typeof result.current.install).toBe('function');
  });
});

describe('InstallPrompt', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalLocalStorage = window.localStorage;

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // Mock localStorage
    const mockStorage: { [key: string]: string } = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
        removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
        clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('should render nothing when not installable', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when previously dismissed', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(Date.now().toString());
    const { container } = render(<InstallPrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('should show install prompt when installable', async () => {
    render(<InstallPrompt />);

    // Trigger beforeinstallprompt event
    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(screen.getByText('Install DigiTransac')).toBeInTheDocument();
    });
  });

  it('should have Install button', async () => {
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    });
  });

  it('should have Not now button', async () => {
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    });
  });

  it('should dismiss and save to localStorage when Not now clicked', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'dismissed' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(screen.getByText('Install DigiTransac')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(localStorage.setItem).toHaveBeenCalledWith('pwa-install-dismissed', expect.any(String));
  });

  it('should show description text', async () => {
    render(<InstallPrompt />);

    const mockEvent = new Event('beforeinstallprompt');
    Object.defineProperty(mockEvent, 'prompt', { value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(mockEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(mockEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/Install our app for quick access/)).toBeInTheDocument();
    });
  });
});
