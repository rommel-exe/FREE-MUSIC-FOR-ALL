# Apple macOS 26 (Tahoe) Liquid Glass Design System

> Extracted from `Apple macOS 26 UI Kit.sketch` — Single source of truth for app UI.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Materials (Liquid Glass)](#2-materials-liquid-glass)
3. [Typography](#3-typography)
4. [Component Sizes](#4-component-sizes)

---

## 1. Color System

### 1.1 Semantic Label Colors

#### Light Mode (Over Light Backgrounds)

| Token | Effective Hex | Definition |
|-------|---------------|------------|
| **label.primary** | `#191919` | `#000000 @ 85% opacity` |
| **label.secondary** | `#727272` | `#000000 @ 50% opacity` |
| **label.tertiary** | `#BEBEBE` | `#000000 @ 25% opacity` |
| **label.quaternary** | `#D9D9D9` | `#000000 @ 10% opacity` |
| **label.quinary** | `#E6E6E6` | `#000000 @ 5% opacity` |
| **label.seximal** | — | `#000000 @ 3% opacity` |

#### Dark Mode (Over Dark Backgrounds)

| Token | Effective Hex | Definition |
|-------|---------------|------------|
| **label.primary** | `#F4F4F4` | `#FFFFFF` |
| **label.secondary** | `#898989` | `#FFFFFF @ 55% opacity` |
| **label.tertiary** | `#404040` | `#FFFFFF @ 25% opacity` |
| **label.quaternary** | `#252525` | `#FFFFFF @ 10% opacity` |
| **label.quinary** | `#111111` | `#FFFFFF @ 5% opacity` |
| **label.seximal** | — | `#FFFFFF @ 3% opacity` |

### 1.2 Background Colors

#### Light Mode

| Token | Hex | Notes |
|-------|-----|-------|
| **background.primary** | `#FBFBFB` | |
| **background.secondary** | `#F6F6F6` | |
| **background.tertiary** | `#F1F1F1` | |
| **background.quaternary** | `#E6E6E6` | |
| **background.quinary** | `#D9D9D9` | |

Tinted variants (alpha overlays on white):
- `#000000 @ 2%` through `#000000 @ 10%`

#### Dark Mode

| Token | Hex | Notes |
|-------|-----|-------|
| **background.primary** | `#070707` | |
| **background.secondary** | `#080808` | |
| **background.tertiary** | `#0D0D0D` | |
| **background.quaternary** | `#141414` | |
| **background.quinary** | `#232323` | |

Tinted variants (alpha overlays on black):
- `#FFFFFF @ 2%` through `#FFFFFF @ 10%`

### 1.3 Vibrant System Colors (Liquid Glass)

Two sets — standard and vibrant:

#### Standard Set

| Color | Dark Mode | Light Mode |
|-------|-----------|------------|
| **Red** | `#FF4245` | `#FF383C` |
| **Orange** | `#FF912F` | `#FF8C27` |
| **Yellow** | `#FFD600` | `#FFCC00` |
| **Green** | `#2FD157` | `#34C658` |
| **Teal** | `#00DAC2` | `#00C7B3` |
| **Blue** | `#00D2E0` | `#00C2D0` |
| **Indigo** | `#3CD3FE` | `#00BFE8` |
| **Purple** | `#0090FF` | `#0087FF` |
| **Pink** | `#6D7CFF` | `#6054F4` |
| **Indigo (2nd)** | `#DB34F1` | `#CB2FE0` |
| **Purple (2nd)** | `#FF375E` | `#FF2C54` |
| **Pink (2nd)** | `#B78966` | `#AC7F5D` |

#### Vibrant Set (used for tinted materials)

| Color | Dark Mode | Light Mode |
|-------|-----------|------------|
| **Red** | `#FF4747` | `#F42E31` |
| **Orange** | `#FF9E33` | `#F48524` |
| **Yellow** | `#FFE014` | `#F4C100` |
| **Green** | `#3BDB62` | `#25BE4D` |
| **Teal** | `#2CE0CD` | `#00BCA9` |
| **Blue** | `#2CD7E0` | `#00B3BE` |
| **Indigo** | `#47D8FB` | `#00ABCF` |
| **Purple** | `#0A99FF` | `#0078EF` |
| **Pink** | `#7162FF` | `#5B4FE6` |
| **Indigo (2nd)** | `#E647FB` | `#B72AC9` |
| **Purple (2nd)** | `#FF4169` | `#F4224B` |
| **Pink (2nd)** | `#C19572` | `#9E7353` |

### 1.4 Accent / Control Colors

| Usage | Color | Hex |
|-------|-------|-----|
| **Accent Blue (Active)** | System Blue | `#0087FF` |
| **Destructive Red** | System Red | `#FF383C` |
| **Separator** | Black @ alpha | See section 1.2 |

### 1.5 Fill Colors for Controls (Content Area)

| State | Color | Notes |
|-------|-------|-------|
| **Inactive fill** | `#000000 @ 8%` | Default button background |
| **Active/Accent fill** | `#0087FF` | Accent blue, solid |
| **Active @ 50%** | `#0087FF @ 50%` | Active bordered button overlay |
| **Disabled fill** | `#000000 @ 5%` | |
| **Selected/On fill** | `#000000 @ 13%` | Secondary button "on" state |
| **Secondary active** | `#0087FF @ 10%` | Secondary button active |
| **Destructive active** | `#FF383C @ 25%` | Destructive button active |

### 1.6 Fill Colors for Controls (Over-Glass)

| State | Color | Notes |
|-------|-------|-------|
| **Inactive fill** | `#000000 @ 10%` | Over-glass button background |
| **Active/Accent fill** | `#0087FF` | Accent blue, solid |
| **Disabled fill** | `#000000 @ 5%` | |
| **Selected/On fill** | `#000000 @ 13%` | |
| **Secondary active** | `#0087FF @ 10%` | |

---

## 2. Materials (Liquid Glass)

### 2.1 Material Tint Colors (Background Swatches)

Used for tinting the glass material. These are the background colors seen behind the glass.

**Over Dark Backgrounds:**
| Swatch | Hex |
|--------|-----|
| Green | `#18B516` |
| Blue | `#0E50CD` |
| Purple | `#4E0E9E` |
| Black | `#000000` |
| Gray | `#333333` |
| Light Gray | `#808080` |

**Over Light Backgrounds:**
| Swatch | Hex |
|--------|-----|
| Red | `#D30000` |
| Orange | `#FC7112` |
| Yellow | `#F8DF1A` |
| White | `#FFFFFF` |
| Silver | `#CCCCCC` |
| Gray | `#999999` |

### 2.2 Liquid Glass — Large UI (Dark Mode)

```
Background Fill 1: #000000 @ 40% opacity  (vibrancy layer)
Background Fill 2: #191919 solid           (base color)

Shadows:
  1. #000000 @ 12% | offset:(0, 8)  | blur:40  | spread:0   (drop shadow)
  2. #000000 @ 10% | offset:(0, 0)  | blur:2   | spread:0   (ambient)
  3. #000000 @ 10% | offset:(0, 0)  | blur:8   | spread:0   (ambient large)
  4. #4C4C4C       | offset:(-1.5,-1.5) | blur:0.25 | spread:-1.25 (inner highlight top-left)
  5. #191919       | offset:(-1.5,-1.5) | blur:0.25 | spread:0     (inner shadow top-left)
  6. #4C4C4C       | offset:(1.5, 1.5)  | blur:0.25 | spread:-1.25 (inner highlight bottom-right)
  7. #191919       | offset:(1, 1)       | blur:0.25 | spread:0     (inner shadow bottom-right)
```

### 2.3 Liquid Glass — Medium UI (Dark Mode)

```
Background Fill 1: #000000 @ 40% opacity  (vibrancy layer)
Background Fill 2: #111111 solid           (base color — slightly lighter than Large)

Shadows: Same as Large UI Dark Mode
```

### 2.4 Liquid Glass — Large UI (Light Mode)

```
Background Fill 1: #FFFFFF @ 70% opacity @ 50% gradient  (vibrancy)
Background Fill 2: #F9F9F9 solid                          (base color)

Shadows:
  1. #000000 @ 12% | offset:(0, 8)  | blur:40  | spread:0   (drop shadow)
  2. #000000 @ 20% | offset:(0, 0)  | blur:8   | spread:1   (ambient)
  3. #191919       | offset:(-1, -1) | blur:2   | spread:0   (inner shadow top-left)
  4. #191919       | offset:(1, 1)   | blur:2   | spread:0   (inner shadow bottom-right)
  5. #FFFFFF @ 70% | offset:(2, 2)   | blur:0.25 | spread:-1.5 (specular highlight)
  6. #000000 @ 10% | offset:(0, 0)   | blur:2   | spread:0   (ambient inner)
```

### 2.5 Liquid Glass — Medium UI (Light Mode)

```
Background Fill 1: #FFFFFF @ 70% opacity @ 50% gradient  (vibrancy)
Background Fill 2: #F9F9F9 solid                          (base color)

Shadows: Same as Large UI Light Mode
```

### 2.6 Small UI Components (Tinted Glass)

Both dark and light tinted variants share this structure:

```
Shadow Mask Layer: #D7D7D7 (shape mask for pill/rounded-rect)
Shadow Pill:       #000000 (cast shadow shape)
Background Blur:   #000000 @ 10% opacity  (behind the glass)

Glass Surface:
  Fill 1: #FFFFFF @ 70% (dark tinted) or #FFFFFF @ 40% (light tinted)
  Fill 2: #F9F9F9 solid

Glass Shadows (dark tinted):
  1. #000000 @ 10% | offset:(0,0) | blur:1 | spread:1
  2. #262626 | offset:(-1,-1) | blur:0.25 | spread:-0.25
  3. #4C4C4C | offset:(-1,-1) | blur:0.25 | spread:-0.25
  4. #4C4C4C | offset:(1,1)   | blur:0.25 | spread:-0.25
  5. #262626 | offset:(1,1)   | blur:0.25 | spread:-0.25

Tint Layer: System color applied as solid fill (e.g., #0090FF)

Extra Specular: #FFFFFF | offset:(2,2) | blur:0.25 | spread:-2
```

### 2.7 Sidebar Material (Inside Windows)

```
Sidebar Stack Fill:
  Fill 1: #FFFFFF @ 70% opacity (vibrancy/blur tint)
  Fill 2: #F9F9F9 solid (base)

Note: Sidebar sits inside a 256pt wide pane
      Stack padding: 8pt from each edge
      Content width: 240pt
```

---

## 3. Typography

### 3.1 Font Families Used

| Font | Usage |
|------|-------|
| **SF Pro** | Primary system font — all labels, buttons, menus |
| **SF Pro Rounded** | Search field placeholders and values |
| **SF Compact** | (Referenced for compact sizes) |

### 3.2 Font Sizes & Weights

| Size | Weight | Primary Usage |
|------|--------|---------------|
| **60pt** | Bold | Large display/artwork elements |
| **30pt** | Semibold | Section headers in content areas |
| **15pt** | Bold | Window title text |
| **15pt** | Medium | Sidebar text labels |
| **15pt** | Semibold | Toolbar detail labels |
| **13pt** | Medium | **Primary body text** — buttons, sidebar items, menus |
| **13pt** | Semibold | Active/selected button labels, sidebar highlights |
| **13pt** | Bold | Sidebar section titles |
| **13pt** | SF Pro Rounded Medium | Search field text |
| **11pt** | Medium | Secondary text — smaller controls, detail labels |
| **11pt** | Semibold | Compact button labels |
| **11pt** | Bold | Emphasized compact labels |
| **11pt** | SF Pro Rounded Medium | Compact search field text |
| **10pt** | Medium | Toolbar icon labels, small metadata |
| **10pt** | Bold | Toolbar button labels |
| **10pt** | Semibold | Toolbar symbol labels |

### 3.3 Text Colors by Context

| Context | Light Mode | Dark Mode |
|---------|------------|-----------|
| **Primary label** | `#191919` (black @ 85%) | `#F4F4F4` (white) |
| **Secondary label** | `#727272` (black @ 50%) | `#898989` (white @ 55%) |
| **Tertiary label** | `#BEBEBE` (black @ 25%) | `#404040` (white @ 25%) |
| **Accent/tint text** | `#0078EF` (accent blue) | `#0078EF` (accent blue) |
| **Destructive text** | `#FF383C` (red) | `#FF383C` (red) |
| **Disabled text** | `#BEBEBE` (tertiary) | `#404040` (tertiary) |
| **Placeholder text** | `#727272` (secondary) | `#898989` (secondary) |
| **Window title** | `#4C4C4C` | `#4C4C4C` |

---

## 4. Component Sizes

### 4.1 Component Size Scale

macOS 26 uses a **5-tier size scale** for all controls:

| Scale | Label | Description |
|-------|-------|-------------|
| 1 | **1 Mn** (Mini) | Smallest usable size |
| 2 | **2 Sm** (Small) | Compact UIs |
| 3 | **3 Md** (Medium) | **Default / standard size** |
| 4 | **4 Lg** (Large) | Generous spacing |
| 5 | **5 XL** (Extra Large) | Accessibility / touch targets |

### 4.2 Windows

| Variant | Width | Height | Notes |
|---------|-------|--------|-------|
| **Full Window (Toolbar)** | 1000 | 600 | Standard app window with toolbar |
| **Full Window (Toolbar + Titlebar)** | 1000 | 600 | Titlebar (32pt) + Toolbar below |
| **Full Window (Titlebar only)** | 1000 | 600 | Titlebar (32pt), no toolbar |
| **Full Window (Monobar)** | 1000 | 600 | Compact monobar (40pt) |
| **Utility Panel** | 280 | 400 | Floating utility panel |
| **Sidebar Width** | 256 | — | Left pane width |
| **Sidebar Content Width** | 240 | — | Stack width (256 - 2×8 padding) |

**Window Frame Heights:**

| Element | Height |
|---------|--------|
| Titlebar (standalone) | **32pt** |
| Toolbar (standalone) | **40pt** (Monobar) or **52pt** |
| Titlebar + Toolbar combined | 32pt title + toolbar below |
| Right Pane Content | Total - sidebar width |
| Scrollbar Width | **12pt** |
| Content Fade | **90pt** (top gradient) |

**Traffic Lights (Window Controls):**

| Variant | Width | Height | Position |
|---------|-------|--------|----------|
| Standard Window | 62 | 16 | x:8, y:(titlebar_height - 16) |
| Utility Panel | 50 | 16 | x:4, y:(titlebar_height - 16) |
| Button spacing | **8pt** between each dot |

### 4.3 Titlebars and Toolbars

| Element | Width | Height |
|---------|-------|--------|
| **Toolbar Button** (Large) | 36 | 36 |
| **Toolbar Button** (Medium/Monobar) | 24 | 24 |
| **Toolbar Button Group** (5 buttons) | 132 | 36 |
| **Toolbar Button Group** (monobar) | 96 | 24 |
| **Search Field** (in toolbar, large) | 159 | 36 |
| **Search Field** (in toolbar, monobar) | 149 | 24 |
| **Stoplight Group** (standard) | 62 | 16 |
| **Stoplight Group** (utility) | 50 | 16 |
| **Window Title** | 318-365 | 18 |
| **Title + Subtitle** | 96 | 33 |
| **Title Only** | 96 | 18 |
| **Title + Symbol** | 117 | 18 |
| **Utility Title** | 85 | 15 |
| **Toolbar Separator** | 3 | 22 |

### 4.4 Buttons

#### Push Buttons (Bordered Default/Colored/Destructive/Secondary/Neutral)

| Size | Width | Height | Font Size |
|------|-------|--------|-----------|
| **1 Mn** | 41 | 16 | 10pt Medium |
| **2 Sm** | 44 | 20 | 11pt Medium |
| **3 Md** | 50 | 24 | 13pt Medium |
| **4 Lg** | 50 | 28 | 13pt Medium |
| **5 XL** | 50 | 36 | 13pt Medium |

> Note: Widths shown are for standard text labels like "OK". Actual width varies with text.

#### Borderless Buttons

| Size | Width | Height |
|------|-------|--------|
| **1 Mn** | 83 | 16 |
| **2 Sm** | 87 | 20 |
| **3 Md** | 100 | 24 |
| **4 Lg** | 100 | 28 |
| **5 XL** | 100 | 36 |

#### Button Fill Colors by State

| State | Content Area | Over-Glass |
|-------|-------------|------------|
| **Inactive, Off** | `#000000 @ 5%` | `#000000 @ 5%` |
| **Inactive, On (selected)** | `#000000 @ 13%` | `#000000 @ 10%` |
| **Active, Off** | `#0087FF @ 10%` | `#0087FF @ 10%` |
| **Active, On** | `#0087FF` (solid) | `#0087FF` (solid) |
| **Active, Off (bordered)** | `#0087FF @ 50%` | `#0087FF` |
| **Disabled** | `#000000 @ 5%` | `#000000 @ 5%` |

### 4.5 Search Fields

| Size | Width | Height | Font |
|------|-------|--------|------|
| **1 Mn** | 120 | 16 | SF Pro Rounded Medium 11pt |
| **2 Sm** | 120 | 20 | SF Pro Rounded Medium 11pt |
| **3 Md** | 120 | 24 | SF Pro Rounded Medium 13pt |
| **4 Lg** | 120 | 28 | SF Pro Rounded Medium 13pt |
| **5 XL** | 120 | 36 | SF Pro Rounded Medium 13pt |

> Width shown is minimum. Search fields expand to fill available space.

### 4.6 Segmented Controls

#### Duo (2 segments)

| Size | Width | Height |
|------|-------|--------|
| **1 Mn** | 46 | 16 |
| **2 Sm** | 52 | 20 |
| **3 Md** | 60 | 24 |
| **4 Lg** | 68 | 28 |
| **5 XL** | 76 | 36 |

#### Trio (3 segments)

Same height scale as Duo. Width scales proportionally.

Available in: Content Area and Over-Glass variants.

### 4.7 Sliders

#### Linear Sliders

| Component | Width | Height |
|-----------|-------|--------|
| **Track (full)** | 120 | 4 |
| **Track - Center (full)** | 120 | 6 |
| **Track - Filled (half)** | 60 | 4 |
| **Tick Marks** | 120 | 2 |
| **Tick Marks - Center-biased** | 120 | 4 |

#### Slider Track Heights by Size

| Size | Track Height |
|------|-------------|
| **1 Mn** | 4pt |
| **2 Sm** | 4pt |
| **3 Md** | 4pt |
| **4 Lg** | 6pt |
| **5 XL** | 6pt |

### 4.8 Progress Indicators

| Size | Width | Height | Corner Radius |
|------|-------|--------|--------------|
| **2 Sm** | 140 | 6 | 3 (half height) |
| **3 Md** | 140 | 10 | 5 (half height) |

Available in: Content Area and Over-Glass variants.
States: Determinate (0%, 25%, 50%, 75%, 100%) and Indeterminate.
Active vs Inactive states.

### 4.9 Sidebars

| Size | Row Height | Width | Icon Size |
|------|-----------|-------|-----------|
| **Large** | 40 | 240 | 24×24 |
| **Medium** | 32 | 240 | 24×24 |
| **Small** | 24 | 240 | 24×24 |

**Sidebar Structure:**
- **Full width**: 256pt (including 8pt padding each side)
- **Content width**: 240pt
- **Header height**: 43pt (Large), 35pt (Medium), 27pt (Small)
- **Indent per level**: ~16pt
- **Folder indentation levels**: 0–4

**Sidebar Example Heights:**
- Large: 1058pt total
- Medium: 1058pt total
- Small: 1050pt total

### 4.10 Popovers

All popover orientations (North, South, East, West) share the same corner radius and shadow style.

The popover arrow is positioned at: Center, Leading, Trailing (for horizontal), or Top, Middle, Bottom (for vertical).

**Popover Material:**
- Uses Liquid Glass material (same as Small UI components)
- Corner radius: **8pt** (standard for popover containers)
- Padding: ~12pt internal

### 4.11 Text Fields

Same size scale as Search Fields:
| Size | Width | Height |
|------|-------|--------|
| **1 Mn** | Variable | 16 |
| **2 Sm** | Variable | 20 |
| **3 Md** | Variable | 24 |
| **4 Lg** | Variable | 28 |
| **5 XL** | Variable | 36 |

### 4.12 Checkbox / Toggle Sizes

Uses the same 5-tier scale (1 Mn through 5 XL) for checkbox sizes, matching the button height scale.

---

## 5. Window Layout Specifications

### 5.1 Standard Window with Toolbar + Sidebar

```
┌─────────────────────────────────────────────────┐
│ ○ ○ ○   Window Title              [🔍] [⚙]     │  ← Titlebar: 32pt
├─────────────────────────────────────────────────┤
│ [SegCtrl] [Btn] [Btn]     [Search Field]        │  ← Toolbar: 52pt (or 40pt)
├──────────┬──────────────────────────────────────┤
│ Header   │                                      │
├──────────┤         Content Area                 │
│ Item 1   │                                      │
│ Item 2   │    Scroll View (720pt wide)          │
│ Item 3   │                                      │
│ Header   │                                      │
│ Item 4   │                                      │
│ Item 5   │                                      │
│          │                          ┃ Scrollbar  │  ← 12pt wide
├──────────┴──────────────────────────────────────┤
```

### 5.2 Key Measurements Summary

| Measurement | Value |
|-------------|-------|
| Sidebar width | 256pt |
| Sidebar content padding | 8pt each side |
| Sidebar item height (Large) | 40pt |
| Sidebar item height (Medium) | 32pt |
| Sidebar item height (Small) | 24pt |
| Sidebar header height | 43pt (Large) |
| Titlebar height | 32pt |
| Toolbar height | 40pt (Monobar) / 52pt |
| Traffic light diameter | ~12pt (within 16pt height) |
| Traffic light spacing | 8pt center-to-center |
| Traffic light group width | 62pt (standard) / 50pt (utility) |
| Scrollbar width | 12pt |
| Content fade height | 90pt |
| Button spacing in toolbar | 4pt gap |

---

## 6. Design Token Summary (for implementation)

```swift
// MARK: - Colors
struct DSColors {
    // Light Mode Labels
    static let labelPrimary:    Color = Color(red: 0x19/255, green: 0x19/255, blue: 0x19/255)       // #191919
    static let labelSecondary:  Color = Color(red: 0x72/255, green: 0x72/255, blue: 0x72/255)       // #727272
    static let labelTertiary:   Color = Color(red: 0xBE/255, green: 0xBE/255, blue: 0xBE/255)       // #BEBEBE
    static let labelQuaternary: Color = Color(red: 0xD9/255, green: 0xD9/255, blue: 0xD9/255)       // #D9D9D9
    static let labelQuinary:    Color = Color(red: 0xE6/255, green: 0xE6/255, blue: 0xE6/255)       // #E6E6E6

    // Dark Mode Labels
    static let darkLabelPrimary:    Color = Color(red: 0xF4/255, green: 0xF4/255, blue: 0xF4/255)   // #F4F4F4
    static let darkLabelSecondary:  Color = Color(red: 0x89/255, green: 0x89/255, blue: 0x89/255)   // #898989
    static let darkLabelTertiary:   Color = Color(red: 0x40/255, green: 0x40/255, blue: 0x40/255)   // #404040
    static let darkLabelQuaternary: Color = Color(red: 0x25/255, green: 0x25/255, blue: 0x25/255)   // #252525
    static let darkLabelQuinary:    Color = Color(red: 0x11/255, green: 0x11/255, blue: 0x11/255)   // #111111

    // Backgrounds
    static let bgPrimaryLight:   Color = Color(red: 0xFB/255, green: 0xFB/255, blue: 0xFB/255)      // #FBFBFB
    static let bgSecondaryLight: Color = Color(red: 0xF6/255, green: 0xF6/255, blue: 0xF6/255)      // #F6F6F6
    static let bgTertiaryLight:  Color = Color(red: 0xF1/255, green: 0xF1/255, blue: 0xF1/255)      // #F1F1F1

    static let bgPrimaryDark:   Color = Color(red: 0x07/255, green: 0x07/255, blue: 0x07/255)       // #070707
    static let bgSecondaryDark: Color = Color(red: 0x08/255, green: 0x08/255, blue: 0x08/255)       // #080808
    static let bgTertiaryDark:  Color = Color(red: 0x0D/255, green: 0x0D/255, blue: 0x0D/255)       // #0D0D0D

    // Accent
    static let accentBlue:  Color = Color(red: 0x00/255, green: 0x87/255, blue: 0xFF/255)           // #0087FF
    static let destructive: Color = Color(red: 0xFF/255, green: 0x38/255, blue: 0x3C/255)           // #FF383C

    // Vibrant System Colors (Light / Dark)
    static let systemRed:     (light: "#FF383C", dark: "#FF4245")
    static let systemOrange:  (light: "#FF8C27", dark: "#FF912F")
    static let systemYellow:  (light: "#FFCC00", dark: "#FFD600")
    static let systemGreen:   (light: "#34C658", dark: "#2FD157")
    static let systemTeal:    (light: "#00C7B3", dark: "#00DAC2")
    static let systemBlue:    (light: "#00C2D0", dark: "#00D2E0")
    static let systemIndigo:  (light: "#00BFE8", dark: "#3CD3FE")
    static let systemPurple:  (light: "#0087FF", dark: "#0090FF")
    static let systemPink:    (light: "#6054F4", dark: "#6D7CFF")
}

// MARK: - Dimensions
struct DSDimensions {
    // Window
    static let titlebarHeight:    CGFloat = 32
    static let toolbarHeight:     CGFloat = 40  // monobar
    static let toolbarHeightFull: CGFloat = 52
    static let sidebarWidth:      CGFloat = 256
    static let sidebarPadding:    CGFloat = 8
    static let contentWidth:      CGFloat = 240  // sidebar content
    static let scrollbarWidth:    CGFloat = 12
    static let contentFadeHeight: CGFloat = 90

    // Traffic Lights
    static let trafficLightGroupWidth: CGFloat = 62
    static let trafficLightGroupHeight: CGFloat = 16
    static let trafficLightSpacing:    CGFloat = 8
    static let trafficLightDiameter:   CGFloat = 12

    // Sidebar
    static let sidebarRowLarge:  CGFloat = 40
    static let sidebarRowMedium: CGFloat = 32
    static let sidebarRowSmall:  CGFloat = 24
    static let sidebarHeader:    CGFloat = 43

    // Search Fields
    static let searchHeight1Mn: CGFloat = 16
    static let searchHeight2Sm: CGFloat = 20
    static let searchHeight3Md: CGFloat = 24
    static let searchHeight4Lg: CGFloat = 28
    static let searchHeight5XL: CGFloat = 36

    // Segmented Controls
    static let segmentedHeight1Mn: CGFloat = 16
    static let segmentedHeight2Sm: CGFloat = 20
    static let segmentedHeight3Md: CGFloat = 24
    static let segmentedHeight4Lg: CGFloat = 28
    static let segmentedHeight5XL: CGFloat = 36

    // Progress Indicators
    static let progressWidth:    CGFloat = 140
    static let progressHeightSm: CGFloat = 6
    static let progressHeightMd: CGFloat = 10

    // Slider Track
    static let sliderTrackHeight:    CGFloat = 4
    static let sliderTrackHeightLg:  CGFloat = 6

    // Button (bordered)
    static let buttonHeight1Mn: CGFloat = 16
    static let buttonHeight2Sm: CGFloat = 20
    static let buttonHeight3Md: CGFloat = 24
    static let buttonHeight4Lg: CGFloat = 28
    static let buttonHeight5XL: CGFloat = 36
}

// MARK: - Materials (Liquid Glass)
struct DSMaterials {
    // Dark Mode - Large/Medium UI
    static let darkVibrancyOpacity: Double = 0.40
    static let darkBaseColor = Color(red: 0x19/255, green: 0x19/255, blue: 0x19/255)  // #191919
    static let darkBaseColorMedium = Color(red: 0x11/255, green: 0x11/255, blue: 0x11/255) // #111111

    // Light Mode - Large/Medium UI
    static let lightVibrancyOpacity: Double = 0.70
    static let lightBaseColor = Color(red: 0xF9/255, green: 0xF9/255, blue: 0xF9/255) // #F9F9F9

    // Shared Shadow Values
    static let dropShadowBlur: CGFloat = 40
    static let dropShadowOffsetY: CGFloat = 8
    static let dropShadowOpacity: Double = 0.12
    static let ambientBlur: CGFloat = 8
    static let ambientOpacity: Double = 0.10  // dark: 0.10, light: 0.20
    static let innerShadowOffset: CGFloat = 1
    static let innerShadowBlur: CGFloat = 0.25
    static let specularOffset: CGFloat = 2
    static let specularSpread: CGFloat = -1.5

    // Small UI (Tinted Glass)
    static let smallGlassDarkOpacity: Double = 0.70
    static let smallGlassLightOpacity: Double = 0.40
    static let smallGlassBaseColor = Color(red: 0xF9/255, green: 0xF9/255, blue: 0xF9/255)
    static let smallGlassAmbientColor = Color(red: 0x00/255, green: 0x00/255, blue: 0x00/255)
    static let smallGlassAmbientOpacity: Double = 0.10
    static let specularHighlight = Color.white
    static let specularHighlightOpacity: Double = 1.0

    // Sidebar Material
    static let sidebarVibrancyOpacity: Double = 0.70
    static let sidebarBaseColor = Color(red: 0xF9/255, green: 0xF9/255, blue: 0xF9/255)
}
```

---

*Extracted from Apple macOS 26 UI Kit Sketch file. All values are exact from the source.*
