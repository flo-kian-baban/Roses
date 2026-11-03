# Real-phone test

For Kian and the manager, before go-live. About 45 minutes for both phones.

Run every step on **an iPhone with Safari** and **an Android phone with Chrome**. Tick *Pass* or write down what went wrong under the step. Take a screenshot of every problem and name it with the step number and the phone, for example `07-iphone.png`.

| | iPhone | Android |
|---|---|---|
| Phone model | | |
| iOS / Android version | | |
| Browser and version | Safari | Chrome |
| Wi-Fi or mobile data | | |
| Date and time of the test | | |
| Tested by | | |

## Before you start

- **The address.** Use the live address once hosting is set up. Until then the menu runs on Kian's laptop, and both phones must be on the same Wi-Fi as the laptop: open `http://<laptop address>:3000/senso` (runbook, "On a phone on the same Wi-Fi"). Port 3000 listens only on the laptop itself at the moment, so ask for it to be opened to the Wi-Fi for the test and closed again afterwards.
- **A test PIN.** Kian signs in to the admin on the laptop, opens **Team**, creates a **staff** PIN for Senso named "Phone test" and writes it on paper. Revoke it when the test is over (step 16).
- **A first visit.** Open the menu in a **private tab** (Safari: Tabs → Private; Chrome: ⋮ → New Incognito tab), so the phone has not remembered a language yet.
- Keep the printed **Fall Menu card** next to you for step 4.

## Customers' menu

### 1. The welcome screen (Senso)
**Do:** open the Senso address in a private tab.
**Pass:** within about 2 seconds a full-screen welcome appears with the Senso logo, a greeting for the time of day in English and Persian ("Good morning / Good afternoon / Good evening"), and two big buttons, *English* and *فارسی*. Until 30 November leaves fall gently behind the card (from 1 December it is snow). Neither button is highlighted on this first visit. Nothing flickers or jumps.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 2. Into the menu
**Do:** tap *English*.
**Pass:** the menu is there at once, from the top of the page: the logo and a language button in the header, the row of section names under it, then the first section. The welcome screen goes away in under a second, and you can scroll while it is still fading.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 3. Browse the whole menu
**Do:** scroll slowly from the top to the bottom with your thumb, then flick back up.
**Pass:** the row of section names stays at the top; the underlined name always matches the section you are reading and slides into view by itself; photos appear (a grey square for a moment at most, never a broken-image icon); no text is cut off at the right edge; the page never moves sideways.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 4. Fall Menu against the printed card
**Do:** at the top, compare the *Fall Menu* section with the printed card.
**Pass:** six items in the card's order (Pumpkin Soup, Senso Pumpkin Omelette, Pumpkin Cheesecake, Pumpkin Cake, Pumpkin Latte, Warm Pumpkin & Ice Cream) with the card's prices. From 1 December this section is gone: that is expected.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 5. An item's popup, and closing it
**Do:** tap *Pumpkin Soup*. Close it with the ✕. Open it again and close it by tapping the dark area above it. Open it again and use the phone's Back (Android: back gesture or button; iPhone: swipe from the left edge).
**Pass:** the popup slides up from the bottom with a large photo, the name, the price and the description. Each way of closing slides it back down and leaves the menu where you were. *Good to know* (allergens) appears only on items whose notes the owner has confirmed.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 6. Two long popups in a row
**Do:** open *Brewing Coffee* (sizes and milk choices), scroll to the bottom of its popup, close it with the ✕, then open *Latte*.
**Pass:** the second popup opens at its top: the photo, the name and the ✕ are visible. (The audit saw it open half-way down on Safari; this step checks it on a real iPhone.)
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 7. The section list
**Do:** tap the list icon (≡) at the start of the row of section names. Tap *Fresh Juice*.
**Pass:** a list of all sections slides up and covers at most three quarters of the screen, with a *Close* button at the top. Tapping *Fresh Juice* closes the list and brings you to the Fresh Juice heading, with *Fresh Juice* underlined in the row.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 8. Persian
**Do:** tap the language button in the header to switch to Persian. Scroll a little, open an item, open the section list.
**Pass:** the whole page reads right to left: the section names start from the right, the list icon is on the right, item names and descriptions are in Persian (an item with no Persian text shows its English name), prices keep Western digits ($7.99). The popup and the section list are in Persian too, and the list's *Close* is on the right.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 9. Reload remembers the language
**Do:** reload the page.
**Pass:** the welcome screen comes back with *فارسی* already highlighted; tapping it opens the menu in Persian, from the top.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 10. Footer and tap-to-call
**Do:** scroll to the very bottom. Tap a phone number, then cancel the call.
**Pass:** each location's address, hours and phone number are right; the general allergy notice is there in the page's language; the phone offers to call exactly the number shown. Nothing is hidden behind the bottom bar of the browser.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 11. Kebab Land
**Do:** open the Kebab Land address in a private tab and repeat steps 1, 2, 3, 5 and 10 quickly.
**Pass:** its own look (white logo on a dark tile, its own colours), not Senso's. No Fall Menu section (Kebab Land has no fall items). The footer shows both addresses: dine-in at 9218 Yonge St and take-out at 9108 Yonge St, each with the right phone number.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 12. Bigger text and less motion
**Do:** (a) Bigger text. iPhone: in Safari tap *aA* in the address bar and choose 150 %. Android: Settings → Display → Font size at the largest, then reload. Browse, open a popup and the section list. (b) Less motion. iPhone: Settings → Accessibility → Motion → *Reduce Motion* on. Android: Settings → Accessibility → *Remove animations* on. Reload the menu. Put both settings back afterwards.
**Pass:** (a) all text is readable, nothing overlaps or is cut off, every button can still be tapped. (b) the welcome screen shows still leaves instead of falling ones, the menu appears without a fade, and popups appear without sliding.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 13. Sharing the link
**Do:** send the Senso address and the Kebab Land address to yourself in WhatsApp, and in Messages on the iPhone.
**Pass:** write down what the preview shows (title, text, picture). Expected today: the venue's name and "Menu" and a short text, but no picture, because the pages have no preview image yet (audit proposal). Only the live address can show a preview; a laptop address on Wi-Fi shows none.
- [ ] iPhone noted  - [ ] Android noted
- What the preview showed:

