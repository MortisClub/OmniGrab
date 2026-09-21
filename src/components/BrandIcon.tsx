const paths: Record<string, JSX.Element> = {
  youtube: (
    <path d="M2.5 12s0-3.3.4-4.9c.2-.9.9-1.6 1.8-1.8C6.3 4.9 12 4.9 12 4.9s5.7 0 7.3.4c.9.2 1.6.9 1.8 1.8.4 1.6.4 4.9.4 4.9s0 3.3-.4 4.9c-.2.9-.9 1.6-1.8 1.8-1.6.4-7.3.4-7.3.4s-5.7 0-7.3-.4c-.9-.2-1.6-.9-1.8-1.8C2.5 15.3 2.5 12 2.5 12Zm6.5-2.8v5.6L14.5 12 9 9.2Z" />
  ),
  tiktok: (
    <path d="M14.5 3.5v2.6c.8.6 1.9 1 3 1V9.6c-1.1 0-2.2-.3-3-1v6.6c0 2.9-2 4.8-4.7 4.8A4.5 4.5 0 0 1 5 15.5c0-2.6 2-4.5 4.7-4.4v2.6c-1.2-.1-2.1.7-2.1 1.8 0 1 .8 1.8 1.9 1.8 1.2 0 2-.8 2-2.1V3.5h3Z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.2" cy="6.8" r="1.3" />
    </>
  ),
  vk: (
    <path d="M2.5 6.5c.3 4.7 2.8 8 7.3 9.9h.3v-3.5h2c1.5.1 2.7 1.5 3.2 3.5h2.6c-.6-2.2-2-3.6-3.2-4.1.9-.6 2.4-2 2.8-4h-2.4c-.5 1.4-1.8 2.5-2.9 2.6V6.5h-2.5v6.1c-1.6-.4-3.7-2-4-6.1H2.5Z" />
  ),
  x: (
    <path d="M4 3.5h4.6l4 5.7 4.7-5.7h2.2l-5.8 7 6.1 8.5h-4.6l-4.4-6.2-5.1 6.2H3.5l6.3-7.6L4 3.5Z" />
  ),
  twitch: (
    <path d="M4 3.5h16v11l-4.5 4.5H11l-2.5 2.5H6v-2.5H4V3.5Zm4 3v5h2.5v-5H8Zm5.5 0v5h2.5v-5h-2.5Z" />
  ),
  soundcloud: (
    <path d="M2.5 15.5v-4h1.5v4h-1.5Zm3-5.5v5.5h1.5V10h-1.5Zm3-1.5V15.5H10V8.5H8.5Zm3-1v8H13v-8h-1.5Zm6.5 1.8c-.6-.4-1.3-.6-2-.5v6.7h4.5v-4c0-1-.9-2-2.5-2.2Z" />
  ),
};

export type Brand = keyof typeof paths;

export const brandLabels: Record<Brand, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  vk: "VK",
  x: "X",
  twitch: "Twitch",
  soundcloud: "SoundCloud",
};

export function BrandIcon({ brand, size = 24 }: { brand: Brand; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`brand-icon brand-${brand}`}
      aria-label={brandLabels[brand]}
    >
      {paths[brand]}
    </svg>
  );
}
