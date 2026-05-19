# QuestionForge Practice

A no-install practice question app for personal AI-generated question banks. It runs entirely in the browser and stores data in local storage, so it is easy to put on GitHub Pages or run by opening `index.html`.

## What it does

- Add and edit multiple-choice questions.
- Import AI-generated questions as JSON.
- Download a backup JSON file of your full question bank and restore it later.
- Connect Supabase so questions and practice attempts sync across devices.
- Filter practice blocks by topic.
- Use tutor mode for immediate explanations or exam mode for faster blocks.
- Track accuracy, recent attempts, unused questions, flagged questions, and topic performance.

## Run it

Open `index.html` in a browser.

For GitHub Pages, push these files to a repository and enable Pages from the repository settings. Use the repository root as the publishing source.

## Keep your questions safe

This app stores questions in your browser. Before moving the app folder, changing bookmarks, clearing browser data, or publishing to GitHub Pages, open the Import page and click **Download backup JSON**.

To restore later, paste that backup JSON into the Import page and click **Import questions**.

## Supabase sync

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Paste and run the contents of `supabase-setup.sql`.
4. In Supabase, copy your Project URL and public anon key.
5. Open QuestionForge, go to Settings, and paste both values.
6. Create an account or sign in.
7. Click **Sync local questions to Supabase** once to move this device's existing questions into the cloud.

After that, adding questions in the app saves them to Supabase automatically.

## Import format

Paste either one question object or an array of question objects:

```json
[
  {
    "stem": "Question stem here",
    "choices": ["A", "B", "C", "D"],
    "answerIndex": 1,
    "explanation": "Teaching explanation",
    "tags": ["cardiology"],
    "difficulty": "Medium",
    "source": "AI set 2026-05-19"
  }
]
```

`answerIndex` starts at `0`, so the first choice is `0`, the second is `1`, and so on.
