# Kian's saves within 2 seconds (the PM, 2026-10-13, after the save-order fix)

Read only: one read-only transaction on the working database `roses`, nothing changed. Script: `saves-within-2s.mjs`; its output: `saves-within-2s.txt` and `.json` (run 2026-10-13 after the merge of e0b4ddf).

**Result: no stored value differs from the last value Kian typed.**

Scope: every item change record written by Kian's own account (kind `admin`, name "Kian") since the per-field editor went live (2026-10-07; his first item save through it is 2026-10-08 00:18 UTC): 139 saves on 69 items. The records the import tools wrote under the name "Kian" (the Persian review file of 2026-10-07, the Fall Menu record of 2026-10-12) are not his account and are left out. Undo records by his account count as his saves.

A burst is 2 or more saves of one item with at most 2 s between consecutive ones (by the record's `at`, the start of each save's transaction). 5 bursts:

| Item | When (UTC) | Saves, in the order committed | Stored now |
| --- | --- | --- | --- |
| Warm Pumpkin & Ice Cream | 2026-10-08 00:21:16.9 → 18.6 | #185 the one price $14.99 became a size "Regular $14.99"; #186 (1.67 s later) that size removed, $14.99 again | $14.99, no sizes: #186's value |
| Majoun | 2026-10-08 14:29:45.8 → 46.8 | #583 the size "Regular $21.99" removed, $21.99 as the one price; #584 (1.0 s later) a size "Regular $21.99" again | $21.99, no sizes: the value of #585, 2.2 s after #584 (the size removed again), the last save of the field |
| Majoun | 2026-10-08 14:32:00.9 → 02.2 | #593 Vegan added (contains nuts); #594 (1.3 s later) Halal set | none of these now: the notes changed 7 times since (the research import among them), the last by Kian's account (#1185); stored = #1185's value |
| Majoun | 2026-10-13 03:42:09.9 → 12.8 | #1183 Vegan removed; #1184 (1.3 s) the Persian note cleared; #1185 (1.6 s) the English note cleared | no allergen, no diet, no note: #1185's value |
| Warm Pumpkin & Ice Cream | 2026-10-12 20:54:56.3 → 57.3 | #871 Winter added to Fall; #872 (0.97 s later) Winter removed | Fall only: #872's value |

In every burst, for every field it wrote, the value stored now is the newest write of that field (in the burst, or by a later save, named above).

Three bursts (the 2026-10-08 size bursts and the Winter one) set a value back to what it was before the burst, which is also what the race fixed in ca1d718 leaves behind (the older of two saves landing last). They are not the race, for two reasons each:

1. **The state before the burst allows only one order.** Warm Pumpkin had a price and no size before #185, so the size could not be removed before it was made: #185 came first, #186 second, as committed. Majoun had a size and no price before #583, so "a size from the one price" (#584) needed #583's price first. Warm Pumpkin was Fall only before #871, so Winter could not be removed before it was added. The committed order is the order Kian made them in, and the last one is what is stored.
2. **The gaps are 0.97–1.67 s.** The race needs both saves on their way at the same moment; a save reaches the database in tens of milliseconds here (the editor drill's measurements), so the earlier one would have had to be held up for over a second.

The two other bursts are plain sequences: each save starts from the value the one before it left (its "before" is the previous "after").

Limits: the change record holds the order the saves were committed and the start of each transaction, not the moment each was typed; the order above is inferred from what each save could have started from. Bursts more than 2 s apart were not in scope.
