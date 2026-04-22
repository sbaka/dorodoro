# Multi-Panel Chat Interface Specification

## Overview
Three-column layout chat interface with independent conversation states, persistent history sidebar, and context-aware reply threading. Designed for information-dense applications requiring concurrent message handling.

---

## Layout Structure

### Grid System
- **3-column equal-width layout** on desktop
- Responsive: stacks to 1 column on mobile, 2 columns on tablet
- Panels separated by subtle borders (1px, low contrast)
- Consistent 16px gutter between panels
- Each panel: 320px min-width (content scaled within constraints)

### Panel Container
- **Background**: Solid, subtle shadow (elevation 1)
- **Border radius**: 12px
- **Border**: 1px, low-contrast (divider color)
- **Padding**: 20px internal
- **Header height**: 56px (sticky on scroll within panel)

---

## Panel 1: New Conversation (Onboarding State)

### Header
- Left: "New Conversation" text label
- Right: 3 icon buttons (refresh, expand, close)
- Icon size: 20px, stroke weight: 2px
- Spacing: 8px between icons

### Hero Content (Center)
- **Icon**: Illustrated graphic icon (can be customized per use case)
- **Size**: 64px
- **Heading**: Primary call-to-action text (customizable)
- **Typography**: 24px, weight 600, center-aligned
- **Subheading**: Secondary instruction or description text
- **Typography**: 16px, weight 400, center-aligned, secondary color
- **Spacing**: 12px between heading and subheading

### Quick Action Cards (Conversation Starters)
- **Container**: Cards stacked vertically, 100% width
- **Cards**: 3 visible options (scrollable for more)
- **Card styling**:
  - Background: Surface color (slightly elevated)
  - Border: 1px, subtle divider
  - Border-radius: 8px
  - Padding: 16px
  - Min-height: 48px
  - Hover state: background shift, cursor pointer
  
- **Card content**:
  - Icon (left): 20px, 1 color, 24px from left edge
  - Text (left-aligned): 14px, weight 500, wraps 2 lines max
  - Icon examples: customizable based on use case
  
- **Spacing between cards**: 12px
- **Bottom margin**: 20px below last card

### Message Input
- **Position**: Sticky bottom of panel (20px padding from bottom)
- **Layout**: Input + send button (horizontal flex)
- **Input field**:
  - Placeholder: Customizable (context-dependent)
  - Padding: 12px 16px
  - Height: 44px
  - Border-radius: 8px
  - Border: 1px divider
  - Focus state: border color change + subtle shadow
  - Font: 14px, weight 400
  
- **Icon button** (left inside input):
  - Icon: customizable contextual icon, 18px
  - Position: 12px from left edge
  - Color: secondary/tertiary
  
- **Send button** (right outside input):
  - Icon: arrow or submit icon, 18px
  - Size: 44px square
  - Border-radius: 8px
  - Background: accent/brand color
  - Hover: slight opacity/brightness shift
  - Position: 8px right margin

### Footer Text
- Optional disclaimer or helper text
- Typography: 12px, weight 400, tertiary color (faded)
- Padding: 12px top
- Position: Below input, left-aligned

### Dropdown Filter
- **Label**: "Everything" with chevron
- **Position**: Bottom left of input area
- **Icon**: chevron down, 16px
- **Styling**: Text + icon, clickable, secondary color on hover

---

## Panel 2: Active Conversation with Content Response

### Header
- Left: Conversation title (truncated if long)
- Right: Same 3 icon buttons as Panel 1
- **Title styling**: 14px weight 600, truncate on overflow

### Processing/Loading State (Optional)
- **Container**: Full-width, 8px padding
- **Content**: Spinner icon (20px) + contextual status text
- **Typography**: 14px, weight 400, secondary color
- **Chevron**: Animated directional indicator
- **Spacing**: 16px margin-bottom

### Response/Message Block
- **Avatar** (left): Small circular icon or initials (32px), accent color background
- **Spacing from left**: 0px (flush)
- **Content area** (right of avatar):
  - **Margin-left**: 12px from avatar edge
  
#### Message Body Text
- **Typography**: 15px, weight 400, line-height 1.5
- **Color**: Primary text
- **Margin-bottom**: 12px

#### Information/Reference Cards (Nested)
- **Container**: Full-width within response, margin-top 12px
- **Background**: Accent color at 10% opacity (very light)
- **Border**: 2px left accent color
- **Border-radius**: 4px
- **Padding**: 16px
- **Margin-bottom**: 12px

