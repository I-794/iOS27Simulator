# iOS 27 research notes (released behaviour, gathered day 2)

Sources are listed per item: search-result summaries of MacRumors, 9to5Mac, MacStories, Macworld, Apple Newsroom and Apple Support. Direct page fetches are blocked by this environment's network policy.

## Siri AI (biggest change)
- **Presentation:** Siri mostly lives in the **Dynamic Island**. The old glowing screen-edge animation is **gone**. Instead a floating **dark Liquid Glass orb** descends from the Dynamic Island, pulses while listening, and shows a multicolour waveform that reacts as you speak. While thinking, the orb shrinks into a pill with a loading indicator (the pill covers the island), then expands into a dark translucent overlay with text, images and app-specific cards. *(MacStories review; MacRumors Siri guide)*
- **Search or Ask:** a new interface that **replaces Spotlight**. Swipe down from the **middle / Dynamic Island** area, then type or speak. Results pop out of the Dynamic Island as a rich card, and concise answers stay in the island area. Swipe down on the response to see more, type a follow-up, or enter a conversation view that looks like an iMessage chat, with cards for weather, notes, appointments and more. It also includes a revamped Siri Suggestions view: frequent apps, recent web searches, the weather forecast, and action shortcuts such as recording a voice memo. *(MacRumors "Search or Ask" leak and Siri guide)*
- **Siri app** (new): a card-style list of recent conversations across devices, with search, pinned conversations, image and document uploads, and both typing and voice. A ChatGPT option is available. *(MacRumors)*
- **Availability:** Siri AI is a **beta you join through a waitlist in Settings**. It needs an iPhone 15 Pro or later, works in English only at launch (French, Spanish, Portuguese, Japanese and Korean are expected in October 2026), is **not available in the EU** because of the DMA, and is excluded in China. It has daily usage limits, and expanded access will be paid in future. *(Apple Newsroom; Engadget; TechTimes)*
- **Delayed at launch:** Suggestions in Messages and AI password fixes. *(iDropNews / The Apple Post)*

## Gestures and notifications
The top edge now has three zones:
- **top-left:** Notification Center
- **centre / Dynamic Island:** Search or Ask
- **top-right:** Control Center

Incoming **notifications slide in from the left side** of the screen. *(MacRumors; allthings.how; Cult of Mac)*

## Liquid Glass
- **Where:** Settings › **Appearance** (a new section) › **Liquid Glass**.
- **How it works:** the slider runs from **More Clear** to **More Tinted**, with Apple's default at the midpoint. A live preview redraws as you drag.
- **Other refinements:** more uniform refraction, better contrast, and sharper, more detailed icons. *(MacRumors how-to; iDownloadBlog)*

## Lock Screen (MacRumors "five new features")
1. **Extend** a wallpaper photo with Apple Intelligence so it fills the screen.
2. A **compact clock**: small time alongside the date and widgets at the top. The option is in the top-right of the Font & Color panel.
3. **AI-generated wallpapers** made in Image Playground.
4. The **Liquid Glass opacity** setting affects the clock, buttons, widgets and notifications.
5. **Dismiss Now Playing:** swipe left, then Clear. Music **keeps playing**.

## Home Screen
- A new **extra-large widget** size gives full-screen widgets for Music, Photos, Weather and Calendar. *(MacRumors 50 new things)*

## Camera *(9to5Mac)*
- **Siri mode:** Visual Intelligence in the viewfinder. Examples: translate text, add an event flyer to Calendar, plant care, nutrition info.
- **Customizable controls:** a six-dot icon at the bottom-right opens the controls panel, and **Edit** lets you pin controls to the top row.
- **Pro controls on iPhone 18 Pro:** aperture, shutter speed, white balance and histogram.

## Photos
- **Spatial Reframing:** change composition and perspective after capture, generating any areas that are exposed.
- **Extend:** expand a photo beyond its original frame.
- **Clean Up** was rebuilt, with **Fast, High Quality and Auto** options.
- A **Captured by Me** utility gathers Camera shots, excluding screenshots and memes.

## Other released features
- **Messages:** reply inline to a specific **Android/RCS** message; suggested replies are back.
- **Safari:** AI organizes tabs by topic; **Notify Me** watches for price changes and restocks; **Describe an Extension** creates an extension from plain language.
- **Image Playground:** photorealistic style, plus Lock Screen wallpapers.
- **AirPods:** adjustable **EQ**.
- **Clock:** an **independent alarm volume**.
- **Wallet:** redesigned passes (membership, gift, loyalty and rewards) with Poster layouts.
- **Parental controls:**
  - At child setup, choose essential apps only, a recommended set, or a custom selection.
  - **Ask to Browse** is on by default for children under 13; parents approve in Messages or on the child's device.
  - **Time Allowances** by category (Entertainment, Games, Social Media).
  - Category schedules by time window.
  - Approved contacts.
  - Every device in the family group needs version 27.
- **iPhone Handoff:** use two iPhones with the same phone number.
- **CarPlay video** through AirPlay.
- **Performance** (Apple's claims, each from a different test): app launches up to **30%** faster, photos reach iCloud Photos up to **70%** sooner, **AirDrop** up to **80%** faster and quicker to find people, and Files transfers up to **50%** faster.

## What this changed in the simulator
- Siri overlay: edge glow replaced by the Dynamic Island orb and response card; Search or Ask replaces Spotlight; new top-edge gesture zones; banners slide in from the left. *(shell)*
- Liquid Glass moved to Settings › Appearance with More Clear / More Tinted labels. *(Settings, agent D)*
- Camera customizable controls and Pro controls; the Clean Up Auto option. *(agent B)*
- Now Playing dismissal no longer pauses music; the Lock Screen has a compact clock and Extend. *(shell)*
- Full-screen XL widgets for Music, Photos, Weather and Calendar. *(shell)*
