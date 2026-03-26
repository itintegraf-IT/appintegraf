"use client";

import { useEffect } from "react";

/** Stejné chování jako PHP: window.onload → window.print() */
export function ProtocolAutoPrint() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}
