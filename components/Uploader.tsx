"use client";

import { Button, type ButtonProps } from "@heroui/react";
import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";

export function ImportButton({ onFiles, children, ...props }: { onFiles: (files: File[]) => void } & ButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button {...props} onPress={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** The large drop zone shown before any data has been imported. */
export function Uploader({ onFiles, onSample }: { onFiles: (files: File[]) => void; onSample?: () => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
        dragging ? "border-primary bg-primary-50" : "border-default-300 bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <FileText size={26} />
      </div>
      <h2 className="text-xl font-semibold">Drop your statements here</h2>
      <p className="mx-auto mt-2 max-w-md text-small text-default-500">
        Upload your monthly <b>PDF statements</b>, or a <b>CSV</b> export from your bank&apos;s website (usually under
        &ldquo;Download transactions&rdquo;). Add your credit card and debit account together to see the full picture.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ImportButton color="primary" onFiles={onFiles} startContent={<Upload size={16} />}>
          Choose statements
        </ImportButton>
        {onSample && (
          <Button variant="flat" onPress={onSample}>
            Try with sample data
          </Button>
        )}
      </div>
      <p className="mt-4 text-tiny text-default-400">
        Stays on your computer. Data is saved to a file in the project folder, never uploaded anywhere.
      </p>
    </div>
  );
}
