"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#112113",
          color: "#eef6ec",
          border: "1px solid rgba(174, 255, 157, 0.18)",
        },
      }}
    />
  );
}
