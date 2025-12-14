# GTM Setup Guide for TCAD Scraper Showcase App

**Measurement ID**: `G-ECH51H8L2Z`
**Purpose**: Drive traffic to IntegrityStudio
**Generated**: December 10, 2025

---

## Quick Overview

| What's Tracked | GA4 Event Name | Trigger |
|----------------|----------------|---------|
| All page views | `page_view` | All Pages (automatic) |
| Form submissions | `generate_lead` | Form Submission - All Forms |
| Phone clicks | `phone_click` | Click - Phone Links |
| Email clicks | `email_click` | Click - Email Links |
| CTA button clicks | `cta_click` | Click - CTA Buttons |
| IntegrityStudio clicks | `outbound_click` | Click - External Links to IntegrityStudio |
| Thank you page views | `conversion` | Page View - Thank You Page |
| Key page views | `key_page_view` | Page View - Key Pages |
| 50% scroll | `scroll_50` | Scroll Depth - 50% |
| 90% scroll | `scroll_90` | Scroll Depth - 90% |

---

## Step 1: Import Triggers (5 minutes)

### 1.1 Go to Google Tag Manager
1. Open [tagmanager.google.com](https://tagmanager.google.com)
2. Select your container (or create new: Web container)

### 1.2 Import the Triggers File
1. Click **Admin** (gear icon) in the left sidebar
2. Under "Container", click **Import Container**
3. Click **Choose container file** and select:
   ```
   gtm-container-triggers.json
   ```
4. Select **Existing** workspace (or create new)
5. Choose **Merge** → **Rename conflicting tags, triggers, and variables**
6. Click **Confirm**

### 1.3 Verify Import
After import, you should see:
- **1 Tag**: Conversion Linker
- **10 Triggers**: All Pages, Form Submission, Phone/Email Clicks, CTA Buttons, IntegrityStudio Links, Thank You Page, Key Pages, Scroll Depth 50%/90%
- **7 Variables**: Click URL, Click Text, Click Classes, Form ID, Page Path, Page URL, Scroll Depth Threshold
- **20 Built-in Variables**: Enabled for clicks, forms, scroll tracking

---

## Step 2: Create GA4 Configuration Tag (2 minutes)

This is the **base tag** that must fire first on every page.

### 2.1 Create the Tag
1. Go to **Tags** → **New**
2. Click **Tag Configuration** → **Google Analytics** → **Google Tag**
3. Enter **Tag ID**: `G-ECH51H8L2Z`

### 2.2 Configure Trigger
1. Click **Triggering** → Select **All Pages**

### 2.3 Advanced Settings
1. Expand **Advanced Settings**
2. Set **Tag firing priority**: `100` (ensures this fires first)

### 2.4 Save
1. Name the tag: `GA4 - Configuration`
2. Click **Save**

---

## Step 3: Create GA4 Event Tags (10 minutes)

Create each event tag below. All follow the same pattern:
1. Tags → New → Google Analytics: GA4 Event
2. Configuration Tag: Select `GA4 - Configuration`
3. Add event name and parameters
4. Select trigger
5. Save

### 3.1 Form Submission (generate_lead)

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `generate_lead` |
| **Event Parameters** | |
| - form_id | `{{Form ID}}` |
| - page_path | `{{Page Path}}` |
| **Trigger** | Form Submission - All Forms |
| **Tag Name** | `GA4 - Event - Form Submit` |

### 3.2 Phone Click

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `phone_click` |
| **Event Parameters** | |
| - link_url | `{{Click URL}}` |
| - page_path | `{{Page Path}}` |
| **Trigger** | Click - Phone Links |
| **Tag Name** | `GA4 - Event - Phone Click` |

### 3.3 Email Click

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `email_click` |
| **Event Parameters** | |
| - link_url | `{{Click URL}}` |
| - page_path | `{{Page Path}}` |
| **Trigger** | Click - Email Links |
| **Tag Name** | `GA4 - Event - Email Click` |

### 3.4 CTA Button Click

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `cta_click` |
| **Event Parameters** | |
| - button_text | `{{Click Text}}` |
| - click_classes | `{{Click Classes}}` |
| - page_path | `{{Page Path}}` |
| **Trigger** | Click - CTA Buttons |
| **Tag Name** | `GA4 - Event - CTA Click` |

### 3.5 IntegrityStudio Outbound Click

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `outbound_click` |
| **Event Parameters** | |
| - link_url | `{{Click URL}}` |
| - link_text | `{{Click Text}}` |
| - page_path | `{{Page Path}}` |
| **Trigger** | Click - External Links to IntegrityStudio |
| **Tag Name** | `GA4 - Event - IntegrityStudio Click` |

### 3.6 Thank You Page Conversion

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `conversion` |
| **Event Parameters** | |
| - page_path | `{{Page Path}}` |
| - conversion_type | `form_complete` |
| **Trigger** | Page View - Thank You Page |
| **Tag Name** | `GA4 - Event - Conversion` |

### 3.7 Key Page View

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `key_page_view` |
| **Event Parameters** | |
| - page_path | `{{Page Path}}` |
| **Trigger** | Page View - Key Pages |
| **Tag Name** | `GA4 - Event - Key Page` |

### 3.8 Scroll Depth 50%

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `scroll_50` |
| **Event Parameters** | |
| - page_path | `{{Page Path}}` |
| - scroll_depth | `50` |
| **Trigger** | Scroll Depth - 50% |
| **Tag Name** | `GA4 - Event - Scroll 50%` |

### 3.9 Scroll Depth 90%

| Setting | Value |
|---------|-------|
| **Tag Type** | Google Analytics: GA4 Event |
| **Configuration Tag** | GA4 - Configuration |
| **Event Name** | `scroll_90` |
| **Event Parameters** | |
| - page_path | `{{Page Path}}` |
| - scroll_depth | `90` |
| **Trigger** | Scroll Depth - 90% |
| **Tag Name** | `GA4 - Event - Scroll 90%` |

---

## Step 4: Test in Preview Mode (5 minutes)

### 4.1 Enter Preview Mode
1. Click **Preview** button (top right)
2. Enter your website URL
3. Click **Connect**

### 4.2 Test Each Event
1. **Page Load**: Verify `GA4 - Configuration` fires
2. **Scroll**: Scroll down 50% and 90%, check tags fire
3. **Click CTA buttons**: Verify `GA4 - Event - CTA Click` fires
4. **Click phone/email links**: Verify respective tags fire
5. **Submit a form**: Verify `GA4 - Event - Form Submit` fires
6. **Click IntegrityStudio links**: Verify outbound click fires

### 4.3 Check GA4 DebugView
1. Go to [analytics.google.com](https://analytics.google.com)
2. Navigate to **Admin** → **DebugView**
3. Watch events appear in real-time as you test

---

## Step 5: Publish (1 minute)

### 5.1 Submit Changes
1. Click **Submit** (top right)
2. Add version name: `Initial GA4 Setup - Dec 2025`
3. Add description:
   ```
   GA4 tracking with:
   - Page views
   - Form submissions (generate_lead)
   - Phone/email clicks
   - CTA button clicks
   - IntegrityStudio outbound clicks
   - Key page tracking
   - Scroll depth (50%, 90%)
   ```
4. Click **Publish**

---

## Step 6: Mark Events as Conversions in GA4 (2 minutes)

### 6.1 Configure Conversions
1. Go to [analytics.google.com](https://analytics.google.com)
2. Select your property
3. Go to **Admin** → **Events**
4. Wait for events to appear (may take up to 24 hours)
5. Toggle **Mark as conversion** for:
   - `generate_lead`
   - `conversion`
   - `outbound_click` (IntegrityStudio clicks - your main goal!)
   - `phone_click`

---

## Verification Checklist

After setup, verify in GA4:

- [ ] **Realtime Report**: Shows active users and events
- [ ] **DebugView**: Events appear when testing
- [ ] **Events Report**: All custom events listed
- [ ] **Conversions**: Key events marked as conversions

---

## Tag Summary

| Tag Name | Event | Trigger | Priority |
|----------|-------|---------|----------|
| GA4 - Configuration | (base) | All Pages | 100 |
| Conversion Linker | (attribution) | All Pages | - |
| GA4 - Event - Form Submit | generate_lead | Form Submission | - |
| GA4 - Event - Phone Click | phone_click | Phone Links | - |
| GA4 - Event - Email Click | email_click | Email Links | - |
| GA4 - Event - CTA Click | cta_click | CTA Buttons | - |
| GA4 - Event - IntegrityStudio Click | outbound_click | IntegrityStudio Links | - |
| GA4 - Event - Conversion | conversion | Thank You Page | - |
| GA4 - Event - Key Page | key_page_view | Key Pages | - |
| GA4 - Event - Scroll 50% | scroll_50 | Scroll 50% | - |
| GA4 - Event - Scroll 90% | scroll_90 | Scroll 90% | - |

**Total**: 11 tags, 10 triggers

---

## Troubleshooting

### Tags not firing?
1. Check Preview mode for errors
2. Verify trigger conditions match your page
3. Ensure GA4 Configuration tag fires first (priority 100)

### Events not in GA4?
1. Events can take 24-48 hours to appear in reports
2. Use DebugView for immediate verification
3. Check that your measurement ID is correct: `G-ECH51H8L2Z`

### CTA buttons not tracked?
The regex pattern matches: get started, contact, learn more, sign up, try, demo, schedule, book, request, submit, download

To add more button text, edit the trigger:
1. Go to **Triggers** → **Click - CTA Buttons**
2. Modify the regex to include your button text

---

## Files Created

1. `gtm-container-triggers.json` - Import file with triggers and Conversion Linker
2. `GTM-SETUP-GUIDE.md` - This setup guide

---

**Setup Time**: ~20 minutes total
