import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  handler: () => void;
  description: string;
}

/**
 * Global keyboard shortcuts for the application
 * Follows TeamSync design requirement: "simple keyboard shortcuts (desktop)"
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'k',
      ctrlKey: true,
      description: 'Quick search',
      handler: () => {
        // Trigger search modal (will be handled by SearchBar component)
        document.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'k', 
          ctrlKey: true,
          bubbles: true 
        }));
      }
    },
    {
      key: '/',
      description: 'Focus message composer',
      handler: () => {
        const composer = document.querySelector<HTMLTextAreaElement>('[data-composer]');
        if (composer) {
          composer.focus();
        }
      }
    },
    {
      key: 'Escape',
      description: 'Close panels/dialogs',
      handler: () => {
        // Handled by individual components
      }
    }
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Allow Ctrl+K even in input fields for search
      if (!(event.key === 'k' && event.ctrlKey)) {
        return;
      }
    }

    const matchedShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = !shortcut.ctrlKey || event.ctrlKey || event.metaKey;
      const shiftMatch = !shortcut.shiftKey || event.shiftKey;
      const metaMatch = !shortcut.metaKey || event.metaKey;

      return keyMatch && ctrlMatch && shiftMatch && metaMatch;
    });

    if (matchedShortcut) {
      event.preventDefault();
      matchedShortcut.handler();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

/**
 * Hook to display keyboard shortcuts help
 */
export function useKeyboardShortcutsHelp() {
  const shortcuts = [
    { keys: ['Ctrl', 'K'], description: 'Quick search' },
    { keys: ['/'], description: 'Focus message composer' },
    { keys: ['Enter'], description: 'Send message' },
    { keys: ['Shift', 'Enter'], description: 'New line in message' },
    { keys: ['Escape'], description: 'Close panels/dialogs' },
    { keys: ['↑', '↓'], description: 'Navigate messages' },
  ];

  return shortcuts;
}