##### Card Header
- **Icon** (left, 20px): Checkmark or identifier icon, accent color
- **Text**: Card title/label
- **Typography**: 14px, weight 600
- **Display**: Flex, gap 12px
- **Margin-bottom**: 12px

##### Card Body Text
- **Typography**: 13px, weight 400, line-height 1.6
- **Color**: Secondary text (slightly dimmed)
- **Wraps**: Full width

##### Nested List Items (if present)
- **Bullet style**: Standard bullet or custom
- **Margin-left**: 16px
- **Spacing between items**: 8px
- **Typography**: 13px, weight 400

#### Multiple Cards in Sequence
- **Gap between cards**: 12px
- **No margin-right**: Full container width

### List Content (Numbered or Bulleted)
- **Container**: Within response, margin-top 12px
- **Bullet/number type**: Custom bullets (e.g., filled circles)
- **Margin-left**: 16px from text edge
- **Items spacing**: 8px
- **Typography**: 14px, weight 400

##### Numbered Items Example
- "Accountability for Oversight: Ensuring operational risk management... (bold for title) + regular text for description"
- **Superscript number**: Right side of item (e.g., "2", "5")
- **Color**: Secondary/tertiary (faded)
- **Font-size**: 12px

### Action Icons (Below response)
- **Container**: Flex, gap 8px, margin-top 12px
- **Icons**: Copy icon, refresh icon
- **Size**: 18px
- **Color**: Secondary (interactive on hover)
- **Position**: Left-aligned under content

### Message Input (Same as Panel 1)
- Same styling, position, structure
- Placeholder: Contextual (e.g., "Write message...")

---

## Panel 3: Conversation History Sidebar

### Header
- Left: Back arrow icon (24px) + "History" text label (customizable)
- Right: 2 icon buttons (expand, close)
- **Sticky top**: Follows scroll

### Search Bar
- **Placeholder**: "Search..."
- **Styling**: Same as input fields, 44px height
- **Icon**: Search icon (18px), left side, secondary color

### History Grouped by Date
- **Date headers**: 
  - "Today, 22 Feb 2024"
  - Typography: 12px, weight 600, secondary color
  - Padding: 16px top, 8px bottom
  - No border, just spacing

### History Items (Conversation/Entry Records)
- **Container**: Full-width, stacked
- **Padding**: 12px horizontal, 10px vertical
- **Border-radius**: 6px
- **Background on hover**: Surface color (slight elevation shift)
- **Cursor**: Pointer
- **Transition**: 200ms

#### Item Structure
- **Title** (main): 14px, weight 500, primary text
- **Title ellipsis**: 1 line max, overflow hidden
- **Sub-text** (optional): 12px, weight 400, secondary color (e.g., date/metadata)
- **Icon** (right): Action icon (delete/more), 16px, tertiary color, hidden on default, visible on hover
- **Icon on hover**: Changes to hover state (warning color optional)

### Spacing
- Gap between items: 4px
- Gap between date sections: 12px
- Bottom padding: 20px (scrollable overflow space)

---

## Reply Threading (Context Overlay)

### Position
- **Modal/overlay**: Sits on top of Panel 3 (right side)
- **Background**: Semi-transparent overlay (optional fade)
- **Width**: Panel width minus padding
- **Animation**: Slide in from right

### Header
- **Text**: "Replying to:"
- **Icon**: Left arrow (backlink indicator), 18px
- **Typography**: 12px, weight 600, secondary color
- **Button**: Close button (X icon, 20px), right side

### Replied-to Content Preview
- **Container**: Light background (surface color)
- **Padding**: 12px
- **Border-radius**: 4px
- **Content**: Truncated text from replied message
- **Typography**: 13px, weight 400, primary text
- **Ellipsis**: "..." if text exceeds 2 lines

### Example
"Replying to: Accountability for Oversight: Ensuring operational..."

---

## Color/Styling Tokens (Brand Agnostic)

Replace these with your app's design tokens:

```
Primary Text Color: [Your primary text]
Secondary Text Color: [Your secondary text]
Tertiary Text Color: [Your faded text]
Surface Color: [Your panel/card background]
Divider Color: [Your border color]
Accent Color: [Your primary brand color]
Hover State: [Subtle background change, 5% opacity increase]
Focus State: [Border color change + 2px outline]
Error/Warning: [Optional warning color for delete actions]
```

