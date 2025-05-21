import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Create multiple sizes for better browser compatibility
async function createIcons() {
  try {
    // Create 64x64 icon
    await sharp('public/airtable-logo.png')
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile('public/airtable-icon-64.png');
    console.log('Created 64x64 icon: public/airtable-icon-64.png');
    
    // Create 128x128 icon (larger, might help with visibility)
    await sharp('public/airtable-logo.png')
      .resize(128, 128, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile('public/airtable-icon-128.png');
    console.log('Created 128x128 icon: public/airtable-icon-128.png');
    
    console.log('\nTo use the 128x128 icon (might be more visible), update your layout.tsx metadata to:');
    console.log('icons: [{ rel: "icon", url: "/airtable-icon-128.png", type: "image/png", sizes: "128x128" }]');
  } catch (err) {
    console.error('Error creating icons:', err);
  }
}

createIcons(); 