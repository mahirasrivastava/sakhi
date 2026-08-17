import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * One keyboard, shared by every field on the page.
 *
 * A keyboard per input would mean twenty mounted panels fighting over the
 * bottom of a 5-inch screen. Instead each ScriptField *registers* itself here,
 * and the single docked panel routes its keypresses to whichever field is
 * currently attached. The field owns caret arithmetic, because only the field
 * knows its own value.
 */

const KeyboardContext = createContext(null);

const TRANSLIT_KEY = "sakhi_translit";

export function KeyboardProvider({ children }) {
  const [field, setField] = useState(null);
  const [open, setOpen] = useState(false);
  // Phonetic typing is the faster path for anyone holding a Latin keyboard, but
  // it is startling if you did not ask for it — so it stays off until switched
  // on, and is then remembered.
  const [translit, setTranslit] = useState(() => localStorage.getItem(TRANSLIT_KEY) === "on");

  const fieldsRef = useRef(new Map());
  const activeIdRef = useRef(null);

  const setActive = useCallback((id) => {
    activeIdRef.current = id;
    setField(id ? fieldsRef.current.get(id) || null : null);
  }, []);

  /** Registration objects must be stable — see ScriptField, which registers once. */
  const register = useCallback((id, handlers) => {
    fieldsRef.current.set(id, { id, ...handlers });
    return () => {
      fieldsRef.current.delete(id);
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
        setField(null);
        setOpen(false);
      }
    };
  }, []);

  // Focus alone must not pop the keyboard open — a worker with a physical
  // keyboard would have it thrown in her face on every tab. Focus only
  // *retargets* a keyboard that is already open.
  const focusField = useCallback((id) => {
    if (fieldsRef.current.has(id)) setActive(id);
  }, [setActive]);

  const openFor = useCallback((id) => {
    if (!fieldsRef.current.has(id)) return;
    setActive(id);
    setOpen(true);
  }, [setActive]);

  const close = useCallback(() => setOpen(false), []);

  const toggleFor = useCallback((id) => {
    const wasActive = activeIdRef.current === id;
    setActive(id);
    setOpen((isOpen) => !(isOpen && wasActive));
  }, [setActive]);

  const toggleTranslit = useCallback(() => {
    setTranslit((on) => {
      localStorage.setItem(TRANSLIT_KEY, on ? "off" : "on");
      return !on;
    });
  }, []);

  const press = useCallback((action, payload) => {
    const target = activeIdRef.current && fieldsRef.current.get(activeIdRef.current);
    if (!target) return;
    if (action === "insert") target.insert(payload);
    else if (action === "backspace") target.backspace();
    else if (action === "enter") target.enter();
    // A tapped key also breaks any half-typed Latin run, so the two input
    // methods cannot interleave into nonsense.
    target.endRun?.();
  }, []);

  // The panel is fixed to the bottom of the viewport; without this the field
  // being typed into can sit underneath it.
  useEffect(() => {
    document.body.classList.toggle("kbd-open", open);
    return () => document.body.classList.remove("kbd-open");
  }, [open]);

  const value = useMemo(() => ({
    field, open, translit,
    register, focusField, openFor, close, toggleFor, toggleTranslit, press,
  }), [field, open, translit, register, focusField, openFor, close, toggleFor, toggleTranslit, press]);

  return <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>;
}

export function useKeyboard() {
  const ctx = useContext(KeyboardContext);
  if (!ctx) throw new Error("useKeyboard must be used inside KeyboardProvider");
  return ctx;
}
