/**
 * ContextMenu — macOS-style popover dropdown anchored to a trigger button.
 *
 * Uses a portal so it floats above overflow:hidden parents and the QueuePanel
 * (which has its own scroll context). Closes on:
 *   - Click outside
 *   - Escape key
 *   - Click on any menu item (via onSelect)
 *
 * Supports full keyboard navigation:
 *   - Arrow Up / Down to move focus
 *   - Enter / Space to select
 *   - Escape to close
 *
 * Items are plain ReactNodes so callers can pass icons + labels freely.
 */

import { useEffect, useRef, useState, useCallback, useMemo, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorAfter?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  /** Position the menu relative to the trigger button. */
  align?: 'left' | 'right';
  /** Tooltip for the trigger button. */
  title?: string;
  /** Optional className for the trigger button. */
  triggerClassName?: string;
  /** Optional custom trigger element; default is the MoreHorizontal icon. */
  trigger?: React.ReactNode;
  /** When true, the trigger always renders (not only on hover). */
  alwaysVisible?: boolean;
}

/** Compute safe menu position, keeping it within the viewport. */
function computeSafePosition(
  triggerRect: DOMRect,
  align: 'left' | 'right',
  menuWidth: number,
  menuHeight: number,
): { top: number; left: number } {
  const gap = 6;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let top = triggerRect.bottom + gap;
  let left = align === 'right' ? triggerRect.right : triggerRect.left;

  // Flip horizontal if overflows right edge
  if (align === 'right' && left - menuWidth < 8) {
    left = triggerRect.left;
  } else if (align === 'left' && left + menuWidth > viewportW - 8) {
    left = triggerRect.right - menuWidth;
  }

  // Clamp horizontal
  left = Math.max(8, Math.min(left, viewportW - menuWidth - 8));

  // Flip above if overflows bottom
  if (top + menuHeight > viewportH - 8) {
    top = triggerRect.top - gap - menuHeight;
  }

  // Clamp vertical
  top = Math.max(8, Math.min(top, viewportH - menuHeight - 8));

  return { top, left };
}

export function ContextMenu({
  items,
  align = 'right',
  title = 'More options',
  triggerClassName,
  trigger,
  alwaysVisible = true,
}: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Flat list of selectable item indices (skips separators & disabled). */
  const selectableIndices = useMemo(
    () =>
      items
        .map((item, i) => (item.disabled ? -1 : i))
        .filter((i) => i !== -1),
    [items],
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    // Use a temporary measurement element to get menu dimensions
    const temp = document.createElement('div');
    temp.className =
      'fixed invisible pointer-events-none min-w-[200px] py-1 text-sm';
    temp.setAttribute('role', 'menu');
    document.body.appendChild(temp);
    const { width, height } = temp.getBoundingClientRect();
    document.body.removeChild(temp);

    const safe = computeSafePosition(rect, align, width, height);
    setPosition(safe);
  }, [align]);

  const handleOpen = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setFocusedIndex(-1);
    updatePosition();
    setOpen(true);
  }, [open, updatePosition]);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  const handleSelect = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      item.onSelect();
      close();
    },
    [close],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Keyboard: Escape to close, Arrow keys to navigate, Enter to select
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentPos = selectableIndices.indexOf(prev);
          const nextPos =
            currentPos < selectableIndices.length - 1 ? currentPos + 1 : 0;
          return selectableIndices[nextPos] ?? -1;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentPos = selectableIndices.indexOf(prev);
          const nextPos =
            currentPos > 0 ? currentPos - 1 : selectableIndices.length - 1;
          return selectableIndices[nextPos] ?? -1;
        });
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          handleSelect(items[focusedIndex]);
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close, focusedIndex, items, selectableIndices, handleSelect]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !menuRef.current) return;
    const buttons = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]');
    buttons[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, updatePosition]);

  /** Mirror of align for transform-origin styling. */
  const originX = align === 'right' ? '100%' : '0%';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        className={
          triggerClassName ??
          `p-1.5 rounded-mac-sm transition-all duration-150
           hover:bg-white/[0.08] active:scale-95
           ${alwaysVisible ? '' : 'opacity-0 group-hover:opacity-100'}`
        }
        title={title}
      >
        {trigger ?? <DefaultMoreIcon />}
      </button>

      <AnimatePresence>
        {open && position && (
          <ContextMenuPanel
            ref={menuRef}
            position={position}
            originX={originX}
            items={items}
            focusedIndex={focusedIndex}
            onHover={setFocusedIndex}
            onSelect={handleSelect}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated menu panel (forwarded ref)                                */
/* ------------------------------------------------------------------ */

const ContextMenuPanel = forwardRef<
  HTMLDivElement,
  {
    position: { top: number; left: number };
    originX: string;
    items: ContextMenuItem[];
    focusedIndex: number;
    onHover: (index: number) => void;
    onSelect: (item: ContextMenuItem) => void;
  }
>(function ContextMenuPanel(
  { position, originX, items, focusedIndex, onHover, onSelect },
  ref,
) {
  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transformOrigin: `${originX} 0%`,
        zIndex: 9999,
      }}
      className="min-w-[200px] glass-popover rounded-mac-lg shadow-mac-xl py-1.5"
    >
      {items.map((item, i) => (
        <div key={item.label}>
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            onMouseEnter={() => onHover(i)}
            onFocus={() => onHover(i)}
            tabIndex={-1}
            aria-disabled={item.disabled}
            className={`
              w-full flex items-center h-8 px-2.5 gap-2.5 text-[13px] text-left
              rounded-mac-sm mx-0.5
              transition-all duration-100 ease-out
              ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default'}
              ${
                !item.disabled && item.danger
                  ? 'text-mac-red hover:bg-mac-red/10'
                  : !item.disabled
                    ? 'text-white/80 hover:text-white hover:bg-white/[0.06]'
                    : 'text-white/40'
              }
              ${focusedIndex === i ? (item.danger ? 'bg-mac-red/10 text-mac-red' : 'bg-white/[0.06] text-white') : ''}
            `}
          >
            {/* Icon slot — fixed width for alignment */}
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {item.icon ? (
                <span className="[&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-mac-tertiary">
                  {item.icon}
                </span>
              ) : null}
            </span>
            <span className="truncate flex-1">{item.label}</span>
          </button>
          {item.separatorAfter && (
            <div className="h-px bg-mac-separator my-1 mx-3" />
          )}
        </div>
      ))}
    </motion.div>,
    document.body,
  );
});

/* ------------------------------------------------------------------ */
/*  Default trigger icon                                               */
/* ------------------------------------------------------------------ */

function DefaultMoreIcon() {
  return (
    <MoreHorizontal
      size={16}
      className="text-white/50 transition-colors group-hover:text-white/70"
      aria-hidden="true"
    />
  );
}
