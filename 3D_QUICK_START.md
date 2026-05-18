# 🎯 3D Xonalar Ko'rinishi - Quick Start Guide

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
```
This will install Babylon.js and all other required packages.

### 2. Start Development Server
```bash
npm run dev
```

### 3. Access the Feature
1. Open http://localhost:3000
2. Login as admin
3. Go to Admin Dashboard (`/admin/dashboard`)
4. Click the **"3D Xonalar"** tab

### 4. Try It Out!
- 🖱️ **Click on a room** in the 3D view to select it
- 📍 **Click a floor name** in the left sidebar to switch floors
- 🔄 **Rotate/Zoom**: Use mouse to navigate the 3D space
- 📊 **View details** in the right panel

## 📁 Key Files

| File | Purpose |
|------|---------|
| `components/admin/RoomViewer3D.tsx` | Main 3D visualization component |
| `lib/3d-utils.ts` | 3D geometry and data utilities |
| `app/admin/dashboard/page.tsx` | Dashboard with 3D tab |

## 🎨 What You'll See

### Layout
```
┌─────────────────────────────────────────────────────┐
│  Admin Dashboard > 3D Xonalar                       │
├──────────────┬──────────────────────┬───────────────┤
│              │                      │               │
│ Floor List   │   3D 3D Visualization │  Room Info   │
│              │                      │               │
│ 1-Qavat  ✓  │  [3D Rooms Display]  │ Room #5      │
│ 2-Qavat     │   Interactive Canvas  │ Floor: 1     │
│ 3-Qavat     │                      │ Capacity: 4  │
│              │                      │ Occupied: 2  │
├──────────────┼──────────────────────┼───────────────┤
│ Selected     │ Controls:            │ Status: ⚡   │
│ Room #5      │ • Click = Select     │              │
│ Capacity:... │ • Drag = Rotate      │              │
└──────────────┴──────────────────────┴───────────────┘
```

## 🎮 Controls

### Mouse Controls
| Action | Result |
|--------|--------|
| Left Click | Select room and show details |
| Left Click + Drag | Rotate view |
| Right Click + Drag | Pan camera |
| Scroll Wheel | Zoom in/out |

### UI Controls
| Action | Result |
|--------|--------|
| Click floor button | Switch to floor and reset view |
| Click room in 3D | Select room and animate camera |

## 🎨 Color Coding

### Room Status Colors
- 🟢 **Green** = Empty rooms (no students)
- 🟡 **Yellow** = Partially occupied (some empty beds)
- 🔴 **Red** = Fully occupied (all beds taken)

## 📊 Sample Data

Currently uses randomly generated data:
- **3 Floors**: 1-Qavat, 2-Qavat, 3-Qavat
- **10 Rooms per floor**: Room 1-10
- **4 Capacity per room**: 4 students max
- **Random occupancy**: 0-4 students per room

## 🚀 Common Tasks

### View a Different Floor
1. Click floor name in left sidebar
2. Camera repositions to show that floor

### Check Room Details
1. Click any room in the 3D view
2. Details appear in right panel:
   - Room number
   - Floor number
   - Current occupancy
   - Room status

### Navigate the 3D View
- **Rotate**: Click and drag with left mouse button
- **Zoom**: Use mouse scroll wheel
- **Pan**: Right-click and drag

## ⚠️ Troubleshooting

### 3D View Not Loading?
1. Check browser console (F12) for errors
2. Clear browser cache (Ctrl+Shift+Delete)
3. Ensure WebGL is enabled
4. Try a different browser

### Rooms Not Clickable?
1. Wait for "3D Ko'rinish yuklanmoqda..." to disappear
2. Click directly on the colored room boxes
3. Avoid clicking empty space or walls

### Performance Issues?
1. Close other tabs
2. Reduce window size temporarily
3. Refresh the page (F5)

## 📚 Documentation

For detailed information, see:
- **`3D_ROOMS_DOCUMENTATION.md`** - Complete technical documentation
- **`IMPLEMENTATION_SUMMARY.md`** - Full implementation details

## 🔄 Next Steps

### For Users
- Explore all 3 floors
- Click different rooms to see their details
- Try navigating with mouse

### For Developers
- Review `lib/3d-utils.ts` to understand 3D creation
- Check `RoomViewer3D.tsx` component structure
- Modify sample data in `generateSampleFloors()`
- Add real database integration (see documentation)

## 💡 Tips & Tricks

✅ **Tip 1**: Double-click rooms for faster selection  
✅ **Tip 2**: Use scroll wheel for precise zoom  
✅ **Tip 3**: Right-click drag for better panning  
✅ **Tip 4**: Hold Shift while dragging for slower rotation  

## 🎯 Common Customizations

### Change Room Size
Edit `lib/3d-utils.ts`, function `createRoom()`:
```typescript
const roomWidth = 1.5 // Change this
const roomHeight = 1  // And this
const roomDepth = 1   // And this
```

### Add More Floors
Edit `lib/3d-utils.ts`, function `generateSampleFloors()`:
```typescript
for (let floorNum = 1; floorNum <= 5; floorNum++) { // Change 5 to your count
```

### Change Colors
Edit `lib/3d-utils.ts`, function `createRoom()`:
```typescript
color = new BABYLON.Color3(0.2, 0.8, 0.2) // RGB values: 0-1
```

## ✨ Features You Can Use Now

✅ 3D visualization of dormitory  
✅ Floor switching  
✅ Room selection and details  
✅ Color-coded occupancy status  
✅ Interactive camera controls  
✅ Responsive design  
✅ Smooth animations  

## 🔮 Coming Soon (Future Features)

🔲 Real database integration  
🔲 Student assignment visualization  
🔲 Room management features  
🔲 Mobile touch controls  
🔲 Advanced filtering and search  
🔲 Maintenance tracking  
🔲 Building exterior view  

## 📞 Need Help?

1. Check the **Troubleshooting** section above
2. Review **`3D_ROOMS_DOCUMENTATION.md`**
3. Check browser console for errors (F12)
4. Verify Babylon.js is installed: `npm install babylonjs`

## 🎉 You're Ready!

The 3D Xonalar Ko'rinishi feature is ready to use. Start by clicking the **"3D Xonalar"** tab in your admin dashboard!

---

**Happy exploring! 🚀**

For detailed technical information, see the full documentation files in the project root.
