# Translation review — machine-translated UI strings

Two batches of keys were added to all 23 language files by an AI assistant, not
by native speakers, and **none has been reviewed by a human.** This file records
how much to trust each before the app is used with real patients.

- **31 `anaemia_*` keys** — the camera screen. Carries clinical meaning.
- **31 account / offline / data-saver / read-aloud keys** — UI chrome. Lower
  risk: a clumsy "Sign in" label costs confusion, not a missed diagnosis. The
  exception is `account_stores`, which is a privacy promise and should say
  exactly what the English says.

This matters more than usual here. These strings tell someone whether to seek a
blood test. A mistranslation of `anaemia_severity_strong` or `anaemia_disclaimer`
is a clinical safety problem, not a cosmetic one.

## Priority for review

**Tier 1 — review before any real-world use.** The four strings that carry the
result and the disclaimer:

- `anaemia_severity_none`
- `anaemia_severity_mild`
- `anaemia_severity_moderate`
- `anaemia_severity_strong`
- `anaemia_disclaimer`

Everything else is guidance and can be corrected later without a safety
consequence — with the exception of `account_stores`, which tells the user their
health results never leave the phone. That claim must be accurate in every
language, because someone may decide what to disclose based on it.

## Confidence by language

| Confidence | Languages | Notes |
|---|---|---|
| Reasonable | hi, bn, mr, gu, ta, te, kn, ml, pa, or, as, ne, ur | Widely-resourced languages. Expect idiom and register issues, not meaning errors. |
| Lower | sa, kok, mai, doi, sd, ks | Register and orthography need checking. Sanskrit in particular is written in a formal imperative that may read oddly in a health app. |
| **Lowest — treat as placeholder** | brx, sat, mni | Bodo, Santali and Manipuri. Low training-data coverage, and the medical vocabulary is unlikely to match what health workers in those communities actually use. |

Santali is written in Ol Chiki and Manipuri in Bengali script, matching what was
already in those files. Confirm this is the script your users read — Manipuri is
also written in Meitei Mayek, and the choice is not neutral.

## Suggested process

1. Have an ASHA worker or ANM who speaks the language read the five Tier 1
   strings aloud to a patient and confirm the patient understood the action.
2. Fix the wording in the JSON file directly; the keys are stable.
3. Delete that language's row from the table above once it has been checked.

## Falling back instead

`t()` in `LanguageContext.jsx` falls back to English for any missing key. If a
language is not trusted, deleting its `anaemia_*` keys is safer than shipping a
translation nobody has read — an English string a health worker can interpret
beats a confident-looking wrong one in the patient's own language.
