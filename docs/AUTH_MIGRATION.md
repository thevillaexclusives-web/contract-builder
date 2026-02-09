# Authentication Migration Guide

## Will Auth Carry Over?

**Short answer: No, not automatically.** But there are solutions.

## Why Auth Won't Automatically Carry Over

### Cookie Domain Restrictions
- **Legacy app**: Runs on one domain/port (e.g., `localhost:5173` or production domain)
- **New app**: Runs on different domain/port (e.g., `localhost:3005` or different domain)
- **Cookies are domain-specific**: Auth cookies from legacy app won't be accessible to new app

### How Supabase Stores Sessions

**Legacy App (React-Vite):**
- Uses `@supabase/supabase-js` browser client
- Stores session in `localStorage` or cookies (domain-specific)
- Session token is tied to the domain where login occurred

**New App (Next.js):**
- Uses `@supabase/ssr` for server-side rendering
- Uses HTTP-only cookies (more secure)
- Session token is tied to the new app's domain

## Solutions

### Option 1: Token Exchange via URL Parameter (Recommended for Migration)

Create a redirect endpoint that accepts a session token:

**Legacy App → Redirect:**
```typescript
// In legacy app, when redirecting to new app
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // Redirect with token
  window.location.href = `http://localhost:3005/auth/callback?token=${session.access_token}`;
}
```

**New App → Accept Token:**
```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  
  if (!token) {
    redirect('/login?error=no_token')
  }
  
  const supabase = await createClient()
  
  // Set the session using the token
  const { data, error } = await supabase.auth.setSession({
    access_token: token,
    refresh_token: '', // You might need to pass this too
  })
  
  if (error) {
    redirect('/login?error=invalid_token')
  }
  
  redirect('/templates')
}
```

### Option 2: Same Domain, Different Paths

If both apps are on the same domain:
- Legacy: `example.com/legacy`
- New: `example.com/`

Cookies will be shared automatically! ✅

### Option 3: Manual Re-authentication

Users log in again on the new app. Simple but requires user action.

### Option 4: Shared Session Storage (Advanced)

Use Supabase's session storage that can be shared across domains (requires custom implementation).

## Recommended Approach

For a smooth migration:

1. **Create auth callback route** in new app (`/auth/callback`)
2. **Update legacy app** to redirect with token when navigating to new app
3. **Handle token exchange** in new app to establish session
4. **Fallback to login** if token is invalid/expired

## Implementation Steps

### Step 1: Create Callback Route

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login?error=no_token', request.url))
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  })
  
  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
  }
  
  return NextResponse.redirect(new URL('/templates', request.url))
}
```

### Step 2: Update Legacy App Redirect

```typescript
// In legacy app
const handleRedirectToNewApp = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    const redirectUrl = new URL('http://localhost:3005/auth/callback');
    redirectUrl.searchParams.set('access_token', session.access_token);
    redirectUrl.searchParams.set('refresh_token', session.refresh_token);
    window.location.href = redirectUrl.toString();
  } else {
    window.location.href = 'http://localhost:3005/login';
  }
};
```

## Security Considerations

⚠️ **Important**: Passing tokens via URL parameters is less secure than cookies. Consider:

1. **Use HTTPS** in production
2. **Short-lived tokens** - tokens expire quickly
3. **One-time use** - invalidate token after use
4. **HTTPS-only** - ensure secure transmission

## Alternative: Deep Link with Session Check

Instead of passing tokens, check if user is authenticated on legacy app, then redirect:

```typescript
// Legacy app checks session, then redirects
// New app checks if user needs to authenticate
// If same Supabase project, user can use "Remember me" or SSO
```

---

**Bottom Line**: Auth won't automatically carry over, but you can implement a token exchange flow for seamless migration.
