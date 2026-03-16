"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function TrainingSuccessBanner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      setShow(true);
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800 border border-green-200">
      <p className="font-medium">Test byl úspěšně vytvořen.</p>
    </div>
  );
}
