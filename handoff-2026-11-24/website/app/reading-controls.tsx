"use client";
import {useEffect, useRef} from "react";

export function SkipToContent() {
  return <a className="skip-content" href="#main" onClick={event => {
    const main = document.getElementById("main");
    if (main) {
      event.preventDefault();
      main.focus();
      main.scrollIntoView({block:"start"});
    }
  }}>跳至主要内容</a>;
}

export function useMenuEscape(open:boolean, setOpen:(value:boolean)=>void) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event:KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open, setOpen]);
  return trigger;
}
