# Font Styling Fix Reference

To fix the issue where form elements (like selects) ignore the application font and default to Times New Roman, follow these steps.

### 1. Update `src/app/layout.tsx`
Configure the Inter font to use a CSS variable and apply the `font-sans` class to the body.

```tsx
// ... existing imports
const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-sans', // Add this
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}> {/* Apply variable and class */}
        <AuthProvider>
          <Layout>{children}</Layout>
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Update `src/app/globals.css`
Map the Tailwind theme to the new variable and force all form elements to inherit the font.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans), system-ui, sans-serif; /* Link to the variable */
}

/* ... existing root/media rules ... */

body {
  background: var(--background);
  color: var(--foreground);
  /* font-family: Arial, ...;  <-- REMOVE hardcoded fonts here if any */
}

/* Force inheritance for all form elements */
input,
select,
textarea,
button,
option {
  font-family: inherit !important;
}
```
