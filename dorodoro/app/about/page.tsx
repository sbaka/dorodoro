import Image from "next/image";
import Link from "next/link";

import { SiteHeader } from "@/app/components/site-header";

const images = [
  { src: "/assets/Happy tomato.png", alt: "Happy tomato mascot" },
  { src: "/assets/cerise.png", alt: "Cherry mascot" },
  { src: "/assets/Strong_pepper.png", alt: "Pepper mascot" },
  { src: "/assets/joinUS.png", alt: "Welcome illustration" },
];

export default function Page() {
  return (
    <div className="page-frame">
      <SiteHeader mode="public" />

      <main className="about-page mt-5">
        <section className="about-shell surface-card p-8">
          <div >
            <p className="dash-eyebrow">About DoroDoro</p>
            <h1>Short focus blocks, softer pacing, and a cleaner workspace.</h1>
            <p>
              The public About page stays lightweight. The richer product story, account controls,
              privacy tools, and legal links now live together inside settings once you are signed in.
            </p>
            <div className="settings-link-list">
              <Link href="/login" className="secondary-pill">
                Sign in for full settings
              </Link>
              <Link href="/privacy" className="secondary-pill">
                Privacy
              </Link>
              <Link href="/terms" className="secondary-pill">
                Terms
              </Link>
            </div>
          </div>

          <div className="imagesContainer">
            {images.map((image) => (
              <div key={image.src} className="about-image-card">
                <Image src={image.src} alt={image.alt} width={220} height={220} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}