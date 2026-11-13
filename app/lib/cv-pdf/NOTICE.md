# Third-party notice

The Onyx and Persian CV designs in `designs.ts` follow the templates of the same names in [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume) (`packages/pdf/src/templates/onyx` and `persian`), licensed under the MIT License:

> Copyright (c) 2026 Amruth Pillai
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

What was taken: Onyx follows Reactive Resume's Onyx template with its default settings (IBM Plex Serif, red accent, 14pt margins, Letter here), measured from a PDF exported from Reactive Resume; Persian follows their sample PDF and template styles (A4, three-column skills grid). Both use their contact order and gaps, the two-row entry layout, and the regular-weight [Phosphor](https://github.com/phosphor-icons/core) contact icons in `icons.ts` (MIT, copied from Reactive Resume's bundled set). The rendering is this app's own pdfme layout, not their Forme/React code. Changes from the original: no photo or headline, since the CV has neither; bullets are drawn dots so wrapped lines stay one block for position-based parsers; the phone number isn't a link, since pdfme only links web and email addresses.
