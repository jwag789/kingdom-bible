# Kingdom Bible on the App Store

A step-by-step for the first submission of the iPhone/iPad app (version 1.0, build 1).
Bundle ID `com.kingdomwebbuilders.kingdombible`. Screenshots are in `docs/app-store/screenshots/`.

## 1. Build and upload (Xcode)

1. Use Node 22 (the Capacitor CLI refuses Node 20): `nvm use 22`, then `npm run ios`. This builds
   `dist/`, copies it into the iOS project and opens Xcode.
2. **Xcode → Settings → Accounts**: add the Apple ID that's enrolled in the Apple Developer Program.
3. Select the **App** target → **Signing & Capabilities**. Leave "Automatically manage signing"
   on and pick your **Team**. Xcode registers the bundle ID and creates the certificates and
   profiles. (Today the project has no team, so device and archive builds stop with
   "Signing for App requires a development team". That's the only build error. The simulator
   build and an unsigned device build are both clean.)
4. **Version** 1.0 and **Build** 1 are set on the target's General tab. Raise the build number
   for every upload (1, 2, 3…). Raise the version only for a new release.
5. Run it on a real iPhone once before uploading:
   - Record a family voice. iOS should ask for the microphone with the text from
     Info.plist (the simulator doesn't show this prompt).
   - Turn the silent switch on and play a story. Narration and music should still be heard.
6. Pick the destination **Any iOS Device (arm64)** → **Product → Archive** → in the Organizer,
   **Distribute App → App Store Connect → Upload**. Encryption export compliance is already
   answered in Info.plist (`ITSAppUsesNonExemptEncryption = NO`), so the build won't wait on it.

Already in place: the app icon (1024×1024, no transparency), the launch screen, the microphone
usage text, `PrivacyInfo.xcprivacy` (no tracking, no required-reason APIs, audio and the reader's
name collected for app functionality only), iPhone and iPad support, and arm64.

## 2. Create the app record (App Store Connect → Apps → +)

| Field | Value |
|---|---|
| Platform | iOS |
| Name | Kingdom Bible |
| Primary language | English (U.S.) |
| Bundle ID | com.kingdomwebbuilders.kingdombible (shows up once Xcode has registered it) |
| SKU | kingdom-bible-ios (anything unique; never shown to customers) |
| User access | Full access |

## 3. App Information

- **Subtitle** (30 max): `Bible Stories Kids Can Touch`
- **Category**: see "Kids category or not" below. Recommendation: **Education** primary,
  **Books** secondary.
- **Content rights**: answer "Yes, it contains third-party content, and I have the rights". The
  Bible text is the Berean Standard Bible (public domain), and the narration was made with
  Kokoro (open-source voice model).
- **Age rating**: fill in the questionnaire with *None/No* everywhere: no ads, no web browsing,
  no chat, no user-generated content anyone can browse, no purchases. One judgment call is
  **Cartoon or Fantasy Violence**. The stories include Goliath, the Red Sea, Jericho and Easter.
  If the pictures show these gently, with nothing graphic on the page, *None* is honest and the
  rating comes out **4+**. If you feel any page does show violence, choose *Infrequent/Mild*,
  which makes it 9+.
- **Privacy Policy URL**: https://jwag789.github.io/kingdom-bible/privacy/

### Kids category or not

The Kids category gets the app into the Kids section of the App Store, but it brings stricter
rules (App Review Guidelines 1.3 and 5.1.4), and Apple doesn't let you move an app out of it
casually later. Where Kingdom Bible stands against those rules:

| Rule | Kingdom Bible |
|---|---|
| No third-party ads or analytics | ✅ none |
| Links out of the app and purchases behind a parental gate | ✅ no links out, no purchases; the share sheet sits behind the grown-up check |
| No personal or device data sent to third parties | ⚠️ shared recordings and the reader's name go to Supabase (as your storage provider, only when a grown-up sends one) |
| The parental gate must be something a child can't do | ⚠️ the gate is adding two numbers (6+5 up to 12+12). Reviewers sometimes reject sums a 7–8-year-old can do |

**Recommendation:** launch 1.0 in **Education** with a 4+ rating, outside the Kids category.
Parents still find it by search and by category, and the review is simpler. If you want the Kids
category later, first make the gate harder (for example, typing a number written in words,
"forty-seven"). Then pick the age band (5 and under, or 6–8) and resubmit.

## 4. App Privacy (App Store Connect → App Privacy)

- **Do you or your third-party partners collect data from this app?** Yes. A recording sent to
  family is stored, so it counts as collected.
- Data types (both under **User Content**):
  - **Audio Data**: used for *App Functionality*. Linked to the user's identity? **No**. Used for
    tracking? **No**.
  - **Other User Content** (the reader's name, such as "Grandma"): *App Functionality*. Not linked.
    Not used for tracking.
- Nothing else: no contact info, identifiers, usage data, diagnostics, location or purchases.
- The result reads "Data Not Linked to You: User Content". These answers match the privacy
  manifest in the app and the privacy policy page. Keep the three in step if anything changes.

## 5. Version page (iOS App 1.0)

**Promotional text** (170 max; can be changed any time without review):

> Bible stories in cut-paper pictures that come alive when little fingers tap them, read aloud with music, with a game at the end of every story.

**Description:**

> Kingdom Bible tells the great stories of the Bible in cut-paper pictures that move when little fingers tap them, read aloud with music. Each story has a game at the end.
>
> 25 STORIES, FROM CREATION TO THE FIRST CHURCH
> In the Beginning, Noah's Ark, Joseph's Colorful Coat, Baby Moses, the Red Sea, David and Goliath, Jonah, Christmas, Zacchaeus, Easter, Pentecost and many more, in the order they happened.
>
> PICTURES YOU CAN TOUCH
> Tap the picture and things happen: the sea parts, the stars come out, animals march two by two. Every page has little surprises to find.
>
> READ ALOUD, WITH MUSIC
> A warm narrator reads every page while the words light up, with gentle music and sounds made for each scene, so pre-readers can follow along on their own.
>
> A GAME FOR EVERY STORY
> Count the stars with Abraham, match the animals Adam named, march around Jericho. Win a gold badge for each one.
>
> STICKERS AND A KINGDOM TO BUILD
> Stickers are hidden in the pictures, little lambs wait to be found, and every finished story adds people, animals and places to your child's own paper kingdom.
>
> MADE FOR READING TOGETHER
> • Read it in your own voice: record a story page by page and the app reads it back in your voice. Send it to grandparents so they can listen.
> • Real Bible verses one tap away, from the Berean Standard Bible.
> • Questions to talk about and a memory verse at the end of every story.
> • Bedtime mode with softer pictures and calmer music.
>
> SAFE BY DESIGN
> Free. No ads, no accounts, no tracking, nothing to buy. Grown-up features sit behind an "ask a grown-up" check.

**Keywords** (100 max, comma-separated, no spaces after commas; leave out "Kingdom" and "Bible"
because the name is already searched):

```
children,kids,storybook,read aloud,bedtime,toddler,preschool,christian,jesus,noah,sunday school
```

- **Support URL**: https://jwag789.github.io/kingdom-bible/about/
- **Marketing URL** (optional): https://jwag789.github.io/kingdom-bible/about/
- **Copyright**: `2026 Kingdom Web Builders`

### Screenshots

Upload in this order (the first three show in search results):

1. `03-read-to-me` · 2. `01-home` · 3. `05-game` · 4. `07-kingdom` · 5. `06-me` (reading time,
stickers, badges) · 6. `04-library` · 7. `02-story-cover` (shows "Read by: Grandma") ·
8. `08-talk-about-it`

| App Store Connect slot | Folder | Size |
|---|---|---|
| iPhone 6.9" | `screenshots/iphone-6.9/` | 1320 × 2868 |
| iPhone 6.3" (if asked) | `screenshots/iphone-6.3/` | 1206 × 2622 |
| iPad 13" | `screenshots/ipad-13/` | 2064 × 2752 |

Apple scales the 6.9" and 13" sets down for smaller devices. Upload the 6.3" set only if App
Store Connect asks for that size; Apple's page wording on which iPhone size is required changed
recently. All are JPEG with no transparency, taken from the iOS 27.2 simulators.

### App Review Information

- **Sign-in required**: No.
- **Contact**: your name, phone, admin@kingdomwebbuilders.com
- **Notes**:

> No account needed. To try the grown-up feature: open any story, tap "Read it in your own voice", answer the sum in the "Ask a grown-up" check, pick a name, and record. The microphone is used only while recording. "Send to family" uploads that recording (and the name typed for it) to our Supabase storage and opens the share sheet. Nothing is uploaded otherwise. There are no ads, analytics, purchases or links out of the app.

### Build, pricing, submit

1. **Build**: choose the build uploaded in step 1 (it shows up 5–30 minutes after upload).
2. **Pricing and Availability**: Free, all countries (or limit them).
3. **Add for Review** → **Submit**. Reviews usually take a day or two. If it's rejected, the
   reasons appear in App Store Connect under the version.

## Not covered yet

- The tip jar. It's hidden in the app. A tip collected inside the app has to be an in-app
  purchase (guideline 3.1.1), so don't link the website's tip jar from the app.
- Android: its launcher icons are still the original darker icon.
