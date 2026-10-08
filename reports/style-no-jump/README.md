# Style tab: the open group no longer jumps after a save (Kian, 2026-10-08)

**Bug.** While a colour was being edited in the Style tab, the open group jumped to another group and the colour being edited closed. Kian saw it after tapping parts of the page in the phone preview and then editing on the left.

**Cause.** `StyleTab.tsx` reacted to "a region was tapped in the preview" with an effect keyed on the tapped region *and on the tab's data*. The data reloads after every save (the save's answer, then the refetch the preview reload triggers), so every save replayed the last preview tap: the group tapped earlier reopened over the one being edited, with its first colour, and the preview outlined that region again.

**Fix.** A preview tap is acted on exactly once, when it happens (its sequence number is remembered). A tap on the region of the group already open only re-outlines it and keeps the open colour. The outlined region is state owned by the editor and flows down to both previews (laptop frame, phone overlay) as a prop, so the preview always follows the controls; the phone overlay scrolls to the open group's region when it opens.

## Measured, same scratch database, same throwaway admin, laptop viewport (`measure.mjs`)

Scenario: tap the footer in the preview (the Footer group opens), open **Category tabs** on the left and its **Tab text** colour, type a hex and press Enter (a save), sample every 100 ms for 3 s, then tap the tab bar inside the preview (the open group's own region).

| build | after the save | the colour being edited | preview outlines | tap on the open group's region |
|---|---|---|---|---|
| before, commit eab383f (`before.json`) | **jumped to Footer 117 ms after Enter**, the moment "Saved · Undo" appeared; still Footer at 3 s | **closed** | **the footer** | group stays, but the open colour **closes** (the first colour of the group is selected again) |
| after, this change (`after.json`) | Category tabs stays open through the save, the data reload and the preview reload (29 samples) | stays open | the tab bar | group and colour stay open |

Both runs saved the same colour (`#101010` on the gold category bar the scratch copy carried, accepted by the readability guard at 15:1) and undid it at the end. Screenshots: `before-after-save.jpg`, `after-after-save.jpg`.

The check suite replays the same scenario in the Style drill (`no-jump`), so it cannot come back unnoticed.
