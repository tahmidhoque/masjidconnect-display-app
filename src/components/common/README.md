# Islamic Pattern Background Components

This directory contains React components for creating beautiful tessellated Islamic pattern backgrounds in your application.

## Components

### 1. `TessellatedBackground`

A highly customizable component that provides a tessellated background using SVG patterns based on Islamic geometric design.

#### Features:
- Supports various customization options (pattern size, colors, opacity)
- Adds depth effects using SVG filters (embossing and shadows)
- Optional animation for subtle movement
- Responsive and works with any container size
- Optimized SVG rendering

#### Props:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | string \| number | '100%' | Width of the background |
| `height` | string \| number | '100%' | Height of the background |
| `patternColor` | string | '#E9C46A' | Color of the pattern (HEX or RGBA) |
| `patternSize` | number | 150 | Size of pattern in pixels |
| `backgroundColor` | string | 'rgba(255, 255, 255, 0.9)' | Background color (HEX or RGBA) |
| `opacity` | number | 0.7 | Opacity of the pattern (0-1) |
| `addDepth` | boolean | true | Whether to add emboss and shadow effects |
| `animation` | boolean | false | Whether to animate the pattern |

#### Example Usage:
```jsx
<TessellatedBackground
  patternSize={180}
  patternColor="#2A9D8F"
  opacity={0.5}
  animation={true}
/>
```

### 2. `IslamicPatternBackground`

A simplified production-ready version of the tessellated background with predefined theme variants.

#### Features:
- Preset theme variants that match the application's design system
- Child content overlay with proper z-indexing
- Uses theme colors from Material UI theme
- Optimized for production use

#### Props:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | string \| number | '100%' | Width of the background |
| `height` | string \| number | '100%' | Height of the background |
| `variant` | 'default' \| 'light' \| 'dark' \| 'subtle' | 'default' | Preset theme variant |
| `children` | ReactNode | undefined | Content to display over the pattern |

#### Variants:
- **default**: Standard golden pattern with good visibility
- **light**: Lighter, more subtle pattern for text-heavy designs
- **dark**: Darker pattern using the primary color for contrast
- **subtle**: Very subtle background for minimal distraction

#### Example Usage:
```jsx
<IslamicPatternBackground variant="light">
  <Box sx={{ p: 3, textAlign: 'center' }}>
    <Typography variant="h4">Your Content Here</Typography>
  </Box>
</IslamicPatternBackground>
```

## Example Components

### 1. `TessellatedBackgroundExample`

An interactive demo component that showcases the customization options of the `TessellatedBackground` component.

### 2. `IslamicPatternBackgroundUsage`

A demonstration of all variants of the `IslamicPatternBackground` component in realistic usage scenarios.

## Implementation Details

- Both components use SVG's `<pattern>` element for efficient repeating patterns
- Uses unique IDs for SVG elements to avoid conflicts when using multiple instances
- Implements React.useMemo for performance optimization
- The pattern is based on traditional Islamic geometric designs
- SVG filters add depth and texture to avoid a flat look
- Components are fully responsive and work at any size

## Performance Considerations

- The SVG pattern is defined once and reused across the entire area
- Using `patternUnits="userSpaceOnUse"` ensures proper scaling
- SVG filters are optional and can be disabled for performance-critical applications
- Animation is opt-in to avoid unnecessary rendering 