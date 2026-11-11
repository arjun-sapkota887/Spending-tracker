# Ledger: monthly expense tracker

Import your monthly credit and debit card statements (PDF or CSV) and get a summary of where your money went, with
month-to-month comparisons.

Built with Next.js, HeroUI (formerly NextUI), Tailwind CSS, Recharts and @react-pdf/renderer.

## Features

- Imports PDF statements: it rebuilds the text into rows, works out missing years, and uses the
  withdrawal/deposit columns to tell money in from money out
- Imports CSV exports from most banks: it detects the columns, date format and sign convention by itself,
  including files with no header row
- Sorts transactions into spending categories and income sources, and tracks money lent and borrowed separately
- Skips transfers and credit card payments so the same money isn't counted twice
- Saves every month and compares months by category
- Downloads a monthly overview as a PDF
- Lets you add cash entries (like tips) by hand

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and click **Try with sample data**. There are sample PDF statements in
`public/samples/` you can import to try the PDF reader.

`npm install` also copies the pdf.js worker into `public/` (see the `postinstall` script). If PDF import ever
stops working, run `npm run postinstall`.

Your data is saved to `data/store.json` on your own machine. That folder is git-ignored, so it's never committed.
