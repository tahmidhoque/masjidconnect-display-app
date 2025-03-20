# MasjidConnect Design System

## Core Design Principles
- **Faith-Driven Simplicity** – Intuitive UI, eliminating complex menus while ensuring accessibility for all
- **Community-Oriented** – Navigation and content facilitates mosque committee collaboration and worshipper engagement
- **Modern & Traditional Balance** – Clean, professional UI with subtle Islamic design patterns
- **Clear, Readable Information** – Prioritize legibility for prayer times, announcements, and events
- **Low Technical Barrier** – Designed for ease of use for mosque staff who may not be tech-savvy

## Color System
- **Primary Color (Midnight Blue `#0A2647`)** – Headers, important CTAs
- **Accent Color (Emerald Green `#2A9D8F`)** – Highlights, primary buttons
- **Call-to-Action (Golden Yellow `#E9C46A`)** – Donate buttons, urgent notices
- **Background (Soft White `#F4F4F4`)** – Page backgrounds
- **Interactive (Sky Blue `#66D1FF`)** – Interactive elements, secondary buttons

## Typography
- **Primary Font:** Poppins / Montserrat / Lato (Sans-serif)
- **Headings:**
  - H1: `40px Bold`
  - H2: `32px Semi-Bold`
  - H3: `24px Medium`
- **Body Text:** `16px Regular`
- **Small Text:** `14px Regular`
- **Line Height:** 1.6x for readability

## Spacing
- **Grid:** 12-column responsive grid with 24px minimum margin
- **Component Spacing:** 16px padding between components
- **Section Spacing:** 32px padding between sections
- **Form Elements:** 12px minimum padding inside fields

## Implementation Preference

> **IMPORTANT UPDATE:** We now favor using Material UI (MUI) components over custom Tailwind components. MUI provides a more polished, consistent, and comprehensive component library that will allow for faster development and a more professional UI.

## Component Styling (Material UI)

### Buttons
```jsx
// Primary Button
<Button 
  variant="contained" 
  color="primary"
  size="medium"
>
  Submit
</Button>

// Secondary Button
<Button 
  variant="outlined"
  color="primary"
  size="medium"
>
  Cancel
</Button>

// Danger Button
<Button 
  variant="contained" 
  color="error"
  size="medium"
>
  Delete
</Button>

// Disabled Button
<Button 
  variant="contained" 
  color="primary"
  size="medium"
  disabled
>
  Submit
</Button>
```

### Cards
```jsx
<Card sx={{ p: 3, mb: 3 }}>
  <Typography variant="h6" sx={{ mb: 2 }}>Card Title</Typography>
  <Typography variant="body1">Card content goes here</Typography>
</Card>
```

### Form Elements
```jsx
<Box sx={{ mb: 3 }}>
  <TextField
    id="name"
    label="Name"
    variant="outlined"
    fullWidth
    size="medium"
  />
</Box>
```

### Alerts
```jsx
// Success Alert
<Alert severity="success" sx={{ mb: 3 }}>
  Operation completed successfully
</Alert>

// Error Alert
<Alert severity="error" sx={{ mb: 3 }}>
  An error occurred
</Alert>
```

## Theme Setup
Use MUI's theme provider to customize the default theme with MasjidConnect's design tokens:

```jsx
// src/theme/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0A2647', // Midnight Blue
    },
    secondary: {
      main: '#2A9D8F', // Emerald Green
    },
    error: {
      main: '#E76F51', // Error Red
    },
    warning: {
      main: '#E9C46A', // Golden Yellow
    },
    info: {
      main: '#66D1FF', // Sky Blue
    },
    background: {
      default: '#F4F4F4', // Soft White
    },
  },
  typography: {
    fontFamily: 'Poppins, Montserrat, Lato, sans-serif',
  },
});

export default theme;
```

## Accessibility Guidelines
- All interactive elements must be keyboard-accessible
- Maintain color contrast ratios for text readability
- Provide text alternatives for non-text content
- Ensure form elements have visible labels
- Support screen readers with proper ARIA attributes

## Implementation Resources
- Design system tokens are available in `src/theme/designSystem.ts`
- MUI theme configuration in `src/theme/theme.js`
- Full documentation available in `src/docs/design-rules.md` 