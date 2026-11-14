# Requirements Analysis — Questions

## Q1. [Product] Tone

The design doc leans "cozy with real depth" — forgiving, no punishing permadeath, no idle auto-income. Confirm the tone.

A. Cozy-leaning with real depth — forgiving, no punishing permadeath, no idle auto-income
B. Hardcore simulation — neglect has harsh, lasting consequences
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q2. [Product] Offline progress

When the game is closed and reopened, what should happen?

A. Simulate up to 8 game-days at coarse resolution, with a "while you were away" summary; fish can't die from neglect while away
B. Fully pause when closed — nothing changes while away
C. Not yet defined
X. Other (please specify)

[Answer]:A

## Q3. [Product] Currency and language

What currency and language should the MVP use?

A. Abstract currency ($FISH), bilingual Vietnamese/English
B. Abstract currency ($FISH), English only
C. Abstract currency ($FISH), Vietnamese only
D. Not yet defined
X. Other (please specify)

[Answer]: B

## Q4. [Product] Species in the MVP store

The design doc's MVP says "all 30 species, data-complete"; the architecture doc's first phase starts with 5. How many species should the MVP store carry?

A. All 30 species, data-complete with procedural art
B. A starter subset (say how many or which)
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q5. [Product] Water and environment depth

How deep should the water/environment simulation go in the MVP?

A. Simplified nitrogen cycle — bioload, filter, water changes; the "new tank cycle" as a teachable beginner mechanic
B. No water chemistry — just feed, health, and tank size
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q6. [Product] Save and load

How should saving work?

A. Autosave (~30 seconds) + manual save slots + JSON export/import backup
B. Autosave only
C. Not yet defined
X. Other (please specify)

[Answer]: A

## Q7. [Quality] Additional quality targets

Beyond the confirmed performance target (150 fish at ≥ 50 fps on a Meizu Lucky 08), are there any other hard quality targets?

A. No additional hard targets — keep the confirmed one
B. Additional targets (name them, e.g. save size, load time)
C. Not yet defined
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

- Tone: cozy-leaning with real depth — forgiving, no punishing permadeath, no idle auto-income (Q1)
- Offline: simulate up to 8 game-days with a "while you were away" summary; fish can't die from neglect while away (Q2)
- Currency and language: abstract currency ($FISH), English only (Q3)
- Species: all 30 species, data-complete with procedural art (Q4)
- Water: simplified nitrogen cycle — bioload, filter, water changes (Q5)
- Save: autosave (~30s) + manual slots + JSON export/import backup (Q6)
- Quality: no additional hard targets beyond 150 fish ≥ 50 fps (Q7)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