---

## Responsive Behavior

### Desktop (>1024px)
- 3-column layout as described
- Panels fixed width, equal distribution

### Tablet (768px to 1023px)
- 2-column layout: New Chat + Active Chat, History as modal/drawer
- History toggles via button

### Mobile (<768px)
- Single column, stacked
- Tabs or full-width panels with swipe navigation
- History as bottom sheet or side drawer

---

## Typography System

| Element | Size | Weight | Line-height |
|---------|------|--------|------------|
| Heading 1 | 24px | 600 | 1.2 |
| Heading 2 | 20px | 600 | 1.3 |
| Body Large | 16px | 400 | 1.5 |
| Body Regular | 15px | 400 | 1.5 |
| Body Small | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.4 |
| Caption | 12px | 400 | 1.4 |
| Tiny | 11px | 400 | 1.3 |

---

## Component Patterns

### Buttons
- **Primary action**: Brand accent background, white/light text
- **Secondary action**: Transparent, brand accent text/border
- **Tertiary action**: Icon only, secondary color, hover brightens

### Inputs
- **Default**: Border 1px divider, subtle shadow on focus
- **Filled**: Light background variant
- **Error**: Red/warning border (if validation needed)

### Cards
- **Elevated**: Subtle shadow, 1px border divider
- **Flat**: Border only, no shadow
- **Bordered**: Thicker left border (accent color) for emphasis

### Loading States
- **Spinner**: Animated circular icon, 20px or 24px
- **Skeleton**: Pulsing gray bar (optional, not shown in screenshots)

### Transitions
- **Default**: 200ms ease-out
- **Quick**: 100ms ease-out (hover states)
- **Slow**: 400ms ease-in-out (modals, overlays)

---

## Interaction Patterns

### Hover States
- Panels: Slight shadow increase
- Buttons: 5% opacity change or color shift
- History items: Background surface color
- Conversation starter cards: Border color change + cursor pointer

### Focus States
- Input fields: 2px accent border + subtle shadow
- Buttons: Ring/outline visible
- Keyboard navigation: Visible focus indicator

### Click/Tap States
- Button press: Scale 0.98 (optional, micro-animation)
- History item selection: Background highlight + bold
- Message: Highlight on hover (optional)

### Active States
- Current active chat: Distinct styling in header
- Selected history item: Different background color + accent indicator

---

## Accessibility Considerations

- All interactive elements: Min 44px touch target
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Icons with no label: `aria-label` attribute
- Focus indicators: Always visible, not hidden
- Semantic HTML: `<button>`, `<input>`, `<nav>` tags
- ARIA roles: chat, log, region where appropriate

---

## Implementation Notes

1. **Do NOT hardcode colors**: Use CSS variables (custom properties) for all colors
2. **CSS Variables structure**:
   ```css
   :root {
     --color-primary-text: #...;
     --color-secondary-text: #...;
     --color-tertiary-text: #...;
     --color-surface: #...;
     --color-divider: #...;
     --color-accent: #...;
     --color-hover: #...;
   }
   ```
3. **Use flexbox and CSS Grid** for layout responsiveness
4. **BEM naming convention**: `.panel__header`, `.message-block__avatar`, `.card--info`
5. **CSS transitions**: 200ms ease-out for standard interactions
6. **Mobile-first**: Start with single column, expand to multi-panel on larger screens
7. **Virtualization for history**: If 100+ items, implement CSS will-change + transform optimization
8. **Accessibility**:
   - All buttons: min 44px touch target
   - Icon buttons: `aria-label` attributes
   - Focus indicators: Always visible (not outline: none)
   - Semantic HTML: `<button>`, `<input>`, `<aside>`
9. **Performance**:
   - Use CSS contain for panel isolation
   - Lazy-load history items if scrollable list is long
   - Debounce search input (300ms)

---

## Visual Hierarchy

1. **Highest**: Active chat content, message input
2. **High**: Conversation starters, history items
3. **Medium**: Headers, subheadings, legislation cards
4. **Low**: Footer text, timestamps, secondary icons
5. **Lowest**: Dividers, subtle borders

---

## Example HTML Structure

