'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, LogOut, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  userEmail?: string
  userName?: string
}

export default function Header({ userEmail, userName }: HeaderProps) {
  const [isMobile, setIsMobile] = useState(false)
  const legacyAppUrl = process.env.NEXT_PUBLIC_LEGACY_APP_URL || 'http://localhost:5173'

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Redirect to main legacy app after clearing session
    window.location.href = legacyAppUrl
  }

  const handleGoToPMS = () => {
    window.location.href = `${legacyAppUrl}/v1/pms/dashboard`
  }

  const displayName = userName || userEmail?.split('@')[0] || 'User'

  return (
    <nav className="border-b bg-black">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Brand */}
          <div className="flex items-center">
            <h1 className="text-lg sm:text-xl font-medium text-gray-300">
              Contract Builder V2
            </h1>
          </div>

          {/* Center - Navigation (Desktop only) */}
          {!isMobile && (
            <div className="flex items-center gap-4">
              <Link
                href="/templates"
                className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                Templates
              </Link>
              <Link
                href="/contracts"
                className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
              >
                Contracts
              </Link>
            </div>
          )}

          {/* Right side - User info and menu */}
          <div className="flex items-center gap-2 sm:gap-4">
            {!isMobile && userEmail && (
              <div className="text-right mr-2">
                <div className="text-xs text-gray-500 text-right">
                  {displayName}
                  <br />
                  {userEmail}
                </div>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 cursor-pointer transition-colors text-white">
                  <User className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleGoToPMS}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Property Management App
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
