import Image from "next/image";

/**
 * Committee logo as a faint, fixed background watermark. It sits above the page
 * at very low opacity (so it shows over cards too) and ignores pointer events.
 * The logo is a square JPG with corner ornaments, so it is cropped to a circle.
 */
export function Watermark() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center print:hidden">
      <Image
        src="/logo.jpg"
        alt=""
        width={640}
        height={640}
        priority={false}
        className="size-[min(70vmin,520px)] rounded-full object-cover opacity-[0.06] dark:opacity-[0.05] dark:grayscale"
      />
    </div>
  );
}
