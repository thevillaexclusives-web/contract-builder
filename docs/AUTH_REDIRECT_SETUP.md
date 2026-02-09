# Auth Redirect Setup

## Overview

This document explains how the authentication redirect works between the legacy app and the new Contract Builder app.

## How It Works

1. **User clicks "Contract Builder"** in the legacy app header
2. **Legacy app** gets the current Supabase session
3. **Redirects** to new app with `access_token` and `refresh_token` as URL parameters
4. **New app** receives tokens at `/auth/callback`
5. **New app** establishes session using tokens
6. **User is redirected** to `/templates` page (authenticated)

## Configuration

### Legacy App (thevillaexclusive)

Add this environment variable to `.env`:

```env
VITE_NEW_CONTRACT_BUILDER_URL=http://localhost:3005
```

For production:
```env
VITE_NEW_CONTRACT_BUILDER_URL=https://your-production-domain.com
```

### New App (contract-editor)

No additional configuration needed! The callback route is already set up at `/auth/callback`.

## Files Modified

### Legacy App
- `src/components/Header.tsx` - Updated Contract Builder menu item to redirect with tokens

### New App
- `app/auth/callback/route.ts` - Handles token exchange and session establishment
- `lib/supabase/middleware.ts` - Allows `/auth/callback` route without requiring auth

## Testing

1. **Start both apps:**
   - Legacy app: `yarn dev` (usually on port 5173)
   - New app: `yarn dev` (on port 3005)

2. **Login to legacy app** with valid credentials

3. **Click "Contract Builder"** in the header dropdown menu

4. **Should redirect** to new app and be automatically authenticated

## Troubleshooting

### Issue: Redirects to login page
- **Check**: Are tokens being passed in URL?
- **Check**: Is the new app URL correct in legacy app's `.env`?
- **Check**: Are both apps using the same Supabase project?

### Issue: "Invalid token" error
- **Check**: Token might be expired (tokens expire after 1 hour by default)
- **Solution**: User needs to login again

### Issue: CORS errors
- **Check**: Both apps should be on same domain in production, or configure CORS
- **Development**: Should work fine on localhost

## Security Notes

⚠️ **Important**: 
- Tokens in URL are less secure than cookies
- Use HTTPS in production
- Tokens expire automatically (default: 1 hour)
- Consider implementing one-time token exchange for better security

## Future Improvements

- [ ] Implement one-time token exchange (invalidate token after use)
- [ ] Add token expiration check before redirect
- [ ] Add error handling UI for failed redirects
- [ ] Consider using Supabase PKCE flow for better security
