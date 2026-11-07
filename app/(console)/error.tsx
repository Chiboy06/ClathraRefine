"use client";
import { Button, ErrorNote } from "@/components/ui";

export default function ConsoleError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 md:p-8 lg:p-10">
      <h1 className="text-2xl font-bold">This page hit an error</h1>
      <ErrorNote>{error.message || "Unknown error"}</ErrorNote>
      <div>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