```html
<div class="chat-interface">
  <!-- Panel 1: New Conversation -->
  <div class="panel panel-onboarding">
    <header class="panel-header">
      <span class="panel-title">New Conversation</span>
      <div class="icon-buttons">
        <button class="icon-btn" aria-label="Refresh">↻</button>
        <button class="icon-btn" aria-label="Expand">⤢</button>
        <button class="icon-btn" aria-label="Close">✕</button>
      </div>
    </header>
    <div class="panel-content">
      <div class="hero-section">
        <div class="hero-icon">📋</div>
        <h2>Primary Heading</h2>
        <p class="subheading">Secondary instruction text</p>
      </div>
      <div class="quick-actions">
        <button class="action-card">
          <span class="action-icon">📝</span>
          <span class="action-text">Quick action label one</span>
        </button>
        <button class="action-card">
          <span class="action-icon">❓</span>
          <span class="action-text">Quick action label two</span>
        </button>
        <button class="action-card">
          <span class="action-icon">📄</span>
          <span class="action-text">Quick action label three</span>
        </button>
      </div>
    </div>
    <footer class="panel-footer">
      <div class="message-input-group">
        <input type="text" class="message-input" placeholder="Type message...">
        <button class="send-btn">→</button>
      </div>
      <p class="disclaimer-text">Optional disclaimer or helper text</p>
    </footer>
  </div>

  <!-- Panel 2: Active Conversation -->
  <div class="panel panel-active">
    <header class="panel-header">
      <span class="panel-title">Active Conversation Title</span>
      <div class="icon-buttons">
        <button class="icon-btn">↻</button>
        <button class="icon-btn">⤢</button>
        <button class="icon-btn">✕</button>
      </div>
    </header>
    <div class="panel-content conversation-stream">
      <div class="processing-state">
        <div class="spinner"></div>
        <span>Processing...</span>
      </div>
      <div class="message-block">
        <div class="message-avatar">S</div>
        <div class="message-content">
          <p>Response text goes here.</p>
          <div class="info-card">
            <div class="card-header">
              <span class="card-icon">✓</span>
              <span class="card-title">Reference Title</span>
            </div>
            <p class="card-body">Card description or details.</p>
          </div>
        </div>
      </div>
    </div>
    <footer class="panel-footer">
      <div class="message-input-group">
        <input type="text" class="message-input" placeholder="Write message...">
        <button class="send-btn">→</button>
      </div>
    </footer>
  </div>

  <!-- Panel 3: History Sidebar -->
  <aside class="panel panel-history">
    <header class="panel-header">
      <button class="back-btn">←</button>
      <span class="panel-title">History</span>
      <div class="icon-buttons">
        <button class="icon-btn">⤢</button>
        <button class="icon-btn">✕</button>
      </div>
    </header>
    <div class="panel-content">
      <input type="text" class="search-input" placeholder="Search...">
      <div class="history-group">
        <h3 class="date-header">Today, 22 Feb 2024</h3>
        <button class="history-item">
          <div class="item-text">
            <div class="item-title">Item Title</div>
            <div class="item-meta">Metadata or date</div>
          </div>
          <button class="item-action-btn">⋮</button>
        </button>
        <button class="history-item">
          <div class="item-text">
            <div class="item-title">Another Item</div>
            <div class="item-meta">Metadata</div>
          </div>
          <button class="item-action-btn">⋮</button>
        </button>
      </div>
      <div class="history-group">
        <h3 class="date-header">20 Feb 2024</h3>
        <button class="history-item">
          <div class="item-text">
            <div class="item-title">Older Item</div>
          </div>
          <button class="item-action-btn">⋮</button>
        </button>
      </div>
    </div>
  </aside>

  <!-- Reply Context Overlay -->
  <div class="reply-context-overlay" data-visible="false">
    <div class="reply-header">
      <span>↶ Replying to:</span>
      <button class="close-btn">✕</button>
    </div>
    <div class="reply-preview">
      Replied-to message content preview...
    </div>
  </div>
</div>
```

---

## Notes

- **This spec is color and framework agnostic**: Use CSS custom properties to define your color palette
- **Spacing is consistent**: 4px, 8px, 12px, 16px, 20px increments (4px grid system)
- **Responsive design**: Spec includes breakpoints; adjust based on your target devices
- **Dark mode**: If supporting dark mode, create a separate CSS variable set or use prefers-color-scheme
- **Pure HTML/CSS**: This spec can be implemented with vanilla HTML, CSS, and minimal JavaScript
- **No dependencies**: Build with native CSS Grid, Flexbox, and CSS custom properties