## Admin, as staff

### 14. Sign in
**Do:** open `<address>/admin/senso`. Type a wrong PIN once, then the "Phone test" PIN.
**Pass:** the wrong PIN gives a clear message; the right one opens the menu editor for Senso with its sections, search and the *Preview* button. Never type a wrong PIN five times: that locks this phone out of Senso's sign-in for 15 minutes.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 15. Everyday edits
**Do:** (a) Tap an item's price, type a new price, press Done or Enter. (b) Tap *Undo* on the "Saved · Undo" message. (c) Hide an item with its switch, then show it again. (d) On a section, tap *+ Add item*, type a name and a price, add a photo from the phone, then hide the new item. (e) Open an item and look at *Allergens & diet*. After each change, check the customers' page in another tab (or the *Preview* button).
**Pass:** every change shows "Saved · Undo" and reaches the customers' page within 10 seconds; Undo puts the old value back; the photo appears on the item; staff see that allergens are set by the owner or an admin, without being able to change them. Every word on the screen makes sense to someone who has never used the admin.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

### 16. No connection, then clean up
**Do:** turn on airplane mode, change a price, wait 10 seconds. Turn airplane mode off and do what the screen suggests. Then: delete the test item (item → *Other* → *Delete*), and on the laptop revoke the "Phone test" PIN in **Team**.
**Pass:** with no connection the admin says clearly that the change was not saved and offers a way to try again; once the connection is back the change saves (check the customers' page). Nothing saves silently or vanishes without a message. The test item is gone and the PIN shows as revoked.
- [ ] iPhone pass  - [ ] Android pass
- Problems:

## Problems found

| Step | Phone | What happened | Screenshot |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
