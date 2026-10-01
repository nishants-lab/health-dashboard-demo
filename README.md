# Health Dashboard

A recruiter-facing demonstration of lab-PDF extraction, human review, longitudinal charts and general lifestyle education. All records and profile details are entirely fictional.

## Try it locally
Run `python -m http.server 8794 --bind 127.0.0.1` from this directory, then open http://127.0.0.1:8794.
Use Upload Report > Try sample report > review/edit > Add to session. Refresh or Reset sample clears session changes.

## Privacy and safety
- No personal dataset, source reports, account tokens, original repository configuration or history included.
- PDFs are processed locally. Reviewed values live only in page memory, not localStorage or a server.
- Only theme preferences are stored. The application makes no third-party runtime requests; dependencies are vendored with their licenses.
- Do not upload real health information into this demo. It is not designed or validated for clinical use.
- Reference ranges are illustrative. Units and formats have limited support. Scanned/image PDFs require OCR and are not supported.
- Health Trend Score is an illustrative custom index, not a clinically validated assessment. Change summaries describe numeric movement, not clinical improvement.
- Lifestyle examples are prewritten education, not dynamic advice. No diagnostic, treatment or outcome claims.

## Synthetic fixtures
The initial dataset contains four entirely fictional reports across 29 markers. `samples/synthetic-lab-report.pdf` provides a fifth report; `samples/expected-results.json` is its extraction fixture. Dates are computed relative to creation time. No real observations were used to generate values.

## Publishing
Published separately from the personal dashboard using GitHub Pages (main / root). Never publish the original personal repository or its history.

## Dependencies
Chart.js 4.4.0 (MIT), chartjs-plugin-annotation 3.0.1 (MIT), PDF.js 4.0.379 (Apache-2.0). See vendor license files.
