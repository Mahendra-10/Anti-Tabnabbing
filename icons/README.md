# Extension Icons

You need to create three icon sizes for the Chrome extension:

- **icon16.png** - 16x16 pixels (toolbar icon)
- **icon48.png** - 48x48 pixels (extension management page)
- **icon128.png** - 128x128 pixels (Chrome Web Store)

## Quick Way to Create Icons

### Option 1: Using Online Tools
- Go to https://www.favicon-generator.org/
- Upload any image (shield, eye, lock symbol works well for security extensions)
- Download and rename the appropriate sizes

### Option 2: Using ImageMagick (if installed)
```bash
# Create a simple colored square as placeholder
convert -size 128x128 xc:#4285F4 -pointsize 72 -gravity center -fill white -annotate +0+0 "🛡" icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

### Option 3: Use Existing Icons (temporary)
For development, you can temporarily download free icons from:
- https://icons8.com/ (search for "shield" or "security")
- https://www.flaticon.com/

## For Now (Quick Fix)

The extension will work without icons, but Chrome will show a default puzzle piece icon. You can add proper icons later before final submission.

## Suggested Icon Design

For an anti-tabnabbing extension, consider:
- 🛡️ Shield symbol (protection)
- 👁️ Eye symbol (monitoring)
- 🔒 Lock symbol (security)
- Use blue/green colors (trust, security)

