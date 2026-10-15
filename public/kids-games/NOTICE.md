# NOTICE: word list for the kids' word games (words.js)

**Source.** The word list in `words.js` comes from a public English word-frequency list
(the file header names it as the google-10k list: common English words, filtered to real
dictionary words). The `BLOCKLIST` and the adult-word list in the same file were added by
the project to keep puzzle answers and scoring child-appropriate.

**Licence: NOT CONFIRMED.** The licence of the source word-frequency list has not been
checked, and no licence is stated for this file. The owner must check the licence of the
source list (and of any dictionary used to filter it) before this file is published
publicly. Do not treat this file as openly licensed until that check is done.

**Filter applied.** On 2026-10-15 the blocked terms were removed by the named filter
**pippin-kids-word-filter v1**. It removed these kinds of entry from `window.WORDS` and
`window.BASE_WORDS`:

1. Adult, sexual, drug, alcohol, gambling and profane terms, and sexual-orientation terms.
2. Self-harm terms (for example "suicide").
3. Slurs and noun forms of ethnic or religious group labels. Adjective forms are kept.
4. First names and surnames of people, and names of famous people and bands.
5. Brands and trademarks that have no everyday meaning (for example "nike", "disney").

Entries with an everyday meaning that also happen to be a brand (for example "apple",
"amazon", "java", "target") are kept, as are place names, months, animals and common nouns.

Result: 481 entries removed from `window.WORDS` (6,758 to 6,277) and 58 from
`window.BASE_WORDS` (1,010 to 952). The file format and export names are unchanged.
`window.BLOCKLIST` was not changed, so the games' existing blocklist checks still apply.

The filter was applied by hand against the full list, so it is a judgement, not a
guarantee. It works on whole words, not on context.
