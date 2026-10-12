import bannerLg from "@/assets/banner-beranda-agung-adi.webp";
import bannerSm from "@/assets/banner-beranda-agung-adi-sm.webp";

/** Banner utama Beranda (gambar asli dari pemilik toko). Klik membuka Shop. */
export default function HomeHeroBanner({ onExplore }: { onExplore: () => void }) {
  return (
    <section aria-label="Banner Agung Adi Store" className="mx-auto max-w-[1400px]">
      <button
        type="button"
        onClick={onExplore}
        aria-label="Selamat datang di Agung Adi Store — jelajahi Shop"
        className="block w-full overflow-hidden rounded-[20px] border border-border bg-card shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={bannerLg}
          srcSet={`${bannerSm} 836w, ${bannerLg} 1672w`}
          sizes="(max-width: 900px) 100vw, 1400px"
          width={1672}
          height={941}
          alt="Selamat datang di Agung Adi Store — Tempat Web Murah, Aman, Terpercaya"
          className="block aspect-[1672/941] h-auto w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
      </button>
    </section>
  );
}
