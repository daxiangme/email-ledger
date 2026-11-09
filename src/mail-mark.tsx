export function MailMark({ email }: { email: string }) {
  const provider = providerOf(email)
  return (
    <span className="inline-flex size-4 shrink-0" title={provider.label} aria-hidden="true">
      {provider.icon}
    </span>
  )
}

function providerOf(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  const match = PROVIDERS.find((provider) => provider.domains.some((item) => domain === item || domain.endsWith(`.${item}`)))
  return match ?? { label: "邮箱", icon: <GenericMark /> }
}

const PROVIDERS = [
  { label: "Google", domains: ["gmail.com", "googlemail.com"], icon: <GoogleMark /> },
  {
    label: "Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.cn", "outlook.jp"],
    icon: <OutlookMark />,
  },
  { label: "Apple", domains: ["icloud.com", "me.com", "mac.com"], icon: <AppleMark /> },
  { label: "Yahoo", domains: ["yahoo.com", "yahoo.co.jp", "ymail.com"], icon: <YahooMark /> },
  { label: "QQ", domains: ["qq.com", "foxmail.com", "vip.qq.com"], icon: <QqMark /> },
  { label: "网易", domains: ["163.com", "126.com", "yeah.net"], icon: <NeteaseMark /> },
  { label: "Proton", domains: ["proton.me", "protonmail.com", "pm.me"], icon: <ProtonMark /> },
]

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4A7.2 7.2 0 0 1 5 12c0-.8.1-1.6.4-2.4V6.5H1.4A12 12 0 0 0 0 12c0 1.9.5 3.8 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  )
}

function OutlookMark() {
  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#0F6CBD" />
      <path fill="#fff" d="M13.2 6.2h6.3v11.6h-6.3z" opacity=".9" />
      <path fill="#fff" d="M4.2 7.4h8.2v9.2H4.2z" />
      <ellipse cx="8.3" cy="12" rx="2.3" ry="2.6" fill="#0F6CBD" />
    </svg>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24">
      <path className="fill-foreground" d="M16.4 12.6c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.7zM14.7 6.4c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 1.9-.5 2.5-1.2z" />
    </svg>
  )
}

function YahooMark() {
  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#6001D2" />
      <path fill="#fff" d="M6.2 6.2h2.4l2.2 5.3 1.5-3.4h2.2L10.6 18h-2.3l1.1-2.6-3.2-9.2zm8.2 0h2.3l-2.6 6.1 2.8 5.7h-2.5l-1.8-3.8-1.1 2.4V6.2h2.2l.7 4.8 1-4.8z" />
    </svg>
  )
}

function QqMark() {
  return (
    <svg viewBox="0 0 24 24">
      <ellipse cx="12" cy="13" rx="7" ry="8" fill="#12B7F5" />
      <circle cx="9.4" cy="12.2" r="1" fill="#fff" />
      <circle cx="14.6" cy="12.2" r="1" fill="#fff" />
      <path fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" d="M9.6 15.2c.8.8 4 .8 4.8 0" />
    </svg>
  )
}

function NeteaseMark() {
  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#D14836" />
      <path fill="#fff" d="M7 7.2h10v2H9.4v2.2H16v2H9.4v2.2H17v2H7z" />
    </svg>
  )
}

function ProtonMark() {
  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#6D4AFF" />
      <path fill="#fff" d="M7 16.5 12 6.5l5 10h-2.1l-.8-1.8h-4.2l-.8 1.8H7zm4.4-3.4h2.2L12 9.8l-1.6 3.3z" />
    </svg>
  )
}

function GenericMark() {
  return (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="5" fill="#E7E5E4" />
      <path fill="none" stroke="#44403C" strokeWidth="1.6" d="M6 8.5h12v8H6z" />
      <path fill="none" stroke="#44403C" strokeWidth="1.6" d="m6.5 9 5.5 4 5.5-4" />
    </svg>
  )
}
