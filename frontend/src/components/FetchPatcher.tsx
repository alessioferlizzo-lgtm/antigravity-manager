"use client";
import { useEffect } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

export default function FetchPatcher() {
  useEffect(() => {
    if (!API_KEY || !BACKEND) return;
    const original = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.startsWith(BACKEND)) {
        const headers = new Headers((init?.headers as HeadersInit) ?? {});
        if (!headers.has("X-API-Key")) headers.set("X-API-Key", API_KEY);
        init = { ...init, headers };
      }
      return original.call(this, input, init);
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
