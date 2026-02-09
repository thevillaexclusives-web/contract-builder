# Verification Checklist

Use this checklist to verify your app is running correctly.

## ✅ Pre-Run Checks

- [x] Dependencies installed (`yarn install`)
- [x] Environment variables set (`.env.local` exists)
- [ ] shadcn/ui initialized (optional for now - not needed yet)

## 🚀 Running the App

```bash
cd contract-editor
yarn dev
```

The server should start on `http://localhost:3000`

## ✅ What to Verify

### 1. Server Starts Successfully
- [ ] No build errors in terminal
- [ ] Server shows "Ready" message
- [ ] Port 3000 is accessible

### 2. Home Page Redirects
- [ ] Visit `http://localhost:3000`
- [ ] Should redirect to `/templates` (or `/login` if not authenticated)

### 3. Navigation Works
- [ ] Can navigate to `/templates`
- [ ] Can navigate to `/contracts`
- [ ] Navigation links work in dashboard layout

### 4. Pages Render
- [ ] Templates page shows placeholder content
- [ ] Contracts page shows placeholder content
- [ ] No console errors in browser

### 5. Supabase Connection (if authenticated)
- [ ] No Supabase connection errors in console
- [ ] Middleware redirects work correctly

## ⚠️ Common Issues

### Issue: "Module not found" errors
**Solution:** Make sure all dependencies are installed:
```bash
yarn install
```

### Issue: "Environment variable not found"
**Solution:** Check `.env.local` file exists and has correct values

### Issue: Redirects to `/login` but login page doesn't work
**Solution:** This is expected - login page is a placeholder. For testing, you can temporarily disable auth in middleware.

### Issue: TypeScript errors
**Solution:** Check that `types/database.ts` has valid types (currently using placeholders)

## 🎯 Expected Behavior

1. **Home (`/`)**: Redirects to `/templates`
2. **Templates (`/templates`)**: Shows "Templates list page - to be implemented"
3. **Contracts (`/contracts`)**: Shows "Contracts list page - to be implemented"
4. **Navigation**: Dashboard layout shows navigation links
5. **Styling**: Tailwind CSS should be working (check for styled elements)

## 📝 Next Steps After Verification

Once everything is verified:
1. ✅ Start implementing TipTap editor
2. ✅ Build template management UI
3. ✅ Build contract management UI
4. ✅ Implement PDF export

---

*If everything checks out, you're ready to start building features!*
