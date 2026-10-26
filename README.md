# Credit-Smart Prompt Runner

this is the prompt, do as it is saying without spending all credits

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76b2a294-74c7-4e2a-96ba-e34af55563c2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Recent additions
- Strict TypeScript clean-up (`noUncheckedIndexedAccess`) in `src/lib/data.ts`, `src/lib/charts.ts`, `src/routes/users.tsx`; new `req()` helper in `data.ts`.
- PDF export (no extra dependency): `src/lib/pdf.ts` (builder) and `src/lib/dossiers.ts` (Case Disposal + Institution 360° dossiers). Exports are written to the audit log.
- Client-side overlap detection: `src/lib/overlap.ts`, used by the "Register case" dialog (live, as you type) and the "Live overlap check" panel on each case.
